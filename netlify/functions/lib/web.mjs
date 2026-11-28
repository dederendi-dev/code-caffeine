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
