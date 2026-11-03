/**
 * Mockup Studio — 2D live mockup + 3D view, with several print positions.
 *
 * Every print position (front, left chest, back, sleeve) has its own logo, position and size.
 * Positions/sizes are fractions of that position's print area (catalog `placements`), so the
 * 2D preview, the exported PNG and the 3D decals always match.
 * Finish: 'print' (flat ink) or 'embroidery' (thread colours, satin stitches, raised).
 */
import { createGarment3D, webglAvailable } from './garment3d.js';
import { embroider } from './embroidery.js';
import { track } from './analytics.js';

const C = window.CATALOG;
const { t, pick } = window.I18N;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SAMPLE = 'assets/samples/logo-light.svg';
const KEYS = ['front', 'chest', 'back', 'sleeve'];

const svgCache = {};
function loadSvg(url) {
  if (!svgCache[url]) svgCache[url] = fetch(url).then(r => r.text());
  return svgCache[url];
}
function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

/** Removes a flat (usually white) background from raster logos */
async function knockOutBackground(src) {
  const im = await loadImage(src);
  const max = 1400;
  const r = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.round(im.naturalWidth * r), h = Math.round(im.naturalHeight * r);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(im, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const pts = [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]];
  let rs = 0, gs = 0, bs = 0, as = 0;
  pts.forEach(([x, y]) => { const i = (y * w + x) * 4; rs += d[i]; gs += d[i + 1]; bs += d[i + 2]; as += d[i + 3]; });
  rs /= 4; gs /= 4; bs /= 4; as /= 4;
  if (as < 200) return { src, removed: false }; // already transparent
  const T1 = 38, T2 = 80;
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.sqrt((d[i] - rs) ** 2 + (d[i + 1] - gs) ** 2 + (d[i + 2] - bs) ** 2);
    if (dist < T1) d[i + 3] = 0;
    else if (dist < T2) d[i + 3] = Math.round(d[i + 3] * (dist - T1) / (T2 - T1));
  }
  g.putImageData(img, 0, 0);
  return { src: c.toDataURL('image/png'), removed: true };
}

export function initStudio() {
  const root = $('#studio');
  if (!root) return null;

  const newPlacement = () => ({
    enabled: false, rawLogo: SAMPLE, rawIsRaster: false, rawName: '', userUploaded: false,
    logo: SAMPLE, emb: null, embFor: '', knockState: null, x: 0, y: 0, scale: null
  });
  const state = {
    garment: 'hoodie', colorIndex: 0, view: '2d', side: 'front',
    finish: 'print', finishTouched: false, knockout: true, active: 'front',
    pl: Object.fromEntries(KEYS.map(k => [k, newPlacement()]))
  };
  state.pl.front.enabled = true;

  const listeners = [];
  const emit = () => listeners.forEach(fn => fn(getState()));

  const art = $('#garmentArt');
  const wrap = $('.art-wrap', root);
  const stage = $('#studioStage');
  const sizeRange = $('#sizeRange');
  const sizeVal = $('#sizeVal');
  const knock = $('#knockout');
  const knockInfo = $('#knockInfo');
  let g3d = null;

  const cfg = () => C.garments[state.garment];
  const placements = () => cfg().placements || { front: { side: 'front', bounds: cfg().printBounds, scale: cfg().defaultScale } };
  const plCfg = key => placements()[key];
  const scaleOf = key => state.pl[key].scale ?? plCfg(key)?.scale ?? 0.6;
  const hasBack = () => !!cfg().svgBack && !!plCfg('back');
  const label = key => pick(C.placementInfo[key].label);
  const displaySrc = p => (state.finish === 'embroidery' && p.emb ? p.emb.color : p.logo);

  /* ---------- Print areas (one per position) ---------- */
  const areas = {};
  KEYS.forEach(key => {
    const el = document.createElement('div');
    el.className = 'print-area';
    el.dataset.pl = key;
    el.hidden = true;
    el.innerHTML = '<img alt="" draggable="false"><span class="print-tag"></span>';
    wrap.appendChild(el);
    areas[key] = { el, img: $('img', el), tag: $('.print-tag', el) };
    el.addEventListener('pointerdown', e => {
      if (state.active !== key) setActive(key);
      startDrag(e, key);
    });
  });

  function layoutAreas() {
    const pls = placements();
    KEYS.forEach(key => {
      const a = areas[key], c = pls[key], p = state.pl[key];
      const show = !!c && p.enabled && c.side === state.side;
      a.el.hidden = !show;
      if (!show) return;
      const b = c.bounds;
      Object.assign(a.el.style, {
        top: b.top + '%', left: b.left + '%', width: b.width + '%', height: b.height + '%',
        transform: c.rotate ? `rotate(${c.rotate}deg)` : ''
      });
      a.el.classList.toggle('is-active', key === state.active);
      a.el.classList.toggle('is-emb', state.finish === 'embroidery');
      a.tag.textContent = label(key);
      const src = displaySrc(p);
      if (a.img.getAttribute('src') !== src) a.img.src = src;
      a.img.alt = t('studio.logoAlt');
      Object.assign(a.img.style, { width: scaleOf(key) * 100 + '%', left: 50 + p.x * 100 + '%', top: 50 + p.y * 100 + '%' });
    });
    const s = Math.round(scaleOf(state.active) * 100);
    sizeRange.value = s;
    sizeVal.textContent = s + '%';
  }

  /* ---------- Colours ---------- */
  const colorWrap = $('#colorPicker');
  C.colors.forEach((col, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw' + (col.light ? ' sw--light' : '');
    b.style.setProperty('--c', col.hex);
    b.title = pick(col.name);
    b.setAttribute('aria-label', pick(col.name));
    b.dataset.i18nCatAttr = `title:colors.${i}.name;aria-label:colors.${i}.name`;
    b.dataset.index = i;
    b.addEventListener('click', () => setColor(i));
    colorWrap.appendChild(b);
  });

  function paintArt() {
    const col = C.colors[state.colorIndex];
    $$('.garment-color-fill', art).forEach(el => (el.style.fill = col.hex));
  }

  function setColor(i) {
    state.colorIndex = i;
    const col = C.colors[i];
    $$('.sw', colorWrap).forEach(s => s.classList.toggle('is-active', +s.dataset.index === i));
    $('#colorName').textContent = pick(col.name);
    paintArt();
    stage.classList.toggle('on-light', !!col.light);
    if (g3d) g3d.setColor(col.hex);
    emit();
  }

  /* ---------- Sides (front / back artwork) ---------- */
  async function setSide(side) {
    if (side === 'back' && !hasBack()) side = 'front';
    state.side = side;
    $$('#sideToggle [data-side]').forEach(b => b.classList.toggle('is-active', b.dataset.side === side));
    const url = side === 'back' ? cfg().svgBack : cfg().svg;
    const svg = await loadSvg(url);
    if (state.side !== side) return; // another switch happened meanwhile
    art.innerHTML = svg;
    paintArt();
    layoutAreas();
  }
  $$('#sideToggle [data-side]').forEach(b => b.addEventListener('click', () => {
    const side = b.dataset.side;
    // jump to an enabled position on that side, if there is one
    const target = Object.keys(placements()).find(k => state.pl[k].enabled && plCfg(k).side === side);
    if (target) setActive(target);
    else { setSide(side); if (g3d) g3d.focus(side); }
  }));

  /* ---------- Garments ---------- */
  async function setGarment(key) {
    const c = C.garments[key];
    if (!c) return;
    state.garment = key;
    $$('[data-garment]', root).forEach(b => b.classList.toggle('is-active', b.dataset.garment === key));
    $('#garmentName').textContent = pick(c.name);
    $('#garmentSpec').textContent = pick(c.spec);
    KEYS.forEach(k => {
      state.pl[k].x = 0; state.pl[k].y = 0; state.pl[k].scale = null;
      if (!plCfg(k)) state.pl[k].enabled = false;
    });
    if (!Object.keys(placements()).some(k => state.pl[k].enabled)) state.pl.front.enabled = true;
    if (!plCfg(state.active) || !state.pl[state.active].enabled) state.active = 'front';
    $('#sideToggle').hidden = !hasBack();
    renderChips();
    await setSide(plCfg(state.active).side);

    const btn3d = $('[data-view="3d"]', root);
    btn3d.disabled = !c.has3d || !webglAvailable();
    btn3d.title = t(c.has3d ? 'studio.t3d' : 'studio.no3d');
    if (!c.has3d && state.view === '3d') setView('2d');
    if (g3d) { g3d.setGarment(key); syncAll3d(); }
    emit();
  }
  $$('.gp[data-garment]', root).forEach(b => b.addEventListener('click', () => {
    if (b.dataset.garment !== state.garment) setGarment(b.dataset.garment);
  }));

  /* ---------- Print positions ---------- */
  const chipWrap = $('#placementPicker');
  function renderChips() {
    chipWrap.innerHTML = Object.keys(placements()).map(k => {
      const p = state.pl[k];
      return `<button type="button" class="pl-chip${p.enabled ? ' is-on' : ''}${k === state.active ? ' is-active' : ''}" data-pl="${k}" aria-pressed="${k === state.active}">
        <i aria-hidden="true">${p.enabled ? '✓' : '+'}</i><span>${label(k)}</span></button>`;
    }).join('');
    $('#activePlacementName').textContent = label(state.active);
    const enabledCount = Object.keys(placements()).filter(k => state.pl[k].enabled).length;
    $('#removePlacement').hidden = enabledCount < 2;
  }
  chipWrap.addEventListener('click', e => {
    const b = e.target.closest('[data-pl]');
    if (!b) return;
    const key = b.dataset.pl, p = state.pl[key];
    if (!p.enabled) {
      p.enabled = true;
      // a new position starts with the logo the customer already uploaded
      const src = Object.values(state.pl).find(o => o.enabled && o.userUploaded && o !== p);
      if (src && !p.userUploaded) Object.assign(p, { rawLogo: src.rawLogo, rawIsRaster: src.rawIsRaster, rawName: src.rawName, userUploaded: true });
      track('placement_add', { once: false });
      applyLogo(key);
    }
    setActive(key);
  });
  $('#removePlacement').addEventListener('click', () => {
    const p = state.pl[state.active];
    p.enabled = false;
    if (g3d) g3d.setPrint(state.active, { enabled: false });
    const next = Object.keys(placements()).find(k => state.pl[k].enabled) || 'front';
    state.pl[next].enabled = true;
    setActive(next);
    emit();
  });

  function setActive(key) {
    state.active = key;
    renderChips();
    const side = plCfg(key).side;
    if (side !== state.side) setSide(side); else layoutAreas();
    if (g3d) g3d.focus(key === 'back' ? 'back' : key === 'sleeve' ? 'sleeve' : 'front');
    $('#logoFileName').textContent = state.pl[key].rawName;
    $('#dropZone').classList.toggle('has-file', state.pl[key].userUploaded);
    renderKnockInfo();
  }

  /* ---------- Logo per position ---------- */
  async function applyLogo(key) {
    const p = state.pl[key];
    let src = p.rawLogo, removed = false;
    if (state.knockout && p.rawIsRaster) {
      try { ({ src, removed } = await knockOutBackground(p.rawLogo)); } catch (e) { /* keep original */ }
    }
    p.logo = src;
    p.knockState = p.rawIsRaster ? (removed ? 'removed' : 'nobg') : null;
    if (state.finish === 'embroidery') await ensureEmbroidery(key);
    if (key === state.active) renderKnockInfo();
    layoutAreas();
    syncPrint(key);
    emit();
  }

  async function ensureEmbroidery(key) {
    const p = state.pl[key];
    if (p.emb && p.embFor === p.logo) return;
    try {
      p.emb = await embroider(p.logo);
      p.embFor = p.logo;
    } catch (e) { p.emb = null; }
  }

  function renderKnockInfo() {
    const ks = state.pl[state.active].knockState;
    knockInfo.textContent = ks === 'removed' ? t('studio.removed') : ks === 'nobg' ? t('studio.noBg') : '';
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) { toast(t('studio.badFile')); return; }
    if (file.size > 10 * 1024 * 1024) { toast(t('studio.tooBig')); return; }
    const key = state.active;
    const reader = new FileReader();
    reader.onload = e => {
      Object.assign(state.pl[key], {
        rawLogo: e.target.result, rawIsRaster: file.type !== 'image/svg+xml', rawName: file.name, userUploaded: true
      });
      $('#logoFileName').textContent = file.name;
      $('#dropZone').classList.add('has-file');
      $$('[data-sample]', root).forEach(s => s.classList.remove('is-active'));
      track('logo_upload');
      applyLogo(key);
    };
    reader.readAsDataURL(file);
  }
  $('#logoInput').addEventListener('change', e => { handleFile(e.target.files[0]); e.target.value = ''; });
  [$('#dropZone'), stage].forEach(el => {
    ['dragenter', 'dragover'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.add('is-drag'); }));
    ['dragleave', 'drop'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.remove('is-drag'); }));
    el.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
  });
  $$('[data-sample]', root).forEach(s => s.addEventListener('click', () => {
    $$('[data-sample]', root).forEach(o => o.classList.remove('is-active'));
    s.classList.add('is-active');
    Object.assign(state.pl[state.active], { rawLogo: s.dataset.sample, rawIsRaster: false, userUploaded: false, rawName: '' });
    $('#logoFileName').textContent = '';
    $('#dropZone').classList.remove('has-file');
    applyLogo(state.active);
  }));
  knock.addEventListener('change', () => {
    state.knockout = knock.checked;
    KEYS.forEach(k => { if (state.pl[k].rawIsRaster) applyLogo(k); });
  });

  /* ---------- Finish: print / embroidery ---------- */
  async function setFinish(finish, { touched = true } = {}) {
    if (finish !== 'embroidery') finish = 'print';
    state.finish = finish;
    if (touched) state.finishTouched = true;
    $$('#finishToggle [data-finish]').forEach(b => b.classList.toggle('is-active', b.dataset.finish === finish));
    $('#embNote').hidden = finish !== 'embroidery';
    if (finish === 'embroidery') {
      track('finish_embroidery');
      stage.classList.add('is-busy');
      await Promise.all(KEYS.filter(k => state.pl[k].enabled).map(ensureEmbroidery));
      stage.classList.remove('is-busy');
    }
    layoutAreas();
    syncAll3d();
    emit();
  }
  $$('#finishToggle [data-finish]').forEach(b => b.addEventListener('click', () => setFinish(b.dataset.finish)));

  /* ---------- Size & placement of the active position ---------- */
  const setScale = v => { state.pl[state.active].scale = Math.max(0.1, Math.min(1.2, v)); layoutAreas(); syncPrint(state.active); };
  sizeRange.addEventListener('input', () => setScale(sizeRange.value / 100));
  $('#sizeMinus').addEventListener('click', () => setScale(scaleOf(state.active) - 0.05));
  $('#sizePlus').addEventListener('click', () => setScale(scaleOf(state.active) + 0.05));
  const PRESETS = {
    center: () => ({ x: 0, y: 0, scale: null }),
    big: () => ({ x: 0, y: 0.04, scale: 1 })
  };
  $$('[data-preset]', root).forEach(b => b.addEventListener('click', () => {
    $$('[data-preset]', root).forEach(o => o.classList.toggle('is-active', o === b));
    Object.assign(state.pl[state.active], PRESETS[b.dataset.preset]());
    layoutAreas();
    syncPrint(state.active);
  }));
  $('#resetBtn').addEventListener('click', () => {
    Object.assign(state.pl[state.active], PRESETS.center());
    $$('[data-preset]', root).forEach(o => o.classList.toggle('is-active', o.dataset.preset === 'center'));
    layoutAreas();
    syncPrint(state.active);
  });

  // dragging the logo inside its print area
  let drag = null;
  function startDrag(e, key) {
    const el = areas[key].el;
    const p = state.pl[key];
    drag = { key, x: e.clientX, y: e.clientY, sx: p.x, sy: p.y, rot: ((plCfg(key).rotate || 0) * Math.PI) / 180 };
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
  }
  wrap.addEventListener('pointermove', e => {
    if (!drag) return;
    const el = areas[drag.key].el;
    const w = el.offsetWidth, h = el.offsetHeight;
    // undo the area's rotation so dragging follows the pointer
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    const lx = dx * Math.cos(drag.rot) + dy * Math.sin(drag.rot);
    const ly = -dx * Math.sin(drag.rot) + dy * Math.cos(drag.rot);
    const p = state.pl[drag.key];
    p.x = Math.max(-0.6, Math.min(0.6, drag.sx + lx / w));
    p.y = Math.max(-0.6, Math.min(0.6, drag.sy + ly / h));
    layoutAreas();
    syncPrint(drag.key);
  });
  const endDrag = () => {
    if (!drag) return;
    areas[drag.key].el.classList.remove('is-dragging');
    drag = null;
  };
  wrap.addEventListener('pointerup', endDrag);
  wrap.addEventListener('pointercancel', endDrag);

  /* ---------- 3D ---------- */
  function syncPrint(key) {
    if (!g3d) return;
    const c = plCfg(key), p = state.pl[key];
    if (!c || !p.enabled) { g3d.setPrint(key, { enabled: false }); return; }
    const emb = state.finish === 'embroidery' && p.emb;
    g3d.setPrint(key, {
      enabled: true, src: displaySrc(p), bumpSrc: emb ? p.emb.height : null,
      side: c.side, bounds: c.bounds, x: p.x, y: p.y, scale: scaleOf(key), finish: emb ? 'embroidery' : 'print'
    });
  }
  function syncAll3d() {
    if (!g3d) return;
    g3d.setColor(C.colors[state.colorIndex].hex);
    KEYS.forEach(syncPrint);
  }
  function setView(v) {
    state.view = v;
    $$('[data-view]', root).forEach(b => b.classList.toggle('is-active', b.dataset.view === v));
    stage.dataset.view = v;
    if (v === '3d') {
      if (!g3d) {
        g3d = createGarment3D($('#studio3d'), { garment: state.garment, color: C.colors[state.colorIndex].hex, motion: 'sway' });
        syncAll3d();
      }
      g3d.focus(state.active === 'back' ? 'back' : state.active === 'sleeve' ? 'sleeve' : 'front');
      track('view_3d');
    }
  }
  $$('[data-view]', root).forEach(b => b.addEventListener('click', () => !b.disabled && setView(b.dataset.view)));

  /* ---------- Export (front, plus back when a back print is used) ---------- */
  async function sideSvgUrl(side) {
    const text = await loadSvg(side === 'back' ? cfg().svgBack : cfg().svg);
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const hex = C.colors[state.colorIndex].hex;
    doc.querySelectorAll('.garment-color-fill').forEach(el => el.setAttribute('style', `fill:${hex}`));
    return URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml;charset=utf-8' }));
  }

  async function drawSide(g, side, ox, W, H) {
    const url = await sideSvgUrl(side);
    try { g.drawImage(await loadImage(url), ox, 0, W, H); } finally { URL.revokeObjectURL(url); }
    const pls = placements();
    for (const key of KEYS) {
      const c = pls[key], p = state.pl[key];
      if (!c || !p.enabled || c.side !== side) continue;
      const img = await loadImage(displaySrc(p));
      const b = c.bounds;
      const pw = W * b.width / 100, ph = H * b.height / 100;
      const cx = ox + W * b.left / 100 + pw / 2, cy = H * b.top / 100 + ph / 2;
      const lw = scaleOf(key) * pw, lh = lw * ((img.naturalHeight || 1) / (img.naturalWidth || 1));
      g.save();
      g.translate(cx, cy);
      if (c.rotate) g.rotate((c.rotate * Math.PI) / 180);
      if (state.finish === 'embroidery') {
        g.shadowColor = 'rgba(0,0,0,.45)';
        g.shadowBlur = W / 300;
        g.shadowOffsetY = W / 500;
      } else g.globalAlpha = 0.96;
      g.drawImage(img, p.x * pw - lw / 2, p.y * ph - lh / 2, lw, lh);
      g.restore();
    }
  }

  async function snapshot(size = 1200) {
    const sides = ['front'];
    if (hasBack() && state.pl.back.enabled) sides.push('back');
    const W = size, H = Math.round(size * 650 / 600);
    const c = document.createElement('canvas');
    c.width = W * sides.length; c.height = H;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f5f6fc'); bg.addColorStop(1, '#e9ebf7');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, H);
    for (let i = 0; i < sides.length; i++) await drawSide(g, sides[i], i * W, W, H);

    g.fillStyle = '#6b6d80';
    g.font = `500 ${Math.round(W / 54)}px Geologica, system-ui, sans-serif`;
    g.textAlign = 'center';
    if (sides.length > 1) sides.forEach((s, i) => g.fillText(t(s === 'back' ? 'studio.back' : 'studio.front'), i * W + W / 2, Math.round(W / 22)));
    const finish = state.finish === 'embroidery' ? ` · ${t('studio.embroidery')}` : '';
    g.fillText(`${pick(cfg().name)} · ${pick(C.colors[state.colorIndex].name)}${finish}`, c.width / 2, H - Math.round(W / 35));
    return c.toDataURL('image/png');
  }

  $('#downloadBtn').addEventListener('click', async () => {
    const data = await snapshot();
    const a = document.createElement('a');
    a.href = data;
    a.download = `mockup-${state.garment}-${Date.now().toString().slice(-5)}.png`;
    a.click();
  });

  function getState() {
    const c = cfg();
    return {
      garment: state.garment, colorIndex: state.colorIndex, finish: state.finish, finishTouched: state.finishTouched,
      view: state.view, garmentLabel: pick(c.name), garmentSpec: pick(c.spec), color: C.colors[state.colorIndex]
    };
  }

  /** enabled print positions for the quote form: catalog position index + the customer's own file */
  function getPrints() {
    return Object.keys(placements()).filter(k => state.pl[k].enabled).map(k => {
      const p = state.pl[k];
      return { key: k, pos: C.placementInfo[k].pos, file: p.userUploaded ? p.rawLogo : null, fileName: p.rawName };
    });
  }

  const api = {
    getState, getPrints, snapshot, setColor, setFinish,
    setGarment: key => setGarment(key),
    onChange: fn => listeners.push(fn)
  };

  window.I18N.onChange(() => {
    const c = cfg();
    $('#garmentName').textContent = pick(c.name);
    $('#garmentSpec').textContent = pick(c.spec);
    $('#colorName').textContent = pick(C.colors[state.colorIndex].name);
    $('[data-view="3d"]', root).title = t(c.has3d ? 'studio.t3d' : 'studio.no3d');
    renderChips();
    layoutAreas();
    renderKnockInfo();
  });

  setGarment(state.garment).then(() => { setColor(state.colorIndex); applyLogo('front'); });
  return api;
}

export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('is-on'), 3200);
}
