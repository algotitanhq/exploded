// The QPU's geometry, built from code, in metres. Two cabinets like Lucy at the TGCC [L] (ribbed blue glass doors,
// open outward), the photon's path inside them. Exterior from the photos; the interior arrangement is not public and
// is an estimate [E]: left cabinet = laser, source cryostat, its compressor; right cabinet = demultiplexer, delay
// spools, photonic chip, detector cryostat, time tagger, control server, second compressor.
//
// update(fx) poses everything for one frame: photon sprites, the waveguide glow, detector pixels, laser/QD flashes,
// doors, cutaway, isolation. It holds no time of its own.
import * as THREE from 'three';
import {MZI, P, delayLen, outPort, inMode} from './photonics.js';

const V3 = THREE.Vector3;
export const ACCENT = '#6b3cf2';

// ------------------------------------------------------------ a polyline you can walk by arc length
export class Path {
  constructor(pts) {
    this.p = pts.map((q) => (q.isVector3 ? q.clone() : new V3(...q)));
    this.c = [0];
    for (let i = 1; i < this.p.length; i++) this.c.push(this.c[i - 1] + this.p[i].distanceTo(this.p[i - 1]));
    this.len = this.c[this.c.length - 1];
  }
  at(f, out = new V3()) {
    const s = Math.min(1, Math.max(0, f)) * this.len;
    let lo = 0;
    let hi = this.c.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.c[mid] <= s) lo = mid;
      else hi = mid;
    }
    const seg = this.c[hi] - this.c[lo] || 1;
    return out.copy(this.p[lo]).lerp(this.p[hi], (s - this.c[lo]) / seg);
  }
  concat(o) {
    return new Path([...this.p, ...o.p.slice(1)]);
  }
  reverse() {
    return new Path([...this.p].reverse());
  }
}
const smoothPath = (pts, n = 48) => new Path(new THREE.CatmullRomCurve3(pts.map((q) => new V3(...q)), false, 'centripetal').getPoints(n));

// ------------------------------------------------------------ layout [E], metres; y up, z toward the viewer
export const L = {
  rackW: 0.8,
  rackH: 2.0,
  rackD: 1.1,
  xl: -0.41,
  xr: 0.41,
  // source cryostat (left)
  cs: {x: -0.41, y: 1.12, z: 0.08, r: 0.16, h: 0.55},
  // detector cryostat (right)
  cd: {x: 0.41, y: 0.8, z: 0.08, r: 0.13, h: 0.45},
  qd: new V3(-0.41, 1.074, 0.08),
  chip: {x: 0.41, y: 1.3558, z: 0.25, len: 0.024, pitch: 0.00025, w: 0.03, d: 0.01},
  tray: {y: 1.645},
  demux: {x: 0.41, y: 1.83, z: -0.15},
  tagger: {x: 0.41, y: 0.4525, z: 0.12},
};
const C = L.chip;
export const modeZ = (m) => C.z + (m - (P.modes - 1) / 2) * C.pitch;
export const chipX = (f) => C.x - C.len / 2 + f * C.len;

export function buildMachine() {
  const root = new THREE.Group();
  const groups = {};
  const mats = new Map(); // group -> [{m, base}]
  const std = (o) => new THREE.MeshStandardMaterial({roughness: 0.5, metalness: 0.2, envMapIntensity: 0.6, ...o});
  const B = {
    body: std({color: '#2b2e34', roughness: 0.6, metalness: 0.35}),
    edge: std({color: '#40444c', roughness: 0.5, metalness: 0.5}),
    panel: std({color: '#eceef0', roughness: 0.55, metalness: 0.05}),
    panelDark: std({color: '#4a4e56', roughness: 0.55, metalness: 0.2}),
    alu: std({color: '#c3c7cd', roughness: 0.45, metalness: 0.7, envMapIntensity: 0.5}),
    shield: std({color: '#d9dbe0', roughness: 0.35, metalness: 0.8, envMapIntensity: 0.5, side: THREE.DoubleSide}),
    can: std({color: '#b9bec6', roughness: 0.45, metalness: 0.7, envMapIntensity: 0.5, side: THREE.DoubleSide}),
    steel: std({color: '#a9aeb5', roughness: 0.45, metalness: 0.75, envMapIntensity: 0.5}),
    copper: std({color: '#c47a4c', roughness: 0.45, metalness: 0.85, envMapIntensity: 0.55}),
    gold: std({color: '#d6a944', roughness: 0.35, metalness: 0.95, envMapIntensity: 0.6}),
    silicon: std({color: '#3a3f4b', roughness: 0.3, metalness: 0.3}),
    glassFA: new THREE.MeshPhysicalMaterial({color: '#dfe7ef', roughness: 0.1, transparent: true, opacity: 0.55}),
    spool: std({color: '#f1f2f4', roughness: 0.6, metalness: 0}),
    hose: std({color: '#9aa0a8', roughness: 0.5, metalness: 0.6}),
    vent: std({color: '#1d1f23', roughness: 0.8, metalness: 0.1}),
    doorGlass: new THREE.MeshPhysicalMaterial({color: '#8fa6f0', roughness: 0.2, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide}),
    slat: std({color: '#4d6ee6', roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.42, depthWrite: false}),
    led: new THREE.MeshBasicMaterial({color: '#f4f7ff'}),
    pcb: std({color: '#2d4a43', roughness: 0.6, metalness: 0.1}),
    black: std({color: '#25272b', roughness: 0.55, metalness: 0.2}),
    carrier: std({color: '#5b616b', roughness: 0.5, metalness: 0.4}),
  };
  const fibreMat = new THREE.LineBasicMaterial({color: '#7f868f', transparent: true, opacity: 0.9});
  const recs = [];
  const matFor = (g, m) => {
    if (!mats.has(g)) mats.set(g, new Map());
    const mm = mats.get(g);
    if (!mm.has(m)) {
      const c = m.clone();
      const rec = {g, m: c, op: m.transparent ? m.opacity : 1, tr: m.transparent, dw: m.depthWrite};
      mm.set(m, rec);
      recs.push(rec);
    }
    return mm.get(m).m;
  };
  const grp = (g) => {
    if (!groups[g]) {
      groups[g] = new THREE.Group();
      root.add(groups[g]);
    }
    return groups[g];
  };
  const add = (g, geo, m, pos, opt = {}) => {
    const mesh = new THREE.Mesh(geo, matFor(g, m));
    if (pos) mesh.position.set(...pos);
    if (opt.rot) mesh.rotation.set(...opt.rot);
    mesh.castShadow = opt.shadow ?? true;
    mesh.receiveShadow = true;
    (opt.parent || grp(g)).add(mesh);
    return mesh;
  };
  const box = (g, w, h, d, m, pos, opt) => add(g, new THREE.BoxGeometry(w, h, d), m, pos, opt);
  const cyl = (g, r, h, m, pos, opt = {}) => add(g, new THREE.CylinderGeometry(opt.r2 ?? r, r, h, opt.seg ?? 48, 1, !!opt.open), m, pos, opt);
  const line = (g, path, m = fibreMat) => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.p), matFor(g, m));
    grp(g).add(l);
    return l;
  };

  // ------------------------------------------------------------ cabinets
  const doors = [];
  for (const [side, x] of [[-1, L.xl], [1, L.xr]]) {
    const W = L.rackW;
    const H = L.rackH;
    const D = L.rackD;
    box('rack', W, 0.06, D, B.vent, [x, 0.03, 0]); // plinth
    box('rack', W - 0.1, 0.022, 0.01, B.edge, [x, 0.03, D / 2 + 0.002], {shadow: false}); // plinth grille
    box('rack', W, 0.04, D, B.body, [x, H - 0.02, 0]); // roof
    box('rack', W, H - 0.1, 0.02, B.body, [x, H / 2, -D / 2 + 0.01]); // back
    box('rack', 0.02, H - 0.1, D, B.body, [x + side * (W / 2 - 0.01), H / 2, 0]); // outer side
    box('rack', 0.012, H - 0.1, D, B.edge, [x - side * (W / 2 - 0.006), H / 2, 0]); // inner side
    for (const sx of [-1, 1]) box('rack', 0.03, H - 0.1, 0.03, B.edge, [x + sx * (W / 2 - 0.05), H / 2, D / 2 - 0.06]); // posts
    // the door: hinge on the outer edge, a frame, a glass sheet behind vertical blue ribs, an LED strip on the inside edge
    const pivot = new THREE.Group();
    pivot.position.set(x + side * (W / 2), 0, D / 2 + 0.012);
    grp('rack').add(pivot);
    const dw = W - 0.02;
    const dx = -side * dw / 2;
    const fr = (w, h, px, py) => add('rack', new THREE.BoxGeometry(w, h, 0.024), B.body, [px, py, 0], {parent: pivot});
    fr(dw, 0.05, dx, H - 0.065);
    fr(dw, 0.05, dx, 0.095);
    fr(0.05, H - 0.13, dx - dw / 2 + 0.025, H / 2);
    fr(0.05, H - 0.13, dx + dw / 2 - 0.025, H / 2);
    add('rack', new THREE.PlaneGeometry(dw - 0.1, H - 0.23), B.doorGlass, [dx, H / 2, 0.004], {parent: pivot, shadow: false});
    const ns = 15;
    const slat = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, H - 0.24, 0.012), matFor('rack', B.slat), ns);
    for (let i = 0; i < ns; i++) slat.setMatrixAt(i, new THREE.Matrix4().makeTranslation(dx - (dw - 0.14) / 2 + (i * (dw - 0.14)) / (ns - 1), H / 2, -0.004));
    slat.castShadow = false;
    pivot.add(slat);
    add('rack', new THREE.BoxGeometry(0.008, H - 0.26, 0.006), B.led, [dx - side * (dw / 2 - 0.06), H / 2, -0.012], {parent: pivot, shadow: false});
    add('rack', new THREE.BoxGeometry(0.014, 0.12, 0.02), B.alu, [dx - side * (dw / 2 - 0.09), H * 0.62, 0.022], {parent: pivot});
    doors.push({pivot, side});
  }

  // ------------------------------------------------------------ left: laser, filter box, source cryostat, compressor
  box('laser', 0.6, 0.13, 0.7, B.panel, [L.xl, 1.72, 0.05]);
  box('laser', 0.6, 0.13, 0.008, B.panelDark, [L.xl, 1.72, 0.404]);
  box('laser', 0.07, 0.012, 0.004, B.led, [L.xl - 0.2, 1.75, 0.41], {shadow: false});
  cyl('laser', 0.008, 0.02, B.steel, [-0.25, 1.70, 0.414], {rot: [Math.PI / 2, 0, 0]});
  box('laser', 0.12, 0.05, 0.08, B.panel, [-0.16, 1.47, 0.25]); // filtering: bandpass + polariser [A fig. 1]
  const cs = L.cs;
  const can = [];
  can.push(cyl('source', cs.r, cs.h, B.can, [cs.x, cs.y, cs.z], {open: true, seg: 64}));
  can.push(cyl('source', cs.r, 0.012, B.can, [cs.x, cs.y + cs.h / 2, cs.z], {seg: 64}));
  can.push(cyl('source', cs.r, 0.012, B.can, [cs.x, cs.y - cs.h / 2, cs.z], {seg: 64}));
  const shield = [];
  shield.push(cyl('source', 0.13, 0.45, B.shield, [cs.x, cs.y - 0.01, cs.z], {open: true, seg: 64}));
  shield.push(cyl('source', 0.13, 0.008, B.shield, [cs.x, cs.y + 0.215, cs.z], {seg: 64}));
  cyl('source', 0.065, 0.2, B.steel, [cs.x, cs.y + cs.h / 2 + 0.1, cs.z]); // cold head
  cyl('source', 0.05, 0.06, B.black, [cs.x, cs.y + cs.h / 2 + 0.17, cs.z]);
  cyl('source', 0.02, 0.27, B.copper, [cs.x, 1.195, cs.z - 0.065]); // cold finger to the 4 K plate, off-axis
  cyl('source', 0.1, 0.012, B.copper, [cs.x, 1.05, cs.z]); // 4 K plate
  box('source', 0.05, 0.012, 0.05, B.alu, [cs.x, 1.062, cs.z]); // the sample stage as in the photos: alu block,
  box('source', 0.032, 0.004, 0.032, B.gold, [cs.x, 1.07, cs.z]); // gold-plated mount,
  box('source', 0.014, 0.003, 0.012, B.gold, [cs.x + 0.004, 1.0735, cs.z - 0.004]);
  cyl('source', 0.006, 0.014, B.steel, [cs.x, 1.079, cs.z], {seg: 24}); // fibre ferrule over the micropillar
  cyl('source', 0.008, 0.012, B.steel, [-0.3, cs.y + cs.h / 2 + 0.006, cs.z], {seg: 16}); // fibre feedthrough
  box('source', 0.66, 0.54, 0.8, B.panel, [L.xl, 0.35, -0.05]); // He compressor
  for (let i = 0; i < 7; i++) box('source', 0.5, 0.012, 0.006, B.vent, [L.xl, 0.18 + i * 0.05, 0.352], {shadow: false});
  const hose = (g, pts, r = 0.011) => add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new V3(...q))), 48, r, 10), B.hose, null);
  hose('source', [[-0.56, 0.62, -0.3], [-0.62, 1.0, -0.32], [-0.6, 1.45, -0.1], [-0.47, 1.5, 0.08]]);
  hose('source', [[-0.5, 0.62, -0.32], [-0.56, 1.0, -0.36], [-0.54, 1.52, -0.14], [-0.41, 1.56, -0.0]]);

  // ------------------------------------------------------------ right: demux, spools, chip, detector cryostat, electronics
  const dm = L.demux;
  box('demux', 0.6, 0.09, 0.5, B.panel, [dm.x, dm.y, dm.z]);
  box('demux', 0.6, 0.09, 0.008, B.panelDark, [dm.x, dm.y, dm.z + 0.252]);
  const portX = (j) => 0.19 + j * 0.04;
  for (let j = 0; j < P.demuxOut; j++) cyl('demux', 0.005, 0.014, B.steel, [portX(j), 1.815, 0.11], {rot: [Math.PI / 2, 0, 0], seg: 12});
  cyl('demux', 0.005, 0.014, B.steel, [0.15, 1.845, 0.11], {rot: [Math.PI / 2, 0, 0], seg: 12});
  box('demux', 0.62, 0.01, 0.34, B.alu, [L.xr, 1.63, 0.285]); // spool tray, in front of the demux
  const spoolAt = (j) => new V3(0.16 + (j % 6) * 0.1, L.tray.y, j < 6 ? 0.2 : 0.37);
  const coils = [];
  for (let j = 0; j < P.demuxOut; j++) {
    const s = spoolAt(j);
    cyl('demux', 0.036, 0.018, B.spool, [s.x, s.y, s.z], {seg: 40});
    cyl('demux', 0.046, 0.002, B.spool, [s.x, s.y - 0.009, s.z], {seg: 40});
    // the delay line wound on it: turns from its real length (1 m + (11 − j) × 2.55 m) [E for the spool size]
    const turns = delayLen(j) / (2 * Math.PI * 0.037);
    const pts = [];
    const nseg = Math.ceil(turns * 20);
    for (let i = 0; i <= nseg; i++) {
      const u = i / nseg;
      const a = u * turns * 2 * Math.PI;
      pts.push(new V3(s.x + 0.0375 * Math.cos(a), s.y + 0.008 - u * 0.016, s.z + 0.0375 * Math.sin(a)));
    }
    const coil = new Path(pts);
    coils.push(coil);
    line('demux', coil, new THREE.LineBasicMaterial({color: '#5f666f'}));
  }
  // chip tray: plate, PCB, copper carrier, the Si3N4 chip, fibre arrays at both ends
  box('chip', 0.5, 0.01, 0.42, B.alu, [L.xr, 1.335, 0.22]);
  box('chip', 0.16, 0.003, 0.11, B.pcb, [C.x, 1.3415, C.z]);
  box('chip', 0.05, 0.012, 0.028, B.carrier, [C.x, 1.346, C.z]);
  box('chip', C.w, 0.0006, C.d, B.silicon, [C.x, C.y - 0.0003, C.z]);
  box('chip', 0.005, 0.0022, 0.008, B.glassFA, [C.x - C.w / 2 - 0.0025, C.y, C.z]);
  box('chip', 0.005, 0.0022, 0.008, B.glassFA, [C.x + C.w / 2 + 0.0025, C.y, C.z]);
  {
    // bond pads along both long edges, feeding the heaters
    const pads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0004, 0.00005, 0.0006), matFor('chip', B.gold), 120);
    for (let i = 0; i < 120; i++) pads.setMatrixAt(i, new THREE.Matrix4().makeTranslation(C.x - 0.0135 + (i % 60) * 0.00046, C.y + 0.00003, C.z + (i < 60 ? 1 : -1) * 0.0043));
    pads.castShadow = false;
    grp('chip').add(pads);
  }
  const cd = L.cd;
  const can2 = [];
  can2.push(cyl('detect', cd.r, cd.h, B.can, [cd.x, cd.y, cd.z], {open: true, seg: 64}));
  can2.push(cyl('detect', cd.r, 0.012, B.can, [cd.x, cd.y + cd.h / 2, cd.z], {seg: 64}));
  can2.push(cyl('detect', cd.r, 0.012, B.can, [cd.x, cd.y - cd.h / 2, cd.z], {seg: 64}));
  const shield2 = [];
  shield2.push(cyl('detect', 0.105, 0.37, B.shield, [cd.x, cd.y - 0.01, cd.z], {open: true, seg: 64}));
  shield2.push(cyl('detect', 0.105, 0.008, B.shield, [cd.x, cd.y + 0.175, cd.z], {seg: 64}));
  cyl('detect', 0.055, 0.17, B.steel, [cd.x, cd.y + cd.h / 2 + 0.085, cd.z]);
  cyl('detect', 0.018, 0.16, B.copper, [cd.x, cd.y + 0.1, cd.z - 0.055]);
  cyl('detect', 0.085, 0.01, B.copper, [cd.x, cd.y + 0.015, cd.z]);
  box('detect', 0.03, 0.022, 0.03, B.copper, [cd.x, cd.y + 0.031, cd.z]);
  box('detect', 0.016, 0.001, 0.016, B.silicon, [cd.x, cd.y + 0.0425, cd.z]);
  cyl('detect', 0.008, 0.012, B.steel, [0.5, cd.y + cd.h / 2 + 0.006, cd.z], {seg: 16});
  const pix = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0016, 0.0004, 0.0016), new THREE.MeshBasicMaterial({color: '#ffffff'}), P.modes);
  const pixAt = (m) => new V3(cd.x - 0.0056 + (m % 6) * 0.00224, cd.y + 0.0432, cd.z - 0.0042 + Math.floor(m / 6) * 0.0028);
  for (let m = 0; m < P.modes; m++) {
    const q = pixAt(m);
    pix.setMatrixAt(m, new THREE.Matrix4().makeTranslation(q.x, q.y, q.z));
    pix.setColorAt(m, new THREE.Color('#9da3ad'));
  }
  grp('detect').add(pix);
  box('detect', 0.62, 0.22, 0.8, B.panel, [L.xr, 0.19, -0.05]); // second compressor
  for (let i = 0; i < 3; i++) box('detect', 0.5, 0.012, 0.006, B.vent, [L.xr, 0.13 + i * 0.05, 0.352], {shadow: false});
  hose('detect', [[0.27, 0.3, -0.3], [0.2, 0.75, -0.34], [0.26, 1.1, -0.1], [0.36, 1.12, 0.08]]);
  box('tagger', 0.5, 0.045, 0.4, B.panel, [L.tagger.x, L.tagger.y, L.tagger.z]);
  box('tagger', 0.5, 0.045, 0.006, B.panelDark, [L.tagger.x, L.tagger.y, L.tagger.z + 0.2]);
  for (let i = 0; i < 8; i++) cyl('tagger', 0.004, 0.01, B.gold, [0.24 + i * 0.03, L.tagger.y, 0.325], {rot: [Math.PI / 2, 0, 0], seg: 10});
  box('tagger', 0.6, 0.089, 0.7, B.panel, [L.xr, 0.365, 0.0]); // control server
  box('tagger', 0.6, 0.089, 0.006, B.panelDark, [L.xr, 0.365, 0.352]);
  for (let i = 0; i < 6; i++) box('tagger', 0.03, 0.06, 0.004, B.vent, [0.2 + i * 0.05, 0.365, 0.356], {shadow: false});

  // ------------------------------------------------------------ fibres and the photon's paths
  const ferrTop = new V3(cs.x, 1.086, cs.z);
  const feed = new V3(-0.3, cs.y + cs.h / 2 + 0.012, cs.z);
  const filt = new V3(-0.16, 1.47, 0.25);
  const laserPath = smoothPath([[-0.25, 1.70, 0.42], [-0.22, 1.6, 0.36], [filt.x, filt.y, filt.z], [-0.26, 1.46, 0.16], [feed.x, feed.y + 0.02, feed.z], [feed.x, feed.y, feed.z], [-0.33, 1.25, cs.z], [-0.4, 1.12, cs.z], [ferrTop.x, ferrTop.y + 0.008, ferrTop.z], [ferrTop.x, ferrTop.y, ferrTop.z]], 80).concat(new Path([ferrTop, L.qd]));
  // the photon leaves the micropillar up the same fibre, back out through the feedthrough and the filters
  const common = new Path([L.qd, ferrTop]).concat(smoothPath([[ferrTop.x, ferrTop.y, ferrTop.z], [ferrTop.x, ferrTop.y + 0.008, ferrTop.z], [-0.4, 1.12, cs.z], [-0.33, 1.25, cs.z], [feed.x, feed.y, feed.z], [feed.x, feed.y + 0.02, feed.z], [-0.26, 1.46, 0.16], [filt.x, filt.y, filt.z], [-0.05, 1.6, 0.32], [0.05, 1.84, 0.33], [0.15, 1.845, 0.12]], 96));
  line('laser', laserPath);
  line('demux', common);
  const dmxIn = new V3(0.15, 1.845, 0.11);
  const portIn = (j) => new Path([dmxIn, new V3(0.15, 1.83, 0.0), new V3(portX(j), 1.82, 0.0), new V3(portX(j), 1.815, 0.11)]);
  const portToSpool = (j) => {
    const s = spoolAt(j);
    const c0 = coils[j].p[0];
    return smoothPath([[portX(j), 1.815, 0.118], [portX(j), 1.775, 0.15], [portX(j) * 0.6 + s.x * 0.4, 1.7, 0.34], [c0.x, c0.y + 0.03, c0.z + 0.01], [c0.x, c0.y, c0.z]], 32);
  };
  const faIn = (m) => new V3(C.x - C.w / 2 - 0.005, C.y, modeZ(m));
  const faOut = (m) => new V3(C.x + C.w / 2 + 0.005, C.y, modeZ(m));
  const spoolToChip = (j, m) => {
    const e = coils[j].p[coils[j].p.length - 1];
    return smoothPath([[e.x, e.y, e.z], [e.x, e.y - 0.004, e.z + 0.03], [0.75, 1.6, 0.46], [0.75, 1.45, 0.46], [0.36, 1.39, 0.42], [faIn(m).x - 0.05, C.y + 0.004, C.z + 0.02], [faIn(m).x - 0.01, C.y, modeZ(m)], [faIn(m).x, faIn(m).y, faIn(m).z]], 64);
  };
  for (let j = 0; j < P.demuxOut; j++) {
    line('demux', portIn(j));
    line('demux', portToSpool(j));
    line('demux', spoolToChip(j, 2 * (j % 12)));
  }
  const feed2 = new V3(0.5, cd.y + cd.h / 2 + 0.012, cd.z);
  const outPath = (m) => {
    const q = pixAt(m);
    return smoothPath([[faOut(m).x, faOut(m).y, faOut(m).z], [faOut(m).x + 0.01, C.y, modeZ(m)], [faOut(m).x + 0.06, C.y + 0.003, C.z + 0.02], [0.66, 1.33, 0.42], [0.64, 1.15, 0.3], [feed2.x, feed2.y + 0.04, feed2.z], [feed2.x, feed2.y, feed2.z], [0.47, cd.y + 0.12, cd.z], [q.x, q.y + 0.02, q.z], [q.x, q.y, q.z]], 72);
  };
  const outs = Array.from({length: P.modes}, (_, m) => outPath(m));
  for (let m = 0; m < P.modes; m += 1) line('detect', outs[m], new THREE.LineBasicMaterial({color: '#8b929b', transparent: true, opacity: 0.55}));
  const coax = smoothPath([[cd.x, cd.y + 0.03, cd.z], [cd.x + 0.02, cd.y - 0.05, cd.z], [cd.x + 0.02, cd.y - cd.h / 2 - 0.006, cd.z], [cd.x + 0.05, 0.5, 0.25], [0.3, 0.47, 0.33], [0.3, L.tagger.y, 0.33]], 48);
  line('tagger', coax, new THREE.LineBasicMaterial({color: '#3a3d43'}));

  const photonPaths = new Map();
  /** photon k of an n-photon shot: the shared fibre, its demux output, its delay spool, to chip input mode 2k */
  const pathFor = (n, k) => {
    const key = `${n}:${k}`;
    if (!photonPaths.has(key)) {
      const j = outPort(n, k);
      photonPaths.set(key, {pre: common.concat(portIn(j)), coil: portToSpool(j).concat(coils[j]).concat(spoolToChip(j, inMode(k)))});
    }
    return photonPaths.get(key);
  };
  const homPath = (k) => {
    const key = `hom:${k}`;
    if (!photonPaths.has(key)) {
      const j = outPort(2, k);
      photonPaths.set(key, {pre: common.concat(portIn(j)), coil: portToSpool(j).concat(coils[j]).concat(spoolToChip(j, k))});
    }
    return photonPaths.get(key);
  };

  // ------------------------------------------------------------ the mesh: waveguides as ribbons on the chip, heaters
  const N = P.modes;
  const glowTex = new THREE.DataTexture(new Uint8Array((N + 1) * N * 4), N + 1, N, THREE.RGBAFormat);
  glowTex.magFilter = THREE.LinearFilter;
  glowTex.minFilter = THREE.LinearFilter;
  glowTex.needsUpdate = true;
  const U = {
    uField: {value: glowTex},
    uFront: {value: 0},
    uTail: {value: 0},
    uGain: {value: 0},
    uAfter: {value: 0},
    uBase: {value: new THREE.Color('#9aa1ad')},
    uAccent: {value: new THREE.Color(ACCENT)},
    uOpacity: {value: 1},
  };
  const wgMat = (halo) =>
    new THREE.ShaderMaterial({
      uniforms: {...U, uHalo: {value: halo ? 1 : 0}},
      transparent: true,
      depthWrite: !halo,
      vertexShader: `attribute vec2 aMX; varying vec2 vMX; void main(){ vMX = aMX; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D uField; uniform float uFront, uTail, uGain, uAfter, uHalo, uOpacity; uniform vec3 uBase, uAccent; varying vec2 vMX;
        void main(){
          float N = ${N.toFixed(1)};
          float I = texture2D(uField, vec2((vMX.y * N + 0.5) / (N + 1.0), (vMX.x + 0.5) / N)).r;
          float lit = (1.0 - smoothstep(uFront - 0.004, uFront + 0.004, vMX.y)) * smoothstep(uTail - 0.004, uTail + 0.004, vMX.y);
          float g = clamp(I * (lit * uGain + uAfter), 0.0, 1.0);
          if (uHalo > 0.5) { gl_FragColor = vec4(uAccent, g * 0.45 * uOpacity); }
          else { gl_FragColor = vec4(mix(uBase, uAccent, clamp(g * 1.6, 0.0, 1.0)), uOpacity); }
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
  const colAt = Array.from({length: N}, () => new Map());
  for (const z of MZI) colAt[z.c].set(z.i, z);
  const FR = [0, 0.08, 0.18, 0.26, 0.36, 0.52, 0.62, 0.7, 0.8, 1]; // straight, in, coupler, out, arm, in, coupler, out, phase
  const GAP = C.pitch * 0.18;
  const bend = (u) => u * u * (3 - 2 * u);
  const ribbon = (w) => {
    const pos = [];
    const mx = [];
    const idx = [];
    for (let m = 0; m < N; m++) {
      const pts = [];
      for (let c = 0; c < N; c++) {
        const z = colAt[c].get(m) ? 1 : colAt[c].get(m - 1) ? -1 : 0; // +1: upper mode of an MZI, −1: lower
        const pull = z === 0 ? 0 : z * (C.pitch / 2 - GAP / 2);
        const steps = 18;
        for (let s = 0; s < steps; s++) {
          const f = s / steps;
          let o = 0;
          if (f >= FR[1] && f < FR[2]) o = bend((f - FR[1]) / (FR[2] - FR[1]));
          else if (f >= FR[2] && f < FR[3]) o = 1;
          else if (f >= FR[3] && f < FR[4]) o = 1 - bend((f - FR[3]) / (FR[4] - FR[3]));
          else if (f >= FR[5] && f < FR[6]) o = bend((f - FR[5]) / (FR[6] - FR[5]));
          else if (f >= FR[6] && f < FR[7]) o = 1;
          else if (f >= FR[7] && f < FR[8]) o = 1 - bend((f - FR[7]) / (FR[8] - FR[7]));
          pts.push([(c + f) / N, modeZ(m) + o * pull]);
        }
      }
      pts.push([1, modeZ(m)]);
      const base = pos.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const [f, z] = pts[i];
        const x = chipX(f);
        pos.push(x, C.y + 0.00002, z - w / 2, x, C.y + 0.00002, z + w / 2);
        mx.push(m, f, m, f);
        if (i) {
          const a = base + (i - 1) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aMX', new THREE.Float32BufferAttribute(mx, 2));
    g.setIndex(idx);
    return g;
  };
  const wg = new THREE.Mesh(ribbon(0.000035), wgMat(false));
  const wgHalo = new THREE.Mesh(ribbon(0.00016), wgMat(true));
  wgHalo.position.y = 0.000005;
  wgHalo.renderOrder = 5;
  grp('chip').add(wg, wgHalo);
  // heaters: θ on the upper arm, φ on the upper output, per MZI; brightness follows the drive (φ = A·V² + b [A])
  const heat = new THREE.InstancedMesh(new THREE.BoxGeometry(C.len / N * 0.11, 0.00001, 0.000045), new THREE.MeshBasicMaterial({color: '#ffffff'}), MZI.length * 2);
  MZI.forEach((z, k) => {
    for (const [h, f] of [[0, (FR[4] + FR[5]) / 2], [1, (FR[8] + FR[9]) / 2]]) {
      const zz = modeZ(z.i) + (h === 0 ? 0 : 0);
      heat.setMatrixAt(k * 2 + h, new THREE.Matrix4().makeTranslation(chipX((z.c + f) / N), C.y + 0.00004, zz));
      heat.setColorAt(k * 2 + h, new THREE.Color('#c9a24a'));
    }
  });
  heat.renderOrder = 6;
  grp('chip').add(heat);

  // ------------------------------------------------------------ photons and flashes: screen-sized round sprites
  const MAXP = 160;
  const ptsGeo = new THREE.BufferGeometry();
  ptsGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MAXP * 3), 3));
  ptsGeo.setAttribute('aA', new THREE.Float32BufferAttribute(new Float32Array(MAXP), 1));
  ptsGeo.setAttribute('aS', new THREE.Float32BufferAttribute(new Float32Array(MAXP), 1));
  ptsGeo.setAttribute('aC', new THREE.Float32BufferAttribute(new Float32Array(MAXP * 3), 3));
  const ptsMat = new THREE.ShaderMaterial({
    uniforms: {uPR: {value: 1}},
    transparent: true,
    depthWrite: false,
    depthTest: false, // the photons are the subject: seen through fibres, boxes and cryostat walls
    vertexShader: `attribute float aA; attribute float aS; attribute vec3 aC; uniform float uPR; varying float vA; varying vec3 vC;
      void main(){ vA = aA; vC = aC; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aS * uPR; }`,
    fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard;
      float core = 1.0 - smoothstep(0.12, 0.3, r); float halo = (1.0 - r) * 0.55; vec3 col = mix(vC, vec3(1.0), core * 0.55);
      gl_FragColor = vec4(col, vA * max(core, halo));
      #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(ptsGeo, ptsMat);
  points.frustumCulled = false;
  points.renderOrder = 10;
  root.add(points);
  const accentC = new THREE.Color(ACCENT);
  const laserC = new THREE.Color('#e04a3a');
  const elecC = new THREE.Color('#2b2e34');

  // ------------------------------------------------------------ cutaway and isolation
  const CLIP = new THREE.Plane(new V3(0, 0, -1), L.cs.z);
  const cutMeshes = [...can, ...shield, ...can2, ...shield2];
  const cutMats = [...new Set(cutMeshes.map((m) => m.material))];
  let isoNow = '';
  let isoK = 0;
  const applyIso = () => {
    for (const r of recs) {
      const ghost = isoNow && r.g !== isoNow ? isoK : 0;
      const tr = r.tr || ghost > 0.001;
      if (r.m.transparent !== tr) r.m.needsUpdate = true;
      r.m.transparent = tr;
      r.m.opacity = r.op * (1 - 0.9 * ghost);
      r.m.depthWrite = ghost > 0.5 ? false : r.dw;
    }
  };
  const cutRecs = () => recs.filter((r) => cutMats.includes(r.m));
  const setCut = (mode) => {
    for (const r of cutRecs()) {
      r.m.clippingPlanes = mode === 'section' ? [CLIP] : null;
      r.op = mode === 'glass' ? 0.14 : 1;
      r.tr = mode === 'glass';
      r.dw = mode !== 'glass';
      r.m.needsUpdate = true;
    }
    applyIso();
  };
  setCut('section');
  const setIsolate = (keep, k) => {
    if (keep === isoNow && Math.abs(k - isoK) < 0.002) return;
    isoNow = keep;
    isoK = k;
    applyIso();
  };

  // ------------------------------------------------------------ the frame
  const col = new THREE.Color();
  const HOT = new THREE.Color('#e0b04a');
  const WHITE = new THREE.Color('#ffffff');
  /**
   * fx: {photons: [{pos: V3, a, s, kind}], field (Float32Array[N+1][N] or null), front, tail, gain, after, pix (24 0..1),
   *      doors 0..1, iso: group or '', isoK, heat (0..1 sweep), heatTheta (per MZI 0..1), pr}
   */
  let fieldNow = null;
  const update = (fx) => {
    for (const d of doors) d.pivot.rotation.y = -d.side * fx.doors * 1.95;
    const pa = ptsGeo.attributes.position.array;
    const aa = ptsGeo.attributes.aA.array;
    const as = ptsGeo.attributes.aS.array;
    const ac = ptsGeo.attributes.aC.array;
    let n = 0;
    for (const p of fx.photons) {
      if (n >= MAXP) break;
      pa[n * 3] = p.pos.x;
      pa[n * 3 + 1] = p.pos.y;
      pa[n * 3 + 2] = p.pos.z;
      aa[n] = p.a;
      as[n] = p.s;
      const c = p.kind === 'laser' ? laserC : p.kind === 'elec' ? elecC : accentC;
      ac[n * 3] = c.r;
      ac[n * 3 + 1] = c.g;
      ac[n * 3 + 2] = c.b;
      n++;
    }
    for (let i = n; i < MAXP; i++) aa[i] = 0;
    ptsGeo.setDrawRange(0, Math.max(1, n));
    for (const k of ['position', 'aA', 'aS', 'aC']) ptsGeo.attributes[k].needsUpdate = true;
    ptsMat.uniforms.uPR.value = fx.pr ?? 1;
    if (fx.field && fx.field !== fieldNow) {
      fieldNow = fx.field;
      const d = glowTex.image.data;
      for (let c = 0; c <= N; c++)
        for (let m = 0; m < N; m++) {
          const v = Math.min(1, Math.sqrt(fx.field[c][m]) * 0.95);
          d[(m * (N + 1) + c) * 4] = Math.round(v * 255);
        }
      glowTex.needsUpdate = true;
    }
    U.uFront.value = fx.front;
    U.uTail.value = fx.tail;
    U.uGain.value = fx.gain;
    U.uAfter.value = fx.after;
    for (let m = 0; m < N; m++) {
      const v = fx.pix ? fx.pix[m] : 0;
      pix.setColorAt(m, col.set('#9da3ad').lerp(accentC, Math.min(1, v)));
    }
    pix.instanceColor.needsUpdate = true;
    if (fx.heatTheta) {
      MZI.forEach((z, k) => {
        const sweep = fx.heat ? Math.max(0, 1 - Math.abs(z.c / N - fx.heat) * 8) : 0;
        for (let h = 0; h < 2; h++) {
          const drive = h === 0 ? fx.heatTheta[k] : fx.heatPhi[k];
          heat.setColorAt(k * 2 + h, col.set('#6e521d').lerp(HOT, 0.15 + 0.85 * drive).lerp(WHITE, sweep * 0.8));
        }
      });
      heat.instanceColor.needsUpdate = true;
    }
    setIsolate(fx.iso || '', fx.isoK || 0);
    U.uOpacity.value = fx.iso && fx.iso !== 'chip' ? 1 - 0.9 * fx.isoK : 1;
  };

  // anchors for callouts and cameras
  const A = {
    laser: new V3(L.xl, 1.72, 0.4),
    source: new V3(cs.x, cs.y, cs.z),
    sample: new V3(cs.x, 1.074, cs.z),
    compressor: new V3(L.xl, 0.45, 0.35),
    filter: filt.clone(),
    demux: new V3(dm.x, dm.y, dm.z + 0.25),
    spools: new V3(L.xr, L.tray.y, 0.28),
    chip: new V3(C.x, C.y, C.z),
    detect: new V3(cd.x, cd.y, cd.z),
    snspd: new V3(cd.x, cd.y + 0.043, cd.z),
    tagger: new V3(L.tagger.x, L.tagger.y, 0.32),
    server: new V3(L.xr, 0.365, 0.35),
  };
  return {root, update, setCut, pathFor, homPath, laserPath, outs, coax, A, CLIP, groups, faIn, faOut, pixAt};
}
