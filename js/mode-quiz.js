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

  /* ---------- theory practice ---------- */
  const TH = () => OP.theory;
  const Lx = (en, it) => OP.theory.L(en, it);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const GENERIC = [null, ['unison', 'unisono'], ['2nd', 'seconda'], ['3rd', 'terza'], ['4th', 'quarta'], ['5th', 'quinta'], ['6th', 'sesta'], ['7th', 'settima'], ['octave', 'ottava']];
  const generic = (n) => Lx(GENERIC[n][0], GENERIC[n][1]);

  /** Name the key from its key signature. */
  function keySigQ(sigs, minor) {
    const s = pick(sigs);
    const name = (x) => TH().keyName(TH().keyOfSig(x, minor), minor);
    // Distractors: prefer the keys a beginner mixes up (one more or less, sharps vs flats).
    const near = sigs.filter((x) => x !== s && (Math.abs(x - s) === 1 || x === -s));
    const rest = shuffle(sigs.filter((x) => x !== s && !near.includes(x)));
    const others = shuffle(near).slice(0, 2).concat(rest).slice(0, 3);
    return {
      key: 'ks' + s + minor,
      prompt: minor ? Lx('Which minor key has this key signature?', 'Quale tonalità minore ha questa armatura?') : Lx('Which major key has this key signature?', 'Quale tonalità maggiore ha questa armatura?'),
      options: shuffle([s].concat(others)).map((x) => ({ id: String(x), label: name(x) })),
      answer: String(s),
      reveal: TH().sigText(s),
      staff: () => ({ clef: 'treble', width: 210, keySig: s, notes: [] }),
    };
  }

  /** Play a scale named (or written) in front of you. */
  function scaleQ(tonics, type, show) {
    const pc = pick(tonics), minor = type === 'minor';
    const sc = TH().scale(60 + pc, type);
    const root = TH().keyRoot(pc, minor);
    return {
      key: 'sc' + pc + type, seq: sc.map((x) => x.midi), anyOctave: true, showStaff: show,
      title: show ? '' : TH().keyName(pc, minor),
      prompt: show ? Lx('Play the scale written on the staff. Watch the key signature!', 'Suona la scala scritta sul pentagramma. Attenzione all’armatura!')
        : Lx('Play the scale going up, from ', 'Suona la scala salendo, da ') + root + Lx(' to ', ' a ') + root,
      reveal: TH().keyName(pc, minor) + ' · ' + TH().sigText(TH().sig(pc, minor)),
      staff: (reveal, idx) => ({
        clef: 'treble', width: 130 + sc.length * 44, keySig: TH().sig(pc, minor),
        notes: sc.map((x, i) => ({
          midis: [x.midi], spelled: [x.sp], color: reveal || i < idx ? N().color(x.midi) : 'var(--ink)',
          cls: reveal || i < idx ? 'ok' : i === idx ? 'cur' : '', label: reveal || i < idx ? TH().spName(x.sp) : '',
        })),
      }),
    };
  }

  const WHITES = () => range('C4', 'C6', true);
  /** Read an interval on the staff and name it by counting lines and spaces. */
  function intervalReadQ() {
    const w = WHITES();
    const i = Math.floor(Math.random() * 6), n = 2 + Math.floor(Math.random() * 7);
    const a = w[i], b = w[i + n - 1];
    const near = [n - 1, n + 1, n - 2, n + 2].filter((x) => x >= 2 && x <= 8);
    const far = shuffle([2, 3, 4, 5, 6, 7, 8].filter((x) => x !== n && !near.includes(x)));
    const opts = shuffle([n].concat(shuffle(near).slice(0, 2), far).slice(0, 4));
    return {
      key: 'ir' + a + n,
      prompt: Lx('What interval is this? Count every line and space, from the bottom note to the top one.', 'Che intervallo è? Conta tutte le righe e gli spazi, dalla nota in basso a quella in alto.'),
      options: opts.map((x) => ({ id: String(x), label: generic(x) })),
      answer: String(n), autoplay: false,
      reveal: generic(n) + ': ' + N().shortName(a) + ' → ' + N().shortName(b),
      play: () => { OP.app.play(a, 0.6, 90); setTimeout(() => OP.app.play(b, 0.9, 90), 650); },
      staff: (reveal) => ({ clef: 'treble', width: 250, notes: [a, b].map((m) => ({ midi: m, color: reveal ? N().color(m) : 'var(--ink)', label: reveal ? N().shortName(m) : '' })) }),
    };
  }

  /** Find the note a given interval above a starting key. */
  function intervalPlayQ() {
    const w = WHITES();
    const i = Math.floor(Math.random() * 7), n = 2 + Math.floor(Math.random() * 4);
    const a = w[i], b = w[i + n - 1];
    return {
      key: 'ip' + a + n, answer: b, anyOctave: false, soft: [a], ignore: [a],
      title: generic(n) + ' ↑',
      sub: Lx('up from ', 'sopra ') + N().shortName(a),
      prompt: Lx('Count up from the marked key (it is note 1) and play the last note.', 'Conta salendo dal tasto segnato (è la nota 1) e suona l’ultima nota.'),
      reveal: N().shortName(a) + ' → ' + N().shortName(b),
      staff: (reveal) => ({ clef: 'treble', width: 250, notes: (reveal ? [a, b] : [a]).map((m) => ({ midi: m, color: reveal ? N().color(m) : 'var(--ink)', label: reveal ? N().shortName(m) : '' })) }),
    };
  }

  /** Hear two notes, name the interval. */
  function intervalEarQ(set) {
    const a = 57 + Math.floor(Math.random() * 10);
    const semis = pick(set);
    return {
      key: 'ie' + a + semis,
      prompt: Lx('Which interval do you hear?', 'Che intervallo senti?'),
      options: set.map((s) => ({ id: String(s), label: TH().intervalName(s) })),
      answer: String(semis),
      reveal: N().shortName(a) + ' → ' + N().shortName(a + semis),
      play: () => {
        OP.app.play(a, 0.6, 90);
        setTimeout(() => OP.app.play(a + semis, 0.7, 90), 700);
        setTimeout(() => { OP.app.play(a, 1.2, 80); OP.app.play(a + semis, 1.2, 80); }, 1500);
      },
    };
  }

  /** Play chord I, IV, V… of a key. */
  function chordInKeyQ(keys, degrees) {
    const pc = pick(keys), d = pick(degrees);
    const c = TH().triads(60 + pc)[d];
    return chordQ(N().pc(c.notes[0].midi), c.type, 0, {
      key: 'kc' + pc + d, title: TH().NUMERALS[d], sub: Lx('in ', 'in ') + TH().keyName(pc, false),
    });
  }

  function playChords(list, gap) {
    list.forEach((ns, k) => setTimeout(() => ns.forEach((m) => OP.app.play(m, gap / 1000 * 0.95, 80)), k * gap));
  }
  const chordVoices = (c) => { const ns = c.notes.map((x) => x.midi); return ns.concat([ns[0] - 12]); };

  /** Does the progression end at home (on I) or not? */
  function cadenceQ() {
    const pc = pick([0, 2, 5, 7, 9]);
    const tr = TH().triads(48 + pc);
    const home = Math.random() < 0.5;
    const degs = home ? pick([[0, 3, 4, 0], [0, 5, 4, 0], [0, 4, 0]]) : pick([[0, 3, 0, 4], [0, 4, 3, 4], [0, 3, 4]]);
    return {
      key: 'cad' + pc + degs.join(''),
      prompt: Lx('Does the music sound finished?', 'La musica sembra finita?'),
      options: [{ id: 'home', label: Lx('Finished: back home', 'Finita: è tornata a casa') }, { id: 'away', label: Lx('Not finished yet…', 'Non ancora finita…') }],
      answer: home ? 'home' : 'away',
      reveal: degs.map((d) => TH().NUMERALS[d]).join(' – '),
      play: () => playChords(degs.map((d) => chordVoices(tr[d])), 900),
    };
  }

  /** After the home chord, is the next one IV or V? */
  function fourOrFiveQ() {
    const pc = pick([0, 2, 5, 7, 9]);
    const tr = TH().triads(48 + pc);
    const d = pick([3, 4]);
    return {
      key: 'iv' + pc + d,
      prompt: Lx('First the home chord, I. Then: IV or V?', 'Prima l’accordo di casa, I. Poi: IV o V?'),
      options: [{ id: '3', label: 'IV' }, { id: '4', label: 'V' }],
      answer: String(d),
      reveal: TH().NUMERALS[d] + ' = ' + C().name(N().pc(tr[d].notes[0].midi), 'maj') + (d === 4 ? Lx(' (it wants to go home)', ' (vuole tornare a casa)') : ''),
      play: () => playChords([chordVoices(tr[0]), chordVoices(tr[d])], 1100),
    };
  }

  /* Rhythm patterns: one bar of 4/4 built from pieces. */
  const RQ = { d: 1 }, RH2 = { d: 2 }, RE = { d: 0.5 }, RQR = { d: 1, rest: true }, RDQ = { d: 1.5 }, RDH = { d: 3 };
  function rhythmQ(lv) {
    const sum = (p) => p.reduce((s, n) => s + n.d, 0);
    let out;
    for (let k = 0; k < 60; k++) {
      out = [];
      let rem = 4;
      while (rem > 0) {
        const ok = lv.pieces.filter((p) => sum(p) <= rem && (out.length || !p[0].rest));
        const p = pick(ok);
        out.push(...p.map((x) => Object.assign({}, x)));
        rem -= sum(p);
      }
      const notes = out.filter((n) => !n.rest).length;
      if (notes >= lv.min && new Set(out.map((n) => n.d)).size > 1) break;
    }
    return { key: 'rh' + out.map((n) => n.d + (n.rest ? 'r' : '')).join(','), pattern: out, bpm: lv.bpm };
  }

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
    // Practice for the Theory lessons (shown under the lessons on the Theory page).
    theory: [
      { section: () => Lx('Key signatures', 'Armature di chiave'), levels: [
        { id: 'ks-easy', kind: 'choice', name: () => Lx('Up to 2 sharps or flats', 'Fino a 2 diesis o bemolle'), gen: () => keySigQ([0, 1, 2, -1, -2], false) },
        { id: 'ks-all', kind: 'choice', name: () => Lx('All the major keys', 'Tutte le tonalità maggiori'), gen: () => keySigQ([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6], false) },
        { id: 'ks-minor', kind: 'choice', name: () => Lx('Minor keys', 'Tonalità minori'), gen: () => keySigQ([-4, -3, -2, -1, 0, 1, 2, 3, 4], true) },
      ] },
      { section: () => Lx('Play the scales', 'Suona le scale'), levels: [
        { id: 'sc-read', kind: 'seq', fit: [60, 84], name: () => Lx('Read the scale (key signature!)', 'Leggi la scala (armatura!)'), gen: () => scaleQ([7, 2, 5], 'major', true) },
        { id: 'sc-major', kind: 'seq', fit: [60, 84], name: () => Lx('Major scales by name', 'Scale maggiori dal nome'), gen: () => scaleQ([0, 7, 2, 9, 4, 5, 10, 3], 'major', false) },
        { id: 'sc-minor', kind: 'seq', fit: [60, 84], name: () => Lx('Minor scales by name', 'Scale minori dal nome'), gen: () => scaleQ([9, 4, 2, 7, 0, 11], 'minor', false) },
      ] },
      { section: () => Lx('Intervals', 'Intervalli'), levels: [
        { id: 'iv-read', kind: 'choice', name: () => Lx('Read the interval', 'Leggi l’intervallo'), gen: intervalReadQ },
        { id: 'iv-play', kind: 'note', fit: [60, 84], name: () => Lx('Play the interval', 'Suona l’intervallo'), gen: intervalPlayQ },
        { id: 'iv-ear-easy', kind: 'choice', name: () => Lx('Hear it: 2nd, 3rd, 5th, octave', 'Ascolta: seconda, terza, quinta, ottava'), gen: () => intervalEarQ([2, 4, 7, 12]) },
        { id: 'iv-ear', kind: 'choice', name: () => Lx('Hear it: six intervals', 'Ascolta: sei intervalli'), gen: () => intervalEarQ([3, 4, 5, 7, 9, 12]) },
      ] },
      { section: () => Lx('Chords in a key', 'Gli accordi di una tonalità'), levels: [
        { id: 'kc-play', kind: 'chord', name: () => Lx('Play I, IV and V in {C}, {G}, {F}', 'Suona I, IV e V in {C}, {G}, {F}'), gen: () => chordInKeyQ([0, 7, 5], [0, 3, 4]) },
        { id: 'kc-play2', kind: 'chord', name: () => Lx('More keys, more chords', 'Più tonalità, più accordi'), gen: () => chordInKeyQ([0, 7, 5, 2, 10, 9], [0, 1, 3, 4, 5]) },
        { id: 'kc-finished', kind: 'choice', name: () => Lx('Finished or not?', 'Finita o no?'), gen: cadenceQ },
        { id: 'kc-iv-v', kind: 'choice', name: () => Lx('IV or V?', 'IV o V?'), gen: fourOrFiveQ },
      ] },
      { section: () => Lx('Rhythm', 'Ritmo'), levels: [
        { id: 'rh-read1', kind: 'rhythm', bpm: 76, min: 3, pieces: [[RQ], [RQ], [RH2]], name: () => Lx('Tap it: quarter and half notes', 'Batti: semiminime e minime') },
        { id: 'rh-read2', kind: 'rhythm', bpm: 76, min: 3, pieces: [[RQ], [RH2], [RE, RE], [RE, RE], [RQR], [RDH]], name: () => Lx('Tap it: eighths and rests', 'Batti: crome e pause') },
        { id: 'rh-echo1', kind: 'rhythm', ear: true, bpm: 80, min: 3, pieces: [[RQ], [RQ], [RH2], [RE, RE]], name: () => Lx('Clap it back', 'Ripeti il ritmo') },
        { id: 'rh-echo2', kind: 'rhythm', ear: true, bpm: 76, min: 4, pieces: [[RQ], [RH2], [RE, RE], [RDQ, RE], [RQR]], name: () => Lx('Clap it back: harder', 'Ripeti il ritmo: più difficile') },
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
  const LEVELS_TEMPLATE = '<div class="quiz-levels picker"><h2 data-i18n="pickLevel"></h2><div class="level-sections"></div></div>';
  const PLAY_TEMPLATE =
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

  /**
   * Build one exercise page. By default it fills #mode-<id> and registers a mode.
   * opts (for embedding, e.g. the Theory page): { levelsRoot, playRoot, heading(),
   * onView(view: 'levels' | 'play') } and the returned handlers are wired by the host.
   */
  function makeGame(id, opts) {
    opts = opts || {};
    const sections = GAMES[id];
    const levels = sections.flatMap((s) => s.levels);
    const root = opts.levelsRoot || document.getElementById('mode-' + id);
    const playRoot = opts.playRoot || root;
    if (playRoot === root) root.innerHTML = LEVELS_TEMPLATE + PLAY_TEMPLATE;
    else { root.innerHTML = LEVELS_TEMPLATE; playRoot.innerHTML = PLAY_TEMPLATE; }
    if (opts.heading) root.querySelector('.quiz-levels h2').removeAttribute('data-i18n');
    const q = (s) => root.querySelector(s) || playRoot.querySelector(s);
    const kb = () => OP.app.kb;
    const octKey = 'anyOctave_' + id;
    if (OP.settings[octKey] == null) OP.settings[octKey] = true;

    let L = null; // current level
    let Q = null; // current question
    let lastKey = null, round = 0, firstTry = 0, tries = 0, locked = false, active = false, idx = 0, attemptWrong = false;
    let results = [];
    let timers = [];
    let RH = null, raf = 0; // rhythm questions: { phase, t0, bl, taps }
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); raf = 0; RH = null; };
    const roundSize = () => (L.kind === 'seq' ? 6 : L.kind === 'chord' ? 8 : L.kind === 'rhythm' ? 5 : 10);
    const anyOctave = () => (Q && Q.anyOctave != null ? Q.anyOctave : L.kind === 'chord' ? !(Q && Q.exact) || OP.settings[octKey] : OP.settings[octKey]);
    const view = (v) => { if (opts.onView) opts.onView(v); };

    function renderLevels() {
      if (opts.heading) q('.quiz-levels h2').textContent = opts.heading();
      const box = q('.level-sections');
      box.innerHTML = '';
      sections.forEach((sec) => {
        const h = document.createElement('h3');
        h.className = 'level-section';
        h.textContent = typeof sec.section === 'function' ? sec.section() : t(sec.section);
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
      view('levels');
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
      view('play');
      q('.quiz-result').hidden = true;
      q('.quiz-question').hidden = false;
      q('.quiz-level-name').textContent = lv.name();
      q('.any-octave').hidden = !(((lv.kind === 'note' || lv.kind === 'seq') && !lv.gen) || lv.octaveToggle);
      q('.any-octave input').checked = OP.settings[octKey];
      OP.app.restoreKeyboard();
      kb().soft([]);
      if (lv.fit) OP.app.fitKeyboard(lv.fit[0], lv.fit[1]);
      else if (lv.pool) OP.app.fitKeyboard(Math.min(...lv.pool), Math.max(...lv.pool));
      else if (lv.kind === 'chord') OP.app.fitKeyboard(lv.staff && lv.clef === 'bass' ? 48 : 60, lv.staff && lv.clef === 'bass' ? 72 : 84);
      if (lv.ear && lv.pool) kb().soft(lv.pool);
      ask();
    }

    function newQuestion() {
      for (let k = 0; k < 20; k++) {
        let nq;
        if (L.kind === 'rhythm') nq = rhythmQ(L);
        else if (L.gen) nq = L.gen();
        else if (L.kind === 'note') nq = { key: 'n', answer: pick(L.pool) };
        else nq = { key: 's', seq: melody(L.pool, L.len, L.skips) };
        nq.key = (nq.key || '') + (nq.answer || '') + (nq.seq ? nq.seq.join(',') : '');
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
      ear.hidden = !(L.ear || (L.kind === 'choice' && Q.play));
      big.style.removeProperty('--c');
      if (L.gen || L.kind === 'rhythm') kb().soft(Q.soft || []);

      if (L.kind === 'note') {
        fb.textContent = Q.prompt || (L.ear ? t('earFind') : t('whichNote'));
        if (Q.title) { big.textContent = Q.title; sub.textContent = Q.sub || ''; }
        if (!L.ear) drawStaff();
      } else if (L.kind === 'seq') {
        fb.textContent = Q.prompt || (L.ear ? t('echoPrompt', { n: Q.seq.length }) : t('readMelody'));
        if (Q.title) big.textContent = Q.title;
        if (L.ear || (Q.staff && !Q.showStaff)) sub.innerHTML = seqDots();
        if (!L.ear && (!Q.staff || Q.showStaff)) drawStaff();
      } else if (L.kind === 'chord') {
        if (L.ear) fb.textContent = t('chordHear');
        else if (L.staff) { fb.textContent = t('chordReadPrompt'); drawStaff(); }
        else {
          big.textContent = Q.title || chordLabel(Q);
          big.style.setProperty('--c', N().color(Q.voicing[0]));
          sub.textContent = Q.sub || (L.showNotes ? chordNoteNames(Q) : C().symbol(Q.rootPc, Q.type));
          fb.textContent = Q.needBass ? t('chordInvPrompt', { n: N().shortName(Q.voicing[0], Q.spelled[0].acc < 0) }) : t('chordPrompt');
        }
      } else if (L.kind === 'rhythm') {
        rhythmAsk();
      } else if (L.kind === 'choice') {
        fb.textContent = Q.prompt;
        if (Q.staff) drawStaff();
        Q.options.forEach((o) => {
          const b = document.createElement('button');
          b.className = 'btn choice';
          b.textContent = o.label;
          b.addEventListener('click', () => choose(o.id, b));
          choices.appendChild(b);
        });
      }
      renderDots();
      if (L.ear || (L.kind === 'choice' && Q.play && Q.autoplay !== false)) later(() => { if (active && !locked) playPrompt(); }, 400);
    }

    function seqDots() {
      return '<span class="seq-dots">' + Q.seq.map((m, i) => '<i class="' + (i < idx ? 'done' : i === idx ? 'now' : '') + '"' +
        (i < idx ? ' style="background:' + N().color(m) + '"' : '') + '></i>').join('') + '</span>';
    }

    function drawStaff(reveal) {
      const box = q('.quiz-staff');
      box.hidden = false;
      if (Q.staff) {
        const o = Q.staff(!!reveal, idx);
        box.style.width = 'min(' + (o.width * 1.45) + 'px, 92vw)';
        box.innerHTML = OP.staff.render(o);
        return;
      }
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
      if (L.kind === 'rhythm') rhythmRun(true);
      else if (L.kind === 'note') OP.app.play(Q.answer, 0.9, 95);
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
        if (!q('.quiz-sub').textContent || L.staff || L.ear || Q.title) q('.quiz-sub').textContent = (Q.sub ? Q.sub + ': ' : '') + chordLabel(Q) + ' — ' + chordNoteNames(Q);
      }
    }

    /* ----- rhythm: tap a bar in time after a one-bar count-in ----- */
    const RH_TOL = 0.22; // beats either side that still count as "on time"
    const RH_GOOD = 0.1; // beats: spot on

    function drawRhythm(o) {
      const box = q('.quiz-staff');
      box.hidden = false;
      box.style.width = 'min(620px, 92vw)';
      box.innerHTML = TH().rhythmSvg(Q.pattern, Object.assign({ and: t('rhAnd') }, o));
    }

    function goButton(label) {
      const box = q('.quiz-choices');
      box.innerHTML = '';
      const b = document.createElement('button');
      b.className = 'btn primary choice';
      b.textContent = label;
      b.addEventListener('click', () => { box.innerHTML = ''; rhythmRun(false); });
      box.appendChild(b);
    }

    function rhythmAsk() {
      drawRhythm({ hide: !!L.ear });
      q('.quiz-feedback').textContent = L.ear ? t('rhListen') : t('rhRead');
      if (!L.ear) goButton(t('rhStart'));
    }

    /** Count in, (play the bar,) count in again and let the child tap the bar. */
    function rhythmRun(demo) {
      clearTimers();
      q('.quiz-choices').innerHTML = '';
      drawRhythm({ hide: !!L.ear && tries < 2 });
      const fb = q('.quiz-feedback'), big = q('.quiz-big');
      fb.className = 'quiz-feedback';
      const bl = 60000 / Q.bpm;
      const notes = [];
      let b0 = 0;
      Q.pattern.forEach((n) => { if (!n.rest) notes.push({ beat: b0, d: n.d }); b0 += n.d; });
      const at = (time, fn) => later(fn, Math.max(0, time - performance.now()));
      const click = (accent) => (accent ? OP.audio.sfx.tock : OP.audio.sfx.tick)();
      const bar = (start, counting) => {
        for (let b = 0; b < 4; b++) at(start + b * bl, () => { click(b === 0); if (counting) big.textContent = String(b + 1); });
      };
      let t0 = performance.now() + 200;
      RH = { phase: 'count', bl, taps: [], anim: null };
      if (demo) {
        fb.textContent = t('rhListen');
        bar(t0, true);
        const p0 = t0 + 4 * bl;
        bar(p0, false);
        at(p0, () => { big.textContent = ''; RH.anim = p0; animate(); });
        notes.forEach((n) => at(p0 + n.beat * bl, () => OP.app.play(67, (n.d * bl * 0.85) / 1000, 95, true)));
        t0 = p0 + 4 * bl;
      }
      at(t0, () => { fb.textContent = t('rhYourTurn'); if (RH) RH.anim = null; });
      bar(t0, true);
      const start = t0 + 4 * bl;
      bar(start, false);
      at(start - 0.45 * bl, () => { if (!RH) return; RH.phase = 'tap'; RH.t0 = start; RH.taps = []; });
      at(start, () => { big.textContent = ''; fb.textContent = t('rhTapNow'); if (RH) { RH.anim = start; animate(); } });
      at(start + 4 * bl, () => rhythmJudge(notes));
    }

    function animate() {
      cancelAnimationFrame(raf);
      const frame = () => {
        const cur = q('.quiz-staff .rh-cursor');
        if (!RH || RH.anim == null || !cur) { if (cur) cur.setAttribute('visibility', 'hidden'); return; }
        const beat = (performance.now() - RH.anim) / RH.bl;
        if (beat > 4) { cur.setAttribute('visibility', 'hidden'); return; }
        const x = TH().rhythmX(Math.max(0, beat));
        cur.setAttribute('x1', x); cur.setAttribute('x2', x); cur.setAttribute('visibility', 'visible');
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    function rhythmTap() {
      if (!RH || RH.phase !== 'tap') return;
      RH.taps.push((performance.now() - RH.t0) / RH.bl);
      drawRhythm({ hide: !!L.ear && tries < 2, taps: RH.taps.map((b) => ({ beat: b })) });
    }

    function rhythmJudge(notes) {
      if (!RH || !active) return;
      const taps = RH.taps.slice();
      RH.phase = 'judge';
      RH.anim = null;
      const used = new Set();
      let perfect = 0;
      const matched = notes.map((n) => {
        let best = -1;
        taps.forEach((tb, j) => { if (!used.has(j) && Math.abs(tb - n.beat) <= RH_TOL && (best < 0 || Math.abs(tb - n.beat) < Math.abs(taps[best] - n.beat))) best = j; });
        if (best >= 0) { used.add(best); if (Math.abs(taps[best] - n.beat) <= RH_GOOD) perfect++; }
        return best;
      });
      const missing = matched.filter((j) => j < 0).length;
      const extra = taps.length - used.size;
      const tapMarks = taps.map((b, j) => ({ beat: Math.max(-0.4, Math.min(4, b)), cls: used.has(j) ? 'ok' : 'extra' }));
      let k = 0;
      const colors = Q.pattern.map((n) => (n.rest ? null : matched[k++] >= 0 ? 'var(--good)' : 'var(--bad)'));
      if (!missing && !extra) {
        drawRhythm({ colors, taps: tapMarks });
        correct(perfect === notes.length ? t('rhPerfect') : '');
        return;
      }
      tries++;
      const reveal = !L.ear || tries >= 2;
      drawRhythm({ hide: !reveal, colors: reveal ? colors : null, taps: tapMarks });
      const fb = q('.quiz-feedback');
      fb.textContent = !taps.length ? t('rhNoTaps') : extra && !missing ? t('rhExtra') : missing && !extra ? t('rhMissing') : t('rhAlmost');
      fb.className = 'quiz-feedback bad';
      later(() => {
        if (!active || !L || locked) return;
        if (L.ear || tries >= 2) rhythmRun(true);
        else goButton(t('rhAgain'));
      }, 2200);
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
      if (Q.ignore && Q.ignore.includes(m)) return;
      if (L.kind === 'rhythm') rhythmTap();
      else if (L.kind === 'note') {
        if (same(m, Q.answer)) {
          kb().flash(m, 'good');
          if (!L.ear) drawStaff(true);
          correct(Q.reveal || N().shortName(Q.answer, L.flat));
        } else wrong(m);
      } else if (L.kind === 'seq') {
        if (same(m, Q.seq[idx])) {
          kb().flash(m, 'good');
          kb().clearTargets();
          idx++;
          if (L.ear || (Q.staff && !Q.showStaff)) q('.quiz-sub').innerHTML = seqDots();
          if (!L.ear && (!Q.staff || Q.showStaff || idx >= Q.seq.length)) drawStaff(idx >= Q.seq.length);
          if (idx >= Q.seq.length) correct(Q.reveal || '');
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
      if (Q.title) q('.quiz-big').textContent = Q.title + ' = ' + chordLabel(Q);
      else if (L.ear || L.staff) q('.quiz-big').textContent = chordLabel(Q);
      correct();
    }

    function noteOff() {
      if (L && L.kind === 'chord' && OP.app.held.size === 0) attemptWrong = false;
    }

    function choose(answer, btn) {
      if (locked) return;
      if (answer === Q.answer) {
        btn.classList.add('right');
        if (Q.staff) drawStaff(true);
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

    const api = {
      enter() { active = true; OP.applyI18n(root); if (playRoot !== root) OP.applyI18n(playRoot); if (!L) showLevels(); else start(L); },
      exit() { active = false; clearTimers(); },
      noteOn,
      noteOff,
      get playing() { return !!L; },
      showLevels,
    };
    if (!opts.levelsRoot) OP.registerMode(id, api);
    OP.on('texts', () => {
      if (!active) return;
      if (!L) renderLevels();
      else if (!locked && !q('.quiz-question').hidden) { q('.quiz-level-name').textContent = L.name(); ask(); }
    });
    OP.on('progress', () => { if (active && !L) renderLevels(); });
    return api;
  }

  OP.quiz = { make: makeGame };
  makeGame('notes');
  makeGame('ear');
  makeGame('chords');
})();
