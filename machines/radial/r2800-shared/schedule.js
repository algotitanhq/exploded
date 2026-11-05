// The film's operator script and its one input. A run of the engine is planned once in physical time τ (s): the
// starter, the ignition, the first firings missed then caught, idle, the climb to take-off rpm, the throttle back.
// The film plays it through a slow-motion map τ(t). The crank angle θ is integrated from the rpm once, at load, and
// every pose, valve, spark, gauge and sound of the film is read from θ(t). No three.js: node imports it for the
// timeline and the score.
import {FIRE, ORDER, RATING, SPARK_ADV, stateAt} from './engine.js';

export const DURATION = 40;
export const FPS_TABLE = 1200; // table rate, samples per second of film

// operator moves: views and the buttons the cursor presses
export const SCRIPT = [
  {t: 0, cam: 'hero'},
  {t: 1.6, press: 'starter'},
  {t: 3.3, press: 'ignition'},
  {t: 6.4, cam: 'face'},
  {t: 12.6, cam: 'rowcut'},
  {t: 18.6, cam: 'apart'},
  {t: 23.6, cam: 'cam'},
  {t: 28.4, cam: 'takeoff', press: 'throttle'},
  {t: 32.6, cam: 'faceFull'},
  {t: 35.4, cam: 'heroEnd', press: 'throttleBack'},
];
export const BEATS = SCRIPT.filter((e) => e.t > 0).map((e) => e.t);
export const camAtName = (t) => SCRIPT.filter((e) => e.cam && e.t <= t).pop().cam;
export const camSince = (t) => t - SCRIPT.filter((e) => e.cam && e.t <= t).pop().t;

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
// slow motion: τ seconds per film second, eased between keys in log space
const RATE = [
  [0, 1],
  [6.4, 1],
  [7.6, 1 / 25],
  [12.6, 1 / 25],
  [13.4, 1 / 40],
  [23.6, 1 / 40],
  [24.4, 1 / 14],
  [28.4, 1 / 14],
  [29.6, 1],
  [DURATION, 1],
];
export const rateAt = (t) => {
  let i = 0;
  while (i < RATE.length - 2 && t >= RATE[i + 1][0]) i++;
  const [t0, a] = RATE[i];
  const [t1, b] = RATE[i + 1];
  const k = smoother((t - t0) / (t1 - t0));
  return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * k);
};

// ------------------------------------------------------------ the tables: τ(t), then N(τ), θ, the air
const NT = Math.ceil(DURATION * FPS_TABLE) + 2;
const TAU = new Float64Array(NT);
for (let i = 1; i < NT; i++) {
  const t = (i - 0.5) / FPS_TABLE;
  TAU[i] = TAU[i - 1] + rateAt(t) / FPS_TABLE;
}
const lerpT = (arr, t) => {
  const x = Math.min(NT - 1.001, Math.max(0, t * FPS_TABLE));
  const i = Math.floor(x);
  return arr[i] + (arr[i + 1] - arr[i]) * (x - i);
};
export const tauAt = (t) => lerpT(TAU, t);

// the run, in physical seconds, keyed to the film's beats
export const RUN = (() => {
  const s = tauAt(1.6);
  const ign = tauAt(3.3);
  return {
    starter: s, // the starter engages
    ign, // magnetos on
    catch0: ign + 0.25, // the first firings, mostly missed
    catch1: ign + 1.05, // every cylinder firing
    disengage: ign + 1.3, // the starter lets go
    climb: tauAt(29.7), // the throttle opens
    climbLen: 3.0,
    back: tauAt(35.6), // the throttle closes
    backLen: 3.0,
  };
})();
const {idle, crank} = RATING;
const TO = RATING.takeoff.rpm;
/** the planned engine speed (rpm) at physical time τ */
export const rpmAtTau = (tau) => {
  const R = RUN;
  let N = crank * smoother((tau - R.starter) / 1.0);
  // caught: a flare to ~1,050 rpm, then idle
  const up = smoother((tau - (R.ign + 0.85)) / 1.0);
  const settle = smoother((tau - (R.ign + 1.85)) / 1.15);
  N += up * (1050 - crank) - settle * (1050 - idle);
  N += smoother((tau - R.climb) / R.climbLen) * (TO - idle);
  N -= smoother((tau - R.back) / R.backLen) * (TO - idle);
  return Math.max(0, N);
};
/** 0 on the starter, 1 when every cylinder fires and the engine carries itself */
export const runAtTau = (tau) => smoother((tau - (RUN.ign + 0.6)) / 1.0);
/** the chance that a spark lights its charge, while the engine catches */
export const catchAtTau = (tau) => (tau < RUN.ign ? 0 : 0.12 + 0.88 * smoother((tau - RUN.catch0) / (RUN.catch1 - RUN.catch0)));
export const starterAtTau = (tau) => (tau >= RUN.starter && tau < RUN.disengage ? 1 : 0);

const TH = new Float64Array(NT); // crank angle, degrees
const AIR = new Float64Array(NT); // the charge carried down the pipes, in turns of a pipe (for the particles)
const THETA0 = 6;
TH[0] = THETA0;
for (let i = 1; i < NT; i++) {
  const tau = (TAU[i] + TAU[i - 1]) / 2;
  const dtau = TAU[i] - TAU[i - 1];
  const N = rpmAtTau(tau);
  TH[i] = TH[i - 1] + N * 6 * dtau;
  const st = stateAt(N, runAtTau(tau));
  AIR[i] = AIR[i - 1] + (N / 60) * (st.map / 29.92) * dtau * 0.2;
}
export const thetaAt = (t) => lerpT(TH, t);
export const airAt = (t) => lerpT(AIR, t);
export const rpmAt = (t) => rpmAtTau(tauAt(t));
/** film time at which the crank reaches th (θ is monotone) */
export const tAtTheta = (th) => {
  if (th <= TH[0]) return 0;
  let lo = 0;
  let hi = NT - 1;
  if (th >= TH[hi]) return DURATION;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (TH[mid] < th) lo = mid;
    else hi = mid;
  }
  const f = (th - TH[lo]) / Math.max(1e-9, TH[hi] - TH[lo]);
  return (lo + f) / FPS_TABLE;
};

// ------------------------------------------------------------ the sparks
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const IDX = Object.fromEntries(ORDER.map((c, i) => [c, i]));
/** spark number m of cylinder c (m-th cycle): its crank angle */
const sparkTheta = (c, m) => FIRE[c] - SPARK_ADV + 720 * m;
/** does spark (c, m) light its charge? the ignition must be on and the engine catching */
export const firesAt = (c, m, tau) => hash(m * 18 + IDX[c] + 7) < catchAtTau(tau);
/** the last spark of cylinder c at film time t: when it was (film s), whether it lit, its crank angle */
export function lastSpark(c, t) {
  const th = thetaAt(t);
  const m = Math.floor((th - (FIRE[c] - SPARK_ADV)) / 720);
  const ths = sparkTheta(c, m);
  const ts = tAtTheta(ths);
  const tau = tauAt(ts);
  return {t: ts, th: ths, lit: tau >= RUN.ign && firesAt(c, m, tau), m};
}
/** every spark of the film after the ignition, for the score: [t, cylinder, lit] */
export function sparkList() {
  const out = [];
  const th1 = TH[NT - 1];
  for (const c of ORDER) {
    for (let m = -1; sparkTheta(c, m) < th1; m++) {
      const ths = sparkTheta(c, m);
      if (ths < TH[0]) continue;
      const t = tAtTheta(ths);
      const tau = tauAt(t);
      if (tau < RUN.ign) continue;
      out.push([+t.toFixed(4), c, firesAt(c, m, tau) ? 1 : 0]);
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}
