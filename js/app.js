// Entry point: navigation between screens and start-up.
import { state, on, loadProject, getStation } from './state.js';
import { db, requestPersistence } from './db.js';
import { $, $$, toast } from './ui.js';
import { initMap, focusStation, invalidate } from './mapview.js';
import { initStation, createStation, showStation, renderStationList } from './station.js';
import { initLog, renderLog } from './log.js';
import { renderProjectStructures } from './structures.js';
import { renderProject } from './project.js';

const TITLES = { map: 'Map', stations: 'Stations', log: 'Stratigraphic Log', structs: 'Structures', project: 'Project' };
let current = 'map';
let previous = 'map';

function show(view) {
  if (view !== 'station') previous = view;
  current = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  $$('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === (view === 'station' ? previous : view)));
  $('#btn-back').classList.toggle('hidden', view !== 'station');
  refresh();
}

function refresh() {
  const st = getStation(state.currentStationId);
  $('#title').textContent = current === 'station' ? (st ? st.code : 'Station') : TITLES[current];
  $('#subtitle').textContent = state.project ? state.project.name : '';
  if (current === 'map') invalidate();
  else if (current === 'stations') renderStationList();
  else if (current === 'log') renderLog();
  else if (current === 'structs') renderProjectStructures(openStation);
  else if (current === 'project') renderProject();
}

function openStation(id, tab) {
  state.currentStationId = id;
  show('station');
  showStation(id, tab);
}

const nav = {
  openStation,
  openLog: id => { state.currentStationId = id; show('log'); },
  showOnMap: st => { show('map'); focusStation(st); },
  back: () => show(previous),
};

$$('#tabbar button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
$('#btn-back').addEventListener('click', () => show(previous));

on('stations', () => { if (current === 'stations') renderStationList(); });
on('project', () => { $('#subtitle').textContent = state.project.name; });

async function start() {
  initStation(nav);
  initLog(nav);
  initMap({ addPoint: fix => createStation(fix), openStation });
  const meta = await db.get('meta', 'currentProject');
  await loadProject(meta ? meta.value : null);
  show('map');
  requestPersistence();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
  }
}

start().catch(e => { console.error(e); toast('Start-up error: ' + e.message, 6000); });
