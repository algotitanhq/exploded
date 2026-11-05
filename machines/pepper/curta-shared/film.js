// Pepper, the explorer film (a Curta Type I after the public sources): the machine (curta.js) on the catalogue stage
// (stage.js) under the spec sheet (console.js). One input, the crank angle θ and the discrete state of the plan
// (schedule.js, machine.js), poses every part, every digit and every carry. An operator sets 1 234, multiplies it by
// 56, takes one turn back with the crank pulled up, clears the machine with the ring. A pure function of t.
import * as THREE from 'three';
import {runSim} from 'teardown-kit/runtime.js';
import {createConsole} from './console.js';
import {L, azOf, yRow} from './curta.js';
import {G, ss, state} from './machine.js';
import {DURATION, SCRIPT, beatAt, filmFacts, filmPlan} from './schedule.js';
import {createStage} from './stage.js';
import {T as tr} from './i18n.js';

export {DURATION, SCRIPT};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'pepper', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const V3 = THREE.Vector3;
const P = (r, a, y) => new V3(r * Math.sin(a * D2R) * 0.001, y * 0.001, r * Math.cos(a * D2R) * 0.001);
export {ss};

// ------------------------------------------------------------ subsystems: a view, a cut, an explosion
export const SUB = {
  crank: {view: 'hero', cut: 'solid'},
  sliders: {view: 'sliders', cut: 'solid'},
  drum: {view: 'drumX', cut: 'solid', explode: 1, dof: 1, iso: 1, isoStations: [1, 2, 3, 4]},
  gears: {view: 'gears', cut: 'glass', dof: 0.8, iso: 1, isoStations: [2]},
  carry: {view: 'carry', cut: 'section', dof: 0.7, top: 1},
  carriage: {view: 'top', cut: 'solid'},
  reset: {view: 'reset', cut: 'solid'},
};
export const VIEW_CFG = {
  hero: {view: 'hero', cut: 'solid'},
  top: {view: 'top', cut: 'solid'},
  macro: {view: 'macro', cut: 'glass', dof: 1, iso: 0.7, isoStations: [1, 2, 3, 4]},
  axial: {view: 'axial', cut: 'section'},
};
export const cfgOf = (e) => (e.sub ? {...SUB[e.sub], sub: e.sub, btn: e.sub} : {...VIEW_CFG[e.view], vbtn: e.view, btn: e.view});

// ------------------------------------------------------------ views, each a function of u (seconds since it came on) and the state
const cascadeAz = (S) => {
  // the camera follows the carry tooth around the drum
  const th = S.turn ? S.turn.th : 0;
  const s = Math.min(10.5, Math.max(2.5, (th - G.carry0) / G.pitch + 1));
  return azOf(s) + 10;
};
export const VIEW_FN = {
  hero: (u) => ({tx: 0, ty: 0.05, tz: 0, az: 30 + 1.5 * Math.min(u, 8), el: 24 + 0.3 * Math.min(u, 8), d: 0.385, sx: 0, sy: -30}),
  sliders: (u) => ({tx: 0, ty: 0.034, tz: 0.004, az: 16 - 1.4 * Math.min(u, 4), el: 7, d: 0.3, sx: 0, sy: -14}),
  drumX: (u) => ({tx: 0, ty: 0.042 - 0.004 * ss(0, 6, u), tz: 0, az: 36 - 2.6 * Math.min(u, 7), el: 12 + 1.2 * Math.min(u, 6), d: 0.19 - 0.006 * Math.min(u, 6), sx: 0, sy: -14}),
  macro: (u) => ({tx: 0, ty: 0.034, tz: 0, az: 30 - 2 * Math.min(u, 6), el: 12, d: 0.15, sx: 0, sy: 10}),
  gears: (u) => {
    const p = P(L.shaftR, azOf(2), yRow(3));
    return {tx: p.x, ty: p.y, tz: p.z, az: azOf(2) + 16 - 2 * Math.min(u, 5), el: 10, d: 0.09, sx: 0, sy: 10};
  },
  carry: (u, S) => ({tx: 0, ty: 0.05 - 0.002 * ss(0, 4, u), tz: 0, az: cascadeAz(S), el: 28, d: 0.16, sx: 0, sy: -16}),
  top: (u) => ({tx: 0, ty: 0.07, tz: 0.004, az: 8 + 1.0 * Math.min(u, 10), el: 60, d: 0.265, sx: 0, sy: -60}),
  axial: (u) => ({tx: 0, ty: 0.047, tz: 0, az: 18 - 1.2 * Math.min(u, 5), el: 6, d: 0.31, sx: 0, sy: -22}),
  reset: (u) => ({tx: 0, ty: 0.078, tz: 0, az: -36 + 2.2 * Math.min(u, 6), el: 40, d: 0.28, sx: 0, sy: -22}),
};
const BEATS = SCRIPT.map((e) => [e.t, cfgOf(e)]);
export function blend(a, b, k) {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : key === 'd' ? Math.exp(Math.log(a.d) + (Math.log(b.d) - Math.log(a.d)) * k) : a[key] + (b[key] - a[key]) * k;
  return o;
}
const camOf = (i, t, S) => VIEW_FN[BEATS[i][1].view](t - BEATS[i][0], S);
export const camAt = (t, S) => {
  let i = 0;
  while (i < BEATS.length - 1 && BEATS[i + 1][0] <= t) i++;
  const cur = camOf(i, t, S);
  if (i === 0) return cur;
  const k = ss(BEATS[i][0], BEATS[i][0] + 1.6, t);
  return k >= 1 ? cur : blend(camOf(i - 1, t, S), cur, k);
};
/** cut, glass, explode, dof at t, eased between beats */
export const fxAt = (t) => {
  let i = 0;
  while (i < BEATS.length - 1 && BEATS[i + 1][0] <= t) i++;
  const c = BEATS[i][1];
  const p = i ? BEATS[i - 1][1] : c;
  const k = i ? ss(BEATS[i][0] + 0.2, BEATS[i][0] + 1.7, t) : 1;
  const mix = (key) => (p[key] ?? 0) + ((c[key] ?? 0) - (p[key] ?? 0)) * k;
  const glass = (x) => (x.cut === 'glass' ? 1 : 0);
  return {
    cut: k > 0.25 ? c.cut : p.cut,
    glass: glass(p) + (glass(c) - glass(p)) * k,
    explode: mix('explode'),
    dof: mix('dof'),
    iso: mix('iso'),
    isoStations: (k > 0.5 ? c : p).isoStations ?? c.isoStations,
    ghost: {carriage: 1 - 0.9 * mix('top'), ring: 1 - 0.9 * mix('top'), crank: 1 - 0.85 * mix('top')},
    sub: c.sub,
    view: c.vbtn,
    since: t - BEATS[i][0],
  };
};

// ------------------------------------------------------------ the operator's pointer: a click on the button of each beat
const REST = [[820, 470], [760, 520], [880, 440], [700, 500]];
export function makeCursor(ui, script = SCRIPT) {
  const EV = script.filter((e) => e.t > 0).map((e) => ({t: e.t, spot: ui.spots[e.sub || e.view]}));
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

// ------------------------------------------------------------ callouts per view
export function calloutsFor(view, st, S, vis) {
  const g = st.mac.groups;
  const A = st.mac.A;
  const W = (grp, v) => g[grp].localToWorld(v.clone());
  const out = [];
  const c = (key, at, label, w, acc = false, args = []) => {
    const [name, sub] = tr(key, ...args);
    out.push({name, sub, at: at && st.project(at), label, w, o: vis, acc});
  };
  if (view === 'hero') {
    c('cCrank', W('crank', A.crank), [1210, 120], -160);
    c('cCarriage', W('carriage', A.carriage(-40)), [1210, 340], -170);
    c('cSliders', W('shell', A.sliders), [390, 470], 170);
  } else if (view === 'sliders') {
    c('cSlider', W('shell', A.sliders), [390, 150], 170, false, [S.set[2]]);
    c('cTape', W('shell', A.band.clone().setY(50)), [1210, 150], -170);
  } else if (view === 'drumX' || view === 'macro') {
    c('cDrum', W('drum', A.drum), [390, 600], 190, true);
    c('cGear', W('shafts', new V3(L.shaftR * Math.sin(azOf(1) * D2R), yRow(S.set[0]), L.shaftR * Math.cos(azOf(1) * D2R))), [1210, 520], -180);
  } else if (view === 'gears') {
    c('cGear', W('shafts', new V3(L.shaftR * Math.sin(azOf(2) * D2R), yRow(S.set[1]), L.shaftR * Math.cos(azOf(2) * D2R))), [390, 160], 180);
  } else if (view === 'carry') {
    // the carry in flight, else the last one taken this turn
    const cy = S.active?.carry || (S.turn && S.turn.ev.carries.filter((x) => x.at <= S.turn.th).pop());
    if (cy) c('cLever', W('shafts', A.lever(cy.station)), [390, 140], 180, true, [cy.col]);
    c('cBell', W('drum', A.drumTop), [390, 640], 180);
  } else if (view === 'top') {
    c('cResult', A.result(1), [1210, 200], -170);
    c('cCounter', A.counter(6), [390, 560], 180);
  } else if (view === 'axial') {
    c('cRise', W('drum', A.drum), [390, 610], 180, true);
  } else if (view === 'reset') {
    c('cRing', W('ring', A.ring), [390, 160], 180);
  }
  return out;
}

// ------------------------------------------------------------ captions on the film's timeline
export const CAPTIONS = [
  [0, 'c:hero'],
  [2.2, 'c:set'],
  [4.8, 'c:drum'],
  [8.0, 'c:drum2'],
  [11.3, 'c:turns'],
  [14.9, 'c:carriage'],
  [17.7, 'c:turns2'],
  [21.2, 'c:pull'],
  [22.9, 'c:sub'],
  [25.0, 'c:cascade'],
  [29.5, 'c:sum'],
  [30.8, 'c:clear'],
  [34.4, 'c:end'],
];
export const captionAt = (t, facts) => {
  const c = CAPTIONS.filter(([a]) => a <= t).pop();
  return tr(c[1], facts);
};

// ------------------------------------------------------------ the film
export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    if (window.__SIM_CONFIG?.clean) ui.root.style.display = 'none';
    const plan = filmPlan();
    const facts = filmFacts(plan);
    const lastHist = plan.steps.find((s) => s.kind === 'clear').s0.hist;
    window.PEPPER = {st, plan};
    return {
      resize,
      render(t) {
        const S = state(plan, t);
        const fx = fxAt(t);
        const c = camAt(t, S);
        st.setCut(fx.cut);
        st.frame(S, {...fx}, {...c, az: c.az * D2R, el: c.el * D2R});
        const b = beatAt(t);
        const view = cfgOf(b).view;
        ui.update({
          S,
          sub: fx.sub,
          view: fx.view,
          cut: fx.cut,
          explode: fx.explode,
          paused: false,
          lastHist: t > 30.8 ? lastHist : null,
          callouts: calloutsFor(view, st, S, ss(1.3, 2.0, fx.since) * (1 - ss(-0.5, 0, t - (SCRIPT.find((e) => e.t > t)?.t ?? 99)))),
          cursor: cursorAt(t),
          caption: captionAt(t, facts),
          handNote: tr('handFilm'),
        });
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
