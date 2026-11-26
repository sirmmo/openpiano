/* Shared namespace, a tiny event bus and the mode registry. Loaded first. */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});
  const listeners = {};
  OP.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  OP.emit = (ev, ...args) => (listeners[ev] || []).forEach((fn) => fn(...args));
  OP.modes = {};
  OP.registerMode = (id, mode) => { OP.modes[id] = mode; };
})();
