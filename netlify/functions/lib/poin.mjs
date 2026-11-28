// Kartu stamp digital & voucher, dihitung dari semua pesanan dengan nomor WhatsApp yang sama.
// Aturan (sama dengan yang tertulis di web):
// - Setiap pesanan yang SELESAI (sudah diantar/diambil, tidak batal) = 1 cap, berapa pun jumlah cup-nya.
// - Caffeine Challenge skor 1.800–2.999 = +1 cap tambahan.
// - 5 cap = 1 cup Small gratis. Cap dipakai saat pesanan yang menukarnya dibuat (kecuali pesanan itu batal).
// - Caffeine Challenge skor di bawah 1.800 = 1 voucher Rp1.000, dipakai di pesanan berikutnya.
import { store } from './store.mjs';
import { normalWA } from './util.mjs';
import { hadiahTeks } from './pesanan.mjs';

export const CAP_GRATIS = 5;

async function semua(st, prefix) {
  const { blobs } = await st.list({ prefix });
  return (await Promise.all(blobs.map(b => st.get(b.key, { type: 'json' })))).filter(Boolean);
}

export async function pesananDariWA(wa) {
  const [web, ch] = await Promise.all([semua(store('web'), 'web/'), semua(store('challenge'), 'pesanan/')]);
  const cocok = p => !p.dihapus_at && normalWA(p.wa) === wa;
  return { web: web.filter(cocok), challenge: ch.filter(cocok) };
}

export function hitung({ web, challenge }, kecualiKode) {
  const aktif = p => (p.status || 'baru') !== 'batal' && p.kode !== kecualiKode;
  let capDapat = 0, capPakai = 0, capMenunggu = 0, vDapat = 0, vPakai = 0;
  for (const p of web.filter(aktif)) {
    if (p.diantar) capDapat++; else capMenunggu++;
    // penukaran yang ditandai server "belum cukup" tidak mengurangi saldo (admin akan menagih harga normal)
    if (p.tukar_stamp && !(p.stamp_cek && !p.stamp_cek.cukup)) capPakai += CAP_GRATIS;
    if (p.pakai_voucher && !(p.voucher_cek && !p.voucher_cek.cukup)) vPakai++;
  }
  for (const p of challenge.filter(aktif)) {
    if (p.status === 'menunggu_bayar') continue;
    if (p.diantar) capDapat++; else capMenunggu++;
    if (p.status === 'selesai' && p.tier === 'cap') capDapat++;
    if (p.status === 'selesai' && p.tier === 'voucher') vDapat++;
  }
  const capSisa = Math.max(0, capDapat - capPakai);
  return {
    cap: { dapat: capDapat, dipakai: capPakai, sisa: capSisa, gratis: Math.floor(capSisa / CAP_GRATIS), progres: capSisa % CAP_GRATIS, menunggu: capMenunggu },
    voucher: { dapat: vDapat, dipakai: vPakai, sisa: Math.max(0, vDapat - vPakai) }
  };
}

const samarkan = nama => String(nama || '').trim().split(/\s+/).slice(0, 2)
  .map((w, i) => i === 0 ? w.slice(0, 3) + (w.length > 3 ? '***' : '') : w[0] + '.').join(' ');

function statusWeb(p) {
  const s = p.status || 'baru';
  if (s === 'batal') return 'Batal';
  if (p.diantar) return 'Selesai';
  if (p.antar_at) return p.cara_terima === 'Diantar' ? 'Sedang diantar' : 'Siap diambil';
  return s === 'baru' ? 'Menunggu konfirmasi' : 'Diproses';
}
function statusCh(p) {
  if (p.status === 'batal') return 'Batal';
  if (p.diantar) return 'Selesai';
  return { menunggu_bayar: 'Menunggu transfer', cek_admin: 'Transfer sedang dicek', lunas: 'Lunas, belum main', main: 'Sedang main', selesai: p.antar_at ? 'Sedang diantar' : 'Diproses' }[p.status] || p.status;
}

// Data yang aman ditampilkan ke siapa pun yang tahu nomor WA-nya: tanpa alamat, tanpa nomor lengkap.
export function publikPelanggan(d) {
  const semuaP = [...d.web.map(p => ({ ...p, jenis: 'web' })), ...d.challenge.map(p => ({ ...p, jenis: 'challenge' }))]
    .sort((a, b) => Date.parse(b.dibuat) - Date.parse(a.dibuat));
  const main = d.challenge.filter(p => p.status === 'selesai' && p.skor != null);
  return {
    ada: semuaP.length > 0,
    nama: semuaP.length ? samarkan(semuaP[0].nama) : '',
    ...hitung(d),
    challenge: {
      main: main.length,
      terbaik: main.reduce((m, p) => Math.max(m, p.skor || 0), 0),
      hasil: main.sort((a, b) => Date.parse(b.selesai_at || b.dibuat) - Date.parse(a.selesai_at || a.dibuat)).slice(0, 5)
        .map(p => ({ kode: p.kode, skor: p.skor, hadiah: hadiahTeks(p), t: p.selesai_at || p.dibuat }))
    },
    pesanan: semuaP.slice(0, 10).map(p => ({
      kode: p.kode, jenis: p.jenis, t: p.dibuat, untuk: p.jenis === 'web' ? p.untuk_hari : p.untuk,
      isi: p.jenis === 'web' ? p.pesanan : `${p.menuNama} (paket Caffeine Challenge)`,
      total: p.jenis === 'web' ? p.total : p.harga,
      status: p.jenis === 'web' ? statusWeb(p) : statusCh(p)
    }))
  };
}
