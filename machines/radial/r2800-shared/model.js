// The R-2800 itself, built from code in metres from the numbers in engine.js and against the reference photographs
// (REFERENCES.md): a grey-blue forged crankcase in three sections, 18 steel barrels under black finned muffs, raw
// aluminium heads with deep fins and two rocker boxes each, chromed pushrod tubes from two cam rings, two plugs per
// head on a braided harness ring, two magnetos on the nose, black intake pipes from the supercharger's diffuser, a
// two-throw crankshaft with a master rod and eight articulated rods per row, a planetary reduction gear, a three-blade
// propeller, a cowling and the black inter-cylinder baffles. update(fx) poses everything from the crank angle.
//
// World: the engine's axis is z (the propeller at +z), y up, the axis at the origin. An angle a measured clockwise
// from the top seen from the rear (engine.js) is a rotation of +a about z.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CAM, CAM_PHASE, CYL, E, GEAR, lift, lobeOffset, PROP_D, ROWS, rowPose, VALVE} from './engine.js';

export const ACCENT = '#0a8fe0';
const V3 = THREE.Vector3;
const D2R = Math.PI / 180;
const mm = (x) => x / 1000;
export const FLOOR_Y = -2.2;
const PROP_OFF = 0; // the blades' angle at θ = 0, chosen so frame 0 shows the cylinders between them

// ------------------------------------------------------------ geometry helpers (millimetres in, metres out)
/** a lathed part around Y: profile [[r, y], ...] in mm */
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(mm(r), mm(y))), seg);
/** a lathed part around the engine axis z: profile [[r, z], ...] in mm */
const latheZ = (pts, seg = 64) => lathe(pts, seg).rotateX(Math.PI / 2);
/** the same, its profile smoothed by a centripetal spline through the points (no facets at the knees) */
const latheZs = (pts, seg = 72, n = 4) => {
  const c = new THREE.SplineCurve(pts.map(([r, z]) => new THREE.Vector2(r, z)));
  const out = c.getSpacedPoints(Math.max(8, pts.length * n)).map((v) => [Math.max(0, v.x), v.y]);
  out[0] = pts[0];
  out[out.length - 1] = pts[pts.length - 1];
  return latheZ(out, seg);
};
/** an annular fin: outer wall plus two flat faces, between y and y + t, from rIn to rOut (mm) */
function finGeo(rIn, rOut, y, t, seg) {
  const side = new THREE.CylinderGeometry(mm(rOut), mm(rOut), mm(t), seg, 1, true).translate(0, mm(y + t / 2), 0);
  const top = new THREE.RingGeometry(mm(rIn), mm(rOut), seg, 1).rotateX(-Math.PI / 2).translate(0, mm(y + t), 0);
  const bot = new THREE.RingGeometry(mm(rIn), mm(rOut), seg, 1).rotateX(Math.PI / 2).translate(0, mm(y), 0);
  return [side, top, bot];
}
const tube = (r, y0, y1, seg = 32, open = true) => new THREE.CylinderGeometry(mm(r), mm(r), mm(y1 - y0), seg, 1, open).translate(0, mm((y0 + y1) / 2), 0);
const merge = (list) => {
  const g = mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)));
  g.computeBoundingSphere();
  return g;
};
/** a gear disc in the XY plane (extruded along z): teeth, pitch radius, width, all mm */
function gearGeo(teeth, rp, width, hole = 0) {
  const m = (2 * rp) / teeth;
  const ro = rp + m;
  const rr = rp - 1.2 * m;
  const sh = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const da = (Math.PI * 2) / teeth;
    const pts = [
      [rr, a0],
      [rr, a0 + da * 0.2],
      [ro, a0 + da * 0.36],
      [ro, a0 + da * 0.6],
      [rr, a0 + da * 0.76],
    ];
    pts.forEach(([r, a], k) => (i === 0 && k === 0 ? sh.moveTo(mm(r * Math.cos(a)), mm(r * Math.sin(a))) : sh.lineTo(mm(r * Math.cos(a)), mm(r * Math.sin(a)))));
  }
  sh.closePath();
  if (hole) {
    const h = new THREE.Path();
    h.absarc(0, 0, mm(hole), 0, Math.PI * 2, true);
    sh.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(sh, {depth: mm(width), bevelEnabled: false, curveSegments: 2});
  g.translate(0, 0, -mm(width) / 2);
  return g;
}
/** an internal (ring) gear: teeth pointing in */
function ringGearGeo(teeth, rp, rOut, width) {
  const m = (2 * rp) / teeth;
  const ri = rp - m;
  const rr = rp + 1.2 * m;
  const sh = new THREE.Shape();
  sh.absarc(0, 0, mm(rOut), 0, Math.PI * 2, false);
  const h = new THREE.Path();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const da = (Math.PI * 2) / teeth;
    const pts = [
      [rr, a0],
      [rr, a0 + da * 0.2],
      [ri, a0 + da * 0.36],
      [ri, a0 + da * 0.6],
      [rr, a0 + da * 0.76],
    ];
    pts.forEach(([r, a], k) => (i === 0 && k === 0 ? h.moveTo(mm(r * Math.cos(a)), mm(r * Math.sin(a))) : h.lineTo(mm(r * Math.cos(a)), mm(r * Math.sin(a)))));
  }
  h.closePath();
  sh.holes.push(h);
  const g = new THREE.ExtrudeGeometry(sh, {depth: mm(width), bevelEnabled: false, curveSegments: 24});
  g.translate(0, 0, -mm(width) / 2);
  return g;
}
/** a cam track: base circle plus 4 lobes at the given ring angles (degrees clockwise from the rear), in XY */
function camTrackGeo(phase, half, base, rise, width) {
  const sh = new THREE.Shape();
  const N = 360;
  for (let i = 0; i <= N; i++) {
    const b = (i / N) * 360; // ring angle, clockwise from the top seen from the rear
    const x = (((b - phase) % 90) + 90 + 45) % 90 - 45;
    const u = Math.abs(x) / half;
    const r = base + (u >= 1 ? 0 : rise * (0.5 + 0.5 * Math.cos(Math.PI * u)));
    const px = -Math.sin(b * D2R) * r;
    const py = Math.cos(b * D2R) * r;
    if (i === 0) sh.moveTo(mm(px), mm(py));
    else sh.lineTo(mm(px), mm(py));
  }
  const h = new THREE.Path();
  h.absarc(0, 0, mm(base - 16), 0, Math.PI * 2, true);
  sh.holes.push(h);
  const g = new THREE.ExtrudeGeometry(sh, {depth: mm(width), bevelEnabled: false, curveSegments: 48});
  g.translate(0, 0, -mm(width) / 2);
  return g;
}
const curveTube = (pts, r, seg = 48, rs = 10) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new V3(mm(p[0]), mm(p[1]), mm(p[2])))), seg, mm(r), rs, false);
/** a point given by its engine angle (clockwise from the top seen from the rear), radius and z (mm) */
const polar = (a, r, z) => [-Math.sin(a * D2R) * r, Math.cos(a * D2R) * r, z];

// ------------------------------------------------------------ textures from code
function braidTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#8f918c';
  g.fillRect(0, 0, 64, 16);
  for (let x = -16; x < 80; x += 4) {
    g.strokeStyle = x % 8 ? '#6c6e69' : '#b4b5b0';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 16, 16);
    g.stroke();
    g.beginPath();
    g.moveTo(x + 16, 0);
    g.lineTo(x, 16);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function blurTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 4;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, 'rgba(24,24,24,0.0)');
  gr.addColorStop(0.08, 'rgba(24,24,24,0.55)');
  gr.addColorStop(0.5, 'rgba(26,26,26,0.42)');
  gr.addColorStop(0.9, 'rgba(30,30,30,0.3)');
  gr.addColorStop(0.94, 'rgba(214,170,40,0.55)');
  gr.addColorStop(1, 'rgba(214,170,40,0.0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildEngine() {
  const root = new THREE.Group();
  const CLIP = [new THREE.Plane(new V3(0, 0, -1), 0)];
  const M = {
    fins: new THREE.MeshStandardMaterial({color: '#18191b', roughness: 0.62, metalness: 0.35, side: THREE.DoubleSide}),
    case: new THREE.MeshStandardMaterial({color: '#6b7884', roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide}),
    caseDark: new THREE.MeshStandardMaterial({color: '#56616b', roughness: 0.58, metalness: 0.35, side: THREE.DoubleSide}),
    alu: new THREE.MeshStandardMaterial({color: '#a3a7ab', roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide}),
    chrome: new THREE.MeshStandardMaterial({color: '#aeb2b7', roughness: 0.42, metalness: 1, envMapIntensity: 0.55}),
    steel: new THREE.MeshStandardMaterial({color: '#a7acb2', roughness: 0.42, metalness: 0.95, side: THREE.DoubleSide}),
    steelDark: new THREE.MeshStandardMaterial({color: '#6e7277', roughness: 0.48, metalness: 0.9, side: THREE.DoubleSide}),
    piston: new THREE.MeshStandardMaterial({color: '#c9ccd0', roughness: 0.45, metalness: 0.8, side: THREE.DoubleSide}),
    black: new THREE.MeshStandardMaterial({color: '#1e2022', roughness: 0.62, metalness: 0.25, side: THREE.DoubleSide}),
    exhaust: new THREE.MeshStandardMaterial({color: '#4a3f37', roughness: 0.75, metalness: 0.5}),
    braid: new THREE.MeshStandardMaterial({color: '#9a9b96', roughness: 0.55, metalness: 0.7, map: braidTexture()}),
    hub: new THREE.MeshStandardMaterial({color: '#3b3e42', roughness: 0.48, metalness: 0.7}),
    plug: new THREE.MeshStandardMaterial({color: '#8c8f93', roughness: 0.45, metalness: 0.9}),
    stand: new THREE.MeshStandardMaterial({color: '#55585b', roughness: 0.6, metalness: 0.5}),
    cowl: new THREE.MeshStandardMaterial({color: '#959ba1', roughness: 0.5, metalness: 0.55, side: THREE.DoubleSide, envMapIntensity: 0.6}),
    blade: new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.62, metalness: 0.2, vertexColors: true, side: THREE.DoubleSide}),
    oil: new THREE.MeshStandardMaterial({color: '#8a6a3a', roughness: 0.5, metalness: 0.6, emissive: '#c58a2a', emissiveIntensity: 0}),
    glass: new THREE.MeshPhysicalMaterial({color: '#e9eef2', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide}),
    flame: new THREE.MeshBasicMaterial({color: ACCENT, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide}),
    accent: new THREE.MeshBasicMaterial({color: ACCENT}),
    blur: new THREE.MeshBasicMaterial({color: '#2a2b2c', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide}),
    blurTip: new THREE.MeshBasicMaterial({color: '#c99a1e', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide}),
  };
  // every lit material can be cut by the section plane
  for (const k of Object.keys(M)) M[k].clipShadows = true;

  // groups: what each subsystem button isolates
  const GROUPS = ['case', 'crank', 'cyl', 'valve', 'ign', 'air', 'prop', 'nose', 'oil', 'stand', 'cowl', 'baffle'];
  const parts = Object.fromEntries(GROUPS.map((g) => [g, []]));
  const add = (parent, geo, mat, group, opts = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = opts.cast ?? true;
    m.receiveShadow = opts.receive ?? true;
    m.userData = {group, mat, glassable: !!opts.glassable, nocut: !!opts.nocut};
    parent.add(m);
    parts[group].push(m);
    return m;
  };

  // per-row assemblies (they slide apart along the axis in the "rows apart" view)
  const rowG = {rear: new THREE.Group(), front: new THREE.Group()};
  root.add(rowG.rear, rowG.front);

  // ------------------------------------------------------------ the power section crankcase
  const caseGeo = latheZ([
    [0, -232],
    [236, -232],
    [252, -214],
    [258, -150],
    [262, -105],
    [258, -60],
    [250, 0],
    [258, 60],
    [262, 105],
    [258, 150],
    [252, 214],
    [246, 250],
    [0, 250],
  ]);
  add(root, caseGeo, M.case, 'case', {glassable: true});
  // the cylinder pads, one boss per cylinder
  const padGeo = tube(112, 236, 262, 36, false);
  for (const cy of CYL) {
    const p = add(rowG[cy.row], padGeo, M.caseDark, 'case', {glassable: true});
    p.rotation.z = cy.angle * D2R;
    p.position.z = mm(E.rowZ[cy.row]);
    p.rotation.order = 'ZYX';
  }

  // ------------------------------------------------------------ cylinders
  const barrelGeo = (() => {
    const g = [tube(84, 262, 300), tube(73, 236, 470), tube(84, 438, 448)];
    g.push(...finGeo(84, 99, 254, 10, 40));
    for (let y = 302; y < 432; y += 5.6) g.push(...finGeo(84, 102, y, 1.8, 40));
    return merge(g);
  })();
  const headGeo = (() => {
    const g = [lathe([[86, 440], [88, 470], [86, 540], [70, 580], [40, 598], [0, 604]], 40)];
    for (let y = 452, i = 0; y < 570; y += 6.6, i++) {
      const k = (y - 452) / 118;
      g.push(...finGeo(84 - 22 * k * k, 112 - 26 * k * k, y, 2.4, 40));
    }
    // the combustion chamber's roof, seen in section
    g.push(lathe([[73, 470], [70, 478], [52, 492], [0, 500]], 36));
    return merge(g);
  })();
  // rocker boxes: one over each valve, their covers at the top
  const boxGeo = merge([new THREE.CapsuleGeometry(mm(24), mm(62), 6, 16).rotateX(Math.PI / 2), new THREE.CylinderGeometry(mm(29), mm(29), mm(8), 20).translate(0, mm(16), mm(-18))]);
  const portGeo = new THREE.CylinderGeometry(mm(34), mm(38), mm(60), 20).rotateX(Math.PI / 2);
  const exGeo = curveTube([[0, 512, 92], [0, 520, 128], [0, 540, 158]], 22, 12, 12);
  const plugGeo = merge([new THREE.CylinderGeometry(mm(10), mm(10), mm(44), 12).rotateX(Math.PI / 2), new THREE.CylinderGeometry(mm(14), mm(14), mm(12), 6).rotateX(Math.PI / 2).translate(0, 0, mm(-14))]);
  const flameGeo = lathe([[70, 436], [72, 468], [52, 490], [0, 498]], 32);
  const cylinders = CYL.map((cy) => {
    const g = new THREE.Group();
    g.rotation.z = cy.angle * D2R;
    g.position.z = mm(E.rowZ[cy.row]);
    rowG[cy.row].add(g);
    add(g, barrelGeo, M.fins, 'cyl', {glassable: true});
    const headMat = M.alu.clone();
    headMat.clipShadows = true;
    headMat.emissive = new THREE.Color(ACCENT);
    headMat.emissiveIntensity = 0;
    const head = add(g, headGeo, headMat, 'cyl', {glassable: true});
    head.userData.ownMat = true;
    head.userData.mat = headMat;
    const flame = add(g, flameGeo, M.flame.clone(), 'cyl', {cast: false, receive: false});
    flame.userData.isFlame = true;
    flame.renderOrder = 2;
    // the cam side: the front row's ring is in front of it, the rear row's behind
    const side = cy.row === 'front' ? 1 : -1;
    for (const s of [-1, 1]) {
      const b = add(g, boxGeo, M.alu, 'cyl');
      b.position.set(0, mm(592), mm(60 * s));
      b.rotation.x = -0.32 * s;
    }
    add(g, portGeo, M.alu, 'cyl').position.set(0, mm(522), mm(-100));
    const ex = add(g, exGeo, M.exhaust, 'cyl');
    if (cy.row === 'rear') ex.scale.z = 0.55;
    for (const s of [-1, 1]) {
      const p = add(g, plugGeo, M.plug, 'ign');
      p.position.set(mm(s * 30), mm(476), mm(110 * s));
      p.rotation.y = s * 0.25;
    }
    return {cy, g, head, flame, side};
  });

  // ------------------------------------------------------------ the valve train: two cam rings, tappets, pushrods, rockers, valves
  const camRings = {};
  for (const row of ['rear', 'front']) {
    const side = row === 'front' ? 1 : -1;
    const z = E.rowZ[row] + side * 125;
    const g = new THREE.Group();
    g.position.z = mm(z);
    rowG[row].add(g);
    const half = {in: (VALVE.in[1] - VALVE.in[0]) / 16, ex: (VALVE.ex[1] - VALVE.ex[0]) / 16};
    const tin = add(g, camTrackGeo(CAM_PHASE[row].in, half.in, 140, 12, 12), M.steel, 'valve');
    tin.position.z = mm(-8);
    const tex = add(g, camTrackGeo(CAM_PHASE[row].ex, half.ex, 140, 12, 12), M.steel, 'valve');
    tex.position.z = mm(8);
    add(g, tube(120, -14, 14, 48, false).rotateX(Math.PI / 2), M.steelDark, 'valve');
    camRings[row] = g;
  }
  const tappetGeo = merge([tube(9, 0, 96, 12, false), new THREE.CylinderGeometry(mm(12), mm(12), mm(10), 14).rotateZ(Math.PI / 2)]);
  const rodGeo = (a, b) => curveTube([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], b], 7.5, 8, 10);
  // the pushrod tubes: the near valve goes straight up the cam side, the far one around the barrel
  const nearTube = curveTube([[18, 262, 125], [18, 420, 124], [18, 566, 116]], 7.5, 24, 10);
  const farTube = curveTube([[-24, 262, 125], [-92, 340, 86], [-114, 440, 0], [-92, 528, -84], [-24, 566, -116]], 7.5, 48, 10);
  const valveGeo = merge([tube(4.5, 470, 580, 10, false), lathe([[0, 462], [27, 462], [27, 466], [10, 474], [4.5, 486]], 24)]);
  const rockerGeo = merge([new THREE.BoxGeometry(mm(12), mm(10), mm(96)).translate(0, 0, mm(10)), new THREE.CylinderGeometry(mm(9), mm(9), mm(22), 12).rotateZ(Math.PI / 2)]);
  const train = cylinders.map((C) => {
    const {g, side} = C;
    const out = {};
    for (const ev of ['in', 'ex']) {
      // the inlet valve is at the rear of the head, the exhaust at the front
      const vs = ev === 'in' ? -1 : 1;
      const near = vs === side;
      const tz = side * 125 + (ev === 'in' ? -8 : 8);
      const tp = add(g, tappetGeo, M.steel, 'valve');
      tp.position.set(mm(near ? 18 : -18), mm(152), mm(tz));
      const tb = add(g, near ? nearTube : farTube, M.chrome, 'valve', {glassable: true});
      if (side < 0) tb.scale.z = -1;
      const v = add(g, valveGeo, M.steel, 'valve');
      v.position.z = mm(34 * vs);
      v.rotation.x = 0;
      const rk = add(g, rockerGeo, M.steel, 'valve');
      rk.position.set(0, mm(590), mm(70 * vs));
      rk.scale.z = vs;
      out[ev] = {tp, tb, v, rk, near};
    }
    return out;
  });

  // every part that belongs to one cylinder knows which (the cam view shows one cylinder's train); its tappet stays
  for (const C of cylinders) C.g.traverse((o) => o.isMesh && (o.userData.cyl = C.cy.c));
  for (const tr of train) for (const ev of ['in', 'ex']) tr[ev].tp.userData.keep = true;

  // ------------------------------------------------------------ the crankshaft: two throws at 180°, two halves
  const crank = {};
  const webGeo = (() => {
    const sh = new THREE.Shape();
    const R = 128;
    sh.moveTo(mm(-R * Math.sin(1.1)), mm(-R * Math.cos(1.1)));
    sh.absarc(0, 0, mm(R), -Math.PI / 2 - 1.1, -Math.PI / 2 + 1.1, false);
    sh.lineTo(mm(52), mm(20));
    sh.absarc(0, mm(E.r), mm(54), 0, Math.PI, false);
    sh.lineTo(mm(-52), mm(20));
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, {depth: mm(26), bevelEnabled: true, bevelThickness: mm(2), bevelSize: mm(2), bevelSegments: 1, curveSegments: 20});
    g.translate(0, 0, -mm(13));
    return g;
  })();
  for (const row of ['rear', 'front']) {
    const g = new THREE.Group();
    g.position.z = mm(E.rowZ[row]);
    rowG[row].add(g);
    const sign = row === 'rear' ? 1 : -1; // the front pin is 180° from the rear one
    const inner = row === 'rear' ? 1 : -1; // toward the centre of the engine
    for (const dz of [-44, 44]) {
      const w = add(g, webGeo, M.steel, 'crank');
      w.position.z = mm(dz);
      if (sign < 0) w.rotation.z = Math.PI;
    }
    add(g, tube(46, -32, 32, 32, false).rotateX(Math.PI / 2).translate(0, mm(E.r * sign), 0), M.steel, 'crank');
    // main journals: outward to the end bearing, inward to the centre one
    add(g, tube(50, 0, 160, 32, false).rotateX(Math.PI / 2).translate(0, 0, mm(-inner * 130)), M.steel, 'crank');
    add(g, tube(50, -inner * 60, -inner * 4, 32, false).rotateX(Math.PI / 2).translate(0, 0, mm(inner * 60 + (inner > 0 ? 0 : 0))), M.steel, 'crank');
    // the oil drilling, through the journal and out to the crankpin
    add(g, curveTube([[0, 0, -inner * 150], [0, 0, -inner * 40], [0, E.r * sign * 0.5, 0], [0, E.r * sign, 0]], 7, 24, 8), M.oil, 'oil', {cast: false});
    crank[row] = g;
  }
  // the centre main bearing
  add(root, tube(58, -16, 16, 36, false).rotateX(Math.PI / 2), M.steelDark, 'crank');

  // ------------------------------------------------------------ rods and pistons
  const pistonGeo = (() => {
    const g = [tube(72.5, -50, 66, 40, false), new THREE.CircleGeometry(mm(72.5), 40).rotateX(-Math.PI / 2).translate(0, mm(66), 0)];
    for (const y of [40, 48, 56]) g.push(tube(73.2, y, y + 2.2, 40, false));
    return merge(g);
  })();
  const pinGeo = new THREE.CylinderGeometry(mm(16), mm(16), mm(128), 16).rotateZ(Math.PI / 2);
  const masterGeo = (() => {
    const sh = new THREE.Shape();
    sh.absarc(0, 0, mm(88), 0, Math.PI * 2, false);
    const h = new THREE.Path();
    h.absarc(0, 0, mm(47), 0, Math.PI * 2, true);
    sh.holes.push(h);
    const flange = new THREE.ExtrudeGeometry(sh, {depth: mm(52), bevelEnabled: false, curveSegments: 40}).translate(0, 0, -mm(26));
    const shank = new THREE.BoxGeometry(mm(34), mm(E.L - 110), mm(30)).translate(0, mm(80 + (E.L - 110) / 2 - 10), 0);
    const eye = new THREE.CylinderGeometry(mm(26), mm(26), mm(34), 20).rotateX(Math.PI / 2).translate(0, mm(E.L), 0);
    return merge([flange, shank, eye]);
  })();
  const knuckleGeo = new THREE.CylinderGeometry(mm(11), mm(11), mm(60), 14).rotateX(Math.PI / 2);
  const artGeo = merge([
    new THREE.BoxGeometry(mm(22), mm(E.l - 40), mm(18)).translate(0, mm(E.l / 2), 0),
    new THREE.CylinderGeometry(mm(18), mm(18), mm(22), 16).rotateX(Math.PI / 2),
    new THREE.CylinderGeometry(mm(22), mm(22), mm(26), 16).rotateX(Math.PI / 2).translate(0, mm(E.l), 0),
  ]);
  const rods = {};
  for (const row of ['rear', 'front']) {
    const m = E.master[row];
    const mg = add(rowG[row], masterGeo, M.steel, 'crank');
    const knuckles = [];
    for (const cy of ROWS[row]) {
      if (cy.c === m) continue;
      const k = add(mg, knuckleGeo, M.steelDark, 'crank');
      const d = (cy.angle - CYL[m - 1].angle) * D2R;
      k.position.set(-Math.sin(d) * mm(E.rk), Math.cos(d) * mm(E.rk), 0);
      knuckles.push(k);
    }
    const arts = {};
    for (const cy of ROWS[row]) if (cy.c !== m) arts[cy.c] = add(rowG[row], artGeo, M.steel, 'crank');
    rods[row] = {master: mg, arts};
  }
  const pistons = CYL.map((cy) => {
    const p = add(cylinders[cy.c - 1].g, pistonGeo, M.piston, 'crank');
    add(p, pinGeo, M.steelDark, 'crank');
    return p;
  });

  // ------------------------------------------------------------ the nose: reduction gear, magnetos, harness, propeller
  add(
    root,
    latheZs([
      [246, 250],
      [282, 282],
      [300, 330],
      [292, 400],
      [252, 470],
      [205, 540],
      [165, 598],
      [128, 640],
      [0, 652],
    ]),
    M.case,
    'nose',
    {glassable: true},
  );
  const gearG = new THREE.Group();
  gearG.position.z = mm(380);
  root.add(gearG);
  const RG = {sun: 72, ring: 88, module: 3.4}; // 72 / (72 + 88) = 0.45 [E: the layout]
  const rpS = (RG.sun * RG.module) / 2;
  const rpR = (RG.ring * RG.module) / 2;
  const rpP = (rpR - rpS) / 2;
  const sun = add(gearG, gearGeo(RG.sun, rpS, 34, 30), M.steel, 'prop');
  add(gearG, ringGearGeo(RG.ring, rpR, rpR + 16, 34), M.steelDark, 'prop');
  const carrier = new THREE.Group();
  gearG.add(carrier);
  add(carrier, new THREE.CylinderGeometry(mm(rpR - 4), mm(rpR - 4), mm(10), 48).rotateX(Math.PI / 2).translate(0, 0, mm(26)), M.steelDark, 'prop');
  const planets = [];
  for (let i = 0; i < 6; i++) {
    const pg = add(carrier, gearGeo(8, rpP, 34, 0), M.steel, 'prop');
    const a = (i / 6) * Math.PI * 2;
    pg.position.set(Math.cos(a) * mm(rpS + rpP), Math.sin(a) * mm(rpS + rpP), 0);
    planets.push(pg);
  }
  // the propeller shaft (splined) and hub: they turn with the carrier
  const propG = new THREE.Group();
  root.add(propG);
  add(propG, tube(62, 600, 760, 32, false).rotateX(Math.PI / 2), M.steel, 'prop');
  add(propG, latheZs([[0, 720], [132, 722], [140, 760], [130, 830], [100, 880], [50, 905], [0, 910]], 48), M.hub, 'prop');
  const bladeGeo = (() => {
    const R = PROP_D * 500;
    const rows = 28;
    const cols = 14;
    const pos = [];
    const col = [];
    const idx = [];
    const tipY = new THREE.Color('#d8a925');
    const blk = new THREE.Color('#1b1c1d');
    for (let i = 0; i <= rows; i++) {
      const u = i / rows;
      const r = 150 + (R - 150) * u;
      const chord = u < 0.1 ? 120 + 1300 * u : 250 * (1 - 0.45 * Math.max(0, (u - 0.3) / 0.7) ** 1.4) + (u > 0.97 ? -1500 * (u - 0.97) : 0);
      const thick = 60 * (1 - u) + 7;
      const tw = (52 - 40 * u) * D2R;
      const cc = (r > R - 120 ? tipY : blk).clone();
      for (let j = 0; j < cols; j++) {
        const a = (j / cols) * Math.PI * 2;
        const x = (Math.cos(a) * chord) / 2;
        const z = (Math.sin(a) * thick) / 2;
        pos.push(mm(x * Math.cos(tw) - z * Math.sin(tw)), mm(r), mm(x * Math.sin(tw) + z * Math.cos(tw)));
        col.push(cc.r, cc.g, cc.b);
      }
    }
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) {
        const a = i * cols + j;
        const b = i * cols + ((j + 1) % cols);
        idx.push(a, b, a + cols, b, b + cols, a + cols);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  })();
  const blades = [];
  for (let i = 0; i < 3; i++) {
    const b = add(propG, bladeGeo, M.blade, 'prop');
    b.rotation.z = (i * 2 * Math.PI) / 3;
    b.position.z = mm(790);
    blades.push(b);
  }
  const blurDisc = add(root, new THREE.RingGeometry(mm(150), mm(PROP_D * 500 - 120), 96, 1), M.blur, 'prop', {cast: false, receive: false});
  const blurTip = add(blurDisc, new THREE.RingGeometry(mm(PROP_D * 500 - 120), mm(PROP_D * 500), 96, 1), M.blurTip, 'prop', {cast: false, receive: false});
  blurDisc.position.z = mm(790);
  blurDisc.renderOrder = 3;
  // two magnetos on the nose, their distributors turning at half crank speed
  const magnetos = [];
  for (const a of [-38, 38]) {
    const g = new THREE.Group();
    const [x, y] = polar(a, 300, 0);
    g.position.set(mm(x), mm(y), mm(360));
    g.rotation.z = a * D2R;
    root.add(g);
    add(g, new THREE.BoxGeometry(mm(92), mm(96), mm(128)).translate(0, mm(34), 0), M.caseDark, 'ign');
    const cap = add(g, new THREE.CylinderGeometry(mm(42), mm(46), mm(30), 24).translate(0, mm(96), 0), M.black, 'ign');
    const rotor = add(g, new THREE.BoxGeometry(mm(60), mm(6), mm(10)).translate(mm(16), mm(114), 0), M.steel, 'ign');
    void cap;
    magnetos.push({g, rotor});
  }
  // the harness ring and its 36 leads
  add(root, new THREE.TorusGeometry(mm(302), mm(15), 12, 96), M.braid, 'ign').position.z = mm(268);
  const plugAt = (cy, s) => {
    // a plug's tip in world mm: s +1 front plug, -1 rear plug
    const a = cy.angle;
    const local = [30 * s, 476, 110 * s + 22 * s];
    const r = local[1];
    const t = (local[0] * Math.PI) / 180 / 4.76; // small tangential offset as an angle
    void t;
    const ang = a - (local[0] / r) * (180 / Math.PI);
    return polar(ang, r, E.rowZ[cy.row] + local[2]);
  };
  for (const cy of CYL) {
    for (const s of [1, -1]) {
      const p = plugAt(cy, s);
      const a0 = cy.angle + (cy.row === 'front' ? 0 : 0);
      const start = polar(a0, 302, 268);
      let path;
      if (cy.row === 'front' && s > 0) path = [start, polar(a0, 380, 262), polar(a0 - 3, 455, 245), p];
      else if (cy.row === 'front') path = [start, polar(a0 - 14, 360, 250), polar(a0 - 17, 440, 120), polar(a0 - 14, 470, 20), p];
      else if (s > 0) path = [start, polar(a0, 340, 240), polar(a0, 420, 130), polar(a0 - 3, 466, 30), p];
      else path = [start, polar(a0, 340, 240), polar(a0, 420, 130), polar(a0 - 13, 470, -60), polar(a0 - 9, 474, -180), p];
      add(root, curveTube(path, 5, 40, 6), M.braid, 'ign', {cast: false});
    }
  }

  // ------------------------------------------------------------ the rear: supercharger, diffuser, 18 intake pipes, carburettor, accessories
  add(
    root,
    latheZs([
      [0, -232],
      [252, -232],
      [318, -268],
      [336, -300],
      [330, -340],
      [282, -400],
      [272, -430],
      [262, -520],
      [248, -760],
      [238, -1000],
      [228, -1180],
      [150, -1240],
      [0, -1244],
    ]),
    M.case,
    'air',
    {glassable: true},
  );
  const impG = new THREE.Group();
  impG.position.z = mm(-312);
  root.add(impG);
  add(impG, latheZ([[0, -26], [40, -26], [140, 10], [140, 16], [0, 16]], 40), M.alu, 'air');
  const vane = new THREE.BoxGeometry(mm(4), mm(98), mm(34)).translate(0, mm(90), 0);
  for (let i = 0; i < 18; i++) {
    const v = add(impG, vane, M.alu, 'air');
    v.rotation.z = (i / 18) * Math.PI * 2;
  }
  // the pipes: from the diffuser's outlets to each cylinder's inlet port
  const pipeCurves = [];
  for (const cy of CYL) {
    const zr = E.rowZ[cy.row];
    const a = cy.angle;
    const pts = [polar(a, 318, -300), polar(a, 400, -310), polar(a, 492, cy.row === 'front' ? -150 : zr - 175), polar(a, 522, zr - 128)];
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new V3(mm(p[0]), mm(p[1]), mm(p[2]))));
    pipeCurves.push(c);
    add(root, new THREE.TubeGeometry(c, 40, mm(34), 14, false), M.black, 'air', {glassable: true});
  }
  // carburettor on top of the rear case, the air scoop's throat
  add(root, new THREE.BoxGeometry(mm(240), mm(150), mm(260)).translate(0, mm(330), mm(-560)), M.black, 'air');
  add(root, new THREE.BoxGeometry(mm(200), mm(60), mm(220)).translate(0, mm(430), mm(-560)), M.caseDark, 'air');
  // the starter at the very rear, a generator and pumps on their pads
  add(root, latheZ([[0, -1244], [96, -1244], [100, -1300], [92, -1420], [60, -1450], [0, -1452]], 32), M.black, 'case');
  for (const [a, r, len] of [[120, 160, 230], [240, 160, 230], [180, 170, 180]]) {
    const [x, y] = polar(a, r, 0);
    add(root, new THREE.CylinderGeometry(mm(64), mm(64), mm(len), 24).rotateX(Math.PI / 2).translate(mm(x), mm(y), mm(-1240 - len / 2 + 30)), M.caseDark, 'case');
  }
  // the oil system: pressure pump low at the rear, its line to the rear main bearing, the scavenge sump, the nose feed
  add(root, new THREE.BoxGeometry(mm(150), mm(120), mm(170)).translate(0, mm(-250), mm(-760)), M.caseDark, 'oil');
  const oilLines = [
    [[0, -250, -680], [0, -238, -480], [0, -120, -300], [0, -40, -240]],
    [[60, -262, -150], [50, -300, -400], [40, -300, -700], [40, -260, -760]],
    [[-120, -230, 250], [-200, -250, 330], [-160, -230, 440], [-60, -120, 470]],
  ];
  const oilCurves = oilLines.map((pts) => new THREE.CatmullRomCurve3(pts.map((p) => new V3(mm(p[0]), mm(p[1]), mm(p[2])))));
  for (const c of oilCurves) add(root, new THREE.TubeGeometry(c, 40, mm(11), 10, false), M.oil, 'oil');
  add(root, new THREE.BoxGeometry(mm(240), mm(60), mm(300)).translate(0, mm(-272), 0), M.caseDark, 'oil');

  // ------------------------------------------------------------ baffles, cowling, the test stand
  const baffleGeo = (() => {
    const sh = new THREE.Shape();
    sh.moveTo(mm(-44), mm(420));
    sh.lineTo(mm(44), mm(420));
    sh.lineTo(mm(56), mm(560));
    sh.lineTo(mm(-56), mm(560));
    sh.closePath();
    return new THREE.ExtrudeGeometry(sh, {depth: mm(3), bevelEnabled: false}).translate(0, 0, -mm(1.5)).rotateY(Math.PI / 2);
  })();
  for (const row of ['rear', 'front']) {
    for (const cy of ROWS[row]) {
      const b = add(rowG[row], baffleGeo, M.black, 'baffle');
      b.rotation.z = (cy.angle + 20) * D2R;
      b.position.z = mm(E.rowZ[row]);
      b.rotation.order = 'ZYX';
      b.scale.set(1, 1, 1);
    }
  }
  const cowl = add(
    root,
    latheZ(
      [
        [640, -300],
        [668, -120],
        [690, 120],
        [700, 260],
        [690, 330],
        [655, 352],
        [610, 340],
        [612, 320],
        [664, 300],
        [672, 240],
        [662, 120],
        [636, -120],
        [612, -298],
      ],
      96,
    ),
    M.cowl,
    'cowl',
    {glassable: true},
  );
  void cowl;
  // the mount ring at the rear and a tubular run-up stand down to the concrete
  add(root, new THREE.TorusGeometry(mm(352), mm(22), 12, 64).translate(0, 0, mm(-360)), M.stand, 'stand');
  const leg = (a, b) => {
    const A = new V3(...a.map(mm));
    const B = new V3(...b.map(mm));
    const g = new THREE.CylinderGeometry(mm(24), mm(24), A.distanceTo(B), 12);
    const m = add(root, g, M.stand, 'stand');
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize());
  };
  const Fy = FLOOR_Y * 1000;
  for (const s of [-1, 1]) {
    leg([s * 300, -180, -360], [s * 700, Fy, -150]);
    leg([s * 300, -180, -360], [s * 700, Fy, -1100]);
    leg([s * 340, 60, -360], [s * 700, Fy + 900, -620]);
    leg([s * 700, Fy, -150], [s * 700, Fy, -1100]);
  }
  leg([-700, Fy, -1100], [700, Fy, -1100]);
  leg([-700, Fy, -150], [700, Fy, -150]);

  // ------------------------------------------------------------ the air and the oil, as particles along their paths
  const dotGeo = new THREE.SphereGeometry(1, 10, 8);
  const airDots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({color: ACCENT, transparent: true, opacity: 0.9, depthWrite: false}), 18 * 5 + 60);
  airDots.frustumCulled = false;
  airDots.renderOrder = 4;
  root.add(airDots);
  const oilDots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({color: '#d0902c', transparent: true, opacity: 0.95, depthWrite: false}), 3 * 10);
  oilDots.frustumCulled = false;
  oilDots.renderOrder = 4;
  root.add(oilDots);
  // the charge's path inside the rear case: the carburettor's throat down to the impeller's eye, out to the diffuser
  const throat = new THREE.CatmullRomCurve3([new V3(0, 0.33, -0.56), new V3(0, 0.22, -0.48), new V3(0, 0.06, -0.4), new V3(0, 0.0, -0.33)]);

  // ------------------------------------------------------------ anchors for the callouts (world, metres)
  const top = CYL[0];
  const front1 = CYL[1];
  const A = {
    head: () => cylinders[0].g.localToWorld(new V3(0, mm(560), 0)),
    fins: () => cylinders[0].g.localToWorld(new V3(mm(-100), mm(360), 0)),
    headFront: () => cylinders[1].g.localToWorld(new V3(0, mm(540), mm(30))),
    pushrod: () => cylinders[1].g.localToWorld(new V3(mm(18), mm(400), mm(124))),
    harness: () => new V3(...polar(-60, 302, 268).map(mm)),
    magneto: () => magnetos[1].g.localToWorld(new V3(0, mm(60), 0)),
    nose: () => new V3(0, mm(250), mm(520)),
    hub: () => new V3(0, 0, mm(900)),
    blade: () => blades[0].localToWorld(new V3(0, 1.4, 0)),
    pipe: () => pipeCurves[8].getPoint(0.55),
    carb: () => new V3(0, mm(410), mm(-560)),
    starter: () => new V3(0, 0, mm(-1440)),
    impeller: () => impG.localToWorld(new V3(0, mm(120), 0)),
    camRing: (row = 'front') => camRings[row].localToWorld(new V3(mm(-100), mm(-100), 0)),
    master: (row = 'front') => rods[row].master.localToWorld(new V3(0, mm(150), 0)),
    art: (row, c) => rods[row].arts[c].localToWorld(new V3(0, mm(E.l * 0.5), 0)),
    pin: (row = 'front') => crank[row].localToWorld(new V3(0, mm(E.r * (row === 'rear' ? 1 : -1)), mm(-44))),
    piston: (c) => pistons[c - 1].localToWorld(new V3(0, mm(66), 0)),
    tappet: (c, ev) => train[c - 1][ev].tp.localToWorld(new V3(0, mm(40), 0)),
    rocker: (c, ev) => train[c - 1][ev].rk.localToWorld(new V3(0, 0, mm(30))),
    valve: (c, ev) => train[c - 1][ev].v.localToWorld(new V3(0, mm(470), 0)),
    gear: () => gearG.localToWorld(new V3(mm(-90), mm(90), 0)),
    oilPump: () => new V3(0, mm(-250), mm(-760)),
    sump: () => new V3(mm(100), mm(-280), 0),
    baffle: () => cylinders[4].g.localToWorld(new V3(mm(120), mm(520), 0)),
    cowl: () => new V3(mm(-600), mm(330), mm(300)),
    cylAt: (c, y = 520) => cylinders[c - 1].g.localToWorld(new V3(0, mm(y), 0)),
  };
  void top;
  void front1;

  // ------------------------------------------------------------ cutaways and visibility
  const ghostOf = new Map();
  const ghost = (mat) => {
    let g = ghostOf.get(mat);
    if (!g) {
      g = mat.clone();
      g.transparent = true;
      g.depthWrite = false;
      g.clipShadows = true;
      ghostOf.set(mat, g);
    }
    return g;
  };
  const cut = {mode: 'solid', glass: false};
  const all = Object.values(parts).flat();
  const allMats = new Set();
  for (const m of all) allMats.add(m.material);
  for (const m of Object.values(M)) allMats.add(m);
  const setCut = (mode, plane) => {
    cut.mode = mode;
    if (plane) CLIP[0].copy(plane);
    const planes = mode === 'section' ? CLIP : null;
    for (const mat of [...allMats, ...ghostOf.values()]) {
      mat.clippingPlanes = planes;
      mat.needsUpdate = true;
    }
  };

  // ------------------------------------------------------------ pose everything from the crank angle
  const tmp = new V3();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new V3();
  const up = new V3(0, 1, 0);
  /**
   * fx: th (crank °), vis {group: 0..1 opacity}, glass (bool: case, barrels, heads, pipes as glass), apart (0..1),
   * glow[18] (the flame in each chamber, 0..1), headGlow[18], camHi[18] ({in, ex} 0..1 accent on the tappet and tube),
   * blur (propeller blur 0..1), air (phase), airK (0..1), oil (phase), oilK (0..1)
   */
  const update = (fx) => {
    const th = fx.th;
    const vis = fx.vis || {};
    // groups' visibility: 1 is the part's own material, 0 is hidden, between is a ghost
    for (const g of GROUPS) {
      const v = vis[g] ?? 1;
      for (const m of parts[g]) {
        if (v <= 0.01) {
          m.visible = false;
          continue;
        }
        const vf = fx.focus && m.userData.cyl && m.userData.cyl !== fx.focus && !m.userData.keep ? v * (1 - (fx.focusK ?? 1)) : v;
        if (vf <= 0.01) {
          m.visible = false;
          continue;
        }
        m.visible = true;
        if (m.userData.isFlame) continue;
        const base = m.userData.mat;
        if (m.userData.glassable && fx.glass) m.material = M.glass;
        else if (m.userData.ownMat) {
          m.material = base;
          base.transparent = vf < 0.99;
          base.depthWrite = vf >= 0.99;
          base.opacity = vf;
        } else if (vf < 0.99) {
          const gm = ghost(base);
          gm.opacity = vf;
          m.material = gm;
        } else m.material = base;
      }
    }
    const apart = fx.apart || 0;
    rowG.front.position.z = apart * 0.2;
    rowG.rear.position.z = -apart * 0.14;
    rowG.rear.visible = (fx.hideRear || 0) < 0.5;
    // crank
    crank.rear.rotation.z = th * D2R;
    crank.front.rotation.z = th * D2R;
    // rods and pistons, from the exact geometry of the master and articulated rods
    for (const row of ['rear', 'front']) {
      const P = rowPose(row, th);
      const z = mm(E.rowZ[row]);
      const R = rods[row];
      R.master.position.set(mm(-P.C[0]), mm(P.C[1]), z);
      R.master.rotation.z = Math.atan2(P.d[0], P.d[1]);
      for (const cy of ROWS[row]) {
        const x = P.cyl[cy.c];
        pistons[cy.c - 1].position.y = mm(x.s);
        if (x.master) continue;
        const art = R.arts[cy.c];
        const dx = x.P[0] - x.K[0];
        const dy = x.P[1] - x.K[1];
        art.position.set(mm(-x.K[0]), mm(x.K[1]), z);
        art.rotation.z = Math.atan2(dx, dy);
      }
    }
    // the cam rings turn against the crank at 1/8; tappets ride their lobes, rockers and valves follow
    for (const row of ['rear', 'front']) camRings[row].rotation.z = th * CAM.ratio * D2R;
    for (const C of cylinders) {
      const c = C.cy.c;
      for (const ev of ['in', 'ex']) {
        const T = train[c - 1][ev];
        const L = lift(c, ev, th);
        T.tp.position.y = mm(152 + 12 * L);
        T.v.position.y = mm(-CAM.liftMm * L);
        T.rk.rotation.x = L * 0.2 * (ev === 'in' ? -1 : 1);
        const hi = fx.camHi ? fx.camHi[c - 1]?.[ev] || 0 : 0;
        if (hi > 0.05) {
          T.tp.material = M.accent;
          T.v.material = M.accent;
        }
      }
      const glow = fx.glow ? fx.glow[c - 1] : 0;
      C.flame.material.opacity = Math.min(0.85, glow) * (vis.cyl ?? 1);
      C.flame.visible = glow > 0.01 && (vis.cyl ?? 1) > 0.01 && (!fx.focus || fx.focus === c || (fx.focusK ?? 1) < 0.5);
      const hg = fx.headGlow ? fx.headGlow[c - 1] : 0;
      if (C.head.material !== M.glass) C.head.material.emissiveIntensity = 0.95 * hg;
    }
    // the reduction gear: the sun on the crank, the ring fixed, the carrier (and the propeller) at 0.45
    const prop = th * GEAR.prop;
    sun.rotation.z = th * D2R;
    carrier.rotation.z = prop * D2R;
    // a pinion rolling on the fixed ring: its spin relative to the carrier is -(R/p) times the carrier's turn
    for (const p of planets) p.rotation.z = (-(rpR / rpP) * prop) * D2R;
    propG.rotation.z = (prop + (fx.propOff ?? PROP_OFF)) * D2R;
    const blur = fx.blur || 0;
    const bo = (1 - blur) * (vis.prop ?? 1);
    for (const b of blades) {
      b.visible = bo > 0.02;
      if (b.visible) {
        const gm = bo < 0.99 ? ghost(M.blade) : M.blade;
        gm.opacity = bo;
        b.material = gm;
      }
    }
    blurDisc.visible = blur > 0.01 && (vis.prop ?? 1) > 0.01;
    blurDisc.material.opacity = blur * 0.32 * (vis.prop ?? 1);
    blurTip.visible = blurDisc.visible;
    blurTip.material.opacity = blur * 0.45 * (vis.prop ?? 1);
    blurDisc.rotation.z = prop * D2R;
    impG.rotation.z = th * GEAR.impLow * D2R;
    for (const mg of magnetos) mg.rotor.rotation.y = th * 0.5 * D2R;
    // the charge: dots down the throat, through the impeller, out along every pipe
    const airK = fx.airK || 0;
    airDots.visible = airK > 0.01;
    if (airDots.visible) {
      let n = 0;
      const ph = fx.air || 0;
      const s = 0.011 * airK;
      for (let i = 0; i < 18; i++) {
        for (let j = 0; j < 5; j++) {
          const u = (((j / 5 + ph + i * 0.137) % 1) + 1) % 1;
          pipeCurves[i].getPoint(u, tmp);
          m4.compose(tmp, q, sc.set(s, s, s));
          airDots.setMatrixAt(n++, m4);
        }
      }
      for (let j = 0; j < 60; j++) {
        const u = (((j / 60 + ph * 3) % 1) + 1) % 1;
        if (u < 0.5) throat.getPoint(u * 2, tmp);
        else {
          const a = j * 2.4 + ph * 20;
          const r = 0.04 + (u - 0.5) * 0.58;
          tmp.set(Math.cos(a) * r, Math.sin(a) * r, -0.31);
        }
        m4.compose(tmp, q, sc.set(s, s, s));
        airDots.setMatrixAt(n++, m4);
      }
      airDots.instanceMatrix.needsUpdate = true;
      airDots.material.opacity = 0.9 * airK;
    }
    const oilK = fx.oilK || 0;
    oilDots.visible = oilK > 0.01;
    M.oil.emissiveIntensity = 0.6 * oilK;
    if (oilDots.visible) {
      let n = 0;
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 10; j++) {
          const u = (((j / 10 + (fx.oil || 0)) % 1) + 1) % 1;
          oilCurves[i].getPoint(u, tmp);
          m4.compose(tmp, q, sc.set(0.014, 0.014, 0.014));
          oilDots.setMatrixAt(n++, m4);
        }
      oilDots.instanceMatrix.needsUpdate = true;
      oilDots.material.opacity = oilK;
    }
    void up;
    void lobeOffset;
  };

  return {root, update, setCut, CLIP, A, parts, M, cylinders, rods, pistons, crank, camRings, blades, rowG, plugAt, cut, FLOOR_Y};
}
