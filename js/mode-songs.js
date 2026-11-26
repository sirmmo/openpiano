/* Songs: notes fall onto the keys. In "wait for me" mode the song stops at
 * each note until the child presses the right key. */
(function () {
  'use strict';
  const OP = window.OP;
  const N = () => OP.notes;
  const $ = (s) => document.querySelector(s);
  const t = (k, v) => OP.t(k, v);

  const LEAD_IN = 3; // beats of falling before the first note when pressing Start
  const EARLY = 0.6; // beats: how early a right key is accepted in wait mode
  const WINDOW = 0.4; // beats: timing window in play-along mode

  let song = null, notes = [], next = 0, time = 0, state = 'ready', mistakes = 0, hits = 0;
  let canvas, ctx, W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  let particles = [];
  let demoPlayed = -1;
  let active = false;

  const S = OP.settings;
  if (S.speed == null) S.speed = 1;
  if (S.waitMode == null) S.waitMode = true;

  /* ---------- picker ---------- */
  function renderPicker() {
    const grid = $('#songGrid');
    grid.innerHTML = '';
    OP.songs.list.forEach((s) => {
      const parsed = OP.songs.parse(s);
      const stars = OP.store.stars('song:' + s.id);
      const b = document.createElement('button');
      b.className = 'song-card';
      b.style.setProperty('--c', N().color(parsed[0].midi));
      const dots = parsed.slice(0, 10).map((n) => '<i style="background:' + N().color(n.midi) + '"></i>').join('');
      b.innerHTML =
        '<span class="song-level" aria-label="' + t('level') + ' ' + s.level + '">' + '●'.repeat(s.level) + '<span class="dim">' + '●'.repeat(3 - s.level) + '</span></span>' +
        '<span class="song-title">' + OP.songs.title(s) + '</span>' +
        '<span class="song-dots">' + dots + '</span>' +
        '<span class="stars">' + starHtml(stars) + '</span>';
      b.addEventListener('click', () => open(s));
      grid.appendChild(b);
    });
  }

  function starHtml(n) {
    return [1, 2, 3].map((i) => '<span class="star' + (i <= n ? ' on' : '') + '">★</span>').join('');
  }

  function showPicker() {
    stop();
    song = null;
    $('#songPicker').hidden = false;
    $('#songPlayer').hidden = true;
    OP.app.kb.clearTargets();
    OP.app.restoreKeyboard();
    renderPicker();
  }

  /* ---------- player ---------- */
  function open(s) {
    song = s;
    $('#songPicker').hidden = true;
    $('#songPlayer').hidden = false;
    $('#songTitle').textContent = OP.songs.title(s);
    const ps = OP.songs.parse(s);
    OP.app.fitKeyboard(Math.min(...ps.map((n) => n.midi)), Math.max(...ps.map((n) => n.midi)));
    resize();
    reset();
    loop();
  }

  function reset() {
    notes = OP.songs.parse(song).map((n) => Object.assign({}, n, { state: '' }));
    next = 0;
    mistakes = 0;
    hits = 0;
    time = -LEAD_IN;
    state = 'ready';
    particles = [];
    $('#songResult').hidden = true;
    setMsg(t('songReady'));
    updateButtons();
    updateTarget();
    updateScore();
  }

  function setMsg(s) { const el = $('#playerMsg'); el.textContent = s || ''; el.hidden = !s; }

  function updateButtons() {
    const play = $('#playBtn');
    play.textContent = state === 'playing' ? t('pause') : state === 'paused' ? t('resume') : t('startBtn');
    play.disabled = state === 'demo' || state === 'done';
    $('#listenBtn').textContent = state === 'demo' ? '■ ' + t('stopListen') : '♪ ' + t('listen');
    $('#waitToggle').checked = S.waitMode;
    $('#speedRange').value = S.speed;
    $('#speedVal').textContent = Math.round(S.speed * 100) + '%';
  }

  function updateTarget() {
    const n = notes[next];
    if (n && state !== 'done') OP.app.kb.target(n.midi, n.finger);
    else OP.app.kb.clearTargets();
  }

  function updateScore() {
    $('#songProgress').style.width = (notes.length ? (100 * next) / notes.length : 0) + '%';
    $('#songOops').textContent = S.waitMode ? t('oops', { n: mistakes }) : t('hits', { a: hits, b: notes.length });
  }

  function start() {
    if (state === 'ready') { state = 'playing'; setMsg(''); }
    else if (state === 'paused') state = 'playing';
    else if (state === 'playing') state = 'paused';
    updateButtons();
  }

  function listen() {
    if (state === 'demo') { reset(); return; }
    reset();
    state = 'demo';
    time = -1;
    demoPlayed = -1;
    setMsg('');
    updateButtons();
  }

  function finish() {
    state = 'done';
    OP.app.kb.clearTargets();
    let stars;
    if (S.waitMode) stars = mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1;
    else { const acc = hits / notes.length; stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1; }
    const record = OP.store.award('song:' + song.id, stars);
    OP.emit('progress');
    OP.audio.sfx.fanfare();
    burst(W / 2, H / 2, 70, null);
    const box = $('#songResult');
    box.querySelector('.result-stars').innerHTML = starHtml(stars);
    box.querySelector('.result-title').textContent = stars === 3 ? t('great') : stars === 2 ? t('good') : t('ok');
    box.querySelector('.result-detail').textContent =
      (S.waitMode ? t('oops', { n: mistakes }) : t('hits', { a: hits, b: notes.length })) + (record ? ' · ' + t('newRecord') : '');
    const idx = OP.songs.list.indexOf(song);
    box.querySelector('[data-act="next"]').hidden = idx >= OP.songs.list.length - 1;
    box.hidden = false;
    updateButtons();
  }

  function hit(n) {
    n.state = 'hit';
    hits++;
    next++;
    const g = OP.app.kb.keyGeom(n.midi);
    if (g) burst(((g.x + g.w / 2) / 100) * W, H - 4, 14, N().color(n.midi));
    OP.app.kb.flash(n.midi, 'good');
    updateTarget();
    updateScore();
  }

  function noteOn(m) {
    if (!song || state === 'demo' || state === 'done' || state === 'paused') return;
    const n = notes[next];
    if (!n) return;
    if (state === 'ready') {
      if (m !== n.midi) return;
      state = 'playing';
      time = n.start;
      setMsg('');
      updateButtons();
      hit(n);
      return;
    }
    if (S.waitMode) {
      // The song follows the child: a right key, even early, moves the song on to it.
      if (m === n.midi) { if (time < n.start) time = n.start; hit(n); }
      else if (time >= n.start - EARLY) { mistakes++; OP.app.kb.flash(m, 'bad'); updateScore(); }
    } else if (m === n.midi && Math.abs(time - n.start) <= WINDOW) hit(n);
    else OP.app.kb.flash(m, 'bad');
  }

  /* ---------- animation ---------- */
  function step(dt) {
    const bps = (song.bpm / 60) * S.speed;
    if (state === 'playing') {
      let target = time + dt * bps;
      const n = notes[next];
      if (S.waitMode && n && target >= n.start) target = n.start; // wait for the child
      time = target;
      if (!S.waitMode) {
        while (notes[next] && time > notes[next].start + WINDOW) { notes[next].state = 'miss'; next++; updateTarget(); updateScore(); }
      }
      if (next >= notes.length && time >= song.length + 0.3) finish();
    } else if (state === 'demo') {
      time += dt * bps;
      for (let i = demoPlayed + 1; i < notes.length && notes[i].start <= time; i++) {
        const nn = notes[i];
        OP.app.play(nn.midi, Math.max(0.15, (nn.dur / bps) * 0.92), 85, true);
        nn.state = 'hit';
        demoPlayed = i;
        next = i + 1;
        updateTarget();
        updateScore();
      }
      if (time >= song.length + 1) reset();
    }
    particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.life -= dt; });
    particles = particles.filter((p) => p.life > 0);
  }

  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const kb = OP.app.kb;
    const pxb = Math.max(46, Math.min(120, H / 5.5)); // pixels per beat
    const hitY = H - 4;

    // Lanes: a faint line at every C, shaded black-key lanes.
    for (let m = kb.lo; m <= kb.hi; m++) {
      const g = kb.keyGeom(m);
      if (!g) continue;
      if (g.black) { ctx.fillStyle = 'rgba(60,40,90,0.04)'; ctx.fillRect((g.x / 100) * W, 0, (g.w / 100) * W, H); }
      if (N().pc(m) === 0) { ctx.fillStyle = 'rgba(60,40,90,0.10)'; ctx.fillRect((g.x / 100) * W, 0, 1, H); }
    }

    // Hit line, glowing in the colour of the next note.
    const nx = notes[next];
    const waiting = state === 'playing' && S.waitMode && nx && time >= nx.start;
    ctx.fillStyle = nx ? N().color(nx.midi) : '#c9bfd9';
    ctx.globalAlpha = waiting ? 0.55 + 0.45 * Math.sin(now / 160) : 0.8;
    ctx.fillRect(0, hitY - 2, W, 4);
    ctx.globalAlpha = 1;

    const style = S.noteNames === 'both' ? 'letters' : S.noteNames;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const bottom = hitY - (n.start - time) * pxb;
      const top = bottom - n.dur * pxb + 3;
      if (top > H || bottom < -10) continue;
      const g = kb.keyGeom(n.midi);
      if (!g) continue;
      const x = (g.x / 100) * W + 2, w = (g.w / 100) * W - 4, h = bottom - top;
      const col = N().color(n.midi);
      ctx.globalAlpha = n.state === 'hit' ? 0.28 : n.state === 'miss' ? 0.25 : 1;
      ctx.fillStyle = n.state === 'miss' ? '#a8a1b3' : col;
      rr(x, top, w, h, 9);
      ctx.fill();
      ctx.lineWidth = i === next ? 3 : 1.5;
      ctx.strokeStyle = i === next ? '#2b2238' : N().shade(col, 0.7);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (n.state === '' && h > 20 && w > 16) {
        const fs = Math.min(18, w * 0.45);
        ctx.fillStyle = '#2b2238';
        ctx.font = '700 ' + fs + 'px ' + getComputedStyle(document.body).fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(N().name(n.midi, style), x + w / 2, bottom - 6);
        if (n.finger && h > 44) {
          const cy = bottom - 6 - fs - 12;
          ctx.beginPath();
          ctx.arc(x + w / 2, cy, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.fillStyle = '#2b2238';
          ctx.font = '800 13px ' + getComputedStyle(document.body).fontFamily;
          ctx.textBaseline = 'middle';
          ctx.fillText(String(n.finger), x + w / 2, cy + 1);
        }
      }
    }

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  const CONFETTI = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#b197fc'];
  function burst(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const v = 180 + Math.random() * (color ? 220 : 520);
      const life = 0.6 + Math.random() * (color ? 0.4 : 1.2);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2 + Math.random() * 4, c: color || CONFETTI[i % CONFETTI.length], life, max: life });
    }
  }

  function loop() {
    cancelAnimationFrame(raf);
    last = performance.now();
    const frame = (now) => {
      if (!active || !song) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt);
      draw(now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function stop() { cancelAnimationFrame(raf); }

  function resize() {
    if (!canvas) return;
    const r = canvas.parentElement.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
  }

  /* ---------- wiring ---------- */
  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    canvas = $('#lane');
    ctx = canvas.getContext('2d');
    $('#backBtn').addEventListener('click', showPicker);
    $('#playBtn').addEventListener('click', start);
    $('#listenBtn').addEventListener('click', listen);
    $('#restartBtn').addEventListener('click', reset);
    $('#waitToggle').addEventListener('change', (e) => { OP.store.set('waitMode', e.target.checked); reset(); });
    $('#speedRange').addEventListener('input', (e) => { OP.store.set('speed', +e.target.value); updateButtons(); });
    $('#songResult').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'again') reset();
      if (act.dataset.act === 'list') showPicker();
      if (act.dataset.act === 'next') open(OP.songs.list[OP.songs.list.indexOf(song) + 1]);
    });
    // Space bar = start / pause while a song is open.
    window.addEventListener('keydown', (e) => {
      if (!active || !song || e.code !== 'Space' || e.repeat || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      if (state === 'ready' || state === 'playing' || state === 'paused') start();
    });
  }

  OP.registerMode('songs', {
    enter() { wire(); active = true; if (song) { open(song); } else showPicker(); },
    exit() { active = false; stop(); if (state === 'playing') state = 'paused'; },
    noteOn,
    resize() { resize(); },
  });
  OP.on('keyboard-resized', () => { if (active && song) resize(); });
  OP.on('texts', () => {
    if (!active) return;
    if (song) { $('#songTitle').textContent = OP.songs.title(song); updateButtons(); updateScore(); if (state === 'ready') setMsg(t('songReady')); }
    else renderPicker();
  });
  OP.on('progress', () => { if (active && !song) renderPicker(); });
})();
