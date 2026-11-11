// Props and cast for the Alcatraz video.
import * as THREE from 'three';
import { PAL, mat, umat, box, cyl, ico, cone, torus, group, hash } from '/shared/web/core.js';
import { makeFigure } from '/shared/web/figure.js';
import { lightCone } from './set.js';

// accent colours: collar + cuffs
export const ACCENT = { A: 0xF2A65A, B: 0x49B6A6, C: 0xF1EDE2, W: 0xA680E0 };

export function buildProps(scene, stage) {
  const P = {};
  const add = (o) => { scene.add(o); o.visible = false; return o; };
  P.fig = {};
  for (const k of 'ABCW') P.fig[k] = add(makeFigure({ accent: ACCENT[k] }));
  P.guard = add(makeFigure({ guard: true, shirt: PAL.guard, pants: PAL.guard, accent: PAL.guardDark }));
  P.torch = group({ parent: P.guard.userData.J.elB, y: -0.32 });
  cyl(0.03, 0.03, 0.16, 6, 0x222428, { parent: P.torch, rx: Math.PI / 2, z: 0.02 });
  cyl(0.045, 0.03, 0.05, 6, 0x9a9da3, { parent: P.torch, rx: Math.PI / 2, z: 0.12 });
  P.beam = add(lightCone());

  // spoon (handle along +Y)
  const spoon = () => { const g = new THREE.Group(); box(0.022, 0.15, 0.008, 0xc9ccd2, { parent: g }); const b = ico(0.03, 1, 0xc9ccd2, { y: 0.1, parent: g }); b.scale.set(0.85, 1.25, 0.35); return g; };
  P.spoon = spoon(); P.fig.A.userData.J.elA.add(P.spoon); P.spoon.position.set(0, -0.36, 0.03); P.spoon.rotation.x = Math.PI; P.spoon.visible = false;
  P.bigSpoon = add(spoon());
  P.chips = []; for (let i = 0; i < 16; i++) P.chips.push(add(box(0.035, 0.03, 0.03, PAL.concreteLight)));
  P.salt = []; for (let i = 0; i < 70; i++) P.salt.push(add(ico(0.022, 0, umat(PAL.white, { emissive: PAL.white, ei: 0.5, transparent: true }), { cast: false })));
  // cracks on the hero cell's back wall: zig-zag runs of thin dark slivers
  P.cracks = [];
  const runs = [[[2.05, 2.0], [2.2, 1.6], [2.12, 1.25], [2.32, 0.95], [2.26, 0.7]], [[3.1, 1.75], [2.92, 1.4], [3.0, 1.1], [2.86, 0.8]], [[2.45, 1.45], [2.62, 1.2], [2.55, 0.98]], [[1.75, 1.0], [1.95, 0.72], [1.9, 0.5]]];
  for (const r of runs) for (let i = 0; i < r.length - 1; i++) {
    const [x0, y0] = r[i], [x1, y1] = r[i + 1]; const L = Math.hypot(x1 - x0, y1 - y0);
    const m = add(box(L + 0.02, 0.028, 0.012, 0x3f3a35, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: -1.393, rz: Math.atan2(y1 - y0, x1 - x0), cast: false }));
    P.cracks.push(m);
  }
  // sound rings + notes
  P.rings = []; for (let i = 0; i < 6; i++) P.rings.push(add(torus(1, 0.035, 5, 28, umat(PAL.red, { emissive: PAL.red, ei: 1, transparent: true, fog: false }), { cast: false })));
  P.notes = []; for (let i = 0; i < 8; i++) { const g = add(new THREE.Group()); const m = umat(PAL.amber, { emissive: PAL.amber, ei: 0.9, transparent: true }); const h = ico(0.07, 1, m, { parent: g, cast: false }); h.scale.set(1.2, 0.85, 0.7); box(0.022, 0.26, 0.022, m, { x: 0.07, y: 0.13, parent: g, cast: false }); box(0.12, 0.05, 0.022, m, { x: 0.12, y: 0.24, parent: g, cast: false }); g.userData.m = m; P.notes.push(g); }
  // drill: handle, motor, bit, muffling housing (assembled along +X)
  P.drill = add(new THREE.Group());
  const D = P.drill.userData = {};
  D.handle = group({ parent: P.drill }); box(0.07, 0.2, 0.07, PAL.wood, { x: -0.1, y: -0.13, parent: D.handle }); box(0.2, 0.05, 0.08, 0x3a3e45, { x: -0.1, parent: D.handle });
  D.motor = group({ parent: P.drill }); cyl(0.085, 0.085, 0.22, 8, 0x596069, { x: 0.1, rz: Math.PI / 2, parent: D.motor }); cyl(0.092, 0.092, 0.07, 8, PAL.amber, { x: 0.1, rz: Math.PI / 2, parent: D.motor }); cyl(0.06, 0.085, 0.05, 8, 0x3a3e45, { x: 0.235, rz: -Math.PI / 2, parent: D.motor });
  D.bit = group({ parent: P.drill }); cyl(0.02, 0.02, 0.2, 6, 0xc9ccd2, { x: 0.34, rz: Math.PI / 2, parent: D.bit }); cone(0.03, 0.08, 6, 0xc9ccd2, { x: 0.47, rz: -Math.PI / 2, parent: D.bit });
  D.housing = group({ parent: P.drill }); box(0.32, 0.25, 0.25, 0x8d8573, { x: 0.09, parent: D.housing }); for (const x of [-0.02, 0.2]) box(0.03, 0.27, 0.27, 0x5f5a4e, { x, parent: D.housing });
  // accordion: two end blocks + bellows, stretches along X
  P.acc = add(new THREE.Group());
  const AC = P.acc.userData = { folds: [] };
  AC.l = box(0.1, 0.34, 0.2, 0x2f5d62, { parent: P.acc }); AC.r = box(0.1, 0.34, 0.2, 0x2f5d62, { parent: P.acc });
  box(0.02, 0.26, 0.12, PAL.white, { x: 0.06, parent: AC.r });
  for (let i = 0; i < 7; i++) AC.folds.push(box(0.02, i % 2 ? 0.3 : 0.26, i % 2 ? 0.18 : 0.15, i % 2 ? PAL.amber : 0xd9c9a8, { parent: P.acc }));
  AC.set = (w) => { AC.l.position.x = -w / 2; AC.r.position.x = w / 2; AC.folds.forEach((f, i) => { f.position.x = -w / 2 + 0.07 + (w - 0.14) * (i / 6); }); };
  // brush
  P.brush = add(new THREE.Group()); box(0.03, 0.22, 0.03, PAL.wood, { y: 0.14, parent: P.brush }); box(0.09, 0.07, 0.035, 0x3a3e45, { parent: P.brush }); box(0.085, 0.05, 0.03, PAL.white, { y: -0.055, parent: P.brush });
  // raincoats
  P.coats = [];
  const cc = [0x4d6a64, 0x3f5852, 0x5b6f58, 0x47616b, 0x556b5f];
  for (let i = 0; i < 18; i++) { const g = add(new THREE.Group()); box(0.52, 0.07, 0.4, cc[i % 5], { parent: g }); box(0.2, 0.04, 0.12, cc[(i + 2) % 5], { y: 0.05, z: -0.13, parent: g }); box(0.16, 0.035, 0.42, cc[(i + 1) % 5], { x: 0.3, y: -0.01, rz: -0.25, parent: g }); P.coats.push(g); }
  // raft (length along Z, ~2.7 x 1.4)
  P.raft = add(new THREE.Group());
  const tube = torus(0.5, 0.16, 6, 14, PAL.rubber, { rx: Math.PI / 2, parent: P.raft }); tube.scale.set(1.08, 2.25, 1);
  const floor = cyl(0.5, 0.5, 0.05, 14, PAL.rubberDark, { y: -0.08, parent: P.raft }); floor.scale.set(1.08, 1, 2.25);
  P.seams = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.39; const m = umat(0x6f8d86, { emissive: PAL.amber, ei: 0 }); const s = torus(0.175, 0.018, 4, 8, m, { x: Math.cos(a) * 0.54, z: Math.sin(a) * 1.125, ry: -Math.atan2(Math.sin(a) * 1.08, Math.cos(a) * 2.25) + Math.PI / 2, parent: P.raft, cast: false }); P.seams.push(m); }
  P.steam = []; for (let i = 0; i < 12; i++) P.steam.push(add(ico(0.13, 0, umat(PAL.white, { transparent: true, opacity: 0.6, emissive: 0xffffff, ei: 0.25 }), { cast: false })));
  // paddles
  const paddle = () => { const g = new THREE.Group(); cyl(0.018, 0.018, 1.0, 5, PAL.wood, { parent: g }); box(0.16, 0.3, 0.02, PAL.wood, { y: -0.6, parent: g }); return g; };
  P.paddles = [add(paddle()), add(paddle())]; P.floatPaddle = add(paddle());
  // decoy head: plaster -> soap -> paper -> paint -> hair
  P.decoy = add(new THREE.Group());
  const H = P.decoy.userData = {};
  H.plaster = ico(0.115, 0, 0xe9e6df, { parent: P.decoy }); H.plaster.scale.set(0.95, 1.12, 1);
  H.skinMat = umat(0xe7dcc0);
  H.soap = ico(0.135, 2, H.skinMat, { parent: P.decoy }); H.soap.scale.set(0.92, 1.08, 0.98);
  H.paper = group({ parent: P.decoy }); for (const [y, r] of [[-0.06, 0.118], [0.0, 0.132], [0.065, 0.118]]) torus(r, 0.012, 4, 12, 0xf6f3ea, { y, rx: Math.PI / 2 + 0.2, rz: 0.3, parent: H.paper, cast: false });
  H.hair = group({ parent: P.decoy }); const hr = new THREE.Mesh(new THREE.SphereGeometry(0.142, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0x3b2a20)); hr.scale.set(0.95, 1.08, 1.02); hr.rotation.x = -0.45; hr.position.y = 0.012; hr.castShadow = true; H.hair.add(hr);
  P.stand = add(cyl(0.05, 0.07, 0.06, 6, PAL.wood));
  // titles
  P.t1962 = add(stage.text3d('1962', 0.42, PAL.white));
  P.t50 = add(stage.text3d('50+', 0.62, PAL.amber));
  P.t54 = add(stage.text3d('54°F', 2.6, PAL.white, { ei: 0.8 }));
  // wake, scraps, gull, boats, map
  P.wake = [];
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 30).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff4e6, transparent: true, opacity: 0.4, depthWrite: false, fog: true })); m.rotation.y = s * 0.11; scene.add(m); m.visible = false; P.wake.push(m); }
  P.scraps = []; for (let i = 0; i < 5; i++) { const g = add(new THREE.Group()); const a = cyl(0.3 + 0.12 * hash(i), 0.22, 0.03, 4 + (i % 3), i % 2 ? PAL.rubber : PAL.rubberDark, { parent: g }); a.scale.set(1.5, 1, 0.8 + 0.5 * hash(i + 9)); P.scraps.push(g); }
  P.gull = add(new THREE.Group());
  const gb = ico(0.13, 0, mat(0xf4f1ea, { emissive: 0xf4f1ea, ei: 0.6 }), { parent: P.gull, cast: false }); gb.scale.set(0.6, 0.5, 2.4);
  P.gull.userData.wings = [-1, 1].map((s) => { const w = group({ parent: P.gull }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.16, 0, 0, -0.14, s * 0.75, 0, -0.05], 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat(0xf4f1ea, { side: THREE.DoubleSide, emissive: 0xf4f1ea, ei: 0.75 })); w.add(m); return w; });
  P.boats = [];
  for (let i = 0; i < 4; i++) {
    const b = add(new THREE.Group());
    const hull = box(1.5, 0.7, 4.2, 0x8a96a1, { y: 0.2, parent: b }); const bow = cyl(0.01, 1.06, 1.6, 4, 0x8a96a1, { y: 0.2, z: -2.9, rx: -Math.PI / 2, ry: Math.PI / 4, parent: b }); bow.scale.set(1, 1, 0.66);
    box(1.2, 0.9, 1.5, PAL.white, { y: 1.0, z: 0.5, parent: b }); box(1.3, 0.1, 1.7, 0x3c444e, { y: 1.5, z: 0.5, parent: b });
    b.userData.cone = lightCone(); scene.add(b.userData.cone); b.userData.cone.visible = false;
    const wk = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff4e6, transparent: true, opacity: 0.5, depthWrite: false, fog: false })); wk.position.set(0, 0.08, 6); wk.scale.set(1.2, 1, 9); b.add(wk); b.userData.wake = wk;
    P.boats.push(b);
  }
  P.map = add(new THREE.Group());
  const lm = new THREE.MeshBasicMaterial({ color: 0xfff4e6, transparent: true, opacity: 0.22, depthWrite: false, fog: false });
  for (let i = -6; i <= 6; i++) { const a = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 400).rotateX(-Math.PI / 2), lm); a.position.set(i * 25, 0, 0); P.map.add(a); const b = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.5).rotateX(-Math.PI / 2), lm); b.position.set(0, 0, i * 25); P.map.add(b); }
  P.sweep = new THREE.Mesh(new THREE.CircleGeometry(170, 24, 0, 0.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PAL.amber, transparent: true, opacity: 0.2, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  P.map.add(P.sweep);
  P.sweepRings = [60, 120].map((r) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r + 0.4, 48).rotateX(-Math.PI / 2), lm); P.map.add(m); return m; });
  // glow behind the vent holes (seen from inside the cells)
  P.propLight = new THREE.PointLight(0xfff0dc, 0, 12, 1.5); scene.add(P.propLight);
  return P;
}
