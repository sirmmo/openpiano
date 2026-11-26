/* Settings and progress, kept in localStorage. */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});
  const KEY = 'openpiano.v1';

  const italian = (navigator.language || '').toLowerCase().startsWith('it');
  const defaults = {
    lang: italian ? 'it' : 'en',
    noteNames: italian ? 'solfege' : 'letters',
    labels: true,
    instrument: 'piano', // 'piano' (samples) | 'synth'
    midiSound: true, // play computer sound for notes coming from a MIDI keyboard
    volume: 0.8,
    size: window.innerWidth < 700 ? 25 : 37, // number of keys on screen
    midiOut: '', // MIDI output id used for demos ('' = this computer)
    midiGranted: false,
    theme: 'auto', // 'auto' (follow the system) | 'light' | 'dark'
  };

  let data = {};
  try { data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { data = {}; }
  data.settings = Object.assign({}, defaults, data.settings || {});
  data.progress = data.progress || {};

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode: ignore */ }
  }

  OP.settings = data.settings;
  OP.store = {
    save,
    set(k, v) { data.settings[k] = v; save(); },
    stars(id) { return data.progress[id] || 0; },
    /** Keep the best result; returns true when it is a new record. */
    award(id, stars) {
      if (stars > (data.progress[id] || 0)) { data.progress[id] = stars; save(); return true; }
      return false;
    },
    totalStars() { return Object.values(data.progress).reduce((a, b) => a + b, 0); },
    resetProgress() { data.progress = {}; save(); },
  };
})();
