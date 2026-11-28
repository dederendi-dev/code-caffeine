// API admin: /api/admin/<aksi>. Masuk dengan link rahasia per anggota (env ADMIN_KEYS = "Nama:kunci,Nama2:kunci2").
import { store, update } from './lib/store.mjs';
import { json, fail, body, samaAman, str } from './lib/util.mjs';
import { simpanLangganan, kirimNotif } from './lib/push.mjs';
import { KEY, kedaluwarsa, hadiahTeks } from './lib/pesanan.mjs';

export const config = { path: '/api/admin/*' };

function siapa(kunci) {
  if (!kunci) return null;
  for (const pair of String(process.env.ADMIN_KEYS || '').split(',')) {
    const i = pair.lastIndexOf(':');
    if (i < 1) continue;
    const nama = pair.slice(0, i).trim(), k = pair.slice(i + 1).trim();
    if (k.length >= 16 && samaAman(k, kunci)) return nama;
  }
  return null;
}

const ALUR = {
  lunas: { dari: ['menunggu_bayar', 'cek_admin'], ke: 'lunas', ev: 'ditandai lunas' },
  belum_lunas: { dari: ['lunas'], ke: 'cek_admin', ev: 'lunas dibatalkan (belum main)' },
  batal: { dari: ['menunggu_bayar', 'cek_admin', 'lunas'], ke: 'batal', ev: 'dibatalkan admin' },
  diantar: { dari: ['lunas', 'main', 'selesai'], ev: 'sudah diantar' },
  belum_diantar: { dari: ['lunas', 'main', 'selesai'], ev: 'batal tandai diantar' }
};

export default async (req) => {
  const url = new URL(req.url);
  const aksi = url.pathname.split('/').pop();

  // Manifest untuk "Tambah ke Layar Utama" (iPhone perlu ini untuk notifikasi). Kunci ikut di start_url.
  if (aksi === 'manifest') {
    const k = url.searchParams.get('k') || '';
    if (!siapa(k)) return fail('Link admin tidak valid.', 401);
    return new Response(JSON.stringify({
      id: '/admin/', name: 'Admin Code Caffeine', short_name: 'CC Admin', lang: 'id',
      description: 'Cek transfer dan kelola pesanan paket Caffeine Challenge.',
      start_url: '/admin/?k=' + encodeURIComponent(k), scope: '/admin/',
      display: 'standalone', orientation: 'portrait', background_color: '#16100c', theme_color: '#16100c',
      icons: [
        { src: '/admin/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/admin/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/admin/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    }), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'no-store' } });
  }

  const admin = siapa(req.headers.get('x-admin-key'));
  if (!admin) return fail('Link admin tidak valid.', 401);
  const st = store('challenge');

  if (req.method === 'GET' && aksi === 'pesanan') {
    const { blobs } = await st.list({ prefix: 'pesanan/' });
    const all = (await Promise.all(blobs.map(async b => {
      let p = await st.get(b.key, { type: 'json' });
      if (p && kedaluwarsa(p)) p = (await update(st, b.key, cur => kedaluwarsa(cur))).data || p;
      return p;
    }))).filter(Boolean).map(p => { const { token, ...rest } = p; return { ...rest, hadiah: hadiahTeks(p) }; });
    all.sort((a, b) => Date.parse(b.dibuat) - Date.parse(a.dibuat));
    return json({ admin, pesanan: all, vapid: process.env.VAPID_PUBLIC_KEY || '' });
  }

  if (req.method !== 'POST') return fail('Metode tidak didukung.', 405);
  const b = await body(req);
  const t = new Date().toISOString();

  if (aksi === 'aksi') {
    const a = ALUR[b.aksi];
    if (!a || !/^CC[A-Z0-9]{5}$/.test(b.kode || '')) return fail('Aksi tidak dikenal.');
    const r = await update(st, KEY(b.kode), cur => {
      if (!a.dari.includes(cur.status)) return { error: `Pesanan berstatus "${cur.status}", aksi ini tidak bisa dilakukan.` };
      const next = { ...cur, riwayat: [...cur.riwayat, { t, ev: a.ev, oleh: admin }] };
      if (a.ke) next.status = a.ke;
      if (b.aksi === 'lunas') { next.lunas_at = t; next.lunas_oleh = admin; }
      if (b.aksi === 'belum_lunas') { delete next.lunas_at; delete next.lunas_oleh; }
      if (b.aksi === 'batal') next.alasan_batal = str(b.alasan, 120) || 'Dibatalkan admin';
      if (b.aksi === 'diantar') { next.diantar = true; next.diantar_oleh = admin; next.diantar_at = t; }
      if (b.aksi === 'belum_diantar') { next.diantar = false; delete next.diantar_oleh; delete next.diantar_at; }
      return next;
    });
    if (r.notFound) return fail('Pesanan tidak ditemukan.', 404);
    if (r.error) return fail(r.error, r.code || 409);
    const { token, ...rest } = r.data;
    return json({ ...rest, hadiah: hadiahTeks(r.data) });
  }

  if (aksi === 'langganan') {
    const sub = b.subscription;
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys) return fail('Data notifikasi tidak valid.');
    await simpanLangganan(sub, admin);
    return json({ ok: true });
  }

  if (aksi === 'tes-notif') {
    const r = await kirimNotif({ title: 'Tes notifikasi Code Caffeine', body: `Dikirim oleh ${admin}. Notifikasi pesanan sudah aktif.`, tag: 'tes' });
    return json(r);
  }

  return fail('Aksi tidak dikenal.', 404);
};
