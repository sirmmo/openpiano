/* Music theory helpers: keys and key signatures, spelled scales, chords of a
 * key, intervals, and bilingual text with note names that follow the settings. */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});
  const N = () => OP.notes;

  const LET = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const SOL = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
  const NAT = [0, 2, 4, 5, 7, 9, 11];
  const ACC = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
  const it = () => OP.settings.lang === 'it';

  /** Name of a written note: letter 0..6 (C..B) plus accidental, in the chosen note-name style. */
  function letterName(letter, acc) {
    const style = OP.settings.noteNames === 'solfege' ? SOL : LET;
    return style[letter] + (ACC[acc] || '');
  }
  const spName = (sp) => letterName(((sp.step % 7) + 7) % 7, sp.acc);

  /** Pick the English or Italian text; {C}, {F#}, {Bb} become note names in the chosen style. */
  function L(en, itText) {
    return (it() ? itText : en).replace(/\{([A-G])([#b]?)\}/g, (_, l, a) => letterName(LET.indexOf(l), a === '#' ? 1 : a === 'b' ? -1 : 0));
  }

  /* ---------- keys ---------- */
  // Sharps (> 0) or flats (< 0) in the key signature, by pitch class of the tonic.
  const MAJOR_SIG = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };
  const MINOR_SIG = { 9: 0, 4: 1, 11: 2, 6: 3, 1: 4, 8: 5, 3: -6, 10: -5, 5: -4, 0: -3, 7: -2, 2: -1 };
  const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B
  const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // B E A D G C F

  const sig = (pc, minor) => (minor ? MINOR_SIG : MAJOR_SIG)[pc];
  function rootLetter(pc, minor) {
    const i = NAT.indexOf(pc);
    if (i >= 0) return i;
    return NAT.indexOf(sig(pc, minor) < 0 ? pc + 1 : pc - 1);
  }
  function accOf(pc, letter) {
    let a = pc - NAT[letter];
    if (a > 6) a -= 12;
    if (a < -6) a += 12;
    return a;
  }
  /** Tonic name of a key, spelled the way its key signature spells it (E♭, F♯…). */
  function keyRoot(pc, minor) { const l = rootLetter(pc, minor); return letterName(l, accOf(pc, l)); }
  function keyName(pc, minor) { return keyRoot(pc, minor) + ' ' + (minor ? L('minor', 'minore') : L('major', 'maggiore')); }
  /** The accidentals of a key signature, in order: ['F♯', 'C♯'] */
  function sigNotes(s) {
    const n = Math.abs(s);
    return (s > 0 ? SHARP_ORDER : FLAT_ORDER).slice(0, n).map((l) => letterName(l, s > 0 ? 1 : -1));
  }
  function sigText(s) {
    if (!s) return L('No sharps or flats', 'Nessun diesis e nessun bemolle');
    const n = Math.abs(s);
    const word = s > 0 ? (n === 1 ? L('sharp', 'diesis') : L('sharps', 'diesis')) : (n === 1 ? L('flat', 'bemolle') : L('flats', 'bemolle'));
    return n + ' ' + word + ': ' + sigNotes(s).join(' ');
  }

  /* ---------- scales ---------- */
  // steps in half steps; letters = which letter (from the tonic) each note is written on.
  const SCALES = {
    major: { steps: [2, 2, 1, 2, 2, 2, 1], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
    minor: { steps: [2, 1, 2, 2, 1, 2, 2], letters: [0, 1, 2, 3, 4, 5, 6, 7] },
    penta: { steps: [2, 2, 3, 2, 3], letters: [0, 1, 2, 4, 5, 7] },
  };
  /** A spelled scale from a MIDI tonic: [{ midi, sp: {step, acc} }], tonic to tonic. */
  function scale(tonic, type) {
    const sc = SCALES[type];
    const l0 = rootLetter(N().pc(tonic), type === 'minor');
    let m = tonic;
    return sc.letters.map((lo, i) => {
      const out = { midi: m, sp: N().spell(m, (l0 + lo) % 7) };
      m += sc.steps[i] || 0;
      return out;
    });
  }

  /** The seven triads of a major key built on a MIDI tonic. */
  const NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
  function triads(tonic) {
    const sc = scale(tonic, 'major').slice(0, 7);
    const at = (k) => { const b = sc[k % 7], o = Math.floor(k / 7); return { midi: b.midi + 12 * o, sp: { step: b.sp.step + 7 * o, acc: b.sp.acc } }; };
    return sc.map((_, d) => {
      const ns = [at(d), at(d + 2), at(d + 4)];
      const third = ns[1].midi - ns[0].midi, fifth = ns[2].midi - ns[0].midi;
      const type = fifth === 6 ? 'dim' : third === 4 ? 'maj' : 'min';
      return { degree: d, numeral: NUMERALS[d], type, notes: ns, symbol: spName(ns[0].sp) + (type === 'min' ? 'm' : type === 'dim' ? '°' : '') };
    });
  }

  /* ---------- intervals ---------- */
  const INTERVALS = [
    ['unison', 'unisono', 'P1'], ['minor 2nd', 'seconda minore', 'm2'], ['major 2nd', 'seconda maggiore', 'M2'],
    ['minor 3rd', 'terza minore', 'm3'], ['major 3rd', 'terza maggiore', 'M3'], ['perfect 4th', 'quarta giusta', 'P4'],
    ['tritone', 'tritono', 'TT'], ['perfect 5th', 'quinta giusta', 'P5'], ['minor 6th', 'sesta minore', 'm6'],
    ['major 6th', 'sesta maggiore', 'M6'], ['minor 7th', 'settima minore', 'm7'], ['major 7th', 'settima maggiore', 'M7'],
    ['octave', 'ottava', 'P8'],
  ];
  function intervalName(semis) {
    const s = Math.abs(semis);
    if (s <= 12) return L(INTERVALS[s][0], INTERVALS[s][1]);
    const base = s % 12 === 0 ? INTERVALS[12] : INTERVALS[s % 12];
    const oct = Math.floor((s - 1) / 12);
    return L(base[0], base[1]) + ' + ' + (oct === 1 ? L('an octave', "un'ottava") : oct + ' ' + L('octaves', 'ottave'));
  }
  const CONSONANT = [0, 3, 4, 7, 8, 9]; // in two-voice counterpoint (the 4th counts as a dissonance)

  OP.theory = {
    LET, SOL, letterName, spName, L, sig, keyRoot, keyName, sigNotes, sigText, rootLetter,
    SCALES, scale, triads, NUMERALS, INTERVALS, intervalName, CONSONANT,
  };
})();
