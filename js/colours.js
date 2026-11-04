// Rock colour picker: GSA Rock-Color Chart names with Munsell codes, drawn as swatches.
import { db } from './db.js';
import { esc } from './ui.js';

// [Munsell code, name], grouped by colour family.
export const COLOUR_GROUPS = [
  ['Reds', [
    ['5R 8/2', 'Grayish pink'], ['5R 7/4', 'Moderate pink'], ['5R 6/2', 'Pale red'], ['5R 6/6', 'Light red'],
    ['5R 5/4', 'Moderate red'], ['5R 4/2', 'Grayish red'], ['5R 4/6', 'Moderate red'], ['5R 3/4', 'Dusky red'],
    ['5R 2/2', 'Blackish red'], ['10R 8/2', 'Grayish orange pink'], ['10R 7/4', 'Moderate orange pink'], ['10R 6/2', 'Pale red'],
    ['10R 6/6', 'Moderate reddish orange'], ['10R 5/4', 'Pale reddish brown'], ['10R 4/2', 'Grayish red'],
    ['10R 4/6', 'Moderate reddish brown'], ['10R 3/4', 'Dark reddish brown'], ['10R 2/2', 'Very dusky red'],
  ]],
  ['Browns & oranges', [
    ['5YR 8/1', 'Pinkish gray'], ['5YR 8/4', 'Moderate orange pink'], ['5YR 7/2', 'Grayish orange pink'], ['5YR 6/4', 'Light brown'],
    ['5YR 5/2', 'Pale brown'], ['5YR 5/6', 'Light brown'], ['5YR 4/4', 'Moderate brown'], ['5YR 3/2', 'Grayish brown'],
    ['5YR 3/4', 'Moderate brown'], ['5YR 2/2', 'Dusky brown'], ['5YR 2/1', 'Brownish black'],
    ['10YR 8/2', 'Very pale orange'], ['10YR 8/6', 'Pale yellowish orange'], ['10YR 7/4', 'Grayish orange'],
    ['10YR 6/2', 'Pale yellowish brown'], ['10YR 6/6', 'Dark yellowish orange'], ['10YR 5/4', 'Moderate yellowish brown'],
    ['10YR 4/2', 'Dark yellowish brown'], ['10YR 2/2', 'Dusky yellowish brown'],
  ]],
  ['Yellows & olives', [
    ['5Y 8/1', 'Yellowish gray'], ['5Y 8/4', 'Grayish yellow'], ['5Y 7/2', 'Yellowish gray'], ['5Y 7/6', 'Moderate yellow'],
    ['5Y 6/1', 'Light olive gray'], ['5Y 6/4', 'Dusky yellow'], ['5Y 5/2', 'Light olive gray'], ['5Y 5/6', 'Light olive brown'],
    ['5Y 4/1', 'Olive gray'], ['5Y 4/4', 'Moderate olive brown'], ['5Y 3/2', 'Olive gray'], ['5Y 2/1', 'Olive black'],
    ['10Y 8/2', 'Pale greenish yellow'], ['10Y 7/4', 'Moderate greenish yellow'], ['10Y 6/2', 'Pale olive'],
    ['10Y 5/4', 'Light olive'], ['10Y 4/2', 'Grayish olive'],
  ]],
  ['Greens', [
    ['5GY 8/1', 'Light greenish gray'], ['5GY 7/2', 'Grayish yellow green'], ['5GY 6/1', 'Greenish gray'], ['5GY 5/2', 'Dusky yellow green'],
    ['5GY 4/1', 'Dark greenish gray'], ['5GY 3/2', 'Grayish olive green'], ['5GY 2/1', 'Greenish black'],
    ['10GY 6/2', 'Pale green'], ['10GY 4/2', 'Grayish green'], ['10GY 3/2', 'Dusky green'],
    ['5G 8/1', 'Light greenish gray'], ['5G 7/2', 'Pale green'], ['5G 6/6', 'Light green'], ['5G 5/2', 'Grayish green'],
    ['5G 4/1', 'Dark greenish gray'], ['5G 3/2', 'Dusky green'], ['5G 2/1', 'Greenish black'], ['10G 4/2', 'Grayish green'],
  ]],
  ['Blues', [
    ['5BG 7/2', 'Pale blue green'], ['5BG 5/2', 'Grayish blue green'], ['5BG 3/2', 'Dusky blue green'],
    ['5B 7/1', 'Light bluish gray'], ['5B 6/2', 'Pale blue'], ['5B 5/1', 'Medium bluish gray'], ['5B 3/2', 'Dusky blue'],
    ['5PB 5/2', 'Grayish blue'], ['5PB 3/2', 'Dusky blue'],
  ]],
  ['Purples', [
    ['5P 6/2', 'Pale purple'], ['5P 4/2', 'Grayish purple'], ['5P 2/2', 'Very dusky purple'],
    ['5RP 8/2', 'Pale pink'], ['5RP 6/2', 'Pale red purple'], ['5RP 4/2', 'Grayish red purple'], ['5RP 2/2', 'Very dusky red purple'],
  ]],
  ['White, grays & black', [
    ['N9', 'White'], ['N8', 'Very light gray'], ['N7', 'Light gray'], ['N6', 'Medium light gray'], ['N5', 'Medium gray'],
    ['N4', 'Medium dark gray'], ['N3', 'Dark gray'], ['N2', 'Grayish black'], ['N1', 'Black'],
  ]],
];

// ---------- Munsell -> screen colour (approximation via CIE L*C*h) ----------
const HUE_ANGLE = { R: 25, YR: 60, Y: 90, GY: 120, G: 160, BG: 195, B: 235, PB: 270, P: 305, RP: 340 };

export function munsellHex(code) {
  const n = /^N\s*(\d+(?:\.\d+)?)/i.exec(code);
  const m = /^(\d+(?:\.\d+)?)\s*(YR|GY|BG|PB|RP|R|Y|G|B|P)\s+(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i.exec(code);
  let L, C = 0, h = 0;
  if (n) L = Number(n[1]) * 10;
  else if (m) {
    const step = Number(m[1]), fam = m[2].toUpperCase();
    // within a family, 5 is the centre; 10 leans toward the next family
    h = HUE_ANGLE[fam] + (step - 5) * 3.5;
    L = Number(m[3]) * 10; C = Number(m[4]) * 5.5;
  } else return null;
  return labToHex(L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180));
}

function labToHex(L, a, b) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const f = t => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = 0.95047 * f(fx), Y = f(fy), Z = 1.08883 * f(fz);
  const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];
  return '#' + lin.map(c => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  }).join('');
}

export const colourLabel = (code, name) => `${name} (${code})`;

// Swatch colour for a stored value such as "Moderate reddish brown (10R 4/6)".
export function colourHex(text) {
  if (!text) return null;
  const m = /\(([^)]+)\)\s*$/.exec(text);
  return m ? munsellHex(m[1]) : null;
}

// ---------- picker overlay (sits above the bottom-sheet modal) ----------
let overlay = null;

async function recent() {
  const r = await db.get('meta', 'recentColours');
  return r ? r.value : [];
}
async function remember(value) {
  const list = (await recent()).filter(v => v !== value);
  list.unshift(value);
  await db.put('meta', { id: 'recentColours', value: list.slice(0, 8) });
}

function chip(value, code, name) {
  const hex = code ? munsellHex(code) : colourHex(value);
  return `<button class="cp-chip" data-v="${esc(value)}"><span class="cp-sw" style="background:${hex || 'transparent'}"></span>
    <span class="cp-txt"><span>${esc(name || value)}</span>${code ? `<small>${esc(code)}</small>` : ''}</span></button>`;
}

export async function pickColour(current) {
  const rec = await recent();
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'colour-picker';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div class="cp-card">
    <div class="cp-head"><b>Choose colour</b><button class="icon-btn" data-act="close">&times;</button></div>
    <div class="cp-tools"><input type="search" placeholder="Search: red, olive, 10YR…" class="cp-search">
      <div class="btns" style="margin:8px 0 0"><button class="btn small" data-act="custom">Type my own</button>
      <button class="btn small" data-act="mottled">Mottled (2 colours)</button><button class="btn small danger" data-act="clear">Clear</button></div></div>
    <div class="cp-body">
      ${current ? `<div class="cp-group" data-fixed><div class="group-title">Current</div><div class="cp-grid">${chip(current)}</div></div>` : ''}
      ${rec.length ? `<div class="cp-group" data-fixed><div class="group-title">Recently used</div><div class="cp-grid">${rec.map(v => chip(v)).join('')}</div></div>` : ''}
      ${COLOUR_GROUPS.map(([g, list]) => `<div class="cp-group"><div class="group-title">${g}</div><div class="cp-grid">
        ${list.map(([code, name]) => chip(colourLabel(code, name), code, name)).join('')}</div></div>`).join('')}
    </div></div>`;
  overlay.classList.remove('hidden');

  return new Promise(resolve => {
    let mottledFirst = null;
    const done = v => { overlay.classList.add('hidden'); overlay.onclick = null; if (v) remember(v); resolve(v); };
    overlay.onclick = e => {
      if (e.target === overlay) return done(undefined);
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'close') return done(undefined);
      if (act === 'clear') { overlay.classList.add('hidden'); resolve(''); return; }
      if (act === 'custom') { const v = window.prompt('Colour', current || ''); if (v != null) done(v.trim()); return; }
      if (act === 'mottled') {
        mottledFirst = '';
        overlay.querySelector('.cp-head b').textContent = 'Mottled: tap the 1st colour';
        return;
      }
      if (btn.dataset.v != null) {
        const v = btn.dataset.v;
        if (mottledFirst === '') {
          mottledFirst = v;
          overlay.querySelector('.cp-head b').textContent = 'Mottled: tap the 2nd colour';
          return;
        }
        if (mottledFirst) return done(`${mottledFirst} mottled with ${v.charAt(0).toLowerCase()}${v.slice(1)}`);
        done(v);
      }
    };
    const search = overlay.querySelector('.cp-search');
    search.oninput = () => {
      const q = search.value.toLowerCase().trim();
      overlay.querySelectorAll('.cp-group').forEach(g => {
        let any = false;
        g.querySelectorAll('.cp-chip').forEach(c => {
          const show = !q || c.dataset.v.toLowerCase().includes(q) || g.querySelector('.group-title').textContent.toLowerCase().includes(q);
          c.style.display = show ? '' : 'none'; if (show) any = true;
        });
        g.style.display = any && !(q && g.hasAttribute('data-fixed')) ? '' : 'none';
      });
    };
  });
}

// Field markup: a tappable box showing the swatch and the colour name.
export function colourFieldHtml(key, value, attr = 'data-key') {
  const hex = colourHex(value);
  return `<div class="colour-field"><span class="cf-sw" style="background:${hex || 'transparent'};${hex ? '' : 'border-style:dashed'}"></span>
    <input type="text" readonly ${attr}="${esc(key)}" value="${esc(value || '')}" placeholder="Tap to choose a colour"></div>`;
}

// Make a colour-field open the picker; fires 'input' on the inner input after a choice.
export function bindColourField(wrapper) {
  const input = wrapper.querySelector('input');
  wrapper.addEventListener('click', async () => {
    const v = await pickColour(input.value);
    if (v === undefined) return;
    input.value = v;
    const hex = colourHex(v);
    const sw = wrapper.querySelector('.cf-sw');
    sw.style.background = hex || 'transparent';
    sw.style.borderStyle = hex ? 'solid' : 'dashed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
