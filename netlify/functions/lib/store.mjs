// Penyimpanan pesanan. Di Netlify memakai Netlify Blobs (konsistensi kuat);
// saat uji lokal (CC_LOCAL_DATA diisi) memakai file JSON di folder tersebut.
import { getStore } from '@netlify/blobs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function store(name) {
  if (process.env.CC_LOCAL_DATA) return localStore(path.join(process.env.CC_LOCAL_DATA, name));
  return getStore({ name, consistency: 'strong' });
}

function localStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = k => path.join(dir, encodeURIComponent(k) + '.json');
  const etagOf = text => crypto.createHash('sha1').update(text).digest('hex');
  const read = k => { try { return fs.readFileSync(file(k), 'utf8'); } catch (e) { return null; } };
  const bin = k => file(k) + '.bin';
  const meta = k => { try { return JSON.parse(fs.readFileSync(file(k) + '.meta', 'utf8')); } catch (e) { return {}; } };
  return {
    async get(k, opt = {}) {
      if (opt.type === 'arrayBuffer') { try { const b = fs.readFileSync(bin(k)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } catch (e) { return null; } }
      const t = read(k); return t === null ? null : (opt.type === 'json' ? JSON.parse(t) : t);
    },
    async getWithMetadata(k, opt = {}) {
      if (opt.type === 'arrayBuffer') { const d = await this.get(k, opt); return d && { data: d, etag: '', metadata: meta(k) }; }
      const t = read(k); if (t === null) return null;
      return { data: opt.type === 'json' ? JSON.parse(t) : t, etag: etagOf(t), metadata: {} };
    },
    async set(k, data, opt = {}) {
      fs.writeFileSync(bin(k), Buffer.from(data));
      fs.writeFileSync(file(k) + '.meta', JSON.stringify(opt.metadata || {}));
      return { modified: true };
    },
    async setJSON(k, v, opt = {}) {
      const cur = read(k);
      if (opt.onlyIfNew && cur !== null) return { modified: false };
      if (opt.onlyIfMatch && (cur === null || etagOf(cur) !== opt.onlyIfMatch)) return { modified: false };
      const t = JSON.stringify(v); fs.writeFileSync(file(k), t); return { modified: true, etag: etagOf(t) };
    },
    async delete(k) { for (const f of [file(k), bin(k), file(k) + '.meta']) { try { fs.unlinkSync(f); } catch (e) { /* sudah tidak ada */ } } },
    async list(opt = {}) {
      const blobs = fs.readdirSync(dir).filter(n => n.endsWith('.json'))
        .map(n => decodeURIComponent(n.slice(0, -5)))
        .filter(k => !opt.prefix || k.startsWith(opt.prefix)).map(key => ({ key }));
      return { blobs, directories: [] };
    }
  };
}

// Ubah data secara atomik: baca + etag, ubah, tulis hanya kalau belum diubah orang lain. Coba ulang sampai 5x.
export async function update(st, key, fn) {
  for (let i = 0; i < 5; i++) {
    const cur = await st.getWithMetadata(key, { type: 'json' });
    if (!cur) return { notFound: true };
    const next = fn(structuredClone(cur.data));
    if (next && next.error) return next;
    if (!next) return { data: cur.data, unchanged: true };
    const res = await st.setJSON(key, next, { onlyIfMatch: cur.etag });
    if (res.modified) return { data: next };
  }
  return { error: 'Data sedang diubah, coba lagi sebentar.', code: 409 };
}
