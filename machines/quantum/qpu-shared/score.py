"""Score for Quantum (a photonic QPU after the public figures of Quandela's Belenos): a calm bed (Dmaj9 colours, 84 bpm) the whole way, a soft pop on each of
the four photon emissions, air under the dive into the chip, a high glassy blip on every detector click (they come
from clicks.json, computed by make-timeline.mjs from the film's own schedule and model), a quiet click on each button
press of the tour, a bell when the HOM delay crosses zero.

    node qpu-shared/make-timeline.mjs && python3 "$SKILL_DIR/run_sfx.py" qpu-shared/score.py
"""

import json
import os

from sfx.score_kit import airy, bed, chords, hz
from sfx.synth import blip, chime, click, pop

TIMELINE = "../qpu-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "quantum-score.wav")
TARGET_LUFS = -14.0
SEED = 23

CHORDS = chords("Dmaj9:D3 F#3 A3 C#4 E4/D2", "Bm9:B2 D3 F#3 A3 C#4/B1", "Gmaj7:G2 D3 F#3 B3/G1", "A6:A2 E3 F#3 C#4/A1")
MOTIF = [(0.5, hz("F#5")), (1.5, hz("E5")), (2.5, hz("C#5"))]
HERE = os.path.dirname(os.path.abspath(__file__))


def score(mix, tl):
    dur = tl["duration"]
    b = tl["beats"]
    left, right, low, drums = bed(dur, 84, CHORDS, MOTIF, motif_voice="blip", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.6, keys_lp=3200)
    mix.put_stereo(0, left, right, 0.11)
    mix.put(0, low, 0.1)
    mix.put(0, drums, 0.025)
    for t in b["views"]:
        mix.put(t, click(2400, 0.025), 0.05)
        mix.put(t + 0.05, airy(1.3, 600, 1500, 0.6), 0.016)
    for i, t in enumerate(b["emit"]):
        mix.put(t, pop(520 + 60 * i, 900 + 80 * i, 0.16), 0.05)
    mix.put(b["chipIn"] - 1.0, airy(3.2, 300, 2200, 0.7), 0.03)
    with open(os.path.join(HERE, "../qpu-film/clicks.json"), encoding="utf8") as f:
        clicks = json.load(f)["clicks"]
    notes = [hz("A5"), hz("C#6"), hz("E6"), hz("F#6")]
    for i, t in enumerate(clicks):
        if t < dur - 0.2:
            mix.put(t, blip(notes[i % len(notes)], 0.22, 0.07), 0.035)
    mix.put(b["click"], chime([hz("D5"), hz("F#5"), hz("A5")], 1.6, 0.6), 0.05)
    mix.put(b["homZero"], chime([hz("A4"), hz("D5"), hz("F#5")], 1.8, 0.7), 0.045)
