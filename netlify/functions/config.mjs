// Menyajikan /assets/js/config.js: pengaturan dasar (file) + perubahan dari master admin.
// Disimpan di cache CDN Netlify (tag "config") dan dibersihkan setiap master admin menyimpan perubahan.
import { getConfig, dasar } from './lib/katalog.mjs';

export const config = { path: '/assets/js/config.js' };

export default async () => {
  let c;
  try { c = await getConfig({ segar: true }); } catch (e) { c = dasar(); }
  const js = `/* Pengaturan Code Caffeine. Dasar: config.js di repo, ditimpa perubahan dari master admin. */
(function (root) {
var CC_CONFIG = ${JSON.stringify(c, null, 1)};
if (typeof module === 'object' && module.exports) module.exports = CC_CONFIG;
else root.CC_CONFIG = CC_CONFIG;
})(this);
`;
  return new Response(js, {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      'netlify-cdn-cache-control': 'public, durable, s-maxage=60, stale-while-revalidate=86400',
      'netlify-cache-tag': 'config'
    }
  });
};
