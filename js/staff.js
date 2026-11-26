/* Draws notes on a treble, bass or grand staff as inline SVG.
 * Clef outlines come from the Bravura music font by Steinberg
 * (SIL Open Font License 1.1, https://github.com/steinbergmedia/bravura). */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});

  // SMuFL glyphs: 1000 units per em, 250 units per staff space, y pointing up.
  // gClef origin sits on the G4 line, fClef origin on the F3 line.
  const G_CLEF = 'M376 415C374 427 376 428 382 434C398 449 419 470 438 491C522 583 572 702 572 815C572 902 548 988 507 1048C492 1070 466 1098 455 1098C441 1098 410 1072 390 1050C316 968 292 843 292 739C292 681 299 616 306 575C308 563 309 561 297 551C233 498 164 437 112 373C43 287 0 194 0 87C0 -87 119 -252 364 -252C387 -252 413 -250 433 -246C444 -244 446 -243 448 -255C460 -322 475 -409 475 -456C475 -604 375 -622 316 -622C262 -622 236 -606 236 -593C236 -586 245 -583 268 -576C299 -567 335 -540 335 -482C335 -427 300 -380 239 -380C172 -380 132 -433 132 -495C132 -560 171 -658 322 -658C389 -658 519 -628 519 -458C519 -401 501 -306 490 -244C488 -232 489 -233 503 -227C604 -187 671 -102 671 11C671 139 577 252 430 252C404 252 404 252 401 270ZM470 943C503 943 530 916 530 861C530 792 497 728 419 650C403 634 379 611 356 591C349 585 345 586 343 599C339 625 337 659 337 691C337 847 409 943 470 943ZM361 262C364 243 364 244 346 238C258 208 201 129 201 44C201 -46 248 -110 316 -133C324 -136 336 -139 343 -139C351 -139 355 -134 355 -128C355 -121 347 -118 340 -115C298 -97 268 -54 268 -8C268 49 307 92 368 109C384 113 386 112 388 101L438 -197C440 -208 439 -208 424 -211C408 -214 388 -216 368 -216C193 -216 80 -119 80 20C80 79 90 158 173 252C233 319 279 356 326 394C336 402 338 401 340 390ZM430 103C428 115 429 118 441 117C522 110 589 42 589 -46C589 -109 551 -160 495 -188C483 -194 481 -194 479 -182Z';
  const F_CLEF = 'M252 262C78 262 0 135 0 39C0 -41 42 -110 123 -110C186 -110 229 -66 229 -4C229 60 182 100 133 100C106 100 96 93 83 93C70 93 67 101 67 111C67 151 127 224 229 224C335 224 381 120 381 -37C381 -140 359 -260 297 -356C237 -449 134 -534 10 -605C1 -610 -5 -615 -5 -623C-5 -629 -1 -635 8 -635C13 -635 19 -633 25 -630C158 -565 286 -489 392 -375C479 -281 531 -159 531 -28C531 146 425 262 252 262ZM629 180C598 180 574 156 574 125C574 94 598 70 629 70C660 70 684 94 684 125C684 156 660 180 629 180ZM630 -71C599 -71 576 -94 576 -125C576 -156 599 -179 630 -179C661 -179 684 -156 684 -125C684 -94 661 -71 630 -71Z';

  const SP = 12; // staff space in SVG units
  const HS = SP / 2; // one diatonic step
  const ACC = { '-1': '♭', '1': '♯', '0': '♮' };

  /**
   * opts.clef: 'treble' | 'bass' | 'grand'
   * opts.notes: items drawn left to right. An item is a single note or a chord:
   *   { midi | midis: [...], spelled?: [{step, acc}], flat?, color?, colors?: [...], label?, cls? }
   * opts.width: SVG width in user units
   * opts.spacing: fixed distance between items (default: spread across the staff)
   */
  function render(opts) {
    const clef = opts.clef || 'treble';
    const W = opts.width || 320;
    const items = opts.notes || [];
    const staves = [];
    let y = 60;
    if (clef !== 'bass') { staves.push({ kind: 'treble', top: y, lo: 30, hi: 38 }); y += 4 * SP + (clef === 'grand' ? 5 * SP : 0); }
    if (clef !== 'treble') { staves.push({ kind: 'bass', top: y, lo: 18, hi: 26 }); y += 4 * SP; }
    const hasLabels = items.some((n) => n.label);
    const H = y + 60 + (hasLabels ? 20 : 0);
    const yOf = (st, s) => s.top + (s.hi - st) * HS;
    const staffFor = (st) => (staves.length === 1 ? staves[0] : st >= 28 ? staves[0] : staves[1]);
    const line = (x1, x2, yy, cls) => '<line class="' + cls + '" x1="' + x1 + '" x2="' + x2 + '" y1="' + yy + '" y2="' + yy + '"/>';

    let out = '<svg class="staff" viewBox="0 0 ' + W + ' ' + H + '" role="img" xmlns="http://www.w3.org/2000/svg">';
    staves.forEach((s) => {
      for (let i = 0; i < 5; i++) out += line(6, W - 6, s.top + i * SP, 'staff-line');
      const sc = SP / 250;
      if (s.kind === 'treble') out += '<path class="clef" d="' + G_CLEF + '" transform="translate(14 ' + (s.top + 3 * SP) + ') scale(' + sc + ' ' + -sc + ')"/>';
      else out += '<path class="clef" d="' + F_CLEF + '" transform="translate(14 ' + (s.top + SP) + ') scale(' + sc + ' ' + -sc + ')"/>';
    });
    if (staves.length === 2) out += '<line class="staff-line bar" x1="6" x2="6" y1="' + staves[0].top + '" y2="' + (staves[1].top + 4 * SP) + '"/>';

    const x0 = 64, x1 = W - 18;
    const gap = opts.spacing || (x1 - x0) / Math.max(1, items.length);
    items.forEach((n, i) => {
      const x = x0 + gap * (i + 0.5);
      const midis = n.midis || [n.midi];
      const heads = midis.map((m, k) => {
        const sp = (n.spelled && n.spelled[k]) || OP.notes.step(m, n.flat);
        return { step: sp.step, acc: sp.acc, color: (n.colors && n.colors[k]) || n.color || 'currentColor' };
      }).sort((a, b) => a.step - b.step);
      out += '<g class="note ' + (n.cls || '') + '">';
      // Ledger lines, once per staff, out to the furthest head (staff lines sit on even steps).
      staves.forEach((s) => {
        const mine = heads.filter((h) => staffFor(h.step) === s);
        if (!mine.length) return;
        const lo = Math.min(...mine.map((h) => h.step)), hi = Math.max(...mine.map((h) => h.step));
        for (let k = s.lo - 2; k >= lo; k -= 2) out += line(x - 13, x + 13, yOf(k, s), 'ledger');
        for (let k = s.hi + 2; k <= hi; k += 2) out += line(x - 13, x + 13, yOf(k, s), 'ledger');
      });
      // Heads a step apart sit side by side, like printed music.
      let accCount = 0;
      heads.forEach((h, k) => {
        const s = staffFor(h.step);
        const ny = yOf(h.step, s);
        const shifted = k > 0 && h.step - heads[k - 1].step === 1 && !heads[k - 1].shifted;
        h.shifted = shifted;
        const hx = shifted ? x + 14 : x;
        if (h.acc) {
          out += '<text class="accidental" x="' + (x - 12 - (accCount % 2) * 11) + '" y="' + (ny + 5) + '" text-anchor="end">' + ACC[h.acc] + '</text>';
          accCount++;
        }
        out += '<ellipse class="head" cx="' + hx + '" cy="' + ny + '" rx="7.6" ry="5.6" transform="rotate(-20 ' + hx + ' ' + ny + ')" style="fill:' + h.color + '"/>';
      });
      if (n.label) out += '<text class="note-label" x="' + x + '" y="' + (H - 14) + '" text-anchor="middle" style="fill:' + (n.labelColor || 'currentColor') + '">' + n.label + '</text>';
      out += '</g>';
    });
    return out + '</svg>';
  }

  OP.staff = { render };
})();
