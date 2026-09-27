
import { Bus } from './core/bus.js';
import { Prefs } from './core/prefs.js';
import { CryptoUtil } from './core/crypto.js';
import { Store } from './core/store.js';
import { State } from './core/state.js';
import { Strings } from './core/strings.js';
import { Config } from './core/config.js';
import { EVENTS } from './core/events.js';
import { Flags } from './core/flags.js';
import { StorageAdapter } from './core/storage-adapter.js';
import { Navigation } from './core/navigation.js';
import { Telemetry } from './core/telemetry.js';
import { ViewErrors } from './core/errors.js';
import { WorkerPool } from './core/worker-pool.js';
import { PluginAPI } from './plugins/api.js';
import { Router } from './core/router.js';
import { Toast } from './ui/toast.js';
import { Modal } from './ui/modal.js';
import { Focus } from './ui/focus.js';
import { Announce } from './ui/announce.js';
import { HeaderRenderer } from './ui/header.js';
import { DrawerController } from './ui/drawer.js';
import { Tabs } from './ui/tabs.js';
import { Keyboard } from './ui/keyboard.js';
import { Status } from './ui/status.js';
import { TOC } from './ui/toc.js';
import { ReadingProgress } from './ui/reading-progress.js';
import { CommandPalette } from './ui/command-palette.js';
import { Theme } from './theme/theme.js';
import { Background } from './theme/background.js';
import { Settings } from './settings/settings.js';
import { Markdown } from './markdown/markdown.js';
import { Undo } from './editor/undo.js';
import { Editor } from './editor/editor.js';
import { SelectionBubble } from './editor/bubble.js';
import { FileUploader } from './library/uploader.js';
import { NoteEngine } from './library/note-engine.js';
import { ContentView } from './library/content-view.js';
import { PathwayIO } from './library/pathway.js';
import { ReviewEngine } from './srs/review-engine.js';
import { Exporter } from './output/exporter.js';
import { AudioPlayer } from './input/audio-player.js';
import { ErrorBoundary } from './diagnostics/error-boundary.js';
import { Scrollbar } from './ui/scrollbar.js';
import { escapeHtml } from './core/escape.js';
import { Library } from './library/library.js';
import { Features, Permissions } from './core/features.js';
import { Storage } from './core/storage.js';
import { Clock } from './core/clock.js';
import { Format } from './core/format.js';
import { VirtualList } from './library/virtual-list.js';

Object.defineProperty(window, 'Cwtch', {
value: Object.freeze({ Bus, Prefs, CryptoUtil, Store, State, Strings, Config, Router, Toast, Modal, Focus, Announce, HeaderRenderer, DrawerController, Tabs, Keyboard, Status, TOC, ReadingProgress, Scrollbar, CommandPalette, Theme, Background, Settings, Markdown, Undo, Editor, SelectionBubble, FileUploader, NoteEngine, ContentView, PathwayIO, ReviewEngine, Exporter, AudioPlayer, ErrorBoundary, escapeHtml,
  EVENTS, Flags, Permissions, StorageAdapter, Navigation, Telemetry, ViewErrors, WorkerPool, PluginAPI,
  Library, Features, Storage, Clock, Format, VirtualList }),
writable: false,
configurable: false,
enumerable: true
});

Storage.install();
Library.install();

ErrorBoundary.install();

async function checkVersion() {
try {
if (!navigator.onLine) return;
let _intervalH = 24;
try { const _raw = Number(Prefs.get('setting.updater.intervalHours')); if (Number.isFinite(_raw) && _raw > 0) _intervalH = _raw; } catch (e) { console.warn('[version] interval', e); }
const lastCheck = Number(Prefs.get('version.lastCheck')) || 0;
const now = Date.now();
if (now - lastCheck < _intervalH * 60 * 60 * 1000) return;
const res = await fetch('./data/version.json', { cache: 'no-store', credentials: 'omit' });
if (!res.ok) { console.warn('[version] fetch status', res.status); return; }
const data = await res.json();
const current = Prefs.get('version.current') || '0.0.0';
if (data && data.version) {
try {
const _avail = Prefs.get('version.available');
if (data.version !== current) {
if (_avail !== data.version) {
const ut = document.getElementById('updateToast');
if (ut) { ut.textContent = 'Update available: ' + data.version; ut.hidden = false; setTimeout(() => { ut.hidden = true; }, 8000); }
Prefs.set('version.available', data.version);
}
} else {
Prefs.remove('version.available');
Prefs.set('version.current', data.version);
}
} catch (e) { console.warn('[version] prefs', e); }
}
try { Prefs.set('version.lastCheck', now); } catch {}
} catch (e) { console.warn('[version] check failed', e); }
}

(async function boot() {
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
try {
const _scope = './';
navigator.serviceWorker.getRegistration(_scope).then(reg => {
if (reg) return;
navigator.serviceWorker.register('./sw.js', { scope: _scope }).catch(e => console.warn('[sw] register failed', e));
}).catch(e => console.warn('[sw] getRegistration', e));
} catch (e) { console.warn('[sw] register threw', e); }
try { navigator.serviceWorker.addEventListener('message', (e) => { if (e && e.data && e.data.type === 'cwtch:reload') location.reload(); }); } catch (e) { console.warn('[sw] message bind', e); }
}
try {
try { if (typeof Strings !== 'undefined' && typeof Strings.load === 'function') Strings.load(); } catch (e) { console.warn('[boot] Strings.load failed', e); }
Theme.init();
try { await Store.migrateLegacy(); } catch (e) { console.warn('[boot] migrateLegacy failed', e); }
await checkVersion().catch(e => console.warn('[version]', e));
const bootMain = document.getElementById('main');
if (bootMain) bootMain.setAttribute('aria-busy', 'true');
try {
let items = await Store.list();
  const _order = Prefs.get('libraryOrder');
  if (Array.isArray(_order) && _order.length) {
const _rank = new Map(_order.map((id, i) => [id, i]));
items = items.slice().sort((a, b) => {
const ra = (a && typeof a.id === 'string' && _rank.has(a.id)) ? _rank.get(a.id) : Infinity;
const rb = (b && typeof b.id === 'string' && _rank.has(b.id)) ? _rank.get(b.id) : Infinity;
if (ra === Infinity && rb === Infinity) return 0;
return ra - rb;
});
  }
  State.set('libraryItems', items);
  if (items.length) setTimeout(async () => {
  try {
  if (window._folderPickInProgress || window._filePickInProgress || window._pathwayExportRunning) { console.info('[boot] asset cleanup deferred: upload/export in progress'); return; }
  const used = new Set(items.map(i => i.assetKey).filter(Boolean));
  const bgKey = Prefs.get('setting.bgAssetKey'); if (bgKey) used.add(bgKey);
const _freshItems = await Store.list();
for (const _i of _freshItems) if (_i.assetKey) used.add(_i.assetKey);
const al = typeof Store.listAssets === 'function' ? await Store.listAssets() : null;
if (al) {
if (window._folderPickInProgress || window._filePickInProgress || window._pathwayExportRunning) { console.info('[boot] asset cleanup deferred: upload/export in progress'); return; }
const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;
for (const k of al) {
if (used.has(k) || k.startsWith('bg:')) continue;
if (k.startsWith('ver:')) {
const parts = k.split(':');
const ts = parseInt(parts[2], 10);
if (!ts || (now - ts) > 30 * DAY) { try { await Store.removeAsset(k); } catch (e) { console.warn('[boot] removeAsset ver', e); } }
} else if (k.startsWith('trash:')) {
const ts = parseInt(k.slice(6), 10);
if (ts && (now - ts) > 7 * DAY) { try { await Store.removeAsset(k); } catch (e) { console.warn('[boot] removeAsset trash', e); } }
} else { try { await Store.removeAsset(k); } catch (e) { console.warn('[boot] removeAsset orphan', e); } }
}
}
} catch {}
}, 2000);
} catch (e) {
console.warn('[boot] could not load items:', e);
try { State.set('libraryItems', []); } catch {}
} finally {
if (bootMain) bootMain.removeAttribute('aria-busy');
const skel = document.getElementById('bootSkeleton');
if (skel) skel.hidden = true;
}
let savedActive;
try { savedActive = Prefs.get('activeHeaderId'); } catch (e) { console.warn('[boot] activeHeaderId', e); }
if (savedActive !== undefined && savedActive !== null && typeof savedActive === 'string' && savedActive.length > 0 && savedActive.length < 64) State.set('activeHeaderId', savedActive);
let savedTabs;
try { savedTabs = Prefs.get('openTabs'); } catch (e) { console.warn('[boot] openTabs', e); }
if (Array.isArray(savedTabs)) State.set('openTabs', savedTabs.slice(0, 50));
let savedTabId;
try { savedTabId = Prefs.get('activeTabId'); } catch (e) { console.warn('[boot] activeTabId', e); }
if (savedTabId) State.set('activeTabId', savedTabId);
try {
if (!window._cwtchSaveBroadcast && typeof BroadcastChannel === 'function') {
window._cwtchSaveBroadcast = new BroadcastChannel('cwtch-save');
window._cwtchSaveBroadcast.onmessage = ev => { try { if (ev && ev.data && ev.data.id) Bus.emit(EVENTS.LIBRARY_CHANGED); } catch (e) { console.warn('[boot] broadcast message', e); } };
}
} catch (e) { console.warn('[boot] BroadcastChannel', e); }
if (typeof HeaderRenderer.render === 'function') HeaderRenderer.render();
try { const _fmRaw = Prefs.get('setting.reader.focusMode'); if (_fmRaw === true || _fmRaw === 'true') document.body.classList.add('focus-mode'); } catch (e) { console.warn('[boot] focus restore', e); }
Status.init();
TOC.init();
Background.init();
ReadingProgress.init();
if (Scrollbar && typeof Scrollbar.init === 'function') { try { Scrollbar.init(); } catch (e) { console.warn('[boot] scrollbar', e); } }
try { Tabs.init(); } catch (e) { console.warn('[boot] Tabs.init', e); }
} catch (err) {
try { ErrorBoundary.showFatal(err && err.message ? err.message : String(err)); } catch (e) { console.warn('[boot] showFatal', e); }
}

try { if (Flags.get('workerOffload')) WorkerPool.init(); }
catch (e) { console.warn('[boot] WorkerPool.init', e); }
try { ViewErrors.register('library', e => console.warn('[view-error:library]', e)); }
catch (e) { console.warn('[boot] ViewErrors.register', e); }
try { Telemetry.record('boot.ready', { items: (State.get('libraryItems') || []).length }); }
catch (e) { console.warn('[boot] telemetry', e); }

const bootActiveId = State.get('activeTabId');
const bootDocItem = bootActiveId && (State.get('libraryItems') || []).find(x => x.id === bootActiveId);
try {
if (bootDocItem) { Navigation.push({ view: 'doc', id: bootDocItem.id }); ContentView.showDocument(bootDocItem, true); }
else { Navigation.push({ view: 'library', id: null }); ContentView.showLibrary(); }
FileUploader.bind();
Router.install();
Keyboard.install();
CommandPalette.init();
SelectionBubble.init();
AudioPlayer.init();
} catch (err) {
try { ErrorBoundary.showFatal(err && err.message ? err.message : String(err)); } catch (e) { console.warn('[boot] showFatal', e); }
}

document.getElementById('headerMenuBtn')?.addEventListener('click', () => {
const wrap = document.createElement('div');
wrap.setAttribute('role', 'menu');
wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow-y:auto';
const _canvasRow = document.createElement('div');
_canvasRow.style.cssText = 'display:flex;align-items:center;gap:6px';
const _canvasBtn = document.createElement('button');
_canvasBtn.type = 'button';
_canvasBtn.className = 'drawer__item';
_canvasBtn.style.flex = '1';
_canvasBtn.innerHTML = '<span class="d-icon" aria-hidden="true">🎨</span><span class="d-text">Canvas</span><span class="d-meta">draw</span>';
_canvasBtn.addEventListener('click', () => { try { Modal.dismiss(); } catch {} try { ContentView.showCanvas(); } catch (e) { console.warn('[boot] canvas', e); } });
_canvasRow.appendChild(_canvasBtn);
wrap.appendChild(_canvasRow);
const _hRaw = Prefs.get('hiddenHeaderIds');
const hidden = Array.isArray(_hRaw) ? _hRaw.filter(x => typeof x === 'string') : [];
const sections = (Config._defaultHeader || []).filter(h => h && h.id && hidden.includes(h.id)).map(h => Object.assign({}, h, { _orphan: false }));
const _ORPHAN_META = { theme: { icon: '🎨', label: 'Theme' }, invert: { icon: '🌓', label: 'Invert' }, background: { icon: '🖼️', label: 'Wallpaper' }, export: { icon: '📤', label: 'Export' }, help: { icon: '❓', label: 'Help' }, toc: { icon: '🌲', label: 'Contents' }, pathway: { icon: '🧭', label: 'Pathways' } };
const _knownHeaderIds = new Set();
(Config._defaultHeader || []).forEach(h => { if (h && h.id) _knownHeaderIds.add(h.id); });
(Config.headerCatalog || []).forEach(h => { if (h && h.id) _knownHeaderIds.add(h.id); });
(Config.headerConditional || []).forEach(h => { if (h && h.id) _knownHeaderIds.add(h.id); });
const orphanDrawers = Object.keys(Config.drawers || {}).filter(id => !_knownHeaderIds.has(id));
const _tocEntry = { id: 'toc', icon: '🌲', label: 'Contents', _orphan: false };
if (!sections.some(s => s.id === 'toc')) sections.push(_tocEntry);
const _pathwayEntry = { id: 'pathway', icon: '🧭', label: 'Pathways', _orphan: false };
if (!sections.some(s => s.id === 'pathway') && Config.drawers && Config.drawers.pathway) sections.push(_pathwayEntry);
orphanDrawers.forEach(id => {
if (id === 'toc') return;
const _m = _ORPHAN_META[id] || { icon: '•', label: id };
sections.push({ id, icon: _m.icon, label: _m.label, _orphan: true });
});
sections.sort((a, b) => (a._orphan ? 1 : 0) - (b._orphan ? 1 : 0));
if (!sections.length) {
const msg = document.createElement('div');
msg.className = 'drawer__empty';
msg.textContent = 'All sections are visible in the header.';
wrap.appendChild(msg);
} else {
sections.forEach(h => {
const row = document.createElement('div');
row.style.cssText = 'display:flex;align-items:center;gap:6px';
const b = document.createElement('button');
b.type = 'button';
b.className = 'drawer__item';
b.style.flex = '1';
b.innerHTML = `<span class="d-icon" aria-hidden="true">${escapeHtml(h.icon || '')}</span><span class="d-text">${escapeHtml(h.label || h.id)}</span><span class="d-meta">${h._orphan ? 'menu only' : 'hidden'}</span>`;
b.addEventListener('click', () => { Modal.dismiss(); if (Config.drawers[h.id]) DrawerController.open(h.id); });
row.appendChild(b);
if (!h._orphan) {
const showBtn = document.createElement('button');
showBtn.type = 'button';
showBtn.className = 'drawer__btn is-primary';
showBtn.style.cssText = 'padding:4px 10px;font-size:12px';
showBtn.textContent = 'Show';
showBtn.addEventListener('click', () => {
const _raw2 = Prefs.get('hiddenHeaderIds');
const arr = (Array.isArray(_raw2) ? _raw2 : []).filter(x => typeof x === 'string' && x !== h.id);
Prefs.set('hiddenHeaderIds', arr);
HeaderRenderer.render();
DrawerController.refresh();
Modal.dismiss();
Toast.show((h.label || h.id) + ' shown');
});
row.appendChild(showBtn);
}
wrap.appendChild(row);
});
}
Modal.open({ title: 'All sections', body: wrap, actions: [{ label: 'Close', value: null }] });
});

document.getElementById('helpBtn')?.addEventListener('click', () => DrawerController.open('help'));
document.getElementById('drawerBackdrop')?.addEventListener('click', () => DrawerController.close(false, false));
document.getElementById('upCancel')?.addEventListener('click', () => { try { FileUploader.cancel(); } catch (e) { console.warn('[boot] cancel upload', e); } });
document.getElementById('libraryFab')?.addEventListener('click', () => { try { ContentView.showLibrary(); } catch (e) { console.warn('[boot] library fab', e); } });
try { if (window.Cwtch && window.Cwtch.Settings && window.Cwtch.Settings.flushExpandedWrite) window.Cwtch.Settings.flushExpandedWrite(); } catch (e) { console.warn('[boot] flush settings', e); }

function libSig(items) {
const arr = items || [];
let h = arr.length | 0;
for (let i = 0; i < arr.length; i++) {
const it = arr[i];
if (!it) { h = ((h << 5) - h + 0x1f) | 0; continue; }
const s = String(it.id || '') + '\u001f' + String(it.lastModified || 0) + '\u001f' + (it.starred ? 1 : 0) + '\u001f' + ((Array.isArray(it.tags) ? it.tags.length : 0)) + '\u001f' + ((it.content || '').length) + '\u001f' + ((it.title || '').length) + '\u001f' + ((Array.isArray(it.tags) ? it.tags.join('\u001e') : ''));
for (let j = 0; j < s.length; j++) h = ((h << 5) - h + s.charCodeAt(j)) | 0;
h = ((h << 5) - h + 0x1e) | 0;
h = ((h << 5) - h + 0x1d) | 0;
}
return String(h >>> 0) + ':' + arr.length;
}
let _reloadInProgress = false;
async function reloadLibrary() {
if (_reloadInProgress) return;
_reloadInProgress = true;
try {
let items = await Store.list();
if (!Array.isArray(items)) items = [];
items = items.filter(it => it && typeof it === 'object' && typeof it.id === 'string' && it.id.length > 0 && it.id.length < 200);
const _order = Prefs.get('libraryOrder');
if (Array.isArray(_order) && _order.length) {
const _rank = new Map(_order.map((id, i) => [id, i]));
items = items.slice().sort((a, b) => {
const ra = (a && typeof a.id === 'string' && _rank.has(a.id)) ? _rank.get(a.id) : Infinity;
const rb = (b && typeof b.id === 'string' && _rank.has(b.id)) ? _rank.get(b.id) : Infinity;
if (ra === Infinity && rb === Infinity) return 0;
return ra - rb;
});
}
if (libSig(State.get('libraryItems')) === libSig(items)) return;
State.set('libraryItems', items);
} catch (e) { console.warn('[library] reload failed:', e); try { if (window.Cwtch && window.Cwtch.Toast && window.Cwtch.Toast.error) window.Cwtch.Toast.error('Library reload failed'); } catch {} }
finally { _reloadInProgress = false; }
}
let _reloadTimer = null;
function scheduleReload() { clearTimeout(_reloadTimer); _reloadTimer = setTimeout(() => { _reloadTimer = null; reloadLibrary().catch(e => console.warn('[library] reload', e)); }, 100); }
Bus.on(EVENTS.LIBRARY_CHANGED, scheduleReload);
  let refreshTimer = null;
  Bus.on(EVENTS.LIBRARY_ITEMS, () => {
    try { HeaderRenderer.render(); } catch (e) { console.warn('[boot] header render', e); }
    clearTimeout(refreshTimer);
refreshTimer = setTimeout(() => { try { DrawerController.refresh(); } catch (e) { console.warn('[boot] drawer refresh', e); } }, 150);
  });
  Bus.on(EVENTS.CURRENT_VIEW, ({ value }) => {
    try { Navigation.push({ view: value, id: State.get('activeTabId') || null }); }
    catch (e) { console.warn('[boot] navigation push', e); }
  });
if (!window._cwtchHashBound) {
window._cwtchHashBound = true;
let _hashRaf = 0;
window.addEventListener('hashchange', () => { if (_hashRaf) return; _hashRaf = requestAnimationFrame(() => { _hashRaf = 0; try { HeaderRenderer.render(); } catch (e) { console.warn('[header] hashchange', e); } }); });
}
})();