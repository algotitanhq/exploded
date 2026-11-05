// Writes ../agc-film/timeline.json (the film's beats, for review sheets and the score) and ../agc-film/sfx.json (every
// sound event), from the same schedule and Executive log the film draws: the DSKY key presses, the alarms, the
// Quindar tones of the radio calls.   node agc-shared/make-timeline.mjs (from machines/rope)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {QUINDAR} from './machine.js';
import {DURATION, LOG, SCRIPT, T, filmAt, missionAt, rateAt} from './schedule.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const r = (x) => +x.toFixed(3);
const inFilm = (t) => t >= 0 && t < DURATION - 0.1;
// key clicks: every press of the log heard at a film pace slow enough to hear it as a press
const keys = LOG.keyEv.filter(([s]) => s > missionAt(0)).map(([s]) => filmAt(s)).filter((t) => inFilm(t) && rateAt(t) < 6).map(r);
const alarms = LOG.alarms.map((a) => ({t: r(filmAt(a.s)), code: a.code})).filter((a) => inFilm(a.t));
// Quindar tones: the start and end of the radio exchanges about the alarm (Armstrong's call, Houston's "go") [J]
const calls = [
  [T.alarm + 0.9, T.alarm + 2.3],
  [T.alarm + 3.6, T.alarm + 4.6],
  [T.contact + 0.2, T.contact + 1.4],
].map(([a, b]) => [r(a), r(b)]);
const beats = {
  views: SCRIPT.filter((e) => e.t > 0).map((e) => e.t),
  ropeRead: T.ropeIn,
  erasRead: T.erasIn,
  alarm: alarms[0].t,
  ff: T.ff,
  contact: T.contact,
};
fs.writeFileSync(path.join(HERE, '../agc-film/timeline.json'), JSON.stringify({duration: DURATION, beats}));
fs.writeFileSync(path.join(HERE, '../agc-film/sfx.json'), JSON.stringify({keys, alarms, calls, quindar: QUINDAR}));
console.log(beats, keys.length, 'key presses', alarms.length, 'alarms');
