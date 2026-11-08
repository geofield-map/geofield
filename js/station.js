// Station creation, the auto-filled form, and photos.
import { state, saveProject, saveStation, deleteStation, getStation } from './state.js';
import { db, uid } from './db.js';
import { $, $$, esc, toast, openModal, closeModal, confirmBox, fmt, resetViewport } from './ui.js';
import { toUTM, toDMS } from './geo.js';
import { LITHOLOGIES, ALL_LITHOLOGIES } from './schema.js';
import { autofillFromLayers } from './layers.js';
import { geologyFill } from './geology.js';
import { findFormation, FORMATION_FILLS } from './strat.js';
import { colourFieldHtml, bindColourField } from './colours.js';
import { renderStationStructures } from './structures.js';

let nav = {};
export function initStation(navigation) { nav = navigation; }

// ---------- auto values ----------
function nextSampleNo() {
  let max = 0;
  for (const s of state.stations) {
    const n = Number(s.attrs && s.attrs.sample_no);
    if (!isNaN(n) && n > max) max = n;
  }
  return Math.max(Number(state.project.nextSample) || 1, max + 1);
}

function autoValue(source, st) {
  const p = state.project;
  switch (source) {
    case 'station': return st.code;
    case 'region': return p.region;
    case 'license': return p.license;
    case 'project': return p.project || p.name;
    case 'prospect': return p.prospect;
    case 'geologist': return p.geologist;
    case 'sample_no': return nextSampleNo();
    case 'easting': return st.easting;
    case 'northing': return st.northing;
    case 'elevation': return st.elev == null ? '' : Math.round(st.elev * 10) / 10;
    case 'lat': return st.lat == null ? '' : Number(st.lat.toFixed(7));
    case 'lon': return st.lon == null ? '' : Number(st.lon.toFixed(7));
    case 'lat_dms': return st.lat == null ? '' : toDMS(st.lat, true);
    case 'lon_dms': return st.lon == null ? '' : toDMS(st.lon, false);
    case 'accuracy': return st.acc == null ? '' : Math.round(st.acc * 10) / 10;
    case 'date': return new Date(st.created).toISOString().slice(0, 10);
    default: return '';
  }
}

const POSITION_SOURCES = ['easting', 'northing', 'elevation', 'lat', 'lon', 'lat_dms', 'lon_dms', 'accuracy'];

function setPosition(st, fix) {
  st.lat = fix.lat; st.lon = fix.lon; st.elev = fix.alt ?? null; st.acc = fix.acc ?? null; st.source = fix.source || 'GPS';
  const u = toUTM(fix.lat, fix.lon, state.project.utmZone);
  st.easting = u.easting; st.northing = u.northing; st.utmZone = state.project.utmZone;
}

export async function createStation(fix) {
  const p = state.project;
  const code = (p.stationPrefix || 'ST-') + String(p.nextStation || 1).padStart(3, '0');
  p.nextStation = (p.nextStation || 1) + 1;
  await saveProject();

  const st = { id: uid(), projectId: p.id, code, created: new Date().toISOString(), attrs: {}, structures: [], log: { beds: [] } };
  setPosition(st, fix);
  for (const f of p.schema) if (f.auto) st.attrs[f.key] = autoValue(f.auto, st);
  // formation (and its era, period, epoch, age) from the built-in geological map, by GPS position alone
  Object.assign(st.attrs, await geologyFill(st.lat, st.lon));
  Object.assign(st.attrs, await autofillFromLayers(st.lat, st.lon)); // the geologist's own layers win
  fillFromFormation(st, true);
  await saveStation(st);
  toast(`${code} created`);
  nav.openStation(st.id);
}

// Era / Period / Epoch / Age from the formation library. Returns the keys it changed.
function fillFromFormation(st, onlyEmpty) {
  const fm = findFormation(st.attrs.formation);
  if (!fm) return [];
  const keys = new Set(state.project.schema.map(f => f.key));
  const changed = [];
  for (const [key, prop] of Object.entries(FORMATION_FILLS)) {
    if (!keys.has(key) || !fm[prop]) continue;
    if (onlyEmpty && st.attrs[key]) continue;
    st.attrs[key] = fm[prop]; changed.push(key);
  }
  if (st.attrs.member && fm.members.length && !fm.members.includes(st.attrs.member)) { st.attrs.member = ''; changed.push('member'); }
  return changed;
}

// ---------- station screen ----------
let currentTab = 'data';
let saveTimer = null;

export function showStation(id, tab) {
  state.currentStationId = id;
  if (tab) currentTab = tab;
  $$('#station-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
  renderTab();
}

$$('#station-tabs button').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.tab === 'log') { nav.openLog(state.currentStationId); return; }
  currentTab = b.dataset.tab;
  showStation(state.currentStationId);
}));

function renderTab() {
  const st = getStation(state.currentStationId);
  const body = $('#station-body');
  if (!st) { body.innerHTML = '<div class="empty">Station not found</div>'; return; }
  if (currentTab === 'data') renderForm(st, body);
  else if (currentTab === 'photos') renderPhotos(st, body);
  else if (currentTab === 'structures') renderStationStructures(st, body);
}

function fieldVisible(f, attrs) {
  if (!f.showIf) return true;
  return f.showIf.values.includes(attrs[f.showIf.field]);
}

function selectHtml(f, value, attrs = {}) {
  let opts;
  const fm = f.key === 'member' ? findFormation(attrs.formation) : null;
  if (fm && fm.members.length) {
    opts = fm.members.map(o => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('');
  } else if (f.key === 'lithology' && JSON.stringify(f.options) === JSON.stringify(ALL_LITHOLOGIES)) {
    opts = Object.entries(LITHOLOGIES).map(([g, list]) =>
      `<optgroup label="${g}">${list.map(o => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</optgroup>`).join('');
  } else {
    opts = (f.options || []).map(o => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('');
  }
  const known = (fm && fm.members.includes(value)) || (f.options || []).includes(value);
  const extra = value && !known ? `<option selected>${esc(value)}</option>` : '';
  return `<select data-key="${f.key}"><option value=""></option>${extra}${opts}<option value="__other">Other (type)…</option></select>`;
}

function inputHtml(f, value, attrs) {
  const v = value ?? '';
  switch (f.type) {
    case 'number': return `<input type="number" inputmode="decimal" step="any" data-key="${f.key}" value="${esc(v)}">`;
    case 'date': return `<input type="date" data-key="${f.key}" value="${esc(v)}">`;
    case 'textarea': return `<textarea data-key="${f.key}">${esc(v)}</textarea>`;
    case 'select': return selectHtml(f, v, attrs);
    case 'colour': return colourFieldHtml(f.key, v);
    default: return `<input type="text" data-key="${f.key}" value="${esc(v)}" autocapitalize="sentences">`;
  }
}

function renderForm(st, body) {
  const schema = state.project.schema;
  let html = `<div class="card">
    <div style="display:flex;align-items:center;gap:8px"><h3 style="flex:1;margin:0">${esc(st.code)}</h3>
      <button class="btn small" id="st-rename">Rename</button><span class="badge" id="save-state">Saved</span></div>
    <div class="kv" style="margin-top:8px">
      <div>UTM ${st.utmZone}N</div><div>E ${fmt(st.easting, 1)} · N ${fmt(st.northing, 1)}</div>
      <div>Lat/Long</div><div>${st.lat.toFixed(6)}, ${st.lon.toFixed(6)}</div>
      <div>Elevation</div><div>${st.elev == null ? '–' : fmt(st.elev, 1) + ' m'}</div>
      <div>Accuracy</div><div>${st.acc == null ? '–' : '±' + fmt(st.acc, 1) + ' m'} (${esc(st.source)})</div>
    </div>
    <div class="btns">
      <button class="btn small" id="st-map">Show on map</button>
      <button class="btn small" id="st-regps">Update from GPS</button>
      <button class="btn small" id="st-refill">Re-run auto-fill</button>
    </div></div><div class="form">`;
  let group = null;
  for (const f of schema) {
    if (f.group !== group) { group = f.group; html += `<div class="group-title" data-group="${esc(group)}">${esc(group || '')}</div>`; }
    const auto = f.auto ? '<span class="auto">auto</span>' : '';
    html += `<div class="field" data-field="${f.key}" ${fieldVisible(f, st.attrs) ? '' : 'style="display:none"'}>
      <label>${esc(f.label)} ${auto}</label>${inputHtml(f, st.attrs[f.key], st.attrs)}</div>`;
  }
  html += `<div class="btns" style="margin-top:20px"><button class="btn danger" id="st-del">Delete station</button></div></div>`;
  body.innerHTML = html;
  refreshGroupTitles(body);

  const bind = el => {
    const handler = () => {
      if (el.tagName === 'SELECT' && el.value === '__other') {
        const v = window.prompt('Enter value');
        if (v) {
          const o = document.createElement('option'); o.textContent = v; o.selected = true;
          el.insertBefore(o, el.options[1]);
        } else el.value = st.attrs[el.dataset.key] || '';
      }
      const f = schema.find(x => x.key === el.dataset.key);
      let val = el.value;
      if (f && f.type === 'number' && val !== '') val = Number(val);
      st.attrs[el.dataset.key] = val;
      if (el.dataset.key === 'formation') {
        const changed = fillFromFormation(st, false);
        for (const k of [...changed, 'member']) {
          const field = schema.find(x => x.key === k);
          const row = body.querySelector(`[data-field="${k}"]`);
          if (!field || !row) continue;
          const old = row.querySelector('[data-key]');
          const tmp = document.createElement('div');
          tmp.innerHTML = inputHtml(field, st.attrs[k], st.attrs);
          old.replaceWith(tmp.firstElementChild);
          bind(row.querySelector('[data-key]'));
        }
        if (changed.length) toast('Era, Period, Epoch and Age filled from ' + val);
      }
      if (schema.some(x => x.showIf && x.showIf.field === el.dataset.key)) {
        schema.forEach(x => {
          const row = body.querySelector(`[data-field="${x.key}"]`);
          if (row) row.style.display = fieldVisible(x, st.attrs) ? '' : 'none';
        });
        refreshGroupTitles(body);
      }
      queueSave(st);
    };
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', handler);
  };
  body.querySelectorAll('[data-key]').forEach(bind);
  // colour pickers open on the typical colours of the station's lithology
  body.querySelectorAll('.colour-field').forEach(el => bindColourField(el, () => st.attrs.lithology || ''));

  $('#st-rename').onclick = async () => {
    const input = window.prompt('New station name', st.code);
    resetViewport();
    if (input == null) return;
    const name = input.trim();
    if (!name || name === st.code) return;
    if (state.stations.some(s => s.id !== st.id && s.code.toLowerCase() === name.toLowerCase())) {
      toast(`"${name}" is already used by another station`, 3500);
      return;
    }
    const old = st.code;
    st.code = name;
    // form fields that are auto-filled with the station ID follow the new name
    for (const f of state.project.schema) if (f.auto === 'station' && (st.attrs[f.key] === old || !st.attrs[f.key])) st.attrs[f.key] = name;
    await saveStation(st);
    nav.refreshTitle();
    renderTab();
    toast(`Renamed ${old} → ${name}`);
  };
  $('#st-map').onclick = () => nav.showOnMap(st);
  $('#st-regps').onclick = async () => {
    if (!state.gps) { toast('No GPS fix'); return; }
    if (!(await confirmBox('Replace this station position with the current GPS position?'))) return;
    setPosition(st, { ...state.gps, source: 'GPS' });
    applyAuto(st, POSITION_SOURCES);
    await saveStation(st); renderTab(); toast('Position updated');
  };
  $('#st-refill').onclick = async () => {
    applyAuto(st, POSITION_SOURCES.concat(['station', 'region', 'license', 'project', 'prospect', 'geologist']));
    const geo = await geologyFill(st.lat, st.lon);
    Object.assign(st.attrs, geo);
    Object.assign(st.attrs, await autofillFromLayers(st.lat, st.lon)); // own layers win over the built-in map
    fillFromFormation(st, false);
    await saveStation(st); renderTab();
    toast(st.attrs.formation ? `Auto-fill applied · ${st.attrs.formation} (geological map)` : 'Auto-fill applied');
  };
  $('#st-del').onclick = async () => {
    if (!(await confirmBox(`Delete ${st.code} with its photos, structures and log? This cannot be undone.`))) return;
    await deleteStation(st);
    nav.back();
  };
}

function refreshGroupTitles(body) {
  body.querySelectorAll('.group-title[data-group]').forEach(t => {
    let el = t.nextElementSibling, any = false;
    while (el && !el.classList.contains('group-title')) { if (el.style.display !== 'none' && el.classList.contains('field')) any = true; el = el.nextElementSibling; }
    t.style.display = any ? '' : 'none';
  });
}

function applyAuto(st, onlySources) {
  for (const f of state.project.schema) {
    if (!f.auto || f.auto === 'sample_no' || f.auto === 'date') continue;
    if (onlySources && !onlySources.includes(f.auto)) continue;
    st.attrs[f.key] = autoValue(f.auto, st);
  }
}

function queueSave(st) {
  const badge = $('#save-state');
  if (badge) badge.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveStation(st);
    const b = $('#save-state'); if (b) b.textContent = 'Saved';
  }, 400);
}

// ---------- photos ----------
async function compress(file, maxSide = 2048, quality = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', quality));
  } finally { URL.revokeObjectURL(url); }
}

const thumbUrls = [];
async function renderPhotos(st, body) {
  thumbUrls.splice(0).forEach(u => URL.revokeObjectURL(u));
  const photos = (await db.byIndex('photos', 'stationId', st.id)).sort((a, b) => a.time.localeCompare(b.time));
  body.innerHTML = `<div class="card"><div class="btns" style="margin:0">
      <label class="btn primary" style="text-align:center">Take photo<input type="file" accept="image/*" capture="environment" class="hidden" id="ph-cam"></label>
      <label class="btn" style="text-align:center">From library<input type="file" accept="image/*" multiple class="hidden" id="ph-lib"></label>
    </div><p class="muted" style="margin-bottom:0">${photos.length} photo(s). Photos are named ${esc(st.code)}_01.jpg, _02… in exports.</p></div>
    <div class="photos">${photos.map((p, i) => {
      const u = URL.createObjectURL(p.blob); thumbUrls.push(u);
      return `<div class="ph" data-id="${p.id}"><img src="${u}" alt=""><div class="cap">${i + 1}. ${esc(p.caption || '')}</div></div>`;
    }).join('')}</div>`;

  const add = async files => {
    for (const f of files) {
      const blob = await compress(f);
      await db.put('photos', { id: uid(), stationId: st.id, projectId: st.projectId, blob, caption: '', time: new Date().toISOString() });
    }
    st.photoCount = (await db.byIndex('photos', 'stationId', st.id)).length;
    await saveStation(st);
    renderPhotos(st, body);
  };
  $('#ph-cam').onchange = e => add(e.target.files);
  $('#ph-lib').onchange = e => add(e.target.files);
  body.querySelectorAll('.ph').forEach(el => el.addEventListener('click', () => {
    const p = photos.find(x => x.id === el.dataset.id);
    const u = URL.createObjectURL(p.blob);
    const m = openModal('Photo', `<img class="full-img" src="${u}">
      <div class="field" style="margin-top:10px"><label>Caption / view direction</label><input type="text" id="ph-cap" value="${esc(p.caption)}" placeholder="e.g. Looking N, contact Fm A / Fm B"></div>
      <div class="btns"><button class="btn primary" id="ph-save">Save</button><button class="btn danger" id="ph-del">Delete</button></div>`, () => URL.revokeObjectURL(u));
    m.querySelector('#ph-save').onclick = async () => { p.caption = m.querySelector('#ph-cap').value; await db.put('photos', p); closeModal(); renderPhotos(st, body); };
    m.querySelector('#ph-del').onclick = async () => {
      if (!(await confirmBox('Delete this photo?'))) return;
      await db.del('photos', p.id);
      st.photoCount = Math.max(0, (st.photoCount || 1) - 1); await saveStation(st);
      closeModal(); renderPhotos(st, body);
    };
  }));
}

// ---------- station list ----------
export function renderStationList() {
  const q = ($('#station-search').value || '').toLowerCase();
  const list = state.stations.slice().reverse().filter(s => !q || JSON.stringify([s.code, s.attrs]).toLowerCase().includes(q));
  $('#station-list').innerHTML = list.length ? list.map(s => {
    const a = s.attrs || {};
    const sub = [a.lithology, a.formation, a.sample_no ? 'Sample ' + a.sample_no : '', new Date(s.created).toLocaleString()].filter(Boolean).join(' · ');
    return `<div class="row" data-id="${s.id}"><div class="main"><div class="t1">${esc(s.code)}</div><div class="t2">${esc(sub)}</div></div>
      ${s.structures && s.structures.length ? `<span class="badge">${s.structures.length} str</span>` : ''}
      ${s.log && s.log.beds && s.log.beds.length ? `<span class="badge">log</span>` : ''}
      ${s.photoCount ? `<span class="badge">${s.photoCount} ph</span>` : ''}</div>`;
  }).join('') : `<div class="empty">${state.stations.length ? 'No match' : 'No stations yet.<br>Go to the Map and tap “+ GPS point”.'}</div>`;
  $$('#station-list .row').forEach(r => r.addEventListener('click', () => nav.openStation(r.dataset.id)));
}
$('#station-search').addEventListener('input', renderStationList);
