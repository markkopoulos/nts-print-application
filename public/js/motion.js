/**
 * Motion system (replaces animations.js).
 *
 * Why it's built this way
 *  - Entrances and transitions run on the Web Animations API (element.animate). Those
 *    transform/opacity animations are run by the browser's compositor, so they stay smooth
 *    on phones even while the main thread is busy (3D garment loading, logo processing).
 *  - anime.js provides the physics: springs are converted to CSS linear() curves and shared
 *    by CSS transitions (--m-soft / --m-pop / --m-sheet) and these WAAPI animations.
 *  - Every helper is safe to call with reduced motion: it just applies the end state.
 *
 * Exports helpers used across the site: crossSwap, flipSwap, pop, shake, busy, success, haptic, flipLayout.
 */
import { animate, createSpring, splitText, waapi } from '../vendor/anime.esm.min.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = () => window.matchMedia('(max-width: 760px)').matches;

/* ---------------- Timing ---------------- */
export const ease = {
  out: 'cubic-bezier(.16, 1, .3, 1)',
  in: 'cubic-bezier(.5, 0, .75, 0)',
  inOut: 'cubic-bezier(.65, 0, .35, 1)',
  soft: 'cubic-bezier(.16, 1, .3, 1)',
  pop: 'cubic-bezier(.34, 1.56, .64, 1)',
  sheet: 'cubic-bezier(.2, .9, .25, 1)'
};
function setupSprings() {
  const springs = {
    soft: { bounce: 0.12, duration: 520 },
    pop: { bounce: 0.42, duration: 480 },
    sheet: { bounce: 0.08, duration: 460 }
  };
  try {
    Object.entries(springs).forEach(([name, cfg]) => {
      const curve = waapi.convertEase(createSpring(cfg).ease, 40);
      if (!CSS.supports('transition-timing-function', curve)) return; // old browsers keep the cubic-bezier fallback
      ease[name] = curve;
      document.documentElement.style.setProperty(`--m-${name}`, curve);
    });
  } catch (e) { /* fallbacks stay */ }
}

/**
 * Play keyframes on an element. Resolves when finished.
 * keepEnd: leave the final frame applied (fill forwards) — call .cancel() on the returned animation later.
 */
export function play(el, frames, { duration = 520, delay = 0, easing = ease.out, keepEnd = false } = {}) {
  if (!el || !el.animate) return { finished: Promise.resolve(), cancel() {} };
  if (reduce) duration = 0, delay = 0;
  return el.animate(frames, { duration, delay, easing, fill: keepEnd ? 'both' : 'backwards' });
}

/** fade/scale out → swap content → spring back in (garment change, view change) */
export async function crossSwap(el, swap) {
  if (!el || reduce) { await swap(); return; }
  const out = play(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.95) translateY(8px)' }], { duration: 150, easing: ease.in, keepEnd: true });
  await out.finished;
  await swap();
  play(el, [{ opacity: 0, transform: 'scale(.95) translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 560, easing: ease.soft });
  out.cancel();
}

/** turn the garment around: rotate out on Y → swap artwork → rotate in (front ↔ back) */
export async function flipSwap(el, swap, dir = 1) {
  if (!el || reduce) { await swap(); return; }
  const out = play(el, [{ transform: 'rotateY(0deg)', opacity: 1 }, { transform: `rotateY(${90 * dir}deg)`, opacity: 0.6 }], { duration: 170, easing: ease.in, keepEnd: true });
  await out.finished;
  await swap();
  play(el, [{ transform: `rotateY(${-90 * dir}deg)`, opacity: 0.6 }, { transform: 'rotateY(0deg)', opacity: 1 }], { duration: 620, easing: ease.soft });
  out.cancel();
}

/** springy appearance (a print appearing, a chip being added) */
export function pop(el, from = 0.6) {
  return play(el, [{ transform: `scale(${from})`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: ease.pop });
}

/** "no" shake for errors */
export function shake(el) {
  return play(el, [
    { transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' },
    { transform: 'translateX(-5px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }
  ], { duration: 420, easing: 'ease-out' });
}

/** loading state on any element (shimmer / spinner / progress bar styles live in motion.css) */
export function busy(el, on) {
  if (!el) return;
  el.classList.toggle('is-busy', !!on);
  if (on) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy');
}

/** brief success tick on a button */
export function success(btn, ms = 1300) {
  if (!btn) return;
  btn.classList.add('is-done');
  setTimeout(() => btn.classList.remove('is-done'), ms);
}

/** tiny vibration on phones that support it (Android); silently ignored elsewhere */
export function haptic(ms = 10) {
  try { if (!reduce && small() && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
}

/**
 * Animate a layout change (FLIP): items fade out, remaining items glide to their new
 * place, new items spring in. mutate() performs the actual show/hide.
 */
export async function flipLayout(items, mutate) {
  if (reduce) { mutate(); return; }
  const before = new Map(items.filter(el => !el.hidden).map(el => [el, el.getBoundingClientRect()]));
  const leaving = items.filter(el => !el.hidden);
  // fade out everything that might move or leave, quickly
  await Promise.all(leaving.map(el => play(el, [{ opacity: 1, transform: 'none' }, { opacity: 0.0, transform: 'scale(.96)' }], { duration: 140, easing: ease.in, keepEnd: true }).finished.then(a => a)));
  mutate();
  const shown = items.filter(el => !el.hidden);
  shown.forEach((el, i) => {
    const old = before.get(el);
    const now = el.getBoundingClientRect();
    const dx = old ? old.left - now.left : 0, dy = old ? old.top - now.top : 18;
    el.getAnimations().forEach(a => a.cancel());
    play(el, [
      { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(.96)` },
      { opacity: 1, transform: 'none' }
    ], { duration: 620, delay: i * 45, easing: ease.soft });
  });
  items.filter(el => el.hidden).forEach(el => el.getAnimations().forEach(a => a.cancel()));
}

/* ---------------- Hero entrance ---------------- */
function heroIntro() {
  const copy = $('.hero-copy'), visual = $('.hero-visual');
  if (!copy || !visual) return;
  const d = small() ? 14 : 22;
  const h1 = $('h1', copy);
  let words = [h1];
  try { words = splitText(h1, { words: { wrap: 'clip' } }).words; } catch (e) { /* plain fade */ }

  const up = (el, delay, dist = d, duration = 820) => el && play(el,
    [{ opacity: 0, transform: `translateY(${dist}px)` }, { opacity: 1, transform: 'none' }], { duration, delay });

  // make the containers visible and start every child animation in the same frame (no flash)
  copy.classList.add('is-in');
  visual.classList.add('is-in');
  play($('.hdr'), [{ transform: 'translateY(-100%)' }, { transform: 'none' }], { duration: 700, easing: ease.soft });
  up($('.eyebrow', copy), 60, 10);
  words.forEach((w, i) => play(w, [{ transform: 'translateY(108%)' }, { transform: 'none' }], { duration: 900, delay: 140 + i * 60, easing: ease.out }));
  up($('.lead', copy), 380);
  $$('.hero-actions .btn', copy).forEach((b, i) => play(b,
    [{ opacity: 0, transform: `translateY(${d}px) scale(.96)` }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 480 + i * 80, easing: ease.soft }));
  $$('.hero-stats > div', copy).forEach((s, i) => up(s, 600 + i * 80, 12));
  play($('.hero-card', visual), [{ opacity: 0, transform: `translateY(${d * 1.6}px) scale(.965)` }, { opacity: 1, transform: 'none' }], { duration: 1000, delay: 200, easing: ease.soft });
  $$('.float-badge', visual).forEach((b, i) => play(b, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 820 + i * 160, easing: ease.pop }));
  $$('.hero-stats dt').forEach((dt, i) => countUp(dt, 700 + i * 90));
}

export function countUp(el, delay = 0) {
  const tpl = el.textContent;
  const nums = (tpl.match(/\d+/g) || []).map(Number);
  if (!nums.length || reduce) return;
  const st = { p: 0 };
  animate(st, {
    p: 1, duration: 1200, delay, ease: 'outQuart',
    onUpdate: () => { let k = 0; el.textContent = tpl.replace(/\d+/g, () => String(Math.round(nums[k++] * st.p))); },
    onComplete: () => { el.textContent = tpl; }
  });
}

/* ---------------- Scroll reveals ---------------- */
function scrollReveals() {
  const els = $$('.reveal').filter(el => !el.closest('.hero'));
  const queue = [];
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const d = small() ? 16 : 26;
    // stagger items that appear together, per section
    const groups = new Map();
    queue.splice(0).forEach(el => {
      const key = el.closest('section') || document.body;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    });
    groups.forEach(list => list.forEach((el, i) => {
      el.classList.add('is-in');
      play(el, [{ opacity: 0, transform: `translateY(${d}px) scale(.985)` }, { opacity: 1, transform: 'none' }],
        { duration: 760, delay: Math.min(i, 6) * 70, easing: ease.soft });
    }));
  };
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); queue.push(en.target); } });
    if (queue.length && !scheduled) { scheduled = true; requestAnimationFrame(flush); }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach(el => io.observe(el));
}

/* ---------------- Tap ripple ---------------- */
const RIPPLE = '.btn, .chip-btn, .pl-chip, .gp, .seg-btn, .icon-btn, .lang button, .sample, .size-bar button';
function ripple() {
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest(RIPPLE);
    if (!t || t.disabled || e.button > 0) return;
    const r = t.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const s = document.createElement('span');
    s.className = 'rpl';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    t.appendChild(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
  }, { passive: true });
}

/* ---------------- Header: auto-hide + reading progress ---------------- */
function header() {
  const hdr = $('.hdr');
  if (!hdr) return;
  const bar = document.createElement('span');
  bar.className = 'hdr-progress';
  hdr.appendChild(bar);
  let lastY = window.scrollY, ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    const busyUi = hdr.classList.contains('menu-open') || document.documentElement.classList.contains('no-scroll') || hdr.matches(':focus-within');
    if (!busyUi && y > lastY + 6 && y > 420) hdr.classList.add('is-hidden');
    else if (y < lastY - 6 || y < 200 || busyUi) hdr.classList.remove('is-hidden');
    lastY = y;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* ---------------- Mobile menu: cascade + scrim ---------------- */
function mobileMenu() {
  const hdr = $('.hdr');
  if (!hdr) return;
  $$('.nav a', hdr).forEach((a, i) => a.style.setProperty('--i', i));
  const scrim = document.createElement('div');
  scrim.className = 'nav-scrim';
  hdr.after(scrim);
  scrim.addEventListener('click', () => $('#burger')?.click());
}

/* ---------------- Bottom sheets (phones): drag the grip down to close ---------------- */
function sheets() {
  [['#quote', '.q-box', '[data-close]'], ['#login', '.lg-box', '[data-lg-close]']].forEach(([m, b, closeSel]) => {
    const modal = $(m), box = modal && $(b, modal);
    if (!box) return;
    const grip = document.createElement('div');
    grip.className = 'sheet-grip';
    grip.setAttribute('aria-hidden', 'true');
    grip.innerHTML = '<span></span>';
    box.prepend(grip);
    let start = null;
    grip.addEventListener('pointerdown', e => {
      start = { y: e.clientY, t: performance.now() };
      grip.setPointerCapture(e.pointerId);
      box.classList.add('is-dragging');
    });
    grip.addEventListener('pointermove', e => {
      if (!start) return;
      const dy = Math.max(0, e.clientY - start.y);
      box.style.setProperty('--drag', `${dy < 140 ? dy : 140 + (dy - 140) * 0.6}px`);
    });
    const end = e => {
      if (!start) return;
      const dy = Math.max(0, e.clientY - start.y);
      const v = dy / Math.max(1, performance.now() - start.t); // px per ms
      start = null;
      box.classList.remove('is-dragging');
      box.style.removeProperty('--drag');
      if (dy > 120 || (v > 0.6 && dy > 30)) { haptic(8); $(closeSel, modal)?.click(); }
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);

    // content cascades in when the modal opens
    new MutationObserver(() => {
      if (!modal.classList.contains('is-open') || modal.classList.contains('is-done')) { delete modal.dataset.cascaded; return; }
      if (modal.dataset.cascaded) return;
      modal.dataset.cascaded = '1';
      const parts = m === '#quote' ? $$('.q-side > *:not(.sheet-grip), .q-sec, .q-main > .check, .q-foot', modal) : $$('.lg-box > *:not(.sheet-grip):not(.q-x)', modal);
      parts.forEach((el, i) => play(el, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 600, delay: 90 + Math.min(i, 9) * 40, easing: ease.soft }));
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  });

  // quote sent: celebrate the success screen
  const q = $('#quote');
  if (q) new MutationObserver(() => {
    if (!q.classList.contains('is-done') || q.dataset.celebrated) { if (!q.classList.contains('is-done')) delete q.dataset.celebrated; return; }
    q.dataset.celebrated = '1';
    haptic(18);
    play($('.q-done-ic', q), [{ transform: 'scale(.3) rotate(-35deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 760, easing: ease.pop });
    $$('.q-done h2, .q-done p, .q-done .btn', q).forEach((el, i) => play(el,
      [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 160 + i * 90, easing: ease.soft }));
  }).observe(q, { attributes: true, attributeFilter: ['class'] });
}

/* ---------------- FAQ: smooth open / close ---------------- */
function accordion() {
  $$('.faq details').forEach(d => {
    const sum = $('summary', d);
    let anim = null;
    sum.addEventListener('click', e => {
      if (reduce) return; // native toggle
      e.preventDefault();
      anim?.cancel();
      const startH = d.offsetHeight;
      const opening = !d.open;
      if (opening) d.open = true;
      const endH = opening ? d.scrollHeight : sum.offsetHeight;
      d.style.overflow = 'hidden';
      anim = d.animate({ height: [`${startH}px`, `${endH}px`] }, { duration: opening ? 520 : 300, easing: opening ? ease.soft : ease.out });
      const p = $('p', d);
      if (opening && p) play(p, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 60 });
      anim.onfinish = () => { if (!opening) d.open = false; d.style.overflow = ''; anim = null; };
      anim.oncancel = () => { d.style.overflow = ''; };
    });
  });
}

/* ---------------- Pause decorative loops off screen ---------------- */
function offscreenPause() {
  const io = new IntersectionObserver(entries => entries.forEach(en => en.target.classList.toggle('is-offscreen', !en.isIntersecting)));
  $$('.marquee, .hero-visual').forEach(el => io.observe(el));
}

/* ---------------- Init ---------------- */
export function initMotion() {
  setupSprings();
  ripple();
  header();
  mobileMenu();
  sheets();
  accordion();
  offscreenPause();
  if (!reduce) {
    heroIntro();
    scrollReveals();
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-in'));
  }
  window.__motionReady = true;
  document.documentElement.classList.add('motion-ready');
  return true;
}
