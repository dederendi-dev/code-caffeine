# Code Caffeine

Website pemesanan Code Caffeine, usaha es kopi Kelompok Bytepreneur
(Kewirausahaan Berbasis Program Studi, Teknik Informatika UMP, 2026).

Alamat: https://codecaffeine-ump.netlify.app

## Isi
- Tampilan ikut mode HP: gelap atau terang (prefers-color-scheme).
- Status buka/tutup otomatis mengikuti jadwal (WIB) di `config.js`: jadwal rutin (`hariJual`)
  atau hari jual khusus (`jadwalKhusus`). Form hanya bisa mengirim saat pre-order dibuka.
- Menu 5 minuman x 3 ukuran (Small 12 oz, Medium 14 oz, Large 16 oz) dengan harga dari Excel keuangan.
- Keranjang dan form pesanan yang mengirim pesan rapi ke WhatsApp. Pembayaran tetap transfer atau tunai.
- Kartu stamp (beli 5 kali gratis 1 Small) dan voucher Caffeine Challenge bisa ditukar dari form.
- Setiap pesanan tercatat di Netlify Forms (form `pesanan`) sebagai data penjualan dan validasi.

## Caffeine Challenge (`/main`)
Mini game buatan Ridho. Dimainkan dari form pesanan untuk 1 cup Medium, satu kesempatan per pesanan.
Minimal tetap Medium; skor menentukan bonus (sesuai naskah presentasi dan laporan UTS):

| Skor | Hadiah |
|---|---|
| di bawah 1.800 | Medium + voucher Rp1.000 untuk pesanan berikutnya |
| 1.800 (tamat stage 3) | Medium + 1 cap tambahan di kartu stamp |
| 3.000 (tamat stage 5) | upgrade ke Large |

- Keluar di tengah permainan dihitung skor 0.
- Dibuka langsung (misalnya dari QR poster), game hanya bisa mode latihan; tombol tantangan mengarah ke pemesanan.
- Setiap permainan tantangan tercatat di Netlify Forms (form `challenge`): nama, nomor WA, skor, hasil, rekaman tap.
- **Cek hasil yang mencurigakan:** salin isi kolom `rekaman`, lalu buka
  `https://codecaffeine-ump.netlify.app/main/#cek=<rekaman>`. Skor dihitung ulang dari rekaman;
  kalau sama dengan skor di pesanan, hasilnya asli.
- Aturan hadiah ada di `main/index.html` (bagian `TIERS` dan `VOUCHER`); teks di form pesanan ada di `assets/js/app.js` (`BONUS`).

## Mengubah data
Semua data ada di `assets/js/config.js`: nomor WhatsApp, akun Instagram/TikTok,
jadwal, harga, menu, dan pengumuman manual (misalnya libur atau stok habis).

## Struktur
```
index.html            halaman utama
main/index.html       game Caffeine Challenge
assets/css/style.css  tampilan
assets/js/config.js   data yang bisa diubah
assets/js/app.js      logika jadwal, menu, keranjang, pesan WhatsApp, Caffeine Challenge
assets/img/           logo dan foto minuman
assets/fonts/         Inter, Inter Tight, Press Start 2P, Nunito (lisensi OFL)
```

## Tahap berikutnya
1. QR di cup + poin digital (nomor WhatsApp sebagai akun)
