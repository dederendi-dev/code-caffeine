// Aturan pesanan Caffeine Challenge yang dipakai API pembeli dan admin.
import C from '../../../public/assets/js/config.js';
import SIM from '../../../public/main/sim.js';
import { tanggal, jamMs } from './jadwal.mjs';
import { rupiah } from './util.mjs';

export { C, SIM };
export const KEY = kode => 'pesanan/' + kode;
export const BATAS_BAYAR = 60 * 60 * 1000;      // pesanan tanpa konfirmasi transfer batal sendiri setelah 1 jam
export const BATAS_MAIN = 15 * 60 * 1000;       // menekan MULAI tapi tidak mengirim hasil: dianggap skor 0

export function hadiahTeks(p) {
  if (!p.tier) return '';
  if (p.tier === 'large') return `${p.menuNama} Large (upgrade dari Medium)`;
  if (p.tier === 'cap') return `${p.menuNama} Medium + 1 cap kartu stamp`;
  return `${p.menuNama} Medium + voucher Rp1.000 untuk pesanan berikutnya`;
}

// Perbaiki status yang kedaluwarsa. Mengembalikan objek baru kalau ada perubahan, null kalau tidak.
export function kedaluwarsa(p, now = Date.now()) {
  if (p.status === 'menunggu_bayar' && now - Date.parse(p.dibuat) > BATAS_BAYAR) {
    return { ...p, status: 'batal', alasan_batal: 'Tidak ada konfirmasi transfer dalam 1 jam', riwayat: [...p.riwayat, { t: new Date(now).toISOString(), ev: 'batal otomatis' }] };
  }
  if (p.status === 'main' && now - Date.parse(p.mulai_at) > BATAS_MAIN) {
    return { ...p, status: 'selesai', skor: 0, tier: 'voucher', tidak_selesai: true, selesai_at: new Date(now).toISOString(),
      riwayat: [...p.riwayat, { t: new Date(now).toISOString(), ev: 'tidak mengirim hasil, skor 0' }] };
  }
  return null;
}

export function publik(p) {
  return {
    kode: p.kode, status: p.status, nama: p.nama, menu: p.menu, menuNama: p.menuNama, harga: p.harga, hargaTeks: rupiah(p.harga),
    untuk: p.untuk, cara_terima: p.cara_terima, lokasi: p.lokasi, jam: p.jam, bayar_ke: p.bayar_ke,
    dibuat: p.dibuat, sudah_bayar_at: p.sudah_bayar_at || null, lunas_at: p.lunas_at || null,
    skor: p.skor ?? null, tier: p.tier || null, hadiah: hadiahTeks(p), tidak_selesai: !!p.tidak_selesai,
    alasan_batal: p.alasan_batal || null, diantar: !!p.diantar
  };
}

export const ringkas = p => `${p.nama} · ${p.menuNama} · ${p.untuk}${p.jam ? ' ' + p.jam : ''}`;
export const labelHari = ev => tanggal(ev.day);
export const jamAntar = ev => `${jamMs(ev.mulai)}–${jamMs(ev.selesai)}`;
