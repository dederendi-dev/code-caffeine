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
  // Foto asli tiap menu (assets/img/menu/<id>.webp). Ukuran dipilih = foto diperbesar/diperkecil.
  const SCALE = { S: 0.8, M: 0.9, L: 1 };
  function cupPhoto(drink, size, hero) {
    const u = sizeOf(size);
    const src = `/assets/img/menu/${drink.id}${hero ? '-besar' : ''}.webp`;
    const load = hero ? 'fetchpriority="high"' : 'loading="lazy"';
    return `<div class="cup-photo" data-cupgrp style="--s:${SCALE[size]}">
        <span class="cup-shadow" aria-hidden="true"></span>
        <img src="${src}" alt="${drink.nama}, ${u.nama} ${u.oz} oz" ${load} decoding="async" draggable="false">
      </div>`;
  }

  /* ================= Keranjang ================= */
  const KEY = 'cc-pesanan-v1';
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY) || '[]').filter(i => drinkOf(i.id) && sizeOf(i.size) && i.qty > 0); } catch (e) { cart = []; }
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
    $('[data-drinks]').innerHTML = C.menu.map(d => `
      <article class="card${d.andalan ? ' featured' : ''}" data-drink="${d.id}">
        <div class="card-cup">${cupPhoto(d, 'M')}</div>
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
        $('[data-cupgrp]', card).style.setProperty('--s', SCALE[size]);
        $('.card-cup img', card).alt = `${d.nama}, ${sizeOf(size).nama} ${sizeOf(size).oz} oz`;
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
    renderChallenge();
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
    if (e.target.name === 'nama' || e.target.name === 'wa') renderChallenge();
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

  /* ================= Caffeine Challenge ================= */
  // Aturan hadiah ada di game (/main/, TIERS). Web membaca aturan dan menghitung ulang skor dari game itu sendiri.
  // Satu kesempatan per pesanan: hasil tersimpan sampai pesanan terkirim. Keluar di tengah = skor 0.
  const CH_KEY = 'cc-challenge-v1';
  const game = $('[data-game]'), frame = $('[data-game-frame]');
  let ch = { status: 'none' };
  try { ch = JSON.parse(localStorage.getItem(CH_KEY)) || ch; } catch (e) { /* abaikan */ }
  const saveCh = () => { try { localStorage.setItem(CH_KEY, JSON.stringify(ch)); } catch (e) { /* abaikan */ } };
  // Hadiah berlaku untuk 1 cup Medium (yang termahal kalau ada beberapa)
  const chItem = () => cart.filter(i => i.size === 'M').sort((a, b) => priceOf(b) - priceOf(a))[0] || null;
  const BONUS = {
    voucher: { teks: 'Medium + voucher Rp1.000', pesan: d => `${d} Medium + voucher Rp1.000 untuk pesanan berikutnya` },
    cap: { teks: 'Medium + 1 cap kartu stamp', pesan: d => `${d} Medium + 1 cap tambahan di kartu stamp` },
    large: { teks: 'upgrade ke Large', pesan: d => `${d} Medium di-upgrade jadi Large` }
  };
  const fmtSkor = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  function renderChallenge() {
    const box = $('.ch-box'), play = $('[data-ch-play]'), hint = $('[data-ch-hint]'), text = $('[data-ch-text]');
    const item = chItem();
    if (ch.status === 'done') {
      box.classList.add('done');
      play.hidden = true;
      const b = BONUS[ch.tier] || BONUS.voucher;
      text.innerHTML = `Skor <b>${fmtSkor(ch.score)}</b>: <b>${item ? b.pesan(drinkOf(item.id).nama) : b.teks}</b>.` +
        (ch.stopped ? ' Permainan dihentikan di tengah, jadi skor dihitung 0.' : '');
      hint.textContent = item ? 'Hasil terkunci untuk pesanan ini.' : 'Hasil ini berlaku untuk 1 cup Medium. Tambahkan minuman ukuran Medium supaya bonusnya terpakai.';
      return;
    }
    box.classList.remove('done');
    play.hidden = false;
    text.innerHTML = 'Main sekali untuk 1 cup Medium di pesanan ini. Minimal tetap Medium, skormu menentukan bonusnya: voucher Rp1.000, +1 cap kartu stamp, atau upgrade ke Large.';
    const open = openEvent(nowWIB());
    play.disabled = !item || !open;
    hint.textContent = !open ? 'Bisa dimainkan saat pre-order dibuka.'
      : !item ? 'Tambahkan minimal 1 minuman ukuran Medium untuk ikut.'
      : (form.elements.nama.value.trim() && normalWA(form.elements.wa.value))
        ? 'Satu kesempatan per pesanan. Keluar di tengah permainan dihitung skor 0.'
        : 'Isi nama dan nomor WhatsApp dulu, supaya hasilnya tercatat atas namamu.';
  }

  function logChallenge(status) {
    try {
      if (!location.protocol.startsWith('http') || !navigator.sendBeacon) return;
      const f = form.elements, ev = openEvent(nowWIB());
      const data = new URLSearchParams({
        'form-name': 'challenge', nama: f.nama.value.trim(), wa: normalWA(f.wa.value),
        skor: String(ch.score), hasil: (BONUS[ch.tier] || BONUS.voucher).teks, status,
        rekaman: ch.taps || '', untuk_hari: ev ? tanggal(ev.day, true) : ''
      });
      navigator.sendBeacon('/', data);
    } catch (e) { /* abaikan */ }
  }

  let confirmQuit = false;
  function setGameHead(warn) {
    confirmQuit = warn;
    const t = $('[data-game-title]'), b = $('[data-game-close]');
    t.textContent = warn ? 'Keluar sekarang? Skor dihitung 0.' : 'Caffeine Challenge';
    t.classList.toggle('warn', warn);
    b.textContent = warn ? 'Keluar' : 'Tutup';
    b.classList.toggle('warn', warn);
  }
  function openGame() {
    hideError();
    const f = form.elements;
    if (!f.nama.value.trim()) return showError('Tulis nama dulu, supaya hasil Caffeine Challenge tercatat atas namamu.', f.nama);
    if (!normalWA(f.wa.value)) return showError('Tulis nomor WhatsApp yang aktif dulu, contoh 081234567890.', f.wa);
    if (!chItem() || !openEvent(nowWIB()) || ch.status === 'done') return renderChallenge();
    setGameHead(false);
    frame.src = '/main/?pesanan=1';
    game.showModal();
  }
  function closeGame() {
    if (ch.status === 'started') {                    // keluar di tengah permainan
      if (!confirmQuit) { setGameHead(true); return; }
      ch = { status: 'done', score: 0, tier: 'voucher', taps: '', stopped: true };
      saveCh(); logChallenge('keluar di tengah');
    }
    game.close();
  }
  $('[data-ch-play]').addEventListener('click', openGame);
  $('[data-game-close]').addEventListener('click', closeGame);
  game.addEventListener('cancel', e => { e.preventDefault(); closeGame(); });   // tombol Esc / kembali
  game.addEventListener('close', () => { frame.src = 'about:blank'; setGameHead(false); renderCart(); });

  window.addEventListener('message', e => {
    if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
    const m = e.data || {};
    if (m.type === 'caffeine-challenge:start') {
      if (ch.status === 'done') return;
      ch = { status: 'started', at: Date.now() }; saveCh();
    } else if (m.type === 'caffeine-challenge:result' && m.mode === 'challenge') {
      if (ch.status !== 'started') return;           // hanya hasil dari permainan yang dimulai di sini
      let api = null;
      try { api = frame.contentWindow.CaffeineChallenge; } catch (err) { api = null; }
      const taps = Array.isArray(m.taps) ? m.taps : [];
      let score = 0, tier = 'voucher';
      if (api) {
        const r = api.replay(taps);                   // hitung ulang dari rekaman tap, bukan percaya angka kiriman
        score = r.score; tier = api.tierFor(r.score).key;
      }
      ch = { status: 'done', score, tier, taps: api ? api.encodeTaps(taps) : '', stopped: false };
      saveCh(); logChallenge('selesai');
      setGameHead(false);
    } else if (m.type === 'caffeine-challenge:close') {
      game.close();
    }
  });
  // Kalau halaman ditutup di tengah permainan, kesempatan tetap terpakai
  if (ch.status === 'started') { ch = { status: 'done', score: 0, tier: 'voucher', taps: '', stopped: true }; saveCh(); }

  // 0812-3456-7890, +62 812..., 62812... -> 081234567890. Kosong kalau tidak valid.
  function normalWA(str) {
    let d = String(str).replace(/\D/g, '');
    if (d.startsWith('62')) d = '0' + d.slice(2);
    else if (d.startsWith('8')) d = '0' + d;
    return /^08\d{8,12}$/.test(d) ? d : '';
  }

  function buildMessage(v, t, free, chLine) {
    const lines = cart.map(i => {
      const d = drinkOf(i.id), u = sizeOf(i.size);
      return `- ${i.qty}x ${d.nama} ${u.nama} (${u.oz} oz) = ${rupiah(priceOf(i) * i.qty)}`;
    });
    const terima = v.cara_terima === 'Diantar' ? `Diantar ke ${v.lokasi}` : `Ambil sendiri di ${C.lokasiAmbil}`;
    return [
      'Halo Code Caffeine, saya mau pre-order.',
      '',
      `Nama: ${v.nama}`,
      `No. WA: ${v.wa}`,
      `Untuk: ${tanggal(t, true)}`,
      '',
      'Pesanan:',
      ...lines,
      free ? `Tukar kartu stamp: 1 ${drinkOf(free.id).nama} Small gratis (−${rupiah(priceOf(free))})` : null,
      wantsVoucher() ? `Pakai voucher Caffeine Challenge: −${rupiah(voucherCut())}` : null,
      chLine,
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
    const chI = ch.status === 'done' ? chItem() : null;
    const chLine = chI ? `Caffeine Challenge: skor ${fmtSkor(ch.score)}, ${(BONUS[ch.tier] || BONUS.voucher).pesan(drinkOf(chI.id).nama)}${ch.stopped ? ' (berhenti di tengah)' : ''}` : null;
    const msg = buildMessage(v, ev.day, free, chLine);

    // Catatan pesanan untuk kelompok (Netlify Forms). Gagal mencatat tidak menghalangi pesanan.
    f.wa.value = v.wa;
    f.untuk_hari.value = tanggal(ev.day, true);
    f.pesanan.value = cart.map(i => `${i.qty}x ${drinkOf(i.id).nama} ${sizeOf(i.size).nama}`).join('; ');
    f.jumlah_cup.value = String(cartCount());
    f.total.value = String(netTotal());
    f.stamp_gratis.value = free ? `${drinkOf(free.id).nama} Small (${priceOf(free)})` : '';
    f.challenge.value = chI ? `${drinkOf(chI.id).nama} Medium: ${(BONUS[ch.tier] || BONUS.voucher).teks}${ch.stopped ? ' (berhenti di tengah)' : ''}` : '';
    f.challenge_skor.value = chI ? String(ch.score) : '';
    f.challenge_rekaman.value = chI ? (ch.taps || '') : '';
    try {
      if (location.protocol.startsWith('http') && navigator.sendBeacon) {
        navigator.sendBeacon('/', new URLSearchParams(new FormData(form)));
      }
    } catch (err) { /* abaikan */ }

    // Keranjang dikosongkan supaya pesanan yang sama tidak terkirim dua kali
    cart = []; save();
    f.tukar_stamp.checked = false;
    f.pakai_voucher.checked = false;
    if (chI) { ch = { status: 'none' }; saveCh(); }  // pesanan baru dapat kesempatan baru
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
  $('[data-hero-cup]').innerHTML = cupPhoto(drinkOf('dirty-latte'), 'L', true);
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
