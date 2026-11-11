// Low-poly blank-faced figure with a simple joint rig. Faces +Z, origin at the feet.
// Limb forward (toward +Z) = negative rx. Spine forward lean = positive rx.
import * as THREE from 'three';
import { PAL, mat, box, cyl, ico, group, lerp } from './core.js';

export function makeFigure({ accent = PAL.amber, shirt = PAL.shirt, pants = PAL.pants, skin = PAL.skin, guard = false } = {}) {
  const root = new THREE.Group();
  const pelvis = group({ y: 0.92, parent: root });
  box(0.36, 0.2, 0.21, pants, { parent: pelvis });
  const spine = group({ y: 0.08, parent: pelvis });
  const torso = cyl(0.215, 0.175, 0.5, 6, shirt, { y: 0.27, parent: spine }); torso.scale.z = 0.64;
  if (guard) box(0.37, 0.05, 0.23, PAL.guardDark, { y: 0.03, parent: spine });
  const acc = mat(accent, { emissive: accent, ei: guard ? 0 : 0.45 });
  cyl(0.085, 0.115, 0.085, 8, acc, { y: 0.55, parent: spine });               // collar
  const head = group({ y: 0.58, parent: spine });
  cyl(0.05, 0.055, 0.08, 6, skin, { y: 0.02, parent: head });
  const skull = ico(0.135, 2, skin, { y: 0.16, parent: head }); skull.scale.set(0.92, 1.08, 0.98);
  if (guard) {
    cyl(0.14, 0.13, 0.08, 8, PAL.guardDark, { y: 0.29, parent: head });
    box(0.2, 0.02, 0.12, PAL.guardDark, { y: 0.255, z: 0.13, parent: head });
  }
  const J = { root, pelvis, spine, head };
  for (const [s, k] of [[1, 'A'], [-1, 'B']]) {
    const sh = group({ x: 0.262 * s, y: 0.47, parent: spine });
    cyl(0.062, 0.052, 0.3, 5, shirt, { y: -0.15, parent: sh });
    const el = group({ y: -0.3, parent: sh });
    cyl(0.05, 0.044, 0.25, 5, shirt, { y: -0.12, parent: el });
    cyl(0.058, 0.058, 0.07, 6, acc, { y: -0.23, parent: el });              // cuff
    const hand = ico(0.052, 0, skin, { y: -0.3, parent: el });
    const hip = group({ x: 0.1 * s, y: -0.06, parent: pelvis });
    cyl(0.088, 0.07, 0.42, 5, pants, { y: -0.21, parent: hip });
    const kn = group({ y: -0.42, parent: hip });
    cyl(0.066, 0.055, 0.4, 5, pants, { y: -0.2, parent: kn });
    box(0.1, 0.07, 0.23, 0x2B2B2E, { y: -0.42, z: 0.05, parent: kn });
    J['sh' + k] = sh; J['el' + k] = el; J['hip' + k] = hip; J['kn' + k] = kn; J['hand' + k] = hand;
  }
  root.userData.J = J;
  return root;
}

const JOINTS = ['pelvis', 'spine', 'head', 'shA', 'shB', 'elA', 'elB', 'hipA', 'hipB', 'knA', 'knB'];
// pose = { y: pelvis height, joint: [rx, ry, rz], ... }
export function applyPose(fig, pose) {
  const J = fig.userData.J;
  J.pelvis.position.y = pose.y ?? 0.92;
  for (const j of JOINTS) { const r = pose[j] || [0, 0, 0]; J[j].rotation.set(r[0], r[1] || 0, r[2] || 0); }
  return fig;
}
export function mixPose(a, b, t) {
  const o = { y: lerp(a.y ?? 0.92, b.y ?? 0.92, t) };
  for (const j of JOINTS) { const x = a[j] || [0, 0, 0], y = b[j] || [0, 0, 0]; o[j] = [0, 1, 2].map((i) => lerp(x[i] || 0, y[i] || 0, t)); }
  return o;
}
const S = Math.sin, C = Math.cos, PI = Math.PI;
export const Pose = {
  stand: (sway = 0) => ({ shA: [0.05 * S(sway), 0, 0.09], shB: [-0.05 * S(sway), 0, -0.09], elA: [-0.15], elB: [-0.15] }),
  walk: (p, amt = 1) => ({
    y: 0.9 + 0.02 * C(2 * p),
    hipA: [-0.55 * amt * S(p)], hipB: [0.55 * amt * S(p)],
    knA: [0.75 * amt * Math.max(0, -C(p))], knB: [0.75 * amt * Math.max(0, C(p))],
    shA: [0.5 * amt * S(p), 0, 0.08], shB: [-0.5 * amt * S(p), 0, -0.08], elA: [-0.35], elB: [-0.35], spine: [0.06 * amt],
  }),
  // kneeling at a low wall, arms working forward
  kneel: (p = 0) => ({
    y: 0.5, hipA: [-0.35], hipB: [-0.2], knA: [2.0], knB: [1.9], spine: [0.55], head: [-0.25],
    shA: [-1.15 + 0.22 * S(p), 0, 0.1], shB: [-0.95, 0, -0.15], elA: [-0.5 - 0.2 * S(p)], elB: [-0.7],
  }),
  // flat on the belly, arms ahead, wriggling (pelvis rx = 90deg puts the body horizontal)
  slither: (p = 0) => ({
    y: 0.2, pelvis: [PI / 2, 0, 0.06 * S(p)], head: [-1.1],
    shA: [-2.7 + 0.35 * S(p), 0, 0.25], shB: [-2.7 - 0.35 * S(p), 0, -0.25], elA: [-0.5 - 0.3 * S(p)], elB: [-0.5 + 0.3 * S(p)],
    hipA: [-0.15 - 0.25 * S(p)], hipB: [-0.15 + 0.25 * S(p)], knA: [0.4 + 0.3 * S(p)], knB: [0.4 - 0.3 * S(p)],
  }),
  climb: (p = 0) => ({
    spine: [0.12], head: [-0.5],
    shA: [-2.5 + 0.45 * S(p), 0, 0.15], shB: [-2.5 - 0.45 * S(p), 0, -0.15], elA: [-0.6 + 0.4 * S(p)], elB: [-0.6 - 0.4 * S(p)],
    hipA: [-0.9 - 0.5 * S(p)], hipB: [-0.9 + 0.5 * S(p)], knA: [1.3 + 0.5 * S(p)], knB: [1.3 - 0.5 * S(p)],
  }),
  sit: (seat = 0.5) => ({
    y: seat + 0.08, hipA: [-PI / 2, 0, 0.08], hipB: [-PI / 2, 0, -0.08], knA: [PI / 2], knB: [PI / 2],
    shA: [-0.5, 0, 0.2], shB: [-0.5, 0, -0.2], elA: [-1.0], elB: [-1.0],
  }),
  crouchRun: (p) => { const w = Pose.walk(p, 1.15); w.spine = [0.45]; w.head = [-0.3]; w.y = 0.82 + 0.02 * C(2 * p); return w; },
};
