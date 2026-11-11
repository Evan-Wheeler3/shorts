// 2D stage: a Canvas2D "paper cutaway" renderer with the same contract as the 3D stage
// (video.update draws the frame, overlay.step adds the STEP label, render() finishes it).
// World space: x right, y DOWN (heights are negative), in arbitrary units; cam = {x, y, z}
// puts world point (x, y) at 41% of the frame height at z pixels per unit.
import { PAL, pop, clamp, sseg, lerp } from './core.js';

export const hex = (n) => '#' + n.toString(16).padStart(6, '0');
export const rgba = (n, a) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
export function mixHex(a, b, t) { const c = (s) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, clamp(t))); return (c(16) << 16) | (c(8) << 8) | c(0); }

export async function createStage2D({ canvas, W, H, scale = 1 }) {
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d');
  await new FontFace('Montserrat Black', 'url(/shared/fonts/Montserrat-Black.ttf)').load().then((f) => document.fonts.add(f));
  let cur = null;
  const st = {
    ctx, W, H, scale, is2d: true, CY: 0.41,
    begin() { ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.globalAlpha = 1; ctx.shadowColor = 'transparent'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; },
    // run fn in world space
    world(cam, fn) { ctx.save(); ctx.translate(W / 2, H * st.CY); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y); fn(); ctx.restore(); },
    toScreen(cam, x, y) { return [W / 2 + (x - cam.x) * cam.z, H * st.CY + (y - cam.y) * cam.z]; },
    // visible world rectangle [x0, y0, x1, y1]
    view(cam) { return [cam.x - W / 2 / cam.z, cam.y - H * st.CY / cam.z, cam.x + W / 2 / cam.z, cam.y + H * (1 - st.CY) / cam.z]; },
    // paper layer: filled path with a soft drop shadow (depth 0 = flat)
    paper(fill, depth, path) {
      ctx.save();
      if (depth > 0) { ctx.shadowColor = 'rgba(3,7,18,0.5)'; ctx.shadowBlur = 16 * depth * scale; ctx.shadowOffsetX = 4 * depth * scale; ctx.shadowOffsetY = 7 * depth * scale; }
      ctx.fillStyle = typeof fill === 'number' ? hex(fill) : fill; ctx.beginPath(); path(ctx); ctx.fill(); ctx.restore();
    },
    rect(fill, depth, x, y, w, h, r = 0) { st.paper(fill, depth, (c) => (r ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h))); },
    line(color, width, pts, alpha = 1, dash = null) {
      ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = typeof color === 'number' ? hex(color) : color; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.restore();
    },
    circle(fill, depth, x, y, r) { st.paper(fill, depth, (c) => c.arc(x, y, r, 0, Math.PI * 2)); },
    // big pop-in number / word in screen pixels, centred
    title(str, x, y, size, color, s, o = {}) {
      if (s <= 0.001) return;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(o.rot || 0);
      ctx.font = `${size}px "Montserrat Black"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(3,7,18,0.55)'; ctx.shadowBlur = 22 * scale; ctx.shadowOffsetY = 10 * scale;
      ctx.strokeStyle = '#0D1424'; ctx.lineWidth = size * 0.16; ctx.strokeText(str, 0, 0);
      ctx.shadowColor = 'transparent'; ctx.fillStyle = typeof color === 'number' ? hex(color) : color; ctx.fillText(str, 0, 0); ctx.restore();
    },
    overlay: { fade: 0, step(shot, t) { cur = { shot, t }; } },
    render() {
      st.begin();
      if (cur && cur.shot.step) {
        const { shot, t } = cur, s = 0.8 * pop(t, 0.12, 0.4) * (1 - sseg(t, shot.duration - 0.25, shot.duration - 0.05));
        if (s > 0.001) {
          ctx.save(); ctx.translate(60, 170); ctx.scale(s, s); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
          ctx.font = '64px "Montserrat Black"'; const lab = `STEP ${shot.step}`, w = ctx.measureText(lab).width;
          ctx.fillStyle = '#F2A65A'; ctx.beginPath(); ctx.roundRect(8, 10, w + 64, 104, 22); ctx.fill();
          ctx.fillStyle = '#141C30'; ctx.fillText(lab, 40, 66);
          ctx.font = '104px "Montserrat Black"'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0D1424'; ctx.lineWidth = 20; ctx.strokeText(shot.name, 12, 206);
          ctx.fillStyle = '#F1EDE2'; ctx.fillText(shot.name, 12, 206); ctx.restore();
        }
      }
      if (st.overlay.fade > 0.002) { ctx.fillStyle = `rgba(0,0,0,${clamp(st.overlay.fade)})`; ctx.fillRect(0, 0, W, H); }
    },
  };
  return st;
}
