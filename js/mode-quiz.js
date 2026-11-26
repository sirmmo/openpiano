/* Two quiz games sharing one engine:
 *  - Read notes: a note appears on the staff, press the matching key.
 *  - Listen & find: hear a note, find it on the keyboard. */
(function () {
  'use strict';
  const OP = window.OP;
  const N = () => OP.notes;
  const t = (k, v) => OP.t(k, v);
  const ROUND = 10;

  const range = (a, b, whitesOnly) => {
    const out = [];
    for (let m = N().parse(a); m <= N().parse(b); m++) if (!whitesOnly || !N().isBlack(m)) out.push(m);
    return out;
  };
  const listNames = (pool) => pool.map((m) => N().name(m, OP.settings.noteNames === 'both' ? 'letters' : OP.settings.noteNames)).join(' ');

  const GAMES = {
    notes: {
      levels: [
        { clef: 'treble', pool: () => range('C4', 'G4', true), name: () => t('notesL1') },
        { clef: 'treble', pool: () => range('C4', 'C5', true), name: () => t('notesL2') },
        { clef: 'treble', pool: () => range('C4', 'A5', true), name: () => t('notesL3') },
        { clef: 'bass', pool: () => range('G2', 'C4', true), name: () => t('notesL4') },
        { clef: 'grand', pool: () => range('G2', 'G5', true), name: () => t('notesL5') },
        { clef: 'treble', pool: () => range('C4', 'C5', false), name: () => t('notesL6') },
      ],
      prompt: () => t('whichNote'),
    },
    ear: {
      levels: [
        { pool: () => range('C4', 'E4', true), name: () => listNames(range('C4', 'E4', true)) },
        { pool: () => range('C4', 'G4', true), name: () => listNames(range('C4', 'G4', true)) },
        { pool: () => range('C4', 'C5', true), name: () => t('earL3') },
        { pool: () => range('C4', 'B4', false), name: () => t('earL4') },
      ],
      prompt: () => t('earFind'),
    },
  };

  function makeGame(id) {
    const cfg = GAMES[id];
    const root = document.getElementById('mode-' + id);
    const q = (s) => root.querySelector(s);
    let level = null, pool = [], answer = null, last = null, round = 0, firstTry = 0, tries = 0, locked = false, active = false;
    const results = [];
    if (OP.settings['anyOctave_' + id] == null) OP.settings['anyOctave_' + id] = true;

    function renderLevels() {
      const box = q('.level-grid');
      box.innerHTML = '';
      cfg.levels.forEach((lv, i) => {
        const b = document.createElement('button');
        b.className = 'level-card';
        const stars = OP.store.stars(id + ':' + i);
        b.innerHTML = '<span class="level-num">' + (i + 1) + '</span><span class="level-name">' + lv.name() + '</span><span class="stars">' +
          [1, 2, 3].map((s) => '<span class="star' + (s <= stars ? ' on' : '') + '">★</span>').join('') + '</span>';
        b.addEventListener('click', () => start(i));
        box.appendChild(b);
      });
    }

    function showLevels() {
      level = null;
      q('.quiz-levels').hidden = false;
      q('.quiz-play').hidden = true;
      OP.app.kb.clearTargets();
      OP.app.kb.soft([]);
      OP.app.restoreKeyboard();
      renderLevels();
    }

    function start(i) {
      level = i;
      pool = cfg.levels[i].pool();
      round = 0;
      firstTry = 0;
      results.length = 0;
      last = null;
      q('.quiz-levels').hidden = true;
      q('.quiz-play').hidden = false;
      q('.quiz-result').hidden = true;
      q('.quiz-question').hidden = false;
      q('.quiz-level-name').textContent = cfg.levels[i].name();
      q('.any-octave input').checked = OP.settings['anyOctave_' + id];
      OP.app.fitKeyboard(Math.min(...pool), Math.max(...pool));
      if (id === 'ear') OP.app.kb.soft(pool);
      ask();
    }

    function ask() {
      tries = 0;
      locked = false;
      do { answer = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && answer === last);
      last = answer;
      OP.app.kb.clearTargets();
      q('.quiz-feedback').textContent = cfg.prompt();
      q('.quiz-feedback').className = 'quiz-feedback';
      renderDots();
      if (id === 'notes') drawNote(false);
      else setTimeout(() => { if (active && !locked) playPrompt(); }, 350);
    }

    function drawNote(reveal) {
      const box = q('.quiz-staff');
      const lv = cfg.levels[level];
      box.innerHTML = OP.staff.render({
        clef: lv.clef,
        width: 260,
        notes: [{
          midi: answer,
          color: reveal ? N().color(answer) : '#2b2238',
          cls: reveal ? 'ok' : '',
          label: reveal ? N().name(answer) : '',
        }],
      });
    }

    function playPrompt() {
      const btn = q('.ear-btn');
      btn.classList.remove('ring');
      void btn.offsetWidth;
      btn.classList.add('ring');
      OP.app.play(answer, 0.9, 95, false);
    }

    function renderDots() {
      q('.quiz-dots').innerHTML = Array.from({ length: ROUND }, (_, i) =>
        '<i class="' + (results[i] === 1 ? 'gold' : results[i] === 2 ? 'ok' : i === round ? 'now' : '') + '"></i>').join('');
    }

    function matches(m) {
      return OP.settings['anyOctave_' + id] ? N().pc(m) === N().pc(answer) : m === answer;
    }

    function hintKey() {
      if (OP.app.kb.inRange(answer)) return answer;
      for (let m = OP.app.kb.lo; m <= OP.app.kb.hi; m++) if (N().pc(m) === N().pc(answer)) return m;
      return answer;
    }

    function noteOn(m) {
      if (!active || level == null || locked || q('.quiz-question').hidden) return;
      const fb = q('.quiz-feedback');
      if (matches(m)) {
        locked = true;
        if (tries === 0) firstTry++;
        results[round] = tries === 0 ? 1 : 2;
        OP.app.kb.clearTargets();
        OP.app.kb.flash(m, 'good');
        OP.audio.sfx.good();
        const yays = t('yay');
        fb.textContent = yays[Math.floor(Math.random() * yays.length)] + ' ' + N().name(answer);
        fb.className = 'quiz-feedback good';
        if (id === 'notes') drawNote(true);
        round++;
        renderDots();
        setTimeout(() => { if (!active || level == null) return; if (round >= ROUND) finish(); else ask(); }, 1100);
      } else {
        tries++;
        OP.app.kb.flash(m, 'bad');
        fb.textContent = tries >= 2 ? t('hint') : t('tryAgain');
        fb.className = 'quiz-feedback bad';
        if (tries >= 2) OP.app.kb.target(hintKey());
        if (id === 'ear' && tries === 1) setTimeout(() => { if (!locked && active) playPrompt(); }, 700);
      }
    }

    function finish() {
      const stars = firstTry >= 9 ? 3 : firstTry >= 7 ? 2 : 1;
      const record = OP.store.award(id + ':' + level, stars);
      OP.emit('progress');
      OP.audio.sfx.fanfare();
      q('.quiz-question').hidden = true;
      const r = q('.quiz-result');
      r.hidden = false;
      r.querySelector('.result-stars').innerHTML = [1, 2, 3].map((s) => '<span class="star' + (s <= stars ? ' on' : '') + '">★</span>').join('');
      r.querySelector('.result-title').textContent = stars === 3 ? t('great') : stars === 2 ? t('good') : t('ok');
      r.querySelector('.result-detail').textContent = t('firstTry', { a: firstTry, b: ROUND }) + (record ? ' · ' + t('newRecord') : '');
      OP.app.kb.clearTargets();
    }

    let wired = false;
    function wire() {
      if (wired) return;
      wired = true;
      q('.quiz-back').addEventListener('click', showLevels);
      q('.any-octave input').addEventListener('change', (e) => OP.store.set('anyOctave_' + id, e.target.checked));
      q('.quiz-result').addEventListener('click', (e) => {
        const a = e.target.closest('[data-act]');
        if (!a) return;
        if (a.dataset.act === 'again') start(level);
        if (a.dataset.act === 'list') showLevels();
      });
      if (id === 'ear') q('.ear-btn').addEventListener('click', playPrompt);
    }

    OP.registerMode(id, {
      enter() { wire(); active = true; if (level == null) showLevels(); else start(level); },
      exit() { active = false; },
      noteOn,
    });
    OP.on('texts', () => {
      if (!active) return;
      if (level == null) renderLevels();
      else {
        q('.quiz-level-name').textContent = cfg.levels[level].name();
        if (!locked) q('.quiz-feedback').textContent = cfg.prompt();
      }
    });
    OP.on('progress', () => { if (active && level == null) renderLevels(); });
  }

  makeGame('notes');
  makeGame('ear');
})();
