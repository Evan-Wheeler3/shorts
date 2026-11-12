// Stage: renderer, soft shadows, optional ambient occlusion, sky/fog, and the 2D overlay
// (STEP labels, eyelids, fades). Shared by every video.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { PAL, pop, clamp, sseg, mat } from './core.js';

export async function createStage({ canvas, W, H, scale = 1, ao = true }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W * scale, H * scale, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PAL.fog, 0.012);
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 900);

  // sky dome with a vertical gradient (ignores fog)
  const skyGeo = new THREE.SphereGeometry(700, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(PAL.navy) }, bottom: { value: new THREE.Color(PAL.fog) }, k: { value: 1.6 } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform float k; varying float h; void main(){ float t = pow(clamp(h*k+0.08,0.0,1.0),0.7); gl_FragColor = vec4(mix(bottom, top, t),1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat); sky.frustumCulled = false; scene.add(sky);

  const hemi = new THREE.HemisphereLight(0x8fa6c8, 0x2a2a30, 0.6); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; key.shadow.radius = 5;
  scene.add(key); scene.add(key.target);

  let composer = null, gtao = null;
  if (ao) {
    const rt = new THREE.WebGLRenderTarget(W * scale, H * scale, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, W * scale, H * scale);
    gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.2, thickness: 1.2, scale: 1.15, samples: 8 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
    composer.addPass(gtao);
    composer.addPass(new OutputPass());
  }

  // ---------- 2D overlay in frame pixels (origin top-left) ----------
  const oscene = new THREE.Scene();
  const ocam = new THREE.OrthographicCamera(0, W, 0, H, -10, 10);
  await new FontFace('Montserrat Black', 'url(/shared/fonts/Montserrat-Black.ttf)').load().then((f) => document.fonts.add(f));
  const quad = (color) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, toneMapped: false })); m.scale.set(W, H, 1); m.position.set(W / 2, H / 2, 5); m.rotation.x = Math.PI; m.material.side = THREE.DoubleSide; oscene.add(m); return m; };
  const fade = quad(0x000000); fade.renderOrder = 20;
  const lidT = quad(0x000000), lidB = quad(0x000000);
  const labels = new Map();
  function makeStepLabel(step, name) {
    const c = document.createElement('canvas'); c.width = 760; c.height = 300;
    const g = c.getContext('2d');
    g.textBaseline = 'middle';
    g.font = '64px "Montserrat Black"';
    const s = `STEP ${step}`; const w = g.measureText(s).width;
    g.fillStyle = '#F2A65A'; g.beginPath(); g.roundRect(8, 10, w + 64, 104, 22); g.fill();
    g.fillStyle = '#141C30'; g.fillText(s, 40, 66);
    g.font = '104px "Montserrat Black"'; g.lineJoin = 'round';
    g.strokeStyle = '#0D1424'; g.lineWidth = 20; g.strokeText(name, 12, 206);
    g.fillStyle = '#F1EDE2'; g.fillText(name, 12, 206);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(760, 300), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false, side: THREE.DoubleSide }));
    m.rotation.x = Math.PI; m.scale.y = 1; oscene.add(m); m.visible = false; return m;
  }
  // free-form 2D layer for counters and tags, drawn by the video each frame: overlay.hud.begin() then use .ctx
  const hudC = document.createElement('canvas'); hudC.width = W; hudC.height = H;
  const hudTex = new THREE.CanvasTexture(hudC); hudTex.colorSpace = THREE.SRGBColorSpace;
  const hudM = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false, toneMapped: false, side: THREE.DoubleSide }));
  hudM.rotation.x = Math.PI; hudM.position.set(W / 2, H / 2, 3); hudM.visible = false; oscene.add(hudM);
  const hud = { ctx: hudC.getContext('2d'), begin() { hud.ctx.setTransform(1, 0, 0, 1, 0, 0); hud.ctx.clearRect(0, 0, W, H); hudM.visible = true; hudTex.needsUpdate = true; return hud.ctx; }, off() { hudM.visible = false; } };
  const overlay = {
    fade: 0, lids: 1, hud,
    step(shot, t) {
      for (const m of labels.values()) m.visible = false;
      if (!shot.step) return;
      const k = shot.step + shot.name;
      if (!labels.has(k)) labels.set(k, makeStepLabel(shot.step, shot.name));
      const m = labels.get(k); const s = pop(t, 0.12, 0.4) * (1 - sseg(t, shot.duration - 0.25, shot.duration - 0.05));
      const ks = 0.8 * s; m.visible = s > 0.001; m.scale.set(ks, ks, 1);
      m.position.set(60 + 380 * ks, 170 + 150 * 0.8, 2);
    },
    apply() {
      fade.material.opacity = clamp(overlay.fade); fade.visible = overlay.fade > 0.002;
      const open = clamp(overlay.lids); lidT.visible = lidB.visible = open < 0.999;
      const h = (1 - open) * H * 0.56;
      lidT.scale.set(W, h, 1); lidT.position.set(W / 2, h / 2, 4);
      lidB.scale.set(W, h, 1); lidB.position.set(W / 2, H - h / 2, 4);
    },
  };

  const font = new FontLoader().parse(await (await fetch('/node_modules/three/examples/fonts/helvetiker_bold.typeface.json')).json());
  // chunky low-poly 3D title text, centred on its origin
  function text3d(str, size = 1, color = PAL.white, o = {}) {
    const geo = new TextGeometry(str, { font, size, depth: size * 0.28, curveSegments: 2, bevelEnabled: true, bevelThickness: size * 0.03, bevelSize: size * 0.025, bevelSegments: 1 });
    geo.center();
    const m = new THREE.Mesh(geo, mat(color, { emissive: color, ei: o.ei ?? 0.55, unique: true, fog: false }));
    m.castShadow = false; m.userData.base = 1; return m;
  }

  function render() {
    overlay.apply();
    renderer.setRenderTarget(null);
    renderer.clear();
    if (composer) composer.render(); else renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(oscene, ocam);
  }
  return { renderer, scene, camera, sky: skyMat.uniforms, hemi, key, overlay, text3d, render, gtao, W, H };
}
