/* Tiny translation table. Add a language by adding a column. */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});

  const S = {
    tagline: ['Learn the piano, one note at a time', 'Impara il pianoforte, una nota alla volta'],
    start: ["Let's play!", 'Suoniamo!'],
    splashHint: ['Plug in a USB MIDI keyboard, or play with the mouse and the computer keys.', 'Collega una tastiera MIDI USB, oppure suona con il mouse e la tastiera del computer.'],
    modeFree: ['Free play', 'Suona libero'],
    modeSongs: ['Songs', 'Canzoni'],
    modeNotes: ['Read notes', 'Leggi le note'],
    modeEar: ['Listen & find', 'Ascolta e trova'],

    midiConnect: ['Connect keyboard', 'Collega tastiera'],
    midiUnsupported: ['No MIDI here', 'MIDI non disponibile'],
    midiUnsupportedLong: ["This browser can't talk to MIDI keyboards. Try Chrome or Edge on a computer. You can still play with the mouse and the computer keys.", 'Questo browser non comunica con le tastiere MIDI. Prova Chrome o Edge su un computer. Puoi comunque suonare con il mouse e la tastiera del computer.'],
    midiInsecure: ['MIDI needs this page to be opened over https:// (or from localhost).', 'Il MIDI richiede che la pagina sia aperta via https:// (o da localhost).'],
    midiNoDevice: ['Plug in a keyboard', 'Collega una tastiera'],
    midiDenied: ['MIDI blocked', 'MIDI bloccato'],
    midiDeniedLong: ['The browser blocked MIDI. Allow it from the icon next to the address bar, then reload.', "Il browser ha bloccato il MIDI. Consentilo dall'icona vicino alla barra degli indirizzi e ricarica."],
    midiConnected: ['{name} connected', '{name} collegata'],
    midiGone: ['Keyboard unplugged', 'Tastiera scollegata'],

    settings: ['Settings', 'Impostazioni'],
    language: ['Language', 'Lingua'],
    noteNames: ['Note names', 'Nomi delle note'],
    namesLetters: ['C D E', 'C D E'],
    namesSolfege: ['Do Re Mi', 'Do Re Mi'],
    namesBoth: ['Both', 'Entrambi'],
    keyLabels: ['Show names on the keys', 'Mostra i nomi sui tasti'],
    instrument: ['Sound', 'Suono'],
    instPiano: ['Piano', 'Pianoforte'],
    instSynth: ['Soft synth', 'Synth morbido'],
    midiSound: ['Make sound when playing a MIDI keyboard', 'Suona dal computer con la tastiera MIDI'],
    midiSoundHint: ['Turn this off if your keyboard has its own speakers.', 'Disattiva se la tastiera ha già i suoi altoparlanti.'],
    volume: ['Volume', 'Volume'],
    kbSize: ['Keys on screen', 'Tasti sullo schermo'],
    midiDevices: ['MIDI keyboards', 'Tastiere MIDI'],
    midiNone: ['None found', 'Nessuna trovata'],
    midiOut: ['Play demos through', 'Fai suonare le demo da'],
    outBuiltin: ['This computer', 'Questo computer'],
    computerKeys: ['Computer keys: A W S E D F T G Y H U J K O L P play notes. Z and X move down or up an octave.', 'Tastiera del computer: A W S E D F T G Y H U J K O L P suonano le note. Z e X spostano di un\'ottava giù o su.'],
    resetProgress: ['Erase all stars', 'Cancella tutte le stelle'],
    resetConfirm: ['Erase all stars and progress?', 'Cancellare tutte le stelle e i progressi?'],
    done: ['Done', 'Fatto'],
    about: ['OpenPiano is free and open source.', 'OpenPiano è libero e open source.'],
    loadingPiano: ['Loading the piano sound…', 'Carico il suono del pianoforte…'],

    freeHint: ['Play any key!', 'Premi un tasto!'],
    freeSub: ['Each note has its own colour. Hold three keys together to make a chord.', 'Ogni nota ha il suo colore. Tieni premuti tre tasti insieme per fare un accordo.'],

    pickSong: ['Pick a song', 'Scegli una canzone'],
    level: ['Level', 'Livello'],
    back: ['Back', 'Indietro'],
    startBtn: ['Start', 'Via!'],
    pause: ['Pause', 'Pausa'],
    resume: ['Go on', 'Continua'],
    listen: ['Listen', 'Ascolta'],
    stopListen: ['Stop', 'Stop'],
    restart: ['From the top', 'Da capo'],
    waitMode: ['Wait for me', 'Aspettami'],
    speed: ['Speed', 'Velocità'],
    songReady: ['Press the glowing key to start!', 'Premi il tasto che brilla per iniziare!'],
    oops: ['Oops: {n}', 'Ops: {n}'],
    hits: ['{a} of {b}', '{a} su {b}'],
    great: ['Amazing!', 'Fantastico!'],
    good: ['Well done!', 'Bravo!'],
    ok: ['Good try!', 'Bel tentativo!'],
    newRecord: ['New record!', 'Nuovo record!'],
    playAgain: ['Play again', 'Ancora'],
    nextSong: ['Next song', 'Prossima canzone'],
    moreSongs: ['All songs', 'Tutte le canzoni'],

    pickLevel: ['Pick a level', 'Scegli un livello'],
    whichNote: ['Which note is this? Play it!', 'Che nota è? Suonala!'],
    earFind: ['Listen… then find the note!', 'Ascolta… poi trova la nota!'],
    hearAgain: ['Hear it again', 'Riascolta'],
    anyOctave: ['Any octave counts', "Vale qualsiasi ottava"],
    tryAgain: ['Try again', 'Riprova'],
    hint: ['Look for the glowing key', 'Cerca il tasto che brilla'],
    firstTry: ['{a} of {b} on the first try', '{a} su {b} al primo colpo'],
    yay: [['Yes!', 'Great!', 'Super!', 'You got it!', 'Wow!'], ['Sì!', 'Grande!', 'Super!', 'Esatto!', 'Wow!']],

    notesL1: ['Middle C and friends', 'Il Do centrale e i suoi amici'],
    notesL2: ['Treble clef, C to C', 'Chiave di violino, da Do a Do'],
    notesL3: ['Treble clef, up high', 'Chiave di violino, più in alto'],
    notesL4: ['Bass clef', 'Chiave di basso'],
    notesL5: ['Both clefs', 'Entrambe le chiavi'],
    notesL6: ['With sharps', 'Con i diesis'],
    earL3: ['All the white keys', 'Tutti i tasti bianchi'],
    earL4: ['White and black keys', 'Tasti bianchi e neri'],

    chord: {
      maj: ['major', 'maggiore'], min: ['minor', 'minore'], dim: ['diminished', 'diminuito'], aug: ['augmented', 'aumentato'],
      sus2: ['sus2', 'sus2'], sus4: ['sus4', 'sus4'], dom7: ['seventh', 'settima'], maj7: ['major seventh', 'settima maggiore'], min7: ['minor seventh', 'settima minore'],
    },
  };

  function lookup(path) {
    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), S);
  }

  /** t('key', {n: 3}) → translated text with {placeholders} filled in. */
  OP.t = function (key, vars) {
    const entry = lookup(key);
    if (!entry) return key;
    const idx = OP.settings.lang === 'it' ? 1 : 0;
    let s = entry[idx];
    if (typeof s === 'string' && vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ''));
    return s;
  };

  /** Fill every [data-i18n] element in the page. */
  OP.applyI18n = function (root) {
    (root || document).querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = OP.t(el.dataset.i18n); });
    (root || document).querySelectorAll('[data-i18n-label]').forEach((el) => el.setAttribute('aria-label', OP.t(el.dataset.i18nLabel)));
    document.documentElement.lang = OP.settings.lang;
  };
})();
