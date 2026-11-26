/* Free play: big colourful note name, the notes on a grand staff, chord names. */
(function () {
  'use strict';
  const OP = window.OP;
  const N = () => OP.notes;
  const $ = (s) => document.querySelector(s);
  const MAX = 12;
  let history = [];

  // Interval sets (from the root) → chord kind.
  const CHORDS = [
    ['0,4,7', 'maj'], ['0,3,7', 'min'], ['0,3,6', 'dim'], ['0,4,8', 'aug'], ['0,2,7', 'sus2'], ['0,5,7', 'sus4'],
    ['0,4,7,10', 'dom7'], ['0,4,7,11', 'maj7'], ['0,3,7,10', 'min7'],
  ];

  function chordName(midis) {
    const pcs = [...new Set(midis.map(N().pc))];
    if (pcs.length < 3) return '';
    const bass = Math.min(...midis);
    // Prefer the lowest note as the root, then try the others (inversions).
    const roots = [N().pc(bass), ...pcs.filter((p) => p !== N().pc(bass))];
    for (const r of roots) {
      const key = pcs.map((p) => (p - r + 12) % 12).sort((a, b) => a - b).join(',');
      const hit = CHORDS.find((c) => c[0] === key);
      if (hit) return N().name(r) + ' ' + OP.t('chord.' + hit[1]);
    }
    return '';
  }

  function other(m) {
    const s = OP.settings.noteNames;
    return s === 'letters' ? N().SOLFEGE[N().pc(m)] : s === 'solfege' ? N().LETTERS[N().pc(m)] : '';
  }

  function renderStaff() {
    const box = $('#freeStaff');
    const w = Math.max(320, Math.min(900, box.clientWidth || 600));
    box.innerHTML = OP.staff.render({
      clef: 'grand',
      width: w,
      spacing: (w - 90) / MAX,
      notes: history.map((m) => ({ midi: m, color: N().color(m), label: N().name(m, OP.settings.noteNames === 'both' ? 'letters' : OP.settings.noteNames) })),
    });
  }

  function show(m) {
    const big = $('#freeNote');
    big.textContent = N().name(m, OP.settings.noteNames === 'both' ? 'letters' : OP.settings.noteNames);
    big.parentElement.style.setProperty('--c', N().color(m));
    big.classList.remove('pop');
    void big.offsetWidth;
    big.classList.add('pop');
    $('#freeOther').textContent = OP.settings.noteNames === 'both' ? N().SOLFEGE[N().pc(m)] : other(m);
    $('#freeOctave').textContent = N().LETTERS[N().pc(m)] + N().octave(m) + (m === 60 ? ' · ★' : '');
  }

  OP.registerMode('free', {
    enter() {
      $('#freeChord').textContent = '';
      renderStaff();
    },
    noteOn(m) {
      history.push(m);
      if (history.length > MAX) history = history.slice(-MAX);
      show(m);
      renderStaff();
      $('#freeChord').textContent = chordName([...OP.app.held]);
      $('#freeHint').hidden = true;
    },
    noteOff() {
      const c = chordName([...OP.app.held]);
      if (c) $('#freeChord').textContent = c;
    },
    resize: renderStaff,
  });
  OP.on('texts', () => { if (!$('#mode-free').hidden) renderStaff(); });
})();
