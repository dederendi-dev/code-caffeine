# Code Caffeine

Website pemesanan Code Caffeine, usaha es kopi Kelompok Bytepreneur
(Kewirausahaan Berbasis Program Studi, Teknik Informatika UMP, 2026).

Alamat: https://codecaffeine-ump.netlify.app

## Isi
- Tampilan ikut mode HP: gelap atau terang (prefers-color-scheme).
- Status buka/tutup otomatis mengikuti jadwal (WIB): hari jual Senin, Rabu, Jumat;
  pre-order H-1 pukul 08.00–20.00; serah terima 09.30–13.00.
- Menu 5 minuman x 3 ukuran (Small 12 oz, Medium 14 oz, Large 16 oz) dengan harga dari Excel keuangan.
- Keranjang dan form pesanan yang mengirim pesan rapi ke WhatsApp. Pembayaran tetap transfer atau tunai.
- Setiap pesanan juga tercatat di Netlify Forms (form `pesanan`) sebagai data penjualan dan validasi.

## Mengubah data
Semua data ada di `assets/js/config.js`: nomor WhatsApp, akun Instagram/TikTok,
jadwal, harga, menu, dan pengumuman manual (misalnya libur atau stok habis).

## Struktur
```
index.html            halaman utama
assets/css/style.css  tampilan
assets/js/config.js   data yang bisa diubah
assets/js/app.js      logika jadwal, menu, keranjang, pesan WhatsApp
assets/img/           logo
assets/fonts/         Inter dan Inter Tight (lisensi OFL)
```

## Tahap berikutnya
1. Web utama (bagian ini)
2. QR di cup + halaman pertanyaan + poin (`/scan`)
3. Mini game Caffeine Challenge (`/main`)
