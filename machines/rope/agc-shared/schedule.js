// The film's operator script and its one input: the mission time s (seconds after PDI, counted on screen in MCT) as
// a monotone function of film time t. It crawls through two single memory cycles (a word read from the rope, a word
// read and rewritten in erasable memory), runs at about twice real time into the first 1202, then fast-forwards
// through P64 to touchdown. No three.js, so the timeline and the score can import it in node.
import {EVENTS, MCT, ROPE_WORDS, novacTrace} from './machine.js';
import {jobsAt, simulate} from './executive.js';

export const DURATION = 40;
/** the flown log: the crew's keys, the radar's steals on */
export const LOG = simulate();
export const ALARM1 = LOG.alarms[0];

// the NOVAC call the film slows down on: the first monitor-job request after 307.6 s
const REQ = LOG.jobs.find((j) => j.kind === 'monitor' && j.t0 >= 307.6);
export const NOVAC = {req: REQ, ...novacTrace(REQ.set)};
const base = Math.round(REQ.t0 / MCT);
const iCaf = NOVAC.trace.findIndex((x) => ROPE_WORDS[x.w].op === 'CAF NO.CORES');
const iCcs = NOVAC.trace.findIndex((x) => x.erasable);
/** the MCT in which the rope gives CAF NO.CORES (fetched in the last MCT before it runs) */
export const ROPE_MCT = base + NOVAC.trace[iCaf].mct - 1;
/** the MCT in which CCS PRIORITY reads core set 0's PRIORITY register (and rewrites it) */
export const ERAS_MCT = base + NOVAC.trace[iCcs].mct + 1;
export const ERAS_JOB = jobsAt(LOG, REQ.t0)[0];
const sR = ROPE_MCT * MCT;
const sE = ERAS_MCT * MCT;
const R_SLOW = MCT / 4; // one MCT in 4 s of film
export const T = {ropeIn: 10.2, erasIn: 16.0, alarm: 27.6, ff: 32.4, contact: 37.4};

const cubicOut = (u) => 1 - (1 - u) ** 3;
const cubicIn = (u) => u ** 3;
const smoother = (u) => u * u * u * (u * (u * 6 - 15) + 10);
// [t0, t1, s0, s1, ease]
const SEGS = [
  [0, 9.6, 306.4, sR + (9.6 - T.ropeIn) * R_SLOW, cubicOut],
  [9.6, 14.8, sR + (9.6 - T.ropeIn) * R_SLOW, sR + (14.8 - T.ropeIn) * R_SLOW, (u) => u],
  [14.8, 15.6, sR + (14.8 - T.ropeIn) * R_SLOW, sE + (15.6 - T.erasIn) * R_SLOW, (u) => u],
  [15.6, 20.2, sE + (15.6 - T.erasIn) * R_SLOW, sE + (20.2 - T.erasIn) * R_SLOW, (u) => u],
  [20.2, T.alarm, sE + (20.2 - T.erasIn) * R_SLOW, ALARM1.s, cubicIn],
  [T.alarm, T.ff, ALARM1.s, 324.0, (u) => u],
  [T.ff, T.contact, 324.0, EVENTS.contact + 0.4, smoother],
  [T.contact, DURATION + 1, EVENTS.contact + 0.4, EVENTS.contact + 3.2, (u) => u],
];
/** mission seconds after PDI at film time t */
export function missionAt(t) {
  const sg = SEGS.find((x) => t < x[1]) ?? SEGS[SEGS.length - 1];
  const u = Math.min(1, Math.max(0, (t - sg[0]) / (sg[1] - sg[0])));
  return sg[2] + (sg[3] - sg[2]) * sg[4](u);
}
/** film time at which the mission reaches s (binary search: s is monotone in t) */
export function filmAt(s) {
  let lo = 0;
  let hi = DURATION + 1;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (missionAt(mid) < s) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
/** mission seconds per film second at t */
export const rateAt = (t) => (missionAt(t + 0.004) - missionAt(Math.max(0, t - 0.004))) / (t > 0.004 ? 0.008 : 0.004);

// operator moves: camera views and the button pressed for each; `act` are the mechanical states
export const SCRIPT = [
  {t: 0, cam: 'hero'},
  {t: 3.0, cam: 'open', btn: 'tray'},
  {t: 6.8, cam: 'rope', btn: 'rope'},
  {t: 14.6, cam: 'eras', btn: 'eras'},
  {t: 20.2, cam: 'dsky', btn: 'dsky'},
  {t: 24.0, cam: 'exec', btn: 'exec'},
  {t: 32.4, cam: 'hero', btn: 'case'},
];
const ramp = (a, b, t) => smoother(Math.min(1, Math.max(0, (t - a) / (b - a))));
/** the machine's mechanical states at film time t */
export function actsAt(t) {
  return {
    open: ramp(3.2, 6.4, t) * (1 - ramp(32.8, 36.4, t)),
    rope: ramp(7.0, 8.6, t) * (1 - ramp(16.0, 17.4, t)),
    ropeCover: ramp(8.4, 9.2, t) * (1 - ramp(15.6, 16.0, t)),
    ropeDetail: t > 8.7 && t < 15.6 ? 1 : 0,
    eras: ramp(15.0, 16.0, t) * (1 - ramp(20.4, 21.4, t)),
    logic: 0,
    gate: 0,
    cut: '',
  };
}
export const camAtName = (t) => SCRIPT.filter((e) => e.cam && e.t <= t).pop().cam;
