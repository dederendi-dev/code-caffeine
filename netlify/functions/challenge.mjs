// API pembeli Caffeine Challenge: /api/challenge/<aksi>
// Alur: pesan -> (transfer) sudah-bayar -> admin tandai lunas -> mulai (1x) -> hasil (skor dihitung ulang di server).
import { store, update } from './lib/store.mjs';
import { json, fail, body, str, normalWA, kodeBaru, tokenBaru, samaAman, rupiah } from './lib/util.mjs';
import { nowWIB, openEvent } from './lib/jadwal.mjs';
import { kirimNotif } from './lib/push.mjs';
import { C, SIM, KEY, publik, kedaluwarsa, hadiahTeks, labelHari, jamAntar } from './lib/pesanan.mjs';

export const config = { path: '/api/challenge/*' };

async function ambil(st, kode, token) {
  if (!/^CC[A-Z0-9]{5}$/.test(kode || '')) return { err: fail('Kode pesanan tidak dikenal.', 404) };
  const p = await st.get(KEY(kode), { type: 'json' });
  if (!p || !samaAman(p.token, token || '')) return { err: fail('Pesanan tidak ditemukan.', 404) };
  const exp = kedaluwarsa(p);
  if (exp) { const r = await update(st, KEY(kode), cur => kedaluwarsa(cur)); return { p: r.data || exp }; }
  return { p };
}

export default async (req) => {
  const aksi = new URL(req.url).pathname.split('/').pop();
  const st = store('challenge');

  if (req.method === 'GET' && aksi === 'status') {
    const u = new URL(req.url);
    const { p, err } = await ambil(st, u.searchParams.get('kode'), u.searchParams.get('token'));
    return err || json(publik(p));
  }
  if (req.method !== 'POST') return fail('Metode tidak didukung.', 405);
  const b = await body(req);

  if (aksi === 'pesan') {
    if (!C.pembayaran || !C.pembayaran.length) return fail('Pembayaran tantangan belum dibuka.', 409);
    const ev = openEvent(nowWIB());
    if (!ev) return fail('Pre-order sedang ditutup, jadi tantangan belum bisa dibeli.', 409);
    const m = C.menu.find(x => x.id === b.menu);
    if (!m) return fail('Pilih minuman dulu.');
    const nama = str(b.nama, 60), wa = normalWA(b.wa);
    const cara = b.cara_terima === 'Ambil sendiri' ? 'Ambil sendiri' : 'Diantar';
    const lokasi = str(b.lokasi, 120);
    if (!nama) return fail('Tulis nama untuk pesanan ini.');
    if (!wa) return fail('Tulis nomor WhatsApp yang aktif, contoh 081234567890.');
    if (cara === 'Diantar' && !lokasi) return fail('Tulis lokasi antar, misalnya gedung di kampus UMP atau nama kos.');
    const tujuan = C.pembayaran[Number(b.bayar_ke) || 0] || C.pembayaran[0];
    const now = new Date().toISOString();
    const p = {
      kode: '', token: tokenBaru(), dibuat: now, status: 'menunggu_bayar',
      nama, wa, menu: m.id, menuNama: m.nama, ukuran: 'M', harga: m.harga.M,
      cara_terima: cara, lokasi: cara === 'Diantar' ? lokasi : `Ambil sendiri di ${C.lokasiAmbil}`,
      jam: str(b.jam, 40) || jamAntar(ev), catatan: str(b.catatan, 200), pernah_beli: b.pernah_beli === 'Sudah' ? 'Sudah' : 'Belum',
      untuk: labelHari(ev), untuk_ms: ev.day, bayar_ke: { jenis: tujuan.jenis, nomor: tujuan.nomor, atasNama: tujuan.atasNama },
      riwayat: [{ t: now, ev: 'dibuat' }]
    };
    for (let i = 0; i < 6; i++) {
      p.kode = kodeBaru();
      const r = await st.setJSON(KEY(p.kode), p, { onlyIfNew: true });
      if (r.modified) return json({ ...publik(p), token: p.token }, 201);
    }
    return fail('Gagal membuat pesanan, coba lagi.', 500);
  }

  const { p, err } = await ambil(st, b.kode, b.token);
  if (err) return err;
  const t = new Date().toISOString();

  if (aksi === 'sudah-bayar') {
    if (p.status !== 'menunggu_bayar') return json(publik(p));
    const r = await update(st, KEY(p.kode), cur => cur.status !== 'menunggu_bayar' ? null
      : { ...cur, status: 'cek_admin', sudah_bayar_at: t, riwayat: [...cur.riwayat, { t, ev: 'pembeli: sudah transfer' }] });
    if (r.error) return fail(r.error, r.code || 409);
    if (!r.unchanged) {
      await kirimNotif({ title: `Cek transfer ${rupiah(p.harga)} · ${p.kode}`, body: `${p.nama} · ${p.menuNama} Medium · ke ${p.bayar_ke.jenis} ${p.bayar_ke.nomor}`, tag: p.kode });
    }
    return json(publik(r.data));
  }

  if (aksi === 'batal') {
    const r = await update(st, KEY(p.kode), cur => cur.status !== 'menunggu_bayar' ? { error: 'Pesanan ini tidak bisa dibatalkan dari sini. Hubungi admin.' }
      : { ...cur, status: 'batal', alasan_batal: 'Dibatalkan pembeli', riwayat: [...cur.riwayat, { t, ev: 'dibatalkan pembeli' }] });
    if (r.error) return fail(r.error, 409);
    return json(publik(r.data));
  }

  if (aksi === 'mulai') {
    const r = await update(st, KEY(p.kode), cur => cur.status !== 'lunas'
      ? { error: cur.status === 'main' || cur.status === 'selesai' ? 'Kesempatan main untuk pesanan ini sudah dipakai.' : 'Pembayaran belum dikonfirmasi admin.' }
      : { ...cur, status: 'main', mulai_at: t, riwayat: [...cur.riwayat, { t, ev: 'mulai main' }] });
    if (r.error) return fail(r.error, 409);
    return json(publik(r.data));
  }

  if (aksi === 'hasil') {
    const rekaman = str(b.rekaman, 20000);
    if (!/^[0-9a-z.]*$/.test(rekaman)) return fail('Rekaman permainan tidak valid.');
    const taps = SIM.decodeTaps(rekaman);
    if (taps.length > 6000 || taps.some((x, i) => !Number.isFinite(x) || x < 0 || (i && x < taps[i - 1]))) return fail('Rekaman permainan tidak valid.');
    const hasil = SIM.replay(taps);
    const tier = SIM.tierFor(hasil.score).key;
    const r = await update(st, KEY(p.kode), cur => {
      // kiriman ulang dari HP yang sama (balasan pertama tidak sampai): anggap berhasil
      if (cur.status === 'selesai' && cur.rekaman === rekaman) return null;
      if (cur.status !== 'main') return { error: cur.status === 'selesai' ? 'Hasil pesanan ini sudah tersimpan.' : 'Permainan belum dimulai.' };
      const lama = Date.now() - Date.parse(cur.mulai_at), minimal = hasil.steps / 60 * 1000;
      return { ...cur, status: 'selesai', skor: hasil.score, tier, rekaman, selesai_at: t,
        curiga: lama < minimal - 3000 ? `Hasil terkirim ${Math.round(lama / 1000)} dtk setelah mulai, padahal permainannya ${Math.round(minimal / 1000)} dtk` : undefined,
        riwayat: [...cur.riwayat, { t, ev: `hasil: skor ${hasil.score}` }] };
    });
    if (r.error) return fail(r.error, 409);
    const q = r.data;
    if (!r.unchanged) await kirimNotif({ title: `Hasil Challenge ${q.kode}: ${q.tier === 'large' ? 'LARGE' : 'Medium'}`, body: `${q.nama} · ${hadiahTeks(q)} · ${q.untuk} ${q.jam}`, tag: q.kode + '-hasil' });
    return json(publik(q));
  }

  return fail('Aksi tidak dikenal.', 404);
};
