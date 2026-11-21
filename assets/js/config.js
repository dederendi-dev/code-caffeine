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
      // warna gambar gelas, dari atas ke bawah
      gelas: { cairan: [[0, '#2E1A10'], [0.22, '#4A2B18'], [0.36, '#8A5A38'], [0.46, '#C9A27C'], [0.56, '#E8D9C3'], [1, '#F3EADB']], permukaan: ['#5A3520', '#24140B'] }
    },
    {
      id: 'dalgona',
      nama: 'Dalgona Coffee',
      deskripsi: 'Kopi kocok yang lembut di atas susu dingin.',
      harga: { S: 10000, M: 12000, L: 14000 },
      gelas: { cairan: [[0, '#D39A5E'], [0.2, '#C68B52'], [0.3, '#B98049'], [0.36, '#E9DCC8'], [1, '#F4ECDF']], permukaan: ['#E2AE74', '#C08048'], busa: true }
    },
    {
      id: 'cimory-matcha',
      nama: 'Cimory Matcha Latte',
      deskripsi: 'Matcha susu Cimory yang creamy dan dingin.',
      harga: { S: 13000, M: 15000, L: 17000 },
      gelas: { cairan: [[0, '#C9DA9E'], [0.14, '#A7C176'], [0.5, '#8EAB5A'], [1, '#B9CF8B']], permukaan: ['#CFE0A6', '#9DB86A'] }
    },
    {
      id: 'milo',
      nama: 'Ice Coffee Milo',
      deskripsi: 'Milo cokelat ketemu kopi, manis dan dingin.',
      harga: { S: 13000, M: 15000, L: 17000 },
      gelas: { cairan: [[0, '#A06B47'], [0.3, '#8A5636'], [0.55, '#6A3D24'], [1, '#4E2B17']], permukaan: ['#A87552', '#6B3D22'] }
    },
    {
      id: 'americano',
      nama: 'Americano',
      deskripsi: 'Kopi hitam dingin yang ringan. Pilihan paling hemat.',
      harga: { S: 7000, M: 8000, L: 9000 },
      gelas: { cairan: [[0, '#2A160C'], [0.5, '#3A2012'], [1, '#4A2A17']], permukaan: ['#3B2213', '#1A0D06'], bening: true }
    }
  ]
};
