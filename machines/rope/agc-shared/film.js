// Rope, the film: the AGC and its DSKY (agc.js) on the drawing sheet (stage.js) under the overlay (console.js). One
// input, the mission time in MCT since PDI (schedule.js), reads the Executive's log (executive.js) and the descent
// (machine.js): the word in the rope, the core sets, the lamps, VERB / NOUN / PROG and R1-R3. An operator opens the
// case, pulls rope module B1 and dives between its cores while one word is read, reads and rewrites one erasable
// word, goes back to the DSKY, watches the radar's stolen cycles fill the core sets until the 1202, then
// fast-forwards through P64 to touchdown. A pure function of t.
import {runSim} from 'teardown-kit/runtime.js';
import {createConsole} from './console.js';
import {L} from './agc.js';
import {loadFonts} from './fonts.js';
import {AGC, EVENTS, EXEC, GET0, MCT, ROPE_WORDS, bits16, descent, ropePlace} from './machine.js';
import {SAMPLE, displayAt, jobsAt, lampAt, restartAt, sampleAt, servicerDuty} from './executive.js';
import {ALARM1, DURATION, ERAS_JOB, ERAS_MCT, LOG, NOVAC, ROPE_MCT, SCRIPT, T as TB, actsAt, camAtName, missionAt, rateAt} from './schedule.js';
import {createStage} from './stage.js';
import {nf, T as tr} from './i18n.js';

export {DURATION, SCRIPT};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'rope', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
export const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const lerpV = (a, b, k) => ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k)});
const logLerp = (a, b, k) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * k);

// ------------------------------------------------------------ views: straight, slow, along the axes. u: seconds in
// the view, A: the machine's anchors (world space) for the frame
export const VIEW_FN = {
  hero: (u) => ({tx: 0.05, ty: 0.07, tz: 0.0, az: 34 + 1.4 * Math.sin(u * 0.41), el: 25, d: 3.15 - 0.06 * Math.sin(u * 0.41), sx: 0, sy: 30}),
  open: (u) => ({tx: 0.02, ty: 0.05, tz: -0.16, az: 30 + 0.4 * Math.min(u, 6), el: 38, d: 3.15, sx: 0, sy: 20}),
  rope: (u, A) => {
    const k = smoother((u - 1.2) / 3.0);
    const p = lerpV(A.rope, A.core, smoother((u - 1.6) / 2.6));
    return {tx: p.x, ty: p.y, tz: p.z, az: lerp(28, 48, k), el: lerp(40, 26, k), d: logLerp(1.05, 0.066, k), sx: 0, sy: lerp(20, 0, k)};
  },
  eras: (u, A) => {
    const k = smoother((u - 0.6) / 2.4);
    const p = lerpV(A.eras, A.erasCore, k);
    return {tx: p.x, ty: p.y, tz: p.z, az: lerp(16, 6, k), el: lerp(30, 12, k), d: logLerp(1.1, 0.075, k), sx: 0, sy: lerp(20, 0, k)};
  },
  dsky: (u, A) => ({tx: A.dsky.x, ty: A.dsky.y - 0.052, tz: A.dsky.z, az: 26 - 0.4 * Math.min(u, 6), el: 7, d: 1.22, sx: 0, sy: 6}),
  exec: (u) => ({tx: 0.06, ty: 0.05, tz: -0.12, az: 22 + 0.4 * Math.min(u, 8), el: 31, d: 3.35, sx: 0, sy: 16}),
  // live only
  logic: (u, A) => {
    const k = smoother((u - 0.4) / 2.2);
    return {tx: lerp(-0.1, A.gate.x - 0.03, k), ty: lerp(0.06, A.gate.y - 0.03, k), tz: lerp(0, A.gate.z - 0.04, k), az: lerp(28, 14, k), el: lerp(36, 20, k), d: logLerp(2.6, 0.62, k), sx: 0, sy: 10};
  },
  graze: (u) => ({tx: L.x0 + 0.02, ty: 0.07, tz: 0.0, az: 78 - 0.6 * Math.min(u, 8), el: 7, d: 1.45, sx: 0, sy: 6}),
};
export function blend(a, b, k) {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : key === 'd' ? logLerp(a.d, b.d, k) : a[key] + (b[key] - a[key]) * k;
  // between two close views the camera backs out on the way, so it never passes through the trays
  const lift = Math.max(0, Math.log(0.9 / Math.max(a.d, b.d)));
  o.d *= Math.exp(lift * Math.sin(Math.PI * k));
  return o;
}
const VIEWS = SCRIPT.filter((e) => e.cam).map((e) => [e.t, e.cam]);
export const camAt = (t, A) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const view = (k) => VIEW_FN[VIEWS[k][1]](t - VIEWS[k][0], A);
  const cur = view(i);
  if (i === 0) return cur;
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 2.0, t);
  return k >= 1 ? cur : blend(view(i - 1), cur, k);
};

// ------------------------------------------------------------ the operator's pointer
const REST = [[820, 520], [700, 470], [900, 560], [760, 430]];
export function makeCursor(ui, script = SCRIPT) {
  const EV = script.filter((e) => e.t > 0 && e.btn).map((e) => ({t: e.t, spot: ui.spots[e.btn]}));
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

// ------------------------------------------------------------ the machine's state at mission time s
const sgn = (v, n = 5) => (v < 0 ? '-' : '+') + String(Math.min(10 ** n - 1, Math.round(Math.abs(v)))).padStart(n, '0');
const mmss = (sec) => {
  const t = Math.max(0, Math.round(sec));
  return `+${String(Math.min(99, Math.floor(t / 60))).padStart(2, '0')} ${String(t % 60).padStart(2, '0')}`;
};
const hash = (n) => {
  const x = Math.sin(n * 0.61803 + 3.1) * 43758.5453;
  return x - Math.floor(x);
};
/** registers for a noun from the descent at the display's last refresh */
export function registers(noun, ds, fail, s) {
  if (noun === '68') return [sgn(ds.slantNm * 10), mmss(ds.tgo), sgn(ds.dH)];
  if (noun === '63') return [sgn(ds.v * 10), sgn(ds.hdot * 10), sgn(ds.h)];
  if (noun === '64') return [`+${String(Math.max(0, Math.round(EVENTS.p66 - ds.s))).padStart(2, '0').slice(-2)} ${String(Math.round(ds.lpd)).padStart(2, '0')}`, sgn(ds.hdot * 10), sgn(ds.h)];
  if (noun === '60') return [sgn(ds.vh * 10), sgn(ds.hdot * 10), sgn(ds.h)];
  if (noun === '09') return fail.map((c) => (c ? ' ' + c.toString().padStart(5, '0') : ' 00000'));
  if (noun === '36') {
    const g = GET0 + s;
    return [sgn(Math.floor(g / 3600)), sgn(Math.floor((g % 3600) / 60)), sgn(Math.floor((g % 60) * 100))];
  }
  return ['      ', '      ', '      '];
}
export function machineState(log, s, {liveKeys} = {}) {
  const d = displayAt(log, s);
  const ds = descent(d.shown);
  const reg = registers(d.noun, ds, d.fail, d.shown);
  const verb = d.mode === 'verb' ? d.vb.padEnd(2, ' ') : d.verb;
  const noun = d.mode === 'noun' ? d.nb.padEnd(2, ' ') : d.mode === 'verb' ? d.noun : d.noun;
  const i = sampleAt(log, s);
  const run = log.S.run[i];
  const lamps = {
    PROG: lampAt(log, s, 'PROG'),
    'OPR ERR': lampAt(log, s, 'OPR ERR'),
    ALT: s < EVENTS.alt || (s > EVENTS.lrDrop && s < EVENTS.lrBack) ? 1 : 0,
    VEL: s < EVENTS.vel || (s > EVENTS.lrDrop && s < EVENTS.lrBack) ? 1 : 0,
  };
  // the jobs, and which one has the processor
  const sets = jobsAt(log, s);
  let runJ = null;
  for (const j of sets) if (j && (!runJ || j.prio > runJ.prio || (j.prio === runJ.prio && j.t0 < runJ.t0))) runJ = j;
  const setsOut = sets.map((j) => (j ? {kind: j.kind, run: j === runJ && run >= 0, age: `${nf(Math.max(0, s - j.t0), 1)} s`} : null));
  const vacs = [];
  for (let k = 0; k < EXEC.vacAreas; k++) vacs.push(!!(log.S.vacs[i] & (1 << k)));
  const busy = sets.filter(Boolean).length;
  const tl = log.radar ? EXEC.tloss : 0;
  const prog = s < EVENTS.p64 ? 63 : s < EVENTS.p66 ? 64 : 66;
  const serv = servicerDuty(s);
  const lrPart = prog === 63 ? Math.max(0, serv - EXEC.braking) : 0;
  const mon = d.monitor ? EXEC.n68 : 0;
  const lpd = prog === 64 ? EXEC.approachJobs / EXEC.servicerPeriod : 0;
  const parts = [
    {k: 'serv', v: serv - lrPart},
    ...(lrPart > 0.001 ? [{k: 'lr', v: lrPart}] : []),
    ...(mon ? [{k: 'n68', v: mon}] : []),
    ...(lpd ? [{k: 'lpd', v: lpd}] : []),
    ...(tl ? [{k: 'rr', v: tl}] : []),
  ];
  const total = parts.reduce((a, p) => a + p.v, 0);
  // one millisecond of MCTs, ending now
  const n0 = Math.floor(s / MCT);
  const strip = [];
  const idleP = Math.max(0, 1 - total);
  const novac0 = Math.round(NOVAC.req.t0 / MCT);
  for (let q = 0; q < 85; q++) {
    const n = n0 - 84 + q;
    const inNovac = n >= novac0 && n < novac0 + NOVAC.mct;
    const h = hash(n);
    if (!inNovac && h < tl) strip.push('s');
    else if (inNovac || (run >= 0 && h > tl + idleP)) strip.push('j');
    else strip.push(run < 0 ? 'i' : h < tl + idleP ? 'i' : 'j');
  }
  // the alarm, while PROG is lit and a few seconds after
  const r = restartAt(log, s);
  let alarm = null;
  if (r) {
    const age = s - r.s;
    const k = lamps.PROG ? 1 : 1 - Math.min(1, Math.max(0, (age - 6) / 1.5));
    if (k > 0) {
      const counts = {};
      for (const x of r.dropped) counts[x.kind] = (counts[x.kind] || 0) + 1;
      const kl = {servicer: tr('job:servicer'), monitor: tr('job:monitor'), lpd: tr('job:lpd'), charin: tr('job:charin')};
      alarm = {code: r.code, k: Math.min(1, age / 0.15) * k, kept: r.kept[0]?.kind, dropped: Object.entries(counts).map(([kk, c]) => `${c} × ${kl[kk]}`).join(', ') || '—'};
    }
  }
  return {
    dsky: {prog: String(prog === 66 && s > EVENTS.contact + 3 ? 68 : prog), verb, noun, reg, compActy: run >= 0 ? 1 : 0, lamps},
    d,
    ds,
    sets: setsOut,
    vacs,
    busy,
    duty: {parts, total},
    strip,
    alarm,
  };
}
export const dskyText = (d, ds) => {
  const n = d.mode ? '' : d.noun;
  if (n === '68') return tr('dsky:68', nf(ds.slantNm, 1), mmss(ds.tgo).slice(1).replace(' ', ':'), nf(Math.round(ds.dH)));
  if (n === '63') return tr('dsky:63', nf(ds.v, 1), nf(ds.hdot, 1), nf(Math.round(ds.h)));
  if (n === '64') return tr('dsky:64', Math.round(ds.lpd), nf(ds.hdot, 1), nf(Math.round(ds.h)));
  if (n === '60') return tr('dsky:60', nf(ds.vh, 1), nf(ds.hdot, 1), nf(Math.round(ds.h)));
  if (n === '09') return tr('dsky:09');
  if (n === '36') return tr('dsky:36');
  return tr('dsky:keying');
};
export const rateText = (r) => {
  if (r < 1e-3) return tr('rateSlow', nf(r * 1e6, 1), nf(1 / r));
  if (r < 0.9) return tr('rateSlowS', nf(r, 2));
  return tr('rateFast', nf(r, r < 10 ? 1 : 0));
};

// ------------------------------------------------------------ the subsystem panels
const ROPE_W = ROPE_WORDS.findIndex((w) => w.op === 'CAF NO.CORES');
const SEL = ROPE_WORDS[ROPE_W];
export const ROPE_PLACE = ropePlace(SEL.bank, SEL.addr);
export const prioWord = (kind) => (kind ? ({servicer: 0o20, monitor: 0o10, lpd: 0o10, charin: 0o30}[kind] << 9) | 0o154 : 0o77777);
/** rope read inside its MCT: phase 0..1 → {stage, fill} */
export function ropeRead(phase) {
  if (phase < 0) return {stage: -1, fill: 0};
  if (phase >= 1) return {stage: -1, fill: 16};
  const stage = phase < 0.12 ? 0 : phase < 0.45 ? 1 : phase < 0.72 ? 2 : 3;
  const fill = Math.max(0, Math.min(16, Math.floor(((phase - 0.5) / 0.3) * 16 + 1)));
  return {stage, fill: phase < 0.5 ? 0 : fill};
}
export function erasRead(phase) {
  if (phase < 0) return {stage: -1, fill: 16, state: 'stored'};
  if (phase >= 1) return {stage: -1, fill: 16, state: 'stored'};
  const stage = phase < 0.18 ? 0 : phase < 0.55 ? 1 : 2;
  const fill = phase < 0.2 ? 0 : Math.min(16, Math.floor(((phase - 0.2) / 0.22) * 16 + 1));
  return {stage, fill, state: 'read'};
}
export function detailFor(kind, s, ms, extra = {}) {
  if (kind === 'rope') {
    const ph = extra.ropePhase ?? -1;
    const r = ropeRead(ph);
    return {kind, w: extra.ropeW ?? ROPE_W, place: extra.place ?? ROPE_PLACE, fill: r.fill, stage: r.stage};
  }
  if (kind === 'eras') {
    const ph = extra.erasPhase ?? -1;
    const r = erasRead(ph);
    const job = extra.erasJob;
    return {kind, set: extra.erasSet ?? 0, job, bits: bits16(prioWord(job)), fill: r.fill, stage: r.stage, state: r.state};
  }
  if (kind === 'clock') {
    const f = (s / MCT) % 1;
    return {kind, pulse: Math.floor(f * 12), phase: f, mct: Math.floor(s / MCT)};
  }
  if (kind === 'nor') {
    const f = (s / MCT) % 1;
    const p = Math.floor(f * 12);
    return {kind, in: extra.norIn ?? [p % 2 ? 1 : 0, p >= 4 && p < 8 ? 1 : 0, p >= 9 ? 1 : 0]};
  }
  if (kind === 'iface') return {kind, rr: !!extra.radar, lr: s > EVENTS.alt};
  if (kind === 'dsky') return {kind, text: tr('dskyKeysNote')};
  return {kind: 'exec'};
}

// ------------------------------------------------------------ callouts per view, label spots on the 1600 x 900 layout
export function calloutsFor(view, st, vis, extra = {}) {
  const A = st.mac.anchors;
  const out = [];
  const c = (key, at, label, w, hot = false, o = vis) => {
    const [name, sub] = tr(key);
    out.push({name, sub, at: st.project(at), label, w, o, hot});
  };
  if (view === 'hero') {
    c('cAgc', A.trayB, [380, 150], 230);
    c('cDsky', A.dsky, [1230, 150], -200);
  } else if (view === 'open' || view === 'exec') {
    c('cTrayA', A.trayA, [380, 600], 220);
    c('cTrayB', A.xrib, [1230, 112], -230);
    if (view === 'exec') c('cConn', A.conn, [1230, 600], -250, !!extra.rrHot);
  } else if (view === 'rope') {
    const o2 = vis * (extra.inside ?? 0);
    c('cRopeMod', A.ropeEnd, [1230, 112], -250, false, vis * (1 - (extra.inside ?? 0)));
    c('cCore', A.core, [380, 112], 250, true, o2);
    c('cSense', A.coreNext, [1230, 112], -250, false, o2);
    c('cInhibit', A.inhib, [380, 640], 250, false, o2);
  } else if (view === 'eras') {
    const o2 = vis * (extra.inside ?? 0);
    c('cErasMod', A.erasMod, [380, 112], 260, false, vis * (1 - (extra.inside ?? 0)));
    c('cErasCore', A.erasCore, [380, 112], 260, true, o2);
    c('cErasSense', A.erasSense, [1230, 640], -250, false, o2);
  } else if (view === 'dsky') {
    c('cEl', A.dskyEl, [1230, 112], -240, true);
    c('cKeys', A.dskyKeys, [380, 640], 220);
  } else if (view === 'logic') {
    c('cLogic', A.logic, [380, 112], 240);
    c('cGate', A.gate, [1230, 112], -250, true);
  } else if (view === 'graze') {
    c('cTrayA', A.trayA, [380, 112], 220);
  }
  return out;
}

// ------------------------------------------------------------ captions of the film, by beat
const CAPS = [
  [0, 'cap:hero'],
  [3.0, 'cap:open'],
  [6.8, 'cap:rope'],
  [11.0, 'cap:rope2'],
  [14.6, 'cap:eras'],
  [20.2, 'cap:dsky'],
  [24.0, 'cap:exec'],
  [TB.alarm, 'cap:alarm'],
  [TB.alarm + 2.4, 'cap:restart'],
  [TB.ff, 'cap:ff'],
  [35.2, 'cap:p64'],
  [TB.contact - 0.4, 'cap:contact'],
];
export const captionAt = (t) => tr(CAPS.filter((c) => c[0] <= t).pop()[1]);

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
    window.ROPE = {st, LOG};
    const sR = ROPE_MCT * MCT;
    const sE = ERAS_MCT * MCT;
    return {
      resize,
      render(t) {
        const s = missionAt(t);
        const view = camAtName(t);
        const t0 = VIEWS.filter(([a]) => a <= t).pop()[0];
        const since = t - t0;
        const ms = machineState(LOG, s);
        const acts = actsAt(t);
        const ropePhase = (s - sR) / MCT;
        const erasPhase = (s - sE) / MCT;
        const press = {};
        for (const [ks, k] of LOG.keyEv) {
          const dt = s - ks;
          if (dt >= 0 && dt < 0.25) press[k] = Math.max(press[k] || 0, 1 - dt / 0.25);
        }
        const fx = {
          ...acts,
          read: {phase: ropePhase >= 0 && ropePhase < 1 ? ropePhase : -1},
          erasRead: {phase: erasPhase >= 0 && erasPhase < 1 ? erasPhase : -1, bit: bits16(prioWord(ERAS_JOB?.kind))[1]},
          rr: view === 'exec' || view === 'hero' ? 0.25 + 0.25 * Math.sin(t * 9) : 0,
          dsky: {lamps: ms.dsky.lamps, el: ms.dsky, press},
        };
        st.mac.update(fx);
        const c = camAt(t, st.mac.anchors);
        st.frame(fx, {...c, az: c.az * D2R, el: c.el * D2R});
        const det =
          view === 'rope'
            ? detailFor('rope', s, ms, {ropePhase})
            : view === 'eras'
              ? detailFor('eras', s, ms, {erasPhase, erasJob: ERAS_JOB?.kind, erasSet: 0})
              : view === 'dsky'
                ? detailFor('dsky', s, ms)
                : view === 'exec'
                  ? detailFor('iface', s, ms, {radar: true})
                  : detailFor('clock', s, ms);
        const inside = view === 'rope' ? ss(3.0, 4.2, since) : view === 'eras' ? ss(2.0, 3.0, since) : 0;
        ui.update({
          get: GET0 + s,
          mct: s / MCT,
          rateText: rateText(rateAt(t)),
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
          caption: captionAt(t),
          sub: {rope: 'rope', eras: 'eras', dsky: 'dsky', exec: 'exec'}[view] || '',
          cut: acts.open > 0.5 ? 'tray' : '',
          view: '',
          callouts: calloutsFor(view, st, ss(1.2, 1.9, since) * (t > DURATION - 0.3 ? 0 : 1), {inside, rrHot: true}),
          cursor: cursorAt(t),
        });
        return {};
      },
    };
  };
}
void AGC;
void SAMPLE;
void ALARM1;

export const run = () => runSim(DEFAULTS, makeFilm());
