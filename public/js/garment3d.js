/**
 * Garment3D — procedural Three.js garments with a live logo print.
 * Used in the hero and in the Mockup Studio (3D view).
 *
 * Every garment is modelled from parts instead of an extruded silhouette:
 *   torso   – superellipse cross-section tube with sloped shoulders, yoke and neckline
 *   sleeves – tapered tubes along a curve (short for T-shirt, long with rib cuffs otherwise)
 *   hoodie  – hood shell with inner lining, rim, drawstrings, raised kangaroo pocket
 *   cap     – 6-panel dome with seams, button and curved brim
 * The logo is a subdivided plane that follows the fabric surface (no floating card).
 *
 * Usage:
 *   const g = createGarment3D(el, { garment: 'tshirt', color: '#17181c', motion: 'spin' });
 *   g.setColor('#2c3192');
 *   g.setLogo(url, { bounds, x: 0, y: 0, scale: 0.6 });   // bounds = catalog printBounds (2D %)
 */
import * as THREE from '../vendor/three.module.min.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const TAU = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const spow = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);
/** smooth piecewise interpolation over [[t, value], ...] */
function profile(tbl, t) {
  if (t <= tbl[0][0]) return tbl[0][1];
  for (let i = 1; i < tbl.length; i++) {
    if (t <= tbl[i][0]) {
      const [t0, a] = tbl[i - 1], [t1, b] = tbl[i];
      return lerp(a, b, smooth(0, 1, (t - t0) / (t1 - t0)));
    }
  }
  return tbl[tbl.length - 1][1];
}

/** smooth 2D value noise in [0, 1] (deterministic, so garments look the same every load) */
function hash2(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/* 2D artwork coordinates (600 x 650 viewBox) -> model units */
const tx = x => x - 300;
const ty = y => 330 - y;

/* ------------------------------------------------------------------ */
/* Garment definitions (model units ≈ pixels of the 2D artwork)        */
/* ------------------------------------------------------------------ */
const LONG_SLEEVE = {
  pts: [[60, 165], [146, 160], [198, 92], [234, -28], [250, -146]],
  r: [44, 60, 56, 50, 46],
  zs: 0.84, cuff: true, cuffR: 39, long: true
};
const MODELS = {
  tshirt: {
    hemY: -272, topY: 270, drop: 48, n: 2.5, fold: 4, bulge: 9,
    W: [[0, 151], [0.5, 152], [0.8, 157], [0.93, 153], [1, 146]],
    D: [[0, 80], [0.45, 86], [0.8, 84], [1, 58]],
    neck: { y: 262, rx: 64, rz: 48, dip: 30, rib: 7 },
    rib: 0,
    sleeve: { pts: [[60, 172], [148, 170], [204, 142], [242, 118]], r: [44, 62, 58, 55], zs: 0.82, cuff: false, long: false }
  },
  sweatshirt: {
    hemY: -272, topY: 264, drop: 46, n: 2.5, fold: 3, bulge: 10,
    W: [[0, 138], [0.06, 141], [0.11, 153], [0.5, 155], [0.8, 160], [0.93, 155], [1, 147]],
    D: [[0, 76], [0.11, 86], [0.45, 90], [0.8, 88], [1, 60]],
    neck: { y: 256, rx: 62, rz: 48, dip: 18, rib: 10 },
    rib: 0.07,
    sleeve: LONG_SLEEVE
  },
  hoodie: {
    hemY: -272, topY: 262, drop: 44, n: 2.5, fold: 3, bulge: 10,
    W: [[0, 142], [0.06, 145], [0.11, 158], [0.5, 160], [0.8, 165], [0.93, 160], [1, 152]],
    D: [[0, 80], [0.11, 90], [0.45, 95], [0.8, 92], [1, 64]],
    neck: { y: 250, rx: 68, rz: 54, dip: 16, rib: 6 },
    rib: 0.07, hood: true, pocket: true,
    sleeve: LONG_SLEEVE
  },
  cap: { cap: true, tilt: 0.34, base: 0, Rx: 168, Ry: 168, Rz: 160, offsetY: -78, scale: 1.25 }
};

/* ------------------------------------------------------------------ */
/* Procedural textures                                                 */
/* ------------------------------------------------------------------ */
function knitTexture() {
  const S = 256, cells = 16, cs = S / cells;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#7a7a7a';
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const ox = x * cs, oy = y * cs;
      const grd = g.createLinearGradient(ox, oy, ox, oy + cs);
      grd.addColorStop(0, 'rgba(255,255,255,0.75)');
      grd.addColorStop(1, 'rgba(255,255,255,0.25)');
      g.fillStyle = grd;
      g.beginPath(); g.ellipse(ox + cs * 0.32, oy + cs * 0.5, cs * 0.2, cs * 0.46, -0.45, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(ox + cs * 0.68, oy + cs * 0.5, cs * 0.2, cs * 0.46, 0.45, 0, TAU); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** vertical rib knit (cuffs, hem bands, collars): stripes vary along texture x */
function ribTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 8;
  const g = c.getContext('2d');
  const img = g.createImageData(64, 8);
  for (let x = 0; x < 64; x++) {
    const v = Math.round(128 + 110 * Math.sin((x / 64) * TAU * 4));
    for (let y = 0; y < 8; y++) { const i = (y * 64 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function scaleUV(geo, sx, sy) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  return geo;
}

/** gray vertex colours used as baked ambient occlusion */
function setAO(geo, fn) {
  const P = geo.attributes.position, col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { const a = fn(i); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = a; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grd.addColorStop(0, 'rgba(14,16,34,0.6)');
  grd.addColorStop(0.45, 'rgba(14,16,34,0.22)');
  grd.addColorStop(1, 'rgba(14,16,34,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** Soft photo-studio reflections: a tiny room with emissive soft-boxes, prefiltered by PMREM */
function studioEnvironment(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: 0x4a4d5c, side: THREE.BackSide })));
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(4, 3, 0xffffff, 7, [3, 4, 4]);      // key soft-box
  panel(2.5, 4, 0xfff3e0, 2.6, [-5, 1, 2]); // warm fill
  panel(5, 1.6, 0x9aa2ff, 4, [-1, 3, -5]);  // cool rim
  panel(8, 8, 0x5c5f70, 1.2, [0, -5.5, 0]); // floor bounce
  const tex = pm.fromScene(env, 0.04).texture;
  pm.dispose();
  return tex;
}

/* ------------------------------------------------------------------ */
/* Geometry builders                                                   */
/* ------------------------------------------------------------------ */
/** Indexed grid (rows x cols). Default winding faces outward when columns run right→left as seen
 *  from outside (torso); pass flip for grids laid out left→right, bottom→top. seam = shared edge normals */
function gridGeometry(pos, uv, rows, cols, seam, flip = false) {
  const idx = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (seam) fixSeam(g, rows, cols);
  return g;
}

function fixSeam(g, rows, cols) {
  const n = g.attributes.normal, v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let j = 0; j < rows; j++) {
    const a = j * cols, b = j * cols + cols - 1;
    v.fromBufferAttribute(n, a).add(w.fromBufferAttribute(n, b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
}

/**
 * Fabric displacement (model units, outward) at angle th / height v:
 * hem drape, bunching above rib bands, diagonal drag folds from the armpits, soft wrinkles.
 * Calmer across the front/back centre where prints sit. All terms are periodic in th.
 */
function torsoDisp(m, th, v) {
  const c = Math.cos(th), s = Math.sin(th);
  const ex = Math.abs(spow(c, 2 / m.n));
  const calm = 0.35 + 0.65 * ex;
  const body = smooth(m.rib, m.rib + 0.05, v) * (1 - smooth(0.9, 1, v));
  const crease = x => { const w = Math.sin(x); return w * Math.abs(w); }; // sharper ridges than a plain sine
  let d = 1.5 * m.fold * (1 - smooth(0, 0.38, v)) * smooth(m.rib, m.rib + 0.05, v) *
    crease(th * 7 + 0.6 + (noise2(c * 1.7 + 4, s * 1.7 + v * 3) - 0.5) * 3);
  if (m.rib) d += 3.4 * Math.exp(-((v - m.rib - 0.045) ** 2) / 0.0011) * (0.45 + 0.55 * Math.sin(th * 13 + noise2(c * 2 + 9, s * 2) * 4));
  const arm = smooth(0.55, 0.95, ex) * Math.exp(-((v - 0.72) ** 2) / 0.012);
  d += 5 * arm * crease(v * 46 - ex * 15 + (s > 0 ? 0 : 1.4));
  // long vertical drape folds hanging from the chest
  d += 3.6 * calm * body * (1 - smooth(0.25, 0.7, v)) * crease(th * 9 + (noise2(c * 1.3 + 2, s * 1.3) - 0.5) * 5);
  d += 4.2 * calm * body * (noise2(c * 2.4 + 20, s * 2.4 + v * 8.5) - 0.5);
  return d;
}

/** point on the torso surface (v: 0 hem → 1 shoulder line) */
function torsoPoint(m, th, v, out = new THREE.Vector3(), grow = 0) {
  const c = Math.cos(th), s = Math.sin(th);
  const ex = spow(c, 2 / m.n), ez = spow(s, 2 / m.n);
  const W = profile(m.W, v), D = profile(m.D, v);
  const top = m.topY - m.drop * Math.pow(Math.abs(ex), 1.6);
  const k = 1 + (torsoDisp(m, th, v) + grow) / W;
  return out.set(W * ex * k, m.hemY + v * (top - m.hemY), D * ez * k);
}

/** point on the shoulder yoke (t: 0 shoulder line → 1 neckline) */
function yokePoint(m, th, t, out = new THREE.Vector3()) {
  const c = Math.cos(th), s = Math.sin(th);
  const ex = spow(c, 2 / m.n), ez = spow(s, 2 / m.n);
  const W = profile(m.W, 1), D = profile(m.D, 1);
  const topAt = m.topY - m.drop * Math.pow(Math.abs(ex), 1.6);
  const ny = m.neck.y - m.neck.dip * Math.pow(Math.max(0, s), 2);
  const e = 1 - Math.pow(1 - t, 1.5);
  return out.set(
    lerp(W * ex, m.neck.rx * c, e),
    lerp(topAt, ny, t) + m.bulge * Math.sin(Math.PI * t) * (1 - 0.6 * Math.abs(ex)),
    lerp(D * ez, m.neck.rz * s, e)
  );
}

/** Torso tube + shoulder yoke as one smooth surface, with baked AO. Returns geometry and the neck ring. */
function buildTorso(m) {
  const U = 128, V = 96, K = 14;
  const rows = V + K + 1, cols = U + 1;
  const pos = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2), ao = new Float32Array(rows * cols);
  const neckRing = [];
  const P = new THREE.Vector3();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const th = (i / U) * TAU;
      const ex = Math.abs(spow(Math.cos(th), 2 / m.n));
      let a = 1;
      if (j <= V) {
        const v = j / V;
        torsoPoint(m, th, v, P);
        // shade where the sleeves meet / cover the body, and inside the rib crease
        a -= 0.26 * smooth(0.72, 1, ex) * smooth(0.5, 0.86, v) * (1 - smooth(0.95, 1.0, v) * 0.4);
        if (m.sleeve.long) a -= 0.16 * smooth(0.8, 1, ex) * smooth(0.12, 0.4, v) * (1 - smooth(0.7, 0.86, v));
        if (m.rib) a -= 0.1 * Math.exp(-((v - m.rib) ** 2) / 0.0004);
        a -= 0.08 * (1 - smooth(0, 0.06, v));
      } else {
        const t = (j - V) / K;
        yokePoint(m, th, t, P);
        a -= 0.14 * t * t; // collar shades the neckline
        if (j === rows - 1) neckRing.push(P.clone());
      }
      const p = (j * cols + i) * 3;
      pos[p] = P.x; pos[p + 1] = P.y; pos[p + 2] = P.z;
      const q = (j * cols + i) * 2;
      uv[q] = (i / U) * 20; uv[q + 1] = ((P.y - m.hemY) / 100 + (j > V ? (j - V) / K : 0)) * 2.5;
      ao[j * cols + i] = a;
    }
  }
  neckRing.pop(); // last equals first (closed ring)
  const geo = gridGeometry(pos, uv, rows, cols, true);
  setAO(geo, i => ao[i]);
  return { geo, neckRing };
}

/** Front surface depth of the torso at (x, y) – used to lay the logo and pocket on the fabric */
function torsoFrontZ(m, x, y) {
  let v = clamp01((y - m.hemY) / (m.topY - m.hemY));
  let W = profile(m.W, v);
  const ex = clamp01(Math.abs(x) / W);
  const top = m.topY - m.drop * Math.pow(ex, 1.6);
  v = clamp01((y - m.hemY) / (top - m.hemY));
  W = profile(m.W, v);
  const D = profile(m.D, v);
  const cth = spow(Math.min(0.999, Math.abs(x) / W), m.n / 2);
  const th = Math.atan2(Math.sqrt(1 - cth * cth), x >= 0 ? cth : -cth);
  const k = 1 + torsoDisp(m, th, v) / W;
  const r = Math.min(0.999, Math.abs(x) / (W * k));
  return k * D * Math.pow(1 - Math.pow(r, m.n), 1 / m.n);
}

/** Closed ring of points at height v (for seams / rib lines) */
function torsoRing(m, v, grow = 1) {
  const pts = [];
  for (let i = 0; i < 128; i++) pts.push(torsoPoint(m, (i / 128) * TAU, v, new THREE.Vector3(), grow));
  return pts;
}

/** ribbed band hugging the torso between v0 and v1 (hem rib) */
function ribBand(m, v0, v1, grow) {
  const U = 128, R = 8, rows = R + 1, cols = U + 1;
  const pos = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2), P = new THREE.Vector3();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      torsoPoint(m, (i / U) * TAU, lerp(v0, v1, j / R), P, grow);
      pos.set([P.x, P.y, P.z], (j * cols + i) * 3);
      uv.set([(i / U) * 70, j / R], (j * cols + i) * 2);
    }
  }
  return gridGeometry(pos, uv, rows, cols, true);
}

/** Tapered sleeve tube along a curve; returns { geo, end, tangent, endR } */
function buildSleeve(sp, side) {
  const inward = new THREE.Vector3(-side, 0, 0);
  const pts = sp.pts.map(([x, y]) => new THREE.Vector3(side * x, y, 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const T = 72, R = 32;
  const geo = new THREE.TubeGeometry(curve, T, 1, R, false);
  // arc-length position of every control point, to interpolate radii along the sleeve
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k].distanceTo(pts[k - 1]));
  const tbl = cum.map((d, k) => [d / cum[cum.length - 1], sp.r[k]]);
  const radius = t => {
    let r = profile(tbl, t);
    if (sp.long) r *= 1 + 0.014 * Math.sin(t * 34) * smooth(0.4, 0.5, t) * (1 - smooth(0.72, 0.82, t)); // soft elbow folds
    if (sp.cuff) r = lerp(r, sp.cuffR, smooth(0.86, 0.9, t));
    return r;
  };
  const P = geo.attributes.position, UV = geo.attributes.uv;
  const ctr = new THREE.Vector3(), d = new THREE.Vector3();
  const len = curve.getLength();
  const ao = new Float32Array(P.count);
  for (let i = 0; i <= T; i++) {
    const t = i / T;
    curve.getPointAt(t, ctr);
    const r = radius(t);
    for (let j = 0; j <= R; j++) {
      const k = i * (R + 1) + j;
      d.fromBufferAttribute(P, k).sub(ctr);
      // baked AO: darker where the sleeve joins the body and on the side facing the torso
      const facing = Math.max(0, d.dot(inward));
      const a = (j / R) * TAU;
      let f = 0;
      if (sp.long) {
        f += 0.045 * Math.sin(t * 40 + a * 2 + noise2(t * 6 + Math.cos(a) * 1.5, Math.sin(a) * 1.5) * 2) * smooth(0.36, 0.48, t) * (1 - smooth(0.74, 0.8, t));
        f += 0.07 * Math.exp(-((t - 0.83) ** 2) / 0.0016) * (0.5 + 0.5 * Math.sin(a * 5 + t * 30));
      } else {
        f += 0.022 * Math.sin(a * 3 + t * 11) * smooth(0.35, 0.6, t);
      }
      ao[k] = 1 - 0.22 * (1 - smooth(0.06, 0.24, t)) - (sp.long ? 0.16 : 0.08) * facing * smooth(0.12, 0.3, t);
      d.z *= sp.zs;
      d.multiplyScalar(r * (1 + f)).add(ctr);
      P.setXYZ(k, d.x, d.y, d.z);
      UV.setXY(k, (t * len) / 40, (j / R) * 8);
      ao[k] -= Math.max(0, -f) * 2.2; // folds' valleys a touch darker
    }
  }
  geo.computeVertexNormals();
  fixSeam(geo, T + 1, R + 1);
  setAO(geo, k => ao[k]);
  return { geo, curve, radius, endR: radius(1) };
}

/** ribbed cuff: constant-radius sleeve section between t0 and t1 */
function cuffBand(curve, t0, t1, r, zs) {
  const pts = [];
  for (let k = 0; k <= 6; k++) pts.push(curve.getPointAt(lerp(t0, t1, k / 6)));
  const sub = new THREE.CatmullRomCurve3(pts);
  const T = 10, R = 40;
  const geo = new THREE.TubeGeometry(sub, T, 1, R, false);
  const P = geo.attributes.position, UV = geo.attributes.uv, ctr = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i <= T; i++) {
    sub.getPointAt(i / T, ctr);
    for (let j = 0; j <= R; j++) {
      const k = i * (R + 1) + j;
      d.fromBufferAttribute(P, k).sub(ctr);
      d.z *= zs;
      d.multiplyScalar(r).add(ctr);
      P.setXYZ(k, d.x, d.y, d.z);
      UV.setXY(k, (j / R) * 28, i / T); // stripes run along the sleeve
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function tube(points, r, closed = false, seg = 96) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.TubeGeometry(curve, seg, r, 10, closed);
}

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */
export function createGarment3D(container, opts = {}) {
  const options = Object.assign({ garment: 'tshirt', color: '#17181c', motion: 'sway', interactive: true }, opts);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  // phones: slightly lower render resolution + cheaper shadows keep animations smooth
  const handheld = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 760;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, handheld ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps garment colours true to the swatches
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'g3d-canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.66;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.08, 5.4);

  // Direct lights (key casts soft self-shadows: sleeves, hood, drawstrings)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd3ea, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 2.15);
  key.position.set(2.2, 3.2, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(handheld ? 512 : 1024, handheld ? 512 : 1024);
  Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 1, far: 12 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8f97ff, 1.1);
  rim.position.set(-2.5, 2, -3.5);
  scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);
  const garmentGroup = new THREE.Group(); // model units -> world (1/300)
  garmentGroup.scale.setScalar(1 / 300);
  root.add(garmentGroup);
  const model = new THREE.Group();       // per-garment offset/scale + all meshes + logo
  garmentGroup.add(model);

  // Contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 2.8),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.3;
  scene.add(shadow);

  /* Materials */
  const knit = knitTexture();
  const baseColor = new THREE.Color(options.color);
  const fabric = new THREE.MeshPhysicalMaterial({
    color: baseColor.clone(), roughness: 0.9, metalness: 0,
    sheen: 0.7, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xffffff),
    bumpMap: knit, bumpScale: 0.22
  });
  const fabricAO = fabric.clone();                 // torso + sleeves: baked ambient occlusion in vertex colours
  fabricAO.vertexColors = true;
  const rib = ribTexture();
  const ribMat = fabric.clone();                   // cuffs, hem bands, collars
  ribMat.bumpMap = rib;
  ribMat.bumpScale = 1.4;
  const fabricShade = fabric.clone();              // under-brim, seams, stitching
  const lining = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1, side: THREE.DoubleSide, bumpMap: knit, bumpScale: 0.5 });
  const cordMat = new THREE.MeshStandardMaterial({ color: 0xf1f1ec, roughness: 0.8 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.28, metalness: 0.9 });
  const targetColor = baseColor.clone();
  const white = new THREE.Color(0xffffff);

  let currentKey = null, current = null, sleeveInfo = null;
  const prints = new Map(); // key -> { state, tex, bump, mesh }

  function add(geo, mat, { shadowCast = true, shadowReceive = true } = {}) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = shadowCast;
    mesh.receiveShadow = shadowReceive;
    model.add(mesh);
    return mesh;
  }

  function disposeModel() {
    model.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    model.clear();
    prints.forEach(p => { p.mesh = null; });
    sleeveInfo = null;
  }

  /* ---------------- Builders per garment ---------------- */
  function buildTop(m) {
    const { geo, neckRing } = buildTorso(m);
    add(geo, fabricAO);
    const stitch = (pts, r = 0.9, closed = false) => add(tube(pts, r, closed, Math.max(16, pts.length * 2)), fabricShade, { shadowCast: false });

    // dark inside visible through the neck and the hem
    const inner = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true);
    const neckIn = add(inner, lining, { shadowCast: false });
    neckIn.scale.set(m.neck.rx * 0.96, 80, m.neck.rz * 0.96);
    neckIn.position.y = m.neck.y - 52;
    const hemCap = add(new THREE.CircleGeometry(1, 48), lining, { shadowCast: false });
    hemCap.rotation.x = Math.PI / 2;
    hemCap.scale.set(profile(m.W, 0) * 0.97, profile(m.D, 0) * 0.97, 1);
    hemCap.position.y = m.hemY + 3;

    // neckline: ribbed collar
    if (m.neck.rib) add(scaleUV(tube(neckRing, m.neck.rib, true, 160), 90, 1), ribMat);

    // hem: ribbed band (sweatshirt / hoodie) or a folded hem with twin-needle stitching (T-shirt)
    if (m.rib) {
      add(ribBand(m, 0, m.rib, 1.6), ribMat, { shadowCast: false });
      stitch(torsoRing(m, m.rib, 2.2), 1.1, true);
    } else {
      add(tube(torsoRing(m, 0.004, 0.8), 1.8, true), fabric, { shadowCast: false });
      stitch(torsoRing(m, 0.03, 1.1), 0.7, true);
      stitch(torsoRing(m, 0.042, 1.1), 0.7, true);
    }

    // side seams and shoulder seams
    [0, Math.PI].forEach(th => {
      const side = [];
      for (let v = (m.rib || 0.02) + 0.01; v <= 0.9; v += 0.03) side.push(torsoPoint(m, th, v, new THREE.Vector3(), 1.0));
      stitch(side, 1.0);
      const shoulder = [];
      for (let t = 0.02; t <= 0.98; t += 0.08) shoulder.push(yokePoint(m, th, t).multiplyScalar(1.006));
      stitch(shoulder, 1.0);
    });

    // sleeves: AO-shaded tube, armhole seam, cuff or hem, light-dark opening
    [-1, 1].forEach(side => {
      const sp = m.sleeve;
      const sl = buildSleeve(sp, side);
      add(sl.geo, fabricAO);
      if (side === 1) sleeveInfo = { curve: sl.curve, radius: sl.radius, zs: sp.zs, long: sp.long };
      const ring = (t, grow, r) => {
        const pts = [], c = sl.curve.getPointAt(t), tn = sl.curve.getTangentAt(t);
        const n = new THREE.Vector3(0, 0, 1).cross(tn).normalize(), b = new THREE.Vector3().crossVectors(tn, n).normalize();
        for (let k = 0; k < 40; k++) {
          const a = (k / 40) * TAU, o = n.clone().multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a));
          o.z *= sp.zs;
          pts.push(o.multiplyScalar(sl.radius(t) + grow).add(c));
        }
        return pts;
      };
      stitch(ring(sp.long ? 0.2 : 0.3, 0.5), 1.0, true);           // armhole seam
      const end = sl.curve.getPointAt(1), tan = sl.curve.getTangentAt(1);
      if (sp.cuff) {
        add(cuffBand(sl.curve, 0.885, 1, sp.cuffR + 0.9, sp.zs), ribMat);
        stitch(ring(0.885, 1.6), 1.0, true);
      } else {
        add(tube(ring(0.998, 0.3), 1.8, true), fabric, { shadowCast: false }); // folded sleeve hem
        stitch(ring(0.93, 0.6), 0.7, true);
      }
      const cap = add(new THREE.CircleGeometry(1, 32), lining, { shadowCast: false });
      cap.scale.set(sl.endR * 0.93, sl.endR * 0.93, 1);
      cap.position.copy(end).addScaledVector(tan, -2.5);
      cap.quaternion.setFromUnitVectors(Z_AXIS, tan);
    });

    if (m.hood) buildHood(m);
    if (m.pocket) buildPocket(m);
  }

  function buildHood(m) {
    // sphere whose pole faces forward (+z): the front cap becomes the face opening,
    // and a sector at the bottom is left open where the hood meets the neck
    const open = 0.62, gap = 0.78;
    const g = new THREE.SphereGeometry(1, 72, 48, Math.PI / 2 + gap, TAU - 2 * gap, open, Math.PI - open);
    g.rotateX(Math.PI / 2);
    // shape it like a real hood: peaked at the back-top, narrower at the top, flaring onto the shoulders
    const deform = v => {
      const back = Math.max(0, -v.z), top = Math.max(0, v.y);
      v.y += 0.16 * back * top;
      v.z -= 0.14 * back * top;
      v.x *= 1 - 0.17 * top;
      if (v.y < 0) v.x *= 1 + 0.14 * -v.y;
      return v;
    };
    { const P = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < P.count; i++) { deform(v.fromBufferAttribute(P, i)); P.setXYZ(i, v.x, v.y, v.z); }
      g.computeVertexNormals(); }
    const place = mesh => {
      mesh.scale.set(108, 92, 50);
      mesh.position.set(0, m.neck.y - 16, -68);
      mesh.rotation.x = -1.42;
    };
    const outer = add(g, fabric);
    place(outer);
    const inner = add(g, lining, { shadowCast: false });
    place(inner);
    inner.scale.multiplyScalar(0.94);

    // rim around the face opening
    outer.updateMatrix();
    const rimPts = [];
    for (let k = 0; k <= 40; k++) {
      const phi = Math.PI / 2 + gap + (k / 40) * (TAU - 2 * gap);
      const p = new THREE.Vector3(-Math.cos(phi) * Math.sin(open), Math.cos(open), Math.sin(phi) * Math.sin(open));
      deform(p.set(p.x, -p.z, p.y)).multiplyScalar(0.985).applyMatrix4(outer.matrix);
      rimPts.push(p);
    }
    add(tube(rimPts, 8, false, 80), fabric);
    // centre back seam over the crown
    const seam = [];
    for (let a = open + 0.1; a <= Math.PI + 0.55; a += 0.08) seam.push(deform(new THREE.Vector3(0, Math.sin(a), Math.cos(a))).multiplyScalar(1.008).applyMatrix4(outer.matrix));
    add(tube(seam, 1.2, false, 60), fabricShade, { shadowCast: false });

    // drawstrings with metal aglets
    [-1, 1].forEach((side, i) => {
      const x0 = side * 24, y0 = m.neck.y - m.neck.dip - 2;
      const len = 118 + i * 12;
      const pts = [0, 0.35, 0.7, 1].map(f => {
        const y = y0 - f * len, x = x0 * (1 - 0.12 * f) + side * Math.sin(f * 3) * 3;
        return new THREE.Vector3(x, y, torsoFrontZ(m, x, y) + 6 + f * 2);
      });
      add(tube(pts, 3.6, false, 24), cordMat);
      const tip = add(new THREE.CylinderGeometry(4.3, 4.3, 16, 12), metalMat);
      const e = pts[pts.length - 1];
      tip.position.set(e.x, e.y - 7, e.z);
    });
  }

  function buildPocket(m) {
    const yTop = ty(404), yBot = ty(548);
    const C = 28, R = 18, pos = new Float32Array((C + 1) * (R + 1) * 3), uv = new Float32Array((C + 1) * (R + 1) * 2);
    for (let j = 0; j <= R; j++) {
      const b = j / R, y = lerp(yBot, yTop, b);
      const half = b < 0.62 ? 120 : lerp(120, 88, (b - 0.62) / 0.38);
      for (let i = 0; i <= C; i++) {
        const a = i / C, x = (a * 2 - 1) * half;
        const lift = 4.5 * Math.pow(Math.sin(Math.PI * a), 0.35) * Math.pow(Math.sin(Math.PI * b), 0.35);
        const k = (j * (C + 1) + i);
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = torsoFrontZ(m, x, y) + 0.6 + lift;
        uv[k * 2] = (x + 150) / 40; uv[k * 2 + 1] = (y + 300) / 40;
      }
    }
    // rows go bottom→top and columns left→right: flipped winding so the panel faces +z
    add(gridGeometry(pos, uv, R + 1, C + 1, false, true), fabric, { shadowCast: false });
    // pocket openings (slanted sides) + top seam
    [-1, 1].forEach(side => {
      const pts = [0, 0.5, 1].map(f => {
        const y = lerp(yTop, lerp(yBot, yTop, 0.62), f), x = side * lerp(88, 120, f);
        return new THREE.Vector3(x, y, torsoFrontZ(m, x, y) + 4.2);
      });
      add(tube(pts, 2, false, 16), lining, { shadowCast: false });
    });
    const seam = [];
    for (let f = 0; f <= 1.0001; f += 0.1) {
      const x = lerp(-88, 88, f);
      seam.push(new THREE.Vector3(x, yTop - 2, torsoFrontZ(m, x, yTop - 2) + 3.4));
    }
    add(tube(seam, 1.4, false, 24), fabricShade, { shadowCast: false });
  }

  function buildCap(m) {
    model.position.y = m.offsetY;
    model.scale.setScalar(m.scale);
    const dome = new THREE.SphereGeometry(1, 72, 36, 0, TAU, 0, Math.PI / 2);
    const uvA = dome.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 22, uvA.getY(i) * 7);
    const d = add(dome, fabric);
    d.scale.set(m.Rx, m.Ry, m.Rz);
    d.position.y = m.base;
    const din = add(dome, lining, { shadowCast: false });
    din.scale.set(m.Rx * 0.985, m.Ry * 0.985, m.Rz * 0.985);
    din.position.y = m.base;

    // six panel seams + top button
    for (let k = 0; k < 6; k++) {
      const phi = (k / 6) * TAU + Math.PI / 6;
      const pts = [];
      for (let f = 0; f <= 1.0001; f += 0.1) {
        const th = f * (Math.PI / 2) * 0.98;
        pts.push(new THREE.Vector3(m.Rx * Math.sin(th) * Math.sin(phi) * 1.006, m.base + m.Ry * Math.cos(th) * 1.006, m.Rz * Math.sin(th) * Math.cos(phi) * 1.006));
      }
      add(tube(pts, 1.8, false, 32), fabricShade, { shadowCast: false });
    }
    const baseRing = [];
    for (let k = 0; k < 72; k++) { const a = (k / 72) * TAU; baseRing.push(new THREE.Vector3(m.Rx * Math.sin(a) * 1.004, m.base + 1.5, m.Rz * Math.cos(a) * 1.004)); }
    add(tube(baseRing, 3, true, 144), fabric, { shadowCast: false });
    const btn = add(new THREE.SphereGeometry(13, 20, 12), fabric);
    btn.scale.y = 0.5;
    btn.position.y = m.base + m.Ry + 2;

    // curved brim (top + underside + stitching)
    // brim covers the front ±62°, tapers to nothing at the ends, droops forward and curls down at the sides
    const A = 40, S = 14, a0 = -1.08, a1 = 1.08;
    const brimPoint = (a, s, off) => {
      const ix = m.Rx * Math.sin(a) * 0.985, iz = m.Rz * Math.cos(a) * 0.985;
      const e = Math.abs(a) / a1;                         // 0 centre → 1 ends
      const reach = 132 * Math.pow(Math.cos(e * Math.PI / 2), 0.7);
      const x = ix + Math.sin(a) * reach * 0.55 * s, z = iz + Math.cos(a) * reach * s;
      const y = m.base - 3 - 12 * s * s - 13 * e * e * s + off;
      return [x, y, z];
    };
    const makeBrim = (off, flip) => {
      const pos = new Float32Array((A + 1) * (S + 1) * 3), uv = new Float32Array((A + 1) * (S + 1) * 2);
      for (let j = 0; j <= S; j++) {
        for (let i = 0; i <= A; i++) {
          const a = lerp(a0, a1, i / A), s = j / S, k = j * (A + 1) + i;
          const [x, y, z] = brimPoint(a, s, off);
          pos.set([x, y, z], k * 3);
          uv.set([x / 30, z / 30], k * 2);
        }
      }
      const g = gridGeometry(pos, uv, S + 1, A + 1, false);
      if (flip) { const ix = g.index.array; for (let q = 0; q < ix.length; q += 3) { const t = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = t; } g.computeVertexNormals(); }
      return g;
    };
    add(makeBrim(2, true), fabric);
    add(makeBrim(-1, false), fabricShade, { shadowCast: false });
    const edge = [];
    for (let i = 0; i <= A; i++) { const [x, y, z] = brimPoint(lerp(a0, a1, i / A), 1, 0.5); edge.push(new THREE.Vector3(x, y, z)); }
    add(tube(edge, 2.4, false, 64), fabric);
    // rows of stitching running along the brim edge
    [0.8, 0.86, 0.92].forEach(s => {
      const line = [];
      for (let i = 0; i <= A; i++) { const [x, y, z] = brimPoint(lerp(a0 * 0.9, a1 * 0.9, i / A), s, 2.35); line.push(new THREE.Vector3(x, y, z)); }
      add(tube(line, 0.45, false, 64), fabricShade, { shadowCast: false });
    });

    const domePoint = (phi, y, grow = 1.004) => {
      const r = Math.sqrt(Math.max(0, 1 - ((y - m.base) / m.Ry) ** 2));
      return new THREE.Vector3(m.Rx * r * Math.sin(phi) * grow, y, m.Rz * r * Math.cos(phi) * grow);
    };
    // eyelets on the side/back panels
    for (let k = 1; k < 6; k++) {
      const phi = (k / 6) * TAU, p = domePoint(phi, m.base + m.Ry * 0.62, 1.006);
      const eye = add(new THREE.TorusGeometry(3.6, 1.1, 8, 20), fabricShade, { shadowCast: false });
      eye.position.copy(p);
      eye.lookAt(p.clone().multiplyScalar(2).setY(p.y * 2 - m.base));
      const hole = add(new THREE.CircleGeometry(2.6, 16), lining, { shadowCast: false });
      hole.position.copy(p);
      hole.lookAt(eye.position.clone().add(eye.getWorldDirection(new THREE.Vector3())));
    }
    // back arch opening with an adjustable strap and buckle
    const archW = 0.36, archH = 46;
    const arch = new THREE.Shape();
    arch.moveTo(-archW, 0);
    arch.bezierCurveTo(-archW, archH * 0.9, archW, archH * 0.9, archW, 0);
    arch.lineTo(-archW, 0);
    const ag = new THREE.ShapeGeometry(arch, 24);
    { const P = ag.attributes.position;
      for (let i = 0; i < P.count; i++) { const v = domePoint(Math.PI + P.getX(i), m.base + P.getY(i), 1.003); P.setXYZ(i, v.x, v.y, v.z); }
      ag.computeVertexNormals(); }
    add(ag, lining, { shadowCast: false });
    const archEdge = [];
    for (let k = 0; k <= 24; k++) {
      const tt = k / 24, u = lerp(-archW, archW, tt);
      const h = archH * 0.68 * Math.sin(Math.PI * tt) ** 0.8;
      archEdge.push(domePoint(Math.PI + u, m.base + h, 1.008));
    }
    add(tube(archEdge, 1.6, false, 48), fabric, { shadowCast: false });
    const strap = [];
    for (let k = 0; k <= 16; k++) strap.push(domePoint(Math.PI + lerp(-archW - 0.06, archW + 0.06, k / 16), m.base + 9, 1.02));
    add(tube(strap, 3.2, false, 32), fabricShade);
    const buckle = add(new THREE.BoxGeometry(16, 9, 3.5), metalMat);
    buckle.position.copy(domePoint(Math.PI + 0.12, m.base + 9, 1.045));
    buckle.lookAt(buckle.position.clone().multiplyScalar(2).setY(buckle.position.y));
  }

  /* front surface depth for logo placement */
  function frontZ(x, y) {
    const m = current;
    if (!m) return 0;
    if (m.cap) {
      const dy = Math.max(0, y - m.base) / m.Ry, dx = x / m.Rx;
      return m.Rz * Math.sqrt(Math.max(0.02, 1 - dx * dx - dy * dy));
    }
    return torsoFrontZ(m, x, y);
  }

  function setGarment(key) {
    if (!MODELS[key]) key = 'tshirt';
    if (key === currentKey) return;
    const first = currentKey === null;
    currentKey = key;
    current = MODELS[key];
    disposeModel();
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.setScalar(1);
    if (current.cap) buildCap(current);
    else buildTop(current);
    prints.forEach((_, k) => buildPrint(k));
    baseTilt = current.tilt || 0.06; // caps are viewed slightly from above, like a product photo
    if (!first) { pop = 0.82; popV = 0; spinKick += 0.9; }
  }

  /* ---------------- Prints (logos that follow the fabric) ----------------
   * One decal per print position:
   *   front / chest – on the chest (2D front-artwork coordinates)
   *   back          – mirrored onto the back (2D back-artwork coordinates)
   *   sleeve        – wrapped around the wearer's left upper sleeve
   * finish 'embroidery' adds a raised, glossy-thread material with a height (bump) map.
   */
  const loadCanvasTexture = (src, cb, srgb = true) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      const max = 1024;
      const r = Math.min(max / (im.naturalWidth || max), max / (im.naturalHeight || max));
      const c = document.createElement('canvas');
      c.width = Math.max(2, Math.round((im.naturalWidth || max) * r));
      c.height = Math.max(2, Math.round((im.naturalHeight || max) * r));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const tex = new THREE.CanvasTexture(c);
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      cb(tex);
    };
    im.src = src;
  };

  function printGeometry(st, aspect) {
    const b = st.bounds || { top: 24, left: 32, width: 36, height: 44 };
    const pw = (b.width / 100) * 600, ph = (b.height / 100) * 650;
    const cx = (b.left / 100) * 600 + pw / 2 + (st.x || 0) * pw;
    const cy = (b.top / 100) * 650 + ph / 2 + (st.y || 0) * ph;
    const w = (st.scale || 0.6) * pw, h = w * aspect;
    const lift = st.finish === 'embroidery' ? 2.6 : 1.6;
    const side = st.side || 'front';

    if (side === 'sleeve' || (side === 'front' && st.key === 'sleeve')) {
      if (!sleeveInfo) return null;
      return sleeveGeometry(sleeveInfo, w, h, st, lift);
    }
    const g = new THREE.PlaneGeometry(w, h, 28, 28);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      if (side === 'back') {
        if (current.cap) return null;
        // viewer's left on the back artwork is the model's +x side
        const x = 300 - cx - P.getX(i), y = ty(cy) + P.getY(i);
        P.setXYZ(i, x, y, -torsoFrontZ(current, x, y) - lift);
      } else {
        const x = tx(cx) + P.getX(i), y = ty(cy) + P.getY(i);
        P.setXYZ(i, x, y, frontZ(x, y) + lift);
      }
    }
    g.computeVertexNormals();
    return g;
  }

  /** decal wrapped around the upper sleeve, facing outward-front */
  function sleeveGeometry(si, w, h, st, lift) {
    const len = si.curve.getLength();
    const tC = (si.long ? 0.27 : 0.55) + (st.y || 0) * 0.2;
    const C = 24, R = 24, pos = new Float32Array((C + 1) * (R + 1) * 3), uv = new Float32Array((C + 1) * (R + 1) * 2);
    const out0 = new THREE.Vector3(1, 0, 0.85).normalize();
    const T = new THREE.Vector3(), N = new THREE.Vector3(), Rv = new THREE.Vector3(), ctr = new THREE.Vector3(), o = new THREE.Vector3();
    for (let j = 0; j <= R; j++) {
      const v = j / R;
      const t = Math.min(0.97, Math.max(0.03, tC + (0.5 - v) * (h / len)));
      si.curve.getPointAt(t, ctr);
      si.curve.getTangentAt(t, T);
      N.copy(out0).addScaledVector(T, -out0.dot(T)).normalize();
      Rv.copy(T).negate().cross(N).normalize(); // right = up(-T) × outward
      const r = si.radius(t) + lift;
      const span = w / r;
      for (let i = 0; i <= C; i++) {
        const u = i / C, a = (u - 0.5) * span + (st.x || 0) * 0.6;
        o.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(Rv, Math.sin(a));
        o.z *= si.zs;
        o.multiplyScalar(r).add(ctr);
        const k = j * (C + 1) + i;
        pos.set([o.x, o.y, o.z], k * 3);
        uv.set([u, v], k * 2);
      }
    }
    return gridGeometry(pos, uv, R + 1, C + 1, false, true);
  }

  function buildPrint(key) {
    const p = prints.get(key);
    if (!p || !current) return;
    if (p.mesh) { model.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); p.mesh = null; }
    if (!p.tex || p.state.enabled === false) return;
    const img = p.tex.image;
    const g = printGeometry({ ...p.state, key }, img && img.width ? img.height / img.width : 1);
    if (!g) return;
    const emb = p.state.finish === 'embroidery';
    const mat = emb
      ? new THREE.MeshPhysicalMaterial({
          map: p.tex, transparent: true, roughness: 0.5, metalness: 0,
          sheen: 0.9, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xffffff),
          bumpMap: p.bump || null, bumpScale: 5, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false
        })
      : new THREE.MeshStandardMaterial({
          map: p.tex, transparent: true, roughness: 0.82, metalness: 0,
          bumpMap: knit, bumpScale: 0.12, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false
        });
    p.mesh = new THREE.Mesh(g, mat);
    p.mesh.receiveShadow = true;
    p.mesh.castShadow = emb;
    p.mesh.renderOrder = 2;
    model.add(p.mesh);
  }

  /** add / update one print. state: { src, bumpSrc, side, bounds, x, y, scale, finish, enabled } */
  function setPrint(key, state = {}) {
    const p = prints.get(key) || { state: {} };
    prints.set(key, p);
    const prev = p.state;
    p.state = Object.assign({}, prev, state);
    let pending = 0;
    if (state.src && state.src !== prev.src) {
      pending++;
      loadCanvasTexture(state.src, tex => {
        if (p.state.src !== state.src) { tex.dispose(); return; }
        if (p.tex) p.tex.dispose();
        p.tex = tex;
        buildPrint(key);
      });
    }
    if ('bumpSrc' in state && state.bumpSrc !== prev.bumpSrc) {
      if (p.bump) { p.bump.dispose(); p.bump = null; }
      if (state.bumpSrc) {
        pending++;
        loadCanvasTexture(state.bumpSrc, tex => {
          if (p.state.bumpSrc !== state.bumpSrc) { tex.dispose(); return; }
          p.bump = tex;
          buildPrint(key);
        }, false);
      }
    }
    if (!pending) buildPrint(key);
  }

  function removePrint(key) {
    const p = prints.get(key);
    if (!p) return;
    if (p.mesh) { model.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); }
    if (p.tex) p.tex.dispose();
    if (p.bump) p.bump.dispose();
    prints.delete(key);
  }

  // single-logo API (hero) = the 'front' print
  const setLogo = (src, state = {}) => setPrint('front', { ...state, src });
  const setLogoTransform = (state = {}) => setPrint('front', state);

  function setColor(hex) { targetColor.set(hex); }

  /* ---------------- Interaction ---------------- */
  let rotY = -0.4, rotX = 0.06, velY = 0, targetX = 0.06, baseTilt = 0.06;
  let swayCenter = 0, focusUntil = 0;
  let dragging = false, lastX = 0, lastY = 0, lastInteract = -9999;
  let pop = 1, popV = 0, spinKick = 0;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (options.interactive) {
    const el = renderer.domElement;
    el.style.touchAction = 'pan-y';
    el.addEventListener('pointerdown', e => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
      container.classList.add('is-grabbing');
    });
    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      velY = dx * 0.008;
      rotY += velY;
      targetX = Math.max(-0.35, Math.min(0.6, targetX + dy * 0.004));
      lastInteract = performance.now();
    });
    const end = () => { dragging = false; container.classList.remove('is-grabbing'); lastInteract = performance.now(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /* ---------------- Loop ---------------- */
  let visible = true, raf = 0, readyMarked = false;
  const clock = new THREE.Clock();

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (!dragging) {
      velY *= 0.94;
      rotY += velY;
      if (spinKick > 0.001) { const s = spinKick * 0.12; rotY += s; spinKick -= s; }
      const idle = performance.now() - lastInteract > 2500 || performance.now() < focusUntil;
      if (idle && !reduceMotion) {
        if (options.motion === 'spin') rotY += dt * 0.42;
        else rotY += (swayCenter + Math.sin(t * 0.55) * 0.5 - rotY) * (performance.now() < focusUntil ? 0.07 : 0.02);
        targetX += (baseTilt - targetX) * 0.03;
      }
    }
    // springy "pop" when the garment changes
    popV += (1 - pop) * 0.22;
    popV *= 0.72;
    pop += popV;
    rotX += (targetX - rotX) * 0.1;
    root.rotation.set(rotX, rotY, 0);
    root.scale.setScalar(pop);
    const bob = reduceMotion ? 0 : Math.sin(t * 1.2);
    root.position.y = bob * 0.045 + 0.03;
    shadow.material.opacity = 0.85 - bob * 0.12;
    shadow.scale.setScalar(1 - bob * 0.04);

    fabric.color.lerp(targetColor, 0.12);
    fabric.sheenColor.copy(fabric.color).lerp(white, 0.3);
    fabricShade.color.copy(fabric.color).multiplyScalar(0.72);
    fabricAO.color.copy(fabric.color);
    fabricAO.sheenColor.copy(fabric.sheenColor);
    ribMat.color.copy(fabric.color).multiplyScalar(0.96);
    ribMat.sheenColor.copy(fabric.sheenColor);
    fabricShade.sheenColor.copy(fabric.sheenColor).multiplyScalar(0.7);
    lining.color.copy(fabric.color).multiplyScalar(0.42);

    renderer.render(scene, camera);
    if (!readyMarked) { readyMarked = true; container.classList.add('g3d-ready'); } // fades the canvas in (motion.css)
  }

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w / h < 0.85 ? 5.4 / (w / h / 0.85) : 5.4; // keep long sleeves in frame
    camera.updateProjectionMatrix();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { threshold: 0.01 });
  io.observe(container);

  setGarment(options.garment);
  resize();
  frame();

  return {
    setGarment,
    setColor,
    setLogo,
    setLogoTransform,
    setPrint,
    removePrint,
    /** turn the garment to face a print position ('front' | 'back' | 'sleeve') */
    focus(where) {
      swayCenter = where === 'back' ? Math.PI : where === 'sleeve' ? -1.3 : 0;
      // take the short way round
      rotY = swayCenter + Math.atan2(Math.sin(rotY - swayCenter), Math.cos(rotY - swayCenter));
      velY = 0;
      focusUntil = performance.now() + 1800;
    },
    setRotation(y, x = baseTilt) { rotY = y; targetX = rotX = x; velY = 0; lastInteract = performance.now() + 1e9; },
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      disposeModel(); renderer.dispose(); renderer.domElement.remove();
    }
  };
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
