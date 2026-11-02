/**
 * Garment3D — lightweight Three.js renderer for a "plush" 3D garment
 * with a live logo decal. Used in the hero and in the Mockup Studio (3D view).
 *
 * Usage:
 *   import { createGarment3D } from './garment3d.js';
 *   const g = createGarment3D(containerEl, { garment: 'tshirt', color: '#17181c', motion: 'spin' });
 *   g.setColor('#2c3192');
 *   g.setLogo('assets/samples/sample-logo-1.svg', { bounds, x: 0, y: 0, scale: 0.6 });
 */
import * as THREE from '../vendor/three.module.min.js';

/* Garment silhouettes in the same 600x650 coordinate system as the 2D artwork */
const PATHS = {
  tshirt: 'M 215 48 C 170 54 90 122 42 182 C 26 202 38 238 80 220 L 142 188 L 145 585 C 145 598 155 604 175 604 L 425 604 C 445 604 455 598 455 585 L 458 188 L 520 220 C 562 238 574 202 558 182 C 510 122 430 54 385 48 C 352 48 332 94 300 94 C 268 94 248 48 215 48 Z',
  sweatshirt: 'M 215 50 C 165 58 120 110 100 160 L 34 452 C 30 468 40 480 56 482 L 100 490 C 114 492 122 484 124 470 L 146 300 L 148 590 C 148 600 156 606 168 606 L 432 606 C 444 606 452 600 452 590 L 454 300 L 476 470 C 478 484 486 492 500 490 L 544 482 C 560 480 570 468 566 452 L 500 160 C 480 110 435 58 385 50 C 352 50 332 96 300 96 C 268 96 248 50 215 50 Z',
  hoodie: 'M 220 70 C 168 80 122 118 102 168 L 34 452 C 30 468 40 480 56 482 L 100 490 C 114 492 122 484 124 470 L 146 300 L 148 590 C 148 600 156 606 168 606 L 432 606 C 444 606 452 600 452 590 L 454 300 L 476 470 C 478 484 486 492 500 490 L 544 482 C 560 480 570 468 566 452 L 498 168 C 478 118 432 80 380 70 C 392 34 352 12 300 12 C 248 12 208 34 220 70 Z'
};

const NECK = {
  tshirt: { back: 'M 215 48 C 248 48 268 94 300 94 C 332 94 352 48 385 48 C 360 28 240 28 215 48 Z', rib: [[215, 48], [248, 48], [268, 94], [300, 94], [332, 94], [352, 48], [385, 48]] },
  sweatshirt: { back: 'M 215 50 C 248 50 268 96 300 96 C 332 96 352 50 385 50 C 360 30 240 30 215 50 Z', rib: [[215, 50], [248, 50], [268, 96], [300, 96], [332, 96], [352, 50], [385, 50]] }
};

const DEPTH = 46;
const BEVEL_T = 30;
const BEVEL_S = 22;
const FRONT_Z = DEPTH / 2 + BEVEL_T;

const tx = x => x - 300;
const ty = y => 330 - y;

function pathToShape(d) {
  const t = d.trim().split(/[\s,]+/);
  const s = new THREE.Shape();
  let i = 0;
  let cmd = '';
  while (i < t.length) {
    if (/^[MLCZ]$/i.test(t[i])) cmd = t[i++].toUpperCase();
    if (cmd === 'M') { s.moveTo(tx(+t[i]), ty(+t[i + 1])); i += 2; cmd = 'L'; }
    else if (cmd === 'L') { s.lineTo(tx(+t[i]), ty(+t[i + 1])); i += 2; }
    else if (cmd === 'C') {
      s.bezierCurveTo(tx(+t[i]), ty(+t[i + 1]), tx(+t[i + 2]), ty(+t[i + 3]), tx(+t[i + 4]), ty(+t[i + 5]));
      i += 6;
    } else if (cmd === 'Z') { s.closePath(); i++; }
    else i++;
  }
  return s;
}

function knitTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 128; x += 8) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.ellipse(x + 2.5, y + 4, 1.6, 3.6, -0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + 5.5, y + 4, 1.6, 3.6, 0.5, 0, Math.PI * 2); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 9, 1 / 9);
  return tex;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(22,23,43,0.55)');
  grd.addColorStop(0.5, 'rgba(22,23,43,0.18)');
  grd.addColorStop(1, 'rgba(22,23,43,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function createGarment3D(container, opts = {}) {
  const options = Object.assign({ garment: 'tshirt', color: '#17181c', motion: 'sway', interactive: true }, opts);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = 'g3d-canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.05, 5.4);

  // Lights: soft studio setup with a cool indigo rim
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9dcef, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(2.5, 3, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff4d6, 0.7);
  fill.position.set(-3, 0.5, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x6f78ff, 1.6);
  rim.position.set(-2, 2, -4);
  scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);
  const garmentGroup = new THREE.Group();
  garmentGroup.scale.setScalar(1 / 300);
  root.add(garmentGroup);

  // Contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.32;
  scene.add(shadow);

  const knit = knitTexture();
  const fabric = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(options.color),
    roughness: 0.82,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0xffffff),
    bumpMap: knit,
    bumpScale: 0.6
  });
  const fabricDark = fabric.clone();
  const detailDark = new THREE.MeshStandardMaterial({ color: 0x0c0d14, roughness: 1, transparent: true, opacity: 0.55 });

  let logoMesh = null;
  let logoTexture = null;
  let logoState = null;
  let currentKey = null;
  const targetColor = new THREE.Color(options.color);

  function disposeGroup() {
    garmentGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    garmentGroup.clear();
    logoMesh = null;
  }

  function addNeck(key) {
    const neck = NECK[key];
    if (!neck) return;
    const backGeo = new THREE.ExtrudeGeometry(pathToShape(neck.back), { depth: 8, bevelEnabled: false, curveSegments: 24 });
    backGeo.translate(0, 0, -6);
    garmentGroup.add(new THREE.Mesh(backGeo, fabricDark));

    const p = neck.rib.map(([x, y]) => new THREE.Vector3(tx(x), ty(y) - 2, FRONT_Z - 6));
    const curve = new THREE.CurvePath();
    curve.add(new THREE.CubicBezierCurve3(p[0], p[1], p[2], p[3]));
    curve.add(new THREE.CubicBezierCurve3(p[3], p[4], p[5], p[6]));
    const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 9, 12, false), fabric);
    garmentGroup.add(rib);
  }

  function addHoodieDetails() {
    // Hood opening
    const hole = new THREE.ShapeGeometry(pathToShape('M 246 80 C 246 36 354 36 354 80 C 342 124 258 124 246 80 Z'), 24);
    const holeMesh = new THREE.Mesh(hole, detailDark);
    holeMesh.position.z = FRONT_Z + 0.6;
    garmentGroup.add(holeMesh);

    // Kangaroo pocket (raised panel)
    const pocketGeo = new THREE.ExtrudeGeometry(
      pathToShape('M 212 404 L 388 404 L 420 458 L 420 548 L 180 548 L 180 458 Z'),
      { depth: 2, bevelEnabled: true, bevelThickness: 6, bevelSize: 5, bevelSegments: 4, curveSegments: 8 }
    );
    pocketGeo.translate(0, 0, FRONT_Z - 3);
    garmentGroup.add(new THREE.Mesh(pocketGeo, fabric));

    // Drawstrings
    const cordMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.7 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.8 });
    [-26, 26].forEach((x, i) => {
      const len = 120 + i * 14;
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, len, 10), cordMat);
      cord.position.set(x, ty(118) - len / 2, FRONT_Z + 6);
      garmentGroup.add(cord);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 16, 10), tipMat);
      tip.position.set(x, ty(118) - len - 6, FRONT_Z + 6);
      garmentGroup.add(tip);
    });
  }

  function setGarment(key) {
    if (!PATHS[key]) key = 'tshirt';
    if (key === currentKey) return;
    currentKey = key;
    disposeGroup();

    const geo = new THREE.ExtrudeGeometry(pathToShape(PATHS[key]), {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: BEVEL_T,
      bevelSize: BEVEL_S,
      bevelSegments: 12,
      curveSegments: 40
    });
    geo.translate(0, 0, -DEPTH / 2);
    geo.computeVertexNormals();
    garmentGroup.add(new THREE.Mesh(geo, fabric));

    if (key === 'hoodie') addHoodieDetails();
    else addNeck(key);

    if (logoState) applyLogo();
  }

  function applyLogo() {
    if (!logoTexture || !logoState) return;
    if (logoMesh) { garmentGroup.remove(logoMesh); logoMesh.geometry.dispose(); }

    const b = logoState.bounds || { top: 24, left: 32, width: 36, height: 44 };
    const pw = (b.width / 100) * 600;
    const ph = (b.height / 100) * 650;
    const cx = (b.left / 100) * 600 + pw / 2 + (logoState.x || 0) * pw;
    const cy = (b.top / 100) * 650 + ph / 2 + (logoState.y || 0) * ph;

    const img = logoTexture.image;
    const aspect = img && img.width ? img.height / img.width : 1;
    const w = (logoState.scale || 0.6) * pw;
    const h = w * aspect;

    const mat = new THREE.MeshStandardMaterial({
      map: logoTexture,
      transparent: true,
      roughness: 0.75,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    logoMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    logoMesh.position.set(tx(cx), ty(cy), FRONT_Z + 0.8);
    garmentGroup.add(logoMesh);
  }

  const loader = new THREE.TextureLoader();
  function setLogo(src, state = {}) {
    logoState = Object.assign({}, logoState || {}, state);
    if (!src) return;
    if (src === logoState._src && logoTexture) { applyLogo(); return; }
    logoState._src = src;

    // Rasterise through a canvas so SVGs get a proper resolution
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      const max = 1024;
      const r = Math.min(max / (im.naturalWidth || max), max / (im.naturalHeight || max));
      const c = document.createElement('canvas');
      c.width = Math.max(2, Math.round((im.naturalWidth || max) * r));
      c.height = Math.max(2, Math.round((im.naturalHeight || max) * r));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      if (logoTexture) logoTexture.dispose();
      logoTexture = new THREE.CanvasTexture(c);
      logoTexture.colorSpace = THREE.SRGBColorSpace;
      logoTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      applyLogo();
    };
    im.src = src;
  }

  function setLogoTransform(state = {}) {
    logoState = Object.assign({}, logoState || {}, state);
    applyLogo();
  }

  function setColor(hex) {
    targetColor.set(hex);
  }

  /* ---------------- Interaction ---------------- */
  let rotY = -0.35, rotX = 0.05, velY = 0, targetX = 0.05;
  let dragging = false, lastX = 0, lastY = 0, lastInteract = -9999;

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
      targetX = Math.max(-0.35, Math.min(0.35, targetX + dy * 0.004));
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
      const idle = performance.now() - lastInteract > 2500;
      if (idle) {
        if (options.motion === 'spin') rotY += dt * 0.45;
        else rotY += (Math.sin(t * 0.6) * 0.55 - rotY) * 0.02;
        targetX += (0.05 - targetX) * 0.03;
      }
    }
    rotX += (targetX - rotX) * 0.1;
    root.rotation.set(rotX, rotY, 0);
    root.position.y = Math.sin(t * 1.2) * 0.05 + 0.04;
    shadow.material.opacity = 0.85 - Math.sin(t * 1.2) * 0.12;
    shadow.scale.setScalar(1 - Math.sin(t * 1.2) * 0.04);

    fabric.color.lerp(targetColor, 0.12);
    fabricDark.color.copy(fabric.color).multiplyScalar(0.55);

    renderer.render(scene, camera);
  }

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the garment fully in frame on narrow containers
    camera.position.z = w / h < 0.85 ? 5.4 / (w / h / 0.85) : 5.4;
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
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      disposeGroup(); renderer.dispose(); renderer.domElement.remove();
    }
  };
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
