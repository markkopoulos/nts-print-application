/**
 * Mockup Studio — 2D live mockup + optional 3D view.
 * Model: logo position (x, y) and size (scale) are stored as fractions of the
 * garment's print area, so DOM preview, PNG export and 3D view always match.
 */
import { createGarment3D, webglAvailable } from './garment3d.js';

const C = window.CATALOG;
const { t, pick } = window.I18N;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

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

  // sample the four corners
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

  const state = {
    garment: 'hoodie',
    colorIndex: 0,
    rawLogo: 'assets/samples/logo-light.svg',
    rawIsRaster: false,
    rawName: '',
    logo: 'assets/samples/logo-light.svg',
    knockout: true,
    x: 0,
    y: 0,
    scale: C.garments.hoodie.defaultScale,
    view: '2d',
    userUploaded: false,
    knockState: null // 'removed' | 'nobg' | null
  };
  const listeners = [];
  const emit = () => listeners.forEach(fn => fn(getState()));

  const art = $('#garmentArt');
  const printArea = $('#printArea');
  const logoImg = $('#logoImg');
  const stage = $('#studioStage');
  const sizeRange = $('#sizeRange');
  const sizeVal = $('#sizeVal');
  const knock = $('#knockout');
  const knockInfo = $('#knockInfo');
  let g3d = null;

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

  function setColor(i) {
    state.colorIndex = i;
    const col = C.colors[i];
    $$('.sw', colorWrap).forEach(s => s.classList.toggle('is-active', +s.dataset.index === i));
    $('#colorName').textContent = pick(col.name);
    $$('.garment-color-fill', art).forEach(el => (el.style.fill = col.hex));
    stage.classList.toggle('on-light', !!col.light);
    if (g3d) g3d.setColor(col.hex);
    emit();
  }

  /* ---------- Garments ---------- */
  async function setGarment(key, keepTransform = false) {
    const cfg = C.garments[key];
    if (!cfg) return;
    state.garment = key;
    $$('[data-garment]', root).forEach(b => b.classList.toggle('is-active', b.dataset.garment === key));
    $('#garmentName').textContent = pick(cfg.name);
    $('#garmentSpec').textContent = pick(cfg.spec);

    const b = cfg.printBounds;
    Object.assign(printArea.style, { top: b.top + '%', left: b.left + '%', width: b.width + '%', height: b.height + '%' });
    if (!keepTransform) { state.x = 0; state.y = 0; state.scale = cfg.defaultScale; }

    art.innerHTML = await loadSvg(cfg.svg);
    setColor(state.colorIndex);
    render();

    const btn3d = $('[data-view="3d"]', root);
    btn3d.disabled = !cfg.has3d || !webglAvailable();
    btn3d.title = t(cfg.has3d ? 'studio.t3d' : 'studio.no3d');
    if (!cfg.has3d && state.view === '3d') setView('2d');
    if (g3d) { g3d.setGarment(key); sync3d(); }
    emit();
  }

  /* ---------- Render logo transform ---------- */
  function render() {
    logoImg.style.width = (state.scale * 100) + '%';
    logoImg.style.left = (50 + state.x * 100) + '%';
    logoImg.style.top = (50 + state.y * 100) + '%';
    sizeRange.value = Math.round(state.scale * 100);
    sizeVal.textContent = Math.round(state.scale * 100) + '%';
    if (g3d) g3d.setLogoTransform({ x: state.x, y: state.y, scale: state.scale, bounds: C.garments[state.garment].printBounds });
  }

  function sync3d() {
    if (!g3d) return;
    g3d.setColor(C.colors[state.colorIndex].hex);
    g3d.setLogo(state.logo, { x: state.x, y: state.y, scale: state.scale, bounds: C.garments[state.garment].printBounds });
  }

  /* ---------- Logo ---------- */
  async function applyLogo() {
    let src = state.rawLogo, removed = false;
    if (state.knockout && state.rawIsRaster) {
      try { ({ src, removed } = await knockOutBackground(state.rawLogo)); } catch (e) { /* keep original */ }
    }
    state.logo = src;
    logoImg.src = src;
    state.knockState = state.rawIsRaster ? (removed ? 'removed' : 'nobg') : null;
    renderKnockInfo();
    if (g3d) g3d.setLogo(src, {});
    emit();
  }

  function renderKnockInfo() {
    knockInfo.textContent = state.knockState === 'removed' ? t('studio.removed')
      : state.knockState === 'nobg' ? t('studio.noBg') : '';
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast(t('studio.badFile'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) { toast(t('studio.tooBig')); return; }
    const reader = new FileReader();
    reader.onload = e => {
      state.rawLogo = e.target.result;
      state.rawIsRaster = file.type !== 'image/svg+xml';
      state.rawName = file.name;
      state.userUploaded = true;
      $('#logoFileName').textContent = file.name;
      $('#dropZone').classList.add('has-file');
      $$('[data-sample]', root).forEach(s => s.classList.remove('is-active'));
      applyLogo();
    };
    reader.readAsDataURL(file);
  }

  $('#logoInput').addEventListener('change', e => handleFile(e.target.files[0]));

  // drag & drop onto the drop-zone or the stage
  [$('#dropZone'), stage].forEach(el => {
    ['dragenter', 'dragover'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.add('is-drag'); }));
    ['dragleave', 'drop'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.remove('is-drag'); }));
    el.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
  });

  $$('[data-sample]', root).forEach(s => s.addEventListener('click', () => {
    $$('[data-sample]', root).forEach(o => o.classList.remove('is-active'));
    s.classList.add('is-active');
    state.rawLogo = s.dataset.sample;
    state.rawIsRaster = false;
    state.userUploaded = false;
    state.rawName = '';
    $('#logoFileName').textContent = '';
    $('#dropZone').classList.remove('has-file');
    applyLogo();
  }));

  knock.addEventListener('change', () => { state.knockout = knock.checked; applyLogo(); });

  /* ---------- Size & placement ---------- */
  sizeRange.addEventListener('input', () => { state.scale = sizeRange.value / 100; render(); });
  $('#sizeMinus').addEventListener('click', () => { state.scale = Math.max(0.1, state.scale - 0.05); render(); });
  $('#sizePlus').addEventListener('click', () => { state.scale = Math.min(1.2, state.scale + 0.05); render(); });

  const PRESETS = {
    center: () => ({ x: 0, y: 0, scale: C.garments[state.garment].defaultScale }),
    chest: () => ({ x: 0.26, y: -0.3, scale: 0.3 }),
    big: () => ({ x: 0, y: 0.06, scale: 1 })
  };
  $$('[data-preset]', root).forEach(b => b.addEventListener('click', () => {
    $$('[data-preset]', root).forEach(o => o.classList.remove('is-active'));
    b.classList.add('is-active');
    Object.assign(state, PRESETS[b.dataset.preset]());
    render();
  }));

  $('#resetBtn').addEventListener('click', () => {
    Object.assign(state, PRESETS.center());
    $$('[data-preset]', root).forEach(o => o.classList.toggle('is-active', o.dataset.preset === 'center'));
    render();
  });

  // Dragging the logo inside the print area
  let drag = null;
  printArea.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY, sx: state.x, sy: state.y };
    printArea.setPointerCapture(e.pointerId);
    printArea.classList.add('is-dragging');
  });
  printArea.addEventListener('pointermove', e => {
    if (!drag) return;
    const r = printArea.getBoundingClientRect();
    state.x = Math.max(-0.6, Math.min(0.6, drag.sx + (e.clientX - drag.x) / r.width));
    state.y = Math.max(-0.6, Math.min(0.6, drag.sy + (e.clientY - drag.y) / r.height));
    render();
  });
  const endDrag = () => { drag = null; printArea.classList.remove('is-dragging'); };
  printArea.addEventListener('pointerup', endDrag);
  printArea.addEventListener('pointercancel', endDrag);

  /* ---------- 2D / 3D view ---------- */
  function setView(v) {
    state.view = v;
    $$('[data-view]', root).forEach(b => b.classList.toggle('is-active', b.dataset.view === v));
    stage.dataset.view = v;
    if (v === '3d' && !g3d) {
      g3d = createGarment3D($('#studio3d'), { garment: state.garment, color: C.colors[state.colorIndex].hex, motion: 'sway' });
      sync3d();
    }
  }
  $$('[data-view]', root).forEach(b => b.addEventListener('click', () => !b.disabled && setView(b.dataset.view)));

  /* ---------- Export ---------- */
  async function snapshot(size = 1200) {
    const cfg = C.garments[state.garment];
    const W = size, H = Math.round(size * 650 / 600);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');

    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f5f6fc'); bg.addColorStop(1, '#e9ebf7');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    const svgEl = art.querySelector('svg');
    const svg = new XMLSerializer().serializeToString(svgEl);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const gImg = await loadImage(url);
    g.drawImage(gImg, 0, 0, W, H);
    URL.revokeObjectURL(url);

    const lImg = await loadImage(state.logo);
    const b = cfg.printBounds;
    const pw = W * b.width / 100, ph = H * b.height / 100;
    const cx = W * b.left / 100 + pw / 2 + state.x * pw;
    const cy = H * b.top / 100 + ph / 2 + state.y * ph;
    const lw = state.scale * pw;
    const lh = lw * ((lImg.naturalHeight || 1) / (lImg.naturalWidth || 1));
    g.globalAlpha = 0.96;
    g.drawImage(lImg, cx - lw / 2, cy - lh / 2, lw, lh);
    g.globalAlpha = 1;

    g.fillStyle = '#6b6d80';
    g.font = '500 22px Geologica, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(`${pick(cfg.name)} · ${pick(C.colors[state.colorIndex].name)}`, W / 2, H - 34);
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
    const cfg = C.garments[state.garment];
    return {
      ...state,
      garmentLabel: pick(cfg.name),
      garmentSpec: pick(cfg.spec),
      color: C.colors[state.colorIndex]
    };
  }

  // public API
  const api = {
    getState,
    snapshot,
    setColor,
    setGarment: key => setGarment(key),
    onChange: fn => listeners.push(fn),
    rawLogoForUpload: () => (state.userUploaded ? state.rawLogo : null)
  };

  // re-label everything that is set from JavaScript when the language changes
  window.I18N.onChange(() => {
    const cfg = C.garments[state.garment];
    $('#garmentName').textContent = pick(cfg.name);
    $('#garmentSpec').textContent = pick(cfg.spec);
    $('#colorName').textContent = pick(C.colors[state.colorIndex].name);
    const btn3d = $('[data-view="3d"]', root);
    btn3d.title = t(cfg.has3d ? 'studio.t3d' : 'studio.no3d');
    renderKnockInfo();
  });

  setGarment(state.garment).then(() => { applyLogo(); });
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
