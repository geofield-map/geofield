// Offline support: keeps the app, its libraries and viewed map tiles on the phone.
const VERSION = 'geofield-v44';
const TILE_CACHE = 'geofield-tiles';

const APP_FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'js/app.js', 'js/db.js', 'js/geo.js', 'js/schema.js', 'js/ui.js', 'js/state.js', 'js/layers.js', 'js/mapview.js',
  'js/station.js', 'js/structures.js', 'js/log.js', 'js/export.js', 'js/project.js', 'js/strat.js', 'js/colours.js',
  'js/geology.js', 'js/library.js', 'js/section.js', 'data/geology.json',
];
const LIBS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://unpkg.com/shpjs@3.6.3/dist/shp.min.js',
  'https://unpkg.com/@tmcw/togeojson@5.8.1/dist/togeojson.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm',
  'https://unpkg.com/georaster@1.6.0/dist/georaster.browser.bundle.min.js',
  'https://unpkg.com/georaster-layer-for-leaflet@3.10.0/dist/georaster-layer-for-leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://unpkg.com/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js',
];
const TILE_HOSTS = ['server.arcgisonline.com', 'tile.opentopomap.org', 'tile.openstreetmap.org'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // 'reload' skips the phone's HTTP cache, so an update never stores yesterday's files
    await cache.addAll(APP_FILES.map(u => new Request(u, { cache: 'reload' })));
    // libraries one by one so a single CDN hiccup does not break installation
    await Promise.all(LIBS.map(u => cache.add(new Request(u, { mode: 'cors' })).catch(() => null)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION && key !== TILE_CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (TILE_HOSTS.some(h => url.hostname.endsWith(h))) {
    event.respondWith((async () => {
      const cache = await caches.open(TILE_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      } catch (e) { return new Response('', { status: 504 }); }
    })());
    return;
  }

  // App files: network first (so updates arrive), fall back to cache offline.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        // 'no-cache' asks GitHub whether the file changed instead of trusting a 10-minute-old copy
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        return (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
      }
    })());
    return;
  }

  // Libraries: cache first.
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());
});
