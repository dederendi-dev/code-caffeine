// Pesanan web biasa (tunai/transfer): impor data lama Netlify Forms dan alur status untuk CC Admin.
import { normalWA } from './util.mjs';

// Data pesanan lama dari Netlify Forms (sekali impor, lewat env IMPOR_FORMS berisi JSON).
// Setiap id ditandai 'impor/<id>' supaya tidak dimasukkan lagi walau sudah dihapus permanen.
export async function imporForms(st) {
  let list = [];
  try { list = JSON.parse(process.env.IMPOR_FORMS || '[]'); } catch (e) { return; }
  for (const f of list) {
    if (!f || !/^[a-f0-9]{24}$/.test(f.id || '')) continue;
    if (await st.get('impor/' + f.id)) continue;
    const d = f.data || {};
    await st.setJSON('web/f-' + f.id, {
      id: 'f-' + f.id, kode: 'F' + f.id.slice(-5).toUpperCase(), jenis: 'web', status: 'baru', lunas: false, diantar: false,
      dibuat: f.created_at, dari_forms: true, riwayat: [{ t: f.created_at, ev: 'masuk dari web (data lama Netlify Forms)' }],
      nama: d.nama || '(tanpa nama)', wa: normalWA(d.wa) || d.wa || '', items: [], pesanan: d.pesanan || '',
      jumlah_cup: Number(d.jumlah_cup) || 0, total: Number(d.total) || 0, subtotal: null,
      cara_terima: d.cara_terima || '', lokasi: d.lokasi || '', jam: d.jam || '', bayar: d.bayar || '',
      pernah_beli: d.pernah_beli || '', stamp_gratis: d.stamp_gratis || '', pakai_voucher: !!d.pakai_voucher,
      sumber: d.sumber || '', catatan: d.catatan || '', untuk_hari: d.untuk_hari || ''
    }, { onlyIfNew: true });
    await st.setJSON('impor/' + f.id, { t: new Date().toISOString() });
  }
}

export async function semuaWeb(st) {
  const { blobs } = await st.list({ prefix: 'web/' });
  return (await Promise.all(blobs.map(b => st.get(b.key, { type: 'json' })))).filter(Boolean);
}

// Alur pesanan web di CC Admin. Mengembalikan objek baru, atau { error }.
export function aksiWeb(cur, aksi, admin, alasan) {
  const t = new Date().toISOString(), st = cur.status || 'baru';
  const log = ev => [...(cur.riwayat || []), { t, ev, oleh: admin }];
  const tolak = { error: `Pesanan berstatus "${st}", aksi ini tidak bisa dilakukan.` };
  switch (aksi) {
    case 'terima':
      if (st !== 'baru') return tolak;
      return { ...cur, status: 'diproses', diterima_oleh: admin, diterima_at: t, riwayat: log('pesanan diterima') };
    case 'lunas':
      if (!['baru', 'diproses'].includes(st) || cur.lunas) return tolak;
      return { ...cur, status: 'diproses', lunas: true, lunas_oleh: admin, lunas_at: t, riwayat: log('ditandai lunas') };
    case 'belum_lunas':
      if (!cur.lunas || st === 'batal') return tolak;
      return { ...cur, lunas: false, lunas_oleh: undefined, lunas_at: undefined, riwayat: log('lunas dibatalkan') };
    case 'diantar':
      if (st !== 'diproses' || cur.diantar) return tolak;
      return { ...cur, diantar: true, diantar_oleh: admin, diantar_at: t, riwayat: log('sudah diantar') };
    case 'belum_diantar':
      if (!cur.diantar) return tolak;
      return { ...cur, diantar: false, diantar_oleh: undefined, diantar_at: undefined, riwayat: log('batal tandai diantar') };
    case 'batal':
      if (!['baru', 'diproses'].includes(st) || cur.diantar) return tolak;
      return { ...cur, status: 'batal', alasan_batal: alasan || 'Dibatalkan admin', riwayat: log('dibatalkan') };
    case 'aktifkan':
      if (st !== 'batal') return tolak;
      return { ...cur, status: 'baru', alasan_batal: undefined, riwayat: log('diaktifkan lagi') };
    default:
      return { error: 'Aksi tidak dikenal.' };
  }
}
