/*
  PENGATURAN CODE CAFFEINE
  ------------------------
  File ini satu-satunya yang perlu diubah untuk mengganti nomor WA,
  akun media sosial, jadwal, harga, rekening pembayaran, atau menu. Simpan, lalu deploy ulang.
  File ini dibaca oleh web DAN oleh server (harga & jadwal pesanan Caffeine Challenge dicek di server).
*/
(function (root) {
var CC_CONFIG = {
  // Nomor WhatsApp tujuan pesanan. Format 62xxxxxxxxxx (tanpa +, spasi, atau 0 di depan).
  // Selama kosong, tombol pesan hanya menyalin teks pesanan.
  whatsapp: '6285604504216',

  // Username tanpa @. Biarkan kosong kalau akunnya belum dibuat (ikon tidak ditampilkan).
  instagram: '',
  tiktok: '',

  // Pengumuman manual yang menimpa status otomatis, misalnya libur atau stok habis.
  // Contoh: { judul: 'Libur dulu', pesan: 'Kami libur sampai Senin, 30 November.' }
  // Biarkan null kalau jadwal normal.
  statusManual: null,

  // JADWAL RUTIN (sesuai Rencana Praktik Usaha di laporan UTS)
  // Sementara dimatikan karena jualan mengikuti jadwal khusus di bawah.
  // Untuk menyalakan lagi: hariJual: [1, 3, 5]   (0 Minggu, 1 Senin, ... 6 Sabtu)
  hariJual: [],
  preorder: { buka: '08:00', tutup: '20:00' },   // dibuka H-1
  serahTerima: { mulai: '09:30', selesai: '13:00' },
  slotSerahTerima: ['09.30–10.30', '10.30–11.30', '11.30–13.00'],

  // JADWAL KHUSUS: hari jual di luar jadwal rutin. Waktu dalam WIB, format 'YYYY-MM-DD HH:MM'.
  jadwalKhusus: [
    {
      tanggal: '2026-11-29',                 // Minggu
      poBuka: '2026-11-27 00:00',
      poTutup: '2026-11-29 12:00',
      serahTerima: { mulai: '15:00', selesai: '18:00' },
      slot: ['15.00–16.00', '16.00–17.00', '17.00–18.00']
    }
  ],

  // REKENING / E-WALLET TUJUAN PEMBAYARAN CAFFEINE CHALLENGE (transfer, lalu admin cek dan tandai lunas).
  // Selama daftar ini kosong, pembelian tantangan belum dibuka (mode latihan tetap bisa dimainkan).
  // Contoh: { jenis: 'DANA', nomor: '085604504216', atasNama: 'Dede Rendi Pauji' }
  //         { jenis: 'Bank BRI', nomor: '1234 5678 9012 345', atasNama: 'Dede Rendi Pauji' }
  // atasNama: nama pemilik akun DANA, supaya pembeli yakin transfernya benar. Kosong = tidak ditampilkan.
  pembayaran: [
    { jenis: 'DANA', nomor: '0856-0450-4216', atasNama: 'Yusuf Yanuar Aji W' }
  ],

  // Nomor WhatsApp admin yang dihubungi pembeli kalau pembayaran belum dikonfirmasi.
  // Kosong = pakai nomor pesanan di atas.
  whatsappAdmin: '',

  areaAntar: 'kampus UMP dan kos sekitar',
  lokasiAmbil: 'Kembaran',

  ukuran: [
    { id: 'S', nama: 'Small', oz: 12 },
    { id: 'M', nama: 'Medium', oz: 14 },
    { id: 'L', nama: 'Large', oz: 16 }
  ],

  // Harga S/M/L sesuai Excel keuangan kelompok.
  // Foto tiap menu: assets/img/menu/<id>.webp (latar transparan, tinggi 720 px).
  menu: [
    {
      id: 'dirty-latte',
      nama: 'Dirty Latte',
      andalan: true,
      deskripsi: 'Susu dingin dengan kopi yang dituang di atasnya. Diminum berlapis atau diaduk dulu, sama-sama enak.',
      harga: { S: 13000, M: 15000, L: 17000 }
    },
    {
      id: 'dalgona',
      nama: 'Dalgona Coffee',
      deskripsi: 'Kopi kocok yang lembut di atas susu dingin.',
      harga: { S: 10000, M: 12000, L: 14000 }
    },
    {
      id: 'cimory-matcha',
      nama: 'Cimory Matcha Latte',
      deskripsi: 'Matcha susu Cimory yang creamy dan dingin.',
      harga: { S: 13000, M: 15000, L: 17000 }
    },
    {
      id: 'milo',
      nama: 'Ice Coffee Milo',
      deskripsi: 'Milo cokelat ketemu kopi, manis dan dingin.',
      harga: { S: 13000, M: 15000, L: 17000 }
    },
    {
      id: 'americano',
      nama: 'Americano',
      deskripsi: 'Kopi hitam dingin yang ringan. Pilihan paling hemat.',
      harga: { S: 7000, M: 8000, L: 9000 }
    }
  ]
};

if (typeof module === 'object' && module.exports) module.exports = CC_CONFIG;
else root.CC_CONFIG = CC_CONFIG;
})(this);
