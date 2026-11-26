/* Free play: big colourful note name, the notes on a grand staff (chords
 * stacked), and the name of the chord being held. */
(function () {
  'use strict';
  const OP = window.OP;
  const N = () => OP.notes;
  const $ = (s) => document.querySelector(s);
  const t = (k, v) => OP.t(k, v);
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

  /* ---------- recording ---------- */
  const S = OP.settings;
  if (S.recBpm == null) S.recBpm = 80;
  if (S.metronome == null) S.metronome = false;
  const GRID = 0.25; // beats: recordings snap to sixteenth notes
  const BAR = 4;
  let rec = null; // { phase: 'count' | 'rec', t0, notes: [{m, vel, on, off}], open: Map }
  let infoTimer = 0, metroTimer = 0, mNext = 0, mBeat = 0;
  let lastRec = null; // { model, rawId }

  function metroStart(onBeat) {
    metroStop();
    mBeat = 0;
    mNext = performance.now() + 60;
    const tick = () => {
      const now = performance.now();
      const iv = 60000 / S.recBpm;
      if (now - mNext > iv * 2) mNext = now; // the tab was asleep: don't catch up
      while (mNext <= now + 8) {
        if (S.metronome) (mBeat % BAR === 0 ? OP.audio.sfx.tock : OP.audio.sfx.tick)();
        onBeat(mBeat, mNext);
        mBeat++;
        mNext += iv;
      }
    };
    metroTimer = setInterval(tick, 15);
  }
  function metroStop() { clearInterval(metroTimer); metroTimer = 0; }

  function fmtTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function renderRec() {
    const btn = $('#recBtn');
    btn.classList.toggle('on', !!rec && rec.phase === 'rec');
    btn.classList.toggle('count', !!rec && rec.phase === 'count');
    const label = $('#recLabel');
    if (!rec) label.textContent = t('record');
    else if (rec.phase === 'count') label.textContent = String(BAR - (rec.beat || 0));
    else label.textContent = t('stopRec');
    $('#metroToggle').checked = S.metronome;
    $('#tempoRange').value = S.recBpm;
    $('#tempoVal').textContent = '♩ ' + S.recBpm;
    const info = $('#recInfo');
    if (rec && rec.phase === 'rec') info.textContent = t('recInfo', { time: fmtTime(rec.t0 == null ? 0 : performance.now() - rec.t0), n: rec.notes.length });
    else if (rec) info.textContent = t('recCountIn');
    else info.textContent = '';
  }

  function startRec() {
    OP.audio.unlock();
    $('#recDone').hidden = true;
    rec = { phase: S.metronome ? 'count' : 'rec', t0: null, notes: [], open: new Map(), beat: 0 };
    if (S.metronome) {
      // One bar of count-in, then the recording starts on the next downbeat.
      metroStart((beat, at) => {
        if (!rec) return;
        rec.beat = beat;
        if (beat === BAR) { rec.phase = 'rec'; rec.t0 = at; }
        renderRec();
      });
    }
    infoTimer = setInterval(renderRec, 250);
    renderRec();
  }

  function stopRec() {
    const r = rec;
    rec = null;
    metroStop();
    clearInterval(infoTimer);
    renderRec();
    if (!r) return;
    const end = performance.now();
    r.open.forEach((n) => { n.off = end; });
    const done = r.notes.filter((n) => n.off != null);
    if (!done.length) { OP.app.toast(t('recEmpty'), 3500); return; }
    saveRec(r, done);
  }

  function saveRec(r, list) {
    const bpm = S.recBpm;
    const beats = (ms) => ((ms - (r.t0 != null ? r.t0 : list[0].on)) / 1000) * (bpm / 60);
    const snap = (b) => Math.round(b / GRID) * GRID;
    let notes = list.map((n) => {
      const start = snap(beats(n.on));
      return { midi: n.m, start, dur: Math.max(GRID, snap(beats(n.off)) - start), finger: null, vel: n.vel };
    });
    // Keep the bars in place, but drop empty bars at the start (and make room for notes played during the count-in).
    const first = Math.min(...notes.map((n) => n.start));
    // A note just before the first downbeat was meant to be on it.
    const shift = first < 0 && first >= -0.5 ? -first : -Math.floor(first / BAR) * BAR;
    notes.forEach((n) => { n.start += shift; });
    notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
    const length = Math.max(...notes.map((n) => n.start + n.dur));
    const n = OP.midiFile.library.list().filter((e) => e.rec).length + 1;
    const title = t('recTitle', { n });
    const draft = { title, tempos: [{ beat: 0, bpm }], meters: [{ beat: 0, num: 4, den: 4 }], parts: [{ key: 'midi', name: 'Piano', notes }], length };
    let res;
    try { res = OP.midiFile.library.add(title, OP.midiFile.write(draft), true); } catch (e) { console.warn(e); OP.app.toast(t('midiBad')); return; }
    lastRec = { model: res.model, rawId: res.model.id.slice(5), saved: res.saved };
    const box = $('#recDone');
    box.querySelector('.rec-done-text').textContent = res.saved ? t('recSaved', { name: title, n: notes.length }) : t('recNotSaved');
    box.hidden = false;
    OP.audio.sfx.good();
  }

  function recNote(m, vel, on) {
    if (!rec) return;
    const now = performance.now();
    if (on) {
      if (rec.phase === 'rec' && rec.t0 == null) rec.t0 = now; // no metronome: time starts at the first note
      const prev = rec.open.get(m);
      if (prev) prev.off = now;
      const n = { m, vel: vel || 90, on: now, off: null };
      rec.notes.push(n);
      rec.open.set(m, n);
    } else {
      const n = rec.open.get(m);
      if (n) { n.off = now; rec.open.delete(m); }
    }
  }

  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    $('#recBtn').addEventListener('click', () => (rec ? stopRec() : startRec()));
    $('#metroToggle').addEventListener('change', (e) => OP.store.set('metronome', e.target.checked));
    $('#tempoRange').addEventListener('input', (e) => { OP.store.set('recBpm', +e.target.value); renderRec(); });
    $('#recDone').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act || !lastRec) return;
      if (act.dataset.act === 'open') OP.openSong(lastRec.model);
      if (act.dataset.act === 'download') OP.midiFile.download(lastRec.model);
      if (act.dataset.act === 'discard') {
        OP.midiFile.library.remove(lastRec.rawId);
        lastRec = null;
        $('#recDone').hidden = true;
      }
    });
  }

  OP.registerMode('free', {
    enter() { wire(); renderRec(); renderStaff(); },
    exit() { if (rec) stopRec(); },
    noteOff(m) { recNote(m, 0, false); },
    noteOn(m, vel) {
      recNote(m, vel, true);
      const now = performance.now();
      const last = history[history.length - 1];
      if (last && now - last.at < CHORD_MS && !last.midis.includes(m)) last.midis.push(m);
      else history.push({ midis: [m], at: now });
      if (history.length > MAX) history = history.slice(-MAX);
      if (!showChord()) showNote(m);
      renderStaff();
      $('#freeHint').hidden = true;
    },
    resize: renderStaff,
  });
  OP.on('texts', () => {
    if ($('#mode-free').hidden) return;
    renderStaff();
    renderRec();
    if (lastRec && !$('#recDone').hidden) {
      $('#recDone .rec-done-text').textContent = lastRec.saved
        ? t('recSaved', { name: lastRec.model.title, n: lastRec.model.parts.reduce((s, p) => s + p.notes.length, 0) }) : t('recNotSaved');
    }
  });
})();
