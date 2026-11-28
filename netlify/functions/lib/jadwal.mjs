// Jadwal pre-order (salinan logika events/openEvent di public/assets/js/app.js). Semua waktu WIB.
import C from '../../../public/assets/js/config.js';

const DAY = 86400000;
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const startOfDay = d => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const parseWIB = str => {
  const [d, t = '00:00'] = str.split(' ');
  const [y, m, dd] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return Date.UTC(y, m - 1, dd, h, mi);
};
export const nowWIB = (ms = Date.now()) => new Date(ms + 7 * 3600000);
export const tanggal = ms => { const d = new Date(ms); return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

export function events(now) {
  const today = startOfDay(now);
  const list = [];
  for (let i = -1; i < 15; i++) {
    const d = today + i * DAY;
    if (!C.hariJual.includes(new Date(d).getUTCDay())) continue;
    list.push({
      day: d,
      buka: d - DAY + toMin(C.preorder.buka) * 60000,
      tutup: d - DAY + toMin(C.preorder.tutup) * 60000,
      mulai: d + toMin(C.serahTerima.mulai) * 60000,
      selesai: d + toMin(C.serahTerima.selesai) * 60000,
      slot: C.slotSerahTerima
    });
  }
  (C.jadwalKhusus || []).forEach(k => {
    const d = parseWIB(k.tanggal);
    list.push({
      day: d,
      buka: parseWIB(k.poBuka),
      tutup: parseWIB(k.poTutup),
      mulai: d + toMin(k.serahTerima.mulai) * 60000,
      selesai: d + toMin(k.serahTerima.selesai) * 60000,
      slot: k.slot || C.slotSerahTerima
    });
  });
  return list.filter(e => e.selesai > now.getTime() - DAY).sort((a, b) => a.day - b.day);
}

export const openEvent = now => events(now).find(e => now.getTime() >= e.buka && now.getTime() < e.tutup) || null;
export const jamMs = ms => { const d = new Date(ms); return `${String(d.getUTCHours()).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')}`; };
