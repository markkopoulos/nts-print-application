/**
 * Catalog — garments & fabric colours shown in the Mockup Studio and quote form.
 * Edit this file to add/remove garments or colours (no other code changes needed).
 *
 * Every visible label is bilingual: { el: 'Ελληνικά', en: 'English' }.
 * The Greek (`el`) value is also what is saved with a quote request, so the admin
 * panel always shows consistent Greek values whatever language the customer used.
 *
 * printBounds: printable area as % of the garment artwork (600 x 650 viewBox)
 */
window.CATALOG = {
  garments: {
    tshirt: {
      label: { el: 'T-shirt', en: 'T-shirt' },
      name: { el: 'T-shirt', en: 'T-shirt' },
      spec: { el: 'Ενδεικτικό σχήμα · το τελικό ύφασμα επιβεβαιώνεται στην προσφορά', en: 'Illustrative shape · final fabric confirmed in your quote' },
      svg: 'assets/apparel/tshirt.svg',
      printBounds: { top: 24, left: 32, width: 36, height: 44 },
      defaultScale: 0.62,
      has3d: true
    },
    hoodie: {
      label: { el: 'Hoodie', en: 'Hoodie' },
      name: { el: 'Hoodie', en: 'Hoodie' },
      spec: { el: 'Ενδεικτικό σχήμα · το τελικό ύφασμα επιβεβαιώνεται στην προσφορά', en: 'Illustrative shape · final fabric confirmed in your quote' },
      svg: 'assets/apparel/hoodie.svg',
      printBounds: { top: 27, left: 33, width: 34, height: 30 },
      defaultScale: 0.6,
      has3d: true
    },
    sweatshirt: {
      label: { el: 'Φούτερ', en: 'Sweatshirt' },
      name: { el: 'Φούτερ', en: 'Sweatshirt' },
      spec: { el: 'Ενδεικτικό σχήμα · το τελικό ύφασμα επιβεβαιώνεται στην προσφορά', en: 'Illustrative shape · final fabric confirmed in your quote' },
      svg: 'assets/apparel/sweatshirt.svg',
      printBounds: { top: 24, left: 32, width: 36, height: 42 },
      defaultScale: 0.62,
      has3d: true
    },
    cap: {
      label: { el: 'Καπέλο', en: 'Cap' },
      name: { el: 'Καπέλο', en: 'Cap' },
      spec: { el: 'Ενδεικτικό σχήμα · το τελικό ύφασμα επιβεβαιώνεται στην προσφορά', en: 'Illustrative shape · final fabric confirmed in your quote' },
      svg: 'assets/apparel/cap.svg',
      printBounds: { top: 27, left: 36, width: 28, height: 22 },
      defaultScale: 0.7,
      has3d: true
    }
  },

  colors: [
    { name: { el: 'Μαύρο', en: 'Black' }, hex: '#17181c' },
    { name: { el: 'Λευκό', en: 'White' }, hex: '#f6f6f3', light: true },
    { name: { el: 'Navy', en: 'Navy' }, hex: '#1f2a44' },
    { name: { el: 'Royal', en: 'Royal' }, hex: '#2c3192' },
    { name: { el: 'Γκρι Melange', en: 'Heather Grey' }, hex: '#9a9ea6', light: true },
    { name: { el: 'Sand', en: 'Sand' }, hex: '#d9ccb2', light: true },
    { name: { el: 'Olive', en: 'Olive' }, hex: '#4a5639' },
    { name: { el: 'Κίτρινο', en: 'Yellow' }, hex: '#f4cf1d', light: true },
    { name: { el: 'Κόκκινο', en: 'Red' }, hex: '#c3222b' }
  ],

  positions: [
    { el: 'Μπροστά', en: 'Front' },
    { el: 'Πίσω', en: 'Back' },
    { el: 'Στήθος', en: 'Chest' },
    { el: 'Μανίκι', en: 'Sleeve' },
    { el: 'Άλλο σημείο', en: 'Other', other: true }
  ],
  sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  techniques: [
    { el: 'Εκτύπωση DTF', en: 'DTF Printing' },
    { el: 'Κέντημα', en: 'Embroidery' },
    { el: 'Custom εκτύπωση', en: 'Custom Printing' },
    { el: 'Μεταξοτυπία', en: 'Screen Printing' },
    { el: 'Δεν είμαι σίγουρος/η', en: 'Not sure yet' }
  ]
};
