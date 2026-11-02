/**
 * Quote request modal (inspired by the step-based form the client liked)
 * + general contact form.
 */
import { toast } from './studio.js';

const C = window.CATALOG;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const readAsDataURL = file => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(fr.result);
  fr.onerror = rej;
  fr.readAsDataURL(file);
});

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.svg,.ai,.eps';
const MAX = 10 * 1024 * 1024;

const ICON_UP = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>';

export function initQuote(studio) {
  const modal = $('#quote');
  if (!modal) return;
  const form = $('#quoteForm');
  const F = n => form.elements[n];
  const files = {}; // position index -> File
  let lastFocus = null;

  /* ---------- Build dynamic parts ---------- */
  const gWrap = $('#qGarments');
  Object.entries(C.garments).forEach(([key, g]) => {
    gWrap.insertAdjacentHTML('beforeend',
      `<label class="chip"><input type="radio" name="garment" value="${key}"><span>${g.label}</span></label>`);
  });

  const cWrap = $('#qColors');
  C.colors.forEach((col, i) => {
    cWrap.insertAdjacentHTML('beforeend',
      `<label class="sw-radio${col.light ? ' sw--light' : ''}" title="${col.name}">
         <input type="radio" name="color" value="${i}" aria-label="${col.name}">
         <span style="--c:${col.hex}"></span>
       </label>`);
  });

  const pWrap = $('#qPositions');
  C.positions.forEach((p, i) => {
    const other = p === 'Άλλο σημείο';
    pWrap.insertAdjacentHTML('beforeend', `
      <div class="pos-row" data-pos="${i}">
        <label class="chip"><input type="checkbox" name="positions" value="${p}" ${i === 0 ? 'checked' : ''}><span>${p}</span></label>
        ${other ? `<input class="field pos-other" name="positionOther" maxlength="60" placeholder="Πού; π.χ. πλάι, γιακάς, τσέπη" hidden>` : ''}
        <label class="pos-file" ${i === 0 ? '' : 'hidden'}>
          ${ICON_UP}<span data-fname>${i === 0 ? 'Από το Mockup Studio' : 'Ανεβάστε αρχείο'}</span>
          <input type="file" accept="${ACCEPT}">
        </label>
        <button type="button" class="pos-x" hidden aria-label="Αφαίρεση αρχείου">&times;</button>
      </div>`);
  });

  const sWrap = $('#qSizes');
  C.sizes.forEach(s => {
    sWrap.insertAdjacentHTML('beforeend',
      `<label class="size"><span>${s}</span><input type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-size="${s}" aria-label="Ποσότητα ${s}"></label>`);
  });

  const tWrap = $('#qTechnique');
  C.techniques.forEach((t, i) => {
    tWrap.insertAdjacentHTML('beforeend',
      `<label class="chip"><input type="radio" name="technique" value="${t}" ${i === C.techniques.length - 1 ? 'checked' : ''}><span>${t}</span></label>`);
  });

  /* ---------- Position rows behaviour ---------- */
  $$('.pos-row', pWrap).forEach(row => {
    const i = +row.dataset.pos;
    const chk = $('input[type=checkbox]', row);
    const fileLabel = $('.pos-file', row);
    const fileInput = $('input[type=file]', row);
    const fname = $('[data-fname]', row);
    const x = $('.pos-x', row);
    const other = $('.pos-other', row);
    const def = i === 0 ? 'Από το Mockup Studio' : 'Ανεβάστε αρχείο';

    chk.addEventListener('change', () => {
      fileLabel.hidden = !chk.checked;
      if (other) other.hidden = !chk.checked;
      if (!chk.checked) clear();
      update();
    });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      if (!f) return;
      if (f.size > MAX) { toast('Το αρχείο ξεπερνά τα 10MB.'); fileInput.value = ''; return; }
      files[i] = f;
      fname.textContent = f.name;
      fileLabel.classList.add('has-file');
      x.hidden = false;
    });
    function clear() {
      delete files[i];
      fileInput.value = '';
      fname.textContent = def;
      fileLabel.classList.remove('has-file');
      x.hidden = true;
    }
    x.addEventListener('click', clear);
  });

  /* ---------- Live summary / progress ---------- */
  function totals() {
    let total = 0;
    const sizes = {};
    $$('[data-size]', sWrap).forEach(inp => {
      const n = Math.max(0, parseInt(inp.value, 10) || 0);
      if (n) { sizes[inp.dataset.size] = n; total += n; }
      inp.closest('.size').classList.toggle('has-val', n > 0);
    });
    return { total, sizes };
  }

  function update() {
    const { total } = totals();
    $('#qTotal').textContent = total;
    const st = studio ? studio.getState() : null;
    const color = C.colors[+(F('color').value || 0)];
    const g = C.garments[F('garment').value] || {};
    const positions = $$('input[name=positions]:checked', pWrap).map(i => i.value);

    $('#sumGarment').textContent = g.name || '—';
    $('#sumColor').innerHTML = color ? `<i style="--c:${color.hex}"></i>${color.name}` : '—';
    $('#sumPositions').textContent = positions.length ? positions.join(', ') : '—';
    $('#sumQty').textContent = total ? `${total} τεμ.` : '—';
    $('#sumTech').textContent = F('technique').value || '—';
    $('#qTitle').textContent = g.name || '';
    $('#qSpec').textContent = g.spec || '';

    // progress: product, positions, sizes, contact, consent
    const steps = [
      !!F('garment').value,
      positions.length > 0,
      total > 0,
      F('name').value.trim() && /\S+@\S+\.\S+/.test(F('email').value),
      F('consent').checked
    ];
    const pct = Math.round(steps.filter(Boolean).length / steps.length * 100);
    $('#qProgress').style.width = pct + '%';
    $('#qProgressTxt').textContent = pct + '%';
    return st;
  }

  form.addEventListener('input', update);
  form.addEventListener('change', e => {
    if (!studio) return update();
    if (e.target.name === 'garment') studio.setGarment(e.target.value).then(refreshPreview);
    if (e.target.name === 'color') { studio.setColor(+e.target.value); refreshPreview(); }
    update();
  });

  async function refreshPreview() {
    if (!studio) return;
    const img = $('#qPreview');
    img.classList.add('is-loading');
    try {
      img.src = await studio.snapshot(900);
    } catch (e) { /* ignore */ }
    img.classList.remove('is-loading');
  }

  /* ---------- Open / close ---------- */
  function open() {
    lastFocus = document.activeElement;
    if (studio) {
      const st = studio.getState();
      F('garment').value = st.garment;
      F('color').value = String(st.colorIndex);
      refreshPreview();
    } else {
      F('garment').value = 'tshirt';
      F('color').value = '0';
    }
    update();
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-open'));
    document.documentElement.classList.add('no-scroll');
    setTimeout(() => $('#qSizes input')?.focus({ preventScroll: true }), 350);
  }
  function close() {
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('no-scroll');
    setTimeout(() => { modal.hidden = true; }, 250);
    lastFocus?.focus?.();
  }
  $$('[data-quote]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); open(); }));
  $$('[data-close]', modal).forEach(b => b.addEventListener('click', close));
  $('[data-edit]', modal)?.addEventListener('click', () => { close(); document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' }); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

  /* ---------- Submit ---------- */
  function setErr(name, msg) {
    const el = $(`[data-err="${name}"]`, form);
    if (el) el.textContent = msg || '';
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    ['sizes', 'name', 'email', 'consent', 'positions'].forEach(n => setErr(n));
    const { total, sizes } = totals();
    const positions = $$('input[name=positions]:checked', pWrap);
    let ok = true;
    if (!positions.length) { setErr('positions', 'Επιλέξτε τουλάχιστον μία θέση.'); ok = false; }
    if (!total) { setErr('sizes', 'Συμπληρώστε ποσότητα σε τουλάχιστον ένα μέγεθος.'); ok = false; }
    if (!F('name').value.trim()) { setErr('name', 'Υποχρεωτικό πεδίο.'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(F('email').value.trim())) { setErr('email', 'Συμπληρώστε έγκυρο email.'); ok = false; }
    if (!F('consent').checked) { setErr('consent', 'Απαιτείται αποδοχή.'); ok = false; }
    if (!ok) {
      const first = $('.err:not(:empty)', form);
      first?.closest('fieldset, .field-wrap, label')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const btn = $('#qSubmit');
    btn.disabled = true;
    btn.classList.add('is-loading');

    try {
      const posPayload = await Promise.all(positions.map(async chk => {
        const i = +chk.closest('.pos-row').dataset.pos;
        return { name: chk.value, file: files[i] ? await readAsDataURL(files[i]) : null };
      }));
      const color = C.colors[+F('color').value];
      const g = C.garments[F('garment').value];

      const payload = {
        type: 'quote',
        garment: F('garment').value,
        garmentLabel: g.name,
        colorName: color.name,
        colorHex: color.hex,
        technique: F('technique').value,
        positions: posPayload,
        positionOther: F('positionOther') ? F('positionOther').value : '',
        sizes,
        name: F('name').value,
        company: F('company').value,
        email: F('email').value,
        phone: F('phone').value,
        message: F('message').value,
        consent: F('consent').checked,
        website: F('website').value,
        mockup: studio ? await studio.snapshot(1000) : '',
        studioLogo: studio ? studio.rawLogoForUpload() : null
      };

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Αποτυχία αποστολής.');

      $('#qDoneId').textContent = data.leadId;
      modal.classList.add('is-done');
    } catch (err) {
      $('#qMsg').textContent = err.message || 'Κάτι πήγε στραβά. Δοκιμάστε ξανά.';
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  });

  $('#qNew')?.addEventListener('click', () => {
    form.reset();
    Object.keys(files).forEach(k => delete files[k]);
    $$('.pos-row', pWrap).forEach((row, i) => {
      $('.pos-file', row).hidden = i !== 0;
      $('.pos-file', row).classList.remove('has-file');
      $('[data-fname]', row).textContent = i === 0 ? 'Από το Mockup Studio' : 'Ανεβάστε αρχείο';
      $('.pos-x', row).hidden = true;
    });
    modal.classList.remove('is-done');
    close();
  });
}

export function initContact() {
  const form = $('#contactForm');
  if (!form) return;
  const F = n => form.elements[n];
  const fileInput = $('input[type=file]', form);
  const fileLabel = $('.file-drop', form);

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    $('[data-fname]', form).textContent = f ? f.name : 'Επισυνάψτε το logo ή το σχέδιό σας';
    fileLabel.classList.toggle('has-file', !!f);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('.form-msg', form);
    msg.className = 'form-msg';
    msg.textContent = '';
    if (!form.checkValidity()) {
      msg.classList.add('is-err');
      msg.textContent = 'Συμπληρώστε τα υποχρεωτικά πεδία (*) και αποδεχτείτε την πολιτική απορρήτου.';
      form.reportValidity();
      return;
    }
    const f = fileInput.files[0];
    if (f && f.size > MAX) { msg.classList.add('is-err'); msg.textContent = 'Το αρχείο ξεπερνά τα 10MB.'; return; }

    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contact',
          name: F('name').value,
          company: F('company').value,
          email: F('email').value,
          phone: F('phone').value,
          interest: F('interest').value,
          quantityText: F('qty').value,
          message: F('message').value,
          consent: F('consent').checked,
          website: F('website').value,
          file: f ? await readAsDataURL(f) : null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Αποτυχία αποστολής.');
      form.reset();
      $('[data-fname]', form).textContent = 'Επισυνάψτε το logo ή το σχέδιό σας';
      fileLabel.classList.remove('has-file');
      msg.classList.add('is-ok');
      msg.textContent = `Ευχαριστούμε! Λάβαμε το μήνυμά σας (#${data.leadId}) και θα επικοινωνήσουμε σύντομα.`;
    } catch (err) {
      msg.classList.add('is-err');
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  });
}
