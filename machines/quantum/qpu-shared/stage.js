// The QPU's stage: the V8's pale studio scaled to two 2 m cabinets. A soft shadow on an invisible floor, soft boxes
// for the metal to catch, GTAO for the cabinet interiors (off when the camera is down at the chip, where it would
// smear the waveguides). frame(fx, cam) poses the machine and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildMachine} from './machine.js';

const V3 = THREE.Vector3;
export const BG = {top: '#f3f3f4', mid: '#e9eaec', low: '#e1e2e5'};

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 512;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, BG.top);
    gr.addColorStop(0.55, BG.mid);
    gr.addColorStop(1, BG.low);
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
  }
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.01, 60);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.7;
  gtao.updateGtaoMaterial({radius: 0.12, distanceExponent: 1.4, thickness: 0.6, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  const aoSkip = (on) => {
    shade.visible = on;
    mac.root.children.forEach((c) => {
      if (c.isPoints) c.visible = on;
    });
  };
  composer.addPass(new Toggle(() => aoSkip(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(() => aoSkip(true)));
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#d9dadd');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 1, 0);
      env.add(m);
    };
    box(14, 14, new V3(0, 16, 3), 2.6);
    box(3, 14, new V3(-13, 5, 7), 3.2);
    box(3, 14, new V3(13, 5, -4), 2.0);
    box(20, 2, new V3(0, 3, 15), 1.6);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#c9cacd', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -1;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 1.0;
    pm.dispose();
  }
  const sun = new THREE.DirectionalLight('#ffffff', 2.0);
  sun.position.set(-2.4, 6.0, 4.2);
  sun.target.position.set(0, 1, 0);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -2.2, right: 2.2, top: 2.4, bottom: -1.6, near: 1, far: 14});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 10;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.004;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfd0d3', 0.8));
  // a soft fill inside the open cabinets so the dark interiors read
  const fill = new THREE.PointLight('#ffffff', 1.4, 3.5, 1.6);
  fill.position.set(0, 1.4, 1.6);
  scene.add(fill);

  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({color: '#5d636c', opacity: 0.26, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.0005;
  shade.receiveShadow = true;
  scene.add(shade);

  const mac = buildMachine();
  scene.add(mac.root);

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
  let aoWanted = true;
  // cam: target (tx, ty, tz), azimuth from +z toward +x, elevation, distance (radians, metres), sx/sy screen shift
  const frame = (fx, cam) => {
    const {tx, ty, tz, az, el, d} = cam;
    camera.position.set(tx + d * Math.cos(el) * Math.sin(az), ty + d * Math.sin(el), tz + d * Math.cos(el) * Math.cos(az));
    camera.lookAt(tx, ty, tz);
    camera.near = Math.max(0.0004, d * 0.02);
    camera.far = Math.max(12, d * 30);
    camera.updateProjectionMatrix();
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    gtao.enabled = aoWanted && d > 0.5 && cutNow !== 'section';
    mac.update({...fx, pr: size.pr * (size.h / 900)});
    composer.render();
  };
  const pv = new V3();
  const project = (p) => {
    pv.copy(p).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, ao, shadow}) => {
    if (samples !== undefined) {
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    }
    if (ao !== undefined) aoWanted = ao;
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  // GTAO's normal pass would bring the cut half back as a pale ghost, and clipping it there would cut every cabinet
  // part in front of the plane: in section mode the AO stays off.
  let cutNow = 'section';
  const setCut = (mode) => {
    if (mode === cutNow && mac.cutDone) return;
    cutNow = mode;
    mac.cutDone = true;
    mac.setCut(mode);
  };
  setCut('section');
  return {renderer, scene, camera, mac, composer, gtao, sun, resize, frame, project, size, setQuality, setCut};
}
