// Notifikasi ke HP admin (Web Push). Langganan disimpan di store 'langganan'.
// Saat uji lokal, notifikasi dicatat ke file push-log.json, tidak benar-benar dikirim.
import * as webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { store } from './store.mjs';

const subStore = () => store('langganan');
export const subKey = endpoint => crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 32);

export async function simpanLangganan(sub, admin) {
  await subStore().setJSON(subKey(sub.endpoint), { sub, admin, t: new Date().toISOString() });
}

// kecuali: nama admin yang tidak perlu dikabari (yang melakukan aksinya sendiri)
export async function kirimNotif({ title, body, tag, kecuali }) {
  const payload = JSON.stringify({ title, body, tag: tag || 'pesanan', url: '/admin/' });
  if (process.env.CC_LOCAL_DATA) {
    const f = path.join(process.env.CC_LOCAL_DATA, 'push-log.json');
    let log = []; try { log = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { /* baru */ }
    log.push({ ...JSON.parse(payload), kecuali: kecuali || null }); fs.writeFileSync(f, JSON.stringify(log));
    return { sent: 0, logged: true };
  }
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv } = process.env;
  if (!pub || !priv) return { sent: 0, error: 'VAPID belum diatur' };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://codecaffeine-ump.netlify.app', pub, priv);
  const st = subStore();
  const { blobs } = await st.list();
  let sent = 0;
  await Promise.allSettled(blobs.map(async b => {
    const rec = await st.get(b.key, { type: 'json' });
    if (!rec || (kecuali && rec.admin === kecuali)) return;
    try { await webpush.sendNotification(rec.sub, payload, { TTL: 3600, urgency: 'high' }); sent++; }
    catch (err) { if (err.statusCode === 404 || err.statusCode === 410) await st.delete(b.key); }
  }));
  return { sent };
}

// Dipakai saat akses admin dicabut: HP-nya berhenti menerima notifikasi pesanan
export async function hapusLanggananAdmin(nama) {
  const st = subStore();
  const { blobs } = await st.list();
  let n = 0;
  await Promise.all(blobs.map(async b => {
    const rec = await st.get(b.key, { type: 'json' });
    if (rec && rec.admin === nama) { await st.delete(b.key); n++; }
  }));
  return n;
}
