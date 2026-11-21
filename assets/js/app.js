(() => {
  'use strict';
  const C = window.CC_CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const DAY = 86400000;
  const rupiah = n => 'Rp' + n.toLocaleString('id-ID');
  const sizeOf = id => C.ukuran.find(u => u.id === id);
  const drinkOf = id => C.menu.find(m => m.id === id);
  const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const jam = hhmm => hhmm.replace(':', '.');

  /* ================= Waktu (selalu WIB, apa pun zona waktu HP) ================= */
  // Tanggal digeser +7 jam lalu dibaca dengan getUTC*.
  const nowWIB = () => new Date(Date.now() + 7 * 3600000);
  const startOfDay = d => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = ms => new Date(ms).getUTCDay();
  const tanggal = (ms, withYear) => {
    const d = new Date(ms);
    return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}${withYear ? ' ' + d.getUTCFullYear() : ''}`;
  };

  const PO_BUKA = toMin(C.preorder.buka), PO_TUTUP = toMin(C.preorder.tutup);
  const ST_MULAI = toMin(C.serahTerima.mulai), ST_SELESAI = toMin(C.serahTerima.selesai);

  // Hari jual terdekat yang pre-ordernya belum ditutup
  function targetDay(now) {
    const today = startOfDay(now);
    for (let i = 0; i < 15; i++) {
      const d = today + i * DAY;
      if (!C.hariJual.includes(dow(d))) continue;
      if (now.getTime() < d - DAY + PO_TUTUP * 60000) return d;
    }
    return null;
  }

  function status(now) {
    if (C.statusManual) {
      return { state: 'manual', text: [C.statusManual.judul, C.statusManual.pesan].filter(Boolean).join('. ') };
    }
    const today = startOfDay(now);
    const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (C.hariJual.includes(dow(today)) && mins < ST_SELESAI) {
      return mins < ST_MULAI
        ? { state: 'jual', text: `Hari ini hari jual. Pesanan diantar mulai ${jam(C.serahTerima.mulai)}` }
        : { state: 'jual', text: `Hari ini hari jual. Pesanan sedang diantar sampai ${jam(C.serahTerima.selesai)}` };
    }
    const t = targetDay(now);
    if (t === null) return { state: 'soon', text: 'Jadwal jualan berikutnya belum tersedia' };
    const buka = t - DAY + PO_BUKA * 60000, tutup = t - DAY + PO_TUTUP * 60000;
    if (now.getTime() >= buka && now.getTime() < tutup) {
      return { state: 'open', text: `Pre-order untuk ${tanggal(t)} dibuka sampai ${jam(C.preorder.tutup)}` };
    }
    return { state: 'soon', text: `Pre-order untuk ${tanggal(t)} dibuka ${HARI[dow(buka)]} ${jam(C.preorder.buka)}` };
  }

  function renderStatus() {
    const s = status(nowWIB());
    $('.status').dataset.state = s.state;
    $('[data-status-text]').textContent = s.text;
  }

  function renderWeek() {
    const today = startOfDay(nowWIB());
    const html = [];
    for (let i = 0; i < 7; i++) {
      const d = today + i * DAY;
      const w = dow(d);
      const besok = dow(d + DAY);
      let cls = 'libur', info = 'Libur';
      if (C.hariJual.includes(w)) {
        cls = 'jual';
        info = `Hari jual. Antar <span class="nw">${jam(C.serahTerima.mulai)}–${jam(C.serahTerima.selesai)}</span>`;
      } else if (C.hariJual.includes(besok)) {
        cls = 'po';
        info = `Pre-order <span class="nw">${jam(C.preorder.buka)}–${jam(C.preorder.tutup)}</span> untuk ${HARI[besok]}`;
      }
      const dt = new Date(d);
      html.push(`<li class="day ${cls}${i === 0 ? ' today' : ''}">
        <span class="day-name">${HARI[w]}${i === 0 ? '<span class="today-badge">Hari ini</span>' : ''}<small>${dt.getUTCDate()} ${BULAN[dt.getUTCMonth()].slice(0, 3)}</small></span>
        <span class="day-info">${info}</span></li>`);
    }
    $('[data-week]').innerHTML = html.join('');
  }

  /* ================= Gambar gelas ================= */
  let uid = 0;
  const SCALE = { S: [0.9, 0.82], M: [0.95, 0.91], L: [1, 1] };

  function cupSVG(drink, size) {
    const id = 'g' + (++uid);
    const g = drink.gelas;
    const stops = g.cairan.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
    const [sx, sy] = SCALE[size];
    const u = sizeOf(size);
    const iceOpacity = g.bening ? 0.8 : 0.55;
    const foam = g.busa
      ? `<g clip-path="url(#cc-liquid)">${Array.from({ length: 14 }, (_, i) => `<circle cx="${80 + i * 18 + (i % 2) * 6}" cy="${152 + (i % 3) * 5}" r="${10 + (i % 4) * 3}" fill="${g.permukaan[0]}" opacity=".9"/>`).join('')}</g>`
      : '';
    return `<svg viewBox="40 40 320 500" role="img" aria-label="${drink.nama}, ${u.nama} ${u.oz} oz" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${id}l" x1="0" y1="150" x2="0" y2="510" gradientUnits="userSpaceOnUse">${stops}</linearGradient>
        <radialGradient id="${id}s" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="${g.permukaan[0]}"/><stop offset="1" stop-color="${g.permukaan[1]}"/></radialGradient>
      </defs>
      <ellipse cx="200" cy="520" rx="150" ry="20" fill="url(#cc-shadow)"/>
      <g class="cupgrp" data-cupgrp style="transform:scale(${sx},${sy})">
        <g clip-path="url(#cc-liquid)">
          <rect x="40" y="120" width="320" height="420" fill="url(#${id}l)" ${g.bening ? '' : 'filter="url(#cc-marble)"'}/>
          <g opacity="${iceOpacity}">
            <rect x="96" y="170" width="78" height="70" rx="14" transform="rotate(-14 135 205)" fill="url(#cc-ice)" stroke="#fff" stroke-opacity=".5"/>
            <rect x="182" y="188" width="82" height="72" rx="15" transform="rotate(10 223 224)" fill="url(#cc-ice)" stroke="#fff" stroke-opacity=".5"/>
            <rect x="236" y="250" width="66" height="60" rx="13" transform="rotate(-8 269 280)" fill="url(#cc-ice)" stroke="#fff" stroke-opacity=".45"/>
            <rect x="118" y="262" width="70" height="62" rx="13" transform="rotate(18 153 293)" fill="url(#cc-ice)" stroke="#fff" stroke-opacity=".4"/>
          </g>
        </g>
        <ellipse cx="200" cy="150" rx="132" ry="20" fill="url(#${id}s)"/>
        ${foam}
        <ellipse cx="180" cy="146" rx="60" ry="6" fill="#fff" opacity=".08"/>
        <path d="M118,132 q4,-26 30,-24 l42,4 q22,3 18,26 l-3,14 q-60,10 -88,-6 z" fill="url(#cc-ice)" stroke="#fff" stroke-opacity=".8" stroke-width="1.2"/>
        <path d="M206,140 q2,-24 26,-25 l40,1 q20,2 18,22 l-2,14 q-50,8 -82,-2 z" fill="url(#cc-ice)" stroke="#fff" stroke-opacity=".75" stroke-width="1.2"/>
        <path d="M128,118 l40,-2 M216,124 l38,-3" stroke="#fff" stroke-opacity=".9" stroke-width="2" stroke-linecap="round"/>
        <g clip-path="url(#cc-body)">
          <rect x="40" y="60" width="320" height="480" fill="#fff" opacity=".06"/>
          <rect x="40" y="60" width="320" height="480" fill="url(#cc-edge)"/>
          <path d="M86,110 L118,490" stroke="url(#cc-sheen)" stroke-width="22" stroke-linecap="round" opacity=".7"/>
          <path d="M100,110 L128,480" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
          <path d="M316,120 L290,480" stroke="#fff" stroke-opacity=".18" stroke-width="8" stroke-linecap="round" filter="url(#cc-blur)"/>
          <g filter="url(#cc-soft)" fill="url(#cc-drop)">
            <ellipse cx="270" cy="330" rx="4" ry="5"/><ellipse cx="252" cy="372" rx="3" ry="4"/><ellipse cx="282" cy="402" rx="5" ry="6.5"/>
            <ellipse cx="148" cy="404" rx="3.5" ry="4.5"/><ellipse cx="166" cy="438" rx="2.5" ry="3"/><ellipse cx="238" cy="452" rx="4" ry="5"/>
            <ellipse cx="200" cy="420" rx="2.5" ry="3.2"/><ellipse cx="128" cy="360" rx="2.8" ry="3.6"/><ellipse cx="290" cy="290" rx="2.6" ry="3.2"/>
          </g>
        </g>
        <path class="cup-edge" d="M62,92 L102,506 A98,15 0 0 0 298,506 L338,92" fill="none" stroke-width="1.6"/>
        <ellipse class="cup-rim" cx="200" cy="92" rx="138" ry="22" fill="none" stroke-width="2.2"/>
        <path d="M90,84 A138,22 0 0 1 250,72" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2.5" stroke-linecap="round"/>
        <ellipse class="cup-edge" cx="200" cy="506" rx="98" ry="15" fill="none" stroke-width="1.4"/>
      </g>
    </svg>`;
  }

  /* ================= Keranjang ================= */
  const KEY = 'cc-pesanan-v1';
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY) || '[]').filter(i => drinkOf(i.id) && sizeOf(i.size) && i.qty > 0); } catch (e) { cart = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* penyimpanan tidak tersedia */ } };
  const priceOf = i => drinkOf(i.id).harga[i.size];
  const cartCount = () => cart.reduce((a, i) => a + i.qty, 0);
  const cartTotal = () => cart.reduce((a, i) => a + i.qty * priceOf(i), 0);

  function addToCart(id, size) {
    const found = cart.find(i => i.id === id && i.size === size);
    if (found) found.qty += 1; else cart.push({ id, size, qty: 1 });
    save(); renderCart();
  }
  function changeQty(id, size, delta) {
    const found = cart.find(i => i.id === id && i.size === size);
    if (!found) return;
    found.qty += delta;
    if (found.qty <= 0) cart = cart.filter(i => i !== found);
    save(); renderCart();
  }

  /* ================= Menu ================= */
  const priceHTML = (d, size) => `${rupiah(d.harga[size])}<small>${sizeOf(size).nama}, ${sizeOf(size).oz} oz</small>`;

  function renderMenu() {
    $('[data-drinks]').innerHTML = C.menu.map(d => `
      <article class="card${d.andalan ? ' featured' : ''}" data-drink="${d.id}">
        <div class="card-cup">${cupSVG(d, 'M')}</div>
        <div class="card-title"><h3>${d.nama}</h3>${d.andalan ? '<span class="badge">Andalan</span>' : ''}</div>
        <p class="card-desc">${d.deskripsi}</p>
        <fieldset class="sizes">
          <legend>Ukuran ${d.nama}</legend>
          ${C.ukuran.map(u => `<label><input type="radio" name="size-${d.id}" value="${u.id}"${u.id === 'M' ? ' checked' : ''}><span>${u.nama}</span></label>`).join('')}
        </fieldset>
        <div class="card-foot">
          <p class="price" data-price aria-live="polite">${priceHTML(d, 'M')}</p>
          <button type="button" class="btn btn-solid" data-add>Tambah</button>
        </div>
        <p class="in-cart" data-in-cart></p>
      </article>`).join('');

    $$('[data-drink]').forEach(card => {
      const d = drinkOf(card.dataset.drink);
      card.addEventListener('change', e => {
        if (!e.target.name || !e.target.name.startsWith('size-')) return;
        const size = e.target.value;
        const [sx, sy] = SCALE[size];
        $('[data-cupgrp]', card).style.transform = `scale(${sx},${sy})`;
        $('.card-cup svg', card).setAttribute('aria-label', `${d.nama}, ${sizeOf(size).nama} ${sizeOf(size).oz} oz`);
        $('[data-price]', card).innerHTML = priceHTML(d, size);
      });
      $('[data-add]', card).addEventListener('click', e => {
        const size = $(`input[name="size-${d.id}"]:checked`, card).value;
        addToCart(d.id, size);
        const btn = e.currentTarget;
        btn.classList.add('added');
        btn.textContent = 'Ditambahkan';
        clearTimeout(btn._t);
        btn._t = setTimeout(() => { btn.classList.remove('added'); btn.textContent = 'Tambah'; }, 1300);
      });
    });
  }

  /* ================= Lembar pesanan ================= */
  const sheet = $('[data-sheet]');
  const form = $('[data-order-form]');
  const sent = $('[data-sent]');
  let lastFocus = null;

  function renderCart() {
    const n = cartCount();
    $$('[data-cart-count]').forEach(el => { el.textContent = n; el.hidden = n === 0; });
    $('[data-cartbar]').hidden = n === 0 || sheet.open;
    $('[data-cartbar-count]').textContent = `${n} minuman`;
    $('[data-cartbar-total]').textContent = rupiah(cartTotal());

    $$('[data-drink]').forEach(card => {
      const q = cart.filter(i => i.id === card.dataset.drink).reduce((a, i) => a + i.qty, 0);
      $('[data-in-cart]', card).textContent = q ? `${q} di pesananmu` : '';
    });

    $('[data-cart-list]').innerHTML = cart.map(i => {
      const d = drinkOf(i.id), u = sizeOf(i.size);
      return `<li class="cart-item">
        <span class="ci-name">${d.nama}</span>
        <span class="stepper">
          <button type="button" data-qty="-1" data-id="${i.id}" data-size="${i.size}" aria-label="Kurangi ${d.nama} ${u.nama}">−</button>
          <output aria-live="polite">${i.qty}</output>
          <button type="button" data-qty="1" data-id="${i.id}" data-size="${i.size}" aria-label="Tambah ${d.nama} ${u.nama}">+</button>
        </span>
        <span class="ci-meta">${u.nama} ${u.oz} oz, ${rupiah(priceOf(i))} × ${i.qty} = ${rupiah(priceOf(i) * i.qty)}</span>
      </li>`;
    }).join('');
    $('[data-cart-empty]').hidden = n > 0;
    $('[data-cart-total-row]').hidden = n === 0;
    $('[data-cart-total]').textContent = rupiah(cartTotal());
    $('[data-fields]').disabled = n === 0;
    $('[data-send]').disabled = n === 0;
  }

  function openSheet() {
    lastFocus = document.activeElement;
    form.hidden = false; sent.hidden = true;
    const t = targetDay(nowWIB());
    $('[data-target-day]').textContent = t ? `Untuk hari jual ${tanggal(t, true)}` : '';
    hideError();
    document.documentElement.classList.add('lock');
    sheet.showModal();
    renderCart();
  }
  function closeSheet() { sheet.close(); }
  sheet.addEventListener('close', () => {
    document.documentElement.classList.remove('lock');
    renderCart();
    if (lastFocus) lastFocus.focus();
  });
  sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
  $$('[data-open-order]').forEach(b => b.addEventListener('click', openSheet));
  $$('[data-close-sheet]').forEach(b => b.addEventListener('click', closeSheet));
  $('[data-cart-list]').addEventListener('click', e => {
    const b = e.target.closest('[data-qty]');
    if (b) changeQty(b.dataset.id, b.dataset.size, Number(b.dataset.qty));
  });

  $('[data-slot-select]').innerHTML = C.slotSerahTerima.map(s => `<option>${s}</option>`).join('') + '<option>Kapan saja di jam antar</option>';

  function syncLokasi() {
    $('[data-lokasi-field]').hidden = form.elements.cara_terima.value !== 'Diantar';
  }
  form.addEventListener('change', e => { if (e.target.name === 'cara_terima') syncLokasi(); });
  form.addEventListener('input', e => { if (e.target.hasAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid'); });
  syncLokasi();

  function showError(msg, field) {
    const el = $('[data-form-error]');
    el.textContent = msg; el.hidden = false;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }
  function hideError() {
    $('[data-form-error]').hidden = true;
    $$('[aria-invalid]', form).forEach(f => f.removeAttribute('aria-invalid'));
  }

  function buildMessage(v, t) {
    const lines = cart.map(i => {
      const d = drinkOf(i.id), u = sizeOf(i.size);
      return `- ${i.qty}x ${d.nama} ${u.nama} (${u.oz} oz) = ${rupiah(priceOf(i) * i.qty)}`;
    });
    const terima = v.cara_terima === 'Diantar' ? `Diantar ke ${v.lokasi}` : `Ambil sendiri di ${C.lokasiAmbil}`;
    return [
      'Halo Code Caffeine, saya mau pre-order.',
      '',
      `Nama: ${v.nama}`,
      `Untuk: ${t ? tanggal(t, true) : '-'}`,
      '',
      'Pesanan:',
      ...lines,
      `Total: ${rupiah(cartTotal())}`,
      '',
      `Cara terima: ${terima}`,
      `Jam: ${v.jam}`,
      `Bayar: ${v.bayar}`,
      `Sudah pernah beli: ${v.pernah_beli}`,
      v.catatan ? `Catatan: ${v.catatan}` : null
    ].filter(l => l !== null).join('\n');
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    hideError();
    if (cartCount() === 0) return showError('Pesanan masih kosong. Pilih minuman dulu dari menu.');
    const f = form.elements;
    const v = {
      nama: f.nama.value.trim(),
      cara_terima: f.cara_terima.value,
      lokasi: f.lokasi.value.trim(),
      jam: f.jam.value,
      bayar: f.bayar.value,
      pernah_beli: f.pernah_beli.value,
      catatan: f.catatan.value.trim()
    };
    if (!v.nama) return showError('Tulis nama untuk pesanan ini.', f.nama);
    if (v.cara_terima === 'Diantar' && !v.lokasi) return showError('Tulis lokasi antar, misalnya gedung di kampus UMP atau nama kos.', f.lokasi);

    const t = targetDay(nowWIB());
    const msg = buildMessage(v, t);

    // Catatan pesanan untuk kelompok (Netlify Forms). Gagal mencatat tidak menghalangi pesanan.
    f.untuk_hari.value = t ? tanggal(t, true) : '';
    f.pesanan.value = cart.map(i => `${i.qty}x ${drinkOf(i.id).nama} ${sizeOf(i.size).nama}`).join('; ');
    f.jumlah_cup.value = String(cartCount());
    f.total.value = String(cartTotal());
    try {
      if (location.protocol.startsWith('http') && navigator.sendBeacon) {
        navigator.sendBeacon('/', new URLSearchParams(new FormData(form)));
      }
    } catch (err) { /* abaikan */ }

    const again = $('[data-wa-again]');
    if (C.whatsapp) {
      const url = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank', 'noopener');
      again.href = url; again.hidden = false;
    } else {
      again.hidden = true;
      if (navigator.clipboard) navigator.clipboard.writeText(msg).catch(() => {});
      $('[data-sent-text]').textContent = 'Nomor WhatsApp pesanan belum diatur, jadi teks pesananmu kami salin. Tempel di chat WhatsApp Code Caffeine.';
    }
    form.hidden = true;
    sent.hidden = false;
    $('h2', sent).focus();
  });

  $('[data-finish]').addEventListener('click', () => {
    cart = []; save(); form.reset(); syncLokasi(); renderCart(); closeSheet();
  });

  /* ================= Sosial ================= */
  function renderSocial() {
    const items = [];
    if (C.instagram) items.push(`<li><a href="https://instagram.com/${C.instagram}" target="_blank" rel="noopener">Instagram @${C.instagram}</a></li>`);
    if (C.tiktok) items.push(`<li><a href="https://www.tiktok.com/@${C.tiktok}" target="_blank" rel="noopener">TikTok @${C.tiktok}</a></li>`);
    if (C.whatsapp) items.push(`<li><a href="https://wa.me/${C.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></li>`);
    const ul = $('[data-social]');
    ul.innerHTML = items.join('');
    ul.hidden = items.length === 0;
  }

  /* ================= Mulai ================= */
  $('[data-hero-cup]').innerHTML = cupSVG(drinkOf('dirty-latte'), 'L');
  renderMenu();
  renderStatus();
  renderWeek();
  renderSocial();
  renderCart();
  setInterval(renderStatus, 60000);
})();
