/**
 * Light / dark theme switcher (shared by the site and the admin panel).
 *
 * - Default: follows the operating system (prefers-color-scheme).
 * - Clicking any [data-theme-toggle] button flips the theme and remembers it
 *   in localStorage ('nts-theme'). A tiny inline script in <head> applies the
 *   saved choice before first paint, so there is no flash.
 * - Fires a 'themechange' event on window with { detail: 'light' | 'dark' }.
 */
(function () {
  const KEY = 'nts-theme';
  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');

  const current = () => root.dataset.theme || (mq.matches ? 'dark' : 'light');

  function sync() {
    const dark = current() === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.setAttribute('aria-pressed', String(dark));
      b.classList.toggle('is-dark', dark);
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#080c14' : '#7b1e33');
    window.dispatchEvent(new CustomEvent('themechange', { detail: current() }));
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    const next = current() === 'dark' ? 'light' : 'dark';
    const apply = () => {
      root.dataset.theme = next;
      try { localStorage.setItem(KEY, next); } catch (err) { /* storage unavailable */ }
      sync();
    };
    // the new theme grows out of the toggle as a circle (View Transitions); instant elsewhere
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || calm) { apply(); return; }
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('vt-theme');
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 620, easing: 'cubic-bezier(.16, 1, .3, 1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
    const done = () => root.classList.remove('vt-theme');
    vt.finished.finally(done);
    setTimeout(done, 1500); // safety net: never leave the language crossfade disabled
  });

  mq.addEventListener('change', () => { if (!root.dataset.theme) sync(); });
  sync();

  window.NTS_THEME = { current };
})();
