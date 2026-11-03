/**
 * Page motion with anime.js (v4, vendored in /vendor).
 *  - hero entrance (word-by-word headline, staggered copy, 3D card, counting stats)
 *  - scroll reveals with per-section stagger
 *  - micro-interactions: garment / colour changes, quote modal, success tick, FAQ, theme toggle
 * Everything is skipped for visitors who ask for reduced motion (returns false → CSS fallback).
 */
import { animate, stagger, createTimeline, splitText } from '../vendor/anime.esm.min.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initAnimations() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  document.documentElement.classList.add('anim');
  heroIntro();
  scrollReveals();
  microInteractions();
  return true;
}

/* ---------------- Hero ---------------- */
function heroIntro() {
  const copy = $('.hero-copy');
  const visual = $('.hero-visual');
  if (!copy || !visual) return;
  copy.style.opacity = 1;
  copy.style.transform = 'none';
  visual.style.opacity = 1;
  visual.style.transform = 'none';

  const h1 = $('h1', copy);
  let words = [];
  try {
    words = splitText(h1, { words: { wrap: 'clip' } }).words; // each word rises out of its own clip box
  } catch (e) { words = [h1]; }

  const tl = createTimeline({ defaults: { ease: 'outExpo', duration: 900 } });
  tl.add($('.eyebrow', copy), { opacity: { from: 0, to: 1 }, translateY: { from: 14, to: 0 } }, 0)
    .add(words, { translateY: { from: '105%', to: '0%' }, duration: 1000, delay: stagger(70) }, 120)
    .add($('.lead', copy), { opacity: { from: 0, to: 1 }, translateY: { from: 18, to: 0 } }, 420)
    .add($$('.hero-actions .btn', copy), { opacity: { from: 0, to: 1 }, translateY: { from: 16, to: 0 }, scale: { from: 0.94, to: 1 }, delay: stagger(90) }, 560)
    .add($$('.hero-stats > div', copy), { opacity: { from: 0, to: 1 }, translateY: { from: 14, to: 0 }, delay: stagger(90) }, 700)
    .add($('.hero-card', visual), { opacity: { from: 0, to: 1 }, translateY: { from: 40, to: 0 }, scale: { from: 0.96, to: 1 }, duration: 1200 }, 200)
    .add($$('.float-badge', visual), { opacity: { from: 0, to: 1 }, scale: { from: 0.7, to: 1 }, ease: 'outBack(1.6)', duration: 700, delay: stagger(160) }, 900);

  // count the hero numbers up (keeps separators such as "5–10" or "~12")
  $$('.hero-stats dt').forEach((dt, i) => countUp(dt, 800 + i * 90));
}

function countUp(el, delay) {
  const tpl = el.textContent;
  const nums = (tpl.match(/\d+/g) || []).map(Number);
  if (!nums.length) return;
  const state = { p: 0 };
  animate(state, {
    p: 1, duration: 1300, delay, ease: 'outQuart',
    onUpdate: () => {
      let k = 0;
      el.textContent = tpl.replace(/\d+/g, () => String(Math.round(nums[k++] * state.p)));
    },
    onComplete: () => { el.textContent = tpl; }
  });
}

/* ---------------- Scroll reveals ---------------- */
function scrollReveals() {
  const items = $$('.reveal').filter(el => !el.closest('.hero'));
  const queue = new Set();
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    // group the elements that entered together by section, then stagger each group
    const groups = new Map();
    queue.forEach(el => {
      const sec = el.closest('section') || document.body;
      if (!groups.has(sec)) groups.set(sec, []);
      groups.get(sec).push(el);
    });
    queue.clear();
    groups.forEach(list => {
      animate(list, {
        opacity: { from: 0, to: 1 },
        translateY: { from: 28, to: 0 },
        duration: 900,
        ease: 'outExpo',
        delay: stagger(85),
        onComplete: () => list.forEach(el => { el.classList.add('is-in'); el.style.transform = ''; })
      });
    });
  };

  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      queue.add(en.target);
    });
    if (queue.size && !scheduled) { scheduled = true; requestAnimationFrame(flush); }
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  items.forEach(el => io.observe(el));
}

/* ---------------- Micro-interactions ---------------- */
function microInteractions() {
  // garment change in the studio: soft pop of the artwork / stage
  $$('.gp[data-garment]').forEach(b => b.addEventListener('click', () => {
    animate('#garmentArt', { scale: [{ to: 0.94, duration: 120 }, { to: 1, duration: 520, ease: 'outBack(2)' }], ease: 'outQuad' });
    animate(b, { scale: [{ to: 0.92, duration: 90 }, { to: 1, duration: 420, ease: 'outBack(2.5)' }] });
  }));

  // colour swatches: little bounce (works for swatches created later too)
  document.addEventListener('click', e => {
    const sw = e.target.closest('.sw, .sw-radio');
    if (sw) animate(sw, { scale: [{ to: 0.82, duration: 90 }, { to: 1, duration: 480, ease: 'outBack(3)' }] });
  });

  // quote modal: cascade the form sections in when it opens
  const q = $('#quote');
  if (q) {
    new MutationObserver(() => {
      if (q.classList.contains('is-open') && !q.classList.contains('is-done') && !q.dataset.animated) {
        q.dataset.animated = '1';
        animate($$('.q-sec, .q-side > *', q), { opacity: { from: 0, to: 1 }, translateY: { from: 16, to: 0 }, duration: 700, ease: 'outExpo', delay: stagger(45, { start: 120 }) });
      }
      if (!q.classList.contains('is-open')) delete q.dataset.animated;
      if (q.classList.contains('is-done') && !q.dataset.doneAnimated) {
        q.dataset.doneAnimated = '1';
        animate('.q-done-ic', { scale: { from: 0.4, to: 1 }, rotate: { from: -30, to: 0 }, duration: 900, ease: 'outElastic(1, .6)' });
        animate($$('.q-done h2, .q-done p, .q-done .btn'), { opacity: { from: 0, to: 1 }, translateY: { from: 12, to: 0 }, delay: stagger(90, { start: 150 }), ease: 'outExpo', duration: 700 });
      }
      if (!q.classList.contains('is-done')) delete q.dataset.doneAnimated;
    }).observe(q, { attributes: true, attributeFilter: ['class'] });
  }

  // FAQ: fade/slide the answer in when a question opens
  $$('.faq details').forEach(d => d.addEventListener('toggle', () => {
    if (d.open) animate($('p', d), { opacity: { from: 0, to: 1 }, translateY: { from: -6, to: 0 }, duration: 450, ease: 'outQuad' });
  }));

  // theme toggle: spin the icon
  $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => {
    animate($$('svg', b), { rotate: { from: -120, to: 0 }, scale: { from: 0.6, to: 1 }, duration: 600, ease: 'outBack(2)' });
  }));
}
