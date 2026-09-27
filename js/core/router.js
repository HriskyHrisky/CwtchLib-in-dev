
import { State } from './state.js';
import { Config } from './config.js';
import { EVENTS } from './events.js';
import { Navigation } from './navigation.js';
import { Telemetry } from './telemetry.js';
import { ContentView } from '../library/content-view.js';
import { HeaderRenderer } from '../ui/header.js';
import { DrawerController } from '../ui/drawer.js';
import { Editor } from '../editor/editor.js';
import { Tabs } from '../ui/tabs.js';
import { Modal } from '../ui/modal.js';

export const Router = (() => {
let installed = false;
let applying = false;
let _onPop = null, _onHash = null, _onDom = null;
let _lastApplyHash = '';
const _jumpStack = [];
const _JUMP_MAX = 20;
function _pushJump(hash) {
if (!hash || typeof hash !== 'string') return;
if (_jumpStack[_jumpStack.length - 1] === hash) return;
_jumpStack.push(hash);
while (_jumpStack.length > _JUMP_MAX) _jumpStack.shift();
}
function jumpBack() {
if (_jumpStack.length < 2) return false;
_jumpStack.pop();
const prev = _jumpStack[_jumpStack.length - 1];
if (prev) { try { history.replaceState(null, '', prev || location.pathname + location.search); _scheduleApply(); } catch (e) { console.warn('[Router] jumpBack', e); location.hash = prev; } return true; }
return false;
}
function _scheduleApply() {
const cur = location.hash;
if (cur === _lastApplyHash) return;
Promise.resolve(apply()).then(() => { _lastApplyHash = location.hash; _pushJump(location.hash); }).catch(e => { console.warn('[Router] apply failed', e); });
}
function install() {
if (installed) return;
installed = true;
_onPop = () => _scheduleApply();
_onHash = () => _scheduleApply();
_onDom = () => { try { _onDom = null; } catch {} _scheduleApply(); };
window.addEventListener('popstate', _onPop);
window.addEventListener('hashchange', _onHash);
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', _onDom, { once: true });
} else {
Promise.resolve(apply()).catch(e => console.warn('[Router] initial apply', e));
_lastApplyHash = location.hash;
}
}
let _queued = false;
let _queuedHash = null;
let _reentry = 0;
async function apply() {
if (applying) { _queued = true; _queuedHash = location.hash; return; }
if (_reentry > 15) { console.warn('[Router] reentry limit hit'); _queued = false; _reentry = 0; try { if (window.Cwtch && window.Cwtch.Toast && typeof window.Cwtch.Toast.error === 'function') window.Cwtch.Toast.error('Navigation stalled — try again'); } catch (e) { console.warn('[Router] stall toast', e); } return; }
applying = true; _reentry++;
try { await applyOnce(); }
catch (e) { console.warn('[Router]', e); }
finally {
applying = false; _reentry = 0;
if (_queued) { _queued = false; const _h = _queuedHash; _queuedHash = null; queueMicrotask(() => { apply().catch(e => console.warn('[Router]', e)); }); }
}
}
async function applyOnce() {
try {
const _rawHashEarly = location.hash.replace(/^#/, '');
const _curEditId = typeof Editor !== 'undefined' && Editor && typeof Editor.dirtyId === 'function' && typeof Editor.isDirty === 'function' && Editor.isDirty() ? Editor.dirtyId() : null;
if (_rawHashEarly.length > 2000) { console.warn('[Router] hash too long (early)'); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { console.warn('[Router] replace too-long early', e); } _lastApplyHash = ''; return; }
const _isSameEditTarget = _curEditId && _rawHashEarly === 'edit-' + encodeURIComponent(_curEditId);
if (!_isSameEditTarget && typeof Editor !== 'undefined' && Editor && typeof Editor.isDirty === 'function' && Editor.isDirty()) {
let ok = false;
if (typeof Modal !== 'undefined' && Modal && typeof Modal.confirm === 'function') {
ok = await Modal.confirm('The editor has unsaved changes. Are you sure you want to leave?', { okLabel: 'Leave', danger: true });
} else {
ok = window.confirm('The editor has unsaved changes. Leave anyway?');
}
if (!ok) { const back = (typeof Editor.dirtyId === 'function') ? Editor.dirtyId() : null; if (back) { try { history.replaceState(null, '', '#edit-' + encodeURIComponent(back)); } catch (e) { console.warn('[Router] replace failed', e); } } return; }
try { if (Editor.flushPendingAutoSave) await Editor.flushPendingAutoSave(); } catch (e) { console.warn('[Router] flush pending', e); }
Editor.clearDirty();
} } catch (e) { console.warn('[Router] dirty check', e); }
const _items = Array.isArray(State.get('libraryItems')) ? State.get('libraryItems') : [];
const activeTabId = State.get('activeTabId');
const _ids = new Set();
for (const x of _items) { if (x && typeof x.id === 'string') _ids.add(x.id); }
const activeTabExists = activeTabId && _ids.has(activeTabId) && (State.get('openTabs') || []).includes(activeTabId);
if (_items.length > 100000) { console.warn('[Router] huge library, applying with reduced checks'); }
if (location.hash.length > 2000) { console.warn('[Router] hash too long', location.hash.length); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { console.warn('[Router] replace', e); } try { ContentView.showLibrary(); } catch (e2) { console.warn('[Router] showLibrary fallback', e2); } return; }
const _rawHash = location.hash.replace(/^#/, '').replace(/[\u2028\u2029]/g, '').slice(0, 2000);
const raw = _rawHash || (activeTabExists ? 'doc-' + activeTabId : 'library');
if (raw.startsWith('doc-') && raw.length > 4) {
let id; try { id = decodeURIComponent(raw.slice(4)); } catch (e) { console.warn('[Router] doc decode', e); id = raw.slice(4); }
if (typeof id !== 'string' || !id || id.length > 200 || id.indexOf('\u0000') >= 0) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { console.warn('[Router] replace', e); } if (typeof ContentView.showLibrary === 'function') ContentView.showLibrary(); return; }
const item = (State.get('libraryItems') || []).find(x => x && x.id === id);
if (item && typeof ContentView.showDocument === 'function') { try { Tabs.open(id); } catch (e) { console.warn('[Router] Tabs.open', e); } try { Navigation.push({ view: 'doc', id }); } catch (e) { console.warn('[Router] nav push', e); } ContentView.showDocument(item, true); try { const _h2 = '#doc-' + encodeURIComponent(id); if (location.hash !== _h2) history.replaceState(null, '', _h2); } catch (e) { console.warn('[Router] normalize hash', e); } return; }
try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { console.warn('[Router] replace', e); }
if (typeof ContentView.showLibrary === 'function') ContentView.showLibrary(); return;
}
if (raw.startsWith('edit-') && raw.length > 5) {
let id; try { id = decodeURIComponent(raw.slice(5)); } catch (e) { console.warn('[Router] edit decode', e); id = raw.slice(5); }
if (typeof id !== 'string' || !id || id.length > 200 || id.indexOf('\u0000') >= 0) { try { history.replaceState(null, '', location.pathname + location.search); } catch {} ContentView.showLibrary(); return; }
const item = (State.get('libraryItems') || []).find(x => x.id === id);
if (item && (item.kind === 'markdown' || item.kind === 'text' || item.kind === 'note')) { Editor.open(id); try { const _h3 = '#edit-' + encodeURIComponent(id); if (location.hash !== _h3) history.replaceState(null, '', _h3); } catch (e) { console.warn('[Router] normalize edit hash', e); } return; }
try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { console.warn('[Router] replace', e); }
ContentView.showLibrary(); return;
}
if (raw.startsWith('review-') && raw.length > 7) {
let id; try { id = decodeURIComponent(raw.slice(7)); } catch (e) { console.warn('[Router] review decode', e); id = raw.slice(7); }
if (typeof id !== 'string' || !id || id.length > 200 || id.indexOf('\u0000') >= 0) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { console.warn('[Router] replace', e); } ContentView.showLibrary(); return; }
const item = (State.get('libraryItems') || []).find(x => x.id === id && x.kind === 'card');
if (item && typeof ContentView.showReview === 'function') { ContentView.showReview(item); try { const _h4 = '#review-' + encodeURIComponent(id); if (location.hash !== _h4) history.replaceState(null, '', _h4); } catch (e) { console.warn('[Router] normalize review hash', e); } return; }
try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { console.warn('[Router] replace', e); }
ContentView.showLibrary(); return;
}
if (raw === 'search' || raw.startsWith('search=')) {
State.set('activeHeaderId', 'search');
if (HeaderRenderer.setActive) HeaderRenderer.setActive('search');
DrawerController.open('search');
if (raw.startsWith('search=')) {
let q = ''; try { q = decodeURIComponent(raw.slice(7)); } catch (e) { console.warn('[Router] search decode', e); q = raw.slice(7); }
q = String(q).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 500);
try { setTimeout(() => { const _inp = document.querySelector('#drawer-search .drawer__input'); if (_inp) { _inp.value = q; _inp.dispatchEvent(new Event('input', { bubbles: true })); _inp.focus(); } }, 80); } catch (e) { console.warn('[Router] search prefill', e); }
}
return;
}
if (raw === 'help') { State.set('activeHeaderId', 'help'); try { if (HeaderRenderer && HeaderRenderer.setActive) HeaderRenderer.setActive('help'); } catch (e) { console.warn('[Router] setActive', e); } try { DrawerController.open('help'); } catch (e) { console.warn('[Router] open help', e); } return; }
if (raw.startsWith('folder-')) { let f; try { f = decodeURIComponent(raw.slice(7)); } catch (e) { console.warn('[Router] folder decode', e); f = raw.slice(7); } if (typeof f !== 'string' || f.length > 500) f = ''; if (!f || typeof ContentView.showFolder !== 'function') { ContentView.showLibrary(); return; } ContentView.showFolder(f, true); return; }
if (raw.startsWith('search-')) {
let q; try { q = decodeURIComponent(raw.slice(7)); } catch (e) { console.warn('[Router] search decode', e); q = raw.slice(7); }
if (typeof q !== 'string') q = '';
q = q.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, '').slice(0, 500);
if (typeof ContentView.showSearchResults !== 'function') { ContentView.showLibrary(); return; }
const ql = q.toLowerCase();
const hits = (State.get('libraryItems') || []).filter(it =>
(it.title || '').toLowerCase().includes(ql) ||
(it.content || '').toLowerCase().includes(ql) ||
(it.path || '').toLowerCase().includes(ql));
ContentView.showSearchResults(hits, q);
return;
}
const item = (Config.headerAll || []).find(h => h && h.id === raw) || (Config.headerConditional || []).find(h => h && h.id === raw) || null;
if (item) {
State.set('activeHeaderId', raw);
if (HeaderRenderer && typeof HeaderRenderer.setActive === 'function') HeaderRenderer.setActive(raw);
if (raw === 'library' && typeof ContentView.showLibrary === 'function') ContentView.showLibrary();
if (Config && Config.drawers && Object.prototype.hasOwnProperty.call(Config.drawers, raw)) { try { DrawerController.open(raw); } catch (e) { console.warn('[Router] drawer open', e); } }
document.title = 'CwtchLib — ' + (item.label || item.id);
return;
}
if (Config && Config.drawers && Object.prototype.hasOwnProperty.call(Config.drawers, raw)) { State.set('activeHeaderId', raw); if (HeaderRenderer && typeof HeaderRenderer.setActive === 'function') HeaderRenderer.setActive(raw); try { DrawerController.open(raw); } catch (e) { console.warn('[Router] drawer open fallback', e); } document.title = 'CwtchLib — ' + String(raw).slice(0, 80); return; }
State.set('activeHeaderId', 'library');
if (typeof ContentView.showLibrary === 'function') ContentView.showLibrary();
document.title = 'CwtchLib';
}
const BINDINGS = [
{ icon: '⌘', label: 'Command palette', meta: 'Ctrl/Cmd+K' },
{ icon: '⌘', label: 'Command palette (alt)', meta: 'Ctrl/Cmd+Shift+P' },
{ icon: '↶', label: 'Undo', meta: 'Ctrl/Cmd+Z' },
{ icon: '↷', label: 'Redo', meta: 'Ctrl/Cmd+Shift+Z' },
{ icon: 'B', label: 'Bold (editor)', meta: 'Ctrl/Cmd+B' },
{ icon: 'I', label: 'Italic (editor)', meta: 'Ctrl/Cmd+I' },
{ icon: '💾', label: 'Save (editor)', meta: 'Ctrl/Cmd+S' },
{ icon: '⬇', label: 'Export current', meta: 'Ctrl/Cmd+Shift+E' },
{ icon: '⎋', label: 'Close drawer / palette', meta: 'Escape' },
{ icon: '/', label: 'Focus search', meta: '/' },
{ icon: '?', label: 'Show shortcuts', meta: '?' },
{ icon: 'J', label: 'Next item', meta: 'J' },
{ icon: 'K', label: 'Prev item', meta: 'K' },
{ icon: 'g', label: 'Go Library', meta: 'G then L' },
{ icon: 'g', label: 'Go Search', meta: 'G then S' },
{ icon: 'g', label: 'Go Note', meta: 'G then N' },
{ icon: 'g', label: 'Go Edit', meta: 'G then E' },
{ icon: 'g', label: 'Go Settings', meta: 'G then T' },
{ icon: 'g', label: 'Go Invert', meta: 'G then I' },
{ icon: 'g', label: 'Go Background', meta: 'G then D' },
{ icon: 'g', label: 'Go Canvas', meta: 'G then A' }
];
function uninstall() {
if (!installed) return;
if (_onPop) { try { window.removeEventListener('popstate', _onPop); } catch (e) { console.warn('[Router] unsub pop', e); } }
if (_onHash) { try { window.removeEventListener('hashchange', _onHash); } catch (e) { console.warn('[Router] unsub hash', e); } }
if (_onDom) { try { document.removeEventListener('DOMContentLoaded', _onDom); } catch (e) { console.warn('[Router] unsub dom', e); } }
_onPop = _onHash = _onDom = null;
_lastApplyHash = '';
_queued = false;
_queuedHash = null;
_jumpStack.length = 0;
installed = false;
}
return { install, uninstall, BINDINGS, jumpBack, getStack: () => _jumpStack.slice() };
})();

// ---- js/core/features.js ----

import { Prefs } from './prefs.js';
import { Bus } from './bus.js';

export const Features = (() => {
const _defs = Object.freeze({
ai: { default: false, dev: true, requires: [], description: 'AI assistant (Ollama or compatible HTTP endpoint).' },
collab: { default: false, dev: true, requires: [], description: 'Realtime collaboration over WebRTC.' },
vault: { default: false, dev: true, requires: ['crypto'], description: 'Encrypted vault using Argon2 + AES-GCM.' },
biometric: { default: false, dev: true, requires: ['webauthn'], description: 'Biometric unlock via WebAuthn.' },
telemetry: { default: false, dev: true, requires: [], description: 'Local-only usage counters.' },
sync: { default: false, dev: true, requires: [], description: 'Cross-device sync (unimplemented).' },
plugins: { default: false, dev: true, requires: [], description: 'Third-party plugins (unimplemented).' },
worker: { default: true, dev: true, requires: ['worker'], description: 'Offload search indexing to a Web Worker.' },
softDelete: { default: true, dev: true, requires: [], description: 'Move deleted items to trash before purging.' },
});

function _availability() {
return {
crypto: !!(typeof crypto !== 'undefined' && crypto.subtle),
webauthn: !!(typeof window !== 'undefined' && window.PublicKeyCredential && navigator.credentials && typeof navigator.credentials.get === 'function'),
worker: typeof Worker === 'function',
};
}

function _prefKey(name) { return 'feature.' + name; }

function isEnabled(name) {
if (!_defs[name]) return false;
if (_defs[name].dev) return false;
try {
const v = Prefs.get(_prefKey(name));
if (v === undefined || v === null) return _defs[name].default;
return v === true || v === 'true';
} catch (e) { console.warn('[features] read', name, e); return _defs[name].default; }
}

function setEnabled(name, on) {
if (!_defs[name]) { console.warn('[features] unknown', name); return false; }
if (on) {
const avail = _availability();
for (const r of _defs[name].requires) { if (!avail[r]) { console.warn('[features] cannot enable', name, ': missing', r); return false; } }
}
try { Prefs.set(_prefKey(name), !!on); } catch (e) { console.warn('[features] write', name, e); return false; }
try { Bus.emit('feature:changed', { name, enabled: !!on }); } catch (e) { console.warn('[features] emit', name, e); }
return true;
}

function list() {
return Object.keys(_defs).map(name => ({
name,
default: _defs[name].default,
dev: _defs[name].dev,
requires: _defs[name].requires.slice(),
description: _defs[name].description,
enabled: isEnabled(name),
available: _defs[name].requires.every(r => _availability()[r]),
}));
}

return { isEnabled, setEnabled, list, _defs, _availability };
})();

export const Permissions = (() => {
const _grants = new Map();

function _key(name) { return 'permission.' + name; }

function _load(name) {
if (_grants.has(name)) return _grants.get(name);
try {
const raw = Prefs.get(_key(name));
const rec = raw && typeof raw === 'object' ? raw : null;
_grants.set(name, rec);
return rec;
} catch (e) { console.warn('[permissions] load', name, e); return null; }
}

function isGranted(name) {
const rec = _load(name);
return !!(rec && rec.granted === true);
}

function grant(name, reason, disclosure) {
if (typeof name !== 'string' || !name || name.length > 80) return false;
if (isGranted(name)) return true;
const rec = { granted: true, at: Date.now(), reason: String(reason || '').slice(0, 200), disclosure: String(disclosure || '').slice(0, 2000) };
try { Prefs.set(_key(name), rec); } catch (e) { console.warn('[permissions] grant write', name, e); return false; }
_grants.set(name, rec);
try { Bus.emit('permission:granted', { name, rec }); } catch (e) { console.warn('[permissions] emit', e); }
return true;
}

function revoke(name) {
try { Prefs.remove(_key(name)); } catch (e) { console.warn('[permissions] revoke', name, e); }
_grants.delete(name);
try { Bus.emit('permission:revoked', { name }); } catch (e) { console.warn('[permissions] emit', e); }
}

function record(name) { return _load(name); }

return { isGranted, grant, revoke, record };
})();

// ---- js/library/library.js ----

import { Prefs } from '../core/prefs.js';
import { State } from '../core/state.js';
import { Store } from '../core/store.js';
import { Bus } from '../core/bus.js';
import { Features } from '../core/features.js';

export const Library = (() => {
let _installed = false;
let _journal = [];
const _JOURNAL_MAX = 200;
let _channel = null;
const _migrators = new Map();
const SCHEMA_VERSION = 2;

function _broadcast(payload) {
try {
if (!_channel && typeof BroadcastChannel === 'function') _channel = new BroadcastChannel('cwtch-library');
if (_channel) _channel.postMessage(payload);
} catch (e) { console.warn('[library] broadcast', e); }
}

function _journalPush(rec) {
_journal.push(rec);
while (_journal.length > _JOURNAL_MAX) _journal.shift();
}

function _itemKey(it) { return it && typeof it.id === 'string' ? it.id : null; }

function _detectConflict(existing, incoming) {
if (!existing || !incoming) return false;
const a = Number(existing.lastModified) || 0;
const b = Number(incoming.lastModified) || 0;
return b < a;
}

function registerMigrator(version, fn) {
if (!Number.isFinite(version) || typeof fn !== 'function') return;
_migrators.set(version, fn);
}

function _migrateItem(it) {
if (!it || typeof it !== 'object') return it;
const v = Number(it.schema) || 1;
if (v >= SCHEMA_VERSION) return it;
let cur = it;
const steps = Array.from(_migrators.entries()).sort((a, b) => a[0] - b[0]);
for (const [ver, fn] of steps) {
if (ver <= v) continue;
try { cur = fn(cur) || cur; } catch (e) { console.warn('[library] migrate', ver, e); }
}
cur.schema = SCHEMA_VERSION;
return cur;
}

async function mutate(op) {
if (!op || typeof op !== 'object') return { ok: false, error: 'invalid op' };
const type = String(op.type || '');
if (type !== 'put' && type !== 'remove' && type !== 'patch') return { ok: false, error: 'unknown op type' };
const items = State.get('libraryItems') || [];
const now = Date.now();

if (type === 'put') {
const item = op.item;
const id = _itemKey(item);
if (!id) return { ok: false, error: 'missing id' };
const existing = items.find(x => x && x.id === id);
if (existing && _detectConflict(existing, item) && !op.force) {
return { ok: false, error: 'stale-write', existing };
}
const next = _migrateItem(Object.assign({}, item, { schema: SCHEMA_VERSION }));
try { await Store.put(next); }
catch (e) { console.warn('[library] put failed', id, e); return { ok: false, error: String(e && e.message || e) }; }
const nextItems = existing ? items.map(x => x && x.id === id ? next : x) : [...items, next];
State.set('libraryItems', nextItems);
_journalPush({ op: 'put', id, at: now, previous: existing || null });
_broadcast({ op: 'put', id, at: now });
Bus.emit('library:changed');
return { ok: true, item: next };
}

if (type === 'patch') {
const id = String(op.id || '');
if (!id) return { ok: false, error: 'missing id' };
const existing = items.find(x => x && x.id === id);
if (!existing) return { ok: false, error: 'not-found' };
const patch = op.patch && typeof op.patch === 'object' ? op.patch : {};
const merged = _migrateItem(Object.assign({}, existing, patch, { lastModified: now, schema: SCHEMA_VERSION }));
try { await Store.put(merged); }
catch (e) { console.warn('[library] patch failed', id, e); return { ok: false, error: String(e && e.message || e) }; }
State.set('libraryItems', items.map(x => x && x.id === id ? merged : x));
_journalPush({ op: 'patch', id, at: now, previous: existing });
_broadcast({ op: 'patch', id, at: now });
Bus.emit('library:changed');
return { ok: true, item: merged };
}

if (type === 'remove') {
const id = String(op.id || '');
if (!id) return { ok: false, error: 'missing id' };
const existing = items.find(x => x && x.id === id);
if (!existing) return { ok: false, error: 'not-found' };
if (Features.isEnabled('softDelete') && !op.hard) {
try { await Store.putAsset('trash:' + id + ':' + now, new Blob([JSON.stringify(existing)])); } catch (e) { console.warn('[library] trash', e); }
}
try { await Store.remove(id); }
catch (e) { console.warn('[library] remove failed', id, e); return { ok: false, error: String(e && e.message || e) }; }
State.set('libraryItems', items.filter(x => !x || x.id !== id));
_journalPush({ op: 'remove', id, at: now, previous: existing });
_broadcast({ op: 'remove', id, at: now });
Bus.emit('library:changed');
return { ok: true };
}

return { ok: false, error: 'unreachable' };
}

async function restoreJournal(entry) {
if (!entry || (entry.op !== 'put' && entry.op !== 'patch')) return false;
if (!entry.previous) return false;
try { await Store.put(entry.previous); } catch (e) { console.warn('[library] restore', e); return false; }
const items = State.get('libraryItems') || [];
State.set('libraryItems', items.map(x => x && x.id === entry.id ? entry.previous : x));
Bus.emit('library:changed');
return true;
}

function install() {
if (_installed) return;
_installed = true;
try {
if (!_channel && typeof BroadcastChannel === 'function') {
_channel = new BroadcastChannel('cwtch-library');
_channel.onmessage = ev => {
const d = ev && ev.data;
if (!d || !d.op) return;
if (d.op === 'put' || d.op === 'patch' || d.op === 'remove') {
queueMicrotask(async () => {
try {
const items = await Store.list();
State.set('libraryItems', Array.isArray(items) ? items : []);
Bus.emit('library:changed');
} catch (e) { console.warn('[library] remote refresh', e); }
});
}
};
}
} catch (e) { console.warn('[library] channel init', e); }
}

function journal() { return _journal.slice(); }

return { mutate, install, journal, restoreJournal, registerMigrator, SCHEMA_VERSION };
})();

// ---- js/core/storage.js ----

import { Prefs } from './prefs.js';
import { Store } from './store.js';

export const Storage = (() => {
const _adapters = new Map();

function register(name, adapter) {
if (typeof name !== 'string' || !name) return false;
if (!adapter || typeof adapter !== 'object') return false;
_adapters.set(name, adapter);
return true;
}

function get(name) { return _adapters.get(name) || null; }

function estimate() {
try {
if (navigator.storage && typeof navigator.storage.estimate === 'function') return navigator.storage.estimate();
} catch (e) { console.warn('[storage] estimate', e); }
return Promise.resolve({ usage: 0, quota: 0 });
}

function install() {
register('idb', {
get: id => Store.get(id),
put: rec => Store.put(rec),
remove: id => Store.remove(id),
list: () => Store.list(),
getAsset: k => Store.getAsset(k),
putAsset: (k, b) => Store.putAsset(k, b),
removeAsset: k => Store.removeAsset(k),
listAssets: () => Store.listAssets(),
});
register('prefs', {
get: k => Prefs.get(k),
set: (k, v) => Prefs.set(k, v),
remove: k => Prefs.remove(k),
});
}

return { register, get, estimate, install, _adapters };
})();