// Service worker halaman admin: menampilkan notifikasi pesanan dan membuka halaman admin saat diketuk.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Halaman admin selalu diambil dari internet (data pesanan harus terbaru). Kalau HP sedang offline,
// tampilkan pesan singkat, bukan halaman error browser.
const OFFLINE = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline · CC Admin</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#16100c;color:#f5ecdf;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:22px;margin:0 0 8px">Tidak ada koneksi</h1><p style="margin:0 0 18px;opacity:.7">Daftar pesanan perlu internet. Nyalakan data atau Wi-Fi, lalu coba lagi.</p>
<button onclick="location.reload()" style="font:inherit;font-weight:600;padding:10px 20px;border-radius:999px;border:0;background:#f3e9da;color:#1a100a">Coba lagi</button></div></body></html>`;
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { 'content-type': 'text/html; charset=utf-8' } })));
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Code Caffeine', {
      body: d.body || 'Ada pembaruan pesanan.',
      tag: d.tag || 'pesanan',
      renotify: true,
      icon: '/apple-touch-icon.png',
      badge: '/favicon.png',
      data: { url: d.url || '/admin/' }
    });
    // halaman admin yang sedang terbuka langsung memuat ulang daftar
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    list.forEach(c => c.postMessage({ type: 'refresh' }));
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/admin/';
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (new URL(c.url).pathname.startsWith('/admin')) { c.postMessage({ type: 'refresh' }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
