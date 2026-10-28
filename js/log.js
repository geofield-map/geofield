// Stratigraphic log for a station: beds from base to top, drawn as a graphic column.
import { state, saveStation, getStation } from './state.js';
import { uid } from './db.js';
import { $, esc, openModal, closeModal, toast, confirmBox, saveFile } from './ui.js';
import { LITHOLOGIES } from './schema.js';
import { FORMATION_NAMES, findFormation, CHART_LITHOLOGIES } from './strat.js';

export const GRAINS = ['Clay', 'Silt', 'Very fine sand', 'Fine sand', 'Medium sand', 'Coarse sand', 'Very coarse sand', 'Granule', 'Pebble', 'Cobble', 'Boulder'];
const GRAIN_ABBR = ['cl', 'si', 'vf', 'f', 'm', 'c', 'vc', 'gr', 'pb', 'cb', 'bl'];
const CONTACTS = ['Sharp', 'Erosional', 'Gradational', 'Unconformity', 'Faulted', 'Covered'];
const LOG_LITHS = [...new Set([...CHART_LITHOLOGIES, ...LITHOLOGIES.Sedimentary, 'Igneous (intrusive)', 'Metamorphic', 'Covered / no exposure'])];

// Lithology -> SVG pattern id
function patternFor(lith = '') {
  const l = lith.toLowerCase();
  if (l.includes('covered')) return 'p-covered';
  if (l.includes('basement')) return 'p-ign';
  if (l.includes('salt')) return 'p-evap';
  if (l.includes('dune')) return 'p-sand';
  if (l.includes('argillaceous limestone')) return 'p-marl';
  if (l.includes('calcaren') || l.includes('wackestone')) return 'p-limestone';
  if (l.includes('conglom') || l.includes('tillite') || l.includes('diamict')) return 'p-congl';
  if (l.includes('breccia')) return 'p-breccia';
  if (l.includes('dolom')) return 'p-dolomite';
  if (l.includes('limestone') || l.includes('chalk')) return 'p-limestone';
  if (l.includes('marl')) return 'p-marl';
  if (l.includes('silt')) return 'p-silt';
  if (l.includes('shale') || l.includes('mud') || l.includes('clay')) return 'p-shale';
  if (l.includes('sand') || l.includes('arkose') || l.includes('greywacke') || l.includes('arenite')) return 'p-sand';
  if (l.includes('chert')) return 'p-chert';
  if (l.includes('evap') || l.includes('gypsum') || l.includes('anhydrite') || l.includes('halite')) return 'p-evap';
  if (l.includes('coal')) return 'p-coal';
  if (l.includes('volcan')) return 'p-volc';
  if (l.includes('igneous')) return 'p-ign';
  if (l.includes('metamorphic')) return 'p-meta';
  if (l.includes('iron') || l.includes('phosph')) return 'p-sand';
  return 'p-blank';
}

const DEFS = `<defs>
  <pattern id="p-sand" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fde9a8"/><circle cx="2" cy="2" r=".9" fill="#333"/><circle cx="6" cy="6" r=".9" fill="#333"/></pattern>
  <pattern id="p-silt" width="10" height="8" patternUnits="userSpaceOnUse"><rect width="10" height="8" fill="#e9dcae"/><line x1="0" y1="2" x2="5" y2="2" stroke="#333"/><circle cx="7.5" cy="6" r=".8" fill="#333"/></pattern>
  <pattern id="p-shale" width="12" height="5" patternUnits="userSpaceOnUse"><rect width="12" height="5" fill="#c9c9c9"/><line x1="0" y1="2.5" x2="7" y2="2.5" stroke="#333"/></pattern>
  <pattern id="p-limestone" width="16" height="10" patternUnits="userSpaceOnUse"><rect width="16" height="10" fill="#bfe3f2"/><path d="M0 0H16M0 5H16M4 0V5M12 5V10" stroke="#333" fill="none"/></pattern>
  <pattern id="p-dolomite" width="16" height="10" patternUnits="userSpaceOnUse"><rect width="16" height="10" fill="#d6d1f0"/><path d="M0 0H16M0 5H16M3 0L5 5M11 5L13 10" stroke="#333" fill="none"/></pattern>
  <pattern id="p-marl" width="16" height="10" patternUnits="userSpaceOnUse"><rect width="16" height="10" fill="#d4e8d0"/><path d="M0 0H16M4 0V5M2 7.5H10" stroke="#333" fill="none"/></pattern>
  <pattern id="p-congl" width="18" height="14" patternUnits="userSpaceOnUse"><rect width="18" height="14" fill="#f7d9a0"/><circle cx="5" cy="4" r="3" fill="none" stroke="#333"/><circle cx="13" cy="10" r="2.5" fill="none" stroke="#333"/><circle cx="14" cy="3" r=".8" fill="#333"/></pattern>
  <pattern id="p-breccia" width="18" height="14" patternUnits="userSpaceOnUse"><rect width="18" height="14" fill="#f2cfa0"/><path d="M2 6L6 1L8 6Z M10 13L13 8L16 13Z" fill="none" stroke="#333"/></pattern>
  <pattern id="p-chert" width="12" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="#e7e7e7"/><path d="M1 6L4 2L7 6Z" fill="#333"/></pattern>
  <pattern id="p-evap" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#f6d1e6"/><path d="M0 0L10 10M10 0L0 10" stroke="#555" stroke-width=".7"/></pattern>
  <pattern id="p-coal" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#222"/></pattern>
  <pattern id="p-ign" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#f4b6b6"/><path d="M3 1V7M0 4H6M10 8V14M7 11H13" stroke="#333"/></pattern>
  <pattern id="p-volc" width="14" height="12" patternUnits="userSpaceOnUse"><rect width="14" height="12" fill="#e7a9c8"/><path d="M1 2L3 6L5 2M8 7L10 11L12 7" stroke="#333" fill="none"/></pattern>
  <pattern id="p-meta" width="20" height="8" patternUnits="userSpaceOnUse"><rect width="20" height="8" fill="#c8d9b4"/><path d="M0 4Q5 0 10 4T20 4" stroke="#333" fill="none"/></pattern>
  <pattern id="p-covered" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><path d="M0 8L8 0" stroke="#aaa"/></pattern>
  <pattern id="p-blank" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#eee"/></pattern>
</defs>`;

function grainIndex(bed) {
  const i = GRAINS.indexOf(bed.grain);
  if (i >= 0) return i;
  const p = patternFor(bed.lithology);
  if (p === 'p-shale') return 0;
  if (p === 'p-limestone' || p === 'p-dolomite' || p === 'p-marl' || p === 'p-chert' || p === 'p-evap' || p === 'p-coal') return 1;
  if (p === 'p-covered') return 0;
  return 4;
}

function wrapText(text, maxChars) {
  const words = String(text || '').split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines;
}

export function logSvg(st) {
  const beds = (st.log && st.log.beds) || [];
  const total = beds.reduce((s, b) => s + (Number(b.thickness) || 0), 0) || 1;
  const pxPerM = Math.max(8, Math.min(200, 600 / total));
  const colX = 92, minW = 30, stepW = 13, textX = colX + minW + stepW * 10 + 20, W = textX + 280;
  const heights = beds.map(b => Math.max(10, (Number(b.thickness) || 0) * pxPerM));
  const top = 50, H = top + heights.reduce((a, b) => a + b, 0) + 60;
  const esc2 = s => esc(s);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">${DEFS}
    <rect width="${W}" height="${H}" fill="#fff"/>
    <text x="10" y="20" font-size="14" font-weight="bold">${esc2(st.code)} — Stratigraphic log</text>
    <text x="10" y="36" font-size="11" fill="#555">${esc2([state.project.name, st.attrs.formation, `E ${Math.round(st.easting)} N ${Math.round(st.northing)}`].filter(Boolean).join(' · '))}</text>`;

  // beds drawn from the top of the page (youngest) down to the base
  let y = top, cum = total;
  const order = beds.map((b, i) => i).reverse();
  // formation / member columns: merge consecutive beds with the same unit
  const unitCol = (key, x, w) => {
    let yy = top, k = 0, out = '';
    while (k < order.length) {
      const name = beds[order[k]][key] || '';
      let hh = 0;
      while (k < order.length && (beds[order[k]][key] || '') === name) { hh += heights[order[k]]; k++; }
      out += `<rect x="${x}" y="${yy}" width="${w}" height="${hh}" fill="none" stroke="#000" stroke-width=".6"/>`;
      if (name) out += `<text transform="translate(${x + w / 2 + 3.5},${yy + hh / 2}) rotate(-90)" font-size="9.5" text-anchor="middle">${esc2(hh > name.length * 5.5 ? name : name.slice(0, Math.max(1, Math.floor(hh / 5.5))))}</text>`;
      yy += hh;
    }
    return out;
  };
  if (beds.some(b => b.formation || b.member)) {
    s += `<text x="2" y="${top - 6}" font-size="8" fill="#555">Fm</text><text x="20" y="${top - 6}" font-size="8" fill="#555">Mbr</text>`;
    s += unitCol('formation', 2, 16) + unitCol('member', 20, 16);
  }
  for (const i of order) {
    const b = beds[i], h = heights[i];
    const w = minW + stepW * grainIndex(b);
    s += `<rect x="${colX}" y="${y}" width="${w}" height="${h}" fill="url(#${patternFor(b.lithology)})" stroke="#000" stroke-width="1"/>`;
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
    // description
    const desc = [`${i + 1}. ${b.lithology || ''}${b.thickness ? ' (' + b.thickness + ' m)' : ''}`, [b.color, b.grain, b.structures, b.fossils].filter(Boolean).join(', '), b.description, b.sample ? 'Sample: ' + b.sample : '']
      .filter(Boolean).flatMap((t, k) => wrapText(t, 46).map(line => ({ line, bold: k === 0 })));
    const maxLines = Math.max(1, Math.floor(h / 11));
    desc.slice(0, Math.max(maxLines, 1)).forEach((d, k) => {
      s += `<text x="${textX}" y="${y + 10 + k * 11}" font-size="9.5" ${d.bold ? 'font-weight="bold"' : ''}>${esc2(d.line)}</text>`;
    });
    s += `<line x1="${colX + w}" y1="${y}" x2="${textX - 4}" y2="${y}" stroke="#ccc" stroke-dasharray="2 2"/>`;
    y += h;
  }
  s += `<line x1="${colX - 14}" y1="${y}" x2="${colX - 10}" y2="${y}" stroke="#000"/><text x="${colX - 16}" y="${y + 4}" font-size="9" text-anchor="end">0</text>`;
  s += `<text x="${colX - 30}" y="${top - 6}" font-size="9" fill="#555">m</text>`;
  // grain-size scale
  GRAIN_ABBR.forEach((a, i) => {
    const x = colX + minW + stepW * i;
    s += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 5}" stroke="#000"/><text x="${x}" y="${y + 15}" font-size="8" text-anchor="middle">${a}</text>`;
  });
  s += `<text x="${colX}" y="${y + 30}" font-size="9" fill="#555">Grain size · scale 1 m = ${pxPerM.toFixed(0)} px</text>`;
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
      <div class="field"><label>Base contact</label><select id="bd-contact">${opts(CONTACTS, b.contact)}</select></div>
    </div>
    <div class="field"><label>Lithology</label><select id="bd-lith">${opts(LOG_LITHS, b.lithology)}</select></div>
    <div class="field"><label>Grain size</label><select id="bd-grain">${opts(GRAINS, b.grain)}</select></div>
    <div class="field"><label>Colour</label><input type="text" id="bd-color" value="${esc(b.color)}" placeholder="e.g. Reddish brown"></div>
    <div class="field"><label>Sedimentary structures</label><input type="text" id="bd-struct" value="${esc(b.structures)}" placeholder="e.g. Trough cross-bedding"></div>
    <div class="field"><label>Fossils</label><input type="text" id="bd-fossils" value="${esc(b.fossils)}"></div>
    <div class="field"><label>Description</label><textarea id="bd-desc">${esc(b.description)}</textarea></div>
    <div class="field"><label>Sample no.</label><input type="text" id="bd-sample" value="${esc(b.sample)}"></div>
    <div class="btns"><button class="btn primary" id="bd-save">Save</button>
      ${index != null ? '<button class="btn" id="bd-up">Move up</button><button class="btn" id="bd-down">Move down</button><button class="btn danger" id="bd-del">Delete</button>' : ''}</div>`);
  const v = id => body.querySelector(id).value;
  body.querySelector('#bd-fm').onchange = e => { b.member = ''; body.querySelector('#bd-mbr').innerHTML = memberOpts(e.target.value); };
  body.querySelector('#bd-save').onclick = async () => {
    const th = Number(v('#bd-th'));
    if (!th || th <= 0) { toast('Enter a thickness in metres'); return; }
    Object.assign(b, { thickness: th, formation: v('#bd-fm'), member: v('#bd-mbr'), contact: v('#bd-contact'), lithology: v('#bd-lith'), grain: v('#bd-grain'), color: v('#bd-color'),
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
