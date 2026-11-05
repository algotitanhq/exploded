// Pepper's geometry, built from code, in millimetres (the root is scaled to metres). Against the photos in
// ../REFERENCES.md: a knurled base, the slotted body with its 8 sliders, the CURTA band, the knurled carriage with the
// result and counter windows on its top plate, the clearing ring, the crank. Inside, from the drawings of the
// internals [M]: one stepped drum with its addition and complement rows and the carry bell on top, 11 square shafts
// around it with their counting gears, the carry levers and pinions, the digit drums lying on their sides under the
// windows. update(S, fx) poses every part from the model's state (machine.js) for one frame; it holds no time.
import * as THREE from 'three';
import {rng} from 'teardown-kit/util.js';
import {CURTA, G, stationOf, thetaCarry} from './machine.js';

const V3 = THREE.Vector3;
const D2R = Math.PI / 180;
export const ACCENT = '#b07a1c';

// ------------------------------------------------------------ layout, mm; y up, azimuth a from +z toward +x
export const L = {
  baseR: 26.5,
  baseH: 14,
  shellR: 23.6,
  shellY: [14, 52],
  slotY: [19.2, 47.6],
  slotW: 3.4,
  bandR: 25.2,
  bandY: [52, 63],
  carR: 26.5,
  carY: [63, 79.5],
  plateY: [79.5, 81.5],
  ringR: [20.6, 25.6],
  drumR: 6,
  toothR: 7.6,
  drumY: [18.6, 45.4],
  shaftR: 9.7,
  gearR: 2.3,
  wheelR: 4.2,
  wheelW: 4.2,
  wheelAt: 18.6, // radius of the result digit drums' centres
  ctrR: 2.6,
  ctrW: 3.2,
  ctrAt: 7.2,
  crankArm: 16,
  A1: 3.5 * G.pitch, // azimuth of station 1: the 8 sliders centred on the front, slider 1 on the right
};
export const azOf = (s) => L.A1 - (s - 1) * G.pitch; // degrees
export const yRow = (d) => 43 - G.rowPitch * d; // height of the counting gear for digit d (and of add row d)
const P = (r, a, y) => new V3(r * Math.sin(a * D2R), y, r * Math.cos(a * D2R));

// ------------------------------------------------------------ textures drawn on canvases
function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
function normalFromHeight(w, h, hf, strength) {
  return canvas(w, h, (g) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (hf((x + 1) % w, y) - hf((x - 1 + w) % w, y)) * strength;
        const dy = (hf(x, (y + 1) % h) - hf(x, (y - 1 + h) % h)) * strength;
        const n = new V3(-dx, dy, 1).normalize();
        const i = (y * w + x) * 4;
        img.data[i] = (n.x * 0.5 + 0.5) * 255;
        img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
        img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  });
}
const texOf = (c, {srgb = false, rx = 1, ry = 1, aniso = 8} = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = aniso;
  return t;
};
// diamond knurl: a grid of four-sided pyramids
const knurlCanvas = () => normalFromHeight(64, 64, (x, y) => 1 - Math.max(Math.abs((x % 32) - 16), Math.abs((y % 32) - 16)) / 16, 2.2);
// the crackle paint: small cells of raised paint with grooves between them
function crackleCanvas() {
  const r = rng(48);
  const N = 256;
  const pts = Array.from({length: 150}, () => [r() * N, r() * N]);
  const H = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let d1 = 1e9;
      let d2 = 1e9;
      for (const [px, py] of pts) {
        let dx = Math.abs(x - px);
        let dy = Math.abs(y - py);
        dx = Math.min(dx, N - dx);
        dy = Math.min(dy, N - dy);
        const d = dx * dx + dy * dy;
        if (d < d1) [d1, d2] = [d, d1];
        else if (d < d2) d2 = d;
      }
      const e = Math.sqrt(d2) - Math.sqrt(d1);
      H[y * N + x] = Math.min(1, e / 3) * (0.8 + 0.2 * Math.sin(x * 0.9 + y * 1.3));
    }
  return normalFromHeight(N, N, (x, y) => H[y * N + x], 1.6);
}
// a digit drum's face: ten digits around the circumference, each turned so its top points at the machine's axis
function digitsCanvas(fg, bg, w = 640, h = 72, font = 'JetBrains Mono') {
  return canvas(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const cw = w / 10;
    g.fillStyle = fg;
    g.font = `600 ${Math.round(cw * 0.78)}px '${font}', monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let d = 0; d < 10; d++) {
      g.save();
      g.translate((d + 0.5) * cw, h / 2);
      g.rotate(Math.PI);
      g.fillText(String(d), 0, 2);
      g.restore();
    }
  });
}
// a slider's digit tape: 0 at the top, 9 at the bottom
const tapeCanvas = () =>
  canvas(64, 640, (g, w, h) => {
    g.fillStyle = '#0d0d0e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2efe6';
    g.font = `600 46px 'JetBrains Mono', monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let d = 0; d < 10; d++) g.fillText(String(d), w / 2, (d + 0.5) * (h / 10) + 2);
  });
// the band: CURTA at the front, the slider numbers under the slots
const bandCanvas = () =>
  canvas(2048, 128, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9e6dd';
    g.font = `300 70px Inter, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const word = 'C U R T A';
    g.save();
    g.translate(w * 0.035, h * 0.52);
    g.fillText(word, 0, 0);
    g.restore();
    g.save();
    g.translate(w * 1.035, h * 0.52);
    g.fillText(word, 0, 0);
    g.restore();
  });
const numbersCanvas = (labels, size = 34) =>
  canvas(2048, 64, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d9d6cd';
    g.font = `500 ${size}px Inter, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [a, txt] of labels) {
      const u = (((a / 360) % 1) + 1) % 1;
      g.fillText(txt, u * w, h / 2 + 1);
    }
  });

// ------------------------------------------------------------ shapes
function gearGeom(teeth, rTip, rRoot, thick, hole = 0.7) {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ph = i % 4;
    const r = ph === 1 || ph === 2 ? rTip : rRoot;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const hp = new THREE.Path();
  hp.moveTo(hole, hole);
  hp.lineTo(-hole, hole);
  hp.lineTo(-hole, -hole);
  hp.lineTo(hole, -hole);
  hp.lineTo(hole, hole);
  s.holes.push(hp);
  const g = new THREE.ExtrudeGeometry(s, {depth: thick, bevelEnabled: false, curveSegments: 2});
  g.rotateX(-Math.PI / 2);
  g.translate(0, -thick / 2, 0);
  return g;
}
// the top plate: a disc with 11 + 6 windows
function plateGeom() {
  const s = new THREE.Shape();
  s.absarc(0, 0, L.carR - 0.3, 0, Math.PI * 2, false);
  const win = (r, a, w, h) => {
    const p = new THREE.Path();
    const c = [r * Math.sin(a * D2R), r * Math.cos(a * D2R)];
    const ra = [Math.sin(a * D2R), Math.cos(a * D2R)];
    const ta = [Math.cos(a * D2R), -Math.sin(a * D2R)];
    const q = (u, v) => [c[0] + ra[0] * u + ta[0] * v, c[1] + ra[1] * u + ta[1] * v];
    const pts = [q(-h / 2, -w / 2), q(-h / 2, w / 2), q(h / 2, w / 2), q(h / 2, -w / 2)];
    p.moveTo(...pts[0]);
    for (const x of pts.slice(1)) p.lineTo(...x);
    p.lineTo(...pts[0]);
    s.holes.push(p);
  };
  for (let j = 1; j <= CURTA.result; j++) win(L.wheelAt, L.A1 - (j - 1) * G.pitch, 4.0, 5.6);
  for (let c = 1; c <= CURTA.counter; c++) win(L.ctrAt, L.A1 - (c - 0.5) * G.pitch, 2.4, 3.4);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 3.0, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, {depth: L.plateY[1] - L.plateY[0], bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 2, curveSegments: 64});
  // shape x → world x, shape y → world z (a = 0 at +z): rotate so the extrusion goes up
  g.rotateX(Math.PI / 2);
  g.scale(1, -1, 1);
  g.translate(0, L.plateY[0], 0);
  return g;
}

export function buildCurta() {
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  const groups = {};
  const grp = (name, parent = root) => {
    const g = new THREE.Group();
    g.name = name;
    parent.add(g);
    groups[name] = g;
    return g;
  };
  // ---- materials (each group gets its own copies so it can turn to glass or ghost on its own)
  const knurlN = texOf(knurlCanvas());
  const crackN = texOf(crackleCanvas(), {rx: 3, ry: 2});
  const std = (o) => new THREE.MeshStandardMaterial({roughness: 0.5, metalness: 0, envMapIntensity: 0.6, ...o});
  const M = {
    crackle: std({color: '#121213', roughness: 0.78, normalMap: crackN, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 0.5}),
    knurl: std({color: '#18191b', roughness: 0.44, metalness: 0.55, normalMap: knurlN, normalScale: new THREE.Vector2(1.1, 1.1), envMapIntensity: 0.75}),
    satinBlack: std({color: '#151618', roughness: 0.42, metalness: 0.5, envMapIntensity: 0.7}),
    steel: std({color: '#9a9ea5', roughness: 0.4, metalness: 1, envMapIntensity: 0.6}),
    polished: std({color: '#aeb2b8', roughness: 0.36, metalness: 1, envMapIntensity: 0.62}),
    brass: std({color: '#9c8c6a', roughness: 0.42, metalness: 1, envMapIntensity: 0.6}),
    dark: std({color: '#0a0a0b', roughness: 0.7}),
    band: std({color: '#ffffff', roughness: 0.55, metalness: 0.2, map: texOf(bandCanvas(), {srgb: true}), envMapIntensity: 0.5}),
    nums: std({color: '#ffffff', roughness: 0.7, map: texOf(numbersCanvas(Array.from({length: 8}, (_, i) => [azOf(i + 1), String(i + 1)])), {srgb: true})}),
  };
  const accentC = new THREE.Color(ACCENT);
  const ACC = () => std({color: '#c9902a', roughness: 0.38, metalness: 0.9, emissive: accentC, emissiveIntensity: 0, envMapIntensity: 0.8});
  const resultTex = texOf(digitsCanvas('#f4f1e8', '#0b0b0c'), {srgb: true});
  const ctrTex = texOf(digitsCanvas('#141414', '#ece5d2'), {srgb: true});
  const tapeTex = texOf(tapeCanvas(), {srgb: true});
  const mats = new Map(); // group name -> materials
  const own = (gname, m) => {
    const c = m.clone();
    c.userData.base = {opacity: 1, transparent: false};
    if (!mats.has(gname)) mats.set(gname, []);
    mats.get(gname).push(c);
    return c;
  };
  const mesh = (gname, geo, m, parent = groups[gname]) => {
    const x = new THREE.Mesh(geo, own(gname, m));
    x.castShadow = true;
    x.receiveShadow = true;
    parent.add(x);
    return x;
  };
  const cyl = (r0, r1, h, seg = 96, open = false, ts = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(r0, r1, h, seg, 1, open, ts, tl);
  const at = (o, y) => (o.position.y = y, o);
  const A = {}; // anchors for the callouts

  // ================================================================ base
  grp('base');
  {
    const h = L.baseH;
    const ring = mesh('base', cyl(L.baseR, L.baseR, h - 2, 128, true), M.knurl);
    ring.material.normalMap = knurlN.clone();
    ring.material.normalMap.repeat.set(90, 7);
    ring.material.normalMap.needsUpdate = true;
    at(ring, 1 + (h - 2) / 2);
    // chamfers and the bottom
    const prof = [[0, 0], [L.baseR - 1.2, 0], [L.baseR, 1.0], [L.baseR, 1.2], [L.baseR - 0.3, 1.2]].map(([x, y]) => new THREE.Vector2(x, y));
    mesh('base', new THREE.LatheGeometry(prof, 128), M.satinBlack);
    const top = [[L.baseR - 0.3, h - 1.2], [L.baseR, h - 1.2], [L.baseR, h - 0.8], [L.baseR - 0.8, h], [L.shellR - 0.2, h]].map(([x, y]) => new THREE.Vector2(x, y));
    mesh('base', new THREE.LatheGeometry(top, 128), M.satinBlack);
    // three steel pins on the top edge
    for (const a of [-42, 8, 58]) {
      const pin = mesh('base', new THREE.CylinderGeometry(0.7, 0.8, 1.6, 16), M.steel);
      pin.position.copy(P(L.baseR - 1.4, a, h + 0.6));
    }
  }

  // ================================================================ shell: the body with its slots, sliders, band
  grp('shell');
  {
    const [y0, y1] = L.shellY;
    const [s0, s1] = L.slotY;
    const halfA = ((L.slotW / 2) / L.shellR) / D2R;
    // full rings above and below the slots
    const below = mesh('shell', cyl(L.shellR, L.shellR, s0 - y0, 128, true), M.crackle);
    at(below, (y0 + s0) / 2);
    below.material.side = THREE.DoubleSide;
    const above = mesh('shell', cyl(L.shellR, L.shellR, y1 - s1, 128, true), M.crackle);
    at(above, (s1 + y1) / 2);
    above.material.side = THREE.DoubleSide;
    // panels between the slots (slots at stations 1..8, a solid back)
    const slots = Array.from({length: CURTA.sliders}, (_, i) => azOf(i + 1)).sort((a, b) => a - b);
    const edges = [];
    for (let i = 0; i < slots.length; i++) {
      const a0 = slots[i] + halfA;
      const a1 = i + 1 < slots.length ? slots[i + 1] - halfA : slots[0] + 360 - halfA;
      edges.push([a0, a1]);
    }
    for (const [a0, a1] of edges) {
      const g = cyl(L.shellR, L.shellR, s1 - s0, Math.max(4, Math.round((a1 - a0) / 3)), true, a0 * D2R, (a1 - a0) * D2R);
      const m = mesh('shell', g, M.crackle);
      m.material.side = THREE.DoubleSide;
      at(m, (s0 + s1) / 2);
    }
    // the slot's back: a dark guide with a polished rod, like the photos
    for (let i = 1; i <= CURTA.sliders; i++) {
      const a = azOf(i);
      const back = mesh('shell', cyl(L.shellR - 1.6, L.shellR - 1.6, s1 - s0, 8, true, (a - halfA * 1.6) * D2R, halfA * 3.2 * D2R), M.dark);
      back.material.side = THREE.DoubleSide;
      at(back, (s0 + s1) / 2);
      const rod = mesh('shell', new THREE.CylinderGeometry(0.55, 0.55, s1 - s0, 12), M.polished);
      rod.position.copy(P(L.shellR - 1.0, a, (s0 + s1) / 2));
    }
    // sliders: knurled tabs riding in the slots
    groups.sliders = [];
    for (let i = 1; i <= CURTA.sliders; i++) {
      const a = azOf(i);
      const piv = new THREE.Group();
      piv.rotation.y = a * D2R;
      groups.shell.add(piv);
      const tab = new THREE.Group();
      piv.add(tab);
      const knob = mesh('shell', new THREE.BoxGeometry(4.4, 4.6, 2.4), M.knurl, tab);
      knob.material.normalMap = knurlN.clone();
      knob.material.normalMap.repeat.set(3, 3);
      knob.position.set(0, 0, L.shellR + 1.0);
      const stem = mesh('shell', new THREE.BoxGeometry(2.4, 3.2, 2.2), M.satinBlack, tab);
      stem.position.set(0, 0, L.shellR - 1.0);
      groups.sliders.push(tab);
      // digit tape window above the slot
      const win = mesh('shell', new THREE.PlaneGeometry(3.0, 3.0), std({map: tapeTex.clone(), roughness: 0.6, color: '#ffffff'}), piv);
      win.material.map.repeat.set(1, 0.1);
      win.material.map.needsUpdate = true;
      win.position.set(0, (s1 + y1) / 2 + 0.6, L.shellR + 0.05);
      tab.userData.win = win;
    }
    // slider numbers under the slots
    const nums = mesh('shell', cyl(L.shellR + 0.02, L.shellR + 0.02, 3.2, 128, true), M.nums);
    at(nums, y0 + 2.6);
    // the band
    const band = mesh('shell', cyl(L.bandR, L.bandR, L.bandY[1] - L.bandY[0], 128, true), M.band);
    at(band, (L.bandY[0] + L.bandY[1]) / 2);
    const bandTop = mesh('shell', new THREE.RingGeometry(L.shellR - 0.5, L.bandR, 128), M.satinBlack);
    bandTop.rotation.x = Math.PI / 2;
    bandTop.position.y = L.bandY[0];
    A.sliders = P(L.shellR + 2, azOf(3), 34);
    A.band = P(L.bandR, 20, 58);
  }

  // ================================================================ drum: the stepped drum and the carry bell, turning with the crank
  grp('drum');
  const drumSpin = new THREE.Group();
  groups.drum.add(drumSpin);
  groups.drumSpin = drumSpin;
  const teeth = [];
  {
    const [y0, y1] = L.drumY;
    const core = mesh('drum', cyl(L.drumR, L.drumR, y1 - y0, 64), M.steel, drumSpin);
    core.material.color.set('#7d8187');
    at(core, (y0 + y1) / 2);
    const shaft = mesh('drum', cyl(2.2, 2.2, 82 - 15, 24), M.steel, drumSpin);
    at(shaft, (15 + 82) / 2);
    // rows: add row d (d teeth) at yRow(d), complement row d (9 − d teeth) half a pitch lower, the ten row on top
    const rows = [];
    for (let d = 1; d <= 9; d++) rows.push({kind: 'add', d, y: yRow(d), n: d});
    for (let d = 0; d <= 8; d++) rows.push({kind: 'comp', d, y: yRow(d) - G.shift, n: 9 - d});
    rows.push({kind: 'ten', d: 0, y: yRow(0) + G.shift, n: 10});
    let count = 0;
    for (const r of rows) count += r.n;
    const tg = new THREE.BoxGeometry(1.25, 0.95, L.toothR - L.drumR + 0.3);
    const im = new THREE.InstancedMesh(tg, own('drum', M.brass), count);
    im.castShadow = true;
    im.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let i = 0;
    for (const r of rows)
      for (let k = 0; k < r.n; k++) {
        // tooth k sits at drum angle A1 + entry0 + 10k (it meets station s at θ = entry0 + (s − 1)·22.5 + 10k)
        const phi = L.A1 + G.entry0 + k * G.tooth;
        q.setFromAxisAngle(new V3(0, 1, 0), phi * D2R);
        m4.compose(P((L.drumR + L.toothR) / 2 - 0.15, phi, r.y), q, new V3(1, 1, 1));
        im.setMatrixAt(i, m4);
        im.setColorAt(i, new THREE.Color(1, 1, 1));
        teeth.push({...r, k, i});
        i++;
      }
    im.instanceColor.needsUpdate = true;
    drumSpin.add(im);
    groups.teeth = im;
    // collars between the rows, thin rings that read as the drum's stepped body
    for (let d = 0; d <= 9; d++) {
      const c = mesh('drum', cyl(L.drumR + 0.2, L.drumR + 0.2, 0.25, 64), M.satinBlack, drumSpin);
      at(c, yRow(d) - G.shift / 2 - 0.6);
    }
    // the carry bell: a disc with one tooth
    const bell = mesh('drum', cyl(7.0, 7.4, 1.4, 64), M.steel, drumSpin);
    at(bell, 46.8);
    const phiC = L.A1 + G.carry0;
    const ct = mesh('drum', new THREE.BoxGeometry(1.6, 2.6, 1.8), ACC(), drumSpin);
    ct.position.copy(P(7.9, phiC, 47.2));
    ct.rotation.y = phiC * D2R;
    groups.carryTooth = ct;
    A.drum = new V3(0, 30, 0);
    A.drumTop = new V3(0, 47, 0);
  }

  // ================================================================ shafts: 11 stations, counting gears, forks, carry levers
  grp('shafts');
  const st = [];
  {
    const gearG = gearGeom(10, L.gearR, L.gearR - 0.55, 1.0);
    const pinG = gearGeom(10, 1.7, 1.25, 0.9);
    for (let s = 1; s <= G.active; s++) {
      const a = azOf(s);
      const base = P(L.shaftR, a, 0);
      const piv = new THREE.Group();
      piv.position.copy(base);
      groups.shafts.add(piv);
      const spin = new THREE.Group();
      piv.add(spin);
      const sh = mesh('shafts', new THREE.BoxGeometry(1.3, 46, 1.3), M.steel, spin);
      sh.position.y = 16.5 + 23;
      const gear = mesh('shafts', gearG, ACC(), spin);
      gear.material.color.set('#a89878');
      gear.position.y = yRow(0);
      const pin = mesh('shafts', pinG, M.brass, spin);
      pin.position.y = 49.6;
      // the coupling at the top, under the carriage
      const cup = mesh('shafts', cyl(1.6, 1.6, 1.2, 16), M.brass, spin);
      cup.position.y = 62.2;
      // the extra cog of the first column, met by the ten row when the drum is up [V]
      if (s === 1) {
        const cog = mesh('shafts', gearG, M.brass, spin);
        cog.position.y = yRow(0) + G.shift;
      }
      // fork from the slider to the gear (sliders only)
      let fork = null;
      if (s <= CURTA.sliders) {
        fork = new THREE.Group();
        groups.shafts.add(fork);
        fork.rotation.y = a * D2R;
        const bar = mesh('shafts', new THREE.BoxGeometry(0.45, 0.8, L.shellR - 1.6 - L.shaftR - 1.2), M.satinBlack, fork);
        bar.position.set(0, 0, (L.shaftR + 1.2 + L.shellR - 1.6) / 2);
        const yoke = mesh('shafts', new THREE.BoxGeometry(3.4, 0.4, 1.0), M.satinBlack, fork);
        yoke.position.set(0, 0.85, L.shaftR + 0.9);
      }
      // carry lever (stations 2..11): pivots on the frame, presses the pinion down [F]
      let lever = null;
      if (s >= 2) {
        lever = new THREE.Group();
        groups.shafts.add(lever);
        lever.position.copy(P(12.6, a, 53.2));
        lever.rotation.y = a * D2R;
        const arm = mesh('shafts', new THREE.BoxGeometry(0.8, 0.9, 3.6), ACC(), lever);
        arm.material.color.set('#b9bdc3');
        arm.material.metalness = 1;
        arm.position.set(0, -0.4, -1.6);
        const up = mesh('shafts', new THREE.BoxGeometry(0.8, 6.4, 0.8), M.steel, lever);
        up.position.set(0, 3.0, 0.1);
        const pv = mesh('shafts', new THREE.CylinderGeometry(0.6, 0.6, 1.8, 12), M.polished, lever);
        pv.rotation.z = Math.PI / 2;
        lever.userData.arm = arm;
      }
      const smats = [];
      for (const o of [piv, fork, lever]) o?.traverse((m) => m.isMesh && smats.push(m.material));
      st.push({s, a, piv, spin, gear, pin, fork, lever, smats});
    }
    // the frame ring that carries the lever pivots
    const fr = mesh('shafts', new THREE.TorusGeometry(12.6, 0.5, 8, 96), M.steel);
    fr.rotation.x = Math.PI / 2;
    fr.position.y = 53.2;
    const plate = mesh('shafts', new THREE.RingGeometry(3.0, 14.5, 96), M.satinBlack);
    plate.material.side = THREE.DoubleSide;
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = 16.4;
    A.shaft = (s) => P(L.shaftR, azOf(s), 30);
    A.lever = (s) => P(12.6, azOf(s), 52);
  }
  groups.st = st;

  // ================================================================ carriage: knurled ring, top plate, digit drums
  grp('carriage');
  const car = groups.carriage;
  const wheels = [];
  const ctrs = [];
  {
    const [y0, y1] = L.carY;
    const ring = mesh('carriage', cyl(L.carR, L.carR, y1 - y0 - 2, 128, true), M.knurl);
    ring.material.normalMap = knurlN.clone();
    ring.material.normalMap.repeat.set(90, 8);
    ring.material.side = THREE.DoubleSide;
    at(ring, (y0 + y1) / 2);
    const lo = [[L.bandR - 0.4, y0], [L.carR - 0.8, y0], [L.carR, y0 + 0.8], [L.carR, y0 + 1.0]].map(([x, y]) => new THREE.Vector2(x, y));
    mesh('carriage', new THREE.LatheGeometry(lo, 128), M.satinBlack);
    const hi = [[L.carR, y1 - 1.0], [L.carR, y1 - 0.8], [L.carR - 0.8, y1], [L.carR - 1.0, y1]].map(([x, y]) => new THREE.Vector2(x, y));
    mesh('carriage', new THREE.LatheGeometry(hi, 128), M.satinBlack);
    const inner = mesh('carriage', cyl(L.carR - 3.5, L.carR - 3.5, y1 - y0, 96, true), M.dark);
    inner.material.side = THREE.DoubleSide;
    at(inner, (y0 + y1) / 2);
    const plate = mesh('carriage', plateGeom(), M.satinBlack);
    plate.material.color.set('#111113');
    // result digit drums, axles lying radially
    for (let j = 1; j <= CURTA.result; j++) {
      const a = L.A1 - (j - 1) * G.pitch;
      const piv = new THREE.Group();
      piv.rotation.y = a * D2R - Math.PI / 2; // local +x radial outward
      car.add(piv);
      const roll = new THREE.Group();
      roll.position.set(L.wheelAt, L.plateY[0] - L.wheelR + 0.35, 0);
      piv.add(roll);
      const g = new THREE.CylinderGeometry(L.wheelR, L.wheelR, L.wheelW, 40, 1, false);
      g.rotateZ(-Math.PI / 2);
      const w = mesh('carriage', g, std({map: resultTex, roughness: 0.5, color: '#ffffff'}), roll);
      w.castShadow = false;
      // its bevel and stub down to the coupling
      const bev = mesh('carriage', new THREE.CylinderGeometry(1.6, 0.9, 1.4, 16), M.brass, roll);
      bev.rotation.z = Math.PI / 2;
      bev.position.x = -L.wheelW / 2 - 4.4;
      const ax = mesh('carriage', new THREE.CylinderGeometry(0.45, 0.45, L.wheelAt - 10, 8), M.steel, piv);
      ax.rotation.z = Math.PI / 2;
      ax.position.set((L.wheelAt + 10) / 2 - 0.5, roll.position.y, 0);
      const stub = mesh('carriage', new THREE.CylinderGeometry(0.8, 0.8, roll.position.y - 63.2, 10), M.steel, piv);
      stub.position.set(L.shaftR, (roll.position.y + 63.2) / 2, 0);
      wheels.push({j, piv, roll, w});
    }
    // counter drums, inner ring, between the result columns
    for (let c = 1; c <= CURTA.counter; c++) {
      const a = L.A1 - (c - 0.5) * G.pitch;
      const piv = new THREE.Group();
      piv.rotation.y = a * D2R - Math.PI / 2;
      car.add(piv);
      const roll = new THREE.Group();
      roll.position.set(L.ctrAt, L.plateY[0] - L.ctrR + 0.3, 0);
      piv.add(roll);
      const g = new THREE.CylinderGeometry(L.ctrR, L.ctrR, L.ctrW, 32, 1, false);
      g.rotateZ(-Math.PI / 2);
      const w = mesh('carriage', g, std({map: ctrTex, roughness: 0.5, color: '#ffffff'}), roll);
      w.castShadow = false;
      ctrs.push({c, piv, roll, w});
    }
    A.result = (j) => {
      const v = new V3(L.wheelAt, L.plateY[1], 0);
      return wheels[j - 1].piv.localToWorld(v);
    };
    A.counter = (c) => ctrs[c - 1].piv.localToWorld(new V3(L.ctrAt, L.plateY[1], 0));
    A.carriage = (a) => P(L.carR, a, 71);
  }

  // ================================================================ clearing ring with its fold-out lever
  grp('ring');
  {
    const y = L.plateY[1];
    const pr = [[L.ringR[0], y], [L.ringR[1] - 0.6, y], [L.ringR[1], y + 0.6], [L.ringR[1], y + 1.0], [L.ringR[1] - 0.6, y + 1.4], [L.ringR[0] + 0.4, y + 1.4], [L.ringR[0], y + 1.0]].map(([x, yy]) => new THREE.Vector2(x, yy));
    mesh('ring', new THREE.LatheGeometry(pr, 128), M.steel);
    const lever = new THREE.Group();
    lever.position.copy(P(L.ringR[1] - 0.2, -100, y + 0.8));
    lever.rotation.y = -100 * D2R;
    groups.ring.add(lever);
    const loop = mesh('ring', new THREE.TorusGeometry(4.2, 0.7, 10, 32), M.steel, lever);
    loop.rotation.x = Math.PI / 2;
    loop.position.set(0, 0, 3.6);
    groups.ringLever = lever;
    A.ring = P(L.ringR[1], -100, y + 1);
  }

  // ================================================================ crank
  grp('crank');
  const crankSpin = new THREE.Group();
  groups.crank.add(crankSpin);
  {
    const y = L.plateY[1] + 1.4;
    const prof = [[0, y], [4.8, y], [5.2, y + 0.6], [5.2, y + 3.4]];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 2);
      prof.push([5.2 * Math.cos(a), y + 3.4 + 4.6 * Math.sin(a)]);
    }
    mesh('crank', new THREE.LatheGeometry(prof.map(([x, yy]) => new THREE.Vector2(Math.max(0.001, x), yy)), 64), M.satinBlack, crankSpin);
    const yA = y + 7.2;
    const arm = mesh('crank', new THREE.BoxGeometry(4.4, 2.6, L.crankArm), M.steel, crankSpin);
    arm.position.set(0, yA, L.crankArm / 2);
    const elbow = mesh('crank', new THREE.CylinderGeometry(2.6, 2.6, 2.6, 24), M.steel, crankSpin);
    elbow.position.set(0, yA, L.crankArm);
    const knob = mesh('crank', new THREE.CylinderGeometry(3.2, 3.2, 12, 40), M.knurl, crankSpin);
    knob.material.normalMap = knurlN.clone();
    knob.material.normalMap.repeat.set(10, 7);
    knob.position.set(0, yA + 1.3 + 6.2, L.crankArm);
    const cap = mesh('crank', new THREE.SphereGeometry(3.2, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.satinBlack, crankSpin);
    cap.scale.y = 0.35;
    cap.position.set(0, yA + 1.3 + 12.2, L.crankArm);
    const screw = mesh('crank', new THREE.CylinderGeometry(0.8, 0.8, 0.6, 12), M.polished, crankSpin);
    screw.position.set(0, y + 8.05, 0);
    A.crank = new V3(0, yA + 6, L.crankArm);
    A.crankHub = new V3(0, y + 5, 0);
  }
  // the crank's home: the arm points back-left, clear of the windows in the 3/4 view
  const HOME = 205;

  // ---------------------------------------------------------------- contact shadow blob
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(130, 130),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(
        canvas(256, 256, (g) => {
          const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
          gr.addColorStop(0, 'rgba(30,26,20,0.62)');
          gr.addColorStop(0.32, 'rgba(30,26,20,0.38)');
          gr.addColorStop(0.62, 'rgba(30,26,20,0.08)');
          gr.addColorStop(1, 'rgba(30,26,20,0)');
          g.fillStyle = gr;
          g.fillRect(0, 0, 256, 256);
        }),
      ),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.05;
  blob.renderOrder = -1;
  root.add(blob);
  groups.blob = blob;

  // ---------------------------------------------------------------- cutaway, glass, ghosts
  const HOUSING = ['base', 'shell', 'carriage', 'ring'];
  const CLIP = new THREE.Plane(new V3(0, 0, -1), 0);
  let cutMode = '';
  const setCut = (mode) => {
    if (mode === cutMode) return;
    cutMode = mode;
    for (const g of HOUSING)
      for (const m of mats.get(g)) {
        m.clippingPlanes = mode === 'section' ? [CLIP] : null;
        m.clipShadows = true;
        m.needsUpdate = true;
      }
  };
  const fadeM = (m, o) => {
    const t = o < 0.995;
    if (m.transparent !== t) {
      m.transparent = t;
      m.needsUpdate = true;
    }
    m.opacity = o;
    m.depthWrite = !t || o > 0.6;
  };
  const fade = (g, o) => {
    for (const m of mats.get(g)) {
      const t = o < 0.995;
      if (m.transparent !== t) {
        m.transparent = t;
        m.needsUpdate = true;
      }
      m.opacity = o;
      m.depthWrite = !t || o > 0.6;
    }
  };

  // ---------------------------------------------------------------- update: one frame from the model's state
  const white = new THREE.Color(1, 1, 1);
  const accLit = new THREE.Color('#ffb53a');
  const lastLit = new Set();
  /**
   * S: machine state (machine.js state()). fx: {explode 0..1, glass 0..1, cut, clipAz (deg), ghost: {group: o}}
   */
  const update = (S, fx) => {
    const e = fx.explode ?? 0;
    const ex = (v) => v * e;
    groups.base.position.y = ex(-56);
    groups.shell.position.y = ex(-56);
    groups.drum.position.y = S.up * G.shift + ex(0);
    groups.shafts.position.y = 0;
    groups.carriage.position.y = S.lift * G.lift + ex(24);
    groups.ring.position.y = S.lift * G.lift + ex(38);
    groups.crank.position.y = S.up * G.shift + S.lift * G.lift + ex(54);
    blob.position.y = ex(-56) + 0.05;
    blob.material.opacity = 1 - 0.55 * e;
    const th = S.theta;
    drumSpin.rotation.y = -th * D2R;
    crankSpin.rotation.y = (HOME - th) * D2R;
    // carriage turned to its position
    car.rotation.y = (S.carPos - 1) * G.pitch * D2R;
    groups.ring.rotation.y = (S.carPos - 1) * G.pitch * D2R - S.ring * D2R;
    groups.ringLever.rotation.x = 0;
    groups.ringLever.children[0].position.y = S.phase === 'clear' ? 1.6 * Math.sin(Math.PI * Math.min(1, S.k * 1.2)) : 0;
    // digit drums: value v at the top → α = 270° − 36°(v + ½)
    for (const w of wheels) w.roll.rotation.x = (270 - 36 * (S.regPos[w.j - 1] + 0.5)) * D2R;
    for (const c of ctrs) c.roll.rotation.x = (270 - 36 * (S.ctrPos[c.c - 1] + 0.5)) * D2R;
    // sliders, their tapes, forks and gears
    for (let i = 0; i < CURTA.sliders; i++) {
      const y = yRow(S.setPos[i]);
      groups.sliders[i].position.y = y;
      const map = groups.sliders[i].userData.win.material.map;
      map.offset.y = 0.9 - S.setPos[i] * 0.1;
    }
    // shafts: each turns with the column above it; its pose comes from the cumulative teeth it has taken
    const turn = S.turn;
    for (const x of st) {
      const d = x.s <= CURTA.sliders ? S.setPos[x.s - 1] : 0;
      x.gear.position.y = yRow(d);
      if (x.fork) x.fork.position.y = yRow(d);
      x.spin.rotation.y = (S.shaft?.[x.s] ?? 0) * 36 * D2R;
      if (x.lever) {
        const a = S.arms[x.s] ?? 0;
        x.lever.rotation.x = -a * 0.42;
        x.pin.position.y = 49.6 - 1.3 * a;
      }
    }
    // accent: the teeth working now, the gear and the column they drive, the carry in flight
    for (const i of lastLit) groups.teeth.setColorAt(i, white);
    lastLit.clear();
    for (const x of st) {
      x.gear.material.emissiveIntensity = 0;
      x.gear.material.color.set('#a89878');
      if (x.lever) {
        x.lever.userData.arm.material.emissiveIntensity = 0;
        x.lever.userData.arm.material.color.set('#b9bdc3');
      }
    }
    for (const w of wheels) w.w.material.emissive?.set(0);
    groups.carryTooth.material.emissiveIntensity = 0;
    const lit = (m, k = 1) => {
      m.color.copy(accentC).lerp(accLit, 0.25);
      m.emissive.copy(accentC);
      m.emissiveIntensity = 0.45 * k;
    };
    const focus = fx.focusStation ?? (turn && S.active?.tooth?.station);
    if (turn && focus) {
      const s = focus;
      const d = s <= CURTA.sliders ? S.set[s - 1] : 0;
      const kind = turn.sign > 0 ? 'add' : 'comp';
      for (const t of teeth) {
        const row = (t.kind === kind && t.d === d && (kind === 'comp' || d > 0)) || (turn.sign < 0 && s === 1 && t.kind === 'ten');
        if (row) {
          groups.teeth.setColorAt(t.i, accLit);
          lastLit.add(t.i);
        }
      }
      const x = st[s - 1];
      lit(x.gear.material);
    }
    for (const x of st) if (x.lever && (S.arms[x.s] ?? 0) > 0.05) lit(x.lever.userData.arm.material, S.arms[x.s]);
    if (turn && S.active?.carry) lit(groups.carryTooth.material);
    groups.teeth.instanceColor.needsUpdate = true;
    // glass and ghosts
    const glass = fx.glass ?? 0;
    for (const g of HOUSING) fade(g, Math.min(fx.ghost?.[g] ?? 1, 1 - 0.86 * glass));
    for (const g of ['drum', 'shafts', 'crank']) fade(g, fx.ghost?.[g] ?? 1);
    // one subsystem isolated: the other stations fade, the working ones stay
    const iso = fx.iso ?? 0;
    if (iso > 0.001)
      for (const x of st) {
        const o = Math.min(fx.ghost?.shafts ?? 1, fx.isoStations?.includes(x.s) ? 1 : 1 - 0.86 * iso);
        for (const m of x.smats) fadeM(m, o);
      }
    // the cut faces the camera
    const ca = (fx.clipAz ?? 0) * D2R;
    CLIP.normal.set(-Math.sin(ca), 0, -Math.cos(ca));
    CLIP.constant = 0;
    root.updateMatrixWorld(true);
  };

  return {root, groups, update, setCut, A, mats, teeth, st, wheels, ctrs, HOUSING};
}

/** world position (metres) of a model point in mm, before any group transform */
export const mm = (v) => v.clone().multiplyScalar(0.001);
export {thetaCarry, stationOf};
