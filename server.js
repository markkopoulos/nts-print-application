/**
 * Custom Apparel Brand — Showcase, Mockup Studio & Admin
 * Simple Node/Express server. No database: leads are stored in data/leads.json
 * and uploaded files in data/uploads/.
 *
 * Environment variables (optional):
 *   PORT            – port to listen on (Hostinger sets this automatically)
 *   ADMIN_USER      – admin username (default: admin)
 *   ADMIN_PASSWORD  – admin password (falls back to ADMIN_PIN, then to 1234 — change it!)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = String(process.env.ADMIN_USER || 'admin');
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || process.env.ADMIN_PIN || '1234');
const USING_DEFAULT_PASSWORD = !process.env.ADMIN_PASSWORD && !process.env.ADMIN_PIN;
const SESSION_COOKIE = 'nts_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

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
app.set('trust proxy', 1); // Hostinger runs the app behind a proxy (needed for req.ip / req.secure)
app.use(express.json({ limit: '60mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
// Customer uploads (logos, mockups) are only visible to a logged-in admin
app.use('/uploads', requireAdmin, express.static(UPLOAD_DIR, { maxAge: '1h' }));

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
/* Admin auth: username + password -> HttpOnly session cookie          */
/* ------------------------------------------------------------------ */
const sessions = new Map(); // token -> expiry timestamp (in memory; a restart logs everyone out)

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

/** Constant-time comparison that also hides the length of the secret */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function setSessionCookie(req, res, token, maxAgeSec) {
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure}`);
}

function validSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const exp = sessions.get(token);
  if (!exp || exp < Date.now()) { sessions.delete(token); return null; }
  return token;
}

function requireAdmin(req, res, next) {
  if (validSession(req)) return next();
  return res.status(401).json({ success: false, error: 'Unauthorized' });
}

// Brute-force protection: max 10 failed logins per IP per 15 minutes
const loginFails = new Map();
function loginBlocked(ip) {
  const now = Date.now();
  const arr = (loginFails.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
  loginFails.set(ip, arr);
  return arr.length >= 10;
}

app.post('/api/admin/login', (req, res) => {
  if (loginBlocked(req.ip)) {
    return res.status(429).json({ success: false, error: 'Too many attempts. Try again in 15 minutes.' });
  }
  const b = req.body || {};
  const userOk = safeEqual(clean(b.username, 100), ADMIN_USER);
  const passOk = safeEqual(typeof b.password === 'string' ? b.password.slice(0, 200) : '', ADMIN_PASSWORD);
  if (!(userOk && passOk)) {
    loginFails.get(req.ip).push(Date.now());
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }
  loginFails.delete(req.ip);
  // drop expired sessions now and then
  const now = Date.now();
  for (const [t, exp] of sessions) if (exp < now) sessions.delete(t);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, now + SESSION_TTL_MS);
  setSessionCookie(req, res, token, SESSION_TTL_MS / 1000);
  res.json({ success: true, user: ADMIN_USER });
});

app.post('/api/admin/logout', (req, res) => {
  const token = validSession(req);
  if (token) sessions.delete(token);
  setSessionCookie(req, res, '', 0);
  res.json({ success: true });
});

app.get('/api/admin/session', (req, res) => {
  const ok = !!validSession(req);
  res.json({ success: true, authenticated: ok, user: ok ? ADMIN_USER : null });
});

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
      pieces: leads.reduce((s, l) => s + (l.totalQty || 0), 0),
      // submissions per day for the last 30 days (oldest first), split by form type
      daily: (() => {
        const DAY = 864e5;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const first = today.getTime() - 29 * DAY;
        const days = Array.from({ length: 30 }, (_, i) => ({
          date: new Date(first + i * DAY).toISOString().slice(0, 10), quote: 0, contact: 0
        }));
        leads.forEach(l => {
          const i = Math.floor((new Date(l.createdAt).getTime() - first) / DAY);
          if (i >= 0 && i < 30) days[i][l.type === 'contact' ? 'contact' : 'quote']++;
        });
        return days;
      })()
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
  if (USING_DEFAULT_PASSWORD) {
    console.warn('WARNING: admin login is using the default password. Set ADMIN_USER and ADMIN_PASSWORD environment variables.');
  }
});
