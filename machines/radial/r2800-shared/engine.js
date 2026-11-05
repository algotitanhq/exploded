// The R-2800 Double Wasp, the numbers: one source for every figure the page shows and every pose the 3D takes.
// Modelled on a C-series R-2800 CB16 (Douglas DC-6B, Convair 340) from public sources; not affiliated with Pratt &
// Whitney. The letters match REFERENCES.md: [F] the FAA type certificate data sheet 6A3, [N] the Smithsonian NASM
// record, [H] the FAA powerplant handbook, [W] the published series description, [E] an estimate (not public).
//
// No three.js in here: node imports it for check.mjs, the timeline and the score. Units are millimetres and degrees.
// Angles around the engine are measured clockwise from the top, seen from the rear (the pilot's side); the crankshaft
// turns clockwise seen from the rear, the usual US "right-hand tractor".

export const E = {
  bore: 146.05, // 5.75 in [W]
  stroke: 152.4, // 6.0 in [W]
  r: 76.2, // crank throw, half the stroke
  L: 292, // master rod, crankpin centre to piston pin [E]
  rk: 60.3, // knuckle-pin circle on the master rod's big end, 2.375 in [E]
  l: 231.7, // articulated rod, knuckle pin to piston pin: L - rk [E]
  cr: 6.75, // compression ratio of the C series [W]
  compH: 66, // piston pin to crown [E]
  rowZ: {rear: -105, front: 105}, // the two rows along the axis [E]
  master: {rear: 13, front: 8}, // the cylinders that carry the master rods [E]
};
export const DISPL_IN3 = (Math.PI / 4) * 5.75 ** 2 * 6 * 18; // 2,804.5 in³
export const DISPL_L = DISPL_IN3 * 0.016387064; // 45.96 L
export const RATING = {
  takeoff: {hp: 2050, rpm: 2700, map: 55.0}, // dry, two minutes, low blower [F]
  wet: {hp: 2400, rpm: 2800, map: 59.5}, // water-alcohol injection [F]
  meto: {hp: 1800, rpm: 2600, map: 48.5}, // maximum continuous [F]
  idle: 700, // [E]
  crank: 140, // starter cranking speed [E]
};
export const GEAR = {prop: 0.45, impLow: 7.29, impHigh: 8.58}; // [F]
export const MASS_KG = 1068; // 2,350 lb [N]
export const DIAMETER_MM = 1341; // 52.8 in [N]
export const LENGTH_MM = 2068; // 81.4 in [N]
export const PROP_D = 4.0; // m, a three-blade Hamilton Standard [E]

// ------------------------------------------------------------ cylinders, numbering and firing order
// 1 at the top of the rear row, then clockwise seen from the rear: odd numbers in the rear row, even in the front,
// the front row turned 20° from the rear one [H]. 18 cylinders, 20° apart, 40° within a row.
export const CYL = Array.from({length: 18}, (_, i) => {
  const c = i + 1;
  const row = c % 2 ? 'rear' : 'front';
  return {c, row, k: Math.floor(i / 2), angle: 20 * i, z: E.rowZ[row]};
});
export const ROWS = {rear: CYL.filter((x) => x.row === 'rear'), front: CYL.filter((x) => x.row === 'front')};
// the firing order numbers of an 18-cylinder twin-row radial are +11 and -7 [H]
export const ORDER = (() => {
  const o = [1];
  while (o.length < 18) {
    const a = o[o.length - 1] + 11;
    o.push(a <= 18 ? a : o[o.length - 1] - 7);
  }
  return o;
})();
export const INTERVAL = 720 / 18; // 40° of crank between firings
export const FIRE = Object.fromEntries(ORDER.map((c, i) => [c, i * INTERVAL])); // crank angle of each firing TDC
export const SPARK_ADV = 25; // ° before TDC [E]
const mod = (a, m) => ((a % m) + m) % m;
export const wrap180 = (a) => mod(a + 180, 360) - 180;
/** four-stroke phase of cylinder c, degrees after its firing TDC: 0-180 power, 180-360 exhaust, 360-540 intake, 540-720 compression */
export const psi = (c, th) => mod(th - FIRE[c], 720);
export const STROKES = ['power', 'exhaust', 'intake', 'compression'];
export const strokeOf = (ps) => STROKES[Math.floor(mod(ps, 720) / 180)];

// ------------------------------------------------------------ the crank and the rods, exact
const vec = (a) => [Math.sin((a * Math.PI) / 180), Math.cos((a * Math.PI) / 180)];
const rotCW = ([x, y], a) => {
  const c = Math.cos((a * Math.PI) / 180);
  const s = Math.sin((a * Math.PI) / 180);
  return [x * c + y * s, -x * s + y * c];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
/** the crankpin of a row: the rear one at θ, the front one at θ + 180° */
export const pinAngle = (row, th) => (row === 'rear' ? th : th + 180);
/**
 * every rod of one row at crank angle th: the crankpin C, the master rod's direction d, and for each cylinder its
 * piston pin distance from the axis s (mm), its knuckle pin K (the master's own is C) and its piston pin P, in the
 * plane of the row seen from the rear (x right, y up)
 */
export function rowPose(row, th) {
  const C = vec(pinAngle(row, th)).map((v) => v * E.r);
  const m = CYL[E.master[row] - 1];
  const um = vec(m.angle);
  const sm = dot(C, um) + Math.sqrt(E.L * E.L - cross(C, um) ** 2);
  const Pm = [um[0] * sm, um[1] * sm];
  const d = [(Pm[0] - C[0]) / E.L, (Pm[1] - C[1]) / E.L];
  const out = {C, d, cyl: {}};
  for (const cy of ROWS[row]) {
    const u = vec(cy.angle);
    if (cy.c === m.c) {
      out.cyl[cy.c] = {s: sm, K: C, P: Pm, master: true};
      continue;
    }
    const kd = rotCW(d, cy.angle - m.angle);
    const K = [C[0] + kd[0] * E.rk, C[1] + kd[1] * E.rk];
    const s = dot(K, u) + Math.sqrt(E.l * E.l - cross(K, u) ** 2);
    out.cyl[cy.c] = {s, K, P: [u[0] * s, u[1] * s], master: false};
  }
  return out;
}
export const pistonS = (c, th) => rowPose(CYL[c - 1].row, th).cyl[c].s;

// the law of each piston, sampled once at 0.05°: stroke, TDC height and where TDC falls, against the ideal
// slider-crank of the master rod
export const LAW = (() => {
  const out = {};
  for (const cy of CYL) {
    let max = -1e9;
    let min = 1e9;
    let thMax = 0;
    let thMin = 0;
    for (let i = 0; i < 7200; i++) {
      const th = i * 0.05;
      const s = pistonS(cy.c, th);
      if (s > max) [max, thMax] = [s, th];
      if (s < min) [min, thMin] = [s, th];
    }
    // the crank angle at which the pin points at this cylinder: TDC for a plain slider-crank
    const ideal = mod(cy.angle - (cy.row === 'rear' ? 0 : 180), 360);
    const A = (Math.PI / 4) * E.bore * E.bore;
    out[cy.c] = {sTDC: max, sBDC: min, stroke: max - min, thTDC: thMax, thBDC: thMin, tdcLag: wrap180(thMax - ideal), bdcLag: wrap180(thMin - ideal - 180), A};
  }
  // clearance volume: set by the master's compression ratio; a piston that stops lower leaves a bigger chamber
  for (const row of ['rear', 'front']) {
    const m = out[E.master[row]];
    const Vc = (m.A * m.stroke) / (E.cr - 1);
    for (const cy of ROWS[row]) {
      const x = out[cy.c];
      x.Vc = Vc + x.A * (m.sTDC - x.sTDC);
      x.cr = (x.Vc + x.A * x.stroke) / x.Vc;
      x.dTDC = x.sTDC - m.sTDC;
    }
  }
  return out;
})();
export const MASTER_STROKE = LAW[E.master.front].stroke;

// ------------------------------------------------------------ valves: two cam rings, no camshaft
// one ring per row, two tracks (inlet, exhaust), 4 lobes 90° apart, turning at 1/8 crank speed against the crank:
// a lobe reaches each tappet once every 720° of crank [H]. Valve events in crank degrees after the firing TDC [E].
export const CAM = {lobes: 4, ratio: -1 / 8, liftMm: 15.9, zOff: 88};
export const VALVE = {in: [340, 600], ex: [130, 380]}; // inlet opens 20° BTDC, closes 60° ABDC; exhaust 50° BBDC to 20° ATDC
const centre = ([a, b]) => (a + b) / 2;
const halfCam = ([a, b]) => (b - a) / 16; // the event's half-width in cam degrees (crank ÷ 8 ÷ 2)
// each track's phase, derived from the firing order: the lobe is centred on cylinder c's tappet when the crank is at
// the centre of c's event. The same constant holds for every cylinder of a row (check.mjs verifies it).
const phaseOf = (row, ev) => {
  const c = ROWS[row][0];
  return mod(c.angle + (FIRE[c.c] + centre(VALVE[ev])) / 8, 90);
};
export const CAM_PHASE = {rear: {in: phaseOf('rear', 'in'), ex: phaseOf('rear', 'ex')}, front: {in: phaseOf('front', 'in'), ex: phaseOf('front', 'ex')}};
/** the ring's rotation (degrees, clockwise from the rear) at crank angle th: it turns against the crank at 1/8 */
export const camAngle = (th) => th * CAM.ratio;
/** a lobe's offset in front of cylinder c's tappet, cam degrees, in [-45, 45) */
export const lobeOffset = (c, ev, th) => {
  const cy = CYL[c - 1];
  return mod(cy.angle - camAngle(th) - CAM_PHASE[cy.row][ev] + 45, 90) - 45;
};
/** the lobe's rise under a tappet: 0..1, a smooth bump over the event's width */
export const lobeRise = (x, half) => {
  const u = Math.abs(x) / half;
  return u >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * u);
};
/** valve lift of cylinder c (0..1 of CAM.liftMm), read off the cam ring at crank angle th */
export const lift = (c, ev, th) => lobeRise(lobeOffset(c, ev, th), halfCam(VALVE[ev]));
/** the same lift from the valve timing alone, for check.mjs */
export const liftFromTiming = (c, ev, th) => {
  const ps = psi(c, th);
  const [a, b] = VALVE[ev];
  const x = mod(ps - centre([a, b]) + 360, 720) - 360;
  return lobeRise(x / 8, halfCam([a, b]));
};

// ------------------------------------------------------------ ignition
// 2 plugs per cylinder (36), 2 magnetos each feeding one plug of every cylinder; a distributor turns at half crank
// speed so each plug fires once in two turns [W]
export const IGN = {plugs: 36, magnetos: 2, distRatio: 0.5};
/** how long ago (crank degrees) cylinder c's plugs last fired, at th; the flame lights from the spark to ~70° ATDC */
export const sinceSpark = (c, th) => mod(th - (FIRE[c] - SPARK_ADV), 720);

// ------------------------------------------------------------ power, from the rpm alone
// quasi-steady: the propeller at fine pitch absorbs P ∝ N³, set to the take-off rating at 2,700 rpm [E]. The power
// needs a brake mean effective pressure; manifold pressure follows from bmep = k·MAP − friction − pumping, k set so
// that the take-off point is exact (2,050 hp needs 55.0 inHg [F]). check.mjs holds the METO point within 7 %.
const HP = 745.7;
const INHG = 0.033864; // bar per inHg
const AMB = 29.92;
export const fmep = (N) => 1.2 + 0.6 * (N / 2700) ** 2; // bar [E]
export const propHp = (N) => RATING.takeoff.hp * (N / RATING.takeoff.rpm) ** 3;
/** bmep in bar for a brake power (hp) at N rpm */
export const bmepOf = (hp, N) => (N > 1 ? (2 * hp * HP) / ((DISPL_L / 1000) * (N / 60)) / 1e5 : 0);
export const K_MAP = (() => {
  const {hp, rpm, map} = RATING.takeoff;
  return (bmepOf(hp, rpm) + fmep(rpm) + (AMB - map) * INHG) / map;
})();
/** brake power from MAP and N (the inverse) */
export const hpOf = (map, N) => (Math.max(0, K_MAP * map - fmep(N) - (AMB - map) * INHG) * 1e5 * (DISPL_L / 1000) * (N / 60)) / 2 / HP;
/**
 * the engine's state at N rpm. run 0..1: how far the engine has caught (0 on the starter, 1 running). Returns
 * manifold pressure (inHg), brake power (hp), crank torque (N·m), firing frequency (Hz), mean piston speed (m/s),
 * propeller and impeller rpm.
 */
export function stateAt(N, run = 1) {
  const hp = run * propHp(N);
  const mapRun = N > 1 ? (bmepOf(propHp(N), N) + fmep(N) + AMB * INHG) / (K_MAP + INHG) : AMB;
  const mapCrank = AMB - 0.9 * Math.min(1, N / 100);
  const map = mapCrank + (mapRun - mapCrank) * run;
  const w = (N * 2 * Math.PI) / 60;
  return {
    N,
    map,
    hp,
    kw: hp * HP * 1e-3,
    torque: w > 0.1 ? (hp * HP) / w : 0,
    fireHz: (N / 60) * 9,
    pistonMs: (2 * E.stroke * 1e-3 * N) / 60,
    propRpm: N * GEAR.prop,
    impRpm: N * GEAR.impLow,
  };
}
export const AMBIENT_INHG = AMB;
