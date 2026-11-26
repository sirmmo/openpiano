/* Song book. All melodies are traditional / public domain, right hand, C major.
 *
 * Notation: space separated notes, "|" separates bars (ignored).
 *   E4      one beat
 *   C4/2    two beats       G4/.5  half a beat
 *   r/1     a one-beat rest
 * hand: the key under the thumb in a five-finger position; finger numbers are
 * shown for notes that fall inside it.
 */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});

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
    },
    {
      id: 'auclair', level: 1, bpm: 100, hand: 'C4',
      title: ['Au Clair de la Lune', 'Au Clair de la Lune'],
      notes: 'C4 C4 C4 D4 | E4/2 D4/2 | C4 E4 D4 D4 | C4/4 | C4 C4 C4 D4 | E4/2 D4/2 | C4 E4 D4 D4 | C4/4',
    },
    {
      id: 'ode', level: 2, bpm: 100, hand: 'C4',
      title: ['Ode to Joy', 'Inno alla gioia'],
      notes: 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4/1.5 D4/.5 D4/2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4/1.5 C4/.5 C4/2',
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
    },
    {
      id: 'london', level: 2, bpm: 100, hand: 'C4',
      title: ['London Bridge', 'Il ponte di Londra'],
      notes: 'G4/1.5 A4/.5 G4 F4 | E4 F4 G4/2 | D4 E4 F4/2 | E4 F4 G4/2 | G4/1.5 A4/.5 G4 F4 | E4 F4 G4/2 | D4/2 G4/2 | E4 C4/3',
    },
    {
      id: 'macdonald', level: 2, bpm: 110, hand: null,
      title: ['Old MacDonald Had a Farm', 'Nella vecchia fattoria'],
      notes: 'C4 C4 C4 G3 | A3 A3 G3/2 | E4 E4 D4 D4 | C4/3 G3 | C4 C4 C4 G3 | A3 A3 G3/2 | E4 E4 D4 D4 | C4/4',
    },
    {
      id: 'row', level: 3, bpm: 90, hand: 'C4',
      title: ['Row, Row, Row Your Boat', 'Rema, rema la barchetta'],
      notes: 'C4/1.5 C4/1.5 | C4 D4/.5 E4/1.5 | E4 D4/.5 E4 F4/.5 | G4/3 | C5/.5 C5/.5 C5/.5 G4/.5 G4/.5 G4/.5 | E4/.5 E4/.5 E4/.5 C4/.5 C4/.5 C4/.5 | G4 F4/.5 E4 D4/.5 | C4/3',
    },
    {
      id: 'jingle', level: 3, bpm: 120, hand: 'C4',
      title: ['Jingle Bells', 'Jingle Bells'],
      notes: 'E4 E4 E4/2 | E4 E4 E4/2 | E4 G4 C4/1.5 D4/.5 | E4/4 | F4 F4 F4/1.5 F4/.5 | F4 E4 E4 E4/.5 E4/.5 | E4 D4 D4 E4 | D4/2 G4/2 | E4 E4 E4/2 | E4 E4 E4/2 | E4 G4 C4/1.5 D4/.5 | E4/4 | F4 F4 F4 F4 | F4 E4 E4 E4/.5 E4/.5 | G4 G4 F4 D4 | C4/4',
    },
    {
      id: 'birthday', level: 3, bpm: 100, hand: null,
      title: ['Happy Birthday', 'Tanti auguri'],
      notes: 'G3/.75 G3/.25 | A3 G3 C4 | B3/2 G3/.75 G3/.25 | A3 G3 D4 | C4/2 G3/.75 G3/.25 | G4 E4 C4 | B3 A3 F4/.75 F4/.25 | E4 C4 D4 | C4/3',
    },
  ];

  const WHITE_INDEX = (m) => OP.notes.step(m).step; // diatonic position

  function parse(song) {
    if (song.parsed) return song.parsed;
    const out = [];
    let t = 0;
    const thumb = song.hand ? WHITE_INDEX(OP.notes.parse(song.hand)) : null;
    song.notes.split(/\s+/).forEach((tok) => {
      if (!tok || tok === '|') return;
      const [n, d] = tok.split('/');
      const dur = d ? parseFloat(d) : 1;
      if (n !== 'r') {
        const midi = OP.notes.parse(n);
        let finger = null;
        if (thumb != null && !OP.notes.isBlack(midi)) {
          const f = WHITE_INDEX(midi) - thumb + 1;
          if (f >= 1 && f <= 5) finger = f;
        }
        out.push({ midi, start: t, dur, finger });
      }
      t += dur;
    });
    song.parsed = out;
    song.length = t;
    return out;
  }

  OP.songs = {
    list: SONGS,
    parse,
    title: (s) => s.title[OP.settings.lang === 'it' ? 1 : 0],
    byId: (id) => SONGS.find((s) => s.id === id),
  };
})();
