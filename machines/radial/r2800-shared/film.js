// Radial, the film: the R-2800 (model.js) on its run-up stand (stage.js) under the manual-plate overlay (console.js).
// One input, the crank angle θ(t) integrated once from the planned run (schedule.js), poses every piston, rod, cam,
// valve, magneto, gear and the propeller, lights each spark, and drives every gauge. The operator starts the engine,
// watches the firing order go round the star, cuts a row, pulls the rows apart, looks at a cam ring lifting a valve,
// opens the throttle to take-off rpm and closes it again. A pure function of t.
import * as THREE from 'three';
import {runSim} from 'teardown-kit/runtime.js';
import {createConsole} from './console.js';
import {CYL, E, lift, ROWS, stateAt, wrap180} from './engine.js';
import {loadFonts} from './fonts.js';
import {T as tr} from './i18n.js';
import {airAt, camAtName, camSince, DURATION, lastSpark, rateAt, rpmAt, RUN, runAtTau, SCRIPT, starterAtTau, tauAt, thetaAt} from './schedule.js';
import {createStage} from './stage.js';

export {DURATION, SCRIPT};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'radial', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
export const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// the cylinder the cam view watches: the front-row cylinder near the top whose inlet valve opens mid-hold
export const CAM_CYL = (() => {
  const t0 = 24.4;
  const t1 = 28.0;
  let best = ROWS.front[0].c;
  let score = -1e9;
  for (const cy of ROWS.front) {
    let peak = 0;
    let tp = 0;
    for (let t = t0; t <= t1; t += 0.02) {
      const L = lift(cy.c, 'in', thetaAt(t));
      if (L > peak) [peak, tp] = [L, t];
    }
    const top = Math.cos(cy.angle * D2R);
    const s = peak * 2 + top * 1.2 - Math.abs(tp - 26.2) * 0.6;
    if (s > score) [score, best] = [s, cy.c];
  }
  return best;
})();

// ------------------------------------------------------------ views, each a function of u (seconds since it came on)
const camAng = CYL[CAM_CYL - 1].angle;
export const VIEW_FN = {
  hero: (u) => ({tx: 0, ty: -0.04, tz: 0.04, az: 36 + 1.0 * Math.min(u, 8), el: 9 + 0.3 * Math.min(u, 8), d: 4.7 - 0.05 * Math.min(u, 8), sx: 0, sy: 0}),
  face: (u) => ({tx: 0, ty: 0, tz: 0, az: 0, el: 1.5, d: 4.35 - 0.06 * Math.min(u, 6), sx: 0, sy: 0}),
  faceFull: (u) => ({tx: 0, ty: 0, tz: 0, az: -4 + 1.2 * u, el: 2, d: 4.5 - 0.04 * u, sx: 0, sy: 0}),
  rowcut: (u) => ({tx: 0, ty: 0, tz: 0.1, az: 0, el: 0, d: 3.7 - 0.12 * Math.min(u, 6), sx: 0, sy: 0}),
  apart: (u) => ({tx: 0, ty: 0.02, tz: 0.03, az: 58 + 1.6 * u, el: 18, d: 3.4, sx: 0, sy: 0}),
  cam: (u) => {
    // beside the watched cylinder, looking across it: the cam ring, the tappet, the tube, the rocker, the valve
    const a = camAng * D2R;
    const ur = [-Math.sin(a), Math.cos(a), 0];
    const ut = [Math.cos(a), Math.sin(a), 0];
    const sw = 0.1 * Math.sin(u * 0.35);
    const dir = [0, 1, 2].map((i) => (0.82 + sw) * ut[i] + 0.5 * (i === 2 ? 1 : 0) + 0.22 * ur[i]);
    const n = Math.hypot(...dir);
    const [dx, dy, dz] = dir.map((v) => v / n);
    const R = 0.31;
    return {tx: ur[0] * R, ty: ur[1] * R, tz: 0.105 + 0.11, az: Math.atan2(dx, dz) / D2R, el: Math.asin(dy) / D2R, d: 1.8 - 0.02 * u, sx: 0, sy: 0};
  },
  takeoff: (u) => ({tx: 0, ty: -0.05, tz: -0.12, az: 64 + 5.5 * u, el: 7, d: 5.3, sx: 0, sy: 0}),
  heroEnd: (u) => ({...VIEW_FN.hero(u), d: 4.8 - 0.03 * u}),
  // live-only
  profile: () => ({tx: 0, ty: 0, tz: -0.25, az: 90, el: 2, d: 5.4, sx: 0, sy: 0}),
  inside: () => {
    // across the cut through cylinder 2's axis: the piston, the chamber, both valves and both plugs
    const a = CYL[1].angle * D2R;
    const ur = [-Math.sin(a), Math.cos(a)];
    const ut = [Math.cos(a), Math.sin(a)];
    const dir = [ut[0] * 0.93 + ur[0] * 0.2, ut[1] * 0.93 + ur[1] * 0.2, 0.3];
    const n = Math.hypot(...dir);
    return {tx: ur[0] * 0.47, ty: ur[1] * 0.47, tz: 0.105, az: Math.atan2(dir[0] / n, dir[2] / n) / D2R, el: Math.asin(dir[1] / n) / D2R, d: 0.95, fov: 34, sx: 0, sy: 0};
  },
};
const VIEWS = SCRIPT.filter((e) => e.cam).map((e) => [e.t, e.cam]);
export function blend(a, b, k) {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + wrap180(b.az - a.az) * k : key === 'd' ? Math.exp(Math.log(a.d) + (Math.log(b.d) - Math.log(a.d)) * k) : (a[key] ?? b[key]) + (b[key] - (a[key] ?? b[key])) * k;
  return o;
}
export const camAt = (t) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const view = (k) => VIEW_FN[VIEWS[k][1]](t - VIEWS[k][0]);
  const cur = view(i);
  if (i === 0) return cur;
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.6, t);
  if (k >= 1) return cur;
  return blend(view(i - 1), cur, k);
};

// ------------------------------------------------------------ what each view shows: subsystem opacity, cut, rows
const ALL = {case: 1, crank: 1, cyl: 1, valve: 1, ign: 1, air: 1, prop: 1, nose: 1, oil: 1, stand: 1, cowl: 0, baffle: 1};
export const LOOK = {
  hero: {vis: ALL},
  face: {vis: {...ALL, prop: 0.3}},
  faceFull: {vis: ALL},
  heroEnd: {vis: ALL},
  takeoff: {vis: ALL},
  rowcut: {vis: {...ALL, prop: 0, ign: 0, air: 0, valve: 0, baffle: 0, oil: 0, cowl: 0}, cut: 'rowcut', hideRear: 1},
  apart: {vis: {...ALL, case: 0, prop: 0, nose: 0, ign: 0, air: 0, valve: 0, baffle: 0, oil: 0, stand: 0, cyl: 0}, apart: 1},
  cam: {vis: {...ALL, case: 0.12, cyl: 0.3, crank: 0, prop: 0, nose: 0, ign: 0, air: 0, baffle: 0, oil: 0, stand: 0}, hideRear: 1, focusK: 1},
};
const lookAt = (name) => LOOK[name] || LOOK.hero;
/** the looks of two views, blended: opacities, the apart offset, the hidden rear row */
export function blendLook(a, b, k) {
  const vis = {};
  for (const g of Object.keys(ALL)) vis[g] = (a.vis[g] ?? 1) + ((b.vis[g] ?? 1) - (a.vis[g] ?? 1)) * k;
  return {vis, apart: (a.apart || 0) + ((b.apart || 0) - (a.apart || 0)) * k, hideRear: (a.hideRear || 0) + ((b.hideRear || 0) - (a.hideRear || 0)) * k, cut: k < 0.5 ? a.cut : b.cut, focusK: (a.focusK || 0) + ((b.focusK || 0) - (a.focusK || 0)) * k, focus: a.focusK || b.focusK ? CAM_CYL : 0};
}
export const lookAtT = (t) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = lookAt(VIEWS[i][1]);
  if (i === 0) return blendLook(cur, cur, 1);
  const prev = lookAt(VIEWS[i - 1][1]);
  return blendLook(prev, cur, ss(VIEWS[i][0] + 0.1, VIEWS[i][0] + 1.1, t));
};

// ------------------------------------------------------------ the operator's pointer: a click on the button of each beat
const REST = [[860, 520], [720, 430], [900, 560], [760, 380]];
const SPOT_OF = {face: 'face', faceFull: 'face', rowcut: 'section', apart: 'crank', cam: 'valve', takeoff: 'throttle', heroEnd: 'throttleBack'};
export function makeCursor(ui, script = SCRIPT) {
  const EV = script.filter((e) => e.t > 0).map((e) => ({t: e.t, spot: ui.spots[e.press || SPOT_OF[e.cam]] || ui.spots.hero}));
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

// ------------------------------------------------------------ sparks to light: from the last spark of each cylinder
/**
 * glow of each chamber, 0..1: lit sparks only, fading over ~0.35 s of screen time and ~100° of crank. When the
 * firings come faster than the eye (more than ~12 a second on screen) the lights merge into a steady low glow.
 * spark(c) → {t (screen s), th (crank °), lit}; now: screen time; th: crank; fireHzScreen: firings per screen second
 */
export function glowOf(spark, now, th, fireHzScreen) {
  const merge = ss(12, 60, fireHzScreen);
  return CYL.map((cy) => {
    const s = spark(cy.c);
    if (!s || !s.lit) return 0.22 * merge;
    const age = now - s.t;
    const dth = th - s.th;
    const g = Math.exp(-Math.max(0, age) / 0.35) * (dth < 110 ? 1 : Math.exp(-(dth - 110) / 50));
    return g * (1 - merge) + 0.22 * merge;
  });
}
/** the propeller's blur: how far a blade turns between two frames */
export const blurOf = (propRpm, rate, fps = 60) => ss(5, 28, (propRpm * 6 * rate) / fps);
export const phaseOf = (tau) => {
  const R = RUN;
  if (tau < R.starter) return 'stopped';
  if (tau < R.ign) return 'starter';
  if (tau < R.disengage + 0.6) return 'ignition';
  if (tau < R.climb) return 'idle';
  if (tau < R.climb + R.climbLen + 0.3) return 'climb';
  if (tau < R.back) return 'takeoff';
  if (tau < R.back + R.backLen) return 'back';
  return 'idle';
};

// ------------------------------------------------------------ callouts per view, label spots on the 1600 x 900 layout
export function calloutsFor(view, st, vis) {
  const P3 = (v) => st.project(v);
  const A = st.eng.A;
  const out = [];
  const c = (key, at, label, w, o = 1) => {
    const [name, sub] = tr(key);
    out.push({name, sub, at: P3(at), label, w, o: vis * o});
  };
  if (view === 'hero' || view === 'heroEnd') {
    c('cProp', A.blade(), [372, 168], 120);
    c('cMagneto', A.magneto(), [372, 300], 140);
    c('cHarness', A.harness(), [372, 420], 120);
    c('cHead', A.head(), [1232, 150], -130);
    c('cFins', A.fins(), [1232, 268], -120);
    c('cPushrod', A.pushrod(), [1232, 390], -140);
    c('cPipe', A.pipe(), [1232, 520], -110);
  } else if (view === 'face' || view === 'faceFull') {
    c('cStarFront', A.cylAt(2, 560), [372, 200], 160);
    c('cStarRear', A.cylAt(5, 560), [372, 610], 160);
    c('cNose', A.nose(), [1232, 200], -140);
  } else if (view === 'rowcut') {
    c('cMaster', A.master('front'), [372, 200], 150);
    c('cArt', A.art('front', 12), [1232, 230], -150);
    c('cKnuckle', A.pin('front'), [372, 610], 170);
    c('cPiston', A.piston(2), [1232, 560], -150);
  } else if (view === 'apart') {
    c('cPinRear', A.pin('rear'), [372, 220], 150);
    c('cPinFront', A.pin('front'), [372, 600], 150);
    c('cRows', A.piston(1), [1232, 220], -140);
  } else if (view === 'cam') {
    c('cCam', A.camRing('front'), [372, 610], 160);
    c('cTappet', A.tappet(CAM_CYL, 'in'), [372, 320], 160);
    c('cRocker', A.rocker(CAM_CYL, 'in'), [1232, 200], -150);
    c('cValve', A.valve(CAM_CYL, 'in'), [1232, 470], -150);
  } else if (view === 'takeoff') {
    c('cSuper', A.impeller(), [1232, 640], -140);
    c('cCarb', A.carb(), [1232, 190], -150);
    c('cGear', A.nose(), [372, 190], 130);
    c('cStarter', A.starter(), [1232, 470], -130);
  }
  return out;
}
export const CTX_OF = {hero: 'run', heroEnd: 'run', face: 'ign', faceFull: 'takeoff', rowcut: 'law', apart: 'throws', cam: 'cam', takeoff: 'takeoff'};
export const BTN_OF = {hero: 'hero', heroEnd: 'hero', face: 'face', faceFull: 'face', rowcut: 'face', apart: 'hero', cam: 'hero', takeoff: 'profile'};
export const SUB_OF = {rowcut: 'crank', apart: 'crank', cam: 'valve', face: 'ign'};

/** one frame of everything from the crank angle and the run's state. Shared by the film and the live tour. */
export function engineFrame({th, N, run, rate, spark, now}) {
  const s = stateAt(N, run);
  const fireScreen = s.fireHz * rate;
  const lit = glowOf(spark, now, th, fireScreen);
  return {s, lit, blur: blurOf(s.propRpm, rate)};
}

// ------------------------------------------------------------ the film
export function makeFilm() {
  return async ({canvas, capture}) => {
    await loadFonts();
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    if (window.__SIM_CONFIG?.clean) ui.root.style.display = 'none';
    window.R2800 = {st};
    return {
      resize,
      render(t) {
        const th = thetaAt(t);
        const tau = tauAt(t);
        const N = rpmAt(t);
        const run = runAtTau(tau);
        const rate = rateAt(t);
        const {s, lit, blur} = engineFrame({th, N, run, rate, spark: (c) => lastSpark(c, t), now: t});
        const view = camAtName(t);
        const since = camSince(t);
        const look = lookAtT(t);
        st.setCut(look.cut ? 'section' : 'solid', look.cut || 'profile');
        const camHi = look.focusK > 0.5 ? CYL.map((cy) => (cy.c === CAM_CYL ? {in: lift(cy.c, 'in', th), ex: lift(cy.c, 'ex', th)} : {in: 0, ex: 0})) : null;
        const fx = {th, vis: look.vis, apart: look.apart, hideRear: look.hideRear, focus: look.focus, focusK: look.focusK, glow: lit, headGlow: lit.map((g) => g * 0.85 * (1 - look.focusK)), blur, camHi, air: airAt(t), airK: 0, oil: th / 1440, oilK: 0};
        const c = camAt(t);
        st.frame(fx, {...c, az: c.az * D2R, el: c.el * D2R});
        const phase = phaseOf(tau);
        ui.update({
          ...s,
          th,
          lit,
          rate,
          phase,
          starter: starterAtTau(tau) > 0,
          ignition: tau >= RUN.ign,
          thrRpm: N,
          ctx: CTX_OF[view] || 'run',
          ctxArg: view === 'cam' ? 0 + CAM_CYL : view === 'rowcut' ? 'front' : undefined,
          sub: SUB_OF[view] || '',
          cut: look.cut ? 'section' : 'solid',
          camBtn: BTN_OF[view],
          layers: {cowl: false, callouts: true},
          caption: tr('cap:' + (view === 'hero' && phase !== 'stopped' ? phase : view)),
          callouts: calloutsFor(view, st, ss(1.2, 2.0, since) * (view === 'hero' && t > 1.5 ? 1 - ss(1.5, 2.0, t) : 1)),
          cursor: cursorAt(t),
        });
        return {};
      },
    };
  };
}
void E;
export const run = () => runSim(DEFAULTS, makeFilm());
