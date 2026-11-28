// API master admin (khusus pemilik kunci di env MASTER_KEYS): /api/master/<aksi>
// - data pembeli: pesanan web + paket Challenge, tempat sampah (hapus, pulihkan, hapus permanen)
// - pengaturan toko: menu, harga, foto, jadwal, pembayaran, pengumuman
import crypto from 'node:crypto';
import { purgeCache } from '@netlify/functions';
import { store, update } from './lib/store.mjs';
import { json, fail, body, pemilikKunci } from './lib/util.mjs';
import { imporForms } from './lib/web.mjs';
import { KEY, kedaluwarsa, hadiahTeks } from './lib/pesanan.mjs';
import { bacaOverride, gabung, validasi, simpanConfig, hapusOverride } from './lib/katalog.mjs';

export const config = { path: '/api/master/*' };

const JENIS = {
  web: { store: 'web', key: id => 'web/' + id, ok: id => /^[A-Za-z0-9_-]{4,48}$/.test(id) },
  challenge: { store: 'challenge', key: id => KEY(id), ok: id => /^CC[A-Z0-9]{5}$/.test(id) }
};

async function bersihkanCache() {
  if (process.env.CC_LOCAL_DATA) return;
  try { await purgeCache({ tags: ['config'] }); } catch (e) { console.error('purgeCache gagal:', e.message); }
}

async function semua(st, prefix) {
  const { blobs } = await st.list({ prefix });
  return (await Promise.all(blobs.map(b => st.get(b.key, { type: 'json' })))).filter(Boolean);
}

export default async (req) => {
  const url = new URL(req.url);
  const aksi = url.pathname.split('/').pop();
  const admin = pemilikKunci('MASTER_KEYS', req.headers.get('x-master-key'));
  if (!admin) return fail('Link master admin tidak valid.', 401);
  const t = new Date().toISOString();

  /* ---------- data pembeli ---------- */
  if (req.method === 'GET' && aksi === 'data') {
    const sw = store('web'), sc = store('challenge');
    await imporForms(sw);
    const web = await semua(sw, 'web/');
    const ch = await Promise.all((await sc.list({ prefix: 'pesanan/' })).blobs.map(async b => {
      let p = await sc.get(b.key, { type: 'json' });
      if (p && !p.dihapus_at && kedaluwarsa(p)) p = (await update(sc, b.key, cur => kedaluwarsa(cur))).data || p;
      return p;
    }));
    const challenge = ch.filter(Boolean).map(p => { const { token, ...rest } = p; return { ...rest, jenis: 'challenge', id: p.kode, hadiah: hadiahTeks(p) }; });
    return json({ admin, web, challenge });
  }

  if (req.method === 'GET' && aksi === 'katalog') {
    const o = await bacaOverride();
    return json({ admin, config: gabung(o && o.config), diubah: o ? { at: o.diubah_at, oleh: o.diubah_oleh } : null });
  }

  if (req.method !== 'POST') return fail('Metode tidak didukung.', 405);

  /* ---------- foto menu (badan permintaan = gambar mentah) ---------- */
  if (aksi === 'foto') {
    const type = (req.headers.get('content-type') || '').split(';')[0].trim();
    const ext = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }[type];
    if (!ext) return fail('Format foto harus PNG, WebP, atau JPG.');
    const buf = Buffer.from(await req.arrayBuffer());
    if (!buf.length || buf.length > 2.5 * 1024 * 1024) return fail('Ukuran foto maksimal 2,5 MB.');
    const name = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) + '.' + ext;
    await store('foto').set(name, buf, { metadata: { type, oleh: admin, t } });
    return json({ url: '/foto/' + name });
  }

  const b = await body(req);

  /* ---------- tempat sampah ---------- */
  if (['hapus', 'pulihkan', 'hapus-permanen'].includes(aksi)) {
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 300).filter(i => JENIS[i.jenis] && JENIS[i.jenis].ok(String(i.id)));
    if (!items.length) return fail('Pilih data dulu.');
    let n = 0;
    for (const i of items) {
      const J = JENIS[i.jenis], st = store(J.store), k = J.key(String(i.id));
      if (aksi === 'hapus-permanen') {
        const cur = await st.get(k, { type: 'json' });
        if (cur && cur.dihapus_at) { await st.delete(k); n++; }
        continue;
      }
      const r = await update(st, k, cur => aksi === 'hapus'
        ? (cur.dihapus_at ? null : { ...cur, dihapus_at: t, dihapus_oleh: admin })
        : (!cur.dihapus_at ? null : (({ dihapus_at, dihapus_oleh, ...rest }) => rest)(cur)));
      if (r.data && !r.unchanged) n++;
    }
    return json({ ok: true, jumlah: n });
  }

  /* ---------- pengaturan toko ---------- */
  if (aksi === 'katalog') {
    const v = validasi(b.config);
    if (v.error) return fail(v.error);
    await simpanConfig(v.config, admin);
    await bersihkanCache();
    return json({ ok: true, config: gabung(v.config), diubah: { at: t, oleh: admin } });
  }
  if (aksi === 'katalog-reset') {
    await hapusOverride();
    await bersihkanCache();
    return json({ ok: true, config: gabung(null), diubah: null });
  }

  return fail('Aksi tidak dikenal.', 404);
};
