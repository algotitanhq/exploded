// Recomputes, from the same functions the page draws with, every figure Radial shows, and fails if one leaves the
// range its source gives. node machines/radial/check.mjs (CI runs it on every push).
import {CAM, CYL, DISPL_IN3, DISPL_L, E, FIRE, GEAR, hpOf, LAW, lift, liftFromTiming, ORDER, pinAngle, RATING, ROWS, stateAt} from './r2800-shared/engine.js';
import {DURATION, rpmAt, sparkList, thetaAt} from './r2800-shared/schedule.js';

let bad = 0;
const near = (name, v, lo, hi, unit = '') => {
  const ok = v >= lo && v <= hi;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'}  ${name.padEnd(52)} ${Number(v.toPrecision(6))} ${unit}  [${lo} … ${hi}]`);
};
const mod = (a, m) => ((a % m) + m) % m;

// displacement: π/4 × 5.75² × 6 × 18 = 2,804.5 in³ [W]
near('displacement', DISPL_IN3, 2804, 2805, 'in³');
near('displacement', DISPL_L, 45.9, 46.0, 'L');

// the firing order: +11, −7 [H], each cylinder once in 720°, 40° apart, the rows alternating
const BRIEF = '1-12-5-16-9-2-13-6-17-10-3-14-7-18-11-4-15-8';
near('firing order is ' + BRIEF, ORDER.join('-') === BRIEF ? 1 : 0, 1, 1);
near('cylinders in the order, each once', new Set(ORDER).size, 18, 18);
let alt = 0;
for (let i = 0; i < 18; i++) if (CYL[ORDER[i] - 1].row !== CYL[ORDER[(i + 1) % 18] - 1].row) alt++;
near('consecutive firings in different rows', alt, 18, 18);
const gaps = ORDER.map((c, i) => mod(FIRE[ORDER[(i + 1) % 18]] - FIRE[c], 720));
near('interval between firings (min)', Math.min(...gaps), 40, 40, '°');
near('interval between firings (max)', Math.max(...gaps), 40, 40, '°');
// at its firing TDC the row's crankpin points at the cylinder (the geometry agrees with the order)
let miss = 0;
for (const cy of CYL) miss = Math.max(miss, Math.abs(((mod(pinAngle(cy.row, FIRE[cy.c]) - cy.angle, 360) + 180) % 360) - 180));
near('crankpin on the cylinder at its firing', miss, 0, 1e-9, '°');
// every spark of the film, counted per cylinder over the running part: once per two turns
{
  const sp = sparkList();
  const t0 = 8;
  const t1 = DURATION - 0.5;
  const turns = (thetaAt(t1) - thetaAt(t0)) / 360;
  const per = CYL.map((cy) => sp.filter((s) => s[1] === cy.c && s[0] >= t0 && s[0] < t1).length);
  near('sparks per cylinder per 2 turns (film)', Math.min(...per) / (turns / 2), 0.98, 1.02);
  near('', Math.max(...per) / (turns / 2), 0.98, 1.02);
}

// the master rod and the articulated rods, exact: the master's piston follows the plain slider-crank law
const mF = LAW[E.master.front];
near('master stroke (2 × crank throw)', mF.stroke, 152.399, 152.401, 'mm');
near('master TDC at its pin angle', Math.abs(mF.tdcLag), 0, 0.05, '°');
const arts = CYL.filter((c) => c.c !== E.master.front && c.c !== E.master.rear).map((c) => LAW[c.c]);
near('articulated strokes, shortest', Math.min(...arts.map((a) => a.stroke)), 152.4, 153.5, 'mm');
near('articulated strokes, longest', Math.max(...arts.map((a) => a.stroke)), 152.4, 153.5, 'mm');
near('articulated TDC, largest shift', Math.max(...arts.map((a) => Math.abs(a.tdcLag))), 0.1, 6, '°');
near('articulated TDC, lowest below the master', -Math.min(...arts.map((a) => a.dTDC)), 0, 4, 'mm');
near('compression ratio, master', mF.cr, 6.7499, 6.7501);
near('compression ratio, lowest articulated', Math.min(...arts.map((a) => a.cr)), 6.0, 6.75);
for (const row of ['rear', 'front']) {
  const ws = ROWS[row].filter((c) => c.c !== E.master[row]).sort((a, b) => Math.abs(LAW[b.c].tdcLag) - Math.abs(LAW[a.c].tdcLag))[0];
  const x = LAW[ws.c];
  console.log(`     ${row} row: master ${E.master[row]}, most different ${ws.c}: stroke ${x.stroke.toFixed(3)} mm, TDC ${x.tdcLag.toFixed(2)}°, ${(-x.dTDC).toFixed(2)} mm lower, CR ${x.cr.toFixed(3)}`);
}

// the cam rings: 4 lobes at ⅛ crank speed against the crank [H]; the lift read off the ring equals the valve timing
near('cam ring speed', CAM.ratio, -0.125, -0.125);
near('lobes × 2 × speed = once per two turns', CAM.lobes * 2 * Math.abs(CAM.ratio), 1, 1);
let err = 0;
let opens = 0;
for (const cy of CYL)
  for (const ev of ['in', 'ex']) {
    let prev = lift(cy.c, ev, -0.5);
    for (let th = 0; th < 720; th += 0.5) {
      const a = lift(cy.c, ev, th);
      err = Math.max(err, Math.abs(a - liftFromTiming(cy.c, ev, th)));
      if (a > 0.5 && prev <= 0.5) opens++;
      prev = a;
    }
  }
near('cam lift vs valve timing (max error)', err, 0, 1e-9);
near('valve openings in 720° (36 valves)', opens, 36, 36);

// power: the take-off point is exact [F], the maximum-continuous point within 7 %
const to = stateAt(RATING.takeoff.rpm);
near('take-off power at 2,700 rpm', to.hp, 2049.9, 2050.1, 'hp');
near('take-off manifold pressure', to.map, 54.99, 55.01, 'inHg');
near('METO 1,800 hp at 2,600 rpm, 48.5″ (model)', hpOf(RATING.meto.map, RATING.meto.rpm), 1800 * 0.93, 1800 * 1.07, 'hp');
near('take-off torque', to.torque, 5400, 5415, 'N·m');
near('firing frequency at 2,700 rpm', to.fireHz, 405, 405, 'Hz');
near('mean piston speed at 2,700 rpm', to.pistonMs, 13.71, 13.72, 'm/s');
near('propeller at 2,700 rpm (0.45 : 1)', to.propRpm, 1215, 1215, 'rpm');
near('impeller at 2,700 rpm (7.29 : 1)', to.impRpm, 19683, 19683, 'rpm');
near('drawn reduction gear 72 / (72 + 88)', 72 / (72 + 88), GEAR.prop, GEAR.prop);
near('idle manifold pressure (model)', stateAt(RATING.idle).map, 8, 16, 'inHg');

// the film's run reaches take-off rpm and comes back to idle
near('film: peak rpm', Math.max(...Array.from({length: 400}, (_, i) => rpmAt(i / 10))), 2690, 2701, 'rpm');
near('film: rpm at the end', rpmAt(DURATION), RATING.idle - 5, RATING.idle + 5, 'rpm');

if (bad) {
  console.error(`\n${bad} figure(s) out of range`);
  process.exit(1);
}
console.log('\nevery figure in range');
