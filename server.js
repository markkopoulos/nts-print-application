/**
 * Custom Apparel Brand — Showcase, Mockup Studio & Admin
 * Simple Node/Express server. No database: leads are stored in data/leads.json
 * and uploaded files in data/uploads/.
 *
 * Environment variables (optional):
 *   PORT       – port to listen on (Hostinger sets this automatically)
 *   ADMIN_PIN  – PIN for the admin panel (default: 1234)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = String(process.env.ADMIN_PIN || '1234');

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DATA_FILE = path.join(DATA_DIR, 'leads.json');

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB per file
const ALLOWED_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/postscript': 'eps',
  'application/illustrator': 'ai'
};

app.disable('x-powered-by');
app.use(express.json({ limit: '60mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

/* ------------------------------------------------------------------ */
/* Storage helpers                                                     */
/* ------------------------------------------------------------------ */
function ensureStorage() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const now = Date.now();
    const demo = [
      {
        id: 'Q-1001',
        type: 'quote',
        createdAt: new Date(now - 3600e3 * 5).toISOString(),
        status: 'new',
        name: 'Αλέξανδρος Νικολάου',
        company: 'Kaya Coffee Bar',
        email: 'alex@example.com',
        phone: '+30 697 123 4567',
        garment: 'hoodie',
        garmentLabel: 'Oversized Hoodie',
        colorName: 'Μαύρο',
        colorHex: '#17181c',
        technique: 'Κέντημα',
        positions: [{ name: 'Μπροστά' }, { name: 'Πίσω' }],
        sizes: { S: 4, M: 10, L: 12, XL: 6 },
        totalQty: 32,
        message: 'Κέντημα στο στήθος και μεταξοτυπία στην πλάτη για το προσωπικό μας.',
        mockup: '',
        files: []
      },
      {
        id: 'Q-1002',
        type: 'contact',
        createdAt: new Date(now - 3600e3 * 28).toISOString(),
        status: 'contacted',
        name: 'Ελένη Δημητρίου',
        company: 'Indie band "Halcyon"',
        email: 'eleni@example.com',
        phone: '+30 694 889 0012',
        interest: 'Μπλουζάκια / φούτερ',
        quantityText: '50 τεμάχια',
        message: 'Merch για περιοδεία. Θέλουμε βαρύ οργανικό βαμβάκι.',
        files: []
      }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(demo, null, 2), 'utf-8');
  }
}

function readLeads() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    console.error('readLeads:', e.message);
    return [];
  }
}

function writeLeads(leads) {
  // atomic-ish write: write temp file then rename
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(leads, null, 2), 'utf-8');
  fs.renameSync(tmp, DATA_FILE);
}

/** Saves a base64 data URL to /data/uploads and returns its public info */
function saveDataUrl(dataUrl, label) {
  if (typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1];
  const ext = ALLOWED_EXT[mime];
  if (!ext) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_FILE_BYTES) return null;
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buf);
  return { label: String(label || 'Αρχείο').slice(0, 60), url: `/uploads/${fileName}`, mime, size: buf.length };
}

function clean(v, max = 500) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/* ------------------------------------------------------------------ */
/* Basic anti-spam: per-IP rate limit                                  */
/* ------------------------------------------------------------------ */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 12;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */
app.post('/api/leads', (req, res) => {
  try {
    const b = req.body || {};

    // Honeypot – bots fill hidden "website" field
    if (b.website) return res.json({ success: true, leadId: 'OK' });
    if (rateLimited(req.ip)) {
      return res.status(429).json({ success: false, error: 'Πολλά αιτήματα. Δοκιμάστε ξανά σε λίγα λεπτά.' });
    }

    const name = clean(b.name, 120);
    const email = clean(b.email, 160);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Συμπληρώστε ονοματεπώνυμο και έγκυρο email.' });
    }
    if (!b.consent) {
      return res.status(400).json({ success: false, error: 'Απαιτείται η αποδοχή της πολιτικής απορρήτου.' });
    }

    const type = b.type === 'contact' ? 'contact' : 'quote';
    const prefix = type === 'quote' ? 'Q' : 'C';

    const lead = {
      id: `${prefix}-${Date.now().toString().slice(-6)}`,
      type,
      createdAt: new Date().toISOString(),
      status: 'new',
      name,
      company: clean(b.company, 120),
      email,
      phone: clean(b.phone, 40),
      message: clean(b.message, 3000),
      files: []
    };

    if (type === 'quote') {
      const sizes = {};
      let total = 0;
      if (b.sizes && typeof b.sizes === 'object') {
        for (const [k, v] of Object.entries(b.sizes)) {
          const n = Math.max(0, Math.min(100000, parseInt(v, 10) || 0));
          if (n > 0) { sizes[clean(k, 8)] = n; total += n; }
        }
      }
      Object.assign(lead, {
        garment: clean(b.garment, 30),
        garmentLabel: clean(b.garmentLabel, 80),
        colorName: clean(b.colorName, 40),
        colorHex: clean(b.colorHex, 9),
        technique: clean(b.technique, 60),
        positionOther: clean(b.positionOther, 60),
        sizes,
        totalQty: total,
        positions: [],
        mockup: ''
      });

      const mock = saveDataUrl(b.mockup, 'Mockup');
      if (mock) lead.mockup = mock.url;

      const studioLogo = saveDataUrl(b.studioLogo, 'Logo (Mockup Studio)');
      if (studioLogo) lead.files.push(studioLogo);

      if (Array.isArray(b.positions)) {
        b.positions.slice(0, 6).forEach(p => {
          const pos = { name: clean(p && p.name, 40) };
          if (!pos.name) return;
          const f = p.file ? saveDataUrl(p.file, `Logo – ${pos.name}`) : null;
          if (f) { pos.file = f.url; lead.files.push(f); }
          lead.positions.push(pos);
        });
      }
    } else {
      lead.interest = clean(b.interest, 80);
      lead.quantityText = clean(b.quantityText, 60);
      const f = saveDataUrl(b.file, 'Συνημμένο');
      if (f) lead.files.push(f);
    }

    const leads = readLeads();
    leads.unshift(lead);
    writeLeads(leads);

    res.status(201).json({ success: true, leadId: lead.id });
  } catch (err) {
    console.error('POST /api/leads', err);
    res.status(500).json({ success: false, error: 'Σφάλμα διακομιστή. Δοκιμάστε ξανά.' });
  }
});

/* ------------------------------------------------------------------ */
/* Admin API (PIN protected via x-admin-pin header)                    */
/* ------------------------------------------------------------------ */
function requireAdmin(req, res, next) {
  const pin = String(req.get('x-admin-pin') || '');
  const a = Buffer.from(pin);
  const b = Buffer.from(ADMIN_PIN);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  return res.status(401).json({ success: false, error: 'Unauthorized' });
}

app.post('/api/admin/login', requireAdmin, (req, res) => res.json({ success: true }));

app.get('/api/leads', requireAdmin, (req, res) => {
  const leads = readLeads();
  res.json({ success: true, count: leads.length, data: leads });
});

app.get('/api/stats', requireAdmin, (req, res) => {
  const leads = readLeads();
  const weekAgo = Date.now() - 7 * 864e5;
  res.json({
    success: true,
    data: {
      total: leads.length,
      quotes: leads.filter(l => l.type === 'quote').length,
      newLeads: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      completed: leads.filter(l => l.status === 'completed').length,
      lastWeek: leads.filter(l => new Date(l.createdAt).getTime() > weekAgo).length,
      pieces: leads.reduce((s, l) => s + (l.totalQty || 0), 0)
    }
  });
});

app.patch('/api/leads/:id', requireAdmin, (req, res) => {
  const leads = readLeads();
  const lead = leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ success: false, error: 'Not found' });
  const allowed = ['new', 'contacted', 'completed'];
  if (allowed.includes(req.body.status)) lead.status = req.body.status;
  if (typeof req.body.note === 'string') lead.adminNote = clean(req.body.note, 2000);
  writeLeads(leads);
  res.json({ success: true, data: lead });
});

app.delete('/api/leads/:id', requireAdmin, (req, res) => {
  const leads = readLeads();
  const lead = leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ success: false, error: 'Not found' });

  // remove associated uploaded files
  const urls = [lead.mockup, ...(lead.files || []).map(f => f.url)].filter(Boolean);
  urls.forEach(u => {
    const p = path.join(UPLOAD_DIR, path.basename(u));
    fs.promises.unlink(p).catch(() => {});
  });

  writeLeads(leads.filter(l => l.id !== req.params.id));
  res.json({ success: true });
});

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

ensureStorage();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}  (admin: /admin)`);
});
