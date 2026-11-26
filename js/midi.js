/* Web MIDI: listens to every connected USB MIDI keyboard, follows hot-plugging,
 * and can send notes to an output (to play demos on the keyboard itself). */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});

  const M = {
    supported: typeof navigator.requestMIDIAccess === 'function',
    secure: window.isSecureContext !== false,
    access: null,
    // 'idle' | 'unsupported' | 'insecure' | 'denied' | 'nodevice' | 'connected'
    state: 'idle',
    onNote: null, // (midi, velocity, isOn)
    onSustain: null, // (isDown)
    onAllOff: null,
    onChange: null, // (state, devices, event)
  };

  function connectedInputs() {
    return M.access ? [...M.access.inputs.values()].filter((p) => p.state === 'connected') : [];
  }

  function onMessage(e) {
    const d = e.data;
    if (!d || d.length < 2) return;
    const cmd = d[0] & 0xf0;
    if (cmd === 0x90 && d[2] > 0) M.onNote && M.onNote(d[1], d[2], true);
    else if (cmd === 0x80 || cmd === 0x90) M.onNote && M.onNote(d[1], 0, false);
    else if (cmd === 0xb0 && d[1] === 64) M.onSustain && M.onSustain(d[2] >= 64);
    else if (cmd === 0xb0 && (d[1] === 120 || d[1] === 123)) M.onAllOff && M.onAllOff();
  }

  function bind(evt) {
    const ins = connectedInputs();
    ins.forEach((p) => { p.onmidimessage = onMessage; }); // assigning the handler opens the port
    M.state = ins.length ? 'connected' : 'nodevice';
    M.onChange && M.onChange(M.state, ins.map((p) => p.name), evt);
  }

  M.request = async function () {
    if (!M.supported) { M.state = M.secure ? 'unsupported' : 'insecure'; M.onChange && M.onChange(M.state, []); return; }
    try {
      M.access = await navigator.requestMIDIAccess({ sysex: false });
      M.access.onstatechange = (e) => {
        if (e.port && e.port.type === 'input') bind(e);
        else M.onChange && M.onChange(M.state, M.inputNames(), e);
      };
      bind();
      OP.store.set('midiGranted', true);
    } catch (err) {
      console.warn('MIDI access refused', err);
      M.state = 'denied';
      M.onChange && M.onChange(M.state, []);
    }
  };

  M.inputNames = () => connectedInputs().map((p) => p.name);
  M.outputs = () => (M.access ? [...M.access.outputs.values()].filter((p) => p.state === 'connected').map((p) => ({ id: p.id, name: p.name })) : []);

  function out() {
    const id = OP.settings.midiOut;
    if (!id || !M.access) return null;
    const p = M.access.outputs.get(id);
    return p && p.state === 'connected' ? p : null;
  }

  M.hasOutput = () => !!out();
  M.send = function (midi, vel, on) {
    const p = out();
    if (p) p.send(on ? [0x90, midi, vel] : [0x80, midi, 0]);
  };

  OP.midi = M;
})();
