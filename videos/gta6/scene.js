// HOW GTA 6 MAKES ITS MONEY BACK - low-poly isometric city where every district is a money stream.
// Original city, vehicles and figures only (no game artwork). Every frame is a pure function of (shot, t).
// Money figures live in MONEY below and in script.json; all of them are estimates and are tagged as such on screen.
import * as THREE from 'three';
import { PAL, clamp, lerp, seg, sseg, eseg, smooth, easeOut, easeIn, backOut, pop, pulse, hash, mat, umat, box, cyl, ico, cone, torus, group, setPop } from '/shared/web/core.js';

const PI = Math.PI, S = Math.sin, Cs = Math.cos;
const MONEY = { cost: -1.5e9, afterPre: -0.8e9, firstYear: 0.74e9, onlinePerYear: 0.35e9 };  // studio-side, after a ~30% store cut
const PITCH = 8.2, bx = (i) => (i - 2) * PITCH;
const GOLD = 0xF2C14E, GREEN = 0x3DDC97, CREAM = 0xEFE7D6;
const BODY = [0x8FA3B8, 0xC9B8A0, 0x6F86A8, 0xD9A47F, 0x5E8C8A, 0xE0CDB2, 0x9C8FB8];
const VAULT = [bx(2), bx(2)], STORE = [bx(3), bx(1)], PLAZA = [bx(3), bx(2)], OLD = [bx(1), bx(3)];
const BACK = new THREE.Vector3(1, 0.9, 1).normalize(), DIST = 150;

export async function create(stage, list) {
  const { scene, camera, overlay } = stage, V = list.vars || {};
  scene.fog.density = 0;
  const root = group({ parent: scene });
  // ------------------------------------------------------------------ ground
  box(43, 1.4, 43, 0x1B2540, { y: -0.7, parent: root });
  for (const c of [-12.3, -4.1, 4.1, 12.3]) for (let k = -20; k <= 20; k += 2.4) { box(0.9, 0.02, 0.14, 0x6C7A99, { x: k, y: 0.011, z: c, parent: root, cast: false }); box(0.14, 0.02, 0.9, 0x6C7A99, { x: c, y: 0.011, z: k, parent: root, cast: false }); }
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) box(6, 0.2, 6, 0x3B4868, { x: bx(i), y: 0.1, z: bx(j), parent: root });
  // ------------------------------------------------------------------ generic buildings
  const B = [];
  function building(x, z, w, d, h, seed) {
    const g = group({ x, y: 0.2, z, parent: root }), col = BODY[Math.floor(hash(seed) * BODY.length)];
    box(w, h, d, col, { y: h / 2, parent: g }); box(w * 0.7, 0.35, d * 0.7, 0x4A5878, { y: h + 0.17, parent: g });
    if (hash(seed + 5) > 0.5) box(0.7, 0.5, 0.7, 0x59688A, { x: w * 0.15, y: h + 0.55, z: -d * 0.1, parent: g });
    const win = umat(PAL.amber, { emissive: hash(seed + 9) > 0.7 ? 0x7FE0D0 : PAL.amber, ei: 1 });
    for (let y = 1.75; y < h - 0.3; y += 0.95) { box(w * 0.8, 0.36, 0.06, win, { y, z: d / 2 + 0.02, parent: g, cast: false }); box(0.06, 0.36, d * 0.8, win, { x: w / 2 + 0.02, y, parent: g, cast: false }); }
    // shop front on the +z face: lit interior, shutter, striped awning
    const shop = umat(0xFFD9A0, { emissive: 0xFFC873, ei: 1 });
    box(w * 0.72, 0.9, 0.05, shop, { y: 0.6, z: d / 2 + 0.02, parent: g, cast: false });
    const shutter = box(w * 0.74, 0.94, 0.07, 0x56637F, { y: 0.6, z: d / 2 + 0.05, parent: g, cast: false });
    for (let k = 0; k < 4; k++) box(w * 0.2, 0.08, 0.5, k % 2 ? CREAM : PAL.amber, { x: -w * 0.3 + k * w * 0.2, y: 1.2, z: d / 2 + 0.26, rx: 0.25, parent: g });
    const b = { g, x, z, w, d, h, win, shop, shutter, seed, order: hash(seed + 21) }; B.push(b); return b;
  }
  const special = (i, j) => (i === 2 && j === 2) || (i === 3 && j === 1) || (i === 3 && j === 2) || (i === 1 && j === 3) || (i === 2 && j === 3);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    if (special(i, j)) continue;
    const far = 8 - (i + j), seed = i * 7 + j * 13 + 1, h = 2.2 + far * 0.55 + hash(seed) * 2.2;
    if (hash(seed + 3) > 0.45) building(bx(i), bx(j), 4.4, 4.4, h, seed);
    else { building(bx(i) - 1.45, bx(j) - 0.4, 2.5, 4.6, h, seed); building(bx(i) + 1.5, bx(j) + 0.5, 2.4, 3.6, h * 0.62 + 0.8, seed + 50); }
  }
  // palms
  const palm = (x, z, s = 1) => { const g = group({ x, y: 0.2, z, parent: root, s }); cyl(0.07, 0.11, 1.7, 5, 0x8A6B4A, { y: 0.85, rz: 0.08, parent: g }); for (let k = 0; k < 6; k++) { const l = cone(0.22, 1.1, 4, 0x3E9E86, { y: 1.72, parent: g }); l.rotation.set(0, (k / 6) * PI * 2, 1.15); l.translateY(0.45); l.scale.z = 0.35; } return g; };
  for (const [x, z] of [[PLAZA[0] - 2.4, PLAZA[1] - 2.3], [PLAZA[0] + 2.5, PLAZA[1] - 2.4], [PLAZA[0] - 2.4, PLAZA[1] + 2.5], [OLD[0] + 2.4, OLD[1] + 2.4], [OLD[0] - 2.4, OLD[1] + 2.4], [VAULT[0] - 2.6, VAULT[1] + 2.7], [VAULT[0] + 2.6, VAULT[1] + 2.7], [bx(2) - 2.2, bx(3) + 0.5], [bx(2) + 2.2, bx(3) + 1.8], [bx(2) - 0.4, bx(3) + 2.4], [bx(2) + 0.8, bx(3) - 0.6]]) palm(x, z, 0.9 + 0.3 * hash(x + z));
  // ------------------------------------------------------------------ the vault (the studio's side of the ledger)
  const vault = group({ x: VAULT[0], y: 0.2, z: VAULT[1], parent: root });
  box(5.4, 0.4, 5.4, 0xC9C2B4, { y: 0.2, parent: vault });
  for (const [x, z, w, d] of [[-2.2, 0, 0.5, 4.9], [2.2, 0, 0.5, 4.9], [0, -2.2, 3.9, 0.5], [0, 2.2, 3.9, 0.5]]) box(w, 1.7, d, CREAM, { x, y: 1.25, z, parent: vault });
  for (let k = -1; k <= 1; k++) { cyl(0.16, 0.18, 1.7, 6, 0xFFFFFF, { x: k * 1.3, y: 1.25, z: 2.55, parent: vault }); cyl(0.16, 0.18, 1.7, 6, 0xFFFFFF, { x: 2.55, y: 1.25, z: k * 1.3, parent: vault }); }
  box(5.3, 0.25, 0.5, 0xC9C2B4, { y: 2.2, z: 2.55, parent: vault }); box(0.5, 0.25, 5.3, 0xC9C2B4, { x: 2.55, y: 2.2, parent: vault });
  const pitMat = umat(PAL.red, { emissive: PAL.red, ei: 1 }); box(3.9, 0.05, 3.9, pitMat, { y: 0.45, parent: vault, cast: false });
  const goldMat = umat(GOLD, { emissive: 0xD9942A, ei: 0.35 });
  const gold = box(3.8, 1, 3.8, goldMat, { y: 0.45, parent: vault });
  const goldTop = group({ parent: vault }); for (let k = 0; k < 9; k++) box(1.0, 0.3, 0.5, goldMat, { x: (k % 3 - 1) * 1.15, z: (Math.floor(k / 3) - 1) * 0.9, ry: 0.2 * (hash(k) - 0.5), parent: goldTop });
  const vaultLight = new THREE.PointLight(PAL.red, 0, 16, 1.5); vaultLight.position.set(VAULT[0], 3.2, VAULT[1]); scene.add(vaultLight);
  // ------------------------------------------------------------------ the store that takes its cut
  const store = group({ x: STORE[0], y: 0.2, z: STORE[1], parent: root });
  box(4.8, 2.6, 4.2, 0xE0CDB2, { y: 1.3, parent: store }); box(5.0, 0.3, 4.4, 0x4A5878, { y: 2.75, parent: store });
  const storeGlow = umat(0xFFD9A0, { emissive: 0xFFC873, ei: 1.2 }); box(3.6, 1.3, 0.06, storeGlow, { y: 0.85, z: 2.12, parent: store, cast: false });
  for (let k = 0; k < 6; k++) box(0.8, 0.1, 0.9, k % 2 ? CREAM : 0x49B6A6, { x: -2 + k * 0.8, y: 1.75, z: 2.5, rx: 0.3, parent: store });
  box(2.4, 0.8, 0.2, 0x49B6A6, { y: 3.3, z: 1.6, parent: store }); const slot = cyl(0.55, 0.55, 0.14, 14, goldMat, { y: 3.3, z: 1.72, rx: PI / 2, parent: store });
  // ------------------------------------------------------------------ the 2013 tower (the last game)
  const old = group({ x: OLD[0], y: 0.2, z: OLD[1], parent: root });
  box(4.4, 0.5, 4.4, 0x5A6788, { y: 0.25, parent: old });
  const tower = group({ y: 0.5, parent: old });
  const tBody = box(3.2, 1, 3.2, 0x7D8FB5, { y: 0.5, parent: tower }), tWin = umat(PAL.amber, { emissive: PAL.amber, ei: 1.1 });
  const tBands = []; for (let k = 0; k < 40; k++) { const a = box(2.7, 0.34, 0.06, tWin, { z: 1.62, parent: tower, cast: false }), b = box(0.06, 0.34, 2.7, tWin, { x: 1.62, parent: tower, cast: false }); tBands.push([a, b]); }
  const tCap = box(2.4, 0.4, 2.4, 0x4A5878, { parent: tower });
  function setTower(h) { tBody.scale.y = h; tBody.position.y = h / 2; tCap.position.y = h + 0.2; tBands.forEach(([a, b], k) => { const y = 0.8 + k * 0.95; a.visible = b.visible = y < h - 0.3; a.position.y = b.position.y = y; }); }
  // ------------------------------------------------------------------ plaza props: game case, coin stack, calendar
  const gameCase = group({ parent: root });
  box(1.7, 2.4, 0.34, CREAM, { parent: gameCase }); box(1.5, 2.2, 0.04, 0xF29CB4, { z: 0.18, parent: gameCase, cast: false }); box(1.5, 1.0, 0.045, 0x2F6F8F, { y: -0.6, z: 0.18, parent: gameCase, cast: false });
  cyl(0.48, 0.48, 0.03, 16, umat(PAL.amber, { emissive: PAL.amber, ei: 0.7 }), { y: 0.25, z: 0.21, rx: PI / 2, parent: gameCase, cast: false });
  for (let k = 0; k < 3; k++) box(1.5, 0.1, 0.03, k === 1 ? CREAM : 0x49B6A6, { y: -0.3 - k * 0.26, z: 0.215, parent: gameCase, cast: false });
  box(0.3, 2.4, 0.36, 0x1E2C55, { x: -0.72, parent: gameCase });
  const coins = []; for (let k = 0; k < 10; k++) coins.push(cyl(0.5, 0.5, 0.17, 12, goldMat, { parent: root }));
  const cal = group({ x: PLAZA[0] + 1.3, y: 0.2, z: PLAZA[1] + 1.5, ry: PI / 4, parent: root });
  for (const sx of [-1, 1]) cyl(0.07, 0.07, 1.0, 5, 0x56637F, { x: sx * 0.9, y: 0.5, parent: cal });
  const leaf = group({ y: 2.6, parent: cal });
  box(2.7, 3.0, 0.22, CREAM, { parent: leaf }); box(2.7, 0.62, 0.26, PAL.red, { y: 1.19, parent: leaf });
  for (const sx of [-0.8, 0.8]) torus(0.14, 0.04, 5, 8, 0x56637F, { x: sx, y: 1.55, ry: PI / 2, parent: leaf });
  const tDays = stage.text3d('DAYS', 0.4, 0x1E2C55, { ei: 0.15 }); tDays.position.set(0, -1.0, 0.16); leaf.add(tDays);
  const tA = stage.text3d(String(V.days ?? '7'), 1.5, 0x1E2C55, { ei: 0.15 }); tA.position.set(0, 0.05, 0.16); leaf.add(tA);
  const tB = stage.text3d(String(V.days_next ?? '6'), 1.5, 0x1E2C55, { ei: 0.15 }); tB.position.set(0, 0.05, 0.16); leaf.add(tB);
  // ------------------------------------------------------------------ buyers (instanced), trucks, flying coins
  const NB = 330, bodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.19, 0.55, 6), mat(0xffffff), NB), heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 1), mat(PAL.skin), NB);
  bodies.castShadow = heads.castShadow = true; bodies.frustumCulled = heads.frustumCulled = false; root.add(bodies, heads);
  for (let i = 0; i < NB; i++) bodies.setColorAt(i, new THREE.Color([0x49B6A6, 0xF29CB4, PAL.amber, 0x8FA3B8, CREAM, 0x9C8FB8][Math.floor(hash(i + 3) * 6)]));
  const PATH = [[8.2, -4.1], [-20.5, -4.1], [-20.5, 4.1], [20.5, 4.1], [20.5, 12.3], [-20.5, 12.3], [-20.5, 20.5], [20.5, 20.5]];
  const segLen = PATH.slice(1).map((p, i) => Math.hypot(p[0] - PATH[i][0], p[1] - PATH[i][1])), pathLen = segLen.reduce((a, b) => a + b, 0);
  const along = (s) => { s = clamp(s, 0, pathLen - 0.01); for (let i = 0; i < segLen.length; i++) { if (s <= segLen[i]) { const u = s / segLen[i]; return [lerp(PATH[i][0], PATH[i + 1][0], u), lerp(PATH[i][1], PATH[i + 1][1], u)]; } s -= segLen[i]; } return PATH[PATH.length - 1]; };
  const M4 = new THREE.Matrix4();
  function buyers(count, t, flow = 0) {
    for (let i = 0; i < NB; i++) {
      const on = i < count, s = ((i * 0.53 - flow) % pathLen + pathLen) % pathLen, [x, z] = along(flow ? s : i * 0.53), y = 0.3 + 0.05 * Math.abs(S(t * 6 + i));
      const sc = on ? 1 : 0.0001; M4.makeScale(sc, sc, sc); M4.setPosition(x + 0.25 * (hash(i) - 0.5), y, z + 0.25 * (hash(i + 9) - 0.5)); bodies.setMatrixAt(i, M4);
      M4.setPosition(x + 0.25 * (hash(i) - 0.5), y + 0.42, z + 0.25 * (hash(i + 9) - 0.5)); heads.setMatrixAt(i, M4);
    }
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true; bodies.visible = heads.visible = count > 0;
  }
  const trucks = []; for (let k = 0; k < 4; k++) { const g = group({ parent: root }); box(2.0, 1.15, 1.1, 0xB9C4D8, { y: 0.85, parent: g }); box(0.75, 0.85, 1.05, CREAM, { x: 1.35, y: 0.7, parent: g }); box(2.02, 0.16, 1.12, GOLD, { y: 0.75, parent: g, cast: false }); for (const [wx, wz] of [[-0.6, 0.5], [-0.6, -0.5], [1.2, 0.5], [1.2, -0.5]]) cyl(0.26, 0.26, 0.16, 8, 0x12182A, { x: wx, y: 0.26, z: wz, rx: PI / 2, parent: g }); box(0.05, 0.18, 0.8, umat(0xFFF1C0, { emissive: 0xFFE9A8, ei: 2 }), { x: 1.74, y: 0.6, parent: g, cast: false }); trucks.push(g); }
  const bars = []; for (let k = 0; k < 12; k++) bars.push(box(0.6, 0.22, 0.32, goldMat, { parent: root }));
  const fly = []; for (let k = 0; k < 70; k++) fly.push(cyl(0.3, 0.3, 0.1, 10, goldMat, { parent: root, cast: false }));
  const burst = []; for (let k = 0; k < 18; k++) burst.push(ico(0.22, 0, umat([GREEN, PAL.amber, 0xF29CB4][k % 3], { emissive: [GREEN, PAL.amber, 0xF29CB4][k % 3], ei: 1.5 }), { parent: root, cast: false }));
  // ------------------------------------------------------------------ world-space numbers
  const T = {}; const mk = (k, str, size, color) => { T[k] = stage.text3d(str, size, color, { ei: 0.75 }); T[k].material.depthTest = false; T[k].material.depthWrite = false; T[k].renderOrder = 50; scene.add(T[k]); T[k].visible = false; };
  mk('years', '13 YEARS', 3.0, CREAM); mk('p80', '$80', 1.5, CREAM); mk('p56', '$56', 1.5, GOLD); mk('m27', '27 MILLION', 3.2, CREAM); mk('copies', 'COPIES', 1.5, PAL.amber);
  mk('y2013', '2013', 1.3, CREAM); mk('b1', '$1B', 1.9, GOLD); mk('d3', 'IN 3 DAYS', 0.8, CREAM); mk('m235', '235M', 2.3, CREAM); mk('sold', 'SOLD', 1.0, PAL.amber);
  mk('pre', '10M+', 2.0, CREAM); mk('preo', 'PRE-ORDERS', 0.7, PAL.amber); mk('m38', '38M', 2.4, CREAM); mk('m38c', 'COPIES, YEAR ONE', 1.1, PAL.amber); mk('b3', '$3B+', 2.4, GOLD); mk('b3s', 'IN SALES', 1.2, CREAM);
  mk('m500', '+$500M', 2.6, GOLD); mk('yr', 'A YEAR, ONLINE', 1.35, CREAM);
  const say = (k, x, y, z, s) => { const m = T[k]; m.visible = s > 0.001; if (!m.visible) return; m.position.set(x, y, z); m.quaternion.copy(camera.quaternion); m.scale.setScalar(s); };
  const movers = [gameCase, ...coins, ...trucks, ...bars, ...fly, ...burst];

  // ------------------------------------------------------------------ helpers
  function iso(target, width, shake = 0, t = 0) {
    camera.up.set(0, 1, 0); camera.position.set(target[0] + BACK.x * DIST + shake * S(t * 91), target[1] + BACK.y * DIST + shake * S(t * 117), target[2] + BACK.z * DIST);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((width / 2 / DIST) * (16 / 9))); camera.near = 20; camera.far = 1200;
    camera.setViewOffset(stage.W, stage.H, 0, -0.02 * stage.H, stage.W, stage.H); camera.lookAt(target[0], target[1], target[2]); camera.updateMatrixWorld();
  }
  const mixT = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const col = (h) => new THREE.Color(h);
  function mood(day, dark = 0) {            // day 0 = dusk/night, 1 = sunrise; dark deepens the night
    const bg = col(0x111A33).lerp(col(0x0A1022), dark).lerp(col(0x34497A), day);
    stage.sky.top.value.copy(bg); stage.sky.bottom.value.copy(bg);
    stage.hemi.color.copy(col(0x8FA6D8).lerp(col(0xFFE6CC), day)); stage.hemi.groundColor.set(0x1C2238); stage.hemi.intensity = lerp(0.85, 1.15, day) * (1 - 0.35 * dark);
    stage.key.color.copy(col(0xB8C8FF).lerp(col(0xFFD2A0), day)); stage.key.intensity = lerp(1.0, 1.9, day) * (1 - 0.4 * dark);
    stage.key.target.position.set(0, 0, 0); stage.key.position.set(-18 + 30 * day, 40, 30);
    const sc = stage.key.shadow.camera; sc.left = sc.bottom = -34; sc.right = sc.top = 34; sc.near = 1; sc.far = 120; sc.updateProjectionMatrix();
    stage.renderer.toneMappingExposure = 1.08;
    return day;
  }
  const fmt = (v) => { const n = Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (v < -0.5 ? '−' : v > 0.5 ? '+' : '') + '$' + n; };
  function hud(value, o = {}) {
    const g = overlay.hud.begin(); if (value === null && !o.text) return;
    const str = o.text || fmt(value), color = o.color || (value < -0.5 ? '#E5483B' : '#3DDC97'), s = o.scale ?? 1;
    g.save(); g.translate(500 + (o.dx || 0), 250 + (o.dy || 0)); g.scale(s, s);
    g.font = '96px "Montserrat Black"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const w = g.measureText(str).width, k = Math.min(1, 860 / w); g.scale(k, k);
    g.shadowColor = 'rgba(3,7,18,0.6)'; g.shadowBlur = 26; g.shadowOffsetY = 10; g.strokeStyle = '#0B1222'; g.lineWidth = 22; g.strokeText(str, 0, 0);
    g.shadowColor = 'transparent'; g.fillStyle = color; g.fillText(str, 0, 0); g.restore();
    const tag = o.tag || 'ANALYST ESTIMATES', ta = o.tagAlpha ?? 1;
    if (ta > 0.01) { g.save(); g.globalAlpha = ta; g.font = '34px "Montserrat Black"'; g.textAlign = 'center'; g.textBaseline = 'middle'; const tw = g.measureText(tag).width; g.fillStyle = 'rgba(11,18,34,0.85)'; g.beginPath(); g.roundRect(500 - tw / 2 - 22, 322, tw + 44, 54, 14); g.fill(); g.fillStyle = '#F1EDE2'; g.fillText(tag, 500, 350); g.restore(); }
  }
  function setVault(value) {
    const prog = clamp((value - MONEY.cost) / (MONEY.firstYear + MONEY.onlinePerYear - MONEY.cost)), h = lerp(0.03, 2.5, prog), neg = value < 0;
    gold.scale.y = h; gold.position.y = 0.45 + h / 2; goldTop.position.y = 0.45 + h + 0.15; goldTop.visible = prog > 0.5;
    pitMat.emissiveIntensity = neg ? 1.4 : 0; pitMat.color.set(neg ? PAL.red : 0x333333);
    vaultLight.color.set(neg ? PAL.red : GOLD); vaultLight.intensity = neg ? 60 * (0.4 + 0.6 * clamp(-value / 1.5e9)) : 45;
  }
  function city(t, o = {}) {
    const build = o.build ?? 1e9, win = o.win ?? 1, open = o.open ?? 1, blink = o.blink ?? null;
    for (const b of B) {
      const s = o.build === undefined ? 1 : pop(t, build + b.order * 2.6, 0.4);
      b.g.visible = s > 0.001; b.g.scale.set(1, Math.max(s, 0.001), 1);
      b.win.emissiveIntensity = win * (blink === null ? 1 : 0.12 + 0.88 * sseg(t, blink + b.order * 2.2, blink + b.order * 2.2 + 0.25));
      const op = typeof open === 'number' ? open : open(b);
      b.shutter.scale.y = Math.max(0.02, 1 - op); b.shutter.position.y = 0.6 + 0.47 * op; b.shop.emissiveIntensity = 0.15 + 1.2 * op;
    }
    const sv = o.build === undefined ? 1 : pop(t, build + 0.2, 0.45); for (const g of [vault, store, old]) { g.visible = sv > 0.001; g.scale.set(1, Math.max(sv, 0.001), 1); }
    cal.visible = o.cal !== false; storeGlow.emissiveIntensity = 0.2 + 1.1 * (typeof open === 'number' ? open : 1);
  }
  const arc = (a, b, u, h) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u) + 4 * h * u * (1 - u), lerp(a[2], b[2], u)];
  const VT = [VAULT[0], 3.0, VAULT[1]];
  function coinStreams(t, t0, rate, size, pick) {      // coins arcing from buildings into the vault
    fly.forEach((m, i) => {
      const b = B[Math.floor(hash(i * 3 + 1) * B.length)], per = 1.1 + hash(i) * 0.6, tt = t - t0 - hash(i + 7) * per;
      if (tt < 0 || i >= rate || (pick && !pick(b))) { m.visible = false; return; }
      const u = (tt % per) / per, p = arc([b.x, b.h + 0.6, b.z], VT, u, 3.2);
      m.visible = true; m.position.set(p[0], p[1], p[2]); m.rotation.set(u * 9, i, 0); m.scale.setScalar(size * Math.min(1, u * 8) * (1 - sseg(u, 0.9, 1)));
    });
  }
  // ================================================================= SHOT 1: HOOK
  function shot1(t, c, d) {
    mood(0, 0.15);
    const push = eseg(t, c.days - 0.2, c.how + 0.2);
    const v = t < c.spent ? null : MONEY.cost * easeOut(seg(t, c.spent + 0.05, c.spent + 1.2));
    iso(mixT([0, 3, 2], [PLAZA[0] + 1.3, 2.2, PLAZA[1] + 1.5], push), lerp(lerp(46, 42, seg(t, 0, c.days)), 15, push), 0.25 * pulse(t, c.spent, c.spent + 0.35, 0.05), t);
    city(t, { build: c.build - 0.3, win: 0.9, open: 0.6 }); setTower(4); setVault(v ?? MONEY.cost);
    vaultLight.intensity *= sseg(t, c.spent, c.spent + 0.4);
    const cs = pop(t, c.days + 0.25, 0.45); cal.visible = cs > 0.001; cal.scale.setScalar(Math.max(cs, 0.001)); leaf.rotation.x = 0; tA.visible = true; tB.visible = false;
    say('years', 0, 17, 0, pop(t, c.years, 0.4) * (1 - sseg(t, c.days - 0.3, c.days)));
    hud(v, { scale: v === null ? 0 : 0.6 + 0.4 * pop(t, c.spent, 0.35), tagAlpha: sseg(t, c.spent + 0.5, c.spent + 0.9) });
  }
  // ================================================================= SHOT 2: THE PRICE
  function shot2(t, c, d) {
    mood(0, 0.1); city(t, { win: 0.9, open: 1, cal: false }); setTower(4); setVault(MONEY.cost);
    iso(mixT([PLAZA[0] + 0.3, 2.4, PLAZA[1] - 0.6], [PLAZA[0] + 0.6, 2.6, PLAZA[1] - 3.2], eseg(t, c.cut - 0.3, c.cut + 1.2)), lerp(13, 16, eseg(t, c.cut - 0.3, c.cut + 1.2)));
    const drop = easeOut(seg(t, c.price, c.price + 0.45)), cs = pop(t, c.price, 0.4);
    gameCase.visible = cs > 0.001; gameCase.position.set(PLAZA[0] - 1.1, 0.2 + 2.3 + 6 * (1 - drop), PLAZA[1] - 0.2); gameCase.rotation.set(0, PI / 4 + 0.25 * S(t * 1.2), 0.04 * S(t * 2)); gameCase.scale.setScalar(Math.max(cs, 0.001) * 1.55);
    say('p80', PLAZA[0] - 1.1, 5.9, PLAZA[1] - 0.2, pop(t, c.eighty, 0.4) * (1 - sseg(t, c.left - 0.2, c.left + 0.1)));
    // ten coins = the price; three of them go to the store
    const base = [PLAZA[0] + 1.9, 0.3, PLAZA[1] - 0.6], door = [STORE[0], 3.5, STORE[1] + 1.8];
    coins.forEach((m, k) => {
      const s = pop(t, c.eighty + 0.1 + k * 0.05, 0.25); m.visible = s > 0.001; if (!m.visible) return;
      let p = [base[0], base[1] + k * 0.19, base[2]], sc = s;
      if (k >= 7) { const u = eseg(t, c.cut + 0.2 + (9 - k) * 0.25, c.cut + 0.85 + (9 - k) * 0.25); p = arc(p, door, u, 1.6); sc *= 1 - sseg(u, 0.85, 1); m.material = u > 0 ? mat(0x49B6A6, { emissive: 0x49B6A6, ei: 0.4 }) : goldMat; } else m.material = goldMat;
      m.position.set(p[0], p[1], p[2]); m.rotation.set(0, k, 0); m.scale.setScalar(Math.max(sc, 0.001));
    });
    slot.rotation.z = t * 2; store.scale.setScalar(1 + 0.05 * pulse(t, c.cut + 0.8, c.cut + 1.7, 0.15));
    say('p56', base[0] + 0.3, 3.3, base[2], pop(t, c.left + 0.25, 0.4));
    hud(MONEY.cost);
  }
  // ================================================================= SHOT 3: THE TARGET
  function shot3(t, c, d) {
    mood(0, 0.1); city(t, { win: 0.9, open: 1 }); setTower(4);
    const wig = 9e6 * pulse(t, c.zero - 0.2, d, 0.3) * (0.5 + 0.5 * S(t * 30)); setVault(MONEY.cost);
    iso(mixT([PLAZA[0], 2, PLAZA[1] - 3], [0, 3, 2], eseg(t, 0, c.million + 0.3)), lerp(16, 42, eseg(t, 0, c.million + 0.3)));
    buyers(Math.floor(NB * eseg(t, c.queue, c.zero)), t);
    say('m27', 0, 18.0, 0, pop(t, c.million, 0.4)); say('copies', 0, 13.4, 0, pop(t, c.million + 0.3, 0.4));
    hud(MONEY.cost + wig);
  }
  // ================================================================= SHOT 4: THE BASELINE
  function shot4(t, c, d) {
    mood(0, 0.1); city(t, { win: 0.9, open: 1 }); setVault(MONEY.cost); buyers(NB, t);
    const beat = (k) => backOut(seg(t, c.billion + 0.25 + k * 0.35, c.billion + 0.5 + k * 0.35));
    const h = 4 + 2.2 * (beat(0) + beat(1) + beat(2)) + 26 * eseg(t, c.sold, d + 2);
    setTower(h);
    iso(mixT([0, 3, 2], [OLD[0] + 1.5, 6.5, OLD[1] - 1.5], eseg(t, c.last - 0.3, c.billion)), lerp(42, 22, eseg(t, c.last - 0.3, c.billion)), 0.12 * (pulse(t, c.billion + 0.25, c.billion + 0.4, 0.03) + pulse(t, c.billion + 0.6, c.billion + 0.75, 0.03) + pulse(t, c.billion + 0.95, c.billion + 1.1, 0.03)), t);
    say('y2013', OLD[0] + 2.6, 1.6, OLD[1] + 2.6, pop(t, c.last, 0.4));
    const topY = 0.7 + Math.min(h, 12.5);
    say('b1', OLD[0] + 3.6, topY + 1.3, OLD[1] - 3.6, pop(t, c.billion + 1.2, 0.4) * (1 - sseg(t, c.sold - 0.1, c.sold + 0.2))); say('d3', OLD[0] + 3.6, topY - 1.3, OLD[1] - 3.6, pop(t, c.billion + 1.45, 0.4) * (1 - sseg(t, c.sold - 0.1, c.sold + 0.2)));
    say('m235', OLD[0] + 4.2, 9.2, OLD[1] - 4.2, pop(t, c.sold + 0.45, 0.4)); say('sold', OLD[0] + 4.2, 6.2, OLD[1] - 4.2, pop(t, c.sold + 0.7, 0.4));
    hud(MONEY.cost);
  }
  // ================================================================= SHOT 5: THE HEAD START
  function shot5(t, c, d) {
    mood(0, 0.75); city(t, { win: 0.45, open: 0 }); setTower(30);
    const v = lerp(MONEY.cost, MONEY.afterPre, eseg(t, c.sales + 0.1, c.sales + 3.4)); setVault(v);
    iso(mixT([OLD[0] + 1.5, 6.5, OLD[1] - 1.5], [VAULT[0] + 0.5, 2.0, VAULT[1] + 2.6], eseg(t, 0, c.head + 0.6)), lerp(22, 18, eseg(t, 0, c.head + 0.6)));
    trucks.forEach((g, k) => {
      const a = c.head + 0.2 + k * 1.9, u = t - a; if (u < 0 || u > 5.2) { g.visible = false; return; }
      const stopX = VAULT[0] - 2.4 + (k % 2) * 2.6, x = lerp(-30, stopX, easeOut(seg(u, 0, 1.4))) + 34 * easeIn(seg(u, 3.4, 5.0));
      g.visible = true; g.position.set(x, 0.02, 4.1 + (k % 2 ? 0.55 : -0.55)); g.rotation.y = 0;
      for (let j = 0; j < 3; j++) { const m = bars[k * 3 + j], uu = seg(u, 1.5 + j * 0.4, 2.2 + j * 0.4); m.visible = uu > 0 && uu < 1; if (m.visible) { const p = arc([stopX, 1.6, 4.1], VT, uu, 2.4); m.position.set(p[0], p[1], p[2]); m.rotation.set(uu * 6, k, 0); } }
    });
    say('pre', VAULT[0] + 1.5, 8.6, VAULT[1] - 1.5, pop(t, c.pre, 0.4)); say('preo', VAULT[0] + 1.5, 6.1, VAULT[1] - 1.5, pop(t, c.pre + 0.25, 0.4));
    hud(v, { scale: 1 + 0.04 * pulse(t, c.sales + 0.1, c.sales + 3.4, 0.3) * S(t * 24) });
  }
  // ================================================================= SHOT 6: THE LAUNCH
  function shot6(t, c, d) {
    const day = mood(sseg(t, c.launch - 0.4, c.launch + 1.6), 0.75 * (1 - sseg(t, 0, c.launch + 0.6)));
    const open = (b) => backOut(seg(t, c.launch + b.order * 0.9, c.launch + b.order * 0.9 + 0.35));
    city(t, { win: lerp(0.45, 0.5, day), open }); setTower(30);
    const up = seg(t, c.launch + 0.3, c.green + 0.3), v = t < c.green + 0.3 ? lerp(MONEY.afterPre, -0.02e9, up * up * (3 - 2 * up)) : lerp(-0.02e9, MONEY.firstYear, easeOut(seg(t, c.green + 0.3, c.green + 0.85)));
    setVault(v);
    const flip = pulse(t, c.green + 0.3, c.green + 0.8, 0.08);
    iso(mixT([VAULT[0] + 0.5, 2.0, VAULT[1] + 2.6], [0, 3, 2], eseg(t, c.launch, c.sales)), lerp(18, 44, eseg(t, c.launch, c.sales)), 0.2 * flip, t);
    buyers(NB, t, Math.max(0, t - c.launch) * 2.2);
    coinStreams(t, c.launch + 0.5, Math.floor(70 * sseg(t, c.launch + 0.5, c.copies + 1)), 1.25);
    say('m38', -9.5, 14.5, 0, pop(t, c.copies, 0.4)); say('m38c', -9.5, 11.1, 0, pop(t, c.copies + 0.25, 0.4));
    say('b3', 7.5, 15.5, -5, pop(t, c.sales, 0.4)); say('b3s', 7.5, 12.0, -5, pop(t, c.sales + 0.25, 0.4));
    burst.forEach((m, k) => { const u = seg(t, c.green + 0.3, c.green + 1.5); m.visible = u > 0 && u < 1; if (!m.visible) return; const a = (k / burst.length) * PI * 2, r = 8 * easeOut(u); m.position.set(VAULT[0] + Cs(a) * r, 4 + 7 * easeOut(u) - 5 * u * u + 1.5 * S(a * 3), VAULT[1] + S(a) * r); m.scale.setScalar(1.6 * (1 - u)); });
    hud(v, { scale: 1 + 0.18 * flip });
  }
  // ================================================================= SHOT 7: THE LONG TAIL
  function shot7(t, c, d) {
    mood(lerp(1, 0, sseg(t, 0, 2.2)), 0.25 * sseg(t, 0.5, 2.5)); city(t, { win: 1.15, open: 1, blink: c.online - 0.3 }); setTower(30);
    const v = MONEY.firstYear + MONEY.onlinePerYear * seg(t, c.year, d + 0.5); setVault(v);
    iso([0, 3, 2], lerp(44, 40, smooth(seg(t, 0, d)))); buyers(NB, t, 28 + t * 1.2);
    coinStreams(t, c.online, 46, 0.75, (b) => t > c.online - 0.3 + b.order * 2.2);
    say('m500', 0, 17.5, 0, pop(t, c.year, 0.4)); say('yr', 0, 13.2, 0, pop(t, c.year + 0.3, 0.4));
    hud(v);
  }
  // ================================================================= SHOT 8: THE ENDING
  function shot8(t, c, d) {
    mood(0, 0.25); city(t, { win: 1.2, open: 1 }); setTower(30); setVault(MONEY.firstYear + MONEY.onlinePerYear); buyers(NB, t, 40 + t * 1.2);
    coinStreams(t, -5, 46, 0.75);
    const push = eseg(t, c.real - 0.2, c.real + 1.3);
    iso(mixT([0, 3, 2], [PLAZA[0] + 1.3, 2.4, PLAZA[1] + 1.5], push), lerp(lerp(40, 46, eseg(t, 0, c.proj)), 14, push));
    const f = eseg(t, c.flip, c.flip + 0.6); leaf.rotation.x = -f * PI * 2; tA.visible = f < 0.5; tB.visible = f >= 0.5; cal.scale.setScalar(1 + 0.12 * pulse(t, c.flip + 0.5, c.flip + 0.9, 0.12));
    if (t < c.ten) hud(MONEY.firstYear + MONEY.onlinePerYear);
    else hud(null, { text: '$10 BILLION?', color: '#F2C14E', scale: 0.7 + 0.3 * pop(t, c.ten, 0.4), tag: 'LIFETIME ESTIMATE' });
    overlay.fade = seg(t, d - 0.75, d - 0.4);
  }
  const SHOTS = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8];
  return {
    update(shot, t) {
      overlay.fade = 0; overlay.lids = 1;
      for (const m of movers) m.visible = false; for (const k in T) T[k].visible = false;
      buyers(0, t); store.scale.setScalar(1); cal.scale.setScalar(1); leaf.rotation.x = 0; tA.visible = true; tB.visible = false;
      SHOTS[shot.id - 1](t, shot.cues, shot.duration);
      camera.updateProjectionMatrix();
    },
  };
}
