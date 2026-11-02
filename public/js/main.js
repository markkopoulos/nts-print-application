import { initStudio } from './studio.js';
import { initQuote, initContact } from './quote.js';
import { createGarment3D, webglAvailable } from './garment3d.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const C = window.CATALOG;

/* Header: shadow on scroll + mobile menu */
const header = $('.hdr');
const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const burger = $('#burger');
burger?.addEventListener('click', () => {
  const open = header.classList.toggle('menu-open');
  burger.setAttribute('aria-expanded', open);
});
$$('.nav a').forEach(a => a.addEventListener('click', () => header.classList.remove('menu-open')));

/* Studio + forms */
const studio = initStudio();
initQuote(studio);
initContact();

/* Category cards → preselect garment in studio */
$$('[data-pick]').forEach(el => el.addEventListener('click', e => {
  e.preventDefault();
  studio?.setGarment(el.dataset.pick);
  $('#studio').scrollIntoView({ behavior: 'smooth' });
}));

/* Hero 3D */
const heroEl = $('#hero3d');
if (heroEl && webglAvailable()) {
  const heroColors = [
    { hex: '#2c3192', logo: 'assets/samples/logo-light.svg', name: 'Royal' },
    { hex: '#17181c', logo: 'assets/samples/logo-light.svg', name: 'Μαύρο' },
    { hex: '#f6f6f3', logo: 'assets/samples/logo-dark.svg', name: 'Λευκό' },
    { hex: '#d9ccb2', logo: 'assets/samples/logo-dark.svg', name: 'Sand' },
    { hex: '#f4cf1d', logo: 'assets/samples/logo-dark.svg', name: 'Κίτρινο' }
  ];
  const garments = ['hoodie', 'tshirt', 'sweatshirt'];
  const g3d = createGarment3D(heroEl, { garment: 'hoodie', color: heroColors[0].hex, motion: 'spin' });
  g3d.setLogo(heroColors[0].logo, { bounds: C.garments.hoodie.printBounds, x: 0, y: -0.05, scale: 0.62 });

  const dots = $('#heroDots');
  heroColors.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw sw--sm' + (i === 0 ? ' is-active' : '') + (['#f6f6f3', '#d9ccb2', '#f4cf1d'].includes(c.hex) ? ' sw--light' : '');
    b.style.setProperty('--c', c.hex);
    b.setAttribute('aria-label', c.name);
    b.addEventListener('click', () => {
      $$('.sw', dots).forEach(d => d.classList.remove('is-active'));
      b.classList.add('is-active');
      g3d.setColor(c.hex);
      g3d.setLogo(c.logo, {});
    });
    dots.appendChild(b);
  });

  const gBtns = $('#heroGarments');
  garments.forEach((k, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg-btn' + (i === 0 ? ' is-active' : '');
    b.textContent = C.garments[k].label;
    b.addEventListener('click', () => {
      $$('.seg-btn', gBtns).forEach(d => d.classList.remove('is-active'));
      b.classList.add('is-active');
      g3d.setGarment(k);
      g3d.setLogoTransform({ bounds: C.garments[k].printBounds, x: 0, y: k === 'tshirt' ? -0.15 : -0.05, scale: 0.6 });
    });
    gBtns.appendChild(b);
  });
} else if (heroEl) {
  heroEl.classList.add('no-webgl');
  heroEl.innerHTML = '<img src="assets/apparel/hoodie.svg" alt="" class="hero-fallback">';
}

/* Portfolio filter */
$$('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
  $$('[data-filter]').forEach(b => b.classList.toggle('is-active', b === btn));
  const f = btn.dataset.filter;
  $$('.work').forEach(w => { w.hidden = !(f === 'all' || w.dataset.cat === f); });
}));

/* Reveal on scroll */
const io = new IntersectionObserver(entries => entries.forEach(en => {
  if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
}), { threshold: 0.12 });
$$('.reveal').forEach(el => io.observe(el));

/* Year */
$$('[data-year]').forEach(el => (el.textContent = new Date().getFullYear()));
