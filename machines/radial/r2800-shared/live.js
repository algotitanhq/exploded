// Radial as a page you drive: the film's engine and overlay, run in real time. The starter, the magnetos and the
// throttle drive the one input (the crank angle, integrated from the engine speed each frame); slow motion, pause,
// the seven subsystems, the cutaways (glass, section, solid), four views, the cowling, orbit and zoom, H to hide the
// overlay. Left alone it plays the film's script as an auto tour with the operator's cursor, looped; a click, drag,
// wheel or key hands control to the visitor, with the engine as the tour left it; 25 s of quiet hands it back.
import {warmComposer} from 'teardown-kit/warm.js';
import {CAMS, createConsole, CUTS, LAYERS, SUBS} from './console.js';
import {CYL, FIRE, lift, ORDER, RATING, SPARK_ADV} from './engine.js';
import {calloutsFor, CAM_CYL, camAt, CTX_OF, engineFrame, lookAtT, makeCursor, phaseOf, smoother, ss, SUB_OF, BTN_OF, VIEW_FN, blendLook, LOOK} from './film.js';
import {loadFonts} from './fonts.js';
import {airAt, camAtName, camSince, DURATION, lastSpark, rateAt, rpmAt, RUN, runAtTau, SCRIPT, starterAtTau, tauAt, thetaAt} from './schedule.js';
import {createStage} from './stage.js';
import {createChrome} from '../../../shared/chrome.js';
import {LANG, T as tr} from './i18n.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const RATES = [1, 1 / 4, 1 / 10, 1 / 25, 1 / 40];
// what each subsystem button shows: its own parts solid, the case and the cylinders as ghosts, the rest hidden
const ALL = {case: 1, crank: 1, cyl: 1, valve: 1, ign: 1, air: 1, prop: 1, nose: 1, oil: 1, stand: 1, cowl: 0, baffle: 1};
const ISO = {
  crank: {case: 0.1, cyl: 0.12, valve: 0, ign: 0, air: 0, prop: 0.12, nose: 0.1, oil: 0, baffle: 0, stand: 0.5},
  cyl: {case: 0.5, crank: 0, valve: 0.35, ign: 0, air: 0.25, prop: 0.2, nose: 0.4, oil: 0, stand: 0.5},
  valve: {case: 0.12, cyl: 0.16, crank: 0, ign: 0, air: 0, prop: 0.1, nose: 0.1, oil: 0, baffle: 0, stand: 0.5},
  ign: {case: 0.5, cyl: 0.4, crank: 0, valve: 0.25, air: 0.15, prop: 0.25, nose: 0.5, oil: 0, baffle: 0, stand: 0.5},
  air: {case: 0.35, cyl: 0.35, crank: 0, valve: 0.15, ign: 0, air: 0.4, prop: 0.2, nose: 0.3, oil: 0, baffle: 0, stand: 0.5},
  prop: {case: 0.3, cyl: 0.3, crank: 0.4, valve: 0, ign: 0, air: 0.2, nose: 0.15, oil: 0, baffle: 0, stand: 0.5},
  oil: {case: 0.18, cyl: 0.12, crank: 0.4, valve: 0, ign: 0, air: 0.12, prop: 0.12, nose: 0.15, baffle: 0, stand: 0.5},
};
const CTX_SUB = {crank: 'law', cyl: 'cyl', valve: 'cam', ign: 'ign', air: 'air', prop: 'prop', oil: 'oil'};
const PLANE = {face: 'rowcut', hero: 'profile', profile: 'profile', inside: 'inside'};
const INSIDE_CYL = 2;

const CSS = (top) => `
html,body{margin:0;background:#e9eef1 linear-gradient(#e4ebf0,#edf0f0 55%,#f3ece1) fixed;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.tb{pointer-events:auto;cursor:pointer}
.tb:hover{filter:brightness(.93)}
.hit{position:absolute;pointer-events:auto;cursor:pointer}
.hit.ew{cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:${30 + top}px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;height:24px;padding:0 12px;border:1.5px solid #2b2f34;background:rgba(246,243,234,.96);color:#22262b;font:700 12px 'Barlow Condensed',sans-serif;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:7px;height:7px;border-radius:50%;background:#0a8fe0}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:700 13px/1.4 'Barlow Condensed',sans-serif;letter-spacing:1px;color:#777b80;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export async function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS(0);
  document.head.appendChild(style);
  document.title = tr('docTitle');
  document.documentElement.lang = LANG;
  await loadFonts();
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createStage({canvas});
  const ui = createConsole(app, {live: true});
  const tourCursor = makeCursor(ui);

  // ------------------------------------------------------------ quality tiers
  const TIERS = [
    {samples: 8, ao: true, shadow: 4096, pr: 2},
    {samples: 4, ao: false, shadow: 2048, pr: 1.5},
    {samples: 2, ao: false, shadow: 1024, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let scale = 1;
  const chrome = createChrome({slug: 'radial', name: 'Radial', credit: tr('footCredit')});
  const fit = () => {
    const {top, bottom} = chrome.heights();
    const h = innerHeight - top - bottom;
    scale = Math.min(innerWidth / W, h / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${top + (h - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    void pr;
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = tr('turnPhone');
  document.body.appendChild(note);

  // ------------------------------------------------------------ the engine, live: θ integrated from N each frame
  const E = {th: 6, N: 0, target: RATING.idle, ign: false, starter: false, run: 0, air: 0, sparks: CYL.map(() => null), n: 0};
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const stepEngine = (dtau, T) => {
    const running = E.ign && E.run > 0.55;
    if (E.starter && E.run >= 1) E.starter = false;
    let want = 0;
    let tc = 1.2;
    if (running) {
      want = E.target;
      tc = want > E.N ? 0.9 : 1.1;
    } else if (E.starter) {
      want = RATING.crank;
      tc = 0.35;
    }
    E.N += (want - E.N) * (1 - Math.exp(-dtau / tc));
    if (!running && !E.starter && E.N < 25) E.N = Math.max(0, E.N - 40 * dtau);
    if (E.ign && E.N > 80) E.run = Math.min(1, E.run + dtau / 1.0);
    if (!E.ign) E.run = Math.max(0, E.run - dtau / 0.4);
    const th0 = E.th;
    E.th += E.N * 6 * dtau;
    E.air += (E.N / 60) * dtau * 0.2;
    // the sparks this step crossed: each lights its charge with the engine's chance of catching
    if (E.ign) {
      const pCatch = 0.12 + 0.88 * smoother(E.run / 0.8);
      for (const c of ORDER) {
        const base = FIRE[c] - SPARK_ADV;
        let m = Math.ceil((th0 - base) / 720);
        for (let k = 0; k < 4; k++, m++) {
          const ths = base + 720 * m;
          if (ths > E.th) break;
          if (ths <= th0) continue;
          const f = (ths - th0) / Math.max(1e-9, E.th - th0);
          E.sparks[c - 1] = {t: T - (1 - f) * frameDt, th: ths, lit: hash(m * 18 + ORDER.indexOf(c) + 7 + E.n * 0.0) < pCatch};
        }
      }
    }
  };
  let frameDt = 1 / 60;

  // ------------------------------------------------------------ state
  let T = 0;
  let rateI = 3;
  let paused = false;
  let view = 'hero';
  let viewAt = 0;
  let cut = 'solid';
  let sub = '';
  const layers = {cowl: false, callouts: true};
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.hero(0)};
  let ring = {t: -9, x: 0, y: 0};
  let hidden = false;
  const visNow = {...ALL};
  const pulse = (x, y) => (ring = {t: T, x, y});
  const pulseBtn = (k) => pulse(...ui.spots[k]);

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0, loop: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.loop = 0;
    paused = false;
    cut = 'solid';
    sub = '';
    layers.cowl = false;
    layers.callouts = true;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const cyc = (T - AP.t0) % DURATION;
    const name = camAtName(cyc);
    view = {face: 'face', faceFull: 'face', rowcut: 'face', apart: 'hero', cam: 'hero', takeoff: 'profile', heroEnd: 'hero'}[name] || 'hero';
    viewAt = T - 10;
    sub = {rowcut: 'crank', cam: 'valve'}[name] || '';
    cut = name === 'rowcut' ? 'section' : 'solid';
    for (const g of Object.keys(ALL)) visNow[g] = sub ? (ISO[sub][g] ?? 1) : ALL[g];
    // the engine carries on where the tour left it
    const tau = tauAt(cyc);
    Object.assign(E, {th: thetaAt(cyc), N: rpmAt(cyc), ign: tau >= RUN.ign, starter: starterAtTau(tau) > 0, run: runAtTau(tau), air: airAt(cyc)});
    E.target = clamp(Math.round(E.N / 50) * 50, RATING.idle, RATING.takeoff.rpm);
    rateI = RATES.reduce((b, r, i) => (Math.abs(Math.log(r / rateAt(cyc))) < Math.abs(Math.log(RATES[b] / rateAt(cyc))) ? i : b), 0);
    for (const cy of CYL) {
      const s = lastSpark(cy.c, cyc);
      E.sparks[cy.c - 1] = {t: T - (cyc - s.t), th: s.th, lit: s.lit};
    }
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip) takeOver();
  });

  // ------------------------------------------------------------ controls
  const setView = (v) => {
    view = v;
    viewAt = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
    if (v === 'inside') cut = 'section';
  };
  const on = (k, fn) =>
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      fn();
    });
  for (const k of CAMS) on(k, () => setView(k));
  for (const k of CUTS) on(k, () => (cut = k));
  for (const k of SUBS) on(k, () => (sub = sub === k ? '' : k));
  for (const k of LAYERS) on(k, () => (layers[k] = !layers[k]));
  on('pause', () => (paused = !paused));
  on('starter', () => {
    if (E.run < 1) E.starter = !E.starter;
  });
  on('ignition', () => (E.ign = !E.ign));
  on('slowmo', () => (rateI = (rateI + 1) % RATES.length));
  {
    const {SL} = ui;
    const d = document.createElement('div');
    d.className = 'hit ew';
    Object.assign(d.style, {left: `${SL.x - 8}px`, top: '840px', width: `${SL.w + 16}px`, height: '26px'});
    const apply = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      const k = clamp((x - SL.x) / SL.w, 0, 1);
      E.target = Math.round((RATING.idle + k * (RATING.takeoff.rpm - RATING.idle)) / 50) * 50;
      lastInput = T;
    };
    d.addEventListener('pointerdown', (e) => {
      takeOver();
      d.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', apply);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', apply);
      addEventListener('pointerup', up);
      apply(e);
    });
    ui.root.appendChild(d);
  }
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = {1: 'face', 2: 'hero', 3: 'profile', 4: 'inside'}[key];
    takeOver();
    if (v) setView(v);
    else if (key === ' ') paused = !paused;
    else if (key === 'h') hidden = !hidden;
    else if (key === 's') E.starter = E.run < 1 && !E.starter;
    else if (key === 'm') E.ign = !E.ign;
    else if (key === 'arrowleft') rateI = clamp(rateI + 1, 0, RATES.length - 1);
    else if (key === 'arrowright') rateI = clamp(rateI - 1, 0, RATES.length - 1);
    else if (key === 'arrowup') E.target = clamp(E.target + 100, RATING.idle, RATING.takeoff.rpm);
    else if (key === 'arrowdown') E.target = clamp(E.target - 100, RATING.idle, RATING.takeoff.rpm);
    else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az += ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -25, 60);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.5);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ the frame
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    frameDt = dt;
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    let th;
    let N;
    let run;
    let rate;
    let spark;
    let tgt;
    let cursor;
    let fxLook;
    let caption = '';
    let calloutView;
    let since;
    let phase;
    let ctx;
    let ctxArg;
    let camBtn;
    let camHi = null;
    let starterOn;
    let ignOn;
    let air;
    let thr;
    if (AP.on) {
      // the film, exactly: its run, its look, its camera
      const c = T - AP.t0;
      const loop = Math.floor(c / DURATION);
      const cyc = c - loop * DURATION;
      if (loop > AP.loop) AP.loop = loop;
      th = thetaAt(cyc);
      const tau = tauAt(cyc);
      N = rpmAt(cyc);
      run = runAtTau(tau);
      rate = rateAt(cyc);
      spark = (cc) => {
        const s = lastSpark(cc, cyc);
        return {t: T - (cyc - s.t), th: s.th, lit: s.lit};
      };
      const name = camAtName(cyc);
      since = camSince(cyc);
      fxLook = lookAtT(cyc);
      tgt = camAt(cyc);
      cursor = tourCursor(cyc);
      if (AP.loop > 0 && cyc < 0.8) {
        const end = tourCursor(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * k, y: end.y + (cursor.y - end.y) * k};
      }
      phase = phaseOf(tau);
      caption = tr('cap:' + (name === 'hero' && phase !== 'stopped' ? phase : name));
      calloutView = name;
      ctx = CTX_OF[name] || 'run';
      ctxArg = name === 'cam' ? CAM_CYL : name === 'rowcut' ? 'front' : undefined;
      camBtn = BTN_OF[name];
      if (fxLook.focusK > 0.5) camHi = CYL.map((cy) => (cy.c === CAM_CYL ? {in: lift(cy.c, 'in', th), ex: lift(cy.c, 'ex', th)} : {in: 0, ex: 0}));
      starterOn = starterAtTau(tau) > 0;
      ignOn = tau >= RUN.ign;
      air = airAt(cyc);
      thr = N;
      st.setCut(fxLook.cut ? 'section' : 'solid', fxLook.cut || 'profile');
      sub = SUB_OF[name] || '';
      if (name === 'hero' && cyc > 1.5) since = -1;
    } else {
      if (T - lastInput > IDLE) startTour();
      rate = paused ? 0 : RATES[rateI];
      stepEngine(dt * rate, T);
      th = E.th;
      N = E.N;
      run = E.run;
      spark = (cc) => E.sparks[cc - 1];
      since = T - viewAt;
      // the look: the subsystem's, eased
      const want = sub ? {...ALL, ...ISO[sub], [sub]: 1} : {...ALL};
      want.cowl = layers.cowl ? 1 : 0;
      if (sub === 'prop') want.nose = 0.15;
      const kk = 1 - Math.exp(-dt / 0.25);
      for (const g of Object.keys(ALL)) visNow[g] += ((want[g] ?? 1) - visNow[g]) * kk;
      fxLook = {vis: {...visNow}, apart: 0, hideRear: 0, focus: 0};
      tgt = VIEW_FN[view](since);
      tgt.az += off.az;
      tgt.el = clamp(tgt.el + off.el, -20, 85);
      tgt.d *= off.k;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
      phase = !E.ign && !E.starter && N < 1 ? 'stopped' : E.starter && E.run < 0.55 ? (E.ign ? 'ignition' : 'starter') : N > E.target + 60 ? 'back' : N < E.target - 60 ? 'climb' : N > 2500 ? 'takeoff' : 'idle';
      calloutView = view === 'hero' ? 'hero' : view === 'face' ? 'face' : '';
      ctx = sub ? CTX_SUB[sub] : N > 1500 ? 'takeoff' : 'run';
      ctxArg = sub === 'valve' ? INSIDE_CYL : sub === 'crank' ? 'front' : undefined;
      camBtn = view;
      if (sub === 'valve') camHi = CYL.map((cy) => ({in: lift(cy.c, 'in', th), ex: lift(cy.c, 'ex', th)}));
      starterOn = E.starter;
      ignOn = E.ign;
      air = E.air;
      thr = E.target;
      if (cut === 'section') {
        if (view === 'inside') {
          const a = CYL[INSIDE_CYL - 1].angle * D2R;
          st.planes.inside.normal.set(-Math.cos(a), -Math.sin(a), 0);
          st.planes.inside.constant = 0;
        }
        st.setCut('section', PLANE[view] + (view === 'inside' ? '' : ''));
      } else st.setCut('solid');
    }
    const {s, lit, blur} = engineFrame({th, N, run, rate: Math.max(rate, 1e-4), spark, now: T});

    // the camera eases toward its target
    const k = 1 - Math.exp(-dt / (AP.on ? 0.1 : 0.35));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'sx', 'sy']) cam[key] += ((tgt[key] ?? 0) - (cam[key] ?? 0)) * k;
    cam.fov = (cam.fov ?? 26) + ((tgt.fov ?? 26) - (cam.fov ?? 26)) * k;
    cam.d = Math.exp(Math.log(cam.d) + (Math.log(tgt.d) - Math.log(cam.d)) * k);
    const fx = {
      th,
      vis: fxLook.vis,
      apart: fxLook.apart,
      hideRear: fxLook.hideRear,
      focus: fxLook.focus,
      focusK: fxLook.focusK ?? 0,
      glass: !AP.on && cut === 'glass',
      glow: lit,
      headGlow: lit.map((g) => g * 0.85 * (1 - (fxLook.focusK ?? 0))),
      blur,
      camHi,
      air,
      airK: !AP.on && sub === 'air' ? 1 : 0,
      oil: th / 1440,
      oilK: !AP.on && sub === 'oil' ? 1 : 0,
    };
    st.frame(fx, {...cam, az: cam.az * D2R, el: cam.el * D2R});

    ui.root.style.display = hidden ? 'none' : '';
    const callVis = layers.callouts && calloutView && since >= 0 ? ss(1.2, 2.0, since) : 0;
    ui.update({
      ...s,
      th,
      lit,
      rate: Math.max(rate, 1e-4),
      phase,
      starter: starterOn,
      ignition: ignOn,
      thrRpm: thr,
      ctx,
      ctxArg,
      sub,
      cut: AP.on ? (fxLook.cut ? 'section' : 'solid') : cut,
      camBtn,
      layers: {...layers},
      paused,
      slowmo: rate < 0.98,
      caption,
      callouts: calloutView ? calloutsFor(calloutView, st, callVis) : [],
      cursor,
    });
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? `<i></i>${tr('tourOn')}` : tr('tourOff');
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  st.frame({th: 6, vis: ALL, glow: CYL.map(() => 0), headGlow: CYL.map(() => 0), blur: 0}, {...cam, az: cam.az * D2R, el: cam.el * D2R});
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {
    st,
    cam,
    E,
    startTour,
    takeOver,
    get tier() {
      return tier;
    },
    get T() {
      return T;
    },
  };
  void blendLook;
  void LOOK;
  void SCRIPT;
}
