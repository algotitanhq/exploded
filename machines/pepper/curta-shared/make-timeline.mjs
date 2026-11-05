// Writes ../curta-film/timeline.json (the beats, for review sheets and the score) and ../curta-film/sounds.json
// (every ratchet tooth, carry, counter step, slider detent and carriage notch of the film, from the same plan and
// model the film draws).   node curta-shared/make-timeline.mjs (from machines/pepper)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {soundEvents} from './machine.js';
import {DURATION, SCRIPT, filmPlan} from './schedule.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const r = (x) => +x.toFixed(3);
const plan = filmPlan();
const ev = soundEvents(plan);
const turns = plan.steps.filter((s) => s.kind === 'turns');
const sub = turns[turns.length - 1];
const beats = {
  views: SCRIPT.filter((e) => e.t > 0).map((e) => e.t),
  firstTooth: r(turns[0].t0 + 1.2),
  turnsEnd: r(turns[1].t1),
  carriage: r(plan.steps.find((s) => s.kind === 'carriage').t0 + 1.2),
  subStart: r(sub.t0 + 0.8),
  cascade: r(ev.carry.filter((c) => c.t > sub.t0)[2].t),
  overflow: r(ev.overflow[0]),
  clear: r(plan.steps.find((s) => s.kind === 'clear').t0 + 1.4),
  end: 36.5,
};
fs.writeFileSync(path.join(HERE, '../curta-film/timeline.json'), JSON.stringify({duration: DURATION, beats}));
const round = (a) => a.map((x) => (typeof x === 'number' ? r(x) : Array.isArray(x) ? x.map(r) : {...x, t: r(x.t)}));
fs.writeFileSync(path.join(HERE, '../curta-film/sounds.json'), JSON.stringify(Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, round(v)]))));
console.log(beats, Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, v.length])));
