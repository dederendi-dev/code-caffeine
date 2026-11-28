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
  // Menu diatur dari master admin: aktif=false disembunyikan, habis=true tampil tapi tidak bisa dipesan.
  const MENU = C.menu.filter(m => m.aktif !== false);
  const drinkOf = id => MENU.find(m => m.id === id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ANDALAN = MENU.find(m => m.andalan) || MENU[0];
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

  const parseWIB = str => {
    const [d, t = '00:00'] = str.split(' ');
    const [y, m, dd] = d.split('-').map(Number);
    const [h, mi] = t.split(':').map(Number);
    return Date.UTC(y, m - 1, dd, h, mi);
  };
  const jamMs = ms => { const d = new Date(ms); return `${String(d.getUTCHours()).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')}`; };

  // Semua hari jual di sekitar sekarang: jadwal rutin (hariJual) + jadwal khusus
  function events(now) {
    const today = startOfDay(now);
    const list = [];
    for (let i = -1; i < 15; i++) {
      const d = today + i * DAY;
      if (!C.hariJual.includes(dow(d))) continue;
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

  // Hari jual terdekat yang pre-ordernya belum ditutup (untuk keterangan jadwal)
  const targetEvent = now => events(now).find(e => now.getTime() < e.tutup) || null;
  // Hari jual yang pre-ordernya SEDANG dibuka. Form hanya menerima pesanan di jendela ini.
  const openEvent = now => events(now).find(e => now.getTime() >= e.buka && now.getTime() < e.tutup) || null;
  // "pukul 12.00" kalau hari ini, "Minggu 12.00" kalau hari lain
  const kapan = (ms, now) => (startOfDay(new Date(ms)) === startOfDay(now) ? `pukul ${jamMs(ms)}` : `${HARI[dow(ms)]} ${jamMs(ms)}`);

  function status(now) {
    if (C.statusManual) {
      return { state: 'manual', text: [C.statusManual.judul, C.statusManual.pesan].filter(Boolean).join('. ') };
    }
    const t = now.getTime();
    const ev = events(now);
    const open = ev.find(e => t >= e.buka && t < e.tutup);
    if (open) {
      const untuk = open.day === startOfDay(now) ? 'hari ini' : tanggal(open.day);
      return { state: 'open', text: `Pre-order untuk ${untuk} dibuka sampai ${kapan(open.tutup, now)}` };
    }
    const selling = ev.find(e => e.day === startOfDay(now) && t >= e.tutup && t < e.selesai);
    if (selling) {
      return t < selling.mulai
        ? { state: 'jual', text: `Hari ini hari jual. Pesanan diantar mulai ${jamMs(selling.mulai)}` }
        : { state: 'jual', text: `Hari ini hari jual. Pesanan sedang diantar sampai ${jamMs(selling.selesai)}` };
    }
    const next = ev.find(e => t < e.buka);
    if (next) return { state: 'soon', text: `Pre-order untuk ${tanggal(next.day)} dibuka ${kapan(next.buka, now)}` };
    return { state: 'soon', text: 'Jadwal jualan berikutnya segera diumumkan' };
  }

  function renderStatus() {
    const s = status(nowWIB());
    $('.status').dataset.state = s.state;
    $('[data-status-text]').textContent = s.text;
  }

  function renderWeek() {
    const now = nowWIB();
    const today = startOfDay(now);
    const ev = events(now);
    const html = [];
    for (let i = 0; i < 7; i++) {
      const d = today + i * DAY;
      const jual = ev.find(e => e.day === d);
      const po = ev.find(e => e.day !== d && e.buka < d + DAY && e.tutup > d);
      let cls = 'libur', info = 'Libur';
      if (jual) {
        cls = 'jual';
        info = `Hari jual. Antar <span class="nw">${jamMs(jual.mulai)}–${jamMs(jual.selesai)}</span>`;
        if (jual.tutup > d) info += `. Pre-order sampai <span class="nw">${jamMs(jual.tutup)}</span>`;
      } else if (po) {
        cls = 'po';
        const dari = Math.max(po.buka, d), sampai = Math.min(po.tutup, d + DAY);
        info = (dari === d && sampai === d + DAY)
          ? `Pre-order dibuka untuk ${HARI[dow(po.day)]}`
          : `Pre-order <span class="nw">${jamMs(dari)}–${jamMs(sampai)}</span> untuk ${HARI[dow(po.day)]}`;
      }
      const dt = new Date(d);
      html.push(`<li class="day ${cls}${i === 0 ? ' today' : ''}">
        <span class="day-name">${HARI[dow(d)]}${i === 0 ? '<span class="today-badge">Hari ini</span>' : ''}<small>${dt.getUTCDate()} ${BULAN[dt.getUTCMonth()].slice(0, 3)}</small></span>
        <span class="day-info">${info}</span></li>`);
    }
    $('[data-week]').innerHTML = html.join('');

    // Keterangan di atas jadwal
    const rutin = C.hariJual.length ? `Jadwal rutin kami: ${C.hariJual.map(w => HARI[w]).join(', ')}. ` : '';
    const hariIni = ev.find(e => e.day === today && now.getTime() >= e.tutup && now.getTime() < e.selesai);
    const next = targetEvent(now);
    let note;
    if (hariIni) {
      note = `Hari ini jualan, pesanan diantar ${jamMs(hariIni.mulai)}–${jamMs(hariIni.selesai)}. Pre-order hari ini sudah ditutup, tapi yang datang langsung tetap dilayani selama stok ada.`;
    } else if (next) {
      note = `Jualan berikutnya ${tanggal(next.day)}: pre-order sampai ${HARI[dow(next.tutup)]} ${jamMs(next.tutup)}, diantar ${jamMs(next.mulai)}–${jamMs(next.selesai)}. Yang datang langsung tetap dilayani selama stok ada.`;
    } else {
      note = 'Jadwal jualan berikutnya segera diumumkan lewat WhatsApp.';
    }
    $('[data-schedule-note]').textContent = rutin + note;
  }

  /* ================= Foto minuman ================= */
  // Foto tiap menu dari pengaturan (foto, fotoBesar). Ukuran dipilih = foto diperbesar/diperkecil.
  // Menu tanpa foto memakai ikon cangkir Code Caffeine.
  const SCALE = { S: 0.8, M: 0.9, L: 1 };
  const NO_PHOTO = '/assets/img/logo-ikon.svg';
  function cupPhoto(drink, size, hero) {
    const u = sizeOf(size);
    const src = (hero && drink.fotoBesar) || drink.foto || NO_PHOTO;
    const load = hero ? 'fetchpriority="high"' : 'loading="lazy"';
    return `<div class="cup-photo${src === NO_PHOTO ? ' no-photo' : ''}" data-cupgrp style="--s:${SCALE[size]}">
        <span class="cup-shadow" aria-hidden="true"></span>
        <img src="${esc(src)}" alt="${esc(drink.nama)}, ${u.nama} ${u.oz} oz" ${load} decoding="async" draggable="false" onerror="this.onerror=null;this.src='${NO_PHOTO}';this.parentNode.classList.add('no-photo')">
      </div>`;
  }

  /* ================= Keranjang ================= */
  const KEY = 'cc-pesanan-v1';
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY) || '[]').filter(i => drinkOf(i.id) && !drinkOf(i.id).habis && sizeOf(i.size) && i.qty > 0); } catch (e) { cart = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* penyimpanan tidak tersedia */ } };
  const priceOf = i => drinkOf(i.id).harga[i.size];
  const cartCount = () => cart.reduce((a, i) => a + i.qty, 0);
  const cartTotal = () => cart.reduce((a, i) => a + i.qty * priceOf(i), 0);

  /* Kartu stamp: 5 cap = 1 cup Small gratis (menu bebas). Diverifikasi dengan kartu fisik saat serah terima. */
  const form = $('[data-order-form]');
  const wantsStamp = () => form.elements.pernah_beli.value === 'Sudah' && form.elements.tukar_stamp.checked;
  // Minuman Small termahal di pesanan yang digratiskan
  const stampItem = () => cart.filter(i => i.size === 'S').sort((a, b) => priceOf(b) - priceOf(a))[0] || null;
  const discount = () => (wantsStamp() && stampItem() ? priceOf(stampItem()) : 0);
  // Voucher Caffeine Challenge dari pesanan sebelumnya (dicek tim lewat nomor WA)
  const VOUCHER = 1000;
  const wantsVoucher = () => form.elements.pernah_beli.value === 'Sudah' && form.elements.pakai_voucher.checked;
  const voucherCut = () => (wantsVoucher() && cartCount() > 0 ? Math.min(VOUCHER, cartTotal() - discount()) : 0);
  const netTotal = () => cartTotal() - discount() - voucherCut();

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
    $('[data-drinks]').innerHTML = MENU.map(d => `
      <article class="card${d.andalan ? ' featured' : ''}${d.habis ? ' habis' : ''}" data-drink="${esc(d.id)}">
        <div class="card-cup">${cupPhoto(d, 'M')}</div>
        <div class="card-title"><h3>${esc(d.nama)}</h3>${d.habis ? '<span class="badge badge-off">Habis</span>' : d.andalan ? '<span class="badge">Andalan</span>' : ''}</div>
        <p class="card-desc">${esc(d.deskripsi)}</p>
        <fieldset class="sizes">
          <legend>Ukuran ${esc(d.nama)}</legend>
          ${C.ukuran.map(u => `<label><input type="radio" name="size-${d.id}" value="${u.id}"${u.id === 'M' ? ' checked' : ''}><span>${u.nama}</span></label>`).join('')}
        </fieldset>
        <div class="card-foot">
          <p class="price" data-price aria-live="polite">${priceHTML(d, 'M')}</p>
          <button type="button" class="btn btn-solid" data-add${d.habis ? ' disabled' : ''}>${d.habis ? 'Habis' : 'Tambah'}</button>
        </div>
        <p class="in-cart" data-in-cart></p>
      </article>`).join('');

    $$('[data-drink]').forEach(card => {
      const d = drinkOf(card.dataset.drink);
      card.addEventListener('change', e => {
        if (!e.target.name || !e.target.name.startsWith('size-')) return;
        const size = e.target.value;
        $('[data-cupgrp]', card).style.setProperty('--s', SCALE[size]);
        $('.card-cup img', card).alt = `${d.nama}, ${sizeOf(size).nama} ${sizeOf(size).oz} oz`;
        $('[data-price]', card).innerHTML = priceHTML(d, size);
      });
      $('[data-add]', card).addEventListener('click', e => {
        const size = $(`input[name="size-${d.id}"]:checked`, card).value;
        addToCart(d.id, size);
        const pesan = $('.nav [data-open-order]');
        pesan.classList.remove('denyut'); void pesan.offsetWidth; pesan.classList.add('denyut');
        kabar(`<b>${esc(d.nama)} ${sizeOf(size).nama}</b> masuk pesanan. Tekan <b>Pesan</b> di kanan atas untuk lanjut.`);
        const btn = e.currentTarget;
        btn.classList.add('added');
        btn.textContent = 'Ditambahkan';
        clearTimeout(btn._t);
        btn._t = setTimeout(() => { btn.classList.remove('added'); btn.textContent = 'Tambah'; }, 1300);
      });
    });
  }

  /* ================= Kabar singkat di atas layar ================= */
  let kabarT = 0;
  function kabar(html, lama) {
    const k = $('[data-kabar]'); if (!k) return;
    k.innerHTML = html; k.hidden = false;
    clearTimeout(kabarT); kabarT = setTimeout(() => { k.hidden = true; }, lama || 2600);
  }

  /* ================= Lembar pesanan ================= */
  const sheet = $('[data-sheet]');
  const sent = $('[data-sent]');
  let lastFocus = null;

  function renderCart() {
    const n = cartCount();
    $$('[data-cart-count]').forEach(el => { el.textContent = n; el.hidden = n === 0; });

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
    $('[data-cart-total]').textContent = rupiah(netTotal());
    $('[data-fields]').disabled = n === 0;

    // Kartu stamp
    const stampOn = form.elements.pernah_beli.value === 'Sudah';
    $('[data-stamp-field]').hidden = !stampOn;
    const si = stampItem();
    const disc = $('[data-cart-disc]');
    disc.hidden = !(n > 0 && wantsStamp() && si);
    if (si) {
      $('[data-cart-disc-label]').textContent = `Kartu stamp: ${drinkOf(si.id).nama} Small gratis`;
      $('[data-cart-disc-value]').textContent = '−' + rupiah(priceOf(si));
    }
    $('[data-voucher-field]').hidden = !stampOn;
    $('[data-cart-voucher]').hidden = !(n > 0 && wantsVoucher());
    $('[data-cart-voucher-value]').textContent = '−' + rupiah(voucherCut());
    $('[data-stamp-hint]').textContent = wantsStamp()
      ? (si ? 'Jangan lupa tunjukkan kartunya saat serah terima. Kalau kartu belum penuh, bayar harga normal.' : 'Tambahkan satu minuman ukuran Small dari menu untuk ditukar.')
      : '';

    // Tombol kirim hanya aktif saat pre-order dibuka
    const open = openEvent(nowWIB());
    const send = $('[data-send]');
    send.disabled = n === 0 || !open;
    send.textContent = open ? 'Kirim lewat WhatsApp' : 'Pre-order sedang ditutup';
    $('[data-foot-note]').innerHTML = open
      ? 'Pesananmu akan terbuka di WhatsApp. Tekan kirim di sana supaya masuk ke kami.'
      : (C.whatsapp ? `Mau tanya stok atau jadwal? <a href="https://wa.me/${C.whatsapp}" target="_blank" rel="noopener">Chat kami di WhatsApp</a>.` : 'Info jualan berikutnya kami umumkan lewat WhatsApp.');
  }

  // Keterangan kenapa pre-order tidak bisa dikirim sekarang
  function closedText(now) {
    const t = now.getTime();
    const ev = events(now);
    const today = ev.find(e => e.day === startOfDay(now) && t >= e.tutup && t < e.selesai);
    if (today) return `Pre-order untuk hari ini sudah ditutup ${kapan(today.tutup, now)}. Mau beli langsung? Chat kami untuk cek stok.`;
    const next = ev.find(e => t < e.buka);
    if (next) return `Pre-order untuk ${tanggal(next.day)} dibuka ${kapan(next.buka, now)}. Menu yang kamu pilih tetap tersimpan.`;
    return 'Pre-order sedang ditutup. Info jualan berikutnya kami umumkan lewat WhatsApp.';
  }

  function openSheet() {
    lastFocus = document.activeElement;
    form.hidden = false; sent.hidden = true;
    const now = nowWIB();
    const ev = openEvent(now);
    $('[data-target-day]').textContent = ev
      ? `Untuk hari jual ${tanggal(ev.day, true)}, diantar ${jamMs(ev.mulai)}–${jamMs(ev.selesai)}. Pre-order ditutup ${kapan(ev.tutup, now)}.`
      : closedText(now);
    const slotEv = ev || targetEvent(now);
    const slots = slotEv ? slotEv.slot : C.slotSerahTerima;
    const rentang = slotEv ? `${jamMs(slotEv.mulai)}–${jamMs(slotEv.selesai)}` : '';
    $('[data-slot-select]').innerHTML = slots.map(x => `<option>${x}</option>`).join('') + `<option>Kapan saja${rentang ? ', ' + rentang : ''}</option>`;
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


  function syncLokasi() {
    $('[data-lokasi-field]').hidden = form.elements.cara_terima.value !== 'Diantar';
  }
  form.addEventListener('change', e => {
    if (e.target.name === 'cara_terima') syncLokasi();
    if (e.target.name === 'pernah_beli' && e.target.value !== 'Sudah') { form.elements.tukar_stamp.checked = false; form.elements.pakai_voucher.checked = false; }
    if (['pernah_beli', 'tukar_stamp', 'pakai_voucher'].includes(e.target.name)) renderCart();
  });
  form.addEventListener('input', e => {
    if (e.target.hasAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid');
  });
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

  // 0812-3456-7890, +62 812..., 62812... -> 081234567890. Kosong kalau tidak valid.
  function normalWA(str) {
    let d = String(str).replace(/\D/g, '');
    if (d.startsWith('62')) d = '0' + d.slice(2);
    else if (d.startsWith('8')) d = '0' + d;
    return /^08\d{8,12}$/.test(d) ? d : '';
  }

  // Kode pesanan web: W + 5 karakter (tanpa huruf/angka yang mirip). Ikut di chat WA dan di CC Admin.
  const ALFA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const kodeBaru = () => 'W' + Array.from(crypto.getRandomValues(new Uint8Array(5)), b => ALFA[b % ALFA.length]).join('');

  function buildMessage(v, t, free, kode) {
    const lines = cart.map(i => {
      const d = drinkOf(i.id), u = sizeOf(i.size);
      return `- ${i.qty}x ${d.nama} ${u.nama} (${u.oz} oz) = ${rupiah(priceOf(i) * i.qty)}`;
    });
    const terima = v.cara_terima === 'Diantar' ? `Diantar ke ${v.lokasi}` : `Ambil sendiri di ${C.lokasiAmbil}`;
    return [
      'Halo Code Caffeine, saya mau pre-order.',
      '',
      `Kode pesanan: ${kode}`,
      `Nama: ${v.nama}`,
      `No. WA: ${v.wa}`,
      `Untuk: ${tanggal(t, true)}`,
      '',
      'Pesanan:',
      ...lines,
      free ? `Tukar kartu stamp: 1 ${drinkOf(free.id).nama} Small gratis (−${rupiah(priceOf(free))})` : null,
      wantsVoucher() ? `Pakai voucher Caffeine Challenge: −${rupiah(voucherCut())}` : null,
      `Total: ${rupiah(netTotal())}`,
      free ? 'Kartu stamp saya tunjukkan saat serah terima.' : null,
      '',
      `Cara terima: ${terima}`,
      `Jam: ${v.jam}`,
      `Bayar: ${v.bayar}`,
      `Sudah pernah beli: ${v.pernah_beli}`,
      v.catatan ? `Catatan: ${v.catatan}` : null
    ].filter(l => l !== null).join('\n');
  }

  let lastUrl = '';
  function openWhatsApp(url) {
    // Tanpa 'noopener' supaya ketahuan kalau diblokir (sering terjadi di browser bawaan Instagram/TikTok)
    let w = null;
    try { w = window.open(url, '_blank'); } catch (err) { w = null; }
    if (w) { try { w.opener = null; } catch (err) { /* abaikan */ } }
    else { location.href = url; }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    hideError();
    if (cartCount() === 0) return showError('Pesanan masih kosong. Pilih minuman dulu dari menu.');
    const f = form.elements;
    const v = {
      nama: f.nama.value.trim(),
      wa: normalWA(f.wa.value),
      cara_terima: f.cara_terima.value,
      lokasi: f.lokasi.value.trim(),
      jam: f.jam.value,
      bayar: f.bayar.value,
      pernah_beli: f.pernah_beli.value,
      catatan: f.catatan.value.trim()
    };
    if (!v.nama) return showError('Tulis nama untuk pesanan ini.', f.nama);
    if (!v.wa) return showError('Tulis nomor WhatsApp yang aktif, contoh 081234567890.', f.wa);
    if (v.cara_terima === 'Diantar' && !v.lokasi) return showError('Tulis lokasi antar, misalnya gedung di kampus UMP atau nama kos.', f.lokasi);
    if (wantsStamp() && !stampItem()) return showError('Untuk tukar kartu stamp, tambahkan satu minuman ukuran Small dari menu dulu.', f.tukar_stamp);

    const ev = openEvent(nowWIB());
    if (!ev) { renderCart(); return showError(closedText(nowWIB())); }
    const free = wantsStamp() ? stampItem() : null;
    const kode = kodeBaru();
    const msg = buildMessage(v, ev.day, free, kode);

    // Catatan pesanan untuk kelompok (Netlify Forms). Gagal mencatat tidak menghalangi pesanan.
    f.wa.value = v.wa;
    f.untuk_hari.value = tanggal(ev.day, true);
    f.pesanan.value = cart.map(i => `${i.qty}x ${drinkOf(i.id).nama} ${sizeOf(i.size).nama}`).join('; ');
    f.jumlah_cup.value = String(cartCount());
    f.total.value = String(netTotal());
    f.stamp_gratis.value = free ? `${drinkOf(free.id).nama} Small (${priceOf(free)})` : '';
    try {
      if (location.protocol.startsWith('http') && navigator.sendBeacon) {
        navigator.sendBeacon('/', new URLSearchParams(new FormData(form)));
      }
    } catch (err) { /* abaikan */ }
    // Masuk ke CC Admin (semua admin dapat notifikasi). sendBeacon tetap terkirim walau halaman berpindah ke WhatsApp.
    const rekam = JSON.stringify({
      kode, nama: v.nama, wa: v.wa, cara_terima: v.cara_terima, lokasi: v.lokasi, jam: v.jam, bayar: v.bayar,
      pernah_beli: v.pernah_beli, tukar_stamp: wantsStamp(), pakai_voucher: wantsVoucher(), sumber: f.sumber.value,
      catatan: v.catatan, untuk_hari: tanggal(ev.day, true), untuk_ms: ev.day, total: netTotal(),
      items: cart.map(i => ({ id: i.id, size: i.size, qty: i.qty })), 'bot-field': f['bot-field'] ? f['bot-field'].value : ''
    });
    antrekan(kode, rekam);
    try { localStorage.setItem('cc-wa', v.wa); } catch (err) { /* abaikan */ }
    $('[data-sent-kode]').textContent = ` dengan kode ${kode}`;

    // Keranjang dikosongkan supaya pesanan yang sama tidak terkirim dua kali
    cart = []; save();
    f.tukar_stamp.checked = false;
    f.pakai_voucher.checked = false;
    f.catatan.value = '';
    renderCart();

    const again = $('[data-wa-again]');
    form.hidden = true;
    sent.hidden = false;
    if (C.whatsapp) {
      lastUrl = `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}`;
      again.href = lastUrl; again.hidden = false;
      $('h2', sent).focus();
      openWhatsApp(lastUrl);
    } else {
      again.hidden = true;
      if (navigator.clipboard) navigator.clipboard.writeText(msg).catch(() => {});
      $('[data-sent-text]').textContent = 'Nomor WhatsApp pesanan belum diatur, jadi teks pesananmu kami salin. Tempel di chat WhatsApp Code Caffeine.';
      $('h2', sent).focus();
    }
  });

  $('[data-finish]').addEventListener('click', () => {
    form.reset(); syncLokasi(); renderCart(); closeSheet();
  });
  $('[data-cek-status]').addEventListener('click', () => {
    const wa = (() => { try { return localStorage.getItem('cc-wa') || ''; } catch (e) { return ''; } })();
    form.reset(); syncLokasi(); renderCart(); closeSheet();
    bukaPoin(wa);
  });

  /* ================= Catatan pesanan ke CC Admin: dijamin terkirim ================= */
  // Pesanan disimpan dulu di HP. Kalau koneksi putus atau halaman langsung berpindah ke WhatsApp,
  // pesanan dikirim ulang saat web dibuka lagi (server mengabaikan kiriman ganda dengan kode yang sama).
  const Q_KEY = 'cc-pesanan-tertunda';
  const bacaQ = () => { try { return JSON.parse(localStorage.getItem(Q_KEY) || '{}'); } catch (e) { return {}; } };
  const tulisQ = q => { try { localStorage.setItem(Q_KEY, JSON.stringify(q)); } catch (e) { /* abaikan */ } };
  async function kirimRekam(kode, rekam) {
    try {
      const r = await fetch('/api/order', { method: 'POST', body: rekam, keepalive: true, headers: { 'content-type': 'text/plain;charset=UTF-8' } });
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429)) { const q = bacaQ(); delete q[kode]; tulisQ(q); }
    } catch (e) { /* tetap di antrean */ }
  }
  function antrekan(kode, rekam) {
    const q = bacaQ(); q[kode] = { rekam, t: Date.now() }; tulisQ(q);
    kirimRekam(kode, rekam);
  }
  (function kirimUlang() {
    const q = bacaQ();
    Object.entries(q).forEach(([kode, x]) => {
      if (Date.now() - x.t > 3 * 86400000) { delete q[kode]; tulisQ(q); return; }
      kirimRekam(kode, x.rekam);
    });
  })();

  /* ================= Kartu stamp digital, voucher, skor, status pesanan (pakai nomor WA) ================= */
  const poinForm = $('[data-poin-form]'), poinHasil = $('[data-poin-hasil]');
  async function ambilPoin(wa) {
    const r = await fetch('/api/poin?wa=' + encodeURIComponent(wa), { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Data belum bisa dimuat. Coba lagi.');
    return j;
  }
  const fmtTgl = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short' });
  function renderPoin(d) {
    if (!d.ada) {
      poinHasil.innerHTML = '<p class="poin-kosong">Belum ada pesanan dengan nomor ini. Pastikan nomornya sama dengan yang kamu tulis saat pesan.</p>';
      return;
    }
    const isi = d.cap.sisa >= 5 ? 5 : d.cap.progres;          // 5 cap atau lebih: kartu penuh, siap ditukar
    const slot = Array.from({ length: 5 }, (_, i) => `<i class="${i < isi ? 'on' : ''}"></i>`).join('');
    const ST = s => /Selesai/.test(s) ? 'ok' : /Batal/.test(s) ? 'off' : '';
    poinHasil.innerHTML = `
      <h3>Halo, ${esc(d.nama)}</h3>
      <p class="sub">${d.cap.gratis ? `Kamu punya <b>${d.cap.gratis} cup Small gratis</b>. Tukar saat pesan berikutnya.` : `${5 - d.cap.progres} cap lagi menuju cup Small gratis.`}${d.cap.menunggu ? ` ${d.cap.menunggu} pesanan lagi menunggu selesai untuk dapat cap.` : ''}</p>
      <div class="cap" aria-label="${isi} dari 5 cap">${slot}</div>
      <div class="poin-angka">
        <div><b>${d.cap.sisa}</b><span>Cap terkumpul</span></div>
        <div><b>${d.voucher.sisa}</b><span>Voucher Rp1.000</span></div>
        <div><b>${d.challenge.terbaik ? d.challenge.terbaik.toLocaleString('id-ID') : '–'}</b><span>Skor terbaik</span></div>
      </div>
      <ul class="poin-list">${d.pesanan.map(p => `<li><span>${esc(p.isi)}</span><span class="st ${ST(p.status)}">${esc(p.status)}</span><small>${esc(p.kode)} · ${esc(p.untuk || fmtTgl.format(new Date(p.t)))} · ${rupiah(p.total)}</small></li>`).join('')}</ul>`;
  }
  async function cekPoin(wa) {
    const w = normalWA(wa);
    if (!w) { poinHasil.innerHTML = '<p class="poin-kosong">Tulis nomor WhatsApp yang aktif, misalnya 0812 3456 7890.</p>'; return; }
    try { localStorage.setItem('cc-wa', w); } catch (e) { /* abaikan */ }
    poinHasil.innerHTML = '<p class="poin-kosong">Memuat…</p>';
    try { renderPoin(await ambilPoin(w)); }
    catch (err) { poinHasil.innerHTML = `<p class="poin-kosong">${esc(err.message)}</p>`; }
  }
  function bukaPoin(wa) {
    $('#member').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (wa) { poinForm.elements.poin_wa.value = wa; cekPoin(wa); } else setTimeout(() => poinForm.elements.poin_wa.focus({ preventScroll: true }), 500);
  }
  poinForm.addEventListener('submit', e => { e.preventDefault(); cekPoin(poinForm.elements.poin_wa.value); });
  try { const w = localStorage.getItem('cc-wa'); if (w) poinForm.elements.poin_wa.value = w; } catch (e) { /* abaikan */ }

  // Di form pesanan: tampilkan saldo cap & voucher, dan kunci pilihan yang belum cukup
  let saldoT = 0, saldoWA = '';
  function cekSaldo() {
    const hint = $('[data-saldo-hint]');
    if (form.elements.pernah_beli.value !== 'Sudah') { hint.textContent = ''; return; }
    const w = normalWA(form.elements.wa.value);
    if (!w) { hint.textContent = 'Isi nomor WhatsApp di atas untuk melihat cap dan voucher-mu.'; return; }
    if (w === saldoWA) return;
    clearTimeout(saldoT);
    saldoT = setTimeout(async () => {
      saldoWA = w; hint.textContent = 'Mengecek cap dan voucher…';
      try {
        const d = await ambilPoin(w);
        const ts = form.elements.tukar_stamp, pv = form.elements.pakai_voucher;
        ts.disabled = d.cap.sisa < 5; pv.disabled = d.voucher.sisa < 1;
        if (ts.disabled) ts.checked = false;
        if (pv.disabled) pv.checked = false;
        hint.textContent = d.ada
          ? `Nomor ini punya ${d.cap.sisa} cap${d.cap.sisa < 5 ? ` (perlu 5 untuk tukar)` : ''} dan ${d.voucher.sisa} voucher.`
          : 'Belum ada pesanan dengan nomor ini, jadi belum ada cap atau voucher.';
        renderCart();
      } catch (e) { saldoWA = ''; hint.textContent = ''; }
    }, 400);
  }
  form.addEventListener('input', e => { if (['wa', 'pernah_beli'].includes(e.target.name)) cekSaldo(); });
  form.addEventListener('change', e => { if (e.target.name === 'pernah_beli') { saldoWA = ''; cekSaldo(); } });

  /* ================= Paket Caffeine Challenge (game di halaman + transfer, dikonfirmasi admin) ================= */
  // Pesanan & kesempatan main disimpan di server (/api/challenge). Di HP hanya ada kode + token pesanan.
  const T_KEY = 'cc-tantangan-v2';
  const chSheet = $('[data-ch-sheet]'), chFrame = $('[data-ch-frame]'), chForm = $('[data-ch-step="form"]');
  let tOrder = null;            // { kode, token, rekaman? }
  try { tOrder = JSON.parse(localStorage.getItem(T_KEY)); } catch (e) { tOrder = null; }
  let tData = null;             // status terakhir dari server
  let pollTimer = 0, lateTimer = 0;
  const waAdmin = () => C.whatsappAdmin || C.whatsapp;
  const saveT = () => { try { if (tOrder) localStorage.setItem(T_KEY, JSON.stringify(tOrder)); else localStorage.removeItem(T_KEY); } catch (e) { /* abaikan */ } };

  async function api(path, data) {
    const opt = data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : { cache: 'no-store' };
    let res;
    try { res = await fetch('/api/challenge/' + path, opt); } catch (e) { throw new Error('Koneksi bermasalah. Cek internetmu lalu coba lagi.'); }
    let j = {};
    try { j = await res.json(); } catch (e) { /* bukan JSON */ }
    if (!res.ok) { const err = new Error(j.error || 'Terjadi kesalahan. Coba lagi.'); err.status = res.status; throw err; }
    return j;
  }
  const toGame = msg => { try { chFrame.contentWindow.postMessage(msg, location.origin); } catch (e) { /* game belum siap */ } };
  const syncGame = () => toGame({ type: 'caffeine-challenge:' + (tData && tData.status === 'lunas' ? 'siap' : 'tidak-siap') });

  const waLink = text => `https://wa.me/${waAdmin()}?text=${encodeURIComponent(text)}`;
  function waText() {
    if (!tData) return 'Halo admin Code Caffeine, saya mau tanya soal paket Caffeine Challenge.';
    const belum = tData.status === 'cek_admin' || tData.status === 'menunggu_bayar';
    return [
      `Halo admin Code Caffeine, saya ${tData.nama}.`,
      belum ? `Saya sudah transfer ${tData.hargaTeks} ke ${tData.bayar_ke.jenis} ${tData.bayar_ke.nomor} untuk paket Caffeine Challenge, tapi belum dikonfirmasi.`
            : 'Saya mau tanya soal pesanan paket Caffeine Challenge saya.',
      `Kode pesanan: ${tData.kode}`,
      `Minuman: ${tData.menuNama} Medium`
    ].join('\n');
  }

  const TITLES = { form: 'Paket Challenge', bayar: 'Transfer ke admin', tunggu: 'Menunggu konfirmasi', lunas: 'Siap main', hasil: 'Struk Challenge', info: 'Caffeine Challenge' };
  function step(name) {
    $$('[data-ch-step]', chSheet).forEach(p => { p.hidden = p.dataset.chStep !== name; });
    $('[data-ch-title]').textContent = TITLES[name] || 'Caffeine Challenge';
    const wa = waLink(waText());
    $$('[data-ch-wa],[data-ch-wa2],[data-ch-wa3]', chSheet).forEach(a => { a.href = wa; a.hidden = !waAdmin(); });
  }
  function info(title, text, btn) {
    $('[data-ch-info-title]').textContent = title;
    $('[data-ch-info-text]').textContent = text;
    $('[data-ch-info-btn]').textContent = btn || 'Oke';
    step('info');
  }
  function openCh() { if (!chSheet.open) { document.documentElement.classList.add('lock'); chSheet.showModal(); } }
  function closeCh() { if (chSheet.open) chSheet.close(); }
  chSheet.addEventListener('close', () => document.documentElement.classList.remove('lock'));
  chSheet.addEventListener('click', e => { if (e.target === chSheet) closeCh(); });
  $$('[data-ch-close]', chSheet).forEach(b => b.addEventListener('click', closeCh));

  function clearOrder() { tOrder = null; tData = null; saveT(); stopPoll(); renderPill(); syncGame(); }

  /* ---------- isi tiap langkah ---------- */
  function fillForm(ev) {
    const f = chForm.elements;
    $('[data-ch-target]').textContent = `Untuk hari jual ${tanggal(ev.day, true)}, diantar ${jamMs(ev.mulai)}–${jamMs(ev.selesai)}. Pre-order ditutup ${kapan(ev.tutup, nowWIB())}.`;
    const cur = f.menu ? f.menu.value : '';
    const jual = MENU.filter(m => !m.habis);
    $('[data-ch-menu]').innerHTML = jual.map((m, i) => `<label class="ch-opt"><input type="radio" name="menu" value="${esc(m.id)}"${(jual.some(x => x.id === cur) ? cur === m.id : i === 0) ? ' checked' : ''}><span><b>${esc(m.nama)}</b><em>${rupiah(m.harga.M)}</em></span></label>`).join('');
    const rentang = `${jamMs(ev.mulai)}–${jamMs(ev.selesai)}`;
    $('[data-ch-jam]').innerHTML = ev.slot.map(x => `<option>${x}</option>`).join('') + `<option>Kapan saja, ${rentang}</option>`;
    const an = b => (b.atasNama ? `a.n. ${b.atasNama}` : b.nomor);
    $('[data-ch-bayar]').innerHTML = C.pembayaran.length === 1
      ? `<p class="ch-pay-one"><b>${C.pembayaran[0].jenis}</b> ${an(C.pembayaran[0])}</p><input type="hidden" name="bayar_ke" value="0">`
      : C.pembayaran.map((b, i) => `<label class="ch-opt"><input type="radio" name="bayar_ke" value="${i}"${i === 0 ? ' checked' : ''}><span><b>${b.jenis}</b><em>${an(b)}</em></span></label>`).join('');
    // ambil nama & WA dari form pesanan biasa kalau sudah diisi
    const of = form.elements;
    if (!f.nama.value && of.nama.value) f.nama.value = of.nama.value;
    if (!f.wa.value && of.wa.value) f.wa.value = of.wa.value;
    syncChLokasi();
    $('[data-ch-error]').hidden = true;
  }
  function syncChLokasi() { $('[data-ch-lokasi]').hidden = chForm.elements.cara_terima.value !== 'Diantar'; }
  chForm.addEventListener('change', e => { if (e.target.name === 'cara_terima') syncChLokasi(); });

  function fillBayar() {
    const d = tData;
    $('[data-ch-amount]').textContent = d.hargaTeks;
    $('[data-ch-jenis]').textContent = d.bayar_ke.jenis;
    $('[data-ch-nomor]').textContent = d.bayar_ke.nomor;
    $('[data-ch-atasnama]').textContent = d.bayar_ke.atasNama || '';
    $('.ch-dest-nama').hidden = !d.bayar_ke.atasNama;
    $('[data-ch-kode]').textContent = d.kode;
    $('[data-ch-error2]').hidden = true;
  }
  function fillTunggu() {
    const d = tData;
    $('[data-ch-amount2]').textContent = d.hargaTeks;
    $('[data-ch-kode2]').textContent = d.kode;
    clearTimeout(lateTimer);
    const late = $('[data-ch-late]');
    const sisa = 3 * 60000 - (Date.now() - Date.parse(d.sudah_bayar_at || new Date().toISOString()));
    late.hidden = sisa > 0;
    if (sisa > 0) lateTimer = setTimeout(() => { late.hidden = false; }, sisa);
  }
  function fillHasil() {
    const d = tData;
    $('[data-ch-prize]').textContent = d.hadiah;
    $('[data-ch-score]').textContent = `Skor ${String(d.skor).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}` + (d.tidak_selesai ? ' (permainan tidak selesai)' : '');
    const rows = [
      ['Kode pesanan', d.kode],
      ['Hari jual', `${d.untuk}, ${d.jam}`],
      ['Terima', d.cara_terima === 'Diantar' ? `Diantar ke ${d.lokasi}` : d.lokasi],
      ['Pembayaran', `${d.hargaTeks} ke ${d.bayar_ke.jenis}, lunas`]
    ];
    $('[data-ch-receipt]').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd></dd></div>`).join('');
    $$('[data-ch-receipt] dd').forEach((dd, i) => { dd.textContent = rows[i][1]; });
  }

  function showForStatus() {
    const d = tData;
    if (!d) return;
    if (d.status === 'menunggu_bayar') { fillBayar(); step('bayar'); }
    else if (d.status === 'cek_admin') { fillTunggu(); step('tunggu'); }
    else if (d.status === 'lunas') step('lunas');
    else if (d.status === 'main') info('Sedang bermain', 'Kesempatan main untuk pesanan ini sudah dimulai. Selesaikan permainannya di game. Kalau halaman sempat tertutup, hasilnya dihitung skor 0 setelah 15 menit.');
    else if (d.status === 'selesai') { fillHasil(); step('hasil'); }
    else if (d.status === 'batal') info('Pesanan dibatalkan', `${d.alasan_batal || 'Pesanan ini dibatalkan'}. Kalau kamu sudah transfer, hubungi admin dengan kode ${d.kode}.`, 'Pesan paket baru');
  }

  // Dipanggil dari tombol Tantangan di game dan dari kotak status
  function openTantangan() {
    if (tData && tData.status !== 'batal') { showForStatus(); openCh(); return; }
    if (tData && tData.status === 'batal') clearOrder();
    if (!C.pembayaran || !C.pembayaran.length) {
      info('Segera dibuka', 'Pembelian paket tantangan dibuka sebentar lagi. Sementara itu, main mode latihan dulu, gratis.');
      openCh(); return;
    }
    const ev = openEvent(nowWIB());
    if (!ev) { info('Pre-order sedang ditutup', `${closedText(nowWIB())} Mode latihan tetap bisa dimainkan.`); openCh(); return; }
    fillForm(ev); step('form'); openCh();
  }

  /* ---------- status dari server ---------- */
  function stopPoll() { clearInterval(pollTimer); pollTimer = 0; }
  function startPoll() { stopPoll(); pollTimer = setInterval(refresh, 5000); }
  async function refresh() {
    if (!tOrder) return;
    try {
      const d = await api(`status?kode=${encodeURIComponent(tOrder.kode)}&token=${encodeURIComponent(tOrder.token)}`);
      onStatus(d);
      // hasil yang tadi gagal terkirim (misalnya sinyal putus) dikirim ulang
      if ((d.status === 'main' || d.status === 'selesai') && tOrder.rekaman) {
        const r = await api('hasil', { kode: tOrder.kode, token: tOrder.token, rekaman: tOrder.rekaman });
        delete tOrder.rekaman; saveT(); onStatus(r);
        toGame({ type: 'caffeine-challenge:hasil-tersimpan', hadiah: r.hadiah });
      }
    } catch (err) {
      if (err.status === 404) clearOrder();
      else if (err.status === 409 && tOrder && tOrder.rekaman) {   // rekaman ditolak server: jangan dicoba terus
        delete tOrder.rekaman; saveT();
        toGame({ type: 'caffeine-challenge:hasil-gagal', pesan: err.message + ' Hubungi admin kalau hasilnya tidak sesuai.' });
      } else if (tOrder && tOrder.rekaman) setTimeout(refresh, 8000);
    }
  }
  function onStatus(d) {
    const prev = tData && tData.status;
    tData = d;
    renderPill(); syncGame();
    if (d.status === 'cek_admin') { if (!pollTimer) startPoll(); } else stopPoll();
    if (prev && prev !== d.status) {
      if (chSheet.open) showForStatus();
      else if (prev === 'cek_admin' && (d.status === 'lunas' || d.status === 'batal')) { showForStatus(); openCh(); }
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && tOrder) refresh(); });

  function renderPill() {
    const box = $('[data-ch-status]'), d = tData;
    if (!d) { box.hidden = true; return; }
    const teks = {
      menunggu_bayar: [`Pesanan ${d.kode} menunggu transfer ${d.hargaTeks}`, 'Lanjutkan'],
      cek_admin: [`Menunggu konfirmasi admin untuk ${d.kode}`, 'Lihat'],
      lunas: ['Pembayaran diterima. Tantanganmu sudah terbuka di game.', 'Info'],
      main: [`Sedang bermain (${d.kode})`, 'Info'],
      selesai: [`Hadiahmu: ${d.hadiah}`, 'Struk'],
      batal: [`Pesanan ${d.kode} dibatalkan`, 'Lihat']
    }[d.status] || ['', 'Lihat'];
    box.hidden = false;
    box.dataset.state = d.status;
    $('[data-ch-status-text]').textContent = teks[0];
    $('[data-ch-status-btn]').textContent = teks[1];
  }
  $('[data-ch-status-btn]').addEventListener('click', openTantangan);

  /* ---------- tombol di pop-up ---------- */
  function chError(sel, msg, field) {
    const el = $(sel); el.textContent = msg; el.hidden = false;
    if (field) field.focus();
  }
  chForm.addEventListener('submit', async e => {
    e.preventDefault();
    const f = chForm.elements;
    $('[data-ch-error]').hidden = true;
    const data = {
      menu: f.menu ? f.menu.value : '', nama: f.nama.value.trim(), wa: normalWA(f.wa.value),
      cara_terima: f.cara_terima.value, lokasi: f.lokasi.value.trim(), jam: f.jam.value,
      catatan: f.catatan.value.trim(), bayar_ke: f.bayar_ke ? f.bayar_ke.value : '0'
    };
    if (!data.menu) return chError('[data-ch-error]', 'Pilih minuman dulu.');
    if (!data.nama) return chError('[data-ch-error]', 'Tulis nama untuk pesanan ini.', f.nama);
    if (!data.wa) return chError('[data-ch-error]', 'Tulis nomor WhatsApp yang aktif, contoh 081234567890.', f.wa);
    if (data.cara_terima === 'Diantar' && !data.lokasi) return chError('[data-ch-error]', 'Tulis lokasi antar, misalnya gedung di kampus UMP atau nama kos.', f.lokasi);
    const btn = $('[data-ch-submit]');
    btn.disabled = true; btn.textContent = 'Membuat pesanan…';
    try {
      const r = await api('pesan', data);
      tOrder = { kode: r.kode, token: r.token }; saveT();
      delete r.token; tData = r;
      renderPill(); fillBayar(); step('bayar');
    } catch (err) {
      chError('[data-ch-error]', err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Lanjut ke pembayaran';
    }
  });

  function copyBtn(sel, getText) {
    $(sel).addEventListener('click', async e => {
      const b = e.currentTarget, old = b.textContent;
      try { await navigator.clipboard.writeText(getText()); b.textContent = 'Tersalin'; } catch (err) { b.textContent = 'Salin manual'; }
      setTimeout(() => { b.textContent = old; }, 1600);
    });
  }
  copyBtn('[data-copy-amount]', () => String(tData.harga));
  copyBtn('[data-copy-nomor]', () => tData.bayar_ke.nomor.replace(/\s/g, ''));

  $('[data-ch-paid]').addEventListener('click', async e => {
    const b = e.currentTarget;
    b.disabled = true;
    try { onStatus(await api('sudah-bayar', tOrder)); fillTunggu(); step('tunggu'); }
    catch (err) { chError('[data-ch-error2]', err.message); }
    finally { b.disabled = false; }
  });
  $('[data-ch-cancel]').addEventListener('click', async () => {
    try { await api('batal', tOrder); } catch (err) { /* tetap dihapus dari HP */ }
    clearOrder();
    info('Pesanan dibatalkan', 'Pesanan paket tantangan ini sudah dibatalkan. Kamu bisa pesan lagi kapan saja selama pre-order dibuka.');
  });
  $('[data-ch-play]').addEventListener('click', () => {
    closeCh();
    chFrame.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    syncGame();
    toGame({ type: 'caffeine-challenge:buka-tantangan' });
  });
  $('[data-ch-done]').addEventListener('click', () => { clearOrder(); closeCh(); });
  $('[data-ch-info-btn]').addEventListener('click', () => {
    if (tData && tData.status === 'batal') { clearOrder(); openTantangan(); } else closeCh();
  });

  /* ---------- pesan dari game ---------- */
  window.addEventListener('message', async e => {
    if (e.origin !== location.origin || e.source !== chFrame.contentWindow) return;
    const m = e.data || {};
    if (m.type === 'caffeine-challenge:minta-bayar') openTantangan();
    else if (m.type === 'caffeine-challenge:minta-status') syncGame();
    else if (m.type === 'caffeine-challenge:minta-mulai') {
      if (!tOrder || !tData || tData.status !== 'lunas') {
        toGame({ type: 'caffeine-challenge:mulai-gagal', pesan: 'Belum ada pembayaran yang dikonfirmasi admin.' }); return;
      }
      try { onStatus(await api('mulai', tOrder)); toGame({ type: 'caffeine-challenge:mulai-ok' }); }
      catch (err) { toGame({ type: 'caffeine-challenge:mulai-gagal', pesan: err.message }); refresh(); }
    } else if (m.type === 'caffeine-challenge:result' && m.mode === 'challenge') {
      if (!tOrder) return;
      try { onStatus(await api('hasil', { kode: tOrder.kode, token: tOrder.token, rekaman: m.rekaman || '' })); toGame({ type: 'caffeine-challenge:hasil-tersimpan', hadiah: tData.hadiah }); }
      catch (err) {
        if (err.status !== 409) { tOrder.rekaman = m.rekaman || ''; saveT(); }   // dicoba lagi otomatis
        toGame({ type: 'caffeine-challenge:hasil-gagal', pesan: err.status === 409 ? err.message : 'Hasil belum tersimpan karena koneksi. Jangan tutup halaman ini, kami coba kirim ulang.' });
        setTimeout(refresh, 3000);
      }
    } else if (m.type === 'caffeine-challenge:close') {
      if (tData && tData.status === 'selesai') { fillHasil(); step('hasil'); openCh(); }
    }
  });
  chFrame.addEventListener('load', syncGame);
  if (tOrder) refresh();

  /* ================= Panduan interaktif cara pesan ================= */
  // Muncul sekali di kunjungan pertama, dan kapan saja lewat tombol "Cara pesan".
  function turPesan() {
    if (!window.CCTur) return;
    const kartu = () => $('[data-drink]:not(.habis)');
    window.CCTur.mulai([
      { el: '.hero .status', judul: 'Cek jadwal pre-order', teks: 'Di sini tertulis pre-order sedang buka atau tutup, untuk hari apa, dan sampai jam berapa.' },
      { el: () => kartu() && $('.sizes', kartu()), judul: 'Pilih ukuran', teks: 'Small 12 oz, Medium 14 oz, atau Large 16 oz. Harganya ikut berubah.' },
      { el: () => kartu() && $('[data-add]', kartu()), judul: 'Tekan Tambah', teks: 'Minumannya masuk keranjang. Bisa tambah beberapa minuman sekaligus.' },
      { el: '.nav [data-open-order]', judul: 'Buka pesanan', teks: 'Setelah menambah minuman, tekan Pesan di kanan atas. Angkanya menunjukkan jumlah minuman. Lalu isi nama, nomor WhatsApp, dan alamat antar.' },
      { el: null, judul: 'Kirim ke WhatsApp', teks: 'Tekan Kirim ke WhatsApp, lalu tekan kirim di chat-nya. Pesananmu langsung tercatat di tim kami dengan kode pesanan, dan admin membalas untuk konfirmasi.' },
      { el: '#challenge .ch-game', judul: 'Mau berhadiah?', teks: 'Main Caffeine Challenge di sini. Latihan gratis; paket tantangan 1 cup Medium dengan bonus sesuai skormu.' },
      { el: '[data-poin]', judul: 'Cap dan status pesanan', teks: 'Tulis nomor WhatsApp-mu di sini untuk melihat cap kartu stamp, voucher, skor tantangan, dan status pesananmu.', tombol: 'Siap pesan' }
    ], { kunci: 'pesan-v1' });
  }
  $$('[data-tur-mulai]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); turPesan(); }));
  // Kunjungan pertama: tawarkan dulu, jangan langsung memulai panduan
  const sambut = $('[data-sambut]');
  const sudahSambut = () => { try { return localStorage.getItem('cc-sambut-v1') === '1'; } catch (e) { return true; } };
  const tutupSambut = () => { try { localStorage.setItem('cc-sambut-v1', '1'); } catch (e) { /* abaikan */ } if (sambut.open) sambut.close(); };
  $('[data-sambut-tur]').addEventListener('click', () => { tutupSambut(); turPesan(); });
  $('[data-sambut-lewati]').addEventListener('click', () => { tutupSambut(); $('#menu').scrollIntoView({ behavior: 'smooth' }); });
  $('[data-sambut-poin]').addEventListener('click', () => { tutupSambut(); bukaPoin((() => { try { return localStorage.getItem('cc-wa') || ''; } catch (e) { return ''; } })()); });
  sambut.addEventListener('cancel', () => tutupSambut());
  if (!sudahSambut() && !location.hash && !(window.CCTur && window.CCTur.sudah('pesan-v1'))) {
    setTimeout(() => { if (!document.querySelector('dialog[open]')) sambut.showModal(); }, 900);
  }

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
  $('[data-hero-cup]').innerHTML = cupPhoto(ANDALAN, 'L', true);
  $('[data-hero-name]').textContent = ANDALAN.nama;
  $('[data-hero-price]').textContent = rupiah(ANDALAN.harga.M);
  const termurah = Math.min(...MENU.map(m => m.harga.S));
  $$('[data-min-price]').forEach(el => { el.textContent = rupiah(termurah); });
  renderMenu();
  renderStatus();
  renderWeek();
  renderSocial();
  renderCart();
  setInterval(() => {
    renderStatus();
    if (sheet.open && !form.hidden) renderCart();   // tombol kirim ikut mati tepat saat pre-order ditutup
  }, 30000);
})();
