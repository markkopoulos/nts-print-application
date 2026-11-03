/**
 * NtsPrints — Admin Panel Client
 * Username/password login (HttpOnly session cookie set by the server),
 * lead management, submissions chart, mockup preview modal, status changes and CSV export.
 */

let allLeads = [];
let currentFilter = 'all';
let lastDaily = [];

async function adminFetch(url, options = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...options });
  if (res.status === 401) {
    showLogin();
    throw new Error('Unauthorized');
  }
  return res;
}

document.addEventListener('DOMContentLoaded', async () => {
  setupListeners();
  try {
    const res = await fetch('/api/admin/session', { credentials: 'same-origin' });
    const json = await res.json();
    if (json.authenticated) return enterDashboard();
  } catch (e) { /* fall through to login */ }
  showLogin();
});

function showLogin() {
  document.getElementById('adminLoginGate').style.display = 'flex';
  document.getElementById('adminMainContent').style.display = 'none';
  setTimeout(() => document.getElementById('adminUser')?.focus(), 50);
}

function showMain() {
  document.getElementById('adminLoginGate').style.display = 'none';
  document.getElementById('adminMainContent').style.display = 'block';
}

function enterDashboard() {
  showMain();
  fetchStats();
  fetchLeads();
}

async function login(username, password) {
  const err = document.getElementById('loginError');
  const btn = document.getElementById('loginSubmitBtn');
  err.style.display = 'none';
  btn.disabled = true;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (res.ok) {
      document.getElementById('adminPass').value = '';
      enterDashboard();
      return;
    }
    err.textContent = res.status === 429
      ? 'Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε ξανά σε 15 λεπτά.'
      : 'Λάθος όνομα χρήστη ή κωδικός.';
    err.style.display = 'block';
  } catch (e) {
    err.textContent = 'Σφάλμα σύνδεσης με τον διακομιστή.';
    err.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
}

function setupListeners() {
  document.getElementById('loginForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const u = document.getElementById('adminUser').value.trim();
    const p = document.getElementById('adminPass').value;
    if (u && p) login(u, p);
  });

  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) { /* ignore */ }
    allLeads = [];
    showLogin();
  });

  const refreshBtn = document.getElementById('refreshLeadsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchStats();
      fetchLeads();
    });
  }

  const searchInput = document.getElementById('leadSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterAndRenderLeads();
    });
  }

  const filterTabs = document.querySelectorAll('.tab-btn');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      filterAndRenderLeads();
    });
  });

  const exportBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToCSV);
  }

  const closeViewerBtn = document.getElementById('closeMockupViewerBtn');
  const viewerModal = document.getElementById('mockupViewerModal');
  if (closeViewerBtn && viewerModal) {
    closeViewerBtn.addEventListener('click', () => {
      viewerModal.classList.remove('active');
    });
    viewerModal.addEventListener('click', (e) => {
      if (e.target === viewerModal) viewerModal.classList.remove('active');
    });
  }

  // redraw the chart when its width changes
  const wrap = document.getElementById('chartWrap');
  if (wrap && 'ResizeObserver' in window) {
    let w = 0;
    new ResizeObserver(entries => {
      const nw = Math.round(entries[0].contentRect.width);
      if (nw && nw !== w) { w = nw; renderChart(lastDaily); }
    }).observe(wrap);
  }
}

/* ------------------------------------------------------------------ */
/* Submissions chart: stacked bars per day (quotes + contact messages) */
/* ------------------------------------------------------------------ */
const SVG_NS = 'http://www.w3.org/2000/svg';
const fmtDay = iso => new Date(iso + 'T12:00:00').toLocaleDateString('el-GR', { day: 'numeric', month: 'short' });

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (parent) parent.appendChild(el);
  return el;
}

/** Bar segment path: square at the bottom, optional 4px rounded top */
function barPath(x, y, w, h, roundTop) {
  if (h <= 0) return '';
  const r = roundTop ? Math.min(4, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}` + (r ? `Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}` : `H${x + w}`) + `V${y + h}Z`;
}

function renderChart(daily) {
  const svg = document.getElementById('submissionsChart');
  const wrap = document.getElementById('chartWrap');
  const tip = document.getElementById('chartTip');
  if (!svg || !wrap || !daily || !daily.length) return;

  const W = Math.max(280, wrap.clientWidth);
  const H = 220;
  const m = { t: 12, r: 8, b: 26, l: 30 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.innerHTML = '';

  const maxTotal = Math.max(...daily.map(d => d.quote + d.contact));
  const yMax = Math.max(4, Math.ceil(maxTotal / 2) * 2);
  const y = v => m.t + ih - (v / yMax) * ih;
  const band = iw / daily.length;
  const bw = Math.max(3, Math.min(18, band * 0.62));

  // recessive grid + y labels
  const grid = svgEl('g', { class: 'c-grid' }, svg);
  [0, yMax / 2, yMax].forEach(v => {
    svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, grid);
    const t = svgEl('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'c-axis' }, grid);
    t.textContent = v;
  });

  // x labels: every 5th day + today
  daily.forEach((d, i) => {
    if (i % 5 !== 4 && i !== daily.length - 1) return;
    const t = svgEl('text', { x: m.l + band * i + band / 2, y: H - 6, 'text-anchor': 'middle', class: 'c-axis' }, svg);
    t.textContent = i === daily.length - 1 ? 'Σήμερα' : fmtDay(d.date);
  });

  const hl = svgEl('rect', { class: 'c-hl', y: m.t, height: ih, width: band, x: -999 }, svg);
  const bars = svgEl('g', {}, svg);
  daily.forEach((d, i) => {
    const x = m.l + band * i + (band - bw) / 2;
    const hq = d.quote ? (d.quote / yMax) * ih : 0;
    const hc = d.contact ? (d.contact / yMax) * ih : 0;
    const gap = hq && hc ? 2 : 0; // 2px surface gap between stacked segments
    if (hq) svgEl('path', { class: 'c-bar c-bar--quote', d: barPath(x, m.t + ih - hq, bw, hq, !hc) }, bars);
    if (hc) svgEl('path', { class: 'c-bar c-bar--contact', d: barPath(x, m.t + ih - hq - gap - hc, bw, hc, true) }, bars);
  });

  // hover layer: full-height hit targets per day
  const hits = svgEl('g', {}, svg);
  daily.forEach((d, i) => {
    const r = svgEl('rect', { x: m.l + band * i, y: m.t, width: band, height: ih, fill: 'transparent' }, hits);
    const show = () => {
      hl.setAttribute('x', m.l + band * i);
      tip.innerHTML = `<b>${fmtDay(d.date)}</b>
        <span><i class="sw sw--quote"></i>Προσφορές <b>${d.quote}</b></span>
        <span><i class="sw sw--contact"></i>Μηνύματα <b>${d.contact}</b></span>
        <span class="tip-total">Σύνολο <b>${d.quote + d.contact}</b></span>`;
      tip.hidden = false;
      const left = Math.min(Math.max(m.l + band * i + band / 2, 80), W - 80);
      tip.style.left = left + 'px';
    };
    r.addEventListener('mouseenter', show);
    r.addEventListener('touchstart', show, { passive: true });
  });
  svg.onmouseleave = () => { tip.hidden = true; hl.setAttribute('x', -999); };

  // accessible table view (days with activity, newest first)
  const rows = daily.filter(d => d.quote + d.contact > 0).reverse();
  document.getElementById('chartTableBody').innerHTML = rows.length
    ? rows.map(d => `<tr><td>${fmtDay(d.date)}</td><td>${d.quote}</td><td>${d.contact}</td><td><b>${d.quote + d.contact}</b></td></tr>`).join('')
    : '<tr><td colspan="4">Καμία υποβολή τις τελευταίες 30 ημέρες.</td></tr>';
  document.getElementById('chartTotal30').textContent = daily.reduce((s, d) => s + d.quote + d.contact, 0);
}

async function fetchStats() {
  try {
    const res = await adminFetch('/api/stats');
    const json = await res.json();
    if (json.success) {
      const d = json.data;
      document.getElementById('statTotal').textContent = d.total || 0;
      document.getElementById('statQuotes').textContent = d.quotes || 0;
      document.getElementById('statNew').textContent = d.newLeads || 0;
      document.getElementById('statPieces').textContent = d.pieces || 0;
      document.getElementById('statWeek').textContent = d.lastWeek || 0;
      lastDaily = d.daily || [];
      renderChart(lastDaily);
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

async function fetchLeads() {
  const tbody = document.getElementById('leadsTableBody');
  tbody.innerHTML = `<tr><td colspan="7" class="empty-state-cell">Φόρτωση δεδομένων...</td></tr>`;

  try {
    const res = await adminFetch('/api/leads');
    const json = await res.json();
    if (json.success) {
      allLeads = json.data || [];
      filterAndRenderLeads();
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state-cell" style="color:var(--err);">Σφάλμα κατά τη φόρτωση των αιτημάτων.</td></tr>`;
  }
}

function filterAndRenderLeads() {
  const search = (document.getElementById('leadSearchInput')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('leadsTableBody');

  const filtered = allLeads.filter(lead => {
    if (currentFilter === 'new' && lead.status !== 'new') return false;
    if (currentFilter === 'quote' && lead.type !== 'quote') return false;
    if (currentFilter === 'contact' && lead.type !== 'contact') return false;

    if (search) {
      const matchName = (lead.name || '').toLowerCase().includes(search);
      const matchEmail = (lead.email || '').toLowerCase().includes(search);
      const matchCompany = (lead.company || '').toLowerCase().includes(search);
      const matchId = (lead.id || '').toLowerCase().includes(search);
      const matchGarment = (lead.garmentLabel || '').toLowerCase().includes(search);
      return matchName || matchEmail || matchCompany || matchId || matchGarment;
    }
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state-cell">
          Δεν βρέθηκαν αιτήματα με τα επιλεγμένα κριτήρια.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(lead => {
    const isQuote = lead.type === 'quote';
    const dateStr = new Date(lead.createdAt).toLocaleString('el-GR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // Customer details
    const companyHtml = lead.company ? `<div class="customer-company">${escapeHtml(lead.company)}</div>` : '';
    const contactsHtml = `
      <div class="customer-contacts">
        <a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a>
        ${lead.phone ? `<span>·</span><a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a>` : ''}
      </div>
    `;

    // Order specs
    let specsHtml = '';
    let qtyHtml = '';
    if (isQuote) {
      const colorDot = lead.colorHex ? `<span class="swatch-dot" style="background-color:${lead.colorHex}"></span>` : '';
      const positionsText = (lead.positions || []).map(p => p.name).join(', ') || 'Μπροστά';
      specsHtml = `
        <div class="order-specs">
          <div class="garment-line">
            <span class="type-pill quote">Προσφορά</span>
            ${colorDot}
            <span>${escapeHtml(lead.garmentLabel || lead.garment || 'Ρούχο')}</span>
          </div>
          <div class="meta-tags">
            ${lead.colorName ? `<span class="meta-pill">Χρώμα: ${escapeHtml(lead.colorName)}</span>` : ''}
            ${lead.technique ? `<span class="meta-pill">Τεχνική: ${escapeHtml(lead.technique)}</span>` : ''}
            <span class="meta-pill">Θέσεις: ${escapeHtml(positionsText)}</span>
          </div>
          ${lead.message ? `<div style="font-size:12px; color:var(--mut); margin-top:4px;">💬 "${escapeHtml(lead.message)}"</div>` : ''}
        </div>
      `;

      // Sizes chips
      const sizes = lead.sizes || {};
      const sizeKeys = Object.keys(sizes).filter(k => sizes[k] > 0);
      const sizeChips = sizeKeys.map(k => `<span class="size-mini-chip">${k}: <b>${sizes[k]}</b></span>`).join('');
      qtyHtml = `
        <div class="qty-total">${lead.totalQty || 0} τεμ.</div>
        ${sizeChips ? `<div class="sizes-mini-chips">${sizeChips}</div>` : ''}
      `;
    } else {
      specsHtml = `
        <div class="order-specs">
          <div class="garment-line">
            <span class="type-pill contact">Μήνυμα</span>
            <span>${escapeHtml(lead.interest || 'Γενικό Ερώτημα')}</span>
          </div>
          ${lead.message ? `<div style="font-size:12px; color:var(--mut); margin-top:4px;">💬 "${escapeHtml(lead.message)}"</div>` : ''}
        </div>
      `;
      qtyHtml = `<div class="qty-total" style="font-size:13px; font-weight:500;">${escapeHtml(lead.quantityText || '—')}</div>`;
    }

    // Mockup / Files
    let previewHtml = '—';
    if (lead.mockup) {
      previewHtml = `
        <button type="button" class="mockup-thumb-btn" onclick="openLeadViewer('${lead.id}')">
          <img src="${lead.mockup}" class="mockup-thumb-img" alt="Mockup">
          <span>Προβολή</span>
        </button>
      `;
    } else if (lead.files && lead.files.length) {
      previewHtml = `
        <button type="button" class="mockup-thumb-btn" onclick="openLeadViewer('${lead.id}')">
          <span>${lead.files.length} Αρχείο/α</span>
        </button>
      `;
    }

    return `
      <tr class="lead-row" data-id="${lead.id}">
        <td>
          <div class="id-badge">#${lead.id}</div>
          <div class="lead-date">${dateStr}</div>
        </td>
        <td>
          <div class="customer-name">${escapeHtml(lead.name)}</div>
          ${companyHtml}
          ${contactsHtml}
        </td>
        <td>${specsHtml}</td>
        <td>${qtyHtml}</td>
        <td style="text-align: center;">${previewHtml}</td>
        <td>
          <select class="status-select ${lead.status || 'new'}" onchange="updateStatus('${lead.id}', this.value)">
            <option value="new" ${lead.status === 'new' ? 'selected' : ''}>Νέο</option>
            <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Σε εξέλιξη</option>
            <option value="completed" ${lead.status === 'completed' ? 'selected' : ''}>Ολοκληρώθηκε</option>
          </select>
        </td>
        <td>
          <div class="row-actions">
            <button type="button" class="icon-btn" title="Πλήρη στοιχεία" onclick="openLeadViewer('${lead.id}')">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </button>
            <button type="button" class="icon-btn" title="Διαγραφή" onclick="deleteLead('${lead.id}')">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function updateStatus(id, newStatus) {
  try {
    const res = await adminFetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      const idx = allLeads.findIndex(l => l.id === id);
      if (idx !== -1) allLeads[idx].status = newStatus;
      fetchStats();
      filterAndRenderLeads();
    }
  } catch (err) {
    alert('Αποτυχία ενημέρωσης κατάστασης.');
  }
}

async function deleteLead(id) {
  if (!confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε το αίτημα #${id};`)) {
    return;
  }
  try {
    const res = await adminFetch(`/api/leads/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      allLeads = allLeads.filter(l => l.id !== id);
      fetchStats();
      filterAndRenderLeads();
    }
  } catch (err) {
    alert('Αποτυχία διαγραφής.');
  }
}

window.openLeadViewer = function(leadId) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead) return;

  const modal = document.getElementById('mockupViewerModal');
  const img = document.getElementById('viewerMockupImage');
  const imgContainer = document.getElementById('viewerImgContainer');
  const title = document.getElementById('viewerLeadTitle');
  const subtitle = document.getElementById('viewerLeadDetails');
  const infoGrid = document.getElementById('viewerInfoGrid');
  const filesList = document.getElementById('viewerFilesList');
  const downloadBtn = document.getElementById('downloadLeadMockupLink');

  title.textContent = `Αίτημα #${lead.id} — ${lead.name}`;
  subtitle.textContent = lead.company ? `${lead.company} · ${lead.email}` : lead.email;

  // Mockup image
  if (lead.mockup) {
    img.src = lead.mockup;
    imgContainer.style.display = 'block';
    downloadBtn.style.display = 'inline-flex';
    downloadBtn.href = lead.mockup;
    downloadBtn.download = `mockup-${lead.id}.png`;
  } else {
    imgContainer.style.display = 'none';
    downloadBtn.style.display = 'none';
  }

  // Info blocks
  let blocks = `
    <div class="viewer-info-block">
      <h5>Στοιχεία Επικοινωνίας</h5>
      <div><strong>${escapeHtml(lead.name)}</strong></div>
      ${lead.company ? `<div>Εταιρεία: ${escapeHtml(lead.company)}</div>` : ''}
      <div>Email: <a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></div>
      ${lead.phone ? `<div>Τηλέφωνο: <a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a></div>` : ''}
    </div>
  `;

  if (lead.type === 'quote') {
    const sizeItems = Object.entries(lead.sizes || {}).filter(([k, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(' · ');
    const posItems = (lead.positions || []).map(p => p.name).join(', ') || 'Μπροστά';
    blocks += `
      <div class="viewer-info-block">
        <h5>Προδιαγραφές Παραγγελίας</h5>
        <div>Ρούχο: <strong>${escapeHtml(lead.garmentLabel || lead.garment)}</strong></div>
        <div>Χρώμα: ${escapeHtml(lead.colorName || '—')}</div>
        <div>Τεχνική: ${escapeHtml(lead.technique || '—')}</div>
        <div>Θέσεις: ${escapeHtml(posItems)}</div>
        <div style="margin-top:4px;">Μεγέθη: <strong>${sizeItems || '—'}</strong> (${lead.totalQty || 0} τεμ.)</div>
      </div>
    `;
  } else {
    blocks += `
      <div class="viewer-info-block">
        <h5>Ενδιαφέρον</h5>
        <div>Κατηγορία: <strong>${escapeHtml(lead.interest || '—')}</strong></div>
        <div>Εκτίμηση ποσότητας: ${escapeHtml(lead.quantityText || '—')}</div>
      </div>
    `;
  }

  if (lead.message) {
    blocks += `
      <div class="viewer-info-block" style="grid-column: 1 / -1;">
        <h5>Μήνυμα Πελάτη</h5>
        <div>${escapeHtml(lead.message)}</div>
      </div>
    `;
  }

  infoGrid.innerHTML = blocks;

  // Attached files list
  const files = lead.files || [];
  if (files.length) {
    filesList.innerHTML = files.map(f => `
      <a href="${f.url}" target="_blank" download class="file-link-pill">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        <span>${escapeHtml(f.label || 'Αρχείο')}</span>
      </a>
    `).join('');
  } else {
    filesList.innerHTML = '<span style="font-size:12px; color:var(--mut);">Δεν υπάρχουν επιπλέον συνημμένα αρχεία.</span>';
  }

  modal.classList.add('active');
};

function exportToCSV() {
  if (!allLeads.length) {
    alert('Δεν υπάρχουν αιτήματα για εξαγωγή.');
    return;
  }

  const headers = ['ID', 'Τύπος', 'Ημερομηνία', 'Ονοματεπώνυμο', 'Εταιρεία', 'Email', 'Τηλέφωνο', 'Ρούχο', 'Χρώμα', 'Τεχνική', 'Θέσεις', 'Σύνολο Τεμαχίων', 'Ανάλυση Μεγεθών', 'Μήνυμα', 'Κατάσταση'];
  const rows = allLeads.map(l => {
    const isQuote = l.type === 'quote';
    const sizeStr = Object.entries(l.sizes || {}).filter(([k, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(' ');
    const posStr = (l.positions || []).map(p => p.name).join(', ');

    return [
      l.id,
      isQuote ? 'Προσφορά' : 'Επικοινωνία',
      new Date(l.createdAt).toLocaleDateString('el-GR'),
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.company || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.garmentLabel || l.interest || '').replace(/"/g, '""')}"`,
      `"${(l.colorName || '').replace(/"/g, '""')}"`,
      `"${(l.technique || '').replace(/"/g, '""')}"`,
      `"${posStr.replace(/"/g, '""')}"`,
      isQuote ? (l.totalQty || 0) : `"${(l.quantityText || '').replace(/"/g, '""')}"`,
      `"${sizeStr.replace(/"/g, '""')}"`,
      `"${(l.message || '').replace(/"/g, '""')}"`,
      l.status || 'new'
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ntsprints-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
