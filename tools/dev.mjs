// npm run dev  –  chạy app + máy chủ AI (api/) trên máy, dùng khóa trong file .env.
// Giống bản Vercel nhưng ở http://127.0.0.1:8095 (localStorage riêng, không lẫn với serve.py cổng 8090).
// Micro dùng được vì 127.0.0.1 được trình duyệt coi là an toàn. Dừng: Ctrl + C.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, loadEnv } from './_env.mjs';

loadEnv();
const APP = path.join(ROOT, 'app');
const args = process.argv.slice(2);
let port = +(args[args.indexOf('--port') + 1] || 0) || 8095;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const api = {};
for (const f of fs.readdirSync(path.join(ROOT, 'api'))) if (/^[^_].*\.js$/.test(f)) api[f.slice(0, -3)] = await import(pathToFileURL(path.join(ROOT, 'api', f)).href);

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (u.pathname.startsWith('/api/')) {
      const m = api[u.pathname.slice(5).replace(/\/$/, '')], h = m && m[req.method];
      if (!h) { res.writeHead(404); res.end('{"error":"Không có API này"}'); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      const t = Date.now();
      const out = await h(new Request('http://' + req.headers.host + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
      const buf = Buffer.from(await out.arrayBuffer());
      if (u.pathname !== '/api/health') console.log(`${new Date().toLocaleTimeString('vi-VN')}  ${req.method} ${u.pathname} → ${out.status}  ${Date.now() - t} ms${out.status >= 400 ? '  ' + buf.toString().slice(0, 200) : ''}`);
      res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(buf); return;
    }
    let file = path.join(APP, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!file.startsWith(APP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
    let data = fs.readFileSync(file);
    // Báo cho app biết có máy chủ AI cùng địa chỉ → mặc định dùng "AI của app" như bản Vercel
    if (file.endsWith('index.html')) data = Buffer.from(data.toString('utf8').replace('<head>', '<head><script>window.VM_APP_API = true;</script>'));
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e.message || e)); }
});

const { summary } = await import(pathToFileURL(path.join(ROOT, 'api', '_providers.js')).href);
function listen() {
  server.once('error', e => { if (e.code === 'EADDRINUSE' && port < 8115) { console.log(`Cổng ${port} đang bận, thử ${port + 1}…`); port++; listen(); } else throw e; });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`, s = summary();
    console.log('='.repeat(64));
    console.log(' Vinmec Pharmacy Hub + AI (chế độ dev, đọc khóa từ .env)');
    console.log('   Mở: ' + url);
    for (const [id, p] of Object.entries(s.providers)) console.log(`   ${p.ready ? '✓' : '·'} ${p.label.padEnd(28)} ${p.ready ? `OCR: ${p.ocr.join(', ') || '—'} · giọng nói: ${p.stt.join(', ') || '—'}` : 'chưa có khóa'}`);
    console.log(`   Mặc định: OCR → ${s.defaults.ocr || 'KHÔNG CÓ'}, giọng nói → ${s.defaults.stt || 'KHÔNG CÓ'}`);
    console.log(' Dừng: Ctrl + C');
    console.log('='.repeat(64));
    if (!args.includes('--no-open')) exec((process.platform === 'win32' ? 'start "" ' : process.platform === 'darwin' ? 'open ' : 'xdg-open ') + url);
  });
}
listen();
