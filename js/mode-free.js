/* Free play: big colourful note name, the notes on a grand staff (chords
 * stacked), and the name of the chord being held. */
(function () {
  'use strict';
  const OP = window.OP;
  const N = () => OP.notes;
  const $ = (s) => document.querySelector(s);
  const MAX = 12;
  const CHORD_MS = 90; // keys pressed this close together are drawn as one chord
  let history = []; // [{ midis: [], at }]

  function describe(held) {
    const c = OP.chords.detect(held);
    if (!c) return null;
    const name = OP.chords.name(c.root, c.type);
    const inv = c.inversion ? OP.t('inv' + c.inversion) : OP.t('inv0');
    return { name, detail: inv, c };
  }

  function renderStaff() {
    const box = $('#freeStaff');
    const w = Math.max(320, Math.min(900, box.clientWidth || 600));
    box.innerHTML = OP.staff.render({
      clef: 'grand',
      width: w,
      spacing: (w - 90) / MAX,
      notes: history.map((h) => {
        const c = h.midis.length >= 3 ? OP.chords.detect(h.midis) : null;
        const sorted = h.midis.slice().sort((a, b) => a - b);
        return {
          midis: sorted,
          spelled: c ? OP.chords.spell(sorted.find((m) => N().pc(m) === c.root) || sorted[0], c.type, sorted) : null,
          colors: sorted.map(N().color),
          label: c ? OP.chords.symbol(c.root, c.type) : sorted.length === 1 ? N().shortName(sorted[0]) : '',
        };
      }),
    });
  }

  function showNote(m) {
    const big = $('#freeNote');
    big.textContent = N().shortName(m);
    big.parentElement.style.setProperty('--c', N().color(m));
    big.classList.remove('pop');
    void big.offsetWidth;
    big.classList.add('pop');
    const s = OP.settings.noteNames;
    $('#freeOther').textContent = s === 'letters' ? N().SOLFEGE[N().pc(m)] : N().LETTERS[N().pc(m)];
    $('#freeOctave').textContent = N().LETTERS[N().pc(m)] + N().octave(m) + (m === 60 ? ' · ★' : '');
  }

  function showChord() {
    const d = describe([...OP.app.held]);
    if (!d) return false;
    const big = $('#freeNote');
    big.textContent = OP.chords.symbol(d.c.root, d.c.type);
    big.parentElement.style.setProperty('--c', N().color(d.c.root + 60));
    $('#freeOther').textContent = d.name;
    $('#freeOctave').textContent = d.detail;
    return true;
  }

  OP.registerMode('free', {
    enter() { renderStaff(); },
    noteOn(m) {
      const now = performance.now();
      const last = history[history.length - 1];
      if (last && now - last.at < CHORD_MS && !last.midis.includes(m)) last.midis.push(m);
      else history.push({ midis: [m], at: now });
      if (history.length > MAX) history = history.slice(-MAX);
      if (!showChord()) showNote(m);
      renderStaff();
      $('#freeHint').hidden = true;
    },
    noteOff() {},
    resize: renderStaff,
  });
  OP.on('texts', () => { if (!$('#mode-free').hidden) renderStaff(); });
})();
