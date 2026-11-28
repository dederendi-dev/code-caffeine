// API admin: /api/admin/<aksi>. Masuk dengan link rahasia per anggota (env ADMIN_KEYS = "Nama:kunci,Nama2:kunci2").
import { store, update } from './lib/store.mjs';
import { json, fail, body, str, rupiah } from './lib/util.mjs';
import { simpanLangganan, kirimNotif } from './lib/push.mjs';
import { KEY, kedaluwarsa, hadiahTeks } from './lib/pesanan.mjs';
import { imporForms, semuaWeb } from './lib/web.mjs';
import { terapkan, LABEL } from './lib/alur.mjs';
import { siapaAdmin } from './lib/adminkey.mjs';
import { getConfig } from './lib/katalog.mjs';

export const config = { path: '/api/admin/*' };

const siapa = kunci => siapaAdmin(kunci);

export default async (req) => {
  const url = new URL(req.url);
  const aksi = url.pathname.split('/').pop();

  // Manifest untuk "Tambah ke Layar Utama" (iPhone perlu ini untuk notifikasi). Kunci ikut di start_url.
  if (aksi === 'manifest') {
    const k = url.searchParams.get('k') || '';
    if (!(await siapa(k))) return fail('Link admin tidak valid.', 401);
    return new Response(JSON.stringify({
      id: '/admin/', name: 'Admin Code Caffeine', short_name: 'CC Admin', lang: 'id',
      description: 'Kelola semua pesanan Code Caffeine bersama tim.',
      start_url: '/admin/?k=' + encodeURIComponent(k), scope: '/admin/',
      display: 'standalone', orientation: 'portrait', background_color: '#16100c', theme_color: '#16100c',
      icons: [
        { src: '/admin/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/admin/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/admin/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    }), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'no-store' } });
  }

  const admin = await siapa(req.headers.get('x-admin-key'));
  if (!admin) return fail('Link admin tidak valid.', 401);
  const st = store('challenge');

  if (req.method === 'GET' && aksi === 'pesanan') {
    const { blobs } = await st.list({ prefix: 'pesanan/' });
    const all = (await Promise.all(blobs.map(async b => {
      let p = await st.get(b.key, { type: 'json' });
      if (p && kedaluwarsa(p)) p = (await update(st, b.key, cur => kedaluwarsa(cur))).data || p;
      return p;
    }))).filter(p => p && !p.dihapus_at).map(p => { const { token, ...rest } = p; return { ...rest, hadiah: hadiahTeks(p) }; });
    all.sort((a, b) => Date.parse(b.dibuat) - Date.parse(a.dibuat));
    const sw = store('web');
    await imporForms(sw);
    const web = (await semuaWeb(sw)).filter(p => !p.dihapus_at).sort((a, b) => Date.parse(b.dibuat) - Date.parse(a.dibuat));
    const C = await getConfig();
    return json({ admin, pesanan: all, web, pembayaran: C.pembayaran, vapid: process.env.VAPID_PUBLIC_KEY || '' });
  }

  if (req.method !== 'POST') return fail('Metode tidak didukung.', 405);
  const b = await body(req);
  const t = new Date().toISOString();

  // Semua aksi admin (dua jenis pesanan) lewat satu aturan di lib/alur.mjs. Admin lain langsung dikabari.
  if (aksi === 'aksi') {
    const web = b.jenis === 'web';
    const id = String(web ? b.id : (b.kode || b.id) || '');
    if (web ? !/^[A-Za-z0-9_-]{4,48}$/.test(id) : !/^CC[A-Z0-9]{5}$/.test(id)) return fail('Pesanan tidak dikenal.');
    if (!LABEL[b.aksi]) return fail('Aksi tidak dikenal.');
    const s = web ? store('web') : st, k = web ? 'web/' + id : KEY(id);
    const r = await update(s, k, cur => terapkan(cur, web ? 'web' : 'challenge', b.aksi, admin, str(b.alasan, 120)));
    if (r.notFound) return fail('Pesanan tidak ditemukan.', 404);
    if (r.error) return fail(r.error, r.code || 409);
    const p = r.data;
    if (!r.unchanged) {
      const harga = rupiah(web ? p.total : p.harga);
      const judul = {
        terima: `${p.nama} diterima ${admin}`, lunas: `${p.nama} lunas (${harga})`, antar: `${p.nama} ${p.cara_terima === 'Diantar' ? 'sedang diantar' : 'siap diambil'}`,
        diantar: `${p.nama} selesai`, batal: `${p.nama} dibatalkan`, ambil_alih: `${p.nama} diambil alih ${admin}`, wa: `${p.nama} sedang di-WA ${admin}`
      }[b.aksi] || `${p.nama} ${LABEL[b.aksi]}`;
      const isi = {
        terima: `${admin} yang menghubungi dan mengantar pesanan ini.`, ambil_alih: `Sebelumnya ditangani ${p.pj_sebelumnya}. Sekarang ${admin} yang menghubungi dan mengantar.`,
        batal: `Oleh ${admin}${p.alasan_batal ? ': ' + p.alasan_batal : ''}.`
      }[b.aksi] || `Oleh ${admin}.`;
      await kirimNotif({ title: judul, body: `${isi} ${p.kode}`, tag: p.kode, kecuali: admin });
    }
    if (web) return json(p);
    const { token, ...rest } = p;
    return json({ ...rest, hadiah: hadiahTeks(p) });
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
