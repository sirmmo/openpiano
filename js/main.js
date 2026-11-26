/* App shell: routes notes from MIDI / mouse / computer keys to the sound,
 * the on-screen keyboard and the active mode; handles settings and MIDI status. */
(function () {
  'use strict';
  const OP = window.OP;
  const $ = (s) => document.querySelector(s);
  const t = (k, v) => OP.t(k, v);

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg, ms) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    if (ms !== 0) toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2600);
  }
  const hideToast = () => $('#toast').classList.remove('show');

  /* ---------- modes ---------- */
  const modes = OP.modes;
  let current = null;

  function setMode(id) {
    if (!modes[id]) id = 'free';
    if (current && current.exit) current.exit();
    kb.clearTargets();
    kb.soft([]);
    restoreKeyboard();
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === id)));
    document.querySelectorAll('.mode').forEach((s) => { s.hidden = s.id !== 'mode-' + id; });
    current = modes[id];
    current.enter && current.enter();
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
  }

  /* ---------- the note hub ---------- */
  const held = new Set();
  function noteOn(m, vel, src) {
    if (src !== 'midi' || OP.settings.midiSound) OP.audio.noteOn(m, vel);
    held.add(m);
    kb.down(m);
    if (current && current.noteOn) current.noteOn(m, vel, src);
  }
  function noteOff(m, src) {
    OP.audio.noteOff(m);
    held.delete(m);
    kb.up(m);
    if (current && current.noteOff) current.noteOff(m, src);
  }

  const kb = new OP.Keyboard($('#keyboard'), { onDown: noteOn, onUp: noteOff });
  kb.setSize(OP.settings.size);

  /** Make sure the notes a mode needs are on screen (keeps the user's key count when possible). */
  function fitKeyboard(min, max) {
    if (kb.inRange(min) && kb.inRange(max)) return;
    const span = kb.hi - kb.lo;
    let lo = min - OP.notes.pc(min); // the C at or below
    let hi = lo + span;
    if (hi < max) hi = max + ((12 - OP.notes.pc(max)) % 12); // up to the next C
    kb.lo = Math.max(21, lo);
    kb.hi = Math.min(108, hi);
    kb.build();
    OP.emit('keyboard-resized');
  }
  function restoreKeyboard() {
    const before = kb.lo + ':' + kb.hi;
    kb.setSize(OP.settings.size);
    if (before !== kb.lo + ':' + kb.hi) OP.emit('keyboard-resized');
  }

  /** Play a note for a demo, an accompaniment or a game prompt: through the chosen
   * MIDI output, or the computer. visual: true = press the key on screen,
   * 'auto' = a paler press for notes the app plays along. */
  const playToken = new Map(); // midi -> id of the latest play() of that note
  let playSeq = 0;
  function play(m, seconds, vel, visual) {
    vel = vel || 90;
    const id = ++playSeq;
    playToken.set(m, id);
    const latest = () => playToken.get(m) === id; // a newer play() of the same note owns the release
    if (OP.midi.hasOutput()) {
      OP.midi.send(m, vel, true);
      setTimeout(() => { if (latest()) OP.midi.send(m, 0, false); }, seconds * 1000);
    } else {
      OP.audio.noteOn(m, vel);
      setTimeout(() => { if (latest() && !held.has(m)) OP.audio.noteOff(m); }, seconds * 1000);
    }
    if (visual) {
      const cls = visual === 'auto' ? 'auto' : 'down';
      kb.mark(m, cls, true);
      setTimeout(() => { if (latest() && (cls === 'auto' || !held.has(m))) kb.mark(m, cls, false); }, seconds * 1000);
    }
  }

  OP.app = { kb, held, toast, setMode, fitKeyboard, restoreKeyboard, play };

  /* ---------- MIDI ---------- */
  OP.midi.onNote = (m, vel, on) => (on ? noteOn(m, vel, 'midi') : noteOff(m, 'midi'));
  OP.midi.onSustain = (down) => OP.audio.setSustain(down);
  OP.midi.onAllOff = () => { OP.audio.allOff(); [...held].forEach((m) => noteOff(m, 'midi')); };
  OP.midi.onChange = (state, names, evt) => {
    renderMidiPill();
    renderMidiSettings();
    if (evt && evt.port && evt.port.type === 'input') {
      if (evt.port.state === 'connected' && evt.port.connection !== 'open') toast(t('midiConnected', { name: evt.port.name }));
      if (evt.port.state === 'disconnected') { toast(t('midiGone')); OP.midi.onAllOff(); }
    }
  };

  function renderMidiPill() {
    const btn = $('#midiBtn');
    const st = OP.midi.state;
    const names = OP.midi.inputNames();
    btn.dataset.state = st;
    $('#midiText').textContent =
      st === 'connected' ? names[0] + (names.length > 1 ? ' +' + (names.length - 1) : '') :
      st === 'nodevice' ? t('midiNoDevice') :
      st === 'denied' ? t('midiDenied') :
      st === 'unsupported' || st === 'insecure' ? t('midiUnsupported') : t('midiConnect');
  }

  $('#midiBtn').addEventListener('click', () => {
    const st = OP.midi.state;
    if (st === 'unsupported') toast(t('midiUnsupportedLong'), 6000);
    else if (st === 'insecure') toast(t('midiInsecure'), 6000);
    else if (st === 'denied') toast(t('midiDeniedLong'), 6000);
    else if (st === 'idle') OP.midi.request();
    else openSettings();
  });
  if (!OP.midi.supported) OP.midi.state = OP.midi.secure ? 'unsupported' : 'insecure';

  /* ---------- piano loading status ---------- */
  OP.on('piano-loading', () => toast(t('loadingPiano'), 0));
  OP.on('piano-ready', hideToast);
  OP.on('piano-failed', hideToast);
  OP.on('octave', (shift) => toast('⌨︎ ' + OP.notes.name(60 + 12 * shift) + (4 + shift)));

  /* ---------- settings dialog ---------- */
  const dlg = $('#settingsDlg');
  const form = $('#settingsForm');

  function renderMidiSettings() {
    const names = OP.midi.inputNames();
    $('#midiList').textContent = names.length ? names.join(', ') : t('midiNone');
    const sel = form.elements.midiOut;
    const outs = OP.midi.outputs();
    sel.innerHTML = '';
    sel.add(new Option(t('outBuiltin'), ''));
    outs.forEach((o) => sel.add(new Option(o.name, o.id)));
    sel.value = outs.some((o) => o.id === OP.settings.midiOut) ? OP.settings.midiOut : '';
    $('#midiOutRow').hidden = !outs.length;
  }

  function openSettings() {
    const s = OP.settings;
    const f = form.elements;
    f.lang.value = s.lang;
    f.theme.value = s.theme;
    f.noteNames.value = s.noteNames;
    f.labels.checked = s.labels;
    f.instrument.value = s.instrument;
    f.midiSound.checked = s.midiSound;
    f.volume.value = s.volume;
    f.size.value = String(s.size);
    renderMidiSettings();
    dlg.showModal();
  }

  form.addEventListener('change', (e) => {
    const f = form.elements;
    const name = e.target.name;
    if (name === 'lang') { OP.store.set('lang', f.lang.value); refreshTexts(); }
    if (name === 'noteNames') { OP.store.set('noteNames', f.noteNames.value); refreshTexts(); }
    if (name === 'theme') { OP.store.set('theme', f.theme.value); OP.theme.apply(f.theme.value); }
    if (name === 'labels') { OP.store.set('labels', f.labels.checked); kb.updateLabels(); }
    if (name === 'instrument') { OP.store.set('instrument', f.instrument.value); if (f.instrument.value === 'piano') OP.audio.loadPiano(); }
    if (name === 'midiSound') OP.store.set('midiSound', f.midiSound.checked);
    if (name === 'size') { OP.store.set('size', +f.size.value); restoreKeyboard(); }
    if (name === 'midiOut') OP.store.set('midiOut', f.midiOut.value);
  });
  form.elements.volume.addEventListener('input', (e) => { OP.store.set('volume', +e.target.value); OP.audio.setVolume(+e.target.value); });
  $('#resetBtn').addEventListener('click', () => {
    if (confirm(t('resetConfirm'))) { OP.store.resetProgress(); updateStars(); OP.emit('progress'); }
  });
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#themeBtn').addEventListener('click', () => {
    const next = OP.theme.resolve(OP.settings.theme) === 'dark' ? 'light' : 'dark';
    OP.store.set('theme', next);
    OP.theme.apply(next);
    if (dlg.open) form.elements.theme.value = next;
  });

  function refreshTexts() {
    OP.applyI18n();
    renderMidiPill();
    kb.updateLabels();
    if (dlg.open) renderMidiSettings();
    OP.emit('texts');
  }

  function updateStars() { $('#totalStars').textContent = OP.store.totalStars(); }
  OP.on('progress', updateStars);

  /* ---------- start ---------- */
  // After a mouse click, drop focus from the button so Space and letter keys
  // go to the piano instead of pressing the button again.
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (b && e.detail > 0) b.blur();
  });
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  window.addEventListener('resize', () => current && current.resize && current.resize());
  window.addEventListener('hashchange', () => setMode(location.hash.slice(1)));
  // Any click or key wakes the audio up (browsers block sound until then).
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => OP.audio.unlock(), { capture: true }));

  $('#startBtn').addEventListener('click', () => {
    OP.audio.unlock();
    $('#splash').classList.add('gone');
    setTimeout(() => $('#splash').remove(), 500);
    if (OP.midi.supported && OP.midi.state === 'idle') OP.midi.request();
  });

  OP.theme.apply(OP.settings.theme);
  OP.applyI18n();
  renderMidiPill();
  updateStars();
  setMode(location.hash.slice(1) || 'free');
  // If MIDI was allowed before, connect straight away (no prompt is shown).
  if (OP.midi.supported && OP.settings.midiGranted) OP.midi.request();
})();
