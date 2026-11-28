# Code Caffeine

Website pemesanan Code Caffeine, usaha es kopi Kelompok Bytepreneur
(Kewirausahaan Berbasis Program Studi, Teknik Informatika UMP, 2026).

Alamat: https://codecaffeine-ump.netlify.app

## Isi
- Tampilan ikut mode HP: gelap atau terang (prefers-color-scheme).
- Status buka/tutup otomatis mengikuti jadwal (WIB) di `public/assets/js/config.js`: jadwal rutin (`hariJual`)
  atau hari jual khusus (`jadwalKhusus`). Form hanya bisa mengirim saat pre-order dibuka.
- Menu 5 minuman x 3 ukuran (Small 12 oz, Medium 14 oz, Large 16 oz) dengan harga dari Excel keuangan.
- Keranjang dan form pesanan yang mengirim pesan rapi ke WhatsApp. Pembayaran tetap transfer atau tunai.
  Setiap pesanan juga masuk ke CC Admin (`/admin/`) dengan kode `Wxxxxx` yang sama dengan di chat WA,
  dan semua admin mendapat notifikasi "Pesanan baru".
- Kartu stamp (beli 5 kali gratis 1 Small) dan voucher Caffeine Challenge bisa ditukar dari form.
- Paket Caffeine Challenge dibayar lewat DANA dan dikonfirmasi admin; game terbuka otomatis setelah lunas.
- Setiap pesanan tercatat di Netlify Forms (form `pesanan`) sebagai data penjualan dan validasi.

## Caffeine Challenge (game di halaman utama)
Mini game buatan Ridho, tampil langsung di bagian **Game** halaman utama (iframe `/main/?embed=web`).
Latihan gratis. Tantangan = paket 1 cup Medium, satu kesempatan per pesanan. Minimal tetap Medium;
skor menentukan bonus (sesuai naskah presentasi dan laporan UTS):

| Skor | Hadiah |
|---|---|
| di bawah 1.800 | Medium + voucher Rp1.000 untuk pesanan berikutnya |
| 1.800 (tamat stage 3) | Medium + 1 cap tambahan di kartu stamp |
| 3.000 (tamat stage 5) | upgrade ke Large |

### Alur pembeli
1. Tekan **TANTANGAN** di game, lalu **PESAN & BAYAR**. Pop-up meminta minuman, nama, WA, cara terima.
2. Pop-up menampilkan nominal dan tujuan transfer (DANA di `config.js` → `pembayaran`) beserta kode pesanan.
3. Pembeli menekan **Saya sudah transfer** → status "Menunggu konfirmasi admin" + tombol WhatsApp admin.
4. Admin menandai lunas → di HP pembeli pop-up "Pembayaran diterima" muncul sendiri, tantangan terbuka.
5. Menekan **MULAI** memakai kesempatan. Hasil dikirim ke server, skor dihitung ulang dari rekaman tap, struk tampil.

Aturan di server: harga diambil dari `config.js`; pesanan tanpa konfirmasi transfer batal sendiri setelah 1 jam;
yang sudah MULAI tapi tidak mengirim hasil dalam 15 menit dihitung skor 0; hasil yang terkirim lebih cepat dari
lama permainannya ditandai "perlu dicek" di halaman admin.

### CC Admin (`/admin/`) untuk semua anggota
Berisi **semua pesanan**: pesanan web biasa (Pesanan baru → Terima pesanan → Tandai lunas → Tandai diantar)
dan paket Challenge (Cek transfer → Tandai lunas → main → Siap diantar). Ada rekap jumlah cup yang perlu dibuat.

- Masuk dengan link pribadi per anggota: `https://codecaffeine-ump.netlify.app/admin/#k=<kunci>`. Tanpa password.
  Kunci disimpan di env Netlify `ADMIN_KEYS` dengan format `Nama:kunci,Nama2:kunci2` (kunci minimal 16 karakter).
  Mengganti atau menghapus kunci seseorang langsung mematikan link lamanya (setelah deploy ulang).
- Tiga kelompok berwarna: Belum diproses (oranye), Diproses (biru), Selesai (hijau). Ketuk nama untuk detail.
- **Satu pesanan, satu penanggung jawab:** "Terima & WA pembeli" membuka WhatsApp pembeli dan menjadikan admin itu
  penanggung jawab. Hanya dia yang bisa membuka WA pembeli, menandai sedang diantar (membuka WA lagi), dan selesai.
  Admin lain bisa "Ambil alih". Lunas boleh ditandai siapa saja. Aturannya di `netlify/functions/lib/alur.mjs`
  dan dicek atomik di server, jadi dua admin yang menekan bersamaan tidak bisa sama-sama berhasil.
- Setiap aksi (termasuk membuka WA) masuk riwayat dengan nama dan jam, dan dikirim sebagai notifikasi ke HP admin lain.
  Halaman yang terbuka langsung memuat ulang saat notifikasi datang. Tombol "Salin daftar antar" untuk pengantar.
- Panduan interaktif (`public/assets/js/tur.js`) muncul sekali di web utama (cara pesan) dan di CC Admin;
  bisa dibuka lagi lewat tombol "Cara pesan" / "Panduan".
- Notifikasi HP (Web Push) saat pembeli menekan "sudah transfer" dan saat hasil masuk. Env: `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY` (buat dengan `npx web-push generate-vapid-keys`). Di iPhone, halaman admin harus
  ditambahkan ke Layar Utama dulu, lalu notifikasi diaktifkan dari ikon itu.
- Cek rekaman: link "Putar ulang hitungan skor" di riwayat pesanan membuka `/main/#cek=<rekaman>`.

### Master admin (`/master/`), khusus pemilik
Link `https://codecaffeine-ump.netlify.app/master/#k=<kunci>` (env `MASTER_KEYS`, format sama dengan `ADMIN_KEYS`).
- **Pesanan:** semua data pembeli (web + Challenge), filter, unduh CSV (pemisah titik koma untuk Excel).
- **Sampah:** data yang dihapus tidak tampil di CC Admin; bisa dipulihkan atau dihapus permanen.
- **Menu:** nama, deskripsi, harga S/M/L, foto (dipangkas & dikecilkan otomatis; pakai PNG latar transparan),
  tampil/sembunyi, habis, menu andalan, urutan, tambah/hapus menu.
- **Pengaturan:** pengumuman di web, hari jual khusus, jadwal rutin, tujuan transfer, kontak.

Perubahan menu/pengaturan disimpan di Netlify Blobs (store `pengaturan`) dan menimpa `config.js`.
`/assets/js/config.js` disajikan fungsi `config` (cache CDN 60 detik, dibersihkan saat disimpan), jadi web dan server
selalu memakai harga yang sama. "Kembalikan ke bawaan" kembali ke isi file.

Penyimpanan Netlify Blobs: `challenge` (paket Challenge), `web` (pesanan web), `pengaturan`, `foto`, `langganan` (notifikasi).
Env `IMPOR_FORMS` (opsional) berisi pesanan lama dari Netlify Forms yang diimpor sekali ke store `web`.

### Uji lokal
```
npm install
npm run dev          # http://localhost:8888
                     # admin: /admin/#k=kunci-uji-lokal-1234567890  master: /master/#k=kunci-master-lokal-1234567890
```
Data uji tersimpan di `.local-data/` (tidak ikut git); notifikasi dicatat ke `.local-data/push-log.json`.

## Mengubah data
Sehari-hari lewat master admin. Isi bawaannya ada di `public/assets/js/config.js` (nomor WhatsApp, tujuan transfer,
akun Instagram/TikTok, jadwal, harga, menu, pengumuman).

## Struktur
```
public/index.html              halaman utama
public/main/index.html         game Caffeine Challenge
public/main/sim.js             simulasi game (dipakai game dan server untuk menghitung ulang skor)
public/admin/                  CC Admin (semua anggota) + service worker notifikasi
public/master/                 master admin (pemilik)
public/assets/css/style.css    tampilan
public/assets/js/config.js     data yang bisa diubah
public/assets/js/app.js        jadwal, menu, keranjang, pesan WhatsApp, pop-up tantangan
public/assets/img/             logo dan foto minuman
public/assets/fonts/           Inter, Inter Tight, Press Start 2P, Nunito (lisensi OFL)
netlify/functions/challenge.mjs  API pembeli (/api/challenge/*)
netlify/functions/admin.mjs      API CC Admin (/api/admin/*)
netlify/functions/master.mjs     API master admin (/api/master/*)
netlify/functions/order.mjs      pesanan web masuk (/api/order)
netlify/functions/config.mjs     /assets/js/config.js dinamis
netlify/functions/foto.mjs       foto menu unggahan (/foto/*)
netlify/functions/lib/           penyimpanan, jadwal, aturan pesanan, notifikasi
scripts/dev-server.mjs           server uji lokal
```

## Tahap berikutnya
1. QR di cup + poin digital (nomor WhatsApp sebagai akun)
