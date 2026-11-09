// Project screen: settings, projects, form (schema) editor, export, backup/restore.
import { state, saveProject, loadProject, newProject } from './state.js';
import { db, uid } from './db.js';
import { $, esc, toast, openModal, closeModal, confirmBox, saveFile, fileStamp } from './ui.js';
import { UTM_ZONES } from './geo.js';
import { AUTO_SOURCES, cloneSchema } from './schema.js';
import { EXPORTS, runExport } from './export.js';
import { fillEmptyForAll } from './station.js';
import { importFiles, projectLayers, attributeNames, hideLayer } from './layers.js';
import { map } from './mapview.js';

// ---------- auto-fill files: one polygon file per field (Region, License, Prospect, Formation) ----------
// A station takes the attribute value of the polygon its GPS position falls in. The geologist's files win over
// the built-in geological map. Files are kept on the phone (not drawn on the map unless switched on in ☰).
const SLOTS = [
  ['region', 'Region', /region|emirate|province|adm1|mintaqa/i],
  ['license', 'License', /licen|lic_|permit|concession|lease/i],
  ['prospect', 'Prospect', /prospect|target|block/i],
  ['formation', 'Formation', /^formation_?$|formation|fm|unit|geol/i],
];
// the column to read: one whose name fits (e.g. "LICENSE"), preferring full names over short codes
// (in Fomation_Platforme.shp, "Formation_" = "Minjur" beats "Formation" = "MNJ")
function guessAttribute(layer, re) {
  const names = attributeNames(layer).filter(n => !/area|leng|^fid$|^id$|objectid/i.test(n));
  const feats = (layer.geojson.features || []).slice(0, 300);
  const avgLen = n => { const v = feats.map(f => f.properties && f.properties[n]).filter(x => typeof x === 'string' && x); return v.length ? v.reduce((s, x) => s + x.length, 0) / v.length : 0; };
  const best = list => list.sort((a, b) => avgLen(b) - avgLen(a))[0];
  return best(names.filter(n => re.test(n))) || best(names.filter(n => /name/i.test(n))) || names[0] || '';
}
async function slotsHtml() {
  const layers = await projectLayers();
  return SLOTS.map(([key, label]) => {
    const l = layers.find(x => x.slot === key);
    const attrs = l ? attributeNames(l) : [];
    const attr = l && l.autofill ? l.autofill[key] : '';
    const sample = l ? [...new Set((l.geojson.features || []).map(f => f.properties && f.properties[attr]).filter(v => v != null && v !== ''))].slice(0, 3).join(', ') : '';
    return `<div class="slot" data-key="${key}">
      <div class="slot-head"><b>${label}</b>
        <label class="btn small ${l ? '' : 'primary'}">${l ? 'Replace' : 'Upload file'}<input type="file" multiple class="hidden slot-file"></label>
        ${l ? '<button class="btn small danger slot-del">Remove</button>' : ''}</div>
      ${l ? `<div class="muted">${esc(l.name)} · ${(l.geojson.features || []).length} polygons</div>
        <div class="field" style="margin:6px 0 0"><label>Take the ${label} from the column</label>
        <select class="slot-attr">${attrs.map(a => `<option ${a === attr ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
        <div class="muted">e.g. ${esc(sample || '—')}</div>` : '<div class="muted">No file yet</div>'}</div>`;
  }).join('');
}
async function bindSlots(card) {
  card.querySelector('#pj-slots').innerHTML = await slotsHtml();
  const layers = await projectLayers();
  card.querySelectorAll('.slot').forEach(row => {
    const [key, label, re] = SLOTS.find(s => s[0] === row.dataset.key);
    const old = layers.find(x => x.slot === key);
    row.querySelector('.slot-file').onchange = async e => {
      toast(`Reading ${label} file…`);
      const created = await importFiles(e.target.files);
      // keep the layer with the most polygons; drop anything else that came in the same upload
      const polys = l => (l.geojson && l.geojson.features || []).filter(f => f.geometry && /Polygon/.test(f.geometry.type)).length;
      const pick = created.filter(l => l.kind === 'vector').sort((a, b) => polys(b) - polys(a))[0];
      for (const l of created) if (l !== pick) await db.del('layers', l.id);
      if (!pick || !polys(pick)) { if (pick) await db.del('layers', pick.id); toast('No polygons found in that file. Use a shapefile (.zip, or .shp + .dbf + .prj together), KML/KMZ or GeoJSON.', 5000); return; }
      if (old) { hideLayer(map, old.id); await db.del('layers', old.id); }
      hideLayer(map, pick.id);
      Object.assign(pick, { slot: key, visible: false, autofill: { [key]: guessAttribute(pick, re) } });
      await db.put('layers', pick);
      toast(`${label} file ready: ${polys(pick)} polygons`);
      bindSlots(card);
    };
    const del = row.querySelector('.slot-del');
    if (del) del.onclick = async () => {
      if (!(await confirmBox(`Remove the ${label} file? Stations already filled keep their values.`))) return;
      hideLayer(map, old.id); await db.del('layers', old.id); bindSlots(card);
    };
    const sel = row.querySelector('.slot-attr');
    if (sel) sel.onchange = async () => { old.autofill = { [key]: sel.value }; await db.put('layers', old); bindSlots(card); toast(`${label} now taken from ${sel.value}`); };
  });
}

const SETTINGS = [
  ['name', 'Project name (in the app)', 'text'],
  ['region', 'Region', 'text'], ['license', 'License', 'text'], ['project', 'Project', 'text'], ['prospect', 'Prospect', 'text'],
  ['geologist', 'Geologist', 'text'],
  ['stationPrefix', 'Station prefix', 'text'], ['nextStation', 'Next station number', 'number'], ['nextSample', 'Next sample number (minimum)', 'number'],
  ['declination', 'Magnetic declination (° east +)', 'number'],
];

export async function renderProject() {
  const p = state.project;
  const projects = (await db.all('projects')).sort((a, b) => a.name.localeCompare(b.name));
  const body = $('#project-body');
  body.innerHTML = `
    <div class="card"><h3>Project</h3>
      <div class="field"><label>Current project</label><select id="pj-switch">${projects.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
      <div class="btns"><button class="btn" id="pj-new">+ New project</button><button class="btn danger" id="pj-del">Delete project</button></div>
    </div>
    <div class="card"><h3>Settings (auto-filled into every new station)</h3>
      ${SETTINGS.map(([k, label, type]) => `<div class="field"><label>${label}</label><input type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} data-k="${k}" value="${esc(p[k])}"></div>`).join('')}
      <div class="field"><label>Coordinate system</label><select id="pj-zone">${UTM_ZONES.map(z => `<option value="${z}" ${z === p.utmZone ? 'selected' : ''}>WGS 84 / UTM zone ${z}N (EPSG:326${z})</option>`).join('')}</select></div>
      <p class="muted">Tip: to auto-fill License, Prospect, Formation, Era… from where you stand, import the boundary or geology polygons in Map → Layers, then open the layer's ⋯ menu.</p>
    </div>
    <div class="card" id="pj-slots-card"><h3>Auto-fill from your files</h3>
      <p class="muted">Upload one polygon file for each: shapefile (.zip, or .shp + .dbf + .prj + .cpg picked together), KML/KMZ or GeoJSON. New stations take the value of the polygon they are in, from GPS. Then use “Fill empty boxes now” below for stations you already have.</p>
      <div id="pj-slots"></div></div>
    <div class="card"><h3>Fill empty boxes</h3>
      <p class="muted">For all ${state.stations.length} stations: fills only the boxes that are still empty, from the settings above, the station position, your own map layers and the built-in geological map (Formation, Era, Period, Epoch, Age, main rock type, rock class). Nothing you typed is changed.</p>
      <div class="btns"><button class="btn primary" id="pj-fill">Fill empty boxes now</button></div>
      <p class="muted" id="pj-fill-result"></p></div>
    <div class="card"><h3>Station form</h3>
      <p class="muted">${p.schema.length} fields. Add, remove, rename fields, change dropdown lists and auto-fill sources.</p>
      <div class="btns"><button class="btn" id="pj-schema">Edit form fields</button></div></div>
    <div class="card"><h3>Export</h3><p class="muted">${state.stations.length} stations. On iPhone the share sheet opens: choose “Save to Files”, AirDrop, Mail or WhatsApp.</p>
      ${Object.entries(EXPORTS).map(([k, e]) => `<div class="row" style="background:var(--bg3)" data-exp="${k}"><div class="main"><div class="t1">${e.label}</div><div class="t2">${e.desc}</div></div><span>›</span></div>`).join('')}
    </div>
    <div class="card"><h3>Backup</h3>
      <p class="muted">A full backup (all projects data + photos) can be restored on this or another phone. Make one every evening.</p>
      <div class="btns"><button class="btn primary" id="pj-backup">Save full backup</button>
        <label class="btn" style="text-align:center">Restore backup<input type="file" id="pj-restore" class="hidden"></label></div>
      <p class="muted" id="pj-storage"></p></div>
    <p class="muted" style="text-align:center;padding-bottom:20px">GeoField v0.1 · works offline</p>`;

  body.querySelectorAll('input[data-k]').forEach(el => el.addEventListener('change', async () => {
    const k = el.dataset.k;
    p[k] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
    await saveProject();
    toast('Saved');
  }));
  $('#pj-zone').onchange = async e => { p.utmZone = Number(e.target.value); await saveProject(); toast('Coordinate system changed. Existing stations keep their zone.'); };
  $('#pj-switch').onchange = async e => { await loadProject(e.target.value); renderProject(); toast('Project opened'); };
  $('#pj-new').onclick = async () => {
    const name = window.prompt('New project name');
    if (!name) return;
    const np = newProject(name);
    // carry over company settings and the customised form
    Object.assign(np, { region: p.region, license: p.license, geologist: p.geologist, utmZone: p.utmZone, declination: p.declination, schema: JSON.parse(JSON.stringify(p.schema)) });
    await db.put('projects', np);
    await loadProject(np.id);
    renderProject();
  };
  $('#pj-del').onclick = async () => {
    if (!(await confirmBox(`Delete project "${p.name}" with ALL its stations, photos and layers? Make a backup first. This cannot be undone.`))) return;
    for (const s of state.stations) {
      for (const ph of await db.byIndex('photos', 'stationId', s.id)) await db.del('photos', ph.id);
      await db.del('stations', s.id);
    }
    for (const l of await db.byIndex('layers', 'projectId', p.id)) await db.del('layers', l.id);
    await db.del('projects', p.id);
    await loadProject(null);
    renderProject();
  };
  $('#pj-schema').onclick = () => openSchemaEditor();
  bindSlots($('#pj-slots-card'));
  $('#pj-fill').onclick = async () => {
    const btn = $('#pj-fill'), out = $('#pj-fill-result');
    btn.disabled = true;
    try {
      const r = await fillEmptyForAll((i, n) => { btn.textContent = `Filling… ${i} / ${n}`; });
      const lines = Object.entries(r.fields).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${esc(k)}: ${c}`);
      out.innerHTML = r.stations ? `<b>${r.stations} station(s) updated.</b><br>${lines.join(' · ')}` : 'Nothing to fill: every box that can be filled already has a value.';
      toast(r.stations ? `Filled empty boxes in ${r.stations} station(s)` : 'No empty boxes to fill');
    } catch (e) { console.error(e); toast('Could not fill: ' + e.message, 4000); }
    btn.disabled = false; btn.textContent = 'Fill empty boxes now';
  };
  body.querySelectorAll('[data-exp]').forEach(r => r.onclick = async () => {
    toast('Preparing export…', 4000);
    try { await runExport(r.dataset.exp); } catch (e) { console.error(e); toast('Export failed: ' + e.message, 4000); }
  });
  $('#pj-backup').onclick = backup;
  $('#pj-restore').onchange = e => restore(e.target.files[0]);
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(est => {
      const el = $('#pj-storage');
      if (el) el.textContent = `Storage used on this phone: ${(est.usage / 1048576).toFixed(1)} MB`;
    });
  }
}

// ---------- schema editor ----------
function openSchemaEditor() {
  const schema = state.project.schema;
  const body = openModal('Station form fields', `
    <p class="muted">Tap a field to edit it. Order here is the order in the form.</p>
    ${schema.map((f, i) => `<div class="layer-row" data-i="${i}">
      <div class="nm">${esc(f.label)}<div class="muted">${f.group || ''} · ${f.type}${f.auto ? ' · auto: ' + AUTO_SOURCES[f.auto] : ''}</div></div>
      <button class="btn small up">↑</button><button class="btn small dn">↓</button></div>`).join('')}
    <div class="btns"><button class="btn primary" id="sc-add">+ Add field</button><button class="btn" id="sc-reset">Reset to default</button></div>
    <div class="btns"><button class="btn" id="sc-export">Share form (JSON)</button>
      <label class="btn" style="text-align:center">Load form (JSON)<input type="file" id="sc-import" class="hidden"></label></div>`);
  body.querySelectorAll('.layer-row').forEach(row => {
    const i = Number(row.dataset.i);
    row.querySelector('.nm').onclick = () => editField(i);
    row.querySelector('.up').onclick = async () => { if (i > 0) { [schema[i - 1], schema[i]] = [schema[i], schema[i - 1]]; await saveProject(); openSchemaEditor(); } };
    row.querySelector('.dn').onclick = async () => { if (i < schema.length - 1) { [schema[i + 1], schema[i]] = [schema[i], schema[i + 1]]; await saveProject(); openSchemaEditor(); } };
  });
  $('#sc-add').onclick = () => editField(null);
  $('#sc-reset').onclick = async () => {
    if (!(await confirmBox('Replace this form with the default form? Data already entered is kept.'))) return;
    state.project.schema = cloneSchema(); await saveProject(); openSchemaEditor();
  };
  $('#sc-export').onclick = () => saveFile(new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' }), 'geofield_form.json');
  $('#sc-import').onchange = async e => {
    try {
      const s = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(s) || !s.every(f => f.key && f.label)) throw new Error('Not a GeoField form file');
      state.project.schema = s; await saveProject(); openSchemaEditor(); toast('Form loaded');
    } catch (err) { toast(err.message, 4000); }
  };
}

function editField(index) {
  const schema = state.project.schema;
  const f = index == null ? { key: '', label: '', type: 'text', group: schema.length ? schema[schema.length - 1].group : 'Custom', options: [], auto: '' } : { ...schema[index] };
  const groups = [...new Set(schema.map(x => x.group).filter(Boolean))];
  const body = openModal(index == null ? 'New field' : 'Edit field', `
    <div class="field"><label>Label (shown in form and CSV)</label><input type="text" id="fd-label" value="${esc(f.label)}"></div>
    <div class="field"><label>Type</label><select id="fd-type">${['text', 'number', 'select', 'textarea', 'date', 'colour'].map(t => `<option ${t === f.type ? 'selected' : ''} value="${t}">${{ text: 'Text', number: 'Number', select: 'Dropdown list', textarea: 'Long text', date: 'Date', colour: 'Rock colour (chart)' }[t]}</option>`).join('')}</select></div>
    <div class="field" id="fd-opts-wrap"><label>Dropdown choices (one per line)</label><textarea id="fd-opts" style="min-height:140px">${esc((f.options || []).join('\n'))}</textarea></div>
    <div class="field"><label>Section</label><input type="text" id="fd-group" list="fd-groups" value="${esc(f.group || '')}"><datalist id="fd-groups">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist></div>
    <div class="field"><label>Auto-fill from</label><select id="fd-auto">${Object.entries(AUTO_SOURCES).map(([k, v]) => `<option value="${k}" ${k === (f.auto || '') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    ${f.showIf ? `<p class="muted">Shown only when ${esc(f.showIf.field)} = ${esc(f.showIf.values.join(' / '))}.</p>` : ''}
    <div class="btns"><button class="btn primary" id="fd-save">Save</button>${index != null ? '<button class="btn danger" id="fd-del">Delete field</button>' : ''}</div>`);
  const syncOpts = () => { body.querySelector('#fd-opts-wrap').style.display = body.querySelector('#fd-type').value === 'select' ? '' : 'none'; };
  syncOpts(); body.querySelector('#fd-type').onchange = syncOpts;
  body.querySelector('#fd-save').onclick = async () => {
    f.label = body.querySelector('#fd-label').value.trim();
    if (!f.label) { toast('Enter a label'); return; }
    f.type = body.querySelector('#fd-type').value;
    f.options = body.querySelector('#fd-opts').value.split('\n').map(s => s.trim()).filter(Boolean);
    f.group = body.querySelector('#fd-group').value.trim();
    f.auto = body.querySelector('#fd-auto').value;
    if (!f.key) {
      let k = f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field';
      while (schema.some(x => x.key === k)) k += '_' + uid().slice(-3);
      f.key = k;
    }
    if (index == null) {
      // insert after the last field of the same section
      let pos = schema.length;
      for (let i = schema.length - 1; i >= 0; i--) if (schema[i].group === f.group) { pos = i + 1; break; }
      schema.splice(pos, 0, f);
    } else schema[index] = f;
    await saveProject(); openSchemaEditor();
  };
  const del = body.querySelector('#fd-del');
  if (del) del.onclick = async () => {
    if (!(await confirmBox(`Remove field "${f.label}" from the form? Values already entered stay in the stations data.`))) return;
    schema.splice(index, 1); await saveProject(); openSchemaEditor();
  };
}

// ---------- backup / restore ----------
const blobToB64 = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
const b64ToBlob = async dataUrl => (await fetch(dataUrl)).blob();

async function backup() {
  toast('Preparing backup…', 4000);
  const projects = await db.all('projects');
  const stations = await db.all('stations');
  const photos = await Promise.all((await db.all('photos')).map(async p => ({ ...p, blob: await blobToB64(p.blob) })));
  const layers = (await db.all('layers')).filter(l => l.kind === 'vector');
  const data = JSON.stringify({ app: 'GeoField', version: 1, created: new Date().toISOString(), projects, stations, photos, layers });
  await saveFile(new Blob([data], { type: 'application/json' }), `GeoField_backup_${fileStamp()}.json`);
}

async function restore(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'GeoField') throw new Error('Not a GeoField backup');
    if (!(await confirmBox(`Restore ${data.projects.length} project(s) and ${data.stations.length} station(s)? Items with the same ID are replaced.`))) return;
    for (const p of data.projects) await db.put('projects', p);
    for (const s of data.stations) await db.put('stations', s);
    for (const l of data.layers || []) await db.put('layers', l);
    for (const ph of data.photos) await db.put('photos', { ...ph, blob: await b64ToBlob(ph.blob) });
    await loadProject(state.project.id);
    closeModal(); renderProject(); toast('Backup restored');
  } catch (e) { toast('Restore failed: ' + e.message, 4000); }
}
