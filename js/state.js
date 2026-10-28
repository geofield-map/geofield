// App-wide state: current project, its stations, and the latest GPS fix.
import { db, uid } from './db.js';
import { cloneSchema } from './schema.js';

const listeners = {};
export function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
export function emit(evt, data) { (listeners[evt] || []).forEach(fn => fn(data)); }

export const state = {
  project: null,
  stations: [],
  gps: null,          // { lat, lon, alt, acc, heading, time }
  currentStationId: null,
};

export function newProject(name = 'My Project') {
  return {
    id: uid(), name, region: '', license: '', project: name, prospect: '', geologist: '',
    utmZone: 38, declination: 3.5, stationPrefix: 'ST-', nextStation: 1, nextSample: 1,
    schema: cloneSchema(), created: new Date().toISOString(),
  };
}

export async function loadProject(id) {
  let project = id ? await db.get('projects', id) : null;
  if (!project) {
    const all = await db.all('projects');
    project = all.sort((a, b) => (b.lastOpened || '').localeCompare(a.lastOpened || ''))[0];
  }
  if (!project) { project = newProject(); }
  project.lastOpened = new Date().toISOString();
  await db.put('projects', project);
  await db.put('meta', { id: 'currentProject', value: project.id });
  state.project = project;
  state.stations = (await db.byIndex('stations', 'projectId', project.id)).sort((a, b) => a.created.localeCompare(b.created));
  emit('project', project);
  emit('stations', state.stations);
  return project;
}

export async function saveProject() {
  await db.put('projects', state.project);
  emit('project', state.project);
}

export async function saveStation(st) {
  st.updated = new Date().toISOString();
  await db.put('stations', st);
  const i = state.stations.findIndex(s => s.id === st.id);
  if (i >= 0) state.stations[i] = st; else state.stations.push(st);
  emit('stations', state.stations);
}

export async function deleteStation(st) {
  const photos = await db.byIndex('photos', 'stationId', st.id);
  for (const p of photos) await db.del('photos', p.id);
  await db.del('stations', st.id);
  state.stations = state.stations.filter(s => s.id !== st.id);
  emit('stations', state.stations);
}

export function getStation(id) { return state.stations.find(s => s.id === id); }
