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

### Halaman admin (`/admin/`)
- Masuk dengan link pribadi per anggota: `https://codecaffeine-ump.netlify.app/admin/#k=<kunci>`. Tanpa password.
  Kunci disimpan di env Netlify `ADMIN_KEYS` dengan format `Nama:kunci,Nama2:kunci2` (kunci minimal 16 karakter).
  Mengganti atau menghapus kunci seseorang langsung mematikan link lamanya (setelah deploy ulang).
- Daftar pesanan per status: Perlu dicek, Menunggu transfer, Lunas belum main, Sedang main, Siap diantar,
  Sudah diantar, Batal. Setiap aksi mencatat nama admin di riwayat. Tombol "Salin daftar antar" untuk pengantar.
- Notifikasi HP (Web Push) saat pembeli menekan "sudah transfer" dan saat hasil masuk. Env: `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY` (buat dengan `npx web-push generate-vapid-keys`). Di iPhone, halaman admin harus
  ditambahkan ke Layar Utama dulu, lalu notifikasi diaktifkan dari ikon itu.
- Cek rekaman: link "Putar ulang hitungan skor" di riwayat pesanan membuka `/main/#cek=<rekaman>`.

Data pesanan disimpan di Netlify Blobs (store `challenge`), langganan notifikasi di store `langganan`.

### Uji lokal
```
npm install
npm run dev          # http://localhost:8888, admin: /admin/#k=kunci-uji-lokal-1234567890
```
Data uji tersimpan di `.local-data/` (tidak ikut git); notifikasi dicatat ke `.local-data/push-log.json`.

## Mengubah data
Semua data ada di `public/assets/js/config.js`: nomor WhatsApp, tujuan transfer tantangan (`pembayaran`),
akun Instagram/TikTok, jadwal, harga, menu, dan pengumuman manual (misalnya libur atau stok habis).
Server tantangan membaca file yang sama, jadi harga dan jadwal selalu sama di web dan di server.

## Struktur
```
public/index.html              halaman utama
public/main/index.html         game Caffeine Challenge
public/main/sim.js             simulasi game (dipakai game dan server untuk menghitung ulang skor)
public/admin/                  halaman admin + service worker notifikasi
public/assets/css/style.css    tampilan
public/assets/js/config.js     data yang bisa diubah
public/assets/js/app.js        jadwal, menu, keranjang, pesan WhatsApp, pop-up tantangan
public/assets/img/             logo dan foto minuman
public/assets/fonts/           Inter, Inter Tight, Press Start 2P, Nunito (lisensi OFL)
netlify/functions/challenge.mjs  API pembeli (/api/challenge/*)
netlify/functions/admin.mjs      API admin (/api/admin/*)
netlify/functions/lib/           penyimpanan, jadwal, aturan pesanan, notifikasi
scripts/dev-server.mjs           server uji lokal
```

## Tahap berikutnya
1. QR di cup + poin digital (nomor WhatsApp sebagai akun)
