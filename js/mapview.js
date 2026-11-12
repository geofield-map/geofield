// Map screen: base maps, user layers, station markers, live GPS and point creation.
/* global L */
import { state, on } from './state.js';
import { db } from './db.js';
import { $, esc, openModal, closeModal, toast, fmt, confirmBox } from './ui.js';
import { toUTM } from './geo.js';
import {
  importFiles, projectLayers, showLayer, hideLayer, hideAll, zoomToLayer, setOpacity, attributeNames, VECTOR_COLORS,
} from './layers.js';
import { loadGeology, geologyAt, unitColour } from './geology.js';
import { startSectionPick } from './section.js';

const BASEMAPS = {
  imagery: { name: 'Satellite (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Esri World Imagery', maxNativeZoom: 19 },
  topo: { name: 'Topographic (OpenTopoMap)', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '© OpenTopoMap © OpenStreetMap', maxNativeZoom: 17 },
  osm: { name: 'Streets (OpenStreetMap)', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap contributors', maxNativeZoom: 19 },
  none: { name: 'None (own maps only)' },
};

export let map;
let baseLayer = null;
let baseKey = 'imagery';
let stationLayer;
let userMarker, accCircle;
let firstFix = true;
let crosshairOn = false;
let handlers = {};

export function initMap(h) {
  handlers = h;
  map = L.map('map', { zoomControl: false, attributionControl: true, maxZoom: 22 }).setView([24.0, 45.0], 6);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  stationLayer = L.layerGroup().addTo(map);

  db.get('meta', 'basemap').then(m => setBasemap(m ? m.value : 'imagery'));
  db.get('meta', 'geoOverlay').then(m => { if (m && m.value) setGeoOverlay(true); });

  $('#btn-locate').addEventListener('click', () => {
    if (state.gps) map.setView([state.gps.lat, state.gps.lon], Math.max(map.getZoom(), 16));
    else toast('Waiting for GPS…');
  });
  $('#btn-crosshair').addEventListener('click', () => {
    crosshairOn = !crosshairOn;
    $('#crosshair').classList.toggle('hidden', !crosshairOn);
    $('#btn-add-cross').classList.toggle('hidden', !crosshairOn);
    $('#btn-crosshair').classList.toggle('on', crosshairOn);
  });
  $('#btn-layers').addEventListener('click', openLayersPanel);
  $('#btn-section').addEventListener('click', () => startSectionPick(map));
  $('#btn-add-gps').addEventListener('click', () => {
    if (!state.gps) { toast('No GPS fix yet. Use the crosshair to place the point.'); return; }
    handlers.addPoint({ ...state.gps, source: 'GPS' });
  });
  $('#btn-add-cross').addEventListener('click', () => {
    const c = map.getCenter();
    handlers.addPoint({ lat: c.lat, lon: c.lng, alt: state.gps ? state.gps.alt : null, acc: null, source: 'Map' });
  });
  map.on('moveend', updateCrossReadout);

  startGPS();
  on('stations', drawStations);
  on('project', reloadUserLayers);
}

function setBasemap(key, persist = true) {
  baseKey = BASEMAPS[key] ? key : 'imagery';
  if (baseLayer) map.removeLayer(baseLayer);
  baseLayer = null;
  const b = BASEMAPS[baseKey];
  if (b.url) {
    baseLayer = L.tileLayer(b.url, { attribution: b.attr, maxNativeZoom: b.maxNativeZoom, maxZoom: 22, crossOrigin: true });
    baseLayer.addTo(map);
    baseLayer.bringToBack();
  }
  if (persist) { savedBase = baseKey; db.put('meta', { id: 'basemap', value: baseKey }); }
}
let savedBase = 'imagery'; // the base map the geologist chose (a single-map view hides it without forgetting it)

// ---------- built-in geological map ----------
let geoLayer = null;
async function setGeoOverlay(on) {
  db.put('meta', { id: 'geoOverlay', value: !!on });
  if (geoLayer) { map.removeLayer(geoLayer); geoLayer = null; }
  if (!on) return;
  let d;
  try { d = await loadGeology(); } catch (e) { toast('Geological map not available offline yet: open the app once with internet'); return; }
  const fc = { type: 'FeatureCollection', features: d.features.map(f => ({ type: 'Feature', properties: { code: f.code }, geometry: { type: 'MultiPolygon', coordinates: f.polys } })) };
  geoLayer = L.geoJSON(fc, {
    style: f => ({ color: '#333', weight: 0.6, opacity: 0.7, fillColor: unitColour(d.units[f.properties.code]), fillOpacity: 0.5 }),
    onEachFeature: (f, l) => l.bindPopup(() => {
      const u = d.units[f.properties.code] || {};
      return `<b>${esc(u.name || f.properties.code)}</b><br>${esc([u.period, u.epoch].filter(Boolean).join(' · '))}<br>${esc(u.age || '')}<br><span style="color:#666">${esc(u.lith || '')}</span>`;
    }),
  }).addTo(map);
  // above base maps and imported rasters, below the stations
  geoLayer.bringToFront(); stationLayer.eachLayer(l => l.bringToFront && l.bringToFront());
}

// the formation under the GPS position, shown in the GPS panel (looked up at most every 5 s)
let lastGeoLookup = 0, geoLine = '';
async function updateGeoLine(g) {
  if (Date.now() - lastGeoLookup < 5000) return;
  lastGeoLookup = Date.now();
  try {
    const u = await geologyAt(g.lat, g.lon);
    geoLine = u ? ` · ${u.formation ? u.formation + ' Fm' : u.name}${u.period ? ' (' + u.period + ')' : ''}` : '';
  } catch (e) { geoLine = ''; }
  updateGpsPanel(true);
}

async function reloadUserLayers() {
  hideAll(map);
  for (const layer of await projectLayers()) {
    if (layer.visible) await showLayer(map, layer);
  }
}

function drawStations(stations) {
  stationLayer.clearLayers();
  for (const st of stations) {
    if (st.lat == null) continue;
    const m = L.circleMarker([st.lat, st.lon], { radius: 7, color: '#000', weight: 2, fillColor: '#e8833a', fillOpacity: 1 });
    m.bindTooltip(st.code, { permanent: true, direction: 'right', offset: [8, 0], className: 'st-label' });
    const a = st.attrs || {};
    m.bindPopup(() => {
      const div = document.createElement('div');
      div.innerHTML = `<b>${esc(st.code)}</b><br>${esc(a.lithology || '')} ${a.sample_no ? '· Sample ' + esc(a.sample_no) : ''}<br>
        <button class="btn small green" style="margin-top:6px">Open</button>`;
      div.querySelector('button').onclick = () => handlers.openStation(st.id);
      return div;
    });
    stationLayer.addLayer(m);
  }
}

export function focusStation(st) {
  if (st && st.lat != null) map.setView([st.lat, st.lon], Math.max(map.getZoom(), 16));
}

// ---------- GPS ----------
function startGPS() {
  if (!navigator.geolocation) { $('#gps-line1').textContent = 'GPS not available'; return; }
  navigator.geolocation.watchPosition(onPosition, err => {
    $('#gps-line1').textContent = 'GPS: ' + (err.code === 1 ? 'permission denied — allow Location for this site' : err.message);
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
}

function onPosition(pos) {
  const c = pos.coords;
  state.gps = { lat: c.latitude, lon: c.longitude, alt: c.altitude, acc: c.accuracy, altAcc: c.altitudeAccuracy, time: pos.timestamp };
  const ll = [c.latitude, c.longitude];
  if (!userMarker) {
    userMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [18, 18] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
    accCircle = L.circle(ll, { radius: c.accuracy, color: '#1e88ff', weight: 1, fillOpacity: 0.1, interactive: false }).addTo(map);
  } else {
    userMarker.setLatLng(ll);
    accCircle.setLatLng(ll).setRadius(c.accuracy);
  }
  if (firstFix) { firstFix = false; map.invalidateSize(); map.setView(ll, 15); }
  updateGpsPanel();
}

function updateGpsPanel(fromGeo) {
  const g = state.gps;
  if (!g) return;
  const zone = state.project ? state.project.utmZone : 38;
  const u = toUTM(g.lat, g.lon, zone);
  $('#gps-line1').textContent = `E ${u.easting.toFixed(0)}  N ${u.northing.toFixed(0)}  (UTM ${zone}N)  ±${fmt(g.acc, 0)} m`;
  $('#gps-line2').textContent = `${g.lat.toFixed(6)}, ${g.lon.toFixed(6)}  ·  Elev ${g.alt == null ? '–' : fmt(g.alt, 0) + ' m'}${geoLine}`;
  if (crosshairOn) updateCrossReadout();
  if (!fromGeo) updateGeoLine(g);
}

function updateCrossReadout() {
  if (!crosshairOn) return;
  const c = map.getCenter();
  const zone = state.project ? state.project.utmZone : 38;
  const u = toUTM(c.lat, c.lng, zone);
  $('#gps-line2').textContent = `Crosshair: E ${u.easting.toFixed(0)} N ${u.northing.toFixed(0)}`;
}

// ---------- layers panel ----------
// preview tile of a base map around the current view
function previewTile(template) {
  const c = map.getCenter(), z = Math.max(3, Math.min(15, map.getZoom() - 1)), n = 2 ** z, r = c.lat * Math.PI / 180;
  const x = Math.floor((c.lng + 180) / 360 * n), y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
  return template.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{s}', 'a');
}

// ☰ on the map: base map, the geologist's maps to show on it, the built-in geological map, import
async function openLayersPanel() {
  const layers = await projectLayers();
  const baseHtml = `<div class="bm-grid">${Object.entries(BASEMAPS).map(([k, b]) => `<button class="bm-card ${k === baseKey ? 'on' : ''}" data-k="${k}">
    ${b.url ? `<img src="${previewTile(b.url)}" alt="" onerror="this.style.visibility='hidden'">` : '<div class="bm-none">∅</div>'}
    <span>${esc(b.name.replace(/\s*\(.*\)$/, '').replace('None', 'No base map'))}</span></button>`).join('')}</div>`;
  const layerHtml = layers.length ? layers.map(l => `
    <div class="layer-row" data-id="${l.id}">
      <input type="checkbox" class="lv" ${l.visible ? 'checked' : ''} style="width:22px;height:22px">
      <div class="nm">${esc(l.name)}<div class="muted">${['geotiff', 'mbtiles'].includes(l.kind) ? 'map' : (l.geojson.features || []).length + ' features'}${l.kind === 'vector' && Object.keys(l.autofill || {}).length ? ' · auto-fill on' : ''}</div></div>
      <button class="btn small lz">Zoom</button>
      <button class="btn small lm">⋯</button>
    </div>`).join('') : '<p class="muted">No maps uploaded yet. Import them below.</p>';

  const body = openModal('Maps on screen', `
    <div class="group-title" style="margin-top:0">Base map</div>${baseHtml}
    <div class="group-title">Show my maps</div>${layerHtml}
    <div class="layer-row"><input type="checkbox" id="geo-ov" ${geoLayer ? 'checked' : ''} style="width:22px;height:22px">
      <div class="nm">Geological map · Arabian Platform<div class="muted">built-in · fills Formation from GPS, shown or not</div></div></div>
    <div class="btns"><label class="btn primary" style="text-align:center">Import map files
      <input id="layer-file" type="file" multiple class="hidden"></label></div>
    <p class="muted">GeoTIFF, MBTiles (raster), KML, KMZ, GPX, GeoJSON, Shapefile (.zip, or .shp + .dbf + .prj together). Online base maps are kept on the phone for areas you have viewed.</p>`);

  body.querySelectorAll('.bm-card').forEach(c => c.addEventListener('click', () => {
    setBasemap(c.dataset.k);
    body.querySelectorAll('.bm-card').forEach(x => x.classList.toggle('on', x === c));
  }));
  body.querySelector('#geo-ov').addEventListener('change', e => setGeoOverlay(e.target.checked));
  body.querySelector('#layer-file').addEventListener('change', async e => {
    toast('Importing…');
    const created = await importFiles(e.target.files);
    for (const l of created) await showLayer(map, l, true);
    if (created.length) toast(`Imported ${created.length} layer(s)`);
    openLayersPanel();
  });
  body.querySelectorAll('.layer-row[data-id]').forEach(row => { // (the geological-map row has its own switch)
    const layer = layers.find(l => l.id === row.dataset.id);
    row.querySelector('.lv').addEventListener('change', async e => {
      layer.visible = e.target.checked;
      await db.put('layers', layer);
      if (layer.visible) await showLayer(map, layer); else hideLayer(map, layer.id);
    });
    row.querySelector('.lz').addEventListener('click', async () => {
      if (!layer.visible) { layer.visible = true; await db.put('layers', layer); await showLayer(map, layer); }
      zoomToLayer(map, layer.id); closeModal();
    });
    row.querySelector('.lm').addEventListener('click', () => openLayerSettings(layer));
  });
}

function openLayerSettings(layer, after = openLayersPanel) {
  const fields = state.project.schema;
  const attrs = layer.kind === 'vector' ? attributeNames(layer) : [];
  const attrOpts = sel => ['<option value="">—</option>', ...attrs.map(a => `<option ${a === sel ? 'selected' : ''}>${esc(a)}</option>`)].join('');
  const autofillHtml = layer.kind === 'vector' ? `
    <div class="group-title">Auto-fill from this layer</div>
    <p class="muted">When a new point falls inside a polygon of this layer, copy its attribute into the form field. Example: Formation ← FORMATION.</p>
    ${fields.map(f => `<div class="field"><label>${esc(f.label)}</label><select data-key="${f.key}" class="af">${attrOpts((layer.autofill || {})[f.key])}</select></div>`).join('')}`
    : '';
  const colorHtml = layer.kind === 'vector' ? `<div class="field"><label>Colour</label><div class="btns">${VECTOR_COLORS.map(c =>
    `<button class="btn small col" data-c="${c}" style="background:${c};min-width:36px;flex:0;${c === layer.color ? 'outline:3px solid #fff' : ''}">&nbsp;</button>`).join('')}</div></div>` : '';

  const body = openModal(layer.name, `
    <div class="field"><label>Name</label><input type="text" id="ly-name" value="${esc(layer.name)}"></div>
    <div class="field"><label>Opacity</label><input type="range" id="ly-op" min="0.1" max="1" step="0.1" value="${layer.opacity ?? 1}" style="width:100%"></div>
    ${colorHtml}${autofillHtml}
    <div class="btns"><button class="btn primary" id="ly-save">Save</button><button class="btn danger" id="ly-del">Delete layer</button></div>`);

  body.querySelector('#ly-op').addEventListener('input', e => setOpacity(layer.id, Number(e.target.value)));
  body.querySelectorAll('.col').forEach(b => b.addEventListener('click', () => {
    layer.color = b.dataset.c;
    body.querySelectorAll('.col').forEach(x => { x.style.outline = x === b ? '3px solid #fff' : ''; });
  }));
  body.querySelector('#ly-save').addEventListener('click', async () => {
    layer.name = body.querySelector('#ly-name').value.trim() || layer.name;
    layer.opacity = Number(body.querySelector('#ly-op').value);
    if (layer.kind === 'vector') {
      layer.autofill = {};
      body.querySelectorAll('.af').forEach(s => { if (s.value) layer.autofill[s.dataset.key] = s.value; });
    }
    await db.put('layers', layer);
    if (layer.visible) await showLayer(map, layer);
    toast('Layer saved');
    after();
  });
  body.querySelector('#ly-del').addEventListener('click', async () => {
    if (!(await confirmBox(`Delete layer "${layer.name}" from this phone?`))) return;
    hideLayer(map, layer.id);
    await db.del('layers', layer.id);
    after();
  });
}

export function invalidate() { if (map) setTimeout(() => map.invalidateSize(), 50); }

// ---------- used by the Maps library screen ----------
export const basemapName = () => BASEMAPS[savedBase].name;
export const basemapList = () => Object.entries(BASEMAPS).filter(([, b]) => b.url).map(([key, b]) => ({ key, name: b.name, url: b.url, current: key === savedBase }));

// Basemap view: the chosen base map with the geologist's maps that are switched on (and the geological map if on)
export async function openBasemapMode(key, centreOnMe = false) {
  setBasemap(key || savedBase, true);
  map.invalidateSize();
  if (centreOnMe && state.gps) map.setView([state.gps.lat, state.gps.lon], Math.max(map.getZoom(), 15));
  await reloadUserLayers();
  const g = await db.get('meta', 'geoOverlay');
  if (g && g.value && !geoLayer) await setGeoOverlay(true);
}

// Single-map view (Avenza style): only this map, no base map and no other layers; stations and GPS stay
export async function openSingleMap(layer) {
  setBasemap('none', false); // not remembered: Open basemap brings the base map back
  hideAll(map);
  if (geoLayer) { map.removeLayer(geoLayer); geoLayer = null; }
  map.invalidateSize();
  await showLayer(map, layer, true);
  $('#title').textContent = layer.name;
}
export const geoOverlayOn = () => !!geoLayer;
export async function showGeoOverlay(on) { await setGeoOverlay(on); }
// make a layer visible and zoom to it
// (the map may have been hidden behind the library: measure it again before zooming)
export async function openLayerOnMap(layer) {
  if (!layer.visible) { layer.visible = true; await db.put('layers', layer); }
  map.invalidateSize();
  await showLayer(map, layer, true);
}
export async function zoomToBounds(b) { map.invalidateSize(); if (b) map.fitBounds([[b[1], b[0]], [b[3], b[2]]], { maxZoom: 17 }); }
export async function importAndShow(files) {
  toast('Importing…');
  const created = await importFiles(files);
  for (const l of created) await showLayer(map, l, false);
  if (created.length) toast(`Imported ${created.length} map(s)`);
  return created;
}
export function layerSettings(layer, after) { openLayerSettings(layer, after); }
