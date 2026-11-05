// Rope's overlay, drawn as a sheet of the MIT Instrumentation Lab's documentation and a DSKY: the mission clock top
// left in seven-segment figures, the DSKY's face below it (the same drawing as the 3D panel), the Executive (duty,
// core sets, VAC areas, one millisecond of memory cycles, the alarm) on the right, the working subsystem's detail
// bottom left, the operator's buttons bottom centre, the title block (cartouche) bottom right, a one-line caption and
// callouts with thin leaders into the machine. Fixed 1600 x 900 CSS layout; update(s) redraws every live part.
import {ACCENT, ACCENT_INK, AMBER, drawEL, drawLampPanel} from './agc.js';
import {AGC, EXEC, MCT, MCT_PER_S, ADDS_PER_S, ROPE_WORDS, octal} from './machine.js';
import {svgDigits, digitsWidth} from './seg7.js';
import {FAMILY} from './fonts.js';
import {nf, T as tr} from './i18n.js';

export const C = {paper: '#efe8d8', panel: 'rgba(241,235,221,.9)', ink: '#2b2925', mute: '#7a7062', faint: 'rgba(70,58,40,.32)', line: 'rgba(70,58,40,.55)', acc: ACCENT_INK, accEl: ACCENT, amber: AMBER, amberInk: '#a86a06', steal: '#9c4a2e'};
export const SUBS = ['rope', 'eras', 'nor', 'clock', 'exec', 'dsky', 'iface'];
export const CUTS = ['case', 'tray', 'module'];
export const VIEWS = ['axo', 'dskyFace', 'ropeIn', 'graze'];
const CSS = `
#app{font-family:${FAMILY};color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.pn{position:absolute;background:${C.panel};border:1px solid ${C.line}}
.pn:before{content:'';position:absolute;inset:3px;border:.6px solid ${C.faint};pointer-events:none}
.hd{position:absolute;font-weight:700;font-size:15px;letter-spacing:2.2px;text-transform:uppercase;white-space:nowrap}
.sm{position:absolute;font-weight:500;font-size:12.5px;letter-spacing:1.3px;text-transform:uppercase;color:${C.mute};white-space:nowrap}
.tx{position:absolute;font-weight:500;font-size:14px;line-height:18px;letter-spacing:.3px}
.tb{position:absolute;height:28px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;letter-spacing:1.6px;text-transform:uppercase;border:1px solid ${C.line};background:${C.panel};color:${C.ink};white-space:nowrap;box-sizing:border-box}
.tb.on{background:${C.ink};color:${C.paper}}
.tb.on:after{content:'';position:absolute;left:6px;right:6px;bottom:3px;height:2px;background:${C.accEl}}
.gl{position:absolute;font-weight:600;font-size:12px;letter-spacing:2px;color:${C.mute};text-transform:uppercase}
.call{position:absolute;white-space:nowrap;background:rgba(241,235,221,.88);padding:2px 8px 4px;margin:-2px -8px 0}
.call b{display:block;font-weight:700;font-size:28px;line-height:30px;letter-spacing:.6px;text-transform:uppercase}
.call span{display:block;font-weight:500;font-size:15px;letter-spacing:1.8px;color:${C.mute};text-transform:uppercase;margin-top:1px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(40,30,10,.35))}
.ring{position:absolute;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;border:2px solid ${C.acc};opacity:0;z-index:49}
.cap{position:absolute;left:380px;width:840px;top:756px;text-align:center;font-weight:600;font-size:21px;line-height:27px;letter-spacing:.5px}
.cap span{background:rgba(241,235,221,.9);padding:1px 8px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.alarm{position:absolute;background:${C.amber};color:#2a1d05;border:1px solid #6b4a0c}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const KIND_LABEL = () => ({servicer: tr('job:servicer'), monitor: tr('job:monitor'), lpd: tr('job:lpd'), charin: tr('job:charin')});
export const pad = (n, w) => String(n).padStart(w, '0');
/** GET as hh:mm:ss.cc */
export function getText(s) {
  const t = Math.max(0, s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return `${pad(h, 3)}:${pad(m, 2)}:${pad(Math.floor(sec), 2)}.${pad(Math.floor((sec % 1) * 100), 2)}`;
}

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };

  // ------------------------------------------------------------ the mission clock
  add(`<div class="pn" style="left:34px;top:32px;width:304px;height:150px"></div>`);
  add(`<div class="hd" style="left:48px;top:42px">${tr('clockTitle')}</div>`);
  const getSvg = add(`<svg style="position:absolute;left:46px;top:66px" width="282" height="40"></svg>`);
  add(`<div class="sm" style="left:48px;top:112px">${tr('mctSince')}</div>`);
  const mctSvg = add(`<svg style="position:absolute;left:46px;top:130px" width="200" height="26"></svg>`);
  const rateTx = add(`<div class="sm" style="left:48px;top:160px;color:${C.ink}"></div>`);
  const phaseTx = add(`<div class="hd" style="right:${1600 - 326}px;top:132px;font-size:22px;letter-spacing:1px"></div>`);

  // ------------------------------------------------------------ the DSKY, as on its face
  add(`<div class="pn" style="left:34px;top:192px;width:304px;height:250px;background:#8f9194;border-color:#4b4d50"></div>`);
  const lampCv = add(`<canvas width="420" height="470" style="position:absolute;left:46px;top:202px;width:136px;height:152px"></canvas>`);
  const elCv = add(`<canvas width="400" height="470" style="position:absolute;left:192px;top:202px;width:130px;height:152px"></canvas>`);
  add(`<div class="hd" style="left:48px;top:362px;color:#1e1f20;font-size:13px">${tr('dskyTitle')}</div>`);
  const dskyTx = add(`<div class="tx" style="left:48px;top:382px;width:278px;color:#1e1f20;font-size:13.5px;line-height:17px"></div>`);

  // ------------------------------------------------------------ the Executive
  const EX = {x: 1262, y: 32, w: 304};
  add(`<div class="pn" style="left:${EX.x}px;top:${EX.y}px;width:${EX.w}px;height:${646}px"></div>`);
  add(`<div class="hd" style="left:${EX.x + 14}px;top:${EX.y + 10}px">${tr('execTitle')}</div>`);
  add(`<div class="sm" style="left:${EX.x + 14}px;top:${EX.y + 34}px">${tr('dutyTitle')}</div>`);
  const dutySvg = add(`<svg style="position:absolute;left:${EX.x + 14}px;top:${EX.y + 52}px" width="${EX.w - 28}" height="88"></svg>`);
  const dutyTot = add(`<svg style="position:absolute;left:${EX.x + EX.w - 84}px;top:${EX.y + 8}px" width="72" height="26"></svg>`);
  add(`<div class="sm" style="left:${EX.x + 14}px;top:${EX.y + 132}px">${tr('setsTitle')}</div>`);
  const busyTx = add(`<div class="hd" style="right:${1600 - EX.x - EX.w + 14}px;top:${EX.y + 130}px;font-size:14px;letter-spacing:1.4px"></div>`);
  const setsSvg = add(`<svg style="position:absolute;left:${EX.x + 14}px;top:${EX.y + 150}px" width="${EX.w - 28}" height="212"></svg>`);
  add(`<div class="sm" style="left:${EX.x + 14}px;top:${EX.y + 368}px">${tr('vacTitle')}</div>`);
  const vacSvg = add(`<svg style="position:absolute;left:${EX.x + 14}px;top:${EX.y + 386}px" width="${EX.w - 28}" height="26"></svg>`);
  add(`<div class="sm" style="left:${EX.x + 14}px;top:${EX.y + 420}px">${tr('stripTitle')}</div>`);
  const stripSvg = add(`<svg style="position:absolute;left:${EX.x + 14}px;top:${EX.y + 438}px" width="${EX.w - 28}" height="46"></svg>`);
  const alarmBox = add(`<div class="alarm" style="left:${EX.x + 10}px;top:${EX.y + 492}px;width:${EX.w - 20}px;height:148px;display:none"></div>`);
  const restartTx = add(`<div class="tx" style="left:${EX.x + 14}px;top:${EX.y + 496}px;width:${EX.w - 28}px;font-size:14px"></div>`);

  // ------------------------------------------------------------ the subsystem's detail
  const DT = {x: 34, y: 452, w: 304, h: 326};
  add(`<div class="pn" style="left:${DT.x}px;top:${DT.y}px;width:${DT.w}px;height:${DT.h}px"></div>`);
  const detHd = add(`<div class="hd" style="left:${DT.x + 14}px;top:${DT.y + 10}px"></div>`);
  const detSvg = add(`<svg style="position:absolute;left:${DT.x + 14}px;top:${DT.y + 36}px" width="${DT.w - 28}" height="${DT.h - 46}"></svg>`);

  // ------------------------------------------------------------ buttons
  const btn = {};
  const BX = 372;
  add(`<div class="gl" style="left:${BX}px;top:818px">${tr('grpSubs')}</div>`);
  SUBS.forEach((k, i) => (btn[k] = add(`<div class="tb" style="left:${BX + i * 122}px;top:836px;width:116px">${tr('sub:' + k)}</div>`)));
  add(`<div class="gl" style="left:${BX}px;top:870px;display:none"></div>`);
  const BY = 32;
  const BXC = 372;
  add(`<div class="gl" style="left:${BXC}px;top:${BY}px">${tr('grpCuts')}</div>`);
  CUTS.forEach((k, i) => (btn[k] = add(`<div class="tb" style="left:${BXC + i * 104}px;top:${BY + 18}px;width:98px">${tr('cut:' + k)}</div>`)));
  const BXV = 712;
  add(`<div class="gl" style="left:${BXV}px;top:${BY}px">${tr('grpViews')}</div>`);
  VIEWS.forEach((k, i) => (btn[k] = add(`<div class="tb" style="left:${BXV + i * 128}px;top:${BY + 18}px;width:122px">${tr('view:' + k)}</div>`)));

  // ------------------------------------------------------------ the title block
  const CB = {x: 1262, y: 688, w: 304, h: 178};
  add(`<div style="position:absolute;left:${CB.x}px;top:${CB.y}px;width:${CB.w}px;height:${CB.h}px;border:1.4px solid ${C.ink};background:${C.panel}"></div>`);
  const hl = (y) => add(`<div style="position:absolute;left:${CB.x}px;top:${CB.y + y}px;width:${CB.w}px;height:0;border-top:.8px solid ${C.ink}"></div>`);
  const vl = (x, y0, y1) => add(`<div style="position:absolute;left:${CB.x + x}px;top:${CB.y + y0}px;width:0;height:${y1 - y0}px;border-left:.8px solid ${C.ink}"></div>`);
  hl(66);
  hl(92);
  hl(116);
  vl(178, 116, CB.h);
  add(`<div style="position:absolute;left:${CB.x + 14}px;top:${CB.y + 2}px;font-weight:700;font-size:56px;line-height:62px;letter-spacing:6px">${tr('title')}</div>`);
  add(`<div class="sm" style="left:${CB.x + 150}px;top:${CB.y + 14}px;color:${C.ink};font-size:13px;line-height:16px;white-space:normal;width:146px">${tr('titleSub')}</div>`);
  add(`<div class="sm" style="left:${CB.x + 12}px;top:${CB.y + 72}px;color:${C.ink};font-size:12.5px;letter-spacing:.9px">${tr('titleMission')}</div>`);
  add(`<div class="sm" style="left:${CB.x + 12}px;top:${CB.y + 97}px;font-size:12px;letter-spacing:.9px">${tr('titleSources')}</div>`);
  add(`<div class="sm" style="left:${CB.x + 12}px;top:${CB.y + 124}px;font-size:12px;line-height:15px;white-space:normal;width:160px;color:${C.ink}">${tr('titleNot')}</div>`);
  add(`<div class="sm" style="left:${CB.x + 188}px;top:${CB.y + 124}px;font-size:12px;letter-spacing:.9px">${tr('titleSheet')}</div>`);
  add(`<div class="sm" style="left:${CB.x + 188}px;top:${CB.y + 142}px;font-size:12px;line-height:15px;white-space:normal;width:110px;letter-spacing:.6px">${tr('titleFigs', nf(AGC.massKg), nf(AGC.powerW))}</div>`);

  // ------------------------------------------------------------ caption, callouts, the pointer
  const cap = add(`<div class="cap"></div>`);
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="24" height="24" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="${C.ink}" stroke="${C.paper}" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);

  const centre = (n) => {
    const l = parseFloat(n.style.left);
    const t = parseFloat(n.style.top);
    return [l + parseFloat(n.style.width) / 2, t + 14];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };

  // caches so the SVGs are rebuilt only when they change
  const last = {};
  const put = (key, node, html) => {
    if (last[key] === html) return;
    last[key] = html;
    node.innerHTML = html;
  };
  const txt = (x, y, s, o = {}) =>
    `<text x="${x}" y="${y}" font-family="${FAMILY}" font-size="${o.size ?? 13}" font-weight="${o.w ?? 600}" letter-spacing="${o.ls ?? 1.2}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? 'start'}">${s}</text>`;
  const hatch = `<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="${C.paper}"/><line x1="0" y1="0" x2="0" y2="4" stroke="${C.steal}" stroke-width="2"/></pattern></defs>`;

  // ------------------------------------------------------------ the detail panel, per subsystem
  const drawDetail = (d) => {
    const W = DT.w - 28;
    let h = hatch;
    if (d.kind === 'rope') {
      // the word: 16 cells, filled as the sense amplifiers see them
      const w = ROPE_WORDS[d.w];
      h += txt(0, 14, tr('ropeAddr', w.bank, octal(w.addr, 4), d.place.module + 1, d.place.core, d.place.strand), {size: 13.5, w: 600});
      h += txt(0, 36, w.op, {size: 26, w: 700, ls: 1.5});
      if (w.label) h += txt(W, 36, w.label, {size: 14, w: 600, anchor: 'end', fill: C.mute});
      const cw = W / 16;
      for (let b = 0; b < 16; b++) {
        const x = b * cw;
        const seen = b < d.fill;
        const v = w.bits[b];
        h += `<rect x="${x + 1}" y="50" width="${cw - 2}" height="34" fill="${seen ? (v ? C.acc : C.paper) : 'none'}" stroke="${C.line}" stroke-width=".8"/>`;
        if (seen) h += svgDigits(String(v), x + cw / 2 - 5, 56, 10, 22, 0, v ? C.paper : C.ink, null, 0.05);
        h += txt(x + cw / 2, 98, b === 15 ? 'P' : String(15 - b), {size: 10.5, w: 500, anchor: 'middle', fill: C.mute, ls: 0});
      }
      h += txt(0, 124, tr('ropeOctal'), {size: 12.5, w: 500, fill: C.mute});
      h += svgDigits(d.fill >= 16 ? octal(w.word) : '     ', 0, 132, 18, 32, 5, C.ink, 'rgba(70,58,40,.08)');
      h += txt(W, 150, tr('ropeParity', w.parity), {size: 13, w: 600, anchor: 'end'});
      h += txt(0, 196, tr('ropePhase'), {size: 12.5, w: 500, fill: C.mute});
      const phases = [tr('ph:inhibit'), tr('ph:set'), tr('ph:reset'), tr('ph:strobe')];
      phases.forEach((p, i) => {
        const on = d.stage === i;
        h += `<rect x="${(i * W) / 4 + 1}" y="204" width="${W / 4 - 2}" height="26" fill="${on ? C.ink : 'none'}" stroke="${C.line}" stroke-width=".8"/>`;
        h += txt((i * W) / 4 + W / 8, 222, p, {size: 13, w: 700, anchor: 'middle', fill: on ? C.paper : C.ink, ls: 1});
      });
      h += `<foreignObject x="0" y="236" width="${W}" height="44"><div xmlns="http://www.w3.org/1999/xhtml" style="font:500 13px/16px ${FAMILY};color:${C.ink};letter-spacing:.3px">${tr('ropeNote', nf(AGC.fixedWords), AGC.ropeModules, nf(AGC.coresPerModule), AGC.senseLinesPerCore)}</div></foreignObject>`;
    } else if (d.kind === 'eras') {
      h += txt(0, 14, tr('erasAddr', d.set), {size: 13.5, w: 600});
      h += txt(0, 36, d.job ? tr('erasJob', KIND_LABEL()[d.job]) : tr('erasFree'), {size: 22, w: 700, ls: 1});
      const cw = W / 16;
      for (let b = 0; b < 16; b++) {
        const x = b * cw;
        const v = d.bits[b];
        const isPlane = b === 1;
        const shown = d.state === 'read' ? b < d.fill : d.state === 'gone' ? false : true;
        h += `<rect x="${x + 1}" y="50" width="${cw - 2}" height="34" fill="${shown ? (v ? (isPlane ? C.acc : C.ink) : C.paper) : 'none'}" stroke="${isPlane ? C.acc : C.line}" stroke-width="${isPlane ? 1.6 : 0.8}"/>`;
        if (shown) h += svgDigits(String(v), x + cw / 2 - 5, 56, 10, 22, 0, v ? C.paper : C.ink, null, 0.05);
        h += txt(x + cw / 2, 98, b === 15 ? 'P' : String(15 - b), {size: 10.5, w: 500, anchor: 'middle', fill: isPlane ? C.acc : C.mute, ls: 0});
      }
      h += txt(0, 124, tr('erasPlane'), {size: 12.5, w: 600, fill: C.acc});
      const steps = [tr('es:read'), tr('es:sense'), tr('es:rewrite')];
      steps.forEach((p, i) => {
        const on = d.stage === i;
        h += `<rect x="${(i * W) / 3 + 1}" y="136" width="${W / 3 - 2}" height="26" fill="${on ? C.ink : 'none'}" stroke="${C.line}" stroke-width=".8"/>`;
        h += txt((i * W) / 3 + W / 6, 154, p, {size: 13, w: 700, anchor: 'middle', fill: on ? C.paper : C.ink, ls: 1});
      });
      h += `<foreignObject x="0" y="172" width="${W}" height="110"><div xmlns="http://www.w3.org/1999/xhtml" style="font:500 13.5px/17px ${FAMILY};color:${C.ink};letter-spacing:.3px">${tr('erasNote', nf(AGC.erasableWords), nf(AGC.erasableWords * AGC.wordBits))}</div></foreignObject>`;
    } else if (d.kind === 'nor') {
      // RTL NOR: three transistors, one collector resistor; inputs from three timing pulses
      const [a, b, c] = d.in;
      const out = a || b || c ? 0 : 1;
      const on = (v) => (v ? C.acc : C.ink);
      h += txt(0, 14, tr('norHead'), {size: 13.5, w: 600});
      const y0 = 40;
      h += `<line x1="40" y1="${y0}" x2="230" y2="${y0}" stroke="${C.ink}" stroke-width="1.2"/>` + txt(236, y0 + 4, 'V+', {size: 12, w: 600});
      h += `<rect x="128" y="${y0 + 8}" width="10" height="30" fill="none" stroke="${C.ink}" stroke-width="1.2"/><line x1="133" y1="${y0}" x2="133" y2="${y0 + 8}" stroke="${C.ink}" stroke-width="1.2"/>`;
      h += `<line x1="133" y1="${y0 + 38}" x2="133" y2="${y0 + 52}" stroke="${on(out)}" stroke-width="1.6"/><line x1="40" y1="${y0 + 52}" x2="236" y2="${y0 + 52}" stroke="${on(out)}" stroke-width="1.6"/>`;
      h += `<circle cx="236" cy="${y0 + 52}" r="3" fill="${on(out)}"/>` + txt(244, y0 + 57, `Q = ${out}`, {size: 16, w: 700, fill: on(out)});
      [a, b, c].forEach((v, i) => {
        const x = 60 + i * 60;
        const yb = y0 + 84;
        h += `<line x1="${x}" y1="${y0 + 52}" x2="${x}" y2="${yb - 12}" stroke="${C.ink}" stroke-width="1.2"/>`;
        h += `<line x1="${x - 8}" y1="${yb - 16}" x2="${x - 8}" y2="${yb + 16}" stroke="${C.ink}" stroke-width="2"/>`;
        h += `<line x1="${x - 8}" y1="${yb - 6}" x2="${x}" y2="${yb - 12}" stroke="${C.ink}" stroke-width="1.2"/><line x1="${x - 8}" y1="${yb + 6}" x2="${x}" y2="${yb + 12}" stroke="${C.ink}" stroke-width="1.2"/>`;
        h += `<line x1="${x}" y1="${yb + 12}" x2="${x}" y2="${yb + 30}" stroke="${C.ink}" stroke-width="1.2"/>`;
        h += `<line x1="${x - 8}" y1="${yb}" x2="${x - 30}" y2="${yb}" stroke="${on(v)}" stroke-width="1.6"/><rect x="${x - 26}" y="${yb - 4}" width="14" height="8" fill="${C.paper}" stroke="${on(v)}" stroke-width="1.2"/>`;
        h += txt(x - 34, yb + 4, 'ABC'[i], {size: 14, w: 700, anchor: 'end', fill: on(v)}) + txt(x - 19, yb + 24, String(v), {size: 13, w: 700, anchor: 'middle', fill: on(v)});
      });
      h += `<line x1="40" y1="${y0 + 114}" x2="200" y2="${y0 + 114}" stroke="${C.ink}" stroke-width="1.2"/>` + txt(206, y0 + 118, '0 V', {size: 12, w: 600});
      // truth table of NOR 3
      const ty = 176;
      h += txt(0, ty, 'A B C  →  Q', {size: 13, w: 700, ls: 2});
      for (let k = 0; k < 8; k++) {
        const ia = (k >> 2) & 1;
        const ib = (k >> 1) & 1;
        const ic = k & 1;
        const cur = ia === a && ib === b && ic === c;
        const x = (k % 4) * 69;
        const y = ty + 10 + Math.floor(k / 4) * 22;
        h += `<rect x="${x}" y="${y}" width="66" height="19" fill="${cur ? C.ink : 'none'}" stroke="${C.faint}" stroke-width=".8"/>`;
        h += txt(x + 33, y + 14, `${ia}${ib}${ic} → ${ia || ib || ic ? 0 : 1}`, {size: 13, w: 600, anchor: 'middle', fill: cur ? C.paper : C.ink, ls: 1});
      }
      h += `<foreignObject x="0" y="236" width="${W}" height="48"><div xmlns="http://www.w3.org/1999/xhtml" style="font:500 13.5px/17px ${FAMILY};color:${C.ink};letter-spacing:.3px">${tr('norNote', nf(AGC.ics), nf(AGC.ics * AGC.gatesPerIc))}</div></foreignObject>`;
    } else if (d.kind === 'clock') {
      h += txt(0, 14, tr('clockHead', nf(AGC.clockHz / 1e6, 3), nf(MCT * 1e6, 2)), {size: 13.5, w: 600});
      const lane = (W - 34) / 12;
      for (let p = 0; p < 12; p++) {
        const x = 34 + p * lane;
        const on = d.pulse === p;
        h += `<rect x="${x + 1}" y="28" width="${lane - 2}" height="22" fill="${on ? C.acc : 'none'}" stroke="${C.line}" stroke-width=".8"/>`;
        h += txt(x + lane / 2, 44, `T${p + 1}`, {size: 11.5, w: 700, anchor: 'middle', fill: on ? C.paper : C.ink, ls: 0});
      }
      h += txt(0, 44, 'MCT', {size: 12, w: 700});
      // the waveform of the 1.024 MHz chain over one MCT
      let path = '';
      for (let k = 0; k <= 24; k++) path += `${k ? 'L' : 'M'}${34 + (k * (W - 34)) / 24},${k % 2 ? 62 : 76}${k < 24 ? `L${34 + ((k + 1) * (W - 34)) / 24},${k % 2 ? 62 : 76}` : ''}`;
      h += `<path d="${path}" fill="none" stroke="${C.ink}" stroke-width="1"/>` + txt(0, 74, '1 MHZ', {size: 11, w: 600});
      const px = 34 + d.phase * (W - 34);
      h += `<line x1="${px}" y1="24" x2="${px}" y2="82" stroke="${C.acc}" stroke-width="1.6"/>`;
      h += txt(0, 110, tr('clockPulse'), {size: 12.5, w: 500, fill: C.mute});
      h += svgDigits(String(d.pulse + 1).padStart(2, ' '), 0, 118, 18, 32, 5, C.acc) + txt(50, 146, '/ 12', {size: 18, w: 700});
      h += `<foreignObject x="0" y="160" width="${W}" height="120"><div xmlns="http://www.w3.org/1999/xhtml" style="font:500 13.5px/17px ${FAMILY};color:${C.ink};letter-spacing:.3px">${tr('clockNote', nf(MCT_PER_S), nf(ADDS_PER_S), nf(MCT * 2e6, 1))}</div></foreignObject>`;
    } else if (d.kind === 'iface') {
      h += txt(0, 14, tr('ifHead'), {size: 13.5, w: 600});
      const rows = [
        [tr('if:rr'), d.rr ? nf(EXEC.rrAngles * EXEC.rrPulses * (EXEC.tloss / (EXEC.rrAngles * EXEC.rrPulses * MCT))) : '0', d.rr],
        [tr('if:imu'), '≈ 0', false],
        [tr('if:lr'), d.lr ? tr('if:lrOn') : '—', false],
      ];
      rows.forEach(([name, v, hot], i) => {
        const y = 32 + i * 34;
        h += `<rect x="0" y="${y}" width="${W}" height="28" fill="none" stroke="${C.faint}" stroke-width=".8"/>`;
        h += txt(8, y + 19, name, {size: 13.5, w: 600});
        h += txt(W - 8, y + 19, v, {size: 15, w: 700, anchor: 'end', fill: hot ? C.steal : C.ink});
      });
      h += txt(0, 152, tr('ifTloss'), {size: 12.5, w: 500, fill: C.mute});
      h += svgDigits(nf((d.rr ? EXEC.tloss : 0) * 100, 1).replace(',', '.'), 0, 160, 18, 32, 5, d.rr ? C.steal : C.ink);
      h += txt(110, 188, '%', {size: 20, w: 700});
      h += `<foreignObject x="0" y="200" width="${W}" height="84"><div xmlns="http://www.w3.org/1999/xhtml" style="font:500 13.5px/17px ${FAMILY};color:${C.ink};letter-spacing:.3px">${tr('ifNote', nf(EXEC.rrPulses), nf(EXEC.tlossMax * 100, 2), nf(EXEC.rrAngles * EXEC.rrPulses * MCT * 100, 1))}</div></foreignObject>`;
    } else if (d.kind === 'dsky') {
      h += txt(0, 14, tr('dskyHead'), {size: 13.5, w: 600});
      h += `<foreignObject x="0" y="24" width="${W}" height="256"><div xmlns="http://www.w3.org/1999/xhtml" style="font:500 14px/18px ${FAMILY};color:${C.ink};letter-spacing:.3px">${d.text}</div></foreignObject>`;
    } else {
      // exec: the job list with priorities
      h += txt(0, 14, tr('exHead'), {size: 13.5, w: 600});
      h += `<foreignObject x="0" y="24" width="${W}" height="256"><div xmlns="http://www.w3.org/1999/xhtml" style="font:500 14px/18px ${FAMILY};color:${C.ink};letter-spacing:.3px">${tr('exNote', EXEC.coreSets, EXEC.vacAreas, nf(EXEC.braking * 100), nf(EXEC.lrConvert * 100, 1), nf(EXEC.n68 * 100), nf(EXEC.tloss * 100))}</div></foreignObject>`;
    }
    return h;
  };

  return {
    spots,
    btn,
    root: ui,
    pointer,
    lampCv,
    elCv,
    update(s) {
      // clock
      put('get', getSvg, svgDigits(getText(s.get), 0, 2, 18, 34, 4.5, C.ink, 'rgba(70,58,40,.045)'));
      put('mct', mctSvg, svgDigits(nf(Math.floor(s.mct)).replace(/[^0-9]/g, ' '), 0, 2, 12, 22, 3.5, C.ink, null));
      put('rate', rateTx, s.rateText);
      put('phase', phaseTx, `P${s.dsky.prog}`);
      // DSKY
      const dk = JSON.stringify(s.dsky);
      if (dk !== last.dsky) {
        last.dsky = dk;
        drawLampPanel(lampCv.getContext('2d'), 420, 470, s.dsky.lamps);
        drawEL(elCv.getContext('2d'), 400, 470, s.dsky);
      }
      put('dskyTx', dskyTx, s.dskyText);
      // duty: stacked bar of what the machine is asked for, against 100 %
      {
        const W = EX.w - 28;
        const X = (v) => (v / 1.1) * W;
        const parts = s.duty.parts;
        let h = hatch;
        let x = 0;
        for (const p of parts) {
          const w = X(p.v);
          h += `<rect x="${x.toFixed(1)}" y="6" width="${Math.max(0, w - 1).toFixed(1)}" height="24" fill="${p.k === 'rr' ? 'url(#hatch)' : p.k === 'n68' || p.k === 'lpd' ? C.acc : p.k === 'lr' ? '#6d665a' : C.ink}" stroke="${p.k === 'rr' ? C.steal : 'none'}" stroke-width=".8"/>`;
          x += w;
        }
        h += `<line x1="${X(1)}" y1="0" x2="${X(1)}" y2="34" stroke="${C.ink}" stroke-width="1.6" stroke-dasharray="3 2"/>` + txt(X(1) + 4, 12, '100', {size: 11, w: 700});
        const tot = s.duty.total;
        parts.forEach((p, i) => {
          const lx = (i % 2) * (W / 2);
          const ly = 42 + Math.floor(i / 2) * 15;
          h += `<rect x="${lx}" y="${ly}" width="9" height="9" fill="${p.k === 'rr' ? 'url(#hatch)' : p.k === 'n68' || p.k === 'lpd' ? C.acc : p.k === 'lr' ? '#6d665a' : C.ink}" stroke="${p.k === 'rr' ? C.steal : 'none'}"/>` + txt(lx + 13, ly + 9, `${tr('duty:' + p.k)} ${nf(p.v * 100, Math.abs(p.v * 100 - Math.round(p.v * 100)) > 0.05 ? 1 : 0)} %`, {size: 12, w: 600, ls: 0.5});
        });
        put('duty', dutySvg, h);
        put('dutyTot', dutyTot, svgDigits(String(Math.round(tot * 100)).padStart(3, ' '), 0, 1, 13, 22, 3.5, tot > 1 ? C.amberInk : C.ink, 'rgba(70,58,40,.05)') + txt(56, 22, '%', {size: 16, w: 700}));
      }
      // core sets
      {
        const W = EX.w - 28;
        let h = '';
        const kl = KIND_LABEL();
        s.sets.forEach((j, k) => {
          const y = k * 26;
          const run = j && j.run;
          h += `<rect x="0" y="${y + 1}" width="22" height="22" fill="${j ? C.ink : 'none'}" stroke="${C.line}" stroke-width=".8"/>` + txt(11, y + 17, String(k), {size: 14, w: 700, anchor: 'middle', fill: j ? C.paper : C.ink, ls: 0});
          h += `<rect x="28" y="${y + 1}" width="${W - 28}" height="22" fill="${run ? C.acc : j ? 'rgba(43,41,37,.08)' : 'none'}" stroke="${C.faint}" stroke-width=".8"/>`;
          if (j) h += txt(36, y + 17, kl[j.kind], {size: 14, w: 700, fill: run ? C.paper : C.ink, ls: 1.2}) + txt(W - 6, y + 17, j.age, {size: 12.5, w: 600, anchor: 'end', fill: run ? C.paper : C.mute, ls: 0.5});
          else h += txt(36, y + 17, tr('setFree'), {size: 13, w: 500, fill: C.mute, ls: 1.2});
        });
        h += txt(0, 8 * 26 + 2, '', {});
        put('sets', setsSvg, h);
      }
      {
        let h = '';
        s.vacs.forEach((v, k) => {
          h += `<rect x="${k * 40}" y="2" width="34" height="20" fill="${v ? C.ink : 'none'}" stroke="${C.line}" stroke-width=".8"/>` + txt(k * 40 + 17, 17, `VAC${k + 1}`, {size: 11, w: 700, anchor: 'middle', fill: v ? C.paper : C.ink, ls: 0});
        });
        put('vac', vacSvg, h);
        put('busyTx', busyTx, `<span style="color:${s.busy >= EXEC.coreSets ? C.amberInk : C.ink}">${tr('busyOf', s.busy, EXEC.coreSets)}</span>`);
      }
      // one millisecond of memory cycles: jobs, stolen, idle
      {
        const W = EX.w - 28;
        const n = s.strip.length;
        const cw = W / n;
        let h = hatch;
        for (let i = 0; i < n; i++) {
          const v = s.strip[i];
          if (v === 's') h += `<rect x="${(i * cw).toFixed(2)}" y="0" width="${(cw - 0.6).toFixed(2)}" height="22" fill="${C.steal}"/>`;
          else if (v === 'j') h += `<rect x="${(i * cw).toFixed(2)}" y="0" width="${(cw - 0.6).toFixed(2)}" height="22" fill="${C.ink}"/>`;
          else h += `<rect x="${(i * cw).toFixed(2)}" y="0" width="${(cw - 0.6).toFixed(2)}" height="22" fill="none" stroke="${C.faint}" stroke-width=".5"/>`;
        }
        if (s.stripAt >= 0) h += `<rect x="${(s.stripAt * cw - 1).toFixed(2)}" y="-2" width="${(cw + 1.4).toFixed(2)}" height="26" fill="none" stroke="${C.acc}" stroke-width="1.6"/>`;
        h += `<rect x="0" y="30" width="9" height="9" fill="${C.ink}"/>` + txt(13, 39, tr('stripJob'), {size: 11.5, w: 600, ls: 0.6});
        h += `<rect x="96" y="30" width="9" height="9" fill="${C.steal}"/>` + txt(109, 39, tr('stripSteal'), {size: 11.5, w: 600, ls: 0.6});
        h += `<rect x="190" y="30" width="9" height="9" fill="none" stroke="${C.faint}"/>` + txt(203, 39, tr('stripIdle'), {size: 11.5, w: 600, ls: 0.6});
        put('strip', stripSvg, h);
      }
      // the alarm, then what the restart kept and dropped
      {
        const a = s.alarm;
        if (a && a.k > 0.01) {
          alarmBox.style.display = 'block';
          alarmBox.style.opacity = a.k.toFixed(2);
          put(
            'alarm',
            alarmBox,
            `<div style="position:absolute;left:12px;top:6px;font-weight:700;font-size:14px;letter-spacing:2px">${tr('alarmHead')}</div>
             <svg style="position:absolute;left:12px;top:28px" width="120" height="50">${svgDigits(String(a.code).padStart(4, '0'), 0, 2, 22, 44, 6, '#2a1d05')}</svg>
             <div style="position:absolute;left:132px;top:30px;width:150px;font-weight:700;font-size:15px;line-height:18px;letter-spacing:.8px">${tr('alarm:' + a.code)}</div>
             <div style="position:absolute;left:12px;top:80px;width:272px;font-weight:500;font-size:13px;line-height:16px">${tr('restartKept', KIND_LABEL()[a.kept] ?? '—')}<br>${tr('restartDropped', a.dropped)}</div>`,
          );
          put('restart', restartTx, '');
        } else {
          alarmBox.style.display = 'none';
          put('restart', restartTx, s.execNote || '');
        }
      }
      // detail
      put('detHd', detHd, tr('det:' + s.detail.kind));
      put('det', detSvg, drawDetail(s.detail));
      put('cap', cap, s.caption ? `<span>${s.caption}</span>` : '');
      // buttons
      for (const [k, n] of Object.entries(btn)) {
        const on = s.sub === k || s.cut === k || s.view === k;
        if (n.classList.contains('on') !== on) n.classList.toggle('on', on);
      }
      // callouts
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = c.w < 0;
        const w = Math.abs(c.w);
        const o = c.o.toFixed(2);
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx.toFixed(1)},${(ly + 34).toFixed(1)} ${(lx + (right ? -w : w)).toFixed(1)},${(ly + 34).toFixed(1)}" fill="none" stroke="${C.ink}" stroke-width="1" opacity="${o}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="3" fill="${c.hot ? C.acc : C.ink}" opacity="${o}"/>`;
        ch += `<div class="call" style="${right ? `right:${(1600 - lx).toFixed(1)}px;text-align:right` : `left:${lx.toFixed(1)}px`};top:${(ly - 2).toFixed(1)}px;opacity:${o}"><b style="${c.hot ? `color:${C.acc}` : ''}">${c.name}</b><span style="margin-top:6px">${c.sub}</span></div>`;
      }
      put('callL', callSvg, lh);
      put('callG', callG, ch);
      pointer(s.cursor);
    },
  };
}
void digitsWidth;
