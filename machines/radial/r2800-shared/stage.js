// Radial's stage: a 1940s airfield under a white overcast. A sky dome pale at the zenith (#e4ebf0) down to a warm,
// light horizon; a light concrete apron in 5 m slabs fading into the haze; a hard outdoor sun from the upper left
// with a crisp shadow on the concrete; a pale sky fill. frame(fx, cam) poses the engine and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildEngine, FLOOR_Y} from './model.js';

const V3 = THREE.Vector3;
export const SKY = {zenith: '#e4ebf0', mid: '#edf0f0', horizon: '#f3ece1', ground: '#e6dfd3'};

function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zen: {value: new THREE.Color(SKY.zenith)},
      mid: {value: new THREE.Color(SKY.mid)},
      hor: {value: new THREE.Color(SKY.horizon)},
      gnd: {value: new THREE.Color(SKY.ground)},
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader:
      'uniform vec3 zen; uniform vec3 mid; uniform vec3 hor; uniform vec3 gnd; varying vec3 vD;' +
      'void main(){ float y = vD.y; vec3 c;' +
      ' if (y > 0.0) { float a = clamp(y / 0.18, 0.0, 1.0); float b = clamp((y - 0.18) / 0.6, 0.0, 1.0); c = mix(mix(hor, mid, a), zen, b); }' +
      ' else { c = mix(hor, gnd, clamp(-y / 0.08, 0.0, 1.0)); }' +
      ' gl_FragColor = vec4(c, 1.0); }',
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}
function concreteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#d9d3c8';
  g.fillRect(0, 0, 512, 512);
  // a fixed speckle (a seeded generator: the texture is the same every load)
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9000; i++) {
    const v = 190 + Math.floor(r() * 40);
    g.fillStyle = `rgba(${v},${v - 4},${v - 12},${0.25 + r() * 0.3})`;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(150,140,125,${0.04 + r() * 0.05})`;
    g.beginPath();
    g.ellipse(r() * 512, r() * 512, 20 + r() * 70, 10 + r() * 40, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // the joints of a slab
  g.strokeStyle = 'rgba(140,132,120,0.3)';
  g.lineWidth = 2.5;
  g.strokeRect(1.5, 1.5, 509, 509);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(16, 16);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY.horizon);
  scene.fog = new THREE.Fog(SKY.horizon, 14, 46);
  const sky = skyDome();
  scene.add(sky);
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.02, 120);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.65;
  gtao.updateGtaoMaterial({radius: 0.07, distanceExponent: 1.4, thickness: 0.6, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
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
    sky.visible = on;
    floor.visible = on;
  };
  composer.addPass(new Toggle(() => aoSkip(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(() => aoSkip(true)));
  composer.addPass(new OutputPass());

  // an overcast sky for the metal to reflect: bright above, the warm apron below, a brighter patch toward the sun
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#d6dbde');
    const box = (w, h, pos, color, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(30, 30, new V3(0, 16, 0), '#eef2f5', 2.2);
    box(10, 8, new V3(-12, 9, 6), '#ffffff', 3.0);
    box(30, 4, new V3(0, 1, -16), '#f2ece2', 1.3);
    box(30, 4, new V3(0, 1, 16), '#f2ece2', 1.3);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#bdb6aa', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -3;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 0.75;
    pm.dispose();
  }
  const sun = new THREE.DirectionalLight('#fffaf0', 3.0);
  sun.position.set(-4.2, 7.5, 3.4);
  sun.target.position.set(0, -0.6, -0.2);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 2, far: 20});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.012;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#eaf0f4', '#cbbfae', 0.9));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({color: '#ffffff', map: concreteTexture(), roughness: 0.92, metalness: 0}));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  floor.material.map.repeat.set(24, 24);
  scene.add(floor);

  const eng = buildEngine();
  scene.add(eng.root);

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
    camera.fov = cam.fov ?? 26;
    camera.near = Math.max(0.01, d * 0.03);
    camera.updateProjectionMatrix();
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    gtao.enabled = aoWanted && eng.cut.mode !== 'section' && !fx.glass;
    eng.update(fx);
    composer.render();
  };
  const pv = new V3();
  const project = (p) => {
    if (!p) return null;
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
  // the section plane: n·x + c ≥ 0 is kept
  const planes = {
    rowcut: new THREE.Plane(new V3(0, 0, -1), 0.105),
    profile: new THREE.Plane(new V3(-1, 0, 0), 0),
    inside: new THREE.Plane(new V3(-1, 0, 0), 0),
  };
  let cutKey = '';
  const setCut = (mode, planeKey = 'profile') => {
    const key = mode + ':' + planeKey;
    if (key === cutKey) return;
    cutKey = key;
    eng.setCut(mode, planes[planeKey]);
  };
  setCut('solid');
  return {renderer, scene, camera, eng, composer, gtao, sun, resize, frame, project, size, setQuality, setCut, planes};
}
