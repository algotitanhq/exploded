// Pepper's overlay, laid out like a watchmaker's catalogue sheet: titles in Instrument Serif, fine rules, a lot of
// air. Left: the name, the technical sheet, the crank's turn as a timing chart (each column's teeth and its carry on
// the crank angle), the hand controls. Right: the three registers drawn as the real numbered drums (rolling), the
// operation laid out by hand in columns, the subsystem, cut and view buttons. Callouts with thin leaders into the
// machine. Fixed 1600 x 900 CSS layout; update(s) redraws every live part from the frame's state.
import {CURTA, G, addendOf, fromDigits, stationOf, thetaCarry} from './machine.js';
import {ACCENT} from './curta.js';
import {nf, T as tr} from './i18n.js';

export const C = {ink: '#1b1a17', mute: '#8a877f', faint: '#c9c5bb', line: '#d9d5cc', paper: 'rgba(246,244,239,.92)', acc: ACCENT, accSoft: 'rgba(176,122,28,.16)'};
export const SUBS = ['crank', 'sliders', 'drum', 'gears', 'carry', 'carriage', 'reset'];
export const CUTS = ['solid', 'glass', 'section'];
export const VIEWS = ['hero', 'top', 'macro', 'axial'];
export const ACTS = ['turn', 'pull', 'carL', 'carR', 'clear', 'pause'];
const SERIF = `'Instrument Serif',Georgia,serif`;
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.sf{font-family:${SERIF};font-weight:400;letter-spacing:-.005em}
.cp{font-size:10px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;white-space:nowrap}
.mu{color:${C.mute}}
.rule{position:absolute;height:1px;background:${C.line}}
.tb{position:absolute;height:24px;padding:0 8px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;letter-spacing:.5px;border:1px solid ${C.line};border-radius:12px;background:rgba(255,255,255,.55);color:${C.ink};white-space:nowrap}
.call{position:absolute;white-space:nowrap}
.call b{display:block;font-family:${SERIF};font-weight:400;font-size:30px;line-height:1;letter-spacing:-.01em}
.call span{display:block;font-size:10.5px;font-weight:600;letter-spacing:1.5px;color:${C.mute};text-transform:uppercase;margin-top:5px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.acc};opacity:0;z-index:49}
.reg{position:absolute;display:flex;gap:2px}
.dg{position:relative;width:24px;height:36px;overflow:hidden;background:#141414;border-radius:2px;box-shadow:inset 0 6px 6px -4px rgba(0,0,0,.9),inset 0 -6px 6px -4px rgba(0,0,0,.9)}
.dg.cream{background:#ece5d2;box-shadow:inset 0 6px 6px -4px rgba(0,0,0,.35),inset 0 -6px 6px -4px rgba(0,0,0,.35)}
.dg i{position:absolute;left:0;right:0;top:0;display:block;font:600 21px/36px 'JetBrains Mono',monospace;text-align:center;color:#f4f1e8;font-style:normal;white-space:pre}
.dg.cream i{color:#151515}
.dg u{position:absolute;left:3px;right:3px;bottom:-1px;height:3px;background:${C.acc};opacity:0}
.dgx{position:absolute;font-size:9px;font-weight:600;letter-spacing:1px;color:${C.mute};text-align:center;width:24px}
.op{position:absolute;font-family:${SERIF};font-size:27px;line-height:30px;white-space:nowrap}
.op span{display:inline-block;width:19px;text-align:center}
.op .o{width:22px;text-align:left;color:${C.mute}}
.op .lo{color:${C.faint}}
.op .ac{color:${C.acc}}
.op .cy{font-family:Inter,sans-serif;font-size:11px;font-weight:700;color:${C.acc};line-height:12px;height:12px}
.spec{position:absolute;font-size:12.5px;line-height:21px}
.spec div{display:flex;justify-content:space-between;border-bottom:1px solid rgba(217,213,204,.6)}
.spec b{font-weight:600}
.cap{position:absolute;left:376px;right:376px;bottom:30px;text-align:center;font-family:${SERIF};font-size:29px;line-height:1.15;color:${C.ink};text-shadow:0 0 14px #ece9e3,0 0 26px #ece9e3,0 0 4px #ece9e3}
.cap .pill{background:rgba(239,237,232,.88);padding:1px 14px 3px;border-radius:3px;-webkit-box-decoration-break:clone;box-decoration-break:clone;line-height:1.3}
.pane{position:absolute;background:linear-gradient(rgba(240,238,233,.93),rgba(236,234,228,.9));box-shadow:0 0 0 1px rgba(217,213,204,.55)}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const STRIP = '0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0';

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
  const btn = {};
  // the sheet's paper, so the columns stay readable over the black body in the close views
  add(`<div class="pane" style="left:26px;top:14px;width:340px;height:858px"></div>`);
  add(`<div class="pane" style="left:1212px;top:14px;width:362px;height:858px"></div>`);

  // ------------------------------------------------------------ left: name, sheet
  const X = 46;
  const W = 300;
  add(`<div class="sf" style="position:absolute;left:${X - 2}px;top:22px;font-size:68px;line-height:1">${tr('title')}</div>`);
  add(`<div class="cp" style="position:absolute;left:${X}px;top:100px">${tr('subtitle')}</div>`);
  add(`<div style="position:absolute;left:${X}px;top:118px;font-size:10px;color:${C.mute};letter-spacing:.3px">${tr('model')}</div>`);
  add(`<div class="rule" style="left:${X}px;top:142px;width:${W}px"></div>`);
  add(`<div class="sf" style="position:absolute;left:${X}px;top:152px;font-size:25px">${tr('sheet')}</div>`);
  const row = (k, v) => `<div><span class="mu">${k}</span><b>${v}</b></div>`;
  add(`<div class="spec" style="left:${X}px;top:188px;width:${W}px">
    ${row(tr('specReg'), `${CURTA.sliders} · ${CURTA.counter} · ${CURTA.result}`)}
    ${row(tr('specDia'), `${nf(CURTA.diameter)} mm`)}
    ${row(tr('specH'), tr('specHv', nf(CURTA.height), nf(CURTA.heightCrank)))}
    ${row(tr('specMass'), `${nf(CURTA.mass)} g`)}
    ${row(tr('specMade'), tr('specMadev', nf(CURTA.made), CURTA.years[0], CURTA.years[1]))}
    ${row(tr('specII'), `${CURTA.typeII.sliders} · ${CURTA.typeII.counter} · ${CURTA.typeII.result}`)}
  </div>`);
  add(`<div class="rule" style="left:${X}px;top:330px;width:${W}px"></div>`);

  // ------------------------------------------------------------ left: the turn as a timing chart
  add(`<div class="sf" style="position:absolute;left:${X}px;top:340px;font-size:25px">${tr('turnTitle')}</div>`);
  const thBig = add(`<div class="sf" style="position:absolute;right:${1600 - X - W}px;top:336px;font-size:32px;color:${C.acc}"></div>`);
  const thSub = add(`<div class="cp" style="position:absolute;left:${X}px;top:374px;font-weight:500"></div>`);
  const chart = add(`<svg style="position:absolute;left:${X}px;top:394px" width="${W}" height="250"></svg>`);
  add(`<div style="position:absolute;left:${X}px;top:648px;font-size:10.5px;color:${C.mute};line-height:15px;width:${W}px">${tr('chartLegend', C.acc)}</div>`);

  // ------------------------------------------------------------ left: the hand (live controls)
  add(`<div class="rule" style="left:${X}px;top:708px;width:${W}px"></div>`);
  add(`<div class="cp mu" style="position:absolute;left:${X}px;top:720px;font-weight:500">${tr('grpHand')}</div>`);
  {
    let x = X;
    let y = 740;
    for (const k of ACTS) {
      const w = Math.round(tr('act:' + k).length * 6.6 + 22);
      if (x + w > X + W) {
        x = X;
        y += 30;
      }
      btn[k] = add(`<div class="tb" style="left:${x}px;top:${y}px;width:${w}px">${tr('act:' + k)}</div>`);
      x += w + 6;
    }
  }
  const handNote = add(`<div style="position:absolute;left:${X}px;top:808px;width:${W}px;font-size:10.5px;line-height:15px;color:${C.mute}"></div>`);

  // ------------------------------------------------------------ right: registers as drums
  const RX = 1258;
  const RW = 300;
  const regs = {};
  const reg = (key, n, y, cream, title) => {
    add(`<div class="sf" style="position:absolute;left:${RX}px;top:${y}px;font-size:23px">${title}</div>`);
    const side = add(`<div class="cp mu" style="position:absolute;right:${1600 - RX - RW}px;top:${y + 8}px;font-weight:500"></div>`);
    const box = add(`<div class="reg" style="left:${RX + RW - n * 26 + 2}px;top:${y + 32}px"></div>`);
    const cells = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = el(`<div class="dg${cream ? ' cream' : ''}"><i>${STRIP}</i><u></u></div>`);
      box.appendChild(d);
      cells[i] = d;
    }
    regs[key] = {cells, side, box, n};
  };
  reg('result', CURTA.result, 22, false, tr('regResult'));
  reg('ctr', CURTA.counter, 104, true, tr('regCtr'));
  reg('set', CURTA.sliders, 186, false, tr('regSet'));
  // column numbers under the result
  for (let i = 0; i < CURTA.result; i++) add(`<div class="dgx" style="left:${RX + RW - (i + 1) * 26 + 2}px;top:94px">${i + 1}</div>`);
  add(`<div class="rule" style="left:${RX}px;top:266px;width:${RW}px"></div>`);

  // ------------------------------------------------------------ right: the operation by hand
  add(`<div class="sf" style="position:absolute;left:${RX}px;top:276px;font-size:25px">${tr('opTitle')}</div>`);
  const opSide = add(`<div class="cp mu" style="position:absolute;left:${RX}px;top:310px;font-weight:500"></div>`);
  const op = add(`<div class="op" style="left:${RX + RW - 11 * 19 - 22}px;top:322px"></div>`);
  const opNote = add(`<div style="position:absolute;left:${RX}px;top:452px;width:${RW}px;font-size:11px;line-height:16px;color:${C.mute}"></div>`);
  add(`<div class="rule" style="left:${RX}px;top:510px;width:${RW}px"></div>`);
  const hist = add(`<div style="position:absolute;left:${RX}px;top:520px;width:${RW}px;font-size:12.5px;line-height:21px"></div>`);

  // ------------------------------------------------------------ right: buttons
  // laid out from the bottom up, so a longer language takes more rows and still ends above the footer
  const groups = [[tr('grpSub'), SUBS, 'sub:'], [tr('grpCut'), [...CUTS, 'explode'], 'cut:'], [tr('grpView'), VIEWS, 'view:']];
  const BX = RX - 30;
  const laid = groups.map(([title, keys, pre]) => {
    let x = BX;
    let row = 0;
    const items = keys.map((k) => {
      const w = Math.round(tr(pre + k).length * 6.1 + 18);
      if (x + w > RX + RW) {
        x = BX;
        row++;
      }
      const it = {k, x, row, w, label: tr(pre + k)};
      x += w + 5;
      return it;
    });
    return {title, items, rows: row + 1};
  });
  const height = laid.reduce((a, g) => a + 15 + g.rows * 27 + 6, 0);
  let gy = 870 - height;
  add(`<div class="rule" style="left:${BX}px;top:${gy - 10}px;width:${RW + 30}px"></div>`);
  for (const g of laid) {
    add(`<div class="cp mu" style="position:absolute;left:${BX}px;top:${gy}px;font-weight:500">${g.title}</div>`);
    for (const it of g.items) btn[it.k] = add(`<div class="tb" style="left:${it.x}px;top:${gy + 15 + it.row * 27}px;width:${it.w}px">${it.label}</div>`);
    gy += 15 + g.rows * 27 + 6;
  }

  // ------------------------------------------------------------ caption, callouts, pointer
  const cap = add(`<div class="cap"></div>`);
  add(`<div class="cp" style="position:absolute;left:0;right:0;top:880px;text-align:center;font-weight:500;color:${C.faint}">${tr('hint')}</div>`);
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => [parseFloat(n.style.left) + parseFloat(n.style.width) / 2, parseFloat(n.style.top) + 12];
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const setSpots = Object.fromEntries(Array.from({length: CURTA.sliders}, (_, i) => [i, [RX + RW - (i + 1) * 26 + 14, 186 + 32 + 18]]));
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const roll = (r, vals, active = -1) => {
    for (let i = 0; i < r.n; i++) {
      const v = (((vals[i] % 10) + 10) % 10);
      r.cells[i].firstChild.style.transform = `translateY(${(-v * 36).toFixed(2)}px)`;
      r.cells[i].lastChild.style.opacity = i === active ? '1' : '0';
    }
  };
  let lastEv = null;

  // the turn's chart: θ across, one row per result column (1 at the bottom); teeth as brass ticks, carries as dots
  const drawChart = (ev, th, p) => {
    const Wc = W;
    const x0 = 26;
    const x1 = Wc - 6;
    const xa = (a) => x0 + (a / 360) * (x1 - x0);
    const rh = 19;
    const yRow = (j) => 8 + (CURTA.result - j) * rh + rh / 2;
    let h = '';
    for (const a of [0, 90, 180, 270, 360]) h += `<line x1="${xa(a)}" x2="${xa(a)}" y1="2" y2="${yRow(1) + 12}" stroke="${C.line}" stroke-width="${a % 180 ? 0.6 : 1}"/><text x="${xa(a)}" y="${yRow(1) + 24}" font-size="9" text-anchor="middle" fill="${C.mute}">${a}°</text>`;
    for (let j = 1; j <= CURTA.result; j++) {
      const y = yRow(j);
      h += `<text x="${x0 - 8}" y="${y + 3.5}" font-size="9.5" text-anchor="end" fill="${C.mute}" font-weight="600">${j}</text>`;
      h += `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${C.line}" stroke-width=".5" stroke-dasharray="1 3"/>`;
    }
    if (ev) {
      for (const c of ev.cols) {
        const y = yRow(c.col);
        for (const a of c.teeth) {
          const on = th !== null && th >= a;
          h += `<rect x="${xa(a).toFixed(1)}" y="${y - 5}" width="${(xa(a + G.toothDur) - xa(a)).toFixed(1)}" height="10" fill="${on ? '#8d7a52' : '#cfc6b1'}"/>`;
        }
      }
      // carries: from the wrap of a column to the carry tooth reaching the next, then the dot
      for (const cy of ev.carries) {
        const y = yRow(cy.col);
        const a = cy.at;
        const fired = th !== null && th >= a;
        const xw = xa(cy.from);
        h += `<path d="M${xw.toFixed(1)} ${(y + rh - 4).toFixed(1)} C ${(xw + 10).toFixed(1)} ${(y + rh - 4).toFixed(1)}, ${(xa(a) - 8).toFixed(1)} ${(y + 8).toFixed(1)}, ${xa(a).toFixed(1)} ${(y + 3).toFixed(1)}" fill="none" stroke="${fired ? C.acc : C.faint}" stroke-width="1"/>`;
        h += `<circle cx="${xa(a + 3).toFixed(1)}" cy="${y}" r="${fired ? 5 : 4}" fill="${fired ? C.acc : '#fff'}" stroke="${C.acc}" stroke-width="1.2"/>`;
      }
      if (ev.overflow) {
        const a = ev.overflow.at;
        const fired = th !== null && th >= a + 4;
        h += `<path d="M${xa(a).toFixed(1)} ${yRow(CURTA.result) - 4} L ${xa(a + 12).toFixed(1)} ${yRow(CURTA.result) - 10}" stroke="${fired ? C.acc : C.faint}" stroke-width="1"/><text x="${x1}" y="5" font-size="8.5" letter-spacing=".8" text-anchor="end" fill="${fired ? C.acc : C.mute}" font-weight="600">${tr("overflow")}</text>`;
      }
      // the counter's tooth
      const yc = yRow(1) + 12;
      h += `<rect x="${xa(G.counterAt)}" y="${yc - 3}" width="${xa(G.counterAt + G.counterDur) - xa(G.counterAt)}" height="3" fill="${th !== null && th >= G.counterAt ? C.ink : C.faint}"/>`;
    }
    // columns below the carriage's position are parked
    for (let j = 1; j < p; j++) h += `<rect x="${x0}" y="${yRow(j) - 7}" width="${x1 - x0}" height="14" fill="rgba(233,231,226,.75)"/>`;
    if (th !== null) h += `<line x1="${xa(th).toFixed(1)}" x2="${xa(th).toFixed(1)}" y1="0" y2="${yRow(1) + 13}" stroke="${C.acc}" stroke-width="1.6"/>`;
    chart.innerHTML = h;
  };

  // the operation by hand: during a turn, the register, the addend (or its complement), the carries and the sum;
  // between turns, the running total
  const opLine = (sym, digits, cls = (i) => '', lead = true) => {
    let h = `<div><span class="o">${sym}</span>`;
    let started = !lead;
    for (let i = CURTA.result - 1; i >= 0; i--) {
      const d = digits[i];
      if (d === null || d === undefined) {
        h += `<span></span>`;
        continue;
      }
      if (d !== 0 || i === 0) started = true;
      h += `<span class="${started ? cls(i) : 'lo'}">${started || !lead ? d : '0'}</span>`;
    }
    return h + '</div>';
  };
  const fmt = (v) => nf(v).replace(/^-/, "−");

  return {
    spots,
    setSpots,
    btn,
    root: ui,
    pointer,
    update(s) {
      const S = s.S;
      const turn = S.turn;
      if (turn) lastEv = turn.ev;
      const ev = turn ? turn.ev : s.nextEv || lastEv;
      // the turn
      const th = turn ? turn.th : null;
      thBig.textContent = turn ? `θ ${Math.round(th)}°` : '';
      thSub.innerHTML = turn
        ? `<span style="color:${turn.sign < 0 ? C.acc : C.ink}">${tr(turn.sign < 0 ? 'modeSub' : 'modeAdd')}</span> <span class="mu">&nbsp;·&nbsp; ${tr('turnOf', turn.n + 1, turn.of)} &nbsp;·&nbsp; ${tr('posN', S.p)}</span>`
        : `<span class="mu">${tr(S.up > 0.5 ? 'crankUp' : 'crankDown')} &nbsp;·&nbsp; ${tr('posN', S.p)}</span>`;
      drawChart(ev, th, turn ? turn.ev.p : S.p);

      // registers
      const actCol = turn && S.active?.carry ? S.active.carry.col : turn && S.active?.tooth ? S.active.tooth.col : -1;
      roll(regs.result, S.regPos, actCol - 1);
      roll(regs.ctr, S.ctrPos, S.p - 1);
      roll(regs.set, S.setPos, -1);
      regs.result.side.textContent = nf(fromDigits(S.reg));
      regs.ctr.side.innerHTML = `${tr('posN', S.p)} &nbsp;·&nbsp; ${nf(fromDigits(S.ctr))}`;
      regs.set.side.textContent = nf(fromDigits(S.set));
      // the carriage's offset under the result, shown by sliding the counter and setting rows
      const off = (S.carPos - 1) * 26;
      regs.set.box.style.transform = `translateX(${(-off).toFixed(1)}px)`;

      // the operation
      if (turn) {
        const e = turn.ev;
        const add = addendOf(e.set, e.p, e.sign);
        const carried = new Array(CURTA.result).fill(null);
        for (const c of e.carries) if (th >= c.at) carried[c.col - 1] = 1;
        const now = S.reg;
        let h = `<div class="cy"><span class="o"></span>${Array.from({length: CURTA.result}, (_, q) => `<span>${carried[CURTA.result - 1 - q] ? '1' : ''}</span>`).join('')}</div>`;
        h += opLine('', e.reg0, () => '');
        h += opLine(e.sign < 0 ? '+' : '+', add.map((x) => (x === null ? null : x % 10)), (i) => (add[i] === 10 ? 'ac' : i + 1 === actCol ? 'ac' : ''), e.sign > 0);
        h += `<div style="height:1px;background:${C.ink};margin:3px 0 3px 22px;width:${11 * 19}px"></div>`;
        h += opLine('', now, (i) => (i + 1 === actCol ? 'ac' : ''));
        op.innerHTML = h;
        opSide.textContent = e.sign < 0 ? tr('opSubSide') : tr('opAddSide', e.p);
        opNote.innerHTML = e.sign < 0 ? tr('compNote', fmt(fromDigits(e.set) * 10 ** (e.p - 1)), C.acc) : tr('addNote', fmt(fromDigits(e.set)), e.p, fmt(fromDigits(e.set) * 10 ** (e.p - 1)));
      } else {
        let h = `<div class="cy"></div>`;
        h += opLine('', S.reg, () => '');
        op.innerHTML = h;
        opSide.textContent = '';
        opNote.innerHTML = S.up > 0.5 ? tr('upNote', C.acc) : '';
      }
      // the running operation, by hand: 1 234 × 6, + 1 234 × 50, − 1 234 × 10
      {
        const H = S.hist.length ? S.hist : s.lastHist || [];
        let h = '';
        let mul = 0;
        H.slice(-4).forEach((x, i) => {
          const m = x.n * 10 ** (x.p - 1);
          h += `<div style="display:flex;justify-content:space-between"><span><span class="mu" style="display:inline-block;width:14px">${i || x.sign < 0 ? (x.sign < 0 ? '−' : '+') : ''}</span>${fmt(x.set)} × ${fmt(m)}</span><span class="mu">${tr('histTurns', x.n, x.p)}</span></div>`;
        });
        for (const x of H) mul += x.sign * x.n * 10 ** (x.p - 1);
        const set = H.length ? H[H.length - 1].set : 0;
        const total = H.reduce((a, x) => a + x.sign * x.n * x.set * 10 ** (x.p - 1), 0);
        if (H.length) h += `<div style="display:flex;justify-content:space-between;border-top:1px solid ${C.ink};margin-top:3px;padding-top:2px"><b>= ${H.every((x) => x.set === set) ? `${fmt(set)} × ${fmt(mul)}` : ''}</b><b class="sf" style="font-size:22px;color:${C.acc}">${fmt(total)}</b></div>`;
        hist.innerHTML = h;
      }

      // toggles
      const tog = (k, on) => {
        if (!btn[k]) return;
        btn[k].style.background = on ? C.ink : 'rgba(255,255,255,.55)';
        btn[k].style.color = on ? '#f6f4ef' : C.ink;
        btn[k].style.borderColor = on ? C.ink : C.line;
      };
      for (const k of SUBS) tog(k, s.sub === k);
      for (const k of CUTS) tog(k, s.cut === k);
      tog('explode', s.explode > 0.5);
      for (const k of VIEWS) tog(k, s.view === k);
      tog('pull', S.up > 0.5);
      tog('pause', !!s.paused);
      if (btn.pause) btn.pause.textContent = tr(s.paused ? 'act:play' : 'act:pause');
      handNote.innerHTML = s.handNote || '';
      cap.innerHTML = s.caption ? `<span class="pill">${s.caption}</span>` : '';

      // callouts
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = c.w < 0;
        const w = Math.abs(c.w);
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx.toFixed(1)},${(ly + 54).toFixed(1)} ${(lx + (right ? -w : w)).toFixed(1)},${(ly + 54).toFixed(1)}" fill="none" stroke="${c.acc ? C.acc : C.mute}" stroke-width=".9" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" fill="${c.acc ? C.acc : C.ink}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="${right ? `right:${(1600 - lx).toFixed(1)}px;text-align:right` : `left:${lx.toFixed(1)}px`};top:${(ly - 4).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
  };
}
export {stationOf, thetaCarry};
