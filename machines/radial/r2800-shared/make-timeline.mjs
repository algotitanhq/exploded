// Writes ../r2800-film/timeline.json (the beats, for review sheets and the score) and ../r2800-film/events.json
// (every spark of the film, lit or missed, and the engine's speed, slow motion, manifold pressure and firing rate on
// screen sampled at 100 Hz), all from the same schedule and model the film draws.
//   node r2800-shared/make-timeline.mjs   (from machines/radial)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stateAt} from './engine.js';
import {BEATS, DURATION, rateAt, rpmAt, RUN, runAtTau, SCRIPT, sparkList, tauAt, thetaAt} from './schedule.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const r = (x) => +x.toFixed(3);
// film time of a physical time (τ is monotone in t)
const tOfTau = (tau) => {
  let lo = 0;
  let hi = DURATION;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (tauAt(mid) < tau) lo = mid;
    else hi = mid;
  }
  return r((lo + hi) / 2);
};
const beats = {
  views: BEATS,
  presses: SCRIPT.filter((e) => e.press).map((e) => e.t),
  starter: tOfTau(RUN.starter),
  ignition: tOfTau(RUN.ign),
  disengage: tOfTau(RUN.disengage),
  climb: tOfTau(RUN.climb),
  full: tOfTau(RUN.climb + RUN.climbLen),
  back: tOfTau(RUN.back),
  idleAgain: tOfTau(RUN.back + RUN.backLen),
};
fs.writeFileSync(path.join(HERE, '../r2800-film/timeline.json'), JSON.stringify({duration: DURATION, beats}));
const samples = [];
for (let i = 0; i <= DURATION * 100; i++) {
  const t = i / 100;
  const N = rpmAt(t);
  const tau = tauAt(t);
  const s = stateAt(N, runAtTau(tau));
  const rate = rateAt(t);
  samples.push([r(N), r(rate), r(s.map), r(s.fireHz * rate * runAtTau(tau)), r(thetaAt(t))]);
}
const sparks = sparkList();
fs.writeFileSync(path.join(HERE, '../r2800-film/events.json'), JSON.stringify({rate: 100, fields: ['rpm', 'slow', 'map', 'fireHzScreen', 'theta'], samples, sparks}));
console.log(beats, sparks.length, 'sparks', sparks.filter((s) => s[2]).length, 'lit');
