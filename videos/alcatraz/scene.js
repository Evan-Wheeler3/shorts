// HOW TO ESCAPE FROM ALCATRAZ - shot animation. Every frame is a pure function of
// (shot, t): nothing accumulates, so any frame can be rendered on its own.
// t is seconds since the shot started; c holds the shot's cue times resolved from the
// narration's word timestamps (see script.json -> cues, and shotlist.retimed.json).
import * as THREE from 'three';
import { PAL, clamp, lerp, seg, sseg, eseg, smooth, easeIO, easeOut, easeIn, backOut, pop, pulse, hash, camAt, setPop } from '/shared/web/core.js';
import { applyPose, mixPose, Pose } from '/shared/web/figure.js';
import { buildSet, G, cx, ventX, ventY, bunkX, groundY, VENT } from './set.js';
import { buildProps } from './props.js';

const PI = Math.PI, S_ = Math.sin, C_ = Math.cos;
const SCRAPE = 0.5;                       // seconds per spoon stroke (sfx.py uses the same rhythm)
const col = (h) => new THREE.Color(h);
const MOODS = {
  nightIn: { top: 0x0c1424, bot: 0x2a4048, fog: 0x2a4048, fd: 0.012, hs: 0x7c94c4, hg: 0x2a2a34, hi: 0.75, kc: 0xa8c0ff, ki: 0.7, exp: 1.1, water: 0x101b33, bulb: 5, angel: 0x33505a },
  nightOut: { top: 0x0b1326, bot: 0x3d5a60, fog: 0x3d5a60, fd: 0.016, hs: 0x7896c6, hg: 0x1e2636, hi: 0.8, kc: 0x9fb8ff, ki: 0.9, exp: 1.1, water: 0x0f1a33, bulb: 5, angel: 0x3a565d },
  dawn: { top: 0x6a8fb5, bot: 0xf2c59c, fog: 0xe6bf9f, fd: 0.007, hs: 0xffe6cc, hg: 0x6a6470, hi: 1.0, kc: 0xffd0a0, ki: 1.6, exp: 1.0, water: 0x7d9bb0, bulb: 0.6, angel: 0xa9b3b8 },
};
const COLS = ['top', 'bot', 'fog', 'hs', 'hg', 'kc', 'water', 'angel'];
function mixMood(a, b, u) { const o = {}; for (const k in a) o[k] = COLS.includes(k) ? col(a[k]).lerp(col(b[k]), u) : lerp(a[k], b[k], u); return o; }

export async function create(stage, list) {
  const { scene, camera, overlay } = stage;
  const S = buildSet(scene);
  const P = buildProps(scene, stage);
  const F = P.fig, WALLC = col(PAL.concrete), CEMENT = col(0xcfcac0);
  const hidables = [];
  scene.traverse((o) => { if (o.visible === false) hidables.push(o); });
  P.fig.B.add(P.acc); P.acc.position.set(0, 1.16, 0.3);
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  let bulbK = 1;

  function mood(m, dir = [0.4, 1, 0.8], focus = [1, 1, 0], size = 9) {
    stage.sky.top.value.set(m.top); stage.sky.bottom.value.set(m.bot);
    scene.fog.color.set(m.fog); scene.fog.density = m.fd;
    stage.hemi.color.set(m.hs); stage.hemi.groundColor.set(m.hg); stage.hemi.intensity = m.hi;
    stage.key.color.set(m.kc); stage.key.intensity = m.ki;
    stage.renderer.toneMappingExposure = m.exp;
    S.waterMat.color.set(m.water); S.angelMat.color.set(m.angel);
    bulbK = m.bulb;
    for (const b of S.bulb) { b.light.intensity = m.bulb; b.mesh.material.emissiveIntensity = 0.3 + 0.26 * m.bulb; }
    const d = new THREE.Vector3(...dir).normalize();
    stage.key.target.position.set(...focus); stage.key.position.set(focus[0] + d.x * 40, focus[1] + d.y * 40, focus[2] + d.z * 40);
    const sc = stage.key.shadow.camera; sc.left = sc.bottom = -size; sc.right = sc.top = size; sc.near = 1; sc.far = 90; sc.updateProjectionMatrix();
  }
  const bulbs = (k) => { for (const b of S.bulb) { b.light.intensity = bulbK * k; b.mesh.material.emissiveIntensity = 0.3 + 0.26 * bulbK * k; } };
  function cam(cm, shake = 0, t = 0, offset = 0.09) {
    camera.up.set(0, 1, 0);
    camera.position.set(cm.p[0] + shake * S_(t * 97), cm.p[1] + shake * S_(t * 123 + 1), cm.p[2] + shake * S_(t * 71 + 2));
    camera.fov = cm.fov; camera.setViewOffset(stage.W, stage.H, 0, offset * stage.H, stage.W, stage.H);
    camera.lookAt(cm.l[0], cm.l[1], cm.l[2]); camera.updateMatrixWorld();
  }
  const put = (f, x, y, z, heading, pose) => { f.visible = true; f.position.set(x, y, z); f.rotation.set(0, heading, 0); applyPose(f, pose); return f; };
  const show = (o, x, y, z, s = 1) => { o.visible = s > 0.001; o.position.set(x, y, z); o.scale.setScalar(Math.max(s, 0.001)); return o; };
  const face = (o, spin = 0) => { o.quaternion.copy(camera.quaternion); if (spin) o.rotateY(spin); };
  const strokeEnv = (tt) => (tt < 0 ? 0 : (tt % SCRAPE) < 0.27 ? S_(((tt % SCRAPE) / 0.27) * PI) : 0);

  function reset(id) {
    for (const o of hidables) o.visible = false;
    P.propLight.intensity = 0;
    for (const k of ['roof', 'roofVent', 'shellBack', 'shellLeft', 'endWall', 'bars', 'blockTop', 'sheets', 'furniture', 'pipes', 'pipesH', 'fences', 'towerG']) S[k].visible = true;
    S.fan.rotation.y = 0; S.ventCap.rotation.set(0, 0, 0); S.ventCap.position.set(0, 0.5, 0);
    overlay.fade = 0; overlay.lids = 1;
    S.corridorLight.intensity = 0; S.topLight.intensity = 0; S.angelMat.emissiveIntensity = 0;
    S.corridorLight.position.set(1.6, 1.6, -2.1);
    for (let i = 0; i < G.N; i++) {
      S.plug[i].forEach((m, k) => { m.visible = true; m.material.color.copy(WALLC); m.material.emissive.set(0x000000); });
      S.grille[i].visible = true; S.holeGlow[i].material.opacity = 0;
      const fk = S.fake[i]; fk.visible = false; fk.position.set(ventX(i), ventY, -1.385); fk.rotation.set(0, 0, 0); fk.scale.setScalar(1);
      fk.userData.board.material.color.copy(WALLC); fk.userData.paint.scale.setScalar(1);
      S.lump[i].visible = false;
    }
    // story state carried between shots
    if (id >= 4) { S.plug[3].forEach((m) => (m.visible = false)); S.grille[3].visible = false; }
    if (id >= 5) S.fake[3].visible = true;
    if (id === 7 || id === 8) {
      for (let i = 0; i < G.N; i++) { S.grille[i].visible = false; S.fake[i].visible = false; if (i > 0) S.plug[i].forEach((m) => (m.visible = false)); }
      S.plug[0].forEach((m, k) => { m.visible = k < 4; m.material.color.copy(CEMENT); });   // West's opening: too narrow
    }
    if (id >= 9) for (let i = 1; i < G.N; i++) { S.plug[i].forEach((m) => (m.visible = false)); S.grille[i].visible = false; S.fake[i].visible = true; }
  }
  const digPlug = (n) => { const order = [1, 3, 0, 2, 6, 7, 4, 5]; for (let k = 0; k < Math.min(n, 8); k++) S.plug[3][order[k]].visible = false; };
  const beam = (g, from, to, spread, color, power) => g.userData.aim(from, to, spread, color, power);
  const torchPos = () => { P.guard.updateWorldMatrix(true, true); return P.torch.getWorldPosition(new THREE.Vector3()); };
  const WHITE = col(0xfff1dc), RED = col(PAL.red);
  const guardPose = (walkPhase, moving, aim = -1.1) => { const p = moving ? Pose.walk(walkPhase, 0.8) : Pose.stand(walkPhase * 0.2); p.shB = [aim, 0, -0.1]; p.elB = [-0.25]; return p; };
  function decoyStage(n, tintU = 1) {  // finished decoy
    const H = P.decoy.userData; H.plaster.visible = false; H.soap.visible = true; H.soap.scale.set(0.92, 1.08, 0.98); H.paper.visible = false; H.hair.visible = true; H.hair.scale.setScalar(1);
    H.skinMat.color.set(0xe7dcc0).lerp(col(PAL.skin), tintU);
  }
  function chips(tt, ox, oy, oz) {
    P.chips.forEach((m, i) => {
      const n = Math.floor(tt / SCRAPE) - (i % 2), age = tt - n * SCRAPE - 0.1 - (i % 4) * 0.03;
      if (tt < 0 || n < 0 || age < 0 || age > 0.75) { m.visible = false; return; }
      const h = (k) => hash(i * 7 + n * 13 + k);
      m.visible = true; m.position.set(ox + (h(1) - 0.5) * 0.3 + (h(2) - 0.5) * 1.1 * age, oy + (0.6 + 1.6 * h(3)) * age - 4.5 * age * age, oz + (0.5 + 0.9 * h(4)) * age);
      if (m.position.y < 0.02) m.position.y = 0.02;
      m.rotation.set(age * 9 * h(5), age * 7, 0); m.scale.setScalar(0.7 + h(6));
    });
  }
  function rings(list_, fn) { P.rings.forEach((r, i) => { const o = fn(i); if (!o) { r.visible = false; return; } r.visible = true; r.position.set(o.x, o.y, o.z); r.scale.setScalar(o.r); r.material.opacity = o.a; r.material.color.copy(o.c || RED); r.material.emissive.copy(o.c || RED); if (o.q) r.quaternion.copy(o.q); else r.rotation.set(0, 0, 0); }); }

  // ================================================================= SHOT 1: HOOK
  function shot1(t, c, d) {
    for (let i = 0; i < 3; i++) S.lump[i].visible = true;
    if (t < c.alcatraz) {
      mood(MOODS.nightIn, [0.2, 0.7, 1], [2.4, 1, 0], 5);
      overlay.lids = t < 0.5 ? 0.45 * sseg(t, 0.08, 0.5) : t < 0.9 ? lerp(0.45, 0.1, sseg(t, 0.5, 0.9)) : lerp(0.1, 1, sseg(t, 0.9, 1.6));
      const u = eseg(t, 0.4, c.alcatraz + 0.4);
      cam({ p: [2.03, 0.86, -0.92], l: [lerp(2.42, 2.5, u), lerp(2.25, 1.22, u), lerp(0.3, 1.4, u)], fov: 60 }, 0, 0, 0);
      setPop(P.t1962, pop(t, c.year, 0.45) * 0.55); P.t1962.position.set(2.52, 1.42, 0.9); face(P.t1962, 0.25 * S_(t * 1.3));
    } else {
      const u = seg(t, c.alcatraz, d);
      mood(mixMood(MOODS.nightIn, MOODS.nightOut, sseg(u, 0.15, 0.6)), [0.3, 0.9, 1], [0, 0, 0], 20);
      const cm = camAt([{ t: c.alcatraz, p: [2.85, 1.3, 1.2], l: [2.1, 0.85, -1.2], fov: 42 }, { t: d - 0.2, p: [7.5, 8, 35], l: [0.4, 0.2, 0], fov: 30 }, { t: d, p: [7.5, 8, 35], l: [0.4, 0.2, 0], fov: 30 }], t, (x) => easeIO(x));
      cam(cm, 0, 0, 0.09 * sseg(u, 0, 0.5));
      put(F.A, 2.36, 0, -0.55, PI / 2, Pose.sit(0.5));
      beam(S.search[0], S.towers[0], tmpV.set(-14 + 14 * sseg(u, 0.3, 1), -0.4, 5.5 + 1.5 * S_(t)), 1.8, RED, 0.8 * sseg(u, 0.35, 0.6));
    }
  }
  // ================================================================= SHOT 2: THE WALL
  function shot2(t, c, d) {
    mood(MOODS.nightIn, [0.7, 1, 0.9], [2.4, 0.5, -0.8], 6);
    S.roof.visible = S.roofVent.visible = S.blockTop.visible = S.sheets.visible = S.endWall.visible = S.bars.visible = false;
    for (let i = 0; i < 3; i++) S.lump[i].visible = true;
    const tt = t - c.dig, sh = 0.012 * strokeEnv(tt);
    cam(camAt([{ t: 0, p: [7.6, 5.0, 4.0], l: [2.4, 0.9, -1.1], fov: 35 }, { t: c.vent, p: [7.2, 4.7, 3.7], l: [2.4, 0.8, -1.2], e: smooth }, { t: c.corridor + 1.0, p: [5.9, 2.1, 1.8], l: [2.72, 0.6, -1.45] }, { t: d, p: [5.5, 1.75, 1.45], l: [2.72, 0.6, -1.45], e: smooth }], t), sh, t);
    // salt air + cracks
    const sa = sseg(t, c.salt, c.salt + 0.6) * (1 - sseg(t, c.vent + 0.5, c.vent + 1.6));
    P.salt.forEach((m, i) => { m.visible = sa > 0.01; if (!m.visible) return; const z0 = hash(i) * 5.2; m.position.set(1.7 + hash(i + 50) * 2.2 - 0.12 * t, 0.3 + hash(i + 90) * 2.6 + 0.12 * S_(t * 1.5 + i), -3.6 + ((z0 + 0.7 * t) % 5.2)); m.material.opacity = sa * 0.9; });
    P.cracks.forEach((m, i) => { const s = eseg(t, c.salt + 0.7 + i * 0.1, c.salt + 0.95 + i * 0.1); m.visible = s > 0.01; m.scale.set(Math.max(s, 0.01), 1, 1); });
    const g = sseg(t, c.vent, c.vent + 1.3);
    S.corridorLight.intensity = 14 * g; S.holeGlow[3].material.opacity = 0.9 * g; S.corridorLight.position.set(2.4, 1.3, -2.1);
    // you, at the vent with a spoon
    const k = eseg(t, c.dig - 1.0, c.dig - 0.15);
    const pose = mixPose(Pose.stand(t), Pose.kneel(tt > 0 ? (tt / SCRAPE) * PI * 2 : 0), k);
    put(F.A, lerp(2.5, 2.42, k), 0, lerp(-0.1, -0.76, k), lerp(PI, PI - 0.42, k), pose);
    P.spoon.visible = k > 0.5;
    chips(tt, ventX(3) + 0.18, 0.5, -1.36);
    digPlug(Math.floor(clamp((tt - 0.9) / 1.3, 0, 2)));
    setPop(P.bigSpoon, pop(t, c.spoon, 0.4) * 3.4); P.bigSpoon.position.set(3.02, 1.12, -0.9); face(P.bigSpoon, 0.6 * S_(t * 2.2)); P.bigSpoon.rotateZ(-0.5);
  }
  // ================================================================= SHOT 3: THE NOISE
  function shot3(t, c, d) {
    mood(MOODS.nightIn, [0.3, 0.9, 1], [1.6, 1, 0], 7);
    S.bars.visible = false; S.lump[0].visible = S.lump[1].visible = true;
    S.holeGlow[3].material.opacity = 0.8; S.corridorLight.intensity = 6;
    const drillOn = t > c.motor + 0.9, muff = sseg(t, c.muffle, c.muffle + 0.3);
    const sh = t < c.build ? 0.016 * strokeEnv(t) : drillOn ? lerp(0.009, 0.003, muff) : 0;
    cam(camAt([{ t: 0, p: [2.75, 1.5, 5.2], l: [2.6, 0.62, -1.2], fov: 35 }, { t: c.cover, p: [2.7, 1.5, 4.9], l: [2.6, 0.62, -1.2], e: smooth }, { t: c.accordion + 0.7, p: [1.6, 1.8, 10.6], l: [1.6, 0.75, -1.0] }, { t: d, p: [1.6, 1.8, 10.2], l: [1.6, 0.75, -1.0], e: smooth }], t), sh, t);
    digPlug(t < c.build ? 2 : 3 + Math.floor(clamp((t - c.cover) / 1.5, 0, 3)));
    const working = t < c.build || t > c.cover;
    put(F.A, 2.42, 0, -0.76, PI - 0.42, Pose.kneel(t < c.build ? (t / SCRAPE) * PI * 2 : working ? t * 30 : 0));
    P.spoon.visible = t < c.build;
    if (t < c.build) chips(t, ventX(3) + 0.18, 0.5, -1.36);
    // the drill, presented large then put to work
    const away = sseg(t, c.cover, c.cover + 0.45), D = P.drill.userData;
    const ds = pop(t, c.build, 0.4) * (1 - away) * 1.25;
    P.propLight.position.set(3.2, 2.2, 3.4); P.propLight.intensity = 22 * (1 - away) * sseg(t, c.build - 0.2, c.build + 0.2);
    show(P.drill, lerp(2.5, 2.74, away), lerp(1.12, 0.6, away), lerp(1.7, -1.0, away), ds);
    P.drill.rotation.set(0.1, -0.35 + 0.22 * S_(t * 1.6), 0.05 + (drillOn ? 0.012 * S_(t * 80) : 0));
    D.handle.visible = true;
    const mo = pop(t, c.motor, 0.4); D.motor.visible = mo > 0.001; D.motor.scale.setScalar(Math.max(mo, 0.001)); D.motor.position.x = 0.9 * (1 - eseg(t, c.motor, c.motor + 0.4));
    const bi = pop(t, c.motor + 0.42, 0.35); D.bit.visible = bi > 0.001; D.bit.scale.setScalar(Math.max(bi, 0.001)); D.bit.position.x = 0.7 * (1 - eseg(t, c.motor + 0.42, c.motor + 0.8)); D.bit.rotation.x = drillOn ? t * 45 : 0;
    const ho = pop(t, c.muffle, 0.35); D.housing.visible = ho > 0.001; D.housing.scale.setScalar(Math.max(ho, 0.001)); D.housing.position.y = 0.7 * (1 - easeOut(seg(t, c.muffle, c.muffle + 0.22)));
    // the accordionist next door
    const playing = sseg(t, c.accordion - 0.2, c.accordion + 0.3), bw = 0.34 + 0.2 * playing * (0.5 + 0.5 * S_((t - c.accordion) * 3.4));
    const sit = Pose.sit(0.5); sit.shA = [-0.75, 0, 0.25 + bw * 0.5]; sit.shB = [-0.75, 0, -0.25 - bw * 0.5]; sit.elA = [-1.25, 0, -0.5]; sit.elB = [-1.25, 0, 0.5]; sit.head = [0.1, 0.3 * S_(t * 1.7) * playing, 0.12 * S_(t * 3.4) * playing]; sit.spine = [0.05, 0, 0.06 * S_(t * 3.4) * playing];
    put(F.B, 0.66, 0, 0.2, 0.55, sit);
    P.acc.visible = true; P.acc.userData.set(bw); P.acc.rotation.z = 0.1 * S_(t * 3.4) * playing;
    // sound: red rings = danger; amber notes soak them up
    const absorb = sseg(t, c.accordion + 0.3, c.accordion + 1.8);
    rings(null, (i) => {
      if (t < c.build) { const n = Math.floor(t / SCRAPE) - i; const age = t - n * SCRAPE; if (n < 0 || i > 2 || age > 1.3) return null; return { x: 2.74, y: 0.45, z: -1.2 + age * 2.2, r: 0.2 + age * 1.0, a: 0.95 * (1 - age / 1.3) }; }
      if (drillOn && t < c.cover + 0.2) { const per = 0.3, n = Math.floor((t - c.motor - 0.9) / per) - i, age = t - c.motor - 0.9 - n * per; if (n < 0 || i > 3 || age > 1.2) return null; const R = lerp(0.95, 0.3, muff); return { x: 2.75, y: 1.12, z: 1.75, r: 0.3 + age * R, a: lerp(0.9, 0.45, muff) * (1 - age / 1.2) * (1 - away), q: camera.quaternion }; }
      if (t > c.cover + 0.5) { const per = 0.45, n = Math.floor((t - c.cover) / per) - i, age = t - c.cover - n * per; if (n < 0 || i > 3 || age > 1.8) return null; const lim = lerp(1.8, 0.75, absorb); if (age > lim) return null; return { x: 2.74, y: 0.5, z: -1.2 + age * 1.6, r: 0.2 + age * lerp(0.75, 0.4, absorb), a: 0.8 * (1 - age / lim), c: RED.clone().lerp(col(PAL.amber), absorb * seg(age, 0.2, 0.75)) }; }
      return null;
    });
    P.notes.forEach((g, i) => {
      const per = 0.42, life = 3.0, tt = t - c.accordion - 0.25, n = Math.floor(tt / per), k = n - ((n - i) % 8 + 8) % 8, age = tt - k * per;
      if (tt < 0 || k < 0 || age > life) { g.visible = false; return; }
      const u = age / life; g.visible = true;
      g.position.set(0.95 + u * 2.3 + 0.12 * S_(age * 3 + k), 1.45 + 0.75 * S_(u * PI) + 0.1 * S_(age * 5 + k * 2) - u * 0.7, 1.75); g.quaternion.copy(camera.quaternion); g.rotateZ(0.25 * S_(age * 4 + k));
      g.scale.setScalar(backOut(clamp(age / 0.25)) * 1.25); g.userData.m.opacity = 1 - sseg(u, 0.75, 1);
    });
  }
  // ================================================================= SHOT 4: THE HOLE
  function shot4(t, c, d) {
    mood(MOODS.nightIn, [0.9, 0.9, 0.7], [2.6, 0.6, 0], 6);
    S.endWall.visible = false; S.lump[0].visible = S.lump[1].visible = S.lump[2].visible = true;
    const dimU = sseg(t, c.dim, c.dim + 0.7); bulbs(lerp(1, 0.22, dimU)); stage.hemi.intensity *= lerp(1, 0.7, dimU);
    S.holeGlow[3].material.opacity = 0.9; S.corridorLight.intensity = 5;
    cam(camAt([{ t: 0, p: [4.75, 1.25, 0.45], l: [2.76, 0.6, -1.4], fov: 35 }, { t: c.dim, p: [4.55, 1.2, 0.3], l: [2.76, 0.6, -1.4], e: smooth }, { t: c.see - 0.1, p: [6.4, 2.3, 6.6], l: [2.3, 1.0, 0.7] }, { t: d, p: [6.2, 2.25, 6.4], l: [2.3, 1.0, 0.7], e: smooth }], t), 0, t);
    // cardboard: appear -> painted -> slotted in
    const fk = S.fake[3], pu = pop(t, c.make, 0.4), su = eseg(t, c.slot, c.slot + 0.45), pa = sseg(t, c.paint, c.paint + 0.75);
    fk.visible = pu > 0.001; fk.scale.setScalar(Math.max(pu, 0.001) * lerp(0.55, 1, su) * (1 + 0.08 * pulse(t, c.slot + 0.4, c.slot + 0.7, 0.12)));
    fk.position.set(lerp(3.02, ventX(3), su), lerp(0.86, ventY, su), lerp(-0.95, -1.385, su)); fk.rotation.set(0, lerp(0.8, 0, su), lerp(-0.12, 0, su));
    fk.userData.board.material.color.set(PAL.cardboard).lerp(WALLC, pa);
    fk.userData.paint.scale.setScalar(Math.max(0.001, pop(t, c.paint + 0.35, 0.35)));
    if (t > c.paint - 0.2 && t < c.paint + 0.95) { const u = seg(t, c.paint, c.paint + 0.75); show(P.brush, 3.16 - 0.26 * u, 0.9 + 0.08 * S_(u * PI * 3), -0.76 - 0.26 * u, 0.9); P.brush.rotation.set(0.3, 0.8, -0.5); }
    // you
    const leave = sseg(t, c.slot + 0.7, c.dim + 0.2);
    if (leave < 1) { const sit = Pose.sit(0.5); sit.spine = [0.45, 0, 0]; sit.shA = [-1.0, 0, 0.1]; sit.shB = [-1.0, 0, -0.1]; sit.elA = [-0.6]; sit.elB = [-0.6]; put(F.A, 2.32, 0, -0.78, PI / 2 + 0.3, sit); }
    S.lump[3].visible = dimU > 0.5; F.A.visible = dimU <= 0.5;
    // the guard and his flashlight
    const gx = lerp(-1.2, 2.45, seg(t, c.dim - 0.3, c.see - 0.55)), stop = seg(t, c.see - 0.55, c.see - 0.25), go = seg(t, d - 0.75, d - 0.45);
    const moving = stop <= 0 || go >= 1, gx2 = gx + Math.max(0, t - (d - 0.45)) * 1.3;
    const aimIn = stop * (1 - go);
    put(P.guard, gx2, 0, 2.3, lerp(PI / 2, PI, aimIn), guardPose(gx2 * 5.2, moving, -1.15));
    const from = torchPos(), sw = sseg(t, c.see - 0.35, c.see + 1.1);
    const tgt = tmpV.set(lerp(gx2 + 1.6, lerp(1.95, 3.15, sw), aimIn), lerp(0.02, lerp(0.75, 0.35, sw), aimIn), lerp(2.3, -1.39, aimIn));
    beam(P.beam, from, tgt, lerp(0.35, 0.42, aimIn), WHITE.clone().lerp(RED, aimIn), t > c.dim - 0.3 ? 1 : 0);
  }
  // ================================================================= SHOT 5: THE RAFT
  function shot5(t, c, d) {
    for (let i = 0; i < 3; i++) S.lump[i].visible = true;
    if (t < c.swim) {
      mood(MOODS.nightIn, [0.8, 0.9, -0.8], [2.6, 0.6, -2], 5);
      S.shellBack.visible = false; S.fake[3].visible = false; S.corridorLight.intensity = 9; S.corridorLight.position.set(2.2, 1.7, -2.1);
      cam(camAt([{ t: 0, p: [6.9, 1.7, -4.7], l: [2.9, 0.8, -2.0], fov: 35 }, { t: c.swim, p: [6.3, 1.6, -4.3], l: [2.9, 0.95, -2.0], e: smooth }], t));
      const u = seg(t, 0.1, 1.5), st = eseg(t, 1.1, 1.9);
      const pose = mixPose(Pose.slither(t * 9), Pose.stand(t), st); pose.head = [lerp(-1.1, -0.55, st), 0, 0];
      put(F.A, ventX(3), 0, lerp(-0.6, -1.95, easeOut(u)), lerp(PI, PI * 0.72, st), pose);
    } else if (t < c.collect) {
      mood(MOODS.nightOut, [-0.5, 0.8, 0.6], [3, -5, -24], 22);
      const u = seg(t, c.swim, c.collect);
      cam({ p: [3.4, -2.4, lerp(-9.2, -10.4, smooth(u))], l: [3.9, -3.9, -44], fov: 40 });
      beam(S.search[1], S.towers[1], tmpV.set(lerp(-9, 12, smooth(u)), -4.95, -38 + 2 * S_(u * 3)), 4.0, RED, 2.2);
      S.angelMat.emissiveIntensity = 0.22; S.waterMat.color.set(0x1b2c4d);
    } else {
      mood(MOODS.nightIn, [0.9, 1, 0.5], [1.5, 2.6, 0], 6);
      S.roof.visible = S.roofVent.visible = false; S.topLight.intensity = 11; S.topLight.position.set(1.6, 4.3, 0.3);
      cam(camAt([{ t: c.collect, p: [8.6, 5.4, 2.6], l: [1.3, 3.3, -0.1], fov: 35 }, { t: d, p: [7.4, 4.9, 2.0], l: [1.35, 3.3, -0.1], e: smooth }], t));
      const span = Math.max(1.2, c.glue - c.collect - 0.4), toRaft = c.glue + 0.15;
      P.coats.forEach((g, i) => {
        const s = pop(t, c.collect + 0.1 + (i / 18) * span, 0.3);
        const x0 = 0.45 + (hash(i) - 0.5) * 0.5, z0 = 0.25 + (hash(i + 3) - 0.5) * 0.6, y0 = 2.65 + i * 0.045;
        const fly = i >= 9 ? eseg(t, toRaft + (i - 9) * 0.09, toRaft + 0.45 + (i - 9) * 0.09) : 0;
        show(g, lerp(x0, 2.15, fly), lerp(y0, 2.85, fly) + 0.9 * S_(fly * PI), lerp(z0, -0.1 + (hash(i + 7) - 0.5), fly), s * (1 - sseg(fly, 0.8, 1)));
        g.rotation.set(0, hash(i + 5) * 6 + fly * 4, fly * 2);
      });
      setPop(P.t50, pop(t, c.fifty, 0.45) * 0.72); P.t50.position.set(0.65, 4.04, -0.45); face(P.t50, 0.2 * S_(t * 1.4));
      const rs = backOut(seg(t, c.glue + 0.45, c.glue + 1.1));
      show(P.raft, 2.15, 2.78, -0.15, rs); P.raft.rotation.set(0, 0, 0); P.raft.scale.set(rs, Math.max(0.001, rs * (1 + 0.06 * S_(t * 5) * (1 - sseg(t, c.seal, c.seal + 1)))), rs);
      P.seams.forEach((m, i) => { const a = c.seal + 0.35 + i * 0.3; m.emissiveIntensity = 1.8 * pulse(t, a, a + 0.9, 0.2) + 0.25 * sseg(t, a + 0.7, a + 0.9); });
      P.steam.forEach((m, i) => { const age = (((t - c.seal) * 0.8 + i / 12) % 1 + 1) % 1; m.visible = t > c.seal + (i / 12) * 0.6; if (!m.visible) return; m.position.set(1.7 + 0.25 * S_(i * 2.4) * age + 0.35 * age, 3.3 + 0.55 * age, -1.5 + 1.0 * age); m.scale.setScalar(0.45 + age * 1.5); m.material.opacity = 0.6 * (1 - age) * sseg(age, 0, 0.1); });
      const kn = Pose.kneel(t * 4); put(F.A, 1.12, 2.6, -0.45, PI / 2, kn);
      const st = Pose.stand(t); st.shA = [-1.6 + 0.1 * S_(t * 3), 0, 0.1]; st.elA = [-0.5]; st.head = [0.1, 0.5, 0]; put(F.B, 1.55, 2.6, -1.32, PI, st);
    }
  }
  // ================================================================= SHOT 6: THE DECOY
  const PILLOW = [bunkX(3), 0.71, -1.12];
  function bedCam(t, a, b, push = 0) { return camAt([{ t: a, p: [6.4, 2.3, 6.6], l: [2.3, 1.0, 0.7], fov: 35 }, { t: b, p: [lerp(6.2, 5.3, push), lerp(2.25, 1.8, push), lerp(6.4, 3.4, push)], l: [lerp(2.3, 2.15, push), lerp(1.0, 0.85, push), lerp(0.7, -0.3, push)], e: smooth }], t); }
  function decoyInBed() { S.lump[3].visible = true; decoyStage(); show(P.decoy, ...PILLOW, 1); P.decoy.rotation.set(-PI / 2 + 0.25, 0.5, 0); }
  function shot6(t, c, d) {
    for (let i = 0; i < 3; i++) S.lump[i].visible = true;
    const H = P.decoy.userData;
    if (t < c.sculpt) {
      mood(MOODS.nightIn, [0.6, 0.8, 1], [2.4, 0.6, 0.5], 5); bulbs(0.2); stage.hemi.intensity *= 0.75; S.endWall.visible = false;
      cam(bedCam(t, 0, c.sculpt), 0, 0);
      const gx = lerp(0.9, 2.25, easeOut(seg(t, 0, 0.9))), arrived = seg(t, 0.8, 1.1);
      put(P.guard, gx, 0, 2.25, lerp(PI / 2, PI, arrived), guardPose(gx * 5.2, arrived <= 0, -1.25));
      const sw = sseg(t, 1.0, c.sculpt);
      beam(P.beam, torchPos(), tmpV.set(2.02, 0.62, lerp(0.45, -1.0, sw)), 0.36, WHITE.clone().lerp(RED, arrived), 1);
    } else if (t < c.dark) {
      mood(MOODS.nightIn, [-0.5, 0.9, -0.6], [2.9, 0.9, 0.4], 3);
      cam(camAt([{ t: c.sculpt, p: [2.08, 1.3, -0.5], l: [2.98, 0.99, 0.45], fov: 30 }, { t: c.dark, p: [2.2, 1.24, -0.32], l: [2.98, 0.99, 0.45], e: smooth }], t), 0, 0, 0.06);
      show(P.stand, 2.99, 0.785, 0.45, 1);
      show(P.decoy, 2.99, 0.955, 0.45, 1); P.decoy.rotation.set(0, -2.4 + 0.45 * S_((t - c.sculpt) * 1.1), 0);
      const sp = pop(t, c.soap, 0.35), pl = pop(t, c.plaster, 0.38);
      H.plaster.visible = pl > 0.001 && sp < 0.98; H.plaster.scale.set(0.95 * pl, 1.12 * pl, pl);
      H.soap.visible = sp > 0.001; H.soap.scale.set(0.92 * sp, 1.08 * sp, 0.98 * sp);
      const tint = sseg(t, c.paper + 0.95, c.paper + 1.55);
      H.skinMat.color.set(0xe7dcc0).lerp(col(PAL.skin), tint);
      const pp = pop(t, c.paper, 0.35) * (1 - tint); H.paper.visible = pp > 0.01; H.paper.scale.setScalar(Math.max(pp, 0.001));
      if (t > c.paper + 0.85 && t < c.paper + 1.7) { const u = seg(t, c.paper + 0.95, c.paper + 1.55); show(P.brush, 2.86, 0.98 + 0.1 * S_(u * PI * 3), 0.3, 0.9); P.brush.rotation.set(0.2, -2.3, 0.9); }
      const hp = pop(t, c.hair, 0.4); H.hair.visible = hp > 0.001; H.hair.scale.setScalar(Math.max(hp, 0.001)); H.hair.position.y = 0.25 * (1 - easeOut(seg(t, c.hair, c.hair + 0.25)));
    } else {
      mood(MOODS.nightIn, [0.6, 0.8, 1], [2.4, 0.6, 0.5], 5); bulbs(0.15); stage.hemi.intensity *= 0.75; S.endWall.visible = false;
      cam(bedCam(t, c.dark, d, 1), 0, 0);
      decoyInBed();
      const a = c.dark + 0.2, gx = lerp(0.2, 2.25, seg(t, a, a + 1.2)), look = sseg(t, a + 1.0, a + 1.3) * (1 - sseg(t, c.asleep + 0.35, c.asleep + 0.65));
      const gx2 = gx + Math.max(0, t - c.asleep - 0.6) * 1.2;
      put(P.guard, gx2, 0, 2.25, lerp(PI / 2, PI * 0.95, look), guardPose(gx2 * 5.2, look < 0.05, -1.2));
      const sw = sseg(t, a + 1.0, c.asleep + 0.5);
      beam(P.beam, torchPos(), tmpV.set(lerp(gx2 + 1.5, 2.02, look), lerp(0.05, 0.7, look), lerp(2.25, lerp(0.45, -1.05, sw), look)), 0.36, WHITE.clone().lerp(RED, look * 0.85), sseg(t, a, a + 0.3));
    }
  }
  // ================================================================= SHOT 7: THE NIGHT
  function shot7(t, c, d) {
    mood(MOODS.nightIn, [-0.6, 1, -0.9], [0, 0.5, -2], 8); bulbs(0.35);
    S.shellBack.visible = S.shellLeft.visible = S.roof.visible = S.roofVent.visible = S.fences.visible = S.towerG.visible = S.pipesH.visible = false;
    S.corridorLight.intensity = 10; S.corridorLight.position.set(0.3, 2.0, -2.2);
    cam(camAt([{ t: 0, p: [-6.3, 3.1, -5.8], l: [-0.9, 0.95, -1.9], fov: 46 }, { t: c.west, p: [-6.0, 3.0, -5.6], l: [-0.9, 0.95, -1.9], e: smooth }, { t: c.cement + 1.0, p: [-5.5, 2.5, -5.2], l: [-1.5, 0.85, -1.9] }, { t: c.leave + 0.3, p: [-5.4, 2.4, -5.1], l: [-1.5, 0.85, -1.9], e: smooth }, { t: d, p: [-4.6, 1.6, -4.4], l: [-2.55, 0.75, -1.8] }], t));
    const who = [['A', 3, 0], ['B', 2, 0.4], ['C', 1, 0.8]];
    const stops = { A: 2.5, B: 2.15, C: 1.7 }, climbAt = { A: 0.35, B: 1.6, C: 3.0 };
    for (const [k, cell, dl] of who) {
      const t0 = c.four + dl, u = seg(t, t0, t0 + 1.3), st = eseg(t, t0 + 0.9, t0 + 1.6);
      let x = ventX(cell), y = 0, z = lerp(-0.7, -2.02, easeOut(u)), h = PI, pose = mixPose(Pose.slither(t * 9), Pose.stand(t + dl), st);
      if (st >= 1) {
        const back = sseg(t, c.wait, c.wait + 0.5) * (1 - sseg(t, c.leave, c.leave + 0.4));
        h = lerp(PI * 0.75, -PI / 2, back); pose.head = [0.05 * back, 0, 0];
        if (k === 'C') { x -= 0.45 * sseg(t, c.wait + 0.3, c.wait + 1.0); pose.shA = [-0.9 * sseg(t, c.wait + 0.5, c.wait + 1.0) * (1 - sseg(t, c.leave - 0.2, c.leave + 0.2)), 0, 0.1]; }
        if (t > c.leave) {
          const w = seg(t, c.leave + 0.3, c.leave + climbAt[k]); const x1 = lerp(x, stops[k], k === 'A' ? 1 : w); h = lerp(h, PI / 2, sseg(t, c.leave, c.leave + 0.35));
          if (t < c.leave + climbAt[k]) { if (k !== 'A' && w > 0) pose = Pose.walk(x1 * 5.5); x = x1; }
          else { const cl = t - c.leave - climbAt[k]; x = lerp(stops[k], G.PIPEX, sseg(cl, 0, 0.3)); z = lerp(-2.02, G.PIPEZ + 0.24, sseg(cl, 0, 0.3)); y = Math.max(0, cl - 0.25) * 1.5; h = PI; pose = mixPose(Pose.stand(0), Pose.climb(cl * 9), sseg(cl, 0, 0.3)); }
        }
      }
      if (t > t0 - 0.05) put(F[k], x, y, z, h, pose);
    }
    // West: head and arms through, shoulders will not pass
    const out = easeOut(seg(t, c.four + 0.3, c.four + 1.5)), fight = sseg(t, c.four + 0.8, c.west + 0.5) * (1 - 0.75 * sseg(t, c.wait, d - 0.4));
    const wp = Pose.slither(t * 11); const amp = 0.35 + 0.65 * fight;
    wp.shA = [-2.75 + 0.3 * amp * S_(t * 11), 0, -0.12]; wp.shB = [-2.75 - 0.3 * amp * S_(t * 11), 0, 0.12]; wp.elA = [-0.25 - 0.3 * amp * (0.5 + 0.5 * S_(t * 11))]; wp.elB = [-0.25 - 0.3 * amp * (0.5 - 0.5 * S_(t * 11))];
    wp.head = [lerp(-1.25, -0.6, sseg(t, c.leave + 0.6, d - 0.2)), 0.5 * S_(t * 2.3) * fight + 0.9 * sseg(t, c.leave - 0.1, c.leave + 0.6), 0]; wp.y = 0.33; wp.pelvis = [PI / 2, 0, 0.1 * amp * S_(t * 11)];
    if (t > c.four + 0.25) put(F.W, ventX(0), 0, lerp(-0.2, -0.92, out) + 0.05 * fight * S_(t * 5.5), PI, wp);
    const cp = pulse(t, c.cement + 0.1, c.cement + 1.5, 0.3); S.plug[0].forEach((m) => m.material.emissive.setScalar(0.5 * cp));
  }
  // ================================================================= SHOT 8: THE ROUTE
  function shot8(t, c, d) {
    for (let i = 0; i < 4; i++) S.lump[i].visible = i > 0;
    S.ventCap.rotation.z = -1.25; S.ventCap.position.set(0.1, 0.62, 0.62); S.fan.rotation.y = 0.5 * S_(t * 2.2);
    if (t < c.paddle) {
      mood(MOODS.nightOut, [1, 0.8, 0.3], [2.6, 0, -6], 14); bulbs(0.4);
      S.endWall.visible = false; S.corridorLight.intensity = 7; S.corridorLight.position.set(2.5, 2.4, -2.1);
      const X = G.PIPEX;
      const path = (s) => {     // [y, z, mode]
        if (s < c.roof) return [lerp(0.9, 5.45, seg(s, -0.3, c.roof)), G.PIPEZ + 0.24, 'climb'];
        if (s < c.roof + 0.55) { const u = seg(s, c.roof, c.roof + 0.55); return [5.4 + 0.45 * S_(u * PI), lerp(-2.05, -3.08, u), 'run']; }
        if (s < c.fences) return [lerp(5.2, -0.4, smooth(seg(s, c.roof + 0.55, c.fences))), -3.08, 'slide'];
        if (s < c.shore) { const z = lerp(-3.08, -8.3, seg(s, c.fences, c.shore)); const hop = Math.max(0, 1 - Math.abs(z - G.FENCE1) / 0.75, 1 - Math.abs(z - G.FENCE2) / 0.75); return [-0.4 + 2.15 * S_(Math.min(1, hop) * PI / 2), z, hop > 0 ? 'climb' : 'run']; }
        const z = lerp(-8.3, -12.25, smooth(seg(s, c.shore, c.inflate))); return [groundY(X, z), z, s < c.inflate ? 'run' : 'kneel'];
      };
      let ay = 0, az = 0, n = 0; for (let k = -6; k <= 6; k++) { const q = path(t - 0.3 + k * 0.07); ay += q[0]; az += q[1]; n++; }
      ay /= n; az /= n;
      const zoom = sseg(t, c.inflate, c.inflate + 1.2);
      cam({ p: [26, ay + 1.0, az - 0.2], l: [X, ay + lerp(0.9, 0.5, zoom), az - lerp(0.2, 0.9, zoom)], fov: lerp(25, 19, zoom) });
      'ABC'.split('').forEach((k, i) => {
        const s = t - i * 0.42, [y, z, mode] = path(s), ph = s * 11;
        let pose = mode === 'climb' ? Pose.climb(ph) : mode === 'run' ? Pose.crouchRun(ph) : mode === 'slide' ? Pose.climb(0.4) : Pose.kneel(t * 5 + i);
        const zz = mode === 'kneel' ? z + [0.0, 0.55, 1.0][i] : z;
        put(F[k], X + (y < 0 ? (i - 1) * 0.28 : 0), mode === 'kneel' ? groundY(X, zz) : y, zz, PI, pose);
      });
      // searchlights sweep either side of the dark strip they use
      const on = sseg(t, c.fences, c.fences + 0.6);
      const lead = lerp(-11, -24, sseg(t, c.shore - 0.5, c.inflate + 0.3)), trail = lerp(-3.4, -7.2, sseg(t, c.shore - 0.2, c.inflate + 0.8));
      beam(S.search[0], S.towers[0], tmpV.set(1.0 + 1.5 * S_(t * 1.3), Math.max(-5, groundY(1, lead)), lead), 1.7, RED, on);
      beam(S.search[1], S.towers[1], tmpV.set(5.5 + 1.0 * S_(t * 1.1 + 2), groundY(5.5, trail), trail), 1.3, RED, on);
      const inf = seg(t, c.inflate + 0.2, c.inflate + 1.5), rs = lerp(0.12, 1, smooth(inf)) * (inf > 0 ? 1 : 0);
      show(P.raft, X, -4.78, -13.55, rs); P.raft.rotation.set(0.05, 0, 0); P.raft.scale.set(rs, Math.max(0.001, rs * (0.55 + 0.45 * inf + 0.12 * S_(t * 14) * (1 - inf))), rs);
    } else {
      mood(MOODS.nightOut, [-0.5, 0.8, 0.6], [3, -5, -24], 22);
      const u = seg(t, c.paddle, d);
      cam({ p: [3.4, lerp(-2.6, -1.9, smooth(u)), -9.6], l: [3.9, -3.7, -44], fov: 40 });
      const rz = -19 - 2.3 * (t - c.paddle), ry = -4.9 + 0.07 * S_(t * 1.9), rx = 3.3;
      show(P.raft, rx, ry, rz, 1); P.raft.scale.set(1, 1, 1); P.raft.rotation.set(0.04 * S_(t * 1.9), 0, 0.03 * S_(t * 1.4));
      'ABC'.split('').forEach((k, i) => {
        const ph = t * 4.2 + i * 2.1, side = i === 1 ? 0 : (i === 0 ? 1 : -1);
        const p = Pose.sit(0); p.knA = [0.5]; p.knB = [0.5]; p.spine = [0.3 + 0.15 * S_(ph), 0, 0];
        p.shA = [-1.0 + 0.4 * S_(ph), 0, 0.3 * side + 0.15]; p.shB = [-1.0 + 0.4 * S_(ph), 0, 0.3 * side - 0.15]; p.elA = [-0.6 + 0.3 * C_(ph)]; p.elB = [-0.6 + 0.3 * C_(ph)];
        put(F[k], rx, ry - 0.02, rz - 0.75 + i * 0.75, PI, p);
        if (side) { const pd = P.paddles[i ? 1 : 0]; show(pd, rx - side * 0.62, ry + 0.38 + 0.1 * S_(ph), rz - 1.0 + i * 0.75 - 0.25 * C_(ph), 1); pd.rotation.set(0.5 * S_(ph), 0, -side * 0.35); }
      });
      setPop(P.t54, pop(t, c.temp, 0.45)); P.t54.position.set(3.7, 0.9, -40); face(P.t54);
      const ag = sseg(t, c.angel, c.angel + 1.3); S.angelMat.emissiveIntensity = 0.42 * ag;
    }
  }
  // ================================================================= SHOT 9: DAWN
  function shot9(t, c, d) {
    for (let i = 0; i < 4; i++) S.lump[i].visible = i > 0;
    const dawnKey = [0.5, 0.55, 1];
    if (t < c.paddle) {
      mood(MOODS.dawn, dawnKey, [2.4, 0.6, 0], 5); S.bars.visible = S.roof.visible = S.roofVent.visible = S.blockTop.visible = S.sheets.visible = false; scene.fog.density = 0.004;
      cam(camAt([{ t: 0, p: [2.45, 3.1, 2.9], l: [2.32, 0.62, -0.7], fov: 36 }, { t: c.paddle, p: [2.42, 2.8, 2.5], l: [2.32, 0.55, -0.65], e: smooth }], t));
      const arrive = easeOut(seg(t, 0, c.until - 0.2)), reach = eseg(t, c.until + 0.1, c.touch + 0.05), recoil = sseg(t, c.touch + 0.3, c.touch + 0.7);
      const gp = arrive < 1 ? Pose.walk(t * 7, 0.7) : Pose.stand(t);
      gp.spine = [0.4 * reach - 0.35 * recoil, 0, 0]; gp.shA = [lerp(0, -1.35, reach) + 0.5 * recoil, 0, 0.05]; gp.elA = [-0.2 - 0.9 * recoil]; gp.head = [0.25 * reach, 0, 0]; gp.shB = [0.1 - 0.4 * recoil, 0, -0.1]; gp.elB = [-0.2];
      put(P.guard, lerp(2.95, 2.88, arrive), 0, lerp(1.2, -0.25, arrive) + 0.15 * recoil, lerp(PI, -2.2, sseg(arrive, 0.6, 1)), gp); P.torch.visible = false;
      S.lump[3].visible = true; decoyStage();
      const f = t - c.touch - 0.1;
      if (f <= 0) { show(P.decoy, ...PILLOW, 1); P.decoy.rotation.set(-PI / 2 + 0.25, 0.5, 0); }
      else {
        const roll = seg(f, 0, 0.32), fall = seg(f, 0.32, 0.6), g = Math.max(0, f - 0.6);
        const x = lerp(PILLOW[0], 2.46, roll) + 0.16 * fall + 0.1 * (1 - Math.exp(-g * 2));
        const bounce = g > 0 ? 0.3 * Math.abs(S_(g * 7.5)) * Math.exp(-g * 2.6) : 0;
        const y = lerp(PILLOW[1], 0.145, easeIn(fall)) + bounce, z = PILLOW[2] + 1.25 * (1 - Math.exp(-g * 1.5));
        show(P.decoy, x, y, z, 1); P.decoy.rotation.set(-PI / 2 + 0.25 + g * 5 * Math.exp(-g * 0.5), 0.5, -f * 6 * Math.exp(-g * 0.9));
      }
    } else if (t < c.fbi) {
      const second = t >= c.scraps, ox = second ? -28 : 30, oz = second ? -52.5 : -41.5, a = second ? c.scraps : c.paddle, b = second ? c.fbi : c.scraps;
      mood(MOODS.dawn, dawnKey, [ox, -5, oz], 8); S.waves(t * 0.6, 0.35);
      const u = smooth(seg(t, a, b));
      cam({ p: [ox + lerp(-0.6, 0.6, u), -3.9, oz + 5.2], l: [ox, -4.8, oz], fov: 35 }, 0, 0, 0.04);
      if (!second) { show(P.floatPaddle, ox - 0.35, -4.9 + 0.04 * S_(t * 2), oz, 1.6); P.floatPaddle.rotation.set(PI / 2, 0, 1.1 + 0.2 * t); }
      else P.scraps.forEach((g, i) => { show(g, ox + (hash(i) - 0.5) * 2.4 + 0.12 * t, -4.9 + 0.03 * S_(t * 2 + i), oz + (hash(i + 4) - 0.5) * 3.2, 1.4); g.rotation.set(0.05 * S_(t + i), hash(i + 2) * 6 + 0.1 * t, 0.05 * C_(t * 1.3 + i)); });
    } else if (t < c.fbi + (d - c.fbi) * 0.45) {
      mood(MOODS.dawn, dawnKey, [0, -5, -52], 24);
      const u = seg(t, c.fbi, d);
      cam({ p: [-4 + 3 * u, -3.4, -30], l: [0, -4.4, -52], fov: 40 }, 0, 0, 0.05);
      [[-8, -56, 1, 7], [10, -68, -1, 6]].forEach(([x0, z, dir, sp], i) => { const b = P.boats[i], x = x0 + dir * sp * (t - c.fbi); show(b, x, -5.05 + 0.06 * S_(t * 3 + i), z, 1.5); b.rotation.set(0, -dir * PI / 2, 0.03 * S_(t * 2)); b.userData.wake.visible = true; });
    } else {
      mood(MOODS.dawn, [0.3, 1, 0.4], [0, -5, -80], 40); scene.fog.density = 0.0006; S.waves(0, 0);
      camera.up.set(0, 0, -1); camera.position.set(4, 255, -84); camera.fov = 40; camera.setViewOffset(stage.W, stage.H, 0, 0, stage.W, stage.H); camera.lookAt(4, -5, -84); camera.updateMatrixWorld();
      const tt = t - c.fbi;
      P.map.visible = true; P.map.position.set(0, -4.6, -80); P.sweep.position.set(0, 0, 80); P.sweep.rotation.y = -tt * 2.6; P.sweepRings.forEach((r) => r.position.set(0, 0, 80));
      [[-30, -40, 0.9], [26, -72, 2.6], [-12, -120, 4.4], [34, -138, 0.3]].forEach(([x0, z0, h], i) => { const b = P.boats[i], sp = 14; show(b, x0 - S_(h) * sp * tt, -4.9, z0 - C_(h) * sp * tt, 2.6); b.rotation.set(0, h, 0); b.userData.wake.visible = true; });
    }
  }
  // ================================================================= SHOT 10: THE ENDING
  function shot10(t, c, d) {
    mood(MOODS.dawn, [0.5, 0.55, 1], [6, -5, -40], 20); S.waves(t * 0.7, 0.6);
    const u = smooth(seg(t, 0, d));
    cam({ p: [5, lerp(-3.9, 0.4, u), lerp(-38, -15, u)], l: [9, lerp(-4.2, -6.5, u), -140], fov: 38 });
    const wa = 0.3 * (1 - sseg(t, 0.3, 6.5));
    P.wake.forEach((m, i) => { m.visible = wa > 0.005; m.material.opacity = wa; m.position.set(6.5 + (i ? 1 : -1) * 1.9, -4.86, -60); });
    const g = t - c.gull;
    if (g > 0) { show(P.gull, -6 + 3.2 * g, -2.3 + 0.4 * S_(g * 0.9) + 0.22 * g, -36, 2.4); P.gull.rotation.set(0, -PI / 2, 0.1 * S_(g * 2)); P.gull.userData.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * 0.55 * S_(g * 8.5))); }
    S.angelMat.emissiveIntensity = 0.05;
    overlay.fade = sseg(t, c.fade, c.fade + 0.85);
  }
  const SHOTS = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8, shot9, shot10];
  return {
    update(shot, t, T) {
      reset(shot.id);
      P.torch.visible = true;
      S.waves(T, 1);
      SHOTS[shot.id - 1](t, shot.cues, shot.duration);
      camera.updateProjectionMatrix();
    },
  };
}
