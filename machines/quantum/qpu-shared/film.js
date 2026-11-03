// Quantum, the explorer film (a photonic QPU after the public figures of Quandela's Belenos): the machine (machine.js) on the pale studio (stage.js) under the overlay
// (console.js). One input, the physical time τ of the current shot (schedule.js), poses every photon, flash, glow
// and click; the histogram counts at the real coincidence rate. An operator opens the cabinets, follows one shot from
// the laser to the time tagger, runs the Hong-Ou-Mandel test on one coupler, shows the Perceval program behind the
// heaters, then pulls back. A pure function of t.
import * as THREE from 'three';
import {runSim} from 'teardown-kit/runtime.js';
import {rng} from 'teardown-kit/util.js';
import {CAM_LABEL, createConsole, STAGES} from './console.js';
import {chipX, L, modeZ} from './machine.js';
import {buildHom, buildProgram, chipNs, homPc, hashU, P, PACKET, patLabel, randomPhases, rateN, shotPattern} from './photonics.js';
import {camAtName, deltaAt, DURATION, N_FILM, rateAt, SCRIPT, SEED, SEGMENTS, segAt, tAtTau, tauAt} from './schedule.js';
import {createStage} from './stage.js';
import {T as tr} from './i18n.js';

export {DURATION, SCRIPT};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'quantum', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const V3 = THREE.Vector3;
export const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));
const T_LASER = 8; // ns, laser fibre to the source [E]

// ------------------------------------------------------------ the programs
export function makeWorld(n, seed) {
  const r = rng(seed);
  const phases = randomPhases(r);
  const qc = buildProgram(n, phases, r);
  const hom = buildHom();
  const drive = (pr) => ({th: Float32Array.from(pr.phases, (p) => p.th / (Math.PI / 2)), ph: Float32Array.from(pr.phases, (p) => p.ph / (2 * Math.PI))});
  qc.drive = drive(qc);
  hom.drive = drive(hom);
  return {qc, hom};
}

// ------------------------------------------------------------ views, each a function of u (seconds since it came on)
const CH = L.chip;
export const VIEW_FN = {
  hero: (u) => ({tx: 0, ty: 1.0, tz: 0, az: 22 + 2.6 * Math.min(u, 6), el: 8 + 0.6 * Math.min(u, 6), d: 6.5 - 0.12 * Math.min(u, 6), sx: 0, sy: 18}),
  source: (u) => {
    const k = smoother((u - 0.3) / 3.8);
    return {tx: -0.41, ty: 1.12 - 0.044 * k, tz: 0.08, az: 24 - 6 * k, el: 10 + 12 * k, d: Math.exp(Math.log(2.0) + (Math.log(0.15) - Math.log(2.0)) * k), sx: 0, sy: 14};
  },
  demux: (u) => ({tx: 0.41, ty: 1.7, tz: 0.25, az: -16 + 2.4 * u, el: 24, d: 1.32 - 0.05 * u, sx: 0, sy: 12}),
  chip: (u, x) => {
    const k1 = smoother(u / 2.4);
    const k2 = smoother((u - 2.0) / 1.6);
    const fx = x?.front ?? 0;
    const tx = CH.x + (chipX(Math.min(0.92, Math.max(0.1, fx))) - CH.x) * k2;
    return {tx, ty: CH.y, tz: CH.z - 0.0006 * k2, az: -8 + 8 * k1, el: 16 + 46 * k1, d: Math.exp(Math.log(0.55) + (Math.log(0.04) - Math.log(0.55)) * k1) - 0.026 * k2, sx: 0, sy: 10};
  },
  detect: (u) => {
    const k = smoother((u - 0.2) / 3.4);
    return {tx: 0.41, ty: 0.86 - 0.017 * k, tz: 0.08, az: 20 - 6 * k, el: 12 + 14 * k, d: Math.exp(Math.log(1.7) + (Math.log(0.2) - Math.log(1.7)) * k), sx: 0, sy: 12};
  },
  hom: (u) => ({tx: chipX(1.6 / 24), ty: CH.y, tz: modeZ(1.2), az: 4 - 0.8 * u, el: 66, d: 0.0068, sx: 0, sy: 10}),
  perceval: (u) => ({tx: CH.x, ty: CH.y, tz: CH.z, az: -2 + 1.4 * u, el: 70, d: 0.04, sx: 0, sy: 10}),
  tour: (u) => ({tx: 0, ty: 1.0, tz: 0, az: 6 + 3.2 * u, el: 7 + 0.8 * u, d: 6.0 - 0.05 * u, sx: 0, sy: 18}),
};
const VIEWS = SCRIPT.filter((e) => e.cam).map((e) => [e.t, e.cam]);
export function blend(a, b, k, backOff = true) {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : key === 'd' ? Math.exp(Math.log(a.d) + (Math.log(b.d) - Math.log(a.d)) * k) : a[key] + (b[key] - a[key]) * k;
  const swing = Math.min(1, Math.abs(((b.az - a.az + 540) % 360) - 180) / 90);
  if (backOff) o.d += Math.max(0, Math.max(a.d, b.d) * (1 + 0.3 * swing) - o.d) * Math.sin(Math.PI * k) * 0.35;
  return o;
}
export const camAt = (t, x) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const view = (k) => VIEW_FN[VIEWS[k][1]](t - VIEWS[k][0], x);
  const cur = view(i);
  if (i === 0) return cur;
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.8, t);
  if (k >= 1) return cur;
  return blend(view(i - 1), cur, k);
};

// ------------------------------------------------------------ the operator's pointer: a click on the view button of each beat
const REST = [[820, 470], [700, 430], [900, 520], [760, 380]];
export function makeCursor(ui, script = SCRIPT) {
  const EV = script.filter((e) => e.t > 0).map((e) => ({t: e.t, spot: ui.spots[e.cam === 'tour' ? 'hero' : e.cam]}));
  const WP = [[0, 980, 640]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot]);
    WP.push([e.t + 0.24, ...e.spot]);
    WP.push([e.t + 1.6, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(24, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.09) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ one frame of the machine, from the shot's physical time
export const FOOT = Object.fromEntries(['laser', 'source', 'demux', 'chip', 'detect', 'tagger', 'hom'].map((k) => [k, tr('foot:' + k)]));
export const stageOf = (pr, ph) => {
  const T = pr.times;
  if (ph > T.SHOT - T_LASER) return 'laser';
  if (ph < (pr.n - 1) * P.T + 2) return 'source';
  if (ph < T.tArr) return 'demux';
  if (ph < T.tOut + PACKET) return 'chip';
  if (ph < T.tClick + 0.6) return 'detect';
  return 'tagger';
};

/**
 * c: {mac, pr, s, ph, t, tOf(segment τ) → display s, phAt(dt) → phase of shot s at t − dt, rate, delta}
 * Returns the machine's fx (photons, glow, pixels, heaters) and the facts the console needs.
 */
export function machineFrame(c) {
  const {mac, pr, s, ph, t, tOf} = c;
  const T = pr.times;
  const n = pr.n;
  const S0 = s * T.SHOT;
  const photons = [];
  const pat = shotPattern(pr, s, c.delta);
  const pathOf = (k) => (pr.hom ? mac.homPath(k) : mac.pathFor(n, k));
  const at = (k, p) => {
    const te = k * P.T;
    if (p < te) return null;
    const path = pathOf(k);
    if (p < te + T.tDmx) return path.pre.at((p - te) / T.tDmx);
    if (p < T.tArr) return path.coil.at((p - te - T.tDmx) / (T.tArr - te - T.tDmx));
    return null;
  };
  const atOut = (m, p) => (p >= T.tOut && p < T.tClick ? mac.outs[m].at((p - T.tOut) / (T.tClick - T.tOut)) : null);
  const TR = [0.018, 0.036, 0.054, 0.072, 0.09];
  const trailPh = TR.map((dt) => c.phAt(dt));
  const push = (pos, a, sz, kind) => pos && photons.push({pos, a, s: sz, kind});
  for (let k = 0; k < n; k++) {
    push(at(k, ph), 1, 21, 'photon');
    trailPh.forEach((p, i) => p >= 0 && push(at(k, p), 0.42 * (1 - i / TR.length), 16 - i * 2, 'photon'));
  }
  for (const m of pat) {
    push(atOut(m, ph), 1, 21, 'photon');
    trailPh.forEach((p, i) => p >= 0 && push(atOut(m, p), 0.42 * (1 - i / TR.length), 16 - i * 2, 'photon'));
  }
  // laser pulses in flight: this shot's, and the next shot's first one
  for (let k = 0; k <= n; k++) {
    const te = k < n ? k * P.T : T.SHOT;
    if (ph >= te - T_LASER && ph < te) push(mac.laserPath.at((ph - te + T_LASER) / T_LASER), 0.95, 14, 'laser');
  }
  // the QD flashes on each emission, in display time (an afterglow so the eye catches it)
  let qd = 0;
  for (let k = 0; k < n; k++) if (ph >= k * P.T) qd = Math.max(qd, Math.exp(-(t - tOf(S0 + k * P.T)) / 0.3));
  if (qd > 0.02) photons.push({pos: L.qd, a: qd, s: 64, kind: 'photon'});
  // the detector's electrical pulse to the time tagger
  if (ph >= T.tClick && ph < T.tTag) push(mac.coax.at((ph - T.tClick) / (T.tTag - T.tClick)), 1, 13, 'elec');
  // detector pixels: this shot's clicks, else the last shot's fading
  const pix = new Float32Array(P.modes);
  if (ph >= T.tClick) {
    const a = Math.exp(-(t - tOf(S0 + T.tClick)) / 0.7);
    for (const m of pat) pix[m] = Math.max(pix[m], a);
  } else if (s > 0) {
    const a = Math.exp(-(t - tOf(S0 - T.SHOT + T.tClick)) / 0.7);
    for (const m of shotPattern(pr, s - 1, c.delta)) pix[m] = Math.max(pix[m], a);
  }
  // the mesh: the wavepacket's front and tail, then an afterglow
  let front = 1.01;
  let tail = -0.01;
  let gain = 0;
  let after = 0;
  if (ph >= T.tArr && ph < T.tOut + PACKET) {
    front = (ph - T.tArr) / chipNs;
    tail = (ph - T.tArr - PACKET) / chipNs;
    gain = 1;
  } else if (ph >= T.tOut + PACKET) after = 0.9 * Math.exp(-(t - tOf(S0 + T.tOut + PACKET)) / 0.45);
  else if (s > 0) after = 0.9 * Math.exp(-(t - tOf(S0 - T.SHOT + T.tOut + PACKET)) / 0.45);
  // the outputs leaving the chip: their modes light at the output edge
  return {
    fx: {photons, field: pr.prog.field, front, tail, gain, after, pix, heatTheta: pr.drive.th, heatPhi: pr.drive.ph},
    pat,
    stage: stageOf(pr, ph),
    front,
  };
}

/** histogram facts for the console */
export function histFacts(pr, tAcq, pat, ph, delta, s) {
  if (pr.hom) {
    const pc = homPc(delta);
    const theory = [(1 - pc) / 2, pc, (1 - pc) / 2];
    const N = Math.round(rateN(2) * 0.05);
    const counts = theory.map((p, i) => Math.max(0, Math.round(N * p + Math.sqrt(N * p * (1 - p)) * (hashU(s * 1.3 + i * 7.7) * 2 - 1))));
    const key = pat[0] === pat[1] ? (pat[0] === 0 ? 0 : 2) : 1;
    return {hom: true, labels: ['0²', '0·1', '1²'], theory, counts, N: counts.reduce((a, b) => a + b, 0), total: 3, tvd: 0, lastIdx: ph >= pr.times.tClick ? key : -1};
  }
  const N = Math.min(pr.samp.S, Math.floor(pr.rate * Math.max(0, tAcq)));
  const top = pr.samp.top;
  const idx = pr.dist.pats.indexOf(pat);
  return {
    labels: top.map((i) => patLabel(pr.dist.pats[i])),
    theory: top.map((i) => pr.dist.probs[i]),
    counts: pr.samp.countTop(N),
    N,
    total: pr.dist.pats.length,
    tvd: pr.samp.tvdAt(N),
    lastIdx: ph >= pr.times.tClick ? top.indexOf(idx) : -1,
  };
}

// ------------------------------------------------------------ callouts per view, label spots on the 1600 x 900 layout
export function calloutsFor(view, st, mac, vis) {
  const P3 = (v) => st.project(v);
  const A = mac.A;
  const out = [];
  const c = (key, at, label, w) => {
    const [name, sub] = tr(key);
    out.push({name, sub, at: P3(at), label, w, o: vis});
  };
  if (view === 'hero' || view === 'tour') {
    c('cLaser', A.laser, [372, 150], 120);
    c('cSourceCryo', A.source, [356, 330], 140);
    c('cCompressor', A.compressor, [372, 650], 120);
    c('cDemux', A.demux, [1230, 128], -110);
    c('cChip', A.chip, [1236, 300], -120);
    c('cSnspdCryo', A.detect, [1236, 470], -110);
    c('cTagger', A.tagger, [1236, 640], -116);
  } else if (view === 'source') {
    c('cDot', A.sample, [372, 210], 170);
    c('cShield', new V3(-0.41 - 0.13, 1.2, 0.08), [372, 600], 110);
    c('cColdPlate', new V3(-0.41 + 0.08, 1.05, 0.08), [1230, 640], -110);
    c('cFibre', new V3(-0.41, 1.1, 0.08), [1230, 230], -140);
  } else if (view === 'demux') {
    c('cDemuxActive', A.demux, [372, 150], 170);
    c('cDelay', A.spools, [372, 640], 150);
  } else if (view === 'detect') {
    c('cSnspd', A.snspd, [372, 230], 170);
    c('cCryoCold', new V3(0.41 - 0.13, 0.7, 0.08), [372, 620], 160);
  } else if (view === 'chip' || view === 'perceval') {
    c('cMzi', new V3(chipX(5.5 / 24), CH.y, modeZ(9.5)), [372, 180], 190);
    c('cArray', new V3(CH.x - CH.w / 2 - 0.004, CH.y, CH.z), [372, 640], 160);
  }
  return out;
}

// ------------------------------------------------------------ the film
const isoFor = {source: 'source', demux: 'demux', detect: 'detect'};
export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    // {clean: true}: the machine without the console (the gallery's thumbnail)
    if (window.__SIM_CONFIG?.clean) ui.root.style.display = 'none';
    const W = makeWorld(N_FILM, SEED);
    window.QPU = {st, W};
    return {
      resize,
      render(t) {
        const {seg, tau} = tauAt(t);
        const sg = SEGMENTS[seg];
        const pr = sg.mode === 'hom' ? W.hom : W.qc;
        const SH = pr.times.SHOT;
        const s = Math.max(0, Math.floor(tau / SH));
        const ph = tau - s * SH;
        const delta = deltaAt(t);
        const tOf = (x) => tAtTau(seg, x);
        const phAt = (dt) => (t - dt < sg.t0 ? -1 : tauAt(t - dt).tau - s * SH);
        const mf = machineFrame({mac: st.mac, pr, s, ph, t, tOf, phAt, delta});
        const view = camAtName(t);
        const t0 = VIEWS.filter(([a]) => a <= t).pop()[0];
        const since = t - t0;
        const c = camAt(t, {front: mf.front});
        const iso = isoFor[view] || '';
        const isoK = iso ? ss(1.4, 2.2, since) : 0;
        const prevIso = isoFor[VIEWS[Math.max(0, VIEWS.findIndex(([a]) => a === t0) - 1)][1]];
        const fx = {...mf.fx, doors: ss(3.5, 5.2, t), iso: iso || (prevIso && since < 0.8 ? prevIso : ''), isoK: iso ? isoK : prevIso ? 1 - ss(0, 0.8, since) : 0, heat: view === 'perceval' ? ((since - 1.0) / 3.0) % 1.2 : 0};
        st.frame(fx, {...c, az: c.az * D2R, el: c.el * D2R});
        const tAcq = 6 + (t < 24.6 ? t : t - 6.4);
        const hist = histFacts(pr, tAcq, mf.pat, ph, delta, s);
        const homPts = [];
        if (pr.hom) for (let d = -0.45; d <= delta + 1e-6; d += 0.05) homPts.push([d, homPc(d) + (hashU(d * 91.7) * 2 - 1) * 0.006]);
        ui.update({
          times: pr.times,
          n: pr.n,
          nSel: N_FILM,
          ph,
          shot: s,
          rateNs: rateAt(t),
          stage: mf.stage,
          hom: !!pr.hom,
          homDelta: delta,
          homPts,
          hist,
          prog: W.qc.prog,
          inputs: W.qc.inputs,
          cam: view,
          cut: 'section',
          overlays: {callouts: 1, isolate: iso ? 1 : 0, doors: 1, charts: 1},
          paused: false,
          slowText: tr('auto'),
          slowK: 0.5,
          callouts: calloutsFor(view, st, st.mac, ss(1.4, 2.1, since)),
          cursor: cursorAt(t),
          foot: pr.hom ? FOOT.hom : FOOT[mf.stage],
        });
        return {};
      },
    };
  };
}
void CAM_LABEL;
void STAGES;
void segAt;

export const run = () => runSim(DEFAULTS, makeFilm());
