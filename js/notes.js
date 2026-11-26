/* Note and chord helpers: names, colours, spelling, staff positions,
 * chord shapes and chord recognition. MIDI 60 = C4 (middle C). */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});

  const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const LETTERS_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const SOLFEGE = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
  const SOLFEGE_FLAT = ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
  const BLACK = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
  // One colour per white key, a rainbow from C to B. Black keys use a darker
  // shade of the white key to their left.
  const WHITE_COLORS = { 0: '#ff6b6b', 2: '#ffa94d', 4: '#ffd43b', 5: '#69db7c', 7: '#38d9a9', 9: '#4dabf7', 11: '#b197fc' };

  const pc = (m) => ((m % 12) + 12) % 12;
  const octave = (m) => Math.floor(m / 12) - 1;
  const isBlack = (m) => BLACK[pc(m)] === 1;

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function color(m) {
    const p = pc(m);
    return isBlack(m) ? shade(WHITE_COLORS[p - 1], 0.72) : WHITE_COLORS[p];
  }

  /** Name of a note: style 'letters' | 'solfege' | 'both'; flat=true spells black keys as flats. */
  function name(m, style, flat) {
    style = style || (OP.settings && OP.settings.noteNames) || 'letters';
    const p = pc(m);
    const L = (flat ? LETTERS_FLAT : LETTERS)[p], S = (flat ? SOLFEGE_FLAT : SOLFEGE)[p];
    if (style === 'solfege') return S;
    if (style === 'both') return L + ' · ' + S;
    return L;
  }
  /** Short name used where 'both' would not fit. */
  const shortName = (m, flat) => name(m, OP.settings.noteNames === 'both' ? 'letters' : OP.settings.noteNames, flat);

  /** "C4", "F#3", "Bb2" → MIDI number. */
  function parse(str) {
    const mm = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(str.trim());
    if (!mm) throw new Error('Bad note: ' + str);
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[mm[1].toUpperCase()];
    const acc = mm[2] === '#' ? 1 : mm[2] === 'b' ? -1 : 0;
    return 12 * (parseInt(mm[3], 10) + 1) + base + acc;
  }

  /** Staff position of a note written with a given letter (0=C … 6=B). acc: -1 flat, 0, +1 sharp. */
  function spell(m, letter) {
    let acc = pc(m) - NATURAL_PC[letter];
    if (acc > 6) acc -= 12;
    if (acc < -6) acc += 12;
    const oct = (m - acc - NATURAL_PC[letter]) / 12 - 1;
    return { step: letter + 7 * oct, acc };
  }

  /** Staff position (C4 = 28); black keys as sharps, or as flats with flat=true. */
  function step(m, flat) {
    const p = pc(m);
    if (!isBlack(m)) return spell(m, NATURAL_PC.indexOf(p));
    return spell(m, NATURAL_PC.indexOf(flat ? p + 1 : p - 1));
  }

  /* ---------- chords ---------- */
  const CHORD_TYPES = {
    maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7],
    dom7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dim7: [0, 3, 6, 9], hdim7: [0, 3, 6, 10], maj6: [0, 4, 7, 9], min6: [0, 3, 7, 9],
  };
  const SYMBOL = { maj: '', min: 'm', dim: '°', aug: '+', sus2: 'sus2', sus4: 'sus4', dom7: '7', maj7: 'maj7', min7: 'm7', dim7: '°7', hdim7: 'ø7', maj6: '6', min6: 'm6' };
  // Letter distance from the root for each interval (so E♭ in C minor is an E, not a D♯).
  const LETTER_OFFSET = { 0: 0, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 8: 4, 9: 5, 10: 6, 11: 6 };
  // Black-key roots that read better as flats (B♭ major, E♭ minor…).
  const FLAT_ROOTS = { maj: [1, 3, 8, 10], min: [3, 10], dom7: [1, 3, 8, 10], maj7: [1, 3, 8, 10], min7: [3, 10] };

  const prefersFlat = (rootPc, type) => isBlack(rootPc) && (FLAT_ROOTS[type] || [3, 10]).includes(rootPc);

  /** Notes of a chord: root MIDI note, type, inversion (0 = root position). */
  function chordNotes(root, type, inversion) {
    const ns = CHORD_TYPES[type].map((i) => root + i);
    for (let k = 0; k < (inversion || 0); k++) ns.push(ns.shift() + 12);
    return ns;
  }

  /** Staff spelling for chord notes built on `root`. */
  function spellChord(root, type, midis) {
    const flat = prefersFlat(pc(root), type);
    const rootLetter = isBlack(root) ? NATURAL_PC.indexOf(flat ? pc(root) + 1 : pc(root) - 1) : NATURAL_PC.indexOf(pc(root));
    return midis.map((m) => spell(m, (rootLetter + LETTER_OFFSET[(pc(m) - pc(root) + 12) % 12]) % 7));
  }

  function chordName(rootPc, type) {
    return name(rootPc, null, prefersFlat(rootPc, type)) + ' ' + OP.t('chord.' + type);
  }
  function chordSymbol(rootPc, type) {
    return (prefersFlat(rootPc, type) ? LETTERS_FLAT : LETTERS)[rootPc] + SYMBOL[type];
  }

  /** Recognise a chord from held notes → { root, type, inversion } or null. */
  function detectChord(midis) {
    const pcs = [...new Set(midis.map(pc))];
    if (pcs.length < 3) return null;
    const bass = pc(Math.min(...midis));
    const roots = [bass, ...pcs.filter((p) => p !== bass)];
    for (const r of roots) {
      const key = pcs.map((p) => (p - r + 12) % 12).sort((a, b) => a - b).join(',');
      for (const type in CHORD_TYPES) {
        if (CHORD_TYPES[type].join(',') === key) {
          return { root: r, type, inversion: CHORD_TYPES[type].indexOf((bass - r + 12) % 12) };
        }
      }
    }
    return null;
  }

  OP.notes = { LETTERS, LETTERS_FLAT, SOLFEGE, SOLFEGE_FLAT, pc, octave, isBlack, color, name, shortName, parse, step, spell, shade };
  OP.chords = { TYPES: CHORD_TYPES, SYMBOL, notes: chordNotes, spell: spellChord, name: chordName, symbol: chordSymbol, detect: detectChord, prefersFlat };
})();
