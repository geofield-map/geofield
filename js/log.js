// Stratigraphic log for a station: beds from base to top, drawn as a graphic column.
import { state, saveStation, getStation } from './state.js';
import { db, uid } from './db.js';
import { $, esc, openModal, closeModal, toast, confirmBox, saveFile, resetViewport } from './ui.js';
import { LITHOLOGIES } from './schema.js';
import { FORMATION_NAMES, findFormation, CHART_LITHOLOGIES, chronoColour, formationColour } from './strat.js';
import { colourFieldHtml, bindColourField, colourHex } from './colours.js';

export const GRAINS = ['Clay', 'Silt', 'Very fine sand', 'Fine sand', 'Medium sand', 'Coarse sand', 'Very coarse sand', 'Granule', 'Pebble', 'Cobble', 'Boulder'];
const GRAIN_ABBR = ['cl', 'si', 'vf', 'f', 'm', 'c', 'vc', 'gr', 'pb', 'cb', 'bl'];
const CONTACTS = ['Sharp', 'Erosional', 'Gradational', 'Unconformity', 'Faulted', 'Covered'];
// Lithologies offered in the log, grouped as in the picker. The first groups follow the chart's Lithology Key.
export const LITH_GROUPS = [
  ['Carbonates', ['Limestone', 'Dolomitic limestone', 'Argillaceous limestone', 'Calcarenite', 'Calcarenitic limestone', 'Wackestone',
    'Dolomite', 'Argillaceous dolomite', 'Chalk', 'Marl']],
  ['Clastics', ['Conglomerate', 'Breccia', 'Diamictite', 'Sandstone', 'Sandstone (bedded)', 'Arkose', 'Greywacke', 'Quartz arenite',
    'Siltstone', 'Siltstone (irregular)', 'Silty clay, Mudstone', 'Mudstone', 'Shale-Claystone', 'Shale', 'Claystone', 'Tillite']],
  ['Evaporites & chemical', ['Anhydrite', 'Gypsum', 'Salts', 'Halite', 'Evaporite', 'Chert', 'Ironstone', 'Phosphorite', 'Coal']],
  ['Other', ['Volcanics', 'Igneous (intrusive)', 'Metamorphic', 'Basement', 'Dune sand', 'Rootlets / palaeosol', 'Covered / no exposure']],
];
const LOG_LITHS = [...new Set([...LITH_GROUPS.flatMap(g => g[1]), ...CHART_LITHOLOGIES, ...LITHOLOGIES.Sedimentary])];

// Lithology -> SVG pattern id. Chart names first, then keywords for anything typed by hand.
const PATTERN_BY_NAME = {
  'limestone': 'p-limestone', 'dolomitic limestone': 'p-dol-lime', 'argillaceous limestone': 'p-arg-lime', 'calcarenite': 'p-calcarenite',
  'calcarenitic limestone': 'p-calc-lime', 'calcarenous limestone': 'p-calc-lime', 'wackestone': 'p-wackestone', 'dolomite': 'p-dolomite',
  'argillaceous dolomite': 'p-arg-dol', 'shale-claystone': 'p-shale', 'diamictite': 'p-diamictite', 'diamictites': 'p-diamictite',
  'conglomerate': 'p-congl', 'anhydrite': 'p-anhydrite', 'gypsum': 'p-gypsum', 'sandstone': 'p-sand', 'sandstone (bedded)': 'p-sand-bed',
  'silty clay, mudstone': 'p-mud', 'siltstone': 'p-silt', 'siltstone (irregular)': 'p-silt-irr', 'salts': 'p-salt', 'volcanics': 'p-volc',
  'basement': 'p-basement', 'dune sand': 'p-dune', 'rootlets / palaeosol': 'p-roots',
};
function patternFor(lith = '') {
  const l = lith.toLowerCase().trim();
  if (PATTERN_BY_NAME[l]) return PATTERN_BY_NAME[l];
  if (l.includes('covered')) return 'p-covered';
  if (l.includes('basement')) return 'p-basement';
  if (l.includes('salt') || l.includes('halite')) return 'p-salt';
  if (l.includes('dune')) return 'p-dune';
  if (l.includes('root') || l.includes('palaeosol') || l.includes('paleosol')) return 'p-roots';
  if (l.includes('anhydrite')) return 'p-anhydrite';
  if (l.includes('gypsum')) return 'p-gypsum';
  if (l.includes('conglom') || l.includes('tillite')) return 'p-congl';
  if (l.includes('diamict')) return 'p-diamictite';
  if (l.includes('breccia')) return 'p-breccia';
  if (l.includes('wackestone')) return 'p-wackestone';
  if (l.includes('calcaren')) return 'p-calcarenite';
  if (l.includes('dolom')) return 'p-dolomite';
  if (l.includes('limestone') || l.includes('chalk')) return 'p-limestone';
  if (l.includes('marl')) return 'p-marl';
  if (l.includes('silt')) return 'p-silt';
  if (l.includes('mud')) return 'p-mud';
  if (l.includes('shale') || l.includes('clay')) return 'p-shale';
  if (l.includes('sand') || l.includes('arkose') || l.includes('greywacke') || l.includes('arenite')) return 'p-sand';
  if (l.includes('chert')) return 'p-chert';
  if (l.includes('evap')) return 'p-evap';
  if (l.includes('coal')) return 'p-coal';
  if (l.includes('volcan')) return 'p-volc';
  if (l.includes('igneous')) return 'p-ign';
  if (l.includes('metamorphic')) return 'p-meta';
  if (l.includes('iron') || l.includes('phosph')) return 'p-sand';
  return 'p-blank';
}

// Lithology symbols are drawn over a fill: the bed's chosen colour, or the default colour below.
// Default colours follow the chart's Lithology Key.
// [id, width, height, default fill, symbol markup with INK as the symbol colour]
const BRICK = 'M0 0H16M0 6H16M4 0V6M12 6V12';
const RHOMB = 'M0 0H16M0 6H16M3 0L5 6M11 6L13 12';
const PATTERNS = [
  ['p-limestone', 16, 12, '#C3DDEF', `<path d="${BRICK}" stroke="INK" stroke-width=".8" fill="none"/>`],
  ['p-dol-lime', 16, 12, '#BCD8EC', `<path d="${BRICK}M5 6L11 0M13 12L19 6M-3 12L3 6" stroke="INK" stroke-width=".7" fill="none"/>`],
  ['p-arg-lime', 16, 12, '#A9BDD3', `<path d="${BRICK}M1 3H7M9 9H15" stroke="INK" stroke-width=".7" fill="none"/>`],
  ['p-calcarenite', 16, 12, '#C3DDEF', `<path d="${BRICK}" stroke="INK" stroke-width=".7" fill="none"/><circle cx="8" cy="3" r=".9" fill="INK"/><circle cx="0" cy="9" r=".9" fill="INK"/><circle cx="16" cy="9" r=".9" fill="INK"/>`],
  ['p-calc-lime', 16, 12, '#B6D2EA', `<path d="${BRICK}" stroke="INK" stroke-width=".7" fill="none"/><circle cx="2" cy="3" r=".8" fill="INK"/><circle cx="8" cy="9" r=".8" fill="INK"/>`],
  ['p-wackestone', 16, 12, '#73B886', `<path d="${RHOMB}" stroke="INK" stroke-width=".7" fill="none"/><path d="M7 4.5L8.5 1.5L10 4.5Z M14 10.5L15.5 7.5L17 10.5Z" fill="INK"/>`],
  ['p-dolomite', 16, 12, '#8FCC9E', `<path d="${RHOMB}" stroke="INK" stroke-width=".8" fill="none"/>`],
  ['p-arg-dol', 16, 12, '#5FA070', `<path d="${RHOMB}M6 3H12M14 9H20M-2 9H4" stroke="INK" stroke-width=".7" fill="none"/>`],
  ['p-marl', 16, 12, '#D4E8D0', `<path d="M0 0H16M4 0V6M2 9H10" stroke="INK" fill="none"/>`],
  ['p-shale', 12, 5, '#CDB1A2', '<line x1="0" y1="2.5" x2="7" y2="2.5" stroke="INK"/>'],
  ['p-diamictite', 16, 10, '#BC9A88', '<line x1="0" y1="2.5" x2="6" y2="2.5" stroke="INK"/><line x1="8" y1="7.5" x2="14" y2="7.5" stroke="INK"/><path d="M9 4L11 1L13 4Z M2 9L4 6L6 9Z" fill="INK"/>'],
  ['p-congl', 20, 14, '#FFF6C8', '<ellipse cx="5" cy="4" rx="3" ry="2.2" fill="none" stroke="INK" stroke-width=".8"/><path d="M12 10l3-2 3 1-1 3-4 0z" fill="none" stroke="INK" stroke-width=".8"/><circle cx="15" cy="3" r=".8" fill="INK"/><circle cx="3" cy="11" r=".7" fill="INK"/>'],
  ['p-breccia', 18, 14, '#F2CFA0', '<path d="M2 6L6 1L8 6Z M10 13L13 8L16 13Z" fill="none" stroke="INK"/>'],
  ['p-sand', 8, 8, '#FFF3CF', '<circle cx="2" cy="2" r=".8" fill="INK"/><circle cx="6" cy="6" r=".8" fill="INK"/>'],
  ['p-sand-bed', 24, 12, '#FFF0C8', '<circle cx="2" cy="2" r=".7" fill="INK"/><circle cx="14" cy="3" r=".7" fill="INK"/><circle cx="8" cy="9" r=".7" fill="INK"/><circle cx="20" cy="10" r=".7" fill="INK"/><path d="M0 11Q12 2 24 11" fill="none" stroke="INK" stroke-width=".5" stroke-dasharray="1 1.5"/>'],
  ['p-mud', 12, 8, '#FCE1B0', '<line x1="0" y1="2" x2="6" y2="2" stroke="INK"/><circle cx="9" cy="2" r=".7" fill="INK"/><circle cx="3" cy="6" r=".7" fill="INK"/><line x1="6" y1="6" x2="12" y2="6" stroke="INK"/>'],
  ['p-silt', 14, 8, '#FCEAC2', '<line x1="0" y1="2" x2="5" y2="2" stroke="INK"/><circle cx="7.5" cy="2" r=".7" fill="INK"/><circle cx="10" cy="2" r=".7" fill="INK"/><line x1="7" y1="6" x2="12" y2="6" stroke="INK"/><circle cx="2" cy="6" r=".7" fill="INK"/><circle cx="4.5" cy="6" r=".7" fill="INK"/>'],
  ['p-silt-irr', 16, 8, '#FCEFD0', '<path d="M0 2q2 -1.5 4 0t4 0" fill="none" stroke="INK" stroke-width=".7"/><circle cx="11" cy="2" r=".7" fill="INK"/><path d="M8 6q2 -1.5 4 0t4 0" fill="none" stroke="INK" stroke-width=".7"/><circle cx="3" cy="6" r=".7" fill="INK"/>'],
  ['p-anhydrite', 12, 10, '#F2BBD0', '<path d="M1 4L3 1.5L5 4M7 9L9 6.5L11 9" fill="none" stroke="INK" stroke-width=".7"/>'],
  ['p-gypsum', 12, 10, '#F4C6D8', '<path d="M1 1.5L4 3L1 4.5M7 6.5L10 8L7 9.5" fill="none" stroke="INK" stroke-width=".7"/>'],
  ['p-salt', 8, 8, '#E691C0', ''],
  ['p-evap', 10, 10, '#F6D1E6', '<path d="M0 0L10 10M10 0L0 10" stroke="INK" stroke-width=".7"/>'],
  ['p-chert', 12, 8, '#E7E7E7', '<path d="M1 6L4 2L7 6Z" fill="INK"/>'],
  ['p-coal', 4, 4, '#222222', ''],
  ['p-volc', 14, 12, '#E99A80', '<path d="M1 2L3 6L5 2M8 7L10 11L12 7" stroke="INK" fill="none" stroke-width=".8"/>'],
  ['p-basement', 16, 12, '#C9619B', '<path d="M2 3L5 1M9 5L12 2M4 9L7 7M11 11L14 8M14 4L16 3" stroke="INK" stroke-width=".7"/>'],
  ['p-ign', 14, 14, '#F4B6B6', '<path d="M3 1V7M0 4H6M10 8V14M7 11H13" stroke="INK"/>'],
  ['p-meta', 20, 8, '#C8D9B4', '<path d="M0 4Q5 0 10 4T20 4" stroke="INK" fill="none"/>'],
  ['p-dune', 24, 12, '#FFF3CF', '<path d="M0 10Q8 2 16 10M6 10Q12 5 18 10M14 10Q20 3 24 6" fill="none" stroke="INK" stroke-width=".6"/>'],
  ['p-roots', 16, 14, '#EFE3C8', '<path d="M8 2V8M8 8L5 12M8 8L11 12M8 6L6 8" fill="none" stroke="INK" stroke-width=".8"/>'],
  ['p-covered', 8, 8, '#FFFFFF', '<path d="M0 8L8 0" stroke="#aaa"/>'],
  ['p-blank', 8, 8, '#EEEEEE', ''],
];
const DEFAULT_FILL = Object.fromEntries(PATTERNS.map(p => [p[0], p[3]]));

// Each pattern twice: dark symbols for light colours, light symbols ("-l") for dark colours.
const DEFS = `<defs>${PATTERNS.map(([id, w, h, , sym]) =>
  `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${sym.replace(/INK/g, '#222')}</pattern>` +
  `<pattern id="${id}-l" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${sym.replace(/INK/g, '#f2f2f2')}</pattern>`).join('')}</defs>`;

// ---------- visual pickers (same look as the colour picker) for lithology, bed shape and base contact ----------
export function lithSwatch(name, w = 40, h = 26) {
  const pat = patternFor(name), fill = DEFAULT_FILL[pat];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fill}"/>
    <rect width="${w}" height="${h}" fill="url(#${pat}${isDark(fill) ? '-l' : ''})" stroke="#000" stroke-width=".8"/></svg>`;
}

// A sandstone bed drawn with the chosen outline, on a white background.
function shapeSwatch(shape, w = 40, h = 26) {
  const d = bedPath(shape, 3, w - 8, 4, h - 8);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/>
    <path d="${d}" fill="${DEFAULT_FILL['p-sand']}"/><path d="${d}" fill="url(#p-sand)" stroke="#000" stroke-width=".9"/></svg>`;
}

// Two beds (shale over sandstone) separated by the chosen contact, drawn as in the log.
function contactSwatch(contact, w = 40, h = 26) {
  const m = h / 2;
  let line;
  if (contact === 'Erosional' || contact === 'Unconformity') {
    let d = `M0 ${m}`; for (let x = 0; x < w; x += 8) d += ' q2 -4 4 0 q2 4 4 0';
    line = `<path d="${d}" fill="none" stroke="#000" stroke-width="${contact === 'Unconformity' ? 2.2 : 1.4}"/>`;
  } else if (contact === 'Gradational') {
    line = `<line x1="0" y1="${m}" x2="${w}" y2="${m}" stroke="#000" stroke-dasharray="4 3"/>`;
  } else if (contact === 'Faulted') {
    line = `<line x1="0" y1="${m + 5}" x2="${w}" y2="${m - 5}" stroke="#d00" stroke-width="2"/>`;
  } else if (contact === 'Covered') {
    line = `<rect x="0" y="${m - 4}" width="${w}" height="8" fill="url(#p-covered)"/>`;
  } else {
    line = `<line x1="0" y1="${m}" x2="${w}" y2="${m}" stroke="#000" stroke-width="1.2"/>`;
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${m}" fill="${DEFAULT_FILL['p-shale']}"/><rect width="${w}" height="${m}" fill="url(#p-shale)"/>
    <rect y="${m}" width="${w}" height="${m}" fill="${DEFAULT_FILL['p-sand']}"/><rect y="${m}" width="${w}" height="${m}" fill="url(#p-sand)"/>
    ${line}<rect width="${w}" height="${h}" fill="none" stroke="#000" stroke-width=".8"/></svg>`;
}

// built on first use: BED_SHAPES is declared further down this file
function pickerConfig(kind) {
  return {
    lith: { title: 'Choose lithology', placeholder: 'Tap to choose a lithology', groups: LITH_GROUPS, swatch: lithSwatch, search: true, recentKey: 'recentLiths' },
    shape: { title: 'Shape in log', placeholder: 'Straight', groups: [['Bed outline', BED_SHAPES]], swatch: shapeSwatch },
    contact: { title: 'Base contact', placeholder: 'Sharp', groups: [['Contact with the bed below', CONTACTS]], swatch: contactSwatch },
  }[kind];
}

let pickerOverlay = null;
async function recentOf(key) { if (!key) return []; const r = await db.get('meta', key); return r ? r.value : []; }
async function remember(key, v) {
  if (!key) return;
  const list = (await recentOf(key)).filter(x => x !== v); list.unshift(v);
  await db.put('meta', { id: key, value: list.slice(0, 6) });
}

async function pickVisual(kind, current) {
  const cfg = pickerConfig(kind);
  const rec = await recentOf(cfg.recentKey);
  if (!pickerOverlay) {
    pickerOverlay = document.createElement('div');
    pickerOverlay.id = 'lith-picker';
    document.body.appendChild(pickerOverlay);
  }
  ensureDefs();
  const chip = name => `<button class="cp-chip ${name === current ? 'cp-on' : ''}" data-v="${esc(name)}"><span class="lp-sw">${cfg.swatch(name)}</span><span class="cp-txt"><span>${esc(name)}</span></span></button>`;
  const tools = cfg.search ? `<div class="cp-tools"><input type="search" placeholder="Search: limestone, sand, dolomite…" class="cp-search">
      <div class="btns" style="margin:8px 0 0"><button class="btn small" data-act="custom">Type my own</button><button class="btn small danger" data-act="clear">Clear</button></div></div>` : '';
  pickerOverlay.innerHTML = `<div class="cp-card ${cfg.search ? '' : 'cp-short'}">
    <div class="cp-head"><b>${cfg.title}</b><button class="icon-btn" data-act="close">&times;</button></div>${tools}
    <div class="cp-body">
      ${rec.length ? `<div class="cp-group" data-fixed><div class="group-title">Recently used</div><div class="cp-grid">${rec.map(chip).join('')}</div></div>` : ''}
      ${cfg.groups.map(([g, list]) => `<div class="cp-group"><div class="group-title">${g}</div><div class="cp-grid">${list.map(chip).join('')}</div></div>`).join('')}
    </div></div>`;
  pickerOverlay.classList.remove('hidden');
  return new Promise(resolve => {
    const done = v => { pickerOverlay.classList.add('hidden'); pickerOverlay.onclick = null; resetViewport(); if (v) remember(cfg.recentKey, v); resolve(v); };
    pickerOverlay.onclick = e => {
      if (e.target === pickerOverlay) return done(undefined);
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.act === 'close') return done(undefined);
      if (btn.dataset.act === 'clear') return done('');
      if (btn.dataset.act === 'custom') { const v = window.prompt('Lithology', current || ''); if (v != null) done(v.trim()); return; }
      if (btn.dataset.v != null) done(btn.dataset.v);
    };
    const search = pickerOverlay.querySelector('.cp-search');
    if (search) search.oninput = () => {
      const q = search.value.toLowerCase().trim();
      pickerOverlay.querySelectorAll('.cp-group').forEach(g => {
        let any = false;
        g.querySelectorAll('.cp-chip').forEach(c => { const show = !q || c.dataset.v.toLowerCase().includes(q); c.style.display = show ? '' : 'none'; if (show) any = true; });
        g.style.display = any && !(q && g.hasAttribute('data-fixed')) ? '' : 'none';
      });
    };
  });
}

// Pattern definitions live once in the page, so swatches anywhere (field, picker) can use them.
function ensureDefs() {
  if (document.getElementById('gf-defs')) return;
  const holder = document.createElement('div');
  holder.innerHTML = `<svg id="gf-defs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${DEFS}</svg>`;
  document.body.appendChild(holder.firstElementChild);
}

// A button, not a text box: nothing takes keyboard focus (see resetViewport in ui.js).
function visualFieldHtml(kind, id, value) {
  ensureDefs();
  const cfg = pickerConfig(kind), shown = value || (kind === 'lith' ? '' : cfg.placeholder);
  return `<button type="button" class="colour-field visual-field" data-kind="${kind}"><span class="lp-sw small">${shown ? cfg.swatch(shown, 30, 24) : ''}</span>
    <span class="cf-text ${shown ? '' : 'placeholder'}">${esc(shown || cfg.placeholder)}</span>
    <input type="hidden" id="${id}" value="${esc(shown)}"></button>`;
}
function bindVisualField(wrapper) {
  const kind = wrapper.dataset.kind, cfg = pickerConfig(kind);
  const input = wrapper.querySelector('input');
  wrapper.addEventListener('click', async () => {
    let v = await pickVisual(kind, input.value);
    if (v === undefined) return;
    if (!v && kind !== 'lith') v = cfg.placeholder; // shape and contact always keep a value
    input.value = v;
    const text = wrapper.querySelector('.cf-text');
    text.textContent = v || cfg.placeholder;
    text.classList.toggle('placeholder', !v);
    wrapper.querySelector('.lp-sw').innerHTML = v ? cfg.swatch(v, 30, 24) : '';
  });
}

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum < 105;
}

function grainIndex(bed) {
  const i = GRAINS.indexOf(bed.grain);
  if (i >= 0) return i;
  // no grain size given: a sensible default width for the lithology
  const p = patternFor(bed.lithology);
  if (['p-shale', 'p-mud', 'p-covered'].includes(p)) return 0;
  if (['p-silt', 'p-silt-irr'].includes(p)) return 1;
  if (['p-congl', 'p-breccia', 'p-diamictite'].includes(p)) return 8;
  if (['p-sand', 'p-sand-bed', 'p-dune'].includes(p)) return 4;
  if (['p-ign', 'p-meta', 'p-basement', 'p-volc', 'p-blank'].includes(p)) return 4;
  return 2; // carbonates, evaporites, chert, coal
}

// Colour name without its Munsell code, e.g. "Moderate red (5R 5/4)" -> "Moderate red".
// Also covers mottled colours, which carry a code after each name. The code stays in the saved data.
function stripCode(text) {
  return String(text || '').replace(/\s*\((?:\d+(?:\.\d+)?\s*(?:YR|GY|BG|PB|RP|R|Y|G|B|P)\s+\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?|N\s*\d+(?:\.\d+)?)\)/gi, '').trim();
}

function wrapText(text, maxChars) {
  const words = String(text || '').split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines;
}

// Outline of a bed. x0 = left edge, x1 = right edge (grain size), y/h = top and height.
export const BED_SHAPES = ['Straight', 'Rounded (resistant)', 'Recessive (soft)', 'Lens', 'Wavy'];
function bedPath(shape, x0, x1, y, h) {
  const b = y + h, k = Math.min(10, (x1 - x0) * 0.18, h * 0.6);
  switch (shape) {
    case 'Rounded (resistant)':
      return `M${x0} ${y}H${x1 - k}C${x1 + k * 0.6} ${y} ${x1 + k * 0.6} ${b} ${x1 - k} ${b}H${x0}Z`;
    case 'Recessive (soft)':
      return `M${x0} ${y}H${x1}Q${x1 - 2 * k} ${y + h / 2} ${x1} ${b}H${x0}Z`;
    case 'Lens': {
      const m = y + h / 2;
      const t = Math.min(h * 0.35, 8); // left side keeps most of its height, right side pinches out
      return `M${x0} ${y + t}Q${x0} ${y} ${x0 + t} ${y}H${x1 - (x1 - x0) * 0.35}C${x1} ${y} ${x1} ${m} ${x1} ${m}C${x1} ${m} ${x1} ${b} ${x1 - (x1 - x0) * 0.35} ${b}H${x0 + t}Q${x0} ${b} ${x0} ${b - t}Z`;
    }
    case 'Wavy': {
      const n = Math.max(2, Math.round(h / 12)), step = h / n;
      let d = `M${x0} ${y}H${x1}`;
      for (let i = 0; i < n; i++) d += `q${i % 2 ? -5 : 5} ${step / 2} 0 ${step}`;
      return d + `H${x0}Z`;
    }
    default: return `M${x0} ${y}H${x1}V${b}H${x0}Z`;
  }
}

// Era / period / epoch / stage of a bed: from its formation, else from the station.
function chronoOf(bed, st) {
  const fm = findFormation(bed.formation || st.attrs.formation);
  return {
    era: (fm && fm.era) || st.attrs.era || '',
    period: (fm && fm.period) || st.attrs.period || '',
    epoch: (fm && fm.epoch) || st.attrs.epoch || '',
    age: (fm && fm.age) || st.attrs.age || '',
  };
}

export function logSvg(st) {
  const beds = (st.log && st.log.beds) || [];
  const total = beds.reduce((s, b) => s + (Number(b.thickness) || 0), 0) || 1;
  const pxPerM = Math.max(8, Math.min(200, 600 / total));
  const chrono = beds.map(b => chronoOf(b, st));
  const hasChrono = chrono.some(c => c.era || c.period || c.epoch);
  const hasUnits = beds.some(b => b.formation || b.member);
  // left-hand columns, 17 px each. Era, Period, Epoch and Formation take the chart colours; Stage/Age and Member stay white.
  const white = () => null;
  const cols = [
    ...(hasChrono ? [['Era', i => chrono[i].era, chronoColour], ['Period', i => chrono[i].period, chronoColour],
      ['Epoch', i => chrono[i].epoch, chronoColour], ['Stage / Age', i => chrono[i].age, white]] : []),
    ...(hasUnits ? [['Formation', i => beds[i].formation || '', formationColour],
      // the key keeps equally named members of different formations apart
      ['Member', i => beds[i].member ? `${beds[i].member}\u0000${beds[i].formation || ''}` : '', white]] : []),
  ];
  const colX = 2 + cols.length * 17 + 40, minW = 30, stepW = 13, textX = colX + minW + stepW * 10 + 20, W = textX + 280;
  const heights = beds.map(b => Math.max(10, (Number(b.thickness) || 0) * pxPerM));
  const headTop = 30, headH = 62, top = headTop + headH + 14; // gap keeps the top depth label clear of the header
  const colBottom = top + heights.reduce((a, b) => a + b, 0);
  const order = beds.map((b, i) => i).reverse(); // drawn from the top of the page (youngest) down to the base
  const bedTop = {};
  { let yy = top; for (const i of order) { bedTop[i] = yy; yy += heights[i]; } }

  // descriptions get all the lines they need; a block moves down when the one above is longer than its bed
  const LH = 12, descBlocks = {};
  let lastBottom = top - 12;
  for (const i of order) {
    const b = beds[i];
    const lines = [`${i + 1}. ${b.lithology || ''}${b.thickness ? ' (' + b.thickness + ' m)' : ''}`,
      [stripCode(b.color), b.grain, b.structures, b.fossils].map(t => String(t || '').trim()).filter(Boolean).join(', '),
      b.description, b.sample ? 'Sample: ' + b.sample : '']
      .filter(t => String(t || '').trim()).flatMap((t, k) => wrapText(t, 46).map(line => ({ line, first: k === 0 })));
    const y0 = Math.max(bedTop[i] + 10, lastBottom + LH + 4);
    descBlocks[i] = { y0, lines };
    lastBottom = y0 + (lines.length - 1) * LH;
  }
  const textBottom = lastBottom + 6;

  // legend entries: lithologies and contacts used in this log
  // one entry per lithology + colour, so the swatch matches the beds exactly
  const liths = [];
  for (const b of beds.slice().reverse()) {
    if (!b.lithology) continue;
    const pat = patternFor(b.lithology), fill = colourHex(b.color) || DEFAULT_FILL[pat];
    if (liths.some(l => l.name === b.lithology && l.fill === fill)) continue;
    liths.push({ name: b.lithology, pat, fill });
  }
  const contacts = [...new Set(beds.map(b => b.contact).filter(c => ['Erosional', 'Unconformity', 'Gradational', 'Faulted'].includes(c)))];
  const legendItems = liths.length + contacts.length;
  const legendTop = Math.max(colBottom + 80, textBottom + 24), legendRows = Math.ceil(legendItems / 2);
  const H = legendItems ? legendTop + 24 + legendRows * 22 + 10 : colBottom + 75;

  const esc2 = s => esc(s);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">${DEFS}
    <rect width="${W}" height="${H}" fill="#fff"/>
    <text x="10" y="20" font-size="14" font-weight="bold">${esc2(st.code)} — Stratigraphic log</text>`;

  // header row: each column's name inside its own box, like a stratigraphic chart
  const headBox = (x, w, label, rotate) => {
    let out = `<rect x="${x}" y="${headTop}" width="${w}" height="${headH}" fill="#f2f2f2" stroke="#000" stroke-width=".8"/>`;
    out += rotate
      ? `<text transform="translate(${x + w / 2 + 3.5},${headTop + headH / 2}) rotate(-90)" font-size="8.5" font-weight="bold" text-anchor="middle">${label}</text>`
      : `<text x="${x + w / 2}" y="${headTop + headH / 2 + 4}" font-size="11" font-weight="bold" text-anchor="middle">${label}</text>`;
    return out;
  };
  cols.forEach(([label], c) => { s += headBox(2 + c * 17, 16, label, true); });
  const depthX = 2 + cols.length * 17;
  s += headBox(depthX + 2, colX - depthX - 6, 'm', false);
  s += headBox(colX - 2, textX - colX - 4, 'Lithology', false);
  s += headBox(textX - 4, W - textX, 'Description', false);

  let y = top, cum = total;
  // unit columns: merge consecutive beds with the same value; time units get their chart colour
  const unitCol = (label, valueOf, colourOf, x, w) => {
    let yy = top, k = 0, out = '';
    while (k < order.length) {
      const key = valueOf(order[k]);
      const name = key.split('\u0000')[0];
      let hh = 0;
      while (k < order.length && valueOf(order[k]) === key) { hh += heights[order[k]]; k++; }
      const fill = (key && colourOf(key)) || '#fff';
      out += `<rect x="${x}" y="${yy}" width="${w}" height="${hh}" fill="${fill}" stroke="#000" stroke-width=".6"/>`;
      if (name) out += `<text transform="translate(${x + w / 2 + 3.5},${yy + hh / 2}) rotate(-90)" font-size="9" text-anchor="middle">${esc2(hh > name.length * 5.2 ? name : name.slice(0, Math.max(1, Math.floor(hh / 5.2))))}</text>`;
      yy += hh;
    }
    return out;
  };
  cols.forEach(([label, valueOf, colourOf], c) => { s += unitCol(label, valueOf, colourOf, 2 + c * 17, 16); });

  for (const i of order) {
    const b = beds[i], h = heights[i];
    const w = minW + stepW * grainIndex(b);
    const pat = patternFor(b.lithology);
    const fill = colourHex(b.color) || DEFAULT_FILL[pat];
    const d = bedPath(b.shape, colX, colX + w, y, h);
    s += `<path d="${d}" fill="${fill}"/>`;
    s += `<path d="${d}" fill="url(#${pat}${isDark(fill) ? '-l' : ''})" stroke="#000" stroke-width="1"/>`;
    // base contact
    const by = y + h;
    if (b.contact === 'Erosional' || b.contact === 'Unconformity') {
      let d = `M${colX} ${by}`; for (let x = colX; x < colX + w; x += 8) d += ` q2 -4 4 0 q2 4 4 0`;
      s += `<path d="${d}" fill="none" stroke="#000" stroke-width="${b.contact === 'Unconformity' ? 2 : 1.4}"/>`;
    } else if (b.contact === 'Gradational') {
      s += `<line x1="${colX}" y1="${by}" x2="${colX + w}" y2="${by}" stroke="#fff" stroke-width="2"/><line x1="${colX}" y1="${by}" x2="${colX + w}" y2="${by}" stroke="#000" stroke-dasharray="4 3"/>`;
    } else if (b.contact === 'Faulted') {
      s += `<line x1="${colX - 4}" y1="${by + 3}" x2="${colX + w + 4}" y2="${by - 3}" stroke="#d00" stroke-width="2"/>`;
    }
    // scale tick at top of bed (height above base)
    s += `<line x1="${colX - 14}" y1="${y}" x2="${colX - 10}" y2="${y}" stroke="#000"/><text x="${colX - 16}" y="${y + 4}" font-size="9" text-anchor="end">${(Math.round(cum * 100) / 100)}</text>`;
    cum -= Number(b.thickness) || 0;
    // description: the name line in normal weight, details a little lighter
    const { y0, lines } = descBlocks[i];
    lines.forEach((d, k) => {
      s += `<text x="${textX}" y="${y0 + k * LH}" font-size="10" fill="${d.first ? '#000' : '#333'}">${esc2(d.line)}</text>`;
    });
    s += `<line x1="${colX + w}" y1="${y}" x2="${textX - 4}" y2="${y}" stroke="#ccc" stroke-dasharray="2 2"/>`;
    if (y0 > y + 11) s += `<line x1="${textX - 4}" y1="${y}" x2="${textX - 1}" y2="${y0 - 8}" stroke="#bbb" stroke-width=".7"/>`;
    y += h;
  }
  s += `<line x1="${colX - 14}" y1="${y}" x2="${colX - 10}" y2="${y}" stroke="#000"/><text x="${colX - 16}" y="${y + 4}" font-size="9" text-anchor="end">0</text>`;
  // grain-size scale
  const gx = i => colX + minW + stepW * i;
  GRAIN_ABBR.forEach((a, i) => {
    s += `<line x1="${gx(i)}" y1="${y}" x2="${gx(i)}" y2="${y + 4}" stroke="#000"/><text x="${gx(i)}" y="${y + 13}" font-size="8" text-anchor="middle">${a}</text>`;
  });
  // stepped class line: ticks grow taller from clay to gravel, class names underneath
  const base = y + 32, end = gx(10) + 6, mid = (a, b) => (gx(a) + gx(b)) / 2;
  const steps = [[colX, 4], [mid(0, 1), 7], [mid(1, 2), 10], [mid(6, 7), 13], [end, 16]];
  s += `<line x1="${colX}" y1="${base}" x2="${end}" y2="${base}" stroke="#000" stroke-width="1.2"/>`;
  steps.forEach(([x, h]) => { s += `<line x1="${x}" y1="${base}" x2="${x}" y2="${base - h}" stroke="#000"/>`; });
  [['Clay', 0, 1], ['Silt', 1, 2], ['Sand', 2, 3], ['Gravel', 3, 4]].forEach(([name, a, b]) => {
    s += `<text x="${(steps[a][0] + steps[b][0]) / 2}" y="${base + 11}" font-size="9" text-anchor="middle">${name}</text>`;
  });
  s += `<text x="${colX}" y="${base + 26}" font-size="9" fill="#555">Grain size · scale 1 m = ${pxPerM.toFixed(0)} px</text>`;

  // legend
  if (legendItems) {
    s += `<line x1="10" y1="${legendTop - 8}" x2="${W - 10}" y2="${legendTop - 8}" stroke="#ccc"/>
      <text x="10" y="${legendTop + 8}" font-size="11" font-weight="bold">Legend</text>`;
    const items = [...liths.map(l => ['lith', l]), ...contacts.map(c => ['contact', c])];
    const colW = Math.min((W - 20) / 2, 175);
    items.forEach(([kind, name], n) => {
      const x = 10 + (n % 2) * colW, yy = legendTop + 20 + Math.floor(n / 2) * 22;
      if (kind === 'lith') {
        s += `<rect x="${x}" y="${yy}" width="28" height="16" fill="${name.fill}"/>
          <rect x="${x}" y="${yy}" width="28" height="16" fill="url(#${name.pat}${isDark(name.fill) ? '-l' : ''})" stroke="#000" stroke-width=".8"/>`;
        s += `<text x="${x + 36}" y="${yy + 12}" font-size="10">${esc2(name.name)}</text>`;
        return;
      } else if (name === 'Gradational') {
        s += `<line x1="${x}" y1="${yy + 8}" x2="${x + 28}" y2="${yy + 8}" stroke="#000" stroke-dasharray="4 3"/>`;
      } else if (name === 'Faulted') {
        s += `<line x1="${x}" y1="${yy + 11}" x2="${x + 28}" y2="${yy + 5}" stroke="#d00" stroke-width="2"/>`;
      } else {
        let dd = `M${x} ${yy + 8}`; for (let k = 0; k < 28; k += 8) dd += ' q2 -4 4 0 q2 4 4 0';
        s += `<path d="${dd}" fill="none" stroke="#000" stroke-width="${name === 'Unconformity' ? 2 : 1.4}"/>`;
      }
      s += `<text x="${x + 36}" y="${yy + 12}" font-size="10">${esc2(kind === 'contact' ? name + ' contact' : name)}</text>`;
    });
  }
  return s + '</svg>';
}

// ---------- screen ----------
let nav = {};
export function initLog(navigation) {
  nav = navigation;
  $('#log-station-select').addEventListener('change', e => { state.currentStationId = e.target.value; renderLog(); });
}

export function renderLog() {
  const sel = $('#log-station-select');
  const stations = state.stations.slice().reverse();
  sel.innerHTML = stations.length ? stations.map(s => `<option value="${s.id}" ${s.id === state.currentStationId ? 'selected' : ''}>${esc(s.code)}${s.log && s.log.beds.length ? ' (' + s.log.beds.length + ' beds)' : ''}</option>`).join('') : '<option>No stations</option>';
  const st = getStation(state.currentStationId) || stations[0];
  const body = $('#log-body');
  if (!st) { body.innerHTML = '<div class="empty">Create a station on the map first. Each log belongs to a station.</div>'; return; }
  state.currentStationId = st.id; sel.value = st.id;
  st.log = st.log || { beds: [] };
  const beds = st.log.beds;
  const total = beds.reduce((a, b) => a + (Number(b.thickness) || 0), 0);
  body.innerHTML = `
    <div class="card"><div class="kv"><div>Station</div><div>${esc(st.code)} · ${esc(st.attrs.formation || 'formation not set')}</div>
      <div>Beds</div><div>${beds.length} · total ${Math.round(total * 100) / 100} m</div></div>
      <div class="btns"><button class="btn primary" id="lg-add">+ Add bed on top</button><button class="btn" id="lg-open">Station data</button></div></div>
    ${beds.length ? `<div class="log-svg-wrap">${logSvg(st)}</div>
      <div class="card"><table class="tbl"><tr><th>#</th><th>Lithology</th><th>m</th><th>Grain</th></tr>
      ${beds.map((b, i) => ({ b, i })).reverse().map(({ b, i }) => `<tr data-i="${i}"><td>${i + 1}</td><td>${esc(b.lithology || '')}${b.formation ? `<div class="muted">${esc([b.formation, b.member].filter(Boolean).join(' / '))}</div>` : ''}</td><td>${esc(b.thickness)}</td><td>${esc(b.grain || '')}</td></tr>`).join('')}
      </table><p class="muted">Bed 1 is the base. Tap a bed to edit.</p>
      <div class="btns"><button class="btn" id="lg-svg">Export SVG</button><button class="btn" id="lg-png">Export PNG</button></div></div>`
    : '<div class="empty">No beds yet. Start from the base of the section and add beds upward.</div>'}`;
  $('#lg-add').onclick = () => editBed(st, null);
  $('#lg-open').onclick = () => nav.openStation(st.id, 'data');
  body.querySelectorAll('tr[data-i]').forEach(r => r.onclick = () => editBed(st, Number(r.dataset.i)));
  const svgBtn = $('#lg-svg');
  if (svgBtn) {
    svgBtn.onclick = () => saveFile(new Blob([logSvg(st)], { type: 'image/svg+xml' }), `${st.code}_log.svg`);
    $('#lg-png').onclick = () => exportPng(st);
  }
}

async function exportPng(st) {
  const svg = logSvg(st);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas'); const k = 2;
    c.width = img.width * k; c.height = img.height * k;
    const ctx = c.getContext('2d'); ctx.scale(k, k); ctx.drawImage(img, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    await saveFile(blob, `${st.code}_log.png`);
  } catch (e) { toast('PNG export failed; use SVG'); } finally { URL.revokeObjectURL(url); }
}

function opts(list, val) {
  const extra = val && !list.includes(val) ? `<option selected>${esc(val)}</option>` : '';
  return `<option value=""></option>${extra}${list.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}`;
}

function editBed(st, index) {
  const beds = st.log.beds;
  const prev = index == null ? beds[beds.length - 1] : null;
  const b = index == null ? {
    id: uid(), thickness: '', lithology: prev ? prev.lithology : '', grain: '', color: '', structures: '', fossils: '', contact: 'Sharp', description: '', sample: '',
    formation: prev ? prev.formation : (st.attrs.formation || ''), member: prev ? prev.member : (st.attrs.member || ''),
  } : { ...beds[index] };
  const memberOpts = fmName => { const fm = findFormation(fmName); return opts(fm ? fm.members : [], b.member); };
  const body = openModal(index == null ? `New bed ${beds.length + 1}` : `Bed ${index + 1}`, `
    <div class="grid2">
      <div class="field"><label>Formation</label><select id="bd-fm">${opts(FORMATION_NAMES, b.formation)}</select></div>
      <div class="field"><label>Member</label><select id="bd-mbr">${memberOpts(b.formation)}</select></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Thickness (m)</label><input type="number" inputmode="decimal" step="any" id="bd-th" value="${esc(b.thickness)}"></div>
      <div class="field"><label>Base contact</label>${visualFieldHtml('contact', 'bd-contact', b.contact)}</div>
    </div>
    <div class="field"><label>Lithology</label>${visualFieldHtml('lith', 'bd-lith', b.lithology)}</div>
    <div class="grid2">
      <div class="field"><label>Grain size</label><select id="bd-grain">${opts(GRAINS, b.grain)}</select></div>
      <div class="field"><label>Shape in log</label>${visualFieldHtml('shape', 'bd-shape', b.shape)}</div>
    </div>
    <div class="field"><label>Colour</label>${colourFieldHtml('bd-color', b.color, 'id')}</div>
    <div class="field"><label>Sedimentary structures</label><input type="text" id="bd-struct" value="${esc(b.structures)}" placeholder="e.g. Trough cross-bedding"></div>
    <div class="field"><label>Fossils</label><input type="text" id="bd-fossils" value="${esc(b.fossils)}"></div>
    <div class="field"><label>Description</label><textarea id="bd-desc">${esc(b.description)}</textarea></div>
    <div class="field"><label>Sample no.</label><input type="text" id="bd-sample" value="${esc(b.sample)}"></div>
    <div class="btns"><button class="btn primary" id="bd-save">Save</button>
      ${index != null ? '<button class="btn" id="bd-up">Move up</button><button class="btn" id="bd-down">Move down</button><button class="btn danger" id="bd-del">Delete</button>' : ''}</div>`);
  const v = id => body.querySelector(id).value;
  bindColourField(body.querySelector('.colour-field:not(.visual-field)'));
  body.querySelectorAll('.visual-field').forEach(bindVisualField);
  body.querySelector('#bd-fm').onchange = e => { b.member = ''; body.querySelector('#bd-mbr').innerHTML = memberOpts(e.target.value); };
  body.querySelector('#bd-save').onclick = async () => {
    const th = Number(v('#bd-th'));
    if (!th || th <= 0) { toast('Enter a thickness in metres'); return; }
    Object.assign(b, { thickness: th, formation: v('#bd-fm'), member: v('#bd-mbr'), contact: v('#bd-contact'), lithology: v('#bd-lith'), grain: v('#bd-grain'), shape: v('#bd-shape'), color: v('#bd-color'),
      structures: v('#bd-struct'), fossils: v('#bd-fossils'), description: v('#bd-desc'), sample: v('#bd-sample') });
    if (index == null) beds.push(b); else beds[index] = b;
    await saveStation(st); closeModal(); renderLog();
  };
  const move = async d => {
    const j = index + d; if (j < 0 || j >= beds.length) return;
    [beds[index], beds[j]] = [beds[j], beds[index]];
    await saveStation(st); closeModal(); renderLog();
  };
  if (index != null) {
    body.querySelector('#bd-up').onclick = () => move(1);
    body.querySelector('#bd-down').onclick = () => move(-1);
    body.querySelector('#bd-del').onclick = async () => {
      if (!(await confirmBox('Delete this bed?'))) return;
      beds.splice(index, 1); await saveStation(st); closeModal(); renderLog();
    };
  }
}
