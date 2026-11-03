// Quantum (a photonic QPU after the public figures of Quandela's Belenos) as a page you drive: the film's machine and overlay, run in real time. Views along the photon's
// path, the cryostat cutaway (glass, section, solid), layers (callouts, isolate, doors, charts), photons per shot
// (2 to 5, the distribution recomputed by permanents), a new random circuit U, the HOM test with a delay sweep, pause
// and slow motion, an orbit you drag, a zoom on the wheel, H to hide the overlay. Left alone it plays the film's script
// as an auto tour with the operator's cursor, looped; a click, drag, wheel or key hands control to the visitor, 25 s of
// quiet hands it back.
import {warmComposer} from 'teardown-kit/warm.js';
import {CAMS, createConsole, CUTS, OVERLAYS, STAGES} from './console.js';
import {blend, calloutsFor, camAt, FOOT, histFacts, machineFrame, makeCursor, makeWorld, smoother, ss, VIEW_FN} from './film.js';
import {chipNs, homPc, hashU, PACKET} from './photonics.js';
import {camAtName, deltaAt, DURATION, N_FILM, rateAt, SCRIPT, SEED, SEGMENTS, tAtTau, tauAt} from './schedule.js';
import {createStage} from './stage.js';
import {createChrome} from '../../../shared/chrome.js';
import {LANG, T as tr} from './i18n.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
// slow motion: ns of physical time per second on screen; the photons slow further inside the 0.15 ns chip
const RATES = [0.05, 0.2, 1, 4, 12, 40, 150];
const CHIP_RATE = 0.05;
const ISO = {source: 'source', demux: 'demux', detect: 'detect'};

const CSS = (top) => `
html,body{margin:0;background:#ebecee linear-gradient(#f4f4f5,#ebecee 55%,#e2e3e6) fixed;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.tb{pointer-events:auto;cursor:pointer}
.tb:hover{filter:brightness(.95)}
.hit{position:absolute;pointer-events:auto;cursor:pointer}
.hit.ew{cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:${36 + top}px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:21px;padding:0 11px;border:1px solid #e1e3e6;background:rgba(255,255,255,.95);color:#16181b;font:600 8.8px Inter,sans-serif;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#6b3cf2}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#8b8f95;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
.busy{position:absolute;left:800px;top:440px;transform:translateX(-50%);padding:8px 14px;background:rgba(255,255,255,.95);border:1px solid #e1e3e6;font:600 10px Inter,sans-serif;letter-spacing:1.4px;color:#16181b;display:none}
`;

export function runLive() {
  const top = 0;
  const style = document.createElement('style');
  style.textContent = CSS(top);
  document.head.appendChild(style);
  document.title = tr('docTitle');
  document.documentElement.lang = LANG;
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createStage({canvas});
  const ui = createConsole(app);
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
  // the stage fits between the page's header and footer (shared/chrome.js)
  const chrome = createChrome({slug: 'quantum', name: 'Quantum', credit: tr('footCredit')});
  const fit = () => {
    const {top, bottom} = chrome.heights();
    const h = innerHeight - top - bottom;
    scale = Math.min(innerWidth / W, h / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${top + (h - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
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
  const busy = document.createElement('div');
  busy.className = 'busy';
  busy.textContent = tr('busy');
  ui.root.appendChild(busy);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = tr('turnPhone');
  document.body.appendChild(note);

  // ------------------------------------------------------------ the world: programs, and the live clock
  let nSel = N_FILM;
  let seed = SEED;
  let world = makeWorld(nSel, seed);
  let T = 0;
  // a run: one program, τ from 0, a history of (T, τ) for the afterglows
  const run = {pr: world.qc, tau: 30, T0: 0, hist: [], delta: 0, homLo: 0, homHi: 0};
  const newRun = (pr, tau0 = 0) => {
    run.pr = pr;
    run.tau = tau0;
    run.T0 = T;
    run.hist = [];
    run.homLo = run.homHi = run.delta;
  };
  const rebuild = (n, s) => {
    busy.style.display = 'block';
    setTimeout(() => {
      nSel = n;
      seed = s;
      world = makeWorld(nSel, seed);
      if (!run.pr.hom) newRun(world.qc);
      busy.style.display = 'none';
    }, 30);
  };
  const tOfLive = (tau) => {
    const h = run.hist;
    if (!h.length || tau < h[0][1]) return T - 10;
    let lo = 0;
    let hi = h.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (h[mid][1] <= tau) lo = mid;
      else hi = mid - 1;
    }
    const a = h[lo];
    const b = h[Math.min(h.length - 1, lo + 1)];
    return b[1] > a[1] ? a[0] + ((tau - a[1]) / (b[1] - a[1])) * (b[0] - a[0]) : a[0];
  };
  const tauAgo = (dt) => {
    const h = run.hist;
    const tt = T - dt;
    if (!h.length || tt < h[0][0]) return -1e9;
    let i = h.length - 1;
    while (i > 0 && h[i][0] > tt) i--;
    return h[i][1];
  };

  // ------------------------------------------------------------ state
  let rateI = 4;
  let paused = false;
  let view = 'hero';
  let viewAt = 0;
  let cut = 'section';
  const ov = {callouts: 1, isolate: 1, doors: 1, charts: 1};
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.hero(0)};
  let ring = {t: -9, x: 0, y: 0};
  let hidden = false;
  let doorK = 0;
  let isoK = 0;
  let isoG = '';
  let effRate = RATES[rateI];
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
    cut = 'section';
    Object.assign(ov, {callouts: 1, isolate: 1, doors: 1, charts: 1});
    Object.assign(off, {az: 0, el: 0, k: 1});
    if (nSel !== N_FILM || seed !== SEED) rebuild(N_FILM, SEED);
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const cyc = (T - AP.t0) % DURATION;
    const name = camAtName(cyc);
    view = name === 'tour' ? 'hero' : name;
    viewAt = T - (cyc - SCRIPT.filter((e) => e.cam && e.t <= cyc).pop().t);
    // carry on the run the tour was in
    const {seg, tau} = tauAt(cyc);
    const pr = SEGMENTS[seg].mode === 'hom' ? world.hom : world.qc;
    newRun(pr, tau);
    run.delta = deltaAt(cyc);
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
    const wasHom = view === 'hom';
    view = v;
    viewAt = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
    if (v === 'hom' && !wasHom) newRun(world.hom);
    if (v !== 'hom' && wasHom) newRun(world.qc, 30);
  };
  for (const k of CAMS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      setView(k);
    });
  for (const k of CUTS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      cut = k;
    });
  for (const k of OVERLAYS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      ov[k] = ov[k] ? 0 : 1;
    });
  ui.btn.pause.addEventListener('click', () => {
    takeOver();
    pulseBtn('pause');
    paused = !paused;
  });
  ui.btn.reseed.addEventListener('click', () => {
    takeOver();
    pulseBtn('reseed');
    if (view === 'hom') setView('chip');
    rebuild(nSel, (seed * 1664525 + 1013904223) >>> 0);
  });
  // the photon's path: click a stage to go there
  STAGES.forEach((x, i) => {
    const [cx, cy] = ui.stripSpot(i);
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${cx - 16}px`, top: `${cy - 16}px`, width: '32px', height: '32px', borderRadius: '50%'});
    d.addEventListener('click', () => {
      takeOver();
      pulse(cx, cy);
      setView(x.cam);
    });
    ui.root.appendChild(d);
  });
  const slider = (knobAt, apply) => {
    const [x0, y] = knobAt(0);
    const [x1] = knobAt(1);
    const d = document.createElement('div');
    d.className = 'hit ew';
    Object.assign(d.style, {left: `${x0 - 8}px`, top: `${y - 11}px`, width: `${x1 - x0 + 16}px`, height: '22px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      apply(clamp((x - x0) / (x1 - x0), 0, 1), false);
      lastInput = T;
    };
    d.addEventListener('pointerdown', (e) => {
      takeOver();
      d.setPointerCapture(e.pointerId);
      const up = (ev) => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        const [x] = toStage(ev.clientX, ev.clientY);
        apply(clamp((x - x0) / (x1 - x0), 0, 1), true);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
    ui.root.appendChild(d);
  };
  slider(ui.slowKnob, (k) => (rateI = Math.round(k * (RATES.length - 1))));
  let nDrag = nSel;
  slider(ui.nKnob, (k, done) => {
    nDrag = 2 + Math.round(k * 3);
    if (done && nDrag !== nSel) {
      if (view === 'hom') setView('chip');
      rebuild(nDrag, seed);
    }
  });
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = {1: 'hero', 2: 'source', 3: 'demux', 4: 'chip', 5: 'detect', 6: 'perceval', 7: 'hom'}[key];
    takeOver();
    if (v) setView(v);
    else if (key === ' ') paused = !paused;
    else if (key === 'h') hidden = !hidden;
    else if (key === 'arrowleft') rateI = clamp(rateI - 1, 0, RATES.length - 1);
    else if (key === 'arrowright') rateI = clamp(rateI + 1, 0, RATES.length - 1);
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
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -20, 60);
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
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.3, 2.5);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ the frame
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
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

    let tgt;
    let cursor;
    let since;
    let pr;
    let s;
    let ph;
    let tOf;
    let phAt;
    let rateNs;
    let delta;
    let tAcq;
    let homPts = [];
    if (AP.on) {
      // the film, exactly: its schedule, programs and camera
      const c = T - AP.t0;
      const loop = Math.floor(c / DURATION);
      const cyc = c - loop * DURATION;
      if (loop > AP.loop) AP.loop = loop;
      const {seg, tau} = tauAt(cyc);
      const sg = SEGMENTS[seg];
      pr = sg.mode === 'hom' ? world.hom : world.qc;
      const SH = pr.times.SHOT;
      s = Math.max(0, Math.floor(tau / SH));
      ph = tau - s * SH;
      delta = deltaAt(cyc);
      tOf = (x) => T - cyc + tAtTau(seg, x);
      phAt = (d) => (cyc - d < sg.t0 ? -1 : tauAt(cyc - d).tau - s * SH);
      rateNs = rateAt(cyc);
      const name = camAtName(cyc);
      view = name;
      const t0 = SCRIPT.filter((e) => e.cam && e.t <= cyc).pop().t;
      since = cyc - t0;
      tAcq = 6 + (cyc < 24.6 ? cyc : cyc - 6.4);
      if (pr.hom) for (let d = -0.45; d <= delta + 1e-6; d += 0.05) homPts.push([d, homPc(d) + (hashU(d * 91.7) * 2 - 1) * 0.006]);
      cursor = tourCursor(cyc);
      if (AP.loop > 0 && cyc < 0.8) {
        const end = tourCursor(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * k, y: end.y + (cursor.y - end.y) * k};
      }
      const mf0 = machineFrame({mac: st.mac, pr, s, ph, t: T, tOf, phAt, delta});
      tgt = camAt(cyc, {front: mf0.front});
      doorK = smoother((cyc - 3.5) / 1.7);
      const isoName = {source: 'source', demux: 'demux', detect: 'detect'}[name] || '';
      isoG = isoName || isoG;
      isoK = isoName ? ss(1.4, 2.2, since) : Math.max(0, isoK - dt / 0.8);
      run.pr = pr;
    } else {
      if (T - lastInput > IDLE) startTour();
      since = T - viewAt;
      pr = run.pr;
      const Tm = pr.times;
      // HOM: the delay sweeps back and forth; everything else: the slider's rate, slowed inside the chip
      if (pr.hom) {
        run.delta = 0.45 * Math.sin((T - run.T0) * 0.35 - Math.PI / 2);
        run.homLo = Math.min(run.homLo, run.delta);
        run.homHi = Math.max(run.homHi, run.delta);
      }
      delta = run.delta;
      const SH = Tm.SHOT;
      const phNow = run.tau % SH;
      const inChip = phNow > Tm.tArr - 0.6 && phNow < Tm.tOut + PACKET + 0.4 && view !== 'hom';
      const want = paused ? 0 : inChip && (view === 'chip' || view === 'perceval') ? Math.min(RATES[rateI], CHIP_RATE) : inChip ? Math.min(RATES[rateI], CHIP_RATE * 8) : RATES[rateI];
      effRate += (want - effRate) * (1 - Math.exp(-dt / 0.25));
      run.tau += effRate * dt;
      run.hist.push([T, run.tau]);
      while (run.hist.length > 2 && run.hist[0][0] < T - 4) run.hist.shift();
      s = Math.floor(run.tau / SH);
      ph = run.tau - s * SH;
      tOf = (x) => tOfLive(x);
      phAt = (d) => tauAgo(d) - s * SH;
      rateNs = Math.max(1e-6, effRate);
      tAcq = 6 + (T - run.T0);
      if (pr.hom) for (let d = Math.ceil(run.homLo / 0.05) * 0.05; d <= run.homHi + 1e-6; d += 0.05) homPts.push([d, homPc(d) + (hashU(d * 91.7) * 2 - 1) * 0.006]);
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
      const mf0 = machineFrame({mac: st.mac, pr, s, ph, t: T, tOf, phAt, delta});
      tgt = VIEW_FN[view](since, {front: mf0.front});
      tgt.az += off.az;
      tgt.el = clamp(tgt.el + off.el, -10, 85);
      tgt.d *= off.k;
      doorK += ((ov.doors ? 1 : 0) - doorK) * (1 - Math.exp(-dt / 0.3));
      const want2 = ov.isolate && ISO[view] ? 1 : 0;
      if (ISO[view]) isoG = ISO[view];
      isoK += (want2 - isoK) * (1 - Math.exp(-dt / 0.3));
    }
    const mf = machineFrame({mac: st.mac, pr, s, ph, t: T, tOf, phAt, delta});

    // the camera eases toward its target, logarithmically in distance (it travels from metres to millimetres)
    const k = 1 - Math.exp(-dt / (AP.on ? 0.12 : 0.4));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
    cam.d = Math.exp(Math.log(cam.d) + (Math.log(tgt.d) - Math.log(cam.d)) * k);
    st.setCut(cut);
    st.frame({...mf.fx, doors: doorK, iso: isoK > 0.002 ? isoG : '', isoK, heat: view === 'perceval' ? ((since - 1.0) / 3.0) % 1.2 : 0}, {...cam, az: cam.az * D2R, el: cam.el * D2R});

    ui.root.style.display = hidden ? 'none' : '';
    for (const n of ui.root.querySelectorAll('[data-g="charts"]')) n.style.visibility = ov.charts ? '' : 'hidden';
    const callVis = ov.callouts ? ss(1.4, 2.1, since) : 0;
    ui.update({
      times: pr.times,
      n: pr.n,
      nSel: AP.on ? N_FILM : nDrag,
      ph,
      shot: s,
      rateNs,
      stage: mf.stage,
      hom: !!pr.hom,
      homDelta: delta,
      homPts,
      hist: histFacts(pr, tAcq, mf.pat, ph, delta, s),
      prog: world.qc.prog,
      inputs: world.qc.inputs,
      cam: view,
      cut,
      overlays: {...ov},
      paused,
      slowText: AP.on ? tr('auto') : rateI === 0 ? '50 PS / S' : `${RATES[rateI] >= 1 ? RATES[rateI] : RATES[rateI] * 1000} ${RATES[rateI] >= 1 ? 'NS' : 'PS'} / S`,
      slowK: AP.on ? 0.5 : rateI / (RATES.length - 1),
      callouts: calloutsFor(view, st, st.mac, callVis),
      cursor,
      foot: pr.hom ? FOOT.hom : FOOT[mf.stage],
      scale: 1,
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
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, startTour, takeOver, get tier() {
    return tier;
  }, get T() {
    return T;
  }};
  void blend;
  void chipNs;
}
