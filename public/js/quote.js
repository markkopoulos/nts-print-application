/**
 * Quote request modal (inspired by the step-based form the client liked)
 * + general contact form.
 */
import { toast } from './studio.js';
import { track } from './analytics.js';
import { shake, success, haptic } from './motion.js';

const C = window.CATALOG;
const { t, pick } = window.I18N;
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

/** Map an HTTP status to a localized message (server messages are Greek-only). */
const requestError = status => t(status === 429 ? 'err.rate' : status === 400 ? 'err.invalid' : 'err.generic');

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
      `<label class="chip"><input type="radio" name="garment" value="${key}"><span data-i18n-cat="garments.${key}.label"></span></label>`);
  });

  const cWrap = $('#qColors');
  C.colors.forEach((col, i) => {
    cWrap.insertAdjacentHTML('beforeend',
      `<label class="sw-radio${col.light ? ' sw--light' : ''}" data-i18n-cat-attr="title:colors.${i}.name">
         <input type="radio" name="color" value="${i}" data-i18n-cat-attr="aria-label:colors.${i}.name">
         <span style="--c:${col.hex}"></span>
       </label>`);
  });

  const pWrap = $('#qPositions');
  // print positions set up in the Mockup Studio: catalog position index -> { file, fileName }
  let studioPrints = { 0: {} };
  const defKey = i => (studioPrints[i] ? 'q.fromStudio' : 'q.upload');
  C.positions.forEach((p, i) => {
    // value = Greek name, so saved requests are always consistent for the admin panel
    pWrap.insertAdjacentHTML('beforeend', `
      <div class="pos-row" data-pos="${i}">
        <label class="chip"><input type="checkbox" name="positions" value="${p.el}" ${i === 0 ? 'checked' : ''}><span data-i18n-cat="positions.${i}"></span></label>
        ${p.other ? `<input class="field pos-other" name="positionOther" maxlength="60" data-i18n-attr="placeholder:q.otherPh" hidden>` : ''}
        <label class="pos-file" ${i === 0 ? '' : 'hidden'}>
          ${ICON_UP}<span data-fname data-i18n="${defKey(i)}"></span>
          <input type="file" accept="${ACCEPT}">
        </label>
        <button type="button" class="pos-x" hidden data-i18n-attr="aria-label:q.removeFile">&times;</button>
      </div>`);
  });

  const sWrap = $('#qSizes');
  C.sizes.forEach(s => {
    sWrap.insertAdjacentHTML('beforeend',
      `<label class="size"><span>${s}</span><input type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-size="${s}" aria-label="${s}"></label>`);
  });

  const tWrap = $('#qTechnique');
  C.techniques.forEach((tech, i) => {
    tWrap.insertAdjacentHTML('beforeend',
      `<label class="chip"><input type="radio" name="technique" value="${tech.el}" ${i === C.techniques.length - 1 ? 'checked' : ''}><span data-i18n-cat="techniques.${i}"></span></label>`);
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

    chk.addEventListener('change', () => {
      fileLabel.hidden = !chk.checked;
      if (other) other.hidden = !chk.checked;
      if (!chk.checked) clear();
      update();
    });
    fileInput.addEventListener('change', () => {
      const f = fileInput.files[0];
      if (!f) return;
      if (f.size > MAX) { toast(t('studio.tooBig')); fileInput.value = ''; return; }
      files[i] = f;
      fname.removeAttribute('data-i18n');
      fname.textContent = f.name;
      fileLabel.classList.add('has-file');
      x.hidden = false;
    });
    function clear() {
      delete files[i];
      fileInput.value = '';
      fname.setAttribute('data-i18n', defKey(i));
      fname.textContent = t(defKey(i));
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

    const posLabel = v => { const p = C.positions.find(x => x.el === v); return p ? pick(p) : v; };
    const tech = C.techniques.find(x => x.el === F('technique').value);
    $('#sumGarment').textContent = g.name ? pick(g.name) : '—';
    $('#sumColor').innerHTML = color ? `<i style="--c:${color.hex}"></i>${pick(color.name)}` : '—';
    $('#sumPositions').textContent = positions.length ? positions.map(posLabel).join(', ') : '—';
    $('#sumQty').textContent = total ? `${total} ${t('q.pcs')}` : '—';
    $('#sumTech').textContent = tech ? pick(tech) : '—';
    $('#qTitle').textContent = g.name ? pick(g.name) : '';
    $('#qSpec').textContent = g.spec ? pick(g.spec) : '';

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
    // choosing a technique here switches the studio preview too (embroidery look vs print)
    if (e.target.name === 'technique') {
      const v = e.target.value;
      if (v === 'Κέντημα') studio.setFinish('embroidery').then(refreshPreview);
      else if (v !== 'Δεν είμαι σίγουρος/η') studio.setFinish('print').then(refreshPreview);
    }
    update();
  });

  /** tick the positions designed in the studio and label their file as "From the Mockup Studio" */
  function syncPositionsFromStudio() {
    const prints = studio.getPrints();
    studioPrints = {};
    prints.forEach(pr => { studioPrints[pr.pos] = pr; });
    $$('.pos-row', pWrap).forEach(row => {
      const i = +row.dataset.pos;
      const on = !!studioPrints[i] || !!files[i];
      $('input[type=checkbox]', row).checked = on;
      $('.pos-file', row).hidden = !on;
      if (!files[i]) {
        const fn = $('[data-fname]', row);
        fn.setAttribute('data-i18n', defKey(i));
        fn.textContent = t(defKey(i));
      }
    });
  }

  async function refreshPreview() {
    if (!studio) return;
    const img = $('#qPreview');
    const box = img.closest('.q-preview');
    box.classList.add('is-loading'); // shimmer until the new mockup is decoded
    try {
      img.src = await studio.snapshot(900);
      await img.decode().catch(() => {});
    } catch (e) { /* ignore */ }
    box.classList.remove('is-loading');
  }

  /* ---------- Open / close ---------- */
  function open() {
    track('quote_open');
    lastFocus = document.activeElement;
    if (studio) {
      const st = studio.getState();
      F('garment').value = st.garment;
      F('color').value = String(st.colorIndex);
      syncPositionsFromStudio();
      if (st.finishTouched) {
        const want = st.finish === 'embroidery' ? 'Κέντημα' : 'Εκτύπωση DTF';
        const radio = $$('input[name=technique]', form).find(r => r.value === want);
        if (radio) radio.checked = true;
      }
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
    if (!positions.length) { setErr('positions', t('err.pos')); ok = false; }
    if (!total) { setErr('sizes', t('err.sizes')); ok = false; }
    if (!F('name').value.trim()) { setErr('name', t('err.required')); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(F('email').value.trim())) { setErr('email', t('err.email')); ok = false; }
    if (!F('consent').checked) { setErr('consent', t('err.consent')); ok = false; }
    if (!ok) {
      const first = $('.err:not(:empty)', form);
      const sec = first?.closest('fieldset, .field-wrap, label');
      sec?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => shake(sec), 280);
      haptic(12);
      return;
    }

    const btn = $('#qSubmit');
    btn.disabled = true;
    btn.classList.add('is-loading');

    try {
      const posPayload = await Promise.all(positions.map(async chk => {
        const i = +chk.closest('.pos-row').dataset.pos;
        // a file picked here wins; otherwise the logo uploaded for that position in the studio
        const file = files[i] ? await readAsDataURL(files[i]) : (studioPrints[i] && studioPrints[i].file) || null;
        return { name: chk.value, file };
      }));
      const color = C.colors[+F('color').value];
      const g = C.garments[F('garment').value];

      const payload = {
        type: 'quote',
        garment: F('garment').value,
        garmentLabel: g.name.el,
        colorName: color.name.el,
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
        mockup: studio ? await studio.snapshot(1000) : ''
      };

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(requestError(res.status));

      $('#qDoneId').textContent = data.leadId;
      modal.classList.add('is-done');
      track('quote_submit');
    } catch (err) {
      $('#qMsg').textContent = err.message || t('err.generic');
      shake($('#qMsg'));
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  });

  $('#qNew')?.addEventListener('click', () => {
    form.reset();
    Object.keys(files).forEach(k => delete files[k]);
    studioPrints = { 0: {} };
    $$('.pos-row', pWrap).forEach((row, i) => {
      $('.pos-file', row).hidden = i !== 0;
      $('.pos-file', row).classList.remove('has-file');
      const fn = $('[data-fname]', row);
      fn.setAttribute('data-i18n', defKey(i));
      fn.textContent = t(defKey(i));
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
    const fn = $('[data-fname]', form);
    if (f) { fn.removeAttribute('data-i18n'); fn.textContent = f.name; }
    else { fn.setAttribute('data-i18n', 'f.attach'); fn.textContent = t('f.attach'); }
    fileLabel.classList.toggle('has-file', !!f);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('.form-msg', form);
    msg.className = 'form-msg';
    msg.textContent = '';
    if (!form.checkValidity()) {
      msg.classList.add('is-err');
      msg.textContent = t('err.contactRequired');
      shake(form.querySelector(':invalid')?.closest('label') || msg);
      haptic(12);
      form.reportValidity();
      return;
    }
    const f = fileInput.files[0];
    if (f && f.size > MAX) { msg.classList.add('is-err'); msg.textContent = t('studio.tooBig'); return; }

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
      if (!res.ok || !data.success) throw new Error(requestError(res.status));
      form.reset();
      const fn = $('[data-fname]', form);
      fn.setAttribute('data-i18n', 'f.attach');
      fn.textContent = t('f.attach');
      fileLabel.classList.remove('has-file');
      msg.classList.add('is-ok');
      msg.textContent = t('ok.contact', { id: data.leadId });
      success(btn, 1600);
      haptic(18);
      track('contact_submit');
    } catch (err) {
      msg.classList.add('is-err');
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  });
}
