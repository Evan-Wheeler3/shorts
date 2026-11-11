#!/usr/bin/env node
// Headless renderer: drives the three.js scene in Chromium frame by frame and streams
// JPEG frames straight into ffmpeg (no frame sequence is written to disk).
//   node shared/renderer/render.mjs <video> [--shots all|3,7] [--scale 0.5] [--workers N] [--no-ao]
//                                   [--stills f1,f2,..] [--stills-dir dir] [--png]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const vid = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const flag = (k) => args.includes('--' + k);
const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'videos', vid, 'output/shotlist.retimed.json')));
const scale = parseFloat(opt('scale', '1'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/shared/renderer/player.html?video=${vid}&scale=${scale}&ao=${flag('no-ao') ? 0 : 1}`;

// Software GL only where there is no GPU (Linux servers); on macOS Chromium uses Metal.
const glArgs = process.platform === 'linux' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist', '--enable-gpu'];
const browser = await chromium.launch({ args: glArgs });
async function openPage() {
  const page = await browser.newPage({ viewport: { width: Math.round(list.width * scale), height: Math.round(list.height * scale) } });
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => { console.error('[page]', e.message); process.exit(1); });
  await page.goto(url);
  await page.waitForFunction('window.ready || window.failed', null, { timeout: 120000 });
  const failed = await page.evaluate('window.failed');
  if (failed) throw new Error(failed);
  return page;
}
const buf = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

try {
  if (opt('stills')) {
    const dir = opt('stills-dir', path.join(ROOT, 'videos', vid, 'build/stills'));
    fs.mkdirSync(dir, { recursive: true });
    const page = await openPage();
    for (const f of opt('stills').split(',').map(Number)) {
      const png = flag('png');
      const d = await page.evaluate(([f, png]) => window.grab(f, png ? 'image/png' : 'image/jpeg', 0.92), [f, png]);
      fs.writeFileSync(path.join(dir, `f${String(f).padStart(5, '0')}.${png ? 'png' : 'jpg'}`), buf(d));
    }
    console.log('stills ->', dir);
  } else {
    // Each shot is rendered to its own file (build/shots/shot_NN.mp4) and the files are then
    // joined, so a single shot can be re-rendered with --shots 7 without redoing the rest.
    const dir = path.join(ROOT, 'videos', vid, 'build/shots');
    fs.mkdirSync(dir, { recursive: true });
    const out = opt('out', path.join(ROOT, 'videos', vid, 'build/picture.mp4'));
    const workers = Math.max(1, parseInt(opt('workers', '1')));
    const want = opt('shots', 'all');
    const ids = want === 'all' ? list.shots.map((s) => s.id) : want.split(',').map(Number);
    const shotFile = (id) => path.join(dir, `shot_${String(id).padStart(2, '0')}.mp4`);
    const run = (cmd, a) => new Promise((r, j) => spawn(cmd, a, { stdio: ['ignore', 'inherit', 'inherit'] }).on('close', (c) => (c ? j(new Error(cmd + ' failed')) : r())));
    const pages = await Promise.all([...Array(workers)].map(openPage));
    const total = list.shots.filter((s) => ids.includes(s.id)).reduce((n, s) => n + s.frames, 0);
    let done = 0; const t0 = Date.now();
    const tick = setInterval(() => { const el = (Date.now() - t0) / 1000; process.stderr.write(`  ${done}/${total} frames  ${(done / el).toFixed(2)} fps  eta ${Math.round((total - done) / Math.max(done / el, 1e-6))}s\n`); }, 30000);
    for (const s of list.shots) {
      if (!ids.includes(s.id)) continue;
      const a = s.start_frame, b = s.start_frame + s.frames - 1, per = Math.ceil(s.frames / workers), parts = [];
      await Promise.all(pages.map(async (page, w) => {
        const fa = a + w * per, fb = Math.min(b, fa + per - 1);
        if (fa > fb) return;
        const part = shotFile(s.id).replace(/\.mp4$/, `.part${w}.mp4`); parts[w] = part;
        const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(list.fps), '-i', '-',
          '-vf', `scale=${list.width}:${list.height}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', part], { stdio: ['pipe', 'inherit', 'inherit'] });
        for (let f = fa; f <= fb; f++) {
          const d = await page.evaluate((f) => window.grab(f), f);
          if (!ff.stdin.write(buf(d))) await new Promise((r) => ff.stdin.once('drain', r));
          done++;
        }
        ff.stdin.end();
        await new Promise((r, j) => ff.on('close', (c) => (c ? j(new Error('ffmpeg failed')) : r())));
      }));
      const lst = shotFile(s.id) + '.txt';
      fs.writeFileSync(lst, parts.filter(Boolean).map((p) => `file '${p}'`).join('\n'));
      await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', shotFile(s.id)]);
      for (const p of [...parts.filter(Boolean), lst]) fs.unlinkSync(p);
      console.log(`shot ${s.id} (${s.frames} frames) -> ${path.relative(ROOT, shotFile(s.id))}`);
    }
    clearInterval(tick);
    const missing = list.shots.filter((s) => !fs.existsSync(shotFile(s.id))).map((s) => s.id);
    if (missing.length) console.log(`not joining yet: shots ${missing.join(',')} have not been rendered`);
    else {
      const lst = out + '.txt';
      fs.writeFileSync(lst, list.shots.map((s) => `file '${shotFile(s.id)}'`).join('\n'));
      await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', out]);
      fs.unlinkSync(lst);
      console.log(`picture -> ${path.relative(ROOT, out)} (${total} frames rendered in ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }
} finally {
  await browser.close(); server.close();
}
