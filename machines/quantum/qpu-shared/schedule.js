// The film's operator script and its one input: physical time τ (ns) inside the current run of shots, as a smooth
// monotone function of film time t. No three.js, so the timeline and the score can import it in node.
//
// The 3D shows one post-selected shot at a time in slow motion (only ~1 shot in 1/η⁴ ≈ 20 000 gives a 4-photon
// coincidence; those are the ones drawn). The histogram counts at the real coincidence rate, in real time.
import {shotTimes} from './photonics.js';

export const N_FILM = 4;
export const SEED = 20251023;
export const DURATION = 42;
const S4 = shotTimes(N_FILM).SHOT; // 86 ns
const S2 = shotTimes(2).SHOT; // 61 ns
const ST = shotTimes(N_FILM);

// operator moves: camera views, the HOM demo, cutaway changes
export const SCRIPT = [
  {t: 0, cam: 'hero'},
  {t: 3.5, cam: 'source'},
  {t: 9.2, cam: 'demux'},
  {t: 14.2, cam: 'chip'},
  {t: 20.0, cam: 'detect'},
  {t: 24.6, cam: 'hom'},
  {t: 31.0, cam: 'perceval'},
  {t: 36.0, cam: 'tour'},
];

// runs of shots: each has its program (qc: n photons through the random U; hom: two photons on one coupler) and τ keys
export const SEGMENTS = [
  {
    t0: 0,
    t1: 24.6,
    mode: 'qc',
    n: N_FILM,
    keys: [
      [0, 30],
      [3.5, 78],
      [5.4, S4 + 0.5],
      [9.2, S4 + 41],
      [14.2, S4 + ST.tArr - 0.9],
      [15.6, S4 + ST.tArr - 0.08],
      [18.8, S4 + ST.tOut + 0.25],
      [20.0, S4 + ST.tOut + 1.6],
      [21.6, S4 + ST.tClick + 0.8],
      [22.6, S4 + ST.tTag + 2],
      [24.6, 5 * S4],
    ],
  },
  {t0: 24.6, t1: 31.0, mode: 'hom', n: 2, keys: [[24.6, 0], [31.0, 24 * S2]]},
  {t0: 31.0, t1: DURATION, mode: 'qc', n: N_FILM, keys: [[31.0, 0], [DURATION, 30 * S4]]},
];

// Fritsch-Carlson monotone cubic through the keys: τ never runs backwards, and slows smoothly into each key
function monotone(keys) {
  const n = keys.length;
  const x = keys.map((k) => k[0]);
  const y = keys.map((k) => k[1]);
  const d = [];
  const m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (d[i - 1] + d[i])) / ((2 * d[i] + d[i - 1]) / d[i - 1] + (d[i] + 2 * d[i - 1]) / d[i]);
  return (t) => {
    if (t <= x[0]) return y[0] + m[0] * (t - x[0]);
    if (t >= x[n - 1]) return y[n - 1] + m[n - 1] * (t - x[n - 1]);
    let i = 0;
    while (t > x[i + 1]) i++;
    const h = x[i + 1] - x[i];
    const s = (t - x[i]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}
const SPL = SEGMENTS.map((s) => monotone(s.keys));
export const segAt = (t) => {
  let i = 0;
  while (i < SEGMENTS.length - 1 && t >= SEGMENTS[i + 1].t0) i++;
  return i;
};
export const tauAt = (t) => {
  const i = segAt(t);
  return {seg: i, tau: SPL[i](t)};
};
/** Film time at which segment i reaches τ (binary search: τ is monotone). */
export const tAtTau = (i, tau) => {
  let lo = SEGMENTS[i].t0;
  let hi = SEGMENTS[i].t1 + 30;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (SPL[i](mid) < tau) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
/** ns of physical time per second of film, at t. */
export const rateAt = (t) => {
  const i = segAt(t);
  return (SPL[i](t + 0.01) - SPL[i](t - 0.01)) / 0.02;
};
// the HOM delay scan: from −0.45 ns to +0.45 ns while the camera holds on the coupler
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const deltaAt = (t) => -0.45 + 0.9 * smoother((t - 25.8) / 4.6);
export const camAtName = (t) => SCRIPT.filter((e) => e.cam && e.t <= t).pop().cam;

/** every detector click in the film, in film seconds, for the score */
export function clickTimes() {
  const out = [];
  SEGMENTS.forEach((sg, i) => {
    const st = shotTimes(sg.n);
    const tauEnd = SPL[i](sg.t1);
    for (let s = 0; s * st.SHOT + st.tClick < tauEnd; s++) {
      const tau = s * st.SHOT + st.tClick;
      if (tau < SPL[i](sg.t0)) continue;
      out.push(+tAtTau(i, tau).toFixed(4));
    }
  });
  return out;
}
