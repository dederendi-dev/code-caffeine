// Kunci link CC Admin. Dasar dari env ADMIN_KEYS ("Nama:kunci,..."). Master admin bisa membuat link baru,
// mencabut, atau mengaktifkan lagi akses seseorang TANPA deploy ulang: perubahannya disimpan di Netlify Blobs
// (store 'pengaturan', kunci 'admin'), hanya hash kuncinya yang disimpan.
//   { [nama]: { hash: sha256(kunci) | null, aktif: boolean, diubah_at, diubah_oleh } }
import crypto from 'node:crypto';
import { store } from './store.mjs';
import { pemilikKunci, samaAman } from './util.mjs';

const KEY = 'admin';
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
let cache = null, cacheAt = 0;

export async function bacaAdmin({ segar } = {}) {
  if (!segar && cache && Date.now() - cacheAt < 10000) return cache;
  try { cache = (await store('pengaturan').get(KEY, { type: 'json' })) || {}; } catch (e) { cache = {}; }
  cacheAt = Date.now();
  return cache;
}
async function simpan(data) { await store('pengaturan').setJSON(KEY, data); cache = data; cacheAt = Date.now(); }

export async function siapaAdmin(kunci) {
  if (!kunci || String(kunci).length < 16) return null;
  const over = await bacaAdmin(), h = sha(kunci);
  for (const [nama, o] of Object.entries(over)) if (o && o.aktif !== false && o.hash && samaAman(o.hash, h)) return nama;
  const nama = pemilikKunci('ADMIN_KEYS', kunci);
  if (!nama) return null;
  const o = over[nama];
  if (o && (o.aktif === false || o.hash)) return null;      // dicabut, atau sudah diganti link baru
  return nama;
}

const dariEnv = () => String(process.env.ADMIN_KEYS || '').split(',').map(x => x.slice(0, x.lastIndexOf(':')).trim()).filter(Boolean);

export async function daftarAdmin() {
  const over = await bacaAdmin({ segar: true });
  const nama = [...new Set([...dariEnv(), ...Object.keys(over)])];
  return nama.map(n => ({
    nama: n, aktif: !(over[n] && over[n].aktif === false),
    sumber: over[n] && over[n].hash ? 'link dari master admin' : 'link awal',
    diubah_at: over[n] ? over[n].diubah_at : null, diubah_oleh: over[n] ? over[n].diubah_oleh : null
  }));
}

export async function linkBaru(nama, oleh) {
  const over = { ...(await bacaAdmin({ segar: true })) };
  const kunci = crypto.randomBytes(18).toString('base64url');
  over[nama] = { hash: sha(kunci), aktif: true, diubah_at: new Date().toISOString(), diubah_oleh: oleh };
  await simpan(over);
  return kunci;
}

export async function aturAktif(nama, aktif, oleh) {
  const over = { ...(await bacaAdmin({ segar: true })) };
  over[nama] = { ...(over[nama] || { hash: null }), aktif, diubah_at: new Date().toISOString(), diubah_oleh: oleh };
  await simpan(over);
}
