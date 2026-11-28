/* Panduan interaktif: layar digelapkan, satu bagian disorot, kartu menjelaskan apa yang perlu ditekan.
   Dipakai web utama (cara pesan) dan CC Admin.
   CCTur.mulai(langkah, { kunci })  langkah: [{ el: selector|fungsi|null, judul, teks }]
   CCTur.sudah(kunci) -> true kalau panduan ini pernah selesai/dilewati di HP ini. */
(function () {
  'use strict';
  const CSS = `
  .tur { position: fixed; inset: 0; z-index: 9999; }
  .tur-bg { position: absolute; inset: 0; background: rgba(8, 5, 3, .74); }
  .tur.ada-spot .tur-bg { background: transparent; }
  .tur-spot { position: absolute; border-radius: 16px; box-shadow: 0 0 0 9999px rgba(8, 5, 3, .74), 0 0 0 2px rgba(242, 180, 108, .95);
    transition: left .25s, top .25s, width .25s, height .25s; pointer-events: none; }
  .tur-kartu { position: absolute; width: min(340px, calc(100vw - 24px)); padding: 16px 16px 14px; border-radius: 18px;
    background: var(--sheet-bg, var(--bg2, #1f1611)); color: var(--ink, #f5ecdf); box-shadow: 0 18px 50px rgba(0, 0, 0, .45);
    border: 1px solid var(--line-strong, var(--line2, rgba(255, 255, 255, .16))); font-family: var(--f-body, system-ui, sans-serif);
    transition: left .25s, top .25s; }
  .tur-kartu:focus { outline: none; }
  .tur-nomor { font-size: 12.5px; font-weight: 600; color: var(--accent, var(--c-baru, #dda56c)); }
  .tur-kartu h2 { margin: 4px 0 6px; font: 700 18px/1.25 var(--f-display, var(--f-head, system-ui, sans-serif)); }
  .tur-kartu p { margin: 0; font-size: 14.5px; line-height: 1.5; color: var(--ink2, rgba(245, 236, 223, .75)); }
  .tur-aksi { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
  .tur-aksi .tur-lewati { margin-right: auto; background: none; border: 0; padding: 6px 0; color: var(--ink2, rgba(245, 236, 223, .7)); font: inherit; font-size: 14px; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .tur-aksi button.tur-b { min-height: 38px; padding: 0 16px; border-radius: 999px; font: 600 14px/1 var(--f-body, system-ui, sans-serif); cursor: pointer;
    border: 1px solid var(--line-strong, var(--line2, rgba(255, 255, 255, .2))); background: transparent; color: var(--ink, #f5ecdf); }
  .tur-aksi button.tur-utama { background: var(--btn-bg, var(--btn, #f3e9da)); color: var(--btn-ink, #1a100a); border-color: transparent; }
  .tur-titik { display: flex; gap: 5px; margin-top: 12px; }
  .tur-titik i { width: 6px; height: 6px; border-radius: 50%; background: var(--ink3, rgba(245, 236, 223, .35)); }
  .tur-titik i.on { background: var(--accent, var(--c-baru, #dda56c)); width: 16px; border-radius: 3px; }
  @media (prefers-reduced-motion: reduce) { .tur-spot, .tur-kartu { transition: none; } }`;

  let root, langkah = [], i = 0, kunci = '', target = null, lastFocus = null, tick = 0;
  const simpan = () => { try { localStorage.setItem('cc-tur-' + kunci, '1'); } catch (e) { /* abaikan */ } };
  const sudah = k => { try { return localStorage.getItem('cc-tur-' + k) === '1'; } catch (e) { return false; } };

  function cari(s) {
    const el = typeof s === 'function' ? s() : (s ? document.querySelector(s) : null);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? el : null;
  }
  function pasang() {
    if (!document.getElementById('tur-css')) {
      const st = document.createElement('style'); st.id = 'tur-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    root = document.createElement('div');
    root.className = 'tur';
    root.innerHTML = `<div class="tur-bg"></div><div class="tur-spot" hidden></div>
      <div class="tur-kartu" role="dialog" aria-modal="true" aria-labelledby="tur-judul" tabindex="-1">
        <div class="tur-nomor" aria-hidden="true"></div><h2 id="tur-judul"></h2><p aria-live="polite"></p>
        <div class="tur-titik" aria-hidden="true"></div>
        <div class="tur-aksi"><button type="button" class="tur-lewati">Lewati</button><button type="button" class="tur-b tur-kembali">Kembali</button><button type="button" class="tur-b tur-utama tur-lanjut">Lanjut</button></div>
      </div>`;
    document.body.appendChild(root);
    root.querySelector('.tur-lewati').addEventListener('click', () => tutup());
    root.querySelector('.tur-kembali').addEventListener('click', () => ke(i - 1));
    root.querySelector('.tur-lanjut').addEventListener('click', () => (i < langkah.length - 1 ? ke(i + 1) : tutup()));
    root.querySelector('.tur-bg').addEventListener('click', e => e.stopPropagation());
    document.addEventListener('keydown', kunciTombol, true);
    addEventListener('resize', atur); addEventListener('scroll', atur, true);
    document.documentElement.style.overflow = 'hidden';
  }
  function kunciTombol(e) {
    if (!root) return;
    if (e.key === 'Escape') { e.preventDefault(); tutup(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); root.querySelector('.tur-lanjut').click(); }
    else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); ke(i - 1); }
    else if (e.key === 'Tab') {   // fokus tetap di dalam kartu
      const b = [...root.querySelectorAll('button')], a = document.activeElement;
      if (e.shiftKey && a === b[0]) { e.preventDefault(); b[b.length - 1].focus(); }
      else if (!e.shiftKey && a === b[b.length - 1]) { e.preventDefault(); b[0].focus(); }
    }
  }
  function atur() {
    if (!root) return;
    cancelAnimationFrame(tick);
    tick = requestAnimationFrame(() => {
      const spot = root.querySelector('.tur-spot'), kartu = root.querySelector('.tur-kartu');
      const vw = innerWidth, vh = innerHeight, kw = kartu.offsetWidth, kh = kartu.offsetHeight;
      if (!target) {
        root.classList.remove('ada-spot'); spot.hidden = true;
        kartu.style.left = Math.round((vw - kw) / 2) + 'px'; kartu.style.top = Math.round((vh - kh) / 2) + 'px';
        return;
      }
      const r = target.getBoundingClientRect(), pad = 8;
      const box = { l: Math.max(6, r.left - pad), t: Math.max(6, r.top - pad), r: Math.min(vw - 6, r.right + pad), b: Math.min(vh - 6, r.bottom + pad) };
      root.classList.add('ada-spot'); spot.hidden = false;
      Object.assign(spot.style, { left: box.l + 'px', top: box.t + 'px', width: (box.r - box.l) + 'px', height: (box.b - box.t) + 'px' });
      let top = box.b + 12;
      if (top + kh > vh - 10) top = box.t - kh - 12;          // tidak muat di bawah: taruh di atas
      if (top < 10) top = Math.max(10, vh - kh - 10);          // tidak muat dua-duanya: di bawah layar
      const left = Math.min(Math.max(12, (box.l + box.r) / 2 - kw / 2), vw - kw - 12);
      kartu.style.left = Math.round(left) + 'px'; kartu.style.top = Math.round(top) + 'px';
    });
  }
  function ke(n) {
    i = Math.max(0, Math.min(langkah.length - 1, n));
    const L = langkah[i];
    target = cari(L.el);
    const kartu = root.querySelector('.tur-kartu');
    root.querySelector('.tur-nomor').textContent = `Langkah ${i + 1} dari ${langkah.length}`;
    root.querySelector('#tur-judul').textContent = L.judul;
    root.querySelector('.tur-kartu p').textContent = L.teks;
    root.querySelector('.tur-titik').innerHTML = langkah.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('');
    root.querySelector('.tur-kembali').hidden = i === 0;
    root.querySelector('.tur-lanjut').textContent = i === langkah.length - 1 ? (L.tombol || 'Mengerti') : 'Lanjut';
    if (target) {
      document.documentElement.style.overflow = '';
      const halus = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ block: 'center', behavior: halus ? 'smooth' : 'auto' });
      setTimeout(() => { document.documentElement.style.overflow = 'hidden'; atur(); }, halus ? 420 : 30);
    }
    atur();
    kartu.focus({ preventScroll: true });
  }
  function tutup() {
    if (!root) return;
    simpan();
    document.removeEventListener('keydown', kunciTombol, true);
    removeEventListener('resize', atur); removeEventListener('scroll', atur, true);
    root.remove(); root = null; target = null;
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function mulai(daftar, opsi) {
    if (root) tutup();
    langkah = daftar.filter(Boolean); kunci = (opsi && opsi.kunci) || 'umum';
    if (!langkah.length) return;
    lastFocus = document.activeElement;
    pasang(); ke(0);
  }
  window.CCTur = { mulai, sudah, tutup };
})();
