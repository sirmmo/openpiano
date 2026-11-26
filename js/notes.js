/* Note helpers: names, colours, staff positions. MIDI 60 = C4 (middle C). */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});

  const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const SOLFEGE = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
  const LETTER_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C=0 … B=6 (sharps sit on the note below)
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

  /** Name of a note in the given style: 'letters' | 'solfege' | 'both'. */
  function name(m, style) {
    style = style || (OP.settings && OP.settings.noteNames) || 'letters';
    const p = pc(m);
    if (style === 'solfege') return SOLFEGE[p];
    if (style === 'both') return LETTERS[p] + ' · ' + SOLFEGE[p];
    return LETTERS[p];
  }

  /** "C4", "F#3", "Bb2" → MIDI number. */
  function parse(str) {
    const mm = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(str.trim());
    if (!mm) throw new Error('Bad note: ' + str);
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[mm[1].toUpperCase()];
    const acc = mm[2] === '#' ? 1 : mm[2] === 'b' ? -1 : 0;
    return 12 * (parseInt(mm[3], 10) + 1) + base + acc;
  }

  /** Diatonic position used on the staff (C4 = 28), plus whether it needs a sharp. */
  function step(m) {
    return { step: LETTER_STEP[pc(m)] + 7 * octave(m), sharp: isBlack(m) };
  }

  OP.notes = { LETTERS, SOLFEGE, pc, octave, isBlack, color, name, parse, step, shade };
})();
