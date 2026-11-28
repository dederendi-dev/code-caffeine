// Service worker halaman admin: menampilkan notifikasi pesanan dan membuka halaman admin saat diketuk.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

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
