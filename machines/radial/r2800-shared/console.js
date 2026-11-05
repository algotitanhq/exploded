// Radial's overlay, a plate from a period technical manual: paper panels with a double rule, figure numbers, a
// condensed grotesque and a stencil title. Left: the title, three round dials drawn from the model (rpm, manifold
// pressure, brake power) with the torque and the piston speed under them, the engine's data plate, the run (phase and
// slow motion). Right: the firing-order star turning with the crank, a context figure (the piston law of a master
// and an articulated rod, the cam ring, the throws, the take-off curve), the subsystem, cutaway, view and layer
// buttons. Callouts with thin leaders. Fixed 1600 x 900 CSS layout; update(s) redraws every live part.
import {ACCENT} from './model.js';
import {CAM, CYL, DISPL_IN3, DISPL_L, E, FIRE, GEAR, LAW, lift, MASS_KG, ORDER, RATING, ROWS, pistonS, propHp, stateAt, VALVE} from './engine.js';
import {FONT} from './fonts.js';
import {nf, T as tr} from './i18n.js';

export const C = {ink: '#22262b', mute: '#777b80', faint: '#b9b6ad', rule: '#2b2f34', paper: 'rgba(246,243,234,.95)', paperSolid: '#f6f3ea', acc: ACCENT, accSoft: 'rgba(10,143,224,.16)', red: '#b8322a'};
export const SUBS = ['crank', 'cyl', 'valve', 'ign', 'air', 'prop', 'oil'];
export const CUTS = ['glass', 'section', 'solid'];
export const CAMS = ['face', 'hero', 'profile', 'inside'];
export const LAYERS = ['cowl', 'callouts'];
const CSS = `
#app{font-family:${FONT.cond};color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.pl{position:absolute;background:${C.paper};border:1.5px solid ${C.rule};box-shadow:0 1px 0 rgba(0,0,0,.05)}
.pl::after{content:'';position:absolute;inset:3px;border:.75px solid rgba(34,38,43,.45);pointer-events:none}
.fig{position:absolute;font-weight:700;font-size:13px;letter-spacing:1.6px;text-transform:uppercase;white-space:nowrap}
.fig i{font-style:normal;color:${C.mute};font-weight:500;margin-right:6px}
.mu{color:${C.mute}}
.tb{position:absolute;height:22px;padding:0 7px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;border:1.2px solid ${C.rule};background:${C.paperSolid};color:${C.ink};white-space:nowrap;box-sizing:border-box}
.tb.on{background:${C.ink};color:${C.paperSolid}}
.call{position:absolute;white-space:nowrap;background:rgba(246,243,234,.88);padding:3px 7px 4px;border-left:2px solid ${C.rule}}
.call.r{border-left:0;border-right:2px solid ${C.rule}}
.call b{display:block;font-size:24px;font-weight:700;letter-spacing:.2px;line-height:1}
.call span{display:block;font-size:12.5px;font-weight:500;letter-spacing:1.2px;color:${C.mute};text-transform:uppercase;margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;border:2px solid ${C.ink};opacity:0;z-index:49}
.row{position:absolute;display:flex;justify-content:space-between;font-size:13.5px;letter-spacing:.3px}
.row span:first-child{color:${C.mute};text-transform:uppercase;letter-spacing:1px;font-size:12px;font-weight:500}
.row b{font-weight:700}
svg text{font-family:${FONT.cond}}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const fInt = (x) => nf(Math.round(x));
const D2R = Math.PI / 180;

/** a round dial: the face and ticks are drawn once, the needle every frame */
function dial(svg, {cx, cy, r, min, max, major, minor, label, unit, scaleTxt = (v) => nf(v), red, skipEnds = false}) {
  const a0 = -225;
  const a1 = 45;
  const ang = (v) => a0 + ((v - min) / (max - min)) * (a1 - a0);
  const P = (a, rr) => [cx + Math.cos(a * D2R) * rr, cy + Math.sin(a * D2R) * rr];
  let h = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fbf9f3" stroke="${C.rule}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${r - 4}" fill="none" stroke="${C.rule}" stroke-width=".6"/>`;
  for (let v = min; v <= max + 1e-6; v += minor) {
    const isMaj = Math.abs(((v - min) / major) % 1) < 1e-6 || Math.abs(((v - min) / major) % 1 - 1) < 1e-6;
    const [x0, y0] = P(ang(v), r - 6);
    const [x1, y1] = P(ang(v), r - (isMaj ? 15 : 10));
    h += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${C.ink}" stroke-width="${isMaj ? 1.8 : 0.9}"/>`;
    if (isMaj && !(skipEnds && (Math.abs(v - min) < 1e-6 || Math.abs(v - max) < 1e-6))) {
      const [tx, ty] = P(ang(v), r - (r > 60 ? 26 : 23));
      h += `<text x="${tx}" y="${ty + 4.5}" text-anchor="middle" font-size="${r > 60 ? 13.5 : 12}" font-weight="700" fill="${C.ink}">${scaleTxt(v)}</text>`;
    }
  }
  if (red !== undefined) {
    const [x0, y0] = P(ang(red), r - 5);
    const [x1, y1] = P(ang(red), r - 18);
    h += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${C.red}" stroke-width="3.2"/>`;
  }
  const ly = cy + r * (r > 60 ? 0.42 : 0.66);
  h += `<text x="${cx}" y="${ly}" text-anchor="middle" font-size="${r > 60 ? 13 : 11}" font-weight="700" letter-spacing="1.2" fill="${C.ink}">${label}</text>`;
  h += `<text x="${cx}" y="${ly + (r > 60 ? 12 : 10)}" text-anchor="middle" font-size="${r > 60 ? 10 : 9}" font-weight="500" letter-spacing="1" fill="${C.mute}">${unit}</text>`;
  h += `<g class="ndl"><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - r + 14}" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy + 14}" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/></g><circle cx="${cx}" cy="${cy}" r="6" fill="${C.ink}"/>`;
  svg.insertAdjacentHTML('beforeend', h);
  const ndl = svg.lastElementChild.previousElementSibling;
  return (v) => ndl.setAttribute('transform', `rotate(${ang(Math.min(max, Math.max(min, v))) + 90} ${cx} ${cy})`);
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

  // ------------------------------------------------------------ title plate
  add(`<div class="pl" style="left:28px;top:24px;width:292px;height:108px"></div>`);
  add(`<div style="position:absolute;left:42px;top:30px;font:400 44px/1 ${FONT.stencil};letter-spacing:2px">RADIAL</div>`);
  add(`<div style="position:absolute;left:44px;top:80px;font-size:15.5px;font-weight:700;letter-spacing:1.2px">${tr('subtitle')}</div>`);
  add(`<div class="mu" style="position:absolute;left:44px;top:100px;width:270px;font-size:11px;font-weight:500;letter-spacing:1.1px;line-height:1.25;text-transform:uppercase">${tr('model')}</div>`);

  // ------------------------------------------------------------ instruments
  add(`<div class="pl" data-g="charts" style="left:28px;top:142px;width:292px;height:306px"></div>`);
  add(`<div class="fig" data-g="charts" style="left:42px;top:152px"><i>${tr('fig', 1)}</i>${tr('figInstr')}</div>`);
  const dsvg = add(`<svg data-g="charts" style="position:absolute;left:30px;top:166px" width="288" height="220"></svg>`);
  const setRpm = dial(dsvg, {cx: 84, cy: 108, r: 76, min: 0, max: 3000, major: 500, minor: 100, label: tr('dRpm'), unit: tr('dRpmU'), scaleTxt: (v) => nf(v / 100), red: RATING.takeoff.rpm});
  const setMap = dial(dsvg, {cx: 222, cy: 56, r: 52, min: 10, max: 70, major: 20, minor: 5, label: tr('dMap'), unit: 'IN HG', red: RATING.takeoff.map, skipEnds: true});
  const setHp = dial(dsvg, {cx: 222, cy: 164, r: 52, min: 0, max: 2500, major: 500, minor: 250, label: tr('dHp'), unit: 'HP × 100', scaleTxt: (v) => nf(v / 100), red: RATING.takeoff.hp, skipEnds: true});
  const readTop = 382;
  const rowsTxt = ['rTorque', 'rPiston', 'rProp'].map((k, i) =>
    add(`<div class="row" data-g="charts" style="left:42px;top:${readTop + i * 18}px;width:264px"><span>${tr(k)}</span><b></b></div>`).querySelector('b'),
  );

  // ------------------------------------------------------------ data plate
  add(`<div class="pl" data-g="charts" style="left:28px;top:458px;width:292px;height:248px"></div>`);
  add(`<div class="fig" data-g="charts" style="left:42px;top:468px"><i>${tr('fig', 2)}</i>${tr('figData')}</div>`);
  const data = [
    ['pBore', `${nf(5.75, 2)} × ${nf(6, 2)} in`],
    ['pDispl', `${fInt(DISPL_IN3)} in³ · ${nf(DISPL_L, 1)} L`],
    ['pCr', `${nf(E.cr, 2)} : 1`],
    ['pTo', `${fInt(RATING.takeoff.hp)} hp · ${fInt(RATING.takeoff.rpm)} · ${nf(RATING.takeoff.map, 1)}″`],
    ['pWet', `${fInt(RATING.wet.hp)} hp · ${fInt(RATING.wet.rpm)} · ${nf(RATING.wet.map, 1)}″`],
    ['pRed', `${nf(GEAR.prop, 2)} : 1`],
    ['pSc', tr('pScV', nf(GEAR.impLow, 2), nf(GEAR.impHigh, 2))],
    ['pMass', `${fInt(MASS_KG)} kg`],
    ['pCam', tr('pCamV')],
    ['pIgn', tr('pIgnV')],
  ];
  data.forEach(([k, v], i) => add(`<div class="row" data-g="charts" style="left:42px;top:${490 + i * 20.5}px;width:264px"><span>${tr(k)}</span><b>${v}</b></div>`));

  // ------------------------------------------------------------ the run: phase, slow motion, live controls
  add(`<div class="pl" style="left:28px;top:716px;width:292px;height:162px"></div>`);
  add(`<div class="fig" style="left:42px;top:726px"><i>${tr('fig', 3)}</i>${tr('figRun')}</div>`);
  const phaseTxt = add(`<div style="position:absolute;left:42px;top:746px;font:400 25px/1 ${FONT.stencil};letter-spacing:1px"></div>`);
  const slowTxt = add(`<div style="position:absolute;left:42px;top:778px;font-size:13.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase"></div>`);
  const btn = {};
  ['starter', 'ignition', 'slowmo', 'pause'].forEach((k, i) => {
    btn[k] = add(`<div class="tb" style="left:${42 + i * 66.5}px;top:802px;width:62.5px;font-size:11.5px;letter-spacing:.8px;padding:0 3px">${tr({starter: 'bStarter', ignition: 'bIgnition', slowmo: 'bSlow', pause: 'pause'}[k])}</div>`);
  });
  add(`<div class="mu" style="position:absolute;left:42px;top:830px;font-size:11.5px;font-weight:500;letter-spacing:1px">${tr('throttle')}</div>`);
  const thrVal = add(`<div style="position:absolute;left:226px;top:830px;width:80px;text-align:right;font-size:12px;font-weight:700"></div>`);
  const SL = {x: 44, w: 260};
  add(`<div style="position:absolute;left:${SL.x}px;top:852px;width:${SL.w}px;height:2px;background:${C.rule}"></div>`);
  const thrKnob = add(`<div style="position:absolute;top:845px;width:10px;height:16px;margin-left:-5px;background:${C.ink}"></div>`);


  // ------------------------------------------------------------ firing-order star
  add(`<div class="pl" data-g="charts" style="left:1280px;top:24px;width:292px;height:348px"></div>`);
  add(`<div class="fig" data-g="charts" style="left:1294px;top:34px"><i>${tr('fig', 4)}</i>${tr('figStar')}</div>`);
  add(`<div class="mu" data-g="charts" style="position:absolute;left:1294px;top:52px;font-size:11px;font-weight:500;letter-spacing:1.1px">${tr('starSub')}</div>`);
  const SC = {cx: 146, cy: 112, rr: 64, rf: 92};
  const star = add(`<svg data-g="charts" style="position:absolute;left:1280px;top:66px" width="292" height="232"></svg>`);
  const sp = (a, r) => [SC.cx - Math.sin(a * D2R) * r, SC.cy - Math.cos(a * D2R) * r];
  {
    let h = `<circle cx="${SC.cx}" cy="${SC.cy}" r="${SC.rr}" fill="none" stroke="${C.faint}" stroke-width="1" stroke-dasharray="2 3"/><circle cx="${SC.cx}" cy="${SC.cy}" r="${SC.rf}" fill="none" stroke="${C.faint}" stroke-width="1" stroke-dasharray="2 3"/>`;
    h += `<circle cx="${SC.cx}" cy="${SC.cy}" r="30" fill="#fbf9f3" stroke="${C.rule}" stroke-width="1.4"/>`;
    for (const cy of CYL) {
      const [x, y] = sp(cy.angle, cy.row === 'rear' ? SC.rr : SC.rf);
      h += `<circle data-c="${cy.c}" cx="${x}" cy="${y}" r="11.5" fill="${cy.row === 'rear' ? '#e7e3d8' : '#fbf9f3'}" stroke="${C.ink}" stroke-width="1.3"/>`;
      h += `<text data-t="${cy.c}" x="${x}" y="${y + 4.6}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${C.ink}">${cy.c}</text>`;
    }
    h += `<g class="pins"><line x1="${SC.cx}" y1="${SC.cy}" x2="${SC.cx}" y2="${SC.cy - 44}" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/><circle cx="${SC.cx}" cy="${SC.cy - 44}" r="5" fill="${C.ink}"/><line x1="${SC.cx}" y1="${SC.cy}" x2="${SC.cx}" y2="${SC.cy + 44}" stroke="${C.mute}" stroke-width="3" stroke-linecap="round"/><circle cx="${SC.cx}" cy="${SC.cy + 44}" r="5" fill="none" stroke="${C.mute}" stroke-width="2"/></g>`;
    h += `<text x="8" y="226" font-size="11" font-weight="500" letter-spacing="1" fill="${C.mute}">${tr('starKey')}</text>`;
    star.innerHTML = h;
  }
  const starDots = Object.fromEntries(CYL.map((cy) => [cy.c, star.querySelector(`[data-c="${cy.c}"]`)]));
  const starTxt = Object.fromEntries(CYL.map((cy) => [cy.c, star.querySelector(`[data-t="${cy.c}"]`)]));
  const pins = star.querySelector('.pins');
  const orderBox = add(`<div data-g="charts" style="position:absolute;left:1294px;top:300px;width:266px;font-size:15px;font-weight:700;letter-spacing:.5px;line-height:1.25"></div>`);
  orderBox.innerHTML = ORDER.map((c) => `<span data-o="${c}" style="display:inline-block;width:${266 / 9}px;text-align:center">${c}</span>`).join('');
  const orderSpans = Object.fromEntries(ORDER.map((c) => [c, orderBox.querySelector(`[data-o="${c}"]`)]));
  const starFoot = add(`<div class="mu" data-g="charts" style="position:absolute;left:1294px;top:345px;width:266px;font-size:12px;font-weight:500;letter-spacing:.9px;text-transform:uppercase"></div>`);

  // ------------------------------------------------------------ context figure
  add(`<div class="pl" data-g="charts" style="left:1280px;top:382px;width:292px;height:228px"></div>`);
  const ctxTitle = add(`<div class="fig" data-g="charts" style="left:1294px;top:392px"></div>`);
  const ctxSvg = add(`<svg data-g="charts" style="position:absolute;left:1286px;top:410px" width="282" height="138"></svg>`);
  const ctxTxt = add(`<div data-g="charts" style="position:absolute;left:1294px;top:548px;width:264px;font-size:13px;line-height:1.28"></div>`);

  // ------------------------------------------------------------ subsystems, cutaways, views, layers
  add(`<div class="pl" style="left:1280px;top:620px;width:292px;height:258px"></div>`);
  const spots = {};
  const group = (title, keys, y, label, cols) => {
    add(`<div class="mu" style="position:absolute;left:1294px;top:${y}px;font-size:11px;font-weight:500;letter-spacing:1.3px">${title}</div>`);
    const W = 264;
    const gap = 4;
    const w = (W - gap * (cols - 1)) / cols;
    keys.forEach((k, i) => {
      const x = 1294 + (i % cols) * (w + gap);
      const yy = y + 15 + Math.floor(i / cols) * 25;
      btn[k] = add(`<div class="tb" style="left:${x}px;top:${yy}px;width:${w}px">${label(k)}</div>`);
      spots[k] = [x + w / 2, yy + 11];
    });
    return y + 15 + Math.ceil(keys.length / cols) * 25 + 4;
  };
  let y = group(tr('grpSub'), SUBS, 628, (k) => tr('sub:' + k), 2);
  y = group(tr('grpCut'), CUTS, y, (k) => tr('cut:' + k), 3);
  y = group(tr('grpView'), CAMS, y, (k) => tr('cam:' + k), 4);
  group(tr('grpLayer'), LAYERS, y, (k) => tr('lay:' + k), 2);
  ['starter', 'ignition', 'slowmo', 'pause'].forEach((k, i) => (spots[k] = [42 + i * 66.5 + 31, 813]));
  spots.throttle = [SL.x + SL.w * 0.15, 853];
  spots.throttleBack = [SL.x + SL.w, 853];

  // ------------------------------------------------------------ caption, callouts, cursor
  const cap = add(`<div style="position:absolute;left:800px;top:842px;transform:translateX(-50%);padding:6px 14px 5px;background:${C.paper};border:1.5px solid ${C.rule};font-size:20px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;white-space:nowrap"></div>`);
  const leaders = add(`<svg style="position:absolute;left:0;top:0;overflow:visible" width="1600" height="900"></svg>`);
  const callPool = [];
  const cursor = add(`<svg class="cur" width="26" height="30" viewBox="0 0 26 30"><path d="M3 2 L3 24 L9 18.5 L13 27 L17 25 L13 17 L21 17 Z" fill="#fff" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/></svg>`);
  const ring = add(`<div class="ring"></div>`);

  // ------------------------------------------------------------ context figures
  const plot = (pts, x0, y0, w, h, xr, yr, color, width = 1.6, dash = '') => {
    const X = (x) => x0 + ((x - xr[0]) / (xr[1] - xr[0])) * w;
    const Y = (v) => y0 + h - ((v - yr[0]) / (yr[1] - yr[0])) * h;
    return `<polyline points="${pts.map(([a, b]) => `${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  };
  const axes = (x0, y0, w, h, xl, yl) =>
    `<line x1="${x0}" y1="${y0 + h}" x2="${x0 + w}" y2="${y0 + h}" stroke="${C.rule}" stroke-width="1"/><line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + h}" stroke="${C.rule}" stroke-width="1"/>` +
    `<text x="${x0 + w}" y="${y0 + h + 13}" text-anchor="end" font-size="10.5" font-weight="500" fill="${C.mute}" letter-spacing=".8">${xl}</text><text x="${x0 + 4}" y="${y0 + 9}" font-size="10.5" font-weight="500" fill="${C.mute}" letter-spacing=".8">${yl}</text>`;
  // the piston law: master against its most different articulated rod, the difference magnified
  const lawCyl = (row) => ROWS[row].filter((c) => c.c !== E.master[row]).reduce((a, b) => (Math.abs(LAW[b.c].tdcLag) > Math.abs(LAW[a.c].tdcLag) ? b : a)).c;
  const lawStatic = {};
  const lawFig = (row) => {
    if (lawStatic[row]) return lawStatic[row];
    const m = E.master[row];
    const a = lawCyl(row);
    const dm = CYL[a - 1].angle - CYL[m - 1].angle;
    const t0 = LAW[m].thTDC;
    const ptsD = [];
    for (let i = 0; i <= 180; i++) {
      const x = i * 2;
      ptsD.push([x, pistonS(a, t0 + x + dm) - pistonS(m, t0 + x)]);
    }
    const lo = Math.min(...ptsD.map((p) => p[1]));
    const hi = Math.max(...ptsD.map((p) => p[1]));
    const ym = Math.max(Math.abs(lo), Math.abs(hi)) * 1.15;
    const h =
      axes(30, 6, 236, 100, tr('lawX'), tr('lawY')) +
      `<line x1="30" y1="${6 + 50}" x2="266" y2="${6 + 50}" stroke="${C.faint}" stroke-width="1"/>` +
      plot(ptsD, 30, 6, 236, 100, [0, 360], [-ym, ym], C.acc, 2.2) +
      `<text x="26" y="12" text-anchor="end" font-size="10" fill="${C.mute}">+${nf(ym, 1)}</text><text x="26" y="110" text-anchor="end" font-size="10" fill="${C.mute}">−${nf(ym, 1)}</text>`;
    lawStatic[row] = {h, m, a, dm, ym, t0};
    return lawStatic[row];
  };
  const camFig = {};
  const camFigFor = (c) => {
    if (camFig[c]) return camFig[c];
    const pi = [];
    const pe = [];
    for (let i = 0; i <= 240; i++) {
      const th = FIRE[c] + i * 3;
      pi.push([i * 3, lift(c, 'in', th)]);
      pe.push([i * 3, lift(c, 'ex', th)]);
    }
    const h = axes(30, 6, 236, 96, tr('camX'), tr('camY')) + plot(pe, 30, 6, 236, 96, [0, 720], [0, 1.15], C.ink, 1.8, '4 3') + plot(pi, 30, 6, 236, 96, [0, 720], [0, 1.15], C.ink, 2) + [180, 360, 540].map((x) => `<line x1="${30 + (x / 720) * 236}" y1="6" x2="${30 + (x / 720) * 236}" y2="102" stroke="${C.faint}" stroke-width=".8"/>`).join('') + ['power', 'exhaust', 'intake', 'compression'].map((k, i) => `<text x="${30 + ((i * 180 + 90) / 720) * 236}" y="128" text-anchor="middle" font-size="10" font-weight="500" letter-spacing=".6" fill="${C.mute}">${tr('st:' + k)}</text>`).join('');
    camFig[c] = h;
    return h;
  };
  const toFig = (() => {
    const pts = [];
    for (let N = 600; N <= 2800; N += 50) pts.push([N, propHp(N)]);
    const tq = [];
    for (let N = 600; N <= 2800; N += 50) tq.push([N, stateAt(N).torque]);
    return axes(30, 6, 236, 100, tr('toX'), tr('toY')) + plot(pts, 30, 6, 236, 100, [600, 2800], [0, 2500], C.ink, 2) + plot(tq.map(([a, b]) => [a, b / 2.4]), 30, 6, 236, 100, [600, 2800], [0, 2500], C.ink, 1.6, '4 3') + `<circle cx="${30 + ((2700 - 600) / 2200) * 236}" cy="${6 + 100 - (2050 / 2500) * 100}" r="4" fill="none" stroke="${C.red}" stroke-width="1.6"/>`;
  })();
  let ctxKey = '';

  const update = (s) => {
    // dials and readouts
    setRpm(s.N);
    setMap(s.map);
    setHp(s.hp);
    rowsTxt[0].textContent = `${fInt(s.torque)} N·m · ${fInt(s.torque * 0.7376)} lb·ft`;
    rowsTxt[1].textContent = `${nf(s.pistonMs, 1)} m/s`;
    rowsTxt[2].textContent = `${fInt(s.propRpm)} · ${fInt(s.impRpm)}`;
    // the run
    phaseTxt.textContent = tr('ph:' + s.phase);
    slowTxt.innerHTML = s.rate < 0.98 ? tr('slow', nf(1000 * s.rate, 0), nf(1 / s.rate, 0)) : tr('realtime');
    thrVal.textContent = `${fInt(s.thrRpm ?? s.N)} ${tr('rpmShort')}`;
    thrKnob.style.left = `${SL.x + SL.w * Math.min(1, Math.max(0, ((s.thrRpm ?? s.N) - RATING.idle) / (RATING.takeoff.rpm - RATING.idle)))}px`;
    btn.starter.classList.toggle('on', !!s.starter);
    btn.ignition.classList.toggle('on', !!s.ignition);
    btn.pause.classList.toggle('on', !!s.paused);
    btn.slowmo.classList.toggle('on', s.rate < 0.98);
    // the star: the crank pins turn, the cylinder that fires lights
    pins.setAttribute('transform', `rotate(${-s.th} ${SC.cx} ${SC.cy})`);
    let best = 0;
    let bestC = 0;
    for (const cy of CYL) {
      const g = s.lit[cy.c - 1];
      const dot = starDots[cy.c];
      const k = Math.min(1, g * 1.6);
      dot.setAttribute('fill', k > 0.02 ? `rgba(10,143,224,${(0.2 + 0.8 * k).toFixed(3)})` : cy.row === 'rear' ? '#e7e3d8' : '#fbf9f3');
      dot.setAttribute('stroke', k > 0.3 ? C.acc : C.ink);
      starTxt[cy.c].setAttribute('fill', k > 0.5 ? '#fff' : C.ink);
      if (g > best) [best, bestC] = [g, cy.c];
    }
    for (const c of ORDER) {
      const on = c === bestC && best > 0.15;
      orderSpans[c].style.color = on ? '#fff' : C.ink;
      orderSpans[c].style.background = on ? C.acc : 'transparent';
    }
    starFoot.innerHTML = tr('starFoot', nf(s.fireHz, 0));
    // context figure
    const key = s.ctx + ':' + (s.ctxArg ?? '');
    if (key !== ctxKey) {
      ctxKey = key;
      ctxTitle.innerHTML = `<i>${tr('fig', 5)}</i>${tr('ctx:' + s.ctx)}`;
      if (s.ctx === 'law') ctxSvg.innerHTML = lawFig(s.ctxArg || 'front').h + `<g class="cur1"></g>`;
      else if (s.ctx === 'cam') ctxSvg.innerHTML = camFigFor(s.ctxArg) + `<g class="cur1"></g>`;
      else if (s.ctx === 'takeoff') ctxSvg.innerHTML = toFig + `<g class="cur1"></g>`;
      else if (s.ctx === 'throws') ctxSvg.innerHTML = `<g class="cur1"></g>`;
      else ctxSvg.innerHTML = `<g class="cur1"></g>`;
    }
    const cur1 = ctxSvg.querySelector('.cur1');
    if (s.ctx === 'law') {
      const L = lawFig(s.ctxArg || 'front');
      const m = LAW[L.m];
      const a = LAW[L.a];
      const th = (((s.th - L.t0) % 360) + 360) % 360;
      const x = 30 + (th / 360) * 236;
      const d = pistonS(L.a, s.th + L.dm) - pistonS(L.m, s.th);
      cur1.innerHTML = `<line x1="${x}" y1="6" x2="${x}" y2="106" stroke="${C.ink}" stroke-width="1"/><circle cx="${x}" cy="${6 + 50 - (d / L.ym) * 50}" r="4.5" fill="${C.acc}"/>`;
      ctxTxt.innerHTML = tr('lawTxt', L.m, L.a, nf(m.stroke, 2), nf(a.stroke, 2), nf(Math.abs(a.tdcLag), 1), nf(-a.dTDC, 2), nf(m.cr, 2), nf(a.cr, 2), a.tdcLag > 0);
    } else if (s.ctx === 'cam') {
      const c = s.ctxArg;
      const ph = (((s.th - FIRE[c]) % 720) + 720) % 720;
      const x = 30 + (ph / 720) * 236;
      cur1.innerHTML = `<line x1="${x}" y1="6" x2="${x}" y2="102" stroke="${C.acc}" stroke-width="1.6"/><circle cx="${x}" cy="${6 + 96 - (lift(c, 'in', s.th) / 1.15) * 96}" r="4.5" fill="${C.acc}"/><circle cx="${x}" cy="${6 + 96 - (lift(c, 'ex', s.th) / 1.15) * 96}" r="4" fill="${C.ink}"/>`;
      ctxTxt.innerHTML = tr('camTxt', c, CAM.lobes, nf(CAM.liftMm, 1), nf(lift(c, 'in', s.th) * CAM.liftMm, 1), nf(lift(c, 'ex', s.th) * CAM.liftMm, 1), VALVE.in, VALVE.ex);
    } else if (s.ctx === 'takeoff') {
      const x = 30 + ((Math.min(2800, Math.max(600, s.N)) - 600) / 2200) * 236;
      const yv = 6 + 100 - (Math.min(2500, s.hp) / 2500) * 100;
      cur1.innerHTML = `<circle cx="${x}" cy="${yv}" r="5" fill="${C.acc}"/>`;
      ctxTxt.innerHTML = tr('toTxt', fInt(s.hp), fInt(s.N), nf(s.map, 1), fInt(s.torque));
    } else if (s.ctx === 'throws') {
      // the two crankpins seen from the front, and the rows
      const cx = 70;
      const cy = 66;
      const rr = s.th * D2R;
      const p = (a, r) => [cx - Math.sin(a) * r, cy - Math.cos(a) * r];
      const [x1, y1] = p(rr, 34);
      const [x2, y2] = p(rr + Math.PI, 34);
      cur1.innerHTML = `<circle cx="${cx}" cy="${cy}" r="54" fill="none" stroke="${C.faint}"/><circle cx="${cx}" cy="${cy}" r="9" fill="${C.ink}"/><line x1="${cx}" y1="${cy}" x2="${x1}" y2="${y1}" stroke="${C.ink}" stroke-width="6" stroke-linecap="round"/><circle cx="${x1}" cy="${y1}" r="9" fill="#fbf9f3" stroke="${C.ink}" stroke-width="2.4"/><line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${C.mute}" stroke-width="6" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="9" fill="#fbf9f3" stroke="${C.mute}" stroke-width="2.4"/><text x="${cx}" y="134" text-anchor="middle" font-size="11" font-weight="500" letter-spacing="1" fill="${C.mute}">${tr('throwKey')}</text>` +
        `<text x="140" y="34" font-size="13" font-weight="700" fill="${C.ink}">${tr('throwA')}</text><text x="140" y="52" font-size="12" fill="${C.mute}">${tr('throwA2')}</text><text x="140" y="80" font-size="13" font-weight="700" fill="${C.ink}">${tr('throwB')}</text><text x="140" y="98" font-size="12" fill="${C.mute}">${tr('throwB2')}</text>`;
      ctxTxt.innerHTML = tr('throwTxt');
    } else if (s.ctx === 'ign') {
      cur1.innerHTML = '';
      ctxTxt.innerHTML = tr('ignTxt');
    } else {
      cur1.innerHTML = '';
      ctxTxt.innerHTML = tr('ctxTxt:' + s.ctx);
    }
    const plain = !['law', 'cam', 'takeoff', 'throws'].includes(s.ctx);
    ctxTxt.style.top = plain ? '418px' : '548px';
    ctxTxt.style.fontSize = plain ? '15px' : '13px';
    // buttons
    for (const k of SUBS) btn[k].classList.toggle('on', s.sub === k);
    for (const k of CUTS) btn[k].classList.toggle('on', s.cut === k);
    for (const k of CAMS) btn[k].classList.toggle('on', s.camBtn === k);
    btn.cowl.classList.toggle('on', !!s.layers?.cowl);
    btn.callouts.classList.toggle('on', !!s.layers?.callouts);
    // caption
    cap.textContent = s.caption || '';
    cap.style.display = s.caption ? '' : 'none';
    // callouts
    const list = s.callouts || [];
    let lh = '';
    list.forEach((c, i) => {
      let d = callPool[i];
      if (!d) {
        d = add(`<div class="call"><b></b><span></span></div>`);
        callPool[i] = d;
      }
      const o = c.o ?? 1;
      if (!c.at || o < 0.02) {
        d.style.display = 'none';
        return;
      }
      d.style.display = '';
      d.style.opacity = o;
      d.querySelector('b').textContent = c.name;
      d.querySelector('span').textContent = c.sub || '';
      const right = c.w < 0;
      const [lx, ly] = c.label;
      d.style.left = right ? '' : `${lx}px`;
      d.style.right = right ? `${1600 - lx}px` : '';
      d.style.textAlign = right ? 'right' : 'left';
      d.classList.toggle('r', right);
      d.style.top = `${ly - 17}px`;
      const ex = lx;
      const kx = ex + (right ? 1 : -1) * Math.abs(c.w) * 0.25;
      lh += `<polyline points="${ex},${ly} ${kx},${ly} ${c.at[0].toFixed(1)},${c.at[1].toFixed(1)}" fill="none" stroke="${C.ink}" stroke-width="1.2" opacity="${o}"/><circle cx="${c.at[0].toFixed(1)}" cy="${c.at[1].toFixed(1)}" r="3.2" fill="${C.paperSolid}" stroke="${C.ink}" stroke-width="1.4" opacity="${o}"/>`;
    });
    for (let i = list.length; i < callPool.length; i++) callPool[i].style.display = 'none';
    leaders.innerHTML = lh;
    // cursor
    const cu = s.cursor || {x: -99, y: -99};
    cursor.style.transform = `translate(${cu.x - 3}px, ${cu.y - 2}px) scale(${cu.press ? 0.9 : 1})`;
    ring.style.left = `${cu.ringX ?? 0}px`;
    ring.style.top = `${cu.ringY ?? 0}px`;
    ring.style.opacity = cu.ring ?? 0;
    ring.style.transform = `scale(${1.6 - 0.6 * (cu.ring ?? 0)})`;
  };
  return {root: ui, btn, spots, update, SL, thrKnob};
}
void DISPL_IN3;
