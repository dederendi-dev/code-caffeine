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
  // Tanggal "bergeser" +7 jam; baca dengan getUTC*.
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
      const tutup = d - DAY + PO_TUTUP * 60000;
      if (now.getTime() < tutup) return d;
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
        ? { state: 'jual', text: `Hari ini hari jual. Pesanan diantar mulai pukul ${jam(C.serahTerima.mulai)}.` }
        : { state: 'jual', text: `Hari ini hari jual. Pesanan sedang diantar sampai pukul ${jam(C.serahTerima.selesai)}.` };
    }
    const t = targetDay(now);
    if (t === null) return { state: 'soon', text: 'Jadwal jualan berikutnya belum tersedia.' };
    const buka = t - DAY + PO_BUKA * 60000, tutup = t - DAY + PO_TUTUP * 60000;
    if (now.getTime() >= buka && now.getTime() < tutup) {
      return { state: 'open', text: `Pre-order untuk ${tanggal(t)} dibuka sampai pukul ${jam(C.preorder.tutup)}.` };
    }
    return { state: 'soon', text: `Pre-order untuk ${tanggal(t)} dibuka ${HARI[dow(buka)]} pukul ${jam(C.preorder.buka)}.` };
  }

  function renderStatus() {
    const s = status(nowWIB());
    const el = $('.console');
    el.dataset.state = s.state;
    $('[data-status-text]').textContent = s.text;
  }

  function renderWeek() {
    const now = nowWIB();
    const today = startOfDay(now);
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

  /* ================= Gelas SVG ================= */
  let uidSeq = 0;
  const SCALE = { S: [0.9, 0.8], M: [0.95, 0.9], L: [1, 1] };

  function cupSVG(drink, size, { big = false, light = false } = {}) {
    const id = 'c' + (++uidSeq);
    const TOP = 30, BOT = 166, LEVEL = 0.84;
    const yLiquid = BOT - (BOT - TOP) * LEVEL;
    // gradien lapisan dari bawah ke atas
    let acc = 0;
    const stops = [];
    drink.lapisan.forEach(([c, f], i) => {
      const from = acc, to = acc + f;
      const blend = i === 0 ? 0 : 0.035;
      stops.push(`<stop offset="${Math.min(1, from + blend)}" stop-color="${c}"/>`);
      stops.push(`<stop offset="${Math.max(0, Math.min(1, to - (i < drink.lapisan.length - 1 ? 0.035 : 0)))}" stop-color="${c}"/>`);
      acc = to;
    });
    const stroke = light ? 'rgba(53,37,28,.42)' : 'rgba(255,255,255,.7)';
    const glassFill = light ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.08)';
    const liquidOpacity = drink.bening ? 0.9 : 1;
    const ice = [
      [34, yLiquid + 8, -12], [62, yLiquid + 2, 9], [46, yLiquid + 26, 18], [70, yLiquid + 30, -6]
    ].map(([x, y, r]) => `<rect x="${x}" y="${y}" width="22" height="20" rx="5" transform="rotate(${r} ${x + 11} ${y + 10})" fill="rgba(255,255,255,${drink.bening ? .26 : .2})" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/>`).join('');
    const foam = drink.busa
      ? Array.from({ length: 9 }, (_, i) => `<circle cx="${18 + i * 10.5}" cy="${yLiquid + 1}" r="${5 + (i % 3)}" fill="${drink.lapisan[drink.lapisan.length - 1][0]}"/>`).join('')
      : '';
    const drops = big
      ? [[86, 92, 2.2], [92, 118, 1.6], [81, 136, 2], [30, 120, 1.5], [88, 70, 1.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,.55)"/>`).join('')
      : '';
    const [sx, sy] = SCALE[size];
    const cupPath = 'M14,30 L106,30 L95,160 Q94,166 88,166 L32,166 Q26,166 25,160 Z';
    return `<svg viewBox="0 -14 120 184" role="img" aria-label="${drink.nama}, ${sizeOf(size).nama} ${sizeOf(size).oz} oz" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="${id}k"><path d="${cupPath}"/></clipPath>
        <linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="${BOT}" x2="0" y2="${yLiquid}">${stops.join('')}</linearGradient>
        <linearGradient id="${id}h" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      </defs>
      <g class="cupgrp" data-cupgrp style="transform:scale(${sx},${sy})">
        <rect x="58" y="-12" width="8" height="150" rx="4" transform="rotate(9 62 60)" fill="#8A3F1F"/>
        <path d="${cupPath}" fill="${glassFill}"/>
        <g clip-path="url(#${id}k)">
          <rect x="0" y="${yLiquid}" width="120" height="${BOT - yLiquid + 2}" fill="url(#${id}g)" opacity="${liquidOpacity}"/>
          ${foam}${ice}
          <path d="M22,36 L31,158" stroke="url(#${id}h)" stroke-width="7" stroke-linecap="round" opacity=".8"/>
          <path d="M98,36 L89,156" stroke="rgba(0,0,0,.14)" stroke-width="6"/>
        </g>
        <path d="${cupPath}" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round"/>
        <rect x="10" y="22" width="100" height="11" rx="5" fill="${light ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.28)'}" stroke="${stroke}" stroke-width="2"/>
        ${drops}
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
  function renderMenu() {
    $('[data-drinks]').innerHTML = C.menu.map(d => `
      <li class="drink" data-drink="${d.id}">
        <div class="drink-cup" data-mini-cup>${cupSVG(d, 'M', { light: true })}</div>
        <div class="drink-name"><h3>${d.nama}</h3>${d.andalan ? '<span class="tag">Andalan</span>' : ''}</div>
        <p class="drink-desc">${d.deskripsi}</p>
        <div class="drink-order">
          <fieldset class="sizes">
            <legend>Ukuran ${d.nama}</legend>
            ${C.ukuran.map(u => `<label><input type="radio" name="size-${d.id}" value="${u.id}"${u.id === 'M' ? ' checked' : ''}><span class="opt"><b>${u.nama}</b><span>${rupiah(d.harga[u.id])}</span></span></label>`).join('')}
          </fieldset>
          <div class="add-row">
            <button type="button" class="btn btn-primary" data-add="${d.id}">Tambah ke pesanan</button>
            <span class="in-cart" data-in-cart="${d.id}" hidden></span>
          </div>
        </div>
      </li>`).join('');

    $$('[data-drink]').forEach(li => {
      const id = li.dataset.drink;
      li.addEventListener('change', e => {
        if (!e.target.name || !e.target.name.startsWith('size-')) return;
        const [sx, sy] = SCALE[e.target.value];
        const g = $('[data-cupgrp]', li);
        g.style.transform = `scale(${sx},${sy})`;
        $('svg', li).setAttribute('aria-label', `${drinkOf(id).nama}, ${sizeOf(e.target.value).nama} ${sizeOf(e.target.value).oz} oz`);
      });
      $('[data-add]', li).addEventListener('click', e => {
        const size = $(`input[name="size-${id}"]:checked`, li).value;
        addToCart(id, size);
        const btn = e.currentTarget;
        btn.classList.add('added');
        btn.textContent = `${sizeOf(size).nama} ditambahkan`;
        clearTimeout(btn._t);
        btn._t = setTimeout(() => { btn.classList.remove('added'); btn.textContent = 'Tambah ke pesanan'; }, 1300);
      });
    });
  }

  function renderCart() {
    const n = cartCount();
    $$('[data-cart-count]').forEach(el => { el.textContent = n; });
    const bar = $('[data-cartbar]');
    bar.hidden = n === 0 || sheet.open;
    $('[data-cartbar-count]').textContent = `${n} minuman`;
    $('[data-cartbar-total]').textContent = rupiah(cartTotal());

    C.menu.forEach(d => {
      const q = cart.filter(i => i.id === d.id).reduce((a, i) => a + i.qty, 0);
      const el = $(`[data-in-cart="${d.id}"]`);
      if (!el) return;
      el.hidden = q === 0;
      el.textContent = `${q} di pesanan`;
    });

    const list = $('[data-cart-list]');
    list.innerHTML = cart.map(i => {
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

  /* ================= Lembar pesanan ================= */
  const sheet = $('[data-sheet]');
  const form = $('[data-order-form]');
  const sent = $('[data-sent]');
  let lastFocus = null;

  function openSheet() {
    lastFocus = document.activeElement;
    form.hidden = false; sent.hidden = true;
    const t = targetDay(nowWIB());
    $('[data-target-day]').textContent = t ? `Untuk hari jual ${tanggal(t, true)}` : '';
    hideError();
    renderCart();
    document.documentElement.classList.add('lock');
    sheet.showModal();
    $('[data-cartbar]').hidden = true;
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

  // Jam serah terima
  $('[data-slot-select]').innerHTML = C.slotSerahTerima.map(s => `<option>${s}</option>`).join('') + '<option>Kapan saja di jam antar</option>';

  // Lokasi hanya untuk diantar
  function syncLokasi() {
    const antar = form.elements.cara_terima.value === 'Diantar';
    $('[data-lokasi-field]').hidden = !antar;
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
    const terima = v.cara_terima === 'Diantar'
      ? `Diantar ke ${v.lokasi}`
      : `Ambil sendiri di ${C.lokasiAmbil}`;
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

  let lastWa = '';
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

    // Catatan pesanan untuk kelompok (Netlify Forms)
    f.untuk_hari.value = t ? tanggal(t, true) : '';
    f.pesanan.value = cart.map(i => `${i.qty}x ${drinkOf(i.id).nama} ${sizeOf(i.size).nama}`).join('; ');
    f.jumlah_cup.value = String(cartCount());
    f.total.value = String(cartTotal());
    try {
      if (location.protocol.startsWith('http') && navigator.sendBeacon) {
        navigator.sendBeacon('/', new URLSearchParams(new FormData(form)));
      }
    } catch (err) { /* pencatatan gagal tidak menghalangi pesanan */ }

    const sentText = $('.sent p');
    if (C.whatsapp) {
      lastWa = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}`;
      window.open(lastWa, '_blank', 'noopener');
      $('[data-wa-again]').href = lastWa;
      $('[data-wa-again]').hidden = false;
    } else {
      $('[data-wa-again]').hidden = true;
      if (navigator.clipboard) navigator.clipboard.writeText(msg).catch(() => {});
      sentText.textContent = 'Nomor WhatsApp pesanan belum diatur, jadi teks pesananmu kami salin. Tempel di chat WhatsApp Code Caffeine.';
    }
    form.hidden = true;
    sent.hidden = false;
    $('h2', sent).focus?.();
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
  $('[data-hero-cup]').innerHTML = cupSVG(drinkOf('dirty-latte'), 'L', { big: true });
  renderMenu();
  renderStatus();
  renderWeek();
  renderSocial();
  renderCart();
  setInterval(() => { renderStatus(); }, 60000);
})();
