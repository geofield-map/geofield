// Built-in geological map of the Arabian Platform (data/geology.json), digitised from the geologist's
// Fomation_Platforme.shp: USGS map I-270A (1:2,000,000) with attributes after the Saudi Aramco 2016 chart.
// It works offline (the service worker caches the file) and does not depend on which map is on screen:
// the GPS position alone tells which formation the station sits on.
import { findFormation, formationColour } from './strat.js';

let data = null, loading = null;

export function loadGeology() {
  if (!loading) {
    loading = fetch('data/geology.json')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(d => {
        // bounding box per feature, so a point lookup only tests the few polygons that can contain it
        d.features = d.features.map(([code, polys]) => {
          let w = 180, s = 90, e = -180, n = -90;
          for (const rings of polys) for (const [x, y] of rings[0]) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
          return { code, polys, bbox: [w, s, e, n] };
        });
        data = d;
        return d;
      })
      .catch(err => { loading = null; throw err; });
  }
  return loading;
}

function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// The app's formation name for a map unit ("Basement (Arabian Shield)" -> "Basement"); '' when the unit is
// not a formation (Quaternary deposits, undifferentiated Neogene).
export function appFormation(unitName) {
  const fm = findFormation(String(unitName || '').replace(/\s*\(.*\)\s*$/, ''));
  return fm ? fm.name : '';
}

// Map unit at a position: { code, name, era, period, epoch, age, lith, members, remarks, formation } or null
export async function geologyAt(lat, lon) {
  if (lat == null || lon == null) return null;
  const d = await loadGeology();
  for (const f of d.features) {
    const [w, s, e, n] = f.bbox;
    if (lon < w || lon > e || lat < s || lat > n) continue;
    for (const rings of f.polys) {
      if (!inRing(rings[0], lon, lat)) continue;
      if (rings.slice(1).some(h => inRing(h, lon, lat))) continue; // inside a hole
      const u = d.units[f.code] || {};
      return { code: f.code, ...u, formation: appFormation(u.name) };
    }
  }
  return null;
}

// Station fields from the map: the formation (when it is one the app knows) or, for Quaternary and
// undifferentiated units, the time names straight from the map.
export async function geologyFill(lat, lon) {
  let g = null;
  try { g = await geologyAt(lat, lon); } catch (e) { return {}; }
  if (!g) return {};
  if (g.formation) return { formation: g.formation };
  return { era: g.era || '', period: g.period || '', epoch: g.epoch || '', age: g.age || '' };
}

// Fill colour for a map unit on the map: the chart colour of its formation, or a neutral colour for the rest
export function unitColour(unit) {
  const name = unit && unit.name;
  if (/quaternary/i.test(name || '')) return '#FFF6C8';
  if (/neogene/i.test(name || '')) return '#FFE680';
  return formationColour(appFormation(name)) || '#DDDDDD';
}

export function geologyData() { return data; }
