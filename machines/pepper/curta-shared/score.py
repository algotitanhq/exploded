"""Score for Pepper (a Curta Type I after the public sources): mechanical, dry, precise. A ratchet tick at every tooth
of the crank's anti-reverse ratchet and a firmer detent when the crank comes home, a small click at every carry (the
cascade of the subtraction is a burst of them, one per column), the counter's step, a detent per digit as a slider
moves, the carriage's lift, notch and drop, a soft friction under the clearing ring. No continuous music: a single
plucked music-box note on the strong beats, all in D major. Every time comes from sounds.json and timeline.json,
written by make-timeline.mjs from the same plan the film draws.

    node curta-shared/make-timeline.mjs && python3 "$SKILL_DIR/run_sfx.py" curta-shared/score.py
"""

import json
import math
import os
import random

from sfx.score_kit import hz, thud
from sfx.synth import SR, bandnoise, click

TIMELINE = "../curta-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "pepper-score.wav")
TARGET_LUFS = -14.0
SEED = 1948
HERE = os.path.dirname(os.path.abspath(__file__))


def tick(freq, dur=0.03, body=0.0, body_f=420, decay=0.004):
    """a short metal tick: a damped partial and a burst of noise, with an optional low body"""
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        s = math.sin(2 * math.pi * freq * t) * math.exp(-t / decay)
        s += math.sin(2 * math.pi * freq * 1.47 * t) * math.exp(-t / (decay * 0.6)) * 0.4
        s += random.uniform(-1, 1) * math.exp(-t / 0.0009) * 0.7
        if body:
            s += body * math.sin(2 * math.pi * body_f * t) * math.exp(-t / 0.012)
        out.append(s)
    return out


def pluck(freq, dur=1.6):
    """a music-box tine: a bright attack, inharmonic partials that die fast, a clean fundamental"""
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        a = min(1, t / 0.002)
        s = math.sin(2 * math.pi * freq * t) * math.exp(-t / 0.55)
        s += 0.35 * math.sin(2 * math.pi * freq * 3.01 * t) * math.exp(-t / 0.12)
        s += 0.18 * math.sin(2 * math.pi * freq * 5.4 * t) * math.exp(-t / 0.05)
        out.append(a * s)
    return out


def friction(dur, level=1.0):
    """the clearing ring sliding: low band noise with a slow swell"""
    n = int(dur * SR)
    x = bandnoise(n, lambda k: 900 + 500 * math.sin(k / SR * 7.0), q=0.7)
    return [x[k] * level * math.sin(math.pi * min(1.0, k / n)) ** 0.6 for k in range(n)]


def score(mix, tl):
    dur = tl["duration"]
    b = tl["beats"]
    with open(os.path.join(HERE, "../curta-film/sounds.json"), encoding="utf8") as f:
        ev = json.load(f)
    rnd = random.Random(SEED)
    # the crank's ratchet and its home detent
    for t in ev["ratchet"]:
        mix.put(t, tick(rnd.uniform(5200, 5800), 0.018, decay=0.0025), 0.05, rnd.uniform(-0.15, 0.15))
    for t in ev["home"]:
        mix.put(t, tick(2600, 0.05, body=0.6, body_f=310, decay=0.004), 0.12)
    # carries: one dry click each, a little higher up the columns
    for c in ev["carry"]:
        mix.put(c["t"], tick(3400 + 180 * c["col"], 0.03, body=0.25, body_f=900, decay=0.003), 0.13, -0.3 + 0.06 * c["col"])
    for t in ev["overflow"]:
        mix.put(t, tick(6400, 0.03, decay=0.002), 0.06, 0.4)
    for t in ev["counter"]:
        mix.put(t, tick(3000, 0.03, body=0.3, body_f=600), 0.06, 0.2)
    # sliders: a soft detent per digit
    for t in ev["slide"]:
        mix.put(t, tick(rnd.uniform(4200, 4600), 0.02, decay=0.002), 0.07, -0.25)
    # carriage: lift, notch, drop
    for t in ev["carriageLift"]:
        mix.put(t, tick(1900, 0.06, body=0.5, body_f=240, decay=0.006), 0.08)
    for t in ev["carriageNotch"]:
        mix.put(t, tick(2300, 0.05, body=0.7, body_f=280, decay=0.005), 0.12)
    for t in ev["carriageDrop"]:
        mix.put(t, thud(160, 0.05, 0.25), 0.14)
        mix.put(t, tick(2800, 0.04, decay=0.004), 0.07)
    for t in ev["crank"]:
        mix.put(t, tick(2100, 0.05, body=0.6, body_f=260, decay=0.005), 0.1)
    for t0, t1 in ev["ring"]:
        mix.put(t0, friction(t1 - t0, 1.0), 0.05)
    # one plucked note on the strong beats, D major
    notes = {"firstTooth": "A5", "turnsEnd": "D6", "carriage": "F#5", "subStart": "B5", "cascade": "E6", "clear": "A5"}
    for k, n in notes.items():
        mix.put(b[k], pluck(hz(n)), 0.06)
    # the result: two notes, the fifth then the octave
    mix.put(b["end"] - 1.6, pluck(hz("A5")), 0.06)
    mix.put(b["end"] - 1.2, pluck(hz("D6")), 0.065)
    _ = dur
