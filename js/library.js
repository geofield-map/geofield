// Maps library (home screen, in the style of Avenza Maps): the base map, imported maps and layers,
// each with a thumbnail, size and distance from the current GPS position. Tapping one opens it on the map.
import { state } from './state.js';
import { db } from './db.js';
import { $, esc, toast, loadScript, getSQL } from './ui.js';
import { projectLayers } from './layers.js';
import { fromUTM } from './geo.js';
import { loadGeology } from './geology.js';
import { basemapName, geoOverlayOn, showGeoOverlay, openLayerOnMap, zoomToBounds, importAndShow, layerSettings } from './mapview.js';

let nav = {};
let tab = 'maps', sortBy = 'recent';
export function initLibrary(navigation) { nav = navigation; }

const RASTER = ['geotiff', 'mbtiles'];
const fmtSize = bytes => (bytes >= 1048576 ? (bytes / 1048576).toFixed(bytes >= 1e8 ? 0 : 1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB');

// ---------- extent of a layer [w, s, e, n] in degrees, computed once and kept with the layer ----------
function vectorBounds(gj) {
  let w = 180, s = 90, e = -180, n = -90;
  const walk = c => { if (typeof c[0] === 'number') { if (c[0] < w) w = c[0]; if (c[0] > e) e = c[0]; if (c[1] < s) s = c[1]; if (c[1] > n) n = c[1]; } else c.forEach(walk); };
  (gj.features || []).forEach(f => f.geometry && walk(f.geometry.coordinates));
  return w <= e ? [w, s, e, n] : null;
}
async function rasterBounds(layer) {
  if (layer.kind === 'mbtiles') {
    const SQL = await getSQL();
    const mb = new SQL.Database(new Uint8Array(await layer.blob.arrayBuffer()));
    const r = mb.exec("SELECT value FROM metadata WHERE name='bounds'");
    mb.close();
    return r[0] ? r[0].values[0][0].split(',').map(Number) : null;
  }
  await loadScript('https://unpkg.com/georaster@1.6.0/dist/georaster.browser.bundle.min.js');
  const g = await window.parseGeoraster(await layer.blob.arrayBuffer());
  const p = Number(g.projection);
  if (p === 4326) return [g.xmin, g.ymin, g.xmax, g.ymax];
  if (p >= 32601 && p <= 32660) {
    const z = p - 32600, a = fromUTM(g.xmin, g.ymin, z), b = fromUTM(g.xmax, g.ymax, z);
    return [a.lon, a.lat, b.lon, b.lat];
  }
  return null;
}
async function boundsOf(layer) {
  if (layer.bbox !== undefined) return layer.bbox;
  try { layer.bbox = layer.kind === 'vector' ? vectorBounds(layer.geojson) : await rasterBounds(layer); } catch (e) { layer.bbox = null; }
  await db.put('layers', layer);
  return layer.bbox;
}

// ---------- distance from the GPS position to the nearest edge of an extent ----------
function distanceText(b) {
  const g = state.gps;
  if (!b || !g) return '';
  const lon = Math.max(b[0], Math.min(b[2], g.lon)), lat = Math.max(b[1], Math.min(b[3], g.lat));
  if (lon === g.lon && lat === g.lat) return 'You are here';
  const R = 6371, dLat = (lat - g.lat) * Math.PI / 180, dLon = (lon - g.lon) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(g.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(h));
  return km < 10 ? km.toFixed(1) + ' km' : Math.round(km) + ' km';
}
const distanceKm = b => { const t = distanceText(b); return t === 'You are here' ? 0 : parseFloat(t) || 1e9; };

// ---------- thumbnail: satellite tile under the extent, with vector outlines drawn on top ----------
function tileFor(b) {
  const w = Math.max(1e-4, b[2] - b[0]), z = Math.max(2, Math.min(16, Math.floor(Math.log2(360 / w))));
  const lon = (b[0] + b[2]) / 2, lat = (b[1] + b[3]) / 2, n = 2 ** z, r = lat * Math.PI / 180;
  const x = Math.floor((lon + 180) / 360 * n), y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}
function outlineSvg(features, b, colour) {
  if (!b) return '';
  const [w, s, e, n] = b, k = 60 / Math.max(e - w, n - s, 1e-6);
  const ox = (60 - (e - w) * k) / 2 + 2, oy = (60 - (n - s) * k) / 2 + 2;
  const pt = ([x, y]) => `${(ox + (x - w) * k).toFixed(1)},${(oy + (n - y) * k).toFixed(1)}`;
  let d = '', count = 0;
  const ring = r => { if (count++ > 400) return; d += 'M' + r.filter((_, i) => i % Math.ceil(r.length / 40 || 1) === 0).map(pt).join('L') + 'Z'; };
  for (const g of features.slice(0, 400)) {
    if (!g) continue;
    if (g.type === 'Polygon') ring(g.coordinates[0]);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => ring(p[0]));
    else if (g.type === 'LineString') d += 'M' + g.coordinates.map(pt).join('L');
    else if (g.type === 'Point') { const [x, y] = pt(g.coordinates).split(','); d += `M${x - 1.5},${y}a1.5,1.5 0 1,0 3,0a1.5,1.5 0 1,0 -3,0`; }
  }
  return `<svg class="lib-svg" viewBox="0 0 64 64"><path d="${d}" fill="${colour}" fill-opacity=".35" stroke="${colour}" stroke-width="1"/></svg>`;
}
function thumb(b, svg = '') {
  return `<div class="lib-thumb">${b ? `<img src="${tileFor(b)}" alt="" loading="lazy" onerror="this.remove()">` : ''}${svg}</div>`;
}

// ---------- screen ----------
export async function renderLibrary() {
  const body = $('#library-body');
  const layers = await projectLayers();
  const items = [];
  for (const l of layers) {
    const isMap = RASTER.includes(l.kind);
    if ((tab === 'maps') !== isMap) continue;
    const size = l.blob ? l.blob.size : JSON.stringify(l.geojson || {}).length;
    items.push({ layer: l, name: l.name, size, bbox: await boundsOf(l), recent: l.order || 0 });
  }
  if (tab === 'layers') {
    // the built-in geological map is always in the list
    let gb = null, gsize = 0;
    try { const d = await loadGeology(); gb = d.bbox || (d.bbox = d.features.reduce((a, f) => [Math.min(a[0], f.bbox[0]), Math.min(a[1], f.bbox[1]), Math.max(a[2], f.bbox[2]), Math.max(a[3], f.bbox[3])], [180, 90, -180, -90])); gsize = 1160000; } catch (e) { /* offline before first download */ }
    items.push({ builtin: true, name: 'Geological map · Arabian Platform', size: gsize, bbox: gb, recent: -1, sub: 'Built-in · fills Formation from GPS' });
  }
  items.sort(sortBy === 'name' ? (a, b) => a.name.localeCompare(b.name) : sortBy === 'nearest' ? (a, b) => distanceKm(a.bbox) - distanceKm(b.bbox) : (a, b) => b.recent - a.recent);

  const g = state.gps;
  const baseBbox = g ? [g.lon - 0.02, g.lat - 0.02, g.lon + 0.02, g.lat + 0.02] : [44, 23, 48, 26];
  body.innerHTML = `
    <div class="seg lib-seg"><button data-t="maps" class="${tab === 'maps' ? 'active' : ''}">Maps</button><button data-t="layers" class="${tab === 'layers' ? 'active' : ''}">Layers</button></div>
    <div class="lib-tools"><select id="lib-sort">
      <option value="recent" ${sortBy === 'recent' ? 'selected' : ''}>Recent</option><option value="nearest" ${sortBy === 'nearest' ? 'selected' : ''}>Nearest</option><option value="name" ${sortBy === 'name' ? 'selected' : ''}>Name</option></select>
      <label class="btn small primary lib-import">+ Import<input id="lib-file" type="file" multiple class="hidden"></label></div>
    ${tab === 'maps' ? `<button class="lib-base" id="lib-base" style="background-image:url('${tileFor(baseBbox)}')"><span>Open basemap</span><small>${esc(basemapName())}</small></button>` : ''}
    <div class="lib-list">${items.map((it, i) => `
      <div class="lib-row" data-i="${i}">
        ${thumb(it.bbox, it.layer && it.layer.kind === 'vector' ? outlineSvg((it.layer.geojson.features || []).map(f => f.geometry), it.bbox, it.layer.color || '#ffcc00') : it.builtin ? '<div class="lib-geo-badge">GEO</div>' : '')}
        <div class="lib-txt"><div class="lib-name">${esc(it.name)}</div>
          <div class="muted">${[it.size ? fmtSize(it.size) : '', distanceText(it.bbox), it.sub || ''].filter(Boolean).join(' • ')}${it.builtin && geoOverlayOn() ? ' • shown' : ''}</div></div>
        ${it.layer ? '<button class="icon-btn lib-more" aria-label="Options">⋯</button>' : ''}
      </div>`).join('') || `<div class="empty">${tab === 'maps' ? 'No maps yet. Tap + Import to add a GeoTIFF or MBTiles map.' : 'No layers yet. Tap + Import to add KML, KMZ, Shapefile or GeoJSON.'}</div>`}</div>`;

  body.querySelectorAll('.lib-seg button').forEach(b => b.onclick = () => { tab = b.dataset.t; renderLibrary(); });
  body.querySelector('#lib-sort').onchange = e => { sortBy = e.target.value; renderLibrary(); };
  body.querySelector('#lib-file').onchange = async e => { await importAndShow(e.target.files); renderLibrary(); };
  const base = body.querySelector('#lib-base');
  if (base) base.onclick = () => nav.openMap();
  body.querySelectorAll('.lib-row').forEach(row => {
    const it = items[Number(row.dataset.i)];
    row.addEventListener('click', async e => {
      if (e.target.closest('.lib-more')) return;
      nav.openMap();
      if (it.builtin) { await showGeoOverlay(true); if (!state.gps) zoomToBounds(it.bbox); return; }
      await openLayerOnMap(it.layer);
    });
    const more = row.querySelector('.lib-more');
    if (more) more.onclick = () => layerSettings(it.layer, renderLibrary);
  });
}

// refresh distances as the GPS position arrives
let lastRefresh = 0;
export function libraryGpsTick(isShown) {
  if (!isShown || Date.now() - lastRefresh < 15000) return;
  lastRefresh = Date.now();
  renderLibrary().catch(() => toast('Could not refresh the map list'));
}
