// Stratigraphic log for a station: beds from base to top, drawn as a graphic column.
import { state, saveStation, getStation } from './state.js';
import { db, uid } from './db.js';
import { $, esc, openModal, closeModal, toast, confirmBox, saveFile, resetViewport, loadScript } from './ui.js';
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
export function lithSwatch(name, w = 40, h = 26, colour) {
  const pat = patternFor(name), fill = colour || DEFAULT_FILL[pat];
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
function visualFieldHtml(kind, id, value, placeholder) {
  ensureDefs();
  const cfg = pickerConfig(kind), shown = value || (kind === 'lith' ? '' : cfg.placeholder);
  const ph = placeholder || cfg.placeholder;
  return `<button type="button" class="colour-field visual-field" data-kind="${kind}" data-ph="${esc(ph)}"><span class="lp-sw small">${shown ? cfg.swatch(shown, 30, 24) : ''}</span>
    <span class="cf-text ${shown ? '' : 'placeholder'}">${esc(shown || ph)}</span>
    <input type="hidden" id="${id}" value="${esc(shown)}"></button>`;
}
function bindVisualField(wrapper) {
  const kind = wrapper.dataset.kind, cfg = pickerConfig(kind);
  const input = wrapper.querySelector('input');
  const ph = wrapper.dataset.ph || cfg.placeholder;
  wrapper.addEventListener('click', async () => {
    let v = await pickVisual(kind, input.value);
    if (v === undefined) return;
    if (!v && kind !== 'lith') v = cfg.placeholder; // shape and contact always keep a value
    input.value = v;
    input.dispatchEvent(new Event('change'));
    const text = wrapper.querySelector('.cf-text');
    text.textContent = v || ph;
    text.classList.toggle('placeholder', !v);
    wrapper.querySelector('.lp-sw').innerHTML = v ? cfg.swatch(v, 30, 24) : '';
  });
}

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum < 105;
}

// Carbonate texture (Dunham 1962, with Embry & Klovan 1971 for coarse carbonates).
// [name, abbreviation, position on the width scale, in grain-size steps]
export const DUNHAM = [
  ['Mudstone', 'M', 1.5], ['Wackestone', 'W', 3], ['Packstone', 'P', 4.5], ['Grainstone', 'G', 6],
  ['Floatstone', 'F', 7], ['Rudstone', 'R', 8], ['Boundstone', 'B', 9], ['Crystalline', 'X', 5.25],
];
const DUNHAM_NAMES = DUNHAM.map(d => d[0]);
const dunhamPos = name => { const d = DUNHAM.find(x => x[0] === name); return d ? d[2] : -1; };
const CARB_PATTERNS = ['p-limestone', 'p-dol-lime', 'p-arg-lime', 'p-calcarenite', 'p-calc-lime', 'p-wackestone', 'p-dolomite', 'p-arg-dol', 'p-marl'];
export const isCarbonate = lith => CARB_PATTERNS.includes(patternFor(lith));

// width position of a bed: Dunham texture for carbonates, grain size for everything else
function grainIndex(bed, top = false) {
  if (isCarbonate(bed.lithology)) {
    const p = dunhamPos(top ? bed.textureTop : bed.texture);
    if (p >= 0) return p;
    if (top) return -1;
  } else if (top) return GRAINS.indexOf(bed.grainTop);
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

// Lithology modifiers ("ferruginous sandstone"): each draws a small symbol scattered over the bed.
// glyph markup is centred on 0,0 and about 8 px wide.
export const MODIFIERS = [
  ['Ferruginous', '<text y="2.6" font-size="7.5" font-weight="bold" text-anchor="middle" fill="#b3261e">Fe</text>'],
  ['Hematitic', '<text y="2.6" font-size="7.5" font-weight="bold" text-anchor="middle" fill="#7a1010">He</text>'],
  ['Glauconitic', '<circle cx="-2.2" cy="1" r="1.4" fill="#2e8b3a"/><circle cx="2.2" cy="1" r="1.4" fill="#2e8b3a"/><circle cx="0" cy="-2" r="1.4" fill="#2e8b3a"/>'],
  ['Calcareous', '<path d="M-3.5 -2H3.5M0 -2V2.5" stroke="#000" stroke-width="1" fill="none"/>'],
  ['Dolomitic', '<path d="M-3.5 -2H3.5M-1.2 -2L1.2 2.5" stroke="#000" stroke-width="1" fill="none"/>'],
  ['Argillaceous', '<path d="M-3.5 0H3.5" stroke="#000" stroke-width="1.1"/>'],
  ['Silty', '<path d="M-4 0H0" stroke="#000" stroke-width="1"/><circle cx="2" cy="0" r=".9"/><circle cx="4" cy="0" r=".9"/>'],
  ['Sandy', '<circle cx="-2.5" cy="1.2" r=".9"/><circle cx="0" cy="-1.5" r=".9"/><circle cx="2.5" cy="1.2" r=".9"/>'],
  ['Conglomeratic', '<ellipse cx="-1.5" cy="0" rx="2.4" ry="1.8" fill="none" stroke="#000" stroke-width=".9"/><circle cx="2.8" cy="1" r="1" fill="none" stroke="#000" stroke-width=".8"/>'],
  ['Carbonaceous', '<path d="M-3.5 0H3.5" stroke="#000" stroke-width="2.2"/>'],
  ['Gypsiferous', '<path d="M-2.5 -2L0 2L2.5 -2" stroke="#000" stroke-width="1" fill="none"/>'],
  ['Cherty', '<path d="M-3 2.2L0 -2.5L3 2.2Z" fill="#000"/>'],
  ['Fossiliferous', '<path d="M-3.5 -1A3.5 3.5 0 0 0 3.5 -1Z" fill="none" stroke="#000" stroke-width=".9"/><path d="M0 -1V2.3" stroke="#000" stroke-width=".6"/>'],
  ['Silicified', '<text y="2.6" font-size="7" font-weight="bold" text-anchor="middle" fill="#334">Si</text>'],
  ['Micaceous', '<path d="M-2.5 -2L2.5 2M-2.5 2L2.5 -2" stroke="#555" stroke-width=".9"/>'],
  ['Friable', ''],
];
const MOD_GLYPH = Object.fromEntries(MODIFIERS);

// Sedimentary structure symbols, drawn in their own column beside the lithology. Glyphs centred on 0,0, about 16 x 10 px.
// no stroke-width here: glyphs that set their own would repeat the attribute, which is invalid XML
// (breaks PNG export and strict SVG readers); SVG's default width is already 1
const SK = 'fill="none" stroke="#000"';
export const STRUCTURES = [
  ['Lamination & bedding', [
    ['Parallel lamination', `<path d="M-8 -3.5H8M-8 0H8M-8 3.5H8" ${SK} stroke-width=".9"/>`],
    ['Planar cross-bedding', `<path d="M-8 -4.5H8M-8 4.5H8M-7 4.5L-3 -4.5M-2 4.5L2 -4.5M3 4.5L7 -4.5" ${SK} stroke-width=".9"/>`],
    ['Trough cross-bedding', `<path d="M-8 -4Q0 8 8 -4M-5 -4Q0 3.5 5 -4M-8 4.5H8" ${SK} stroke-width=".9"/>`],
    ['Herringbone cross-bedding', `<path d="M-8 0H8M-7 0L-4 -4.5M-3 0L0 -4.5M1 0L4 -4.5M-4 0L-7 4.5M0 0L-3 4.5M4 0L1 4.5" ${SK} stroke-width=".9"/>`],
    ['Hummocky cross-stratification', `<path d="M-8 1Q-4 -5 0 1T8 1M-8 4.5Q-4 -1.5 0 4.5T8 4.5" ${SK} stroke-width=".9"/>`],
    ['Ripple lamination', `<path d="M-8 3C-7 -3 -4 -3 -3 3C-2 -3 1 -3 2 3C3 -3 6 -3 7 3" ${SK} stroke-width=".9"/><path d="M-6 0.5L-4.5 3M-1 0.5L0.5 3M4 0.5L5.5 3" ${SK} stroke-width=".6"/>`],
    ['Flaser / lenticular bedding', `<path d="M-7 -1.5Q-4 -4.5 -1 -1.5Q-4 1.5 -7 -1.5M1 2Q4 -1 7 2Q4 5 1 2" ${SK} stroke-width=".9"/>`],
    ['Graded bedding', `<path d="M-5 4.5H5L0 -4.5Z" ${SK}/><circle cx="0" cy="2.5" r=".8"/><circle cx="-2" cy="3" r=".7"/><circle cx="2" cy="3" r=".7"/>`],
    ['Massive', `<text y="3.5" font-size="10" font-weight="bold" text-anchor="middle">M</text>`],
  ]],
  ['Soft-sediment & surfaces', [
    ['Convolute / slump bedding', `<path d="M-8 2C-5 -7 -1 7 2 -2S7 -3 8 2" ${SK}/>`],
    ['Load casts / flames', `<path d="M-8 -2Q-6 5 -4 -2Q-2 5 0 -2Q2 5 4 -2Q6 5 8 -2" ${SK}/>`],
    ['Mud cracks', `<path d="M-8 -4H8M-6 -4L-4.5 4L-3 -4M1 -4L2.5 4L4 -4" ${SK}/>`],
    ['Stylolites', `<path d="M-8 0l2 -3l2 3l2 -3l2 3l2 -3l2 3l2 -3l2 3" ${SK}/>`],
    ['Imbrication', `<ellipse cx="-4" cy="0" rx="3.3" ry="1.6" transform="rotate(-25 -4 0)" ${SK} stroke-width=".9"/><ellipse cx="3.5" cy="0" rx="3.3" ry="1.6" transform="rotate(-25 3.5 0)" ${SK} stroke-width=".9"/>`],
  ]],
  ['Biogenic', [
    ['Bioturbation', `<path d="M-6 4.5C-7 -1 -2 2 -3 -4.5M2 4.5C1 0 6 1 5 -4.5" ${SK}/>`],
    ['Burrows', `<path d="M-3 -5V3M3 -5V3" ${SK}/><circle cx="-3" cy="3.8" r="1.2"/><circle cx="3" cy="3.8" r="1.2"/>`],
    ['Root traces', `<path d="M0 -5V0M0 0L-4 5M0 0L4 5M0 0V5M0 -2L-2.5 0" ${SK}/>`],
    ['Shell fragments', `<path d="M-7 -1A3 3 0 0 0 -1 -1Z M1 3A3 3 0 0 0 7 3Z" ${SK} stroke-width=".9"/>`],
  ]],
  ['Diagenetic & weathering', [
    ['Concretions / nodules', `<ellipse cx="0" cy="0" rx="6" ry="3.8" ${SK}/>`],
    ['Iron nodules', `<ellipse cx="-3" cy="0" rx="3.5" ry="2.6" fill="#8b2a12"/><ellipse cx="4.2" cy="1" rx="2.5" ry="1.9" fill="#8b2a12"/>`],
    ['Iron banding / Liesegang', `<path d="M-8 4Q0 -8 8 4M-5 4Q0 -3 5 4M-2 4Q0 1 2 4" fill="none" stroke="#a0301a" stroke-width="1.1"/>`],
    ['Mottling', `<circle cx="-4.5" cy="-1" r="2.6" fill="#a0522d" fill-opacity=".75"/><circle cx="2" cy="1.8" r="1.8" fill="#a0522d" fill-opacity=".75"/><circle cx="5.5" cy="-2.5" r="1.2" fill="#a0522d" fill-opacity=".75"/>`],
    ['Bleaching / leaching', `<rect x="-7" y="-4" width="14" height="8" fill="#fff" stroke="#888" stroke-dasharray="1.5 1.2"/>`],
  ]],
];
const STRUCT_GLYPH = Object.fromEntries(STRUCTURES.flatMap(g => g[1]));
const structAt = (name, x, y, k = 1) => STRUCT_GLYPH[name]
  ? `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${k.toFixed(2)})">${STRUCT_GLYPH[name]}</g>` : '';
const glyphAt = (name, x, y) => MOD_GLYPH[name]
  ? `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><circle r="5" fill="#fff" fill-opacity=".8"/>${MOD_GLYPH[name]}</g>` : '';

// "Sandstone / Siltstone, ferruginous, conglomeratic"
export function bedName(b) {
  const main = [b.lithology || 'Bed', ...(b.inter || []).filter(Boolean)].join(' / ');
  const mods = (b.modifiers || []).map(m => m.toLowerCase());
  return [main, ...mods].join(', ');
}

// Two-colour beds: a main colour plus a second one, and how the two combine.
// 'changing upward to': a sharp colour change inside one bed (e.g. the upper part more oxidised), at colorAt m above the base
export const COLOUR_MODES = ['changing upward to', 'grading upward to', 'varying to', 'mottled with', 'banded with'];
const COLOUR_MODE_LABEL = { 'changing upward to': 'Changes at a level', 'grading upward to': 'Grades up to', 'varying to': 'Varies to', 'mottled with': 'Mottled', 'banded with': 'Banded' };
// where the colour changes, as a fraction of the bed height from the base
function colourChangeAt(b) {
  const th = Number(b.thickness) || 0, at = Number(b.colorAt);
  return th > 0 && at > 0 ? Math.max(0.05, Math.min(0.95, at / th)) : 0.5;
}
function bedColours(b, fallback) {
  let c1 = colourHex(b.color), c2 = colourHex(b.color2), mode = b.color2 ? (b.colorMode || 'varying to') : '';
  // older mottled colours were saved as one text: "A (code) mottled with b (code)"
  if (!b.color2 && / mottled with /i.test(b.color || '')) {
    const [a, z] = b.color.split(/ mottled with /i);
    c1 = colourHex(a); c2 = colourHex(z); mode = 'mottled with';
  }
  c1 = c1 || fallback;
  return c2 && mode ? { c1, c2, mode, at: colourChangeAt(b) } : { c1, c2: null, mode: '' };
}
function mixHex(a, b) {
  const p = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const x = p(a), y = p(b);
  return '#' + x.map((v, k) => Math.round((v + y[k]) / 2).toString(16).padStart(2, '0')).join('');
}
// colour of the symbols' background: decides dark or light symbol ink
const inkBase = bc => (bc.c2 ? mixHex(bc.c1, bc.c2) : bc.c1);
// fill for a bed outline d (box x,y,w,h): one colour, a gradient, mottles or bands
function colourFill(id, d, x, y, w, h, bc) {
  if (!bc.c2) return `<path d="${d}" fill="${bc.c1}"/>`;
  if (bc.mode === 'grading upward to' || bc.mode === 'varying to') {
    const up = bc.mode === 'grading upward to'; // base colour at the bottom, top colour at the top; a range runs left to right
    return `<linearGradient id="${id}" x1="0" y1="${up ? 1 : 0}" x2="${up ? 0 : 1}" y2="0"><stop offset="0" stop-color="${bc.c1}"/><stop offset="1" stop-color="${bc.c2}"/></linearGradient><path d="${d}" fill="url(#${id})"/>`;
  }
  let out = `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bc.c1}"/>`;
  if (bc.mode === 'changing upward to') {
    // lower colour below the change level, upper colour above it; a faint dotted line marks the change (not a bed boundary)
    const yc = y + h * (1 - (bc.at || 0.5));
    out += `<rect x="${x}" y="${y}" width="${w}" height="${(yc - y).toFixed(1)}" fill="${bc.c2}"/>`;
    out += `<line x1="${x}" y1="${yc.toFixed(1)}" x2="${x + w}" y2="${yc.toFixed(1)}" stroke="#000" stroke-opacity=".45" stroke-width=".6" stroke-dasharray="1.5 1.5"/>`;
  } else if (bc.mode === 'banded with') {
    const bh = Math.max(2, Math.min(5, h / 8));
    for (let yy = y + bh; yy < y + h; yy += bh * 2) out += `<rect x="${x}" y="${yy.toFixed(1)}" width="${w}" height="${bh.toFixed(1)}" fill="${bc.c2}"/>`;
  } else {
    // mottles: the same scatter every time for the same bed
    let seed = 0; for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const n = Math.max(3, Math.min(60, Math.round((w * h) / 110)));
    for (let k = 0; k < n; k++) {
      out += `<ellipse cx="${(x + rnd() * w).toFixed(1)}" cy="${(y + rnd() * h).toFixed(1)}" rx="${(2 + rnd() * 3).toFixed(1)}" ry="${(1.5 + rnd() * 2).toFixed(1)}" fill="${bc.c2}"/>`;
    }
  }
  return out + '</g>';
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
    // informal units ("Lower Dolomite"), only when used
    ...(beds.some(b => b.unit) ? [['Unit', i => beds[i].unit ? `${beds[i].unit}\u0000${beds[i].formation || ''}` : '', white]] : []),
  ];
  // a Structures column appears only when some bed has structure symbols, so older logs keep their layout
  const hasStructs = beds.some(b => (b.structSyms || []).some(n => STRUCT_GLYPH[n]));
  const structW = hasStructs ? 46 : 0;
  const colX = 2 + cols.length * 17 + 40, minW = 30, stepW = 13, structX = colX + minW + stepW * 10 + 16, textX = structX + structW + (hasStructs ? 8 : 4), W = textX + 280;
  const heights = beds.map(b => Math.max(10, (Number(b.thickness) || 0) * pxPerM));
  const headTop = 30, headH = 62, top = headTop + headH + 14; // gap keeps the top depth label clear of the header
  const colBottom = top + heights.reduce((a, b) => a + b, 0);
  const order = beds.map((b, i) => i).reverse(); // drawn from the top of the page (youngest) down to the base
  const bedTop = {};
  { let yy = top; for (const i of order) { bedTop[i] = yy; yy += heights[i]; } }

  // Descriptions are centred on the middle of their bed. When neighbouring texts would overlap,
  // they are grouped and the group is centred on its beds as a whole, so every text stays as
  // close to its own bed as the space allows (classic label placement).
  const LH = 12, GAP = 4, descBlocks = {};
  const clusters = []; // { start, items: [{ i, h, ideal }] }
  const clusterH = c => c.items.reduce((s, it) => s + it.h, 0) + GAP * (c.items.length - 1);
  const place = (c, minStart) => {
    let off = 0, sum = 0;
    for (const it of c.items) { sum += it.ideal - off; off += it.h + GAP; }
    c.start = Math.max(minStart, sum / c.items.length);
  };
  const minAfter = k => (k > 0 ? clusters[k - 1].start + clusterH(clusters[k - 1]) + GAP : top - 2);
  for (const i of order) {
    // only the geologist's own comment for the bed is written in the Description column
    const lines = String(beds[i].description || '').split(/\n+/).map(t => t.trim()).filter(Boolean)
      .flatMap(t => wrapText(t, 46).map(line => ({ line, first: true })));
    descBlocks[i] = { y0: bedTop[i] + 10, lines };
    if (!lines.length) continue;
    const h = lines.length * LH, mid = bedTop[i] + heights[i] / 2;
    clusters.push({ items: [{ i, h, ideal: mid - h / 2 }] });
    place(clusters[clusters.length - 1], minAfter(clusters.length - 1));
    // overlapping the group above: join it and centre the joined group again
    while (clusters.length > 1) {
      const k = clusters.length - 1, prev = clusters[k - 1], cur = clusters[k];
      if (cur.start >= prev.start + clusterH(prev) + GAP - 0.01) break;
      prev.items.push(...cur.items); clusters.pop();
      place(prev, minAfter(k - 1));
    }
  }
  let textBottom = top;
  for (const c of clusters) {
    let yy = c.start;
    for (const it of c.items) { descBlocks[it.i].y0 = yy + 9; descBlocks[it.i].mid = bedTop[it.i] + heights[it.i] / 2; descBlocks[it.i].centre = yy + it.h / 2; yy += it.h + GAP; }
    textBottom = yy;
  }

  // legend entries: lithologies and contacts used in this log
  // one entry per lithology + colour, so the swatch matches the beds exactly
  const liths = [];
  const addLith = (name, bc) => {
    if (!name) return;
    const pat = patternFor(name); bc = bc || { c1: DEFAULT_FILL[pat], c2: null, mode: '' };
    const key = [bc.c1, bc.c2, bc.mode].join('|');
    if (!liths.some(l => l.name === name && l.key === key)) liths.push({ name, pat, bc, key });
  };
  for (const b of beds.slice().reverse()) {
    if (b.lithology) addLith(b.lithology, bedColours(b, DEFAULT_FILL[patternFor(b.lithology)]));
    (b.inter || []).forEach(n => addLith(n));
  }
  const contacts = [...new Set(beds.map(b => b.contact).filter(c => ['Erosional', 'Unconformity', 'Gradational', 'Faulted'].includes(c)))];
  const mods = [...new Set(beds.flatMap(b => b.modifiers || []))].filter(m => MOD_GLYPH[m]);
  const anyEstimated = beds.some(b => b.estimated);
  const syms = [...new Set(beds.flatMap(b => b.structSyms || []))].filter(n => STRUCT_GLYPH[n]);
  const legendItems = liths.length + contacts.length + mods.length + syms.length;
  const hasCarb = beds.some(b => isCarbonate(b.lithology));
  // legend runs across the page in rows; the Dunham texture key sits under it
  const legendCols = Math.max(2, Math.floor((W - 20) / 160)), legendColW = (W - 20) / legendCols;
  const legendTop = Math.max(colBottom + 80, textBottom + 24), legendRows = Math.ceil(legendItems / legendCols);
  const legendBottom = legendItems ? legendTop + 20 + legendRows * 22 : colBottom + 50;
  const carbTop = legendBottom + 14;
  const H = hasCarb ? carbTop + 56 : (legendItems ? legendBottom + 10 : colBottom + 75);

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
  s += headBox(colX - 2, (hasStructs ? structX : textX) - colX - 4, 'Lithology', false);
  if (hasStructs) s += headBox(structX - 2, structW + 4, 'Structures', true);
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
    const topIdx = grainIndex(b, true);
    const wTop = topIdx >= 0 ? minW + stepW * topIdx : w; // fining / coarsening upward
    const pat = patternFor(b.lithology);
    const bc = bedColours(b, DEFAULT_FILL[pat]), fill = bc.c1;
    const d =wTop !== w ? `M${colX} ${y}H${colX + wTop}L${colX + w} ${y + h}H${colX}Z` : bedPath(b.shape, colX, colX + w, y, h);
    const inter = (b.inter || []).filter(Boolean);
    if (inter.length) {
      // interbedded: thin alternating stripes of each lithology, clipped to the bed outline
      const cid = `cb${i}`, lithsHere = [{ pat, fill }, ...inter.map(n => { const p = patternFor(n); return { pat: p, fill: DEFAULT_FILL[p] }; })];
      const sh = Math.max(3, Math.min(8, h / 6));
      s += `<clipPath id="${cid}"><path d="${d}"/></clipPath><g clip-path="url(#${cid})">`;
      for (let yy = y, k = 0; yy < y + h; yy += sh, k++) {
        const L = lithsHere[k % lithsHere.length], hh = Math.min(sh, y + h - yy) + 0.3;
        s += `<rect x="${colX}" y="${yy}" width="${Math.max(w, wTop) + 12}" height="${hh}" fill="${L.fill}"/><rect x="${colX}" y="${yy}" width="${Math.max(w, wTop) + 12}" height="${hh}" fill="url(#${L.pat}${isDark(L.fill) ? '-l' : ''})"/>`;
        if (yy > y) s += `<line x1="${colX}" y1="${yy}" x2="${colX + Math.max(w, wTop) + 12}" y2="${yy}" stroke="#000" stroke-opacity=".35" stroke-width=".5"/>`;
      }
      s += `</g><path d="${d}" fill="none" stroke="#000" stroke-width="1"/>`;
    } else {
      s += colourFill(`cf${i}`, d, colX, y, Math.max(w, wTop) + 12, h, bc);
      s += `<path d="${d}" fill="url(#${pat}${isDark(inkBase(bc)) ? '-l' : ''})" stroke="#000" stroke-width="1"/>`;
    }
    // modifier symbols in a row across the middle of the bed
    const modsHere = (b.modifiers || []).filter(m => MOD_GLYPH[m]);
    if (modsHere.length && h >= 7) {
      const usable = Math.min(w, wTop) - 10, n = Math.max(1, Math.min(6, Math.floor(usable / 14)));
      for (let k = 0; k < n; k++) s += glyphAt(modsHere[k % modsHere.length], colX + 6 + (usable * (k + 0.5)) / n, y + h / 2);
    }
    // structure symbols: two per row in the Structures column, centred on the bed, shrunk to fit thin beds
    const symsHere = (b.structSyms || []).filter(n => STRUCT_GLYPH[n]);
    if (symsHere.length) {
      const rows = Math.ceil(symsHere.length / 2), rowH = Math.min(14, h / rows);
      const k = Math.max(0.45, Math.min(1, rowH / 12));
      symsHere.forEach((n, j) => {
        const r = Math.floor(j / 2), inRow = Math.min(2, symsHere.length - r * 2);
        const cx = structX + structW / 2 + (inRow === 2 ? (j % 2 ? 11 : -11) : 0);
        const cy = y + h / 2 + (r - (rows - 1) / 2) * rowH;
        s += structAt(n, cx, cy, k);
      });
    }
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
    // "~" when this height depends on an estimated thickness (this bed or any below it)
    const approx = beds.slice(0, i + 1).some(x => x.estimated) ? '~' : '';
    s += `<line x1="${colX - 14}" y1="${y}" x2="${colX - 10}" y2="${y}" stroke="#000"/><text x="${colX - 16}" y="${y + 4}" font-size="9" text-anchor="end">${approx}${(Math.round(cum * 100) / 100)}</text>`;
    cum -= Number(b.thickness) || 0;
    // description: the name line in normal weight, details a little lighter
    const { y0, lines, mid, centre } = descBlocks[i];
    lines.forEach((d, k) => {
      s += `<text x="${textX}" y="${(y0 + k * LH).toFixed(1)}" font-size="10" fill="${d.first ? '#000' : '#333'}">${esc2(d.line)}</text>`;
    });
    s += `<line x1="${colX + wTop}" y1="${y}" x2="${textX - 4}" y2="${y}" stroke="#ccc" stroke-dasharray="2 2"/>`;
    // text that had to move away from its bed's middle: a thin leader points back to the bed
    if (lines.length && Math.abs(centre - mid) > 5) s += `<line x1="${textX - 8}" y1="${mid.toFixed(1)}" x2="${textX - 2}" y2="${centre.toFixed(1)}" stroke="#999" stroke-width=".7"/>`;
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
  s += `<text x="${colX}" y="${base + 26}" font-size="9" fill="#555">Grain size · scale 1 m = ${pxPerM.toFixed(0)} px${anyEstimated ? ' · ~ = estimated thickness' : ''}</text>`;
  // second scale for carbonate beds: Dunham texture letters on the same width axis
  if (hasCarb) {
    const dy = carbTop + 26;
    s += `<text x="10" y="${carbTop + 8}" font-size="11" font-weight="bold">Carbonate texture (Dunham)</text>`;
    s += `<line x1="${colX}" y1="${dy}" x2="${end}" y2="${dy}" stroke="#000" stroke-width="1.2"/>`;
    const usesX = beds.some(b => isCarbonate(b.lithology) && (b.texture === 'Crystalline' || b.textureTop === 'Crystalline'));
    DUNHAM.filter(d => d[0] !== 'Crystalline' || usesX).forEach(([name, a, p]) => {
      const grey = name === 'Crystalline' ? ' fill="#777"' : '';
      s += `<line x1="${gx(p)}" y1="${dy}" x2="${gx(p)}" y2="${dy - 4}" stroke="#000"/><text x="${gx(p)}" y="${dy + 11}" font-size="${grey ? 8 : 9}" font-weight="bold" text-anchor="middle"${grey}>${a}</text>`;
    });
    s += `<text x="${colX}" y="${dy + 25}" font-size="9" fill="#555">M mud · W wacke · P pack · G grain · F float · R rud · B boundstone${usesX ? ' · X crystalline' : ''}</text>`;
  }

  // legend
  if (legendItems) {
    s += `<line x1="10" y1="${legendTop - 8}" x2="${W - 10}" y2="${legendTop - 8}" stroke="#ccc"/>
      <text x="10" y="${legendTop + 8}" font-size="11" font-weight="bold">Legend</text>`;
    // A–Z within each group (rocks, modifiers, structures, contacts); same rock in several colours stays together
    const az = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });
    const items = [
      ...liths.slice().sort((a, b) => az(a.name, b.name) || az(a.key, b.key)).map(l => ['lith', l]),
      ...mods.slice().sort(az).map(m => ['mod', m]),
      ...syms.slice().sort(az).map(n => ['struct', n]),
      ...contacts.slice().sort(az).map(c => ['contact', c]),
    ];
    items.forEach(([kind, name], n) => {
      const x = 10 + (n % legendCols) * legendColW, yy = legendTop + 20 + Math.floor(n / legendCols) * 22;
      if (kind === 'lith') {
        s += colourFill(`lg${n}`, `M${x} ${yy}h28v16h-28Z`, x, yy, 28, 16, name.bc);
        s += `<rect x="${x}" y="${yy}" width="28" height="16" fill="url(#${name.pat}${isDark(inkBase(name.bc)) ? '-l' : ''})" stroke="#000" stroke-width=".8"/>`;
        s += `<text x="${x + 36}" y="${yy + 12}" font-size="10">${esc2(name.name)}</text>`;
        return;
      } else if (kind === 'struct') {
        s += `<rect x="${x}" y="${yy}" width="28" height="16" fill="#fff" stroke="#000" stroke-width=".8"/>${structAt(name, x + 14, yy + 8, 0.95)}`;
      } else if (kind === 'mod') {
        s += `<rect x="${x}" y="${yy}" width="28" height="16" fill="#fff" stroke="#000" stroke-width=".8"/>${glyphAt(name, x + 14, yy + 8)}`;
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
  removeCycleLabels(st);
  summariseOldMerges(st);
  const beds = st.log.beds;
  const total = beds.reduce((a, b) => a + (Number(b.thickness) || 0), 0);
  body.innerHTML = `
    <div class="card"><div class="kv"><div>Station</div><div>${esc(st.code)} · ${esc(st.attrs.formation || 'formation not set')}</div>
      <div>Beds</div><div>${beds.length} · total ${Math.round(total * 100) / 100} m</div></div>
      <div class="btns"><button class="btn primary" id="lg-add">+ Add bed on top</button><button class="btn" id="lg-open">Station data</button></div></div>
    ${beds.length ? `<div class="log-svg-wrap">${logSvg(st)}</div>
      <div class="card"><table class="tbl"><tr><th>#</th><th>Lithology</th><th>m</th><th>Grain / texture</th></tr>
      ${beds.map((b, i) => ({ b, i })).reverse().map(({ b, i }) => `<tr data-i="${i}"><td>${i + 1}</td><td>${esc(b.lithology ? bedName(b) : '')}${b.formation || b.unit ? `<div class="muted">${esc([b.formation, b.member, b.unit].filter(Boolean).join(' / '))}</div>` : ''}</td><td>${b.estimated ? '~' : ''}${esc(b.thickness)}</td><td>${esc((isCarbonate(b.lithology) && b.texture ? [b.texture, b.textureTop] : [b.grain, b.grainTop]).filter(Boolean).join(' → '))}</td></tr>`).join('')}
      </table><p class="muted">Bed 1 is the base. Tap a bed to edit or copy it · press and hold a bed to move it.</p>
      <div class="btns"><button class="btn" id="lg-repeat">Repeat beds…</button></div>
      <div class="btns"><button class="btn" id="lg-pdf">Export PDF</button><button class="btn" id="lg-png">Export PNG</button><button class="btn" id="lg-svg">Export SVG</button></div></div>`
    : '<div class="empty">No beds yet. Start from the base of the section and add beds upward.</div>'}`;
  $('#lg-add').onclick = () => editBed(st, null);
  $('#lg-open').onclick = () => nav.openStation(st.id, 'data');
  body.querySelectorAll('tr[data-i]').forEach(r => bindBedRow(r, st));
  const svgBtn = $('#lg-svg');
  if (svgBtn) {
    $('#lg-repeat').onclick = () => repeatBeds(st);
    svgBtn.onclick = () => saveFile(new Blob([logSvg(st)], { type: 'image/svg+xml' }), `${st.code}_log.svg`);
    $('#lg-png').onclick = () => exportPng(st);
    $('#lg-pdf').onclick = () => exportPdf(st);
  }
}

// One-time clean-up, Nov 2026: the MM-COMPOSITE log was delivered with "Cycle 2." etc. at the start of
// four descriptions; the geologist asked for them to go. Runs once per station, then never again.
function removeCycleLabels(st) {
  if (st.code !== 'MM-COMPOSITE' || st.log.cycleLabelsRemoved) return;
  const strip = t => String(t || '').replace(/(^|\n)Cycle \d+( of \d+)?\.\s*([a-z]?)/g, (m, start, of, c) => start + c.toUpperCase());
  const clean = b => {
    if (b.description) b.description = strip(b.description);
    if (b.notes) b.notes = strip(b.notes);
    (b.mergedFrom || []).forEach(clean);
  };
  st.log.beds.forEach(clean);
  st.log.cycleLabelsRemoved = true;
  saveStation(st);
}

// One-time update: beds merged before merges wrote a summary only have the two old descriptions
// one under the other. Give them the summary now, the same one a merge writes today. Recognised by:
// remembering their two original beds without own notes (merged with v23–v26), or, in MM-COMPOSITE,
// a description on two lines (merged with v22, which joined the two descriptions with a line break).
function summariseOldMerges(st) {
  if (st.log.oldMergesSummarised) return;
  let changed = false;
  for (const b of st.log.beds) {
    if (b.notes != null) continue; // already has a summary
    const remembered = (b.mergedFrom || []).length === 2;
    const twoLines = st.code === 'MM-COMPOSITE' && /\n/.test(b.description || '');
    if (!remembered && !twoLines) continue;
    b.description = bedSummary(b);
    changed = true;
  }
  st.log.oldMergesSummarised = true;
  saveStation(st);
  if (changed) setTimeout(() => toast('Merged beds now have a summary description'), 300);
}

// tap = edit; press and hold (0.5 s) = move menu
function bindBedRow(row, st) {
  const i = Number(row.dataset.i);
  let timer = null, held = false, sx = 0, sy = 0;
  const cancel = () => { clearTimeout(timer); timer = null; row.classList.remove('pressing'); };
  row.addEventListener('pointerdown', e => {
    held = false; sx = e.clientX; sy = e.clientY;
    row.classList.add('pressing');
    timer = setTimeout(() => {
      timer = null; held = true; row.classList.remove('pressing');
      if (navigator.vibrate) navigator.vibrate(30);
      moveBed(st, i);
    }, 500);
  });
  row.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => row.addEventListener(ev, cancel));
  row.addEventListener('contextmenu', e => e.preventDefault());
  row.addEventListener('click', () => { if (held) { held = false; return; } editBed(st, i); });
}

const bedLabel = (b, n) => `${n}. ${b.lithology || 'Bed'}${b.thickness ? ' · ' + b.thickness + ' m' : ''}`;

// Repeat a group of beds (a cycle) several times: copies go straight on top of the group.
function repeatBeds(st) {
  const beds = st.log.beds;
  const optsFor = sel => beds.map((b, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(bedLabel(b, i + 1))}</option>`).reverse().join('');
  const last = beds.length - 1;
  const body = openModal('Repeat beds', `
    <p class="muted">Log one cycle (e.g. sandstone → siltstone → claystone), then repeat it. The copies are added on top of the cycle.</p>
    <div class="field"><label>Cycle starts at (lowest bed)</label><select id="rp-from">${optsFor(Math.max(0, last - 2))}</select></div>
    <div class="field"><label>Cycle ends at (highest bed)</label><select id="rp-to">${optsFor(last)}</select></div>
    <div class="field"><label>Total number of cycles (including this one)</label><input type="number" inputmode="numeric" id="rp-n" value="4" min="2" max="50"></div>
    <p class="muted" id="rp-info"></p>
    <div class="btns"><button class="btn primary" id="rp-go">Repeat</button><button class="btn" id="rp-cancel">Cancel</button></div>`);
  const read = () => {
    let a = Number(body.querySelector('#rp-from').value), b = Number(body.querySelector('#rp-to').value);
    if (a > b) [a, b] = [b, a];
    const n = Math.round(Number(body.querySelector('#rp-n').value));
    return { a, b, n };
  };
  const info = () => {
    const { a, b, n } = read();
    const th = beds.slice(a, b + 1).reduce((s, x) => s + (Number(x.thickness) || 0), 0);
    body.querySelector('#rp-info').textContent = n >= 2
      ? `Cycle = beds ${a + 1}–${b + 1} (${b - a + 1} beds, ${Math.round(th * 100) / 100} m). Adds ${(n - 1) * (b - a + 1)} beds, ${Math.round(th * (n - 1) * 100) / 100} m.`
      : 'Enter at least 2 cycles.';
  };
  body.querySelectorAll('select, input').forEach(el => el.addEventListener('input', info));
  info();
  body.querySelector('#rp-cancel').onclick = closeModal;
  body.querySelector('#rp-go').onclick = async () => {
    const { a, b, n } = read();
    if (!(n >= 2 && n <= 50)) { toast('Enter between 2 and 50 cycles'); return; }
    const group = beds.slice(a, b + 1);
    const copies = [];
    for (let k = 1; k < n; k++) for (const x of group) copies.push({ ...x, id: uid(), sample: '', modifiers: [...(x.modifiers || [])], inter: [...(x.inter || [])], structSyms: [...(x.structSyms || [])] });
    beds.splice(b + 1, 0, ...copies);
    await saveStation(st); closeModal(); renderLog();
    toast(`Added ${copies.length} beds (${n} cycles)`);
  };
}

// choose where a bed goes: top, base, or between two other beds
function moveBed(st, from, title) {
  const beds = st.log.beds;
  const moving = beds[from];
  const rest = beds.filter((_, k) => k !== from);
  const slot = k => {
    const where = k === rest.length ? 'Move to the top' : k === 0 ? 'Move to the base' : `Between ${rest[k - 1].lithology || 'bed'} and ${rest[k].lithology || 'bed'}`;
    return k === from
      ? `<div class="mv-slot mv-here">● Current position</div>`
      : `<button type="button" class="mv-slot" data-k="${k}">↳ ${esc(where)}</button>`;
  };
  let html = `<p class="muted">Bed ${from + 1}: <b>${esc(moving.lithology || 'Bed')}</b>${moving.thickness ? ' · ' + esc(moving.thickness) + ' m' : ''}. Tap where it should go (top of the list = top of the log).</p><div class="mv-list">`;
  for (let k = rest.length; k >= 0; k--) {
    html += slot(k);
    if (k > 0) {
      const b = rest[k - 1], orig = beds.indexOf(b);
      html += `<div class="mv-bed"><span class="lp-sw small">${lithSwatch(b.lithology, 30, 24, colourHex(b.color))}</span>${esc(bedLabel(b, orig + 1))}</div>`;
    }
  }
  html += `</div><div class="btns"><button class="btn" id="mv-cancel">Cancel</button></div>`;
  ensureDefs();
  const body = openModal(title || 'Move bed', html);
  body.querySelector('#mv-cancel').onclick = () => { closeModal(); renderLog(); };
  body.querySelectorAll('button.mv-slot').forEach(btn => btn.onclick = async () => {
    const k = Number(btn.dataset.k);
    rest.splice(k, 0, moving);
    st.log.beds = rest;
    await saveStation(st); closeModal(); renderLog();
    toast(`Bed moved to position ${k + 1} of ${rest.length}`);
  });
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

// PDF: the log drawn as vectors (sharp at any zoom, text selectable), one page sized to the log.
// Falls back to a high-resolution picture inside the PDF if the vector conversion fails.
export const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
export const SVG2PDF_URL = 'https://unpkg.com/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js';
async function exportPdf(st) {
  toast('Preparing PDF…', 3000);
  try { await loadScript(JSPDF_URL); await loadScript(SVG2PDF_URL); }
  catch (e) { toast('PDF needs an internet connection the first time; use PNG for now', 5000); return; }
  const svgText = logSvg(st);
  const el = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  const W = Number(el.getAttribute('width')), H = Number(el.getAttribute('height'));
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: H > W ? 'portrait' : 'landscape', unit: 'pt', format: [W, H] });
  doc.setProperties({ title: `${st.code} stratigraphic log`, creator: 'GeoField' });
  const holder = document.createElement('div'); // the converter measures text, so the drawing must be in the page
  holder.style.cssText = 'position:absolute;left:-99999px;top:0;';
  holder.appendChild(el); document.body.appendChild(holder);
  try {
    await doc.svg(el, { x: 0, y: 0, width: W, height: H });
  } catch (e) {
    // picture fallback: render at 4x and place it on the page
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const k = Math.min(4, Math.sqrt(16e6 / (W * H))); // stay under the iPhone canvas limit
      const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.scale(k, k); ctx.drawImage(img, 0, 0);
      doc.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, W, H);
    } catch (e2) { holder.remove(); toast('PDF export failed; use PNG'); return; }
    finally { URL.revokeObjectURL(url); }
  }
  holder.remove();
  await saveFile(doc.output('blob'), `${st.code}_log.pdf`);
}

// One bed from two neighbours: the lower bed keeps its base (contact, base grain, formation),
// and the upper bed's grain/texture/colour become the top of the bed.
// opts.how: 'inter' = different rocks, the upper rock becomes "interbedded with";
//           'same'  = same unit (e.g. one part more oxidised): one rock type, both colours kept.
// opts.colour: how two different colours are drawn (a COLOUR_MODES value).
export function mergeBeds(lo, up, opts = {}) {
  const how = opts.how || 'inter', colourMode = opts.colour || 'grading upward to';
  const uniq = list => [...new Set(list.filter(Boolean))];
  const joinText = (a, b, sep) => uniq([a, b].map(x => String(x || '').trim())).join(sep);
  const lith = lo.lithology || up.lithology || '';
  const inter = uniq([...(lo.inter || []), ...(how === 'inter' ? [up.lithology] : []), ...(up.inter || [])]).filter(n => n !== lith).slice(0, 2);
  const upTopGrain = up.grainTop || up.grain || '', upTopTex = up.textureTop || up.texture || '';
  const m = {
    ...lo,
    thickness: Math.round(((Number(lo.thickness) || 0) + (Number(up.thickness) || 0)) * 1000) / 1000,
    estimated: !!(lo.estimated || up.estimated),
    lithology: lith,
    inter,
    modifiers: uniq([...(lo.modifiers || []), ...(up.modifiers || [])]),
    structSyms: uniq([...(lo.structSyms || []), ...(up.structSyms || [])]),
    grainTop: upTopGrain && upTopGrain !== lo.grain ? upTopGrain : (lo.grainTop || ''),
    textureTop: upTopTex && upTopTex !== lo.texture ? upTopTex : (lo.textureTop || ''),
    structures: joinText(lo.structures, up.structures, '; '),
    fossils: joinText(lo.fossils, up.fossils, '; '),
    description: joinText(lo.description, up.description, '\n'),
    sample: joinText(lo.sample, up.sample, ', '),
    unit: lo.unit || up.unit || '',
    // the two original beds, so the merge can be undone later ("Split back into 2 beds")
    mergedFrom: JSON.parse(JSON.stringify([lo, up])),
  };
  if (!lo.color && up.color) m.color = up.color;
  else if (up.color && up.color !== lo.color) {
    // different colours: keep both, drawn the way the geologist chose
    m.color = lo.color; m.color2 = up.color; m.colorMode = colourMode;
    m.colorAt = colourMode === 'changing upward to' ? (Number(lo.thickness) || 0) : '';
  }
  return m;
}

// Cut any bed into a lower and an upper part (also for beds merged before merges were remembered).
// A two-colour bed gives its first colour to the lower part and its second to the upper part;
// an interbedded bed can give each part one of its rocks; a description on two lines is shared out.
export function cutBed(b, lowerTh, lowerLith, upperLith) {
  const th = Number(b.thickness) || 0;
  const lo = JSON.parse(JSON.stringify(b)), up = JSON.parse(JSON.stringify(b));
  delete lo.mergedFrom; delete up.mergedFrom; delete lo.notes; delete up.notes;
  up.id = uid();
  lo.thickness = Math.round(lowerTh * 1000) / 1000;
  up.thickness = Math.round((th - lowerTh) * 1000) / 1000;
  lo.lithology = lowerLith || b.lithology; up.lithology = upperLith || b.lithology;
  // different rocks chosen for the two parts: each part is now a single rock
  if (!(lo.lithology === b.lithology && up.lithology === b.lithology)) { lo.inter = []; up.inter = []; }
  // grain / texture: base of the bed stays with the lower part, the top with the upper part
  lo.grainTop = ''; up.grain = b.grainTop || b.grain || ''; up.grainTop = '';
  lo.textureTop = ''; up.texture = b.textureTop || b.texture || ''; up.textureTop = '';
  if (b.color2) {
    lo.color = b.color; up.color = b.color2;
    for (const x of [lo, up]) { x.color2 = ''; x.colorMode = ''; x.colorAt = ''; }
  }
  up.contact = b.colorMode === 'changing upward to' || lo.lithology === up.lithology ? 'Gradational' : 'Sharp';
  const lines = String(b.description || '').split(/\n+/).filter(t => t.trim());
  if (lines.length >= 2) { lo.description = lines[0]; up.description = lines.slice(1).join('\n'); }
  up.sample = '';
  return [lo, up];
}

function splitDialog(st, i) {
  const beds = st.log.beds, b = beds[i];
  const th = Number(b.thickness) || 0;
  const liths = [...new Set([b.lithology, ...(b.inter || [])].filter(Boolean))];
  const defAt = b.colorMode === 'changing upward to' && Number(b.colorAt) > 0 ? Number(b.colorAt) : Math.round(th / 2 * 100) / 100;
  const lithOpts = sel => liths.map(n => `<option ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const body = openModal('Split bed in two', `
    <p class="muted">Bed ${i + 1}: <b>${esc(bedName(b))}</b> · ${esc(b.thickness)} m. It becomes a lower and an upper bed; everything else is copied to both, so you can then edit each one.</p>
    <div class="field"><label>Thickness of the lower part (m)</label><input type="number" inputmode="decimal" step="any" id="sp-th" value="${defAt}"></div>
    <p class="muted" id="sp-info"></p>
    ${liths.length > 1 ? `<div class="grid2">
      <div class="field"><label>Lower part rock</label><select id="sp-lo">${lithOpts(b.lithology)}</select></div>
      <div class="field"><label>Upper part rock</label><select id="sp-up">${lithOpts(liths[1])}</select></div></div>` : ''}
    ${b.color2 ? `<p class="muted">Colours: lower part ${esc(stripCode(b.color))}, upper part ${esc(stripCode(b.color2))}.</p>` : ''}
    <div class="btns"><button class="btn primary" id="sp-go">Split</button><button class="btn" id="sp-cancel">Cancel</button></div>`);
  const thIn = body.querySelector('#sp-th');
  const info = () => { const x = Number(thIn.value); body.querySelector('#sp-info').textContent = x > 0 && x < th ? `Lower ${x} m + upper ${Math.round((th - x) * 1000) / 1000} m` : `Enter a value between 0 and ${th}`; };
  thIn.addEventListener('input', info); info();
  body.querySelector('#sp-cancel').onclick = () => { closeModal(); editBed(st, i); };
  body.querySelector('#sp-go').onclick = async () => {
    const x = Number(thIn.value);
    if (!(x > 0 && x < th)) { toast(`Lower part must be between 0 and ${th} m`); return; }
    const loL = body.querySelector('#sp-lo')?.value, upL = body.querySelector('#sp-up')?.value;
    beds.splice(i, 1, ...cutBed(b, x, loL, upL));
    await saveStation(st); closeModal(); renderLog();
    toast(`Bed ${i + 1} split into beds ${i + 1} and ${i + 2}`);
  };
}

// Description for a merged bed: a summary built from the beds' data (rock, grain trend, colours,
// structures), then the geologist's own notes from both beds without repeated sentences.
// Works offline; the result is shown for editing before the merge.
// sentences of a text, without end punctuation
const sentencesOf = d => String(d || '').replace(/([.;!?])\s+/g, '$1\n').split(/\n+/).map(s => s.trim().replace(/[.;]+$/, '')).filter(Boolean);
// the geologist's own notes for a bed: a merged bed keeps them apart from its generated summary
const notesOf = b => (b.notes != null ? sentencesOf(b.notes) : sentencesOf(b.description));
export function mergedDescription(lo, up, m) {
  let text = summaryLine(m);
  // the geologist's notes: each sentence once, lower bed first
  const seen = new Set(), keep = list => list.filter(s => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const loN = keep(notesOf(lo)), upN = keep(notesOf(up));
  if (loN.length && upN.length) text += ` Lower part: ${loN.join('; ')}. Upper part: ${upN.join('; ')}.`;
  else if (loN.length || upN.length) text += ' ' + [...loN, ...upN].join('; ') + '.';
  return text;
}

// "Write summary" in the bed form: the summary sentence from the bed's data, then the geologist's notes.
// A merged bed that remembers its two beds gets "Lower part / Upper part" notes. The bed's own notes are kept
// apart (b.notes), so pressing the button again never puts the old summary inside the new one.
export function bedSummary(b) {
  const generated = new Set(sentencesOf(summaryLine(b)).map(s => s.toLowerCase()));
  const own = notesOf(b).filter(s => !generated.has(s.toLowerCase()));
  const [lo, up] = b.mergedFrom || [];
  if (lo && up) {
    const parts = new Set([...notesOf(lo), ...notesOf(up)].map(s => s.toLowerCase()));
    const extra = own.filter(s => !parts.has(s.toLowerCase()));
    b.notes = [...notesOf(lo), ...notesOf(up), ...extra].join('\n');
    return mergedDescription(lo, up, b) + (extra.length ? ' ' + extra.join('; ') + '.' : '');
  }
  b.notes = own.join('\n');
  return summaryLine(b) + (own.length ? ' ' + own.join('; ') + '.' : '');
}

// the opening sentence of a summary, written from the bed's data
function summaryLine(m) {
  const lc = s => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '');
  const r2 = x => Math.round((Number(x) || 0) * 100) / 100;
  const parts = [];
  // rock: "Ferruginous, hematitic sandstone" or "Sandstone interbedded with siltstone"
  const mods = (m.modifiers || []).map(lc);
  let rock = (mods.length ? mods.join(', ') + ' ' + lc(m.lithology || 'bed') : (m.lithology || 'Bed'));
  rock = rock.charAt(0).toUpperCase() + rock.slice(1);
  if ((m.inter || []).length) rock += ' interbedded with ' + m.inter.map(lc).join(' and ');
  parts.push(`${rock}, ${r2(m.thickness)} m`);
  // grain or carbonate texture trend
  const carb = isCarbonate(m.lithology) && m.texture;
  const a = carb ? m.texture : m.grain, t = carb ? m.textureTop : m.grainTop;
  if (a && t && a !== t) {
    const finer = carb ? dunhamPos(t) < dunhamPos(a) : GRAINS.indexOf(t) < GRAINS.indexOf(a);
    parts.push(carb ? `${lc(a)} passing upward into ${lc(t)}` : `${finer ? 'fining' : 'coarsening'} upward from ${lc(a)} to ${lc(t)}`);
  } else if (a) parts.push(lc(a));
  // colours
  const c1 = lc(stripCode(m.color)), c2 = lc(stripCode(m.color2));
  if (c1 && c2) {
    const at = r2(m.colorAt), above = r2((Number(m.thickness) || 0) - at);
    parts.push({
      'changing upward to': at ? `${c1} in the lower ${at} m, ${c2} in the upper ${above} m` : `${c1} below, ${c2} above`,
      'grading upward to': `${c1} grading upward into ${c2}`,
      'varying to': `${c1} to ${c2}`,
      'mottled with': `${c1} mottled ${c2}`,
      'banded with': `${c1} with ${c2} bands`,
    }[m.colorMode] || `${c1} and ${c2}`);
  } else if (c1) parts.push(c1);
  const syms = (m.structSyms || []).map(lc);
  if (syms.length) parts.push(syms.join(', '));
  return parts.join('; ') + '.';
}

// Merge menu: how to join bed i with the bed above it
function mergeDialog(st, i, lo) {
  const beds = st.log.beds, up = beds[i + 1];
  const sameRock = (lo.lithology || '') === (up.lithology || '');
  const twoColours = !!(lo.color && up.color && lo.color !== up.color);
  const line = (b, n) => `<div class="mv-bed"><span class="lp-sw small">${lithSwatch(b.lithology, 30, 24, colourHex(b.color))}</span>Bed ${n}: ${esc(b.lithology || 'Bed')} · ${esc(b.thickness)} m${b.color ? ' · ' + esc(stripCode(b.color)) : ''}</div>`;
  ensureDefs();
  const body = openModal('Merge beds', `
    <div class="mv-list">${line(up, i + 2)}${line(lo, i + 1)}</div>
    <div class="field"><label>How are they related?</label>
      <label class="check small-check choice"><input type="radio" name="mg-how" value="same" ${sameRock ? 'checked' : ''}> Same unit, keep both colours (e.g. one part more oxidised)</label>
      <label class="check small-check choice"><input type="radio" name="mg-how" value="inter" ${sameRock ? '' : 'checked'}> Different rocks, interbedded</label></div>
    ${twoColours ? `<div class="field"><label>Show the two colours as</label><select id="mg-col">
      <option value="changing upward to">Colour change at the same level</option>
      <option value="grading upward to">Grading upward</option>
      <option value="varying to">Varying</option>
      <option value="mottled with">Mottled</option>
      <option value="banded with">Banded</option></select>
      <p class="muted" style="margin:6px 2px 0">Colour change: each colour stays where it was, with no bed boundary between them.</p></div>` : ''}
    <div class="field"><label>Description of the merged bed</label>
      <p class="muted" style="margin:0 2px 6px">A summary written from both beds. You can edit it.</p>
      <textarea id="mg-desc" rows="6"></textarea>
      <button type="button" class="btn small" id="mg-regen" style="margin-top:6px">Write the summary again</button></div>
    <div class="btns"><button class="btn primary" id="mg-go">Merge</button><button class="btn" id="mg-cancel">Cancel</button></div>`);
  const choice = () => ({ how: body.querySelector('input[name="mg-how"]:checked').value, colour: twoColours ? body.querySelector('#mg-col').value : undefined });
  const desc = body.querySelector('#mg-desc');
  let edited = false;
  const regen = () => { desc.value = mergedDescription(lo, up, mergeBeds(lo, up, choice())); edited = false; };
  desc.addEventListener('input', () => { edited = true; });
  // the summary follows the choices above until the geologist types in it
  body.querySelectorAll('input[name="mg-how"], #mg-col').forEach(el => el.addEventListener('change', () => { if (!edited) regen(); }));
  body.querySelector('#mg-regen').onclick = regen;
  regen();
  body.querySelector('#mg-cancel').onclick = () => { closeModal(); editBed(st, i); };
  body.querySelector('#mg-go').onclick = async () => {
    const m = mergeBeds(lo, up, choice());
    const generated = new Set(sentencesOf(mergedDescription(lo, up, m)).map(s => s.toLowerCase()));
    // raw notes of both beds, plus any sentence the geologist added in the box
    const notes = [...notesOf(lo), ...notesOf(up), ...sentencesOf(desc.value).filter(s => !generated.has(s.toLowerCase()))];
    m.notes = [...new Map(notes.map(s => [s.toLowerCase(), s])).values()].join('\n');
    m.description = desc.value.trim();
    beds[i] = m;
    beds.splice(i + 1, 1);
    await saveStation(st); closeModal(); renderLog();
    toast(`Beds ${i + 1} and ${i + 2} merged: ${beds[i].thickness} m`);
  };
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
    formation: prev ? prev.formation : (st.attrs.formation || ''), member: prev ? prev.member : (st.attrs.member || ''), unit: prev ? prev.unit || '' : '',
  } : { ...beds[index] };
  // informal unit names already used in any log, offered as suggestions
  const unitNames = [...new Set(state.stations.flatMap(s => ((s.log && s.log.beds) || []).map(x => x.unit)).filter(Boolean))].sort();
  const memberOpts = fmName => { const fm = findFormation(fmName); return opts(fm ? fm.members : [], b.member); };
  const body = openModal(index == null ? `New bed ${beds.length + 1}` : `Bed ${index + 1}`, `
    <div class="grid2">
      <div class="field"><label>Formation</label><select id="bd-fm">${opts(FORMATION_NAMES, b.formation)}</select></div>
      <div class="field"><label>Member</label><select id="bd-mbr">${memberOpts(b.formation)}</select></div>
    </div>
    <div class="field"><label>Informal unit <span class="muted">(own name, e.g. Lower Dolomite)</span></label>
      <input type="text" id="bd-unit" list="bd-unit-list" value="${esc(b.unit || '')}" autocomplete="off">
      <datalist id="bd-unit-list">${unitNames.map(u => `<option value="${esc(u)}">`).join('')}</datalist></div>
    <div class="grid2">
      <div class="field"><label>Thickness (m)</label><input type="number" inputmode="decimal" step="any" id="bd-th" value="${esc(b.thickness)}">
        <label class="check small-check"><input type="checkbox" id="bd-est" ${b.estimated ? 'checked' : ''}> Estimated (~)</label></div>
      <div class="field"><label>Base contact</label>${visualFieldHtml('contact', 'bd-contact', b.contact)}</div>
    </div>
    <div class="field"><label>Lithology</label>${visualFieldHtml('lith', 'bd-lith', b.lithology)}</div>
    <div class="field"><label>Modifiers <span class="muted">(tap all that apply)</span></label><div class="mod-chips" id="bd-mods">
      ${MODIFIERS.map(([m, g]) => `<button type="button" class="mod-chip ${(b.modifiers || []).includes(m) ? 'on' : ''}" data-m="${m}">${g ? `<svg width="16" height="14" viewBox="-8 -7 16 14">${g}</svg>` : ''}${m}</button>`).join('')}
    </div></div>
    <div class="grid2">
      <div class="field"><label>Interbedded with</label>${visualFieldHtml('lith', 'bd-inter1', (b.inter || [])[0], 'None')}</div>
      <div class="field"><label>and</label>${visualFieldHtml('lith', 'bd-inter2', (b.inter || [])[1], 'None')}</div>
    </div>
    <div class="grid2" id="bd-clastic-row">
      <div class="field"><label>Grain size (base)</label><select id="bd-grain">${opts(GRAINS, b.grain)}</select></div>
      <div class="field"><label>Grain at top</label><select id="bd-grain-top">${opts(GRAINS, b.grainTop).replace('<option value=""></option>', '<option value="">Same as base</option>')}</select></div>
    </div>
    <div class="grid2" id="bd-carb-row">
      <div class="field"><label>Texture (Dunham)</label><select id="bd-tex">${opts(DUNHAM_NAMES, b.texture)}</select></div>
      <div class="field"><label>Texture at top</label><select id="bd-tex-top">${opts(DUNHAM_NAMES, b.textureTop).replace('<option value=""></option>', '<option value="">Same as base</option>')}</select></div>
    </div>
    <p class="muted" id="bd-trend" style="margin:-4px 0 8px"></p>
    <div class="field"><label>Shape in log</label>${visualFieldHtml('shape', 'bd-shape', b.shape)}</div>
    <div class="field"><label>Colour</label>${colourFieldHtml('bd-color', b.color, 'id')}</div>
    <div class="grid2">
      <div class="field"><label>Second colour</label><select id="bd-cmode"><option value="">None</option>
        ${COLOUR_MODES.map(m => `<option value="${m}" ${b.color2 && (b.colorMode || 'varying to') === m ? 'selected' : ''}>${COLOUR_MODE_LABEL[m]}</option>`).join('')}</select></div>
      <div class="field" id="bd-color2-f"><label>&nbsp;</label>${colourFieldHtml('bd-color2', b.color2, 'id')}</div>
    </div>
    <div class="field" id="bd-cat-f"><label>Colour changes at (m above the base of the bed)</label>
      <input type="number" inputmode="decimal" step="any" id="bd-cat" value="${esc(b.colorAt || '')}" placeholder="middle of the bed"></div>
    <div class="field"><label>Sedimentary structures <span class="muted">(drawn in the log)</span></label>
      ${STRUCTURES.map(([g, list]) => `<div class="group-title" style="margin:6px 2px 4px">${g}</div><div class="mod-chips">
        ${list.map(([n, gl]) => `<button type="button" class="mod-chip struct-chip ${(b.structSyms || []).includes(n) ? 'on' : ''}" data-s="${esc(n)}"><svg width="22" height="16" viewBox="-11 -8 22 16">${gl}</svg>${esc(n)}</button>`).join('')}
      </div>`).join('')}</div>
    <div class="field"><label>Other structures / notes</label><input type="text" id="bd-struct" value="${esc(b.structures)}" placeholder="e.g. set thickness 20 cm, foresets dip 25° SE"></div>
    <div class="field"><label>Fossils</label><input type="text" id="bd-fossils" value="${esc(b.fossils)}"></div>
    <div class="field"><label>Description</label><textarea id="bd-desc">${esc(b.description)}</textarea>
      <button type="button" class="btn small" id="bd-summary" style="margin-top:6px">Write summary</button></div>
    <div class="field"><label>Sample no.</label><input type="text" id="bd-sample" value="${esc(b.sample)}"></div>
    <div class="btns"><button class="btn primary" id="bd-save">Save</button>
      ${index != null ? `<button class="btn" id="bd-copy">Copy bed</button><button class="btn" id="bd-move">Move…</button>${index < beds.length - 1 ? '<button class="btn" id="bd-merge">Merge with bed above</button>' : ''}${(b.mergedFrom || []).length === 2 ? '<button class="btn" id="bd-split">Split back into 2 beds</button>' : '<button class="btn" id="bd-cut">Split bed in two…</button>'}<button class="btn danger" id="bd-del">Delete</button>` : ''}</div>`);
  const v = id => body.querySelector(id).value;
  // the colour picker opens on the typical colours of the chosen lithology
  // the main colour can also go back to the Aramco chart colour (no field colour: the log uses the Lithology Key fill)
  body.querySelectorAll('.colour-field:not(.visual-field)').forEach(el => bindColourField(el, () => v('#bd-lith'),
    el.querySelector('#bd-color') ? () => (v('#bd-lith') ? DEFAULT_FILL[patternFor(v('#bd-lith'))] : '') : null));
  const cmode = body.querySelector('#bd-cmode');
  const showC2 = () => {
    body.querySelector('#bd-color2-f').style.visibility = cmode.value ? '' : 'hidden';
    body.querySelector('#bd-cat-f').style.display = cmode.value === 'changing upward to' ? '' : 'none';
  };
  cmode.addEventListener('change', showC2); showC2();
  body.querySelectorAll('.visual-field').forEach(bindVisualField);
  body.querySelectorAll('.mod-chip').forEach(c => c.onclick = () => c.classList.toggle('on')); // modifiers and structures
  // carbonates use Dunham texture instead of grain size
  const trend = () => {
    const carb = isCarbonate(v('#bd-lith'));
    body.querySelector('#bd-clastic-row').style.display = carb ? 'none' : '';
    body.querySelector('#bd-carb-row').style.display = carb ? '' : 'none';
    let msg = '';
    if (carb) {
      const a = dunhamPos(v('#bd-tex')), t = dunhamPos(v('#bd-tex-top'));
      if (a >= 0 && t >= 0 && a !== t) msg = t > a ? '↑ More grain-supported upward (shoaling-upward)' : '↑ More mud-supported upward (deepening-upward)';
    } else {
      const a = GRAINS.indexOf(v('#bd-grain')), t = GRAINS.indexOf(v('#bd-grain-top'));
      if (a >= 0 && t >= 0 && a !== t) msg = t < a ? '↑ Fining upward' : '↑ Coarsening upward';
    }
    body.querySelector('#bd-trend').textContent = msg;
  };
  ['#bd-grain', '#bd-grain-top', '#bd-tex', '#bd-tex-top', '#bd-lith'].forEach(id => body.querySelector(id).addEventListener('change', trend));
  trend();
  body.querySelector('#bd-fm').onchange = e => { b.member = ''; body.querySelector('#bd-mbr').innerHTML = memberOpts(e.target.value); };
  // reads the form into the bed; false when the thickness is missing
  const readForm = () => {
    const th = Number(v('#bd-th'));
    if (!th || th <= 0) { toast('Enter a thickness in metres'); return false; }
    Object.assign(b, {
      estimated: body.querySelector('#bd-est').checked,
      modifiers: [...body.querySelectorAll('.mod-chip.on[data-m]')].map(c => c.dataset.m),
      structSyms: [...body.querySelectorAll('.struct-chip.on')].map(c => c.dataset.s),
      inter: [v('#bd-inter1'), v('#bd-inter2')].filter(Boolean),
      grainTop: v('#bd-grain-top'),
      texture: v('#bd-tex'),
      textureTop: v('#bd-tex-top'),
      unit: v('#bd-unit').trim(),
      colorMode: v('#bd-cmode'),
      color2: v('#bd-cmode') ? v('#bd-color2') : '',
      colorAt: v('#bd-cmode') === 'changing upward to' && Number(v('#bd-cat')) > 0 ? Number(v('#bd-cat')) : '',
    });
    // merged bed: sentences typed into its description are also kept in its own notes (used by a later merge)
    if (b.notes != null && v('#bd-desc') !== b.description) {
      const old = new Set(sentencesOf(b.description).map(s => s.toLowerCase())), have = new Set(sentencesOf(b.notes).map(s => s.toLowerCase()));
      const added = sentencesOf(v('#bd-desc')).filter(s => !old.has(s.toLowerCase()) && !have.has(s.toLowerCase()));
      if (added.length) b.notes = [b.notes, ...added].filter(Boolean).join('\n');
    }
    Object.assign(b, { thickness: th, formation: v('#bd-fm'), member: v('#bd-mbr'), contact: v('#bd-contact'), lithology: v('#bd-lith'), grain: v('#bd-grain'), shape: v('#bd-shape'), color: v('#bd-color'),
      structures: v('#bd-struct'), fossils: v('#bd-fossils'), description: v('#bd-desc'), sample: v('#bd-sample') });
    return true;
  };
  // summary from the bed's current data and notes; shown in the box, saved only with Save
  body.querySelector('#bd-summary').onclick = () => {
    if (!readForm()) return;
    const box = body.querySelector('#bd-desc');
    box.value = bedSummary(b); b.description = box.value;
    toast('Summary written. Edit it if needed, then Save');
  };
  body.querySelector('#bd-save').onclick = async () => {
    if (!readForm()) return;
    if (index == null) beds.push(b); else beds[index] = b;
    await saveStation(st); closeModal(); renderLog();
  };
  if (index != null) {
    // copy: keeps any edits, puts the copy just above the original, then asks where it should go
    body.querySelector('#bd-copy').onclick = async () => {
      if (!readForm()) return;
      beds[index] = b;
      beds.splice(index + 1, 0, { ...b, id: uid(), sample: '', modifiers: [...(b.modifiers || [])], inter: [...(b.inter || [])], structSyms: [...(b.structSyms || [])] });
      await saveStation(st); renderLog();
      moveBed(st, index + 1, 'Where should the copy go?');
    };
    body.querySelector('#bd-move').onclick = async () => {
      if (!readForm()) return;
      beds[index] = b; await saveStation(st);
      moveBed(st, index);
    };
    const splitBtn = body.querySelector('#bd-split');
    if (splitBtn) splitBtn.onclick = async () => {
      const [lo, up] = b.mergedFrom;
      if (!(await confirmBox(`Split this bed back into the 2 beds it was made from (${lo.lithology || 'bed'} ${lo.thickness} m + ${up.lithology || 'bed'} ${up.thickness} m)? Changes made to it after merging are lost.`))) return;
      beds.splice(index, 1, lo, up);
      // a copied merged bed carries the same originals: give restored beds fresh ids if already used
      for (const x of [lo, up]) if (beds.filter(y => y.id === x.id).length > 1) x.id = uid();
      await saveStation(st); closeModal(); renderLog();
      toast(`Split back into beds ${index + 1} and ${index + 2}`);
    };
    const cutBtn = body.querySelector('#bd-cut');
    if (cutBtn) cutBtn.onclick = async () => {
      if (!readForm()) return;
      beds[index] = b; await saveStation(st); // keep the edits made in this form
      splitDialog(st, index);
    };
    const mergeBtn = body.querySelector('#bd-merge');
    if (mergeBtn) mergeBtn.onclick = async () => {
      if (!readForm()) return;
      beds[index] = b; await saveStation(st); // keep the edits made in this form
      mergeDialog(st, index, b);
    };
    body.querySelector('#bd-del').onclick = async () => {
      if (!(await confirmBox('Delete this bed?'))) return;
      beds.splice(index, 1); await saveStation(st); closeModal(); renderLog();
    };
  }
}
