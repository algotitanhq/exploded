"""Score for Radial (an R-2800 Double Wasp after public sources), every sound on the film's own timeline.

The starter whines up and settles on A4 (the one key, D minor, that every tonal sound keeps: the starter, the low
drone, the click); the first sparks after the magnetos come on are coughs, the missed ones silent (events.json lists
every spark, lit or not, from the same schedule the film draws). Once the engine runs, each firing is a dull thud
while they come slower than ~12 a second on screen (the slow-motion stretches); faster, they merge into a growl
whose pulse is the firing rate on screen, 9 a turn, with the half- and first-order beats under it. The propeller's
wash rises with its speed. A quiet click on each button the tour's cursor presses.

    node r2800-shared/make-timeline.mjs && python3 "$SKILL_DIR/run_sfx.py" r2800-shared/score.py
"""

import json
import math
import os
import random

from sfx.dsp import svf, zeros
from sfx.score_kit import airy, bang, hz, thud
from sfx.synth import SR, bandnoise, click

TIMELINE = "../r2800-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "radial-score.wav")
TARGET_LUFS = -14.0
SEED = 2800
HERE = os.path.dirname(os.path.abspath(__file__))


def smooth(a, b, x):
    u = min(1.0, max(0.0, (x - a) / (b - a)))
    return u * u * (3 - 2 * u)


def score(mix, tl):
    dur = tl["duration"]
    b = tl["beats"]
    with open(os.path.join(HERE, "../r2800-film/events.json"), encoding="utf8") as f:
        ev = json.load(f)
    rate = ev["rate"]
    S = ev["samples"]  # rpm, slow, map, fireHzScreen, theta
    n = int(dur * SR)

    def at(t, i):
        x = min(len(S) - 1.001, max(0.0, t * rate))
        k = int(x)
        return S[k][i] + (S[k + 1][i] - S[k][i]) * (x - k)

    # ---------------------------------------------------------------- the low drone: D, very quiet, the whole way
    drone = zeros(n)
    f0 = hz("D2")
    for k in range(n):
        t = k / SR
        env = min(1.0, t / 2.0, (dur - t) / 2.5)
        drone[k] = env * (math.sin(2 * math.pi * f0 * t) + 0.5 * math.sin(2 * math.pi * f0 * 1.5 * t + 0.4 * math.sin(0.3 * t)) + 0.3 * math.sin(2 * math.pi * f0 * 2 * t))
    drone = svf(drone, 500, 0.6, "lp")
    mix.put(0, drone, 0.05)

    # ---------------------------------------------------------------- the starter: a whine up to A4, then it lets go
    t0 = b["starter"]
    t1 = b["disengage"]
    m = int((t1 - t0 + 0.6) * SR)
    whine = []
    ph = 0.0
    for k in range(m):
        t = t0 + k / SR
        spin = smooth(t0, t0 + 1.0, t) if t < t1 else max(0.0, 1 - (t - t1) / 0.6)
        f = hz("A4") * (0.25 + 0.75 * spin)
        ph += 2 * math.pi * f / SR
        g = spin * (1 if t < t1 else 0.8)
        whine.append(g * (math.sin(ph) * 0.6 + 0.25 * math.sin(2 * ph) + 0.12 * math.sin(3 * ph)))
    mix.put(t0, svf(whine, 2400, 0.7, "lp"), 0.06)
    mix.put(t0, airy(t1 - t0 + 0.4, 300, 900, 0.5), 0.02)

    # ---------------------------------------------------------------- sparks: coughs while it catches, thuds in slow motion
    rnd = random.Random(SEED)
    catch_end = b["disengage"] + 0.6
    for t, c, lit in ev["sparks"]:
        if t >= dur - 0.05:
            continue
        fire = at(t, 3)
        if t < catch_end:
            if lit:
                mix.put(t, bang(0.5 + 0.5 * rnd.random(), seed=int(t * 1000)), 0.11 * (0.6 + 0.4 * rnd.random()), rnd.uniform(-0.25, 0.25))
            continue
        g = 1 - smooth(8, 18, fire)
        if g > 0.01:
            mix.put(t, thud(54 + 6 * (c % 3), 0.07, 0.32), 0.16 * g, 0.12 if c % 2 else -0.12)

    # ---------------------------------------------------------------- the growl: the firings merged, pulse = their rate on screen
    growl = zeros(n)
    ph = 0.0
    phc = 0.0
    for k in range(n):
        t = k / SR
        fire = at(t, 3)
        level = smooth(10, 30, fire)
        if fire <= 0.5:
            continue
        ph += 2 * math.pi * fire / SR
        phc += 2 * math.pi * fire / 9 / SR
        # a pulse train at the firing rate, the first and half orders under it (rows and rods not quite alike)
        p = math.sin(ph) + 0.5 * math.sin(2 * ph) + 0.25 * math.sin(3 * ph)
        p *= 0.75 + 0.25 * math.sin(phc) + 0.12 * math.sin(phc / 2)
        sub = math.sin(phc) * 0.6 + math.sin(phc / 2) * 0.35
        growl[k] = level * (math.tanh(1.4 * p) * 0.7 + sub)
    growl = svf(growl, 900, 0.7, "lp")
    mix.put(0, growl, 0.11)
    # the exhaust's grit over it: band noise opening with the rpm
    grit = bandnoise(n, lambda k: 300 + 1.1 * at(k / SR, 0) * at(k / SR, 1), q=0.6)
    for k in range(n):
        t = k / SR
        grit[k] *= smooth(10, 30, at(t, 3)) * (0.3 + 0.7 * min(1.0, at(t, 0) / 2700))
    mix.put(0, grit, 0.05)

    # ---------------------------------------------------------------- the propeller's wash: air, rising with its speed, blade-pass beat
    wash = bandnoise(n, lambda k: 700 + 500 * min(1.0, at(k / SR, 0) / 2700), q=0.5)
    php = 0.0
    for k in range(n):
        t = k / SR
        N = at(t, 0) * at(t, 1)
        bpf = 3 * N * 0.45 / 60
        php += 2 * math.pi * bpf / SR
        lvl = (min(1.0, N / 2700)) ** 2
        wash[k] *= lvl * (0.8 + 0.2 * math.sin(php))
    mix.put(0, wash, 0.09)

    # ---------------------------------------------------------------- the cursor's clicks
    for t in b["views"]:
        mix.put(t, click(2200, 0.03), 0.05)
