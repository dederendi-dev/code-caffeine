/*
  PENGATURAN CODE CAFFEINE
  ------------------------
  File ini satu-satunya yang perlu diubah untuk mengganti nomor WA,
  akun media sosial, jadwal, harga, atau menu. Simpan, lalu deploy ulang.
*/
window.CC_CONFIG = {
  // Nomor WhatsApp tujuan pesanan. Format 62xxxxxxxxxx (tanpa +, spasi, atau 0 di depan).
  // Selama kosong, tombol pesan hanya menyalin teks pesanan.
  whatsapp: '',

  // Username tanpa @. Biarkan kosong kalau akunnya belum dibuat (ikon tidak ditampilkan).
  instagram: '',
  tiktok: '',

  // Pengumuman manual yang menimpa status otomatis, misalnya libur atau stok habis.
  // Contoh: { judul: 'Libur dulu', pesan: 'Kami libur sampai Senin, 30 November.' }
  // Biarkan null kalau jadwal normal.
  statusManual: null,

  // Jadwal (sesuai Rencana Praktik Usaha di laporan UTS)
  hariJual: [1, 3, 5],                 // 0 Minggu, 1 Senin, ... 6 Sabtu
  preorder: { buka: '08:00', tutup: '20:00' },   // dibuka H-1
  serahTerima: { mulai: '09:30', selesai: '13:00' },
  slotSerahTerima: ['09.30–10.30', '10.30–11.30', '11.30–13.00'],

  areaAntar: 'kampus UMP dan kos sekitar',
  lokasiAmbil: 'Kembaran',

  ukuran: [
    { id: 'S', nama: 'Small', oz: 12 },
    { id: 'M', nama: 'Medium', oz: 14 },
    { id: 'L', nama: 'Large', oz: 16 }
  ],

  // Harga S/M/L sesuai Excel keuangan kelompok
  menu: [
    {
      id: 'dirty-latte',
      nama: 'Dirty Latte',
      andalan: true,
      deskripsi: 'Susu dingin dengan kopi yang dituang di atasnya. Diminum berlapis atau diaduk dulu, sama-sama enak.',
      harga: { S: 13000, M: 15000, L: 17000 },
      lapisan: [['#F0E5D3', 0.58], ['#4A2916', 0.42]]
    },
    {
      id: 'dalgona',
      nama: 'Dalgona Coffee',
      deskripsi: 'Kopi kocok yang lembut di atas susu dingin.',
      harga: { S: 10000, M: 12000, L: 14000 },
      lapisan: [['#F2E8D8', 0.64], ['#C98A4C', 0.36]],
      busa: true
    },
    {
      id: 'cimory-matcha',
      nama: 'Cimory Matcha Latte',
      deskripsi: 'Matcha susu Cimory yang creamy dan dingin.',
      harga: { S: 13000, M: 15000, L: 17000 },
      lapisan: [['#93AE5E', 0.82], ['#CADBA0', 0.18]]
    },
    {
      id: 'milo',
      nama: 'Ice Coffee Milo',
      deskripsi: 'Milo cokelat ketemu kopi, manis dan dingin.',
      harga: { S: 13000, M: 15000, L: 17000 },
      lapisan: [['#5E3520', 0.55], ['#9A6644', 0.45]]
    },
    {
      id: 'americano',
      nama: 'Americano',
      deskripsi: 'Kopi hitam dingin yang ringan. Pilihan paling hemat.',
      harga: { S: 7000, M: 8000, L: 9000 },
      lapisan: [['#3A2114', 1]],
      bening: true
    }
  ]
};
