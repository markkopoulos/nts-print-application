/**
 * Catalog — garments & fabric colours shown in the Mockup Studio and quote form.
 * Edit this file to add/remove garments or colours (no other code changes needed).
 *
 * Every visible label is bilingual: { el: 'Ελληνικά', en: 'English' }.
 * The Greek (`el`) value is also what is saved with a quote request, so the admin
 * panel always shows consistent Greek values whatever language the customer used.
 *
 * printBounds: printable area as % of the garment artwork (600 x 650 viewBox)
 * placements:  every print position the Mockup Studio offers for that garment.
 *   side    'front' | 'back' — which artwork it is drawn on (svg / svgBack)
 *   bounds  print area as % of that artwork; scale = default logo width inside it
 *   rotate  degrees (sleeve prints follow the sleeve in the 2D view)
 */
window.CATALOG = {
  garments: {
    tshirt: {
      label: { el: 'T-shirt', en: 'T-shirt' },
      name: { el: 'T-shirt', en: 'T-shirt' },
      spec: { el: 'Ενδεικτικό σχήμα · το τελικό ύφασμα επιβεβαιώνεται στην προσφορά', en: 'Illustrative shape · final fabric confirmed in your quote' },
      svg: 'assets/apparel/tshirt.svg',
      svgBack: 'assets/apparel/tshirt-back.svg',
      printBounds: { top: 24, left: 32, width: 36, height: 44 },
      defaultScale: 0.62,
      has3d: true,
      placements: {
        front: { side: 'front', bounds: { top: 24, left: 32, width: 36, height: 44 }, scale: 0.62 },
        chest: { side: 'front', bounds: { top: 25, left: 55, width: 13, height: 12 }, scale: 0.9 },
        back: { side: 'back', bounds: { top: 20, left: 32, width: 36, height: 46 }, scale: 0.7 },
        sleeve: { side: 'front', bounds: { top: 23, left: 79, width: 10, height: 8 }, scale: 0.85, rotate: 40 }
      }
    },
    hoodie: {
      label: { el: 'Hoodie', en: 'Hoodie' },
      name: { el: 'Hoodie', en: 'Hoodie' },
      spec: { el: 'Ενδεικτικό σχήμα · το τελικό ύφασμα επιβεβαιώνεται στην προσφορά', en: 'Illustrative shape · final fabric confirmed in your quote' },
      svg: 'assets/apparel/hoodie.svg',
      svgBack: 'assets/apparel/hoodie-back.svg',
      printBounds: { top: 27, left: 33, width: 34, height: 30 },
      defaultScale: 0.6,
      has3d: true,
      placements: {
        front: { side: 'front', bounds: { top: 27, left: 33, width: 34, height: 30 }, scale: 0.6 },
        chest: { side: 'front', bounds: { top: 26, left: 58, width: 12, height: 11 }, scale: 0.9 },
        back: { side: 'back', bounds: { top: 39, left: 33, width: 34, height: 30 }, scale: 0.75 },
        sleeve: { side: 'front', bounds: { top: 36, left: 80, width: 9, height: 11 }, scale: 0.85, rotate: -6 }
      }
    },
    sweatshirt: {
      label: { el: 'Φούτερ', en: 'Sweatshirt' },
      name: { el: 'Φούτερ', en: 'Sweatshirt' },
      spec: { el: 'Ενδεικτικό σχήμα · το τελικό ύφασμα επιβεβαιώνεται στην προσφορά', en: 'Illustrative shape · final fabric confirmed in your quote' },
      svg: 'assets/apparel/sweatshirt.svg',
      svgBack: 'assets/apparel/sweatshirt-back.svg',
      printBounds: { top: 24, left: 32, width: 36, height: 42 },
      defaultScale: 0.62,
      has3d: true,
      placements: {
        front: { side: 'front', bounds: { top: 24, left: 32, width: 36, height: 42 }, scale: 0.62 },
        chest: { side: 'front', bounds: { top: 24, left: 55, width: 13, height: 12 }, scale: 0.9 },
        back: { side: 'back', bounds: { top: 20, left: 32, width: 36, height: 44 }, scale: 0.7 },
        sleeve: { side: 'front', bounds: { top: 37, left: 80, width: 9, height: 11 }, scale: 0.85, rotate: -6 }
      }
    },
    cap: {
      label: { el: 'Καπέλο', en: 'Cap' },
      name: { el: 'Καπέλο', en: 'Cap' },
      spec: { el: 'Ενδεικτικό σχήμα · το τελικό ύφασμα επιβεβαιώνεται στην προσφορά', en: 'Illustrative shape · final fabric confirmed in your quote' },
      svg: 'assets/apparel/cap.svg',
      printBounds: { top: 27, left: 36, width: 28, height: 22 },
      defaultScale: 0.7,
      has3d: true,
      placements: {
        front: { side: 'front', bounds: { top: 27, left: 36, width: 28, height: 22 }, scale: 0.7 }
      }
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

  /* print positions shown in the studio; pos = index into `positions` below (quote form) */
  placementInfo: {
    front: { pos: 0, label: { el: 'Μπροστά', en: 'Front' } },
    chest: { pos: 2, label: { el: 'Στήθος', en: 'Left chest' } },
    back: { pos: 1, label: { el: 'Πίσω', en: 'Back' } },
    sleeve: { pos: 3, label: { el: 'Μανίκι', en: 'Sleeve' } }
  },

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
