#!/usr/bin/env python3
"""Build js/hanon.js: Hanon's The Virtuoso Pianist, Part 1, Nos. 1-20.

Reads the Mutopia Project's LilyPond engraving (public domain music, notes and
fingering as in the original), finds each hand's repeating 8-note figure going
up and coming down, keeps one octave each way and writes compact figure data.

    python3 tools/build-hanon.py [path/to/virtuoso-pianist-pt1-lys]

Without a path it downloads the sources from mutopiaproject.org.
"""
import io, json, os, re, sys, urllib.request, zipfile, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://www.mutopiaproject.org/ftp/HanonCL/virtuoso-pianist-pt1/virtuoso-pianist-pt1-lys.zip'
DIR = None


def fetch(path):
    global DIR
    if not path:
        tmp = tempfile.mkdtemp(prefix='hanon-')
        with urllib.request.urlopen(URL) as r:
            zipfile.ZipFile(io.BytesIO(r.read())).extractall(tmp)
        path = os.path.join(tmp, 'virtuoso-pianist-pt1-lys')
    DIR = path
    return path



LET = 'cdefgab'
NOTE = re.compile(r"([a-g])((?:isis|eses|is|es)?)([',]*)(\d*)(\.*)((?:\s*[-_^]\d)*)")


def blocks(src):
    """{'RH': body, 'LH': body} with the \\relative reference pitch."""
    out = {}
    for m in re.finditer(r"(RH|LH)\s*=\s*(?:\\relative\s+([a-g][',]*)\s*)?\{", src):
        i, depth = m.end(), 1
        j = i
        while depth:
            if src[j] == '{': depth += 1
            elif src[j] == '}': depth -= 1
            j += 1
        out[m.group(1)] = (m.group(2), src[i:j - 1])
    return out


def strip(body):
    body = re.sub(r'%[^\n]*', '', body)
    body = re.sub(r'\\bar\s*"\|\|"', ' || ', body)
    body = re.sub(r'\\bar\s*"[^"]*"', ' ', body)
    # <e c'>2 (a real chord) -> e2 & c'2
    body = re.sub(r"<\s*([a-g][^<>]*?\s[a-g][^<>]*?)\s*>(\d*\.*)", lambda m: ' & '.join(n + m.group(2) for n in m.group(1).split()), body)
    # < c, _5 >16  ->  c,16_5   (single notes written as chords to place the finger)
    body = re.sub(r"<\s*([a-g](?:isis|eses|is|es)?[',]*)\s*([-_^]\d)?\s*>(\d*\.*)", lambda m: m.group(1) + m.group(3) + (m.group(2) or ''), body)
    # c 16-1  ->  c16-1
    body = re.sub(r"(?<![A-Za-z])([a-g](?:isis|eses|is|es)?[',]*)\s+(\d+\.*)", r"\1\2", body)
    body = re.sub(r'\\markup\s*\\?\w*\s*\{[^{}]*\}', ' ', body)          # \markup{...}
    body = re.sub(r'\\markup\s*\{[^{}]*(\{[^{}]*\}[^{}]*)*\}', ' ', body)
    body = re.sub(r'[\^_-]?"[^"]*"', ' ', body)                         # strings
    body = re.sub(r'\\[A-Za-z]+', ' ', body)                            # other commands
    body = re.sub(r'[\^_]\s*(?=\s)', ' ', body)
    return body


def parse(ref, body):
    body = strip(body)
    # reference pitch: lilypond c = C3 (step 21)
    absolute = ref is None
    prev = 21 if absolute else 21 + LET.index(ref[0]) + 7 * (ref.count("'") - ref.count(','))
    notes, dur, barmark = [], 16, []
    chord = False
    for tok in re.finditer(r"&|\|\||\||" + NOTE.pattern, body):
        if tok.group(0) == '&':
            chord = True
            continue
        if tok.group(0) in ('|', '||'):
            barmark.append(len(notes))
            continue
        letter, acc, octs, d, dots, fing = tok.group(1, 2, 3, 4, 5, 6)
        # Skip things that are not notes (letters inside leftover words).
        s = tok.start()
        if s > 0 and body[s - 1].isalpha():
            continue
        li = LET.index(letter)
        if absolute:
            step = 21 + li + 7 * (octs.count("'") - octs.count(','))
        else:
            base = prev - ((prev % 7) - li)
            # choose the octave closest to prev (within a fourth)
            cands = [base - 7, base, base + 7]
            step = min(cands, key=lambda c: abs(c - prev))
            step += 7 * (octs.count("'") - octs.count(','))
        prev = step
        if d:
            dur = 16 // int(d) if int(d) <= 16 else 1
            if dots: dur = dur * 3 // 2
        a = {'': 0, 'is': 1, 'es': -1, 'isis': 2, 'eses': -2}[acc]
        f = re.findall(r'\d', fing)
        notes.append({'step': step, 'acc': a, 'dur': dur, 'f': int(f[0]) if f else None, 'chord': chord})
        chord = False
    return notes, barmark


def load(n):
    src = open(os.path.join(DIR, 'hanon%02d.ily' % n)).read()
    b = blocks(src)
    res = {}
    for hand in ('RH', 'LH'):
        ref, body = b[hand]
        res[hand] = parse(ref, body)
    return res


def analyse(n):
    r = load(n)
    out = {}
    for hand in ('RH', 'LH'):
        notes, bars = r[hand]
        body, last = notes[:-1], notes[-1]
        mid = [b for b in bars if 0 < b < len(notes) - 1]
        half = mid[0] if mid else len(body) // 2
        up, down = body[:half], body[half:]
        # figure length: smallest F so that up is a sequence of shifted copies
        res = None
        for F in range(2, 33):
            if len(up) % F or len(down) % F: continue
            def shape(seq):
                gs = [seq[i:i + F] for i in range(0, len(seq), F)]
                sh = [tuple(x['step'] - g[0]['step'] for x in g) for g in gs]
                starts = [g[0]['step'] for g in gs]
                durs = [tuple(x['dur'] for x in g) for g in gs]
                ok = len(set(sh)) == 1 and len(set(durs)) == 1 and all(b - a == starts[1] - starts[0] for a, b in zip(starts, starts[1:]))
                return ok, sh[0], starts, durs[0], gs
            a, b = shape(up), shape(down)
            if a[0] and b[0]:
                fing = lambda gs: [next((g[i]['f'] for g in gs if g[i]['f']), None) for i in range(F)]
                res = {'F': F, 'up': a[1], 'upStarts': a[2], 'down': b[1], 'downStarts': b[2], 'durs': a[3],
                       'fUp': fing(a[4]), 'fDown': fing(b[4]), 'last': last, 'accs': sum(1 for x in notes if x['acc'])}
                break
        out[hand] = res
    return out



def infer(steps, fingers, hand):
    """Fill missing fingers from the nearest marked note of the same figure (no thumb crossings inside a figure)."""
    out = list(fingers)
    for k, f in enumerate(fingers):
        if f: continue
        best = None
        for j in sorted(range(len(steps)), key=lambda j: (abs(j - k), j > k)):
            if fingers[j]:
                d = steps[k] - steps[j]
                g = fingers[j] + d if hand == 'RH' else fingers[j] - d
                if 1 <= g <= 5: best = g
                break
        out[k] = best
    return out


def section(groups, direction, hand):
    """groups: list of note lists (F notes each). The middle ones repeat one shape, each starting
    a step further; the first and last figure may differ (a lead-in or the turn at the top)."""
    shape = lambda g: tuple(x['step'] - g[0]['step'] for x in g)
    ref = groups[1]
    s0 = shape(ref)
    def regular(i):
        return shape(groups[i]) == s0 and groups[i][0]['step'] - ref[0]['step'] == direction * (i - 1)
    for i in range(1, len(groups) - 1):
        assert regular(i), ('irregular group', i)
    regs = [g for i, g in enumerate(groups) if regular(i)]
    fr = [next((g[i]['f'] for g in regs if g[i]['f']), None) for i in range(len(s0))]
    fr = infer(list(s0), fr, hand)
    special = {}
    for i in (0, len(groups) - 1):
        if not regular(i):
            g = groups[i]
            special[i] = {'o': [x['step'] - g[0]['step'] for x in g], 'f': infer([x['step'] for x in g], [x['f'] for x in g], hand)}
    base = ref[0]['step'] - direction  # where figure 0 would start if it were regular
    return {'o': list(s0), 'f': fr, 'base': base}, special.get(0), special.get(len(groups) - 1)


def one_octave(n, hand):
    notes, bars = load(n)[hand]
    split = [b for b in bars if 0 < b < len(notes) - 1][0]
    end = [x for x in notes[split:] if x['dur'] > 1]
    body_down = notes[split:len(notes) - len(end)]
    up, down = notes[:split], body_down
    assert all(x['dur'] == 1 and x['acc'] == 0 and not x['chord'] for x in up + down), (n, hand, 'durations/accidentals')
    F = 8
    assert len(up) % F == 0 and len(down) % F == 0, (n, hand, len(up), len(down))
    ug = [up[i:i + F] for i in range(0, len(up), F)]
    dg = [down[i:i + F] for i in range(0, len(down), F)]
    U, D = len(ug), len(dg)
    upReg, upFirst, upLast = section(ug, +1, hand)
    dnReg, dnFirst, dnLast = section(dg, -1, hand)
    # Keep the first octave going up and the top transition figure; the top octave
    # coming down and the closing figure. Shift so the right hand starts near middle C.
    keepUp = list(range(0, U - 8)) + [U - 1]
    keepDn = list(range(0, D - 8)) + [D - 1]
    shiftUp = lambda i: 7 if i < U - 1 else 0
    shiftDn = lambda i: 0 if i < D - 1 else 7
    expanded = []
    for i in keepUp: expanded += [(x['step'] + shiftUp(i)) for x in ug[i]]
    for i in keepDn: expanded += [(x['step'] + shiftDn(i)) for x in dg[i]]
    fEnd = infer([x['step'] for x in [dg[-1][-1]] + end], [dg[-1][-1]['f'] or (dnLast or dnReg)['f'][-1]] + [x['f'] for x in end], hand)[1:]
    data = {
        'up': {'s': upReg['base'] + 7, 'o': upReg['o'], 'f': upReg['f']}, 'nUp': len(keepUp),
        'upFirst': dict(upFirst, s=ug[0][0]['step'] + 7) if upFirst else None,
        'upLast': dict(upLast, s=ug[-1][0]['step']) if upLast else None,
        'down': {'s': dnReg['base'], 'o': dnReg['o'], 'f': dnReg['f']}, 'nDown': len(keepDn),
        'downFirst': dict(dnFirst, s=dg[0][0]['step']) if dnFirst else None,
        'downLast': dict(dnLast, s=dg[-1][0]['step'] + 7) if dnLast else None,
        'end': [{'s': x['step'] + 7, 'f': f} for x, f in zip(end, fEnd)],
    }
    expanded += [x['step'] + 7 for x in end]
    return data, expanded, (U, D)


def expand(d):
    """Same expansion as js/songs.js, to check the data."""
    out = []
    for i in range(d['nUp']):
        g = d['upLast'] if (i == d['nUp'] - 1 and d['upLast']) else d['upFirst'] if (i == 0 and d['upFirst']) else dict(d['up'], s=d['up']['s'] + i)
        out += [g['s'] + o for o in g['o']]
    for i in range(d['nDown']):
        g = d['downLast'] if (i == d['nDown'] - 1 and d['downLast']) else d['downFirst'] if (i == 0 and d['downFirst']) else dict(d['down'], s=d['down']['s'] - i)
        out += [g['s'] + o for o in g['o']]
    return out + [e['s'] for e in d['end']]


if __name__ == '__main__':
    DIR = fetch(sys.argv[1] if len(sys.argv) > 1 else None)
    out = os.path.join(ROOT, 'js', 'hanon.js')
    allData = []
    for n in range(1, 21):
        ex = {'n': n}
        for hand in ('RH', 'LH'):
            data, flat, ud = one_octave(n, hand)
            assert expand(data) == flat, (n, hand)
            ex[hand.lower()] = data
            fs = lambda f: ''.join(str(x) if x else '.' for x in f)
            print(n, hand, 'orig groups', ud, 'kept', data['nUp'], data['nDown'], 'range', min(flat), max(flat),
                  'fUp', fs(data['up']['f']), 'fDn', fs(data['down']['f']),
                  'first', ('U' if data['upFirst'] else '') + ('D' if data['downFirst'] else ''),
                  'upLast', fs(data['upLast']['f']) if data['upLast'] else '-', 'dnLast', fs(data['downLast']['f']) if data['downLast'] else '-',
                  'end', [(e['s'], e['f']) for e in data['end']])
        allData.append(ex)
    if True:
        lines = []
        for ex in allData:
            lines.append('    { n: %d,\n      rh: %s,\n      lh: %s },' % (ex['n'], json.dumps(ex['rh'], separators=(',', ':')), json.dumps(ex['lh'], separators=(',', ':'))))
        js = '''/* Hanon, The Virtuoso Pianist, Part 1 (1873), Nos. 1-20: generated by
 * tools/build-hanon.py from the Mutopia Project's LilyPond engraving. Do not edit.
 *
 * Each hand: figures of 8 sixteenth notes. "up" repeats one figure, a step higher
 * each time; "down" does the same going down. upFirst/upLast/downFirst/downLast are
 * figures that differ from the pattern (a lead-in, or the turn at the top). Shortened
 * to one octave up and one down. s = start note as a diatonic step (C4 = 28),
 * o = offsets in steps, f = fingers (null where the edition gives none).
 */
(function () {
  'use strict';
  const OP = (window.OP = window.OP || {});
  OP.hanonData = [
''' + '\n'.join(lines) + '''
  ];
})();
'''
        open(out, 'w').write(js)
        print('wrote', out)
