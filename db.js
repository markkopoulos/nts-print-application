/**
 * Persistent storage: SQLite (Node's built-in node:sqlite, Node >= 22.13) + uploaded files.
 *
 * Everything lives OUTSIDE the deployed code, so a redeploy from GitHub can't wipe it:
 *   DATA_DIR (env)  or  ~/ntsprints-data
 *     ├── ntsprints.db   leads + privacy-friendly analytics
 *     └── uploads/       customer logos, mockups, attachments
 *
 * On first start it imports the old file-based data (data/leads.json + data/uploads/)
 * that lived inside the app folder, once.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (e) {
  console.error('This app needs Node.js 22.13 or newer (built-in SQLite). Current:', process.version);
  throw e;
}

const LEGACY_DIR = path.join(__dirname, 'data');

/** use DATA_DIR / ~/ntsprints-data; if the host doesn't allow writing there, fall back to ./data */
function pickDataDir() {
  const preferred = path.resolve(process.env.DATA_DIR || path.join(os.homedir(), 'ntsprints-data'));
  try {
    fs.mkdirSync(path.join(preferred, 'uploads'), { recursive: true });
    const probe = path.join(preferred, '.write-test');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return { dir: preferred, fallback: false };
  } catch (e) {
    console.warn(`WARNING: cannot write to ${preferred} (${e.code || e.message}). ` +
      'Falling back to the app folder — data may be lost on redeploy. Set DATA_DIR to a writable folder outside the app.');
    fs.mkdirSync(path.join(LEGACY_DIR, 'uploads'), { recursive: true });
    return { dir: LEGACY_DIR, fallback: true };
  }
}
const { dir: DATA_DIR, fallback: DATA_DIR_IS_FALLBACK } = pickDataDir();
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'ntsprints.db');
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 3000;
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS leads_created ON leads(created_at);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    ts INTEGER NOT NULL,
    name TEXT NOT NULL,
    visitor TEXT NOT NULL,
    ref TEXT,
    path TEXT
  );
  CREATE INDEX IF NOT EXISTS events_day_name ON events(day, name);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`);

const getMeta = key => db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null;
const setMeta = (key, value) => db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */
const stmt = {
  all: db.prepare('SELECT data FROM leads ORDER BY created_at DESC'),
  get: db.prepare('SELECT data FROM leads WHERE id = ?'),
  insert: db.prepare('INSERT INTO leads (id, created_at, type, status, data) VALUES (?, ?, ?, ?, ?)'),
  update: db.prepare('UPDATE leads SET status = ?, data = ? WHERE id = ?'),
  remove: db.prepare('DELETE FROM leads WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM leads')
};

function listLeads() { return stmt.all.all().map(r => JSON.parse(r.data)); }
function getLead(id) { const r = stmt.get.get(id); return r ? JSON.parse(r.data) : null; }
function countLeads() { return stmt.count.get().n; }

/** Inserts a lead; if its id is taken, appends a short random suffix */
function insertLead(lead) {
  const base = lead.id;
  for (let i = 0; i < 5; i++) {
    try {
      stmt.insert.run(lead.id, lead.createdAt, lead.type, lead.status, JSON.stringify(lead));
      return lead;
    } catch (e) {
      if (!/UNIQUE|PRIMARY/i.test(e.message)) throw e;
      lead.id = base + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
    }
  }
  throw new Error('Could not allocate a lead id');
}
function updateLead(lead) { stmt.update.run(lead.status, JSON.stringify(lead), lead.id); }
function deleteLead(id) { stmt.remove.run(id); }

/* ------------------------------------------------------------------ */
/* One-time import of the old file-based storage                       */
/* ------------------------------------------------------------------ */
function migrateLegacy() {
  if (getMeta('legacy_import_v1')) return;
  let imported = 0, files = 0;
  try {
    const legacyFile = path.join(LEGACY_DIR, 'leads.json');
    if (fs.existsSync(legacyFile)) {
      const old = JSON.parse(fs.readFileSync(legacyFile, 'utf-8'));
      if (Array.isArray(old)) {
        old.forEach(l => {
          if (!l || !l.id || getLead(l.id)) return;
          insertLead({ status: 'new', type: 'quote', createdAt: new Date().toISOString(), ...l });
          imported++;
        });
      }
    }
    const legacyUploads = path.join(LEGACY_DIR, 'uploads');
    if (fs.existsSync(legacyUploads) && path.resolve(legacyUploads) !== UPLOAD_DIR) {
      fs.readdirSync(legacyUploads).forEach(f => {
        const src = path.join(legacyUploads, f), dst = path.join(UPLOAD_DIR, f);
        if (fs.statSync(src).isFile() && !fs.existsSync(dst)) { fs.copyFileSync(src, dst); files++; }
      });
    }
  } catch (e) {
    console.error('Legacy import failed (old data left untouched):', e.message);
    return;
  }
  setMeta('legacy_import_v1', new Date().toISOString());
  if (imported || files) console.log(`Imported ${imported} lead(s) and ${files} file(s) from the old data/ folder.`);
}
migrateLegacy();

/* ------------------------------------------------------------------ */
/* Privacy-friendly analytics (no cookies, no IPs stored)              */
/* A visitor id is a hash of (daily random salt + IP + user agent);     */
/* salts older than today are deleted, so visitors can't be followed    */
/* across days and the raw IP is never written anywhere.                */
/* ------------------------------------------------------------------ */
const EVENT_NAMES = new Set(['pageview', 'studio_view', 'logo_upload', 'placement_add', 'finish_embroidery', 'view_3d', 'quote_open', 'quote_submit', 'contact_submit']);
const today = () => new Date().toISOString().slice(0, 10);

function dailySalt() {
  const day = today();
  let salt = getMeta('salt:' + day);
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
    db.prepare("DELETE FROM meta WHERE key LIKE 'salt:%'").run();
    setMeta('salt:' + day, salt);
  }
  return salt;
}

const insertEvent = db.prepare('INSERT INTO events (day, ts, name, visitor, ref, path) VALUES (?, ?, ?, ?, ?, ?)');
function recordEvent({ name, ip, ua, ref, pagePath }) {
  if (!EVENT_NAMES.has(name)) return false;
  const visitor = crypto.createHash('sha256').update(dailySalt() + '|' + ip + '|' + ua).digest('hex').slice(0, 16);
  insertEvent.run(today(), Date.now(), name, visitor, ref || null, pagePath || null);
  return true;
}

/** Funnel + traffic summary for the admin dashboard */
function analyticsSummary(days = 30) {
  days = Math.max(1, Math.min(365, days | 0));
  const from = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
  // "unique visits": distinct (day, visitor) pairs per event
  const counts = {};
  db.prepare('SELECT name, COUNT(DISTINCT day || visitor) AS n FROM events WHERE day >= ? GROUP BY name').all(from)
    .forEach(r => { counts[r.name] = r.n; });
  const daily = db.prepare("SELECT day, COUNT(DISTINCT visitor) AS n FROM events WHERE day >= ? AND name = 'pageview' GROUP BY day ORDER BY day").all(from);
  const referrers = db.prepare("SELECT ref, COUNT(DISTINCT day || visitor) AS n FROM events WHERE day >= ? AND name = 'pageview' AND ref IS NOT NULL AND ref != '' GROUP BY ref ORDER BY n DESC LIMIT 6").all(from);
  return { days, from, counts, daily, referrers };
}

module.exports = {
  DATA_DIR, UPLOAD_DIR, DB_PATH, DATA_DIR_IS_FALLBACK,
  listLeads, getLead, insertLead, updateLead, deleteLead, countLeads,
  recordEvent, analyticsSummary
};
