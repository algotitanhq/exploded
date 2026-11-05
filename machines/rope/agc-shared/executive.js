// The Executive's log, planned once: the LGC's jobs from PDI to touchdown, simulated in 1 ms steps, with the
// rendezvous radar's cycle steals taken off the top of every millisecond. Everything the DSKY and the Executive panel
// show is read from this log at the frame's mission time. No three.js.
//
// The jobs [E1] [E]: SERVICER every 2 s (needs a core set and a VAC area), its duty set by the phase (braking 85 %,
// +2 % for the landing radar once it locks, approach 90.5 %, P66 80 %); a Verb 16 monitor job every second while the
// crew has one up (3 %, lower priority than SERVICER); in P64 the landing-point-designator job every 2 s; one short
// keyboard job per key press. A job holds its core set from its request until it ends. When a request finds the 8 core
// sets (or the 5 VAC areas) busy: BAILOUT, alarm 1202 (1201), a software restart that keeps only the newest SERVICER,
// drops the rest and the Verb 16 monitor, and lights PROG.
import {CREW_KEYS, EVENTS, EXEC, DESCENT_END} from './machine.js';

export const DT = 0.001;
export const SAMPLE = 0.01; // the log keeps one sample every 10 ms
export const JOB = {servicer: 0, monitor: 1, lpd: 2, charin: 3};
const PRIO = {servicer: 20, monitor: 10, lpd: 10, charin: 30}; // relative order only [E]
const NEEDS_VAC = {servicer: true, monitor: false, lpd: true, charin: false};
const WORK = {monitor: EXEC.n68 * EXEC.monitorPeriod, lpd: EXEC.approachJobs, charin: 0.004};
const LPD_START = 12;
const LR_RAMP = 24; // s for the radar's data to come fully into the navigation [E], calibrated on the first alarm

/** the phase's program number at s */
export const progAt = (s) => (s < EVENTS.p64 ? 63 : s < EVENTS.p66 ? 64 : s < EVENTS.contact + 3 ? 66 : 68);
/** SERVICER's duty (fraction of the machine) at s */
export function servicerDuty(s) {
  const p = progAt(s);
  if (p === 63) return EXEC.braking + (s > EVENTS.alt ? EXEC.lrConvert * Math.min(1, (s - EVENTS.alt) / LR_RAMP) : 0);
  if (p === 64) {
    const k = Math.min(1, (s - EVENTS.p64) / (EVENTS.p66 - EVENTS.p64));
    return EXEC.approach[0] + (EXEC.approach[1] - EXEC.approach[0]) * k - EXEC.approachJobs / EXEC.servicerPeriod;
  }
  return EXEC.manual;
}

// deterministic jitter on each SERVICER pass
const jit = (k) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/**
 * Runs the log. keys: [[s, key]] (the crew's, plus any the visitor adds); radar: the RR cycle steals on (as flown) or
 * off. Returns the samples, every job, the alarms, the displays and the lamps.
 */
export function simulate({keys = CREW_KEYS, radar = true, end = DESCENT_END} = {}) {
  const N = Math.ceil(end / SAMPLE) + 1;
  const S = {
    sets: new Uint8Array(N), // bit k: core set k busy
    vacs: new Uint8Array(N),
    run: new Int8Array(N), // the job running at the sample (JOB.*), -1 the dummy job
    duty: new Float32Array(N), // demanded duty incl. the radar's steals
    busy: new Uint8Array(N), // core sets in use
  };
  const jobs = [];
  const alarms = [];
  const restarts = [];
  const live = [];
  const sets = new Array(EXEC.coreSets).fill(null);
  const vacs = new Array(EXEC.vacAreas).fill(null);
  const tloss = radar ? EXEC.tloss : 0;
  // ------------------------------------------------ the DSKY's own state (a small PINBALL)
  const kq = [...keys].sort((a, b) => a[0] - b[0]);
  let ki = 0;
  const disp = []; // display states over time
  const lampEv = []; // [s, lamp, on]
  let mode = ''; // '', 'verb', 'noun'
  let vb = '';
  let nb = '';
  let verb = '06';
  let noun = '63';
  let monitor = false;
  let failreg = [0, 0, 0];
  let prog = 63;
  const keyEv = [];
  const pushDisp = (s, x = {}) => disp.push({s, prog, verb, noun, mode, vb, nb, monitor, fail: [...failreg], ...x});
  pushDisp(0);
  let oprErr = false;
  const exec = (s) => {
    const v = vb.padStart(2, '0');
    const n = nb.padStart(2, '0');
    mode = '';
    if ((v === '16' || v === '06') && ['63', '64', '68', '60'].includes(n)) {
      verb = v;
      noun = n;
      monitor = v === '16';
    } else if (v === '05' && n === '09') {
      verb = v;
      noun = n;
      monitor = false;
    } else if (v === '16' && n === '36') {
      verb = v;
      noun = n;
      monitor = true;
    } else {
      oprErr = true;
      lampEv.push([s, 'OPR ERR', 1]);
    }
    vb = v;
    nb = n;
  };
  const key = (s, k) => {
    keyEv.push([s, k]);
    if (k === 'VERB') {
      mode = 'verb';
      vb = '';
    } else if (k === 'NOUN') {
      mode = 'noun';
      nb = '';
    } else if (/^\d$/.test(k)) {
      if (mode === 'verb' && vb.length < 2) vb += k;
      else if (mode === 'noun' && nb.length < 2) nb += k;
      else {
        oprErr = true;
        lampEv.push([s, 'OPR ERR', 1]);
      }
    } else if (k === 'CLR') {
      if (mode === 'verb') vb = '';
      if (mode === 'noun') nb = '';
    } else if (k === 'ENTR') {
      if (mode) exec(s);
    } else if (k === 'RSET') {
      lampEv.push([s, 'PROG', 0]);
      if (oprErr) lampEv.push([s, 'OPR ERR', 0]);
      oprErr = false;
    } else if (k === 'KEY REL') {
      monitor = false;
      mode = '';
      progDisplay();
    }
    pushDisp(s);
  };
  const progDisplay = () => {
    verb = '06';
    noun = prog === 63 ? '63' : prog === 64 ? '64' : '60';
    monitor = false;
  };

  // ------------------------------------------------ the Executive
  let nextServ = 0.02;
  let nextMon = Infinity;
  let nextLpd = Infinity;
  let kServ = 0;
  let id = 0;
  const request = (s, kind, work) => {
    const set = sets.indexOf(null);
    const vac = NEEDS_VAC[kind] ? vacs.indexOf(null) : -2;
    if (set < 0 || vac === -1) return bailout(s, set < 0 ? 1202 : 1201, kind);
    const j = {id: id++, kind, prio: PRIO[kind], t0: s, t1: null, work, left: work, set, vac, fate: ''};
    sets[set] = j;
    if (vac >= 0) vacs[vac] = j;
    jobs.push(j);
    live.push(j);
    return j;
  };
  const free = (j, s, fate) => {
    j.t1 = s;
    j.fate = fate;
    sets[j.set] = null;
    if (j.vac >= 0) vacs[j.vac] = null;
    live.splice(live.indexOf(j), 1);
  };
  const bailout = (s, code, kind) => {
    const busy = sets.filter(Boolean).length;
    alarms.push({s, code, busy, vacBusy: vacs.filter(Boolean).length, kind});
    if (!failreg[0]) failreg[0] = code;
    else if (!failreg[1]) failreg[1] = code;
    failreg[2] = code;
    lampEv.push([s, 'PROG', 1]);
    // the restart: only the newest SERVICER survives, restarted from its restart point
    const newest = [...live].reverse().find((j) => j.kind === 'servicer');
    const kept = [];
    const dropped = [];
    for (const j of [...live]) {
      if (j === newest) continue;
      dropped.push({kind: j.kind, t0: j.t0});
      free(j, s, 'flushed');
    }
    if (newest) {
      kept.push({kind: newest.kind, t0: newest.t0});
      newest.left = newest.work;
    }
    if (monitor) {
      monitor = false;
      nextMon = Infinity;
    }
    progDisplay();
    mode = '';
    restarts.push({s, code, kept, dropped});
    pushDisp(s, {restart: true});
    return null;
  };

  const steps = Math.ceil(end / DT);
  let si = 0;
  for (let i = 0; i <= steps; i++) {
    const s = i * DT;
    // keys
    while (ki < kq.length && kq[ki][0] <= s) {
      const [ks, k] = kq[ki++];
      request(ks, 'charin', WORK.charin);
      const wasMon = monitor;
      key(ks, k);
      if (monitor && !wasMon) nextMon = ks + 0.05;
      if (!monitor) nextMon = Infinity;
    }
    // program changes
    const p = progAt(s);
    if (p !== prog) {
      prog = p;
      if (p === 64) {
        nextLpd = s + LPD_START; // after the pitchover [E]
      } else nextLpd = Infinity;
      nextMon = Infinity;
      progDisplay();
      mode = '';
      pushDisp(s);
    }
    // the waitlist
    if (s >= nextServ) {
      const w = EXEC.servicerPeriod * servicerDuty(s) * (1 + 0.025 * jit(kServ++));
      request(s, 'servicer', w);
      nextServ += EXEC.servicerPeriod;
    }
    if (s >= nextMon) {
      if (monitor) request(s, 'monitor', WORK.monitor);
      nextMon = monitor ? nextMon + EXEC.monitorPeriod : Infinity;
    }
    if (s >= nextLpd) {
      request(s, 'lpd', WORK.lpd);
      nextLpd += EXEC.servicerPeriod;
    }
    // one millisecond of CPU, less the stolen cycles, to the highest priorities first (FIFO among equals)
    let cap = DT * (1 - tloss);
    let ran = -1;
    while (cap > 1e-12 && live.length) {
      let best = null;
      for (const j of live) if (!best || j.prio > best.prio) best = j;
      const use = Math.min(cap, best.left);
      best.left -= use;
      cap -= use;
      if (ran < 0) ran = JOB[best.kind];
      if (best.left <= 1e-12) {
        free(best, s, 'done');
        if (best.kind === 'monitor' || best.kind === 'servicer') best.shown = s; // the display it refreshed
      }
    }
    if (s >= si * SAMPLE - 1e-9 && si < N) {
      let m = 0;
      let v = 0;
      sets.forEach((j, k) => j && (m |= 1 << k));
      vacs.forEach((j, k) => j && (v |= 1 << k));
      S.sets[si] = m;
      S.vacs[si] = v;
      S.run[si] = ran;
      S.busy[si] = sets.filter(Boolean).length;
      S.duty[si] = tloss + servicerDuty(s) + (monitor ? EXEC.n68 : 0) + (prog === 64 ? EXEC.approachJobs / EXEC.servicerPeriod : 0);
      si++;
    }
  }
  // display refreshes: a monitor job's end (Verb 16), a SERVICER pass's end (the program's Verb 06)
  const monShown = jobs.filter((j) => j.kind === 'monitor' && j.fate === 'done').map((j) => j.t1);
  const servShown = jobs.filter((j) => j.kind === 'servicer' && j.fate === 'done').map((j) => j.t1);
  return {S, jobs, alarms, restarts, disp, lampEv, keyEv, monShown, servShown, radar, end};
}

const lastLE = (arr, s, key = (x) => x) => {
  let lo = 0;
  let hi = arr.length - 1;
  if (hi < 0 || key(arr[0]) > s) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (key(arr[mid]) <= s) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};
export const sampleAt = (log, s) => Math.max(0, Math.min(log.S.sets.length - 1, Math.round(s / SAMPLE)));
/** the display state at s, and when its registers were last refreshed */
export function displayAt(log, s) {
  const d = log.disp[Math.max(0, lastLE(log.disp, s, (x) => x.s))];
  const src = d.monitor ? log.monShown : log.servShown;
  const k = lastLE(src, s);
  const shown = k < 0 ? d.s : Math.max(src[k], d.s);
  return {...d, shown};
}
/** a lamp's state at s */
export function lampAt(log, s, name) {
  let on = 0;
  for (const [t, l, v] of log.lampEv) {
    if (t > s) break;
    if (l === name) on = v;
  }
  return on;
}
/** the jobs alive at s, in core-set order */
export function jobsAt(log, s) {
  const out = new Array(EXEC.coreSets).fill(null);
  for (const j of log.jobs) if (j.t0 <= s && (j.t1 === null || j.t1 > s)) out[j.set] = j;
  return out;
}
/** the last restart at or before s */
export function restartAt(log, s) {
  const k = lastLE(log.restarts, s, (x) => x.s);
  return k < 0 ? null : log.restarts[k];
}
