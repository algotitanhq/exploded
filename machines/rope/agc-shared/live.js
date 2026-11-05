// Rope as a page you drive: the film's machine and overlay, in real time. Seven subsystems (rope, erasable, NOR logic,
// clock, Executive, DSKY, interfaces), three sections (case, trays, module), four views, an orbit you drag and a zoom
// on the wheel, the mission speed from one memory cycle in four seconds to sixty times real time. The DSKY's 19 keys
// work: a verb and a noun go into the Executive's log, which is planned again from that moment, so Verb 16 Noun 68
// can bring the 1202 back; switching the radar's cycle steals off makes it go away. Left alone, the page plays the
// film's script as an auto tour with the operator's cursor; a click, drag, wheel or key hands control over, 25 s of
// quiet hands it back.
import * as THREE from 'three';
import {warmComposer} from 'teardown-kit/warm.js';
import {CUTS, SUBS, VIEWS, createConsole} from './console.js';
import {loadFonts} from './fonts.js';
import {CREW_KEYS, EVENTS, GET0, MCT, ROPE_WORDS, bits16, ropePlace} from './machine.js';
import {jobsAt, simulate} from './executive.js';
import {DURATION, LOG, SCRIPT, actsAt, camAtName, missionAt, rateAt, ERAS_JOB, ERAS_MCT, ROPE_MCT} from './schedule.js';
import {L} from './agc.js';
import {VIEW_FN, calloutsFor, camAt, captionAt, detailFor, dskyText, machineState, makeCursor, prioWord, rateText, smoother, ss} from './film.js';
import {createStage} from './stage.js';
import {createChrome} from '../../../shared/chrome.js';
import {LANG, T as tr} from './i18n.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const RATES = [{k: 'mct', r: MCT / 4, label: '1 MCT / 4 S'}, {k: '1', r: 1, label: '×1'}, {k: '10', r: 10, label: '×10'}, {k: '60', r: 60, label: '×60'}];
const VIEW_OF_SUB = {rope: 'rope', eras: 'eras', nor: 'logic', clock: 'open', exec: 'exec', dsky: 'dsky', iface: 'exec'};

const CSS = (top) => `
html,body{margin:0;background:#efe8d8;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.tb{pointer-events:auto;cursor:pointer}
.tb:hover{filter:brightness(.96)}
.hit{position:absolute;pointer-events:auto;cursor:pointer}
.tourchip{position:absolute;left:800px;top:${92 + top}px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;height:26px;padding:0 13px;border:1px solid rgba(70,58,40,.55);background:rgba(241,235,221,.95);color:#2b2925;font:600 13px 'Barlow Condensed',sans-serif;letter-spacing:1.8px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:7px;height:7px;border-radius:50%;background:#1f8a4c}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:40px;text-align:center;font:600 14px/1.4 'Barlow Condensed',sans-serif;letter-spacing:1.5px;color:#7a7062;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
.busy{position:absolute;left:800px;top:440px;transform:translateX(-50%);padding:8px 14px;background:rgba(241,235,221,.96);border:1px solid rgba(70,58,40,.55);font:600 14px 'Barlow Condensed',sans-serif;letter-spacing:1.6px;color:#2b2925;display:none}
#app .cap{top:732px}
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
  const ui = createConsole(app);
  const tourCursor = makeCursor(ui);

  // ------------------------------------------------------------ quality tiers
  const TIERS = [
    {samples: 8, shadow: 4096, pr: 2},
    {samples: 4, shadow: 2048, pr: 1.5},
    {samples: 0, shadow: 1024, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let scale = 1;
  const chrome = createChrome({slug: 'rope', name: 'Rope', credit: tr('footCredit')});
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

  // live controls: mission speed, the radar, back to PDI + 5 min
  const ctl = {};
  const mk = (key, x, w, html) => {
    const n = document.createElement('div');
    n.className = 'tb';
    Object.assign(n.style, {left: `${x}px`, top: '788px', width: `${w}px`, height: '26px', fontSize: '13px'});
    n.innerHTML = html;
    ui.root.appendChild(n);
    ctl[key] = n;
    return n;
  };
  {
    const lab = document.createElement('div');
    lab.className = 'gl';
    Object.assign(lab.style, {left: '372px', top: '770px'});
    lab.textContent = tr('speed');
    ui.root.appendChild(lab);
  }
  RATES.forEach((r, i) => mk('rate' + i, 372 + i * 92, 86, r.label));
  mk('radar', 750, 250, tr('radarOn'));
  mk('reset', 1010, 208, tr('restartMission'));

  // ------------------------------------------------------------ the mission: the log, re-planned on the visitor's keys
  let radar = true;
  let userKeys = [];
  let cutKeys = Infinity; // the crew's own keys stop where the visitor took over the keyboard
  let log = LOG;
  const replan = () => {
    busy.style.display = 'block';
    requestAnimationFrame(() =>
      setTimeout(() => {
        log = simulate({keys: [...CREW_KEYS.filter((k) => k[0] < cutKeys), ...userKeys], radar});
        busy.style.display = 'none';
      }, 0),
    );
  };
  let s = 306.4;
  let rateI = 1;
  let T = 0;

  // ------------------------------------------------------------ state
  let paused = false;
  let view = 'hero';
  let viewAt = 0;
  let sub = '';
  let cut = '';
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.hero(0)};
  const mech = {open: 0, rope: 0, ropeCover: 0, eras: 0, logic: 0, gate: 0};
  let ring = {t: -9, x: 0, y: 0};
  let hidden = false;
  let norIn = [0, 0, 0];
  const press = {};
  const pulse = (x, y) => (ring = {t: T, x, y});
  const pulseBtn = (k) => pulse(...(ui.spots[k] || [800, 450]));

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0, loop: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.loop = 0;
    paused = false;
    Object.assign(off, {az: 0, el: 0, k: 1});
    if (log !== LOG || radar !== true) {
      radar = true;
      userKeys = [];
      cutKeys = Infinity;
      log = LOG;
    }
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const cyc = (T - AP.t0) % DURATION;
    s = missionAt(cyc);
    const name = camAtName(cyc);
    view = name;
    viewAt = T - (cyc - SCRIPT.filter((e) => e.cam && e.t <= cyc).pop().t);
    sub = {rope: 'rope', eras: 'eras', dsky: 'dsky', exec: 'exec'}[name] || '';
    const a = actsAt(cyc);
    Object.assign(mech, {open: a.open, rope: a.rope, ropeCover: a.ropeCover, eras: a.eras, logic: 0, gate: 0});
    cut = a.open > 0.5 ? 'tray' : '';
    rateI = rateAt(cyc) < 0.01 ? 0 : 1;
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
  };
  for (const k of SUBS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      sub = sub === k && k !== 'dsky' ? '' : k;
      if (sub) {
        if (['rope', 'eras', 'nor', 'clock', 'exec', 'iface'].includes(sub)) cut = sub === 'exec' || sub === 'clock' || sub === 'iface' ? 'tray' : 'module';
        setView(VIEW_OF_SUB[sub]);
        rateI = sub === 'rope' || sub === 'eras' ? 0 : rateI === 0 ? 1 : rateI;
      } else setView(mech.open > 0.5 ? 'open' : 'hero');
    });
  for (const k of CUTS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      cut = cut === k ? '' : k;
      if (cut === 'case') setView('hero');
      else if (cut === 'tray') setView(sub === 'nor' || sub === 'rope' || sub === 'eras' ? 'open' : view === 'hero' ? 'open' : view);
      else if (cut === 'module') {
        if (!['rope', 'eras', 'nor'].includes(sub)) sub = 'rope';
        setView(VIEW_OF_SUB[sub]);
      } else setView('hero');
    });
  for (const k of VIEWS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      if (k === 'axo') setView(mech.open > 0.5 || cut === 'tray' || cut === 'module' ? 'open' : 'hero');
      else if (k === 'dskyFace') {
        sub = 'dsky';
        setView('dsky');
      } else if (k === 'ropeIn') {
        sub = 'rope';
        cut = 'module';
        rateI = 0;
        setView('rope');
      } else if (k === 'graze') {
        if (!cut || cut === 'case') cut = 'tray';
        setView('graze');
      }
    });
  RATES.forEach((r, i) =>
    ctl['rate' + i].addEventListener('click', () => {
      takeOver();
      rateI = i;
      pulse(...centreOf(ctl['rate' + i]));
    }),
  );
  ctl.radar.addEventListener('click', () => {
    takeOver();
    radar = !radar;
    pulse(...centreOf(ctl.radar));
    replan();
  });
  ctl.reset.addEventListener('click', () => {
    takeOver();
    s = 300;
    userKeys = [];
    cutKeys = Infinity;
    log = LOG;
    if (!radar) replan();
    pulse(...centreOf(ctl.reset));
  });
  const centreOf = (n) => [parseFloat(n.style.left) + parseFloat(n.style.width) / 2, parseFloat(n.style.top) + 13];
  // NOR inputs: three hit areas over the schematic's A, B, C
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${34 + 14 + 60 + i * 60 - 50}px`, top: `${452 + 36 + 124 - 16}px`, width: '36px', height: '32px'});
    d.addEventListener('click', () => {
      if (sub !== 'nor') return;
      takeOver();
      norIn[i] = norIn[i] ? 0 : 1;
      pulse(34 + 14 + 60 + i * 60 - 32, 452 + 36 + 124);
    });
    ui.root.appendChild(d);
  }
  // the DSKY's keys, by raycast on the 3D face
  const ray = new THREE.Raycaster();
  const keyMeshes = Object.values(st.mac.dsky.keys);
  const keyAt = (cx, cy) => {
    const [x, y] = toStage(cx, cy);
    ray.setFromCamera(new THREE.Vector2((x / W) * 2 - 1, -(y / H) * 2 + 1), st.camera);
    const hit = ray.intersectObjects(keyMeshes, false)[0];
    return hit?.object.userData.key || null;
  };
  const pressKey = (k) => {
    if (cutKeys === Infinity) cutKeys = s;
    userKeys.push([s + 0.001, k]);
    press[k] = T;
    replan();
  };
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    takeOver();
    if (key === ' ') paused = !paused;
    else if (key === 'h') hidden = !hidden;
    else if (/^[1-7]$/.test(key)) ui.btn[SUBS[+key - 1]].click();
    else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const k = keyAt(e.clientX, e.clientY);
    if (k) {
      takeOver();
      pressKey(k);
      return;
    }
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) {
      canvas.style.cursor = keyAt(e.clientX, e.clientY) ? 'pointer' : '';
      return;
    }
    off.az += ((e.clientX - drag.x) / scale) * 0.25;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.18, -20, 50);
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
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.6);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ loops of the live subsystems
  const ROPE_LOOP = [0o2625, 0o2626, 0o2627, 0o2630, 0o2631, 0o2632, 0o2633];
  const ropeLoop = (t) => {
    const n = Math.floor(t / 3.2);
    const addr = ROPE_LOOP[n % ROPE_LOOP.length];
    const w = ROPE_WORDS.findIndex((x) => x.bank === 1 && x.addr === addr);
    return {phase: (t / 3.2) % 1, w, core: 4 + (addr - 0o2627), place: ropePlace(1, addr)};
  };

  // ------------------------------------------------------------ the frame
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const ease = (key, want, dt, tau = 0.5) => (mech[key] += (want - mech[key]) * (1 - Math.exp(-dt / tau)));
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
    let fx;
    let tgt;
    let ms;
    let det;
    let callouts;
    let cursor;
    let caption;
    let rateTxt;
    let curView;
    let pressNow = {};
    if (AP.on) {
      // the film, exactly
      const c = T - AP.t0;
      const loop = Math.floor(c / DURATION);
      const cyc = c - loop * DURATION;
      if (loop > AP.loop) AP.loop = loop;
      s = missionAt(cyc);
      curView = camAtName(cyc);
      const t0 = SCRIPT.filter((e) => e.cam && e.t <= cyc).pop().t;
      const since = cyc - t0;
      ms = machineState(LOG, s);
      const acts = actsAt(cyc);
      const ropePhase = (s - ROPE_MCT * MCT) / MCT;
      const erasPhase = (s - ERAS_MCT * MCT) / MCT;
      for (const [ks, k] of LOG.keyEv) {
        const d = s - ks;
        if (d >= 0 && d < 0.25) pressNow[k] = Math.max(pressNow[k] || 0, 1 - d / 0.25);
      }
      fx = {
        ...acts,
        read: {phase: ropePhase >= 0 && ropePhase < 1 ? ropePhase : -1},
        erasRead: {phase: erasPhase >= 0 && erasPhase < 1 ? erasPhase : -1, bit: bits16(prioWord(ERAS_JOB?.kind))[1]},
        rr: curView === 'exec' || curView === 'hero' ? 0.25 + 0.25 * Math.sin(T * 9) : 0,
        dsky: {lamps: ms.dsky.lamps, el: ms.dsky, press: pressNow},
      };
      st.mac.update(fx);
      tgt = camAt(cyc, st.mac.anchors);
      Object.assign(mech, {open: acts.open, rope: acts.rope, ropeCover: acts.ropeCover, eras: acts.eras, logic: 0, gate: 0});
      det =
        curView === 'rope'
          ? detailFor('rope', s, ms, {ropePhase})
          : curView === 'eras'
            ? detailFor('eras', s, ms, {erasPhase, erasJob: ERAS_JOB?.kind, erasSet: 0})
            : curView === 'dsky'
              ? detailFor('dsky', s, ms)
              : curView === 'exec'
                ? detailFor('iface', s, ms, {radar: true})
                : detailFor('clock', s, ms);
      const inside = curView === 'rope' ? ss(3.0, 4.2, since) : curView === 'eras' ? ss(2.0, 3.0, since) : 0;
      callouts = calloutsFor(curView, st, ss(1.2, 1.9, since), {inside, rrHot: true});
      cursor = tourCursor(cyc);
      if (AP.loop > 0 && cyc < 0.8) {
        const end = tourCursor(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * k, y: end.y + (cursor.y - end.y) * k};
      }
      caption = captionAt(cyc);
      rateTxt = rateText(rateAt(cyc));
    } else {
      if (T - lastInput > IDLE) startTour();
      const since = T - viewAt;
      curView = view;
      if (!paused) s += RATES[rateI].r * dt;
      if (s > EVENTS.contact + 6) s = 300;
      ms = machineState(log, s);
      // mechanisms toward the section and the subsystem
      const open = cut === 'tray' || cut === 'module' || ['rope', 'eras', 'nor', 'graze'].includes(view) || (sub && sub !== 'dsky') ? 1 : 0;
      ease('open', open, dt, 0.55);
      const ready = mech.open > 0.97;
      ease('rope', ready && (sub === 'rope' || view === 'rope') ? 1 : 0, dt, 0.45);
      ease('ropeCover', mech.rope > 0.95 && (sub === 'rope' || view === 'rope') ? 1 : 0, dt, 0.3);
      ease('eras', ready && sub === 'eras' ? 1 : 0, dt, 0.45);
      ease('logic', ready && sub === 'nor' ? 1 : 0, dt, 0.45);
      ease('gate', mech.logic > 0.9 && sub === 'nor' ? 1 : 0, dt, 0.35);
      const inRope = mech.ropeCover > 0.97 && view === 'rope';
      const rl = ropeLoop(T);
      const eLoopN = Math.floor(T / 4);
      const eSet = eLoopN % 8;
      const eJob = jobsAt(log, s)[eSet];
      const erasPhase = sub === 'eras' && mech.eras > 0.95 ? (T / 4) % 1 : -1;
      for (const [k, t] of Object.entries(press)) {
        const d = T - t;
        if (d >= 0 && d < 0.25) pressNow[k] = 1 - d / 0.25;
      }
      for (const [ks, k] of log.keyEv) {
        const d = s - ks;
        if (d >= 0 && d < 0.25 && RATES[rateI].r <= 1) pressNow[k] = Math.max(pressNow[k] || 0, 1 - d / 0.25);
      }
      fx = {
        ...mech,
        ropeDetail: inRope ? 1 : 0,
        read: {phase: inRope ? rl.phase : -1, core: rl.core},
        erasRead: {phase: erasPhase, bit: bits16(prioWord(eJob?.kind))[1]},
        cut: cut === 'case' ? 'case' : '',
        rr: (sub === 'iface' || sub === 'exec') && radar ? 0.25 + 0.25 * Math.sin(T * 9) : 0,
        dsky: {lamps: ms.dsky.lamps, el: ms.dsky, press: pressNow},
      };
      st.mac.update(fx);
      const fn = VIEW_FN[curView] || VIEW_FN.hero;
      tgt = fn(curView === 'rope' && !inRope && mech.rope < 0.9 ? Math.min(since, 1.0) : since, st.mac.anchors);
      tgt.az += off.az;
      tgt.el = clamp(tgt.el + off.el, -10, 85);
      tgt.d *= off.k;
      const kind = sub || 'clock';
      det =
        kind === 'rope'
          ? detailFor('rope', s, ms, {ropePhase: inRope ? rl.phase : -1, ropeW: rl.w, place: rl.place})
          : kind === 'eras'
            ? detailFor('eras', s, ms, {erasPhase, erasJob: eJob?.kind, erasSet: eSet})
            : kind === 'nor'
              ? detailFor('nor', s, ms, {norIn})
              : kind === 'iface'
                ? detailFor('iface', s, ms, {radar})
                : detailFor(kind, s, ms);
      const inside = curView === 'rope' ? (inRope ? 1 : 0) : curView === 'eras' ? ss(2.0, 3.0, since) : 0;
      callouts = calloutsFor(curView, st, ss(1.2, 1.9, since), {inside, rrHot: radar});
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
      caption = tr('cap:live:' + (sub || 'axo'));
      rateTxt = paused ? '‖' : rateText(RATES[rateI].r);
    }
    // the camera eases toward its target, logarithmically in distance (metres down to centimetres)
    const k = 1 - Math.exp(-dt / (AP.on ? 0.1 : 0.35));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'sx', 'sy']) cam[key] += ((tgt[key] ?? 0) - (cam[key] ?? 0)) * k;
    cam.d = Math.exp(Math.log(cam.d) + (Math.log(tgt.d) - Math.log(cam.d)) * k);
    st.frame(fx, {...cam, az: cam.az * D2R, el: cam.el * D2R});

    ui.root.style.display = hidden ? 'none' : '';
    ui.update({
      get: GET0 + s,
      mct: s / MCT,
      rateText: rateTxt,
      dsky: ms.dsky,
      dskyText: dskyText(ms.d, ms.ds),
      sets: ms.sets,
      vacs: ms.vacs,
      busy: ms.busy,
      duty: ms.duty,
      strip: ms.strip,
      stripAt: 84,
      alarm: ms.alarm,
      execNote: tr('execWait'),
      detail: det,
      caption,
      sub: AP.on ? {rope: 'rope', eras: 'eras', dsky: 'dsky', exec: 'exec'}[curView] || '' : sub,
      cut: AP.on ? (mech.open > 0.5 ? 'tray' : '') : cut,
      view: AP.on ? '' : {open: 'axo', hero: 'axo', dsky: 'dskyFace', rope: 'ropeIn', graze: 'graze'}[curView] || '',
      callouts,
      cursor,
    });
    RATES.forEach((r, i) => ctl['rate' + i].classList.toggle('on', !AP.on && i === rateI && !paused));
    const rt = radar ? tr('radarOn') : tr('radarOff');
    if (ctl.radar.textContent !== rt) ctl.radar.textContent = rt;
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
  // the first pose before warming, so every program the frame needs exists
  st.mac.update({...mech, ropeDetail: 1, dsky: {lamps: {}, el: machineState(LOG, s).dsky, press: {}}});
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {
    st,
    cam,
    startTour,
    takeOver,
    pressKey,
    get tier() {
      return tier;
    },
    get T() {
      return T;
    },
    get s() {
      return s;
    },
    get log() {
      return log;
    },
  };
  void smoother;
  void L;
}
