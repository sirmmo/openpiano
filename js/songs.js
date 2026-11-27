/* Song book. All melodies are traditional / public domain, in C major,
 * followed by finger exercises (group: 'tech'): five-finger patterns and scales
 * with their standard fingering, Hanon Nos. 1–20 (group: 'hanon') and Czerny
 * (groups 'czerny840' and 'czerny821').
 *
 * Notation: space separated tokens, "|" separates bars (ignored).
 *   E4            one beat               C4/2     two beats     G4/.5  half a beat
 *   C3+E3+G3/4    a chord, four beats    r/1      a one-beat rest
 *   [C]/4         a left-hand chord shape from LH_CHORDS below
 *   …@531         finger numbers, one per note of the token
 * hand: the key under the right thumb; finger numbers are added for notes
 * inside that five-finger position.
 * left: optional left-hand part (chords). By default the app plays it
 * (leftRole: 'play' makes it the child's part too).
 * flat: true spells black keys as flats on the score.
 */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});

  // Easy left-hand shapes around C3 that barely move between chords.
  const LH_CHORDS = {
    C: ['C3+E3+G3', '531'],
    F: ['C3+F3+A3', '521'],
    G: ['B2+D3+G3', '531'],
    G7: ['B2+F3+G3', '521'],
    Am: ['C3+E3+A3', '521'],
    Dm: ['D3+F3+A3', '531'],
  };

  /* ---------- Hanon, The Virtuoso Pianist (1873), Nos. 1–20 ----------
   * Notes and fingering come from js/hanon.js (generated from the Mutopia
   * Project's engraving of the original), shortened to one octave up and one
   * down for small hands. Sixteenths become eighths; the last note fills a bar. */
  const wn = (step) => 'CDEFGAB'[((step % 7) + 7) % 7] + Math.floor(step / 7); // diatonic step → note name (C4 = 28)
  function hanonFigures(d) {
    const out = [];
    for (let i = 0; i < d.nUp; i++) out.push(i === d.nUp - 1 && d.upLast ? d.upLast : i === 0 && d.upFirst ? d.upFirst : { s: d.up.s + i, o: d.up.o, f: d.up.f });
    for (let i = 0; i < d.nDown; i++) out.push(i === d.nDown - 1 && d.downLast ? d.downLast : i === 0 && d.downFirst ? d.downFirst : { s: d.down.s - i, o: d.down.o, f: d.down.f });
    return out;
  }
  function hanonPart(d, shift) {
    const out = hanonFigures(d).map((g) => g.o.map((o, k) => wn(g.s + o + shift) + '/.5' + (g.f[k] ? '@' + g.f[k] : '')).join(' '));
    const fingers = d.end.some((e) => e.f) ? '@' + d.end.map((e) => e.f || 0).join('') : '';
    out.push(d.end.map((e) => wn(e.s + shift)).join('+') + '/4' + fingers);
    return out.join(' | ');
  }
  function hanonSongs() {
    return (OP.hanonData || []).map((h) => {
      const top = Math.max(...hanonFigures(h.rh).flatMap((g) => g.o.map((o) => g.s + o)));
      const shift = top > 42 ? -7 : 0; // keep everything on a 49-key keyboard (C2–C6)
      return {
        id: 'hanon' + h.n, group: 'hanon', level: h.n <= 10 ? 2 : 3, bpm: 60,
        title: ['Hanon No. ' + h.n, 'Hanon n. ' + h.n],
        notes: hanonPart(h.rh, shift), left: hanonPart(h.lh, shift),
      };
    });
  }

  /* ---------- Czerny: Op. 840 Nos. 1–10 and Op. 821 Nos. 1–19 ----------
   * From js/czerny.js (generated from the Mutopia Project's engravings). */
  function czernySongs() {
    return (OP.czernyData || []).map((p) => {
      const R = 96;
      const dec = (arr) => {
        const out = [];
        let t = 0;
        for (let i = 0; i < arr.length; i += 3) { t += arr[i]; out.push({ midi: arr[i + 2], start: t / R, dur: arr[i + 1] / R, finger: null, vel: 90 }); }
        return out;
      };
      const parts = [{ key: 'right', notes: dec(p.rh), role: 'play' }, { key: 'left', notes: dec(p.lh), role: 'listen' }];
      const id = 'czerny' + p.op + '-' + p.no;
      const title = ['Czerny, Op. ' + p.op + ' No. ' + p.no, 'Czerny, op. ' + p.op + ' n. ' + p.no];
      const keys = p.keys.map(([t, sf]) => ({ beat: t / R, sf }));
      const level = p.op === 840 ? 2 : 3;
      return {
        id, group: 'czerny' + p.op, level, title, short: ['No. ' + p.no, 'N. ' + p.no], tempoWord: p.tempo,
        model: {
          id: 'song:' + id, title, level, pickup: p.pickup, parts, flat: p.flat,
          // Spell black keys with flats only while the music is in a flat key.
          flatAt: (beat) => { let sf = 0; for (const k of keys) { if (k.beat <= beat + 0.01) sf = k.sf; else break; } return sf < 0; },
          tempos: p.tempos.map(([t, bpm]) => ({ beat: t / R, bpm })),
          meters: p.meters.map(([t, num, den]) => ({ beat: t / R, num, den })),
          length: Math.max(...parts.flatMap((x) => x.notes.map((n) => n.start + n.dur))),
        },
      };
    });
  }

  const SONGS = [
    {
      id: 'warmup', level: 1, bpm: 80, hand: 'C4',
      title: ['Five-finger warm-up', 'Riscaldamento a cinque dita'],
      notes: 'C4 D4 E4 F4 | G4/4 | G4 F4 E4 D4 | C4/4',
    },
    {
      id: 'hotcross', level: 1, bpm: 90, hand: 'C4',
      title: ['Hot Cross Buns', 'Hot Cross Buns'],
      notes: 'E4 D4 C4/2 | E4 D4 C4/2 | C4/.5 C4/.5 C4/.5 C4/.5 D4/.5 D4/.5 D4/.5 D4/.5 | E4 D4 C4/2',
    },
    {
      id: 'mary', level: 1, bpm: 100, hand: 'C4',
      title: ['Mary Had a Little Lamb', 'Maria aveva un agnellino'],
      notes: 'E4 D4 C4 D4 | E4 E4 E4/2 | D4 D4 D4/2 | E4 G4 G4/2 | E4 D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4/4',
      left: '[C]/4 | [C]/4 | [G]/4 | [C]/4 | [C]/4 | [C]/4 | [G]/4 | [C]/4',
    },
    {
      id: 'auclair', level: 1, bpm: 100, hand: 'C4',
      title: ['Au Clair de la Lune', 'Au Clair de la Lune'],
      notes: 'C4 C4 C4 D4 | E4/2 D4/2 | C4 E4 D4 D4 | C4/4 | C4 C4 C4 D4 | E4/2 D4/2 | C4 E4 D4 D4 | C4/4',
      left: '[C]/4 | [C]/2 [G]/2 | [C]/2 [G]/2 | [C]/4 | [C]/4 | [C]/2 [G]/2 | [C]/2 [G]/2 | [C]/4',
    },
    {
      id: 'ode', level: 2, bpm: 100, hand: 'C4',
      title: ['Ode to Joy', 'Inno alla gioia'],
      notes: 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4/1.5 D4/.5 D4/2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4/1.5 C4/.5 C4/2',
      left: '[C]/4 | [G]/4 | [C]/4 | [G]/4 | [C]/4 | [G]/4 | [C]/4 | [G]/2 [C]/2',
    },
    {
      id: 'frere', level: 2, bpm: 100, hand: 'C4',
      title: ['Frère Jacques', 'Fra Martino'],
      notes: 'C4 D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4/2 | E4 F4 G4/2 | G4/.5 A4/.5 G4/.5 F4/.5 E4 C4 | G4/.5 A4/.5 G4/.5 F4/.5 E4 C4 | C4 G3 C4/2 | C4 G3 C4/2',
    },
    {
      id: 'twinkle', level: 2, bpm: 100, hand: 'C4',
      title: ['Twinkle Twinkle Little Star', 'Brilla brilla la stellina'],
      notes: 'C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2 | G4 G4 F4 F4 | E4 E4 D4/2 | G4 G4 F4 F4 | E4 E4 D4/2 | C4 C4 G4 G4 | A4 A4 G4/2 | F4 F4 E4 E4 | D4 D4 C4/2',
      left: '[C]/4 | [F]/2 [C]/2 | [F]/2 [C]/2 | [G]/2 [C]/2 | [C]/2 [F]/2 | [C]/2 [G]/2 | [C]/2 [F]/2 | [C]/2 [G]/2 | [C]/4 | [F]/2 [C]/2 | [F]/2 [C]/2 | [G]/2 [C]/2',
    },
    {
      id: 'london', level: 2, bpm: 100, hand: 'C4',
      title: ['London Bridge', 'Il ponte di Londra'],
      notes: 'G4/1.5 A4/.5 G4 F4 | E4 F4 G4/2 | D4 E4 F4/2 | E4 F4 G4/2 | G4/1.5 A4/.5 G4 F4 | E4 F4 G4/2 | D4/2 G4/2 | E4 C4/3',
      left: '[C]/4 | [C]/4 | [G7]/4 | [C]/4 | [C]/4 | [C]/4 | [G7]/4 | [C]/4',
    },
    {
      id: 'macdonald', level: 2, bpm: 110, hand: null,
      title: ['Old MacDonald Had a Farm', 'Nella vecchia fattoria'],
      notes: 'C4 C4 C4 G3 | A3 A3 G3/2 | E4 E4 D4 D4 | C4/3 G3 | C4 C4 C4 G3 | A3 A3 G3/2 | E4 E4 D4 D4 | C4/4',
    },
    {
      id: 'chords3', level: 2, bpm: 72, hand: null,
      title: ['Three chords: C, F, G', 'Tre accordi: Do, Fa, Sol'],
      notes: 'C4+E4+G4/4@135 | C4+F4+A4/4@135 | B3+D4+G4/4@125 | C4+E4+G4/4@135 | C4+E4+G4/2@135 C4+F4+A4/2@135 | C4+E4+G4/2@135 B3+D4+G4/2@125 | C4+E4+G4/2@135 C4+F4+A4/2@135 | B3+D4+G4/2@125 C4+E4+G4/2@135',
    },
    {
      id: 'arpeggios', level: 3, bpm: 90, hand: null,
      title: ['Broken chords', 'Accordi spezzati'],
      notes: 'C4@1 E4@3 G4@5 E4@3 | C4@1 F4@3 A4@5 F4@3 | B3@1 D4@2 G4@5 D4@2 | C4/2@1 E4/2@3 | A3@1 C4@2 E4@4 C4@2 | D4@1 F4@2 A4@4 F4@2 | B3@1 D4@2 G4@5 D4@2 | C4/4@1',
    },
    {
      id: 'row', level: 3, bpm: 90, hand: 'C4', meter: [6, 8],
      title: ['Row, Row, Row Your Boat', 'Rema, rema la barchetta'],
      notes: 'C4/1.5 C4/1.5 | C4 D4/.5 E4/1.5 | E4 D4/.5 E4 F4/.5 | G4/3 | C5/.5 C5/.5 C5/.5 G4/.5 G4/.5 G4/.5 | E4/.5 E4/.5 E4/.5 C4/.5 C4/.5 C4/.5 | G4 F4/.5 E4 D4/.5 | C4/3',
      left: '[C]/3 | [C]/3 | [C]/3 | [C]/3 | [C]/3 | [C]/3 | [G]/3 | [C]/3',
    },
    {
      id: 'jingle', level: 3, bpm: 120, hand: 'C4',
      title: ['Jingle Bells', 'Jingle Bells'],
      notes: 'E4 E4 E4/2 | E4 E4 E4/2 | E4 G4 C4/1.5 D4/.5 | E4/4 | F4 F4 F4/1.5 F4/.5 | F4 E4 E4 E4/.5 E4/.5 | E4 D4 D4 E4 | D4/2 G4/2 | E4 E4 E4/2 | E4 E4 E4/2 | E4 G4 C4/1.5 D4/.5 | E4/4 | F4 F4 F4 F4 | F4 E4 E4 E4/.5 E4/.5 | G4 G4 F4 D4 | C4/4',
      left: '[C]/4 | [C]/4 | [C]/4 | [C]/4 | [F]/4 | [C]/4 | [G]/4 | [G7]/4 | [C]/4 | [C]/4 | [C]/4 | [C]/4 | [F]/4 | [C]/4 | [G7]/4 | [C]/4',
    },
    {
      id: 'birthday', level: 3, bpm: 100, hand: null, meter: [3, 4], pickup: 1,
      title: ['Happy Birthday', 'Tanti auguri'],
      notes: 'G3/.75 G3/.25 | A3 G3 C4 | B3/2 G3/.75 G3/.25 | A3 G3 D4 | C4/2 G3/.75 G3/.25 | G4 E4 C4 | B3 A3 F4/.75 F4/.25 | E4 C4 D4 | C4/3',
    },

    /* ---------- finger exercises ---------- */
    {
      id: 'five-hands', group: 'tech', level: 1, bpm: 80, leftRole: 'play',
      title: ['Five fingers, both hands', 'Cinque dita, due mani'],
      notes: 'C4@1 D4@2 E4@3 F4@4 | G4@5 F4@4 E4@3 D4@2 | C4@1 D4@2 E4@3 F4@4 | G4@5 F4@4 E4@3 D4@2 | C4/4@1',
      left: 'C3@5 D3@4 E3@3 F3@2 | G3@1 F3@2 E3@3 D3@4 | C3@5 D3@4 E3@3 F3@2 | G3@1 F3@2 E3@3 D3@4 | C3/4@5',
    },
    {
      id: 'five-keys', group: 'tech', level: 2, bpm: 80,
      title: ['Five fingers in five keys', 'Cinque dita in cinque tonalità'],
      notes: ['C4 D4 E4 F4 G4', 'G4 A4 B4 C5 D5', 'D4 E4 F#4 G4 A4', 'A4 B4 C#5 D5 E5', 'E4 F#4 G#4 A4 B4'].map((k) => {
        const n = k.split(' ');
        return n[0] + '@1 ' + n[1] + '@2 ' + n[2] + '@3 ' + n[3] + '@4 | ' + n[4] + '@5 ' + n[3] + '@4 ' + n[2] + '@3 ' + n[1] + '@2 | ' + n[0] + '/4@1';
      }).join(' | '),
      left: ['C3 D3 E3 F3 G3', 'G3 A3 B3 C4 D4', 'D3 E3 F#3 G3 A3', 'A3 B3 C#4 D4 E4', 'E3 F#3 G#3 A3 B3'].map((k) => {
        const n = k.split(' ');
        return n[0] + '@5 ' + n[1] + '@4 ' + n[2] + '@3 ' + n[3] + '@2 | ' + n[4] + '@1 ' + n[3] + '@2 ' + n[2] + '@3 ' + n[1] + '@4 | ' + n[0] + '/4@5';
      }).join(' | '),
    },
    {
      id: 'thumb-under', group: 'tech', level: 2, bpm: 72,
      title: ['Thumb under: the {C} scale', 'Il pollice passa sotto: scala di {C}'],
      notes: 'C4@1 D4@2 E4@3 F4@1 | G4@2 A4@3 B4@4 C5@5 | B4@4 A4@3 G4@2 F4@1 | E4@3 D4@2 C4/2@1',
      left: 'C3@5 D3@4 E3@3 F3@2 | G3@1 A3@3 B3@2 C4@1 | B3@2 A3@3 G3@1 F3@2 | E3@3 D3@4 C3/2@5',
    },
    {
      id: 'scale-g', group: 'tech', level: 2, bpm: 72,
      title: ['{G} major scale', 'Scala di {G} maggiore'],
      notes: 'G4@1 A4@2 B4@3 C5@1 | D5@2 E5@3 F#5@4 G5@5 | F#5@4 E5@3 D5@2 C5@1 | B4@3 A4@2 G4/2@1',
      left: 'G3@5 A3@4 B3@3 C4@2 | D4@1 E4@3 F#4@2 G4@1 | F#4@2 E4@3 D4@1 C4@2 | B3@3 A3@4 G3/2@5',
    },
    {
      id: 'scale-d', group: 'tech', level: 2, bpm: 72,
      title: ['{D} major scale', 'Scala di {D} maggiore'],
      notes: 'D4@1 E4@2 F#4@3 G4@1 | A4@2 B4@3 C#5@4 D5@5 | C#5@4 B4@3 A4@2 G4@1 | F#4@3 E4@2 D4/2@1',
      left: 'D3@5 E3@4 F#3@3 G3@2 | A3@1 B3@3 C#4@2 D4@1 | C#4@2 B3@3 A3@1 G3@2 | F#3@3 E3@4 D3/2@5',
    },
    {
      id: 'scale-f', group: 'tech', level: 2, bpm: 72, flat: true,
      title: ['{F} major scale', 'Scala di {F} maggiore'],
      notes: 'F4@1 G4@2 A4@3 Bb4@4 | C5@1 D5@2 E5@3 F5@4 | E5@3 D5@2 C5@1 Bb4@4 | A4@3 G4@2 F4/2@1',
      left: 'F3@5 G3@4 A3@3 Bb3@2 | C4@1 D4@3 E4@2 F4@1 | E4@2 D4@3 C4@1 Bb3@2 | A3@3 G3@4 F3/2@5',
    },
    {
      id: 'contrary', group: 'tech', level: 3, bpm: 66, leftRole: 'play',
      title: ['Contrary motion', 'Moto contrario'],
      notes: 'C4@1 D4@2 E4@3 F4@1 | G4@2 A4@3 B4@4 C5@5 | B4@4 A4@3 G4@2 F4@1 | E4@3 D4@2 C4/2@1',
      left: 'C3@1 B2@2 A2@3 G2@1 | F2@2 E2@3 D2@4 C2@5 | D2@4 E2@3 F2@2 G2@1 | A2@3 B2@2 C3/2@1',
    },
    ...hanonSongs(),
    ...czernySongs(),
  ];

  const diatonic = (m) => OP.notes.step(m).step;
  const TOKEN = /^(r|\[[^\]]+\]|[A-G][#b]?-?\d(?:\+[A-G][#b]?-?\d)*)(?:\/([\d.]+))?(?:@(\d+))?$/;

  /** Parse one part's text into [{ midi, start, dur, finger }]. */
  function parseLine(text, hand) {
    const out = [];
    let t = 0;
    const thumb = hand ? diatonic(OP.notes.parse(hand)) : null;
    text.split(/\s+/).forEach((tok) => {
      if (!tok || tok === '|') return;
      const mm = TOKEN.exec(tok);
      if (!mm) throw new Error('Bad token: ' + tok);
      let body = mm[1], fingers = mm[3] || '';
      const dur = mm[2] ? parseFloat(mm[2]) : 1;
      if (body[0] === '[') {
        const shape = LH_CHORDS[body.slice(1, -1)];
        if (!shape) throw new Error('Unknown chord shape: ' + body);
        body = shape[0];
        fingers = fingers || shape[1];
      }
      if (body !== 'r') {
        body.split('+').forEach((n, i) => {
          const midi = OP.notes.parse(n);
          let finger = fingers[i] ? +fingers[i] : null;
          if (finger == null && thumb != null && !OP.notes.isBlack(midi)) {
            const f = diatonic(midi) - thumb + 1;
            if (f >= 1 && f <= 5) finger = f;
          }
          out.push({ midi, start: t, dur, finger, vel: 90 });
        });
      }
      t += dur;
    });
    return out;
  }

  /** Common song model used by the player (built-in songs and MIDI files). */
  function model(song) {
    if (song.model) return song.model;
    const parts = [{ key: 'right', notes: parseLine(song.notes, song.hand), role: 'play' }];
    if (song.left) parts.push({ key: 'left', notes: parseLine(song.left, null), role: song.leftRole || 'listen' });
    const length = Math.max(...parts.map((p) => Math.max(...p.notes.map((n) => n.start + n.dur))));
    const [num, den] = song.meter || [4, 4];
    song.model = {
      id: 'song:' + song.id, title: song.title, tempos: [{ beat: 0, bpm: song.bpm }],
      meters: [{ beat: 0, num, den }], pickup: song.pickup || 0, parts, length, level: song.level, flat: !!song.flat,
    };
    return song.model;
  }

  /** Time signature in effect at a beat. */
  function meterAt(m, beat) {
    const list = m.meters || [];
    let cur = list[0] || { beat: 0, num: 4, den: 4 };
    for (const x of list) { if (x.beat <= beat) cur = x; else break; }
    return cur;
  }

  /** Beats where bar lines go (a pickup bar shifts the first one). */
  function bars(m) {
    const list = m.meters && m.meters.length ? m.meters : [{ beat: 0, num: 4, den: 4 }];
    const out = [];
    list.forEach((x, i) => {
      const len = (x.num * 4) / x.den;
      const end = i + 1 < list.length ? list[i + 1].beat : m.length + 0.01;
      let b = x.beat + (i === 0 && m.pickup ? m.pickup : i === 0 ? len : 0);
      const last = i === list.length - 1;
      for (; (last ? b <= end : b < end - 1e-6) && out.length < 20000; b += len) out.push(b);
    });
    return out;
  }

  OP.songs = {
    list: SONGS,
    model,
    parseLine,
    meterAt,
    bars,
    title: (s) => (Array.isArray(s.title) ? (OP.theory ? OP.theory.L(s.title[0], s.title[1]) : s.title[OP.settings.lang === 'it' ? 1 : 0]) : s.title),
    /** Songs or finger exercises ('tech'). */
    group: (g) => SONGS.filter((s) => (s.group || 'songs') === g),
    partName: (p) => (p.key === 'right' ? OP.t('rightHand') : p.key === 'left' ? OP.t('leftHand') : p.name),
  };
})();
