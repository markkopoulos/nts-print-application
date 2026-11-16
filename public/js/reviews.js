/**
 * Google reviews section:
 *  - long reviews are clamped with a "Read more" toggle (only when they actually overflow)
 *  - desktop shows the first reviews with a "See all" toggle; extra cards cascade in
 *  - phones get a swipeable, snapping carousel with a progress rail
 */
import { play, ease } from './motion.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initReviews() {
  const list = $('#reviewList');
  if (!list) return;
  const { t } = window.I18N;
  const cards = $$('.rv', list);
  const allBtn = $('#reviewsAll');
  const rail = $('.rv-rail span', list.parentElement);

  /* "Read more" only where the text is longer than the clamp */
  function measure() {
    cards.forEach(card => {
      const text = $('.rv-text', card), btn = $('.rv-more', card);
      if (card.offsetParent === null || card.dataset.open === '1') return; // hidden or expanded by the reader
      text.classList.add('is-clamped');
      const overflows = text.scrollHeight > text.clientHeight + 4;
      text.classList.toggle('is-clamped', overflows);
      btn.hidden = !overflows;
    });
  }
  cards.forEach(card => {
    const text = $('.rv-text', card), btn = $('.rv-more', card);
    btn.addEventListener('click', () => {
      const open = card.dataset.open !== '1';
      card.dataset.open = open ? '1' : '';
      const from = text.offsetHeight;
      text.classList.toggle('is-clamped', !open);
      const to = text.offsetHeight;
      play(text, [{ height: `${from}px` }, { height: `${to}px` }], { duration: open ? 480 : 300, easing: ease.soft });
      btn.dataset.i18n = open ? 'rev.less' : 'rev.more';
      btn.textContent = t(btn.dataset.i18n);
    });
  });

  /* desktop: see all / fewer */
  allBtn?.addEventListener('click', () => {
    const showing = !list.classList.contains('is-all');
    list.classList.toggle('is-all', showing);
    allBtn.setAttribute('aria-expanded', String(showing));
    const label = $('[data-i18n]', allBtn);
    label.dataset.i18n = showing ? 'rev.fewer' : 'rev.all';
    label.textContent = t(label.dataset.i18n);
    if (showing) {
      measure();
      $$('.rv--extra', list).forEach((c, i) => play(c,
        [{ opacity: 0, transform: 'translateY(16px) scale(.98)' }, { opacity: 1, transform: 'none' }],
        { duration: 600, delay: Math.min(i, 8) * 45, easing: ease.soft }));
    } else {
      list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /* phones: progress rail follows the swipe */
  const updateRail = () => {
    if (!rail) return;
    const max = list.scrollWidth - list.clientWidth;
    const w = list.scrollWidth ? (list.clientWidth / list.scrollWidth) * 100 : 100;
    rail.style.setProperty('--w', `${Math.max(12, w)}%`);
    rail.style.setProperty('--x', `${max > 0 ? (list.scrollLeft / max) * (100 / Math.max(12, w) * 100 - 100) : 0}%`);
  };
  list.addEventListener('scroll', () => requestAnimationFrame(updateRail), { passive: true });

  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measure(); updateRail(); }, 150); });
  window.I18N.onChange(() => requestAnimationFrame(measure));
  measure();
  updateRail();
  // fonts can change line breaks after load
  document.fonts?.ready.then(measure);
}
