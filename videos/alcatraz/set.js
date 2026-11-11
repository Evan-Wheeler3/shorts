// The one recurring set: a cutaway diorama of the cell block on its island.
// Cells run along X (cell 3 = "your" cell at the cut end, cell 0 = West's), fronts face +Z,
// the service corridor is behind them (-Z), pipes rise to the roof vent, then fences,
// shoreline and the bay continue toward -Z with Angel Island far away.
import * as THREE from 'three';
import { PAL, mat, umat, box, cyl, ico, cone, torus, group, hash, lerp, clamp } from '/shared/web/core.js';

export const G = { N: 4, CW: 1.6, X0: -3.2, ZF: 1.4, ZB: -1.4, H: 2.4, TOP: 2.6, ROOF: 5.2, PIPEX: 2.62, PIPEZ: -2.28, WATER: -5, FENCE1: -4.6, FENCE2: -6.4 };
export const cx = (i) => G.X0 + G.CW * (i + 0.5);
export const VENT = { dx: 0.32, y0: 0.1, w: 0.62, h: 0.46 };
export const ventX = (i) => cx(i) + VENT.dx;
export const ventY = VENT.y0 + VENT.h / 2;
export const bunkX = (i) => cx(i) - 0.8 + 0.42;

// terrain profile (radius -> height); the island is slightly stretched in X
const PROFILE = [[0, -0.4], [8, -0.4], [9.3, -1.5], [11, -3.3], [12.6, -4.62], [14.6, -5.6]];
export function groundY(x, z) {
  const r = Math.hypot(x / 1.25, z);
  for (let i = 1; i < PROFILE.length; i++) if (r <= PROFILE[i][0]) { const a = PROFILE[i - 1], b = PROFILE[i]; return lerp(a[1], b[1], (r - a[0]) / (b[0] - a[0])); }
  return -5.6;
}

export function lightCone(color = 0xffffff) {
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(1, 1, 20, 1, true); geo.translate(0, -0.5, 0); geo.rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, m); g.add(mesh);
  const spot = new THREE.SpotLight(color, 0, 0, 0.3, 0.5, 1.4); g.add(spot); spot.position.set(0, 0, 0); g.add(spot.target); spot.target.position.set(0, 0, 1);
  g.userData = { mesh, mat: m, spot };
  // point the cone from `from` to `to`; spread = radius at the far end
  g.userData.aim = (from, to, spread, color, power = 1) => {
    g.position.copy(from); g.lookAt(to);
    const d = from.distanceTo(to);
    mesh.scale.set(spread, spread, d);
    m.color.set(color); m.opacity = 0.06 * power; spot.color.set(color);
    spot.angle = Math.atan2(spread, d) * 1.05; spot.intensity = 26 * power * Math.max(1, d * d / 9); spot.distance = d * 1.8;
    g.visible = power > 0.01;
  };
  return g;
}

export function buildSet(scene) {
  const S = { scene };
  const root = group({ parent: scene });
  const C = PAL.concrete, CD = PAL.concreteDark, CL = PAL.concreteLight;

  // ---- floor slab + walkway
  box(7.9, 0.4, 6.4, CD, { x: -0.65, y: -0.2, z: 0.4, parent: root });
  box(7.9, 0.02, 0.5, 0x8a847a, { x: -0.65, y: 0.01, z: 2.3, parent: root, cast: false });
  box(1.2, 2.4, 3.0, C, { x: -3.85, y: 1.2, z: -0.1, parent: root });               // block end mass
  // ---- dividers
  S.endWall = null;
  for (let i = 0; i <= G.N; i++) {
    const w = box(0.1, G.H, 2.8, i === G.N ? CL : C, { x: G.X0 + i * G.CW, y: G.H / 2, z: 0, parent: root });
    if (i === G.N) S.endWall = w;
  }
  // ---- per-cell back wall with vent hole, furniture, bulb
  S.plug = []; S.grille = []; S.fake = []; S.bulb = []; S.lump = []; S.cellGlow = [];
  S.furniture = group({ parent: root });
  for (let i = 0; i < G.N; i++) {
    const xl = G.X0 + i * G.CW, xr = xl + G.CW, vx = ventX(i), h0 = vx - VENT.w / 2, h1 = vx + VENT.w / 2, yT = VENT.y0 + VENT.h;
    const zc = -1.5;
    box(h0 - xl, G.H, 0.2, C, { x: (xl + h0) / 2, y: G.H / 2, z: zc, parent: root });
    box(xr - h1, G.H, 0.2, C, { x: (xr + h1) / 2, y: G.H / 2, z: zc, parent: root });
    box(VENT.w, G.H - yT, 0.2, C, { x: vx, y: (G.H + yT) / 2, z: zc, parent: root });
    box(VENT.w, VENT.y0, 0.2, C, { x: vx, y: VENT.y0 / 2, z: zc, parent: root });
    // concrete still filling the hole around the small original vent (dug away chunk by chunk)
    const plug = []; const gw = 0.3, gh = 0.2, gy = VENT.y0 + VENT.h / 2;
    const cols = [[h0, vx - gw / 2], [vx + gw / 2, h1]];
    for (const [a, b] of cols) for (let k = 0; k < 2; k++) plug.push(box(b - a, VENT.h / 2, 0.2, umat(C), { x: (a + b) / 2, y: VENT.y0 + VENT.h / 4 + k * VENT.h / 2, z: zc, parent: root }));
    for (const yy of [[VENT.y0, gy - gh / 2], [gy + gh / 2, yT]]) for (let k = 0; k < 2; k++) plug.push(box(gw / 2, yy[1] - yy[0], 0.2, umat(C), { x: vx - gw / 4 + k * gw / 2, y: (yy[0] + yy[1]) / 2, z: zc, parent: root }));
    S.plug.push(plug);
    const gr = group({ x: vx, y: gy, z: -1.39, parent: root });
    box(gw + 0.04, gh + 0.04, 0.03, PAL.metal, { parent: gr });
    for (let k = 0; k < 4; k++) box(gw - 0.04, 0.018, 0.04, 0x2b2f35, { y: -0.066 + k * 0.044, parent: gr });
    S.grille.push(gr);
    // fake cover (cardboard, later painted to match the wall)
    const fk = group({ x: vx, y: gy, z: -1.385, parent: root });
    const board = box(VENT.w + 0.08, VENT.h + 0.08, 0.02, umat(PAL.cardboard), { parent: fk });
    const paint = group({ parent: fk });
    box(gw + 0.04, gh + 0.04, 0.012, PAL.metal, { z: 0.012, parent: paint });
    for (let k = 0; k < 4; k++) box(gw - 0.04, 0.018, 0.02, 0x2b2f35, { y: -0.066 + k * 0.044, z: 0.016, parent: paint });
    fk.userData = { board, paint }; fk.visible = false; S.fake.push(fk);

    // bunk
    const bx = bunkX(i);
    box(0.74, 0.06, 1.96, PAL.metal, { x: bx, y: 0.42, z: -0.38, parent: S.furniture });
    box(0.7, 0.1, 1.9, PAL.mattress, { x: bx, y: 0.5, z: -0.38, parent: S.furniture });
    box(0.5, 0.09, 0.32, PAL.white, { x: bx, y: 0.59, z: -1.12, parent: S.furniture });
    const lump = group({ x: bx, y: 0.6, z: -0.3, parent: root });
    const l1 = ico(0.3, 1, PAL.blanket, { parent: lump }); l1.scale.set(1.02, 0.5, 2.5);
    const l2 = ico(0.2, 1, PAL.blanket, { z: -0.55, y: 0.03, parent: lump }); l2.scale.set(1.35, 0.6, 1.2);
    lump.visible = false; S.lump.push(lump);
    // sink over the vent, shelf, fold-down table
    box(0.3, 0.09, 0.2, 0xd8d3c6, { x: vx, y: 0.92, z: -1.29, parent: S.furniture });
    cyl(0.025, 0.025, 0.26, 5, PAL.pipe, { x: vx, y: 0.7, z: -1.34, parent: S.furniture });
    box(0.12, 0.03, 0.7, PAL.wood, { x: xr - 0.11, y: 1.55, z: -0.7, parent: S.furniture });
    box(0.08, 0.16, 0.1, 0x6f7f8f, { x: xr - 0.11, y: 1.65, z: -0.9, parent: S.furniture });
    box(0.08, 0.13, 0.08, 0xa58c6a, { x: xr - 0.11, y: 1.63, z: -0.76, parent: S.furniture });
    box(0.32, 0.03, 0.46, PAL.wood, { x: xr - 0.21, y: 0.74, z: 0.45, parent: S.furniture });
    // bulb
    cyl(0.008, 0.008, 0.22, 4, 0x222222, { x: cx(i), y: 2.29, z: -0.1, parent: root, cast: false });
    const bm = ico(0.055, 1, umat(PAL.amber, { emissive: PAL.amber, ei: 1.6 }), { x: cx(i), y: 2.15, z: -0.1, parent: root, cast: false });
    const bl = new THREE.PointLight(PAL.amber, 5, 7, 1.8); bl.position.set(cx(i), 2.05, -0.1); root.add(bl);
    S.bulb.push({ light: bl, mesh: bm });
  }
  // ---- bars
  S.bars = group({ parent: root });
  for (let i = 0; i < G.N; i++) {
    const xl = G.X0 + i * G.CW;
    for (let k = 0; k < 14; k++) cyl(0.017, 0.017, G.H, 6, PAL.metal, { x: xl + 0.06 + k * 0.1138, y: G.H / 2, z: G.ZF, parent: S.bars });
    for (const y of [0.04, 1.2, 2.36]) box(G.CW, 0.04, 0.04, PAL.metal, { x: xl + 0.8, y, z: G.ZF, parent: S.bars });
  }
  // ---- top of the block (workshop level)
  S.blockTop = box(7.7, 0.2, 3.0, CL, { x: -0.55, y: 2.5, z: -0.1, parent: root });
  S.sheets = group({ parent: root });
  cyl(0.008, 0.008, 3.6, 4, 0x333333, { x: 1.4, y: 4.15, z: 1.25, rz: Math.PI / 2, parent: S.sheets, cast: false });
  for (let k = 0; k < 3; k++) box(1.02, 1.5 - 0.06 * (k % 2), 0.03, k === 1 ? 0xbfb8a8 : 0xa9a79b, { x: 0.2 + k * 1.1, y: 3.4 + 0.03 * (k % 2), z: 1.25, parent: S.sheets });
  box(0.03, 1.5, 1.6, 0xb2ad9f, { x: -0.45, y: 3.4, z: 0.4, parent: S.sheets });

  // ---- corridor pipes
  S.pipes = group({ parent: root });
  const P = PAL.pipe;
  cyl(0.075, 0.075, G.ROOF, 8, P, { x: G.PIPEX, y: G.ROOF / 2, z: G.PIPEZ, parent: S.pipes });
  cyl(0.045, 0.045, G.ROOF, 6, 0x7d766a, { x: G.PIPEX + 0.25, y: G.ROOF / 2, z: G.PIPEZ - 0.12, parent: S.pipes });
  cyl(0.05, 0.05, G.ROOF, 6, P, { x: 0.7, y: G.ROOF / 2, z: -2.42, parent: S.pipes });
  S.pipesH = group({ parent: root });
  for (const [y, r, c] of [[0.3, 0.06, P], [2.05, 0.045, 0x7d766a]]) cyl(r, r, 7.5, 6, c, { x: -0.55, y, z: -2.47, rz: Math.PI / 2, parent: S.pipesH });
  for (let y = 0.9; y < 5; y += 1.3) box(0.5, 0.05, 0.1, PAL.metal, { x: G.PIPEX + 0.1, y, z: G.PIPEZ - 0.12, parent: S.pipes });
  // steam pipe + valve at workshop level
  cyl(0.065, 0.065, 7.5, 6, 0x8a7a66, { x: -0.55, y: 3.3, z: -1.85, rz: Math.PI / 2, parent: S.pipes });
  S.valve = group({ x: 1.7, y: 3.3, z: -1.85, parent: S.pipes });
  cyl(0.05, 0.05, 0.3, 6, 0x8a7a66, { z: 0.15, rx: Math.PI / 2, parent: S.valve });
  torus(0.09, 0.02, 5, 8, PAL.amber, { y: 0.14, rx: Math.PI / 2, parent: S.valve });
  cyl(0.012, 0.012, 0.14, 4, PAL.metal, { y: 0.07, parent: S.valve });

  // ---- roof with vent
  S.roof = group({ parent: root });
  const ry = G.ROOF + 0.1;
  box(6.8, 0.2, 6.4, CD, { x: -1.2, y: ry, z: 0.4, parent: S.roof });
  box(0.3, 0.2, 6.4, CD, { x: 3.15, y: ry, z: 0.4, parent: S.roof });
  box(0.8, 0.2, 5.4, CD, { x: 2.6, y: ry, z: 0.9, parent: S.roof });
  box(0.8, 0.2, 0.2, CD, { x: 2.6, y: ry, z: -2.7, parent: S.roof });
  S.roofVent = group({ x: 2.6, y: G.ROOF + 0.2, z: -2.2, parent: root });
  for (const [x, z, w, d] of [[-0.44, 0, 0.08, 0.96], [0.44, 0, 0.08, 0.96], [0, -0.44, 0.8, 0.08], [0, 0.44, 0.8, 0.08]]) box(w, 0.5, d, PAL.metal, { x, y: 0.25, z, parent: S.roofVent });
  S.fan = group({ y: 0.42, parent: S.roofVent });
  cyl(0.07, 0.07, 0.06, 6, 0x2b2f35, { parent: S.fan });
  for (let k = 0; k < 4; k++) { const b = group({ ry: k * Math.PI / 2, parent: S.fan }); box(0.34, 0.015, 0.13, 0x6a7078, { x: 0.22, rx: 0.35, parent: b }); }
  S.ventCap = group({ y: 0.5, parent: S.roofVent });
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) cyl(0.02, 0.02, 0.2, 4, PAL.metal, { x, y: 0.1, z, parent: S.ventCap });
  cyl(0.12, 0.72, 0.26, 4, 0x5a6068, { y: 0.33, ry: Math.PI / 4, parent: S.ventCap });
  cyl(0.05, 0.05, 5.8, 6, PAL.pipe, { x: G.PIPEX, y: 2.5, z: -2.86, parent: root });   // drainpipe down the back wall
  // ---- outer shell (cutaway: no front wall)
  S.shellBack = box(7.9, 5.6, 0.2, CL, { x: -0.65, y: 2.4, z: -2.7, parent: root });
  S.shellLeft = box(0.2, 5.6, 6.4, CL, { x: -4.5, y: 2.4, z: 0.4, parent: root });

  // ---- island
  const SEG = 30;
  const ringPt = (ri, k) => { const a = (k / SEG) * Math.PI * 2; const [r, y] = PROFILE[ri]; const n = ri === 0 ? 0 : (hash(ri * 37 + k) - 0.5) * (ri === 1 ? 0.2 : 0.55); return [Math.cos(a) * (r + n) * 1.25, y, Math.sin(a) * (r + n)]; };
  const pos = [];
  for (let ri = 1; ri < PROFILE.length - 0; ri++) for (let k = 0; k < SEG; k++) {
    const a = ri === 1 ? [0, -0.4, 0] : ringPt(ri - 1, k), b = ri === 1 ? [0, -0.4, 0] : ringPt(ri - 1, k + 1), c = ringPt(ri, k), d = ringPt(ri, (k + 1));
    if (ri === 1) pos.push(...a, ...d, ...c); else pos.push(...a, ...b, ...c, ...b, ...d, ...c);
  }
  const ig = new THREE.BufferGeometry(); ig.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ig.computeVertexNormals();
  S.island = new THREE.Mesh(ig, mat(PAL.rock)); S.island.receiveShadow = true; root.add(S.island);

  // ---- fences
  S.fences = group({ parent: root });
  for (const z of [G.FENCE1, G.FENCE2]) {
    for (let x = -5.5; x <= 5.51; x += 1.1) { cyl(0.035, 0.035, 2.3, 5, PAL.metal, { x, y: 0.75, z, parent: S.fences }); box(0.03, 0.03, 0.32, PAL.metal, { x, y: 2.0, z: z - 0.1, rx: -0.8, parent: S.fences }); }
    for (const y of [0.0, 0.5, 1.0, 1.5, 1.88]) box(11, 0.016, 0.016, 0x8b9096, { y, z, parent: S.fences, cast: false });
    for (const [y, dz] of [[2.02, -0.12], [2.12, -0.22]]) box(11, 0.014, 0.014, 0x8b9096, { y, z: z + dz, parent: S.fences, cast: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.3), new THREE.MeshBasicMaterial({ color: 0x9aa7ad, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    mesh.position.set(0, 0.75, z); S.fences.add(mesh);
  }
  // ---- searchlight towers
  S.towers = []; S.search = []; S.towerG = group({ parent: root });
  for (const [x, z] of [[-6.6, -2.2], [-4.4, -7.1]]) {
    const t = group({ x, y: -0.4, z, parent: S.towerG });
    for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) cyl(0.05, 0.07, 4.4, 4, PAL.metal, { x: a, y: 2.2, z: b, parent: t });
    box(1.5, 0.12, 1.5, CD, { y: 4.4, parent: t }); box(1.2, 0.9, 1.2, 0x56606b, { y: 4.95, parent: t }); cyl(0.2, 1.15, 0.5, 4, 0x3f464f, { y: 5.65, ry: Math.PI / 4, parent: t });
    ico(0.14, 1, umat(0xffe9e0, { emissive: 0xffd0c0, ei: 1.5 }), { y: 4.9, z: -0.7, parent: t, cast: false });
    S.towers.push(new THREE.Vector3(x, 4.5, z - 0.7));
    const lc = lightCone(); scene.add(lc); lc.visible = false; S.search.push(lc);
  }
  // ---- water
  const wg = new THREE.PlaneGeometry(150, 150, 60, 60); wg.rotateX(-Math.PI / 2);
  S.waterMat = umat(PAL.water);
  S.water = new THREE.Mesh(wg, S.waterMat); S.water.position.set(0, G.WATER, -20); S.water.receiveShadow = true; scene.add(S.water);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), S.waterMat); far.position.y = G.WATER - 0.12; scene.add(far);
  const base = wg.attributes.position.array.slice();
  S.waves = (t, amp = 1) => {
    const p = wg.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = base[i], z = base[i + 2];
      p[i + 1] = amp * (0.1 * Math.sin(x * 0.33 + t * 0.9) + 0.09 * Math.sin(z * 0.41 - t * 0.7 + x * 0.12) + 0.05 * Math.sin((x - z) * 0.83 + t * 1.4));
    }
    wg.attributes.position.needsUpdate = true;
  };
  // ---- Angel Island, far across the bay
  S.angelMat = umat(0x33505a, { fog: false, emissive: 0x9fd0c8, ei: 0 });
  S.angel = group({ x: 16, y: G.WATER, z: -175, parent: scene });
  const a1 = ico(1, 1, S.angelMat, { parent: S.angel, cast: false }); a1.scale.set(46, 10, 16);
  const a2 = ico(1, 1, S.angelMat, { x: -30, parent: S.angel, cast: false }); a2.scale.set(26, 5.5, 12);
  const a3 = ico(1, 1, S.angelMat, { x: 32, parent: S.angel, cast: false }); a3.scale.set(22, 4.5, 10);

  // amber glow seen through each vent hole from inside the cell
  S.holeGlow = [];
  for (let i = 0; i < G.N; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(VENT.w, VENT.h), new THREE.MeshBasicMaterial({ color: PAL.amber, transparent: true, opacity: 0, fog: false })); m.position.set(ventX(i), ventY, -1.61); root.add(m); S.holeGlow.push(m); }
  // corridor glow light (the "unguarded service corridor")
  S.corridorLight = new THREE.PointLight(PAL.amber, 0, 9, 1.6); S.corridorLight.position.set(1.6, 1.6, -2.1); root.add(S.corridorLight);
  S.topLight = new THREE.PointLight(PAL.amber, 0, 9, 1.6); S.topLight.position.set(1.4, 4.4, 0.2); root.add(S.topLight);
  return S;
}
