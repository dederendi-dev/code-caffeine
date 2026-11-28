// Alur pesanan di CC Admin untuk dua jenis pesanan: 'web' (pesanan biasa) dan 'challenge' (paket game).
// Prinsip:
// - Setiap aksi dicek terhadap keadaan TERBARU di server (atomik), jadi dua admin yang menekan bersamaan
//   tidak bisa sama-sama berhasil; yang kalah dapat pesan siapa yang sudah melakukannya.
// - Admin yang menekan "Terima pesanan" menjadi penanggung jawab (pj). Hanya pj yang menghubungi pembeli lewat
//   WA, menandai sedang diantar, dan menandai selesai. Admin lain bisa "Ambil alih" (tercatat & diberitahukan).
// - Lunas boleh ditandai admin mana pun (yang memegang DANA bisa jadi bukan pengantar).
// - Setiap aksi masuk riwayat beserta nama admin dan jamnya.

export const jamWIB = iso => {
  if (!iso) return '';
  const d = new Date(Date.parse(iso) + 7 * 3600000);
  return `${String(d.getUTCHours()).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

const LUNAS_CH = ['lunas', 'main', 'selesai'];

// Label untuk notifikasi & riwayat
export const LABEL = {
  terima: 'diterima', lunas: 'ditandai lunas', belum_lunas: 'ditandai belum lunas', antar: 'sedang diantar',
  diantar: 'selesai diantar', belum_diantar: 'dikembalikan ke belum diantar', batal: 'dibatalkan',
  aktifkan: 'diaktifkan lagi', ambil_alih: 'diambil alih', wa: 'dihubungi lewat WA'
};

/**
 * Terapkan aksi admin. cur = data pesanan terbaru, jenis = 'web' | 'challenge'.
 * Mengembalikan objek baru, null (tidak berubah), atau { error }.
 */
export function terapkan(cur, jenis, aksi, admin, alasan) {
  const t = new Date().toISOString();
  const web = jenis === 'web';
  const st = cur.status || 'baru';
  const pj = cur.pj || (web ? cur.diterima_oleh : null) || null;
  const batal = st === 'batal';
  const lunas = web ? !!cur.lunas : LUNAS_CH.includes(st);
  const log = (ev, extra) => ({ ...cur, ...extra, riwayat: [...(cur.riwayat || []), { t, ev, oleh: admin }] });
  const salah = msg => ({ error: msg });
  const hanyaPj = () => pj && pj !== admin
    ? salah(`Pesanan ini ditangani ${pj}. Hanya ${pj} yang bisa melakukannya. Pakai "Ambil alih" kalau ${pj} berhalangan.`) : null;
  if (cur.dihapus_at) return salah('Pesanan ini sudah dihapus oleh master admin.');
  if (batal && !['aktifkan'].includes(aksi)) return salah(`Pesanan ini sudah dibatalkan${cur.batal_oleh ? ' oleh ' + cur.batal_oleh : ''}.`);

  switch (aksi) {
    case 'terima': {
      if (pj) return salah(pj === admin ? 'Pesanan ini sudah kamu terima.' : `Sudah diterima ${pj} (${jamWIB(cur.pj_at || cur.diterima_at)}). ${pj} yang menghubungi pembeli.`);
      if (!web && !lunas) return salah('Paket Challenge baru bisa diterima setelah transfernya ditandai lunas.');
      // tombol Terima sekaligus membuka WA pembeli, jadi WA ikut dicatat
      return log('pesanan diterima, membuka WA pembeli', { pj: admin, pj_at: t, wa_oleh: admin, wa_at: t, ...(web ? { status: 'diproses', diterima_oleh: admin, diterima_at: t } : {}) });
    }
    case 'lunas': {
      if (lunas) return salah(`Sudah ditandai lunas${cur.lunas_oleh ? ' oleh ' + cur.lunas_oleh : ''} (${jamWIB(cur.lunas_at)}).`);
      if (web) return log('ditandai lunas', { lunas: true, lunas_oleh: admin, lunas_at: t });
      if (!['menunggu_bayar', 'cek_admin'].includes(st)) return salah('Pesanan ini tidak menunggu pembayaran.');
      return log('ditandai lunas (transfer dicek)', { status: 'lunas', lunas_oleh: admin, lunas_at: t });
    }
    case 'belum_lunas': {
      if (!lunas) return salah('Pesanan ini memang belum lunas.');
      if (web) return log('lunas dibatalkan', { lunas: false, lunas_oleh: undefined, lunas_at: undefined });
      if (st !== 'lunas') return salah('Pembeli sudah mulai main, lunas tidak bisa dibatalkan.');
      return log('lunas dibatalkan, tantangan terkunci lagi', { status: 'cek_admin', lunas_oleh: undefined, lunas_at: undefined });
    }
    case 'antar': {
      if (!pj) return salah('Terima pesanannya dulu.');
      const x = hanyaPj(); if (x) return x;
      if (cur.diantar) return salah('Pesanan ini sudah selesai diantar.');
      if (cur.antar_at) return salah(`Sudah ditandai sedang diantar (${jamWIB(cur.antar_at)}).`);
      return log(cur.cara_terima === 'Diantar' ? 'sedang diantar, membuka WA pembeli' : 'siap diambil, membuka WA pembeli', { antar_at: t, antar_oleh: admin, wa_oleh: admin, wa_at: t });
    }
    case 'diantar': {
      if (!pj) return salah('Terima pesanannya dulu.');
      const x = hanyaPj(); if (x) return x;
      if (cur.diantar) return salah(`Sudah selesai diantar${cur.diantar_oleh ? ' oleh ' + cur.diantar_oleh : ''} (${jamWIB(cur.diantar_at)}).`);
      if (!web && !LUNAS_CH.includes(st)) return salah('Pesanan ini belum lunas.');
      return log(cur.cara_terima === 'Diantar' ? 'selesai diantar' : 'sudah diambil pembeli', { diantar: true, diantar_oleh: admin, diantar_at: t });
    }
    case 'belum_diantar': {
      if (!cur.diantar) return salah('Pesanan ini memang belum selesai diantar.');
      const x = hanyaPj(); if (x) return x;
      return log('batal tandai selesai diantar', { diantar: false, diantar_oleh: undefined, diantar_at: undefined });
    }
    case 'batal': {
      if (cur.diantar) return salah('Pesanan yang sudah diantar tidak bisa dibatalkan.');
      if (!web && !['menunggu_bayar', 'cek_admin', 'lunas'].includes(st)) return salah('Pembeli sudah mulai main, paket ini tidak bisa dibatalkan.');
      const x = hanyaPj(); if (x) return x;
      return log('dibatalkan' + (alasan ? `: ${alasan}` : ''), { status: 'batal', alasan_batal: alasan || 'Dibatalkan admin', batal_oleh: admin, batal_at: t });
    }
    case 'aktifkan': {
      if (!batal) return salah('Pesanan ini tidak sedang batal.');
      if (!web) return salah('Paket Challenge yang batal tidak bisa diaktifkan lagi. Minta pembeli pesan ulang.');
      return log('diaktifkan lagi', { status: pj ? 'diproses' : 'baru', alasan_batal: undefined, batal_oleh: undefined, batal_at: undefined });
    }
    case 'ambil_alih': {
      if (!pj) return salah('Pesanan ini belum diterima siapa pun. Tekan Terima pesanan.');
      if (pj === admin) return salah('Pesanan ini sudah kamu tangani.');
      if (cur.diantar) return salah('Pesanan ini sudah selesai.');
      return log(`diambil alih dari ${pj}`, { pj: admin, pj_at: t, pj_sebelumnya: pj, ...(web ? { diterima_oleh: admin } : {}) });
    }
    case 'wa': {
      const x = pj ? hanyaPj() : salah('Terima pesanannya dulu. Tombol Terima pesanan sekaligus membuka WA pembeli.');
      if (x) return x;
      // tidak dicatat ulang kalau admin yang sama baru saja membuka WA (≤2 menit)
      if (cur.wa_oleh === admin && Date.now() - Date.parse(cur.wa_at || 0) < 120000) return null;
      return log('membuka WA pembeli', { wa_oleh: admin, wa_at: t });
    }
    default:
      return salah('Aksi tidak dikenal.');
  }
}
