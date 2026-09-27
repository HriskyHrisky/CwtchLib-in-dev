
import { State } from '../core/state.js';
import { Store } from '../core/store.js';
import { Toast } from '../ui/toast.js';
import { Announce } from '../ui/announce.js';

export const PathwayIO = (() => {
const _WIN_RESERVED = new Set([
'CON','PRN','AUX','NUL',
'COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9',
'LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9'
]);
function _safeName(s, fallback) {
const _MAX_BYTES = 200;
let cleaned = String(s == null ? '' : s)
.replace(/[\u0000-\u001f\u007f-\u009f\\/:*?"<>|\u2028\u2029]+/g, '_')
.replace(/[\u2028\u2029\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
.replace(/^\.+/, '')
.replace(/\.+$/, '')
.replace(/\s+/g, ' ')
.trim();
let _bytesLen = 0;
try { _bytesLen = new TextEncoder().encode(cleaned).length; } catch (e) { console.warn('[pathway] byteLen', e); _bytesLen = cleaned.length; }
while (_bytesLen > _MAX_BYTES && cleaned.length > 1) {
cleaned = cleaned.slice(0, -1);
try { _bytesLen = new TextEncoder().encode(cleaned).length; } catch (e) { console.warn('[pathway] byteLen loop', e); _bytesLen = cleaned.length; }
}
if (!cleaned) cleaned = fallback || 'item';
let _baseName = cleaned.split('.')[0] || cleaned;
if (_WIN_RESERVED.has(_baseName.toUpperCase())) cleaned = '_' + cleaned;
else if (_WIN_RESERVED.has(cleaned.toUpperCase())) cleaned = '_' + cleaned;
try {
let _bl = new TextEncoder().encode(cleaned).length;
while (_bl > _MAX_BYTES && cleaned.length > 1) { cleaned = cleaned.slice(0, -1); _bl = new TextEncoder().encode(cleaned).length; }
} catch (e) { console.warn('[pathway] byteLen recheck', e); }
return cleaned || (fallback || 'item');
}

const _YAML_RESERVED = /^(null|~|true|false|yes|no|on|off|y|n)$/i;
function _yamlString(v) {
const s = String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').replace(/[\u2028\u2029]/g, ' ').slice(0, 5000);
if (s === '') return '""';
if (/^[A-Za-z0-9_\-./]+$/.test(s) && !s.startsWith(':') && !/ #/.test(s) && !/^#/.test(s) && !_YAML_RESERVED.test(s) && !s.includes('\u0000')) return s;
return '"' + s
.replace(/\\/g, '\\\\')
.replace(/"/g, '\\"')
.replace(/\n/g, '\\n')
.replace(/\r/g, '\\r')
.replace(/\t/g, '\\t')
.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '') + '"';
}
function _extOf(it) {
if (!it || typeof it !== 'object') return '.md';
if (it.kind === 'image') return _extFromMime(it.mime || it.mimeType) || '.png';
if (it.kind === 'audio') return _extFromMime(it.mime || it.mimeType) || '.mp3';
if (it.kind === 'canvas') return '.svg';
if (it.kind === 'card') return '.md';
if (it.kind === 'binary') {
const _t = String(it.mime || it.mimeType || '').toLowerCase();
if (/pdf/.test(_t)) return '.pdf';
if (/epub/.test(_t)) return '.epub';
return '.bin';
}
return '.md';
}
function _extFromMime(m) {
if (!m || typeof m !== 'string') return '';
m = m.toLowerCase().slice(0, 200).split(';')[0].trim();
if (/^image\/svg\+xml$/.test(m)) return '.svg';
if (/png/.test(m)) return '.png';
if (/jpe?g/.test(m)) return '.jpg';
if (/gif/.test(m)) return '.gif';
if (/webp/.test(m)) return '.webp';
if (/svg/.test(m)) return '.svg';
if (/^audio\/mp4$|^audio\/m4a$/.test(m)) return '.m4a';
if (/mp3|mpeg/.test(m)) return '.mp3';
if (/wav/.test(m)) return '.wav';
if (/ogg/.test(m)) return '.ogg';
if (/m4a/.test(m)) return '.m4a';
if (/flac/.test(m)) return '.flac';
if (/aac/.test(m)) return '.aac';
if (/opus/.test(m)) return '.opus';
if (/json/.test(m)) return '.json';
if (/pdf/.test(m)) return '.pdf';
if (/epub/.test(m)) return '.epub';
if (/csv/.test(m)) return '.csv';
if (/plain|text/.test(m)) return '.txt';
if (/html/.test(m)) return '.html';
return '';
}
function _fnv1a(bytes) {
let h = 0x811c9dc5 >>> 0;
for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
const a = h.toString(16).padStart(8, '0');
h = Math.imul(h ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
const b = h.toString(16).padStart(8, '0');
return 'fnv1a-' + a + b;
}
async function _hashOf(buf) {
try {
if (!buf) { console.warn('[pathway] bad buffer'); return null; }
if (typeof crypto === 'undefined' || !crypto.subtle || typeof crypto.subtle.digest !== 'function') {
console.warn('[pathway] crypto.subtle missing, using FNV-1a fallback');
const _u8 = (buf instanceof ArrayBuffer) ? new Uint8Array(buf) : (ArrayBuffer.isView(buf) ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : null);
if (!_u8) return null;
return _fnv1a(_u8);
}
if (buf.byteLength > 200 * 1024 * 1024) { console.warn('[pathway] buffer too large to hash'); return null; }
const _view = (buf instanceof ArrayBuffer) ? new Uint8Array(buf) : (ArrayBuffer.isView(buf) ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : null);
if (!_view) { console.warn('[pathway] bad buffer'); return null; }
const h = await crypto.subtle.digest('SHA-256', _view);
return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
} catch (e) { console.warn('[pathway] hash failed', e); return null; }
}
async function writeMarkdown(dir, it) {
if (!it || typeof it !== 'object' || !dir) throw new Error('bad item');
const tags = Array.isArray(it.tags) ? it.tags.filter(t => typeof t === 'string' && t.length < 200 && t.length > 0).slice(0, 100) : [];
if (!Object.prototype.hasOwnProperty.call(writeMarkdown, '_usedNames') || writeMarkdown._usedNames.size > 5000) writeMarkdown._usedNames = new Set();
const _titleSafe = String(it.title == null ? 'Untitled' : it.title).replace(/^---$/gm, '—').replace(/[\u0000-\u001f]/g, '').slice(0, 300);
const _safeKind = String(it.kind || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 32);
const meta = '---\n' +
'title: ' + _yamlString(_titleSafe) + '\n' +
'kind: ' + _yamlString(it.kind || '') + '\n' +
'tags: [' + tags.map(t => _yamlString(String(t).replace(/[\u0000-\u001f\u007f]/g, ''))).join(', ') + ']\n' +
'path: ' + _yamlString(String(it.path || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 500)) + '\n' +
'createdAt: ' + (Number.isFinite(it.createdAt) ? it.createdAt : Date.now()) + '\n' +
'---\n\n';
let body = typeof it.content === 'string' ? it.content : '';
if (it.kind === 'card') {
try {
const d = JSON.parse(it.content);
const _f = String(d.front || '').replace(/^FRONT:\s*$/gm, 'FRONT\\:').replace(/^BACK:\s*$/gm, 'BACK\\:');
const _b = String(d.back || '').replace(/^FRONT:\s*$/gm, 'FRONT\\:').replace(/^BACK:\s*$/gm, 'BACK\\:');
body = 'FRONT:\n' + _f + '\n\nBACK:\n' + _b;
} catch {}
}
const bytes = new TextEncoder().encode(meta + body);
    const _baseName = _safeName(it.title || it.id, 'item');
    let name = _baseName + '.md';
    let _usedNames = writeMarkdown._usedNames;
    if (!_usedNames) { _usedNames = writeMarkdown._usedNames = new Set(); }
    if (_usedNames.size > 50000) { _usedNames = writeMarkdown._usedNames = new Set(); }
    let _attempt = 1;
    while (_attempt < 1000 && _usedNames.has(name)) { name = _baseName + '-' + (++_attempt) + '.md'; }
    if (_attempt >= 1000) name = _baseName + '-' + Date.now().toString(36) + '.md';
try {
let _exists = false;
try { await dir.getFileHandle(name); _exists = true; } catch { _exists = false; }
if (_exists) {
_attempt = 1;
do { name = _baseName + '-' + (++_attempt) + '.md'; try { await dir.getFileHandle(name); _exists = true; } catch { _exists = false; } } while (_exists && _attempt < 1000);
}
} catch (e) { console.warn('[pathway] name collision check', e); }
_usedNames.add(name);
const fh = await dir.getFileHandle(name, { create: true });
const w = await fh.createWritable();
try { await w.write(bytes); await w.close(); } catch (e) { try { await w.abort(); } catch (er) { console.warn('[pathway] abort', er); } throw e; }
return { name, sha256: await _hashOf(bytes), size: bytes.byteLength };
}
async function _writeBinary(dir, it) {
if (!it || !it.assetKey) throw new Error('no asset');
if (typeof Store.getAsset !== 'function') throw new Error('storage unavailable');
let blob;
try { blob = await Store.getAsset(it.assetKey); } catch (e) { throw new Error('asset read failed: ' + (e && e.message ? e.message : e)); }
if (!blob) throw new Error('asset missing');
if (typeof blob.size === 'number' && blob.size > 500 * 1024 * 1024) throw new Error('asset too large');
const _canvasExt = it.kind === 'canvas' ? (_extFromMime(blob.type) || null) : null;
const ext = _canvasExt || _extFromMime(blob.type) || (it.kind === 'canvas' ? '.svg' : _extOf(it));
const buf = new Uint8Array(await blob.arrayBuffer());
const name = _safeName(it.title || it.id, 'asset') + ext;
const fh = await dir.getFileHandle(name, { create: true });
const w = await fh.createWritable();
try { await w.write(buf); await w.close(); } catch (e) { try { await w.abort(); } catch (er) { console.warn('[pathway] abort', er); } throw e; }
return { name, sha256: await _hashOf(buf), size: buf.byteLength };
}
async function exportToDisk(mode) {
if (window._pathwayExportRunning) { try { Toast.show('Export already running'); } catch (e) { console.warn('[pathway] toast', e); } return { wrote: 0, skipped: 0 }; }
const _mode = (mode === 'kind' || mode === 'folder') ? mode : 'tag';
if (writeMarkdown) writeMarkdown._usedNames = new Set();
try {
if (typeof TextEncoder !== 'function') { try { Toast.error('This browser lacks TextEncoder'); } catch (e) { console.warn('[pathway] toast', e); } return { wrote: 0, skipped: 0 }; }
} catch (e) { console.warn('[pathway] TextEncoder check', e); }
if (!window.isSecureContext) { try { Toast.error('Export requires a secure context (HTTPS or localhost)'); } catch (e) { console.warn('[pathway] toast', e); } return { wrote: 0, skipped: 0 }; }
if (typeof window.showDirectoryPicker !== 'function') { try { Toast.error('File System Access API not supported in this browser. Use Export all instead.'); } catch (e) { console.warn('[pathway] toast', e); } return { wrote: 0, skipped: 0 }; }
if (navigator.userActivation && typeof navigator.userActivation.isActive === 'boolean' && !navigator.userActivation.isActive) { try { Toast.error('Export must be triggered by a user gesture'); } catch (e) { console.warn('[pathway] toast', e); } return { wrote: 0, skipped: 0 }; }
window._pathwayExportRunning = true;
let root = null;
try {
const _opts = { mode: 'readwrite' };
try { _opts.id = 'cwtch-pathway-export'; _opts.startIn = 'documents'; } catch (e) { console.warn('[pathway] opts', e); }
root = await window.showDirectoryPicker(_opts);
} catch (e) {
window._pathwayExportRunning = false;
if (e && e.name === 'AbortError') return { wrote: 0, skipped: 0 };
try { Toast.error('Folder picker failed: ' + (e && e.message ? e.message : e)); } catch (ee) { console.warn('[pathway] toast', ee); }
return { wrote: 0, skipped: 0 };
}
if (!root) { window._pathwayExportRunning = false; return { wrote: 0, skipped: 0 }; }
try { if (typeof root.queryPermission === 'function') { const _perm = await root.queryPermission({ mode: 'readwrite' }); if (_perm === 'denied') { window._pathwayExportRunning = false; try { Toast.error('Write permission was denied'); } catch {} return { wrote: 0, skipped: 0 }; } } } catch (e) { console.warn('[pathway] queryPermission', e); }
const items = State.get('libraryItems') || [];
if (!items.length) { window._pathwayExportRunning = false; Toast.show('Library is empty'); return { wrote: 0, skipped: 0 }; }
const _modeKeyOf = (it, m) => {
if (!it || typeof it !== 'object') return 'other';
if (m === 'kind') return (typeof it.kind === 'string' && it.kind) ? it.kind : 'other';
if (m === 'folder') return (typeof it.path === 'string') ? (it.path.split('/').slice(0, -1).join('/') || 'root') : 'root';
const _tags = Array.isArray(it.tags) ? it.tags.filter(t => typeof t === 'string' && t.length > 0 && t.length < 200).slice(0, 100) : [];
return _tags.length ? _tags.slice().sort().join('\u001f') : ((typeof it.kind === 'string' && it.kind) ? it.kind : 'other');
};
const groups = new Map();
items.forEach(it => {
const k = _modeKeyOf(it, _mode);
if (!groups.has(k)) groups.set(k, []);
groups.get(k).push(it);
});
let wrote = 0, skipped = 0, _done = 0;
const _total = items.length;
const manifest = { generatedAt: new Date().toISOString(), mode: _mode, folders: {}, files: {}, skippedItems: [] };
const _usedFolders = new Set();
const _progressHost = document.getElementById('uploadProgress');
const _prevProgressHidden = _progressHost ? _progressHost.hidden : null;
if (_progressHost) _progressHost.hidden = false;
document.body.classList.add('has-upload-progress');
const _upFill = document.getElementById('upFill');
const _upCur = document.getElementById('upCurrent');
const _upCnt = document.getElementById('upCount');
  const _upTick = (label) => {
    const pct = _total ? Math.round(_done / _total * 100) : 0;
    if (_upFill && _upFill.isConnected) { _upFill.style.width = pct + '%'; _upFill.setAttribute('aria-valuenow', String(pct)); _upFill.setAttribute('aria-valuetext', pct + '%'); }
    if (_upCur && _upCur.isConnected) _upCur.textContent = String(label || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200);
    if (_upCnt && _upCnt.isConnected) _upCnt.textContent = _done + ' / ' + _total;
    if (typeof Announce !== 'undefined' && Announce.polite && _total && (_done === _total || _done % 100 === 0)) {
      try { Announce.polite('Exported ' + _done + ' of ' + _total + ' files'); } catch (e) { console.warn('[pathway] announce', e); }
    }
  };
try {
for (const [folder, arr] of groups.entries()) {
let safeFolder = _safeName(folder, 'other');
if (_usedFolders.has(safeFolder)) {
let n = 2;
while (_usedFolders.has(safeFolder + '-' + n) && n < 1000) n++;
safeFolder = safeFolder + '-' + n;
}
_usedFolders.add(safeFolder);
let dir;
try { dir = await root.getDirectoryHandle(safeFolder, { create: true }); }
catch (e) { console.warn('[pathway] mkdir failed', safeFolder, e); continue; }
if (!dir) continue;
const names = [];
for (const it of arr) {
try {
if (!it || typeof it !== 'object') { skipped++; _done++; continue; }
let entry;
if (it.kind === 'image' || it.kind === 'audio' || it.kind === 'canvas') entry = await _writeBinary(dir, it);
else entry = await _writeMarkdown(dir, it);
names.push(entry.name);
manifest.files[safeFolder + '/' + entry.name] = { sha256: entry.sha256 || null, size: entry.size, wroteAt: new Date().toISOString() };
if (!entry.sha256) manifest.hasUnhashed = true;
wrote++;
} catch (e) { skipped++; if (manifest.skippedItems.length < 200) manifest.skippedItems.push({ id: it && it.id, reason: String(e && e.message || e).slice(0, 200) }); console.warn('[pathway] write failed', it && it.id, e); }
_done++;
try { _upTick((it && it.title) || (it && it.id) || ''); } catch (e) { console.warn('[pathway] tick', e); }
}
manifest.folders[safeFolder] = { count: arr.length, files: names };
}
} catch (e) { console.warn('[pathway] folder write batch failed', e); }
} finally {
if (_progressHost && _progressHost.isConnected) _progressHost.hidden = (_prevProgressHidden === true);
document.body.classList.remove('has-upload-progress');
if (_upFill && _upFill.isConnected) { _upFill.style.width = '0%'; _upFill.setAttribute('aria-valuenow', '0'); }
try {
const mfh = await root.getFileHandle('_pathway-manifest.json', { create: true });
const mw = await mfh.createWritable();
try { await mw.write(JSON.stringify(manifest, null, 2)); await mw.close(); } catch (e2) { try { await mw.abort(); } catch {} throw e2; }
} catch (e) { console.warn('[pathway] manifest failed', e); }
Toast.success('Wrote ' + wrote + ' file' + (wrote === 1 ? '' : 's') + (skipped ? ' (' + skipped + ' skipped)' : ''));
} finally {
window._pathwayExportRunning = false;
}
return { wrote, skipped };
}
return { exportToDisk };
})();

export const Config = {
callouts: {
NOTE: { icon: '📝' },
TIP: { icon: '💡' },
WARNING: { icon: '⚠️' },
IMPORTANT: { icon: '❗' },
DANGER: { icon: '🚫' },
INFO: { icon: 'ℹ️' }
},
tags: ['definition','example','proof','insight','question','review','subjectivism','noise'],
headerCatalog: [
{ id: 'library', icon: '📚', label: 'Files',placement: 'header', action: 'view', handler: 'library' },
{ id: 'search',icon: '🔎', label: 'Search', placement: 'header', action: 'popper', handler: 'search' },
{ id: 'note',icon: '📝', label: 'Note', placement: 'header', action: 'mode', handler: 'note' },
{ id: 'edit',icon: '✏️', label: 'Edit', placement: 'header', action: 'mode', handler: 'edit', children: [
{ id: 'status',icon: '💾', label: 'Save status',action: 'popper', handler: 'saveStatus' }
] },
{ id: 'tts', icon: '🔊', label: 'Read aloud', placement: 'header', action: 'toggle', handler: 'tts' },
{ id: 'theme', icon: '🌓', label: 'Theme',placement: 'header', action: 'action', handler: 'theme' },
{ id: 'settings',icon: '⚙️', label: 'Settings', placement: 'header', action: 'popper', handler: 'settings' },
{ id: 'headerGridBtn', icon: '☰',label: 'All sections', placement: 'header', action: 'popper', handler: 'headerGrid' }
],
headerConditional: [
{ id: 'annotate-menu', icon: '✍️', label: 'Annotate', action: 'popper', handler: 'annotate', visibleWhen: 'view === "edit"',priority: 20 },
{ id: 'collab',icon: '👥', label: 'Collab', action: 'drawer', handler: 'collab', visibleWhen: 'collabEnabled === true', priority: 30 },
{ id: 'ai',icon: '🧠', label: 'AI', action: 'drawer', handler: 'ai', visibleWhen: 'aiEnabled === true', priority: 40 }
],
levelHints: { 1: 'surface', 50: 'mid', 99: 'noise / extra / filter' },
_headerCache: null,
_headerCacheKey: null,
  _defaultHeader: [
  { id: 'library',icon: '📚', label: 'Library'},
  { id: 'search', icon: '🔍', label: 'Search' },
  { id: 'note', icon: '📝', label: 'Note' },
  { id: 'edit', icon: '✏️', label: 'Edit' },
  { id: 'review', icon: '🎴', label: 'Review' },
  { id: 'tags', icon: '🏷️', label: 'Tags' },
  { id: 'settings', icon: '⚙️', label: 'Settings' }
  ],
  _drawerRefs: { FileUploader, DrawerController, Editor, ReviewEngine, HeaderRenderer, Theme, Background, Exporter, Settings, ContentView, NoteEngine, PathwayIO, Modal, Toast, State, Store, Bus, Strings, EVENTS },
get header() {
let _hRaw;
try { _hRaw = Prefs.get('hiddenHeaderIds'); } catch (e) { console.warn('[config] hiddenHeaderIds', e); _hRaw = null; }
const hidden = Array.isArray(_hRaw) ? _hRaw.filter(x => typeof x === 'string') : [];
let key;
try { key = JSON.stringify(hidden.slice().sort()); }
catch (e) { console.warn('[config] header key', e); key = String(hidden.length); }
if (Config._headerCache && Config._headerCacheKey === key) return Config._headerCache.value.slice();
const _def = Array.isArray(this._defaultHeader) ? this._defaultHeader : [];
const value = _def.filter(h => h && h.id && !hidden.includes(h.id));
Config._headerCache = { key, value: value.map(v => Object.assign({}, v)) };
Config._headerCacheKey = key;
return Config._headerCache.value.slice();
},
get headerAll() {
const seen = new Set();
const out = [];
const _def = Array.isArray(this._defaultHeader) ? this._defaultHeader : [];
const _cat = Array.isArray(this.headerCatalog) ? this.headerCatalog : [];
const _con = Array.isArray(this.headerConditional) ? this.headerConditional : [];
_def.concat(_cat, _con).forEach(h => {
if (h && typeof h === 'object' && typeof h.id === 'string' && h.id && !seen.has(h.id)) { seen.add(h.id); out.push(h); }
});
return out;
},
get headerConditionalSafe() { return Array.isArray(this.headerConditional) ? this.headerConditional.filter(h => h && typeof h === 'object' && typeof h.id === 'string' && h.id).slice() : []; },
drawers: {
library: {
title: 'Library',
sections: [
{ type: 'grid', items: () => [
{ icon: '📁', label: 'Import folder', onClick: () => FileUploader.pickFolder() },
{ icon: '📄', label: 'Import files',onClick: () => FileUploader.pickFiles() },
{ icon: '📝', label: 'New note',onClick: () => DrawerController.open('note') },
{ icon: '🆕', label: 'New markdown',onClick: async () => {
try {
const raw = await Modal.prompt('New Markdown file name (e.g. notes.md, chapter-1.md, reading-list.md)', { okLabel: 'Create' });
if (!raw) return;
const name = /\.[a-z0-9]+$/i.test(raw) ? raw : raw + '.md';
const title = name.replace(/\.[^.]+$/, '');
const rec = {
id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'md-' + Date.now().toString(36),
title, icon: '📝', kind: 'markdown', path: '',
size: 0, lastModified: Date.now(), createdAt: Date.now(),
content: '# ' + title + '\n\n', tags: [], starred: false,
level: Number(Prefs.get('setting.defaultLevel')) || 0
};
await Store.put(rec);
State.set('libraryItems', [...(State.get('libraryItems') || []), rec]);
Bus.emit('library:changed');
ContentView.showDocument(rec);
} catch (e) { console.warn('[library] new markdown failed', e); try { if (typeof Toast !== 'undefined' && Toast.error) Toast.error('Create failed: ' + (e && e.message ? e.message : e)); } catch {} }
} }
] },
{ label: 'Items', type: 'list', items: () => {
const all = State.get('libraryItems') || [];
const _psRaw = Prefs.get('setting.library.pageSize');
const PAGE = (_psRaw === 'none' || _psRaw === 'all' || _psRaw == null) ? 40 : (Number(_psRaw) || 40);
const _cap = Math.min(PAGE, all.length);
const shown = [];
for (let i = 0; i < _cap; i++) {
const it = all[i];
if (!it || typeof it !== 'object') continue;
shown.push({ icon: it.icon || '📄', label: it.title || 'Untitled', meta: it.kind || 'text', onClick: ((item) => () => ContentView.showDocument(item))(it) });
}
if (all.length > PAGE) {
const remaining = all.length - PAGE;
shown.push({ icon: '…', label: `Load all ${all.length} items (${remaining} more)`, meta: 'more', onClick: () => { Prefs.set('setting.library.pageSize', 'none'); DrawerController.refresh(); } });
}
return shown;
}, empty: { text: 'No items yet. Drop files or use the buttons above.' } }
]
},
pathway: {
title: 'Pathways',
sections: [
{ label: 'Split view', type: 'grid', items: () => [
{ icon: '🧭', label: 'Open pathways', primary: true, onClick: () => { DrawerController.close(true, true); ContentView.showPathway(); } },
{ icon: '🔄', label: 'Refresh split', onClick: () => { DrawerController.refresh(); if (State.get('currentView') === 'pathway') ContentView.showPathway(); } }
] },
{ label: 'Split by', type: 'grid', items: () => [
{ icon: '🏷️', label: 'By tag',onClick: () => { DrawerController.close(true, true); ContentView.showPathway('tag'); } },
{ icon: '📦', label: 'By kind', onClick: () => { DrawerController.close(true, true); ContentView.showPathway('kind'); } },
{ icon: '📁', label: 'By folder', onClick: () => { DrawerController.close(true, true); ContentView.showPathway('folder'); } }
] },
{ label: 'Pathway categories', type: 'list', items: () => {
const items = State.get('libraryItems') || [];
const counts = new Map();
items.forEach(it => {
if (!it || typeof it !== 'object') return;
const key = (Array.isArray(it.tags) && it.tags[0]) || it.kind || 'other';
counts.set(key, (counts.get(key) || 0) + 1);
});
return [...counts.entries()].map(([key, n]) => ({
icon: '📂', label: key + ' pathway', meta: String(n),
onClick: () => { DrawerController.close(true, true); ContentView.showPathway('tag', key); }
}));
}, empty: { text: 'No pathways yet. Import content first.' } }
]
},
overview: {
title: 'TOC',
sections: [
{ label: 'Markdown titles', type: 'list', items: () => State.get('libraryItems')
.filter(i => i.kind === 'markdown')
.map(i => ({ icon: '📝', label: i.title, meta: 'md', onClick: () => ContentView.showDocument(i) })),
empty: { text: 'No markdown files yet.' } }
]
},
search: {
title: 'Search',
sections: [
{ type: 'form', placeholder: 'Search documents, notes, cards…', onMount: (inp, results) => {
const drawerEl = inp.closest('.drawer');
if (drawerEl) {
drawerEl.setAttribute('aria-label', 'Search');
inp.addEventListener('focus', () => drawerEl.classList.add('drawer--expanded'));
inp.addEventListener('blur', () => {
if (!drawerEl) return;
setTimeout(() => { if (drawerEl && !drawerEl.contains(document.activeElement)) drawerEl.classList.remove('drawer--expanded'); }, 150);
});
}
let idx = [];
const _rebuild = () => {
idx = (State.get('libraryItems') || []).map(it => ({ id: it.id, item: it, hay: ((it.title || '') + ' ' + (it.content || '') + ' ' + (it.path || '')).toLowerCase().slice(0, 200000) }));
};
let _rebuildTimer = null;
const _scheduleRebuild = () => { clearTimeout(_rebuildTimer); _rebuildTimer = setTimeout(_rebuild, 300); };
_rebuild();
let _offLib = null;
try { _offLib = Bus.on('state:libraryItems', _scheduleRebuild); } catch (e) { console.warn('[search] bus on', e); }
DrawerController.setCleanup(() => { try { if (typeof _offLib === 'function') _offLib(); } catch (e) { console.warn('[search] off', e); } clearTimeout(_rebuildTimer); });
const run = () => {
const q = String(inp.value || '').trim().toLowerCase().slice(0, 200);
if (!q) { results.innerHTML = '<div class="drawer__empty">' + escapeHtml(Strings.t('search.enter', 'Enter a keyword')) + '</div>'; return; }
const hits = idx.filter(r => r && typeof r.hay === 'string' && r.hay.includes(q)).map(r => r.item).filter(Boolean).slice(0, 200);
if (!hits.length) { results.innerHTML = '<div class="drawer__empty">' + escapeHtml(Strings.t('search.none', 'No matches')) + '</div>'; return; }
results.innerHTML = hits.map(it =>
`<button class="drawer__item" type="button" data-id="${escapeHtml(it.id)}">
<span class="d-icon">${escapeHtml(it.icon || '')}</span>
<span class="d-text">${escapeHtml(it.title || '')}</span>
<span class="d-meta">${escapeHtml(it.kind || '')}</span>
</button>`
).join('');
results.querySelectorAll('.drawer__item').forEach(btn => {
btn.addEventListener('click', () => { const hit = hits.find(x => x.id === btn.dataset.id); if (hit) ContentView.showDocument(hit); });
});
};
let searchTimer = null;
inp.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(run, 120); });
const _focusTimer = setTimeout(() => { if (document.contains(inp)) inp.focus(); }, 60);
DrawerController.setCleanup(() => { clearTimeout(_focusTimer); clearTimeout(searchTimer); });
run();
} }
]
},
note: {
title: 'Note',
sections: [
{ type: 'form', placeholder: 'Write your thoughts… (Enter to save, Shift+Enter for new line)', onMount: (inp, results) => {
const render = () => {
const notes = (State.get('libraryItems') || []).filter(i => i.kind === 'note').slice(0, 20);
if (!notes.length) { results.innerHTML = '<div class="drawer__empty">No notes yet. Type above and press Enter to create one.</div>'; return; }
results.innerHTML = notes.map(n =>
`<button class="drawer__item" data-id="${escapeHtml(n.id)}">
<span class="d-icon">📝</span>
<span class="d-text">${escapeHtml(n.title)}</span>
<span class="d-meta">${new Date(n.createdAt).toLocaleDateString()}</span>
</button>`).join('');
results.querySelectorAll('.drawer__item').forEach(btn => {
btn.addEventListener('click', () => { const hit = notes.find(x => x.id === btn.dataset.id); if (hit) ContentView.showDocument(hit); });
});
};
let off = null;
try { off = Bus.on('state:libraryItems', render); } catch (e) { console.warn('[note] bus', e); }
DrawerController.setCleanup(() => { try { if (typeof off === 'function') off(); } catch (e) { console.warn('[note] off', e); } });
inp.addEventListener('keydown', async e => {
if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
e.preventDefault();
const v = inp.value;
if (!v.trim()) return;
inp.value = '';
const _created = await NoteEngine.create(v);
if (_created) render();
}
});
render();
} },
{ label: 'Recent notes', type: 'list', items: () => (State.get('libraryItems') || [])
.filter(i => i.kind === 'note').slice(0, 20)
.map(i => ({ icon: '📝', label: i.title, meta: 'note', onClick: () => ContentView.showDocument(i) })),
empty: { text: 'No notes yet.' } }
]
},
review: {
title: 'Review',
sections: [
{ label: 'Due now', type: 'list', items: () => {
let due = [];
let _getDueErr = false;
try { due = ReviewEngine.getDue() || []; } catch (e) { console.warn('[review] getDue', e); due = []; _getDueErr = true; }
if (_getDueErr) return [{ icon: '⚠️', label: 'Failed to load due cards', meta: 'error', onClick: () => { try { DrawerController.refresh(); } catch (e2) { console.warn('[review] refresh', e2); } } }];
if (!due.length) return [];
return due.slice(0, 10).map(card => {
let d = {};
try { d = JSON.parse(card.content) || {}; } catch { d = {}; }
const _front = (d && typeof d.front === 'string' && d.front) ? d.front : (card.title || 'Untitled');
return { icon: '🎴', label: _front.slice(0, 50), meta: 'due', onClick: () => { if (typeof ContentView.showReview === 'function') ContentView.showReview(card); } };
});
}, empty: { text: 'No cards due. Add cards below.' } },
{ type: 'form', placeholder: 'Front of card…', onMount: (inp, results) => {
results.innerHTML = '';
const wrap = document.createElement('div');
wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:8px';
const back = document.createElement('input');
back.type = 'text';
back.className = 'drawer__input';
back.placeholder = 'Back of card…';
const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'drawer__btn is-primary';
btn.setAttribute('aria-label', 'Add card');
btn.innerHTML = '<span class="d-icon" aria-hidden="true">＋</span><span class="d-label">Add card</span>';
btn.addEventListener('click', async () => {
const f = inp.value.trim(), b = back.value.trim();
if (!f) return;
await ReviewEngine.createCard(f, b);
inp.value = ''; back.value = '';
inp.focus();
});
wrap.appendChild(back); wrap.appendChild(btn);
results.appendChild(wrap);
} }
]
},
edit: {
title: 'Edit',
sections: [
{ label: 'Document', type: 'list', items: () => (State.get('libraryItems') || [])
.filter(i => i.kind === 'markdown' || i.kind === 'text' || i.kind === 'note').slice(0, 50)
.map(i => ({ icon: '✏️', label: i.title, meta: i.kind, onClick: () => Editor.open(i.id) })),
empty: { text: 'No editable documents. Import markdown/text files from the Library first.' } }
]
},
settings: {
title: 'Setting',
sections: [
{ label: 'Theme palette', type: 'grid', items: () => Object.entries(Theme.THEMES).map(([id, t]) => ({
icon: t.icon, label: t.label, onClick: () => { Theme.setTheme(id); DrawerController.refresh(); }
})) },
{ label: 'Theme mode', type: 'grid', items: () => [
{ icon: '🌙', label: 'Dark',onClick: () => Theme.setMode('dark') },
{ icon: '☀️', label: 'Light', onClick: () => Theme.setMode('light') },
{ icon: '🖥️', label: 'Auto',onClick: () => Theme.setMode('auto') }
] },
{ label: 'Theme seed', type: 'custom', render: el => {
const wrap = document.createElement('div');
wrap.className = 'tk-group';
const seed = Theme.getSeed();
const makeRow = (label, key, min, max, format) => {
const r = document.createElement('div');
r.className = 'tk-row';
const lab = document.createElement('span');
lab.className = 'tk-label';
lab.textContent = label;
r.appendChild(lab);
const inp = document.createElement('input');
inp.type = 'range';
inp.min = String(min); inp.max = String(max); inp.step = '1';
inp.value = String(seed[key]);
inp.setAttribute('aria-label', label);
const out = document.createElement('span');
out.className = 'settings-range__val';
out.textContent = format(seed[key]);
inp.addEventListener('input', () => { out.textContent = format(Number(inp.value)); });
inp.addEventListener('change', () => { Theme.setSeed({ [key]: Number(inp.value) }); out.textContent = format(Number(inp.value)); });
r.appendChild(inp);
r.appendChild(out);
return r;
};
wrap.appendChild(makeRow('Surface hue','hue', 0, 360, v => v + '°'));
wrap.appendChild(makeRow('Surface saturation', 'sat', 0, 100, v => v + '%'));
wrap.appendChild(makeRow('Surface lightness','light', 0, 100, v => v + '%'));
wrap.appendChild(makeRow('Accent hue', 'accentHue', 0, 360, v => v + '°'));
wrap.appendChild(makeRow('Accent saturation','accentSat', 0, 100, v => v + '%'));
wrap.appendChild(makeRow('Accent lightness', 'accentLight', 0, 100, v => v + '%'));
const cRow = document.createElement('div');
cRow.className = 'tk-row';
const cLab = document.createElement('span');
cLab.className = 'tk-label';
cLab.textContent = 'Contrast';
cRow.appendChild(cLab);
const cSeg = document.createElement('span');
cSeg.className = 'settings-seg';
cSeg.setAttribute('role', 'group');
cSeg.setAttribute('aria-label', 'Contrast');
['soft','normal','strict'].forEach(o => {
const b = document.createElement('button');
b.type = 'button'; b.textContent = o;
b.className = 'settings-seg__btn' + ((seed.contrast || 'normal') === o ? ' is-active' : '');
b.addEventListener('click', () => {
cSeg.querySelectorAll('.settings-seg__btn').forEach(x => x.classList.remove('is-active'));
b.classList.add('is-active');
Theme.setSeed({ contrast: o });
});
cSeg.appendChild(b);
});
cRow.appendChild(cSeg);
wrap.appendChild(cRow);
const actions = document.createElement('div');
actions.className = 'tk-actions';
const randBtn = document.createElement('button');
randBtn.type = 'button';
randBtn.className = 'demo-btn';
randBtn.textContent = '🎲 Random';
randBtn.addEventListener('click', () => { Theme.setSeed(Theme.randomSeed()); DrawerController.refresh(); });
actions.appendChild(randBtn);
const resetBtn = document.createElement('button');
resetBtn.type = 'button';
resetBtn.className = 'demo-btn';
resetBtn.textContent = 'Reset seed';
resetBtn.addEventListener('click', () => { Prefs.remove('theme.seed'); Theme.applyTheme(); DrawerController.refresh(); });
actions.appendChild(resetBtn);
wrap.appendChild(actions);
el.appendChild(wrap);
} },
{ type: 'custom', render: el => { const _h = Settings.renderInto(el); if (_h && typeof _h.destroy === 'function' && typeof DrawerController.setCleanup === 'function') { try { DrawerController.setCleanup(_h.destroy); } catch (e) { console.warn('[settings] register cleanup', e); } } } },
{ label: 'Header grid — what to show', type: 'grid', items: () => {
const hiddenRaw = Prefs.get('hiddenHeaderIds');
const hidden = Array.isArray(hiddenRaw) ? hiddenRaw : [];
return Config.headerAll.map(h => ({
icon: h.icon,
label: h.label,
primary: !hidden.includes(h.id),
onClick: () => {
const arr = (Array.isArray(hidden) ? hidden : []).slice();
const i = arr.indexOf(h.id);
if (i >= 0) arr.splice(i, 1); else arr.push(h.id);
Prefs.set('hiddenHeaderIds', arr);
HeaderRenderer.render();
DrawerController.refresh();
}
}));
} },
{ label: 'Diagnostics', type: 'grid', items: () => [
{ icon: '⛶', label: 'Toggle focus mode', onClick: () => { try { if (typeof Settings.toggleFocusMode === 'function') Settings.toggleFocusMode(); } catch (e) { console.warn('[settings] focus toggle', e); } } },
{ icon: '📦', label: 'Settings history', onClick: () => {
try {
const hist = Settings.getHistory();
if (!hist.length) { Toast.show('No settings history'); return; }
const blob = new Blob([JSON.stringify(hist, null, 2)], { type: 'application/json' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'settings-history-' + Date.now() + '.json';
document.body.appendChild(a); a.click(); a.remove();
setTimeout(() => URL.revokeObjectURL(a.href), 1000);
Toast.success('History exported (' + hist.length + ')');
} catch (e) { Toast.error('History export failed: ' + e.message); }
} },
{ icon: '💾', label: 'Storage estimate', onClick: async () => {
try {
if (!navigator.storage?.estimate) { Toast.show('Storage API unavailable'); return; }
const e = await navigator.storage.estimate();
const pct = e.quota ? Math.round((e.usage / e.quota) * 100) : 0;
Toast.show(`Used ${Math.round((e.usage||0)/1024/1024)}MB of ${Math.round((e.quota||0)/1024/1024)}MB (${pct}%)`);
} catch (e) { Toast.error('Estimate failed: ' + e.message); }
} },
{ icon: '🧹', label: 'Clear cache', onClick: async () => {
try {
if (!('caches' in window)) { try { Toast.show('Caches API unavailable'); } catch (e) { console.warn('[settings] toast', e); } return; }
const keys = await caches.keys();
await Promise.all(keys.map(k => caches.delete(k)));
try { Toast.success('Cache cleared (' + keys.length + ' store' + (keys.length === 1 ? '' : 's') + ')'); } catch (e) { console.warn('[settings] toast', e); }
} catch (e) { try { Toast.error('Clear cache failed: ' + e.message); } catch (e2) { console.warn('[settings] toast', e2); } }
} },
{ icon: '📋', label: 'Export report', onClick: () => {
try {
const _prefsAll = Prefs.all ? Prefs.all() : {};
const _redacted = {};
const _SENSITIVE = /(password|apikey|secret|token|key)/i;
Object.keys(_prefsAll).forEach(_k => { _redacted[_k] = _SENSITIVE.test(_k) ? '[redacted]' : _prefsAll[_k]; });
const report = { generatedAt: new Date().toISOString(), state: State.all(), prefs: _redacted, ua: navigator.userAgent, url: location.href };
const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'cwtch-report-' + Date.now() + '.json';
document.body.appendChild(a); a.click(); a.remove();
setTimeout(() => URL.revokeObjectURL(a.href), 1000);
Toast.success('Report exported');
} catch (e) { Toast.error('Report failed: ' + e.message); }
} },
{ icon: '↶', label: 'Undo last setting', onClick: () => { try { Settings.undoLast(); } catch (e) { console.warn('[settings] undoLast', e); } } },
{ icon: '📜', label: 'View mutation journal', onClick: () => {
try {
const lib = window.Cwtch && window.Cwtch.Library;
if (!lib || typeof lib.journal !== 'function') { Toast.show('Journal unavailable'); return; }
const entries = lib.journal();
if (!entries.length) { Toast.show('Journal is empty'); return; }
const wrap = document.createElement('div');
wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;max-height:60vh;overflow-y:auto;font-family:ui-monospace,monospace;font-size:11.5px';
entries.slice().reverse().forEach(en => {
const row = document.createElement('div');
row.style.cssText = 'padding:6px 8px;border:1px solid var(--border);border-radius:6px';
const _when = new Date(en.at).toLocaleString();
row.textContent = '[' + _when + '] ' + en.op + ' ' + (en.id || '').slice(0, 40);
wrap.appendChild(row);
});
Modal.open({ title: 'Mutation journal (' + entries.length + ')', body: wrap, actions: [{ label: 'Close', value: null }] });
} catch (e) { console.warn('[settings] journal', e); }
} },
{ icon: '♻️', label: 'Reset all settings', onClick: async () => {
let ok = false;
try { ok = await Modal.confirm('Reset every setting to its default?', { danger: true, okLabel: 'Reset all' }); } catch (e) { console.warn('[settings] confirm', e); return; }
if (!ok) return;
try { Settings.resetAll(); } catch (e) { console.warn('[settings] resetAll', e); }
try { Toast.success('All settings reset'); } catch (e) { console.warn('[settings] toast', e); }
} }
] },
{ label: 'Appearance tokens', type: 'custom', render: el => {
const wrap = document.createElement('div');
wrap.className = 'tk-group';
const current = Theme.currentThemeId ? Theme.currentThemeId() : (Prefs.get('themeId') || 'dark');
const theme = Theme.THEMES[current] || Theme.THEMES.dark;
const custom = Prefs.get('theme.vars.custom') || {};
const rows = Object.entries(theme.vars).filter(([, v]) => /^#|^rgba?\(/.test(String(v)));
rows.forEach(([k, v]) => {
const row = document.createElement('div');
row.className = 'tk-row' + (custom[k] ? ' is-customized' : '');
const label = document.createElement('span');
label.className = 'tk-label';
label.textContent = k;
row.appendChild(label);
const sw = document.createElement('input');
sw.type = 'color';
sw.className = 'tk-swatch';
sw.value = custom[k] || v;
sw.addEventListener('input', () => {
const map = Object.assign({}, Prefs.get('theme.vars.custom') || {});
map[k] = sw.value;
Prefs.set('theme.vars.custom', map);
document.documentElement.style.setProperty('--' + k, sw.value);
row.classList.add('is-customized');
});
row.appendChild(sw);
const reset = document.createElement('button');
reset.type = 'button';
reset.className = 'tk-reset';
reset.textContent = '↺';
reset.title = 'Reset token';
reset.addEventListener('click', () => {
const map = Object.assign({}, Prefs.get('theme.vars.custom') || {});
delete map[k];
Prefs.set('theme.vars.custom', map);
document.documentElement.style.setProperty('--' + k, v);
sw.value = v;
row.classList.remove('is-customized');
});
row.appendChild(reset);
wrap.appendChild(row);
});
const clear = document.createElement('button');
clear.type = 'button';
clear.className = 'demo-btn';
clear.textContent = 'Reset all tokens';
clear.style.marginTop = '8px';
clear.addEventListener('click', () => { Prefs.remove('theme.vars.custom'); Theme.applyTheme(); DrawerController.refresh(); });
wrap.appendChild(clear);
el.appendChild(wrap);
} },
{ label: 'Data', type: 'grid', items: () => [
{ icon: '⬇️', label: 'Export all', primary: true, onClick: () => { try { Exporter.exportAll(); } catch (e) { console.warn('[settings] export', e); } } },
{ icon: '⬆️', label: 'Import backup', onClick: () => { try { Exporter.importAll(); } catch (e) { console.warn('[settings] import', e); } } },
{ icon: '🧹', label: 'Clear library (keeps settings)', onClick: async () => {
let ok = false;
try { ok = await Modal.confirm('Delete all library items but keep your settings?', { danger: true, okLabel: 'Clear' }); } catch (e) { console.warn('[settings] confirm', e); return; }
if (!ok) return;
try { await Store.clearItems(); } catch (e) { console.warn('[settings] clearItems', e); }
State.set('libraryItems', []);
Bus.emit('library:changed');
try { Toast.success('Library cleared'); } catch (e) { console.warn('[settings] toast', e); }
} },
{ icon: '🗑', label: 'Reset all data (settings + library)', onClick: async () => {
const ok = await Modal.confirm('Delete all settings and library data? This cannot be undone.', { danger: true, okLabel: 'Reset all' });
if (!ok) return;
if (Prefs.clearAll) Prefs.clearAll();
else Object.keys(localStorage).filter(k => k.startsWith('cwtch.')).forEach(k => localStorage.removeItem(k));
await Store.clear();
location.reload();
} }
] }
]
},
tags: {
title: 'Tags',
sections: [
{ label: 'All tags', type: 'list', items: () => {
const all = State.get('libraryItems') || [];
const counts = new Map();
all.forEach(i => { if (!i || typeof i !== 'object') return; (Array.isArray(i.tags) ? i.tags : []).forEach(t => { if (typeof t === 'string' && t) counts.set(t, (counts.get(t) || 0) + 1); }); });
return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300).map(([tag, n]) => ({
icon: '🏷️', label: tag, meta: String(n),
onClick: () => {
const hits = (State.get('libraryItems') || []).filter(i => i && Array.isArray(i.tags) && i.tags.includes(tag));
ContentView.showSearchResults(hits, '#' + tag);
DrawerController.close(true, true);
}
}));
}, empty: { text: 'No tags yet.' } }
]
},
theme: {
title: 'Theme',
sections: [
{ label: 'Palette', type: 'grid', items: () => Object.entries(Theme.THEMES).map(([id, t]) => ({
icon: t.icon, label: t.label, onClick: () => { Theme.setTheme(id); DrawerController.refresh(); }
})) },
{ label: 'Mode', type: 'grid', items: () => [
{ icon: '🌙', label: 'Dark',onClick: () => Theme.setMode('dark') },
{ icon: '☀️', label: 'Light', onClick: () => Theme.setMode('light') },
{ icon: '🖥️', label: 'Auto',onClick: () => Theme.setMode('auto') }
] },
{ label: 'Accent', type: 'grid', items: () => Theme.ACCENTS.map(p => ({
icon: '🎨', label: p.label, onClick: () => Theme.setAccent(p.id)
})) },
{ label: 'Contrast', type: 'grid', items: () => [
{ icon: '◐', label: 'Normal contrast', onClick: () => { document.body.classList.remove('contrast-mode'); Prefs.set('setting.contrastMode', false); } },
{ icon: '◑', label: 'High contrast', onClick: () => { document.body.classList.add('contrast-mode'); Prefs.set('setting.contrastMode', true); } }
] },
{ label: 'Motion', type: 'grid', items: () => [
{ icon: '⏸', label: 'Reduce motion', onClick: () => { document.body.classList.add('reduce-motion'); Prefs.set('setting.reduceMotion', true); } },
{ icon: '▶', label: 'Full motion', onClick: () => { document.body.classList.remove('reduce-motion'); Prefs.set('setting.reduceMotion', false); } }
] }
]
},
invert: {
title: 'Invert',
sections: [
{ label: 'Display', type: 'grid', items: () => {
const onUI = document.body.classList.contains('invert-ui');
const onImg = Prefs.get('setting.invertImages');
return [
{ icon: '🌓', label: onUI ? 'Disable invert UI' : 'Enable invert UI', onClick: () => {
const v = !onUI;
document.body.classList.toggle('invert-ui', v);
Prefs.set('setting.invertUI', v);
DrawerController.refresh();
} },
{ icon: '🖼️', label: onImg ? 'Disable invert images' : 'Enable invert images', onClick: () => {
const v = !onImg;
Prefs.set('setting.invertImages', v);
document.body.classList.toggle('invert-images', v);
DrawerController.refresh();
} }
];
} }
]
},
background: {
title: 'Wallpaper',
sections: [
{ label: 'Background', type: 'grid', items: () => [
{ icon: '🖼️', label: 'Pick image', primary: true, onClick: () => Background.pickImage() },
{ icon: '🎬', label: 'Pick video', onClick: () => Background.pickVideo() },
{ icon: '🎨', label: 'Solid color', onClick: () => { Prefs.set('setting.bgType', 'color'); Background.setType('color'); } },
{ icon: '🚫', label: 'Clear', onClick: () => Background.clear() }
] }
]
},
export: {
title: 'Export',
sections: [
{ label: 'Export options', type: 'grid', items: () => [
{ icon: '⬇️', label: 'Export all (JSON)', primary: true, onClick: () => Exporter.exportAll() },
{ icon: '📤', label: 'Export current view', onClick: () => {
const main = document.getElementById('main');
if (!main) return;
const _style = '<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.6;color:#222}pre{background:#f4f5f7;padding:12px;border-radius:8px;overflow-x:auto}img{max-width:100%}button,select,input{display:none}</style>';
const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Export</title>' + _style + '</head><body>' + main.innerHTML + '</body></html>';
const blob = new Blob([html], { type: 'text/html' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'export-' + Date.now() + '.html';
document.body.appendChild(a); a.click(); a.remove();
setTimeout(() => URL.revokeObjectURL(a.href), 1000);
} }
] }
]
},
help: {
title: 'Help',
sections: [
{ label: 'Keyboard shortcuts', type: 'list', items: () => {
try {
const _R = (typeof Router !== 'undefined' && Router) || (typeof window !== 'undefined' && window.Cwtch && window.Cwtch.Router) || null;
const _B = (_R && Array.isArray(_R.BINDINGS)) ? _R.BINDINGS : [];
if (!_B.length) return [{ icon: '⌨️', label: 'Shortcut list unavailable', meta: 'offline', onClick: () => {} }];
const _seen = new Set();
return _B.filter(b => { if (!b || typeof b !== 'object') return false; const k = (b.icon || '') + '|' + (b.label || '') + '|' + (b.meta || ''); if (_seen.has(k)) return false; _seen.add(k); return true; })
.map(b => ({ icon: b.icon, label: b.label, meta: b.meta, onClick: () => {} }));
} catch (e) { console.warn('[help] bindings', e); return []; }
} }
]
}
}
};