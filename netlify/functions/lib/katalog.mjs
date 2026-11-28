// Pengaturan toko (menu, harga, foto, jadwal, pembayaran, pengumuman) yang bisa diubah dari master admin.
// Dasar: public/assets/js/config.js (ikut git). Perubahan dari master admin disimpan di Netlify Blobs
// (store 'pengaturan', kunci 'config') dan menimpa dasar. Tanpa perubahan, web memakai file dasar.
import BASE from '../../../public/assets/js/config.js';
import { store } from './store.mjs';

const KEY = 'config';
let cache = null, cacheAt = 0;

export const dasar = () => structuredClone(BASE);

export function gabung(over) {
  const c = dasar();
  if (!over) return c;
  for (const k of EDITABLE) if (over[k] !== undefined) c[k] = structuredClone(over[k]);
  return c;
}

export async function bacaOverride() {
  try { return await store('pengaturan').get(KEY, { type: 'json' }); } catch (e) { return null; }
}

// Dipakai semua fungsi. Disimpan sebentar di memori supaya tidak membaca Blobs di setiap permintaan.
export async function getConfig({ segar } = {}) {
  if (!segar && cache && Date.now() - cacheAt < 10000) return cache;
  const o = await bacaOverride();
  cache = gabung(o && o.config); cacheAt = Date.now();
  return cache;
}

export async function simpanConfig(config, oleh) {
  await store('pengaturan').setJSON(KEY, { config, diubah_at: new Date().toISOString(), diubah_oleh: oleh });
  cache = null;
}
export async function hapusOverride() { await store('pengaturan').delete(KEY); cache = null; }

/* ---------------- validasi isian master admin ---------------- */
const EDITABLE = ['whatsapp', 'whatsappAdmin', 'instagram', 'tiktok', 'statusManual', 'hariJual', 'preorder', 'serahTerima',
  'slotSerahTerima', 'jadwalKhusus', 'pembayaran', 'areaAntar', 'lokasiAmbil', 'menu'];

const JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
const TGL = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TGLJAM = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):[0-5]\d$/;
const FOTO = /^\/(foto\/[a-f0-9]{16}\.(webp|png|jpg)|assets\/img\/menu\/[a-z0-9-]+\.webp)$/;
const teks = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

export function validasi(raw) {
  const c = {}, salah = msg => ({ error: msg });
  if (!raw || typeof raw !== 'object') return salah('Data pengaturan kosong.');

  const wa = v => String(v || '').replace(/\D/g, '').replace(/^0/, '62');
  c.whatsapp = wa(raw.whatsapp);
  if (c.whatsapp && !/^62\d{8,13}$/.test(c.whatsapp)) return salah('Nomor WhatsApp pesanan tidak valid. Contoh: 085604504216.');
  c.whatsappAdmin = wa(raw.whatsappAdmin);
  if (c.whatsappAdmin && !/^62\d{8,13}$/.test(c.whatsappAdmin)) return salah('Nomor WhatsApp admin tidak valid.');
  c.instagram = teks(raw.instagram, 30).replace(/^@/, '');
  c.tiktok = teks(raw.tiktok, 30).replace(/^@/, '');
  if (!/^[A-Za-z0-9._]*$/.test(c.instagram) || !/^[A-Za-z0-9._]*$/.test(c.tiktok)) return salah('Username Instagram/TikTok hanya boleh huruf, angka, titik, dan garis bawah.');

  const sm = raw.statusManual;
  c.statusManual = sm && (teks(sm.judul, 60) || teks(sm.pesan, 240)) ? { judul: teks(sm.judul, 60) || 'Pengumuman', pesan: teks(sm.pesan, 240) } : null;

  c.hariJual = [...new Set((Array.isArray(raw.hariJual) ? raw.hariJual : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
  const pasangJam = (o, a, b, label) => {
    if (!o || !JAM.test(o[a]) || !JAM.test(o[b])) return `Jam ${label} harus berformat JJ:MM, misalnya 08:00.`;
    if (o[a] >= o[b] && label !== 'pre-order rutin') return `Jam ${label}: jam mulai harus sebelum jam selesai.`;
    return '';
  };
  let e = pasangJam(raw.preorder, 'buka', 'tutup', 'pre-order rutin'); if (e) return salah(e);
  c.preorder = { buka: raw.preorder.buka, tutup: raw.preorder.tutup };
  e = pasangJam(raw.serahTerima, 'mulai', 'selesai', 'serah terima rutin'); if (e) return salah(e);
  c.serahTerima = { mulai: raw.serahTerima.mulai, selesai: raw.serahTerima.selesai };
  const slots = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => teks(s, 24)).filter(Boolean).slice(0, 8);
  c.slotSerahTerima = slots(raw.slotSerahTerima);
  if (!c.slotSerahTerima.length) return salah('Isi minimal satu pilihan jam serah terima rutin.');

  c.jadwalKhusus = [];
  for (const k of (Array.isArray(raw.jadwalKhusus) ? raw.jadwalKhusus : []).slice(0, 20)) {
    if (!TGL.test(k.tanggal || '')) return salah('Tanggal hari jual khusus harus diisi.');
    if (!TGLJAM.test(k.poBuka || '') || !TGLJAM.test(k.poTutup || '')) return salah(`Hari jual ${k.tanggal}: isi waktu pre-order dibuka dan ditutup.`);
    if (k.poBuka >= k.poTutup) return salah(`Hari jual ${k.tanggal}: pre-order harus dibuka sebelum ditutup.`);
    e = pasangJam(k.serahTerima, 'mulai', 'selesai', `serah terima ${k.tanggal}`); if (e) return salah(e);
    const s = slots(k.slot);
    c.jadwalKhusus.push({ tanggal: k.tanggal, poBuka: k.poBuka, poTutup: k.poTutup, serahTerima: { mulai: k.serahTerima.mulai, selesai: k.serahTerima.selesai }, ...(s.length ? { slot: s } : {}) });
  }
  c.jadwalKhusus.sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  c.pembayaran = [];
  for (const p of (Array.isArray(raw.pembayaran) ? raw.pembayaran : []).slice(0, 4)) {
    const x = { jenis: teks(p.jenis, 24), nomor: teks(p.nomor, 32), atasNama: teks(p.atasNama, 60) };
    if (!x.jenis && !x.nomor) continue;
    if (!x.jenis || !x.nomor) return salah('Tujuan pembayaran perlu jenis (misalnya DANA) dan nomornya.');
    c.pembayaran.push(x);
  }
  c.areaAntar = teks(raw.areaAntar, 80);
  c.lokasiAmbil = teks(raw.lokasiAmbil, 60) || 'Kembaran';

  c.menu = [];
  const ids = new Set();
  for (const m of (Array.isArray(raw.menu) ? raw.menu : []).slice(0, 24)) {
    const nama = teks(m.nama, 40);
    if (!nama) return salah('Setiap menu perlu nama.');
    let id = teks(m.id, 30).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,29}$/.test(id)) id = nama.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'menu';
    while (ids.has(id)) id = id.slice(0, 26) + '-' + Math.floor(Math.random() * 900 + 100);
    ids.add(id);
    const harga = {};
    for (const s of ['S', 'M', 'L']) {
      const h = Number(m.harga && m.harga[s]);
      if (!Number.isInteger(h) || h < 1000 || h > 100000) return salah(`Harga ${nama} ukuran ${s} harus angka antara 1.000 dan 100.000.`);
      harga[s] = h;
    }
    const foto = FOTO.test(m.foto || '') ? m.foto : '';
    const fotoBesar = FOTO.test(m.fotoBesar || '') ? m.fotoBesar : '';
    c.menu.push({ id, nama, deskripsi: teks(m.deskripsi, 200), harga, andalan: !!m.andalan, aktif: m.aktif !== false, habis: !!m.habis,
      ...(foto ? { foto } : {}), ...(fotoBesar ? { fotoBesar } : {}) });
  }
  if (!c.menu.some(m => m.aktif)) return salah('Minimal satu menu harus ditampilkan.');
  // hanya satu menu andalan (yang pertama dipilih)
  let ada = false;
  c.menu.forEach(m => { if (m.andalan && (!m.aktif || ada)) m.andalan = false; if (m.andalan) ada = true; });
  return { config: c };
}

// Menu yang tampil di web dan bisa dipesan
export const menuAktif = C => C.menu.filter(m => m.aktif !== false);
export const menuJual = C => menuAktif(C).filter(m => !m.habis);
