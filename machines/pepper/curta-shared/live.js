// Pepper (a Curta Type I after the public sources) as a page you drive: the film's machine and sheet, run in real
// time. Your hand: one turn of the crank, the crank pulled up or pushed down, the carriage one notch either way, the
// clearing ring, the setting drums (click the upper half of a digit for +1, the lower half for −1). The subsystem
// buttons open each part (view, cut, explosion, isolation); the body can be solid, glass, cut or exploded; drag to
// turn the machine, wheel to zoom, H to hide the sheet. Every action becomes a step of the same plan the film uses
// (machine.js), so every digit and every carry still comes from the model. Left alone it plays the film as an auto
// tour with the operator's cursor, looped; a click, drag, wheel or key hands control to the visitor, 25 s of quiet
// hands it back.
import {warmComposer} from 'teardown-kit/warm.js';
import {ACTS, CUTS, SUBS, VIEWS, createConsole} from './console.js';
import {SUB, VIEW_CFG, VIEW_FN, calloutsFor, camAt, captionAt, fxAt, makeCursor} from './film.js';
import {CURTA, createPlan, fromDigits, state, turnEvents} from './machine.js';
import {DURATION, SCRIPT, beatAt, filmFacts, filmPlan} from './schedule.js';
import {createStage} from './stage.js';
import {createChrome} from '../../../shared/chrome.js';
import {LANG, nf, T as tr} from './i18n.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const ss = (a, b, t) => {
  const u = clamp((t - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

const CSS = (top) => `
html,body{margin:0;background:#e9e7e2 linear-gradient(#efeeea,#e9e7e2 58%,#dedbd4) fixed;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.tb{pointer-events:auto;cursor:pointer}
.tb:hover{border-color:#8a877f}
.hit{position:absolute;pointer-events:auto;cursor:pointer}
.tourchip{position:absolute;left:800px;top:${18 + top}px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 12px;border:1px solid #d9d5cc;border-radius:11px;background:rgba(246,244,239,.95);color:#1b1a17;font:600 9px Inter,sans-serif;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#b07a1c}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 Inter,sans-serif;letter-spacing:1px;color:#8a877f;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS(0);
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
    {samples: 8, ao: true, shadow: 2048, dof: true, pr: 2},
    {samples: 4, ao: false, shadow: 1024, dof: true, pr: 1.5},
    {samples: 2, ao: false, shadow: 1024, dof: false, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let scale = 1;
  const chrome = createChrome({slug: 'pepper', name: 'Pepper', credit: tr('footCredit')});
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
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = tr('turnPhone');
  document.body.appendChild(note);

  // ------------------------------------------------------------ the plans: the film's (the tour) and the visitor's
  const film = filmPlan();
  const facts = filmFacts(film);
  const filmHist = film.steps.find((s) => s.kind === 'clear').s0.hist;
  let T = 0;
  let mT = 0; // the machine's clock (stops on pause)
  let plan = null; // the visitor's plan, on the machine clock
  let handoff = null; // {t1, cyc0, T0}: the film's step still finishing after a takeover
  const snap = (s) => ({set: s.set.slice(), up: s.up, p: s.p, reg: s.reg.slice(), ctr: s.ctr.slice(), arms: s.arms.slice(), shaft: s.shaft.slice(), turnsDone: s.turnsDone, hist: s.hist.slice()});

  // ------------------------------------------------------------ state
  let paused = false;
  let sub = 'crank';
  let vbtn = null;
  let view = 'hero';
  let viewAt = 0;
  let cut = 'solid';
  let explodeOn = 0;
  const cfg = {...SUB.crank};
  const fxs = {glass: 0, explode: 0, dof: 0, iso: 0, top: 0};
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.hero(0)};
  let ring = {t: -9, x: 0, y: 0};
  let hidden = false;
  const pulse = (x, y) => (ring = {t: T, x, y});
  const pulseBtn = (k) => ui.spots[k] && pulse(...ui.spots[k]);
  let handNote = tr('handFilm');

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0, loop: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.loop = 0;
    paused = false;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const cyc = (T - AP.t0) % DURATION;
    const b = beatAt(cyc);
    sub = b.sub || null;
    vbtn = b.view || null;
    Object.assign(cfg, b.sub ? SUB[b.sub] : VIEW_CFG[b.view]);
    view = cfg.view;
    viewAt = T - (cyc - b.t);
    cut = cfg.cut;
    explodeOn = cfg.explode ?? 0;
    // the machine carries on: the step in progress finishes as in the film, then the visitor's plan takes over
    const S = state(film, cyc);
    const step = S.step >= 0 && cyc <= film.steps[S.step].t1 ? film.steps[S.step] : null;
    mT = 0;
    if (step) {
      handoff = {t1: step.t1 - cyc, cyc0: cyc};
      plan = createPlan(snap(step.s1));
    } else {
      handoff = null;
      plan = createPlan(snap(S));
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

  // ------------------------------------------------------------ the hand: every action is a step of the plan
  const queueAt = () => {
    const last = plan.steps[plan.steps.length - 1];
    return Math.max(mT, handoff ? handoff.t1 : 0, last ? last.t1 + 0.04 : 0);
  };
  const act = (kind, extra, dur) => {
    if (!plan) return;
    const t0 = queueAt();
    if (t0 - mT > 4) return; // a long queue: drop the extra clicks
    plan.add({kind, t0, t1: t0 + dur, ...extra});
  };
  const end = () => plan.end;
  const doTurn = () => act('turns', {n: 1}, 0.62);
  const doPull = () => act('crank', {up: !end().up}, 0.45);
  const doCar = (dp) => {
    const to = end().p + dp;
    if (to < 1 || to > CURTA.counter) {
      handNote = tr('handFull');
      return;
    }
    act('carriage', {to}, 1.3);
  };
  const doClear = () => act('clear', {}, 2.2);
  const doSet = (i, dd) => {
    const to = end().set.slice();
    to[i] = (to[i] + dd + 10) % 10;
    act('slide', {to}, 0.32);
  };
  const ACT = {turn: doTurn, pull: doPull, carL: () => doCar(-1), carR: () => doCar(1), clear: doClear, pause: () => (paused = !paused)};
  for (const k of ACTS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      ACT[k]();
    });
  const setSub = (k) => {
    sub = k;
    vbtn = null;
    Object.assign(cfg, {iso: 0, isoStations: null, top: 0, dof: 0, explode: 0}, SUB[k]);
    view = cfg.view;
    viewAt = T;
    cut = cfg.cut;
    explodeOn = cfg.explode ?? 0;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  for (const k of SUBS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      setSub(k);
    });
  for (const k of VIEWS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      sub = null;
      vbtn = k;
      Object.assign(cfg, {iso: 0, isoStations: null, top: 0, dof: 0, explode: 0}, VIEW_CFG[k]);
      view = cfg.view;
      viewAt = T;
      cut = cfg.cut;
      explodeOn = 0;
      Object.assign(off, {az: 0, el: 0, k: 1});
    });
  for (const k of CUTS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      cut = k;
    });
  ui.btn.explode.addEventListener('click', () => {
    takeOver();
    pulseBtn('explode');
    explodeOn = explodeOn > 0.5 ? 0 : 1;
  });
  // the setting drums: upper half +1, lower half −1
  for (let i = 0; i < CURTA.sliders; i++) {
    const [cx, cy] = ui.setSpots[i];
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${cx - 12}px`, top: `${cy - 18}px`, width: '24px', height: '36px'});
    d.title = '+1 / −1';
    d.addEventListener('click', (e) => {
      takeOver();
      const r = d.getBoundingClientRect();
      doSet(i, e.clientY < r.top + r.height / 2 ? 1 : -1);
      pulse(cx, cy);
    });
    ui.root.appendChild(d);
    ui.setHit = ui.setHit || [];
    ui.setHit.push(d);
  }
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    takeOver();
    if (key === ' ') doTurn();
    else if (key === 'u') doPull();
    else if (key === 'arrowleft') doCar(-1);
    else if (key === 'arrowright') doCar(1);
    else if (key === 'c') doClear();
    else if (key === 'h') hidden = !hidden;
    else if (key === 'p') paused = !paused;
    else if (/^[1-7]$/.test(key)) setSub(SUBS[+key - 1]);
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
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
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
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.5);
    },
    {passive: false},
  );

  // the next turn's chart, between turns: what one more turn would do
  let preview = {key: '', ev: null};
  const nextEv = (S) => {
    const key = `${S.reg.join('')}|${S.ctr.join('')}|${S.set.join('')}|${S.p}|${S.up}`;
    if (key !== preview.key) preview = {key, ev: turnEvents(S.reg, S.ctr, S.set, S.p, S.up > 0.5 ? -1 : 1)};
    return preview.ev;
  };

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

    let S;
    let tgt;
    let fx;
    let cursor;
    let caption;
    let since;
    let hist = null;
    if (AP.on) {
      const c = T - AP.t0;
      const loop = Math.floor(c / DURATION);
      const cyc = c - loop * DURATION;
      if (loop > AP.loop) AP.loop = loop;
      S = state(film, cyc);
      tgt = camAt(cyc, S);
      const f = fxAt(cyc);
      fx = f;
      cut = f.cut;
      sub = f.sub;
      vbtn = f.view;
      const b = beatAt(cyc);
      view = (b.sub ? SUB[b.sub] : VIEW_CFG[b.view]).view;
      since = f.since;
      cursor = tourCursor(cyc);
      if (AP.loop > 0 && cyc < 0.8) {
        const e = tourCursor(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        cursor = {...cursor, x: e.x + (cursor.x - e.x) * k, y: e.y + (cursor.y - e.y) * k};
      }
      caption = captionAt(cyc, facts);
      if (cyc > 30.8) hist = filmHist;
      Object.assign(fxs, {glass: f.glass, explode: f.explode, dof: f.dof, iso: f.iso, top: 1 - f.ghost.carriage});
      tgt = {...tgt};
    } else {
      if (T - lastInput > IDLE) startTour();
      if (!paused) mT += dt;
      // the film's last step finishes first
      if (handoff && mT < handoff.t1) S = state(film, handoff.cyc0 + mT);
      else {
        handoff = null;
        S = state(plan, mT);
      }
      since = T - viewAt;
      const k = 1 - Math.exp(-dt / 0.35);
      const want = {glass: cut === 'glass' ? 1 : 0, explode: explodeOn, dof: cfg.dof ?? 0, iso: cfg.iso ?? 0, top: cfg.top ?? 0};
      for (const key in fxs) fxs[key] += (want[key] - fxs[key]) * k;
      fx = {cut, glass: fxs.glass, explode: fxs.explode, dof: fxs.dof, iso: fxs.iso, isoStations: cfg.isoStations, ghost: {carriage: 1 - 0.9 * fxs.top, ring: 1 - 0.9 * fxs.top, crank: 1 - 0.85 * fxs.top}};
      tgt = VIEW_FN[view](since, S);
      tgt.az += off.az;
      tgt.el = clamp(tgt.el + off.el, -10, 85);
      tgt.d *= off.k;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
      const ph = S.phase;
      const tt = S.turn;
      caption = tt
        ? tr(tt.sign < 0 ? 'l:sub' : 'l:add', nf(fromDigits(tt.ev.set) * 10 ** (tt.ev.p - 1)))
        : ph === 'carriage'
          ? tr('l:carriage', plan.steps[S.step]?.to ?? S.p)
          : ph === 'clear'
            ? tr('l:clear')
            : ph === 'slide'
              ? tr('l:slide')
              : ph === 'crank'
                ? tr('l:crank')
                : tr('l:idle');
    }

    // the camera eases toward its target, logarithmically in distance
    const k = 1 - Math.exp(-dt / (AP.on ? 0.1 : 0.35));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
    cam.d = Math.exp(Math.log(cam.d) + (Math.log(tgt.d) - Math.log(cam.d)) * k);
    st.setCut(fx.cut);
    st.frame(S, fx, {...cam, az: cam.az * D2R, el: cam.el * D2R});

    ui.root.style.display = hidden ? 'none' : '';
    ui.update({
      S,
      sub,
      view: vbtn,
      cut: fx.cut,
      explode: AP.on ? fx.explode : explodeOn,
      paused,
      lastHist: hist,
      nextEv: S.turn ? null : nextEv(S),
      callouts: calloutsFor(view, st, S, ss(1.3, 2.0, since)),
      cursor,
      caption,
      handNote,
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
  window.LIVE = {
    st,
    cam,
    startTour,
    takeOver,
    act: ACT,
    get plan() {
      return plan;
    },
    get tier() {
      return tier;
    },
    get T() {
      return T;
    },
  };
  void SCRIPT;
}
