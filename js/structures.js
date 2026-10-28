// Structural measurements: entry (manual or phone compass/clinometer) and equal-area stereonets.
import { state, saveStation } from './state.js';
import { uid } from './db.js';
import { $, esc, openModal, closeModal, toast, confirmBox } from './ui.js';
import {
  norm360, strikeFromDipDir, dipDirFromStrike, planeFromOrientation, lineFromOrientation, projectLine, poleOf, greatCircle,
} from './geo.js';

export const STRUCT_TYPES = {
  Bedding: { kind: 'plane', color: '#1e88e5' },
  Foliation: { kind: 'plane', color: '#8e24aa' },
  Cleavage: { kind: 'plane', color: '#5e35b1' },
  Joint: { kind: 'plane', color: '#757575' },
  Fault: { kind: 'plane', color: '#e53935' },
  Vein: { kind: 'plane', color: '#fdd835' },
  Dyke: { kind: 'plane', color: '#6d4c41' },
  Contact: { kind: 'plane', color: '#00897b' },
  'Shear zone': { kind: 'plane', color: '#f4511e' },
  'Axial plane': { kind: 'plane', color: '#3949ab' },
  Lineation: { kind: 'line', color: '#43a047' },
  'Fold axis': { kind: 'line', color: '#c0ca33' },
  'Slickenline': { kind: 'line', color: '#d81b60' },
  'Mineral lineation': { kind: 'line', color: '#2e7d32' },
};

export function describe(m) {
  if (m.kind === 'line') return `${String(m.plunge).padStart(2, '0')}→${String(m.trend).padStart(3, '0')}`;
  return `${String(m.dip).padStart(2, '0')}/${String(m.dipDir).padStart(3, '0')}`;
}

// ---------- stereonet ----------
export function stereonetSvg(measurements, { size = 320, circles = true } = {}) {
  const R = size / 2 - 14, c = size / 2;
  const P = ({ x, y }) => `${(c + x * R).toFixed(1)},${(c + y * R).toFixed(1)}`;
  let s = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
    <circle cx="${c}" cy="${c}" r="${R}" fill="#fff" stroke="#222" stroke-width="1.5"/>
    <line x1="${c - 5}" y1="${c}" x2="${c + 5}" y2="${c}" stroke="#999"/><line x1="${c}" y1="${c - 5}" x2="${c}" y2="${c + 5}" stroke="#999"/>
    <text x="${c}" y="10" text-anchor="middle" font-size="11" fill="#ccc">N</text>`;
  for (let a = 0; a < 360; a += 10) {
    const t = a * Math.PI / 180, l = a % 90 === 0 ? 8 : 4;
    s += `<line x1="${c + R * Math.sin(t)}" y1="${c - R * Math.cos(t)}" x2="${c + (R - l) * Math.sin(t)}" y2="${c - (R - l) * Math.cos(t)}" stroke="#222"/>`;
  }
  for (const m of measurements) {
    const color = (STRUCT_TYPES[m.type] || {}).color || '#000';
    if (m.kind === 'line') {
      const p = projectLine(m.trend, m.plunge);
      s += `<rect x="${(c + p.x * R - 4).toFixed(1)}" y="${(c + p.y * R - 4).toFixed(1)}" width="8" height="8" fill="${color}" stroke="#000" stroke-width=".7"/>`;
    } else {
      if (circles) s += `<polyline points="${greatCircle(m.dipDir, m.dip).map(P).join(' ')}" fill="none" stroke="${color}" stroke-width="1.2" opacity=".8"/>`;
      const pl = poleOf(m.dipDir, m.dip);
      const pole = projectLine(pl.trend, pl.plunge);
      s += `<circle cx="${(c + pole.x * R).toFixed(1)}" cy="${(c + pole.y * R).toFixed(1)}" r="4" fill="${color}" stroke="#000" stroke-width=".7"/>`;
    }
  }
  return s + '</svg>';
}

function legend(measurements) {
  const types = [...new Set(measurements.map(m => m.type))];
  return `<div class="legend">${types.map(t => `<span><i style="background:${(STRUCT_TYPES[t] || {}).color}"></i>${esc(t)}</span>`).join('')}
    <span class="muted">● pole &nbsp;■ line</span></div>`;
}

// ---------- station tab ----------
export function renderStationStructures(st, body) {
  const list = st.structures || [];
  body.innerHTML = `<div class="card"><div class="btns" style="margin:0"><button class="btn primary" id="sm-add">+ Add measurement</button></div></div>
    ${list.length ? `<div class="card"><table class="tbl"><tr><th>Type</th><th>Measure</th><th>Strike</th><th>Note</th></tr>
      ${list.map((m, i) => `<tr data-i="${i}"><td>${esc(m.type)}</td><td><b>${describe(m)}</b></td><td>${m.kind === 'plane' ? String(m.strike).padStart(3, '0') : ''}</td><td>${esc(m.note || '')}</td></tr>`).join('')}
    </table><p class="muted">Planes: dip/dip direction. Lines: plunge→trend. Tap a row to edit.</p></div>
    <div class="card"><div class="stereo-wrap">${stereonetSvg(list)}</div>${legend(list)}</div>`
    : '<div class="empty">No measurements at this station yet.</div>'}`;
  $('#sm-add').onclick = () => editMeasurement(st, null, () => renderStationStructures(st, body));
  body.querySelectorAll('tr[data-i]').forEach(r => r.addEventListener('click', () =>
    editMeasurement(st, list[Number(r.dataset.i)], () => renderStationStructures(st, body))));
}

// ---------- editor ----------
let lastType = 'Bedding';
let lastFormat = 'dipdir';

export function editMeasurement(st, existing, done, draft) {
  const m = draft ? { ...draft } : existing ? { ...existing } : { id: uid(), type: lastType, kind: STRUCT_TYPES[lastType].kind, dip: '', dipDir: '', strike: '', trend: '', plunge: '', note: '', method: 'manual' };
  const body = openModal(existing ? 'Edit measurement' : 'New measurement', `
    <div class="field"><label>Type</label><select id="sm-type">${Object.keys(STRUCT_TYPES).map(t => `<option ${t === m.type ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div id="sm-plane">
      <div class="seg" style="margin:0 0 10px;position:static"><button data-f="dipdir">Dip / Dip dir</button><button data-f="strike">Strike / Dip (RHR)</button></div>
      <div class="grid2" id="sm-pf"></div>
    </div>
    <div id="sm-line" class="grid2">
      <div class="field"><label>Plunge (0-90)</label><input type="number" inputmode="numeric" id="sm-plunge" value="${m.plunge}"></div>
      <div class="field"><label>Trend (0-360)</label><input type="number" inputmode="numeric" id="sm-trend" value="${m.trend}"></div>
    </div>
    <div class="btns"><button class="btn green" id="sm-compass">Measure with phone</button></div>
    <div class="field"><label>Note</label><input type="text" id="sm-note" value="${esc(m.note || '')}"></div>
    <div class="btns"><button class="btn primary" id="sm-save">Save</button>${existing ? '<button class="btn danger" id="sm-del">Delete</button>' : ''}</div>
    <p class="muted">Magnetic declination applied by the phone compass: ${state.project.declination}° (change in Project).</p>`);

  const typeSel = body.querySelector('#sm-type');
  const renderPlaneFields = () => {
    body.querySelectorAll('#sm-plane .seg button').forEach(b => b.classList.toggle('active', b.dataset.f === lastFormat));
    body.querySelector('#sm-pf').innerHTML = lastFormat === 'dipdir'
      ? `<div class="field"><label>Dip (0-90)</label><input type="number" inputmode="numeric" id="sm-dip" value="${m.dip}"></div>
         <div class="field"><label>Dip direction (0-360)</label><input type="number" inputmode="numeric" id="sm-dipdir" value="${m.dipDir}"></div>`
      : `<div class="field"><label>Strike (0-360)</label><input type="number" inputmode="numeric" id="sm-strike" value="${m.strike}"></div>
         <div class="field"><label>Dip (0-90)</label><input type="number" inputmode="numeric" id="sm-dip" value="${m.dip}"></div>`;
  };
  const readPlane = () => {
    const dip = Number(body.querySelector('#sm-dip').value);
    if (lastFormat === 'dipdir') {
      m.dip = dip; m.dipDir = norm360(Number(body.querySelector('#sm-dipdir').value)); m.strike = strikeFromDipDir(m.dipDir);
    } else {
      m.dip = dip; m.strike = norm360(Number(body.querySelector('#sm-strike').value)); m.dipDir = dipDirFromStrike(m.strike);
    }
  };
  const syncKind = () => {
    m.type = typeSel.value; m.kind = STRUCT_TYPES[m.type].kind;
    body.querySelector('#sm-plane').style.display = m.kind === 'plane' ? '' : 'none';
    body.querySelector('#sm-line').style.display = m.kind === 'line' ? '' : 'none';
  };
  renderPlaneFields(); syncKind();
  typeSel.onchange = syncKind;
  body.querySelectorAll('#sm-plane .seg button').forEach(b => b.onclick = () => {
    if (body.querySelector('#sm-dip').value !== '') readPlane();
    lastFormat = b.dataset.f; renderPlaneFields();
  });

  body.querySelector('#sm-compass').onclick = () => {
    if (m.kind === 'plane') readPlaneSafe();
    openCompass(m.kind, reading => {
      Object.assign(m, reading, { method: 'compass' });
      if (m.kind === 'plane') m.strike = strikeFromDipDir(m.dipDir);
      reopen();
    });
  };
  const readPlaneSafe = () => { try { if (body.querySelector('#sm-dip').value !== '') readPlane(); } catch (e) { /* ignore */ } };
  const reopen = () => { m.note = body.querySelector('#sm-note') ? body.querySelector('#sm-note').value : m.note; editMeasurement(st, existing, done, m); };

  body.querySelector('#sm-save').onclick = async () => {
    m.note = body.querySelector('#sm-note').value;
    if (m.kind === 'plane') {
      readPlane();
      if (isNaN(m.dip) || m.dip < 0 || m.dip > 90 || body.querySelector('#sm-dip').value === '') { toast('Dip must be 0–90'); return; }
      m.trend = ''; m.plunge = '';
    } else {
      m.plunge = Number(body.querySelector('#sm-plunge').value); m.trend = norm360(Number(body.querySelector('#sm-trend').value));
      if (body.querySelector('#sm-plunge').value === '' || m.plunge < 0 || m.plunge > 90) { toast('Plunge must be 0–90'); return; }
      m.dip = ''; m.dipDir = ''; m.strike = '';
    }
    m.time = m.time || new Date().toISOString();
    lastType = m.type;
    st.structures = st.structures || [];
    const i = st.structures.findIndex(x => x.id === m.id);
    if (i >= 0) st.structures[i] = m; else st.structures.push(m);
    await saveStation(st);
    closeModal(); done && done();
  };
  const del = body.querySelector('#sm-del');
  if (del) del.onclick = async () => {
    if (!(await confirmBox('Delete this measurement?'))) return;
    st.structures = st.structures.filter(x => x.id !== m.id);
    await saveStation(st); closeModal(); done && done();
  };
}

// ---------- phone compass / clinometer ----------
let orient = null;
function onOrient(e) {
  const heading = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute && e.alpha != null ? norm360(360 - e.alpha) : null);
  orient = { beta: e.beta, gamma: e.gamma, heading };
}

async function startOrientation() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    const r = await DeviceOrientationEvent.requestPermission();
    if (r !== 'granted') throw new Error('Motion & orientation access was refused');
  }
  window.addEventListener('deviceorientation', onOrient);
  window.addEventListener('deviceorientationabsolute', onOrient);
}
function stopOrientation() {
  window.removeEventListener('deviceorientation', onOrient);
  window.removeEventListener('deviceorientationabsolute', onOrient);
}

async function openCompass(kind, onCapture) {
  try { await startOrientation(); } catch (e) { toast(e.message, 4000); return; }
  const decl = Number(state.project.declination) || 0;
  let timer;
  const body = openModal(kind === 'plane' ? 'Measure plane' : 'Measure line', `
    <p class="muted">${kind === 'plane'
      ? 'Lay the phone flat on the surface (screen up). Hold still, then tap Capture.'
      : 'Point the TOP edge of the phone along the lineation, phone edge on the surface. Hold still, then tap Capture.'}</p>
    <div class="compass-read" id="cp-main">–</div><div class="compass-sub" id="cp-sub"></div>
    <div class="bubble"><div class="dot" id="cp-dot"></div></div>
    <div class="btns"><button class="btn primary" id="cp-cap">Capture</button></div>`, () => {
    clearInterval(timer); stopOrientation();
  });
  const samples = [];
  const reading = () => {
    if (!orient || orient.heading == null || orient.beta == null) return null;
    return kind === 'plane' ? planeFromOrientation(orient.beta, orient.gamma, orient.heading, decl) : lineFromOrientation(orient.beta, orient.heading, decl);
  };
  timer = setInterval(() => {
    const r = reading();
    if (!r) { body.querySelector('#cp-sub').textContent = 'Waiting for compass… (move the phone in a figure 8 if it stays empty)'; return; }
    samples.push(r); if (samples.length > 8) samples.shift();
    body.querySelector('#cp-main').textContent = kind === 'plane' ? `${String(r.dip).padStart(2, '0')} / ${String(r.dipDir).padStart(3, '0')}` : `${String(r.plunge).padStart(2, '0')} → ${String(r.trend).padStart(3, '0')}`;
    body.querySelector('#cp-sub').textContent = kind === 'plane' ? `Dip / Dip direction · strike ${String(strikeFromDipDir(r.dipDir)).padStart(3, '0')}` : 'Plunge → Trend';
    const dot = body.querySelector('#cp-dot');
    const gx = Math.max(-1, Math.min(1, (orient.gamma || 0) / 45)), gy = Math.max(-1, Math.min(1, (orient.beta || 0) / 45));
    dot.style.left = (61 + gx * 55) + 'px'; dot.style.top = (61 + gy * 55) + 'px';
  }, 150);
  body.querySelector('#cp-cap').onclick = () => {
    const r = averaged(samples, kind);
    if (!r) { toast('No reading yet'); return; }
    clearInterval(timer); stopOrientation();
    onCapture(r);
  };
}

// Circular mean of directions over the last few samples to steady the reading.
function averaged(samples, kind) {
  if (!samples.length) return null;
  const dirKey = kind === 'plane' ? 'dipDir' : 'trend', angKey = kind === 'plane' ? 'dip' : 'plunge';
  let sx = 0, sy = 0, sa = 0;
  for (const s of samples) { sx += Math.cos(s[dirKey] * Math.PI / 180); sy += Math.sin(s[dirKey] * Math.PI / 180); sa += s[angKey]; }
  return { [dirKey]: Math.round(norm360(Math.atan2(sy, sx) * 180 / Math.PI)), [angKey]: Math.round(sa / samples.length) };
}

// ---------- project-wide view ----------
let filterType = 'All';
export function renderProjectStructures(openStation) {
  const all = [];
  for (const st of state.stations) for (const m of st.structures || []) all.push({ ...m, station: st.code, stationId: st.id });
  const types = ['All', ...new Set(all.map(m => m.type))];
  if (!types.includes(filterType)) filterType = 'All';
  const shown = filterType === 'All' ? all : all.filter(m => m.type === filterType);
  const body = $('#structs-body');
  body.innerHTML = all.length ? `
    <div class="toolbar"><select id="sf-type">${types.map(t => `<option ${t === filterType ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <label class="check" style="flex:0 0 auto"><input type="checkbox" id="sf-gc" checked> Great circles</label></div>
    <div class="card"><div class="stereo-wrap" id="sf-net">${stereonetSvg(shown)}</div>${legend(shown)}
      <p class="muted" style="text-align:center">Equal-area, lower hemisphere · n = ${shown.length}</p></div>
    <div class="card"><table class="tbl"><tr><th>Station</th><th>Type</th><th>Measure</th></tr>
      ${shown.map(m => `<tr data-st="${m.stationId}"><td>${esc(m.station)}</td><td>${esc(m.type)}</td><td><b>${describe(m)}</b></td></tr>`).join('')}</table></div>`
    : '<div class="empty">No structural measurements yet.<br>Open a station → Structures → Add measurement.</div>';
  const sel = body.querySelector('#sf-type');
  if (sel) {
    sel.onchange = () => { filterType = sel.value; renderProjectStructures(openStation); };
    body.querySelector('#sf-gc').onchange = e => { body.querySelector('#sf-net').innerHTML = stereonetSvg(shown, { circles: e.target.checked }); };
    body.querySelectorAll('tr[data-st]').forEach(r => r.onclick = () => openStation(r.dataset.st, 'structures'));
  }
}
