// Cek kartu stamp digital, voucher, skor Challenge, dan status pesanan dengan nomor WhatsApp: GET /api/poin?wa=08...
// Hanya menampilkan data yang aman (nama disamarkan, tanpa alamat dan nomor).
import { json, fail, normalWA } from './lib/util.mjs';
import { pesananDariWA, publikPelanggan } from './lib/poin.mjs';

export const config = { path: '/api/poin' };

export default async (req) => {
  if (req.method !== 'GET') return fail('Metode tidak didukung.', 405);
  const wa = normalWA(new URL(req.url).searchParams.get('wa'));
  if (!wa) return fail('Tulis nomor WhatsApp yang dipakai saat pesan, misalnya 0812 3456 7890.');
  const d = await pesananDariWA(wa);
  return json(publikPelanggan(d));
};
