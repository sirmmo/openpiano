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

  /** Tonic pitch class of the major or minor key with s sharps (> 0) or flats (< 0). */
  function keyOfSig(s, minor) {
    const tab = minor ? MINOR_SIG : MAJOR_SIG;
    const pc = Object.keys(tab).find((k) => tab[k] === s);
    return pc == null ? null : +pc;
  }

  /* ---------- rhythm notation ---------- */
  /** One note value as a small SVG: w h q e s (whole … sixteenth). */
  function glyph(kind) {
    const hollow = kind === 'w' || kind === 'h';
    let s = '<svg class="glyph" viewBox="0 0 32 44" aria-hidden="true"><ellipse cx="12" cy="35" rx="7" ry="5" transform="rotate(-20 12 35)" fill="' + (hollow ? 'none' : 'currentColor') + '" stroke="currentColor" stroke-width="2.4"/>';
    if (kind !== 'w') s += '<line x1="18.4" y1="34" x2="18.4" y2="5" stroke="currentColor" stroke-width="2.2"/>';
    if (kind === 'e' || kind === 's') s += '<path d="M18.4 5c1 6 10 8 8 17" fill="none" stroke="currentColor" stroke-width="2.4"/>';
    if (kind === 's') s += '<path d="M18.4 12c1 6 10 8 8 17" fill="none" stroke="currentColor" stroke-width="2.4"/>';
    return s + '</svg>';
  }

  // Geometry of the one-line rhythm staff drawn by rhythmSvg.
  const RH = { x0: 58, bw: 66, ly: 50, h: 104 };
  const rhythmX = (beat) => RH.x0 + beat * RH.bw + 12;

  /**
   * A bar of rhythm on a one-line staff, with the counts underneath.
   * pattern: [{ d: beats, rest? }]. opts.hide: draw only the beats (for ear games);
   * opts.colors: a colour per item; opts.taps: [{ beat, cls }] marks under the line.
   */
  function rhythmSvg(pattern, opts) {
    opts = opts || {};
    const { x0, bw, ly, h } = RH;
    const total = pattern.reduce((s, n) => s + n.d, 0);
    const W = x0 + total * bw + 18;
    let t = 0;
    const items = pattern.map((n) => { const o = Object.assign({ start: t }, n); t += n.d; return o; });
    let s = '<svg class="rhythm" viewBox="0 0 ' + W + ' ' + h + '" role="img" xmlns="http://www.w3.org/2000/svg">';
    s += '<line class="rh-line" x1="8" x2="' + (W - 8) + '" y1="' + ly + '" y2="' + ly + '"/>';
    s += '<text class="rh-ts" x="28" y="' + (ly - 4) + '" text-anchor="middle">4</text><text class="rh-ts" x="28" y="' + (ly + 20) + '" text-anchor="middle">4</text>';
    s += '<line class="rh-bar" x1="' + (W - 8) + '" x2="' + (W - 8) + '" y1="' + (ly - 16) + '" y2="' + (ly + 16) + '"/>';
    // Beat boxes, so the bar is readable even when the notes are hidden.
    for (let b = 0; b < total; b++) {
      s += '<rect class="rh-beat" x="' + (x0 + b * bw + 2) + '" y="' + (ly - 40) + '" width="' + (bw - 4) + '" height="80" rx="8"/>';
      s += '<text class="rh-count" x="' + rhythmX(b) + '" y="' + (h - 6) + '" text-anchor="middle">' + (b + 1) + '</text>';
    }
    const and = opts.and || '+';
    if (!opts.hide) {
      items.forEach((n, i) => {
        const x = rhythmX(n.start);
        const col = (opts.colors && opts.colors[i]) || 'currentColor';
        if (n.start % 1) s += '<text class="rh-count and" x="' + x + '" y="' + (h - 6) + '" text-anchor="middle">' + and + '</text>';
        s += '<g class="rh-item" style="color:' + col + '">';
        if (n.rest) s += rest(x, ly, n.d);
        else {
          const hollow = n.d >= 2;
          s += '<ellipse cx="' + x + '" cy="' + ly + '" rx="7.6" ry="5.6" transform="rotate(-20 ' + x + ' ' + ly + ')" fill="' + (hollow ? 'none' : 'currentColor') + '" stroke="currentColor" stroke-width="2.4"/>';
          if (n.d < 4) s += '<line x1="' + (x + 6.6) + '" x2="' + (x + 6.6) + '" y1="' + (ly - 2) + '" y2="' + (ly - 34) + '" stroke="currentColor" stroke-width="2.2"/>';
          const beamed = n.d === 0.5 && (isPair(items, i) || isPair(items, i - 1));
          if (n.d === 0.5 && !beamed) s += '<path d="M' + (x + 6.6) + ' ' + (ly - 34) + 'c1 6 10 8 8 17" fill="none" stroke="currentColor" stroke-width="2.4"/>';
          if (isPair(items, i)) s += '<line x1="' + (x + 5.6) + '" x2="' + (rhythmX(items[i + 1].start) + 7.6) + '" y1="' + (ly - 32) + '" y2="' + (ly - 32) + '" stroke="currentColor" stroke-width="5"/>';
          if (n.d === 1.5 || n.d === 3 || n.d === 0.75) s += '<circle cx="' + (x + 14) + '" cy="' + (ly - 3) + '" r="2.6" fill="currentColor"/>';
        }
        s += '</g>';
      });
    }
    (opts.taps || []).forEach((tp) => {
      s += '<circle class="rh-tap ' + (tp.cls || '') + '" cx="' + rhythmX(tp.beat) + '" cy="' + (ly + 28) + '" r="5"/>';
    });
    s += '<line class="rh-cursor" x1="0" x2="0" y1="' + (ly - 40) + '" y2="' + (ly + 40) + '" visibility="hidden"/>';
    return s + '</svg>';
  }
  // Two eighth notes on the same beat are joined by a beam.
  const isPair = (items, i) => i >= 0 && items[i + 1] && items[i].d === 0.5 && items[i + 1].d === 0.5 &&
    !items[i].rest && !items[i + 1].rest && items[i].start % 1 === 0;
  function rest(x, ly, d) {
    if (d >= 4) return '<rect x="' + (x - 7) + '" y="' + ly + '" width="14" height="6" fill="currentColor"/>';
    if (d >= 2) return '<rect x="' + (x - 7) + '" y="' + (ly - 6) + '" width="14" height="6" fill="currentColor"/>';
    if (d >= 1) return '<path d="M' + (x - 3) + ' ' + (ly - 18) + 'l7 9-6 7 7 9c-7-3-11 0-6 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>';
    return '<circle cx="' + (x - 2) + '" cy="' + (ly - 7) + '" r="3.2" fill="currentColor"/><path d="M' + (x - 2) + ' ' + (ly - 5) + 'q5 1 7-3l-6 17" fill="none" stroke="currentColor" stroke-width="2.2"/>';
  }

  OP.theory = {
    LET, SOL, letterName, spName, L, sig, keyRoot, keyName, sigNotes, sigText, rootLetter, keyOfSig,
    SCALES, scale, triads, NUMERALS, INTERVALS, intervalName, CONSONANT,
    glyph, rhythmSvg, rhythmX,
  };
})();
