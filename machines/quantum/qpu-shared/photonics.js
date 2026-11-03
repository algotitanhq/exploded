// The physics of the photonic QPU, in real units, with no three.js. Everything on screen (photon positions, the mesh
// glow, the clicks, the histogram, the losses, the HOM dip) reads from here.
//
// Sources (cited where each number is used):
//  [A]  Maring et al., "A versatile single-photon-based quantum computing platform", Nature Photonics 2024,
//       arXiv:2306.00874 (Ascella, MosaiQ-6). Public numbers for the whole chain.
//  [C]  Quandela product catalogue / MosaiQ page: MosaiQ-12 = Belenos, 24-mode chip, 12 photonic qubits,
//       closed-cycle cryostat ~3 K, 80 MHz clock, source + detectors in two cryostat chambers.
//  [L]  CEA / Quandela press release, Oct. 2025: Lucy, 12 qubits, attocube cryogenics, TGCC.
//  [E]  Estimation: not public. Plausible value, flagged as such on screen.

// ------------------------------------------------------------ the machine's numbers
export const P = {
  name: 'Belenos / Lucy',
  qubits: 12, // [C][L]
  modes: 24, // [C] MosaiQ-12, 24-mode chip
  demuxOut: 12, // [C] 12 photons for 12 dual-rail qubits; Ascella had 6 [A]
  rep: 80e6, // Hz, laser and source clock [A][C]
  T: 12.5, // ns between pulses (1 / 80 MHz)
  lambda: 928, // nm, emission wavelength [A]
  tauRad: 0.092, // ns, QD radiative lifetime 92 ps [A]
  g2: 0.0073, // g2(0) = 7.32e-3 [A]
  M: 0.944, // two-photon indistinguishability, corrected [A]
  tSource: 5, // K, source temperature [A] (~3 K cryostat base, [C])
  tSnspd: 2.5, // K, detector stage [E]
  // transmission chain, source to click [A]: first lens 55 %, demux 70 %, chip 45 %, SNSPD 92 %, total 8.4 %.
  // The fibre coupling + spectral filtering factor is not given separately: it is what makes the product 8.4 % [E].
  eta: [
    {key: 'source', name: 'Source (1st lens)', v: 0.55, src: 'A'},
    {key: 'fibre', name: 'Fibre + filter', v: 0.084 / (0.55 * 0.7 * 0.45 * 0.92), src: 'E'},
    {key: 'demux', name: 'Demultiplexer', v: 0.7, src: 'A'},
    {key: 'chip', name: 'Photonic chip', v: 0.45, src: 'A'},
    {key: 'det', name: 'SNSPD detectors', v: 0.92, src: 'A'},
  ],
  dark: 20, // Hz, SNSPD dark counts, upper bound [A]
  window: 1, // ns, coincidence window [A]
  fibreNs: 1.468 / 0.299792458, // ns per metre of fibre (group index 1.468) = 4.90 ns/m
  // lengths [E]: the fibre runs inside the racks
  L0: 3.0, // m, source to demux
  Ldmx: 0.5, // m, inside the demux
  Lbase: 1.0, // m, shortest delay line
  Lchip: 0.6, // m, delay lines to the chip's fibre array
  Lout: 2.0, // m, chip to detector cryostat
  coaxNs: 5.0, // ns, detector pulse to the time tagger (1 m coax at 0.66 c) [E]
  chipLen: 0.024, // m, mesh length [E]
  chipNg: 1.9, // group index in Si3N4 waveguides [E]
};
export const ETA = P.eta.reduce((a, s) => a * s.v, 1); // 0.084
export const sliceM = (P.T / P.fibreNs); // 2.553 m of fibre per 12.5 ns slot
export const delayLen = (j) => P.Lbase + (P.demuxOut - 1 - j) * sliceM; // fibre length behind demux output j
export const chipNs = (P.chipLen * P.chipNg) / 0.299792458; // 0.152 ns through the mesh
export const PACKET = 3 * P.tauRad; // ns, the wavepacket's visible tail (3 lifetimes)
// n-photon coincidence rate: the demux cuts the 80 MHz stream into groups of n, each photon survives with ETA.
// Check against [A]: n = 6 gives 80e6/6 * 0.084^6 = 4.7 Hz; Ascella measured ~4 Hz.
export const rateN = (n) => (P.rep / n) * Math.pow(ETA, n);

// ------------------------------------------------------------ one shot, in physical nanoseconds
// photon k (0..n-1) is emitted on pulse k, takes demux output j = 12 - n + k, whose delay line makes every photon reach
// the chip together; chip input mode 2k (dual-rail qubit k, logical |0>).
export function shotTimes(n) {
  const tDmx = (P.L0 + P.Ldmx) * P.fibreNs; // emission to demux port
  const tArr = (n - 1) * P.T + tDmx + (delayLen(P.demuxOut - 1) + P.Lchip) * P.fibreNs; // all photons at the chip
  const tOut = tArr + chipNs;
  const tClick = tOut + P.Lout * P.fibreNs;
  const tTag = tClick + P.coaxNs;
  return {tDmx, tArr, tOut, tClick, tTag, SHOT: Math.ceil(tTag + 8)};
}
export const outPort = (n, k) => P.demuxOut - n + k;
export const inMode = (k) => 2 * k;

// ------------------------------------------------------------ complex helpers
const cmul = (ar, ai, br, bi) => [ar * br - ai * bi, ar * bi + ai * br];

// ------------------------------------------------------------ the mesh: a Clements rectangle of MZIs
// column c holds MZIs on (i, i+1) with i = c%2, c%2+2, ... ; 24 columns, 276 MZIs. MZI(θ, φ) on its two modes:
// [[e^{iφ} cos θ, -sin θ], [e^{iφ} sin θ, cos θ]], two thermo-optic heaters (θ inside, φ outside).
export function meshLayout(N = P.modes) {
  const mzi = [];
  for (let c = 0; c < N; c++) for (let i = c % 2; i + 1 < N; i += 2) mzi.push({c, i});
  return mzi;
}
export const MZI = meshLayout();

export function randomPhases(rand) {
  // θ with the density that makes the mesh Haar-like on average (sin 2θ weighting), φ uniform
  return MZI.map(() => ({th: Math.acos(Math.sqrt(1 - rand())) , ph: rand() * 2 * Math.PI}));
}
export function homPhases() {
  // the HOM demo: the first MZI (modes 0, 1) set to 50:50, every other MZI in the bar state (identity)
  return MZI.map((m) => ({th: m.c === 0 && m.i === 0 ? Math.PI / 4 : 0, ph: 0}));
}

function applyMzi(re, im, i, th, ph) {
  const c = Math.cos(th);
  const s = Math.sin(th);
  const [ar, ai] = cmul(re[i], im[i], Math.cos(ph), Math.sin(ph));
  const br = re[i + 1];
  const bi = im[i + 1];
  re[i] = c * ar - s * br;
  im[i] = c * ai - s * bi;
  re[i + 1] = s * ar + c * br;
  im[i + 1] = s * ai + c * bi;
}

/** U (N x N, re/im Float64Array row-major, U[out][in]) and the field: mean photon number per mode after each column. */
export function program(phases, inputs, N = P.modes) {
  const Ur = new Float64Array(N * N);
  const Ui = new Float64Array(N * N);
  const field = Array.from({length: N + 1}, () => new Float32Array(N));
  for (let col = 0; col < N; col++) {
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    re[col] = 1;
    const track = inputs.includes(col);
    if (track) for (let m = 0; m < N; m++) field[0][m] += re[m] * re[m];
    let k = 0;
    for (let c = 0; c < N; c++) {
      for (; k < MZI.length && MZI[k].c === c; k++) applyMzi(re, im, MZI[k].i, phases[k].th, phases[k].ph);
      if (track) for (let m = 0; m < N; m++) field[c + 1][m] += re[m] * re[m] + im[m] * im[m];
    }
    for (let m = 0; m < N; m++) {
      Ur[m * N + col] = re[m];
      Ui[m * N + col] = im[m];
    }
  }
  return {Ur, Ui, field, N};
}

// ------------------------------------------------------------ permanents (Ryser, Gray code)
function permanent(mr, mi, n) {
  if (n === 1) return [mr[0], mi[0]];
  let sr = 0;
  let si = 0;
  const rr = new Float64Array(n);
  const ri = new Float64Array(n);
  let gray = 0;
  for (let k = 1; k < 1 << n; k++) {
    const g = k ^ (k >> 1);
    const bit = Math.log2(g ^ gray) | 0;
    const add = g & (1 << bit) ? 1 : -1;
    gray = g;
    for (let i = 0; i < n; i++) {
      rr[i] += add * mr[i * n + bit];
      ri[i] += add * mi[i * n + bit];
    }
    let pr = 1;
    let pi = 0;
    for (let i = 0; i < n; i++) [pr, pi] = cmul(pr, pi, rr[i], ri[i]);
    let bits = 0;
    for (let x = g; x; x &= x - 1) bits++;
    const sg = (n - bits) % 2 ? -1 : 1;
    sr += sg * pr;
    si += sg * pi;
  }
  return [sr, si];
}

const FACT = [1, 1, 2, 6, 24, 120, 720];

/**
 * Boson sampling distribution: every output pattern (multiset of n modes) and its probability
 * P(S) = |Perm(U[S, inputs])|^2 / prod(s_i!). The input modes are distinct.
 */
export function distribution(prog, inputs) {
  const {Ur, Ui, N} = prog;
  const n = inputs.length;
  const pats = [];
  const probs = [];
  const mr = new Float64Array(n * n);
  const mi = new Float64Array(n * n);
  const out = new Array(n).fill(0);
  const rec = (pos, from) => {
    if (pos === n) {
      let mult = 1;
      let run = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && out[i] === out[i - 1]) run++;
        else {
          mult *= FACT[run];
          run = 1;
        }
      }
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          mr[r * n + c] = Ur[out[r] * N + inputs[c]];
          mi[r * n + c] = Ui[out[r] * N + inputs[c]];
        }
      const [pr, pi] = permanent(mr, mi, n);
      pats.push(out.slice());
      probs.push((pr * pr + pi * pi) / mult);
      return;
    }
    for (let m = from; m < N; m++) {
      out[pos] = m;
      rec(pos + 1, m);
    }
  };
  rec(0, 0);
  const total = probs.reduce((a, b) => a + b, 0); // 1 up to rounding: a check on U's unitarity
  return {pats, probs: Float64Array.from(probs, (p) => p / total), total};
}

/**
 * A seeded stream of S detected patterns (indices into dist.pats), the top-K patterns by probability, their sample
 * positions (for counts at any N), and the total variation distance to theory at checkpoints.
 */
export function sampler(dist, rand, S = 60000, K = 12) {
  const cdf = new Float64Array(dist.probs.length);
  let acc = 0;
  for (let i = 0; i < cdf.length; i++) cdf[i] = acc += dist.probs[i];
  const stream = new Int32Array(S);
  for (let s = 0; s < S; s++) {
    const u = rand() * acc;
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    stream[s] = lo;
  }
  const order = Array.from(dist.probs.keys()).sort((a, b) => dist.probs[b] - dist.probs[a]);
  const top = order.slice(0, K);
  const where = top.map(() => []);
  const slot = new Map(top.map((p, i) => [p, i]));
  for (let s = 0; s < S; s++) {
    const k = slot.get(stream[s]);
    if (k !== undefined) where[k].push(s);
  }
  // TVD checkpoints on a geometric grid
  const cps = [];
  for (let x = 20; x < S; x = Math.ceil(x * 1.12)) cps.push(x);
  cps.push(S);
  const counts = new Float64Array(dist.probs.length);
  const tvd = [];
  let s = 0;
  for (const c of cps) {
    for (; s < c; s++) counts[stream[s]]++;
    let d = 0;
    for (let i = 0; i < counts.length; i++) d += Math.abs(counts[i] / c - dist.probs[i]);
    tvd.push(d / 2);
  }
  const upper = (arr, n) => {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] < n) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return {
    S,
    stream,
    top,
    countTop: (n) => where.map((w) => upper(w, Math.min(n, S))),
    tvdAt: (n) => {
      if (n < cps[0]) return 1;
      let i = 0;
      while (i < cps.length - 1 && cps[i + 1] <= n) i++;
      return tvd[i];
    },
  };
}

// ------------------------------------------------------------ Hong-Ou-Mandel
// two photons on a 50:50 coupler, relative delay δ (ns): coincidence probability ½(1 − M e^{−|δ|/τ}) for
// exponentially decaying wavepackets of lifetime τ [A: M, τ].
export const homPc = (d) => 0.5 * (1 - P.M * Math.exp(-Math.abs(d) / P.tauRad));

// ------------------------------------------------------------ a full program for n photons
export function buildProgram(n, phases, rand) {
  const inputs = Array.from({length: n}, (_, k) => inMode(k));
  const prog = program(phases, inputs);
  const dist = distribution(prog, inputs);
  const samp = sampler(dist, rand);
  return {n, inputs, phases, prog, dist, samp, times: shotTimes(n), rate: rateN(n)};
}
export function buildHom(phases = homPhases()) {
  const inputs = [0, 1];
  const prog = program(phases, inputs);
  return {n: 2, inputs, phases, prog, times: shotTimes(2), rate: rateN(2), hom: true};
}

/** The detected output modes of shot s. HOM: bunched or split from homPc(δ) with a hash of s. */
export function shotPattern(pr, s, delta = 0) {
  if (pr.hom) {
    const u = hashU(s * 7.13 + 1.7);
    if (u < homPc(delta)) return [0, 1];
    return hashU(s * 3.71 + 9.2) < 0.5 ? [0, 0] : [1, 1];
  }
  return pr.dist.pats[pr.samp.stream[((s % pr.samp.S) + pr.samp.S) % pr.samp.S]];
}
export const hashU = (x) => {
  const v = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
export const patLabel = (p) => {
  const occ = new Map();
  for (const m of p) occ.set(m, (occ.get(m) || 0) + 1);
  return [...occ].map(([m, c]) => `${m}${['', '', '²', '³', '⁴', '⁵'][c]}`).join('·');
};
