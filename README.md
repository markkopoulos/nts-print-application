# NtsPrints — Custom Apparel Brand Showcase, 3D Mockup Studio & Quote System

Κομψή, επαγγελματική web εφαρμογή / ιστοσελίδα για custom apparel brand (ρούχα με δικό σας λογότυπο, μεταξοτυπία & κέντημα), εμπνευσμένη από το design system & τη stepped φόρμα προσφορών του impressink.gr, με υποστήριξη 3D διαδραστικού ρούχου και Admin Panel.

---

## 🌐 Γλώσσες (EL / EN)

- Η σελίδα είναι δίγλωσση με διακόπτη **EL | EN** στην κεφαλίδα· η επιλογή αποθηκεύεται στον browser (`localStorage`, κλειδί `nts-lang`).
- Τα ελληνικά κείμενα βρίσκονται απευθείας στο `public/index.html` (προεπιλογή και καλύτερο για SEO)· τα αγγλικά στο λεξικό `EN` του `public/js/i18n.js`. Κάθε στοιχείο έχει `data-i18n="κλειδί"` (ή `data-i18n-html` / `data-i18n-attr`).
- Ονόματα ρούχων, χρωμάτων, θέσεων και μεθόδων είναι δίγλωσσα στο `public/js/catalog.js`. Τα αιτήματα αποθηκεύονται **πάντα στα ελληνικά**, ώστε το Admin Panel να είναι ενιαίο.
- Τα κείμενα βασίζονται στο https://www.nts-prints.gr/ (επικοινωνία: info.ntsprints@gmail.com · Instagram @ntsp.rintsofficial).

---

## 🎨 Σχεδιασμός & Τεχνολογίες

- **Design System & Παλέτα**: Βαθύ indigo (`#2c3192`, `#1f2372`), απαλό background (`#f6f7fc`, `#ffffff`), warm yellow accent (`#f4cf1d`), και καθαρή typography.
- **Γραμματοσειρά**: **Geologica** (Google Font) με fallback σε **CF Asty Pro** / sans-serif.
- **3D Interactive Engine (Three.js)**: Procedural 3D ρούχα (T-shirt, Φούτερ, Hoodie **και Καπέλο**) φτιαγμένα από κομμάτια: κορμός με ώμους & λαιμόκοψη, ξεχωριστά μανίκια με ριπ μανσέτες, κουκούλα με κορδόνια, τσέπη καγκουρό, 6-panel καπέλο με γείσο. Studio φωτισμός (PMREM environment + soft shadows), Neutral tone mapping για σωστά χρώματα, το logo «κάθεται» πάνω στην καμπύλη του υφάσματος.
- **Animations (anime.js v4)**: Είσοδος hero (λέξη-λέξη τίτλος, μετρητές), scroll reveals, micro-interactions (αλλαγή ρούχου/χρώματος, φόρμα προσφοράς, FAQ). Απενεργοποιούνται αυτόματα για χρήστες με «μειωμένη κίνηση».
- **Dark mode**: Ακολουθεί το σύστημα του επισκέπτη, με κουμπί εναλλαγής (☾/☀) στην κεφαλίδα· η επιλογή αποθηκεύεται. Ισχύει και για το Admin Panel.
- **2D/3D Mockup Studio**:
  - Live εναλλαγή μεταξύ 2D artwork και 3D διαδραστικού μοντέλου.
  - Επιλογή ρούχων (Oversized Hoodie 450gsm, Heavyweight T-Shirt 240gsm, Crewneck Φούτερ 380gsm, 6-Panel Dad Cap).
  - Επιλογή χρωμάτων σε πραγματικό χρόνο (Μαύρο, Λευκό, Navy, Royal, Γκρι Melange, Sand, Olive, Κίτρινο, Κόκκινο).
  - Drag & Drop ανεβάσματος λογοτύπου (PNG, JPG, SVG, WebP) με **αυτόματη αφαίρεση λευκού φόντου** (background knockout).
  - Ελεύθερη μετακίνηση (drag) του logo πάνω στην περιοχή τυπώματος, slider μεγέθους, presets (Κέντρο, Στήθος, Μεγάλο τύπωμα).
  - Άμεση λήψη του mockup σε PNG υψηλής ανάλυσης.
- **Stepped Φόρμα Προσφοράς (Quote Modal)**:
  - Εμπνευσμένη από το impressink.gr:
    1. Επιλογή Ρούχου & Χρώματος με live preview του mockup.
    2. Επιλογή Θέσεων Τυπώματος (Μπροστά, Πίσω, Στήθος, Μανίκι, Άλλο σημείο) με δυνατότητα ανεβάσματος διαφορετικού αρχείου για κάθε θέση.
    3. Αναλυτική κατανομή μεγεθών & ποσοτήτων (XS, S, M, L, XL, XXL, 3XL) με αυτόματο υπολογισμό συνόλου.
    4. Επιλογή τεχνικής (Μεταξοτυπία, Κέντημα, DTF, Συμβουλή).
    5. Στοιχεία επικοινωνίας & σημειώσεις παραγγελίας.
- **Admin Panel (`/admin`)**:
  - Κουμπί **σύνδεσης** (εικονίδιο χρήστη) στην κεφαλίδα της σελίδας → όνομα χρήστη & κωδικός → Admin Panel.
  - Ασφαλής σύνδεση με session cookie (HttpOnly, SameSite=Strict, 12 ώρες), όριο 10 αποτυχημένων προσπαθειών / 15 λεπτά.
  - Τα αρχεία πελατών (`/uploads`) είναι ορατά μόνο σε συνδεδεμένο διαχειριστή.
  - Πίνακας στατιστικών: Συνολικά αιτήματα, Προσφορές, Νέα σε εκκρεμότητα, Συνολικά τεμάχια προς παραγωγή.
  - Γράφημα υποβολών φορμών ανά ημέρα (τελευταίες 30 ημέρες, προσφορές vs μηνύματα) + προβολή ως πίνακας.
  - Φίλτρα: Όλα, Προσφορές, Επικοινωνία, Νέα.
  - Επιθεώρηση του mockup σε πλήρη ανάλυση + λήψη PNG + απευθείας download των συνημμένων αρχείων του πελάτη (vector/PDF/PNG).
  - Ενημέρωση κατάστασης (Νέο, Σε εξέλιξη, Ολοκληρώθηκε).
  - Εξαγωγή σε αρχείο CSV με ελληνική κωδικοποίηση (UTF-8 BOM για άνοιγμα σε Excel/Numbers).
- **Zero-Config Database**:
  - Αποθήκευση σε `data/leads.json` και αρχεία σε `data/uploads/`.
  - Δεν απαιτείται MySQL ή PostgreSQL — έτοιμο να τρέξει άμεσα παντού.

---

## 💻 Εκτέλεση Τοπικά

```bash
# 1. Εγκατάσταση εξαρτήσεων
npm install

# 2. Εκκίνηση
npm start
```

Ανοίξτε στον browser:
- Κεντρική Σελίδα & Mockup Studio: `http://localhost:3000`
- Admin Panel: `http://localhost:3000/admin`

### 🔐 Στοιχεία σύνδεσης διαχειριστή (environment variables)

| Μεταβλητή | Περιγραφή | Προεπιλογή |
|---|---|---|
| `ADMIN_USER` | Όνομα χρήστη | `admin` |
| `ADMIN_PASSWORD` | Κωδικός | τιμή του `ADMIN_PIN`, αλλιώς `1234` |

Στο Hostinger: **Websites → (site) → Environment Variables → Add**, μετά **Redeploy**. Ορίστε οπωσδήποτε δικό σας `ADMIN_PASSWORD`· αν λείπει, ο server γράφει προειδοποίηση στα logs.

---

## 🌐 Ανέβασμα στο Hostinger (Deployment)

1. **Hostinger hPanel**:
   - Μεταβείτε στα **Websites** -> επιλέξτε το domain.
   - Στην αναζήτηση επιλέξτε **Node.js**.
2. **Δημιουργία Node.js App**:
   - Έκδοση Node.js: **18.x, 20.x, ή 22.x**
   - Application root: `public_html` (ή ο φάκελος επιλογής σας).
   - Startup file: `server.js`
3. **Ανέβασμα Αρχείου**:
   - Ανεβάστε το αρχείο `custom-brand-mockup-app.zip` στον File Manager και πατήστε **Extract**.
4. **Εγκατάσταση & Εκκίνηση**:
   - Πατήστε **Run NPM Install** (χρειάζεται μόνο το Express).
   - Πατήστε **Start / Restart**.

---

## 📁 Δομή Αρχείων

```
clothes/
├── package.json          # Express dependency & npm scripts
├── server.js             # Express API Server, static files & uploads
├── data/
│   ├── leads.json        # Αποθηκευμένα leads & quotes
│   └── uploads/          # Αποθηκευμένα mockups & συνημμένα αρχεία
├── public/
│   ├── index.html        # Κεντρική σελίδα, Hero 3D, Mockup Studio, Quote Modal
│   ├── admin.html        # Admin Dashboard
│   ├── css/
│   │   ├── styles.css    # Κεντρικό styling (Geologica font & impressink palette)
│   │   └── admin.css     # Styling πίνακα διαχείρισης
│   ├── js/
│   │   ├── catalog.js    # Ρούχα, χρώματα, θέσεις, μεγέθη & τεχνικές
│   │   ├── garment3d.js  # Three.js 3D renderer & decals
│   │   ├── studio.js     # 2D & 3D Mockup Studio controller
│   │   ├── quote.js      # Stepped φόρμα προσφορών & επαφής
│   │   ├── main.js       # Κύρια αρχικοποίηση
│   │   ├── animations.js # anime.js: hero, scroll reveals, micro-interactions
│   │   ├── i18n.js       # Ελληνικά / Αγγλικά
│   │   ├── theme.js      # Light / dark mode
│   │   ├── login.js      # Κουμπί & παράθυρο σύνδεσης διαχειριστή
│   │   └── admin.js      # Admin panel: σύνδεση, γράφημα, leads, CSV export
│   ├── vendor/
│   │   ├── three.module.min.js # Three.js r169 (χωρίς εξωτερικά CDN)
│   │   └── anime.esm.min.js    # anime.js v4.5.0 (MIT)
│   └── assets/
│       ├── apparel/      # Vector SVGs (hoodie, tshirt, sweatshirt, cap)
│       └── samples/      # Δείγματα logos & emblem
└── README.md
```
