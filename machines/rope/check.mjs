// Recomputes, from the same functions the page draws with, every figure Rope shows, and fails if one leaves the range
// its source gives. node machines/rope/check.mjs (CI runs it on every push).
import * as M from './agc-shared/machine.js';
import {simulate} from './agc-shared/executive.js';

let bad = 0;
const near = (name, v, lo, hi, unit = '') => {
  const ok = v >= lo && v <= hi;
  if (!ok) bad++;
  const f = (x) => (unit === 'octal' ? `0${x.toString(8)}` : Number(Number(x).toPrecision(7)));
  console.log(`${ok ? 'ok ' : 'BAD'}  ${name.padEnd(50)} ${f(v)} ${unit === 'octal' ? '' : unit}  [${f(lo)} … ${f(hi)}]`);
};

// the clock [W] [H]: 2.048 MHz halved, 12 timing pulses per memory cycle
near('memory cycle (MCT)', M.MCT * 1e6, 11.71, 11.72, 'µs');
near('MCT per second', M.MCT_PER_S, 85333, 85334);
near('addition, 2 MCT', M.ADD_US, 23.43, 23.44, 'µs');
near('additions per second', M.ADDS_PER_S, 42666, 42667);
// the word [W]: 15 data bits + odd parity
near('word', M.AGC.dataBits + 1, 16, 16, 'bits');
// the memories [W] [S]: 6 ropes x 512 cores x 12 words = 36,864 words; 2,048 erasable words
near('rope words per module (512 cores x 12)', M.WORDS_PER_MODULE, 6144, 6144);
near('fixed words (6 modules)', M.AGC.ropeModules * M.WORDS_PER_MODULE, 36864, 36864);
near('fixed words = 36 banks of 1,024', 36 * M.AGC.bankWords, 36864, 36864);
near('fixed memory in bits', M.FIXED_BITS, 589824, 589824);
near('sense lines per core (12 strands of 16)', M.AGC.wordsPerCore * 16, M.AGC.senseLinesPerCore, M.AGC.senseLinesPerCore);
near('erasable memory in bits', M.ERASABLE_BITS, 32768, 32768);
// one kind of gate: ~2,800 dual 3-input NOR flat-packs [W]
near('NOR gates', M.AGC.ics * M.AGC.gatesPerIc, 5600, 5600);
// the box [W]: 24 x 12.5 x 6.5 in = 61 x 32 x 17 cm
M.AGC.sizeIn.forEach((x, i) => near(`  box dimension ${i + 1}`, x * 0.0254, M.AGC.sizeM[i] - 0.005, M.AGC.sizeM[i] + 0.005, 'm'));
// odd parity on every word of the excerpt [L]: the count of ones, parity included, is odd
let parityBad = 0;
for (const w of M.ROPE_WORDS) if (w.bits.reduce((a, b) => a + b, 0) % 2 !== 1) parityBad++;
near('words with even parity in the excerpt', parityBad, 0, 0);
// the word the film reads, CAF NO.CORES at 01,2627 = 32634 octal [L]
const caf = M.ROPE_WORDS.find((w) => w.op === 'CAF NO.CORES');
near('CAF NO.CORES at 01,2627', caf.word, 0o32634, 0o32634, 'octal');
near('its place: module B1', M.ropePlace(caf.bank, caf.addr).module + 1, 1, 1);
// NOVAC2 with all 8 core sets busy falls through to BAILOUT1 and fetches 01202 from the rope
const full = M.novacTrace(8);
near('NOVAC with 8 busy: found', full.found, -1, -1);
near('  the word it fetches from the rope: OCT 1202', M.ROPE_WORDS[full.trace[full.trace.length - 1].fetch].word, 0o1202, 0o1202, 'octal');
near('  MCTs from NOVAC to the alarm code', full.mct, 60, 140);
// the radar [E1]: 2 angles x 6,400 pulses/s, one MCT each
near('radar steal, theoretical maximum', M.TLOSS_THEORY * 100, 14.9, 15.1, '%');
near('radar steal used by the model', M.EXEC.tloss * 100, 13, M.EXEC.tlossMax * 100, '%');
// the duty at the first alarm [E1]: braking 85 % + radar data + V16 N68 3 % + 13 % stolen > 100 %
const duty = M.EXEC.braking + M.EXEC.lrConvert + M.EXEC.n68 + M.EXEC.tloss;
near('duty asked at the 1202', duty * 100, 100.01, 104, '%');
near('duty without the radar', (duty - M.EXEC.tloss) * 100, 85, 91, '%');
// the log as flown, against Apollo 11's alarms [R]
const L = simulate();
const a = L.alarms;
near('first alarm is a 1202', a[0].code, 1202, 1202);
near('  at, s after PDI (flown 317, 102:38:22)', a[0].s, 314, 320, 's');
near('  core sets busy at it', a[0].busy, 8, 8);
near('second alarm is a 1202', a[1].code, 1202, 1202);
near('  at (flown 357, 102:39:02)', a[1].s, 352, 362, 's');
const p64 = a.filter((x) => x.s > M.EVENTS.p64 && x.s < M.EVENTS.p66);
near('alarms in P64 (flown 3)', p64.length, 2, 4);
near('alarms in P66 and after (flown 0)', a.filter((x) => x.s >= M.EVENTS.p66).length, 0, 0);
near('alarms between the 2nd and P64 (flown 0)', a.filter((x) => x.s > a[1].s + 1 && x.s < M.EVENTS.p64).length, 0, 0);
for (const r of L.restarts) {
  if (r.kept.length !== 1 || r.kept[0].kind !== 'servicer') {
    bad++;
    console.log(`BAD  restart at ${r.s.toFixed(2)} kept ${JSON.stringify(r.kept)}`);
  }
}
near('restarts that keep exactly the newest SERVICER', L.restarts.filter((r) => r.kept.length === 1 && r.kept[0].kind === 'servicer').length, L.restarts.length, L.restarts.length);
// the radar off: no alarm at all
near('alarms with the radar steals off', simulate({radar: false}).alarms.length, 0, 0);
// the descent [J] [E1]: the published points
near('altitude at the first alarm (~33,500 ft)', M.descent(a[0].s).h, 32500, 34500, 'ft');
near('altitude at high gate (7,400 ft)', M.descent(M.EVENTS.p64).h, 7300, 7500, 'ft');
near('slant range at high gate (~7.8 km [G])', M.descent(M.EVENTS.p64).slantNm * 1852, 7000, 8600, 'm');
near('altitude at contact', M.descent(M.EVENTS.contact).h, 0, 8, 'ft');
// Quindar tones [Q]
// the Quindar tones the score plays [Q]: 2,525 Hz to key the ground transmitter, 2,475 Hz to release it, 250 ms
near('Quindar intro tone', M.QUINDAR.intro, 2525, 2525, 'Hz');
near('Quindar release tone', M.QUINDAR.outro, 2475, 2475, 'Hz');
near('Quindar tone length', M.QUINDAR.ms, 250, 250, 'ms');

if (bad) {
  console.error(`\n${bad} figure(s) out of range`);
  process.exit(1);
}
console.log('\nevery figure in range');
