// Writes ../qpu-film/timeline.json (the beats, for review sheets and the score) and ../qpu-film/clicks.json (every
// detector click of the film, from the same schedule and model the film draws).   node qpu-shared/make-timeline.mjs (from machines/quantum)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {shotTimes} from './photonics.js';
import {clickTimes, DURATION, N_FILM, SCRIPT, SEGMENTS, tAtTau} from './schedule.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = shotTimes(N_FILM);
const S = T.SHOT;
const r = (x) => +x.toFixed(3);
const beats = {
  views: SCRIPT.filter((e) => e.t > 0).map((e) => e.t),
  emit: [0, 1, 2, 3].map((k) => r(tAtTau(0, S + k * 12.5))),
  chipIn: r(tAtTau(0, S + T.tArr)),
  click: r(tAtTau(0, S + T.tClick)),
  homZero: 28.1,
};
fs.writeFileSync(path.join(HERE, '../qpu-film/timeline.json'), JSON.stringify({duration: DURATION, beats}));
const segs = SEGMENTS.map((s) => [s.t0, s.mode]);
fs.writeFileSync(path.join(HERE, '../qpu-film/clicks.json'), JSON.stringify({clicks: clickTimes(), segments: segs}));
console.log(beats, clickTimes().length, 'clicks');
