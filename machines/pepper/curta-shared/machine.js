// Pepper, the Curta Type I: the one source of its figures and of its arithmetic. No three.js, so check.mjs, the
// timeline and the score import it in node. The geometry (curta.js), the console and the sound all read from here.
//
// One input: the cumulative crank angle θ, plus the discrete state between turns (sliders, crank up or down, carriage
// position, clearing ring). A plan of steps is built once; state(plan, t) returns every pose, every digit on every
// wheel, every carry lever, as a pure function of t. The letters in comments are the sources in ../REFERENCES.md.

// ------------------------------------------------------------ the figures
export const CURTA = {
  // registers [W][H][V]
  sliders: 8,
  counter: 6,
  result: 11,
  typeII: {sliders: 11, counter: 8, result: 15},
  // body [F]: 5.3 cm across, 8.5 cm high (10.5 cm with the crank [H]), 230 g, ~600 parts
  diameter: 53,
  height: 85,
  heightCrank: 105,
  mass: 230,
  parts: 600,
  // production [F][W]: ~80,000 Type I (and ~60,000 Type II), 1948 to 1970 (Wikipedia gives 1972 for the last one)
  made: 80000,
  madeII: 60000,
  years: [1948, 1970],
  // drum [V]: 19 rows of teeth, 9 for addition, 9 for the nines' complement, 1 extra row of ten for the first digit
  rowsAdd: 9,
  rowsComp: 9,
  rowsTen: 1,
};
export const POSITIONS = CURTA.counter; // the carriage turns through 6 positions [V]

// ------------------------------------------------------------ the timing over one turn [E]
// The ring of stations around the drum: 8 slider shafts (stations 1-8), 3 carry-only shafts (9-11) and 5 parked
// places where the result wheels below the active column wait. 16 stations, 22.5° apart. A drum tooth or the single
// carry tooth meets station s at θ = its angle on the drum + (s − 1)·22.5°, so the drum serves the stations one after
// the other, and the carry tooth reaches column s + 1 after column s has finished: the carries run in order, from
// the units up, during the second half of the turn [F].
export const G = {
  stations: 16,
  active: 11,
  pitch: 22.5, // ° between stations
  tooth: 10, // ° between two teeth of a row
  toothDur: 7, // ° a tooth drives its counting gear
  entry0: 15, // ° where the first tooth meets station 1
  carry0: 105, // ° where the carry tooth meets station 1 (= entry0 + 9 teeth)
  carryDur: 8,
  counterAt: 338, // ° the counting tooth steps the revolution counter
  counterDur: 14,
  armReset: [2, 14], // ° the reset cam lifts the carry levers at the start of the next turn [F]
  ratchet: 12, // anti-reverse ratchet teeth per turn [F] (count estimated)
  rowPitch: 2.4, // mm between rows of the same set; the complement rows sit half a pitch away [V]
  shift: 1.2, // mm the drum rises when the crank is pulled up [V][F]
  lift: 3.2, // mm the carriage lifts to turn or to clear [F]
};
export const stationOf = (col, p) => col - p + 1;
export const thetaTooth = (s, k) => G.entry0 + (s - 1) * G.pitch + k * G.tooth;
export const thetaCarry = (s) => G.carry0 + (s - 1) * G.pitch;

// ------------------------------------------------------------ numbers as digit arrays (index 0 = units)
export const toDigits = (v, n) => Array.from({length: n}, (_, i) => Math.floor(v / 10 ** i) % 10);
export const fromDigits = (d) => d.reduce((a, x, i) => a + x * 10 ** i, 0);
const mod = (a, m) => ((a % m) + m) % m;

/** teeth that reach station s in one turn: the slider's digit, or its nines' complement; the first column ten's */
export function teethAt(s, set, sign) {
  const d = s <= CURTA.sliders ? set[s - 1] : 0;
  if (sign > 0) return d;
  return 9 - d + (s === 1 ? 1 : 0);
}

/**
 * One turn of the crank from the registers reg (11 digits) and ctr (6), the setting set (8), carriage position p,
 * sign +1 (crank down, add) or −1 (crank up, subtract). Returns every column's teeth and carries with their angles.
 */
export function turnEvents(reg, ctr, set, p, sign) {
  const cols = [];
  const carries = [];
  let overflow = null;
  let armIn = false;
  let armAt = null;
  const after = reg.slice();
  const arms = new Array(G.active + 2).fill(0); // carry levers down after the turn, by station
  for (let j = p; j <= CURTA.result; j++) {
    const s = stationOf(j, p);
    const v = reg[j - 1];
    const n = teethAt(s, set, sign);
    const teeth = Array.from({length: n}, (_, k) => thetaTooth(s, k));
    const cin = armIn ? 1 : 0;
    if (cin) carries.push({col: j, station: s, at: thetaCarry(s), from: armAt});
    // where the wheel passes 9 → 0 (the pin on its 9 pushes the next lever down) [F]
    let wrap = null;
    if (v + n >= 10) wrap = teeth[9 - v] + G.toothDur;
    else if (cin && v + n === 9) wrap = thetaCarry(s) + G.carryDur;
    after[j - 1] = (v + n + cin) % 10;
    cols.push({col: j, station: s, v0: v, n, teeth, cin, wrap, v1: after[j - 1]});
    armIn = wrap !== null;
    armAt = wrap;
    if (wrap !== null) arms[s + 1] = 1;
  }
  if (armIn) overflow = {at: armAt, station: stationOf(CURTA.result, p) + 1};
  // the revolution counter: ±1 on the digit of the active position
  const cv = fromDigits(ctr);
  const cv1 = mod(cv + sign * 10 ** (p - 1), 10 ** CURTA.counter);
  const ctrAfter = toDigits(cv1, CURTA.counter);
  const ctrSteps = ctrAfter.map((d, i) => (d !== ctr[i] ? 1 : 0));
  return {cols, carries, overflow, after, ctrAfter, ctrSteps, sign, p, set: set.slice(), arms, reg0: reg.slice(), ctr0: ctr.slice()};
}

/** the addend one turn puts into the 11 columns (the setting shifted, or its ten's complement), for the panel */
export function addendOf(set, p, sign) {
  const out = new Array(CURTA.result).fill(null);
  for (let j = p; j <= CURTA.result; j++) out[j - 1] = teethAt(stationOf(j, p), set, sign);
  return out;
}

// ------------------------------------------------------------ easing
const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smoother = (x) => {
  const u = clamp01(x);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));
// state to state, cubic-bezier(0.65, 0, 0.35, 1)-like
const inout = (x) => {
  const u = clamp01(x);
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
};

// Fritsch-Carlson monotone cubic: θ never runs backwards and slows smoothly into each key
export function monotone(keys) {
  const n = keys.length;
  const x = keys.map((k) => k[0]);
  const y = keys.map((k) => k[1]);
  if (n === 1) return () => y[0];
  const d = [];
  const m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = keys[0][2] ?? d[0];
  m[n - 1] = keys[n - 1][2] ?? d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = keys[i][2] ?? (d[i - 1] * d[i] <= 0 ? 0 : (3 * (d[i - 1] + d[i])) / ((2 * d[i] + d[i - 1]) / d[i - 1] + (d[i] + 2 * d[i - 1]) / d[i]));
  return (t) => {
    if (t <= x[0]) return y[0];
    if (t >= x[n - 1]) return y[n - 1];
    let i = 0;
    while (t > x[i + 1]) i++;
    const h = x[i + 1] - x[i];
    const s = (t - x[i]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}

// ------------------------------------------------------------ the plan
// Steps, each {kind, t0, t1, ...}:
//   slide {to: [8 digits]}         the sliders move to a new setting, one after the other
//   turns {n, keys?}               n turns; keys [[t, θ in this step, slope?]] shape the crank's motion
//   carriage {to}                  lift, turn to position `to`, drop
//   crank {up}                     pull the crank up (subtract) or push it down
//   clear {to?}                    lift the carriage, the ring clears both registers in one turn, (turn to `to`), drop
export const ZERO = () => ({set: new Array(CURTA.sliders).fill(0), up: 0, p: 1, reg: new Array(CURTA.result).fill(0), ctr: new Array(CURTA.counter).fill(0), arms: new Array(G.active + 2).fill(0), shaft: new Array(G.active + 2).fill(0), turnsDone: 0, hist: []});

export function createPlan(init = ZERO()) {
  const plan = {steps: [], end: init, turns: []};
  plan.add = (step) => addStep(plan, step);
  return plan;
}

function addStep(plan, step) {
  const s0 = plan.end;
  const st = {...step, s0};
  const e = {...s0, set: s0.set.slice(), reg: s0.reg.slice(), ctr: s0.ctr.slice(), arms: s0.arms.slice(), shaft: s0.shaft.slice(), hist: s0.hist.slice()};
  if (step.kind === 'slide') {
    st.from = s0.set.slice();
    e.set = step.to.slice();
    // each slider that moves gets its own slice of the step
    const moving = st.from.map((d, i) => (d !== step.to[i] ? i : -1)).filter((i) => i >= 0);
    st.order = moving;
  } else if (step.kind === 'turns') {
    st.ev = [];
    let reg = s0.reg;
    let ctr = s0.ctr;
    const sign = s0.up ? -1 : 1;
    for (let k = 0; k < step.n; k++) {
      const ev = turnEvents(reg, ctr, s0.set, s0.p, sign);
      ev.index = s0.turnsDone + k;
      // each shaft's cumulative teeth, so the gears' pose is a function of the plan alone
      ev.shaft0 = (k ? st.ev[k - 1].shaft1 : s0.shaft).slice();
      ev.shaft1 = ev.shaft0.slice();
      for (const c of ev.cols) ev.shaft1[c.station] += c.n + c.cin;
      st.ev.push(ev);
      plan.turns.push(ev);
      reg = ev.after;
      ctr = ev.ctrAfter;
    }
    e.reg = reg;
    e.ctr = ctr;
    e.arms = st.ev[st.ev.length - 1].arms;
    e.shaft = st.ev[st.ev.length - 1].shaft1;
    e.turnsDone = s0.turnsDone + step.n;
    // the operation as one would write it by hand: consecutive turns at one position and sign group together
    const last = e.hist[e.hist.length - 1];
    const val = fromDigits(s0.set);
    if (last && last.p === s0.p && last.sign === sign && last.set === val && !last.closed) e.hist[e.hist.length - 1] = {...last, n: last.n + step.n};
    else e.hist.push({p: s0.p, sign, set: val, n: step.n});
    const f = step.keys ? monotone(step.keys.map(([t, th, m]) => [step.t0 + t, th, m])) : null;
    st.theta = f || ((t) => 360 * step.n * inout((t - step.t0) / (step.t1 - step.t0)));
  } else if (step.kind === 'carriage') {
    e.p = step.to;
    e.hist = e.hist.map((h) => ({...h, closed: true}));
  } else if (step.kind === 'crank') {
    e.up = step.up ? 1 : 0;
  } else if (step.kind === 'clear') {
    e.reg = new Array(CURTA.result).fill(0);
    e.ctr = new Array(CURTA.counter).fill(0);
    if (step.to) e.p = step.to;
    e.hist = [];
    e.cleared = s0.hist;
  }
  st.s1 = e;
  plan.steps.push(st);
  plan.end = e;
  return st;
}

/** the step running at t (or the last one before it), and the index */
function stepAt(plan, t) {
  let lo = 0;
  let hi = plan.steps.length - 1;
  if (hi < 0 || t < plan.steps[0].t0) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (plan.steps[mid].t0 <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** wheel position (digits, float, not wrapped) of one column at θ inside a turn */
function colPos(c, th) {
  let x = c.v0;
  for (const a of c.teeth) x += ss(a, a + G.toothDur, th);
  if (c.cin) x += ss(thetaCarry(c.station), thetaCarry(c.station) + G.carryDur, th);
  return x;
}

/**
 * The machine at time t: {set, setPos[8], up (0..1), p, carPos (float position), lift (0..1), ring (°), reg[11],
 * regPos[11], ctr[6], ctrPos[6], arms[station] (0..1), turn: {ev, θ, n, slow} | null, theta (cumulative °), phase}
 */
export function state(plan, t) {
  const i = stepAt(plan, t);
  const base = i < 0 ? plan.steps[0]?.s0 ?? plan.end : t > plan.steps[i].t1 ? plan.steps[i].s1 : plan.steps[i].s0;
  const S = {
    set: base.set,
    setPos: base.set.slice(),
    up: base.up,
    p: base.p,
    carPos: base.p,
    lift: 0,
    ring: 0,
    reg: base.reg,
    regPos: base.reg.slice(),
    ctr: base.ctr,
    ctrPos: base.ctr.slice(),
    arms: base.arms.slice(),
    shaft: base.shaft.slice(),
    turn: null,
    theta: 360 * base.turnsDone,
    turnsDone: base.turnsDone,
    hist: base.hist,
    phase: 'idle',
    step: i,
    k: 0,
  };
  if (i < 0 || t > plan.steps[i].t1) return S;
  const st = plan.steps[i];
  const k = (t - st.t0) / Math.max(1e-6, st.t1 - st.t0);
  S.k = k;
  S.phase = st.kind;
  if (st.kind === 'slide') {
    const n = st.order.length;
    st.order.forEach((si, q) => {
      const a = n > 1 ? (q / n) * 0.55 : 0;
      const u = inout((k - a) / (1 - (n > 1 ? 0.55 : 0)));
      S.setPos[si] = st.from[si] + (st.to[si] - st.from[si]) * u;
    });
    S.set = S.setPos.map((x) => Math.round(x));
  } else if (st.kind === 'crank') {
    const u = inout(k);
    S.up = st.up ? u : 1 - u;
  } else if (st.kind === 'carriage') {
    S.lift = ss(0, 0.28, k) * (1 - ss(0.78, 1, k));
    S.carPos = st.s0.p + (st.to - st.s0.p) * inout((k - 0.3) / 0.46);
  } else if (st.kind === 'clear') {
    S.lift = ss(0, 0.14, k) * (1 - ss(0.88, 1, k));
    const r = inout((k - 0.16) / 0.56);
    S.ring = 360 * r;
    if (st.to) S.carPos = st.s0.p + (st.to - st.s0.p) * inout((k - 0.72) / 0.15);
    // the ring's racks sweep each wheel back to 0 as they pass it, forward [F]
    const sweep = (vals, n, a0) =>
      vals.map((v, j) => {
        if (!v) return 0;
        const a = a0 + (j / n) * 300;
        return v + (10 - v) * ss(a, a + 50, S.ring);
      });
    S.regPos = sweep(st.s0.reg, CURTA.result, 0);
    S.ctrPos = sweep(st.s0.ctr, CURTA.counter, 20);
    S.reg = S.regPos.map((x) => Math.round(x) % 10);
    S.ctr = S.ctrPos.map((x) => Math.round(x) % 10);
  } else if (st.kind === 'turns') {
    const th = Math.min(360 * st.n, Math.max(0, st.theta(t)));
    const n = Math.min(st.n - 1, Math.floor(th / 360));
    const thIn = th - 360 * n;
    const ev = st.ev[n];
    S.theta = 360 * st.s0.turnsDone + th;
    S.turn = {ev, th: thIn, n, of: st.n, sign: ev.sign};
    // registers in motion
    S.shaft = ev.shaft0.slice();
    for (const c of ev.cols) {
      S.regPos[c.col - 1] = colPos(c, thIn);
      S.shaft[c.station] += S.regPos[c.col - 1] - c.v0;
    }
    for (let c = 0; c < CURTA.counter; c++) S.ctrPos[c] = ev.ctr0[c] + ev.sign * ev.ctrSteps[c] * ss(G.counterAt, G.counterAt + G.counterDur, thIn);
    S.reg = S.regPos.map((x) => Math.floor(x + 1e-6) % 10);
    S.ctr = S.ctrPos.map((x) => mod(Math.round(x), 10));
    // carry levers: the previous turn's lift at the start; this turn's drop when the wheel below passes 9 → 0
    const prev = n > 0 ? st.ev[n - 1].arms : st.s0.arms;
    const up = ss(G.armReset[0], G.armReset[1], thIn);
    S.arms = prev.map((a) => a * (1 - up));
    for (const c of ev.cols) if (c.wrap !== null) S.arms[c.station + 1] = Math.max(S.arms[c.station + 1], ss(c.wrap - 4, c.wrap, thIn));
    // the turn's active station: the one a tooth or the carry tooth is driving now
    S.active = activeAt(ev, thIn);
  }
  return S;
}

/** the station being driven at θ (tooth or carry), the carry in flight, for the accent */
export function activeAt(ev, th) {
  let tooth = null;
  let carry = null;
  for (const c of ev.cols) {
    for (const a of c.teeth) if (th >= a - 1 && th < a + G.toothDur + 1) tooth = {station: c.station, col: c.col};
    if (c.cin) {
      const a = thetaCarry(c.station);
      if (th >= a - 6 && th < a + G.carryDur + 4) carry = {station: c.station, col: c.col};
    }
  }
  return {tooth, carry};
}

/** every timed event of a plan, for the score: ratchet clicks, teeth, carries, steps */
export function soundEvents(plan) {
  const out = {ratchet: [], home: [], carry: [], overflow: [], counter: [], slide: [], carriageLift: [], carriageNotch: [], carriageDrop: [], crank: [], ring: []};
  // invert θ(t) inside a step by bisection
  const tAt = (st, th) => {
    let lo = st.t0;
    let hi = st.t1;
    for (let q = 0; q < 40; q++) {
      const mid = (lo + hi) / 2;
      if (st.theta(mid) < th) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  for (const st of plan.steps) {
    if (st.kind === 'turns') {
      for (let n = 0; n < st.n; n++) {
        const ev = st.ev[n];
        for (let r = 1; r < G.ratchet; r++) out.ratchet.push(tAt(st, n * 360 + (r * 360) / G.ratchet));
        out.home.push(tAt(st, (n + 1) * 360 - 0.5));
        for (const c of ev.carries) out.carry.push({t: tAt(st, n * 360 + c.at), col: c.col});
        if (ev.overflow) out.overflow.push(tAt(st, n * 360 + ev.overflow.at + G.pitch));
        out.counter.push(tAt(st, n * 360 + G.counterAt + G.counterDur * 0.6));
      }
    } else if (st.kind === 'slide') {
      const n = st.order.length;
      st.order.forEach((si, q) => {
        const a = n > 1 ? (q / n) * 0.55 : 0;
        const span = 1 - (n > 1 ? 0.55 : 0);
        const steps = Math.abs(st.to[si] - st.from[si]);
        for (let d = 1; d <= steps; d++) {
          // the slider's detent at each digit, on its eased path
          const target = d / steps;
          let lo = 0;
          let hi = 1;
          for (let q2 = 0; q2 < 30; q2++) {
            const mid = (lo + hi) / 2;
            if (inout(mid) < target - 0.5 / steps) lo = mid;
            else hi = mid;
          }
          out.slide.push(st.t0 + (a + lo * span) * (st.t1 - st.t0));
        }
      });
    } else if (st.kind === 'carriage' || st.kind === 'clear') {
      const L = (x) => st.t0 + x * (st.t1 - st.t0);
      out.carriageLift.push(L(st.kind === 'clear' ? 0.07 : 0.14));
      out.carriageDrop.push(L(st.kind === 'clear' ? 0.97 : 0.96));
      const from = st.s0.p;
      const to = st.to ?? from;
      const a0 = st.kind === 'clear' ? 0.72 : 0.3;
      const span = st.kind === 'clear' ? 0.15 : 0.46;
      for (let q = 1; q <= Math.abs(to - from); q++) out.carriageNotch.push(L(a0 + span * (q / Math.max(1, Math.abs(to - from))) * 0.95));
      if (st.kind === 'clear') out.ring.push([L(0.16), L(0.72)]);
    } else if (st.kind === 'crank') out.crank.push(st.t0 + 0.75 * (st.t1 - st.t0));
  }
  return out;
}
