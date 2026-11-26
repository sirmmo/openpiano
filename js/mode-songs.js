/* Songs: notes fall onto the keys. Each song has parts (right hand, left-hand
 * chords, MIDI tracks); each part is played by the child, played by the app,
 * or muted. In "wait for me" mode the song stops at every note or chord until
 * all of its keys have been pressed. */
(function () {
  'use strict';
  const OP = window.OP;
  const N = () => OP.notes;
  const $ = (s) => document.querySelector(s);
  const t = (k, v) => OP.t(k, v);

  const LEAD_IN = 3; // beats of falling before the first note when pressing Start
  const EARLY = 0.6; // beats: a wrong key this close to the next note counts as an oops
  const WINDOW = 0.4; // beats: timing window in play-along mode
  const CHORD_GAP = 0.08; // beats: notes starting this close together form one chord

  let model = null, roles = [];
  let notes = [], playNotes = [], autoNotes = [], groups = [];
  let gi = 0, autoIdx = 0, time = 0, state = 'ready', mistakes = 0, hits = 0;
  let canvas, ctx, W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  let particles = [];
  let active = false;

  const S = OP.settings;
  if (S.speed == null) S.speed = 1;
  if (S.waitMode == null) S.waitMode = true;
  if (!S.roles) S.roles = {};

  const starHtml = (n) => [1, 2, 3].map((i) => '<span class="star' + (i <= n ? ' on' : '') + '">★</span>').join('');

  /* ---------- picker ---------- */
  function card(m, title, extra) {
    const b = document.createElement('div');
    b.className = 'song-card';
    b.tabIndex = 0;
    b.setAttribute('role', 'button');
    const first = m ? m.parts[0].notes : [];
    b.style.setProperty('--c', first.length ? N().color(first[0].midi) : 'var(--accent)');
    const dots = first.slice(0, 10).map((n) => '<i style="background:' + N().color(n.midi) + '"></i>').join('');
    b.innerHTML = (extra.top || '') + '<span class="song-title">' + title + '</span>' + '<span class="song-dots">' + dots + '</span>' + (extra.bottom || '');
    return b;
  }

  function renderPicker() {
    const grid = $('#songGrid');
    grid.innerHTML = '';
    OP.songs.list.forEach((s) => {
      const m = OP.songs.model(s);
      const b = card(m, OP.songs.title(s), {
        top: '<span class="song-level" aria-label="' + t('level') + ' ' + s.level + '">' + '●'.repeat(s.level) + '<span class="dim">' + '●'.repeat(3 - s.level) + '</span>' +
          (m.parts.length > 1 ? ' <span class="badge">' + t('withChords') + '</span>' : '') + '</span>',
        bottom: '<span class="stars">' + starHtml(OP.store.stars(m.id)) + '</span>',
      });
      const go = () => open(m);
      b.addEventListener('click', go);
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      grid.appendChild(b);
    });

    const mine = $('#midiGrid');
    mine.innerHTML = '';
    const add = document.createElement('button');
    add.className = 'song-card add-card';
    add.innerHTML = '<span class="add-plus" aria-hidden="true">+</span><span class="song-title">' + t('openMidi') + '</span><span class="add-hint">' + t('openMidiHint') + '</span>';
    add.addEventListener('click', () => $('#midiInput').click());
    mine.appendChild(add);
    OP.midiFile.library.list().forEach((e) => {
      const b = card(null, e.title, {
        top: '<span class="song-level"><span class="badge">MIDI</span></span>',
        bottom: '<span class="stars">' + starHtml(OP.store.stars('midi:' + e.id)) + '</span><button class="card-x" aria-label="' + t('remove') + '" title="' + t('remove') + '">×</button>',
      });
      const go = () => {
        try { open(OP.midiFile.library.load(e.id)); } catch (err) { OP.app.toast(t('midiBad')); }
      };
      b.addEventListener('click', (ev) => {
        if (ev.target.closest('.card-x')) {
          if (confirm(t('removeConfirm', { name: e.title }))) { OP.midiFile.library.remove(e.id); renderPicker(); }
          return;
        }
        go();
      });
      b.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
      mine.appendChild(b);
    });
  }

  function showPicker() {
    stop();
    model = null;
    $('#songPicker').hidden = false;
    $('#songPlayer').hidden = true;
    OP.app.kb.clearTargets();
    OP.app.restoreKeyboard();
    renderPicker();
  }

  async function importFile(file) {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const title = file.name.replace(/\.(mid|midi|kar|rmi)$/i, '');
      const res = OP.midiFile.library.add(title, buf);
      if (!res.saved) OP.app.toast(t('midiNotSaved'), 4000);
      open(res.model);
    } catch (err) {
      console.warn(err);
      OP.app.toast(t('midiBad'), 4000);
    }
  }

  /* ---------- player ---------- */
  function open(m) {
    model = m;
    roles = (S.roles[m.id] && S.roles[m.id].length === m.parts.length) ? S.roles[m.id].slice() : m.parts.map((p) => p.role);
    $('#songPicker').hidden = true;
    $('#songPlayer').hidden = false;
    $('#songTitle').textContent = OP.songs.title(m);
    renderParts();
    fit();
    resize();
    reset();
    loop();
  }

  function fit() {
    const used = model.parts.filter((p, i) => roles[i] !== 'mute').flatMap((p) => p.notes.map((n) => n.midi));
    if (used.length) OP.app.fitKeyboard(Math.min(...used), Math.max(...used));
  }

  function renderParts() {
    const bar = $('#partsBar');
    bar.innerHTML = '';
    bar.hidden = model.parts.length < 2;
    model.parts.forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'part-chip';
      b.dataset.role = roles[i];
      b.innerHTML = '<span class="part-name">' + OP.songs.partName(p) + '</span><span class="part-role">' + t('role_' + roles[i]) + '</span>';
      b.title = t('roleHint');
      b.addEventListener('click', () => {
        roles[i] = { play: 'listen', listen: 'mute', mute: 'play' }[roles[i]];
        S.roles[model.id] = roles.slice();
        OP.store.save();
        renderParts();
        OP.app.restoreKeyboard();
        fit();
        resize();
        reset();
      });
      bar.appendChild(b);
    });
  }

  function reset() {
    notes = [];
    model.parts.forEach((p, pi) => {
      if (roles[pi] === 'mute') return;
      p.notes.forEach((n) => notes.push(Object.assign({}, n, { part: pi, play: roles[pi] === 'play', state: '' })));
    });
    notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
    playNotes = notes.filter((n) => n.play);
    autoNotes = notes.filter((n) => !n.play);
    groups = [];
    playNotes.forEach((n) => {
      const g = groups[groups.length - 1];
      if (g && n.start - g.start <= CHORD_GAP) g.notes.push(n);
      else groups.push({ start: n.start, notes: [n] });
    });
    gi = 0;
    autoIdx = 0;
    mistakes = 0;
    hits = 0;
    time = -LEAD_IN;
    state = 'ready';
    particles = [];
    $('#songResult').hidden = true;
    setMsg(groups.length ? t('songReady') : t('nothingToPlay'));
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
    const g = groups[gi];
    if (g && state !== 'done' && state !== 'demo') OP.app.kb.targets(g.notes.filter((n) => !n.state).map((n) => ({ midi: n.midi, finger: n.finger })));
    else OP.app.kb.clearTargets();
  }

  function updateScore() {
    $('#songProgress').style.width = (groups.length ? (100 * gi) / groups.length : 0) + '%';
    $('#songOops').textContent = !groups.length ? '' : S.waitMode ? t('oops', { n: mistakes }) : t('hits', { a: hits, b: playNotes.length });
  }

  function bpmAt(beat) {
    let bpm = model.tempos[0].bpm;
    for (const tp of model.tempos) { if (tp.beat <= beat) bpm = tp.bpm; else break; }
    return bpm;
  }

  function start() {
    if (state === 'ready') { state = 'playing'; setMsg(''); }
    else if (state === 'paused') state = 'playing';
    else if (state === 'playing') state = 'paused';
    updateButtons();
    updateTarget();
  }

  function listen() {
    if (state === 'demo') { reset(); return; }
    reset();
    state = 'demo';
    time = Math.min(0, notes.length ? notes[0].start - 1 : 0);
    autoIdx = 0;
    setMsg('');
    updateButtons();
    updateTarget();
  }

  function finish() {
    state = 'done';
    OP.app.kb.clearTargets();
    if (!groups.length) { reset(); return; }
    let stars;
    if (S.waitMode) stars = mistakes <= Math.max(1, groups.length * 0.05) ? 3 : mistakes <= Math.max(4, groups.length * 0.15) ? 2 : 1;
    else { const acc = hits / playNotes.length; stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1; }
    const record = OP.store.award(model.id, stars);
    OP.emit('progress');
    OP.audio.sfx.fanfare();
    burst(W / 2, H / 2, 70, null);
    const box = $('#songResult');
    box.querySelector('.result-stars').innerHTML = starHtml(stars);
    box.querySelector('.result-title').textContent = stars === 3 ? t('great') : stars === 2 ? t('good') : t('ok');
    box.querySelector('.result-detail').textContent =
      (S.waitMode ? t('oops', { n: mistakes }) : t('hits', { a: hits, b: playNotes.length })) + (record ? ' · ' + t('newRecord') : '');
    const idx = OP.songs.list.findIndex((s) => s.model === model);
    box.querySelector('[data-act="next"]').hidden = idx < 0 || idx >= OP.songs.list.length - 1;
    box.hidden = false;
    updateButtons();
  }

  function hit(n) {
    n.state = 'hit';
    hits++;
    const g = OP.app.kb.keyGeom(n.midi);
    if (g) burst(((g.x + g.w / 2) / 100) * W, H - 4, 12, N().color(n.midi));
    OP.app.kb.flash(n.midi, 'good');
    while (groups[gi] && groups[gi].notes.every((x) => x.state)) gi++;
    updateTarget();
    updateScore();
  }

  function noteOn(m) {
    if (!model || state === 'demo' || state === 'done' || state === 'paused') return;
    const g = groups[gi];
    if (!g) return;
    if (state === 'ready') {
      const n = g.notes.find((x) => x.midi === m && !x.state);
      if (!n) return;
      state = 'playing';
      time = g.start;
      setMsg('');
      updateButtons();
      hit(n);
      return;
    }
    if (S.waitMode) {
      // The song follows the child: a right key, even early, moves the song on to it.
      const n = g.notes.find((x) => x.midi === m && !x.state);
      if (n) { if (time < g.start) time = g.start; hit(n); }
      else if (!g.notes.some((x) => x.midi === m) && time >= g.start - EARLY) { mistakes++; OP.app.kb.flash(m, 'bad'); updateScore(); }
    } else {
      let best = null;
      for (let k = gi; k < groups.length && groups[k].start <= time + WINDOW; k++) {
        for (const x of groups[k].notes) if (x.midi === m && !x.state && Math.abs(time - x.start) <= WINDOW) { best = x; break; }
        if (best) break;
      }
      if (best) hit(best);
      else OP.app.kb.flash(m, 'bad');
    }
  }

  /** Play the app's notes whose time has come (skipping any the song jumped over). */
  function autoplay(list, bps) {
    while (autoIdx < list.length && list[autoIdx].start <= time) {
      const n = list[autoIdx++];
      if (n.start < time - 0.5) continue;
      OP.app.play(n.midi, Math.max(0.12, (n.dur / bps) * 0.95), n.vel || 85, n.play ? true : 'auto');
      if (state === 'demo') n.state = 'hit';
    }
  }

  /* ---------- animation ---------- */
  function step(dt) {
    const bps = (bpmAt(Math.max(0, time)) / 60) * S.speed;
    if (state === 'playing') {
      let target = time + dt * bps;
      const g = groups[gi];
      if (S.waitMode && g && target >= g.start) target = g.start; // wait for the child
      time = target;
      autoplay(autoNotes, bps);
      if (!S.waitMode) {
        while (groups[gi] && time > groups[gi].start + WINDOW) {
          groups[gi].notes.forEach((x) => { if (!x.state) x.state = 'miss'; });
          gi++;
          updateTarget();
          updateScore();
        }
      }
      if (gi >= groups.length && time >= model.length + 0.3) finish();
    } else if (state === 'demo') {
      time += dt * bps;
      autoplay(notes, bps);
      if (time >= model.length + 1) reset();
    }
    particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.life -= dt; });
    particles = particles.filter((p) => p.life > 0);
  }

  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
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
    const font = getComputedStyle(document.body).fontFamily;

    // Lanes: a faint line at every C, shaded black-key lanes.
    for (let m = kb.lo; m <= kb.hi; m++) {
      const g = kb.keyGeom(m);
      if (!g) continue;
      if (g.black) { ctx.fillStyle = 'rgba(60,40,90,0.04)'; ctx.fillRect((g.x / 100) * W, 0, (g.w / 100) * W, H); }
      if (N().pc(m) === 0) { ctx.fillStyle = 'rgba(60,40,90,0.10)'; ctx.fillRect((g.x / 100) * W, 0, 1, H); }
    }

    // Hit line, glowing in the colour of the next note.
    const g0 = groups[gi];
    const waiting = state === 'playing' && S.waitMode && g0 && time >= g0.start;
    ctx.fillStyle = g0 ? N().color(g0.notes[0].midi) : '#c9bfd9';
    ctx.globalAlpha = waiting ? 0.55 + 0.45 * Math.sin(now / 160) : 0.8;
    ctx.fillRect(0, hitY - 2, W, 4);
    ctx.globalAlpha = 1;

    const current = new Set(g0 ? g0.notes : []);
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const bottom = hitY - (n.start - time) * pxb;
      if (bottom < -10) break; // sorted by start: every later note is above the screen too
      const top = bottom - n.dur * pxb + 3;
      if (top > H) continue; // already went past the keys
      const g = kb.keyGeom(n.midi);
      if (!g) continue;
      const x = (g.x / 100) * W + 2, w = (g.w / 100) * W - 4, h = Math.max(4, bottom - top);
      const col = N().color(n.midi);
      if (n.play) {
        ctx.globalAlpha = n.state === 'hit' ? 0.28 : n.state === 'miss' ? 0.25 : 1;
        ctx.fillStyle = n.state === 'miss' ? '#a8a1b3' : col;
        rr(x, top, w, h, 9);
        ctx.fill();
        const isCur = current.has(n) && !n.state;
        ctx.lineWidth = isCur ? 3 : 1.5;
        ctx.strokeStyle = isCur ? '#2b2238' : N().shade(col, 0.7);
        ctx.stroke();
      } else {
        // The app plays these: pale, so the child knows they are not theirs.
        ctx.globalAlpha = state === 'demo' && n.state === 'hit' ? 0.15 : 0.32;
        ctx.fillStyle = col;
        rr(x + 2, top, w - 4, h, 6);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.strokeStyle = N().shade(col, 0.6);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (n.play && !n.state && h > 20 && w > 16) {
        const fs = Math.min(18, w * 0.45);
        ctx.fillStyle = '#2b2238';
        ctx.font = '700 ' + fs + 'px ' + font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(N().shortName(n.midi), x + w / 2, bottom - 6);
        if (n.finger && h > 44) {
          const cy = bottom - 6 - fs - 12;
          ctx.beginPath();
          ctx.arc(x + w / 2, cy, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.fillStyle = '#2b2238';
          ctx.font = '800 13px ' + font;
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
      if (!active || !model) return;
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
    if (!canvas || $('#songPlayer').hidden) return;
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
    $('#midiInput').addEventListener('change', (e) => { importFile(e.target.files[0]); e.target.value = ''; });
    $('#songResult').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'again') reset();
      if (act.dataset.act === 'list') showPicker();
      if (act.dataset.act === 'next') {
        const idx = OP.songs.list.findIndex((s) => s.model === model);
        open(OP.songs.model(OP.songs.list[idx + 1]));
      }
    });
    // Drop a .mid file anywhere on the Songs page.
    const zone = $('#mode-songs');
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dropping'); });
    zone.addEventListener('dragleave', (e) => { if (e.target === zone) zone.classList.remove('dropping'); });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dropping');
      const f = [...(e.dataTransfer.files || [])].find((x) => /\.(mid|midi|kar|rmi)$/i.test(x.name)) || e.dataTransfer.files[0];
      importFile(f);
    });
    // Space bar = start / pause while a song is open.
    window.addEventListener('keydown', (e) => {
      if (!active || !model || e.code !== 'Space' || e.repeat || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      if (state === 'ready' || state === 'playing' || state === 'paused') start();
    });
  }

  OP.registerMode('songs', {
    enter() { wire(); active = true; if (model) open(model); else showPicker(); },
    exit() { active = false; stop(); if (state === 'playing') state = 'paused'; },
    noteOn,
    resize() { resize(); },
  });
  OP.on('keyboard-resized', () => { if (active && model) resize(); });
  OP.on('texts', () => {
    if (!active) return;
    if (model) {
      $('#songTitle').textContent = OP.songs.title(model);
      renderParts();
      updateButtons();
      updateScore();
      if (state === 'ready') setMsg(groups.length ? t('songReady') : t('nothingToPlay'));
    } else renderPicker();
  });
  OP.on('progress', () => { if (active && !model) renderPicker(); });
})();
