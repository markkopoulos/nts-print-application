/**
 * Header "login" button → admin login modal → /admin dashboard.
 * If the visitor already has a valid admin session, the button goes straight to /admin.
 */
const { t } = window.I18N;
const $ = (s, r = document) => r.querySelector(s);

export function initLogin() {
  const btn = $('#loginBtn');
  const modal = $('#login');
  const form = $('#loginForm');
  if (!btn || !modal || !form) return;
  let loggedIn = false;
  let lastFocus = null;

  // already signed in? then the button is a shortcut to the dashboard
  fetch('/api/admin/session', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(j => {
      loggedIn = !!j.authenticated;
      if (loggedIn) {
        btn.classList.add('is-in');
        btn.setAttribute('data-i18n-attr', 'aria-label:login.dash;title:login.dash');
        window.I18N.apply(btn);
      }
    })
    .catch(() => { /* offline: keep the login button */ });

  function open() {
    lastFocus = document.activeElement;
    $('#lgMsg').textContent = '';
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-open'));
    document.documentElement.classList.add('no-scroll');
    setTimeout(() => form.elements.username.focus(), 120);
  }
  function close() {
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('no-scroll');
    setTimeout(() => { modal.hidden = true; }, 220);
    lastFocus?.focus?.();
  }

  btn.addEventListener('click', () => (loggedIn ? location.assign('/admin') : open()));
  modal.querySelectorAll('[data-lg-close]').forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#lgMsg');
    const username = form.elements.username.value.trim();
    const password = form.elements.password.value;
    if (!username || !password) { msg.textContent = t('err.loginFields'); return; }

    const submit = $('#lgSubmit');
    submit.disabled = true;
    submit.classList.add('is-loading');
    msg.textContent = '';
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) { location.assign('/admin'); return; }
      msg.textContent = t(res.status === 429 ? 'err.loginRate' : res.status === 401 ? 'err.login' : 'err.generic');
      form.elements.password.select();
    } catch (err) {
      msg.textContent = t('err.generic');
    } finally {
      submit.disabled = false;
      submit.classList.remove('is-loading');
    }
  });
}
