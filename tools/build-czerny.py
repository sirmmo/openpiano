#!/usr/bin/env python3
"""Build js/czerny.js: Czerny pieces engraved by the Mutopia Project (public domain).

  Op. 840  50 Melodische Übungsstücke, Nos. 1-10   (melodic studies)
  Op. 821  160 Eight-Measure Exercises, Nos. 1-19  (short technical studies)

Notes and timing come from Mutopia's MIDI files (upper staff = right hand,
lower staff = left hand); the pickup bar and the tempo word come from the
LilyPond source. Mutopia has no machine-readable fingering for these, so the
pieces have none.

    python3 tools/build-czerny.py [cache-dir]
"""
import io, json, os, re, struct, sys, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://www.mutopiaproject.org/ftp/CzernyC/'
RES = 96  # time grid: 1/96 of a beat
TEMPO_WORDS = r'(?:Allegro|Allegretto|Andante|Andantino|Moderato|Adagio|Vivace|Presto|Larghetto|Lento|Tempo di [A-Za-z]+|Scherzando|Grazioso|Con moto)[^"]*'


def get(url, cache):
    path = os.path.join(cache, url.rsplit('/', 1)[1])
    if not os.path.exists(path):
        with urllib.request.urlopen(url) as r:
            open(path, 'wb').write(r.read())
    return open(path, 'rb').read()


def vlq(b, i):
    v = 0
    while True:
        c = b[i]; i += 1; v = (v << 7) | (c & 0x7f)
        if not c & 0x80: return v, i


def read_midi(b):
    assert b[:4] == b'MThd'
    _, ntr, div = struct.unpack('>HHH', b[8:14])
    i, tracks, tempos, meters, keys = 14, [], [], [], []
    for _ in range(ntr):
        assert b[i:i + 4] == b'MTrk'
        ln = struct.unpack('>I', b[i + 4:i + 8])[0]
        j, end, i = i + 8, i + 8 + ln, i + 8 + ln
        t, run, name, on, notes = 0, None, '', {}, []
        while j < end:
            d, j = vlq(b, j); t += d
            st = b[j]
            if st == 0xff:
                typ = b[j + 1]; l2, k = vlq(b, j + 2); data = b[k:k + l2]; j = k + l2
                if typ == 3: name = data.decode('latin1')
                if typ == 0x51: tempos.append((t, 60000000 / int.from_bytes(data, 'big')))
                if typ == 0x58: meters.append((t, data[0], 2 ** data[1]))
                if typ == 0x59: keys.append((t, struct.unpack('b', data[:1])[0]))
                continue
            if st in (0xf0, 0xf7):
                l2, k = vlq(b, j + 1); j = k + l2; continue
            if st & 0x80: run = st; j += 1
            typ = run & 0xf0
            if typ in (0xc0, 0xd0): j += 1; continue
            a, v = b[j], b[j + 1]; j += 2
            if typ == 0x90 and v: on.setdefault(a, []).append(t)
            elif typ in (0x80, 0x90) and on.get(a):
                s = on[a].pop(0); notes.append((s, t - s, a))
        if notes: tracks.append({'name': name, 'notes': sorted(notes)})
    return div, tracks, tempos, meters, keys


def fix_start(tracks, div):
    """A grace note at the very start makes LilyPond's MIDI shift the rest of that staff
    late by the grace's length. Shift back and drop the opening grace."""
    grid = div // 12
    lead = 0
    for tr in tracks:
        t = 0
        for s, d, a in tr['notes']:
            if abs(s - t) <= 2 and d <= div * 0.13: t = s + d
            elif s > t or d > div * 0.13: break
        lead = max(lead, t)
    if not lead or lead % grid == 0:
        return 0
    for tr in tracks:
        late = sum(1 for s, d, a in tr['notes'] if s % grid == lead % grid)
        if late * 2 > len(tr['notes']):
            tr['notes'] = [(s - lead, d, a) for s, d, a in tr['notes'] if s - lead >= 0]
    return lead


def fix_graces(notes, div):
    """LilyPond's MIDI plays grace notes on the beat and delays the main note. Put the
    main note back on the beat and the grace notes just before it."""
    grid = div // 12  # sixteenths and triplets fall on this grid
    short = div * 0.13
    notes = [list(n) for n in sorted(notes)]
    moved = 0
    for b in notes:
        if b[0] % grid == 0:
            continue
        run, t = [], b[0]
        while True:
            prev = [a for a in notes if a is not b and a not in run and a[1] <= short and abs(a[0] + a[1] - t) <= 2]
            if not prev: break
            run.insert(0, prev[0]); t = prev[0][0]
            if t % grid == 0: break
        if run and t % grid and t % grid <= 2: t -= t % grid  # rounding in the MIDI file
        if not run or t % grid: continue
        length = b[0] - t
        # Give each grace note a playable length (a sixteenth of a beat at least) and
        # line them up so the last one ends exactly on the beat.
        for a in run: a[1] = max(a[1], div // 16)
        start = t - sum(a[1] for a in run)
        if start < 0: continue  # a grace at the very start: leave it
        for a in run: a[0] = start; start += a[1]
        b[1] += length; b[0] = t
        moved += 1
    return [tuple(n) for n in sorted(notes)], moved


def q(ticks, div):
    return int(round(ticks * RES / div))


def piece(op, no, mid, ly):
    div, tracks, tempos, meters, keys = read_midi(mid)
    assert len(tracks) == 2, (op, no, [t['name'] for t in tracks])
    up, low = tracks
    fix_start(tracks, div)
    fixed = 0
    for tr in tracks:
        tr['notes'], k = fix_graces(tr['notes'], div)
        fixed += k
    offgrid = sum(1 for tr in tracks for s, d, a in tr['notes'] if s % (div // 12) and d > div * 0.13)  # main notes off the beat grid
    assert re.search(r'upper|discant', up['name'], re.I) and re.search(r'lower|bass|tenor', low['name'], re.I), (op, no, up['name'], low['name'])
    m = re.search(r'\\partial\s+(\d+)(\.?)', ly)
    pickup = (4 / int(m.group(1))) * (1.5 if m.group(2) else 1) if m else 0
    w = re.search('"(' + TEMPO_WORDS + ')"', ly)
    word = (w.group(1).strip().rstrip('.') if w else '').replace('expresivo', 'espressivo')

    def enc(notes):
        out, last = [], 0
        for s, d, a in notes:
            s2 = q(s, div)
            out += [s2 - last, max(RES // 16, q(d, div)), a]  # ornaments: at least 1/16 of a beat
            last = s2
        return out
    # Spell with flats when the piece spends most of its time in flat keys.
    total = max(s + d for t in tracks for s, d, a in t['notes'])
    ks = sorted(set(keys)) or [(0, 0)]
    if ks[0][0] > 0: ks = [(0, 0)] + ks
    flat_time = sum((ks[i + 1][0] if i + 1 < len(ks) else total) - ks[i][0] for i in range(len(ks)) if ks[i][1] < 0)
    return {
        'graces': fixed, 'offgrid': offgrid,
        'op': op, 'no': no, 'tempo': word, 'pickup': pickup, 'flat': flat_time * 2 > total,
        'keys': [[q(t, div), sf] for i, (t, sf) in enumerate(ks) if i == 0 or sf != ks[i - 1][1]],
        'tempos': [[q(t, div), round(b, 1)] for t, b in sorted(set(tempos))],
        'meters': [[q(t, div), n, d] for t, n, d in sorted(set(meters))],
        'rh': enc(up['notes']), 'lh': enc(low['notes']),
    }


def main():
    cache = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '.cache', 'czerny')
    os.makedirs(cache, exist_ok=True)
    out = []
    for no in range(1, 11):
        d = BASE + 'O840/op840-%d/' % no
        mid = get(d + 'op840-%d.mid' % no, cache)
        z = zipfile.ZipFile(io.BytesIO(get(d + 'op840-%d-lys.zip' % no, cache)))
        ly = '\n'.join(z.read(n).decode('utf8', 'replace') for n in z.namelist() if re.search(r'etude-\d+\.ily$', n))
        out.append(piece(840, no, mid, ly))
    for no in range(1, 20):
        d = BASE + 'Op_821/Czerny_Op_821_No_%03d/' % no
        mid = get(d + 'Czerny_Op_821_No_%03d.mid' % no, cache)
        ly = get(d + 'Czerny_Op_821_No_%03d.ly' % no, cache).decode('utf8', 'replace')
        out.append(piece(821, no, mid, ly))
    for p in out:
        print('Op. %d No. %d' % (p['op'], p['no']), 'graces moved', p.pop('graces'), 'main notes off the grid', p.pop('offgrid'), p['tempo'] or '-', 'pickup', p['pickup'], 'flat', p['flat'],
              'tempos', p['tempos'][:2], 'meters', p['meters'], 'notes', len(p['rh']) // 3, len(p['lh']) // 3)
    lines = ',\n'.join('    ' + json.dumps(p, separators=(',', ':'), ensure_ascii=False) for p in out)
    js = '''/* Czerny, from the Mutopia Project's engravings (public domain): Op. 840 Nos. 1-10
 * and Op. 821 Nos. 1-19. Generated by tools/build-czerny.py; do not edit.
 * Times are in 1/96 of a beat. rh/lh: [start delta, duration, MIDI note] per note.
 * keys: [time, sharps (> 0) or flats (< 0)] at each key change. */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});
  OP.czernyData = [
''' + lines + '''
  ];
})();
'''
    path = os.path.join(ROOT, 'js', 'czerny.js')
    open(path, 'w', encoding='utf8').write(js)
    print('wrote', path, len(js), 'bytes')


if __name__ == '__main__':
    main()
