// Small IndexedDB wrapper. All data lives on the device and works offline.
const DB_NAME = 'geofield';
const DB_VERSION = 1;
const STORES = ['projects', 'stations', 'photos', 'layers', 'meta'];

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          if (name === 'stations' || name === 'layers') store.createIndex('projectId', 'projectId');
          if (name === 'photos') store.createIndex('stationId', 'stationId');
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export const db = {
  async get(name, id) { return wrap((await store(name)).get(id)); },
  async all(name) { return wrap((await store(name)).getAll()); },
  async byIndex(name, index, value) { return wrap((await store(name)).index(index).getAll(value)); },
  async put(name, obj) { return wrap((await store(name, 'readwrite')).put(obj)); },
  async del(name, id) { return wrap((await store(name, 'readwrite')).delete(id)); },
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Ask the browser not to evict our data when storage is low.
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (e) { /* not supported */ }
  return false;
}
