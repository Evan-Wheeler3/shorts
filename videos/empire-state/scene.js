// HOW TO BUILD THE EMPIRE STATE BUILDING IN A YEAR - 2D paper-cutaway animation.
// One tall cross-section of the tower and the street; the camera only scrolls and zooms.
// Every frame is a pure function of (shot, t). World y is DOWN: heights are negative.
import { clamp, lerp, seg, sseg, eseg, smooth, easeOut, easeIn, backOut, pop, pulse, hash } from '/shared/web/core.js';
import { hex, rgba, mixHex } from '/shared/web/stage2d.js';

const PI = Math.PI, S = Math.sin, Cs = Math.cos;
const FH = 3.75, TOP = 102, SPIRE = -440;
const C = {
  bgTop: 0x131E36, bgBot: 0x1B2A49, grid: 0xF1EDE2, line: 0xF1EDE2, amber: 0xF2A65A, red: 0xE5483B,
  stone: 0xE4DCCB, stoneShade: 0xCDC4B1, mast: 0xC8CED8, slab: 0x7E90AC, ground: 0x263A61, road: 0x18243F,
  basement: 0x101A30, brick: 0xB9774F, brickDark: 0x9A5F3D, paper1: 0x2B4170, paper2: 0x233760, paper3: 0x1E2F54,
  dark: 0x33425F, cream: 0xEFE7D6, window: 0x66748F, wood: 0x9A7148,
};
const SECTIONS = [[0, 5, 33], [5, 21, 27], [21, 30, 23], [30, 72, 20], [72, 81, 17], [81, 85, 14], [85, 86, 11], [86, 102, 4.5]];
const halfW = (n) => { for (const [a, b, w] of SECTIONS) if (n < b) return w; return 4.5; };
const fy = (n) => -n * FH;
const mixCam = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), u)) });

export async function create(st, list) {
  const { ctx, W, H } = st;
  const px = (cam, n) => n / cam.z;            // n screen pixels expressed in world units

  // ------------------------------------------------------------------ backdrop
  function backdrop(cam, o = {}) {
    const night = o.night || 0, dawn = o.dawn || 0;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, hex(mixHex(mixHex(C.bgTop, 0x0A1124, night), 0x2C4674, dawn)));
    g.addColorStop(1, hex(mixHex(mixHex(C.bgBot, 0x121C36, night), 0x5F6F92, dawn)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (dawn > 0) { const [, gy] = st.toScreen(cam, 0, 0); const r = ctx.createRadialGradient(W / 2, gy, 0, W / 2, gy, H * 0.75); r.addColorStop(0, rgba(C.amber, 0.38 * dawn)); r.addColorStop(1, rgba(C.amber, 0)); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H); }
    // blueprint grid, drawn in world space so it scrolls with the set
    const [x0, y0, x1, y1] = st.view(cam);
    st.world(cam, () => {
      for (const [stepU, a] of [[10, 0.05], [50, 0.11]]) {
        if (stepU * cam.z < 14) continue;
        ctx.beginPath();
        for (let x = Math.floor(x0 / stepU) * stepU; x <= x1; x += stepU) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
        for (let y = Math.floor(y0 / stepU) * stepU; y <= y1; y += stepU) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
        ctx.strokeStyle = rgba(C.grid, a * (1 - 0.5 * night)); ctx.lineWidth = px(cam, 1.5); ctx.stroke();
      }
    });
  }
  function outlinePath() {
    ctx.beginPath(); ctx.moveTo(-33, 0);
    for (const [a, b, w] of SECTIONS) { ctx.lineTo(-w, fy(a)); ctx.lineTo(-w, fy(b)); }
    ctx.lineTo(-1.2, fy(TOP)); ctx.lineTo(0, SPIRE); ctx.lineTo(1.2, fy(TOP));
    for (const [a, b, w] of [...SECTIONS].reverse()) { ctx.lineTo(w, fy(b)); ctx.lineTo(w, fy(a)); }
    ctx.lineTo(33, 0);
  }
  function ghost(cam, alpha, upTo = 1, ticks = 0) {
    if (alpha <= 0.003) return;
    ctx.save(); ctx.beginPath(); ctx.rect(-80, SPIRE * upTo - 2, 160, -SPIRE * upTo + 2.2); ctx.clip();
    outlinePath(); ctx.strokeStyle = rgba(C.line, alpha); ctx.lineWidth = Math.max(0.5, px(cam, 5)); ctx.setLineDash([]); ctx.stroke();
    if (ticks > 0) { ctx.beginPath(); for (let n = 1; n <= TOP * ticks; n++) { const w = halfW(n - 0.5); ctx.moveTo(-w, fy(n)); ctx.lineTo(w, fy(n)); } ctx.strokeStyle = rgba(C.line, alpha * 0.45); ctx.lineWidth = Math.max(0.18, px(cam, 1.2)); ctx.stroke(); }
    ctx.restore();
  }
  const NEIGH = [];
  for (let i = 0, x = -250; x < 250; i++) { const w = 14 + hash(i) * 20, h = 16 + hash(i + 40) * 58 + (hash(i + 80) > 0.82 ? 45 : 0); if (x + w < -62 || x > 44) NEIGH.push({ x, w, h, tone: i % 3, i }); x += w + 1.5 + hash(i + 7) * 5; }
  function skyline(cam, o = {}) {
    const [x0, , x1] = st.view(cam), lit = o.lit || 0;
    for (const b of NEIGH) {
      if (b.x + b.w < x0 - 5 || b.x > x1 + 5) continue;
      st.rect([C.paper1, C.paper2, C.paper3][b.tone], 1, b.x, -b.h, b.w, b.h + 0.5);
      ctx.save(); ctx.beginPath(); ctx.rect(b.x, -b.h, b.w, b.h); ctx.clip();
      for (let y = -b.h + 3; y < -2; y += 4.2) st.line(lit > 0 ? mixHex(0x40557F, C.amber, lit * (hash(b.i * 9 + y) > 0.55 ? 0.85 : 0.1)) : 0x40557F, 1.5, [[b.x + 1.6, y], [b.x + b.w - 1.4, y]], 1, [1.4, 1.7]);
      ctx.restore();
    }
  }
  function ground(cam, o = {}) {
    const [x0, , x1, y1] = st.view(cam);
    st.rect(C.ground, 1.2, x0 - 5, 0, x1 - x0 + 10, Math.max(40, y1 + 5));
    if (o.basement !== false) { st.rect(C.basement, 0, -33, 0.7, 66, 9.3); st.line(C.slab, 0.3, [[-33, 0.7], [-33, 10], [33, 10], [33, 0.7]], 0.8); }
    for (let k = 0; k < 4; k++) { const yk = 17 + k * 19; if (yk - 4 > y1) break; st.paper(mixHex(C.ground, 0x141F3A, 0.22 * (k + 1)), 1, (q) => { const xa = Math.floor((x0 - 8) / 8) * 8; q.moveTo(xa, y1 + 8); for (let x = xa; x <= x1 + 16; x += 8) q.lineTo(x, yk + 2.4 * S(x * 0.06 + k * 2.1) + 1.2 * S(x * 0.17 + k)); q.lineTo(x1 + 16, y1 + 8); q.closePath(); }); }
    st.line(C.line, Math.max(0.16, px(cam, 2)), [[x0 - 5, 0], [x1 + 5, 0]], 0.75);
    if (o.road) { st.rect(C.road, 0, x0 - 5, 0.5, x1 - x0 + 10, 3.4); st.line(C.line, 0.14, [[x0 - 5, 2.2], [x1 + 5, 2.2]], 0.35, [2.2, 2.2]); }
  }
  // the tower at a given state of construction
  function building(cam, o) {
    const frame = o.frame || 0, slab = o.slab ?? frame - 2, clad = o.clad || 0, cladBase = o.cladBase || 0, lit = o.lit;
    const [, y0, , y1] = st.view(cam);
    const nLo = Math.max(0, Math.floor(-y1 / FH) - 1), nHi = Math.min(TOP, Math.ceil(-y0 / FH) + 1);
    if (o.interior) for (const n of o.interior) st.rect(C.paper2, 0, -halfW(n), fy(n + 1), halfW(n) * 2, FH);
    // floor decks
    ctx.fillStyle = hex(C.slab);
    for (let n = Math.max(nLo, 1); n <= Math.min(slab, nHi); n++) { if (n < clad - 1 && n >= cladBase) continue; const w = halfW(n - 0.5); ctx.fillRect(-w, fy(n), w * 2, 0.42); }
    // steel frame (amber)
    ctx.beginPath();
    const fTop = Math.min(Math.ceil(frame), nHi);
    for (let n = Math.max(nLo, 1); n <= fTop; n++) {
      if (n < clad - 1 && n > cladBase) continue;
      const w = halfW(n - 0.5), part = n > frame ? frame - (n - 1) : 1, xr = -w + 2 * w * part;
      for (let x = -w; x <= xr + 0.01; x += (2 * w) / Math.round((2 * w) / 6.5)) { ctx.moveTo(x, fy(n - 1)); ctx.lineTo(x, fy(n)); }
      ctx.moveTo(-w, fy(n)); ctx.lineTo(xr, fy(n));
    }
    ctx.strokeStyle = hex(C.amber); ctx.lineWidth = Math.max(0.34, px(cam, 2)); ctx.stroke();
    // stone cladding with window bands
    if (clad > cladBase) {
      for (const [a, b, w] of SECTIONS) {
        const lo = Math.max(a, cladBase), hi = Math.min(b, clad); if (hi <= lo || fy(hi) > y1 || fy(lo) < y0) continue;
        const mast = a >= 86;
        st.rect(mast ? C.mast : C.stone, 1.1, -w, fy(hi), w * 2, (hi - lo) * FH);
        if (!mast && w > 12) for (const sx of [-0.55, 0, 0.55]) { ctx.fillStyle = hex(C.stoneShade); ctx.fillRect(sx * w - w * 0.11, fy(hi), w * 0.22, (hi - lo) * FH); }
        if (mast) { ctx.fillStyle = hex(C.amber); ctx.fillRect(-0.7, fy(hi), 1.4, (hi - lo) * FH); }
      }
      const cTop = Math.min(Math.floor(clad), nHi);
      for (let n = Math.max(nLo, cladBase); n < cTop; n++) {
        const w = halfW(n + 0.5), cols = Math.floor((2 * w - 1.6) / 2.6), xs = -(cols * 2.6 - 1.3) / 2, y = fy(n) - 2.9;
        if (n >= 86) continue;
        if (lit) { for (let j = 0; j < cols; j++) { const k = lit(n, j); ctx.fillStyle = k > 0 ? hex(mixHex(C.window, 0xFFC873, k)) : hex(0x505C78); ctx.fillRect(xs + j * 2.6, y, 1.3, 2.0); } }
        else { ctx.fillStyle = hex(C.window); for (let j = 0; j < cols; j++) ctx.fillRect(xs + j * 2.6, y, 1.3, 2.0); }
      }
    }
  }
  function spire(dy = 0, a = 1) { ctx.save(); ctx.globalAlpha = a; st.paper(C.mast, 1, (c) => { c.moveTo(-1.3, fy(TOP) + dy); c.lineTo(0, SPIRE + dy); c.lineTo(1.3, fy(TOP) + dy); c.closePath(); }); ctx.restore(); }
  // ------------------------------------------------------------------ cast and props
  function worker(x, y, o = {}) {
    const s = (o.s || 1) * 1.3, col = hex(o.c ?? C.line), ph = o.walk ?? null, sw = ph === null ? 0.16 : 0.34 * S(ph);
    ctx.save(); ctx.translate(x, y - (ph === null ? 0 : 0.05 * Math.abs(S(ph)))); ctx.scale((o.flip ? -1 : 1) * s, s); ctx.globalAlpha *= o.a ?? 1;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 0.21; ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.sit) { ctx.moveTo(-0.1, -0.85); ctx.lineTo(0.5, -0.8); ctx.lineTo(0.55, -0.15); ctx.moveTo(0.1, -0.85); ctx.lineTo(0.7, -0.8); ctx.lineTo(0.75, -0.15); }
    else { ctx.moveTo(-0.08, -0.85); ctx.lineTo(-0.08 - sw, 0); ctx.moveTo(0.08, -0.85); ctx.lineTo(0.08 + sw, 0); }
    const arm = o.arm || [0.42, -0.95]; ctx.moveTo(0.12, -1.42); ctx.lineTo(arm[0], arm[1]);
    if (o.arm2) { ctx.moveTo(-0.05, -1.42); ctx.lineTo(o.arm2[0], o.arm2[1]); }
    ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-0.3, -1.58, 0.6, 0.82, 0.2); ctx.fill();
    ctx.beginPath(); ctx.arc(0.02, -1.86, 0.27, 0, PI * 2); ctx.fill();
    ctx.fillRect(-0.24, -2.14, 0.6, 0.12);                                   // flat cap brim
    ctx.restore();
  }
  function beams(x, y, n, len = 7) { for (let i = 0; i < n; i++) st.rect(C.amber, i === n - 1 ? 0.5 : 0, x - len / 2 + (i % 2) * 0.3, y - 0.42 * (i + 1), len, 0.34, 0.05); }
  function brickBlock(x, y, cols, rows, s = 1) { for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { ctx.fillStyle = hex((r + k) % 2 ? C.brick : C.brickDark); ctx.fillRect(x + (k - cols / 2) * 0.62 * s + (r % 2) * 0.1, y - (r + 1) * 0.32 * s, 0.56 * s, 0.27 * s); } }
  function truck(x, y, o = {}) {
    ctx.save(); ctx.translate(x, y); const s = o.s || 1; ctx.scale((o.flip ? -1 : 1) * s, s); ctx.globalAlpha *= o.a ?? 1;
    st.rect(C.dark, 0.6, -5.6, -1.75, 8.2, 0.55, 0.1);
    st.rect(o.c ?? C.cream, 0.6, 2.7, -3.6, 2.5, 2.4, 0.35); st.rect(o.c ?? C.cream, 0.4, 5.1, -2.5, 1.7, 1.3, 0.25);
    st.rect(C.bgBot, 0, 3.5, -3.2, 1.3, 0.9, 0.15);
    for (const wx of [-3.6, 4.2]) { st.circle(0x0E1528, 0, wx, -0.8, 0.82); st.circle(C.slab, 0, wx, -0.8, 0.3); }
    if (o.beams) beams(-1.5, -1.75, o.beams);
    if (o.bricks) brickBlock(-1.5, -1.75, 9, 4);
    ctx.restore();
  }
  function car(x, y, col, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.scale(o.s || 1, o.s || 1);
    st.rect(col, 0.5, -2.3, -1.55, 4.6, 1.05, 0.35); st.rect(col, 0, -1.3, -2.4, 2.5, 1.0, 0.4); st.rect(C.bgBot, 0, -0.95, -2.2, 1.8, 0.6, 0.15);
    for (const wx of [-1.4, 1.4]) st.circle(0x0E1528, 0, wx, -0.5, 0.52);
    ctx.restore();
  }
  function derrick(cam, x, y, ang, drop, load) {
    const lw = Math.max(0.24, px(cam, 2)), tx = x + 13 * S(ang), ty = y - 1 - 13 * Cs(ang);
    st.line(C.line, lw * 1.3, [[x, y], [x, y - 10]]); st.line(C.line, lw, [[x, y - 1], [tx, ty]]); st.line(C.line, lw * 0.5, [[x, y - 10], [tx, ty]], 0.7);
    st.line(C.line, lw * 0.5, [[tx, ty], [tx, ty + drop]], 0.9);
    if (load) load(tx, ty + drop);
    return [tx, ty + drop];
  }
  function hoist(cam, x, yTop, yPlat, load) {
    const lw = Math.max(0.2, px(cam, 1.6));
    st.line(C.line, lw, [[x - 1.6, 9.5], [x - 1.6, yTop]], 0.55); st.line(C.line, lw, [[x + 1.6, 9.5], [x + 1.6, yTop]], 0.55);
    st.rect(C.cream, 0.5, x - 1.5, yPlat - 0.3, 3, 0.3); if (load) load(x, yPlat - 0.3);
  }
  const arcPt = (a, b, u, h) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - 4 * h * u * (1 - u)];
  function hotRivet(cam, a, b, u, h, r = 0.2) {
    for (let k = 5; k >= 0; k--) { const uu = u - k * 0.035; if (uu < 0 || uu > 1) continue; const p = arcPt(a, b, uu, h); st.circle(rgba(C.red, k ? 0.5 * (1 - k / 6) : 1), 0, p[0], p[1], r * (k ? 0.8 : 1)); }
    if (u >= 0 && u <= 1) { const p = arcPt(a, b, u, h); st.circle(rgba(0xFFD0A0, 0.9), 0, p[0], p[1], r * 0.45); }
  }
  function sparks(x, y, t, n = 7, r = 1) { for (let i = 0; i < n; i++) { const a = hash(i + Math.floor(t * 18) * 3) * PI * 2, l = r * (0.4 + hash(i * 5 + Math.floor(t * 18)) * 0.9); st.line(i % 2 ? C.amber : 0xFFE2B0, 0.07 * r + 0.03, [[x + Cs(a) * 0.2 * r, y + S(a) * 0.2 * r], [x + Cs(a) * l, y + S(a) * l]]); } }
  const frameWorkers = (n, cam, count, t, seed = 0) => { for (let i = 0; i < count; i++) { const w = halfW(n - 0.5) - 1.5, x = -w + 2 * w * hash(i * 3 + seed) + 0.8 * S(t * 0.8 + i); worker(x, fy(n), { walk: t * 5 + i, flip: S(t * 0.8 + i + 1.57) < 0 }); } };

  // ================================================================= SHOT 1: HOOK
  function shot1(t, c, d) {
    const h = eseg(t, c.draw, c.stories + 0.1), back = eseg(t, c.how, d - 0.4);
    const top = { x: 0, y: Math.min(-30, SPIRE * h + 34), z: lerp(9.5, 7.5, sseg(h, 0, 0.5)) };
    const cam = mixCam(top, { x: 0, y: -30, z: 9.5 }, back);
    backdrop(cam);
    st.world(cam, () => {
      skyline(cam); ground(cam, { basement: false });
      for (const sx of [-33, 33]) { st.line(C.line, 0.22, [[sx, 0], [sx, -2.4]]); st.paper(C.amber, 0.4, (k) => { k.moveTo(sx, -2.4); k.lineTo(sx + 1.5, -1.95); k.lineTo(sx, -1.5); k.closePath(); }); }
      st.line(C.line, 0.14, [[-33, -1.2], [33, -1.2]], 0.7, [0.9, 0.9]);
      ghost(cam, lerp(1, 0.16, back), Math.max(h, 0.0001) * (t > c.draw ? 1 : 0), sseg(t, c.stories, c.how + 0.5));
      if (h > 0 && h < 1) st.circle(rgba(C.amber, 0.95), 0, 0, SPIRE * h, px(cam, 14));
    });
    const out = 1 - sseg(t, c.draw + 0.1, c.draw + 0.5);
    st.title('1930', 540, 560, 250, C.line, pop(t, c.year, 0.45) * out);
  }
  // ================================================================= SHOT 2: THE STEEL
  function shot2(t, c, d) {
    const cam = mixCam({ x: -35.5, y: -9, z: 28 }, { x: -34.5, y: -11, z: 30 }, smooth(seg(t, 0, d)));
    const cyc = 2.3, k0 = (t - c.order - 0.1) / cyc, done = clamp(Math.floor(k0 + 0.25), 0, 9);
    const liftU = (k) => seg(t, c.order + 0.1 + k * cyc + 0.9, c.order + 0.1 + k * cyc + 2.2);
    const frame = 3 + 0.5 * (done + smooth(seg(liftU(done), 0.75, 1)));
    backdrop(cam);
    st.world(cam, () => {
      skyline(cam); ground(cam); ghost(cam, 0.13);
      building(cam, { frame, slab: 2 });
      frameWorkers(3, cam, 2, t);
      // nowhere to pile it
      const pl = pop(t, c.pile, 0.35) * (1 - sseg(t, c.order - 0.1, c.order + 0.25));
      if (pl > 0.01) { ctx.save(); ctx.translate(-42.5, 0); ctx.scale(pl, pl); for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate((hash(i) - 0.5) * 6, -0.3 - i * 0.42); ctx.rotate((hash(i + 3) - 0.5) * 0.5); st.rect(C.amber, 0.5, -3.6, -0.2, 7.2, 0.36, 0.05); ctx.restore(); } st.line(C.red, 0.3, [[-6.5, 0.6], [6.5, 0.6]], 0.6 + 0.4 * S(t * 12)); st.line(C.red, 0.4, [[-1.6, -7.6], [1.6, -4.4]]); st.line(C.red, 0.4, [[1.6, -7.6], [-1.6, -4.4]]); ctx.restore(); }
      // trucks on a steady beat; the derrick takes the load straight off the bed
      let hook = null;
      for (let k = 0; k < 6; k++) {
        const a = c.order + 0.1 + k * cyc; if (t < a || t > a + 3.4) continue;
        const x = lerp(-80, -44, easeOut(seg(t, a, a + 0.85))) + 50 * easeIn(seg(t, a + 2.3, a + 3.3)), u = liftU(k);
        truck(x, 0, { beams: u > 0.02 ? 0 : 3 });
        if (u > 0.02 && u < 1) hook = u;
      }
      const base = fy(Math.floor(frame)), swing = hook === null ? 0.5 + 0.2 * S(t * 1.3) : lerp(-0.92, 0.75, smooth(seg(hook, 0.42, 0.85)));
      const want = hook === null ? 3 : hook < 0.42 ? lerp(-3.2 - (base - 1 - 13 * Cs(-0.92)), 4, smooth(hook / 0.42)) : lerp(4, 9.6, smooth(seg(hook, 0.8, 1)));
      derrick(cam, -27, base, swing, Math.max(1, want), hook === null ? null : (x, y) => beams(x, y + 1.4, 3));
    });
  }
  // ================================================================= SHOT 3: THE STREET
  function shot3(t, c, d) {
    const cam = mixCam({ x: -16, y: -11, z: 21 }, { x: -3, y: -11, z: 22 }, eseg(t, c.driveway - 0.3, c.driveway + 1.6));
    const open = eseg(t, c.driveway + 0.2, c.driveway + 0.8), flow = Math.max(0, t - c.driveway - 0.7);
    backdrop(cam);
    st.world(cam, () => {
      skyline(cam); ground(cam, { road: true }); ghost(cam, 0.13);
      building(cam, { frame: 7.5, slab: 5 });
      if (open > 0) { st.rect(mixHex(C.basement, 0x5B4A3A, 0.55), 0, -33 * open, -FH + 0.42, 66 * open, FH - 0.42); st.line(C.amber, 0.3, [[-33 * open, -FH + 0.45], [33 * open, -FH + 0.45]]); }
      frameWorkers(5, cam, 3, t);
      // trucks: parked on the street at first, then cycling through the building
      const leave = easeIn(seg(t, c.driveway + 0.5, c.driveway + 1.6));
      for (const [i, x0] of [[0, -21], [1, 4]]) { const x = x0 + 75 * leave; if (x < 60) truck(x, 0, { beams: 3 }); }
      if (flow > 0) for (let k = 0; k < 5; k++) { const a = k * 1.7, u = flow - a; if (u < 0 || u > 4.2) continue; const x = lerp(-70, 0, easeOut(seg(u, 0, 1.2))) + 70 * easeIn(seg(u, 2.2, 3.4)); truck(x, 0, { beams: u > 1.5 ? 0 : 3, s: 0.92 }); if (u > 1.4 && u < 2.3) beams(0, lerp(-2, -22, smooth(seg(u, 1.4, 2.3))), 3); }
      // ground-floor columns in front of whatever is inside
      if (open > 0.5) for (let x = -33; x <= 33.01; x += 6.6) st.rect(C.amber, 0, x - 0.22, -FH, 0.44, FH);
      // traffic
      const jam = sseg(t, c.jam - 0.1, c.jam + 0.3) * (1 - sseg(t, c.driveway + 0.9, c.driveway + 1.5));
      for (let i = 0; i < 7; i++) {
        const arrive = easeOut(seg(t, 0.2 + i * 0.28, 1.5 + i * 0.28)), xq = lerp(-110, -29 - i * 6.2, arrive);
        const x = xq + Math.max(0, t - c.driveway - 0.9 - i * 0.08) * (17 + i);
        if (x > 60) continue;
        car(x, 3.3, mixHex(i % 2 ? 0xD9D2C2 : 0xB9C3D6, C.red, jam), { s: 1.15 });
        if (jam > 0.5 && i < 4) { const b = 0.5 + 0.5 * S(t * 14 + i * 2); for (let r = 0; r < 2; r++) { ctx.beginPath(); ctx.arc(x + 2.9, 1.3, 0.8 + r * 0.7 + 0.3 * b, -0.9, 0.5); ctx.strokeStyle = rgba(C.red, 0.8 - r * 0.3); ctx.lineWidth = 0.18; ctx.stroke(); } }
      }
    });
  }
  // ================================================================= SHOT 4: THE FLOOR
  function shot4(t, c, d) {
    const N = 12, yF = fy(N), cam = mixCam({ x: -19, y: yF - 2.6, z: 42 }, { x: 13.5, y: yF - 2.6, z: 42 }, eseg(t, c.track - 0.2, c.roll + 2.2));
    backdrop(cam);
    st.world(cam, () => {
      ghost(cam, 0.1);
      building(cam, { frame: 16, slab: 15, interior: [N] });
      const platU = (t * 0.45) % 1;
      hoist(cam, -30.2, fy(17), lerp(6, yF, easeOut(seg(platU, 0, 0.45))) - 30 * easeIn(seg(platU, 0.7, 1)), (x, y) => (platU < 0.6 ? beams(x, y, 2, 2.6) : null));
      // the slow way
      const gone = sseg(t, c.track + 0.2, c.track + 0.8);
      if (gone < 1) {
        const x = -24 + 0.75 * t; ctx.save(); ctx.globalAlpha = 1 - gone;
        const warn = sseg(t, c.slow, c.slow + 0.3);
        st.line(C.red, 0.16, [[x + 3.2, yF - 0.9], [24.5, yF - 0.9]], 0.85 * warn, [0.5, 0.6]);
        if (warn > 0) st.paper(rgba(C.red, 0.9 * warn), 0, (k) => { k.moveTo(25.6, yF - 0.9); k.lineTo(24.4, yF - 1.5); k.lineTo(24.4, yF - 0.3); k.closePath(); });
        worker(x, yF, { walk: t * 4, arm: [0.75, -0.8] });
        st.paper(C.cream, 0.4, (k) => { k.moveTo(x + 0.8, yF - 1.05); k.lineTo(x + 2.5, yF - 1.05); k.lineTo(x + 2.2, yF - 0.5); k.lineTo(x + 1.1, yF - 0.5); k.closePath(); });
        st.circle(C.dark, 0, x + 2.3, yF - 0.28, 0.28); brickBlock(x + 1.65, yF - 1.05, 2, 2);
        ctx.restore();
      }
      // track snaps down piece by piece
      for (let i = 0; i < 11; i++) {
        const s = pop(t, c.track + i * 0.13, 0.22); if (s <= 0) continue;
        const x = -26.5 + i * 4.8, dy = -1.6 * (1 - easeOut(seg(t, c.track + i * 0.13, c.track + i * 0.13 + 0.18)));
        for (let k = 0; k < 4; k++) st.rect(C.wood, 0, x + 0.35 + k * 1.2, yF - 0.16 + dy, 0.5, 0.16);
        st.rect(C.line, 0, x, yF - 0.3 + dy, 4.7 * Math.min(1, s), 0.14);
      }
      // carts glide across
      for (let k = 0; k < 7; k++) {
        const a = c.roll + k * 0.95, u = seg(t, a, a + 1.9); if (t < a) continue;
        const x = lerp(-26, 23.5, smooth(u)), un = sseg(t, a + 1.9, a + 2.3);
        if (un < 1) { st.rect(C.dark, 0.5, x - 1.5, yF - 1.0, 3, 0.45, 0.08); for (const wx of [-1, 1]) st.circle(C.line, 0, x + wx, yF - 0.5, 0.24); ctx.save(); ctx.globalAlpha = 1 - un; if (k % 2) brickBlock(x, yF - 1.0, 4, 3); else beams(x, yF - 1.0, 3, 2.8); ctx.restore(); if (u < 1) worker(x - 2.2, yF, { walk: t * 9 + k, arm: [0.75, -1.0] }); }
      }
      worker(22.8, yF, { flip: true, arm: [0.55, -1.25 + 0.15 * S(t * 6)] }); worker(25.2, yF, { flip: true });
      frameWorkers(N + 1, cam, 3, t, 5);
    });
  }
  // ================================================================= SHOT 5: THE BRICKS
  function shot5(t, c, d) {
    const cam = mixCam(mixCam({ x: -41, y: -3.5, z: 26 }, { x: -34, y: -1.5, z: 27 }, eseg(t, c.chute - 0.4, c.chute + 1.2)), { x: -27, y: -7, z: 26 }, sseg(t, c.lift, d));
    const pour = eseg(t, c.chute + 0.3, c.chute + 2.5), pile = sseg(t, c.bricks, c.chute - 0.1) * (1 - pour);
    backdrop(cam);
    st.world(cam, () => {
      skyline(cam); ground(cam); ghost(cam, 0.13);
      const clad = 1 + 3.2 * sseg(t, c.lift + 0.8, d + 1);
      building(cam, { frame: 20, slab: 18, clad, cladBase: 1 });
      // dump truck and the growing pile
      const tx = lerp(-95, -54, easeOut(seg(t, 0.1, c.bricks))) - 60 * easeIn(seg(t, c.chute + 0.2, c.chute + 1.4));
      truck(tx, 0, { bricks: t < c.bricks + 0.2 });
      if (pile > 0.01) { const rows = Math.ceil(26 * pile); for (let r = 0; r < rows; r++) { const half = (rows - r) * 0.36 + 0.6; for (let x = -half; x < half; x += 0.62) { ctx.fillStyle = hex((r + Math.round(x / 0.62)) % 2 ? C.brick : C.brickDark); ctx.fillRect(-44.5 + x + (r % 2) * 0.2, -(r + 1) * 0.32, 0.56, 0.27); } } }
      // chute down to the basement hopper
      const ch = eseg(t, c.chute - 0.05, c.chute + 0.3);
      if (ch > 0) {
        const a = [-39.5, -0.6], b = [lerp(a[0], -28.2, ch), lerp(a[1], 5.0, ch)];
        st.rect(C.basement, 0, -41.5, -0.1, 4.6, 1.3);
        st.paper(C.cream, 0.6, (k) => { k.moveTo(a[0] - 1.2, a[1]); k.lineTo(b[0] - 0.6, b[1] + 0.9); k.lineTo(b[0] + 0.9, b[1]); k.lineTo(a[0] + 1.2, a[1] - 0.9); k.closePath(); });
        st.paper(C.dark, 0.7, (k) => { k.moveTo(-31.5, 4.2); k.lineTo(-22.5, 4.2); k.lineTo(-24.5, 8.8); k.lineTo(-29.5, 8.8); k.closePath(); });
        const fill = pour; if (fill > 0.02) { ctx.save(); ctx.beginPath(); ctx.moveTo(-31.3, 4.4); ctx.lineTo(-22.7, 4.4); ctx.lineTo(-24.6, 8.6); ctx.lineTo(-29.4, 8.6); ctx.closePath(); ctx.clip(); brickBlock(-27, 8.7, 14, Math.ceil(13 * fill)); ctx.restore(); }
        if (pour > 0 && pour < 0.995) for (let i = 0; i < 16; i++) { const u = ((t * 1.7 + i / 16) % 1); const x = lerp(a[0], -27.6, u), y = lerp(a[1] - 0.5, 4.7, u) - 0.25; ctx.save(); ctx.translate(x, y); ctx.rotate(u * 5 + i); ctx.fillStyle = hex(i % 2 ? C.brick : C.brickDark); ctx.fillRect(-0.3, -0.15, 0.6, 0.3); ctx.restore(); }
      }
      // batches ride the hoist only when a floor is ready
      const lu = t > c.lift ? ((t - c.lift) / 1.7) % 1 : -1;
      hoist(cam, -19, fy(21), lu < 0 ? 9.2 : lerp(9.2, -75, easeIn(seg(lu, 0.3, 1))), (x, y) => (lu >= 0.08 ? brickBlock(x, y, 4, 3) : null));
      if (lu >= 0 && lu < 0.3) { const x = lerp(-24.5, -19, smooth(lu / 0.08)); if (lu < 0.08) brickBlock(x, 9.2, 4, 3); }
      for (let i = 0; i < 3; i++) worker(-52 + i * 2.6 - 4 * pile, 0, { flip: i === 1, c: C.line, a: 0.95 });
      if (clad > 1.3) for (let i = 0; i < 2; i++) worker(-30 + i * 9 + S(t + i), fy(Math.floor(clad)) , { walk: t * 4 + i });
    });
  }
  // ================================================================= SHOT 6: THE RIVETS
  function shot6(t, c, d) {
    const lo = 40, yA = fy(lo), yB = fy(lo + 1);
    const out = eseg(t, c.cools + 0.35, d - 0.6);
    const hm = pulse(t, c.hammer, c.hammer + 1.3, 0.08);
    const sh = 0.05 * hm * (1 - out);
    const cam = mixCam({ x: -0.3 + sh * S(t * 95), y: yA - 3.0 + sh * S(t * 121), z: 52 }, { x: 0, y: -128, z: 13 }, out);
    backdrop(cam);
    st.world(cam, () => {
      ghost(cam, 0.1);
      building(cam, { frame: 44, slab: 38, clad: 24 });
      // the gang: heater with forge (left, lower beam), catcher and riveter (right, upper beam)
      const hand = [-5.7, yA - 2.2], can = [2.75, yB - 1.95], joint = [6.5, yB - 0.6];
      st.rect(C.dark, 0.6, -9.3, yA - 1.45, 1.6, 1.0, 0.1); st.line(C.dark, 0.16, [[-9.0, yA - 0.45], [-9.2, yA]]); st.line(C.dark, 0.16, [[-8.0, yA - 0.45], [-7.8, yA]]);
      const glow = 0.5 + 0.5 * sseg(t, c.heat, c.throw);
      st.rect(mixHex(0x7A2A1E, C.red, glow), 0, -9.1, yA - 1.3, 1.2, 0.45, 0.08);
      const thr = seg(t, c.throw, c.throw + 0.72), wind = sseg(t, c.throw - 0.35, c.throw) * (1 - sseg(t, c.throw, c.throw + 0.2));
      worker(-6.6, yA, { arm: [lerp(0.75, 0.2, wind) + 0.6 * sseg(t, c.throw, c.throw + 0.15) * (1 - sseg(t, c.throw + 0.3, c.throw + 0.6)), lerp(-1.7, -1.1, wind)] });
      const caught = t > c.throw + 0.72;
      worker(3.9, yB, { flip: true, arm: [0.82, -1.45 + (caught ? 0.12 * Math.exp(-(t - c.throw - 0.72) * 8) : 0)] });
      st.paper(C.cream, 0.4, (k) => { k.moveTo(can[0] - 0.28, can[1] - 0.3); k.lineTo(can[0] + 0.28, can[1] - 0.3); k.lineTo(can[0] + 0.14, can[1] + 0.25); k.lineTo(can[0] - 0.14, can[1] + 0.25); k.closePath(); });
      worker(8.6, yB, { flip: true, arm: [1.2 + 0.07 * hm * S(t * 80), -0.6] });
      st.rect(C.dark, 0.3, 6.6 + 0.05 * hm * S(t * 80), yB - 0.95, 0.9, 0.34, 0.06);
      // one rivet, start to finish
      if (out < 0.6) {
        if (t < c.throw) { if (t > c.heat - 0.2) st.circle(mixHex(0x7A2A1E, C.red, glow), 0, -8.5, yA - 1.55, 0.18 + 0.03 * S(t * 20)); }
        else if (!caught) hotRivet(cam, hand, [can[0], can[1] - 0.3], thr, 2.6);
        else {
          const mv = eseg(t, c.catch + 0.45, c.hammer - 0.05), p = [lerp(can[0], joint[0], mv), lerp(can[1] - 0.2, joint[1], mv) - 0.5 * S(mv * PI)];
          const cool = sseg(t, c.hammer + 0.2, c.hammer + 1.6);
          st.circle(mixHex(C.red, 0xB58A62, cool), 0, p[0], p[1], 0.2 - 0.05 * cool); if (cool < 0.3) st.circle(rgba(0xFFD0A0, 0.9 * (1 - cool * 3)), 0, p[0], p[1], 0.09);
          if (t < c.throw + 0.95) sparks(can[0], can[1] - 0.3, t, 5, 0.6);
          if (hm > 0.3) sparks(joint[0], joint[1], t, 8, 1.1);
        }
      }
      // ...and dozens more, all over the frame
      if (out > 0.02) {
        ctx.save(); ctx.globalAlpha = sseg(out, 0.05, 0.45);
        for (let i = 0; i < 30; i++) {
          const n = 25 + Math.floor(hash(i) * 18), w = halfW(n) - 2, x0 = -w + hash(i + 11) * 2 * w, dx = (hash(i + 23) > 0.5 ? 1 : -1) * (5 + hash(i + 31) * 6), x1 = clamp(x0 + dx, -w, w);
          const per = 1.3 + hash(i + 5) * 0.9, u = ((t + hash(i + 77) * 3) % per) / 0.6;
          worker(x0, fy(n), { s: 1.25, flip: dx < 0 }); worker(x1, fy(n + 1), { s: 1.25, flip: dx > 0 });
          if (u <= 1) hotRivet(cam, [x0, fy(n) - 2], [x1, fy(n + 1) - 2], u, 3.2, 0.42); else if (u < 1.35) sparks(x1, fy(n + 1) - 1.6, t + i, 5, 1.5);
        }
        ctx.restore();
      }
    });
  }
  // ================================================================= SHOT 7: THE LUNCH
  function shot7(t, c, d) {
    const N = 38, yF = fy(N), push = eseg(t, c.cafe + 0.05, c.cafe + 1.0);
    const cam = mixCam(mixCam({ x: 12, y: -150, z: 12 }, { x: 14, y: -62, z: 10.5 }, eseg(t, c.up, c.cafe - 0.2)), { x: 1.5, y: yF - 2.8, z: 44 }, push);
    backdrop(cam);
    st.world(cam, () => {
      skyline(cam); ground(cam); ghost(cam, 0.12);
      building(cam, { frame: 46, slab: 42, clad: 27, interior: push > 0.3 ? [N] : null });
      for (const n of [43, 44, 45, 46]) frameWorkers(n, cam, 4, t, n);
      // the long way down, in red
      const line = sseg(t, c.ground - 0.4, c.ground + 0.2) * (1 - sseg(t, c.cafe, c.cafe + 0.5));
      if (line > 0.01) {
        const lx = 25; ctx.save(); ctx.globalAlpha = line;
        st.line(C.red, 0.5, [[lx, fy(44)], [lx, 0]], 0.9, [1.6, 1.4]);
        for (let i = 0; i < 16; i++) { const u = ((t * 0.16 + i / 16) % 1); worker(lx, lerp(fy(44), 0, u) + 2, { s: 2.3, c: C.red, walk: t * 7 + i }); }
        st.rect(C.red, 0.6, lx + 6, -5.5, 9, 5.5, 0.4); st.paper(C.cream, 0.5, (k) => { k.moveTo(lx + 4.5, -5.5); k.lineTo(lx + 16.5, -5.5); k.lineTo(lx + 15, -8.2); k.lineTo(lx + 6, -8.2); k.closePath(); });
        ctx.restore();
      }
      // so lunch comes up to them
      const s = pop(t, c.cafe + 0.85, 0.4);
      if (s > 0.001) {
        ctx.save(); ctx.translate(1.5, yF); ctx.scale(s, s);
        st.rect(C.wood, 0.7, -3.2, -1.25, 6.4, 1.25, 0.08); st.rect(C.cream, 0.4, -3.4, -1.42, 6.8, 0.2, 0.05);
        st.line(C.line, 0.1, [[-3.1, -1.4], [-3.1, -3.0]]); st.line(C.line, 0.1, [[3.1, -1.4], [3.1, -3.0]]);
        for (let k = 0; k < 8; k++) st.paper(k % 2 ? C.amber : C.cream, k === 0 ? 0.6 : 0, (q) => { q.moveTo(-3.6 + k * 0.9, -3.0); q.lineTo(-2.7 + k * 0.9, -3.0); q.lineTo(-2.8 + k * 0.9, -2.45); q.lineTo(-3.5 + k * 0.9, -2.45); q.closePath(); });
        st.rect(C.slab, 0.3, -2.4, -2.25, 0.7, 0.85, 0.1); for (const cx of [-0.8, 0.2, 1.2, 2.2]) st.rect(C.line, 0, cx, -1.72, 0.3, 0.3, 0.04);
        for (let k = 0; k < 3; k++) { const u = (t * 0.7 + k / 3) % 1; st.circle(rgba(C.line, 0.5 * (1 - u)), 0, -2.05 + 0.2 * S(u * 6 + k), -2.4 - u * 0.9, 0.1 + u * 0.14); }
        ctx.restore();
        const e = sseg(t, c.cafe + 1.1, c.cafe + 1.8);
        worker(-0.6, yF, { flip: true, a: s, arm: [0.5, -1.3] });
        for (const [i, x] of [[0, -6.2], [1, -8.0], [2, 6.6], [3, 8.6], [4, 10.6]]) { const sx = lerp(x + (x < 0 ? -9 : 9), x, e); worker(sx, yF - (e >= 1 ? 0.0 : 0), { sit: e >= 1 && i !== 2, walk: e < 1 ? t * 8 + i : null, flip: x > 0, a: s, arm: [0.5, -1.2 + 0.15 * S(t * 3 + i)] }); if (e >= 1) st.rect(C.dark, 0, sx + (x > 0 ? -0.9 : 0.5), yF - 0.5, 0.45, 0.5, 0.08); }
      }
    });
  }
  // ================================================================= SHOT 8: THE PACE
  function shot8(t, c, d) {
    const F = lerp(28, 86, eseg(t, 0.1, d - 0.2)), cam = { x: 0, y: fy(F) + 24, z: 10.5 };
    backdrop(cam);
    st.world(cam, () => {
      skyline(cam); ground(cam); ghost(cam, 0.14);
      building(cam, { frame: F, slab: F - 3, clad: Math.max(0, F - 13) });
      const fl = Math.floor(F), w = halfW(fl - 0.5), flash = 1 - seg(F - fl, 0, 0.35);
      if (flash > 0) st.line(0xFFE2B0, 0.9, [[-w, fy(fl)], [w, fy(fl)]], flash);
      for (const [dx, ph] of [[-0.55, 0], [0.55, 2]]) derrick(cam, dx * w, fy(fl), 0.7 * S(t * 2.4 + ph), 5 + 3 * S(t * 3.1 + ph), (x, y) => beams(x, y + 1.3, 2, 5));
      for (const [sx, ph] of [[-1, 0], [1, 0.5]]) { const u = (t * 0.9 + ph) % 1; hoist(cam, sx * (halfW(Math.max(0, F - 20)) + 4), fy(F - 2), lerp(fy(F - 45), fy(F - 3), smooth(u)), (x, y) => brickBlock(x, y, 4, 3, 1.6)); }
      for (let i = 0; i < 22; i++) {
        const n = Math.floor(F) - 2 - Math.floor(hash(i) * 9), ww = halfW(n) - 1.5, x0 = -ww + hash(i + 11) * 2 * ww, x1 = clamp(x0 + (hash(i + 23) > 0.5 ? 6 : -6), -ww, ww);
        if (n < 1) continue; const u = ((t + hash(i + 77) * 3) % 1.2) / 0.5;
        worker(x0, fy(n), { s: 1.5 }); if (u <= 1) hotRivet(cam, [x0, fy(n) - 2], [x1, fy(n + 1) - 2], u, 3, 0.5); else if (u < 1.3) sparks(x1, fy(n + 1) - 1.6, t + i, 4, 1.6);
      }
      for (let i = 0; i < 6; i++) worker(-w + 2 + (2 * w - 4) * hash(i + 3) + S(t * 2 + i), fy(fl), { s: 1.6, walk: t * 8 + i, flip: i % 2 });
    });
    st.title('3,400', 540, 300, 230, C.amber, pop(t, c.people, 0.45));
  }
  // ================================================================= SHOT 9: THE TOP
  const WIDE = { x: 0, y: -196, z: 2.5 };
  function shot9(t, c, d) {
    const cam = mixCam({ x: 0, y: -412, z: 9.5 }, WIDE, eseg(t, c.done + 0.35, c.tallest + 1.7));
    const dawn = sseg(t, c.done, c.tallest + 1.5);
    backdrop(cam, { dawn });
    st.world(cam, () => {
      skyline(cam); ground(cam, { basement: false });
      building(cam, { frame: TOP, slab: TOP, clad: TOP });
      const drop = 34 * (1 - easeOut(seg(t, 0.1, c.done + 0.2)));
      if (drop > 0.05) st.line(C.line, 0.2, [[0, SPIRE - drop - 30], [0, SPIRE - drop]], 0.8);
      spire(-drop);
      const fl = pulse(t, c.done + 0.2, c.done + 0.75, 0.1); if (fl > 0) { st.circle(rgba(0xFFE2B0, 0.8 * fl), 0, 0, fy(TOP), 3 + 5 * fl); sparks(0, fy(TOP), t, 9, 4); }
      if (drop > 0.05) for (const x of [-3.2, 3.2]) worker(x, fy(TOP), { s: 1.3, flip: x > 0, arm: [0.6, -1.9] });
    });
    const s = pop(t, c.done + 0.55, 0.45);
    st.title('410', 262, 600, 190, C.amber, s); st.title('DAYS', 262, 740, 92, C.line, pop(t, c.done + 0.7, 0.4));
  }
  // ================================================================= SHOT 10: THE ENDING
  const KEEP = [31, 9];                                             // the one window the camera settles on
  function shot10(t, c, d) {
    const u = smooth(seg(t, 0.3, d - 0.8));
    const wx = -(Math.floor((2 * 20 - 1.6) / 2.6) * 2.6 - 1.3) / 2 + KEEP[1] * 2.6 + 0.65;
    const cam = mixCam(WIDE, { x: wx, y: fy(KEEP[0]) - 1.9, z: 15 }, u * u);
    const night = sseg(t, 0, 1.2);
    backdrop(cam, { dawn: 1 - night, night });
    const lit = (n, j) => {
      const on = sseg(t, 0.5 + n * 0.012 + hash(n * 31 + j) * 0.35, 0.75 + n * 0.012 + hash(n * 31 + j) * 0.35);
      const stays = (n === KEEP[0] && j === KEEP[1]) || hash(n * 17 + j * 7.3) < (n < 34 ? 0.2 : 0.035);
      const off = stays ? 0 : sseg(t, c.dark + hash(n * 5 + j * 3) * 3.2, c.dark + 0.25 + hash(n * 5 + j * 3) * 3.2);
      return on * (1 - off);
    };
    st.world(cam, () => {
      skyline(cam, { lit: 0.8 * night }); ground(cam, { basement: false });
      building(cam, { frame: TOP, slab: TOP, clad: TOP, lit });
      spire(0);
      if (night > 0) { ctx.fillStyle = rgba(0x070C1C, 0.36 * night); const [x0, y0, x1, y1] = st.view(cam); ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
      // relight the windows on top of the night wash so they glow
      const [, y0, , y1] = st.view(cam);
      for (let n = Math.max(0, Math.floor(-y1 / FH)); n < Math.min(86, Math.ceil(-y0 / FH)); n++) { const w = halfW(n + 0.5), cols = Math.floor((2 * w - 1.6) / 2.6), xs = -(cols * 2.6 - 1.3) / 2; for (let j = 0; j < cols; j++) { const k = lit(n, j); if (k > 0.02) { ctx.fillStyle = rgba(0xFFC873, k); ctx.fillRect(xs + j * 2.6, fy(n) - 2.9, 1.3, 2.0); } } }
    });
    st.overlay.fade = sseg(t, c.fade + 0.2, c.fade + 1.5);
  }
  const SHOTS = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8, shot9, shot10];
  return { update(shot, t) { st.begin(); st.overlay.fade = 0; SHOTS[shot.id - 1](t, shot.cues, shot.duration); } };
}
