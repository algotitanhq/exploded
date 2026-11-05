// Rope's stage: a sheet of the MIT Instrumentation Lab's documentation rather than a studio. Warm ivory paper with a
// faint millimetre grid and a drawing frame (a screen-space background, so the grid stays put like the sheet it is),
// one warm desk lamp low on the left for long soft shadows, a pale fill. The camera is a long lens, close to an
// axonometric projection. frame(fx, cam) poses the machine and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildMachine} from './agc.js';

export const PAPER = {bg: '#efe8d8', minor: 'rgba(120,96,58,0.075)', major: 'rgba(120,96,58,0.14)', frame: 'rgba(70,58,40,0.55)'};
const V3 = THREE.Vector3;

/** the drawing sheet: grid every 6 px ("1 mm"), heavier every 60, a frame with zone letters; 1600 x 900 layout */
export function paperCanvas(scale = 2) {
  const W = 1600;
  const H = 900;
  const c = document.createElement('canvas');
  c.width = W * scale;
  c.height = H * scale;
  const g = c.getContext('2d');
  g.scale(scale, scale);
  g.fillStyle = PAPER.bg;
  g.fillRect(0, 0, W, H);
  // a faint warm vignette, like a lamp on paper
  const rg = g.createRadialGradient(W * 0.36, H * 0.3, 80, W * 0.5, H * 0.5, W * 0.75);
  rg.addColorStop(0, 'rgba(255,250,236,0.5)');
  rg.addColorStop(1, 'rgba(160,130,80,0.10)');
  g.fillStyle = rg;
  g.fillRect(0, 0, W, H);
  const line = (x0, y0, x1, y1, col, w) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  };
  const m = 14;
  for (let x = m; x <= W - m; x += 6) line(x + 0.25, m, x + 0.25, H - m, (x - m) % 60 === 0 ? PAPER.major : PAPER.minor, (x - m) % 60 === 0 ? 0.7 : 0.45);
  for (let y = m; y <= H - m; y += 6) line(m, y + 0.25, W - m, y + 0.25, (y - m) % 60 === 0 ? PAPER.major : PAPER.minor, (y - m) % 60 === 0 ? 0.7 : 0.45);
  g.strokeStyle = PAPER.frame;
  g.lineWidth = 1.2;
  g.strokeRect(m, m, W - 2 * m, H - 2 * m);
  g.lineWidth = 0.6;
  g.strokeRect(m - 5, m - 5, W - 2 * m + 10, H - 2 * m + 10);
  return c;
}

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const bgTex = new THREE.CanvasTexture(paperCanvas(2));
  bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex;
  const camera = new THREE.PerspectiveCamera(18, 16 / 9, 0.001, 30);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  // a warm room for the metal to reflect
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#d8cdb5');
    const box = (w, h, pos, col, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0.5, 0);
      env.add(m);
    };
    box(10, 10, new V3(-3, 9, 4), '#fff3dc', 2.2);
    box(4, 8, new V3(-9, 3, 2), '#ffe9c4', 1.8);
    box(4, 8, new V3(9, 3, -3), '#f2efe6', 1.1);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 0.75;
    pm.dispose();
  }
  // the desk lamp: warm, low on the left and in front, long shadows
  const lamp = new THREE.DirectionalLight('#ffe2b8', 2.6);
  lamp.position.set(-1.6, 1.25, 1.35);
  lamp.target.position.set(0, 0, -0.05);
  lamp.castShadow = true;
  Object.assign(lamp.shadow.camera, {left: -0.9, right: 0.9, top: 0.75, bottom: -0.75, near: 0.5, far: 4.5});
  lamp.shadow.mapSize.set(4096, 4096);
  lamp.shadow.radius = 5;
  lamp.shadow.bias = -0.0003;
  lamp.shadow.normalBias = 0.0015;
  scene.add(lamp, lamp.target);
  scene.add(new THREE.HemisphereLight('#fff8ea', '#cdbf9f', 1.05));
  const fill = new THREE.DirectionalLight('#e8eef5', 0.45);
  fill.position.set(1.4, 0.9, 1.6);
  scene.add(fill);
  // a lamp that follows the camera when it is inside a module, so the cores read
  const inner = new THREE.PointLight('#fff1da', 0, 0.3, 1.5);
  scene.add(inner);

  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.ShadowMaterial({color: '#5a4630', opacity: 0.3, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);

  const mac = buildMachine();
  scene.add(mac.root);
  mac.root.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh) {
      o.castShadow = o.castShadow ?? true;
      o.receiveShadow = true;
    }
  });

  const size = {w: 1600, h: 900, pr: 1};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    size.pr = pr;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  // cam: target (tx, ty, tz), azimuth from +z toward +x, elevation, distance (radians, metres), fov, sx/sy screen shift
  const frame = (fx, cam) => {
    const {tx, ty, tz, az, el, d} = cam;
    camera.fov = cam.fov ?? 18;
    camera.position.set(tx + d * Math.cos(el) * Math.sin(az), ty + d * Math.sin(el), tz + d * Math.cos(el) * Math.cos(az));
    camera.lookAt(tx, ty, tz);
    camera.near = Math.max(0.0005, d * 0.05);
    camera.far = Math.max(6, d * 20);
    camera.updateProjectionMatrix();
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    const close = Math.max(0, Math.min(1, (0.3 - d) / 0.2));
    inner.intensity = close * 0.25;
    inner.position.copy(camera.position).add(new V3(-0.01, 0.02, 0.01));
    mac.update(fx);
    composer.render();
  };
  const pv = new V3();
  const project = (p) => {
    pv.copy(p).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, shadow}) => {
    if (samples !== undefined)
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    if (shadow !== undefined) {
      lamp.shadow.mapSize.set(shadow, shadow);
      lamp.shadow.map?.dispose();
      lamp.shadow.map = null;
    }
  };
  return {renderer, scene, camera, mac, composer, lamp, resize, frame, project, size, setQuality};
}
