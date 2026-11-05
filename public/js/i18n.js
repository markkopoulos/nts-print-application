/**
 * Tiny EL / EN translation layer (no dependencies).
 *
 * - The HTML itself holds the GREEK copy (default language + good for crawlers / no-JS).
 *   On first run we capture that Greek text, so only the ENGLISH copy lives in EN below.
 * - Strings that only exist in JavaScript (toasts, errors, summaries…) are listed with
 *   both languages in EL (Greek) and EN (English).
 *
 * Markup hooks
 *   data-i18n="key"                 -> textContent
 *   data-i18n-html="key"            -> innerHTML (for copy that contains <em>, <a>, <b>…)
 *   data-i18n-attr="attr:key;…"     -> attributes (placeholder, aria-label, title, alt, content)
 *   data-i18n-cat="garments.hoodie.name"           -> value taken from window.CATALOG
 *   data-i18n-cat-attr="title:colors.0.name;…"      -> same, for attributes
 */
(function () {
  const STORAGE_KEY = 'nts-lang';
  const LANGS = ['el', 'en'];

  /* ------------------------------ English copy ------------------------------ */
  const EN = {
    /* meta */
    'meta.title': 'NtsPrints | Custom Clothing, DTF Printing & Embroidery',
    'meta.desc': 'Custom clothing, DTF printing and embroidery for brands, businesses, teams, schools and organizations. Preview your design on the garment in our Mockup Studio and request a quote.',
    'meta.ogDesc': 'We print your vision. Custom clothing, DTF printing & embroidery.',

    /* header / nav */
    'top.tag': 'Custom clothing & printing studio',
    'nav.aria': 'Main navigation',
    'nav.home': 'Home',
    'nav.menu': 'Menu',
    'nav.services': 'Services',
    'nav.studio': 'Mockup Studio',
    'nav.work': 'Our Work',
    'nav.about': 'About',
    'nav.faq': 'FAQ',
    'nav.contact': 'Contact',
    'cta.quote': 'Get a Quote',

    /* hero */
    'hero.eyebrow': 'Custom clothing & printing studio',
    'hero.h1': 'We print <em>your vision.</em>',
    'hero.lead': 'Custom clothing, DTF printing & embroidery for brands, businesses, teams and organizations. Upload your logo, preview it live on the garment, and tell us what you need.',
    'hero.work': 'View Our Work',
    'hero.s1': 'working days for most orders',
    'hero.s2': 'pieces for the best-value embroidery',
    'hero.s3': 'production methods, chosen to suit your fabric',
    'hero.garmentAria': 'Garment type',
    'hero.3dAria': 'Rotatable 3D garment',
    'hero.colorAria': 'Colour',
    'hero.drag': 'Drag to rotate',
    'hero.b1t': 'DTF Printing',
    'hero.b1s': 'high detail, durable',
    'hero.b2t': 'Embroidery',
    'hero.b2s': 'lasts wash after wash',

    /* marquee (same names as services) */
    'marq.screen': 'Screen Printing',
    'marq.heat': 'Heat Transfer',
    'marq.sub': 'Sublimation',

    /* services */
    'svc.eyebrow': 'Services',
    'svc.h2': 'What we do',
    'svc.p': 'Six ways to get your design onto real garments, from a single sample to a full production run.',
    'svc.dtf.t': 'DTF Printing',
    'svc.dtf.d': 'High-quality custom prints with excellent detail and durability, on almost any fabric.',
    'svc.emb.t': 'Embroidery',
    'svc.emb.d': 'Premium embroidery for a professional, timeless finish that holds up wash after wash.',
    'svc.print.t': 'Custom Printing',
    'svc.print.d': 'Custom designs and prints tailored to your brand, your event, or your project.',
    'svc.biz.t': 'Business Clothing',
    'svc.biz.d': 'Branded workwear and staff clothing that looks consistent across every team member.',
    'svc.sport.t': 'Sports & Teams',
    'svc.sport.d': 'Custom uniforms and kit for sports teams and clubs, sized for a full roster.',
    'svc.school.t': 'Schools & Organizations',
    'svc.school.d': 'Bulk custom clothing for schools, organizations and community groups.',

    /* studio */
    'studio.eyebrow': 'Mockup Studio',
    'studio.h2': 'See your design on the garment, live.',
    'studio.p': 'Upload your logo, choose a garment and colour, drag your design into place and rotate it in 3D. Happy with it? Send it to us as a quote request.',
    'studio.viewAria': 'View',
    'studio.dragTitle': 'Drag to move',
    'studio.logoAlt': 'Your logo',
    'studio.printArea': 'Print area',
    'studio.hint2d': 'Drag the logo to move it',
    'studio.hint3d': 'Drag to rotate the garment',
    'studio.s1': 'Garment',
    'studio.s2': 'Garment colour',
    'studio.s3': 'Your logo',
    'studio.drop': 'Upload or drag your logo here',
    'studio.dropSmall': 'PNG, JPG, SVG, WebP · up to 10MB',
    'studio.or': 'or try a sample:',
    'studio.sample1': 'Sample logo 1',
    'studio.sample2': 'Sample logo 2',
    'studio.sample3': 'Sample emblem',
    'studio.knock': 'Remove white background',
    'studio.removed': '· removed',
    'studio.noBg': '· no background found',
    'studio.s4': 'Position & size',
    'studio.smaller': 'Smaller',
    'studio.larger': 'Larger',
    'studio.sizeAria': 'Logo size',
    'studio.center': 'Centre',
    'studio.chest': 'Chest',
    'studio.big': 'Large print',
    'studio.reset': 'Reset',
    'studio.quote': 'Request a quote with this design',
    'studio.download': 'Download mockup (PNG)',
    'studio.t3d': 'Rotate the garment in 3D',
    'studio.no3d': '3D view is available for T-shirt, Hoodie and Sweatshirt',
    'studio.sideAria': 'Side',
    'studio.front': 'Front',
    'studio.back': 'Back',
    'studio.sPos': 'Print positions',
    'studio.posHelp': 'Add as many positions as you like. Each one has its own logo, size and placement.',
    'studio.forPos': 'for:',
    'studio.sFinish': 'Technique',
    'studio.print': 'Print (DTF)',
    'studio.embroidery': 'Embroidery',
    'studio.embNote': 'Embroidery preview: colours are reduced to up to 8 threads and fine details get bolder — the way it will come out on fabric. For very small lettering we recommend print.',
    'studio.removePos': 'Remove this position',
    'studio.badFile': 'Please upload a PNG, JPG, SVG or WebP image.',
    'studio.tooBig': 'The file is larger than 10MB.',

    /* work */
    'work.eyebrow': 'Our Work',
    'work.h2': 'A selection of projects created by NtsPrints.',
    'work.filterAria': 'Filter',
    'work.all': 'All',
    'work.business': 'Business',
    'work.sports': 'Sports',
    'work.schools': 'Schools',
    'work.events': 'Events',
    'work.fashion': 'Fashion',
    'work.custom': 'Custom',
    'work.w1t': 'Graduation Hoodies',
    'work.w1d': 'Bulk hoodies with a DTF print',
    'work.w2t': 'Branded Caps',
    'work.w2d': 'Embroidered logo',
    'work.w3t': 'Event Merch',
    'work.w3d': 'Custom-printed tees for events',
    'work.w4t': 'Team Sweatshirts',
    'work.w4d': 'Full-colour DTF print',
    'work.w5t': 'Capsule Collection',
    'work.w5d': 'For independent brands',
    'work.w6t': 'One-off Pieces',
    'work.w6d': 'From a single sample upward',
    'work.note': '* Illustrative images — to be replaced with photos from real productions.',

    /* process */
    'proc.eyebrow': 'How it works',
    'proc.h2': 'From idea to finished garment in 4 steps.',
    'proc.1t': 'Contact us',
    'proc.1d': 'Tell us what you need — clothing type, quantity and rough timing.',
    'proc.2t': 'Send your design',
    'proc.2d': 'Send your logo, artwork or idea. No file yet? We can create one.',
    'proc.3t': 'We produce',
    'proc.3d': 'We print or embroider your order in-house, and check it before packing.',
    'proc.4t': 'Delivery',
    'proc.4d': 'Your order is finished and delivered, ready to wear or hand out.',

    /* about */
    'about.eyebrow': 'About us',
    'about.h2': 'A custom clothing and printing studio.',
    'about.p1': 'NtsPrints is a custom clothing and printing studio. We work directly with businesses, schools, sports clubs, teams, organizations, events and independent brands — turning a logo, a concept or a rough idea into finished garments.',
    'about.p2': 'Every order runs through DTF printing, embroidery, screen printing, heat transfer or sublimation, chosen for what actually suits the fabric and the quantity — not a one-size-fits-all process. From a single sample to a full production run, the same attention goes into each piece.',
    'about.t1': 'A method chosen for your fabric and quantity',
    'about.t2': 'Samples or small pre-production runs available',
    'about.t3': 'Original artwork if you don’t have a file yet',
    'why.h': 'Why choose NtsPrints?',
    'why.1t': 'Premium quality',
    'why.1d': 'Materials and finishing checked before anything ships.',
    'why.2t': 'Fast communication',
    'why.2d': 'A real answer to your message, usually within the day.',
    'why.3t': 'B2B & bulk orders',
    'why.3d': 'From a five-piece sample run to a full seasonal order.',
    'why.4t': 'Attention to detail',
    'why.4d': 'Placement, colour matching and finish checked by hand.',

    /* CTA band */
    'band.h2': 'Ready to create something?',
    'band.p': 'Tell us what you have in mind and let’s turn your idea into custom clothing.',

    /* FAQ */
    'faq.eyebrow': 'FAQ',
    'faq.h2': 'Frequently asked questions',
    'faq.1q': 'What is the minimum order quantity?',
    'faq.1a': 'It depends on the method. DTF and custom printing work well for both small and large runs, while embroidery is most cost-effective from around a dozen pieces upward. Tell us your quantity and we’ll confirm what’s possible.',
    'faq.2q': 'Do you print logos?',
    'faq.2a': 'Yes — send us your logo file (vector formats like .ai, .eps or .svg print best) and we’ll prepare it for DTF, embroidery or screen printing.',
    'faq.3q': 'Can you create a design from scratch?',
    'faq.3a': 'Yes. If you don’t have a finished design, describe what you have in mind and our team will put together original artwork or a logo for your project.',
    'faq.4q': 'Do you offer embroidery?',
    'faq.4a': 'Yes, alongside DTF, screen printing, custom printing and sublimation. We’ll recommend the best method for your fabric and budget.',
    'faq.5q': 'How long does an order take?',
    'faq.5a': 'Most orders are ready within 5–10 working days depending on quantity and method. Larger bulk orders may take a little longer — we’ll give you a clear timeline when you request a quote.',
    'faq.6q': 'Do you work with businesses?',
    'faq.6a': 'Yes, B2B orders are a core part of what we do — branded staff clothing, uniforms, corporate gifts and repeat seasonal orders.',
    'faq.7q': 'Do you work with sports teams and schools?',
    'faq.7a': 'Yes, we regularly produce kits for sports clubs and bulk clothing runs for schools and student organizations.',
    'faq.8q': 'Can I order samples?',
    'faq.8a': 'Yes, we can produce a sample or small pre-production run before committing to a full order, especially for larger quantities.',
    'faq.9q': 'How do I get a quote?',
    'faq.9a': 'Press “Get a Quote” or fill in the contact form below with what you need, your quantity and preferred printing method, and we’ll get back to you with pricing and timing.',

    /* contact */
    'contact.eyebrow': 'Contact',
    'contact.h2': 'Get a quote',
    'contact.p': 'Fill in the form and tell us what you have in mind — quantity, method, deadline if you have one. We reply to every request.',
    'contact.formH': 'Your request',
    'f.name': 'Full name *',
    'f.company': 'Company / organization',
    'f.email': 'Email *',
    'f.phone': 'Phone',
    'f.method': 'Printing method',
    'f.choose': 'Choose…',
    'f.qty': 'Quantity (approx.)',
    'f.qtyPh': 'e.g. 50 pieces',
    'f.need': 'What do you need? *',
    'f.needPh': 'e.g. 30 black t-shirts with a white logo on the front and a name on the back.',
    'f.attach': 'Attach your logo or design',
    'f.attachSmall': 'JPG, PNG, PDF, SVG, AI, EPS up to 10MB (optional)',
    'f.consent': 'I agree to the processing of my information for communication regarding my request. See our <a href="https://www.nts-prints.gr/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>. *',
    'f.send': 'Send Request',
    'contact.emailLbl': 'Email',
    'contact.igLbl': 'Instagram',

    /* footer */
    'ftr.about': 'A custom clothing and printing studio working with businesses, schools, clubs and teams — from a single sample to a full production run.',
    'ftr.nav': 'Navigation',
    'ftr.services': 'Services',
    'ftr.contact': 'Contact',
    'ftr.rights': 'NtsPrints. All rights reserved.',
    'ftr.privacy': 'Privacy Policy',
    'ftr.terms': 'Terms',

    /* quote modal */
    'q.close': 'Close',
    'q.eyebrow': 'Get a Quote',
    'q.mockupAlt': 'Your mockup',
    'q.edit': '← Edit in Mockup Studio',
    'q.sGarment': 'Garment',
    'q.sColor': 'Colour',
    'q.sPos': 'Positions',
    'q.sTech': 'Method',
    'q.sTotal': 'Total',
    'q.h1': 'Product & colour',
    'q.h2': 'Logo positions',
    'q.help': 'Choose where you want printing or embroidery and, if you like, upload a different file for each position.',
    'q.small': 'JPG, PNG, PDF, SVG, AI, EPS up to 10MB each.',
    'q.h3': 'Sizes & quantities',
    'q.total': 'Total:',
    'q.pieces': 'pieces',
    'q.h4': 'Printing method',
    'q.h5': 'Your details',
    'q.notes': 'Notes',
    'q.notesPh': 'e.g. embroidery on the chest, print on the back, neck label, the date you need it by…',
    'q.company': 'Company / brand',
    'q.foot': 'We reply to every request, usually within the day.',
    'q.thanks': 'Thank you!',
    'q.doneA': 'We’ve received your request, reference',
    'q.doneB': 'We’ll get back to you with pricing and timing.',
    'q.fromStudio': 'From the Mockup Studio',
    'q.upload': 'Upload a file',
    'q.removeFile': 'Remove file',
    'q.otherPh': 'Where? e.g. side, collar, pocket',
    'q.qtyAria': 'Quantity',
    'q.pcs': 'pcs',

    /* theme + admin login */
    'theme.aria': 'Toggle dark mode',
    'login.aria': 'Admin login',
    'login.dash': 'Open the admin dashboard',
    'login.title': 'Admin login',
    'login.p': 'Sign in to see quote requests and contact form messages.',
    'login.user': 'Username',
    'login.pass': 'Password',
    'login.submit': 'Sign in',
    'err.login': 'Invalid username or password.',
    'err.loginRate': 'Too many failed attempts. Try again in 15 minutes.',
    'err.loginFields': 'Enter your username and password.',

    /* JS-only messages */
    'err.pos': 'Choose at least one position.',
    'err.sizes': 'Enter a quantity for at least one size.',
    'err.required': 'Required field.',
    'err.email': 'Enter a valid email address.',
    'err.consent': 'Please accept to continue.',
    'err.rate': 'Too many requests. Please try again in a few minutes.',
    'err.invalid': 'Please check your details and try again.',
    'err.generic': 'Something went wrong. Please try again.',
    'err.contactRequired': 'Please fill in the required fields (*) and accept the privacy policy.',
    'ok.contact': 'Thank you! We received your message (#{id}) and will reply as soon as possible.'
  };

  /* Greek strings that exist only in JavaScript (everything else is captured from the HTML) */
  const EL = {
    'studio.noBg': '· δεν βρέθηκε φόντο',
    'studio.removed': '· αφαιρέθηκε',
    'studio.t3d': 'Περιστρέψτε το ρούχο σε 3D',
    'studio.no3d': 'Η 3D προβολή είναι διαθέσιμη για T-shirt, Hoodie και Φούτερ',
    'studio.badFile': 'Ανεβάστε εικόνα PNG, JPG, SVG ή WebP.',
    'studio.tooBig': 'Το αρχείο ξεπερνά τα 10MB.',
    'q.fromStudio': 'Από το Mockup Studio',
    'q.upload': 'Ανεβάστε αρχείο',
    'q.removeFile': 'Αφαίρεση αρχείου',
    'q.otherPh': 'Πού; π.χ. πλάι, γιακάς, τσέπη',
    'q.qtyAria': 'Ποσότητα',
    'q.pcs': 'τεμ.',
    'login.dash': 'Άνοιγμα πίνακα ελέγχου',
    'err.login': 'Λάθος όνομα χρήστη ή κωδικός.',
    'err.loginRate': 'Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε ξανά σε 15 λεπτά.',
    'err.loginFields': 'Συμπληρώστε όνομα χρήστη και κωδικό.',
    'err.pos': 'Επιλέξτε τουλάχιστον μία θέση.',
    'err.sizes': 'Συμπληρώστε ποσότητα σε τουλάχιστον ένα μέγεθος.',
    'err.required': 'Υποχρεωτικό πεδίο.',
    'err.email': 'Συμπληρώστε έγκυρο email.',
    'err.consent': 'Απαιτείται αποδοχή.',
    'err.rate': 'Πολλά αιτήματα. Δοκιμάστε ξανά σε λίγα λεπτά.',
    'err.invalid': 'Ελέγξτε τα στοιχεία σας και δοκιμάστε ξανά.',
    'err.generic': 'Κάτι πήγε στραβά. Δοκιμάστε ξανά.',
    'err.contactRequired': 'Συμπληρώστε τα υποχρεωτικά πεδία (*) και αποδεχτείτε την πολιτική απορρήτου.',
    'ok.contact': 'Ευχαριστούμε! Λάβαμε το μήνυμά σας (#{id}) και θα απαντήσουμε το συντομότερο.'
  };

  let lang = 'el';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) lang = saved;
  } catch (e) { /* storage unavailable */ }

  const listeners = [];

  function tr(key) {
    const primary = lang === 'en' ? EN[key] : EL[key];
    if (primary != null) return primary;
    return EL[key] != null ? EL[key] : (EN[key] != null ? EN[key] : key);
  }

  function t(key, vars) {
    let s = tr(key);
    if (vars) Object.keys(vars).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }

  function pick(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] != null ? obj[lang] : obj.el;
  }

  function fromCatalog(path) {
    const root = window.CATALOG;
    if (!root) return '';
    const node = path.split('.').reduce((o, k) => (o == null ? o : o[k]), root);
    return pick(node);
  }

  function parsePairs(spec) {
    return spec.split(';').map(s => s.trim()).filter(Boolean).map(s => {
      const i = s.indexOf(':');
      return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    });
  }

  function apply(root) {
    root = root || document;
    const q = sel => [...(root.matches && root.matches(sel) ? [root] : []), ...root.querySelectorAll(sel)];

    q('[data-i18n]').forEach(el => {
      const k = el.dataset.i18n;
      if (!(k in EL)) EL[k] = el.textContent;
      el.textContent = tr(k);
    });
    q('[data-i18n-html]').forEach(el => {
      const k = el.dataset.i18nHtml;
      if (!(k in EL)) EL[k] = el.innerHTML;
      el.innerHTML = tr(k);
    });
    q('[data-i18n-attr]').forEach(el => {
      parsePairs(el.dataset.i18nAttr).forEach(([attr, k]) => {
        if (!(k in EL)) EL[k] = el.getAttribute(attr) || '';
        el.setAttribute(attr, tr(k));
      });
    });
    q('[data-i18n-cat]').forEach(el => { el.textContent = fromCatalog(el.dataset.i18nCat); });
    q('[data-i18n-cat-attr]').forEach(el => {
      parsePairs(el.dataset.i18nCatAttr).forEach(([attr, path]) => el.setAttribute(attr, fromCatalog(path)));
    });
  }

  function syncToggle() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang]').forEach(b => {
      const on = b.dataset.lang === lang;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on);
    });
  }

  function setLang(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
    const swap = () => { apply(); syncToggle(); listeners.forEach(fn => fn(lang)); };
    // smooth crossfade of the whole page where View Transitions are supported
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !calm) document.startViewTransition(swap);
    else swap();
  }

  window.I18N = {
    t, pick,
    get lang() { return lang; },
    apply, setLang,
    onChange: fn => listeners.push(fn)
  };

  /* Capture the Greek copy first (while the DOM still holds it), then show the saved language */
  const saved = lang;
  lang = 'el';
  apply();
  lang = saved;
  if (lang !== 'el') apply();
  syncToggle();

  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
})();
