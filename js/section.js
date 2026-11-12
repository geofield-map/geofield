// Geological cross-section along a line A–B drawn on the map.
// Surface: ground elevation (online DEM, else the stations' GPS heights) and the formation at each point
// (the geologist's Formation file, else the built-in geological map). Subsurface: every point is traced
// up-dip along the bedding (apparent dip from Bedding measurements near the line, else a default dip)
// until it meets the ground; it takes the formation found there. Stations near the line are projected on it.
/* global L */
import { state } from './state.js';
import { $, esc, toast, openModal, saveFile, loadScript } from './ui.js';
import { geologyAt, unitColour } from './geology.js';
import { autofillFromLayers } from './layers.js';
import { formationColour } from './strat.js';
import { JSPDF_URL, SVG2PDF_URL } from './log.js';

const R = Math.PI / 180;

// ---------- picking A and B on the map ----------
let picking = null;
export function startSectionPick(map) {
  if (picking) { picking.cancel(); return; }
  const pts = [], marks = [];
  const line = L.polyline([], { color: '#e8833a', weight: 3, dashArray: '6 6' }).addTo(map);
  const cancel = () => { map.off('click', onClick); marks.forEach(m => map.removeLayer(m)); map.removeLayer(line); picking = null; $('#btn-section').classList.remove('on'); };
  const onClick = e => {
    pts.push(e.latlng);
    marks.push(L.marker(e.latlng, { icon: L.divIcon({ className: '', html: `<div class="sec-pin">${pts.length === 1 ? 'A' : 'B'}</div>`, iconSize: [26, 26] }) }).addTo(map));
    line.setLatLngs(pts);
    if (pts.length === 1) { toast('Now tap point B (end of the section)'); return; }
    const [a, b] = pts;
    setTimeout(cancel, 400);
    openSection({ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng });
  };
  map.on('click', onClick);
  picking = { cancel };
  $('#btn-section').classList.add('on');
  toast('Cross-section: tap point A (start), then point B. Tap ✂ again to cancel.', 4000);
}

// ---------- data along the line ----------
function frame(a, b) {
  const lat0 = (a.lat + b.lat) / 2, kx = 111320 * Math.cos(lat0 * R), ky = 110540;
  const xy = p => [(p.lon - a.lon) * kx, (p.lat - a.lat) * ky];
  const [bx, by] = xy(b), len = Math.hypot(bx, by), ux = bx / len, uy = by / len;
  const az = (Math.atan2(bx, by) / R + 360) % 360; // section azimuth A→B, degrees from north
  return { len, az, along: p => { const [x, y] = xy(p); return { d: x * ux + y * uy, off: Math.abs(-x * uy + y * ux) }; },
    at: d => ({ lat: a.lat + (d * uy) / ky, lon: a.lon + (d * ux) / kx }) };
}

async function demElevations(points) {
  const out = [];
  for (let i = 0; i < points.length; i += 100) {
    const chunk = points.slice(i, i + 100);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${chunk.map(p => p.lat.toFixed(5)).join(',')}&longitude=${chunk.map(p => p.lon.toFixed(5)).join(',')}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    out.push(...(await r.json()).elevation);
  }
  return out;
}

const apparentDip = (dip, dipDir, az) => Math.atan(Math.tan(dip * R) * Math.cos((dipDir - az) * R)) / R; // + = dips toward B

async function buildData(a, b, opt) {
  const F = frame(a, b), N = 160;
  const samples = Array.from({ length: N + 1 }, (_, i) => ({ d: (F.len * i) / N, ...F.at((F.len * i) / N) }));
  // stations near the line
  const near = state.stations.filter(s => s.lat != null).map(s => ({ s, ...F.along(s) }))
    .filter(o => o.off <= opt.buffer && o.d >= -opt.buffer && o.d <= F.len + opt.buffer);
  // ground elevation
  let demOk = true;
  try { (await demElevations(samples)).forEach((z, i) => { samples[i].z = z; }); }
  catch (e) {
    demOk = false; // offline: interpolate the stations' GPS heights along the line
    const pts = near.filter(o => o.s.elev != null).sort((p, q) => p.d - q.d);
    samples.forEach(p => {
      if (!pts.length) { p.z = 0; return; }
      const r = pts.find(o => o.d >= p.d), l = [...pts].reverse().find(o => o.d <= p.d);
      p.z = !l ? r.s.elev : !r ? l.s.elev : l === r ? l.s.elev : l.s.elev + ((r.s.elev - l.s.elev) * (p.d - l.d)) / (r.d - l.d);
    });
  }
  // formation at the surface
  for (const p of samples) {
    const own = (await autofillFromLayers(p.lat, p.lon)).formation;
    const g = await geologyAt(p.lat, p.lon).catch(() => null);
    p.unit = own || (g ? g.formation || g.name : '');
    p.colour = formationColour(p.unit) || (g ? unitColour(g) : '#e0e0e0');
    p.cover = /quaternary/i.test(p.unit); // thin superficial cover, not bedrock
  }
  // bedrock under the cover: the nearest bedrock unit on either side (hidden contact midway under the cover)
  samples.forEach((p, i) => {
    if (!p.cover) { p.rock = p.unit; p.rockColour = p.colour; return; }
    let l = i, r = i;
    while (l >= 0 && samples[l].cover) l--;
    while (r < samples.length && samples[r].cover) r++;
    const src = l < 0 ? samples[r] : r >= samples.length ? samples[l] : (i - l <= r - i ? samples[l] : samples[r]);
    p.rock = src ? src.unit : ''; p.rockColour = src ? src.colour : '#d9d9d9';
  });
  // apparent dips from Bedding measurements near the line (within twice the buffer)
  const dips = [];
  for (const o of state.stations.filter(s => s.lat != null).map(s => ({ s, ...F.along(s) })).filter(o => o.off <= opt.buffer * 2)) {
    for (const m of o.s.structures || []) if (/bedding/i.test(m.type || '') && m.dip != null) dips.push({ d: o.d, a: apparentDip(Number(m.dip), Number(m.dipDir), F.az), m, code: o.s.code });
  }
  const defA = apparentDip(opt.dip, opt.dipDir, F.az);
  const dipAt = d => { if (!dips.length) return defA; let best = dips[0]; for (const x of dips) if (Math.abs(x.d - d) < Math.abs(best.d - d)) best = x; return best.a; };
  return { F, samples, near, dips, demOk, defA, dipAt };
}

// ---------- drawing ----------
function sectionSvg(D, opt) {
  const { F, samples, near, dips } = D;
  const zs = samples.map(p => p.z), zMax = Math.max(...zs), zMin = Math.min(...zs);
  const base = zMin - opt.depth, W = 1000, sx = W / F.len, sy = sx * opt.ve;
  const top = zMax + (zMax - base) * 0.12 / opt.ve + 30 / sy;
  const H = (top - base) * sy, padL = 56, padT = 40, padB = 70;
  const X = d => padL + d * sx, Y = z => padT + (top - z) * sy;
  const ground = d => { const i = Math.min(samples.length - 2, Math.max(0, Math.floor((d / F.len) * (samples.length - 1)))); const p = samples[i], q = samples[i + 1]; return p.z + ((q.z - p.z) * (d - p.d)) / (q.d - p.d || 1); };
  const unitAtSurface = d => samples[Math.max(0, Math.min(samples.length - 1, Math.round((d / F.len) * (samples.length - 1))))];
  // subsurface: trace each cell up-dip to the ground
  const cols = 220, rows = 90, cw = F.len / cols, ch = (zMax - base) / rows;
  let cells = '';
  for (let r = 0; r < rows; r++) {
    const z = base + (r + 0.5) * ch;
    let run = null;
    const flush = () => { if (run) { cells += `<rect x="${X(run.d0).toFixed(1)}" y="${Y(z + ch / 2).toFixed(1)}" width="${(run.n * cw * sx + 0.6).toFixed(1)}" height="${(ch * sy + 0.6).toFixed(1)}" fill="${run.c}"/>`; run = null; } };
    for (let c = 0; c < cols; c++) {
      const d0 = c * cw, dm = d0 + cw / 2;
      if (z > ground(dm)) { flush(); continue; } // above ground
      let d = dm, zz = z, colour = '#d9d9d9', guard = 0;
      while (guard++ < 400) {
        const a = D.dipAt(d), step = cw;
        if (Math.abs(a) < 0.05) { colour = null; break; } // flat: same bed all along, use the surface above
        const dir = a > 0 ? -1 : 1; // up-dip direction along the section
        const nd = d + dir * step, nz = zz + step * Math.tan(Math.abs(a) * R);
        if (nd < 0 || nd > F.len) break; // leaves the section: unknown
        if (nz >= ground(nd)) { colour = unitAtSurface(nd).rockColour; break; }
        d = nd; zz = nz;
      }
      if (colour === null) colour = unitAtSurface(dm).rockColour;
      if (run && run.c === colour) run.n++; else { flush(); run = { d0, n: 1, c: colour }; }
    }
    flush();
  }
  // ground line and surface units
  const gpath = samples.map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)},${Y(p.z).toFixed(1)}`).join('');
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W + padL + 20}" height="${H + padT + padB}" viewBox="0 0 ${W + padL + 20} ${H + padT + padB}" font-family="Helvetica, Arial, sans-serif">
    <rect width="100%" height="100%" fill="#fff"/>
    <defs><clipPath id="sec-clip"><path d="${gpath}L${X(F.len)},${Y(base)}L${X(0)},${Y(base)}Z"/></clipPath></defs>
    <g clip-path="url(#sec-clip)">${cells}</g>`;
  // surface contacts and dip-parallel contact traces
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].rock === samples[i - 1].rock) continue; // bedrock contacts (also hidden under the cover)
    const d = (samples[i].d + samples[i - 1].d) / 2, z = ground(d), a = D.dipAt(d);
    const dz = z - base, dd = Math.abs(a) < 0.05 ? 0 : (a > 0 ? 1 : -1) * dz / Math.tan(Math.abs(a) * R);
    s += `<line x1="${X(d).toFixed(1)}" y1="${Y(z).toFixed(1)}" x2="${X(d + dd).toFixed(1)}" y2="${Y(base).toFixed(1)}" stroke="#333" stroke-width=".8" stroke-dasharray="5 3" clip-path="url(#sec-clip)"/>`;
  }
  // superficial cover (Quaternary): a thin veneer on the ground, about 10 m thick (at least 4 px)
  const qt = Math.max(10, 4 / sy);
  for (let i = 0; i < samples.length; i++) {
    if (!samples[i].cover) continue;
    let j = i; while (j + 1 < samples.length && samples[j + 1].cover) j++;
    const seg = samples.slice(i, j + 1);
    const d0 = i ? (samples[i - 1].d + samples[i].d) / 2 : 0, d1 = j < samples.length - 1 ? (samples[j].d + samples[j + 1].d) / 2 : F.len;
    const topPts = [[d0, ground(d0)], ...seg.map(p => [p.d, p.z]), [d1, ground(d1)]];
    s += `<path d="M${topPts.map(([d, z]) => `${X(d).toFixed(1)},${Y(z).toFixed(1)}`).join('L')}L${topPts.slice().reverse().map(([d, z]) => `${X(d).toFixed(1)},${Y(z - qt).toFixed(1)}`).join('L')}Z" fill="${seg[0].colour}" stroke="#8d7b3a" stroke-width=".5"/>`;
    i = j;
  }
  s += `<path d="${gpath}" fill="none" stroke="#000" stroke-width="1.6"/>`;
  s += `<rect x="${X(0)}" y="${Y(top)}" width="${W}" height="${H}" fill="none" stroke="#666" stroke-width=".8"/>`;
  // bedding measurements: dip ticks at their station
  for (const x of dips) {
    if (x.d < 0 || x.d > F.len) continue;
    const z = ground(x.d), k = 18, ang = Math.atan(Math.tan(x.a * R) * opt.ve);
    s += `<line x1="${(X(x.d) - k * Math.cos(ang)).toFixed(1)}" y1="${(Y(z) + 6 - k * Math.sin(ang)).toFixed(1)}" x2="${(X(x.d) + k * Math.cos(ang)).toFixed(1)}" y2="${(Y(z) + 6 + k * Math.sin(ang)).toFixed(1)}" stroke="#1e3a8a" stroke-width="2"/>`;
  }
  // stations
  for (const o of near) {
    const d = Math.max(0, Math.min(F.len, o.d)), z = ground(d);
    const lab = [o.s.code, o.s.attrs.formation].filter(Boolean).join(' · ');
    s += `<line x1="${X(d)}" y1="${Y(z)}" x2="${X(d)}" y2="${Y(z) - 22}" stroke="#e8833a" stroke-width="1.2"/><circle cx="${X(d)}" cy="${Y(z)}" r="3.5" fill="#e8833a" stroke="#000" stroke-width=".8"/>
      <text transform="translate(${X(d) + 3},${Y(z) - 25}) rotate(-50)" font-size="10">${esc(lab)}</text>`;
  }
  // axes: elevation ticks, distance scale, A/B
  const zStep = [5, 10, 20, 50, 100, 200, 500, 1000].find(st => (top - base) / st <= 8) || 2000;
  for (let z = Math.ceil(base / zStep) * zStep; z <= top; z += zStep) s += `<line x1="${X(0) - 5}" y1="${Y(z)}" x2="${X(0)}" y2="${Y(z)}" stroke="#000"/><text x="${X(0) - 7}" y="${Y(z) + 3}" font-size="10" text-anchor="end">${z}</text>`;
  s += `<text transform="translate(12,${padT + H / 2}) rotate(-90)" font-size="10" text-anchor="middle">Elevation (m)</text>`;
  const dStep = [100, 200, 500, 1000, 2000, 5000, 10000, 20000].find(st => F.len / st <= 10) || 50000;
  for (let d = 0; d <= F.len; d += dStep) s += `<line x1="${X(d)}" y1="${Y(base)}" x2="${X(d)}" y2="${Y(base) + 5}" stroke="#000"/><text x="${X(d)}" y="${Y(base) + 16}" font-size="10" text-anchor="middle">${d >= 1000 ? d / 1000 + ' km' : d + ' m'}</text>`;
  s += `<text x="${X(0)}" y="${padT - 14}" font-size="16" font-weight="bold">A</text><text x="${X(F.len)}" y="${padT - 14}" font-size="16" font-weight="bold" text-anchor="end">B</text>
    <text x="${X(F.len / 2)}" y="${padT - 14}" font-size="11" text-anchor="middle">Azimuth ${F.az.toFixed(0)}° · length ${(F.len / 1000).toFixed(2)} km · vertical exaggeration ×${opt.ve}</text>`;
  // legend
  const units = [];
  samples.forEach(p => { if (p.unit && !units.some(u => u.name === p.unit)) units.push({ name: p.unit, c: p.colour }); });
  let lx = X(0), ly = Y(base) + 34;
  units.forEach(u => { s += `<rect x="${lx}" y="${ly}" width="18" height="11" fill="${u.c}" stroke="#555" stroke-width=".6"/><text x="${lx + 23}" y="${ly + 9.5}" font-size="10.5">${esc(u.name)}</text>`; lx += 30 + u.name.length * 6.2; if (lx > W - 60) { lx = X(0); ly += 16; } });
  s += `<text x="${X(0)}" y="${ly + 28}" font-size="9" fill="#555">Ground: ${D.demOk ? 'Copernicus DEM (Open-Meteo)' : 'station GPS heights (offline)'} · Geology: ${'formation file / built-in map'} · Dips: ${dips.length ? dips.length + ' bedding measurement(s)' : 'default ' + opt.dip + '°/' + opt.dipDir + '° (apparent ' + D.defA.toFixed(1) + '°)'} · grey = not resolved from surface data · ${new Date().toISOString().slice(0, 10)}</text>`;
  return s.replace(/height="\d+(\.\d+)?" viewBox/, `height="${(ly + 40).toFixed(0)}" viewBox`).replace(/viewBox="0 0 ([\d.]+) [\d.]+"/, `viewBox="0 0 $1 ${(ly + 40).toFixed(0)}"`) + '</svg>';
}

// ---------- screen ----------
async function openSection(a, b) {
  // default dip: mean of all Bedding measurements in the project (Arabian Platform: gentle dips), else 1° toward 070
  const beds = state.stations.flatMap(s => (s.structures || []).filter(m => /bedding/i.test(m.type || '') && m.dip != null));
  const opt = { buffer: 1000, ve: 10, depth: 300, dip: beds.length ? Math.round(beds.reduce((x, m) => x + Number(m.dip), 0) / beds.length) : 1, dipDir: beds.length ? Number(beds[0].dipDir) : 70 };
  const body = openModal('Cross-section A–B', `
    <div class="grid2">
      <div class="field"><label>Stations within (m)</label><input type="number" inputmode="decimal" id="sc-buf" value="${opt.buffer}"></div>
      <div class="field"><label>Vertical exaggeration</label><select id="sc-ve">${[1, 2, 5, 10, 20, 50].map(v => `<option ${v === opt.ve ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Depth below lowest ground (m)</label><input type="number" inputmode="decimal" id="sc-depth" value="${opt.depth}"></div>
      <div class="field"><label>Default dip / dip direction</label><div style="display:flex;gap:6px"><input type="number" inputmode="decimal" id="sc-dip" value="${opt.dip}"><input type="number" inputmode="decimal" id="sc-dd" value="${opt.dipDir}"></div></div>
    </div>
    <p class="muted" style="margin:0 0 8px">Bedding measured at stations near the line is used first; the default dip only where there is none.</p>
    <div class="btns" style="margin-top:0"><button class="btn primary" id="sc-draw">Draw section</button></div>
    <div id="sc-out" class="sec-wrap"><p class="muted">Building the section…</p></div>
    <div class="btns"><button class="btn" id="sc-pdf">Export PDF</button><button class="btn" id="sc-png">Export PNG</button><button class="btn" id="sc-svg">Export SVG</button></div>`);
  let D = null, svg = '';
  const read = () => Object.assign(opt, {
    buffer: Number(body.querySelector('#sc-buf').value) || 1000, ve: Number(body.querySelector('#sc-ve').value) || 10,
    depth: Number(body.querySelector('#sc-depth').value) || 300, dip: Number(body.querySelector('#sc-dip').value) || 0, dipDir: Number(body.querySelector('#sc-dd').value) || 0,
  });
  let lastBuffer = null;
  const draw = async () => {
    read();
    body.querySelector('#sc-out').innerHTML = '<p class="muted">Building the section…</p>';
    try {
      if (!D || lastBuffer !== opt.buffer) { D = await buildData(a, b, opt); lastBuffer = opt.buffer; }
      const defA = Math.atan(Math.tan(opt.dip * R) * Math.cos((opt.dipDir - D.F.az) * R)) / R;
      if (!D.dips.length) { D.defA = defA; D.dipAt = () => defA; }
      svg = sectionSvg(D, opt);
      body.querySelector('#sc-out').innerHTML = svg;
      if (!D.demOk) toast('No internet: ground drawn from your stations’ GPS heights', 4000);
    } catch (e) { console.error(e); body.querySelector('#sc-out').innerHTML = `<p class="muted">Could not build the section: ${esc(e.message)}</p>`; }
  };
  body.querySelector('#sc-draw').onclick = draw;
  const name = `Section_${new Date().toISOString().slice(0, 10)}`;
  body.querySelector('#sc-svg').onclick = () => svg && saveFile(new Blob([svg], { type: 'image/svg+xml' }), name + '.svg');
  body.querySelector('#sc-png').onclick = async () => { if (svg) saveFile(await toPng(svg), name + '.png'); };
  body.querySelector('#sc-pdf').onclick = async () => { if (svg) saveFile(await toPdf(svg), name + '.pdf'); };
  draw();
}

async function toPng(svg) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas'), k = 2; c.width = img.width * k; c.height = img.height * k;
    const ctx = c.getContext('2d'); ctx.scale(k, k); ctx.drawImage(img, 0, 0);
    return await new Promise(r => c.toBlob(r, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
async function toPdf(svg) {
  await loadScript(JSPDF_URL); await loadScript(SVG2PDF_URL);
  const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const W = Number(el.getAttribute('width')), H = Number(el.getAttribute('height'));
  const doc = new window.jspdf.jsPDF({ orientation: W > H ? 'landscape' : 'portrait', unit: 'pt', format: [W, H] });
  const holder = document.createElement('div'); holder.style.cssText = 'position:absolute;left:-99999px;top:0'; holder.appendChild(el); document.body.appendChild(holder);
  try { await doc.svg(el, { x: 0, y: 0, width: W, height: H }); } finally { holder.remove(); }
  return doc.output('blob');
}
