# OpenPiano

A free piano helper for kids. Plug a USB MIDI keyboard into a computer, open the page, and play.

**Try it:** https://ingmmo.com/openpiano/

No keyboard? It also works with the mouse, touch screens and the computer keyboard.

## What it does

- **Free play** – every note gets a big name, its own colour and its place on a grand staff. Play several keys together and they stack up as a chord on the staff, with its name and inversion (C major · 1st inversion).
- **Songs** – notes fall onto the keys, Synthesia-style, with finger numbers. In *Wait for me* mode the song stops at each note or chord until the child presses all of its keys. *Listen* plays the song first; speed goes from 50% to 150%. Fourteen traditional songs, from a five-finger warm-up to Jingle Bells; seven of them have a left-hand chord part, plus two chord pieces (block chords C–F–G and broken chords).
- **Parts** – every song is split into parts (right hand, left hand, or MIDI tracks). Tap a part to choose who plays it: *You play*, *Piano plays* (the app accompanies) or *Off*. Start with the right hand while the app plays the chords, then swap, then both hands.
- **Score view** – while a song plays, the music also scrolls by on a real staff (treble, bass or grand staff as needed) past a play line: note values, dots, flags, bar lines, time signature, and a soft bar showing how long to hold each note. Choose *Notes + score*, *Score* only, or *Falling notes* only.
- **Your own MIDI files** – open a `.mid` file (or drop it on the Songs page) and it becomes a song: tracks become parts, tempo and time-signature changes are followed, drums are skipped, and the melody track is picked for the child to play. Files are kept in the browser for next time. Any song can be downloaded as a `.mid`.
- **Record** – in Free play, press *Record* and play (optionally with a metronome and a one-bar count-in). The recording is tidied to the nearest sixteenth note, saved under *My MIDI files and recordings*, and opens in the player: see it on the score, listen back, play it again, or download it as a `.mid`.
- **Read notes** – 14 levels: middle C, treble lines and spaces, up high, bass clef, ledger lines, both clefs, sharps, flats, then *read a little melody* (play 4–6 notes from the staff).
- **Listen & find** – 10 levels: hear a note and find it, *higher or lower?*, and echo games (hear 2–4 notes, play them back).
- **Chords** – 14 levels: play named chords (C F G, minors, every key, inversions, sevenths, diminished/augmented/sus), read chords on the treble and bass staff, *major or minor?* by ear, and hear-a-chord-play-it.
- After two wrong tries the right keys start to glow. Stars for every song and level, saved in the browser.
- English and Italian; note names as C D E, Do Re Mi, or both.

## MIDI

OpenPiano uses the [Web MIDI API](https://developer.mozilla.org/docs/Web/API/Web_MIDI_API):

- Every connected MIDI input is used; keyboards can be plugged and unplugged at any time.
- Note on/off, velocity and the sustain pedal (CC 64) are supported.
- If the keyboard has its own speakers, turn off *Make sound when playing a MIDI keyboard* in Settings.
- Demos and the ear game can be played through a MIDI output (the keyboard itself) instead of the computer.

Web MIDI works in **Chrome, Edge, Opera and Firefox** (Firefox asks for a site permission). Safari and iOS do not support it; there the app still works with touch and the computer keyboard.

The page must be served over **https://** or from **localhost** for the browser to allow MIDI.

## Sound

The piano sound is a sampled acoustic grand from the FluidR3 GM soundfont: 30 samples, one every three semitones, pitch-shifted for the notes in between. They are packed into `sounds/piano.js` (about 0.9 MB), loaded after the first click, and work offline. Until they are ready, or if *Soft synth* is chosen in Settings, a small Web Audio synth plays instead.

A full General MIDI soundfont would be 100+ MB for instruments a beginner never uses, so the app ships the one instrument it needs.

To rebuild the samples: `python3 tools/build-piano-samples.py`.

## Computer keys

```
 W E   T Y U   O P        ← black keys
A S D F G H J K L ; '     ← white keys, A = middle C
Z / X: octave down / up
Space: start / pause a song
```

## Running it locally

No build step and no dependencies. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` straight from disk also works for sound and the mouse, but most browsers only allow MIDI on http(s).

## Adding a song

Songs live in [`js/songs.js`](js/songs.js) in a short text notation:

```js
{
  id: 'mary', level: 1, bpm: 100, hand: 'C4',
  title: ['Mary Had a Little Lamb', 'Maria aveva un agnellino'],
  notes: 'E4 D4 C4 D4 | E4 E4 E4/2 | ...',
  left:  '[C]/4 | [C]/4 | [G]/4 | ...',
}
```

- `E4` is one beat, `C4/2` two beats, `G4/.5` half a beat, `r/1` a rest; `|` is ignored.
- `C4+E4+G4/4` is a chord; `@135` adds finger numbers (one per note).
- `[C]`, `[F]`, `[G]`, `[G7]`, `[Am]`, `[Dm]` are ready-made left-hand chord shapes.
- `hand` is the key under the right thumb: finger numbers are added for notes inside that five-finger position.
- `left` is optional; by default the app plays it and the child plays `notes`.
- `meter: [3, 4]` sets the time signature (default 4/4); `pickup: 1` starts with a one-beat pickup bar.

Please only add melodies that are in the public domain. Anything else can be loaded as a MIDI file instead.

## Project layout

```
index.html          page and markup
css/style.css       all styles
js/core.js          namespace, event bus, mode registry
js/notes.js         note names, colours, spelling, chords
js/settings.js      settings and stars (localStorage)
js/i18n.js          English / Italian strings
js/audio.js         sampled piano, synth fallback, sound effects
js/midi.js          Web MIDI input/output
js/keyboard.js      on-screen keyboard, mouse/touch/computer keys
js/staff.js         SVG staff renderer
js/score.js         scrolling score for the song player (canvas)
js/songs.js         song book
js/midifile.js      MIDI file reader/writer and saved-files library
js/mode-free.js     free play and recording
js/mode-songs.js    song player
js/mode-quiz.js     exercises (Read notes, Listen & find, Chords)
js/main.js          app shell
sounds/piano.js     piano samples (generated)
```

## License

MIT for the code. The piano samples (FluidR3 GM, CC BY 3.0) and the clef shapes (Bravura, SIL OFL 1.1) keep their own licenses; see [LICENSE](LICENSE).
