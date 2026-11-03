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
    if (meta) meta.setAttribute('content', dark ? '#080c14' : '#2c3192');
    window.dispatchEvent(new CustomEvent('themechange', { detail: current() }));
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    const next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch (err) { /* storage unavailable */ }
    sync();
  });

  mq.addEventListener('change', () => { if (!root.dataset.theme) sync(); });
  sync();

  window.NTS_THEME = { current };
})();
