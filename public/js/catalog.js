/**
 * Catalog — garments & fabric colours shown in the Mockup Studio and quote form.
 * Edit this file to add/remove garments or colours (no other code changes needed).
 *
 * printBounds: printable area as % of the garment artwork (600 x 650 viewBox)
 */
window.CATALOG = {
  garments: {
    tshirt: {
      label: 'T-shirt',
      name: 'Heavyweight T-shirt',
      spec: '240gsm · 100% βαμβάκι · boxy fit',
      svg: 'assets/apparel/tshirt.svg',
      printBounds: { top: 24, left: 32, width: 36, height: 44 },
      defaultScale: 0.62,
      has3d: true
    },
    hoodie: {
      label: 'Hoodie',
      name: 'Oversized Hoodie',
      spec: '450gsm · French terry · oversized',
      svg: 'assets/apparel/hoodie.svg',
      printBounds: { top: 27, left: 33, width: 34, height: 30 },
      defaultScale: 0.6,
      has3d: true
    },
    sweatshirt: {
      label: 'Φούτερ',
      name: 'Crewneck Φούτερ',
      spec: '380gsm · brushed fleece · regular fit',
      svg: 'assets/apparel/sweatshirt.svg',
      printBounds: { top: 24, left: 32, width: 36, height: 42 },
      defaultScale: 0.62,
      has3d: true
    },
    cap: {
      label: 'Καπέλο',
      name: '6-Panel Dad Cap',
      spec: 'Washed cotton twill · ρυθμιζόμενο',
      svg: 'assets/apparel/cap.svg',
      printBounds: { top: 27, left: 36, width: 28, height: 22 },
      defaultScale: 0.7,
      has3d: false
    }
  },

  colors: [
    { name: 'Μαύρο', hex: '#17181c' },
    { name: 'Λευκό', hex: '#f6f6f3', light: true },
    { name: 'Navy', hex: '#1f2a44' },
    { name: 'Royal', hex: '#2c3192' },
    { name: 'Γκρι Melange', hex: '#9a9ea6', light: true },
    { name: 'Sand', hex: '#d9ccb2', light: true },
    { name: 'Olive', hex: '#4a5639' },
    { name: 'Κίτρινο', hex: '#f4cf1d', light: true },
    { name: 'Κόκκινο', hex: '#c3222b' }
  ],

  positions: ['Μπροστά', 'Πίσω', 'Στήθος', 'Μανίκι', 'Άλλο σημείο'],
  sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  techniques: ['Μεταξοτυπία', 'Κέντημα', 'DTF εκτύπωση', 'Δεν είμαι σίγουρος/η']
};
