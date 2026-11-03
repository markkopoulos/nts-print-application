/**
 * Turns a logo into an embroidery preview (canvas only, no libraries):
 *   1. hard edges           – thread can't do soft gradients or semi-transparent pixels
 *   2. ≤ 8 thread colours   – each pixel snaps to the most common colours of the logo
 *   3. satin stitches       – fine directional threads; direction alternates per colour area
 *   4. raised look          – a height map from the shape, lit from the top-left
 * Returns { color, height } data URLs: the coloured preview and a grayscale height map
 * (used as a bump map in 3D so the stitches catch the light).
 */
const cache = new Map();

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

/** separable box blur on a Float32Array (w*h), radius r, in place-ish */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), d = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / d;
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / d;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

export async function embroider(src, { maxColors = 8, size = 560 } = {}) {
  if (cache.has(src)) return cache.get(src);
  const im = await loadImage(src);
  const iw = im.naturalWidth || size, ih = im.naturalHeight || size;
  const k = Math.min(1, size / Math.max(iw, ih));
  const pad = 10;
  const w = Math.round(iw * k) + pad * 2, h = Math.round(ih * k) + pad * 2;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(im, pad, pad, w - pad * 2, h - pad * 2);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data, n = w * h;

  // 1. coverage mask
  const mask = new Float32Array(n);
  for (let i = 0; i < n; i++) mask[i] = d[i * 4 + 3] > 110 ? 1 : 0;

  // 2. thread palette: most common colours (4 bits per channel buckets)
  const buckets = new Map();
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const key = ((d[i * 4] >> 4) << 8) | ((d[i * 4 + 1] >> 4) << 4) | (d[i * 4 + 2] >> 4);
    const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += d[i * 4]; b.g += d[i * 4 + 1]; b.b += d[i * 4 + 2];
    buckets.set(key, b);
  }
  const palette = [];
  [...buckets.values()].sort((a, b) => b.n - a.n).forEach(b => {
    const col = [b.r / b.n, b.g / b.n, b.b / b.n];
    // merge colours a thread buyer would treat as the same
    if (palette.length < maxColors && palette.every(p => Math.hypot(p[0] - col[0], p[1] - col[1], p[2] - col[2]) > 38)) palette.push(col);
  });
  if (!palette.length) palette.push([200, 200, 200]);
  const region = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    let best = 0, bd = Infinity;
    for (let p = 0; p < palette.length; p++) {
      const dd = (d[i * 4] - palette[p][0]) ** 2 + (d[i * 4 + 1] - palette[p][1]) ** 2 + (d[i * 4 + 2] - palette[p][2]) ** 2;
      if (dd < bd) { bd = dd; best = p; }
    }
    region[i] = best;
  }

  // 4. height: blurred mask → rounded ridge at every edge (also between colour areas)
  const edge = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (mask[i] && (region[i] !== region[i - 1] || region[i] !== region[i + 1] || region[i] !== region[i - w] || region[i] !== region[i + w])) edge[i] = 1;
    }
  }
  const soft = boxBlur(boxBlur(mask, w, h, 3), w, h, 2);
  const seams = boxBlur(edge, w, h, 1);
  const height = new Float32Array(n);
  for (let i = 0; i < n; i++) height[i] = mask[i] ? Math.min(1, soft[i] * 1.6) * (1 - 0.45 * Math.min(1, seams[i] * 2)) : 0;

  const out = g.createImageData(w, h), od = out.data;
  const hm = g.createImageData(w, h), hd = hm.data;
  for (let i = 3; i < hd.length; i += 4) hd[i] = 255; // opaque black = flat
  const L = [-0.55, -0.65, 0.52]; // light from the top-left
  const angles = [Math.PI / 4, -Math.PI / 4, Math.PI / 2.6, -Math.PI / 6];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      // gradient of the soft mask: direction across the nearest edge
      const gx = soft[i + 1] - soft[i - 1], gy = soft[i + w] - soft[i - w];
      const border = soft[i] < 0.93 && (gx || gy);
      let stitch, rowGap = 1;
      if (border) {
        // 3a. satin border: threads run across the edge, so the stripes follow the outline
        const ea = Math.atan2(gy, gx);
        const along = -x * Math.sin(ea) + y * Math.cos(ea);
        stitch = 0.5 + 0.5 * Math.sin(along * 1.25);
      } else {
        // 3b. tatami fill: parallel threads (direction alternates per colour) with staggered row breaks
        const a = angles[region[i] % angles.length];
        const u = x * Math.cos(a) + y * Math.sin(a);
        const vv = -x * Math.sin(a) + y * Math.cos(a);
        stitch = 0.5 + 0.5 * Math.sin(u * 0.95 + Math.sin(vv * 0.35) * 0.6);
        const lane = Math.floor(u / 6.6);
        const pos = (vv + (lane % 3) * 6.5) / 19.5;
        if (pos - Math.floor(pos) < 0.09) rowGap = 0.78;
      }
      const fiber = (0.66 + 0.34 * stitch) * rowGap;
      // 4. lighting from the height map (raised thread, darker outline)
      const dx = (height[i + 1] - height[i - 1]) * 4.5, dy = (height[i + w] - height[i - w]) * 4.5;
      const len = Math.hypot(dx, dy, 1);
      const shade = (0.7 + 0.5 * ((-dx * L[0] - dy * L[1] + L[2]) / len)) * (soft[i] < 0.45 ? 0.72 : 1);
      const col = palette[region[i]];
      const f = fiber * shade;
      od[i * 4] = Math.min(255, col[0] * f + 18 * stitch);
      od[i * 4 + 1] = Math.min(255, col[1] * f + 18 * stitch);
      od[i * 4 + 2] = Math.min(255, col[2] * f + 18 * stitch);
      od[i * 4 + 3] = Math.round(255 * Math.min(1, soft[i] * 2.4));
      const hv = Math.round(255 * height[i] * (0.82 + 0.18 * stitch));
      hd[i * 4] = hd[i * 4 + 1] = hd[i * 4 + 2] = hv;
      hd[i * 4 + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  const color = c.toDataURL('image/png');
  g.putImageData(hm, 0, 0);
  const heightUrl = c.toDataURL('image/png');
  const result = { color, height: heightUrl, colors: palette.length };
  cache.set(src, result);
  if (cache.size > 24) cache.delete(cache.keys().next().value);
  return result;
}
