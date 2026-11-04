/**
 * Privacy-friendly, first-party analytics (no cookies, no localStorage, no third parties).
 * Sends tiny anonymous events to /api/e; the server turns the visitor into a daily-rotating
 * hash and never stores IPs. Events power the funnel in the admin dashboard:
 *   pageview → studio_view → logo_upload → quote_open → quote_submit  (+ contact_submit …)
 */
const sent = new Set();

export function track(name, { once = true } = {}) {
  if (once && sent.has(name)) return;
  sent.add(name);
  const body = JSON.stringify({
    n: name,
    p: location.pathname,
    r: name === 'pageview' ? document.referrer : ''
  });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/e', new Blob([body], { type: 'text/plain' }))) return;
  } catch (e) { /* fall back to fetch */ }
  fetch('/api/e', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
}

export function initAnalytics() {
  track('pageview');
  const studio = document.getElementById('studio');
  if (studio && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { track('studio_view'); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(studio);
  }
}
