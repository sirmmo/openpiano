/* Sound: a sampled grand piano (lazy-loaded from sounds/piano.js) with a soft
 * Web Audio synth as fallback, plus a few short sound effects. */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});

  let ctx = null, master = null;
  let samples = null; // [{ midi, buffer }] sorted by midi
  let loading = null;
  const voices = new Map(); // midi -> voice
  const pedalled = new Set(); // released keys still sounding because of the sustain pedal
  let sustain = false;

  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = OP.settings.volume;
    master.connect(comp);
    comp.connect(ctx.destination);
    return ctx;
  }

  /** Must be called from a click/tap: browsers keep audio muted until then. */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (OP.settings.instrument === 'piano') loadPiano();
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function decode(dataUrl) {
    const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // Callback form also works on older Safari.
    return new Promise((res, rej) => ctx.decodeAudioData(bytes.buffer, res, rej));
  }

  function loadPiano() {
    if (loading) return loading;
    ensure();
    OP.emit && OP.emit('piano-loading');
    loading = (window.OP_PIANO_SAMPLES ? Promise.resolve() : loadScript('sounds/piano.js'))
      .then(() => {
        const entries = Object.entries(window.OP_PIANO_SAMPLES);
        return Promise.all(entries.map(([n, url]) => decode(url).then((buffer) => ({ midi: OP.notes.parse(n), buffer }))));
      })
      .then((list) => {
        samples = list.sort((a, b) => a.midi - b.midi);
        delete window.OP_PIANO_SAMPLES; // free the base64 text
        OP.emit && OP.emit('piano-ready');
      })
      .catch((err) => {
        console.warn('Piano samples unavailable, using the synth.', err);
        loading = null;
        OP.emit && OP.emit('piano-failed');
      });
    return loading;
  }

  function nearestSample(m) {
    let best = samples[0];
    for (const s of samples) if (Math.abs(s.midi - m) < Math.abs(best.midi - m)) best = s;
    return best;
  }

  function startVoice(m, vel, opts) {
    const t = ctx.currentTime;
    const amp = 0.15 + 0.85 * Math.pow(vel / 127, 1.6);
    const g = ctx.createGain();
    g.connect(opts.out || master);
    const v = { g, nodes: [], piano: false };

    if (!opts.synth && OP.settings.instrument === 'piano' && samples) {
      const s = nearestSample(m);
      const src = ctx.createBufferSource();
      src.buffer = s.buffer;
      src.playbackRate.value = Math.pow(2, (m - s.midi) / 12);
      g.gain.setValueAtTime(amp * 1.4, t);
      src.connect(g);
      src.start(t);
      v.nodes.push(src);
      v.piano = true;
    } else {
      // Soft "music box" synth: triangle + a quiet octave, filtered, with a piano-like decay.
      const f = freq(m);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = Math.min(9000, f * 7);
      lp.connect(g);
      const o1 = ctx.createOscillator();
      o1.type = opts.wave || 'triangle';
      o1.frequency.value = f;
      o1.connect(lp);
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = f * 2;
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      o2.connect(g2);
      g2.connect(lp);
      const peak = amp * 0.5;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.006);
      g.gain.setTargetAtTime(peak * 0.3, t + 0.01, 0.35);
      g.gain.setTargetAtTime(0, t + 1.2, 1.4);
      o1.start(t);
      o2.start(t);
      v.nodes.push(o1, o2);
    }
    return v;
  }

  function stopVoice(v, fast) {
    const t = ctx.currentTime;
    const g = v.g.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
    else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
    g.setTargetAtTime(0, t, fast ? 0.015 : v.piano ? 0.09 : 0.06);
    v.nodes.forEach((n) => { try { n.stop(t + (fast ? 0.1 : 0.8)); } catch (e) { /* already stopped */ } });
    setTimeout(() => v.g.disconnect(), (fast ? 150 : 900));
  }

  function noteOn(m, vel) {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const old = voices.get(m);
    if (old) stopVoice(old, true);
    pedalled.delete(m);
    voices.set(m, startVoice(m, vel || 90, {}));
  }

  function noteOff(m) {
    if (!ctx) return;
    if (sustain) { if (voices.has(m)) pedalled.add(m); return; }
    const v = voices.get(m);
    if (v) { voices.delete(m); stopVoice(v); }
  }

  function setSustain(on) {
    sustain = on;
    if (!on) { pedalled.forEach((m) => { const v = voices.get(m); if (v) { voices.delete(m); stopVoice(v); } }); pedalled.clear(); }
  }

  function allOff() {
    sustain = false;
    pedalled.clear();
    voices.forEach((v) => stopVoice(v, true));
    voices.clear();
  }

  /** Short synth blips for feedback; they never touch the piano voices. */
  function blips(midis, gap, opts) {
    if (!ensure() || ctx.state !== 'running') return;
    opts = opts || {};
    midis.forEach((m, i) => {
      setTimeout(() => {
        const v = startVoice(m, opts.vel || 70, { synth: true, wave: opts.wave || 'sine' });
        setTimeout(() => stopVoice(v), (opts.len || 0.12) * 1000);
      }, i * gap * 1000);
    });
  }

  const sfx = {
    good: () => blips([84, 88, 91], 0.07, { vel: 55 }),
    bad: () => blips([50, 47], 0.09, { vel: 50, wave: 'triangle', len: 0.1 }),
    fanfare: () => blips([72, 76, 79, 84, 79, 84], 0.12, { vel: 70, wave: 'triangle', len: 0.18 }),
    tick: () => blips([96], 0, { vel: 40, len: 0.03 }),
    tock: () => blips([103], 0, { vel: 75, len: 0.04 }), // the first beat of a bar
  };

  OP.audio = {
    unlock, loadPiano, noteOn, noteOff, setSustain, allOff, sfx,
    get ready() { return !!ctx && ctx.state === 'running'; },
    get pianoReady() { return !!samples; },
    setVolume(v) { if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
  };
})();
