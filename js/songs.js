/* Song book. All melodies are traditional / public domain, in C major.
 *
 * Notation: space separated tokens, "|" separates bars (ignored).
 *   E4            one beat               C4/2     two beats     G4/.5  half a beat
 *   C3+E3+G3/4    a chord, four beats    r/1      a one-beat rest
 *   [C]/4         a left-hand chord shape from LH_CHORDS below
 *   …@531         finger numbers, one per note of the token
 * hand: the key under the right thumb; finger numbers are added for notes
 * inside that five-finger position.
 * left: optional left-hand part (chords). By default the app plays it.
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
      id: 'row', level: 3, bpm: 90, hand: 'C4',
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
      id: 'birthday', level: 3, bpm: 100, hand: null,
      title: ['Happy Birthday', 'Tanti auguri'],
      notes: 'G3/.75 G3/.25 | A3 G3 C4 | B3/2 G3/.75 G3/.25 | A3 G3 D4 | C4/2 G3/.75 G3/.25 | G4 E4 C4 | B3 A3 F4/.75 F4/.25 | E4 C4 D4 | C4/3',
    },
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
    if (song.left) parts.push({ key: 'left', notes: parseLine(song.left, null), role: 'listen' });
    const length = Math.max(...parts.map((p) => Math.max(...p.notes.map((n) => n.start + n.dur))));
    song.model = { id: 'song:' + song.id, title: song.title, tempos: [{ beat: 0, bpm: song.bpm }], parts, length, level: song.level };
    return song.model;
  }

  OP.songs = {
    list: SONGS,
    model,
    parseLine,
    title: (s) => (Array.isArray(s.title) ? s.title[OP.settings.lang === 'it' ? 1 : 0] : s.title),
    partName: (p) => (p.key === 'right' ? OP.t('rightHand') : p.key === 'left' ? OP.t('leftHand') : p.name),
  };
})();
