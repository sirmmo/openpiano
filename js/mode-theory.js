/* Theory: short illustrated lessons you can hear and play along with.
 * Intervals, scales, the circle of fifths, chords of a key, rhythm,
 * melody and counterpoint. The piano below reacts to what you play. */
(function () {
  'use strict';
  const OP = window.OP;
  const N = () => OP.notes;
  const T = () => OP.theory;
  const L = (en, it) => OP.theory.L(en, it);
  const $ = (s, r) => (r || document).querySelector(s);

  const root = document.getElementById('mode-theory');
  root.innerHTML =
    '<div class="th-picker picker"><h2></h2><p class="th-intro"></p><div class="th-grid"></div></div>' +
    '<div class="th-lesson" hidden>' +
    '  <div class="quiz-bar"><button class="btn ghost th-back">‹ <span data-i18n="back"></span></button><span class="quiz-level-name th-title"></span>' +
    '  <button class="btn ghost th-prev" aria-label="‹">‹</button><button class="btn th-next"></button></div>' +
    '  <div class="th-body"><article class="th-doc"></article></div>' +
    '</div>';

  /* ---------- state ---------- */
  const S = { ci: 0, cminor: false, scaleRoot: 0, scaleType: 'major', famKey: 0 };
  let lesson = null; // current lesson object
  let active = false;
  let timers = [];
  let resets = []; // called when playback stops (un-highlight)
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  function stopPlayback() {
    timers.forEach(clearTimeout);
    timers = [];
    const r = resets;
    resets = [];
    r.forEach((fn) => fn());
  }
  const play = (m, s, v) => OP.app.play(m, s, v || 85, true);
  function playChord(ns, s, v) { ns.forEach((m) => play(m, s || 1, v || 80)); }

  /* ---------- small DOM helpers ---------- */
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function button(label, cls, fn) {
    const b = el('button', 'btn ' + (cls || ''), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  const doc = () => $('.th-doc', root);
  const h = (text) => doc().appendChild(el('h3', 'th-h', text));
  const p = (html) => doc().appendChild(el('p', null, html));
  const tip = (html) => doc().appendChild(el('aside', 'th-tip', html));
  const ul = (items) => doc().appendChild(el('ul', 'th-list', items.map((i) => '<li>' + i + '</li>').join('')));
  const PLAY_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15l13-7.5z"/></svg> ';

  /* ---------- a staff example you can listen to ----------
   * voices: strings like 'C4 D4 E4'; 'r' is a rest, '-' holds the note before.
   * voices[0] is the top voice. Two voices show the interval numbers between them. */
  const VOICE_COLORS = ['var(--accent)', '#e8590c'];
  function parseVoice(str) { return str.trim().split(/\s+/).map((tok) => (tok === 'r' ? null : tok === '-' ? '-' : N().parse(tok))); }

  function example(ex, parent) {
    const voices = ex.voices.map(parseVoice);
    const cols = Math.max(...voices.map((v) => v.length));
    const sounding = voices.map((v) => { let last = null; return Array.from({ length: cols }, (_, i) => { if (v[i] === '-') return last; last = v[i] == null ? null : v[i]; return last; }); });
    const all = sounding.flat().filter((m) => m != null);
    const lo = Math.min(...all), hi = Math.max(...all);
    const clef = ex.clef || (lo >= 57 ? 'treble' : hi <= 64 ? 'bass' : 'grand');
    const two = voices.length > 1;
    const box = el('div', 'th-ex');
    const staff = el('div', 'staff-box th-staff');
    const ctrl = el('div', 'th-ex-ctrl');
    box.append(staff, ctrl);
    if (ex.caption) box.appendChild(el('div', 'th-ex-cap', ex.caption));
    let cur = -1;
    const width = 96 + cols * (ex.wide ? 44 : 34);
    staff.style.width = 'min(' + Math.round(width * 1.25) + 'px, 100%)';

    function draw() {
      const items = [];
      for (let i = 0; i < cols; i++) {
        const midis = [], colors = [];
        voices.forEach((v, k) => { if (typeof v[i] === 'number') { midis.push(v[i]); colors.push(two ? VOICE_COLORS[k] : N().color(v[i])); } });
        let label = '', labelColor = 'var(--ink-2)';
        if (two && ex.intervals !== false && sounding[0][i] != null && sounding[1][i] != null) {
          const a = Math.max(sounding[0][i], sounding[1][i]), b = Math.min(sounding[0][i], sounding[1][i]);
          label = String(N().step(a).step - N().step(b).step + 1);
          if (!T().CONSONANT.includes((a - b) % 12)) labelColor = 'var(--bad)';
        } else if (ex.names && midis.length) label = N().shortName(midis[0]);
        items.push({ midis, colors, label, labelColor, cls: i === cur ? 'cur' : '' });
      }
      staff.innerHTML = OP.staff.render({ clef, width, notes: items, keySig: ex.keySig });
    }

    function run(which) {
      stopPlayback();
      OP.app.fitKeyboard(lo, hi);
      const beat = ex.beat || 0.5;
      for (let i = 0; i < cols; i++) {
        later(() => {
          cur = i;
          draw();
          voices.forEach((v, k) => {
            if (which != null && which !== k) return;
            if (typeof v[i] !== 'number') return;
            let len = 1;
            while (v[i + len] === '-') len++;
            play(v[i], len * beat * 0.95, k === 1 ? 78 : 88);
          });
        }, i * beat * 1000);
      }
      later(() => { cur = -1; draw(); }, cols * beat * 1000 + 300);
      resets.push(() => { cur = -1; draw(); });
    }

    ctrl.appendChild(button(PLAY_ICON + L('Play', 'Ascolta'), 'primary small', () => run(null)));
    if (two) {
      ctrl.appendChild(button('<i class="vdot" style="background:' + VOICE_COLORS[0] + '"></i>' + L('Top voice', 'Voce acuta'), 'small', () => run(0)));
      ctrl.appendChild(button('<i class="vdot" style="background:' + VOICE_COLORS[1] + '"></i>' + L('Bottom voice', 'Voce grave'), 'small', () => run(1)));
    }
    draw();
    (parent || doc()).appendChild(box);
    return box;
  }

  /* ======================================================================
   * Lesson 1: steps and intervals
   * ==================================================================== */
  const intervals = {
    id: 'intervals', color: '#ff6b6b',
    title: () => L('Steps and intervals', 'Toni, semitoni e intervalli'),
    desc: () => L('Half steps, whole steps, and the distance between two notes.', 'Semitoni, toni e la distanza tra due note.'),
    last: null,
    render() {
      this.last = null;
      p(L('An <b>interval</b> is the distance between two notes. On the piano we measure it in <b>half steps</b>.',
        'Un <b>intervallo</b> è la distanza tra due note. Sul pianoforte la misuriamo in <b>semitoni</b>.'));
      h(L('Half step and whole step', 'Semitono e tono'));
      p(L('A <b>half step</b> goes from a key to the very next key, black or white. {E}–{F} and {B}–{C} are half steps between two white keys: there is no black key between them.',
        'Un <b>semitono</b> va da un tasto a quello subito vicino, bianco o nero. {E}–{F} e {B}–{C} sono semitoni tra due tasti bianchi: in mezzo non c’è un tasto nero.'));
      p(L('A <b>whole step</b> is two half steps: skip one key. {C}–{D} is a whole step (the black key {C#} sits in the middle).',
        'Un <b>tono</b> vale due semitoni: si salta un tasto. {C}–{D} è un tono (in mezzo c’è il tasto nero {C#}).'));
      const demo = el('div', 'th-row');
      const show = (a, b) => () => { stopPlayback(); OP.app.fitKeyboard(60, 72); OP.app.kb.targets([{ midi: a }, { midi: b }]); play(a, 0.5); later(() => play(b, 0.7), 550); later(() => OP.app.kb.clearTargets(), 2200); };
      demo.append(
        button(PLAY_ICON + L('Half step {E}–{F}', 'Semitono {E}–{F}'), 'small', show(64, 65)),
        button(PLAY_ICON + L('Half step {C}–{C#}', 'Semitono {C}–{C#}'), 'small', show(60, 61)),
        button(PLAY_ICON + L('Whole step {C}–{D}', 'Tono {C}–{D}'), 'small', show(60, 62)),
        button(PLAY_ICON + L('Whole step {E}–{F#}', 'Tono {E}–{F#}'), 'small', show(64, 66)));
      doc().appendChild(demo);
      tip(L('A <b>sharp ♯</b> raises a note by a half step, a <b>flat ♭</b> lowers it by a half step. So the same black key can be {C#} or {Db}.',
        'Il <b>diesis ♯</b> alza una nota di un semitono, il <b>bemolle ♭</b> la abbassa di un semitono. Così lo stesso tasto nero può essere {C#} o {Db}.'));

      h(L('Try it: play two notes', 'Prova: suona due note'));
      p(L('Play one note and then another (or hold two together). The app tells you the interval.',
        'Suona una nota e poi un’altra (o tienine premute due insieme). L’app ti dice l’intervallo.'));
      this.out = doc().appendChild(el('div', 'th-live', L('Waiting for two notes…', 'Aspetto due note…')));

      h(L('The intervals', 'Gli intervalli'));
      p(L('Intervals are named by counting letter names, both ends included: {C} to {E} is C-D-E, a <b>3rd</b>. Major and minor tell you how wide it is.',
        'Gli intervalli si chiamano contando i nomi delle note, compresi gli estremi: da {C} a {E} è Do-Re-Mi, una <b>terza</b>. Maggiore e minore dicono quanto è larga.'));
      const SONGS = {
        1: L('“Für Elise” starts like this', 'l’inizio di “Per Elisa”'),
        2: L('“Frère Jacques” (Are you sleeping)', '“Fra Martino”'),
        3: L('“Greensleeves”', '“Greensleeves”'),
        4: L('“Oh When the Saints”', '“Oh When the Saints”'),
        5: L('“Here Comes the Bride” (Wagner)', 'la marcia nuziale di Wagner'),
        6: L('sounds spooky and restless', 'suona misterioso e inquieto'),
        7: L('“Twinkle Twinkle Little Star”', '“Brilla brilla la stellina”'),
        8: L('sounds sweet and a bit sad', 'suona dolce e un po’ triste'),
        9: L('“My Bonnie Lies over the Ocean”', '“My Bonnie Lies over the Ocean”'),
        10: L('sounds like a question', 'suona come una domanda'),
        11: L('sounds very tense', 'suona molto teso'),
        12: L('“Over the Rainbow” (some-WHERE)', '“Over the Rainbow” (some-WHERE)'),
      };
      const table = el('div', 'th-table');
      for (let s = 1; s <= 12; s++) {
        const row = el('div', 'th-tr');
        row.dataset.s = s;
        const b = button(PLAY_ICON, 'small icon-only', () => {
          stopPlayback();
          OP.app.fitKeyboard(60, 72);
          play(60, 0.55); later(() => play(60 + s, 0.55), 600); later(() => { play(60, 1.1, 72); play(60 + s, 1.1, 72); }, 1250);
        });
        b.setAttribute('aria-label', T().intervalName(s));
        row.append(b,
          el('span', 'th-semis', String(s)),
          el('span', 'th-iname', '<b>' + T().intervalName(s) + '</b> <small>' + T().INTERVALS[s][2] + ' · ' + T().letterName(0, 0) + '–' + N().shortName(60 + s, [1, 3, 8, 10].includes(s)) + '</small>'),
          el('span', 'th-isong', SONGS[s]));
        table.appendChild(row);
      }
      table.prepend(el('div', 'th-tr th-th', '<span></span><span>' + L('half steps', 'semitoni') + '</span><span>' + L('interval', 'intervallo') + '</span><span>' + L('sounds like', 'come in') + '</span>'));
      doc().appendChild(table);
      tip(L('The <b>octave</b> (12 half steps) lands on a note with the same name: {C} to the next {C}. It sounds so similar that we give the two notes the same name.',
        'L’<b>ottava</b> (12 semitoni) arriva su una nota con lo stesso nome: da {C} al {C} successivo. Suona così simile che le due note hanno lo stesso nome.'));
    },
    noteOn(m) {
      const held = [...OP.app.held];
      let a = null, b = null;
      if (held.length >= 2) { a = Math.min(...held); b = Math.max(...held); }
      else if (this.last != null && this.last !== m) { a = this.last; b = m; }
      this.last = m;
      if (a == null || !this.out) return;
      const s = Math.abs(b - a);
      const up = b > a ? '↗' : '↘';
      this.out.innerHTML = '<span class="th-live-notes">' + N().shortName(a) + ' ' + up + ' ' + N().shortName(b) + '</span><b>' + T().intervalName(s) + '</b><span>' +
        s + ' ' + (s === 1 ? L('half step', 'semitono') : L('half steps', 'semitoni')) + '</span>';
      this.out.classList.remove('pop'); void this.out.offsetWidth; this.out.classList.add('pop');
      root.querySelectorAll('.th-tr').forEach((r) => r.classList.toggle('on', +r.dataset.s === s));
    },
  };

  /* ======================================================================
   * Lesson 2: scales
   * ==================================================================== */
  const scales = {
    id: 'scales', color: '#ffa94d',
    title: () => L('Scales', 'Le scale'),
    desc: () => L('Major, minor and pentatonic scales from any note, with their patterns.', 'Scale maggiori, minori e pentatoniche da ogni nota, con il loro schema.'),
    follow: -1,
    render() {
      this.follow = -1;
      p(L('A <b>scale</b> is a ladder of notes from one note up to the same note an octave higher. The first note is the <b>tonic</b>: the home of the music.',
        'Una <b>scala</b> è una scaletta di note che sale da una nota fino alla stessa nota un’ottava sopra. La prima nota è la <b>tonica</b>: la casa della musica.'));
      this.box = doc().appendChild(el('div', 'th-scale'));
      this.draw();
      h(L('The major scale', 'La scala maggiore'));
      p(L('Every major scale uses the same pattern of steps: <b>whole, whole, half, whole, whole, whole, half</b>. Start on {C} and you play only white keys. Start anywhere else and the pattern needs some black keys.',
        'Ogni scala maggiore usa lo stesso schema: <b>tono, tono, semitono, tono, tono, tono, semitono</b>. Partendo da {C} suoni solo tasti bianchi. Partendo da un’altra nota, lo schema ha bisogno di qualche tasto nero.'));
      h(L('The minor scale', 'La scala minore'));
      p(L('The natural minor scale uses <b>whole, half, whole, whole, half, whole, whole</b>. Its third note is lower, and that makes it sound darker or sadder. {A} minor uses only white keys, just like {C} major: they are <b>relatives</b>.',
        'La scala minore naturale usa <b>tono, semitono, tono, tono, semitono, tono, tono</b>. La sua terza nota è più bassa, e per questo suona più scura o triste. {A} minore usa solo tasti bianchi, come {C} maggiore: sono <b>relative</b>.'));
      h(L('The pentatonic scale', 'La scala pentatonica'));
      p(L('Pentatonic means “five notes”. Take the major scale and leave out the 4th and 7th notes. There are no half steps left, so almost any order of these notes sounds good. Many folk songs all over the world use it.',
        'Pentatonica vuol dire “cinque note”. Prendi la scala maggiore e togli la 4ª e la 7ª nota. Non restano semitoni, quindi quasi ogni ordine di queste note suona bene. Moltissime canzoni popolari del mondo la usano.'));
      tip(L('Fun fact: the five black keys are a pentatonic scale. Play only black keys, in any order: it always sounds nice!',
        'Curiosità: i cinque tasti neri sono una scala pentatonica. Suona solo tasti neri, in qualsiasi ordine: suona sempre bene!'));
      h(L('Scale degrees', 'I gradi della scala'));
      p(L('Each note of the scale has a number (a <b>degree</b>). Musicians also give some of them names: 1 is the <b>tonic</b> (home), 4 is the <b>subdominant</b>, 5 is the <b>dominant</b> (it wants to go home), 7 is the <b>leading tone</b> (it leans up to the tonic).',
        'Ogni nota della scala ha un numero (un <b>grado</b>). Alcuni gradi hanno anche un nome: il 1° è la <b>tonica</b> (casa), il 4° la <b>sottodominante</b>, il 5° la <b>dominante</b> (vuole tornare a casa), il 7° la <b>sensibile</b> (spinge verso la tonica).'));
    },
    notes() { return T().scale(60 + S.scaleRoot, S.scaleType); },
    draw() {
      const box = this.box;
      if (!box) return;
      box.innerHTML = '';
      const minor = S.scaleType === 'minor';
      const roots = el('div', 'th-roots');
      for (let k = 0; k < 12; k++) {
        const b = button(T().keyRoot(k, minor), 'small th-root' + (k === S.scaleRoot ? ' on' : ''), () => { S.scaleRoot = k; this.follow = -1; this.draw(); });
        b.style.setProperty('--c', N().color(60 + k));
        roots.appendChild(b);
      }
      const types = el('div', 'seg th-seg');
      [['major', L('Major', 'Maggiore')], ['minor', L('Minor', 'Minore')], ['penta', L('Pentatonic', 'Pentatonica')]].forEach(([id, label]) => {
        const b = button(label, 'small' + (S.scaleType === id ? ' on' : ''), () => { S.scaleType = id; this.follow = -1; this.draw(); });
        types.appendChild(b);
      });
      const sc = this.notes();
      const pattern = el('div', 'th-pattern');
      sc.forEach((n, i) => {
        const chip = el('span', 'th-chip' + (this.follow === i ? ' now' : this.follow > i ? ' done' : ''), T().spName(n.sp));
        chip.style.setProperty('--c', N().color(n.midi));
        pattern.appendChild(chip);
        if (i < sc.length - 1) {
          const d = sc[i + 1].midi - n.midi;
          const w = d === 1 ? L('H', 'S') : d === 2 ? L('W', 'T') : L('W+H', 'T+S');
          pattern.appendChild(el('span', 'th-step s' + d, w));
        }
      });
      const legend = el('div', 'th-legend', L('W = whole step · H = half step', 'T = tono · S = semitono'));
      const staff = el('div', 'staff-box th-staff');
      staff.style.width = 'min(560px, 100%)';
      staff.innerHTML = OP.staff.render({ clef: 'treble', width: 120 + sc.length * 40, notes: sc.map((n, i) => ({ midi: n.midi, spelled: [n.sp], color: N().color(n.midi), cls: this.follow === i ? 'cur' : '', label: String(i + 1) })) });
      const ctrl = el('div', 'th-row');
      ctrl.append(
        button(PLAY_ICON + L('Play it', 'Ascolta'), 'primary small', () => this.playScale()),
        button(this.follow >= 0 ? L('Stop', 'Basta') : L('Your turn', 'Tocca a te'), 'small', () => { this.follow = this.follow >= 0 ? -1 : 0; this.draw(); }));
      const msg = el('div', 'th-msg', this.follow >= 0 ? L('Play the glowing key!', 'Suona il tasto che brilla!') : '');
      box.append(roots, types, pattern, legend, staff, ctrl, msg);
      OP.app.fitKeyboard(sc[0].midi, sc[sc.length - 1].midi);
      OP.app.kb.soft(sc.map((n) => n.midi));
      if (this.follow >= 0) OP.app.kb.target(sc[this.follow].midi); else OP.app.kb.clearTargets();
    },
    playScale() {
      stopPlayback();
      const sc = this.notes().map((n) => n.midi);
      const seq = sc.concat(sc.slice(0, -1).reverse());
      seq.forEach((m, i) => later(() => play(m, i === seq.length - 1 ? 1 : 0.32), i * 330));
    },
    noteOn(m) {
      if (this.follow < 0) return;
      const sc = this.notes();
      const want = sc[this.follow].midi;
      if (N().pc(m) !== N().pc(want)) { OP.app.kb.flash(m, 'bad'); return; }
      OP.app.kb.flash(m, 'good');
      this.follow++;
      if (this.follow >= sc.length) {
        this.follow = -1;
        OP.audio.sfx.good();
        this.draw();
        const msg = $('.th-msg', this.box);
        msg.textContent = OP.t('yay')[0];
        msg.className = 'th-msg good';
      } else this.draw();
    },
  };

  /* ======================================================================
   * Lesson 3: the circle of fifths
   * ==================================================================== */
  const majorAt = (i) => (i * 7) % 12;
  const sigAt = (i) => (i <= 6 ? i : i - 12);
  const indexOfMajor = (pc) => (pc * 7) % 12; // 7 is its own inverse mod 12
  const chordRoot = (pc) => { const r = 48 + pc; return r < 53 ? r + 12 : r; }; // F3..E4
  /** Tonic name of the key at circle position k. At the bottom of the circle the
   * spelling follows the side you look from: F♯ / D♯m among sharps, G♭ / E♭m among flats. */
  function circleRoot(k, minor, ctx) {
    const flats = ctx != null ? ctx < 0 : false;
    if (k === 6) return minor ? (flats ? T().letterName(2, -1) : T().letterName(1, 1)) : (flats ? T().letterName(4, -1) : T().letterName(3, 1));
    if (k === 7 && ctx > 0) return minor ? T().letterName(5, 1) : T().letterName(0, 1); // A♯m / C♯ next to F♯
    return T().keyRoot(minor ? (majorAt(k) + 9) % 12 : majorAt(k), minor);
  }
  const circleKey = (k, minor, ctx) => circleRoot(k, minor, ctx) + ' ' + (minor ? L('minor', 'minore') : L('major', 'maggiore'));

  const circle = {
    id: 'circle', color: '#ffd43b',
    title: () => L('The circle of fifths', 'Il circolo delle quinte'),
    desc: () => L('All twelve keys on one wheel: key signatures, relative minors, and chords that go together.', 'Tutte le dodici tonalità su una ruota: armature di chiave, relative minori e accordi che stanno bene insieme.'),
    render() {
      p(L('The <b>circle of fifths</b> puts all twelve major keys around a clock. Each step clockwise goes <b>up a fifth</b> (five letter names: {C} D E F {G}) and adds <b>one sharp</b>. Each step anticlockwise goes down a fifth and adds <b>one flat</b>.',
        'Il <b>circolo delle quinte</b> mette le dodici tonalità maggiori intorno a un orologio. Ogni passo in senso orario sale di <b>una quinta</b> (cinque note: {C} Re Mi Fa {G}) e aggiunge <b>un diesis</b>. Ogni passo in senso antiorario scende di una quinta e aggiunge <b>un bemolle</b>.'));
      const wrap = doc().appendChild(el('div', 'th-circle'));
      this.wheel = wrap.appendChild(el('div', 'th-wheel'));
      this.info = wrap.appendChild(el('div', 'th-key-info'));
      this.wheel.addEventListener('click', (e) => {
        const g = e.target.closest('[data-i]');
        if (!g) return;
        stopPlayback();
        S.ci = +g.dataset.i;
        S.cminor = g.dataset.minor === '1';
        this.draw();
        const pc = S.cminor ? (majorAt(S.ci) + 9) % 12 : majorAt(S.ci);
        playChord(OP.chords.notes(chordRoot(pc), S.cminor ? 'min' : 'maj'), 1.1);
      });
      this.wheel.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-i]')) { e.preventDefault(); e.target.closest('[data-i]').dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
      this.draw();

      h(L('How to read it', 'Come si legge'));
      ul([
        L('<b>Outer ring:</b> major keys. {C} major at the top has no sharps or flats.', '<b>Anello esterno:</b> tonalità maggiori. {C} maggiore, in alto, non ha diesis né bemolle.'),
        L('<b>Middle ring:</b> the <b>relative minor</b> of each major key. It uses the same key signature: {A} minor has no sharps or flats, like {C} major.', '<b>Anello di mezzo:</b> la <b>relativa minore</b> di ogni tonalità maggiore. Usa la stessa armatura: {A} minore non ha alterazioni, come {C} maggiore.'),
        L('<b>Inner ring:</b> how many sharps ♯ or flats ♭ the key signature has.', '<b>Anello interno:</b> quanti diesis ♯ o bemolle ♭ ha l’armatura di chiave.'),
        L('At the bottom, {F#} major and {Gb} major are the same keys on the piano with two different names (<b>enharmonic</b> keys).', 'In basso, {F#} maggiore e {Gb} maggiore sono gli stessi tasti con due nomi diversi (tonalità <b>enarmoniche</b>).'),
      ]);
      h(L('Neighbours are friends', 'I vicini sono amici'));
      p(L('Keys next to each other share all notes but one, so they sound good together. The key on the right is the <b>dominant</b> (V) and the key on the left is the <b>subdominant</b> (IV). With the chords I, IV and V you can play hundreds of songs: in {C} major they are {C}, {F} and {G}.',
        'Le tonalità vicine hanno tutte le note in comune tranne una, quindi stanno bene insieme. Quella a destra è la <b>dominante</b> (V), quella a sinistra la <b>sottodominante</b> (IV). Con gli accordi I, IV e V puoi suonare centinaia di canzoni: in {C} maggiore sono {C}, {F} e {G}.'));
      p(L('The six highlighted pieces of the wheel are the six chords you will meet most often in the selected key. Play a major or minor chord on the piano and watch the wheel!',
        'I sei spicchi evidenziati sono i sei accordi che incontri più spesso nella tonalità scelta. Suona un accordo maggiore o minore sul pianoforte e guarda la ruota!'));
      h(L('Key signatures', 'L’armatura di chiave'));
      p(L('The sharps or flats of a key are written once, at the start of every line, right after the clef. This is the <b>key signature</b>. They always come in the same order:',
        'I diesis o i bemolle di una tonalità si scrivono una volta sola, all’inizio di ogni rigo, subito dopo la chiave. È l’<b>armatura di chiave</b>. Arrivano sempre nello stesso ordine:'));
      const orders = el('div', 'th-orders');
      orders.innerHTML = '<div><b>♯</b> ' + T().sigNotes(7).join(' · ') + '</div><div><b>♭</b> ' + T().sigNotes(-7).join(' · ') + '</div>';
      doc().appendChild(orders);
      const two = el('div', 'th-row th-sigs');
      [7, -7].forEach((s) => { const b = el('div', 'staff-box th-staff'); b.innerHTML = OP.staff.render({ clef: 'grand', width: 170, keySig: s, notes: [] }); two.appendChild(b); });
      doc().appendChild(two);
      tip(L('The flats are the sharps backwards. To remember the sharps: <b>F</b>ather <b>C</b>harles <b>G</b>oes <b>D</b>own <b>A</b>nd <b>E</b>nds <b>B</b>attle. Read it backwards for the flats: <b>B</b>attle <b>E</b>nds <b>A</b>nd <b>D</b>own <b>G</b>oes <b>C</b>harles’ <b>F</b>ather.',
        'I bemolle sono i diesis al contrario: Fa Do Sol Re La Mi Si per i diesis, Si Mi La Re Sol Do Fa per i bemolle. E l’ordine dei diesis è proprio il giro delle quinte!'));
      h(L('Two tricks to name a key', 'Due trucchi per riconoscere la tonalità'));
      ul([
        L('<b>Sharps:</b> the last sharp is a half step below the key. Last sharp {F#} → {G} major. Last sharp {C#} → {D} major.', '<b>Diesis:</b> l’ultimo diesis è un semitono sotto la tonica. Ultimo diesis {F#} → {G} maggiore. Ultimo diesis {C#} → {D} maggiore.'),
        L('<b>Flats:</b> the second-to-last flat is the key. {Bb} {Eb} → {Eb} major. Just one flat ({Bb}) is {F} major.', '<b>Bemolle:</b> il penultimo bemolle è la tonica. {Bb} {Eb} → {Eb} maggiore. Un solo bemolle ({Bb}) è {F} maggiore.'),
        L('For the minor key, go down three half steps from the major key (or look at the middle ring).', 'Per la tonalità minore scendi di tre semitoni dalla maggiore (o guarda l’anello di mezzo).'),
      ]);
    },
    draw() {
      this.wheel.innerHTML = this.svg();
      this.drawInfo();
    },
    svg() {
      const pt = (r, a) => { const t = (a * Math.PI) / 180; return (r * Math.sin(t)).toFixed(1) + ' ' + (-r * Math.cos(t)).toFixed(1); };
      const sector = (r1, r2, a0, a1) => 'M' + pt(r2, a0) + 'A' + r2 + ' ' + r2 + ' 0 0 1 ' + pt(r2, a1) + 'L' + pt(r1, a1) + 'A' + r1 + ' ' + r1 + ' 0 0 0 ' + pt(r1, a0) + 'Z';
      const txt = (r, a, lines, cls) => {
        const [x, y] = pt(r, a).split(' ');
        if (lines.length === 1) return '<text class="' + cls + '" x="' + x + '" y="' + y + '">' + lines[0] + '</text>';
        return '<text class="' + cls + ' two" x="' + x + '" y="' + y + '"><tspan x="' + x + '" dy="-0.55em">' + lines[0] + '</tspan><tspan x="' + x + '" dy="1.1em">' + lines[1] + '</tspan></text>';
      };
      let s = '<svg viewBox="-215 -215 430 430" role="group" aria-label="' + this.title() + '">';
      for (let i = 0; i < 12; i++) {
        const maj = majorAt(i), min = (maj + 9) % 12, sg = sigAt(i);
        const a0 = i * 30 - 15, a1 = i * 30 + 15, a = i * 30;
        const fam = [0, 1, 11].includes((i - S.ci + 12) % 12);
        const majLabel = i === 6 ? [T().keyRoot(6, false), T().letterName(4, -1)] : [T().keyRoot(maj, false)];
        const minLabel = i === 6 ? [T().letterName(1, 1) + 'm', T().letterName(2, -1) + 'm'] : [T().keyRoot(min, true) + 'm'];
        const name = T().keyName(maj, false);
        s += '<g class="seg maj' + (fam ? '' : ' far') + (S.ci === i && !S.cminor ? ' sel' : '') + '" data-i="' + i + '" data-minor="0" tabindex="0" role="button" aria-label="' + name + '">' +
          '<path d="' + sector(140, 205, a0, a1) + '" style="fill:' + N().color(60 + maj) + '"/>' + txt(172, a, majLabel, 'lbl') + '</g>';
        s += '<g class="seg min' + (fam ? '' : ' far') + (S.ci === i && S.cminor ? ' sel' : '') + '" data-i="' + i + '" data-minor="1" tabindex="0" role="button" aria-label="' + T().keyName(min, true) + '">' +
          '<path d="' + sector(92, 140, a0, a1) + '" style="fill:color-mix(in srgb, ' + N().color(60 + min) + ' 55%, var(--paper))"/>' + txt(116, a, minLabel, 'lbl small') + '</g>';
        const sgText = sg === 0 ? '0' : i === 6 ? ['6♯', '6♭'] : Math.abs(sg) + (sg > 0 ? '♯' : '♭');
        s += '<g class="sig' + (fam ? '' : ' far') + '"><path d="' + sector(62, 92, a0, a1) + '"/>' + txt(77, a, Array.isArray(sgText) ? sgText : [sgText], 'lbl tiny') + '</g>';
      }
      s += '<circle class="hub" r="60"/>' +
        '<text class="hub-key" y="-6">' + circleRoot(S.ci, S.cminor) + (S.cminor ? 'm' : '') + '</text>' +
        '<text class="hub-sub" y="18">' + (S.cminor ? L('minor', 'minore') : L('major', 'maggiore')) + '</text>';
      s += '<text class="dir" x="150" y="-196">♯ ↻</text><text class="dir" x="-150" y="-196">↺ ♭</text>';
      return s + '</svg>';
    },
    drawInfo() {
      const i = S.ci, minor = S.cminor;
      const maj = majorAt(i), pc = minor ? (maj + 9) % 12 : maj, sg = sigAt(i);
      const box = this.info;
      box.innerHTML = '';
      box.appendChild(el('div', 'th-key-name', circleKey(i, minor) + (i === 6 ? ' <small>= ' + circleKey(6, minor, -1) + '</small>' : '')));
      box.appendChild(el('div', 'th-key-sig', T().sigText(sg) + (i === 6 ? ' <small>(' + T().sigText(-6) + ')</small>' : '')));
      const st = el('div', 'staff-box th-staff');
      st.innerHTML = OP.staff.render({ clef: 'treble', width: 190, keySig: sg, notes: [] });
      box.appendChild(st);
      const rel = minor ? L('Relative major', 'Relativa maggiore') + ': <b>' + circleKey(i, false) + '</b>' : L('Relative minor', 'Relativa minore') + ': <b>' + circleKey(i, true) + '</b>';
      box.appendChild(el('p', null, rel));
      const left = (i + 11) % 12, right = (i + 1) % 12;
      const chordPc = (k) => (minor ? (majorAt(k) + 9) % 12 : majorAt(k));
      const sym = (k) => circleRoot(k, minor, sg) + (minor ? 'm' : '');
      box.appendChild(el('p', null, L('Main chords', 'Accordi principali') + ': <b>' + sym(i) + '</b> (' + (minor ? 'i' : 'I') + ') · <b>' + sym(left) + '</b> (' + (minor ? 'iv' : 'IV') + ') · <b>' + sym(right) + '</b> (' + (minor ? 'v' : 'V') + ')'));
      const ctrl = el('div', 'th-row');
      ctrl.append(
        button(PLAY_ICON + L('Scale', 'Scala'), 'small', () => {
          stopPlayback();
          const sc = T().scale(60 + pc - (pc > 6 ? 12 : 0), minor ? 'minor' : 'major').map((n) => n.midi);
          OP.app.fitKeyboard(sc[0], sc[7]);
          sc.forEach((m, k) => later(() => play(m, k === 7 ? 1 : 0.32), k * 330));
        }),
        button(PLAY_ICON + (minor ? 'i – iv – v – i' : 'I – IV – V – I'), 'small', () => {
          stopPlayback();
          const type = minor ? 'min' : 'maj';
          [i, left, right, i].forEach((k, n) => later(() => { const r = chordRoot(chordPc(k)); playChord(OP.chords.notes(r, type).concat([r - 12]), 0.85); }, n * 900));
        }),
        button('↻ ' + L('Walk around', 'Fai il giro'), 'small', () => this.walk()));
      box.appendChild(ctrl);
    },
    walk() {
      stopPlayback();
      for (let k = 0; k <= 12; k++) {
        later(() => {
          S.ci = k % 12;
          S.cminor = false;
          this.draw();
          const r = chordRoot(majorAt(S.ci));
          playChord(OP.chords.notes(r, 'maj').concat([r - 12]), 0.6, 75);
        }, k * 650);
      }
    },
    noteOn() {
      const c = OP.chords.detect([...OP.app.held]);
      if (!c || (c.type !== 'maj' && c.type !== 'min')) return;
      const minor = c.type === 'min';
      const i = indexOfMajor(minor ? (c.root + 3) % 12 : c.root);
      const g = this.wheel && this.wheel.querySelector('[data-i="' + i + '"][data-minor="' + (minor ? 1 : 0) + '"]');
      if (!g) return;
      g.classList.remove('hit'); void g.getBoundingClientRect(); g.classList.add('hit');
      setTimeout(() => g.classList.remove('hit'), 900);
    },
  };

  /* ======================================================================
   * Lesson 4: chords in a key
   * ==================================================================== */
  const family = {
    id: 'family', color: '#69db7c',
    title: () => L('Chords in a key', 'Gli accordi della tonalità'),
    desc: () => L('The seven chords of a major key, Roman numerals, and famous chord progressions.', 'I sette accordi di una tonalità maggiore, i numeri romani e i giri di accordi famosi.'),
    render() {
      p(L('Build a chord on every note of a major scale, using only notes of the scale (skip one, take one: 1-3-5, 2-4-6…). You get seven chords. Musicians number them with <b>Roman numerals</b>: big for major chords, small for minor chords.',
        'Costruisci un accordo su ogni nota di una scala maggiore, usando solo note della scala (una sì e una no: 1-3-5, 2-4-6…). Ottieni sette accordi. I musicisti li numerano con i <b>numeri romani</b>: maiuscoli per gli accordi maggiori, minuscoli per i minori.'));
      this.box = doc().appendChild(el('div', 'th-family'));
      this.draw();
      h(L('Same pattern in every key', 'Lo stesso schema in ogni tonalità'));
      p(L('In every major key the chords follow the same pattern: <b>major, minor, minor, major, major, minor, diminished</b>. Learn it once and it works everywhere.',
        'In ogni tonalità maggiore gli accordi seguono lo stesso schema: <b>maggiore, minore, minore, maggiore, maggiore, minore, diminuito</b>. Lo impari una volta e vale ovunque.'));
      h(L('What each chord does', 'Che cosa fa ogni accordo'));
      ul([
        L('<b>I (tonic):</b> home. Songs usually start and end here.', '<b>I (tonica):</b> casa. Le canzoni di solito iniziano e finiscono qui.'),
        L('<b>V (dominant):</b> tension. It really wants to go back to I. V → I is called a <b>cadence</b>, like a full stop at the end of a sentence.', '<b>V (dominante):</b> tensione. Vuole tanto tornare al I. V → I si chiama <b>cadenza</b>, come il punto alla fine di una frase.'),
        L('<b>IV (subdominant):</b> a step away from home, often on the way to V.', '<b>IV (sottodominante):</b> un passo fuori casa, spesso sulla strada verso il V.'),
        L('<b>vi, ii, iii:</b> the minor chords add colour. vi is the relative minor.', '<b>vi, ii, iii:</b> gli accordi minori danno colore. Il vi è la relativa minore.'),
        L('<b>vii°:</b> diminished, very tense, it pulls hard towards I.', '<b>vii°:</b> diminuito, molto teso, tira forte verso il I.'),
      ]);
      tip(L('Play any chord on your keyboard: if it belongs to the chosen key, its card lights up.', 'Suona un accordo sulla tastiera: se appartiene alla tonalità scelta, la sua carta si illumina.'));
    },
    draw() {
      const box = this.box;
      box.innerHTML = '';
      const keys = el('div', 'th-roots');
      for (let k = 0; k < 12; k++) {
        const b = button(T().keyRoot(k, false), 'small th-root' + (k === S.famKey ? ' on' : ''), () => { S.famKey = k; this.draw(); });
        b.style.setProperty('--c', N().color(60 + k));
        keys.appendChild(b);
      }
      const tonic = (S.famKey <= 7 ? 60 : 48) + S.famKey;
      this.chords = T().triads(tonic);
      const cards = el('div', 'th-cards');
      this.chords.forEach((c) => {
        const b = el('button', 'th-card ' + c.type);
        b.type = 'button';
        b.dataset.d = c.degree;
        b.style.setProperty('--c', N().color(c.notes[0].midi));
        b.innerHTML = '<span class="num">' + c.numeral + '</span><span class="sym">' + c.symbol + '</span><span class="kind">' + OP.t('chord.' + c.type) + '</span><span class="ns">' + c.notes.map((n) => T().spName(n.sp)).join(' ') + '</span>';
        b.addEventListener('click', () => { stopPlayback(); playChord(c.notes.map((n) => n.midi), 1.2); });
        cards.appendChild(b);
      });
      const staff = el('div', 'staff-box th-staff');
      staff.style.width = 'min(620px, 100%)';
      const sg = T().sig(S.famKey, false);
      staff.innerHTML = OP.staff.render({ clef: 'treble', width: 130 + Math.abs(sg) * 10 + 7 * 46, keySig: sg, notes: this.chords.map((c) => ({ midis: c.notes.map((n) => n.midi), spelled: c.notes.map((n) => n.sp), colors: c.notes.map((n) => N().color(n.midi)), label: c.numeral })) });
      const prog = el('div', 'th-row');
      const P = (label, degs) => button(PLAY_ICON + label, 'small', () => this.progression(degs));
      prog.append(P('I – IV – V – I', [0, 3, 4, 0]), P('I – V – vi – IV', [0, 4, 5, 3]), P('ii – V – I', [1, 4, 0]), P('I – vi – IV – V', [0, 5, 3, 4]));
      box.append(el('div', 'th-label', L('Key', 'Tonalità') + ': <b>' + T().keyName(S.famKey, false) + '</b> · ' + T().sigText(sg)), keys, cards, staff, prog);
      OP.app.fitKeyboard(Math.min(tonic, 60), tonic + 24);
    },
    progression(degs) {
      stopPlayback();
      degs.forEach((d, n) => later(() => {
        const c = this.chords[d];
        const ns = c.notes.map((x) => x.midi);
        playChord(ns.concat([ns[0] - 12]), 0.9);
        this.light(d);
      }, n * 1000));
    },
    light(d) {
      const card = this.box && this.box.querySelector('.th-card[data-d="' + d + '"]');
      if (!card) return;
      card.classList.remove('hit'); void card.offsetWidth; card.classList.add('hit');
    },
    noteOn() {
      const c = OP.chords.detect([...OP.app.held]);
      if (!c || !this.chords) return;
      const d = this.chords.findIndex((x) => N().pc(x.notes[0].midi) === c.root && x.type === c.type);
      if (d >= 0) this.light(d);
    },
  };

  /* ======================================================================
   * Lesson 5: rhythm and time
   * ==================================================================== */
  function glyph(kind) {
    const hollow = kind === 'w' || kind === 'h';
    let s = '<svg class="glyph" viewBox="0 0 32 44" aria-hidden="true"><ellipse cx="12" cy="35" rx="7" ry="5" transform="rotate(-20 12 35)" fill="' + (hollow ? 'none' : 'currentColor') + '" stroke="currentColor" stroke-width="2.4"/>';
    if (kind !== 'w') s += '<line x1="18.4" y1="34" x2="18.4" y2="5" stroke="currentColor" stroke-width="2.2"/>';
    if (kind === 'e' || kind === 's') s += '<path d="M18.4 5c1 6 10 8 8 17" fill="none" stroke="currentColor" stroke-width="2.4"/>';
    if (kind === 's') s += '<path d="M18.4 12c1 6 10 8 8 17" fill="none" stroke="currentColor" stroke-width="2.4"/>';
    return s + '</svg>';
  }
  const rhythm = {
    id: 'rhythm', color: '#38d9a9',
    title: () => L('Rhythm and time', 'Ritmo e tempo'),
    desc: () => L('Note values, beats, bars and time signatures.', 'Le figure musicali, i battiti, le battute e i tempi.'),
    render() {
      p(L('Music has a steady <b>beat</b>, like a heartbeat or a clock. The shape of a note tells you how many beats it lasts.',
        'La musica ha un <b>battito</b> regolare, come il cuore o un orologio. La forma di una nota dice quanti battiti dura.'));
      h(L('Note values', 'Le figure musicali'));
      const rows = [
        ['w', 4, L('Whole note', 'Semibreve'), L('4 beats', '4 battiti')],
        ['h', 2, L('Half note', 'Minima'), L('2 beats', '2 battiti')],
        ['q', 1, L('Quarter note', 'Semiminima'), L('1 beat', '1 battito')],
        ['e', 0.5, L('Eighth note', 'Croma'), L('½ beat', '½ battito')],
        ['s', 0.25, L('Sixteenth note', 'Semicroma'), L('¼ beat', '¼ di battito')],
      ];
      const table = doc().appendChild(el('div', 'th-rhythm'));
      rows.forEach(([kind, val, name, beats]) => {
        const row = el('button', 'th-rrow');
        row.type = 'button';
        const n = 4 / val;
        row.innerHTML = '<span class="g">' + glyph(kind) + '</span><span class="rn"><b>' + name + '</b><small>' + beats + '</small></span><span class="bar">' +
          Array.from({ length: n }, () => '<i></i>').join('') + '</span>';
        row.addEventListener('click', () => this.playValue(val, row));
        table.appendChild(row);
      });
      p(L('Tap a row to hear it against four beats of a metronome. Each row fits the same time: 1 whole = 2 halves = 4 quarters = 8 eighths = 16 sixteenths.',
        'Tocca una riga per sentirla con quattro battiti di metronomo. Ogni riga dura lo stesso tempo: 1 semibreve = 2 minime = 4 semiminime = 8 crome = 16 semicrome.'));
      tip(L('A <b>dot</b> after a note adds half of its value: a dotted half note lasts 2 + 1 = 3 beats. Every note value also has a <b>rest</b>, a sign for silence that lasts just as long.',
        'Il <b>punto</b> dopo una nota aggiunge metà del suo valore: una minima puntata dura 2 + 1 = 3 battiti. Ogni figura ha anche la sua <b>pausa</b>, un segno di silenzio che dura altrettanto.'));
      h(L('Bars and time signatures', 'Battute e tempi'));
      p(L('Beats are grouped in <b>bars</b> (or measures), separated by bar lines. The first beat of each bar is the strongest. The <b>time signature</b> at the start says how many beats are in a bar (top number) and which note gets one beat (bottom number: 4 = quarter note, 8 = eighth note).',
        'I battiti sono raggruppati in <b>battute</b> (o misure), separate dalle stanghette. Il primo battito di ogni battuta è il più forte. Il <b>tempo</b> scritto all’inizio dice quanti battiti ci sono in una battuta (numero in alto) e quale figura vale un battito (numero in basso: 4 = semiminima, 8 = croma).'));
      const metres = [
        { n: 2, d: 4, acc: [0], beat: 0.55, text: L('March: ONE two, ONE two.', 'Marcia: UNO due, UNO due.') },
        { n: 3, d: 4, acc: [0], beat: 0.55, text: L('Waltz: ONE two three. “Happy Birthday” is in 3/4.', 'Valzer: UNO due tre. “Tanti auguri” è in 3/4.') },
        { n: 4, d: 4, acc: [0, 2], beat: 0.55, text: L('The most common: ONE two THREE four. “Twinkle Twinkle” is in 4/4.', 'Il più comune: UNO due TRE quattro. “Brilla brilla” è in 4/4.') },
        { n: 6, d: 8, acc: [0, 3], beat: 0.3, text: L('Six quick beats felt in two groups: ONE two three FOUR five six. “Row, Row, Row Your Boat” is in 6/8.', 'Sei battiti veloci in due gruppi: UNO due tre QUATTRO cinque sei. “Row, Row, Row Your Boat” è in 6/8.') },
      ];
      const grid = doc().appendChild(el('div', 'th-metres'));
      metres.forEach((mt) => {
        const card = el('div', 'th-metre');
        card.innerHTML = '<div class="ts"><b>' + mt.n + '</b><b>' + mt.d + '</b></div><div class="mt-body"><p>' + mt.text + '</p><div class="beats">' +
          Array.from({ length: mt.n }, (_, k) => '<i class="' + (mt.acc.includes(k) ? 'acc' : '') + '">' + (k + 1) + '</i>').join('') + '</div></div>';
        card.appendChild(button(PLAY_ICON + L('Count', 'Conta'), 'small', () => this.count(mt, card)));
        grid.appendChild(card);
      });
      h(L('Tempo', 'L’andamento'));
      p(L('<b>Tempo</b> is how fast the beat goes, measured in beats per minute (BPM). Composers often write Italian words: <i>Largo</i> (very slow), <i>Adagio</i> (slow), <i>Andante</i> (walking), <i>Moderato</i>, <i>Allegro</i> (fast and cheerful), <i>Presto</i> (very fast).',
        'L’<b>andamento</b> è quanto va veloce il battito, misurato in battiti al minuto (BPM). Si indica con parole italiane usate in tutto il mondo: <i>Largo</i> (molto lento), <i>Adagio</i> (lento), <i>Andante</i> (al passo), <i>Moderato</i>, <i>Allegro</i> (veloce e allegro), <i>Presto</i> (molto veloce).'));
    },
    playValue(val, row) {
      stopPlayback();
      const beat = 0.6;
      const cells = row.querySelectorAll('.bar i');
      for (let b = 0; b < 4; b++) later(() => (b ? OP.audio.sfx.tick() : OP.audio.sfx.tock()), b * beat * 1000);
      cells.forEach((c, k) => later(() => { cells.forEach((x) => x.classList.remove('on')); c.classList.add('on'); play(67, val * beat * 0.85, 85); }, k * val * beat * 1000));
      later(() => cells.forEach((x) => x.classList.remove('on')), 4 * beat * 1000 + 100);
      resets.push(() => cells.forEach((x) => x.classList.remove('on')));
    },
    count(mt, card) {
      stopPlayback();
      const dots = card.querySelectorAll('.beats i');
      for (let k = 0; k < mt.n * 2; k++) {
        later(() => {
          dots.forEach((x) => x.classList.remove('on'));
          dots[k % mt.n].classList.add('on');
          if (mt.acc.includes(k % mt.n)) { OP.audio.sfx.tock(); if (k % mt.n === 0) play(48, mt.beat * 0.9, 70); } else OP.audio.sfx.tick();
        }, k * mt.beat * 1000);
      }
      later(() => dots.forEach((x) => x.classList.remove('on')), mt.n * 2 * mt.beat * 1000);
      resets.push(() => dots.forEach((x) => x.classList.remove('on')));
    },
  };

  /* ======================================================================
   * Lesson 6: melody
   * ==================================================================== */
  const melody = {
    id: 'melody', color: '#4dabf7',
    title: () => L('Melody', 'La melodia'),
    desc: () => L('Steps and leaps, the shape of a tune, phrases that ask and answer.', 'Gradi e salti, la forma di una melodia, frasi che chiedono e rispondono.'),
    render() {
      p(L('A <b>melody</b> is a line of notes, one after another: the part of the music you can sing or whistle. Music has three big ingredients: <b>melody</b> (the tune), <b>harmony</b> (the chords under it) and <b>rhythm</b> (when the notes happen).',
        'La <b>melodia</b> è una fila di note, una dopo l’altra: la parte della musica che puoi cantare o fischiettare. La musica ha tre grandi ingredienti: <b>melodia</b> (il motivo), <b>armonia</b> (gli accordi sotto) e <b>ritmo</b> (quando arrivano le note).'));
      h(L('Steps, skips and leaps', 'Gradi congiunti e salti'));
      p(L('A melody can move to the next note of the scale (a <b>step</b>), skip one note (a <b>skip</b>, a 3rd), or jump further (a <b>leap</b>). Most good melodies move mostly by steps, with a few leaps for excitement. After a big leap, a melody usually turns back with a step.',
        'Una melodia può andare alla nota vicina della scala (<b>grado congiunto</b>), saltarne una (un <b>salto</b> di terza) o saltare più lontano (un <b>salto</b> ampio). Le belle melodie si muovono soprattutto per gradi congiunti, con qualche salto per dare slancio. Dopo un salto grande, di solito la melodia torna indietro di un grado.'));
      example({ voices: ['C4 D4 E4 F4 G4 F4 E4 D4 C4'], names: true, caption: L('Steps: like walking up and down stairs.', 'Gradi congiunti: come salire e scendere le scale.') });
      example({ voices: ['C4 E4 G4 E4 C4 E4 G4 C5'], names: true, caption: L('Skips: the notes of a chord, one at a time.', 'Salti di terza: le note di un accordo, una alla volta.') });
      example({ voices: ['C4 G4 F4 E4 D4 C5 B4 C5'], names: true, caption: L('A leap, then steps back: the leap gets “filled in”.', 'Un salto, poi gradi all’indietro: il salto viene “riempito”.') });
      h(L('The shape of a melody', 'La forma di una melodia'));
      p(L('Draw a line through the note heads and you see the melody’s <b>contour</b>. A common shape is the <b>arch</b>: it climbs to one highest note, the <b>climax</b>, then comes back down.',
        'Se tracci una linea tra le teste delle note vedi il <b>profilo</b> della melodia. Una forma molto comune è l’<b>arco</b>: sale fino a una nota più alta di tutte, il <b>culmine</b>, poi ridiscende.'));
      const shapes = doc().appendChild(el('div', 'th-grid2'));
      example({ voices: ['C4 D4 E4 G4 A4 C5'], caption: L('Going up', 'Sale') }, shapes);
      example({ voices: ['C5 A4 G4 E4 D4 C4'], caption: L('Going down', 'Scende') }, shapes);
      example({ voices: ['C4 E4 G4 C5 A4 F4 D4 C4'], caption: L('Arch', 'Arco') }, shapes);
      example({ voices: ['E4 G4 D4 F4 C4 E4 D4 C4'], caption: L('Wave', 'Onda') }, shapes);
      h(L('Home note', 'La nota di casa'));
      p(L('Melodies feel finished when they end on the <b>tonic</b>, the first note of the scale. Stop anywhere else and it sounds like the music is waiting for more.',
        'Una melodia sembra finita quando si ferma sulla <b>tonica</b>, la prima nota della scala. Se si ferma altrove, sembra che la musica aspetti ancora qualcosa.'));
      h(L('Question and answer', 'Domanda e risposta'));
      p(L('Melodies are built from <b>phrases</b>, like sentences. Often the first phrase is a <b>question</b>: it stops on an open note such as {D} or {G}. The second phrase is the <b>answer</b>: it starts the same way and ends at home on {C}.',
        'Le melodie sono fatte di <b>frasi</b>, come le frasi di un discorso. Spesso la prima è una <b>domanda</b>: si ferma su una nota aperta come {D} o {G}. La seconda è la <b>risposta</b>: comincia allo stesso modo e finisce a casa, sul {C}.'));
      example({ voices: ['C4 E4 G4 A4 G4 E4 D4 -'], names: true, caption: L('Question: ends on {D}, it sounds unfinished…', 'Domanda: finisce sul {D}, sembra non finita…') });
      example({ voices: ['C4 E4 G4 A4 G4 D4 C4 -'], names: true, caption: L('Answer: ends on {C}. Home!', 'Risposta: finisce sul {C}. A casa!') });
      h(L('Repetition and sequence', 'Ripetizione e progressione'));
      p(L('A short idea of a few notes is called a <b>motif</b>. Composers repeat it to make the melody easy to remember, and change it a little to keep it interesting. Repeating a motif starting on a higher or lower note is a <b>sequence</b>.',
        'Una piccola idea di poche note si chiama <b>motivo</b> (o inciso). I compositori la ripetono per rendere la melodia facile da ricordare, e la cambiano un po’ per non annoiare. Ripetere un motivo partendo da una nota più alta o più bassa si chiama <b>progressione</b>.'));
      example({ voices: ['C4 D4 E4 C4 D4 E4 F4 D4 E4 F4 G4 E4 F4 D4 C4 -'], caption: L('A motif of four notes, climbing one step each time, then home.', 'Un motivo di quattro note che sale di un grado ogni volta, poi torna a casa.') });
      tip(L('<b>Make your own:</b> start on {C}, move mostly by steps, put one leap in the middle, climb to a high point and end on {C}. Record it in Free play and see it on the score!',
        '<b>Inventa la tua:</b> parti dal {C}, muoviti soprattutto per gradi, metti un salto a metà, sali fino a un punto alto e finisci sul {C}. Registrala in Suona libero e guardala sullo spartito!'));
    },
  };

  /* ======================================================================
   * Lesson 7: counterpoint
   * ==================================================================== */
  const counterpoint = {
    id: 'counterpoint', color: '#b197fc',
    title: () => L('Counterpoint', 'Il contrappunto'),
    desc: () => L('Two melodies at once: consonance, motion between voices, and the first rules.', 'Due melodie insieme: consonanze, moti delle voci e le prime regole.'),
    render() {
      p(L('<b>Counterpoint</b> is the art of playing two or more melodies at the same time. Each voice is a good melody on its own, and together they sound good too. The word comes from Latin <i>punctus contra punctum</i>, “note against note”.',
        'Il <b>contrappunto</b> è l’arte di suonare due o più melodie nello stesso momento. Ogni voce è una bella melodia da sola, e insieme suonano bene. Il nome viene dal latino <i>punctus contra punctum</i>, “nota contro nota”.'));
      p(L('The simplest counterpoint is a <b>round</b> (or canon): everyone sings the same tune, starting at different times. Here is “Frère Jacques”, with the second voice coming in after two bars.',
        'Il contrappunto più semplice è il <b>canone</b>: tutti cantano la stessa melodia, partendo in momenti diversi. Ecco “Fra Martino”, con la seconda voce che entra dopo due battute.'));
      example({ voices: ['C5 D5 E5 C5 C5 D5 E5 C5 E5 F5 G5 - E5 F5 G5 -', 'r r r r r r r r C4 D4 E4 C4 C4 D4 E4 C4'], intervals: false, beat: 0.42, caption: L('A round: the same melody, one entry after the other.', 'Un canone: la stessa melodia, una voce dopo l’altra.') });
      h(L('Consonance and dissonance', 'Consonanze e dissonanze'));
      p(L('Two notes sounding together make a <b>harmonic interval</b>. Some sound calm and stable: these are <b>consonances</b> (unison, 3rds, 5ths, 6ths, octaves). Others sound tense and want to move: these are <b>dissonances</b> (2nds, 4ths, 7ths and the tritone). Dissonance is not wrong: it is the spice, and it is resolved by moving to a consonance.',
        'Due note suonate insieme formano un <b>intervallo armonico</b>. Alcuni suonano calmi e stabili: sono le <b>consonanze</b> (unisono, terze, quinte, seste, ottave). Altri suonano tesi e vogliono muoversi: sono le <b>dissonanze</b> (seconde, quarte, settime e tritono). La dissonanza non è un errore: è il sale, e si risolve andando su una consonanza.'));
      const row = doc().appendChild(el('div', 'th-row th-cons'));
      const iv = (s, good) => button(PLAY_ICON + T().intervalName(s), 'small ' + (good ? 'cons' : 'diss'), () => { stopPlayback(); OP.app.fitKeyboard(60, 72); play(60, 1.2, 80); play(60 + s, 1.2, 80); });
      row.append(iv(4, true), iv(7, true), iv(9, true), iv(12, true), iv(2, false), iv(6, false), iv(11, false));
      tip(L('In the examples below, the numbers under the staff are the intervals between the two voices. Red numbers are dissonances.',
        'Negli esempi qui sotto, i numeri sotto il rigo sono gli intervalli tra le due voci. I numeri rossi sono dissonanze.'));
      h(L('Four ways two voices can move', 'Quattro modi in cui si muovono due voci'));
      const motions = doc().appendChild(el('div', 'th-grid2'));
      example({ voices: ['E4 F4 G4 A4', 'C4 D4 E4 F4'], caption: L('<b>Parallel motion:</b> same direction, same distance.', '<b>Moto parallelo:</b> stessa direzione, stessa distanza.') }, motions);
      example({ voices: ['E4 A4 C5', 'C4 D4 E4'], caption: L('<b>Similar motion:</b> same direction, different distance.', '<b>Moto retto:</b> stessa direzione, distanza diversa.') }, motions);
      example({ voices: ['C5 B4 G4', 'C4 D4 E4'], caption: L('<b>Contrary motion:</b> one goes up, the other goes down.', '<b>Moto contrario:</b> una voce sale, l’altra scende.') }, motions);
      example({ voices: ['E4 G4 A4 G4', 'C4 C4 C4 C4'], caption: L('<b>Oblique motion:</b> one voice stays, the other moves.', '<b>Moto obliquo:</b> una voce sta ferma, l’altra si muove.') }, motions);
      p(L('<b>Contrary motion</b> keeps the two voices most independent, so it is the favourite of counterpoint.',
        'Il <b>moto contrario</b> rende le due voci più indipendenti: per questo è il preferito del contrappunto.'));
      h(L('Note against note: the first rules', 'Nota contro nota: le prime regole'));
      p(L('In 1725 Johann Joseph Fux wrote <i>Gradus ad Parnassum</i>, the book that taught counterpoint to Haydn, Mozart and Beethoven. You start with a given melody, the <b>cantus firmus</b>, and write a second voice against it, one note against each note. The main rules:',
        'Nel 1725 Johann Joseph Fux scrisse il <i>Gradus ad Parnassum</i>, il libro su cui studiarono il contrappunto Haydn, Mozart e Beethoven. Si parte da una melodia data, il <b>cantus firmus</b>, e si scrive una seconda voce contro di essa, una nota contro ogni nota. Le regole principali:'));
      ul([
        L('Use only <b>consonances</b>: unison, 3rd, 5th, 6th, octave.', 'Usa solo <b>consonanze</b>: unisono, terza, quinta, sesta, ottava.'),
        L('Begin and end on a <b>perfect</b> consonance (unison, 5th or octave). End with both voices moving by step to the tonic, in contrary motion.', 'Inizia e finisci su una consonanza <b>perfetta</b> (unisono, quinta o ottava). Alla fine le due voci arrivano sulla tonica per grado, in moto contrario.'),
        L('Prefer <b>contrary</b> and oblique motion. 3rds and 6ths in a row are fine, but not too many.', 'Preferisci il moto <b>contrario</b> e obliquo. Terze e seste di fila vanno bene, ma non troppe.'),
        L('Never two <b>5ths or two octaves in a row</b> (parallel fifths and octaves): the voices melt into one and stop sounding independent.', 'Mai due <b>quinte o due ottave di seguito</b> (quinte e ottave parallele): le voci si fondono e smettono di sembrare indipendenti.'),
        L('Each voice should be a good melody: mostly steps, few leaps, one highest note.', 'Ogni voce deve essere una bella melodia: soprattutto gradi congiunti, pochi salti, un solo culmine.'),
      ]);
      example({ voices: ['G4 A4 B4 C5', 'C4 D4 E4 F4'], caption: L('Parallel fifths: hollow and empty. Avoid them!', 'Quinte parallele: suonano vuote. Da evitare!') });
      h(L('Two examples', 'Due esempi'));
      example({ voices: ['C5 B4 A4 G4 B4 C5', 'C4 D4 F4 E4 D4 C4'], wide: true, beat: 0.7, caption: L('A short one in {C}: octave, 6th, 3rd, 3rd, 6th, octave. Almost always contrary motion.', 'Uno breve in {C}: ottava, sesta, terza, terza, sesta, ottava. Quasi sempre moto contrario.') });
      example({ voices: ['A4 A4 G4 A4 B4 C5 C5 B4 D5 C#5 D5', 'D4 F4 E4 D4 G4 F4 A4 G4 F4 E4 D4'], wide: true, beat: 0.7, caption: L('Fux’s cantus firmus in the bottom voice, with a counterpoint above it.', 'Il cantus firmus di Fux nella voce grave, con un contrappunto sopra.') });
      h(L('What comes next', 'E poi?'));
      p(L('Fux continues with more “species”: two notes against one, four notes against one, notes tied over the bar line (<b>suspensions</b>, sweet dissonances that resolve down by step), and finally a free mix of everything (<b>florid</b> counterpoint). With three and four voices you reach the music of Palestrina and the fugues of Johann Sebastian Bach.',
        'Fux continua con altre “specie”: due note contro una, quattro note contro una, note legate oltre la stanghetta (i <b>ritardi</b>, dissonanze dolci che si risolvono scendendo di grado) e infine un misto libero di tutto (contrappunto <b>fiorito</b>). Con tre e quattro voci si arriva alla musica di Palestrina e alle fughe di Johann Sebastian Bach.'));
      tip(L('Try it: play the bottom voice of an example with your left hand and the top voice with your right hand.', 'Prova: suona la voce grave di un esempio con la mano sinistra e quella acuta con la destra.'));
    },
  };

  const LESSONS = [intervals, scales, circle, family, rhythm, melody, counterpoint];

  /* ---------- picker and navigation ---------- */
  function renderPicker() {
    $('.th-picker h2', root).textContent = L('Music theory', 'Teoria musicale');
    $('.th-intro', root).textContent = L('Short lessons with examples you can hear. Keep the piano handy: many of them react to what you play.',
      'Piccole lezioni con esempi da ascoltare. Tieni il pianoforte vicino: molte reagiscono a quello che suoni.');
    const grid = $('.th-grid', root);
    grid.innerHTML = '';
    LESSONS.forEach((ls, k) => {
      const b = el('button', 'song-card th-lcard');
      b.type = 'button';
      b.style.setProperty('--c', ls.color);
      b.innerHTML = '<span class="level-num">' + (k + 1) + '</span><span class="song-title">' + ls.title() + '</span><span class="th-ldesc">' + ls.desc() + '</span>';
      b.addEventListener('click', () => open(ls));
      grid.appendChild(b);
    });
  }

  function showPicker() {
    stopPlayback();
    lesson = null;
    $('.th-picker', root).hidden = false;
    $('.th-lesson', root).hidden = true;
    OP.app.kb.clearTargets();
    OP.app.kb.soft([]);
    OP.app.restoreKeyboard();
    renderPicker();
  }

  function open(ls, keepScroll) {
    stopPlayback();
    const body = $('.th-body', root);
    const y = keepScroll ? body.scrollTop : 0;
    lesson = ls;
    $('.th-picker', root).hidden = true;
    $('.th-lesson', root).hidden = false;
    $('.th-title', root).textContent = ls.title();
    const k = LESSONS.indexOf(ls);
    const next = LESSONS[k + 1];
    $('.th-prev', root).hidden = k === 0;
    $('.th-next', root).hidden = !next;
    if (next) $('.th-next', root).textContent = next.title() + ' ›';
    if (k > 0) $('.th-prev', root).setAttribute('aria-label', LESSONS[k - 1].title());
    OP.app.kb.clearTargets();
    OP.app.kb.soft([]);
    OP.app.restoreKeyboard();
    doc().innerHTML = '';
    doc().style.setProperty('--c', ls.color);
    ls.render();
    const foot = doc().appendChild(el('nav', 'th-foot'));
    if (k > 0) foot.appendChild(button('‹ ' + LESSONS[k - 1].title(), 'ghost', () => open(LESSONS[k - 1])));
    foot.appendChild(el('span'));
    if (next) foot.appendChild(button(next.title() + ' ›', 'primary', () => open(next)));
    else foot.appendChild(button(L('All lessons', 'Tutte le lezioni'), '', showPicker));
    body.scrollTop = y;
  }

  $('.th-back', root).addEventListener('click', showPicker);
  $('.th-prev', root).addEventListener('click', () => open(LESSONS[LESSONS.indexOf(lesson) - 1]));
  $('.th-next', root).addEventListener('click', () => open(LESSONS[LESSONS.indexOf(lesson) + 1]));

  OP.registerMode('theory', {
    enter() { active = true; OP.applyI18n(root); if (lesson) open(lesson, true); else showPicker(); },
    exit() { active = false; stopPlayback(); },
    noteOn(m) { if (lesson && lesson.noteOn) lesson.noteOn(m); },
  });
  OP.on('texts', () => { if (!active) return; if (lesson) open(lesson, true); else renderPicker(); });
})();
