# OpenPiano

A free piano helper for kids. Plug a USB MIDI keyboard into a computer, open the page, and play.

**Try it:** https://sirmmo.github.io/openpiano/

No keyboard? It also works with the mouse, touch screens and the computer keyboard.

## What it does

- **Free play** – every note gets a big name, its own colour and its place on a grand staff. Hold three keys and it names the chord (C major, A minor…).
- **Songs** – notes fall onto the keys, Synthesia-style, with finger numbers. In *Wait for me* mode the song stops at each note until the child finds the right key, so nobody gets left behind. *Listen* plays the song first. Speed goes from 50% to 150%. Twelve traditional songs, from a five-finger warm-up to Jingle Bells.
- **Read notes** – a note appears on the staff; play it. Six levels: middle C, treble clef, bass clef, both clefs, sharps. Two wrong tries and the right key starts to glow.
- **Listen & find** – hear a note, find it on the keyboard. Starts with three notes, ends with all twelve.
- Stars for every song and level, saved in the browser.
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
}
```

`E4` is one beat, `C4/2` two beats, `G4/.5` half a beat, `r/1` a rest; `|` is ignored. `hand` is the key under the thumb: finger numbers are shown for notes within that five-finger position. Please only add melodies that are in the public domain.

## Project layout

```
index.html          page and markup
css/style.css       all styles
js/core.js          namespace, event bus, mode registry
js/notes.js         note names, colours, staff positions
js/settings.js      settings and stars (localStorage)
js/i18n.js          English / Italian strings
js/audio.js         sampled piano, synth fallback, sound effects
js/midi.js          Web MIDI input/output
js/keyboard.js      on-screen keyboard, mouse/touch/computer keys
js/staff.js         SVG staff renderer
js/songs.js         song book
js/mode-*.js        the four modes
js/main.js          app shell
sounds/piano.js     piano samples (generated)
```

## License

MIT for the code. The piano samples (FluidR3 GM, CC BY 3.0) and the clef shapes (Bravura, SIL OFL 1.1) keep their own licenses; see [LICENSE](LICENSE).
