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

/* Theme: data-theme on <html> drives the CSS; canvases read the colours from OP.theme. */
(function () {
  const OP = window.OP;
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  OP.theme = {
    colors: {},
    resolve(pref) { return pref === 'dark' || pref === 'light' ? pref : media && media.matches ? 'dark' : 'light'; },
    apply(pref) {
      const t = OP.theme.resolve(pref);
      document.documentElement.dataset.theme = t;
      const c = OP.theme.colors;
      c.dark = t === 'dark';
      ['ink', 'ink-2', 'paper', 'accent', 'line', 'bg'].forEach((k) => { c[k] = css('--' + k); });
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = css('--paper');
      if (OP.emit) OP.emit('theme', t);
    },
  };
  if (media && media.addEventListener) media.addEventListener('change', () => { if (OP.settings && OP.settings.theme === 'auto') OP.theme.apply('auto'); });
})();
