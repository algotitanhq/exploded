"""Score for Rope (the Apollo Guidance Computer, after public sources): the AGC itself makes no sound, so there is no
hum. A very low, dry bed in D the whole way; a dry click on every DSKY key press (from sfx.json, computed by
make-timeline.mjs from the Executive's log); Quindar tones at the start (2,525 Hz) and end (2,475 Hz) of each radio
exchange; the master alarm tone at the first 1202 (a square wave alternating 750 and 2,000 Hz, after the Apollo
Operations Handbook's caution-and-warning description), shorter for the alarms of the fast forward; a soft tick
on each button the operator presses; a low thud at contact.

    node agc-shared/make-timeline.mjs && python3 "$SKILL_DIR/run_sfx.py" agc-shared/score.py
"""

import json
import math
import os

from sfx.score_kit import beep, hiss, hz, thud
from sfx.synth import SR, click, pad

TIMELINE = "../agc-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "rope-score.wav")
TARGET_LUFS = -14.0
SEED = 1969
HERE = os.path.dirname(os.path.abspath(__file__))


def square_alarm(dur, f_a=750.0, f_b=2000.0, rate=2.5, level=1.0):
    """The master alarm: a soft-edged square wave switching between two pitches `rate` times a second."""
    n = int(dur * SR)
    out = []
    ph = 0.0
    for k in range(n):
        t = k / SR
        f = f_a if int(t * rate * 2) % 2 == 0 else f_b
        ph += 2 * math.pi * f / SR
        s = math.tanh(3.0 * math.sin(ph)) * 0.6
        env = min(1.0, t / 0.01, (dur - t) / 0.04)
        out.append(level * s * env)
    return out


def score(mix, tl):
    dur = tl["duration"]
    b = tl["beats"]
    with open(os.path.join(HERE, "../agc-film/sfx.json"), encoding="utf8") as f:
        fx = json.load(f)
    # the bed: one key, D, low and dry (no tremolo, no drums)
    chords = [(0.0, [hz("D2"), hz("A2"), hz("D3")]), (12.0, [hz("D2"), hz("A2"), hz("E3")]), (24.0, [hz("D2"), hz("A2"), hz("D3")]), (33.0, [hz("D2"), hz("A2"), hz("F#3")])]
    left, right = pad(dur, chords, detune=0.25, tremolo=0.0, xfade=1.2)
    mix.put_stereo(0, left, right, 0.05)
    # the operator's buttons
    for t in b["views"]:
        mix.put(t, click(2200, 0.022), 0.04)
    # the DSKY keys: a dry mechanical click
    for i, t in enumerate(fx["keys"]):
        mix.put(t, click(1300 + 60 * (i % 3), 0.03), 0.16, pan=0.25)
        mix.put(t + 0.004, click(4200, 0.01), 0.05, pan=0.25)
    # Quindar tones round each radio exchange, with a little band noise under the open channel
    q = fx["quindar"]
    for t0, t1 in fx["calls"]:
        mix.put(t0, beep(q["intro"], q["ms"] / 1000, 1.0), 0.05)
        mix.put(t0 + 0.25, hiss(max(0.1, t1 - t0 - 0.25), 2600, 1.0), 0.006)
        mix.put(t1, beep(q["outro"], q["ms"] / 1000, 1.0), 0.05)
    # the alarms: the first in full, the fast-forward ones as short bursts
    for i, a in enumerate(fx["alarms"]):
        if a["t"] >= dur - 0.2:
            continue
        if i == 0:
            mix.put(a["t"], square_alarm(1.6), 0.05)
        elif all(abs(a["t"] - x["t"]) > 0.35 for x in fx["alarms"][:i]):
            mix.put(a["t"], square_alarm(0.4), 0.03)
    # contact
    mix.put(b["contact"], thud(70, 0.25, 0.8), 0.22)
