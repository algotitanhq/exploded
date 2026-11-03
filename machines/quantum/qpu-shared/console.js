// The QPU's overlay: title and the physical clock top left, the source and losses panels, the transport bottom left;
// the stage list, the coincidence histogram and the Perceval / HOM panel on the right; view, cutaway and layer toggles
// bottom right; the photon's path as a strip bottom centre; callouts with thin leaders into the machine.
// Fixed 1600 x 900 CSS layout; update(s) redraws every live part from the frame's state.
import {ACCENT} from './machine.js';
import {ETA, P, homPc, patLabel, rateN} from './photonics.js';
import {nf, T as tr} from './i18n.js';

export const C = {ink: '#16181b', mute: '#8b8f95', faint: '#c9ccd0', line: '#e1e3e6', panel: 'rgba(248,248,249,.94)', acc: ACCENT, accSoft: 'rgba(107,60,242,.14)', laser: '#e04a3a'};
export const CAMS = ['hero', 'source', 'demux', 'chip', 'detect', 'perceval', 'hom'];
export const CAM_LABEL = Object.fromEntries([...CAMS, 'tour'].map((k) => [k, tr('cam:' + k)]));
export const CUTS = ['glass', 'section', 'solid'];
export const CUT_LABEL = Object.fromEntries(CUTS.map((k) => [k, tr('cut:' + k)]));
export const OVERLAYS = ['callouts', 'isolate', 'doors', 'charts'];
export const OV_LABEL = Object.fromEntries(OVERLAYS.map((k) => [k, tr('ov:' + k)]));
export const STAGES = [
  {key: 'laser', cam: 'source'},
  {key: 'source', cam: 'source'},
  {key: 'demux', cam: 'demux'},
  {key: 'chip', cam: 'chip'},
  {key: 'detect', cam: 'detect'},
  {key: 'tagger', cam: 'detect'},
].map((x) => ({...x, name: tr('st:' + x.key), sub: tr('stsub:' + x.key)}));
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.pn{position:absolute;background:${C.panel};border:1px solid ${C.line};box-shadow:0 1px 2px rgba(20,22,26,.04)}
.cp{font-size:9.6px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}
.mu{color:${C.mute}}
.tb{position:absolute;height:19px;padding:0 6px;display:flex;align-items:center;justify-content:center;font-size:8.6px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;border:1px solid ${C.line};background:#fff;color:${C.ink};white-space:nowrap}
.call{position:absolute;white-space:nowrap}
.call b{display:block;font-size:11.5px;font-weight:600;letter-spacing:.1px}
.call span{display:block;font-size:8.6px;font-weight:500;letter-spacing:1.4px;color:${C.mute};text-transform:uppercase;margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.acc};opacity:0;z-index:49}
.mono{font-family:'JetBrains Mono',monospace}
.code{position:absolute;font-family:'JetBrains Mono',monospace;font-size:8.2px;line-height:12.4px;white-space:pre;color:${C.ink}}
.code i{font-style:normal;color:${C.mute}}
.code u{text-decoration:none;color:${C.acc};font-weight:600}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const f2 = (x, d = 1) => nf(x, d);
const fInt = (x) => nf(Math.round(x));

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

  // ------------------------------------------------------------ title and the physical clock
  add(`<div style="position:absolute;left:35px;top:33px;width:43px;height:3px;background:${C.acc}"></div>`);
  add(`<div style="position:absolute;left:35px;top:47px;font-size:24px;font-weight:700;letter-spacing:-.2px">${tr('title')}</div>`);
  add(`<div class="cp" style="position:absolute;left:35px;top:81px;font-weight:500;letter-spacing:1.6px;font-size:9.2px">${tr('subtitle')}</div>`);
  add(`<div class="cp mu" style="position:absolute;left:35px;top:94px;font-weight:500;letter-spacing:1.2px;font-size:7.4px">${tr('model')}</div>`);
  const tauBig = add(`<div style="position:absolute;left:33px;top:103px;font-size:50px;font-weight:800;letter-spacing:-2.6px;color:${C.acc};line-height:1"></div>`);
  const tauUnit = add(`<div style="position:absolute;top:128px;font-size:11px;font-weight:600;letter-spacing:1px">ns</div>`);
  add(`<div class="cp mu" style="position:absolute;left:35px;top:160px;font-weight:500;font-size:8.8px">${tr('physTime')}</div>`);
  const shotBar = add(`<svg style="position:absolute;left:35px;top:174px" width="247" height="28"></svg>`);
  const slowTxt = add(`<div class="cp" style="position:absolute;left:35px;top:208px;font-weight:500;font-size:8.8px"></div>`);
  add(`<div style="position:absolute;left:35px;top:226px;width:247px;height:1px;background:${C.faint}"></div>`);

  // ------------------------------------------------------------ source
  add(`<div class="pn" data-g="charts" style="left:35px;top:240px;width:247px;height:190px"></div>`);
  add(`<div class="cp" data-g="charts" style="position:absolute;left:46px;top:252px;font-weight:700">${tr('srcTitle')}</div>`);
  const srcSvg = add(`<svg data-g="charts" style="position:absolute;left:46px;top:270px" width="226" height="92"></svg>`);
  add(`<div data-g="charts" style="position:absolute;left:46px;top:366px;width:226px;height:1px;background:${C.line}"></div>`);
  add(`<div data-g="charts" style="position:absolute;left:46px;top:372px;font-size:9.5px;line-height:15px;color:${C.mute}">
    ${tr('srcFacts', (v) => `<b style="color:${C.ink}">${v}</b>`)}<br>
    <span style="font-size:8.4px;letter-spacing:.3px">${tr('srcData')}</span></div>`);

  // ------------------------------------------------------------ losses
  add(`<div class="pn" data-g="charts" style="left:35px;top:438px;width:247px;height:226px"></div>`);
  add(`<div class="cp" data-g="charts" style="position:absolute;left:46px;top:450px;font-weight:700">${tr('lossTitle')}</div>`);
  const lossSvg = add(`<svg data-g="charts" style="position:absolute;left:46px;top:468px" width="226" height="132"></svg>`);
  add(`<div data-g="charts" style="position:absolute;left:46px;top:604px;width:226px;height:1px;background:${C.line}"></div>`);
  const rateTxt = add(`<div data-g="charts" style="position:absolute;left:46px;top:610px;font-size:9.5px;line-height:15px;color:${C.mute}"></div>`);

  // ------------------------------------------------------------ transport
  add(`<div class="pn" style="left:35px;top:774px;width:259px;height:111px"></div>`);
  const btn = {};
  btn.pause = add(`<div class="tb" style="left:45px;top:782px;width:99px;height:26px;background:${C.acc};color:#fff;border-color:${C.acc};font-size:9.4px">${tr('pause')}</div>`);
  btn.reseed = add(`<div class="tb" style="left:149px;top:782px;width:136px;height:26px;font-size:9.2px">${tr('reseed')}</div>`);
  add(`<div class="cp" style="position:absolute;left:45px;top:818px;font-weight:500">${tr('slowmo')}</div>`);
  const slowVal = add(`<div class="cp" style="position:absolute;right:${1600 - 284}px;top:818px;font-weight:700"></div>`);
  const SL = {x: 46, w: 238};
  add(`<div style="position:absolute;left:${SL.x}px;top:836px;width:${SL.w}px;height:2px;background:#e1e3e6"></div>`);
  const slowKnob = add(`<div style="position:absolute;top:831px;width:9px;height:11px;margin-left:-4.5px;background:${C.acc}"></div>`);
  add(`<div class="cp" style="position:absolute;left:45px;top:851px;font-weight:500">${tr('perShot')}</div>`);
  const nVal = add(`<div class="cp" style="position:absolute;right:${1600 - 284}px;top:851px;font-weight:700"></div>`);
  add(`<div style="position:absolute;left:${SL.x}px;top:869px;width:${SL.w}px;height:2px;background:#e1e3e6"></div>`);
  const nKnob = add(`<div style="position:absolute;top:864px;width:9px;height:11px;margin-left:-4.5px;background:${C.acc}"></div>`);

  // ------------------------------------------------------------ stage
  add(`<div class="pn" style="left:1318px;top:36px;width:245px;height:196px"></div>`);
  const stShot = add(`<div class="cp" style="position:absolute;left:1329px;top:47px;font-weight:500"></div>`);
  const stMode = add(`<div class="cp mu" style="position:absolute;right:${1600 - 1552}px;top:47px;font-weight:500"></div>`);
  const stBig = add(`<div style="position:absolute;left:1329px;top:61px;font-size:22px;font-weight:700"></div>`);
  const stList = add(`<div style="position:absolute;left:1329px;top:94px"></div>`);
  add(`<div style="position:absolute;left:1329px;top:196px;width:224px;height:1px;background:${C.line}"></div>`);
  add(`<div class="cp" style="position:absolute;left:1329px;top:206px;font-weight:500;font-size:8.8px">${tr('temps', C.acc)}</div>`);

  // ------------------------------------------------------------ coincidences
  add(`<div class="pn" data-g="charts" style="left:1318px;top:240px;width:245px;height:282px"></div>`);
  add(`<div class="cp" data-g="charts" style="position:absolute;left:1329px;top:251px;font-weight:700">${tr('coinTitle')}</div>`);
  const hiN = add(`<div class="cp mu" data-g="charts" style="position:absolute;right:${1600 - 1552}px;top:251px;font-weight:500"></div>`);
  const hiSub = add(`<div class="cp mu" data-g="charts" style="position:absolute;left:1329px;top:266px;font-weight:500;font-size:8.4px"></div>`);
  const hiSvg = add(`<svg data-g="charts" style="position:absolute;left:1326px;top:282px" width="232" height="200"></svg>`);
  add(`<div data-g="charts" style="position:absolute;left:1329px;top:486px;width:224px;height:1px;background:${C.line}"></div>`);
  const hiFoot = add(`<div data-g="charts" style="position:absolute;left:1329px;top:493px;font-size:9.5px;color:${C.mute}"></div>`);

  // ------------------------------------------------------------ Perceval / HOM
  add(`<div class="pn" data-g="charts" style="left:1318px;top:530px;width:245px;height:182px"></div>`);
  const pvTitle = add(`<div class="cp" data-g="charts" style="position:absolute;left:1329px;top:541px;font-weight:700"></div>`);
  const pvSub = add(`<div class="cp mu" data-g="charts" style="position:absolute;right:${1600 - 1552}px;top:541px;font-weight:500"></div>`);
  const pvCode = add(`<div class="code" data-g="charts" style="left:1329px;top:558px"></div>`);
  const pvCanvas = add(`<canvas data-g="charts" width="168" height="168" style="position:absolute;left:1495px;top:646px;width:58px;height:58px;image-rendering:pixelated"></canvas>`);
  const pvSvg = add(`<svg data-g="charts" style="position:absolute;left:1326px;top:556px" width="232" height="152"></svg>`);

  // ------------------------------------------------------------ views, cutaway, layers
  add(`<div class="pn" style="left:1290px;top:720px;width:274px;height:165px"></div>`);
  const group = (title, keys, y, labels) => {
    add(`<div class="cp mu" style="position:absolute;left:1299px;top:${y}px;font-weight:500">${title}</div>`);
    let x = 1299;
    let yy = y + 15;
    keys.forEach((k) => {
      const w = Math.round(labels[k].length * 6.0 + 12);
      if (x + w > 1558) {
        x = 1299;
        yy += 23;
      }
      btn[k] = add(`<div class="tb" style="left:${x}px;top:${yy}px;width:${w}px">${labels[k]}</div>`);
      x += w + 4;
    });
  };
  group(tr('grpView'), CAMS, 727, CAM_LABEL);
  group(tr('grpCut'), CUTS, 794, CUT_LABEL);
  group(tr('grpLayers'), OVERLAYS, 838, OV_LABEL);

  // ------------------------------------------------------------ the photon's path
  add(`<div class="cp mu" style="position:absolute;left:0;right:0;top:793px;text-align:center;font-weight:500">${tr('path')}</div>`);
  const strip = add(`<svg style="position:absolute;left:520px;top:812px" width="560" height="44"></svg>`);
  const stripSpot = (i) => [520 + 40 + i * 96, 812 + 15];
  const footTxt = add(`<div style="position:absolute;left:300px;right:300px;top:857px;text-align:center;font-size:11.5px;font-weight:500;color:${C.ink}"></div>`);
  add(`<div class="cp" style="position:absolute;left:0;right:0;top:876px;text-align:center;font-weight:500;color:${C.faint}">${tr('hint')}</div>`);

  // ------------------------------------------------------------ callouts, the pointer
  const callSvg = add(`<svg data-callouts style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div data-callouts style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    const k = a.width / 1600 || 1;
    return [(r.left - a.left) / k + r.width / k / 2, (r.top - a.top) / k + r.height / k / 2];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const knobX = (v) => SL.x + v * SL.w;
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };

  let heatProg = null;
  const drawHeat = (prog, inputs) => {
    const g = pvCanvas.getContext('2d');
    const N = prog.N;
    const k = 168 / N;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 168, 168);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const v = prog.Ur[r * N + c] ** 2 + prog.Ui[r * N + c] ** 2;
        const a = Math.min(1, Math.sqrt(v) * 1.5);
        g.fillStyle = inputs.includes(c) ? `rgba(107,60,242,${a})` : `rgba(22,24,27,${a * 0.55})`;
        g.fillRect(c * k, r * k, k - 0.4, k - 0.4);
      }
  };

  return {
    spots,
    stripSpot,
    slowKnob: (v) => [knobX(v), 836],
    nKnob: (v) => [knobX(v), 869],
    btn,
    root: ui,
    pointer,
    update(s) {
      const T = s.times;
      // the clock
      tauBig.textContent = f2(Math.max(0, s.ph), s.ph < 10 ? 2 : 1);
      tauUnit.style.left = `${38 + tauBig.getBoundingClientRect().width / (s.scale || 1) + 6}px`;
      {
        const W = 247;
        const X = (t) => 4 + (Math.min(T.SHOT, Math.max(0, t)) / T.SHOT) * (W - 8);
        let h = `<rect x="0" y="9" width="${W}" height="6" fill="#e6e7e9"/>`;
        h += `<rect x="${X(T.tArr)}" y="9" width="${Math.max(2, X(T.tOut + 0.3) - X(T.tArr))}" height="6" fill="${C.faint}"/>`;
        h += `<rect x="0" y="9" width="${X(s.ph).toFixed(1)}" height="6" fill="${C.accSoft}"/>`;
        for (let k = 0; k < s.n; k++) h += `<circle cx="${X(k * P.T)}" cy="12" r="3" fill="${s.ph >= k * P.T ? C.acc : '#fff'}" stroke="${C.acc}" stroke-width="1"/>`;
        h += `<line x1="${X(T.tClick)}" x2="${X(T.tClick)}" y1="5" y2="19" stroke="${C.ink}" stroke-width="1.2"/>`;
        h += `<line x1="${X(s.ph).toFixed(1)}" x2="${X(s.ph).toFixed(1)}" y1="3" y2="21" stroke="${C.acc}" stroke-width="1.6"/>`;
        h += `<text x="${X(0)}" y="28" font-size="6.6" letter-spacing=".8" fill="${C.mute}">${tr('barEmit')}</text><text x="${X(T.tArr) - 2}" y="28" font-size="6.6" letter-spacing=".8" text-anchor="middle" fill="${C.mute}">${tr('barChip')}</text><text x="${X(T.tClick) + 2}" y="28" font-size="6.6" letter-spacing=".8" fill="${C.mute}">${tr('barClick')}</text>`;
        shotBar.innerHTML = h;
      }
      const r = s.rateNs;
      const rTxt = r >= 1 ? `${f2(r, r < 10 ? 1 : 0)} ns` : `${f2(r * 1000, r * 1000 < 10 ? 1 : 0)} ps`;
      slowTxt.innerHTML = tr('onScreen', `<b style="color:${C.acc}">${rTxt}</b>`, (1e9 / Math.max(1e-6, r)).toExponential(0).replace('e+', 'e'));

      // source: pulses, emissions, the cursor; inset of the 92 ps decay
      {
        const W = 226;
        const X = (t) => 6 + (t / Math.max(50, (s.n - 1) * P.T + 12)) * (W - 70);
        let h = `<line x1="4" x2="${W - 64}" y1="62" y2="62" stroke="${C.ink}" stroke-width=".8"/>`;
        for (let k = 0; k < Math.max(5, s.n + 1); k++) {
          const x = X(k * P.T);
          if (x > W - 64) break;
          const used = k < s.n;
          h += `<line x1="${x}" x2="${x}" y1="62" y2="40" stroke="${C.laser}" stroke-width="1.2" opacity="${used ? 0.9 : 0.35}"/>`;
          if (used) {
            const on = s.ph >= k * P.T;
            h += `<circle cx="${x + 5}" cy="30" r="4" fill="${on ? C.acc : '#fff'}" stroke="${C.acc}" stroke-width="1.1"/><text x="${x + 5}" y="18" font-size="6.6" text-anchor="middle" fill="${C.mute}">${k}</text>`;
          }
        }
        const cx = X(Math.min(s.ph, (s.n - 1) * P.T + 10));
        h += `<line x1="${cx}" x2="${cx}" y1="10" y2="66" stroke="${C.acc}" stroke-width="1" opacity=".6"/>`;
        h += `<text x="4" y="78" font-size="6.6" letter-spacing=".8" fill="${C.mute}">${tr('pulses', f2(P.T, 1))}</text><text x="4" y="88" font-size="6.6" letter-spacing=".8" fill="${C.mute}">${tr('onePhoton')}</text>`;
        // inset: one emission, exponential decay over 92 ps
        const ix = W - 56;
        h += `<rect x="${ix - 4}" y="6" width="58" height="60" fill="#fff" stroke="${C.line}"/>`;
        let pth = '';
        for (let i = 0; i <= 40; i++) {
          const tt = (i / 40) * 0.4;
          pth += `${i ? 'L' : 'M'}${(ix + (tt / 0.4) * 48).toFixed(1)} ${(58 - 44 * Math.exp(-tt / P.tauRad)).toFixed(1)}`;
        }
        h += `<path d="${pth}" fill="none" stroke="${C.acc}" stroke-width="1.3"/><text x="${ix}" y="16" font-size="6" fill="${C.mute}">${tr('emission')}</text><text x="${ix + 48}" y="64" font-size="6" text-anchor="end" fill="${C.mute}">${f2(0.4, 1)} ns</text>`;
        srcSvg.innerHTML = h;
      }

      // losses: one bar per stage, cumulative transmission as a line
      {
        const W = 226;
        let h = '';
        let cum = 1;
        P.eta.forEach((e, i) => {
          cum *= e.v;
          const y = 4 + i * 22;
          const lit = s.stage === ['source', 'source', 'demux', 'chip', 'detect'][i] && i !== 1 ? 1 : s.stage === 'source' && i === 1 ? 1 : 0;
          h += `<text x="0" y="${y + 9}" font-size="7.6" fill="${lit ? C.ink : C.mute}" font-weight="${lit ? 600 : 500}">${tr('eta:' + e.key)}${e.src === 'E' ? ' *' : ''}</text>`;
          h += `<rect x="112" y="${y + 1}" width="${(W - 150).toFixed(1)}" height="9" fill="#ececee"/><rect x="112" y="${y + 1}" width="${((W - 150) * e.v).toFixed(1)}" height="9" fill="${lit ? C.acc : C.faint}"/>`;
          h += `<text x="${W}" y="${y + 9}" font-size="7.6" text-anchor="end" font-weight="600" fill="${C.ink}">${Math.round(e.v * 100)} %</text>`;
          h += `<rect x="112" y="${y + 12}" width="${((W - 150) * cum).toFixed(1)}" height="2" fill="${C.ink}" opacity=".55"/>`;
        });
        h += `<text x="0" y="${4 + 5 * 22 + 10}" font-size="8" font-weight="700" fill="${C.ink}">${tr('totalPhoton')}</text><text x="${W}" y="${4 + 5 * 22 + 10}" font-size="9" text-anchor="end" font-weight="700" fill="${C.acc}">${f2(ETA * 100, 1)} %</text>`;
        lossSvg.innerHTML = h;
        rateTxt.innerHTML = `${tr('together', s.n, `<b style="color:${C.ink}">${rateN(s.n) >= 1000 ? fInt(rateN(s.n)) : f2(rateN(s.n), 1)}</b>`)}<br><span style="font-size:8.4px">${tr('checkAscella', f2(rateN(6), 1))}</span>`;
      }

      // stage
      stShot.innerHTML = tr('shot', fInt(s.shot), s.n);
      stMode.innerHTML = s.hom ? `<b style="color:${C.acc}">HOM</b>` : tr('dualRail');
      const sti = STAGES.findIndex((x) => x.key === s.stage);
      stBig.textContent = STAGES[sti].name;
      stBig.style.color = C.ink;
      stList.innerHTML = STAGES.map((x, i) => `<div class="cp" style="height:16.5px;display:flex;align-items:center;gap:10px;font-weight:500;color:${i === sti ? C.ink : C.mute}"><i style="display:block;width:24px;height:2px;background:${i === sti ? C.acc : i < sti ? C.faint : C.line}"></i>${x.name.toUpperCase()}<span style="margin-left:auto;font-size:7.6px;color:${C.mute};letter-spacing:1px">${i === sti ? x.sub : ''}</span></div>`).join('');

      // coincidences: top patterns, theory outline vs measured fill
      {
        const hs = s.hist;
        hiN.innerHTML = `N = <b style="color:${C.ink}">${fInt(hs.N)}</b>`;
        hiSub.innerHTML = hs.hom ? tr('couplerOut', f2(s.homDelta * 1000, 0)) : tr('topPatterns', hs.labels.length, fInt(hs.total));
        const W = 232;
        const rows = hs.labels.length;
        const rh = Math.min(15.5, 196 / rows);
        const max = Math.max(...hs.theory) * 1.15;
        let h = '';
        for (let i = 0; i < rows; i++) {
          const y = i * rh;
          const bw = W - 92;
          const th = hs.theory[i] / max;
          const me = hs.N ? hs.counts[i] / hs.N / max : 0;
          const lit = hs.lastIdx === i;
          h += `<text x="2" y="${y + rh * 0.7}" font-size="7.4" class="mono" fill="${lit ? C.acc : C.ink}" font-weight="${lit ? 700 : 500}">${hs.labels[i]}</text>`;
          h += `<rect x="62" y="${y + 2}" width="${(bw * Math.min(1, me)).toFixed(1)}" height="${rh - 5}" fill="${lit ? C.acc : 'rgba(107,60,242,.55)'}"/>`;
          h += `<rect x="62" y="${y + 2}" width="${(bw * th).toFixed(1)}" height="${rh - 5}" fill="none" stroke="${C.ink}" stroke-width=".8"/>`;
          h += `<text x="${W - 2}" y="${y + rh * 0.7}" font-size="7.2" text-anchor="end" fill="${C.mute}">${f2(hs.theory[i] * 100, 2)} %</text>`;
        }
        hiSvg.innerHTML = h;
        hiFoot.innerHTML = hs.hom
          ? `<span style="color:${C.ink}">▭</span> ${tr('theory')} ½(1 − M·e<sup>−|δ|/τ</sup>) &nbsp;<span style="color:${C.acc}">■</span> ${tr('measured')}`
          : `<span style="color:${C.ink}">▭</span> |Perm(U<sub>S,T</sub>)|² &nbsp;<span style="color:${C.acc}">■</span> ${tr('measured')} &nbsp;· TVD <b style="color:${C.ink}">${f2(hs.tvd * 100, 1)} %</b>`;
      }

      // Perceval or HOM
      if (s.hom) {
        pvTitle.textContent = 'HONG-OU-MANDEL';
        pvSub.innerHTML = `M = <b style="color:${C.ink}">${f2(P.M * 100, 1)} %</b>`;
        pvCode.style.display = 'none';
        pvCanvas.style.display = 'none';
        pvSvg.style.display = '';
        const W = 232;
        const X = (d) => 18 + ((d + 0.5) / 1.0) * (W - 30);
        const Y = (p) => 128 - (p / 0.6) * 112;
        let h = `<line x1="${X(-0.5)}" x2="${X(0.5)}" y1="${Y(0)}" y2="${Y(0)}" stroke="${C.ink}" stroke-width=".8"/><line x1="${X(-0.5)}" x2="${X(-0.5)}" y1="${Y(0.6)}" y2="${Y(0)}" stroke="${C.ink}" stroke-width=".8"/>`;
        h += `<line x1="${X(-0.5)}" x2="${X(0.5)}" y1="${Y(0.5)}" y2="${Y(0.5)}" stroke="${C.line}" stroke-dasharray="3 3"/><text x="${X(0.5)}" y="${Y(0.5) - 3}" font-size="6.2" text-anchor="end" fill="${C.mute}">${tr('distinguishable')}</text>`;
        let pth = '';
        for (let i = 0; i <= 100; i++) {
          const d = -0.5 + i / 100;
          pth += `${i ? 'L' : 'M'}${X(d).toFixed(1)} ${Y(homPc(d)).toFixed(1)}`;
        }
        h += `<path d="${pth}" fill="none" stroke="${C.ink}" stroke-width="1.2"/>`;
        for (const [d, v] of s.homPts) h += `<circle cx="${X(d).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.2" fill="${C.acc}" opacity=".8"/>`;
        h += `<line x1="${X(s.homDelta).toFixed(1)}" x2="${X(s.homDelta).toFixed(1)}" y1="${Y(0.6)}" y2="${Y(0)}" stroke="${C.acc}" stroke-width="1.2"/>`;
        h += `<circle cx="${X(s.homDelta).toFixed(1)}" cy="${Y(homPc(s.homDelta)).toFixed(1)}" r="3.6" fill="${C.acc}"/>`;
        h += `<text x="2" y="10" font-size="6.4" fill="${C.mute}">P(1,1)</text><text x="12" y="${Y(0) + 2}" font-size="6.4" text-anchor="end" fill="${C.mute}">0</text><text x="12" y="${Y(0.5) + 2}" font-size="6.4" text-anchor="end" fill="${C.mute}">${f2(0.5, 1).replace(/^0/, '')}</text>`;
        for (const d of [-0.4, -0.2, 0, 0.2, 0.4]) h += `<text x="${X(d)}" y="${Y(0) + 10}" font-size="6.4" text-anchor="middle" fill="${C.mute}">${Math.round(d * 1000)}</text>`;
        h += `<text x="${X(0.5)}" y="${Y(0) + 20}" font-size="6.2" letter-spacing=".8" text-anchor="end" fill="${C.mute}">${tr('delayAxis')}</text>`;
        h += `<text x="${X(0) + 6}" y="${Y(homPc(0)) - 6}" font-size="6.4" fill="${C.acc}" font-weight="600">${f2(homPc(s.homDelta) * 100, 1)} %</text>`;
        pvSvg.innerHTML = h;
      } else {
        pvTitle.textContent = 'PERCEVAL';
        pvSub.innerHTML = `U → φ → V`;
        pvCode.style.display = '';
        pvCanvas.style.display = '';
        pvSvg.style.display = 'none';
        const inp = Array.from({length: 24}, (_, m) => (s.inputs.includes(m) ? 1 : 0));
        pvCode.innerHTML = `<i>${tr('pvHead')}</i>
<u>import</u> perceval <u>as</u> pcvl
qpu = pcvl.RemoteProcessor(<u>"qpu:belenos"</u>)
qpu.set_circuit(pcvl.Unitary(U))  <i># 24×24</i>
qpu.with_input(pcvl.BasicState(
  [${inp.slice(0, 12).join(',')},
   ${inp.slice(12).join(',')}]))
<i>${tr('pvQubits', s.n)}</i>
<i>${tr('pvCompile')}</i>
<i>${tr('pvTranspile')}</i>
job = Sampler(qpu) \\
  .sample_count(10_000)`;
        if (heatProg !== s.prog) {
          heatProg = s.prog;
          drawHeat(s.prog, s.inputs);
        }
      }

      // toggles
      const tog = (k, on, acc) => {
        btn[k].style.background = on ? (acc ? C.acc : C.ink) : '#fff';
        btn[k].style.color = on ? '#fff' : C.ink;
        btn[k].style.borderColor = on ? (acc ? C.acc : C.ink) : C.line;
      };
      for (const k of CAMS) tog(k, s.cam === k || (k === 'hero' && s.cam === 'tour'));
      for (const k of CUTS) tog(k, s.cut === k);
      for (const k of OVERLAYS) tog(k, !!s.overlays[k], true);
      btn.pause.innerHTML = tr(s.paused ? 'play' : 'pause');
      slowVal.textContent = s.slowText;
      slowKnob.style.left = `${knobX(s.slowK).toFixed(1)}px`;
      nVal.textContent = tr('nPhotons', s.nSel);
      nKnob.style.left = `${knobX((s.nSel - 2) / 3).toFixed(1)}px`;

      // the photon's path strip
      {
        let h = '';
        STAGES.forEach((x, i) => {
          const cx = 40 + i * 96;
          if (i) h += `<line x1="${cx - 84}" x2="${cx - 12}" y1="15" y2="15" stroke="${i <= sti ? C.acc : C.faint}" stroke-width="${i <= sti ? 1.6 : 1}"/>`;
          const on = i === sti;
          h += `<circle cx="${cx}" cy="15" r="${on ? 9 : 7}" fill="${on ? C.acc : i < sti ? C.accSoft : '#fff'}" stroke="${i <= sti ? C.acc : C.faint}" stroke-width="1.3"/>`;
          h += `<text x="${cx}" y="37" font-size="7.4" letter-spacing="1" text-anchor="middle" font-weight="600" fill="${on ? C.ink : C.mute}">${tr('strip:' + x.key)}</text>`;
        });
        strip.innerHTML = h;
      }
      footTxt.innerHTML = s.foot || '';

      // callouts
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = c.w < 0;
        const w = Math.abs(c.w);
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx.toFixed(1)},${(ly + 16).toFixed(1)} ${(lx + (right ? -w : w)).toFixed(1)},${(ly + 16).toFixed(1)}" fill="none" stroke="${C.mute}" stroke-width=".8" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2" fill="${C.ink}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="${right ? `right:${(1600 - lx).toFixed(1)}px;text-align:right` : `left:${lx.toFixed(1)}px`};top:${(ly - 10).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
  };
}
