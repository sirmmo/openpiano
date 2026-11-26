/* Exercises. One engine, three pages (Read notes, Listen & find, Chords), and
 * four kinds of question:
 *   note    – one note, shown on the staff or played; press its key
 *   seq     – a short melody, shown on the staff or played; play it back
 *   chord   – a chord, named / shown on the staff / played; hold its keys together
 *   choice  – listen and pick an answer (higher or lower? major or minor?) */
(function () {
  'use strict';
  const OP = window.OP;
  const N = () => OP.notes;
  const C = () => OP.chords;
  const t = (k, v) => OP.t(k, v);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const range = (a, b, whitesOnly) => {
    const out = [];
    for (let m = N().parse(a); m <= N().parse(b); m++) if (!whitesOnly || !N().isBlack(m)) out.push(m);
    return out;
  };
  const list = (...names) => names.map((n) => N().parse(n));
  const names = (pool) => pool.map((m) => N().shortName(m)).join(' ');

  /** A short melody that moves by steps (and skips when allowed) inside the pool. */
  function melody(pool, len, skips) {
    let i = Math.floor(Math.random() * Math.ceil(pool.length / 2));
    const out = [pool[i]];
    while (out.length < len) {
      const moves = skips ? [-2, -1, 1, 2] : [-1, 1];
      const ok = moves.filter((d) => i + d >= 0 && i + d < pool.length);
      i += pick(ok);
      out.push(pool[i]);
    }
    return out;
  }

  /** A chord question. base = MIDI note of the C the root is built from. */
  function chordQ(rootPc, type, inversion, opts) {
    opts = opts || {};
    // Default: roots from C4 to G♯4, and A3 to B3, so chords sit inside the treble staff.
    const root = (opts.base || (rootPc >= 9 ? 48 : 60)) + rootPc;
    const voicing = C().notes(root, type, inversion || 0);
    return Object.assign({
      key: rootPc + type + (inversion || 0), rootPc, type, inversion: inversion || 0, voicing,
      spelled: C().spell(root, type, voicing),
    }, opts);
  }
  const chordLabel = (q) => C().name(q.rootPc, q.type) + (q.needBass && q.inversion ? ' · ' + t('inv' + q.inversion) : '');
  const chordNoteNames = (q) => q.voicing.map((m, k) => N().shortName(m, q.spelled[k].acc < 0)).join(' · ');

  const ALL_PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];

  /* ---------- the levels ---------- */
  const GAMES = {
    notes: [
      { section: 'secSingle', levels: [
        { id: 'c-friends', kind: 'note', clef: 'treble', pool: range('C4', 'G4', true), name: () => t('notesL1') },
        { id: 'lines', kind: 'note', clef: 'treble', pool: list('E4', 'G4', 'B4', 'D5', 'F5'), name: () => t('notesLines') + ': ' + names(list('E4', 'G4', 'B4', 'D5', 'F5')) },
        { id: 'spaces', kind: 'note', clef: 'treble', pool: list('F4', 'A4', 'C5', 'E5'), name: () => t('notesSpaces') + ': ' + names(list('F4', 'A4', 'C5', 'E5')) },
        { id: 'treble-c', kind: 'note', clef: 'treble', pool: range('C4', 'C5', true), name: () => t('notesL2') },
        { id: 'treble-high', kind: 'note', clef: 'treble', pool: range('C4', 'C6', true), name: () => t('notesL3') },
        { id: 'bass', kind: 'note', clef: 'bass', pool: range('G2', 'C4', true), name: () => t('notesL4') },
        { id: 'bass-ledger', kind: 'note', clef: 'bass', pool: range('C2', 'E4', true), name: () => t('notesBassLedger') },
        { id: 'grand', kind: 'note', clef: 'grand', pool: range('G2', 'G5', true), name: () => t('notesL5') },
        { id: 'sharps', kind: 'note', clef: 'treble', pool: range('C4', 'C5'), name: () => t('notesL6') },
        { id: 'flats', kind: 'note', clef: 'treble', flat: true, pool: range('C4', 'C5'), name: () => t('notesFlats') },
      ] },
      { section: 'secMelody', levels: [
        { id: 'mel-steps', kind: 'seq', clef: 'treble', len: 4, pool: range('C4', 'G4', true), name: () => t('melSteps') },
        { id: 'mel-skips', kind: 'seq', clef: 'treble', len: 5, skips: true, pool: range('C4', 'C5', true), name: () => t('melSkips') },
        { id: 'mel-bass', kind: 'seq', clef: 'bass', len: 4, skips: true, pool: range('G2', 'C4', true), name: () => t('melBass') },
        { id: 'mel-long', kind: 'seq', clef: 'treble', len: 6, skips: true, pool: range('C4', 'G5', true), name: () => t('melLong') },
      ] },
    ],
    ear: [
      { section: 'secFind', levels: [
        { id: 'cde', kind: 'note', ear: true, pool: range('C4', 'E4', true), name: () => names(range('C4', 'E4', true)) },
        { id: 'c-g', kind: 'note', ear: true, pool: range('C4', 'G4', true), name: () => names(range('C4', 'G4', true)) },
        { id: 'whites', kind: 'note', ear: true, pool: range('C4', 'C5', true), name: () => t('earL3') },
        { id: 'chromatic', kind: 'note', ear: true, pool: range('C4', 'B4'), name: () => t('earL4') },
      ] },
      { section: 'secCompare', levels: [
        { id: 'hl-far', kind: 'choice', name: () => t('higherLower'), gen: () => higherLower(4, 9) },
        { id: 'hl-close', kind: 'choice', name: () => t('higherLowerClose'), gen: () => higherLower(1, 3) },
      ] },
      { section: 'secEcho', levels: [
        { id: 'echo2', kind: 'seq', ear: true, len: 2, pool: range('C4', 'E4', true), name: () => t('echoN', { n: 2 }) },
        { id: 'echo3', kind: 'seq', ear: true, len: 3, pool: range('C4', 'G4', true), name: () => t('echoN', { n: 3 }) },
        { id: 'echo4', kind: 'seq', ear: true, len: 4, pool: range('C4', 'G4', true), name: () => t('echoN', { n: 4 }) },
        { id: 'echo4s', kind: 'seq', ear: true, len: 4, skips: true, pool: range('C4', 'C5', true), name: () => t('echoSkips') },
      ] },
    ],
    chords: [
      { section: 'secPlayChord', levels: [
        { id: 'cfg', kind: 'chord', name: () => names(list('C4', 'F4', 'G4')) + ' · ' + t('chord.maj'), showNotes: true, gen: () => chordQ(pick([0, 5, 7]), 'maj') },
        { id: 'minors', kind: 'chord', name: () => names(list('A4', 'D4', 'E4')) + ' · ' + t('chord.min'), showNotes: true, gen: () => chordQ(pick([9, 2, 4]), 'min') },
        { id: 'maj-white', kind: 'chord', name: () => t('chMajWhite'), gen: () => chordQ(pick([0, 2, 4, 5, 7, 9]), 'maj') },
        { id: 'min-white', kind: 'chord', name: () => t('chMinWhite'), gen: () => chordQ(pick([0, 2, 4, 5, 7, 9, 11]), 'min') },
        { id: 'all-keys', kind: 'chord', name: () => t('chAllKeys'), gen: () => chordQ(pick(ALL_PCS), pick(['maj', 'min'])) },
        { id: 'inversions', kind: 'chord', name: () => t('chInversions'), showNotes: true, gen: () => chordQ(pick([0, 5, 7]), 'maj', pick([0, 1, 2]), { needBass: true }) },
        { id: 'sevenths', kind: 'chord', name: () => t('chSevenths'), showNotes: true, gen: () => chordQ(pick([0, 2, 4, 5, 7, 9]), 'dom7') },
        { id: 'colours', kind: 'chord', name: () => t('chColours'), showNotes: true, gen: () => chordQ(pick(WHITE_PCS.slice(0, 6)), pick(['dim', 'aug', 'sus2', 'sus4'])) },
      ] },
      { section: 'secReadChord', levels: [
        { id: 'read-triads', kind: 'chord', staff: true, clef: 'treble', octaveToggle: true, name: () => t('chRead'),
          gen: () => { const c = pick([[0, 'maj'], [5, 'maj'], [7, 'maj'], [9, 'min'], [2, 'min'], [4, 'min']]); return chordQ(c[0], c[1], 0, { exact: true }); } },
        { id: 'read-inv', kind: 'chord', staff: true, clef: 'treble', octaveToggle: true, name: () => t('chReadInv'),
          gen: () => chordQ(pick([0, 5, 7, 2, 9]), pick(['maj', 'min']), pick([0, 1, 2]), { exact: true }) },
        { id: 'read-bass', kind: 'chord', staff: true, clef: 'bass', octaveToggle: true, name: () => t('chReadBass'),
          gen: () => { const c = pick([[0, 'maj'], [5, 'maj'], [7, 'maj'], [9, 'min'], [2, 'min'], [4, 'min']]); return chordQ(c[0], c[1], 0, { base: 48, exact: true }); } },
      ] },
      { section: 'secHearChord', levels: [
        { id: 'happy-sad', kind: 'choice', name: () => t('majorMinor'), gen: majorMinor },
        { id: 'hear-cfg', kind: 'chord', ear: true, name: () => t('chHear') + ': ' + names(list('C4', 'F4', 'G4')), gen: () => chordQ(pick([0, 5, 7]), 'maj', 0, { base: 48 }) },
        { id: 'hear-six', kind: 'chord', ear: true, name: () => t('chHear') + ': ' + t('sixChords'),
          gen: () => { const c = pick([[0, 'maj'], [5, 'maj'], [7, 'maj'], [9, 'min'], [2, 'min'], [4, 'min']]); return chordQ(c[0], c[1], 0, { base: 48 }); } },
      ] },
    ],
  };

  function higherLower(minGap, maxGap) {
    const a = 57 + Math.floor(Math.random() * 16);
    const gap = minGap + Math.floor(Math.random() * (maxGap - minGap + 1));
    const up = Math.random() < 0.5;
    const b = up ? a + gap : a - gap;
    return {
      key: a + ':' + b,
      prompt: t('whichWay'),
      options: [{ id: 'up', label: '↑ ' + t('higher') }, { id: 'down', label: '↓ ' + t('lower') }],
      answer: up ? 'up' : 'down',
      play: () => { OP.app.play(a, 0.6, 90); setTimeout(() => OP.app.play(b, 0.8, 90), 750); },
    };
  }

  function majorMinor() {
    const type = pick(['maj', 'min']);
    const root = 55 + Math.floor(Math.random() * 10);
    const ns = C().notes(root, type, 0);
    return {
      key: root + type,
      prompt: t('happyOrSad'),
      options: [{ id: 'maj', label: t('majorHappy') }, { id: 'min', label: t('minorSad') }],
      answer: type,
      reveal: C().name(N().pc(root), type),
      play: () => {
        ns.forEach((m, i) => setTimeout(() => OP.app.play(m, 0.5, 80), i * 260));
        setTimeout(() => ns.forEach((m) => OP.app.play(m, 1.4, 85)), ns.length * 260 + 120);
      },
    };
  }

  /* ---------- the engine ---------- */
  const TEMPLATE =
    '<div class="quiz-levels picker"><h2 data-i18n="pickLevel"></h2><div class="level-sections"></div></div>' +
    '<div class="quiz-play" hidden>' +
    '  <div class="quiz-bar">' +
    '    <button class="btn ghost quiz-back">‹ <span data-i18n="back"></span></button>' +
    '    <span class="quiz-level-name"></span>' +
    '    <label class="switch any-octave"><input type="checkbox"><span class="track" aria-hidden="true"></span><span data-i18n="anyOctave"></span></label>' +
    '  </div>' +
    '  <div class="quiz-question">' +
    '    <div class="quiz-big"></div>' +
    '    <div class="quiz-sub"></div>' +
    '    <div class="quiz-staff staff-box"></div>' +
    '    <button class="ear-btn"><svg viewBox="0 0 24 24" width="54" height="54" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg><span data-i18n="hearAgain"></span></button>' +
    '    <div class="quiz-feedback" aria-live="polite"></div>' +
    '    <div class="quiz-choices"></div>' +
    '    <div class="quiz-dots"></div>' +
    '  </div>' +
    '  <div class="quiz-result result" hidden>' +
    '    <div class="result-stars stars big"></div><div class="result-title"></div><div class="result-detail"></div>' +
    '    <div class="result-actions"><button class="btn primary" data-act="again" data-i18n="playAgain"></button><button class="btn" data-act="next" data-i18n="nextLevel"></button><button class="btn ghost" data-act="list" data-i18n="pickLevel"></button></div>' +
    '  </div>' +
    '</div>';

  function makeGame(id) {
    const sections = GAMES[id];
    const levels = sections.flatMap((s) => s.levels);
    const root = document.getElementById('mode-' + id);
    root.innerHTML = TEMPLATE;
    const q = (s) => root.querySelector(s);
    const kb = () => OP.app.kb;
    const octKey = 'anyOctave_' + id;
    if (OP.settings[octKey] == null) OP.settings[octKey] = true;

    let L = null; // current level
    let Q = null; // current question
    let lastKey = null, round = 0, firstTry = 0, tries = 0, locked = false, active = false, idx = 0, attemptWrong = false;
    let results = [];
    let timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
    const roundSize = () => (L.kind === 'seq' ? 6 : L.kind === 'chord' ? 8 : 10);
    const anyOctave = () => (L.kind === 'chord' ? !(Q && Q.exact) || OP.settings[octKey] : OP.settings[octKey]);

    function renderLevels() {
      const box = q('.level-sections');
      box.innerHTML = '';
      sections.forEach((sec) => {
        const h = document.createElement('h3');
        h.className = 'level-section';
        h.textContent = t(sec.section);
        box.appendChild(h);
        const grid = document.createElement('div');
        grid.className = 'level-grid';
        sec.levels.forEach((lv) => {
          const n = levels.indexOf(lv) + 1;
          const stars = OP.store.stars(id + ':' + lv.id);
          const b = document.createElement('button');
          b.className = 'level-card';
          b.innerHTML = '<span class="level-num">' + n + '</span><span class="level-name">' + lv.name() + '</span><span class="stars">' +
            [1, 2, 3].map((s) => '<span class="star' + (s <= stars ? ' on' : '') + '">★</span>').join('') + '</span>';
          b.addEventListener('click', () => start(lv));
          grid.appendChild(b);
        });
        box.appendChild(grid);
      });
    }

    function showLevels() {
      clearTimers();
      L = null;
      q('.quiz-levels').hidden = false;
      q('.quiz-play').hidden = true;
      kb().clearTargets();
      kb().soft([]);
      OP.app.restoreKeyboard();
      renderLevels();
    }

    function start(lv) {
      clearTimers();
      L = lv;
      round = 0;
      firstTry = 0;
      results = [];
      lastKey = null;
      q('.quiz-levels').hidden = true;
      q('.quiz-play').hidden = false;
      q('.quiz-result').hidden = true;
      q('.quiz-question').hidden = false;
      q('.quiz-level-name').textContent = lv.name();
      q('.any-octave').hidden = !(lv.kind === 'note' || lv.kind === 'seq' || lv.octaveToggle);
      q('.any-octave input').checked = OP.settings[octKey];
      OP.app.restoreKeyboard();
      kb().soft([]);
      if (lv.pool) OP.app.fitKeyboard(Math.min(...lv.pool), Math.max(...lv.pool));
      else if (lv.kind === 'chord') OP.app.fitKeyboard(lv.staff && lv.clef === 'bass' ? 48 : 60, lv.staff && lv.clef === 'bass' ? 72 : 84);
      if (lv.ear && lv.pool) kb().soft(lv.pool);
      ask();
    }

    function newQuestion() {
      for (let k = 0; k < 20; k++) {
        let nq;
        if (L.kind === 'note') nq = { key: 'n', answer: pick(L.pool) };
        else if (L.kind === 'seq') nq = { key: 's', seq: melody(L.pool, L.len, L.skips) };
        else nq = L.gen();
        nq.key = nq.key + (nq.answer || '') + (nq.seq ? nq.seq.join(',') : '');
        if (nq.key !== lastKey) return nq;
      }
      return L.kind === 'note' ? { answer: pick(L.pool) } : L.gen();
    }

    function ask() {
      clearTimers();
      tries = 0;
      idx = 0;
      locked = false;
      attemptWrong = false;
      Q = newQuestion();
      lastKey = Q.key;
      kb().clearTargets();
      const fb = q('.quiz-feedback');
      fb.className = 'quiz-feedback';
      const big = q('.quiz-big'), sub = q('.quiz-sub'), staff = q('.quiz-staff'), ear = q('.ear-btn'), choices = q('.quiz-choices');
      big.textContent = '';
      sub.textContent = '';
      choices.innerHTML = '';
      staff.hidden = true;
      ear.hidden = !(L.ear || L.kind === 'choice');

      if (L.kind === 'note') {
        fb.textContent = L.ear ? t('earFind') : t('whichNote');
        if (!L.ear) drawStaff();
      } else if (L.kind === 'seq') {
        fb.textContent = L.ear ? t('echoPrompt', { n: Q.seq.length }) : t('readMelody');
        if (L.ear) sub.innerHTML = seqDots();
        else drawStaff();
      } else if (L.kind === 'chord') {
        if (L.ear) fb.textContent = t('chordHear');
        else if (L.staff) { fb.textContent = t('chordReadPrompt'); drawStaff(); }
        else {
          big.textContent = chordLabel(Q);
          big.style.setProperty('--c', N().color(Q.voicing[0]));
          sub.textContent = L.showNotes ? chordNoteNames(Q) : C().symbol(Q.rootPc, Q.type);
          fb.textContent = Q.needBass ? t('chordInvPrompt', { n: N().shortName(Q.voicing[0], Q.spelled[0].acc < 0) }) : t('chordPrompt');
        }
      } else if (L.kind === 'choice') {
        fb.textContent = Q.prompt;
        Q.options.forEach((o) => {
          const b = document.createElement('button');
          b.className = 'btn choice';
          b.textContent = o.label;
          b.addEventListener('click', () => choose(o.id, b));
          choices.appendChild(b);
        });
      }
      renderDots();
      if (L.ear || L.kind === 'choice') later(() => { if (active && !locked) playPrompt(); }, 400);
    }

    function seqDots() {
      return '<span class="seq-dots">' + Q.seq.map((m, i) => '<i class="' + (i < idx ? 'done' : i === idx ? 'now' : '') + '"' +
        (i < idx ? ' style="background:' + N().color(m) + '"' : '') + '></i>').join('') + '</span>';
    }

    function drawStaff(reveal) {
      const box = q('.quiz-staff');
      box.hidden = false;
      let items;
      if (L.kind === 'note') {
        items = [{ midi: Q.answer, flat: L.flat, color: reveal ? N().color(Q.answer) : 'var(--ink)', cls: reveal ? 'ok' : '', label: reveal ? N().shortName(Q.answer, L.flat) : '' }];
      } else if (L.kind === 'seq') {
        items = Q.seq.map((m, i) => ({ midi: m, color: i < idx ? N().color(m) : 'var(--ink)', cls: i === idx ? 'cur' : i < idx ? 'ok' : '', label: i < idx ? N().shortName(m) : '' }));
      } else {
        items = [{ midis: Q.voicing, spelled: Q.spelled, colors: reveal ? Q.voicing.map(N().color) : null, color: 'var(--ink)', cls: reveal ? 'ok' : '', label: reveal ? C().symbol(Q.rootPc, Q.type) : '' }];
      }
      const width = L.kind === 'seq' ? 120 + Q.seq.length * 48 : 260;
      box.style.width = 'min(' + (width * 1.45) + 'px, 92vw)';
      box.innerHTML = OP.staff.render({ clef: L.clef || 'treble', width, notes: items });
    }

    function playPrompt() {
      const btn = q('.ear-btn');
      btn.classList.remove('ring');
      void btn.offsetWidth;
      btn.classList.add('ring');
      if (L.kind === 'note') OP.app.play(Q.answer, 0.9, 95);
      else if (L.kind === 'seq') Q.seq.forEach((m, i) => later(() => OP.app.play(m, 0.45, 90), i * 520));
      else if (L.kind === 'chord') {
        Q.voicing.forEach((m, i) => later(() => OP.app.play(m, 0.5, 80), i * 240));
        later(() => Q.voicing.forEach((m) => OP.app.play(m, 1.3, 85)), Q.voicing.length * 240 + 120);
      } else if (Q.play) Q.play();
    }

    function renderDots() {
      q('.quiz-dots').innerHTML = Array.from({ length: roundSize() }, (_, i) =>
        '<i class="' + (results[i] === 1 ? 'gold' : results[i] === 2 ? 'ok' : i === round ? 'now' : '') + '"></i>').join('');
    }

    const same = (m, target) => (anyOctave() ? N().pc(m) === N().pc(target) : m === target);

    function inRangeKey(target) {
      if (kb().inRange(target)) return target;
      for (let m = kb().lo; m <= kb().hi; m++) if (N().pc(m) === N().pc(target)) return m;
      return target;
    }

    function hint() {
      if (L.kind === 'note') kb().target(inRangeKey(Q.answer));
      else if (L.kind === 'seq') kb().target(inRangeKey(Q.seq[idx]));
      else if (L.kind === 'chord') {
        kb().targets(Q.voicing.map((m) => ({ midi: inRangeKey(m) })));
        if (!q('.quiz-sub').textContent || L.staff || L.ear) q('.quiz-sub').textContent = chordLabel(Q) + ' — ' + chordNoteNames(Q);
      }
    }

    function wrong(m, msg) {
      tries++;
      if (m != null) kb().flash(m, 'bad');
      const fb = q('.quiz-feedback');
      fb.textContent = msg || (tries >= 2 ? t('hint') : t('tryAgain'));
      fb.className = 'quiz-feedback bad';
      if (tries >= 2) hint();
      if (L.ear && tries === 1) later(() => { if (!locked && active) playPrompt(); }, 700);
    }

    function correct(text) {
      locked = true;
      clearTimers();
      if (tries === 0) firstTry++;
      results[round] = tries === 0 ? 1 : 2;
      kb().clearTargets();
      OP.audio.sfx.good();
      const yays = t('yay');
      const fb = q('.quiz-feedback');
      fb.textContent = pick(yays) + (text ? ' ' + text : '');
      fb.className = 'quiz-feedback good';
      round++;
      renderDots();
      later(() => { if (!active || !L) return; if (round >= roundSize()) finish(); else ask(); }, 1200);
    }

    function noteOn(m) {
      if (!active || !L || locked || q('.quiz-question').hidden || !Q) return;
      if (L.kind === 'note') {
        if (same(m, Q.answer)) {
          kb().flash(m, 'good');
          if (!L.ear) drawStaff(true);
          correct(N().shortName(Q.answer, L.flat));
        } else wrong(m);
      } else if (L.kind === 'seq') {
        if (same(m, Q.seq[idx])) {
          kb().flash(m, 'good');
          kb().clearTargets();
          idx++;
          if (L.ear) q('.quiz-sub').innerHTML = seqDots(); else drawStaff();
          if (idx >= Q.seq.length) correct();
          else if (tries >= 2) hint();
        } else wrong(m);
      } else if (L.kind === 'chord') {
        chordCheck(m);
      }
    }

    function chordCheck(m) {
      const held = [...OP.app.held];
      const exact = !anyOctave();
      const want = new Set(Q.voicing.map(N().pc));
      const belongs = exact ? Q.voicing.includes(m) : want.has(N().pc(m));
      if (!belongs) {
        kb().flash(m, 'bad');
        if (!attemptWrong) { attemptWrong = true; wrong(null); }
        return;
      }
      const heldPcs = new Set(held.map(N().pc));
      const complete = exact
        ? Q.voicing.every((v) => held.includes(v)) && held.every((h) => Q.voicing.includes(h))
        : [...want].every((p) => heldPcs.has(p)) && [...heldPcs].every((p) => want.has(p));
      if (!complete) return;
      if (Q.needBass && N().pc(Math.min(...held)) !== N().pc(Q.voicing[0])) {
        if (!attemptWrong) { attemptWrong = true; wrong(null, t('wrongBass', { n: N().shortName(Q.voicing[0], Q.spelled[0].acc < 0) })); }
        return;
      }
      held.forEach((h) => kb().flash(h, 'good'));
      if (L.staff) drawStaff(true);
      if (L.ear || L.staff) q('.quiz-big').textContent = chordLabel(Q);
      correct();
    }

    function noteOff() {
      if (L && L.kind === 'chord' && OP.app.held.size === 0) attemptWrong = false;
    }

    function choose(answer, btn) {
      if (locked) return;
      if (answer === Q.answer) {
        btn.classList.add('right');
        correct(Q.reveal || '');
      } else {
        btn.classList.add('wrong');
        setTimeout(() => btn.classList.remove('wrong'), 500);
        wrong(null);
        later(() => { if (!locked && active) playPrompt(); }, 600);
      }
    }

    function finish() {
      const size = roundSize();
      const stars = firstTry >= size - 1 ? 3 : firstTry >= Math.ceil(size * 0.7) ? 2 : 1;
      const record = OP.store.award(id + ':' + L.id, stars);
      OP.emit('progress');
      OP.audio.sfx.fanfare();
      q('.quiz-question').hidden = true;
      const r = q('.quiz-result');
      r.hidden = false;
      r.querySelector('.result-stars').innerHTML = [1, 2, 3].map((s) => '<span class="star' + (s <= stars ? ' on' : '') + '">★</span>').join('');
      r.querySelector('.result-title').textContent = stars === 3 ? t('great') : stars === 2 ? t('good') : t('ok');
      r.querySelector('.result-detail').textContent = t('firstTry', { a: firstTry, b: size }) + (record ? ' · ' + t('newRecord') : '');
      r.querySelector('[data-act="next"]').hidden = levels.indexOf(L) >= levels.length - 1;
      kb().clearTargets();
    }

    q('.quiz-back').addEventListener('click', showLevels);
    q('.any-octave input').addEventListener('change', (e) => OP.store.set(octKey, e.target.checked));
    q('.ear-btn').addEventListener('click', playPrompt);
    q('.quiz-result').addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'again') start(L);
      if (a.dataset.act === 'next') start(levels[levels.indexOf(L) + 1]);
      if (a.dataset.act === 'list') showLevels();
    });

    OP.registerMode(id, {
      enter() { active = true; OP.applyI18n(root); if (!L) showLevels(); else start(L); },
      exit() { active = false; clearTimers(); },
      noteOn,
      noteOff,
    });
    OP.on('texts', () => {
      if (!active) return;
      if (!L) renderLevels();
      else if (!locked && !q('.quiz-question').hidden) { q('.quiz-level-name').textContent = L.name(); ask(); }
    });
    OP.on('progress', () => { if (active && !L) renderLevels(); });
  }

  makeGame('notes');
  makeGame('ear');
  makeGame('chords');
})();
