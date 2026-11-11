// Shared maths, style, and low-poly building helpers used by every video.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a || 1e-6));
export const smooth = (x) => x * x * (3 - 2 * x);
export const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOut = (x) => 1 - Math.pow(1 - x, 3);
export const easeIn = (x) => x * x * x;
export const backOut = (x) => { const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
// quick pop-in scale-up: 0 before t0, overshoots, settles at 1
export const pop = (t, t0, d = 0.38) => (t < t0 ? 0 : backOut(clamp((t - t0) / d)));
export const sseg = (t, a, b) => smooth(seg(t, a, b));
export const eseg = (t, a, b) => easeIO(seg(t, a, b));
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const pulse = (t, a, b, edge = 0.25) => Math.min(sseg(t, a, a + edge), 1 - sseg(t, b - edge, b));

// House palette (see README > Style)
export const PAL = {
  amber: 0xF2A65A, navy: 0x1B2A49, fog: 0x5E7C80, white: 0xF1EDE2, red: 0xE5483B,
  concrete: 0x9A938A, concreteDark: 0x7B756E, concreteLight: 0xB3ACA1, metal: 0x4A5058,
  shirt: 0xA9BBCD, pants: 0x5E6F86, skin: 0xD9A47F, guard: 0x1E2C55, guardDark: 0x141D3B,
  rubber: 0x44605B, rubberDark: 0x36504C, cardboard: 0xB08A5B, wood: 0x9A7148, rock: 0x5A5F63,
  water: 0x16233F, blanket: 0x6C7468, mattress: 0xC9C2B4, pipe: 0x6E6A62,
};

const _mats = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (o.unique || !_mats.has(key)) {
    const m = new THREE.MeshLambertMaterial({ color, flatShading: o.smooth ? false : true });
    if (o.emissive !== undefined) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
    if (o.transparent) { m.transparent = true; m.opacity = o.opacity ?? 1; }
    if (o.fog === false) m.fog = false;
    if (o.side) m.side = o.side;
    if (o.unique) return m;
    _mats.set(key, m);
  }
  return _mats.get(key);
}
export const umat = (color, o = {}) => mat(color, { ...o, unique: true });

function place(m, o = {}) {
  m.position.set(o.x || 0, o.y || 0, o.z || 0);
  if (o.rx || o.ry || o.rz) m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
  if (o.s !== undefined) m.scale.setScalar(o.s);
  if (o.sx || o.sy || o.sz) m.scale.set(o.sx || 1, o.sy || 1, o.sz || 1);
  m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false;
  if (o.parent) o.parent.add(m);
  return m;
}
const M = (c, o) => (c && c.isMaterial ? c : mat(c, o.m || {}));
export const box = (w, h, d, c, o = {}) => place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c, o)), o);
export const cyl = (rt, rb, h, n, c, o = {}) => place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, n), M(c, o)), o);
export const ico = (r, det, c, o = {}) => place(new THREE.Mesh(new THREE.IcosahedronGeometry(r, det), M(c, o)), o);
export const cone = (r, h, n, c, o = {}) => place(new THREE.Mesh(new THREE.ConeGeometry(r, h, n), M(c, o)), o);
export const torus = (R, r, n1, n2, c, o = {}) => place(new THREE.Mesh(new THREE.TorusGeometry(R, r, n1, n2), M(c, o)), o);
export const group = (o = {}) => place(new THREE.Group(), o);
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// scale helper that keeps zero-scale objects out of the render
export function setPop(obj, s) { obj.visible = s > 0.001; if (obj.visible) obj.scale.setScalar(s * (obj.userData.base || 1)); }

// Camera keyframes: [{t, p:[x,y,z], l:[x,y,z], fov}] eased between keys (one smooth move per pair)
export function camAt(keys, t, easeFn = easeIO) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const u = (b.e || easeFn)(seg(t, a.t, b.t));
  const L = (k) => [0, 1, 2].map((j) => lerp(a[k][j], b[k][j], u));
  return { p: L('p'), l: L('l'), fov: lerp(a.fov ?? 35, b.fov ?? a.fov ?? 35, u) };
}
