// Shared UI helpers: escaping, toast, bottom-sheet modal, file save/share, script loading.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
export function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

let modalOnClose = null;
export function openModal(title, html, onClose) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  $('#modal').classList.remove('hidden');
  modalOnClose = onClose || null;
  return $('#modal-body');
}
export function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modal-body').innerHTML = '';
  const cb = modalOnClose; modalOnClose = null;
  if (cb) cb();
}
$('#modal-close').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

export function confirmBox(msg) { return Promise.resolve(window.confirm(msg)); }

// On iPhone the share sheet lets the user save to Files, AirDrop, WhatsApp, Mail...
export async function saveFile(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const loaded = {};
export function loadScript(src) {
  if (!loaded[src]) {
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => { delete loaded[src]; reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  return loaded[src];
}

export const SQLJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
let sqlPromise;
export function getSQL() {
  if (!sqlPromise) {
    sqlPromise = loadScript(SQLJS_BASE + 'sql-wasm.js')
      .then(() => window.initSqlJs({ locateFile: f => SQLJS_BASE + f }))
      .catch(e => { sqlPromise = null; throw e; });
  }
  return sqlPromise;
}

export function fmt(v, d = 1) { return v == null || isNaN(v) ? '–' : Number(v).toFixed(d); }

export function fileStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
