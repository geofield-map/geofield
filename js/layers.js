// Importing user map layers (GeoTIFF, MBTiles, KML/KMZ, Shapefile, GeoJSON) and drawing them on the map.
/* global L, shp, JSZip, toGeoJSON */
import { db, uid } from './db.js';
import { state } from './state.js';
import { loadScript, getSQL, toast } from './ui.js';
import { featureContains } from './geo.js';

const GEORASTER = 'https://unpkg.com/georaster@1.6.0/dist/georaster.browser.bundle.min.js';
const GEORASTER_LAYER = 'https://unpkg.com/georaster-layer-for-leaflet@3.10.0/dist/georaster-layer-for-leaflet.min.js';

export const VECTOR_COLORS = ['#ffcc00', '#00e5ff', '#ff4081', '#76ff03', '#ff9100', '#d500f9', '#ffffff'];

const live = new Map(); // layer id -> leaflet layer

const ext = name => name.toLowerCase().split('.').pop();

// ---------- import ----------
export async function importFiles(fileList) {
  const files = Array.from(fileList);
  const byExt = {};
  files.forEach(f => { byExt[ext(f.name)] = f; });
  const created = [];

  // Loose shapefile parts (.shp + .dbf + .prj picked together)
  if (byExt.shp) {
    const base = byExt.shp.name.replace(/\.shp$/i, '');
    const shpBuf = await byExt.shp.arrayBuffer();
    const prj = byExt.prj ? await byExt.prj.text() : undefined;
    const parts = [shp.parseShp(shpBuf, prj)];
    if (byExt.dbf) parts.push(shp.parseDbf(await byExt.dbf.arrayBuffer(), byExt.cpg ? await byExt.cpg.text() : undefined));
    const gj = parts.length > 1 ? shp.combine(parts) : { type: 'FeatureCollection', features: parts[0].map(g => ({ type: 'Feature', geometry: g, properties: {} })) };
    if (!byExt.prj) toast('No .prj file: assuming coordinates are WGS84 lat/long', 3500);
    created.push(await saveVector(base, gj));
  }

  for (const f of files) {
    const e = ext(f.name);
    try {
      if (e === 'zip') {
        const out = await shp(await f.arrayBuffer());
        const list = Array.isArray(out) ? out : [out];
        for (const gj of list) created.push(await saveVector(gj.fileName || f.name.replace(/\.zip$/i, ''), gj));
      } else if (e === 'kml') {
        created.push(await saveVector(f.name, kmlToGeoJSON(await f.text())));
      } else if (e === 'kmz') {
        const zip = await JSZip.loadAsync(await f.arrayBuffer());
        const kmlFile = Object.values(zip.files).find(z => /\.kml$/i.test(z.name));
        if (!kmlFile) throw new Error('No KML inside KMZ');
        created.push(await saveVector(f.name, kmlToGeoJSON(await kmlFile.async('text'))));
      } else if (e === 'geojson' || e === 'json') {
        created.push(await saveVector(f.name, JSON.parse(await f.text())));
      } else if (e === 'tif' || e === 'tiff') {
        created.push(await saveRaster(f, 'geotiff'));
      } else if (e === 'mbtiles') {
        created.push(await saveRaster(f, 'mbtiles'));
      } else if (e === 'gpx') {
        created.push(await saveVector(f.name, toGeoJSON.gpx(new DOMParser().parseFromString(await f.text(), 'text/xml'))));
      } else if (e === 'pdf') {
        toast('Georeferenced PDF: please convert to GeoTIFF in QGIS for now', 4500);
      } else if (e === 'jpg' || e === 'jpeg' || e === 'png') {
        toast('Plain images need georeferencing first (coming soon). Use GeoTIFF for now.', 4500);
      }
    } catch (err) {
      console.error(err);
      toast(`Could not import ${f.name}: ${err.message}`, 4500);
    }
  }
  return created.filter(Boolean);
}

function kmlToGeoJSON(text) {
  return toGeoJSON.kml(new DOMParser().parseFromString(text, 'text/xml'));
}

async function saveVector(name, geojson) {
  const layer = {
    id: uid(), projectId: state.project.id, name, kind: 'vector', geojson, visible: true, opacity: 1,
    color: VECTOR_COLORS[Math.floor(Math.random() * VECTOR_COLORS.length)], autofill: {}, order: Date.now(),
  };
  await db.put('layers', layer);
  return layer;
}

async function saveRaster(file, kind) {
  const layer = { id: uid(), projectId: state.project.id, name: file.name, kind, blob: file, visible: true, opacity: 1, order: Date.now() };
  await db.put('layers', layer);
  return layer;
}

export async function projectLayers() {
  const list = await db.byIndex('layers', 'projectId', state.project.id);
  return list.sort((a, b) => a.order - b.order);
}

// ---------- rendering ----------
export async function showLayer(map, layer, fit = false) {
  hideLayer(map, layer.id);
  let ll = null;
  try {
    if (layer.kind === 'vector') ll = vectorLayer(layer);
    else if (layer.kind === 'geotiff') ll = await geotiffLayer(layer);
    else if (layer.kind === 'mbtiles') ll = await mbtilesLayer(layer);
  } catch (err) {
    console.error(err);
    toast(`Could not draw ${layer.name}: ${err.message}`, 4500);
    return;
  }
  if (!ll) return;
  ll.addTo(map);
  live.set(layer.id, ll);
  if (fit) {
    const b = ll.getBounds ? ll.getBounds() : ll._gfBounds;
    if (b && b.isValid && b.isValid()) map.fitBounds(b, { maxZoom: 17 });
  }
}

export function hideLayer(map, id) {
  const ll = live.get(id);
  if (ll) { map.removeLayer(ll); live.delete(id); }
}

export function hideAll(map) {
  for (const id of Array.from(live.keys())) hideLayer(map, id);
}

export function zoomToLayer(map, id) {
  const ll = live.get(id);
  const b = ll && (ll.getBounds ? ll.getBounds() : ll._gfBounds);
  if (b && b.isValid()) map.fitBounds(b, { maxZoom: 17 });
}

export function setOpacity(id, value) {
  const ll = live.get(id);
  if (!ll) return;
  if (ll.setOpacity) ll.setOpacity(value);
  else if (ll.setStyle) ll.setStyle({ opacity: value, fillOpacity: value * 0.25 });
}

function popupHtml(props) {
  const rows = Object.entries(props || {}).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
    .map(([k, v]) => `<tr><td style="color:#888;padding-right:8px">${k}</td><td>${String(v)}</td></tr>`).join('');
  return rows ? `<table style="font-size:12px">${rows}</table>` : '<i>No attributes</i>';
}

function vectorLayer(layer) {
  const color = layer.color || '#ffcc00';
  const op = layer.opacity ?? 1;
  return L.geoJSON(layer.geojson, {
    style: () => ({ color, weight: 2, opacity: op, fillOpacity: op * 0.25 }),
    pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 5, color: '#000', weight: 1, fillColor: color, fillOpacity: 0.9 }),
    onEachFeature: (f, l) => l.bindPopup(() => popupHtml(f.properties)),
  });
}

async function geotiffLayer(layer) {
  await loadScript(GEORASTER);
  await loadScript(GEORASTER_LAYER);
  const buf = await layer.blob.arrayBuffer();
  const georaster = await window.parseGeoraster(buf);
  return new window.GeoRasterLayer({ georaster, opacity: layer.opacity ?? 1, resolution: 256 });
}

async function mbtilesLayer(layer) {
  const SQL = await getSQL();
  const bytes = new Uint8Array(await layer.blob.arrayBuffer());
  const mb = new SQL.Database(bytes);
  const meta = {};
  try {
    const r = mb.exec('SELECT name, value FROM metadata');
    if (r[0]) r[0].values.forEach(([k, v]) => { meta[k] = v; });
  } catch (e) { /* no metadata table */ }
  if (meta.format === 'pbf') throw new Error('Vector MBTiles are not supported yet; use raster MBTiles');
  const mime = meta.format === 'jpg' || meta.format === 'jpeg' ? 'image/jpeg' : meta.format === 'webp' ? 'image/webp' : 'image/png';
  const zr = mb.exec('SELECT MIN(zoom_level), MAX(zoom_level) FROM tiles')[0].values[0];
  const stmt = mb.prepare('SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?');

  const Grid = L.GridLayer.extend({
    createTile(coords, done) {
      const img = document.createElement('img');
      const row = (1 << coords.z) - 1 - coords.y; // MBTiles use TMS rows
      stmt.bind([coords.z, coords.x, row]);
      if (stmt.step()) {
        const data = stmt.get()[0];
        const url = URL.createObjectURL(new Blob([data], { type: mime }));
        img.onload = () => { URL.revokeObjectURL(url); done(null, img); };
        img.onerror = () => done(null, img);
        img.src = url;
      } else {
        setTimeout(() => done(null, img), 0);
      }
      stmt.reset();
      return img;
    },
  });
  const grid = new Grid({ minNativeZoom: zr[0], maxNativeZoom: zr[1], maxZoom: 22, opacity: layer.opacity ?? 1 });
  if (meta.bounds) {
    const [w, s, e, n] = meta.bounds.split(',').map(Number);
    grid._gfBounds = L.latLngBounds([s, w], [n, e]);
  }
  return grid;
}

// ---------- auto-fill from polygons ----------
// Returns { fieldKey: value } for every polygon layer that contains the point.
export async function autofillFromLayers(lat, lon) {
  const out = {};
  const layers = await projectLayers();
  for (const layer of layers) {
    if (layer.kind !== 'vector' || !layer.autofill || !Object.keys(layer.autofill).length) continue;
    const feat = (layer.geojson.features || []).find(f => featureContains(f, lon, lat));
    if (!feat) continue;
    for (const [fieldKey, attr] of Object.entries(layer.autofill)) {
      const v = feat.properties ? feat.properties[attr] : undefined;
      if (attr && v != null && v !== '') out[fieldKey] = v;
    }
  }
  return out;
}

export function attributeNames(layer) {
  const names = new Set();
  (layer.geojson.features || []).slice(0, 200).forEach(f => Object.keys(f.properties || {}).forEach(k => names.add(k)));
  return Array.from(names);
}
