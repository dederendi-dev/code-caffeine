import crypto from 'node:crypto';

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
export const fail = (msg, status = 400) => json({ error: msg }, status);
export async function body(req) { try { return await req.json(); } catch (e) { return {}; } }
export const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// 0812-3456-7890, +62 812..., 62812... -> 081234567890. Kosong kalau tidak valid.
export function normalWA(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  else if (d.startsWith('8')) d = '0' + d;
  return /^08\d{8,12}$/.test(d) ? d : '';
}

const ALFA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const kodeBaru = () => 'CC' + Array.from(crypto.randomBytes(5)).map(b => ALFA[b % ALFA.length]).join('');
export const tokenBaru = () => crypto.randomBytes(18).toString('base64url');
export const samaAman = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
export const rupiah = n => 'Rp' + Number(n).toLocaleString('id-ID');

// Cari pemilik kunci di env berformat "Nama:kunci,Nama2:kunci2" (ADMIN_KEYS, MASTER_KEYS). Kunci minimal 16 karakter.
export function pemilikKunci(envName, kunci) {
  if (!kunci) return null;
  for (const pair of String(process.env[envName] || '').split(',')) {
    const i = pair.lastIndexOf(':');
    if (i < 1) continue;
    const nama = pair.slice(0, i).trim(), k = pair.slice(i + 1).trim();
    if (k.length >= 16 && samaAman(k, kunci)) return nama;
  }
  return null;
}
