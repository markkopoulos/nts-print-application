# Handover prompt — NtsPrints web app

Paste everything below the line into a new Claude Code chat (with the repo `markkopoulos/nts-print-application` attached).

---

You're continuing work on **NtsPrints**, the website + Mockup Studio + quote system for a Greek custom clothing & printing studio (DTF printing, embroidery, screen printing). The owner is Panayiotis (agency: dfrnt.). He writes casually in English; the site's default language is Greek. Read this whole brief before touching code.

## Where things stand

- **Repo:** `markkopoulos/nts-print-application` (public). Ignore the older private copy `markkopoulos/nts-print`; it's stale.
- **Hosting:** Hostinger Node.js web app, connected to GitHub, **auto-deploys every push to `main`**. Preview URL: `silver-penguin-567689.hostingersite.com`. Framework preset Express, entry `server.js`, npm, Node **24.x**. The domain `nts-prints.gr` still points to the old site; don't connect it until the owner says so.
- **Merged to `main`:** PR #1 (rebrand + Greek/English copy from nts-prints.gr) and PR #2 (dark mode, admin login, anime.js motion, rebuilt 3D garments, garment-picker fix).
- **Pushed but NOT merged yet:** commit `e335aff` on branch `claude/nice-wozniak-74blkz`. It contains:
  1. SQLite storage outside the app folder
  2. cookieless analytics + admin funnel
  3. front / left chest / back / sleeve print positions
  4. embroidery look
  
  It's tested locally. **First task: ask the owner whether to open the PR and merge it** (merging deploys live). If that branch's PR was merged already, restart the branch from `main` for new work.
- **Environment variables on Hostinger:**
  - `ADMIN_USER`, `ADMIN_PASSWORD`: admin login. The password falls back to `ADMIN_PIN`, then to `1234`. Confirm the owner set them.
  - `DATA_DIR` (optional): where the database and uploads live. Defaults to `~/ntsprints-data`.

## Architecture (no build step, plain files)

- `server.js`: Express server. Routes:
  - public: `POST /api/leads`, `POST /api/e` (analytics beacon)
  - admin: `/api/admin/login|logout|session|system`, `/api/leads`, `/api/stats`, `/api/analytics`
  - `/uploads` is admin-only
  
  Admin sessions are HttpOnly SameSite=Strict cookies held in memory (12h); failed logins are limited to 10 per 15 min.
- `db.js`: built-in `node:sqlite` (**needs Node ≥ 22.13**). Tables `leads`, `events`, `meta`.
  - Data lives in `DATA_DIR`. If that folder isn't writable it falls back to `./data`, logs a warning, and the admin footer shows it.
  - Runs a one-time import of legacy `data/leads.json` + `data/uploads/`. The 3 leads in that file are sample data.
  - Analytics visitor = sha256(daily salt + IP + user agent). No IPs are stored; bots and logged-in admins are skipped.
- `public/index.html`: the whole public site in one page: hero with a 3D garment, services, Mockup Studio, work, process, about, FAQ, contact, a quote modal and a login modal.
- `public/admin.html` + `js/admin.js` + `css/admin.css`: the dashboard. It has KPIs, a 30-day submissions chart, the traffic funnel, a leads table (status, delete, mockup viewer, CSV export) and dark mode.
- `public/js/`:
  - `catalog.js`: garments, colours, print positions (`placements` per garment, `placementInfo`), techniques. Every label is `{ el, en }`. **Quote requests are always saved with the Greek (`el`) values**, so the admin stays consistent.
  - `i18n.js`: EL/EN switcher. Greek text lives in the HTML and is captured on load; English goes in the `EN` dictionary. Markup hooks: `data-i18n`, `data-i18n-html`, `data-i18n-attr="attr:key"`, `data-i18n-cat="path.in.catalog"`. JS-only Greek strings go in the `EL` dictionary.
  - `studio.js`: 2D/3D studio with per-position state (logo, x/y/scale), front/back artwork, print/embroidery finish, front+back mockup export (`snapshot`), and `getPrints()` for the quote form.
  - `garment3d.js`: procedural Three.js garments (torso, sleeves, rib cuffs, hood, pocket, cap) and a print-decal system (`setPrint(key, {...})`, `focus('front'|'back'|'sleeve')`, plus the old `setLogo` used by the hero).
  - `embroidery.js`: canvas conversion of a logo into an embroidery look (≤8 thread colours, satin border, tatami fill, height map).
  - `quote.js`: quote modal + contact form. Pre-fills positions, per-position files and technique from the studio.
  - `animations.js`: anime.js hero, scroll reveals, micro-interactions. Disabled for reduced motion.
  - `analytics.js`, `login.js`, `theme.js` (dark mode, follows the OS), `main.js` (wires everything).
- `public/vendor/`: Three.js r169 and anime.js 4.5.0, vendored with no CDN.
- `public/assets/apparel/`: front SVGs plus generated `*-back.svg` (no back view for the cap).
- Design: indigo `#2c3192` and yellow `#f4cf1d`, Geologica font. Dark palette from `color-palette.txt` (`#080C14` / `#111A2E` / `#F1F5F9`). Colours are CSS tokens, so use tokens, not raw hex.

## Content rules the owner agreed to

- **Real facts only.** Copy comes from nts-prints.gr: 5–10 working days for most orders, embroidery best value from ~12 pieces, a reply usually within the day, `info.ntsprints@gmail.com`, Instagram `@ntsp.rintsofficial`.
- **Don't invent** stats, testimonials, phone numbers, addresses or client names. Portfolio images are labelled illustrative until real photos arrive.
- **Every visible string needs both Greek and English.**

## How to test (things that bit before)

- **Run locally:**

  ```bash
  DATA_DIR=<scratch dir> ADMIN_PASSWORD=test PORT=3111 node server.js
  ```

  Stop it with `pkill -x node`. **Never** use `pkill -f "node server.js"`: it matches and kills your own shell.
- **Browser:** Playwright with the preinstalled Chromium. For WebGL launch with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. Software rendering is slow, so animations finish late; wait for end states rather than using fixed timeouts.
- **Analytics** ignore headless user agents. Set a normal Chrome UA in tests that check analytics.
- `isVisible()` treats `opacity:0` as visible, so check computed opacity for the mobile menu.
- **Isolated 3D/component checks:** serve a harness page through `page.route('**/__x.html', …)` and import the real modules from the local server.
- **anime.js v4:** always give explicit `{ from, to }` values. A bare `from` sometimes resolved its end state to 0.
- **`garment3d.js` `gridGeometry(..., flip)`:** grids laid out left→right and bottom→top need `flip = true`, otherwise they face inward and get culled.
- **Shell:** complex heredocs sometimes trip a false "rm" safety check. Write scripts to a file and run them instead.
- **Before shipping,** test both languages, light and dark, and 390px mobile (no horizontal overflow), and check for zero console errors.
- **Ship:** commit to the session branch, then ask before PR/merge, because merging means live.

## Open items / ideas the owner liked (not built yet)

1. **Merge `e335aff`**, then verify on Hostinger that data survives a redeploy: send a test quote, redeploy, check it's still there, and check the admin footer path has no red warning.
2. **Email alerts:** email the shop on every new request (with the mockup) and send the customer an auto-reply. Needs the owner's choice: a Gmail app password for `info.ntsprints@gmail.com` (nodemailer) or a service like Resend.
3. **Instant price estimate** in the quote form, from a price table editable in admin. Needs the owner's price list.
4. **Team names and numbers** plus roster upload for sports clubs and schools.
5. **WhatsApp/Viber button;** shareable mockup link for approvals.
6. **Quote → PDF offer from admin,** online acceptance, order pipeline, repeat orders.
7. **SEO:** per-service/audience pages (EL/EN), schema.org LocalBusiness, social preview image, Google Business Profile.
8. **Real portfolio photos and testimonials** when the owner provides them. Connect `nts-prints.gr` when approved.
9. **Housekeeping:** once the import is confirmed on the live server, untrack `data/leads.json` (sample data in a public repo). Consider making the repo private.
