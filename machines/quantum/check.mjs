// Recomputes, from the same functions the page draws with, every figure Quantum shows, and fails if one leaves the
// range its source gives. node machines/quantum/check.mjs (CI runs it on every push).
import {rng} from '../../kit/util.js';
import * as Q from './qpu-shared/photonics.js';
import {N_FILM, SEED} from './qpu-shared/schedule.js';

let bad = 0;
const near = (name, v, lo, hi, unit = '') => {
  const ok = v >= lo && v <= hi;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'}  ${name.padEnd(46)} ${Number(v.toPrecision(6))} ${unit}  [${lo} … ${hi}]`);
};

// the chain, source to click [A]: 55 % × 70 % × 45 % × 92 % and the fibre factor make 8.4 % per photon
near('transmission per photon', Q.ETA, 0.0839, 0.0841);
for (const e of Q.P.eta) near(`  stage ${e.key}`, e.v, 0, 1);
// n-photon rate: (80 MHz / n) · η^n. Ascella measured ~4 Hz at n = 6 [A]
near('6-photon rate (Ascella ~4 Hz)', Q.rateN(6), 3.5, 6, 'Hz');
near('4-photon rate', Q.rateN(4), 990, 1000, 'Hz');
// one 12.5 ns slot is 2.55 m of fibre (group index 1.468)
near('pulse period', Q.P.T, 12.5, 12.5, 'ns');
near('fibre per slot', Q.sliceM, 2.55, 2.556, 'm');
near('fibre delay', Q.P.fibreNs, 4.89, 4.90, 'ns/m');
// the delay lines bring the n photons of a shot onto the chip together: arrival = emission + fibre, the same for all
for (const n of [2, 3, 4, 5]) {
  const T = Q.shotTimes(n);
  const tDmx = (Q.P.L0 + Q.P.Ldmx) * Q.P.fibreNs;
  const arr = Array.from({length: n}, (_, k) => k * Q.P.T + tDmx + (Q.delayLen(Q.outPort(n, k)) + Q.P.Lchip) * Q.P.fibreNs);
  near(`  n = ${n}: spread of chip arrivals`, Math.max(...arr) - Math.min(...arr), 0, 1e-9, 'ns');
  near(`  n = ${n}: arrival = tArr`, Math.abs(arr[0] - T.tArr), 0, 1e-9, 'ns');
}
// the mesh: a Clements rectangle on 24 modes has 24 · 23 / 2 = 276 MZIs, two heaters each
near('MZIs in the 24-mode mesh', Q.MZI.length, 276, 276);
near('time through the mesh', Q.chipNs, 0.15, 0.155, 'ns');
// Hong-Ou-Mandel: P(1,1) at zero delay = ½(1 − M), M = 94.4 % [A]
near('HOM coincidence at δ = 0', Q.homPc(0), 0.0279, 0.0281);
near('HOM coincidence far from 0', Q.homPc(5), 0.4999, 0.5);
// the film's program: U unitary, its distribution sums to 1, C(24 + 4 − 1, 4) = 17,550 patterns
const r = rng(SEED);
const pr = Q.buildProgram(N_FILM, Q.randomPhases(r), r);
const N = Q.P.modes;
let err = 0;
for (let a = 0; a < N; a++)
  for (let b = 0; b < N; b++) {
    let re = 0;
    let im = 0;
    for (let m = 0; m < N; m++) {
      const [ar, ai, br, bi] = [pr.prog.Ur[m * N + a], pr.prog.Ui[m * N + a], pr.prog.Ur[m * N + b], pr.prog.Ui[m * N + b]];
      re += ar * br + ai * bi;
      im += ar * bi - ai * br;
    }
    err = Math.max(err, Math.hypot(re - (a === b ? 1 : 0), im));
  }
near('U†U − I (max element)', err, 0, 1e-12);
near('sum of the boson-sampling probabilities', pr.dist.total, 1 - 1e-9, 1 + 1e-9);
near('output patterns for 4 photons', pr.dist.pats.length, 17550, 17550);
near('distance to theory after 60,000 samples', pr.samp.tvdAt(60000), 0, 0.1);

if (bad) {
  console.error(`\n${bad} figure(s) out of range`);
  process.exit(1);
}
console.log('\nevery figure in range');
