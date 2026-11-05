// Recomputes, from the same functions the page draws with, every figure Pepper shows, and fails if one is wrong:
// the registers' capacity, the multiplication of the film, the subtraction by the ten's complement, a carry cascade
// from …999 + 1, the order and timing of the carries over one turn, and 3,000 random turns against plain arithmetic.
// node machines/pepper/check.mjs (CI runs it on every push).
import {rng} from '../../kit/util.js';
import {CURTA, G, addendOf, createPlan, fromDigits, stationOf, thetaCarry, thetaTooth, toDigits, turnEvents} from './curta-shared/machine.js';
import {SETTING, filmFacts, filmPlan} from './curta-shared/schedule.js';

let bad = 0;
const eq = (name, v, want) => {
  const ok = v === want;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'}  ${name.padEnd(54)} ${v}${ok ? '' : `  (want ${want})`}`);
};
const near = (name, v, lo, hi, unit = '') => {
  const ok = v >= lo && v <= hi;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'}  ${name.padEnd(54)} ${v} ${unit}  [${lo} … ${hi}]`);
};

// ---- the figures [W][F][H]
eq('setting sliders (Type I)', CURTA.sliders, 8);
eq('counter digits (Type I)', CURTA.counter, 6);
eq('result digits (Type I)', CURTA.result, 11);
eq('Type II: 11 · 8 · 15', `${CURTA.typeII.sliders} · ${CURTA.typeII.counter} · ${CURTA.typeII.result}`, '11 · 8 · 15');
near('diameter', CURTA.diameter, 52, 54, 'mm');
near('height', CURTA.height, 84, 86, 'mm');
near('mass', CURTA.mass, 228, 232, 'g');
near('Type I made', CURTA.made, 80000, 80000);
// capacity: the largest number each register holds
eq('result capacity', 10 ** CURTA.result - 1, 99999999999);
eq('counter capacity', 10 ** CURTA.counter - 1, 999999);
eq('setting capacity', 10 ** CURTA.sliders - 1, 99999999);
// the carriage turns through as many positions as the counter has digits; the setting reaches the top column
eq('carriage positions = counter digits', CURTA.counter, 6);

// ---- the film: 1 234 × 56, then one turn back
const plan = filmPlan();
const f = filmFacts(plan);
eq('setting', f.set, 1234);
eq('6 turns in position 1 (counter)', f.m1, 6);
eq('… then 5 in position 2 (counter)', f.m2, 56);
eq('1 234 × 56', f.r1, 1234 * 56);
eq('one turn back in position 2: 69 104 − 12 340', f.r2, 69104 - 12340);
eq('counter after the subtraction', f.c2, 46);
eq('1 234 × 46 = the result', f.r2, 1234 * 46);
const sub = plan.turns[plan.turns.length - 1];
// the ten's complement: 9 − d in each column, 10 − d in the first, over the 11 columns from the carriage position
const add = addendOf(sub.set, sub.p, -1);
const addV = add.reduce((a, x, i) => a + (x ?? 0) * 10 ** i, 0);
eq('addend = 10^11 − 12 340', addV, 10 ** 11 - 12340);
eq('first column takes 10 − 4 teeth', add[sub.p - 1], 6);
eq('…the column above takes 9 − 3', add[sub.p], 6);
// the carries of that turn: one per column from the 5th to the 11th, in order, and one off the top
eq('carries in the subtraction turn', sub.carries.map((c) => c.col).join(','), '5,6,7,8,9,10,11');
eq('overflow off the 11th column', !!sub.overflow, true);
let order = true;
for (let i = 1; i < sub.carries.length; i++) if (!(sub.carries[i].at > sub.carries[i - 1].at && sub.carries[i].from < sub.carries[i].at && sub.carries[i].from > sub.carries[i - 1].from)) order = false;
eq('carries in order, each after the 9 → 0 that set it', order, true);

// ---- …999 + 1: the longest cascade
{
  const reg = new Array(CURTA.result).fill(9);
  const ev = turnEvents(reg, new Array(CURTA.counter).fill(0), [1, 0, 0, 0, 0, 0, 0, 0], 1, 1);
  eq('99 999 999 999 + 1 = 0 (11 digits)', fromDigits(ev.after), 0);
  eq('…with 10 carries', ev.carries.length, 10);
  eq('…and the 1 off the top', !!ev.overflow, true);
  near('…last carry, crank angle', thetaCarry(11), 330, 330, '°');
}

// ---- the timing over one turn: every station's teeth end before its carry, the carry tooth runs in order, the
// counter steps last, everything inside 360°
{
  let ok = true;
  for (let s = 1; s <= G.active; s++) {
    if (s > 1 && thetaCarry(s) <= thetaCarry(s - 1) + G.carryDur) ok = false;
    // a wrap in column s (teeth or carry) always comes before the carry tooth reaches s + 1
    if (Math.max(thetaTooth(s, s === 1 ? 9 : 8) + G.toothDur, thetaCarry(s) + G.carryDur) >= thetaCarry(s + 1)) ok = false;
  }
  eq('teeth, then carries in order, per station', ok, true);
  near('carries span (crank angle)', thetaCarry(G.active) - thetaCarry(2), 0, 240, '°');
  near('counter step after the last carry', G.counterAt - (thetaCarry(G.active) + G.carryDur), 0, 30, '°');
  near('the complement shift = half a row', G.shift / G.rowPitch, 0.5, 0.5);
}

// ---- 3,000 random turns against plain arithmetic, mod 10^11 and 10^6
{
  const r = rng(1948);
  let ok = true;
  let reg = new Array(CURTA.result).fill(0);
  let ctr = new Array(CURTA.counter).fill(0);
  let R = 0n;
  let C = 0;
  const M = 10n ** 11n;
  for (let k = 0; k < 3000; k++) {
    const set = Array.from({length: 8}, () => Math.floor(r() * 10));
    const p = 1 + Math.floor(r() * 6);
    const sign = r() < 0.4 ? -1 : 1;
    const ev = turnEvents(reg, ctr, set, p, sign);
    reg = ev.after;
    ctr = ev.ctrAfter;
    R = (((R + BigInt(sign) * BigInt(fromDigits(set)) * 10n ** BigInt(p - 1)) % M) + M) % M;
    C = (((C + sign * 10 ** (p - 1)) % 1e6) + 1e6) % 1e6;
    const got = BigInt(reg.reduce((a, x, i) => a + BigInt(x) * 10n ** BigInt(i), 0n));
    if (got !== R || fromDigits(ctr) !== C) ok = false;
  }
  eq('3,000 random turns = arithmetic mod 10^11 / 10^6', ok, true);
}
// the live page's plan gives the same as the film's for the same steps
{
  const p2 = createPlan();
  p2.add({kind: 'slide', t0: 0, t1: 1, to: SETTING});
  p2.add({kind: 'turns', t0: 1, t1: 2, n: 6});
  p2.add({kind: 'carriage', t0: 2, t1: 3, to: 2});
  p2.add({kind: 'turns', t0: 3, t1: 4, n: 5});
  eq('a plan built step by step', fromDigits(p2.end.reg), 69104);
  eq('stations: column 1 in position 2 is parked', stationOf(1, 2), 0);
}
void toDigits;

if (bad) {
  console.error(`\n${bad} figure(s) wrong`);
  process.exit(1);
}
console.log('\nevery figure checks');
