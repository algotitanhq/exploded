// Rope's one source of figures: the Apollo Guidance Computer Block II (the LM's LGC, Luminary 099, Apollo 11), its
// memories, its clock, its Executive and the descent it flew. No three.js here: the geometry (agc.js), the console,
// the score and check.mjs all read these numbers. Letters refer to REFERENCES.md; [E] marks an estimate.
//
// The one input of the machine is the mission time, counted in memory cycles (MCT) since powered descent initiation
// (PDI, 102:33:05 GET). Everything on screen is a function of it: the word in the rope, the core sets, the lamps,
// VERB / NOUN / PROG and R1-R3 on the DSKY.

// ------------------------------------------------------------ the computer [W] [S] [H]
export const AGC = {
  wordBits: 16, // 15 data bits + 1 odd-parity bit [W] [S]
  dataBits: 15,
  fixedWords: 36864, // core rope [W]
  ropeModules: 6, // B1-B6 [S]
  coresPerModule: 512, // 2 layers of 256 [S]
  wordsPerCore: 12, // 12 strands of 16 sense lines = 192 lines through or around each core [S]
  senseLinesPerCore: 192,
  bankWords: 1024, // a fixed bank: 36 banks [V]
  erasableWords: 2048, // coincident-current ferrite cores [W]
  clockHz: 2.048e6, // crystal [W]
  pulsesPerMct: 12, // timing pulses T1-T12, at 1.024 MHz [H]
  addMct: 2, // AD: 2 MCT [H]
  ics: 2800, // ~2,800 flat-packs, dual 3-input NOR gates [W]
  gatesPerIc: 2,
  norInputs: 3,
  logicModules: 24, // A1-A24, ~120 flat-packs each; A25-A31 interface [S]
  massKg: 32, // 70 lb [W]
  powerW: 55, // [W]
  sizeIn: [24, 12.5, 6.5], // [W]
  sizeM: [0.61, 0.32, 0.17], // length, width, height
  dskyM: [0.203, 0.203, 0.178], // LM DSKY, 8 x 8 x 7 in [D]
};
/** one memory cycle: 12 pulses of the 1.024 MHz timing chain (the 2.048 MHz clock halved) */
export const MCT = AGC.pulsesPerMct / (AGC.clockHz / 2); // 11.71875 µs
export const MCT_PER_S = 1 / MCT; // 85,333
export const ADD_US = AGC.addMct * MCT * 1e6; // 23.4 µs
export const ADDS_PER_S = 1 / (AGC.addMct * MCT); // 42,667
export const FIXED_BITS = AGC.fixedWords * AGC.wordBits; // 589,824
export const ERASABLE_BITS = AGC.erasableWords * AGC.wordBits; // 32,768
export const WORDS_PER_MODULE = AGC.coresPerModule * AGC.wordsPerCore; // 6,144

// ------------------------------------------------------------ the Executive and the radar [E1] [L]
export const EXEC = {
  coreSets: 8, // "EIGHT SETS OF 12 REGISTERS EACH" (Luminary 099, ERASABLE_ASSIGNMENTS) [L] [E1]
  vacAreas: 5, // [L] [E1]
  servicerPeriod: 2, // s, average-G navigation cycle (READACCS) [E1]
  // the duty cycle each phase needs, of the whole machine [E1]: margin over 15 % in braking until the landing
  // radar locks, ~13 % after (converting its data), 10 % or less with Verb 16 Noun 68 on the DSKY; under 10 % in P64
  braking: 0.85,
  lrConvert: 0.015,
  n68: 0.03,
  approach: [0.835, 0.9], // P64, essential functions only, high gate to P66: the margin falls below 10 % [E1] [E]
  manual: 0.8, // P66, lighter [E1] [E]
  // the rendezvous radar's CDUs: 2 angles x 6,400 pulses/s at most, one MCT stolen per pulse [E1]
  rrPulses: 6400,
  rrAngles: 2,
  tlossMax: 0.1336, // measured after the flight [E1]
  tloss: 0.13, // the value MIT used to reproduce the flight [E1]
  // the job mix of this model (which jobs hold a core set and how often they come) is simplified [E]
  monitorPeriod: 1, // s, a Verb 16 monitor redisplays every second [P]
  approachJobs: 0.06, // P64: the landing-point-designator display job, each 2 s, s of CPU [E]
};
export const TLOSS_THEORY = EXEC.rrAngles * EXEC.rrPulses * MCT; // 15.0 %

// ------------------------------------------------------------ the descent of Apollo 11 [J] [R]
export const GET0 = 102 * 3600 + 33 * 60 + 5; // PDI, 102:33:05 GET [R]
export const EVENTS = {
  vel: 288, // landing radar velocity data good [E]
  alt: 296, // "Altitude light's out", 102:38:11 [J]
  p64: 507, // high gate, 102:41:32, 7,400 ft [E1]
  p66: 603, // ATT HOLD, P66, 102:43:08 [E1]
  lrDrop: 668, // "Altitude (and) velocity lights" 102:44:13 [J]
  lrBack: 674,
  contact: 755, // "Contact light", 102:45:40 [J]
};
/** the Apollo 11 alarms as flown, s after PDI, to compare with the model's [R] [E1] */
export const FLOWN_ALARMS = [
  [317, 1202], // 102:38:22
  [357, 1202], // 102:39:02
  [553, 1201], // 102:42:18
  [578, 1202], // 102:42:43
  [593, 1202], // 102:42:58
];
// altitude (ft) and horizontal speed (ft/s) against s after PDI: the crew's call-outs [J]; before high gate, where
// nobody called numbers, a smooth braking profile through the published points (33,500 ft at the first alarm,
// 7,400 ft at high gate) [E]
const ALT_KEYS = [
  [0, 50000], [120, 47200], [240, 40400], [317, 33500], [400, 22500], [460, 14000], [507, 7400], [526, 5000],
  [545, 3000], [556, 2000], [598, 750], [602, 700], [606, 600], [611, 540], [621, 400], [628, 350], [641, 300],
  [662, 250], [671, 220], [679, 200], [686, 160], [695, 120], [700, 100], [709, 75], [732, 40], [736, 30], [755, 5], [760, 0],
];
const VH_KEYS = [
  [0, 5560], [120, 4610], [240, 3480], [317, 2700], [400, 1640], [460, 960], [507, 470], [545, 230], [598, 90],
  [621, 58], [641, 47], [662, 19], [671, 13], [679, 11], [700, 9], [709, 6], [736, 2], [755, 0.5], [760, 0],
];
const LPD_KEYS = [[507, 47], [560, 40], [602, 33], [611, 30], [640, 30]]; // LPD angle, degrees [J] [E]

/** Fritsch-Carlson monotone cubic through keys [[x, y]] */
export function monotone(keys) {
  const n = keys.length;
  const x = keys.map((k) => k[0]);
  const y = keys.map((k) => k[1]);
  const d = [];
  const m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (d[i - 1] + d[i])) / ((2 * d[i] + d[i - 1]) / d[i - 1] + (d[i] + 2 * d[i - 1]) / d[i]);
  const f = (t) => {
    if (t <= x[0]) return y[0] + m[0] * (t - x[0]);
    if (t >= x[n - 1]) return y[n - 1];
    let i = 0;
    while (t > x[i + 1]) i++;
    const h = x[i + 1] - x[i];
    const s = (t - x[i]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1];
  };
  return f;
}
const altF = monotone(ALT_KEYS);
const vhF = monotone(VH_KEYS);
const lpdF = monotone(LPD_KEYS);
const END = 760;
// range still to fly, tabulated once: ∫ vh dt from s to the touchdown point
const RNG_DT = 0.25;
const RNG = (() => {
  const n = Math.ceil(END / RNG_DT) + 1;
  const r = new Float64Array(n);
  for (let i = n - 2; i >= 0; i--) r[i] = r[i + 1] + 0.5 * (vhF(i * RNG_DT) + vhF((i + 1) * RNG_DT)) * RNG_DT;
  return r;
})();
const FT_PER_NM = 6076.12;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** the LM's state s seconds after PDI: altitude (ft), its rate (ft/s), horizontal and total speed, range (ft) */
export function descent(s) {
  const t = clamp(s, 0, END);
  const h = Math.max(0, altF(t));
  const hdot = t >= END ? 0 : (altF(Math.min(END, t + 0.5)) - altF(Math.max(0, t - 0.5))) / (Math.min(END, t + 0.5) - Math.max(0, t - 0.5));
  const vh = Math.max(0, vhF(t));
  const i = Math.floor(t / RNG_DT);
  const k = t / RNG_DT - i;
  const range = i >= RNG.length - 1 ? 0 : RNG[i] * (1 - k) + RNG[i + 1] * k;
  // Delta-H: landing-radar altitude minus computed altitude, -2,900 ft when the radar locked [J], then incorporated [E]
  const dH = t < EVENTS.alt ? -2900 : -2900 * Math.exp(-(t - EVENTS.alt) / 38);
  return {s: t, h, hdot, vh, v: Math.hypot(vh, hdot), range, slantNm: Math.hypot(range, h) / FT_PER_NM, dH, lpd: lpdF(t), tgo: Math.max(0, EVENTS.p64 - t)};
}
export const DESCENT_END = END;

// ------------------------------------------------------------ the rope: real words of Luminary 099 [L]
// Assembled words of the Executive's NOVAC (find a core set) and of BAILOUT1, from the Virtual AGC listing of
// Luminary 099 (bank, address, octal word, label, instruction). 15 bits each; the 16th, odd parity, is computed.
export const ROPE_WORDS = [
  [1, 0o2625, 0o34755, 'NOVAC2', 'CAF ZERO'],
  [1, 0o2626, 0o54064, '', 'TS LOCCTR'],
  [1, 0o2627, 0o32634, '', 'CAF NO.CORES'],
  [1, 0o2630, 0o54062, 'NOVAC3', 'TS EXECTEM2'],
  [1, 0o2631, 0o50064, '', 'INDEX LOCCTR'],
  [1, 0o2632, 0o10167, '', 'CCS PRIORITY'],
  [1, 0o2633, 0o12674, '', 'TCF NEXTCORE'],
  [1, 0o2634, 0o00007, 'NO.CORES', 'DEC 7'],
  [1, 0o2635, 0o12674, '', 'TCF NEXTCORE'],
  [1, 0o2636, 0o30063, 'CORFOUND', 'CA NEWPRIO'],
  [1, 0o2637, 0o50064, '', 'INDEX LOCCTR'],
  [1, 0o2640, 0o54167, '', 'TS PRIORITY'],
  [1, 0o2641, 0o75004, '', 'MASK LOW9'],
  [1, 0o2642, 0o50064, '', 'INDEX LOCCTR'],
  [1, 0o2643, 0o54166, '', 'TS PUSHLOC'],
  [1, 0o2674, 0o33033, 'NEXTCORE', 'CAF COREINC'],
  [1, 0o2675, 0o26064, '', 'ADS LOCCTR'],
  [1, 0o2676, 0o10062, '', 'CCS EXECTEM2'],
  [1, 0o2677, 0o12630, '', 'TCF NOVAC3'],
  [1, 0o2700, 0o22061, '', 'LXCH EXECTEM1'],
  [1, 0o2701, 0o30002, '', 'CA Q'],
  [1, 0o2702, 0o05716, '', 'TC BAILOUT1'],
  [1, 0o2703, 0o01202, '', 'OCT 1202'],
  [2, 0o5716, 0o00004, 'BAILOUT1', 'INHINT'],
  [2, 0o5717, 0o53364, '', 'DXCH ALMCADR'],
  [2, 0o5720, 0o35742, '', 'CAF ADR40400'],
  [2, 0o5721, 0o54061, 'BOTHABRT', 'TS ITEMP1'],
  [2, 0o5722, 0o50002, '', 'INDEX Q'],
  [2, 0o5723, 0o30000, '', 'CAF 0'],
].map(([bank, addr, word, label, op]) => ({bank, addr, word, label, op, parity: parityBit(word), bits: bits16(word)}));
// the rest of bank 01 around NOVAC2, for the cores either side of the ones above [L]
export const ROPE_NEIGHBOURS = {0o2616: 0o05716, 0o2617: 0o01201, 0o2620: 0o64752, 0o2621: 0o22007, 0o2622: 0o50000, 0o2623: 0o21777, 0o2624: 0o26063};

/** odd parity: the 16th bit makes the count of ones odd */
export function parityBit(w) {
  let n = 0;
  for (let b = 0; b < 15; b++) n += (w >> b) & 1;
  return n % 2 === 0 ? 1 : 0;
}
/** the 16 bits as stored, most significant data bit first, parity last */
export function bits16(w) {
  const out = [];
  for (let b = 14; b >= 0; b--) out.push((w >> b) & 1);
  out.push(parityBit(w));
  return out;
}
export const octal = (w, n = 5) => w.toString(8).padStart(n, '0');
/** a fixed address to its place in the ropes: absolute word, module B1-B6, core and strand (the strand mapping is
 * this model's: word w of a module sits on core w mod 512, strand ⌊w / 512⌋) [S] [E] */
export function ropePlace(bank, addr) {
  const off = bank >= 2 && addr >= 0o4000 ? addr - (addr >= 0o6000 ? 0o6000 : 0o4000) : addr - 0o2000;
  const abs = bank * AGC.bankWords + off;
  const module = Math.floor(abs / WORDS_PER_MODULE);
  const w = abs % WORDS_PER_MODULE;
  return {abs, module, core: w % AGC.coresPerModule, strand: Math.floor(w / AGC.coresPerModule)};
}
/** the word stored at a bank-01 address of the excerpt, or a neighbour's */
export function wordAt(bank, addr) {
  const r = ROPE_WORDS.find((x) => x.bank === bank && x.addr === addr);
  if (r) return r.word;
  return ROPE_NEIGHBOURS[addr] ?? null;
}

// instruction times in MCT [H]
const TIME = {CAF: 2, CA: 2, CS: 2, TS: 2, INDEX: 2, CCS: 2, TCF: 1, TC: 1, ADS: 2, LXCH: 2, DXCH: 3, MASK: 2, INHINT: 1, DEC: 1, OCT: 1};
/**
 * The instructions NOVAC2 runs to find a core set, given how many are busy (the search starts at core set 0 and
 * walks up): [{w (index in ROPE_WORDS), mct (its first MCT, from the call), n (its MCTs), erasable?}]. With all 8
 * busy it falls through to BAILOUT1, whose INDEX Q / CAF 0 fetches the word after TC BAILOUT1: 01202, from the rope.
 */
export function novacTrace(busy) {
  const idx = (addr, bank = 1) => ROPE_WORDS.findIndex((x) => x.bank === bank && x.addr === addr);
  const out = [];
  let t = 0;
  const run = (addr, bank = 1, extra = {}) => {
    const w = idx(addr, bank);
    const op = ROPE_WORDS[w].op.split(' ')[0];
    out.push({w, mct: t, n: TIME[op], ...extra});
    t += TIME[op];
  };
  run(0o2625);
  run(0o2626);
  run(0o2627);
  for (let k = 0; k < EXEC.coreSets; k++) {
    run(0o2630);
    run(0o2631);
    run(0o2632, 1, {erasable: {set: k}});
    if (k >= busy) {
      // -0 in PRIORITY: the core set is free, CCS skips three to CORFOUND
      for (const a of [0o2636, 0o2637, 0o2640, 0o2641, 0o2642, 0o2643]) run(a);
      return {trace: out, found: k, mct: t};
    }
    run(0o2633);
    run(0o2674);
    run(0o2675);
    run(0o2676);
    if (k < EXEC.coreSets - 1) run(0o2677);
  }
  for (const a of [0o2700, 0o2701, 0o2702]) run(a);
  for (const a of [0o5716, 0o5717, 0o5720, 0o5721, 0o5722]) run(a, 2);
  run(0o5723, 2, {fetch: idx(0o2703)});
  return {trace: out, found: -1, mct: t};
}

// ------------------------------------------------------------ the sound [Q]
/** Quindar tones: the ground's transmitter keyed with 2,525 Hz, released with 2,475 Hz, 250 ms each */
export const QUINDAR = {intro: 2525, outro: 2475, ms: 250};

// ------------------------------------------------------------ the DSKY [D] [P]
export const DSKY_KEYS = ['VERB', 'NOUN', '+', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', 'PRO', 'KEY REL', 'ENTR', 'RSET'];
// LM DSKY lamps, left and right columns [D]
export const LAMPS = [
  ['UPLINK ACTY', 'TEMP'],
  ['NO ATT', 'GIMBAL LOCK'],
  ['STBY', 'PROG'],
  ['KEY REL', 'RESTART'],
  ['OPR ERR', 'TRACKER'],
  ['', 'ALT'],
  ['', 'VEL'],
];
// the crew's keystrokes, s after PDI [J] [E]: Aldrin calls up the Delta-H monitor, reads the alarm code, resets,
// calls the monitor again before the second alarm, then leaves it to Houston
export const CREW_KEYS = [
  [302.6, 'VERB'], [303.0, '1'], [303.4, '6'], [303.9, 'NOUN'], [304.3, '6'], [304.7, '8'], [305.3, 'ENTR'],
  [319.6, 'VERB'], [320.0, '0'], [320.4, '5'], [320.9, 'NOUN'], [321.3, '0'], [321.7, '9'], [322.3, 'ENTR'],
  [323.6, 'RSET'],
  [347.6, 'VERB'], [348.0, '1'], [348.4, '6'], [348.9, 'NOUN'], [349.3, '6'], [349.7, '8'], [350.3, 'ENTR'],
  [362.0, 'RSET'],
  [581.0, 'RSET'], [590.5, 'RSET'], [601.0, 'RSET'],
];
