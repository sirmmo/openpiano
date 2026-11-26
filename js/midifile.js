/* Standard MIDI File (.mid) reader → the player's song model, plus a small
 * library of imported files kept in localStorage. */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});

  const GM_FAMILIES = ['Piano', 'Chromatic percussion', 'Organ', 'Guitar', 'Bass', 'Strings', 'Ensemble', 'Brass',
    'Reed', 'Pipe', 'Synth lead', 'Synth pad', 'Synth effects', 'Ethnic', 'Percussive', 'Sound effects'];

  /** Parse an ArrayBuffer into { format, ppq, tracks: [{ name, events }] }. */
  function parse(buf) {
    const d = new DataView(buf);
    let p = 0;
    const u8 = () => d.getUint8(p++);
    const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
    const u32 = () => { const v = d.getUint32(p); p += 4; return v; };
    const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p + i)); p += n; return s; };
    const vlq = () => { let v = 0, b; do { b = u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

    // Some files are wrapped in a RIFF "RMID" container.
    const magic = str(4);
    if (magic === 'RIFF') {
      const a = new Uint8Array(buf);
      const i = a.findIndex((_, k) => a[k] === 0x4d && a[k + 1] === 0x54 && a[k + 2] === 0x68 && a[k + 3] === 0x64); // "MThd"
      if (i < 0) throw new Error('not-midi');
      p = i + 4;
    } else if (magic !== 'MThd') throw new Error('not-midi');
    const hlen = u32();
    const format = u16(), ntrks = u16(), division = u16();
    p += hlen - 6;
    if (division & 0x8000) throw new Error('smpte');

    const tracks = [];
    while (tracks.length < ntrks && p + 8 <= d.byteLength) {
      const id = str(4), len = u32();
      const end = Math.min(p + len, d.byteLength);
      if (id !== 'MTrk') { p = end; continue; }
      const events = [];
      let tick = 0, running = 0, name = '';
      while (p < end) {
        tick += vlq();
        let st = d.getUint8(p);
        if (st & 0x80) p++; else if (running) st = running; else throw new Error('bad-data');
        if (st === 0xff) {
          const type = u8(), l = vlq();
          if (type === 0x51 && l === 3) events.push({ tick, type: 'tempo', us: (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2) });
          else if ((type === 0x03 || type === 0x04) && !name) name = decodeText(new Uint8Array(buf, p, l));
          p += l;
          if (type === 0x2f) break;
        } else if (st === 0xf0 || st === 0xf7) {
          p += vlq();
        } else {
          running = st;
          const cmd = st & 0xf0, ch = st & 0x0f;
          const a = u8();
          const b = cmd === 0xc0 || cmd === 0xd0 ? 0 : u8();
          if (cmd === 0x90 && b > 0) events.push({ tick, type: 'on', ch, note: a, vel: b });
          else if (cmd === 0x80 || cmd === 0x90) events.push({ tick, type: 'off', ch, note: a });
          else if (cmd === 0xc0) events.push({ tick, type: 'program', ch, program: a });
        }
      }
      p = end;
      tracks.push({ name: name.trim(), events, endTick: tick });
    }
    return { format, ppq: division, tracks };
  }

  function decodeText(bytes) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { return String.fromCharCode(...bytes); }
  }

  /** Turn a parsed file into the player's song model. */
  function toModel(midi, title, id) {
    const ppq = midi.ppq;
    const tempos = [];
    midi.tracks.forEach((t) => t.events.forEach((e) => { if (e.type === 'tempo') tempos.push({ beat: e.tick / ppq, bpm: 60e6 / e.us }); }));
    tempos.sort((a, b) => a.beat - b.beat);
    if (!tempos.length || tempos[0].beat > 0) tempos.unshift({ beat: 0, bpm: tempos.length ? tempos[0].bpm : 120 });

    const parts = [];
    midi.tracks.forEach((t, ti) => {
      const byCh = new Map();
      const programs = {};
      const open = new Map(); // ch:note -> [{tick, vel}]
      const close = (ch, note, tick) => {
        const stack = open.get(ch + ':' + note);
        if (!stack || !stack.length) return;
        const s = stack.shift();
        if (!byCh.has(ch)) byCh.set(ch, []);
        byCh.get(ch).push({ midi: note, start: s.tick / ppq, dur: Math.max(0.05, (tick - s.tick) / ppq), finger: null, vel: s.vel });
      };
      t.events.forEach((e) => {
        if (e.type === 'program') programs[e.ch] = e.program;
        else if (e.type === 'on') {
          const k = e.ch + ':' + e.note;
          if (!open.has(k)) open.set(k, []);
          open.get(k).push({ tick: e.tick, vel: e.vel });
        } else if (e.type === 'off') close(e.ch, e.note, e.tick);
      });
      open.forEach((stack, k) => { const [ch, note] = k.split(':').map(Number); while (stack.length) close(ch, note, t.endTick); });
      byCh.forEach((notes, ch) => {
        if (ch === 9 || !notes.length) return; // channel 10 is drums
        notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
        const family = programs[ch] != null ? GM_FAMILIES[programs[ch] >> 3] : '';
        let name = t.name || family || 'Track ' + (ti + 1);
        if (byCh.size > 1) name += ' · ' + (ch + 1);
        parts.push({ key: 'midi', name, notes, role: 'listen' });
      });
    });
    if (!parts.length) throw new Error('no-notes');

    // Guess the part to play: one named like a right hand / melody, else the highest one.
    const avg = (p) => p.notes.reduce((s, n) => s + n.midi, 0) / p.notes.length;
    let pick = parts.find((p) => /right|\brh\b|melod|destra|solo|lead|voice|voce/i.test(p.name));
    if (!pick) pick = parts.filter((p) => p.notes.length >= 8).sort((a, b) => avg(b) - avg(a))[0] || parts[0];
    pick.role = 'play';

    const length = Math.max(...parts.map((p) => Math.max(...p.notes.map((n) => n.start + n.dur))));
    return { id: 'midi:' + id, title, tempos, parts, length, level: 0, midi: true };
  }

  /* ---------- library of imported files ---------- */
  const KEY = 'openpiano.midi.v1';
  const MAX_BYTES = 3 * 1024 * 1024;

  function readLib() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function writeLib(list) { localStorage.setItem(KEY, JSON.stringify(list)); }

  function toBase64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromBase64(b64) {
    const s = atob(b64);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  }

  const cache = new Map();

  OP.midiFile = {
    parse,
    toModel,
    library: {
      list: () => readLib().map(({ id, title }) => ({ id, title })),
      /** Parse and keep a file; returns { model, saved }. Throws if the file is not usable. */
      add(title, buf) {
        const id = Date.now().toString(36);
        const model = toModel(parse(buf), title, id);
        cache.set(id, model);
        let saved = true;
        try {
          const list = readLib();
          list.push({ id, title, data: toBase64(buf) });
          if (JSON.stringify(list).length > MAX_BYTES) throw new Error('full');
          writeLib(list);
        } catch (e) { saved = false; }
        return { model, saved };
      },
      load(id) {
        if (cache.has(id)) return cache.get(id);
        const e = readLib().find((x) => x.id === id);
        if (!e) return null;
        const model = toModel(parse(fromBase64(e.data)), e.title, id);
        cache.set(id, model);
        return model;
      },
      remove(id) { cache.delete(id); writeLib(readLib().filter((x) => x.id !== id)); },
    },
  };
})();
