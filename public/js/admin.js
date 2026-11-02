/**
 * NtsPrints — Admin Panel Client
 * Handles authenticated API calls with x-admin-pin, lead management,
 * mockup preview modal, status changes and CSV export.
 */

let allLeads = [];
let currentFilter = 'all';

function getPin() {
  return sessionStorage.getItem('admin_pin') || '';
}

function setPin(pin) {
  sessionStorage.setItem('admin_pin', pin);
}

function clearPin() {
  sessionStorage.removeItem('admin_pin');
}

async function adminFetch(url, options = {}) {
  const pin = getPin();
  const headers = Object.assign({}, options.headers || {}, {
    'x-admin-pin': pin
  });
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearPin();
    showLogin();
    throw new Error('Unauthorized');
  }
  return res;
}

document.addEventListener('DOMContentLoaded', () => {
  setupListeners();
  if (getPin()) {
    verifyAndLoad(getPin());
  } else {
    showLogin();
  }
});

function showLogin() {
  const gate = document.getElementById('adminLoginGate');
  const main = document.getElementById('adminMainContent');
  if (gate) gate.style.display = 'flex';
  if (main) main.style.display = 'none';
}

function showMain() {
  const gate = document.getElementById('adminLoginGate');
  const main = document.getElementById('adminMainContent');
  if (gate) gate.style.display = 'none';
  if (main) main.style.display = 'block';
}

async function verifyAndLoad(pin) {
  const pinError = document.getElementById('pinError');
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'x-admin-pin': pin }
    });
    if (!res.ok) {
      if (pinError) {
        pinError.textContent = 'Λάθος PIN. Δοκιμάστε ξανά (προεπιλογή: 1234).';
        pinError.style.display = 'block';
      }
      clearPin();
      showLogin();
      return;
    }
    setPin(pin);
    if (pinError) pinError.style.display = 'none';
    showMain();
    fetchStats();
    fetchLeads();
  } catch (err) {
    if (pinError) {
      pinError.textContent = 'Σφάλμα σύνδεσης με τον διακομιστή.';
      pinError.style.display = 'block';
    }
  }
}

function setupListeners() {
  const pinForm = document.getElementById('pinForm');
  const pinInput = document.getElementById('adminPinInput');

  if (pinForm) {
    pinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = pinInput.value.trim();
      if (val) verifyAndLoad(val);
    });
  }

  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearPin();
      location.reload();
    });
  }

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
  a.download = `atelier-leads-${new Date().toISOString().slice(0, 10)}.csv`;
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
