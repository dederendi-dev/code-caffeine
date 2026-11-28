// Server uji lokal: menyajikan public/ dan menjalankan fungsi /api/challenge/* dan /api/admin/*
// tanpa Netlify. Data disimpan di .local-data/ (bukan Netlify Blobs), notifikasi dicatat ke push-log.json.
//   npm run dev                      -> http://localhost:8888
//   admin: /admin/#k=kunci-uji-lokal-1234567890   master: /master/#k=kunci-master-lokal-1234567890
//   PORT=8777 npm run dev
// Khusus uji: GET /__test/time?offset=<ms> menggeser jam server (untuk menguji batas waktu).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
process.env.CC_LOCAL_DATA ||= path.join(root, '.local-data');
process.env.ADMIN_KEYS ||= 'Penguji:kunci-uji-lokal-1234567890';
process.env.MASTER_KEYS ||= 'Master:kunci-master-lokal-1234567890';
process.env.VAPID_PUBLIC_KEY ||= '';

const realNow = Date.now.bind(Date);
let offset = 0;
Date.now = () => realNow() + offset;

const challenge = (await import(path.join(root, 'netlify/functions/challenge.mjs'))).default;
const admin = (await import(path.join(root, 'netlify/functions/admin.mjs'))).default;
const master = (await import(path.join(root, 'netlify/functions/master.mjs'))).default;
const order = (await import(path.join(root, 'netlify/functions/order.mjs'))).default;
const configFn = (await import(path.join(root, 'netlify/functions/config.mjs'))).default;
const foto = (await import(path.join(root, 'netlify/functions/foto.mjs'))).default;
const poin = (await import(path.join(root, 'netlify/functions/poin.mjs'))).default;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

async function toFn(fn, req, res, url) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const r = await fn(new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/__test/time') {
      offset = Number(url.searchParams.get('offset')) || 0;
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ offset })); return;
    }
    if (url.pathname.startsWith('/api/challenge/')) return await toFn(challenge, req, res, url);
    if (url.pathname.startsWith('/api/admin/')) return await toFn(admin, req, res, url);
    if (url.pathname.startsWith('/api/master/')) return await toFn(master, req, res, url);
    if (url.pathname === '/api/order') return await toFn(order, req, res, url);
    if (url.pathname === '/api/poin') return await toFn(poin, req, res, url);
    if (url.pathname === '/assets/js/config.js') return await toFn(configFn, req, res, url);
    if (url.pathname.startsWith('/foto/')) return await toFn(foto, req, res, url);
    let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = path.join(pub, p);
    if (!file.startsWith(pub)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Tidak ditemukan'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(err.message || err) }));
  }
}).listen(Number(process.env.PORT) || 8888, () => console.log(`Code Caffeine lokal: http://localhost:${Number(process.env.PORT) || 8888}`));
