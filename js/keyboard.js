/* On-screen piano: mouse/touch (with glissando), computer keys, highlights.
 * Key positions are in percent of the keyboard width so the falling-notes
 * canvas above can line up with them. */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});
  const N = () => OP.notes;

  // Ranges for each keyboard size (first and last key are white).
  const RANGES = { 25: [60, 84], 37: [48, 84], 49: [36, 84], 61: [36, 96], 88: [21, 108] };

  // Physical key codes (layout independent), piano-style: home row = white keys.
  const CODES = ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ',
    'KeyK', 'KeyO', 'KeyL', 'KeyP', 'Semicolon', 'Quote'];

  class Keyboard {
    constructor(el, handlers) {
      this.el = el;
      this.onDown = handlers.onDown;
      this.onUp = handlers.onUp;
      this.geom = new Map();
      this.els = new Map();
      this.pointers = new Map(); // pointerId -> midi
      this.codesDown = new Map(); // key code -> midi
      this.octaveShift = 0;
      this.bindPointer();
      this.bindKeys();
    }

    setSize(n) {
      const r = RANGES[n] || RANGES[37];
      this.lo = r[0];
      this.hi = r[1];
      this.build();
    }

    build() {
      const el = this.el;
      el.innerHTML = '';
      this.geom.clear();
      this.els.clear();
      const whites = [];
      for (let m = this.lo; m <= this.hi; m++) if (!N().isBlack(m)) whites.push(m);
      const W = 100 / whites.length;
      whites.forEach((m, i) => this.geom.set(m, { x: i * W, w: W, black: false }));
      const BW = W * 0.6;
      // Nudge black keys the way a real piano does.
      const nudge = { 1: -0.12, 3: 0.12, 6: -0.15, 8: 0, 10: 0.15 };
      for (let m = this.lo; m <= this.hi; m++) {
        if (!N().isBlack(m)) continue;
        const left = this.geom.get(m - 1);
        this.geom.set(m, { x: left.x + left.w - BW / 2 + nudge[N().pc(m)] * BW, w: BW, black: true });
      }
      el.style.setProperty('--white-w', W + '%');
      el.dataset.whites = whites.length > 29 ? 'dense' : '';
      const frag = document.createDocumentFragment();
      const add = (black) => {
        for (let m = this.lo; m <= this.hi; m++) {
          if (N().isBlack(m) !== black) continue;
          const g = this.geom.get(m);
          const k = document.createElement('div');
          k.className = 'key ' + (black ? 'black' : 'white') + (m === 60 ? ' middle-c' : '');
          k.dataset.midi = m;
          k.style.left = g.x + '%';
          k.style.width = g.w + '%';
          k.style.setProperty('--c', N().color(m));
          k.innerHTML = '<span class="finger"></span><span class="label"></span>';
          this.els.set(m, k);
          frag.appendChild(k);
        }
      };
      add(false);
      add(true);
      el.appendChild(frag);
      this.updateLabels();
    }

    updateLabels() {
      const style = OP.settings.noteNames;
      this.el.classList.toggle('no-labels', !OP.settings.labels);
      this.els.forEach((k, m) => {
        const label = k.querySelector('.label');
        const p = N().pc(m);
        // Black keys are narrow: only the short name fits there.
        if (style === 'both' && !N().isBlack(m)) label.innerHTML = N().LETTERS[p] + '<small>' + N().SOLFEGE[p] + '</small>';
        else label.textContent = N().name(m, style === 'both' ? 'letters' : style);
        if (m === 60) label.insertAdjacentHTML('beforeend', '<i class="c-dot" aria-hidden="true"></i>');
      });
    }

    /** Horizontal position of a key, in percent of the keyboard width. */
    keyGeom(m) { return this.geom.get(m); }
    inRange(m) { return m >= this.lo && m <= this.hi; }

    down(m) { const k = this.els.get(m); if (k) k.classList.add('down'); }
    up(m) { const k = this.els.get(m); if (k) k.classList.remove('down'); }
    mark(m, cls, on) { const k = this.els.get(m); if (k) k.classList.toggle(cls, on); }
    releaseAllVisual() { this.els.forEach((k) => k.classList.remove('down')); }

    target(m, finger) { this.targets([{ midi: m, finger }]); }
    /** Make several keys glow (a chord), each with an optional finger number. */
    targets(list) {
      this.clearTargets();
      list.forEach((tg) => {
        const k = this.els.get(tg.midi);
        if (!k) return;
        k.classList.add('target');
        k.querySelector('.finger').textContent = tg.finger || '';
      });
    }
    clearTargets() {
      this.el.querySelectorAll('.key.target').forEach((k) => { k.classList.remove('target'); k.querySelector('.finger').textContent = ''; });
    }
    /** Lightly mark a set of keys (e.g. the notes used in a game level). */
    soft(list) {
      this.el.querySelectorAll('.key.soft').forEach((k) => k.classList.remove('soft'));
      (list || []).forEach((m) => { const k = this.els.get(m); if (k) k.classList.add('soft'); });
    }
    flash(m, kind) {
      const k = this.els.get(m);
      if (!k) return;
      const cls = 'flash-' + kind;
      k.classList.remove(cls);
      void k.offsetWidth; // restart the animation
      k.classList.add(cls);
      setTimeout(() => k.classList.remove(cls), 600);
    }

    bindPointer() {
      const el = this.el;
      const keyAt = (x, y) => {
        const hit = document.elementFromPoint(x, y);
        const k = hit && hit.closest && hit.closest('.key');
        return k && el.contains(k) ? k : null;
      };
      const velocity = (k, y) => {
        const r = k.getBoundingClientRect();
        return Math.round(55 + 70 * Math.min(1, Math.max(0, (y - r.top) / r.height)));
      };
      el.addEventListener('pointerdown', (e) => {
        const k = e.target.closest('.key');
        if (!k) return;
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        const m = +k.dataset.midi;
        this.pointers.set(e.pointerId, m);
        this.onDown(m, velocity(k, e.clientY), 'pointer');
      });
      el.addEventListener('pointermove', (e) => {
        if (!this.pointers.has(e.pointerId)) return;
        const old = this.pointers.get(e.pointerId);
        const k = keyAt(e.clientX, e.clientY);
        const m = k ? +k.dataset.midi : null;
        if (m === old) return;
        if (old != null) this.onUp(old, 'pointer');
        if (m != null) this.onDown(m, velocity(k, e.clientY), 'pointer');
        this.pointers.set(e.pointerId, m);
      });
      const end = (e) => {
        if (!this.pointers.has(e.pointerId)) return;
        const m = this.pointers.get(e.pointerId);
        this.pointers.delete(e.pointerId);
        if (m != null) this.onUp(m, 'pointer');
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    bindKeys() {
      const typing = (e) => {
        const t = e.target;
        if (!t || !t.tagName) return false;
        if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
        return t.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(t.type);
      };
      window.addEventListener('keydown', (e) => {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
        if (document.querySelector('dialog[open]')) return;
        if (e.code === 'KeyZ' || e.code === 'KeyX') {
          this.octaveShift = Math.max(-3, Math.min(3, this.octaveShift + (e.code === 'KeyZ' ? -1 : 1)));
          OP.emit && OP.emit('octave', this.octaveShift);
          return;
        }
        const i = CODES.indexOf(e.code);
        if (i < 0 || this.codesDown.has(e.code)) return;
        e.preventDefault();
        const m = 60 + 12 * this.octaveShift + i;
        this.codesDown.set(e.code, m);
        this.onDown(m, 90, 'keys');
      });
      window.addEventListener('keyup', (e) => {
        const m = this.codesDown.get(e.code);
        if (m == null) return;
        this.codesDown.delete(e.code);
        this.onUp(m, 'keys');
      });
      window.addEventListener('blur', () => {
        this.codesDown.forEach((m) => this.onUp(m, 'keys'));
        this.codesDown.clear();
      });
    }
  }

  OP.Keyboard = Keyboard;
  OP.KEYBOARD_SIZES = Object.keys(RANGES).map(Number);
})();
