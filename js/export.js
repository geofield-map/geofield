// Export: CSV, GeoJSON, KML, KMZ, GPX, Shapefile, GeoPackage, photos, and an all-in-one ZIP.
/* global JSZip */
import { state } from './state.js';
import { db } from './db.js';
import { getSQL, saveFile, fileStamp, esc } from './ui.js';
import { utmPrj } from './geo.js';
import { describe } from './structures.js';
import { logSvg } from './log.js';

// ---------- flatten ----------
const BASE_COLS = [
  ['station', 'Station'], ['lat', 'Latitude'], ['lon', 'Longitude'], ['utm_zone', 'UTM zone'], ['gps_e', 'GPS Easting'],
  ['gps_n', 'GPS Northing'], ['gps_elev', 'GPS Elevation'], ['gps_acc', 'GPS Accuracy (m)'], ['pos_src', 'Position source'], ['created', 'Created'],
];
const TAIL_COLS = [['n_photos', 'Photos'], ['n_struct', 'Structures'], ['structs', 'Structure list'], ['n_beds', 'Log beds']];

function columns() {
  return [...BASE_COLS, ...state.project.schema.map(f => [f.key, f.label, f.type]), ...TAIL_COLS];
}

function row(st) {
  const r = {
    station: st.code, lat: st.lat, lon: st.lon, utm_zone: st.utmZone, gps_e: st.easting, gps_n: st.northing,
    gps_elev: st.elev == null ? '' : Math.round(st.elev * 10) / 10, gps_acc: st.acc == null ? '' : Math.round(st.acc * 10) / 10,
    pos_src: st.source || '', created: st.created,
  };
  for (const f of state.project.schema) r[f.key] = st.attrs[f.key] ?? '';
  r.n_photos = st.photoCount || 0;
  r.n_struct = (st.structures || []).length;
  r.structs = (st.structures || []).map(m => `${m.type} ${describe(m)}`).join('; ');
  r.n_beds = ((st.log && st.log.beds) || []).length;
  return r;
}

const stations = () => state.stations.filter(s => s.lat != null);
const baseName = () => (state.project.name || 'project').replace(/[^\w-]+/g, '_');

// ---------- CSV ----------
function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(headers, rows) {
  return '﻿' + [headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\r\n');
}
export function stationsCsv() {
  const cols = columns();
  return toCsv(cols.map(c => c[1]), stations().map(st => { const r = row(st); return cols.map(c => r[c[0]]); }));
}
export function structuresCsv() {
  const rows = [];
  for (const st of stations()) for (const m of st.structures || []) {
    rows.push([st.code, st.lat, st.lon, st.easting, st.northing, m.type, m.kind, m.dip, m.dipDir, m.strike, m.plunge, m.trend, describe(m), m.method || '', m.note || '', m.time || '']);
  }
  return toCsv(['Station', 'Latitude', 'Longitude', 'Easting', 'Northing', 'Type', 'Kind', 'Dip', 'Dip direction', 'Strike (RHR)', 'Plunge', 'Trend', 'Measure', 'Method', 'Note', 'Time'], rows);
}
export function logCsv() {
  const rows = [];
  for (const st of stations()) {
    const beds = (st.log && st.log.beds) || [];
    let base = 0;
    beds.forEach((b, i) => {
      const top = base + (Number(b.thickness) || 0);
      rows.push([st.code, i + 1, base, top, b.thickness, b.formation, b.member, b.lithology, b.grain, b.color, b.structures, b.fossils, b.contact, b.description, b.sample]);
      base = top;
    });
  }
  return toCsv(['Station', 'Bed', 'Base (m)', 'Top (m)', 'Thickness (m)', 'Formation', 'Member', 'Lithology', 'Grain size', 'Colour', 'Structures', 'Fossils', 'Base contact', 'Description', 'Sample'], rows);
}

// ---------- GeoJSON ----------
export function stationsGeoJSON() {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: stations().map(st => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [st.lon, st.lat, st.elev ?? 0] }, properties: row(st) })),
  }, null, 1);
}

// ---------- KML / KMZ ----------
function kml(photoMap) {
  const cols = columns();
  const placemarks = stations().map(st => {
    const r = row(st);
    const table = cols.filter(c => r[c[0]] !== '' && r[c[0]] != null)
      .map(c => `<tr><td><b>${esc(c[1])}</b></td><td>${esc(r[c[0]])}</td></tr>`).join('');
    const imgs = (photoMap && photoMap[st.id] || []).map(p => `<img src="${p}" width="400"/><br/>`).join('');
    const ext = cols.map(c => `<Data name="${esc(c[0])}"><value>${esc(r[c[0]])}</value></Data>`).join('');
    return `<Placemark><name>${esc(st.code)}</name><styleUrl>#st</styleUrl>
      <description><![CDATA[<table>${table}</table>${imgs}]]></description>
      <ExtendedData>${ext}</ExtendedData>
      <Point><coordinates>${st.lon},${st.lat},${st.elev ?? 0}</coordinates></Point></Placemark>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(state.project.name)}</name>
<Style id="st"><IconStyle><color>ff3a83e8</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style>
${placemarks}
</Document></kml>`;
}

async function stationPhotos(st) {
  return (await db.byIndex('photos', 'stationId', st.id)).sort((a, b) => a.time.localeCompare(b.time));
}
const photoName = (st, i) => `${st.code}_${String(i + 1).padStart(2, '0')}.jpg`;

async function kmz() {
  const zip = new JSZip();
  const photoMap = {};
  for (const st of stations()) {
    const photos = await stationPhotos(st);
    photoMap[st.id] = photos.map((p, i) => { const n = 'files/' + photoName(st, i); zip.file(n, p.blob); return n; });
  }
  zip.file('doc.kml', kml(photoMap));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.google-earth.kmz' });
}

// ---------- GPX ----------
function gpx() {
  const wpts = stations().map(st => {
    const a = st.attrs;
    const desc = [a.lithology, a.formation, a.sample_no ? 'Sample ' + a.sample_no : '', a.remarks].filter(Boolean).join(' | ');
    return `<wpt lat="${st.lat}" lon="${st.lon}">${st.elev != null ? `<ele>${st.elev}</ele>` : ''}<time>${st.created}</time><name>${esc(st.code)}</name><desc>${esc(desc)}</desc><sym>Flag, Blue</sym></wpt>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GeoField" xmlns="http://www.topografix.com/GPX/1/1">
${wpts}
</gpx>`;
}

// ---------- Shapefile (points, in the project UTM zone) ----------
const enc = new TextEncoder();

function dbfFieldNames(keys) {
  const used = new Set();
  return keys.map(k => {
    let base = k.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 10) || 'F';
    let name = base, n = 1;
    while (used.has(name.toUpperCase())) { const suf = String(n++); name = base.slice(0, 10 - suf.length) + suf; }
    used.add(name.toUpperCase());
    return name;
  });
}

function truncBytes(str, max) {
  let b = enc.encode(str);
  if (b.length <= max) return b;
  let s = str;
  while (b.length > max) { s = s.slice(0, -1); b = enc.encode(s); }
  return b;
}

function writeDbf(fields, records) {
  // fields: [{name, type:'C'|'N', key}]
  const defs = fields.map(f => {
    if (f.type === 'N') {
      let dec = 0;
      records.forEach(r => { const v = r[f.key]; if (v !== '' && v != null && !isNaN(v)) { const s = String(v); const i = s.indexOf('.'); if (i >= 0) dec = Math.max(dec, Math.min(8, s.length - i - 1)); } });
      return { ...f, len: 19, dec };
    }
    let len = 1;
    records.forEach(r => { len = Math.max(len, enc.encode(String(r[f.key] ?? '')).length); });
    return { ...f, len: Math.min(254, len), dec: 0 };
  });
  const headerLen = 32 + 32 * defs.length + 1;
  const recLen = 1 + defs.reduce((s, f) => s + f.len, 0);
  const buf = new Uint8Array(headerLen + recLen * records.length + 1);
  const dv = new DataView(buf.buffer);
  const now = new Date();
  buf[0] = 3; buf[1] = now.getFullYear() - 1900; buf[2] = now.getMonth() + 1; buf[3] = now.getDate();
  dv.setUint32(4, records.length, true); dv.setUint16(8, headerLen, true); dv.setUint16(10, recLen, true);
  defs.forEach((f, i) => {
    const o = 32 + i * 32;
    for (let k = 0; k < f.name.length; k++) buf[o + k] = f.name.charCodeAt(k);
    buf[o + 11] = f.type.charCodeAt(0); buf[o + 16] = f.len; buf[o + 17] = f.dec;
  });
  buf[headerLen - 1] = 0x0d;
  let o = headerLen;
  for (const r of records) {
    buf[o++] = 0x20;
    for (const f of defs) {
      buf.fill(0x20, o, o + f.len);
      const v = r[f.key];
      if (f.type === 'N') {
        if (v !== '' && v != null && !isNaN(v)) {
          const s = Number(v).toFixed(f.dec).slice(0, f.len);
          for (let k = 0; k < s.length; k++) buf[o + f.len - s.length + k] = s.charCodeAt(k);
        }
      } else {
        buf.set(truncBytes(String(v ?? ''), f.len), o);
      }
      o += f.len;
    }
  }
  buf[o] = 0x1a;
  return buf;
}

function writeShpShx(points) {
  const n = points.length;
  const shp = new DataView(new ArrayBuffer(100 + 28 * n));
  const shx = new DataView(new ArrayBuffer(100 + 8 * n));
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const bbox = n ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : [0, 0, 0, 0];
  for (const [dv, len] of [[shp, 100 + 28 * n], [shx, 100 + 8 * n]]) {
    dv.setInt32(0, 9994); dv.setInt32(24, len / 2); dv.setInt32(28, 1000, true); dv.setInt32(32, 1, true);
    bbox.forEach((v, i) => dv.setFloat64(36 + i * 8, v, true));
  }
  points.forEach((p, i) => {
    const o = 100 + i * 28;
    shp.setInt32(o, i + 1); shp.setInt32(o + 4, 10);
    shp.setInt32(o + 8, 1, true); shp.setFloat64(o + 12, p[0], true); shp.setFloat64(o + 20, p[1], true);
    shx.setInt32(100 + i * 8, o / 2); shx.setInt32(100 + i * 8 + 4, 10);
  });
  return { shp: shp.buffer, shx: shx.buffer };
}

function addShapefile(zip, name, points, fields, records) {
  const { shp, shx } = writeShpShx(points);
  zip.file(name + '.shp', shp); zip.file(name + '.shx', shx);
  zip.file(name + '.dbf', writeDbf(fields, records));
  zip.file(name + '.prj', utmPrj(state.project.utmZone));
  zip.file(name + '.cpg', 'UTF-8');
}

function shapefileParts(zip, prefix = '') {
  const st = stations();
  const cols = columns();
  const names = dbfFieldNames(cols.map(c => c[0]));
  const numeric = new Set(['lat', 'lon', 'utm_zone', 'gps_e', 'gps_n', 'gps_elev', 'gps_acc', 'n_photos', 'n_struct', 'n_beds',
    ...state.project.schema.filter(f => f.type === 'number').map(f => f.key)]);
  const fields = cols.map((c, i) => ({ name: names[i], key: c[0], type: numeric.has(c[0]) ? 'N' : 'C' }));
  addShapefile(zip, prefix + 'stations', st.map(s => [s.easting, s.northing]), fields, st.map(row));
  zip.file(prefix + 'stations_fields.txt', cols.map((c, i) => `${names[i]}\t${c[1]}`).join('\r\n'));

  const sr = [];
  for (const s of st) for (const m of s.structures || []) sr.push({ s, m });
  if (sr.length) {
    const sf = [['station', 'C'], ['type', 'C'], ['kind', 'C'], ['dip', 'N'], ['dipdir', 'N'], ['strike', 'N'], ['plunge', 'N'], ['trend', 'N'], ['measure', 'C'], ['note', 'C']]
      .map(([k, t]) => ({ name: k, key: k, type: t }));
    addShapefile(zip, prefix + 'structures', sr.map(({ s }) => [s.easting, s.northing]), sf, sr.map(({ s, m }) => ({
      station: s.code, type: m.type, kind: m.kind, dip: m.dip, dipdir: m.dipDir, strike: m.strike, plunge: m.plunge, trend: m.trend, measure: describe(m), note: m.note || '',
    })));
  }
}

// ---------- GeoPackage ----------
function gpGeom(lon, lat) {
  const b = new DataView(new ArrayBuffer(8 + 21));
  b.setUint8(0, 0x47); b.setUint8(1, 0x50); b.setUint8(2, 0); b.setUint8(3, 1); b.setInt32(4, 4326, true);
  b.setUint8(8, 1); b.setUint32(9, 1, true); b.setFloat64(13, lon, true); b.setFloat64(21, lat, true);
  return new Uint8Array(b.buffer);
}

async function geopackage() {
  const SQL = await getSQL();
  const g = new SQL.Database();
  g.run(`PRAGMA application_id = 1196444487; PRAGMA user_version = 10300;
    CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT NOT NULL, srs_id INTEGER PRIMARY KEY, organization TEXT NOT NULL, organization_coordsys_id INTEGER NOT NULL, definition TEXT NOT NULL, description TEXT);
    INSERT INTO gpkg_spatial_ref_sys VALUES ('Undefined cartesian SRS', -1, 'NONE', -1, 'undefined', NULL), ('Undefined geographic SRS', 0, 'NONE', 0, 'undefined', NULL),
      ('WGS 84 geodetic', 4326, 'EPSG', 4326, 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]', NULL);
    CREATE TABLE gpkg_contents (table_name TEXT NOT NULL PRIMARY KEY, data_type TEXT NOT NULL, identifier TEXT UNIQUE, description TEXT DEFAULT '', last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), min_x DOUBLE, min_y DOUBLE, max_x DOUBLE, max_y DOUBLE, srs_id INTEGER);
    CREATE TABLE gpkg_geometry_columns (table_name TEXT NOT NULL, column_name TEXT NOT NULL, geometry_type_name TEXT NOT NULL, srs_id INTEGER NOT NULL, z TINYINT NOT NULL, m TINYINT NOT NULL, PRIMARY KEY (table_name, column_name));`);

  const st = stations();
  const bbox = st.length ? [Math.min(...st.map(s => s.lon)), Math.min(...st.map(s => s.lat)), Math.max(...st.map(s => s.lon)), Math.max(...st.map(s => s.lat))] : [0, 0, 0, 0];
  const featureTable = (name, cols, rows, geoms) => {
    const numeric = c => c[2] === 'number' || ['lat', 'lon', 'utm_zone', 'gps_e', 'gps_n', 'gps_elev', 'gps_acc', 'n_photos', 'n_struct', 'n_beds', 'dip', 'dip_dir', 'strike', 'plunge', 'trend'].includes(c[0]);
    g.run(`CREATE TABLE "${name}" (fid INTEGER PRIMARY KEY AUTOINCREMENT, geom POINT, ${cols.map(c => `"${c[0]}" ${numeric(c) ? 'REAL' : 'TEXT'}`).join(', ')})`);
    g.run(`INSERT INTO gpkg_contents (table_name, data_type, identifier, min_x, min_y, max_x, max_y, srs_id) VALUES (?, 'features', ?, ?, ?, ?, ?, 4326)`, [name, name, ...bbox]);
    g.run(`INSERT INTO gpkg_geometry_columns VALUES (?, 'geom', 'POINT', 4326, 0, 0)`, [name]);
    const stmt = g.prepare(`INSERT INTO "${name}" (geom, ${cols.map(c => `"${c[0]}"`).join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`);
    rows.forEach((r, i) => stmt.run([geoms[i], ...cols.map(c => {
      const v = r[c[0]];
      if (v === '' || v == null) return null;
      return numeric(c) ? Number(v) : String(v);
    })]));
    stmt.free();
  };

  featureTable('stations', columns(), st.map(row), st.map(s => gpGeom(s.lon, s.lat)));
  const sr = [];
  for (const s of st) for (const m of s.structures || []) sr.push({ s, m });
  featureTable('structures', [['station'], ['type'], ['kind'], ['dip'], ['dip_dir'], ['strike'], ['plunge'], ['trend'], ['measure'], ['note']],
    sr.map(({ s, m }) => ({ station: s.code, type: m.type, kind: m.kind, dip: m.dip, dip_dir: m.dipDir, strike: m.strike, plunge: m.plunge, trend: m.trend, measure: describe(m), note: m.note })),
    sr.map(({ s }) => gpGeom(s.lon, s.lat)));

  g.run(`CREATE TABLE log_beds (id INTEGER PRIMARY KEY AUTOINCREMENT, station TEXT, bed INTEGER, base_m REAL, top_m REAL, thickness REAL, formation TEXT, member TEXT, lithology TEXT, grain TEXT, colour TEXT, structures TEXT, fossils TEXT, contact TEXT, description TEXT, sample TEXT)`);
  g.run(`INSERT INTO gpkg_contents (table_name, data_type, identifier) VALUES ('log_beds', 'attributes', 'log_beds')`);
  for (const s of st) {
    let base = 0;
    ((s.log && s.log.beds) || []).forEach((b, i) => {
      const top = base + (Number(b.thickness) || 0);
      g.run('INSERT INTO log_beds (station, bed, base_m, top_m, thickness, formation, member, lithology, grain, colour, structures, fossils, contact, description, sample) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [s.code, i + 1, base, top, Number(b.thickness) || 0, b.formation || '', b.member || '', b.lithology || '', b.grain || '', b.color || '', b.structures || '', b.fossils || '', b.contact || '', b.description || '', b.sample || '']);
      base = top;
    });
  }
  const bytes = g.export();
  g.close();
  return new Blob([bytes], { type: 'application/geopackage+sqlite3' });
}

// ---------- public ----------
export const EXPORTS = {
  zip: { label: 'Everything (ZIP)', desc: 'CSV, Shapefile, KML, GPX, GeoJSON, photos, log drawings' },
  csv: { label: 'CSV (stations)', desc: 'Opens in Excel. Plus structures and log CSV' },
  shp: { label: 'Shapefile', desc: 'Stations and structures, in the project UTM zone (e.g. EPSG:32638)' },
  gpkg: { label: 'GeoPackage', desc: 'Stations, structures, log beds (WGS84)' },
  kmz: { label: 'KMZ (with photos)', desc: 'Google Earth' },
  kml: { label: 'KML', desc: 'Google Earth, no photos' },
  gpx: { label: 'GPX', desc: 'Waypoints for GPS devices' },
  geojson: { label: 'GeoJSON', desc: 'Web maps, QGIS' },
};

export async function runExport(kind) {
  const name = `${baseName()}_${fileStamp()}`;
  if (!stations().length) throw new Error('No stations to export');
  switch (kind) {
    case 'csv': {
      const zip = new JSZip();
      zip.file(`${name}_stations.csv`, stationsCsv());
      zip.file(`${name}_structures.csv`, structuresCsv());
      zip.file(`${name}_log.csv`, logCsv());
      return saveFile(await zip.generateAsync({ type: 'blob' }), `${name}_csv.zip`);
    }
    case 'geojson': return saveFile(new Blob([stationsGeoJSON()], { type: 'application/geo+json' }), `${name}.geojson`);
    case 'kml': return saveFile(new Blob([kml()], { type: 'application/vnd.google-earth.kml+xml' }), `${name}.kml`);
    case 'kmz': return saveFile(await kmz(), `${name}.kmz`);
    case 'gpx': return saveFile(new Blob([gpx()], { type: 'application/gpx+xml' }), `${name}.gpx`);
    case 'shp': {
      const zip = new JSZip(); shapefileParts(zip);
      return saveFile(await zip.generateAsync({ type: 'blob' }), `${name}_shp.zip`);
    }
    case 'gpkg': return saveFile(await geopackage(), `${name}.gpkg`);
    case 'zip': {
      const zip = new JSZip();
      zip.file('stations.csv', stationsCsv()); zip.file('structures.csv', structuresCsv()); zip.file('log_beds.csv', logCsv());
      zip.file('stations.geojson', stationsGeoJSON()); zip.file('stations.kml', kml()); zip.file('stations.gpx', gpx());
      shapefileParts(zip, 'shapefile/');
      for (const s of stations()) {
        (await stationPhotos(s)).forEach((p, i) => zip.file('photos/' + photoName(s, i), p.blob));
        if (s.log && s.log.beds && s.log.beds.length) zip.file(`logs/${s.code}_log.svg`, logSvg(s));
      }
      return saveFile(await zip.generateAsync({ type: 'blob' }), `${name}_all.zip`);
    }
    default: throw new Error('Unknown export ' + kind);
  }
}
