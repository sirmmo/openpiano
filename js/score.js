/* Scrolling score for the song player. Notes sit on a treble, bass or grand
 * staff at their place in time (proportional spacing) and slide left past a
 * play line. Note values come from the durations (hollow heads, stems, dots,
 * flags); a soft bar behind each head shows how long to hold the key. */
(function () {
  'use strict';
  const OP = window.OP;

  const VALUES = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25];
  const DOTTED = new Set([3, 1.5, 0.75, 0.375]);
  const STAVES = { treble: { lo: 30, hi: 38, mid: 34 }, bass: { lo: 18, hi: 26, mid: 22 } };
  const ACC = { '-1': '♭', '1': '♯' };
  const INK = '#2b2238', PAPER = '#ffffff', ACCENT = '#6c4ee0';
  let G, F; // clef Path2D, made on first use

  /** The written value closest to a duration in beats. */
  function value(d) {
    let best = 1;
    for (const v of VALUES) if (Math.abs(Math.log(d / v)) < Math.abs(Math.log(d / best))) best = v;
    return best;
  }

  /** Which staves these notes need. Notes may carry hand: 'right' | 'left'. */
  function clefFor(notes) {
    if (!notes.length) return 'treble';
    const L = notes.some((n) => n.hand === 'left'), R = notes.some((n) => n.hand === 'right');
    if (L && R) return 'grand';
    if (L) return 'bass';
    if (R) return 'treble';
    let lo = 127, hi = 0;
    notes.forEach((n) => { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); });
    if (lo >= 55) return 'treble';
    if (hi <= 64) return 'bass';
    return 'grand';
  }

  /**
   * Group notes (sorted by start) into glyphs: one per part, staff and start time.
   * The glyph heads keep a reference to the note, so its state (hit / miss) shows.
   */
  function prepare(notes, flat) {
    const clef = clefFor(notes);
    const staffOf = (n) => (clef !== 'grand' ? clef : n.hand === 'left' ? 'bass' : n.hand === 'right' ? 'treble' : n.midi >= 60 ? 'treble' : 'bass');
    const byKey = new Map();
    const glyphs = [];
    let maxDur = 0;
    notes.forEach((n) => {
      const staff = staffOf(n);
      const key = staff + ':' + n.part + ':' + Math.round(n.start * 1000);
      let g = byKey.get(key);
      if (!g) { g = { start: n.start, dur: 0, staff, play: n.play, heads: [] }; byKey.set(key, g); glyphs.push(g); }
      const sp = OP.notes.step(n.midi, flat);
      g.heads.push({ n, step: sp.step, acc: sp.acc });
      g.dur = Math.max(g.dur, n.dur);
      maxDur = Math.max(maxDur, n.dur);
    });
    glyphs.forEach((g) => {
      g.heads.sort((a, b) => a.step - b.step);
      g.heads.forEach((h, k) => { h.shifted = k > 0 && h.step - g.heads[k - 1].step === 1 && !g.heads[k - 1].shifted; });
      const v = value(g.dur);
      g.hollow = v >= 2;
      g.stem = v < 4;
      g.dot = DOTTED.has(v);
      g.flags = v <= 0.375 ? 2 : v < 1 ? 1 : 0;
      const avg = g.heads.reduce((s, h) => s + h.step, 0) / g.heads.length;
      g.up = avg < STAVES[g.staff].mid;
    });
    glyphs.sort((a, b) => a.start - b.start);
    return { clef, glyphs, maxDur };
  }

  /**
   * Draw the score at a moment of the song.
   * o: { time, bars: [beat], meterAt(beat) → {num, den}, current: Set(note), waiting, now, font }
   */
  function draw(ctx, W, H, sc, o) {
    if (!G) { G = new Path2D(OP.staff.G_CLEF); F = new Path2D(OP.staff.F_CLEF); }
    const grand = sc.clef === 'grand';
    const SP = Math.max(6, Math.min(20, H / (grand ? 19 : 10.5)));
    const HS = SP / 2, rx = SP * 0.64, ry = SP * 0.46;
    const gap = grand ? 6 * SP : 0;
    const total = grand ? 8 * SP + gap : 4 * SP;
    const staves = {};
    let y = Math.round((H - total) / 2);
    if (sc.clef !== 'bass') { staves.treble = Object.assign({ top: y }, STAVES.treble); y += 4 * SP + gap; }
    if (sc.clef !== 'treble') staves.bass = Object.assign({ top: y }, STAVES.bass);
    const list = Object.values(staves);
    const sysTop = list[0].top, sysBot = list[list.length - 1].top + 4 * SP;
    const yOf = (step, s) => s.top + (s.hi - step) * HS;
    const left = Math.round(SP * 6.4);
    const playX = Math.round(Math.max(left + SP * 3, Math.min(W * 0.26, left + 190)));
    const pxb = SP * 6.2; // pixels per beat
    const font = o.font || 'sans-serif';

    ctx.clearRect(0, 0, W, H);
    const staffLines = (x0, x1) => {
      ctx.fillStyle = INK;
      list.forEach((s) => { for (let i = 0; i < 5; i++) ctx.fillRect(x0, Math.round(s.top + i * SP) - 0.6, x1 - x0, 1.2); });
    };
    staffLines(0, W);

    // Bar lines.
    ctx.fillStyle = INK;
    for (const b of o.bars) {
      const x = playX + (b - o.time) * pxb;
      if (x < left - 2 || x > W + 2) continue;
      ctx.fillRect(x - 0.75, sysTop, 1.5, sysBot - sysTop);
    }

    // The play line.
    const pulse = o.waiting ? 0.5 + 0.5 * Math.sin(o.now / 160) : 0;
    ctx.fillStyle = ACCENT;
    ctx.globalAlpha = 0.1 + 0.12 * pulse;
    ctx.fillRect(playX - SP * 1.2, sysTop - 2.5 * SP, SP * 2.4, sysBot - sysTop + 5 * SP);
    ctx.globalAlpha = 0.55;
    ctx.fillRect(playX - 1, sysTop - 2.5 * SP, 2, sysBot - sysTop + 5 * SP);
    ctx.globalAlpha = 1;

    // Notes: start from the first glyph that can still reach the screen.
    const from = o.time - (playX - left) / pxb - sc.maxDur;
    let lo = 0, hi = sc.glyphs.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sc.glyphs[mid].start < from) lo = mid + 1; else hi = mid; }
    for (let i = lo; i < sc.glyphs.length; i++) {
      const g = sc.glyphs[i];
      const x = playX + (g.start - o.time) * pxb;
      if (x > W + SP * 3) break;
      if (x + g.dur * pxb < left) continue;
      glyph(ctx, g, x, staves[g.staff], yOf, { SP, HS, rx, ry, pxb, font, current: o.current, now: o.now });
    }

    // What has been played fades out a little.
    ctx.fillStyle = PAPER;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(left, 0, Math.max(0, playX - SP * 1.2 - left), H);
    ctx.globalAlpha = 1;

    // Clefs and time signature on a fixed panel.
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, left, H);
    staffLines(SP * 0.3, left);
    ctx.fillStyle = INK;
    if (grand) ctx.fillRect(SP * 0.3, sysTop, 2, sysBot - sysTop);
    list.forEach((s) => {
      ctx.save();
      const treble = s === staves.treble;
      ctx.translate(SP * 0.9, s.top + (treble ? 3 : 1) * SP);
      ctx.scale(SP / 250, -SP / 250);
      ctx.fill(treble ? G : F);
      ctx.restore();
    });
    const m = o.meterAt(Math.max(0, o.time));
    ctx.font = '900 ' + Math.round(SP * 2.1) + 'px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    list.forEach((s) => {
      ctx.fillText(String(m.num), SP * 4.9, s.top + SP + 1);
      ctx.fillText(String(m.den), SP * 4.9, s.top + 3 * SP + 1);
    });
    const edge = ctx.createLinearGradient(left, 0, left + SP * 1.5, 0);
    edge.addColorStop(0, 'rgba(255,255,255,1)');
    edge.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = edge;
    ctx.fillRect(left, 0, SP * 1.5, H);
  }

  function glyph(ctx, g, x, s, yOf, d) {
    const { SP, HS, rx, ry, pxb } = d;
    const fade = g.play ? 1 : 0.4; // parts the app plays are drawn pale
    const steps = g.heads.map((h) => h.step);
    const sLo = Math.min(...steps), sHi = Math.max(...steps);

    // How long to hold: a soft bar behind each head.
    g.heads.forEach((h) => {
      const yy = yOf(h.step, s);
      const len = h.n.dur * pxb - SP * 0.5;
      if (len <= rx) return;
      ctx.globalAlpha = fade * (h.n.state ? 0.15 : 0.3);
      ctx.fillStyle = h.n.state === 'miss' ? '#a8a1b3' : OP.notes.color(h.n.midi);
      roundRect(ctx, x, yy - SP * 0.3, len, SP * 0.6, SP * 0.3);
      ctx.fill();
    });
    ctx.globalAlpha = fade;

    // Ledger lines.
    ctx.fillStyle = INK;
    const lx = x - rx * 1.6, lw = rx * 3.2 + (g.heads.some((h) => h.shifted) ? rx * 1.85 : 0);
    for (let k = s.lo - 2; k >= sLo; k -= 2) ctx.fillRect(lx, yOf(k, s) - 0.75, lw, 1.5);
    for (let k = s.hi + 2; k <= sHi; k += 2) ctx.fillRect(lx, yOf(k, s) - 0.75, lw, 1.5);

    // Heads, accidentals, dots.
    let accN = 0;
    g.heads.forEach((h) => {
      const yy = yOf(h.step, s);
      const hx = x + (h.shifted ? rx * 1.85 : 0);
      const n = h.n;
      const col = n.state === 'miss' ? '#a8a1b3' : OP.notes.color(n.midi);
      if (d.current && d.current.has(n) && !n.state) {
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(d.now / 160);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(hx, yy, SP * 1.25, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = fade * (n.state === 'hit' ? 0.5 : 1);
      ctx.beginPath();
      ctx.ellipse(hx, yy, rx, ry, -0.35, 0, Math.PI * 2);
      if (g.hollow) {
        ctx.fillStyle = PAPER;
        ctx.fill();
        ctx.lineWidth = SP * 0.3;
        ctx.strokeStyle = col;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(hx, yy, rx + SP * 0.12, ry + SP * 0.12, -0.35, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = INK;
        ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      ctx.fillStyle = INK;
      if (h.acc) {
        ctx.font = '700 ' + Math.round(SP * 1.6) + 'px ' + d.font;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(ACC[h.acc] || '', x - rx - SP * 0.3 - (accN % 2) * SP * 0.95, yy + 1);
        accN++;
      }
      if (g.dot) {
        ctx.beginPath();
        ctx.arc(x + rx * (g.heads.some((q) => q.shifted) ? 3.3 : 1.6) + SP * 0.15, yy - (h.step % 2 === 0 ? HS : 0), SP * 0.17, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Stem and flags.
    if (g.stem) {
      ctx.globalAlpha = fade;
      ctx.fillStyle = INK;
      ctx.strokeStyle = INK;
      const len = SP * 3.3;
      const sx = g.up ? x + rx * 0.92 : x - rx * 0.92;
      const y0 = g.up ? yOf(sLo, s) : yOf(sHi, s);
      const y1 = g.up ? yOf(sHi, s) - len : yOf(sLo, s) + len;
      ctx.fillRect(sx - 0.7, Math.min(y0, y1), 1.4, Math.abs(y1 - y0));
      const dir = g.up ? 1 : -1;
      ctx.lineWidth = SP * 0.22;
      ctx.lineCap = 'round';
      for (let f = 0; f < g.flags; f++) {
        const fy = y1 + dir * f * SP * 0.85;
        ctx.beginPath();
        ctx.moveTo(sx, fy);
        ctx.bezierCurveTo(sx + SP * 0.15, fy + dir * SP * 0.9, sx + SP * 1.3, fy + dir * SP * 1.1, sx + SP * 0.85, fy + dir * SP * 2.3);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  OP.score = { prepare, draw, value };
})();
