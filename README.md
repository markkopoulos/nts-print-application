# ATELIER. — Custom Apparel Brand Showcase, 3D Mockup Studio & Quote System

Κομψή, επαγγελματική web εφαρμογή / ιστοσελίδα για custom apparel brand (ρούχα με δικό σας λογότυπο, μεταξοτυπία & κέντημα), εμπνευσμένη από το design system & τη stepped φόρμα προσφορών του impressink.gr, με υποστήριξη 3D διαδραστικού ρούχου και Admin Panel.

---

## 🎨 Σχεδιασμός & Τεχνολογίες

- **Design System & Παλέτα**: Βαθύ indigo (`#2c3192`, `#1f2372`), απαλό background (`#f6f7fc`, `#ffffff`), warm yellow accent (`#f4cf1d`), και καθαρή typography.
- **Γραμματοσειρά**: **Geologica** (Google Font) με fallback σε **CF Asty Pro** / sans-serif.
- **3D Interactive Engine (Three.js)**: Πραγματικό 3D ρούχο (T-shirt, Hoodie, Sweatshirt) με ρεαλιστικό knit bump texture, studio lighting (key, fill, rim light), φυσική κίνηση / sway, και live decal logo mapping.
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
  - Ασφαλής είσοδος με PIN (προεπιλογή: `1234`).
  - Πίνακας στατιστικών: Συνολικά αιτήματα, Προσφορές, Νέα σε εκκρεμότητα, Συνολικά τεμάχια προς παραγωγή.
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
- Admin Panel: `http://localhost:3000/admin` (PIN: `1234`)

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
│   │   ├── main.js       # Κύρια αρχικοποίηση & animations
│   │   └── admin.js      # Admin panel logic & CSV export
│   ├── vendor/
│   │   └── three.module.min.js # Three.js local module (χωρίς εξωτερικά CDN)
│   └── assets/
│       ├── apparel/      # Vector SVGs (hoodie, tshirt, sweatshirt, cap)
│       └── samples/      # Δείγματα logos & emblem
└── README.md
```
