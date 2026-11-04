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

/** Torso tube + shoulder yoke as one smooth surface. Returns geometry and the neck ring points. */
function buildTorso(m) {
  const U = 112, V = 72, K = 12;
  const rows = V + K + 1, cols = U + 1;
  const pos = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2);
  const neckRing = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const th = (i / U) * TAU, c = Math.cos(th), s = Math.sin(th);
      const ex = spow(c, 2 / m.n), ez = spow(s, 2 / m.n);
      let x, y, z;
      const topAt = m.topY - m.drop * Math.pow(Math.abs(ex), 1.6);
      if (j <= V) {
        const v = j / V;
        const W = profile(m.W, v), D = profile(m.D, v);
        y = m.hemY + v * (topAt - m.hemY);
        // soft drape folds towards the hem (none inside the rib band)
        const fold = m.fold * (1 - smooth(0, 0.38, v)) * smooth(m.rib, m.rib + 0.05, v) * Math.sin(th * 7 + 0.6);
        const k = 1 + fold / W;
        x = W * ex * k; z = D * ez * k;
      } else {
        const t = (j - V) / K;
        const W = profile(m.W, 1), D = profile(m.D, 1);
        const ny = m.neck.y - m.neck.dip * Math.pow(Math.max(0, s), 2);
        const e = 1 - Math.pow(1 - t, 1.5);
        x = lerp(W * ex, m.neck.rx * c, e);
        z = lerp(D * ez, m.neck.rz * s, e);
        y = lerp(topAt, ny, t) + m.bulge * Math.sin(Math.PI * t) * (1 - 0.6 * Math.abs(ex));
        if (j === rows - 1) neckRing.push(new THREE.Vector3(x, y, z));
      }
      const p = (j * cols + i) * 3;
      pos[p] = x; pos[p + 1] = y; pos[p + 2] = z;
      const q = (j * cols + i) * 2;
      uv[q] = (i / U) * 20; uv[q + 1] = ((y - m.hemY) / 100 + (j > V ? (j - V) / K : 0)) * 2.5;
    }
  }
  neckRing.pop(); // last equals first (closed ring)
  return { geo: gridGeometry(pos, uv, rows, cols, true), neckRing };
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
  const th = Math.atan2(Math.sqrt(1 - cth * cth), cth);
  const fold = m.fold * (1 - smooth(0, 0.38, v)) * smooth(m.rib, m.rib + 0.05, v) * Math.sin(th * 7 + 0.6);
  const k = 1 + fold / W;
  const r = Math.min(0.999, Math.abs(x) / (W * k));
  return k * D * Math.pow(1 - Math.pow(r, m.n), 1 / m.n);
}

/** Closed ring of points at height v (for seams / rib lines) */
function torsoRing(m, v, grow = 1) {
  const pts = [];
  for (let i = 0; i < 96; i++) {
    const th = (i / 96) * TAU, ex = spow(Math.cos(th), 2 / m.n), ez = spow(Math.sin(th), 2 / m.n);
    const W = profile(m.W, v) * grow, D = profile(m.D, v) * grow;
    const top = m.topY - m.drop * Math.pow(Math.abs(ex), 1.6);
    pts.push(new THREE.Vector3(W * ex, m.hemY + v * (top - m.hemY), D * ez));
  }
  return pts;
}

/** Tapered sleeve tube along a curve; returns { geo, end, tangent, endR } */
function buildSleeve(sp, side) {
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
  for (let i = 0; i <= T; i++) {
    const t = i / T;
    curve.getPointAt(t, ctr);
    const r = radius(t);
    for (let j = 0; j <= R; j++) {
      const k = i * (R + 1) + j;
      d.fromBufferAttribute(P, k).sub(ctr);
      d.z *= sp.zs;
      d.multiplyScalar(r).add(ctr);
      P.setXYZ(k, d.x, d.y, d.z);
      UV.setXY(k, (t * len) / 40, (j / R) * 8);
    }
  }
  geo.computeVertexNormals();
  return { geo, curve, radius, endR: radius(1) };
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps garment colours true to the swatches
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'g3d-canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.75;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.08, 5.4);

  // Direct lights (key casts soft self-shadows: sleeves, hood, drawstrings)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd3ea, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(2.2, 3.2, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
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
  const fabricShade = fabric.clone();              // under-brim, seams
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
    add(geo, fabric);

    // dark inside visible through the neck and the hem
    const inner = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true);
    const neckIn = add(inner, lining, { shadowCast: false });
    neckIn.scale.set(m.neck.rx * 0.96, 80, m.neck.rz * 0.96);
    neckIn.position.y = m.neck.y - 52;
    const hemCap = add(new THREE.CircleGeometry(1, 48), lining, { shadowCast: false });
    hemCap.rotation.x = Math.PI / 2;
    hemCap.scale.set(profile(m.W, 0) * 0.97, profile(m.D, 0) * 0.97, 1);
    hemCap.position.y = m.hemY + 3;

    // neckline rib
    if (m.neck.rib) add(tube(neckRing, m.neck.rib, true, 128), fabric);
    // hem: rib seam line or a folded hem lip
    if (m.rib) add(tube(torsoRing(m, m.rib, 1.012), 2.4, true), fabricShade, { shadowCast: false });
    else add(tube(torsoRing(m, 0.012, 1.01), 3.2, true), fabric, { shadowCast: false });

    // sleeves (+ dark sleeve openings, cuff seam)
    [-1, 1].forEach(side => {
      const sl = buildSleeve(m.sleeve, side);
      add(sl.geo, fabric);
      if (side === 1) sleeveInfo = { curve: sl.curve, radius: sl.radius, zs: m.sleeve.zs, long: m.sleeve.long };
      const end = sl.curve.getPointAt(1), tan = sl.curve.getTangentAt(1);
      const cap = add(new THREE.CircleGeometry(1, 32), lining, { shadowCast: false });
      cap.scale.set(sl.endR * 0.93, sl.endR * 0.93, 1);
      cap.position.copy(end).addScaledVector(tan, -1.5);
      cap.quaternion.setFromUnitVectors(Z_AXIS, tan);
      if (m.sleeve.cuff) {
        const p = sl.curve.getPointAt(0.885), tn = sl.curve.getTangentAt(0.885);
        const ring = add(new THREE.TorusGeometry(m.sleeve.cuffR + 1.5, 2.2, 8, 48), fabricShade, { shadowCast: false });
        ring.position.copy(p);
        ring.quaternion.setFromUnitVectors(Z_AXIS, tn);
      }
    });

    if (m.hood) buildHood(m);
    if (m.pocket) buildPocket(m);
  }

  function buildHood(m) {
    // sphere whose pole faces forward (+z): the front cap becomes the face opening,
    // and a sector at the bottom is left open where the hood meets the neck
    const open = 0.62, gap = 0.78;
    const g = new THREE.SphereGeometry(1, 64, 40, Math.PI / 2 + gap, TAU - 2 * gap, open, Math.PI - open);
    g.rotateX(Math.PI / 2);
    const place = mesh => {
      mesh.scale.set(100, 92, 72);
      mesh.position.set(0, m.neck.y + 6, -66);
      mesh.rotation.x = -1.0;
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
      p.set(p.x, -p.z, p.y).multiplyScalar(0.985).applyMatrix4(outer.matrix);
      rimPts.push(p);
    }
    add(tube(rimPts, 8, false, 80), fabric);

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
      const y = m.base - 3 - 14 * s * s - 20 * e * e * s + off;
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
    [0.35, 0.6, 0.82].forEach(s => {
      const line = [];
      for (let i = 0; i <= A; i++) { const [x, y, z] = brimPoint(lerp(a0 * 0.97, a1 * 0.97, i / A), s, 2.5); line.push(new THREE.Vector3(x, y, z)); }
      add(tube(line, 0.7, false, 64), fabricShade, { shadowCast: false });
    });
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
  let visible = true, raf = 0;
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
    fabricShade.sheenColor.copy(fabric.sheenColor).multiplyScalar(0.7);
    lining.color.copy(fabric.color).multiplyScalar(0.28);

    renderer.render(scene, camera);
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
