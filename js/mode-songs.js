/* Songs: notes fall onto the keys. Each song has parts (right hand, left-hand
 * chords, MIDI tracks); each part is played by the child, played by the app,
 * or muted. In "wait for me" mode the song stops at every note or chord until
 * all of its keys have been pressed. In "play in time" mode the song keeps
 * going after a one-bar count-in (with a metronome if wanted) and every note
 * is marked on time, early or late. */
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
  const ON_TIME = 0.1; // seconds either side that count as "on time"
  const TIMING_COLORS = { good: '#2f9e44', early: '#e67700', late: '#d6336c' };

  let model = null, roles = [], score = null, bars = [];
  let notes = [], playNotes = [], autoNotes = [], groups = [];
  let gi = 0, autoIdx = 0, time = 0, state = 'ready', mistakes = 0, hits = 0;
  let canvas, ctx, W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  let scanvas, sctx, SW = 0, SH = 0;
  let particles = [], labels = [];
  let active = false;
  let timing = { good: 0, early: 0, late: 0 }, nextClick = 0, firstBeat = 0;

  const S = OP.settings;
  if (S.speed == null) S.speed = 1;
  if (S.waitMode == null) S.waitMode = true;
  if (!S.roles) S.roles = {};
  if (!S.view) S.view = 'both'; // 'both' | 'score' | 'lane'
  if (S.songMetro == null) S.songMetro = true;
  const VIEWS = ['both', 'score', 'lane'];

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

  function songCards(list, grid) {
    grid.innerHTML = '';
    list.forEach((s) => {
      const m = OP.songs.model(s);
      const b = card(m, OP.songs.title(s), {
        top: '<span class="song-level" aria-label="' + t('level') + ' ' + s.level + '">' + '●'.repeat(s.level) + '<span class="dim">' + '●'.repeat(3 - s.level) + '</span>' +
          (m.parts.length > 1 ? ' <span class="badge">' + t(s.group ? 'twoHands' : 'withChords') + '</span>' : '') + '</span>',
        bottom: '<span class="stars">' + starHtml(OP.store.stars(m.id)) + '</span>',
      });
      const go = () => open(m);
      b.addEventListener('click', go);
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      grid.appendChild(b);
    });
  }

  /** The built-in pieces in the same group as the open one (songs or finger exercises). */
  function siblings() {
    const s = OP.songs.list.find((x) => x.model === model);
    return s ? OP.songs.group(s.group || 'songs') : [];
  }

  function renderPicker() {
    songCards(OP.songs.group('songs'), $('#songGrid'));
    songCards(OP.songs.group('tech'), $('#techGrid'));
    songCards(OP.songs.group('hanon'), $('#hanonGrid'));

    const mine = $('#midiGrid');
    mine.innerHTML = '';
    const add = document.createElement('button');
    add.className = 'song-card add-card';
    add.innerHTML = '<span class="add-plus" aria-hidden="true">+</span><span class="song-title">' + t('openMidi') + '</span><span class="add-hint">' + t('openMidiHint') + '</span>';
    add.addEventListener('click', () => $('#midiInput').click());
    mine.appendChild(add);
    OP.midiFile.library.list().forEach((e) => {
      const b = card(null, e.title, {
        top: '<span class="song-level">' + (e.rec ? '<span class="badge rec">● ' + t('recBadge') + '</span>' : '<span class="badge">MIDI</span>') + '</span>',
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
    bars = OP.songs.bars(m);
    renderParts();
    applyView();
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
      const hand = p.key === 'right' || p.key === 'left' ? p.key : null;
      p.notes.forEach((n) => notes.push(Object.assign({}, n, { part: pi, hand, play: roles[pi] === 'play', state: '' })));
    });
    notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
    score = OP.score.prepare(notes, model.flat);
    const wrap = $('#stageWrap');
    if (wrap.dataset.clef !== score.clef) { wrap.dataset.clef = score.clef; resize(); }
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
    timing = { good: 0, early: 0, late: 0 };
    firstBeat = notes.length ? Math.max(0, notes[0].start) : 0; // skip a silent intro
    // Play in time: exactly one bar of count-in. Wait for me: a few beats of falling notes.
    time = firstBeat - (S.waitMode ? LEAD_IN : barLenAt(firstBeat));
    nextClick = firstClick(time);
    state = 'ready';
    particles = [];
    labels = [];
    $('#songResult').hidden = true;
    setMsg(groups.length ? t(S.waitMode ? 'songReady' : 'songReadyTime') : t('nothingToPlay'));
    updateButtons();
    updateTarget();
    updateScore();
  }

  /* ---------- the beat grid (metronome and count-in) ---------- */
  const meterOf = (b) => OP.songs.meterAt(model, Math.max(0, b));
  const unitAt = (b) => 4 / meterOf(b).den; // one click per beat of the time signature
  const barLenAt = (b) => { const m = meterOf(b); return (m.num * 4) / m.den; };
  const anchor = () => (bars.length ? bars[0] : 0); // the first bar line
  function firstClick(from) {
    const u = unitAt(from), a = anchor();
    return a + Math.ceil((from - a) / u - 1e-6) * u;
  }
  function isDownbeat(b) {
    const a = anchor();
    if (b < a - 1e-3) { const k = (a - b) / barLenAt(0); return Math.abs(k - Math.round(k)) < 1e-3; }
    return bars.some((x) => Math.abs(x - b) < 1e-3) || Math.abs(b - a) < 1e-3;
  }
  /** Metronome clicks for the beats the song just went past. */
  function clicks() {
    while (nextClick <= time) {
      const counting = nextClick < firstBeat - 1e-3;
      if (counting || S.songMetro) (isDownbeat(nextClick) ? OP.audio.sfx.tock : OP.audio.sfx.tick)();
      if (counting) {
        const k = Math.round((nextClick - (firstBeat - barLenAt(firstBeat))) / unitAt(nextClick)) + 1;
        setMsg(String(Math.max(1, k)));
      } else if (Math.abs(nextClick - firstBeat) < 1e-3) setMsg('');
      nextClick += unitAt(nextClick);
    }
    if (time >= firstBeat && $('#playerMsg').textContent && /^\d+$/.test($('#playerMsg').textContent)) setMsg('');
  }

  function setMsg(s) { const el = $('#playerMsg'); el.textContent = s || ''; el.hidden = !s; }

  function updateButtons() {
    const play = $('#playBtn');
    play.textContent = state === 'playing' ? t('pause') : state === 'paused' ? t('resume') : t('startBtn');
    play.disabled = state === 'demo' || state === 'done';
    $('#listenBtn').textContent = state === 'demo' ? '■ ' + t('stopListen') : '♪ ' + t('listen');
    document.querySelectorAll('#playModeSeg [data-wait]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.wait === '1') === !!S.waitMode)));
    $('#songMetroWrap').hidden = !!S.waitMode;
    $('#songMetro').checked = !!S.songMetro;
    $('#speedRange').value = S.speed;
    $('#speedVal').textContent = Math.round(S.speed * 100) + '%';
    $('#viewLabel').textContent = t('view_' + S.view);
    $('#dlBtn').title = t('download');
  }

  function applyView() {
    $('#stageWrap').dataset.view = S.view;
    $('#viewLabel').textContent = t('view_' + S.view);
    resize();
  }

  function updateTarget() {
    const g = groups[gi];
    if (g && state !== 'done' && state !== 'demo') OP.app.kb.targets(g.notes.filter((n) => !n.state).map((n) => ({ midi: n.midi, finger: n.finger })));
    else OP.app.kb.clearTargets();
  }

  function updateScore() {
    $('#songProgress').style.width = (groups.length ? (100 * gi) / groups.length : 0) + '%';
    $('#songOops').textContent = !groups.length ? '' : S.waitMode ? t('oops', { n: mistakes }) : t('timing', { g: timing.good, e: timing.early, l: timing.late });
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
    time = notes.length ? notes[0].start - 1 : 0;
    autoIdx = 0;
    setMsg('');
    updateButtons();
    updateTarget();
  }

  function finish() {
    state = 'done';
    OP.app.kb.clearTargets();
    if (!groups.length) { reset(); return; }
    let stars, detail;
    if (S.waitMode) {
      stars = mistakes <= Math.max(1, groups.length * 0.05) ? 3 : mistakes <= Math.max(4, groups.length * 0.15) ? 2 : 1;
      detail = t('oops', { n: mistakes });
    } else {
      // On time counts fully, early or late counts a bit, missed counts nothing.
      const sc = (timing.good + 0.6 * (timing.early + timing.late)) / playNotes.length;
      stars = sc >= 0.85 ? 3 : sc >= 0.6 ? 2 : 1;
      const missed = playNotes.length - hits;
      detail = t('timing', { g: timing.good, e: timing.early, l: timing.late }) + (missed ? ' · ' + t('missed', { n: missed }) : '');
      if (timing.early >= 3 && timing.early > 2 * timing.late) detail += '\n' + t('adviceEarly');
      else if (timing.late >= 3 && timing.late > 2 * timing.early) detail += '\n' + t('adviceLate');
    }
    const record = OP.store.award(model.id, stars);
    OP.emit('progress');
    OP.audio.sfx.fanfare();
    burst(W / 2, H / 2, 70, null);
    const box = $('#songResult');
    box.querySelector('.result-stars').innerHTML = starHtml(stars);
    box.querySelector('.result-title').textContent = stars === 3 ? t('great') : stars === 2 ? t('good') : t('ok');
    box.querySelector('.result-detail').textContent = detail + (record ? ' · ' + t('newRecord') : '');
    const sib = siblings(), idx = sib.findIndex((s) => s.model === model);
    box.querySelector('[data-act="next"]').hidden = idx < 0 || idx >= sib.length - 1;
    box.querySelector('[data-act="next"]').textContent = t(sib[0] && sib[0].group ? 'nextExercise' : 'nextSong');
    box.hidden = false;
    updateButtons();
  }

  function hit(n) {
    n.state = 'hit';
    hits++;
    const g = OP.app.kb.keyGeom(n.midi);
    if (g) burst(((g.x + g.w / 2) / 100) * W, H - 4, 12, N().color(n.midi));
    if (!S.waitMode && state === 'playing') {
      const sec = (time - n.start) / ((bpmAt(Math.max(0, time)) / 60) * S.speed);
      const cls = Math.abs(sec) <= ON_TIME ? 'good' : sec < 0 ? 'early' : 'late';
      timing[cls]++;
      n.timing = cls;
      if (g) labels.push({ text: t('t_' + cls), x: ((g.x + g.w / 2) / 100) * W, y: H - 30, c: TIMING_COLORS[cls], life: 0.9, max: 0.9 });
    }
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
      if (!S.waitMode) { start(); return; } // any key starts the count-in
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
      if (!S.waitMode) clicks();
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
    labels.forEach((l) => { l.y -= 50 * dt; l.life -= dt; });
    labels = labels.filter((l) => l.life > 0);
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
    const g0 = groups[gi];
    const waiting = state === 'playing' && S.waitMode && g0 && time >= g0.start;
    if (S.view !== 'lane' && SW > 0) {
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      OP.score.draw(sctx, SW, SH, score, {
        time, bars, now, waiting,
        meterAt: (b) => OP.songs.meterAt(model, b),
        current: new Set(state === 'demo' ? [] : g0 ? g0.notes : []),
        font: getComputedStyle(document.body).fontFamily,
      });
    }
    if (S.view !== 'score' && W > 0) drawLane(now, g0, waiting);
  }

  function drawLane(now, g0, waiting) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const kb = OP.app.kb;
    const pxb = Math.max(46, Math.min(120, H / 5.5)); // pixels per beat
    const hitY = H - 4;
    const font = getComputedStyle(document.body).fontFamily;
    const th = OP.theme.colors;
    const laneTint = th.dark ? '255,255,255' : '60,40,90';

    // Lanes: a faint line at every C, shaded black-key lanes.
    for (let m = kb.lo; m <= kb.hi; m++) {
      const g = kb.keyGeom(m);
      if (!g) continue;
      if (g.black) { ctx.fillStyle = 'rgba(' + laneTint + ',0.04)'; ctx.fillRect((g.x / 100) * W, 0, (g.w / 100) * W, H); }
      if (N().pc(m) === 0) { ctx.fillStyle = 'rgba(' + laneTint + ',0.10)'; ctx.fillRect((g.x / 100) * W, 0, 1, H); }
    }

    // Hit line, glowing in the colour of the next note.
    ctx.fillStyle = g0 ? N().color(g0.notes[0].midi) : th.line;
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
        ctx.fillStyle = n.state === 'miss' ? (th.dark ? '#5d5470' : '#a8a1b3') : col;
        rr(x, top, w, h, 9);
        ctx.fill();
        const isCur = current.has(n) && !n.state;
        ctx.lineWidth = isCur ? 3 : 1.5;
        ctx.strokeStyle = isCur ? th.ink : N().shade(col, 0.7);
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
    // "on time / early / late" floating up from the keys
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '800 15px ' + font;
    ctx.lineWidth = 4;
    ctx.strokeStyle = th.dark ? 'rgba(20,16,30,.85)' : 'rgba(255,255,255,.9)';
    labels.forEach((l) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, l.life / l.max * 1.6));
      ctx.strokeText(l.text, l.x, l.y);
      ctx.fillStyle = l.c;
      ctx.fillText(l.text, l.x, l.y);
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

  function sizeCanvas(c) {
    const r = c.parentElement.getBoundingClientRect();
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    c.style.width = r.width + 'px';
    c.style.height = r.height + 'px';
    return r;
  }

  function resize() {
    if (!canvas || $('#songPlayer').hidden) return;
    dpr = window.devicePixelRatio || 1;
    const r = sizeCanvas(canvas);
    W = r.width;
    H = r.height;
    const sr = sizeCanvas(scanvas);
    SW = sr.width;
    SH = sr.height;
  }

  /* ---------- wiring ---------- */
  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    canvas = $('#lane');
    ctx = canvas.getContext('2d');
    scanvas = $('#score');
    sctx = scanvas.getContext('2d');
    $('#viewBtn').addEventListener('click', () => {
      OP.store.set('view', VIEWS[(VIEWS.indexOf(S.view) + 1) % VIEWS.length]);
      applyView();
    });
    $('#dlBtn').addEventListener('click', () => { if (model) OP.midiFile.download(model); });
    $('#backBtn').addEventListener('click', showPicker);
    $('#playBtn').addEventListener('click', start);
    $('#listenBtn').addEventListener('click', listen);
    $('#restartBtn').addEventListener('click', reset);
    $('#playModeSeg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-wait]');
      if (!b) return;
      OP.store.set('waitMode', b.dataset.wait === '1');
      reset();
    });
    $('#songMetro').addEventListener('change', (e) => OP.store.set('songMetro', e.target.checked));
    $('#speedRange').addEventListener('input', (e) => { OP.store.set('speed', +e.target.value); updateButtons(); });
    $('#midiInput').addEventListener('change', (e) => { importFile(e.target.files[0]); e.target.value = ''; });
    $('#songResult').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'again') reset();
      if (act.dataset.act === 'list') showPicker();
      if (act.dataset.act === 'next') {
        const sib = siblings(), idx = sib.findIndex((s) => s.model === model);
        if (sib[idx + 1]) open(OP.songs.model(sib[idx + 1]));
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

  /** Open a song model in the player (used by free play for recordings). */
  OP.openSong = (m) => { model = m; OP.app.setMode('songs'); };

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
      if (state === 'ready') setMsg(groups.length ? t(S.waitMode ? 'songReady' : 'songReadyTime') : t('nothingToPlay'));
    } else renderPicker();
  });
  OP.on('progress', () => { if (active && !model) renderPicker(); });
})();
