/* Full-screen viewer for the "Our work" photos: click to open, arrows / swipe / keys to move, Esc to close. */
import { play, ease, reduce } from './motion.js';

export function initGallery() {
  const items = [...document.querySelectorAll('.work-open[data-full]')];
  if (!items.length) return;
  const t = k => window.I18N?.t(k) ?? k;

  const lb = document.createElement('div');
  lb.className = 'lb';
  lb.hidden = true;
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.innerHTML = `
    <span class="lb-count" aria-live="polite"></span>
    <figure class="lb-fig"><img class="lb-img" alt=""></figure>
    <figcaption class="lb-cap"><b></b><span></span></figcaption>
    <button type="button" class="lb-btn lb-close" data-i18n-attr="aria-label:lb.close" aria-label="Κλείσιμο">&times;</button>
    <button type="button" class="lb-btn lb-prev" data-i18n-attr="aria-label:lb.prev" aria-label="Προηγούμενη φωτογραφία"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
    <button type="button" class="lb-btn lb-next" data-i18n-attr="aria-label:lb.next" aria-label="Επόμενη φωτογραφία"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>`;
  document.body.appendChild(lb);
  const img = lb.querySelector('.lb-img');
  const capT = lb.querySelector('.lb-cap b');
  const capD = lb.querySelector('.lb-cap span');
  const count = lb.querySelector('.lb-count');
  const close = lb.querySelector('.lb-close');

  let list = items, idx = 0, opener = null;

  function render(dir = 0) {
    const btn = list[idx];
    const card = btn.closest('.work');
    const thumb = btn.querySelector('img');
    img.src = btn.dataset.full;
    img.alt = thumb?.alt || '';
    capT.textContent = card.querySelector('h3')?.textContent || '';
    capD.textContent = card.querySelector('p')?.textContent || '';
    count.textContent = `${idx + 1} / ${list.length}`;
    const multi = list.length > 1;
    lb.querySelector('.lb-prev').hidden = !multi;
    lb.querySelector('.lb-next').hidden = !multi;
    if (dir && !reduce) play(img, [{ opacity: 0, transform: `translateX(${dir * 40}px)` }, { opacity: 1, transform: 'none' }], { duration: 380 });
    // warm the neighbours so arrows feel instant
    [idx + 1, idx - 1].forEach(i => { const b = list[(i + list.length) % list.length]; if (b) new Image().src = b.dataset.full; });
  }

  function open(btn) {
    list = items.filter(b => !b.closest('.work').hidden);
    idx = Math.max(0, list.indexOf(btn));
    opener = btn;
    render();
    lb.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    if (!reduce) {
      play(lb, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
      play(img, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: ease.out });
    }
    close.focus();
  }

  async function shut() {
    if (lb.hidden) return;
    const a = reduce ? null : play(lb, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, keepEnd: true });
    await a?.finished.catch(() => {});
    lb.hidden = true;
    a?.cancel();
    document.documentElement.style.overflow = '';
    opener?.focus({ preventScroll: true });
  }

  const step = d => { idx = (idx + d + list.length) % list.length; render(d); };

  items.forEach(b => b.addEventListener('click', () => open(b)));
  close.addEventListener('click', shut);
  lb.querySelector('.lb-prev').addEventListener('click', () => step(-1));
  lb.querySelector('.lb-next').addEventListener('click', () => step(1));
  lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb-fig')) shut(); });
  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') shut();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Tab') { // keep focus inside the viewer
      const f = [...lb.querySelectorAll('button:not([hidden])')];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });

  let x0 = null;
  lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50 && list.length > 1) step(dx < 0 ? 1 : -1);
  });

  window.I18N?.onChange(() => { if (!lb.hidden) render(); });
}
