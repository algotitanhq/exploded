// Rope's geometry, built from code, in metres: the AGC Block II (two magnesium trays bolted face to face, 61 x 32 x
// 17 cm [W]) and the LM DSKY (20 x 20 x 18 cm [D]), after the photographs in REFERENCES.md. Tray A (bottom) holds the
// 24 logic and 7 interface modules standing on edge [S]; tray B holds the memory electronics B7-B17, the erasable
// module B12 (black), the X-ribbed plate, and the bay of the 6 rope modules B1-B6 that slide in from the end [S].
// The layout inside tray B is simplified [E]. update(fx) poses everything from the frame's state.
import * as THREE from 'three';
import {AGC, LAMPS, ROPE_WORDS, bits16, ropePlace, wordAt} from './machine.js';
import {drawDigits} from './seg7.js';

const V3 = THREE.Vector3;
export const ACCENT = '#35c26a'; // the DSKY's electroluminescent green
export const ACCENT_INK = '#1f8a4c'; // the same on paper
export const AMBER = '#f0a828';
const COL = {
  mag: '#a39976', // anodised magnesium, dull gold
  magDark: '#7f7a62',
  magGreen: '#8b8f78', // grey-green
  strip: '#d2cbb7', // potted modules, cream grey
  stripEdge: '#b9b19b',
  black: '#24221f',
  ferrite: '#1c1a18',
  copper: '#b5713f',
  gold: '#c09a4a',
  ink: '#2b2925',
  dsky: '#8f9194',
  key: '#2a2b2d',
  pcb: '#5f6b55',
};
export const L = {
  x0: -0.17, // the AGC's centre
  len: 0.61,
  wid: 0.32,
  trayH: 0.085,
  dsky: new V3(0.5, 0, 0.04),
  dskyYaw: 0.3,
  dskyS: 0.203,
  dskyD: 0.178,
  openZ: -0.37, // tray B beside tray A when apart
  liftY: 0.24,
};
const M0 = new THREE.Matrix4();
const smooth = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};
const mix = (a, b, k) => a + (b - a) * k;

function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({color, roughness: 0.62, metalness: 0.15, envMapIntensity: 0.5, ...o});
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const font = (w, px) => `${w} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;
function labelTex(text, {w = 512, h = 64, px = 40, color = '#2b2925', bg = null, weight = 600, align = 'center', spacing = 3} = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = color;
  g.font = font(weight, px);
  g.textBaseline = 'middle';
  g.textAlign = align;
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  g.fillText(text, align === 'center' ? w / 2 : 12, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------ a magnesium tray: plate, walls, pockets, flange, bolts
function tray({len, wid, h, mat, dark, holes}) {
  const g = new THREE.Group();
  const t = 0.006;
  const shell = [];
  const add = (m) => {
    g.add(m);
    shell.push(m);
    return m;
  };
  add(box(len, t, wid, mat, 0, t / 2, 0));
  add(box(len, h, t, mat, 0, h / 2, wid / 2 - t / 2));
  add(box(len, h, t, mat, 0, h / 2, -wid / 2 + t / 2));
  add(box(t, h, wid - 2 * t, mat, len / 2 - t / 2, h / 2, 0));
  add(box(t, h, wid - 2 * t, mat, -len / 2 + t / 2, h / 2, 0));
  // the flange round the open side
  const fl = 0.012;
  add(box(len, 0.004, fl, mat, 0, h - 0.002, wid / 2 - fl / 2));
  add(box(len, 0.004, fl, mat, 0, h - 0.002, -wid / 2 + fl / 2));
  add(box(fl, 0.004, wid, mat, len / 2 - fl / 2, h - 0.002, 0));
  add(box(fl, 0.004, wid, mat, -len / 2 + fl / 2, h - 0.002, 0));
  // pockets milled into the long walls (the photos' rectangular recesses), and a rib between them
  const pk = std(dark);
  pk.polygonOffset = true;
  pk.polygonOffsetFactor = -2;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const pw = len / n - 0.018;
    const px = -len / 2 + (i + 0.5) * (len / n);
    for (const s of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, h * 0.62), pk);
      p.position.set(px, h * 0.45, s * (wid / 2 + 0.0002));
      if (s < 0) p.rotation.y = Math.PI;
      p.receiveShadow = true;
      g.add(p);
      shell.push(p);
    }
  }
  // bolt holes on the flange
  if (holes) {
    const hg = new THREE.CylinderGeometry(0.0022, 0.0022, 0.0006, 10);
    const hm = new THREE.MeshBasicMaterial({color: '#3b362c'});
    const pts = [];
    for (let i = 0; i <= 22; i++) for (const s of [1, -1]) pts.push([-len / 2 + 0.012 + (i * (len - 0.024)) / 22, s * (wid / 2 - 0.006)]);
    for (let i = 1; i < 10; i++) for (const s of [1, -1]) pts.push([s * (len / 2 - 0.006), -wid / 2 + (i * wid) / 10]);
    const im = new THREE.InstancedMesh(hg, hm, pts.length);
    const M = new THREE.Matrix4();
    pts.forEach(([x, z], i) => im.setMatrixAt(i, M.makeTranslation(x, h + 0.0003, z)));
    g.add(im);
    shell.push(im);
  }
  return {g, shell};
}

// ------------------------------------------------------------ a rope module: frame, 512 cores, copper weave, cover
export const ROPE = {len: 0.16, wid: 0.092, th: 0.028, cols: 32, rows: 8, layers: 2, px: 0.0036, pz: 0.0098, rCore: 0.00315, rHole: 0.0019, thick: 0.0024};
const coreX = (c) => (c - (ROPE.cols - 1) / 2) * ROPE.px;
const coreZ = (r) => (r - (ROPE.rows - 1) / 2) * ROPE.pz;
const coreY = (l) => 0.0095 + l * 0.0098;
function ropeModule(i, mats) {
  const g = new THREE.Group();
  const frame = std(COL.black, {roughness: 0.7});
  g.add(box(ROPE.len, 0.003, ROPE.wid, frame, 0, 0.0015, 0));
  for (const s of [1, -1]) g.add(box(ROPE.len, ROPE.th, 0.004, frame, 0, ROPE.th / 2, s * (ROPE.wid / 2 - 0.002)));
  g.add(box(0.006, ROPE.th, ROPE.wid, frame, -ROPE.len / 2 + 0.003, ROPE.th / 2, 0));
  // the connector end, gold pins
  const conn = box(0.01, ROPE.th * 0.8, ROPE.wid * 0.86, std(COL.black), ROPE.len / 2 - 0.005, ROPE.th * 0.42, 0);
  g.add(conn);
  const pinG = new THREE.CylinderGeometry(0.0005, 0.0005, 0.006, 6);
  pinG.rotateZ(Math.PI / 2);
  const pins = new THREE.InstancedMesh(pinG, mats.gold, 48);
  const M = new THREE.Matrix4();
  for (let k = 0; k < 48; k++) pins.setMatrixAt(k, M.makeTranslation(ROPE.len / 2 + 0.002, 0.008 + (k % 2) * 0.008, -ROPE.wid * 0.4 + Math.floor(k / 2) * (ROPE.wid * 0.8) / 23));
  g.add(pins);
  // cordwood rows of resistors and diodes along both long edges (the photo's white combs)
  const cw = new THREE.CylinderGeometry(0.0007, 0.0007, 0.009, 6);
  const cwm = new THREE.InstancedMesh(cw, std('#e9e3d2', {roughness: 0.8}), 2 * 70);
  for (let k = 0; k < 140; k++) {
    const s = k < 70 ? 1 : -1;
    const x = -0.068 + ((k % 70) * 0.136) / 69;
    cwm.setMatrixAt(k, M.makeTranslation(x, 0.012, s * 0.036));
  }
  g.add(cwm);
  // the cores: 2 layers of 8 rows of 32, axis along the module (the wires run along it)
  const cg = new THREE.TorusGeometry((ROPE.rCore + ROPE.rHole) / 2, (ROPE.rCore - ROPE.rHole) / 2, 6, 14);
  cg.rotateY(Math.PI / 2);
  cg.scale(ROPE.thick / (ROPE.rCore - ROPE.rHole), 1, 1);
  const cores = new THREE.InstancedMesh(cg, mats.ferrite, ROPE.cols * ROPE.rows * ROPE.layers);
  let k = 0;
  for (let l = 0; l < ROPE.layers; l++) for (let r = 0; r < ROPE.rows; r++) for (let c = 0; c < ROPE.cols; c++) cores.setMatrixAt(k++, M.makeTranslation(coreX(c), coreY(l), coreZ(r)));
  cores.castShadow = true;
  g.add(cores);
  // the 192 lines of each row: a bundle through the cores and a looser one round them
  const wl = ROPE.cols * ROPE.px + 0.01;
  const thr = new THREE.CylinderGeometry(0.0014, 0.0014, wl, 8, 1, true);
  thr.rotateZ(Math.PI / 2);
  const aro = new THREE.CylinderGeometry(0.0039, 0.0039, wl, 14, 1, true);
  aro.rotateZ(Math.PI / 2);
  const bundles = new THREE.InstancedMesh(thr, mats.copper, ROPE.rows * ROPE.layers);
  const sheath = new THREE.InstancedMesh(aro, mats.copperSheath, ROPE.rows * ROPE.layers);
  k = 0;
  for (let l = 0; l < ROPE.layers; l++)
    for (let r = 0; r < ROPE.rows; r++) {
      bundles.setMatrixAt(k, M.makeTranslation(0, coreY(l), coreZ(r)));
      sheath.setMatrixAt(k++, M.makeTranslation(0, coreY(l), coreZ(r)));
    }
  g.add(bundles, sheath);
  // the cover and its label
  const cover = new THREE.Group();
  const cm = std(COL.magGreen, {roughness: 0.55});
  cover.add(box(ROPE.len - 0.004, 0.0022, ROPE.wid - 0.002, cm, 0, 0, 0));
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.014), new THREE.MeshStandardMaterial({map: labelTex(`FIXED MEMORY MODULE B${i + 1}`, {px: 34, color: '#3b3a33'}), transparent: true, roughness: 0.8}));
  lab.rotation.x = -Math.PI / 2;
  lab.position.set(-0.01, 0.00115, 0);
  cover.add(lab);
  cover.position.y = ROPE.th + 0.0011;
  g.add(cover);
  return {g, cover, cores, conn, bundles, sheath};
}

// ------------------------------------------------------------ the detailed row inside module B1: 9 cores, 16 sense lines
const DET_N = 9;
function ropeDetail(mats) {
  const g = new THREE.Group();
  const sel = ROPE_WORDS.find((w) => w.op === 'CAF NO.CORES');
  const P = ropePlace(sel.bank, sel.addr);
  const row = Math.floor(P.core / ROPE.cols);
  const layer = Math.floor(row / ROPE.rows);
  const r = row % ROPE.rows;
  const c0 = (P.core % ROPE.cols) - (DET_N - 1) / 2;
  const y = coreY(layer);
  const z = coreZ(r);
  // the words held on this strand by the 9 cores: consecutive addresses [L]
  const words = [];
  for (let k = 0; k < DET_N; k++) {
    const addr = sel.addr + (k - (DET_N - 1) / 2);
    const w = wordAt(1, addr);
    words.push({addr, word: w, bits: w === null ? null : bits16(w)});
  }
  const cg = new THREE.TorusGeometry((ROPE.rCore + ROPE.rHole) / 2, (ROPE.rCore - ROPE.rHole) / 2, 18, 40);
  cg.rotateY(Math.PI / 2);
  cg.scale(ROPE.thick / (ROPE.rCore - ROPE.rHole), 1, 1);
  const cores = [];
  for (let k = 0; k < DET_N; k++) {
    const m = new THREE.Mesh(cg, mats.coreSel.clone());
    m.position.set(coreX(c0 + k), y, z);
    m.castShadow = true;
    g.add(m);
    cores.push(m);
  }
  // a sense line: through the hole of a core (a 1) or over it (a 0); 16 lines, the bits of this strand
  const xs = (k) => coreX(c0 + k);
  const throughAt = (j) => [(-1.5 + (j % 4)) * 0.00042, (-1.5 + Math.floor(j / 4)) * 0.00042];
  const aroundAt = (j) => {
    const a = Math.PI * (0.12 + (0.76 * j) / 15);
    const R = 0.0046 + (j % 2) * 0.0005;
    return [Math.cos(a) * R, Math.sin(a) * R];
  };
  const wires = [];
  const tubeR = 0.00012;
  for (let j = 0; j < 16; j++) {
    const pts = [];
    const x0 = xs(0) - ROPE.px * 0.9;
    const x1 = xs(DET_N - 1) + ROPE.px * 0.9;
    const P0 = (k) => (words[k].bits && words[k].bits[j] ? throughAt(j) : aroundAt(j));
    const first = P0(0);
    pts.push(new V3(x0 - 0.004, y + first[1] * 0.5 + 0.0006, z + first[0]));
    for (let k = 0; k < DET_N; k++) {
      const [dz, dy] = P0(k);
      pts.push(new V3(xs(k) - ROPE.thick * 0.75, y + dy, z + dz));
      pts.push(new V3(xs(k) + ROPE.thick * 0.75, y + dy, z + dz));
    }
    const last = P0(DET_N - 1);
    pts.push(new V3(x1 + 0.004, y + last[1] * 0.5 + 0.0006, z + last[0]));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 220, tubeR, 6), mats.wire.clone());
    g.add(m);
    wires.push(m);
  }
  // the other 176 lines (11 other strands): faint bundles through and round
  const wl = (DET_N + 1.8) * ROPE.px;
  const others = new THREE.Mesh(new THREE.CylinderGeometry(0.00125, 0.00125, wl, 16, 1, true).rotateZ(Math.PI / 2), mats.copperDim);
  others.position.set((xs(0) + xs(DET_N - 1)) / 2, y - 0.0003, z);
  g.add(others);
  // inhibit lines (the address decode) below, and the set / reset line
  const inhib = [];
  for (let q = 0; q < 4; q++) {
    const pts = [];
    for (let k = 0; k < DET_N; k++) {
      const thru = ((k + q) % 3 !== 0) !== (k === (DET_N - 1) / 2) || (k === (DET_N - 1) / 2 && false);
      const on = k === (DET_N - 1) / 2 ? true : thru;
      const dy = on ? -0.0011 - q * 0.00022 : -0.0047 - q * 0.0004;
      pts.push(new V3(xs(k) - ROPE.thick * 0.7, y + dy, z + (q - 1.5) * 0.0005));
      pts.push(new V3(xs(k) + ROPE.thick * 0.7, y + dy, z + (q - 1.5) * 0.0005));
    }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 160, 0.00013, 5), mats.inhibit.clone());
    g.add(m);
    inhib.push(m);
  }
  const setPts = [new V3(xs(0) - 0.005, y + 0.0012, z - 0.0011), new V3(xs(DET_N - 1) + 0.005, y + 0.0012, z - 0.0011)];
  const setLine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(setPts), 4, 0.00017, 6), mats.inhibit.clone());
  g.add(setLine);
  return {g, cores, wires, inhib, setLine, words, sel, place: P, layer, row: r, c0, anchor: new V3(xs((DET_N - 1) / 2), y, z)};
}

// ------------------------------------------------------------ the erasable plane inside B12
export const ERAS = {cols: 34, rows: 11, px: 0.0029, py: 0.0029, sel: [17, 5]};
function erasPlane(mats) {
  const g = new THREE.Group();
  const cg = new THREE.TorusGeometry(0.00072, 0.00026, 8, 18);
  const cores = new THREE.InstancedMesh(cg, mats.ferrite, ERAS.cols * ERAS.rows);
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, Math.PI / 4));
  const S = new V3(1, 1, 1);
  const P = new V3();
  const pos = (c, r) => P.set((c - (ERAS.cols - 1) / 2) * ERAS.px, (r - (ERAS.rows - 1) / 2) * ERAS.py, 0);
  let k = 0;
  for (let r = 0; r < ERAS.rows; r++) for (let c = 0; c < ERAS.cols; c++) cores.setMatrixAt(k++, M.compose(pos(c, r), Q, S));
  g.add(cores);
  // X lines (rows), Y lines (columns), the sense line zig-zag, the inhibit line
  const W = ERAS.cols * ERAS.px;
  const H = ERAS.rows * ERAS.py;
  const xl = [];
  const yl = [];
  for (let r = 0; r < ERAS.rows; r++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.00005, 0.00005, W + 0.004, 5).rotateZ(Math.PI / 2), mats.fine.clone());
    m.position.y = (r - (ERAS.rows - 1) / 2) * ERAS.py;
    g.add(m);
    xl.push(m);
  }
  for (let c = 0; c < ERAS.cols; c++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.00005, 0.00005, H + 0.004, 5), mats.fine.clone());
    m.position.x = (c - (ERAS.cols - 1) / 2) * ERAS.px;
    m.position.z = 0.0001;
    g.add(m);
    yl.push(m);
  }
  const zz = [];
  for (let r = 0; r <= ERAS.rows; r++) zz.push(new V3((r % 2 ? 1 : -1) * (W / 2 + 0.0015), (r - ERAS.rows / 2) * ERAS.py, -0.00012));
  const sense = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(zz, false, 'catmullrom', 0.1), 260, 0.00006, 5), mats.fine.clone());
  g.add(sense);
  // the selected core, on its own, with its magnetisation mark
  const [sc, sr] = ERAS.sel;
  const selCore = new THREE.Mesh(new THREE.TorusGeometry(0.00072, 0.00028, 14, 30), mats.erasSel);
  selCore.position.copy(pos(sc, sr));
  selCore.quaternion.copy(Q);
  g.add(selCore);
  const mark = new THREE.Mesh(new THREE.SphereGeometry(0.0003, 10, 8), mats.mark);
  g.add(mark);
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.01, H + 0.01), std('#b9ae92', {roughness: 0.9}));
  backing.position.z = -0.0014;
  backing.receiveShadow = true;
  g.add(backing);
  return {g, xl, yl, sense, selCore, mark, centre: pos(sc, sr).clone()};
}

// ------------------------------------------------------------ the DSKY: face plate, lamps, EL panel, 19 keys
export const KEY_POS = (() => {
  const out = {};
  const col = (i) => (i - 3) * 0.0262;
  const row = (j) => -0.024 - j * 0.0262;
  out.VERB = [col(0), row(0.5)];
  out.NOUN = [col(0), row(1.5)];
  ['+', '7', '8', '9', 'CLR'].forEach((k, i) => (out[k] = [col(i + 1), row(0)]));
  ['-', '4', '5', '6', 'PRO'].forEach((k, i) => (out[k] = [col(i + 1), row(1)]));
  ['0', '1', '2', '3', 'KEY REL'].forEach((k, i) => (out[k] = [col(i + 1), row(2)]));
  out.ENTR = [col(6), row(0.5)];
  out.RSET = [col(6), row(1.5)];
  return out;
})();
const keyLabel = (k) => (k === '-' ? '−' : k);
function dskyUnit(mats) {
  const g = new THREE.Group();
  const S = L.dskyS;
  const D = L.dskyD;
  const body = std(COL.dsky, {roughness: 0.55, metalness: 0.25});
  const shell = box(S, S, D, body, 0, S / 2, 0);
  g.add(shell);
  // back connector block and side rails (the photo's mounting flanges)
  g.add(box(S * 0.86, S * 0.9, 0.03, std('#2f3133'), 0, S / 2, -D / 2 - 0.015));
  for (const s of [1, -1]) g.add(box(0.006, S * 0.96, D * 0.9, std('#9a9b9c', {metalness: 0.4}), s * (S / 2 + 0.003), S / 2, -0.004));
  // the face: plate, lamp window, EL window, keyboard well
  const plate = new THREE.CanvasTexture(faceCanvas());
  plate.colorSpace = THREE.SRGBColorSpace;
  plate.anisotropy = 8;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshStandardMaterial({map: plate, roughness: 0.6, metalness: 0.1}));
  face.position.set(0, S / 2, D / 2 + 0.0004);
  face.receiveShadow = true;
  g.add(face);
  // the lamp panel and the EL panel: canvases redrawn when their state changes
  const lampC = document.createElement('canvas');
  lampC.width = 420;
  lampC.height = 470;
  const lampT = new THREE.CanvasTexture(lampC);
  lampT.colorSpace = THREE.SRGBColorSpace;
  lampT.anisotropy = 8;
  const lw = 0.08;
  const lh = 0.0895;
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshBasicMaterial({map: lampT, toneMapped: false}));
  lamp.position.set(-0.048, S / 2 + 0.05, D / 2 + 0.0035);
  g.add(lamp);
  g.add(box(lw + 0.006, lh + 0.006, 0.006, std('#55575a'), -0.048, S / 2 + 0.05, D / 2 + 0.0002));
  const elC = document.createElement('canvas');
  elC.width = 400;
  elC.height = 470;
  const elT = new THREE.CanvasTexture(elC);
  elT.colorSpace = THREE.SRGBColorSpace;
  elT.anisotropy = 8;
  const el = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshBasicMaterial({map: elT, toneMapped: false}));
  el.position.set(0.048, S / 2 + 0.05, D / 2 + 0.0035);
  g.add(el);
  g.add(box(lw + 0.006, lh + 0.006, 0.006, std('#55575a'), 0.048, S / 2 + 0.05, D / 2 + 0.0002));
  // keys
  const keys = {};
  const kg = new THREE.BoxGeometry(0.0218, 0.0218, 0.007);
  for (const [k, [x, y]] of Object.entries(KEY_POS)) {
    const t = labelTex(keyLabel(k), {w: 128, h: 128, px: k.length > 3 ? 34 : k.length > 1 ? 40 : 62, color: '#e9e6dc', bg: COL.key, weight: 600, spacing: 1});
    if (k === 'KEY REL') {
      const c = t.image.getContext('2d');
      c.fillStyle = COL.key;
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#e9e6dc';
      c.font = font(600, 36);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('KEY', 64, 46);
      c.fillText('REL', 64, 84);
      t.needsUpdate = true;
    }
    const side = std(COL.key, {roughness: 0.5});
    const front = new THREE.MeshStandardMaterial({map: t, roughness: 0.5});
    const m = new THREE.Mesh(kg, [side, side, side, side, front, side]);
    m.position.set(x, S / 2 + y, D / 2 + 0.0035);
    m.castShadow = true;
    m.userData.key = k;
    g.add(m);
    keys[k] = m;
  }
  return {g, keys, lampC, lampT, elC, elT, face, el, lamp, lastLamp: '', lastEl: ''};
}
function faceCanvas() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#8f9194';
  g.fillRect(0, 0, 1024, 1024);
  // keyboard well
  g.fillStyle = '#7d7f82';
  g.fillRect(24, 548, 976, 452);
  g.strokeStyle = 'rgba(0,0,0,.25)';
  g.lineWidth = 3;
  g.strokeRect(24, 548, 976, 452);
  // screws
  g.fillStyle = '#5d5f62';
  for (const [x, y] of [[40, 40], [984, 40], [40, 520], [984, 520], [512, 520], [40, 984], [984, 984]]) {
    g.beginPath();
    g.arc(x, y, 9, 0, 7);
    g.fill();
  }
  // nameplate
  g.fillStyle = '#6f7174';
  g.fillRect(392, 14, 240, 22);
  g.fillStyle = '#d9d7cf';
  g.font = font(600, 17);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('DISPLAY & KEYBOARD', 512, 26);
  return c;
}
// lamp panel: 2 columns of 7 [D]; lit lamps: white (status) or amber (caution)
const CAUTION = new Set(['TEMP', 'GIMBAL LOCK', 'PROG', 'RESTART', 'TRACKER', 'ALT', 'VEL']);
function drawLamps(d, lamps) {
  drawLampPanel(d.lampC.getContext('2d'), d.lampC.width, d.lampC.height, lamps);
  d.lampT.needsUpdate = true;
}
export function drawLampPanel(g, W, H, lamps) {
  g.fillStyle = '#4b4d50';
  g.fillRect(0, 0, W, H);
  const cw = (W - 30) / 2;
  const ch = (H - 40) / 7;
  LAMPS.forEach((rowL, r) =>
    rowL.forEach((name, c) => {
      const x = 10 + c * (cw + 10);
      const y = 10 + r * (ch + 3.3);
      const on = name && lamps[name];
      g.fillStyle = on ? (CAUTION.has(name) ? AMBER : '#f4f0e0') : '#a6a59c';
      g.fillRect(x, y, cw, ch);
      if (!name) return;
      g.fillStyle = on ? '#2b2210' : '#6e6d66';
      g.font = font(700, name.length > 9 ? 25 : 29);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if ('letterSpacing' in g) g.letterSpacing = '1px';
      const parts = name.length > 9 ? name.split(' ') : [name];
      parts.forEach((p, i) => g.fillText(p, x + cw / 2, y + ch / 2 + (i - (parts.length - 1) / 2) * 24 + 2));
    }),
  );
}
// the EL panel: COMP ACTY, PROG, VERB, NOUN, three signed 5-digit registers, green on black
export function drawEL(g, W, H, s, green = ACCENT) {
  const off = 'rgba(53,194,106,0.06)';
  g.fillStyle = '#0d0f0e';
  g.fillRect(0, 0, W, H);
  const lab = (t, x, y, w, on = true) => {
    g.fillStyle = on ? green : '#0d0f0e';
    g.fillRect(x, y, w, 26);
    g.fillStyle = on ? '#0d0f0e' : green;
    g.font = font(700, 22);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = '1px';
    g.fillText(t, x + w / 2, y + 14);
  };
  // COMP ACTY
  if (s.compActy) {
    g.fillStyle = green;
    g.fillRect(22, 18, 140, 92);
    g.fillStyle = '#0d0f0e';
  } else g.fillStyle = 'rgba(53,194,106,0.12)';
  g.font = font(700, 30);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('COMP', 92, 50);
  g.fillText('ACTY', 92, 82);
  lab('PROG', 252, 16, 120);
  lab('VERB', 22, 128, 120);
  lab('NOUN', 252, 128, 120);
  const dw = 46;
  const dh = 70;
  drawDigits(g, s.prog, 262, 50, dw, dh, 10, green, off);
  drawDigits(g, s.verb, 32, 162, dw, dh, 10, green, off);
  drawDigits(g, s.noun, 262, 162, dw, dh, 10, green, off);
  for (let r = 0; r < 3; r++) {
    const y = 252 + r * 72;
    g.fillStyle = 'rgba(53,194,106,0.55)';
    g.fillRect(22, y - 6, W - 44, 3);
    drawDigits(g, s.reg[r], 30, y + 2, 46, 60, 9.5, green, off);
  }
}
const DIG_STATE = (s) => `${s.compActy}|${s.prog}|${s.verb}|${s.noun}|${s.reg.join('|')}`;

// ------------------------------------------------------------ a logic module's face: 60 flat-packs, and the enlarged gate
function flatpacks(n, w, h, mats) {
  const fg = new THREE.BoxGeometry(0.0064, 0.0036, 0.0012);
  const im = new THREE.InstancedMesh(fg, mats.flatpack, n);
  const lg = new THREE.BoxGeometry(0.0088, 0.0002, 0.0004);
  const leads = new THREE.InstancedMesh(lg, mats.gold, n * 5);
  const M = new THREE.Matrix4();
  const per = n / 2;
  for (let k = 0; k < n; k++) {
    const x = -w / 2 + 0.006 + ((k % per) * (w - 0.012)) / (per - 1);
    const y = (Math.floor(k / per) ? -1 : 1) * h * 0.2;
    im.setMatrixAt(k, M.makeTranslation(x, y, 0));
    for (let q = 0; q < 5; q++) leads.setMatrixAt(k * 5 + q, M.makeTranslation(x, y - 0.0013 + q * 0.00065, 0.0004));
  }
  const g = new THREE.Group();
  g.add(im, leads);
  return g;
}

// ------------------------------------------------------------ the machine
export function buildMachine() {
  const root = new THREE.Group();
  const mats = {
    mag: std(COL.mag, {roughness: 0.58, metalness: 0.35}),
    magB: std(COL.magGreen, {roughness: 0.6, metalness: 0.3}),
    strip: std(COL.strip, {roughness: 0.75}),
    gold: std(COL.gold, {roughness: 0.42, metalness: 0.8}),
    ferrite: std(COL.ferrite, {roughness: 0.5, metalness: 0.2}),
    ferriteHi: std('#26231f', {roughness: 0.42, metalness: 0.25}),
    coreSel: std('#26231f', {roughness: 0.42, metalness: 0.25, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0}),
    copper: std(COL.copper, {roughness: 0.45, metalness: 0.7}),
    copperSheath: std('#9c5f37', {roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.55, depthWrite: false}),
    copperDim: std('#8e5a36', {roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.5, depthWrite: false}),
    wire: std('#c07a44', {roughness: 0.4, metalness: 0.7, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0}),
    inhibit: std('#6f6b63', {roughness: 0.5, metalness: 0.4, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0}),
    mark: new THREE.MeshBasicMaterial({color: '#f4efdf'}),
    fine: std('#7d5233', {roughness: 0.5, metalness: 0.6, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0}),
    erasSel: std('#26231f', {roughness: 0.42, metalness: 0.25, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0}),
    flatpack: std('#1f1f22', {roughness: 0.4, metalness: 0.3}),
    black: std(COL.black, {roughness: 0.65}),
  };
  const clipPlane = new THREE.Plane(new V3(0, 0, -1), 0.02);
  const shells = [];
  const A = {};

  // ------------------------------------------------ tray A: logic
  const agc = new THREE.Group();
  agc.position.x = L.x0;
  root.add(agc);
  const ta = tray({len: L.len, wid: L.wid, h: L.trayH, mat: mats.mag, dark: COL.magDark, holes: true});
  agc.add(ta.g);
  shells.push(...ta.shell);
  // end connector (the gold field on the photo's front end) and its cover plate
  const connA = new THREE.Group();
  connA.position.set(L.len / 2 + 0.004, 0.042, 0);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.026), std('#8a7440', {roughness: 0.5, metalness: 0.7, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0}));
  field.rotation.y = Math.PI / 2;
  connA.add(field);
  connA.add(box(0.005, 0.034, 0.23, mats.magB, -0.002, 0, 0));
  agc.add(connA);
  const strips = [];
  const SW = 0.0136;
  const stripLen = 0.255;
  const groups = [
    {x: -0.148, n: 14, from: 0},
    {x: 0.142, n: 17, from: 14},
  ];
  const label = (name) => {
    const t = labelTex(name, {w: 512, h: 40, px: 30, color: '#57534a', spacing: 4});
    return new THREE.MeshStandardMaterial({map: t, transparent: true, roughness: 0.8});
  };
  for (const gr of groups)
    for (let i = 0; i < gr.n; i++) {
      const k = gr.from + i;
      const name = k < 24 ? `LOGIC MODULE A${k + 1}` : `INTERFACE MODULE A${k + 1}`;
      const s = new THREE.Group();
      s.add(box(stripLen, 0.06, SW - 0.0012, mats.strip, 0, 0.03, 0));
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(stripLen * 0.62, 0.0046), label(name));
      lab.rotation.x = -Math.PI / 2;
      lab.position.set(0, 0.0602, 0);
      s.add(lab);
      s.position.set(gr.x, 0.006, -L.wid / 2 + 0.016 + (i + 0.5) * ((L.wid - 0.032) / gr.n));
      agc.add(s);
      strips.push(s);
    }
  // module A13 opened: its flat-packs on the face that comes up, and one enlarged gate
  const logicK = 12;
  const logicMod = strips[logicK];
  const fp = flatpacks(60, stripLen - 0.02, 0.05, mats);
  fp.position.set(0, 0.03, SW / 2 + 0.0002);
  logicMod.add(fp);
  const bigGate = new THREE.Group();
  {
    const b = box(0.064, 0.038, 0.012, mats.flatpack, 0, 0, 0);
    bigGate.add(b);
    for (let q = 0; q < 5; q++)
      for (const s of [1, -1]) {
        const lead = box(0.03, 0.0016, 0.004, mats.gold, s * 0.045, -0.014 + q * 0.007, 0);
        bigGate.add(lead);
      }
    const t = labelTex('2 × NOR · 3 INPUTS', {w: 512, h: 96, px: 44, color: '#d9d3c0', spacing: 3});
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.0098), new THREE.MeshBasicMaterial({map: t, transparent: true}));
    lab.position.z = 0.0062;
    bigGate.add(lab);
  }
  bigGate.visible = false;
  agc.add(bigGate);

  // ------------------------------------------------ tray B: memory, the rope bay
  const tb = new THREE.Group();
  agc.add(tb);
  const tbt = tray({len: L.len, wid: L.wid, h: L.trayH, mat: mats.magB, dark: '#6f735f', holes: true});
  tb.add(tbt.g);
  shells.push(...tbt.shell);
  // X-ribbed plate, inside, over its part of the tray
  const xr = new THREE.Group();
  {
    const w = 0.14;
    const d = L.wid - 0.02;
    xr.add(box(w, 0.004, d, mats.magB, 0, 0.002, 0));
    const ang = Math.atan2(d, w);
    const len = Math.hypot(w, d);
    for (const s of [1, -1]) {
      const r = box(len, 0.008, 0.006, mats.magB, 0, 0.006, 0);
      r.rotation.y = s * ang;
      xr.add(r);
    }
    xr.position.set(0.225, 0.055, 0);
  }
  tb.add(xr);
  // memory electronics B7-B17, on edge, across the tray
  const bNames = ['OSCILLATOR B7', 'ALARM B8', 'ERASABLE DRIVER B9-10', 'ERASABLE DRIVER B9-10', 'CURRENT SWITCH B11', 'ERASABLE MEMORY B12', 'SENSE AMPLIFIER B13-14', 'SENSE AMPLIFIER B13-14', 'STRAND SELECT B15', 'ROPE DRIVER B16-17', 'ROPE DRIVER B16-17'];
  const bStrips = [];
  bNames.forEach((name, i) => {
    const s = new THREE.Group();
    const isE = name.startsWith('ERASABLE MEMORY');
    const lenB = 0.26;
    s.add(box(lenB, 0.05, 0.0225, isE ? mats.black : mats.strip, 0, 0.025, 0));
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(lenB * 0.66, 0.0062), isE ? new THREE.MeshStandardMaterial({map: labelTex(name.replace('B12', 'MODULE B12'), {w: 512, h: 40, px: 30, color: '#e8e2cf', spacing: 4}), transparent: true}) : label(name.replace(/ B/, ' MODULE B')));
    lab.rotation.x = -Math.PI / 2;
    lab.position.set(0, 0.0502, 0);
    s.add(lab);
    s.position.set(0.0, 0.034, -L.wid / 2 + 0.018 + (i + 0.5) * ((L.wid - 0.036) / 11));
    tb.add(s);
    bStrips.push(s);
  });
  const eras = bStrips[5];
  const plane = erasPlane(mats);
  plane.g.position.set(0, 0.025, 0.0114);
  plane.g.visible = false;
  eras.add(plane.g);
  // the rope bay, at the -x end: 3 across, 2 deep
  const ropes = [];
  const bayX = -L.len / 2 + 0.006 + ROPE.len / 2 + 0.004;
  for (let i = 0; i < 6; i++) {
    const m = ropeModule(i, mats);
    const col = i % 3;
    const lay = Math.floor(i / 3);
    m.home = new V3(bayX, 0.052 - lay * 0.032, (col - 1) * (ROPE.wid + 0.006));
    m.g.position.copy(m.home);
    tb.add(m.g);
    ropes.push(m);
  }
  // module B1 (top layer, middle) is the one that comes out
  const b1 = ropes[1];
  const det = ropeDetail(mats);
  det.g.visible = false;
  b1.g.add(det.g);
  // windows on tray B's outer face over the rope bay (it faces up when the box is closed)
  {
    const wm = std('#4a4a40', {roughness: 0.8});
    for (let c = 0; c < 3; c++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(ROPE.len - 0.03, ROPE.wid - 0.024), wm);
      w.rotation.x = Math.PI / 2;
      w.position.set(bayX, -0.0003, (c - 1) * (ROPE.wid + 0.006));
      tb.add(w);
      shells.push(w);
    }
    const xo = new THREE.Group();
    const w = 0.36;
    const d = L.wid - 0.03;
    const ang = Math.atan2(d, w);
    for (const s of [1, -1]) {
      const r = box(Math.hypot(w, d), 0.005, 0.009, mats.magB, 0, -0.0025, 0);
      r.rotation.y = s * ang;
      xo.add(r);
    }
    xo.position.set(0.1, 0, 0);
    tb.add(xo);
    shells.push(...xo.children);
  }

  // ------------------------------------------------ the DSKY
  const dsky = dskyUnit(mats);
  dsky.g.position.copy(L.dsky);
  dsky.g.rotation.y = L.dskyYaw;
  root.add(dsky.g);
  // a cable from the DSKY to the AGC's end connector
  {
    const pts = [new V3(L.dsky.x - 0.06, 0.05, L.dsky.z - 0.11), new V3(L.dsky.x - 0.1, 0.012, L.dsky.z - 0.2), new V3(0.18, 0.01, -0.1), new V3(L.x0 + L.len / 2 + 0.03, 0.03, -0.02)];
    const cab = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0075, 10), std('#3a3833', {roughness: 0.75}));
    cab.castShadow = true;
    root.add(cab);
  }

  for (const m of shells) if (m.material) m.material = m.material.clone();
  const shellMats = [...new Set(shells.map((m) => m.material))];

  // anchors for callouts (world space, filled by update)
  const anchors = {};
  const tmp = new V3();
  const world = (obj, local) => obj.localToWorld(tmp.copy(local)).clone();
  let cutWas = '';

  /**
   * fx: {open (0 closed, 1 apart), rope (0 in, 1 out), ropeCover (0 on, 1 off), ropeDetail (0..1), read {phase, on},
   *      eras (0 in, 1 up), erasRead {phase, bit, on}, logic (0 in, 1 up), gate (0..1), rr (0..1 connector glow),
   *      cut ('' | 'case'), dsky {lamps, el: {compActy, prog, verb, noun, reg}, press: {key: 0..1}}}
   */
  function update(fx) {
    // tray B: lift, flip about the long axis, slide beside A, lower
    const o = fx.open;
    const k1 = smooth(o / 0.28);
    const k2 = smooth((o - 0.22) / 0.56);
    const k3 = smooth((o - 0.72) / 0.28);
    tb.rotation.x = Math.PI * (1 - k2);
    const yClosed = 2 * L.trayH;
    // local y 0 is the tray's outer face: at 2 x 85 mm when closed (flipped), on the floor when apart
    tb.position.set(0, mix(yClosed, 0, k3) + L.liftY * (k1 - k3), L.openZ * k2);
    // rope module B1: out along -x, then up and clear of the tray
    const r1 = smooth(fx.rope / 0.6);
    const r2 = smooth((fx.rope - 0.55) / 0.45);
    b1.g.position.set(b1.home.x - 0.25 * r1, b1.home.y + 0.075 * r2, b1.home.z);
    b1.cover.position.y = ROPE.th + 0.0011 + 0.05 * smooth(fx.ropeCover);
    b1.cover.visible = fx.ropeCover < 0.98;
    b1.cover.children.forEach((c) => c.material && ((c.material.transparent = true), (c.material.opacity = 1 - smooth((fx.ropeCover - 0.4) / 0.6))));
    const inside = fx.ropeDetail > 0.01;
    if (det.g.visible !== inside) {
      det.g.visible = inside;
      b1.bundles.visible = !inside;
      b1.sheath.visible = !inside;
      // the 9 detailed cores replace their instances
      for (let k = 0; k < DET_N; k++) {
        const idx = (det.layer * ROPE.rows + det.row) * ROPE.cols + det.c0 + k;
        b1.cores.setMatrixAt(idx, inside ? M0.makeScale(0, 0, 0) : M0.makeTranslation(coreX(det.c0 + k), coreY(det.layer), coreZ(det.row)));
      }
      b1.cores.instanceMatrix.needsUpdate = true;
    }
    // the read inside one MCT: inhibit lines, then the set, then the reset whose flux the sense lines catch
    const rd = fx.read || {phase: -1};
    const ph = rd.phase;
    const inh = ph >= 0 && ph < 0.45 ? smooth(ph / 0.06) * (1 - smooth((ph - 0.38) / 0.07)) : 0;
    const setK = ph >= 0.12 && ph < 0.45 ? smooth((ph - 0.12) / 0.05) * (1 - smooth((ph - 0.36) / 0.06)) : 0;
    const resK = ph >= 0.45 && ph < 0.95 ? smooth((ph - 0.45) / 0.05) * (1 - smooth((ph - 0.85) / 0.1)) : 0;
    det.inhib.forEach((m) => (m.material.emissiveIntensity = inh * 0.75));
    det.setLine.material.emissiveIntensity = Math.max(setK, resK) * 0.75;
    const ck = rd.core ?? (DET_N - 1) / 2;
    const sel = det.words[ck].bits || [];
    det.wires.forEach((m, j) => {
      const lit = sel[j] ? resK : 0;
      m.material.emissiveIntensity = lit * 0.65;
      m.material.color.set(lit > 0.5 ? '#7fcf9c' : '#c07a44');
    });
    det.cores.forEach((m, k) => (m.material.emissiveIntensity = k === ck ? Math.max(setK, resK) * 0.55 : 0));
    // B12 rises; its cover window shows the plane
    const e1 = smooth(fx.eras);
    eras.position.y = 0.034 + 0.085 * e1;
    plane.g.visible = fx.eras > 0.3;
    const er = fx.erasRead || {phase: -1, bit: 1};
    const ep = er.phase;
    // read: half currents on one X and one Y line drive the core to 0; the sense line sees a 1. Rewrite: back to 1
    const rdK = ep >= 0 && ep < 0.5 ? smooth(ep / 0.05) * (1 - smooth((ep - 0.4) / 0.08)) : 0;
    const wrK = ep >= 0.55 && ep < 1 ? smooth((ep - 0.55) / 0.05) * (1 - smooth((ep - 0.9) / 0.08)) : 0;
    const [sc, sr] = ERAS.sel;
    plane.xl.forEach((m, i) => (m.material.emissiveIntensity = i === sr ? Math.max(rdK, wrK) * 0.9 : 0));
    plane.yl.forEach((m, i) => (m.material.emissiveIntensity = i === sc ? Math.max(rdK, wrK) * 0.9 : 0));
    plane.sense.material.emissiveIntensity = er.bit && ep >= 0.18 && ep < 0.45 ? 0.9 * (1 - smooth((ep - 0.35) / 0.1)) : 0;
    // the magnetisation: 1 = mark at the top of the ring, 0 = bottom; it turns while the core switches
    let ang = er.bit ? Math.PI / 2 : -Math.PI / 2;
    if (ep >= 0) {
      if (er.bit) {
        const a = smooth((ep - 0.12) / 0.14);
        const b = smooth((ep - 0.62) / 0.14);
        ang = Math.PI / 2 - Math.PI * a + Math.PI * b;
      }
    }
    const rr = 0.00072;
    tmp.set(Math.cos(ang) * rr, Math.sin(ang) * rr, 0).applyQuaternion(plane.selCore.quaternion);
    plane.mark.position.copy(plane.centre).add(tmp);
    mats.erasSel.emissiveIntensity = Math.max(rdK, wrK) * 0.6 * (ep >= 0 ? 1 : 0);
    // logic module A13 up, one gate enlarged in front of it
    const l1 = smooth(fx.logic);
    logicMod.position.y = 0.006 + 0.09 * l1;
    bigGate.visible = fx.gate > 0.01;
    {
      const gk = smooth(fx.gate);
      bigGate.position.set(logicMod.position.x + 0.03, 0.2 + 0.02 * gk, logicMod.position.z + 0.07);
      bigGate.scale.setScalar(0.2 + 0.8 * gk);
    }
    // the radar's pulses into the interface connector
    field.material.emissiveIntensity = (fx.rr || 0) * 0.6;
    // section of the closed case
    const cut = fx.cut === 'case' && o < 0.02 ? 'case' : '';
    if (cut !== cutWas) {
      cutWas = cut;
      for (const m of shellMats) {
        m.clippingPlanes = cut ? [clipPlane] : [];
        m.needsUpdate = true;
      }
    }
    clipPlane.constant = 0.02;
    // the DSKY
    const d = fx.dsky;
    if (d) {
      const ls = JSON.stringify(d.lamps);
      if (ls !== dsky.lastLamp) {
        dsky.lastLamp = ls;
        drawLamps(dsky, d.lamps);
      }
      const es = DIG_STATE(d.el);
      if (es !== dsky.lastEl) {
        dsky.lastEl = es;
        drawEL(dsky.elC.getContext('2d'), dsky.elC.width, dsky.elC.height, d.el);
        dsky.elT.needsUpdate = true;
      }
      for (const [k, m] of Object.entries(dsky.keys)) m.position.z = L.dskyD / 2 + 0.0035 - 0.0024 * (d.press?.[k] || 0);
    }
    // anchors
    root.updateMatrixWorld(true);
    anchors.trayA = world(agc, new V3(-0.05, 0.07, L.wid / 2));
    anchors.trayB = world(tb, new V3(0.05, 0.06, 0));
    anchors.logic = world(logicMod, new V3(0.05, 0.06, 0));
    anchors.gate = world(bigGate, new V3(0.02, 0.01, 0.006));
    anchors.rope = world(b1.g, new V3(0, ROPE.th, 0));
    anchors.ropeEnd = world(b1.g, new V3(ROPE.len / 2, ROPE.th * 0.5, 0));
    anchors.core = world(b1.g, det.anchor.clone());
    anchors.coreNext = world(b1.g, det.anchor.clone().add(new V3(ROPE.px * 3, 0.0045, 0)));
    anchors.inhib = world(b1.g, det.anchor.clone().add(new V3(-ROPE.px * 3, -0.0045, 0)));
    anchors.eras = world(eras, new V3(0.08, 0.05, 0));
    anchors.erasCore = world(eras, plane.centre.clone().add(new V3(0, 0.025, 0.0114)));
    anchors.erasSense = world(eras, new V3(ERAS.cols * ERAS.px * 0.5 + 0.0015, 0.025, 0.0114));
    anchors.dsky = world(dsky.g, new V3(0, L.dskyS * 0.75, L.dskyD / 2));
    anchors.dskyEl = world(dsky.g, new V3(0.048, L.dskyS / 2 + 0.05, L.dskyD / 2));
    anchors.dskyKeys = world(dsky.g, new V3(0, L.dskyS / 2 - 0.05, L.dskyD / 2));
    anchors.dskyProg = world(dsky.g, new V3(-0.028, L.dskyS / 2 + 0.077, L.dskyD / 2));
    anchors.conn = world(connA, new V3(0, 0, 0));
    anchors.xrib = world(tb, new V3(0.225, 0.06, 0));
    anchors.erasMod = world(eras, new V3(-0.06, 0.05, 0));
  }
  update({open: 0, rope: 0, ropeCover: 0, ropeDetail: 0, eras: 0, logic: 0, gate: 0});
  return {root, update, anchors, dsky, det, plane, b1, tb, agc, eras, logicMod, bigGate, shellMats};
}
