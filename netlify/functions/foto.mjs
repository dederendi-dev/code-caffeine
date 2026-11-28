// Foto menu yang diunggah dari master admin: /foto/<hash>.webp (disimpan di Netlify Blobs, store 'foto').
import { store } from './lib/store.mjs';

export const config = { path: '/foto/*' };
const TIPE = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' };

export default async (req) => {
  const name = new URL(req.url).pathname.split('/').pop();
  const m = name.match(/^[a-f0-9]{16}\.(webp|png|jpg)$/);
  if (!m) return new Response('Tidak ditemukan', { status: 404 });
  const r = await store('foto').getWithMetadata(name, { type: 'arrayBuffer' });
  if (!r || !r.data) return new Response('Tidak ditemukan', { status: 404 });
  return new Response(r.data, {
    headers: {
      'content-type': TIPE[m[1]],
      'cache-control': 'public, max-age=31536000, immutable',
      'netlify-cdn-cache-control': 'public, durable, max-age=31536000, immutable'
    }
  });
};
