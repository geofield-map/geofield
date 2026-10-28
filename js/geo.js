// Coordinate conversion, point-in-polygon and structural geology helpers.
/* global proj4 */

export const UTM_ZONES = [36, 37, 38, 39, 40]; // zones covering Saudi Arabia

export function utmCode(zone) { return 'EPSG:326' + zone; }

for (const z of UTM_ZONES) {
  proj4.defs(utmCode(z), `+proj=utm +zone=${z} +datum=WGS84 +units=m +no_defs`);
}

export function toUTM(lat, lon, zone) {
  const [e, n] = proj4('EPSG:4326', utmCode(zone), [lon, lat]);
  return { easting: Math.round(e * 100) / 100, northing: Math.round(n * 100) / 100 };
}

export function fromUTM(e, n, zone) {
  const [lon, lat] = proj4(utmCode(zone), 'EPSG:4326', [e, n]);
  return { lat, lon };
}

export function toDMS(value, isLat) {
  const hemi = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
  let v = Math.abs(value);
  let d = Math.floor(v);
  let m = Math.floor((v - d) * 60);
  let s = ((v - d) * 60 - m) * 60;
  if (s >= 59.995) { s = 0; m += 1; }
  if (m >= 60) { m = 0; d += 1; }
  return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(2).padStart(5, '0')}"${hemi}`;
}

// Esri .prj text for a UTM zone (used in shapefile export).
export function utmPrj(zone) {
  const cm = zone * 6 - 183;
  return `PROJCS["WGS_1984_UTM_Zone_${zone}N",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",${cm}.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]`;
}

// ---- point in polygon (GeoJSON, lon/lat) ----
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygon(x, y, rings) {
  if (!rings.length || !inRing(x, y, rings[0])) return false;
  for (let k = 1; k < rings.length; k++) if (inRing(x, y, rings[k])) return false;
  return true;
}
export function featureContains(feature, lon, lat) {
  const g = feature && feature.geometry;
  if (!g) return false;
  if (g.type === 'Polygon') return inPolygon(lon, lat, g.coordinates);
  if (g.type === 'MultiPolygon') return g.coordinates.some(p => inPolygon(lon, lat, p));
  return false;
}

// ---- structural geology ----
export const norm360 = a => ((a % 360) + 360) % 360;

export function strikeFromDipDir(dipDir) { return norm360(dipDir - 90); } // right-hand rule
export function dipDirFromStrike(strike) { return norm360(strike + 90); }

// Plane from phone lying on the surface. beta/gamma in degrees, heading = top of phone (magnetic).
export function planeFromOrientation(beta, gamma, heading, declination) {
  const b = beta * Math.PI / 180, g = gamma * Math.PI / 180;
  const gx = Math.cos(b) * Math.sin(g);   // gravity in device frame
  const gy = -Math.sin(b);
  const dip = Math.acos(Math.min(1, Math.abs(Math.cos(b) * Math.cos(g)))) * 180 / Math.PI;
  const rel = Math.atan2(gx, gy) * 180 / Math.PI;
  const dipDir = norm360(heading + rel + declination);
  return { dip: Math.round(dip), dipDir: Math.round(dipDir) };
}

// Line along the long edge of the phone (top pointing along the lineation).
export function lineFromOrientation(beta, heading, declination) {
  let trend = heading + declination, plunge = -beta;
  if (plunge < 0) { plunge = -plunge; trend += 180; }
  return { trend: Math.round(norm360(trend)), plunge: Math.round(Math.min(90, plunge)) };
}

// Equal-area (Schmidt) lower-hemisphere projection. Returns x,y in unit circle.
export function projectLine(trend, plunge) {
  const t = trend * Math.PI / 180, p = plunge * Math.PI / 180;
  const r = Math.SQRT2 * Math.sin((Math.PI / 2 - p) / 2);
  return { x: r * Math.sin(t), y: -r * Math.cos(t) };
}

export function poleOf(dipDir, dip) {
  return { trend: norm360(dipDir + 180), plunge: 90 - dip };
}

export function greatCircle(dipDir, dip, steps = 60) {
  const toV = (tr, pl) => {
    const t = tr * Math.PI / 180, p = pl * Math.PI / 180;
    return [Math.cos(p) * Math.cos(t), Math.cos(p) * Math.sin(t), Math.sin(p)];
  };
  const s = toV(dipDir - 90, 0), d = toV(dipDir, dip);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI * i / steps;
    const v = s.map((c, k) => Math.cos(a) * c + Math.sin(a) * d[k]);
    const plunge = Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180 / Math.PI;
    const trend = Math.atan2(v[1], v[0]) * 180 / Math.PI;
    pts.push(projectLine(trend, Math.max(0, plunge)));
  }
  return pts;
}
