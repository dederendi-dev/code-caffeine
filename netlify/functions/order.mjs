// Pesanan web biasa (tunai/transfer). Dikirim web di belakang layar saat pembeli menekan "Kirim ke WhatsApp",
// lalu masuk ke CC Admin (status baru -> diproses -> lunas/diantar) dan semua admin dapat notifikasi.
// Total dihitung ulang dari harga di server. Kode pesanan (W + 5 karakter) dibuat web dan ikut di chat WA.
import { store } from './lib/store.mjs';
import { json, fail, str, normalWA, rupiah } from './lib/util.mjs';
import { kirimNotif } from './lib/push.mjs';
import { getConfig } from './lib/katalog.mjs';
import { pesananDariWA, hitung, CAP_GRATIS } from './lib/poin.mjs';
import { openEvent, nowWIB } from './lib/jadwal.mjs';
import crypto from 'node:crypto';

export const config = { path: '/api/order' };
const VOUCHER = 1000;

// Batas wajar per alamat IP (Wi-Fi kampus dipakai bersama, jadi longgar): 30 pesanan per 10 menit
async function terlaluSering(req, context) {
  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'lokal';
  const k = `rl/${crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 16)}/${Math.floor(Date.now() / 600000)}`;
  const st = store('web');
  const n = (await st.get(k, { type: 'json' })) || 0;
  if (n >= 30) return true;
  await st.setJSON(k, n + 1);
  return false;
}

export default async (req, context) => {
  if (req.method !== 'POST') return fail('Metode tidak didukung.', 405);
  let b = {};
  try { b = JSON.parse(await req.text()); } catch (e) { return fail('Data tidak valid.'); }
  if (b['bot-field']) return json({ ok: true });                       // jebakan bot
  const kode = str(b.kode, 6).toUpperCase();
  if (!/^W[A-Z0-9]{5}$/.test(kode)) return fail('Data tidak valid.');
  const nama = str(b.nama, 60), wa = normalWA(b.wa);
  if (!nama || !wa) return fail('Nama dan nomor WhatsApp wajib.');
  const raw = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
  if (!raw.length) return fail('Pesanan kosong.');

  if (await terlaluSering(req, context)) return fail('Terlalu banyak pesanan dari jaringan ini. Coba lagi beberapa menit lagi.', 429);
  const C = await getConfig();
  const ukuran = Object.fromEntries(C.ukuran.map(u => [u.id, u]));
  const items = [];
  for (const i of raw) {
    const m = C.menu.find(x => x.id === i.id), u = ukuran[i.size], qty = Math.min(50, Math.max(0, Math.floor(Number(i.qty) || 0)));
    if (!m || !u || !qty) continue;
    items.push({ id: m.id, nama: m.nama, ukuran: u.id, qty, harga: m.harga[u.id] });
  }
  if (!items.length) return fail('Pesanan kosong.');
  const subtotal = items.reduce((a, i) => a + i.qty * i.harga, 0);
  const lama = b.pernah_beli === 'Sudah';
  const small = items.filter(i => i.ukuran === 'S').sort((x, y) => y.harga - x.harga)[0];
  const potStamp = lama && b.tukar_stamp && small ? small.harga : 0;
  const potVoucher = lama && b.pakai_voucher ? Math.min(VOUCHER, subtotal - potStamp) : 0;
  const cara = b.cara_terima === 'Ambil sendiri' ? 'Ambil sendiri' : 'Diantar';

  const p = {
    id: kode, kode, jenis: 'web', status: 'baru', lunas: false, diantar: false, dibuat: new Date().toISOString(),
    nama, wa, items,
    pesanan: items.map(i => `${i.qty}x ${i.nama} ${C.ukuran.find(u => u.id === i.ukuran).nama}`).join('; '),
    jumlah_cup: items.reduce((a, i) => a + i.qty, 0),
    subtotal, potongan_stamp: potStamp, potongan_voucher: potVoucher, total: subtotal - potStamp - potVoucher,
    total_klien: Number(b.total) || null,
    cara_terima: cara, lokasi: cara === 'Diantar' ? str(b.lokasi, 120) : `Ambil sendiri di ${C.lokasiAmbil}`,
    jam: str(b.jam, 40), bayar: str(b.bayar, 20), pernah_beli: lama ? 'Sudah' : 'Belum',
    tukar_stamp: !!potStamp, stamp_gratis: potStamp ? `${small.nama} Small` : '', pakai_voucher: !!potVoucher,
    sumber: str(b.sumber, 30), catatan: str(b.catatan, 200), untuk_hari: str(b.untuk_hari, 60), untuk_ms: Number(b.untuk_ms) || null
  };
  // Pemeriksaan otomatis untuk admin (pesanan tetap dicatat karena pembeli sudah dikirim ke WhatsApp)
  const cek = [];
  if (!openEvent(nowWIB(), C)) { p.di_luar_po = true; cek.push('di luar jadwal pre-order'); }
  if (p.total_klien != null && p.total_klien !== p.total) { p.total_beda = p.total_klien; cek.push(`total di WA ${p.total_klien} beda dengan hitungan server ${p.total}`); }
  if (p.tukar_stamp || p.pakai_voucher) {
    const h = hitung(await pesananDariWA(wa), kode);
    if (p.tukar_stamp) { p.stamp_cek = { sisa: h.cap.sisa, cukup: h.cap.sisa >= CAP_GRATIS }; if (!p.stamp_cek.cukup) cek.push(`cap belum cukup (${h.cap.sisa}/${CAP_GRATIS})`); }
    if (p.pakai_voucher) { p.voucher_cek = { sisa: h.voucher.sisa, cukup: h.voucher.sisa >= 1 }; if (!p.voucher_cek.cukup) cek.push('tidak punya voucher Challenge'); }
  }
  p.riwayat = [{ t: p.dibuat, ev: 'masuk dari web' + (cek.length ? ' (perlu dicek: ' + cek.join('; ') + ')' : '') }];
  const r = await store('web').setJSON('web/' + kode, p, { onlyIfNew: true });   // kiriman ganda dengan kode sama diabaikan
  if (r.modified) {
    await kirimNotif({
      title: `Pesanan baru ${rupiah(p.total)} · ${p.nama}`,
      body: `${p.pesanan} · ${p.cara_terima === 'Diantar' ? 'antar ke ' + p.lokasi : 'ambil sendiri'} · ${p.jam} · ${p.bayar} · ${kode}`,
      tag: kode
    });
  }
  return json({ ok: true, kode }, 201);
};
