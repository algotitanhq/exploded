// Pepper's stage: a watchmaker's catalogue shot. Pale cool stone behind (#e9e7e2, a soft gradient), one large light
// box overhead that the satin steel and the knurls catch, deep contact shadows under the machine, and a short depth of
// field on the macro views only (a bokeh pass the working views never pay for). frame(S, fx, cam) draws one frame.
import * as THREE from 'three';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildCurta} from './curta.js';

const V3 = THREE.Vector3;
export const BG = {top: '#efeeea', mid: '#e9e7e2', low: '#dedbd4'};

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  {
    // stone: a vertical gradient with a faint warm-cool falloff toward the corners
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, BG.top);
    gr.addColorStop(0.58, BG.mid);
    gr.addColorStop(1, BG.low);
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 512);
    const rv = g.createRadialGradient(256, 210, 60, 256, 256, 420);
    rv.addColorStop(0, 'rgba(255,255,255,0.22)');
    rv.addColorStop(1, 'rgba(150,152,158,0.18)');
    g.fillStyle = rv;
    g.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
  }
  const camera = new THREE.PerspectiveCamera(24, 16 / 9, 0.005, 5);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({radius: 0.006, distanceExponent: 1.3, thickness: 0.004, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16});
  composer.addPass(gtao);
  const bokeh = new BokehPass(scene, camera, {focus: 0.1, aperture: 0.002, maxblur: 0.008});
  bokeh.enabled = false;
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());

  // the light box: one big panel overhead, a dim stone room, a narrow strip low on the right for an edge on the knurls
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#8e8c88');
    const box = (w, h, pos, k, tint = '#ffffff') => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(tint).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(6, 6, new V3(0, 5, 0.6), 4.2);
    box(1.2, 5, new V3(4.5, 1.2, -1.5), 1.4, '#f4f1ea');
    box(1.0, 5, new V3(-4.5, 1.0, 1.5), 0.8, '#eef0f4');
    box(8, 1.2, new V3(0, 0.6, 5), 0.9, '#efede8');
    const g = new THREE.Mesh(new THREE.CircleGeometry(20, 32), new THREE.MeshBasicMaterial({color: '#c9c6bf', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -0.6;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 1.0;
    pm.dispose();
  }
  const sun = new THREE.DirectionalLight('#fffdf8', 2.6);
  sun.position.set(0.06, 0.5, 0.12);
  sun.target.position.set(0, 0.04, 0);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -0.12, right: 0.12, top: 0.12, bottom: -0.12, near: 0.2, far: 0.8});
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.00005;
  sun.shadow.normalBias = 0.0002;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#b8b4ac', 0.55));
  // a small fill for the inside of the open machine
  const fill = new THREE.PointLight('#fff8ec', 0.06, 0.4, 1.5);
  fill.position.set(0.05, 0.06, 0.09);
  scene.add(fill);

  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.2),
    new THREE.ShadowMaterial({color: '#3c3830', opacity: 0.42, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);

  const mac = buildCurta();
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
  let dofWanted = true;
  // cam: target (tx, ty, tz) in metres, azimuth from +z toward +x, elevation, distance, sx/sy screen shift (px)
  const frame = (S, fx, cam) => {
    const {tx, ty, tz, az, el, d} = cam;
    camera.position.set(tx + d * Math.cos(el) * Math.sin(az), ty + d * Math.sin(el), tz + d * Math.cos(el) * Math.cos(az));
    camera.lookAt(tx, ty, tz);
    camera.near = Math.max(0.002, d * 0.08);
    camera.far = Math.max(1.5, d * 12);
    camera.updateProjectionMatrix();
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    shade.position.y = (fx.explode ?? 0) * -0.056;
    mac.update(S, {...fx, clipAz: fx.clipAz ?? (az * 180) / Math.PI});
    gtao.enabled = aoWanted && (fx.cut !== 'section');
    const dof = dofWanted ? fx.dof ?? 0 : 0;
    bokeh.enabled = dof > 0.02;
    if (bokeh.enabled) {
      bokeh.uniforms.focus.value = d;
      bokeh.uniforms.aperture.value = 0.0022 * dof;
      bokeh.uniforms.maxblur.value = 0.009 * dof;
    }
    composer.render();
  };
  const pv = new V3();
  const project = (p) => {
    pv.copy(p).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, ao, shadow, dof}) => {
    if (samples !== undefined) {
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    }
    if (ao !== undefined) aoWanted = ao;
    if (dof !== undefined) dofWanted = dof;
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  let cutNow = '';
  const setCut = (mode) => {
    if (mode === cutNow) return;
    cutNow = mode;
    mac.setCut(mode);
  };
  setCut('solid');
  return {renderer, scene, camera, mac, composer, gtao, bokeh, sun, resize, frame, project, size, setQuality, setCut};
}
