
import { Prefs } from '../core/prefs.js';
import { State } from '../core/state.js';
import { Store } from '../core/store.js';
import { Bus } from '../core/bus.js';
import { Strings } from '../core/strings.js';
import { EVENTS } from '../core/events.js';
import { Toast } from '../ui/toast.js';
import { Announce } from '../ui/announce.js';

export const FileUploader = (() => {
const _DEFAULT_TYPES = {
md: ['md','markdown'],
txt: ['txt','html','htm','json','csv','yaml','yml','xml'],
img: ['png','jpg','jpeg','gif','webp','svg','bmp'],
audio: ['mp3','wav','ogg','m4a','flac','aac','opus','weba'],
canvas: ['drawio','excalidraw'],
apkg: ['apkg','colpkg'],
epub: ['epub'],
pdf: ['pdf']
};
let _typesVersion = -1;
let MD_EXT, TXT_EXT, IMG_EXT, AUDIO_EXT;
function _refreshTypes() {
let _userTypes = {};
try { _userTypes = Prefs.get('config.fileTypes') || {}; } catch (e) { console.warn('[upload] fileTypes pref', e); }
if (!_userTypes || typeof _userTypes !== 'object' || Array.isArray(_userTypes)) _userTypes = {};
const _v = _userTypes.version == null ? '__default__' : String(_userTypes.version).slice(0, 32);
if (MD_EXT && TXT_EXT && IMG_EXT && AUDIO_EXT && _typesVersion === _v) return;
const _arr = (a, d) => Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.length > 0 && x.length < 16).map(x => x.toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 50) : d;
MD_EXT = new Set(_arr(_userTypes.md, _DEFAULT_TYPES.md));
TXT_EXT = new Set(_arr(_userTypes.txt, _DEFAULT_TYPES.txt));
IMG_EXT = new Set(_arr(_userTypes.img, _DEFAULT_TYPES.img));
AUDIO_EXT = new Set(_arr(_userTypes.audio, _DEFAULT_TYPES.audio));
_typesVersion = _v;
}
_refreshTypes();
const dupWarned = new Set();
const SKIP = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', 'coverage', '.cache', '.parcel-cache', '__pycache__', '__MACOSX', 'venv', '.venv', 'target', '.idea', '.vscode', 'bower_components', '.DS_Store', 'Thumbs.db', 'desktop.ini', '.Trashes', '.fseventsd']);
const _importedThisRun = new Map();
let _importErrors = [];
let queue = [];
let processed = 0;
let total = 0;
let cancelled = false;
let dragDepth = 0;
let _hashCache = new Map();
const _HASH_CACHE_MAX = 2000;

function ext(name) {
if (name == null) return '';
const _n = String(name).slice(0, 500);
const _trimmed = _n.replace(/[.\s]+$/, '');
const _i = _trimmed.lastIndexOf('.');
if (_i < 0 || _i === _trimmed.length - 1 || _i === 0) return '';
const _out = _trimmed.slice(_i + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
return _out.length > 16 ? _out.slice(0, 16) : _out;
}
function kindOf(name) {
_refreshTypes();
const e = ext(name);
if (MD_EXT.has(e)) return 'markdown';
if (e === 'drawio' || e === 'excalidraw') return 'canvas';
if (IMG_EXT.has(e)) return 'image';
if (AUDIO_EXT.has(e)) return 'audio';
if (TXT_EXT.has(e)) return 'text';
return 'binary';
}
function iconOf(kind) {
return kind === 'markdown' ? '📝' : kind === 'text' ? '📄' : kind === 'image' ? '🖼️' : kind === 'audio' ? '🎵' : kind === 'canvas' ? '🎨' : '📦';
}
function uuid() {
try {
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') { try { return crypto.randomUUID(); } catch (e) { console.warn('[upload] randomUUID threw', e); } }
const _b = new Uint8Array(16);
let _filled = false;
if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
try { crypto.getRandomValues(_b); _filled = true; } catch (e) { console.warn('[upload] getRandomValues threw', e); }
}
if (!_filled) { for (let _i = 0; _i < 16; _i++) _b[_i] = Math.floor(Math.random() * 256); }
_b[6] = (_b[6] & 0x0f) | 0x40;
_b[8] = (_b[8] & 0x3f) | 0x80;
const _hex = Array.from(_b).map(x => x.toString(16).padStart(2, '0')).join('');
return _hex.slice(0, 8) + '-' + _hex.slice(8, 12) + '-' + _hex.slice(12, 16) + '-' + _hex.slice(16, 20) + '-' + _hex.slice(20);
} catch (e) { console.warn('[upload] uuid fallback', e); return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
}

let _warnedPath = false;
function installDropZone() {
const overlay = document.getElementById('dropOverlay');
if (!overlay) return;
if (typeof AbortController !== 'function') { console.warn('[upload] AbortController unavailable'); return; }
if (overlay._installed) return;
if (overlay._installAbort) { try { overlay._installAbort.abort(); } catch (e) { console.warn('[upload] abort old', e); } }
overlay._installed = true;
overlay._installAbort = new AbortController();
const hasFiles = e => { const dt = e.dataTransfer; if (!dt) return false; const t = dt.types; if (!t) return false; if (typeof t.includes === 'function') return t.includes('Files'); for (let i = 0; i < t.length; i++) { if (t[i] === 'Files') return true; } return false; };
overlay.setAttribute('aria-hidden', 'true');
const _sig = overlay._installAbort.signal;
document.addEventListener('dragenter', e => {
if (!hasFiles(e)) return;
e.preventDefault();
if (overlay._dropGuard) { clearTimeout(overlay._dropGuard); overlay._dropGuard = null; }
dragDepth = Math.min(dragDepth + 1, 100);
if (dragDepth > 0 && !overlay._dropGuard) {
overlay._dropGuard = setTimeout(() => { dragDepth = 0; overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); document.body.classList.remove('is-drag-over'); document.documentElement.classList.remove('is-drag-over'); overlay._dropGuard = null; }, 3000);
}
if (dragDepth === 1) {
overlay.hidden = false;
overlay.removeAttribute('aria-hidden');
            document.documentElement.classList.add('is-drag-over');
const ann = document.getElementById('dropAnnounce');
if (ann) { ann.textContent = ''; requestAnimationFrame(() => { ann.textContent = 'Drop files to import'; }); }
}
}, { signal: _sig });
document.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); try { if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; } catch (err) { console.warn('[upload] dropEffect', err); } }, { signal: _sig });
document.addEventListener('dragleave', e => { if (!hasFiles(e)) return; if (e.relatedTarget && overlay.contains && overlay.contains(e.relatedTarget)) return; dragDepth--; if (dragDepth <= 0) { dragDepth = 0; overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); document.documentElement.classList.remove('is-drag-over'); document.body.classList.remove('is-drag-over'); if (overlay._dropGuard) { clearTimeout(overlay._dropGuard); overlay._dropGuard = null; } } }, { signal: _sig });
document.addEventListener('drop', async e => {
if (!hasFiles(e)) return;
e.preventDefault();
dragDepth = 0; overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true');
            document.documentElement.classList.remove('is-drag-over');
if (overlay._dropGuard) { clearTimeout(overlay._dropGuard); overlay._dropGuard = null; }
try {
const items = e.dataTransfer && e.dataTransfer.items;
if (items && items.length && typeof items[0].webkitGetAsEntry === 'function') {
const entries = [];
for (const it of items) { try { const entry = it.webkitGetAsEntry(); if (entry) entries.push(entry); } catch (err) { console.warn('[upload] entry', err); } }
await ingestEntries(entries);
} else if (e.dataTransfer && e.dataTransfer.files) {
await ingestFiles(Array.from(e.dataTransfer.files).slice(0, 50000));
}
} catch (err) { console.warn('[upload] drop handler failed', err); try { if (typeof Toast !== 'undefined' && Toast.error) Toast.error('Import failed: ' + (err && err.message ? err.message : err)); } catch (e2) { console.warn('[upload] drop toast', e2); } }
});
}

async function pickFolder() {
if (window._folderPickInProgress) return;
const _pickFocus = document.activeElement;
if (typeof window.showDirectoryPicker !== 'function') { installFallbacks(); requestAnimationFrame(() => { try { document.getElementById('fallbackFolderInput')?.click(); } catch (e) { console.warn('[upload] fallback click', e); } finally { setTimeout(() => { try { if (_pickFocus && document.contains(_pickFocus) && typeof _pickFocus.focus === 'function') _pickFocus.focus({ preventScroll: true }); } catch (e) { console.warn('[upload] restore focus', e); } }, 200); } }); return; }
window._folderPickInProgress = true;
try {
const handle = await window.showDirectoryPicker({ mode: 'read' });
if (handle) await ingestDirectoryHandle(handle, '');
} catch (e) { if (e && e.name !== 'AbortError') { try { if (typeof Toast !== 'undefined') Toast.error('Import failed: ' + (e && e.message ? e.message : e)); } catch (e2) { console.warn('[upload] toast', e2); } } }
finally { window._folderPickInProgress = false; }
}
async function pickFiles() {
if (window._filePickInProgress) return;
const _pickFocus = document.activeElement;
if (typeof window.showOpenFilePicker !== 'function') { installFallbacks(); requestAnimationFrame(() => { try { document.getElementById('fallbackFileInput')?.click(); } catch (e) { console.warn('[upload] fallback click', e); } finally { setTimeout(() => { try { if (_pickFocus && document.contains(_pickFocus) && typeof _pickFocus.focus === 'function') _pickFocus.focus({ preventScroll: true }); } catch (e) { console.warn('[upload] restore focus', e); } }, 200); } }); return; }
window._filePickInProgress = true;
try {
const handles = await window.showOpenFilePicker({ multiple: true });
const files = await Promise.all(handles.map(h => h.getFile()));
await ingestFiles(files);
} catch (e) { if (e && e.name !== 'AbortError') { try { if (typeof Toast !== 'undefined') Toast.error('Import failed: ' + (e && e.message ? e.message : e)); } catch (e2) { console.warn('[upload] toast', e2); } } }
finally { window._filePickInProgress = false; }
}

function installFallbacks() {
if (!document.body) return;
const _existingFile = document.getElementById('fallbackFileInput');
const _existingDir = document.getElementById('fallbackFolderInput');
if (_existingFile && _existingDir) return;
if (_existingFile) { try { _existingFile.value = ''; _existingFile.remove(); } catch (e) { console.warn('[upload] remove existing file', e); } }
if (_existingDir) { try { _existingDir.value = ''; _existingDir.remove(); } catch (e) { console.warn('[upload] remove existing dir', e); } }
const fi = document.createElement('input');
fi.type = 'file'; fi.multiple = true; fi.hidden = true;
fi.id = 'fallbackFileInput';
fi.setAttribute('aria-hidden', 'true');
fi.setAttribute('tabindex', '-1');
fi.tabIndex = -1;
fi.addEventListener('change', async e => { try { await ingestFiles(Array.from(e.target.files || []).slice(0, 50000)); } finally { e.target.value = ''; fi.remove(); } });
document.body.appendChild(fi);
const di = document.createElement('input');
di.type = 'file'; di.multiple = true; di.hidden = true;
di.id = 'fallbackFolderInput';
di.setAttribute('aria-hidden', 'true');
di.setAttribute('tabindex', '-1');
di.tabIndex = -1;
di.setAttribute('webkitdirectory', '');
di.setAttribute('directory', '');
di.addEventListener('change', async e => {
const list = Array.from(e.target.files || []).slice(0, 50000).map(f => ({ file: f, path: f.webkitRelativePath || f.name }));
await ingestFilesWithPath(list);
e.target.value = '';
di.remove();
});
document.body.appendChild(di);
}

async function ingestDirectoryHandle(handle, basePath) {
if (!handle) return;
queue = []; processed = 0; total = 0; cancelled = false;
_importErrors = [];
dupWarned.clear(); _importedThisRun.clear();
try { await collectFromHandle(handle, basePath); }
catch (e) { console.warn('[upload] collectFromHandle failed', e); hideProgress(); return; }
if (!queue.length) { try { Toast.show('Folder is empty'); } catch (e) { console.warn('[upload] empty toast', e); } return; }
showProgress(); try { await runQueue(); } finally { hideProgress(); }
if (cancelled) return;
const _ok2 = queue.filter(x => x._saved).length;
try { Toast.success(`Imported ${_ok2} of ${processed} file${processed === 1 ? '' : 's'}${queue.length - _ok2 ? ` (${queue.length - _ok2} skipped)` : ''}`); } catch (e) { console.warn('[upload] toast', e); }
try { Announce.polite(`Imported ${_ok2} of ${processed} file${processed === 1 ? '' : 's'}`); } catch (e) { console.warn('[upload] announce', e); }
Bus.emit(EVENTS.LIBRARY_CHANGED || 'library:changed');
}
const _MAX_FILES = 50000;
const _MAX_DEPTH = 32;
async function collectFromHandle(handle, basePath, _depth) {
if (cancelled || !handle) return;
const _d = _depth || 0;
if (_d > _MAX_DEPTH) { console.warn('[upload] max depth reached', basePath); return; }
if (queue.length >= _MAX_FILES) { if (_importErrors.length < 200) _importErrors.push({ path: String(basePath || '').slice(0, 500), message: 'File cap reached' }); cancelled = true; return; }
if (handle.kind === 'file') { if (typeof handle.name !== 'string' || !handle.name) return; queue.push({ handle, path: basePath ? basePath + '/' + handle.name : handle.name }); total++; return; }
if (handle.kind === 'directory') {
if (handle.name && SKIP.has(String(handle.name).toLowerCase())) return;
try {
if (typeof handle.entries !== 'function') { console.warn('[upload] handle.entries unavailable'); return; }
for await (const [name, child] of handle.entries()) { if (cancelled) return; await collectFromHandle(child, basePath ? basePath + '/' + name : name, _d + 1); }
} catch (e) { console.warn('[upload] iterate dir failed', basePath, e); }
}
}
async function ingestEntries(entries) {
if (!Array.isArray(entries)) return;
if (window._cwtchUploadInProgress) { console.warn('[upload] another ingest in progress'); return; }
window._cwtchUploadInProgress = true;
try {
queue = []; processed = 0; total = 0; cancelled = false;
_importErrors = [];
dupWarned.clear(); _importedThisRun.clear();
for (const e of entries) { if (e) await collectFromEntry(e, ''); }
if (!queue.length) { Toast.show('No files found'); return; }
showProgress(); await runQueue(); hideProgress();
if (cancelled) return;
const _ok3 = queue.filter(x => x._saved).length;
Toast.success(`Imported ${_ok3} of ${processed} file${processed === 1 ? '' : 's'}${queue.length - _ok3 ? ` (${queue.length - _ok3} skipped)` : ''}`);
Announce.polite(`Imported ${_ok3} of ${processed} file${processed === 1 ? '' : 's'}`);
Bus.emit(EVENTS.LIBRARY_CHANGED || 'library:changed');
} finally { window._cwtchUploadInProgress = false; }
}
async function collectFromEntry(entry, basePath, _depth) {
if (cancelled || !entry) return;
const _d = _depth || 0;
if (_d > _MAX_DEPTH) { console.warn('[upload] depth limit reached', basePath); return; }
if (queue.length >= _MAX_FILES) { cancelled = true; return; }
if (entry.isFile) { if (typeof entry.name !== 'string' || !entry.name || entry.name.length > 200) return; queue.push({ entry, path: basePath ? basePath + '/' + entry.name : entry.name }); total++; return; }
if (entry.isDirectory) {
if (typeof entry.name !== 'string' || !entry.name) return;
if (SKIP.has(entry.name.toLowerCase())) return;
const reader = entry.createReader();
let _readerGuard = 0;
while (_readerGuard++ < 5000) {
const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
if (cancelled) return;
if (!batch || !batch.length) break;
for (const c of batch) {
if (cancelled) return;
await collectFromEntry(c, basePath ? basePath + '/' + entry.name : entry.name, _d + 1);
}
}
}
}
const _decodeCache = new Map();
function _decodeHtmlEntities(s) {
let _inp = String(s == null ? '' : s);
        if (_inp.length > 500000) {
            console.warn('[Uploader] HTML entity decode truncated');
            _inp = _inp.slice(0, 500000);
        }
if (_decodeCache.has(_inp)) return _decodeCache.get(_inp);
if (_inp.indexOf('\u0000') >= 0) return _inp;
const _out = _inp
.replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { const n = parseInt(h, 16); if (!Number.isFinite(n) || n < 0 || n > 0x10FFFF) return ''; return String.fromCodePoint(n); } catch { return ''; } })
.replace(/&#(\d+);/g, (_, d) => { try { const n = parseInt(d, 10); if (!Number.isFinite(n) || n < 0 || n > 0x10FFFF) return ''; return String.fromCodePoint(n); } catch { return ''; } })
.replace(/&nbsp;/g, ' ')
.replace(/&lt;/g, '<')
.replace(/&gt;/g, '>')
.replace(/&amp;/g, '\u0000AMP\u0000')
.replace(/&quot;/g, '"')
.replace(/&#39;/g, "'")
.replace(/\u0000AMP\u0000/g, '&');
if (_decodeCache.size >= 5000) { const _drop = Math.max(1, Math.floor(_decodeCache.size / 10)); let _i = 0; for (const _k of _decodeCache.keys()) { if (_i++ >= _drop) break; _decodeCache.delete(_k); } }
_decodeCache.set(_inp, _out);
return _out;
}
async function ingestAnkiApkg(file) {
if (!file) return { imported: 0, skipped: 0 };
if (typeof window.fflate === 'undefined') { try { Toast.error('Anki import requires fflate'); } catch (e) { console.warn('[anki] toast', e); } return { imported: 0, skipped: 0 }; }
const _MAX_ANKI_BYTES = 200 * 1024 * 1024;
if (file.size > 200 * 1024 * 1024) { try { Toast.error('Anki file too large (>200MB)'); } catch (e) { console.warn('[anki] toast', e); } return { imported: 0, skipped: 0 }; }
if (typeof ReviewEngine === 'undefined' || typeof ReviewEngine.createCard !== 'function') { try { Toast.error('Review engine unavailable'); } catch (e) { console.warn('[anki] toast', e); } return { imported: 0, skipped: 0 }; }
showProgress();
let imported = 0, skipped = 0;
try {
const _MAX_ANKI = 500;
let buf;
try { buf = new Uint8Array(await file.arrayBuffer()); }
catch (e) { Toast.error('Failed to read Anki file'); return { imported: 0, skipped: 0 }; }
let files;
try { files = fflate.unzipSync(buf); } catch (e) { Toast.error('Invalid .apkg: ' + e.message); return { imported: 0, skipped: 0 }; }
const _csvEntries = Object.keys(files).filter(k => /(?:^|\/)(?:notes|cards|collection)\.(?:csv|txt)$/i.test(k)).slice(0, 500);
if (!_csvEntries.length) {
const _anki2 = Object.keys(files).filter(k => /\.anki2$/i.test(k)).slice(0, 5);
try { Toast.error('No CSV/text entries found in .apkg' + (_anki2.length ? ' (modern .anki2 SQLite not supported — export as CSV from Anki)' : '')); } catch (e) { console.warn('[anki] toast', e); }
return { imported: 0, skipped: 0 };
}
for (const key of _csvEntries) {
if (imported >= _MAX_ANKI) break;
try {
const text = fflate.strFromU8(files[key]);
const lines = text.split('\n');
for (const line of lines) {
if (imported >= _MAX_ANKI) break;
if (!line.trim()) continue;
const parts = line.split('\t');
if (parts.length < 2) { skipped++; continue; }
const front = _decodeHtmlEntities(parts[0].replace(/<[^>]+>/g, '')).replace(/\\t/g, '\t').trim();
const back = _decodeHtmlEntities(parts[1].replace(/<[^>]+>/g, '')).replace(/\\t/g, '\t').trim();
if (!front) { skipped++; continue; }
if (/\{\{c\d+::/.test(front)) { const _c = await ReviewEngine.createClozeCard(front, back); if (_c) imported++; else skipped++; continue; }
const _c2 = await ReviewEngine.createCard(front, back);
if (_c2) imported++; else skipped++;
}
} catch (e) { console.warn('[anki] parse failed', key, e); }
}
Toast.success('Anki: imported ' + imported + ', skipped ' + skipped);
return { imported, skipped };
} finally { hideProgress(); }
}
async function ingestFiles(files) {
if (!Array.isArray(files)) return;
if (files.length > _MAX_FILES) { console.warn('[upload] file cap reached, truncating'); files = files.slice(0, _MAX_FILES); }
const _seenAnki = new Set();
const _anki = files.filter(f => { if (!f || !/\.(apkg|colpkg)$/i.test(f.name || '')) return false; const _k = String(f.name || '') + ':' + (f.size || 0); if (_seenAnki.has(_k)) return false; _seenAnki.add(_k); return true; });
if (_anki.length) {
for (const f of _anki) { try { await ingestAnkiApkg(f); } catch (e) { console.warn('[anki]', e); if (_importErrors.length < 200) _importErrors.push({ path: String(f && f.name || '').slice(0, 200), message: 'Anki import failed: ' + (e && e.message ? e.message : String(e)) }); } }
}
const _rest = files.filter(f => f && typeof f === 'object' && !/\.(apkg|colpkg)$/i.test(f.name || ''));
if (!_rest.length) { Bus.emit('library:changed'); return; }
await ingestFilesWithPath(_rest.map(f => ({ file: f, path: f.name || 'file' })));
}
async function ingestFilesWithPath(list) {
if (!Array.isArray(list)) return;
const _MAX_BYTES_INGEST = 1024 * 1024 * 1024;
queue = list.slice(0, _MAX_FILES).map(({ file, path }) => {
if (!file) return null;
if (typeof file.size === 'number' && file.size > _MAX_BYTES_INGEST) { console.warn('[upload] file too large', path); return null; }
const _clean = normalizePath(path);
const _fallback = normalizePath(file.name || 'file') || 'file';
const _final = (_clean && !_clean.startsWith('..') && !_clean.split('/').includes('..')) ? _clean : _fallback;
return { file, path: _final.slice(0, 1024) };
}).filter(Boolean);
processed = 0; total = queue.length; cancelled = false;
_importErrors = [];
dupWarned.clear(); _importedThisRun.clear();
if (!total) return;
showProgress(); try { await runQueue(); } finally { hideProgress(); }
if (cancelled) return;
const _ok = queue.filter(x => x._saved).length;
Toast.success(`Imported ${_ok} of ${processed} file${processed === 1 ? '' : 's'}${queue.length - _ok ? ` (${queue.length - _ok} skipped)` : ''}`);
if (_importErrors.length) console.warn('[upload] errors:', _importErrors);
Announce.polite(`Imported ${_ok} of ${processed} file${processed === 1 ? '' : 's'}`);
Bus.emit('library:changed');
}
async function runQueue() {
for (let _i = 0; _i < queue.length; _i++) {
if (cancelled) { queue.length = 0; return; }
const item = queue[_i];
try { await processEntry(item); }
catch (e) {
console.warn('[upload] entry failed', item && item.path, e);
if (_importErrors.length < 200) _importErrors.push({ path: (item && item.path) || '?', message: (e && e.message) ? String(e.message).slice(0, 500) : String(e).slice(0, 500) });
}
}
queue.length = 0;
}
async function processEntry(item) {
if (cancelled || !item) return;
try {
const file = item.file || await fileFromEntry(item.entry);
if (!file) { processed++; try { updateProgress(item.path); } catch (e) { console.warn('[upload] updateProgress', e); } return; }
if (file.size > 1024 * 1024 * 1024) { console.warn('[upload] file too large', item.path); try { Toast.error('File too large (max 1GB): ' + String(item.path || '').slice(0, 120)); } catch (e) { console.warn('[upload] toast', e); } processed++; return; }
if (item.cancelled) return;
const ok = await saveFileEntry(file, item.path);
if (ok) item._saved = true;
} catch (e) {
console.warn('[upload] failed:', item && item.path, e);
if (!Array.isArray(_importErrors)) _importErrors = [];
if (_importErrors.length < 200) _importErrors.push({ path: (item && item.path) || '?', message: (e && e.message ? String(e.message).slice(0, 500) : String(e).slice(0, 500)) });
}
processed++;
try { updateProgress(item.path); } catch (e) { console.warn('[upload] updateProgress outer', e); }
}
function fileFromEntry(entry) { return new Promise((res, rej) => entry.file(res, rej)); }
const _MAX_HASH_BYTES = 20 * 1024 * 1024;
async function contentHashOf(file) {
if (!file || typeof file.arrayBuffer !== 'function') return null;
if (file.size == null || file.size === 0) return null;
try {
if (typeof crypto === 'undefined' || !crypto.subtle) { console.warn('[upload] crypto.subtle unavailable; dedup disabled'); return null; }
if (file && file.size > _MAX_HASH_BYTES) { if (!contentHashOf._largeWarned) contentHashOf._largeWarned = new Set(); const _nmL = String(file.name || '').slice(0, 200); if (!contentHashOf._largeWarned.has(_nmL)) { contentHashOf._largeWarned.add(_nmL); console.info('[upload] file too large for hashing; dedup skipped:', _nmL); } return null; }
if ((file.lastModified || 0) === 0) { if (!contentHashOf._warned) contentHashOf._warned = new Set(); const _nm = String(file.name || '').slice(0, 200); if (!contentHashOf._warned.has(_nm)) { contentHashOf._warned.add(_nm); console.info('[upload] file has no lastModified, skipping hash cache'); } }
const _ck = String(file.name || '').slice(0, 200) + '|' + (file.size || 0) + '|' + (file.lastModified || 0);
if (_hashCache.has(_ck)) { const _v = _hashCache.get(_ck); _hashCache.delete(_ck); _hashCache.set(_ck, _v); return _v; }
const _bufForHash = await file.arrayBuffer();
const h = await crypto.subtle.digest('SHA-256', _bufForHash);
const hex = Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
if (_hashCache.size >= _HASH_CACHE_MAX) { const _drop = Math.max(1, Math.floor(_hashCache.size / 10)); let _i = 0; for (const _k of _hashCache.keys()) { if (_i++ >= _drop) break; _hashCache.delete(_k); } }
_hashCache.set(_ck, hex);
return hex;
} catch (e) { console.warn('[upload] hash failed', e); return null; }
}
function normalizePath(p) {
if (!p) return '';
if (typeof p !== 'string') p = String(p);
if (p.length > 4096) p = p.slice(0, 4096);
let _s = p.replace(/\\/g, '/');
_s = _s.replace(/^\\\\\?\\/, '').replace(/^\/\/\?\//, '');
_s = _s.replace(/^[A-Za-z]:[\\/]?/, '');
_s = _s.replace(/^\/+/, '');
const parts = _s.split('/');
const out = [];
let _truncatedSeg = false;
let _droppedSeg = 0;
for (const s of parts) {
if (!s || s === '.') continue;
if (s === '..') { if (out.length) out.pop(); else _droppedSeg++; continue; }
if (s.length > 200) { _truncatedSeg = true; out.push(String(s).slice(0, 200)); if (out.length > 64) break; continue; }
if (/[\u0000-\u001f\u007f\u2028\u2029]/.test(s)) { _droppedSeg++; continue; }
if (/[<>:"|?*]/.test(s)) { _droppedSeg++; continue; }
const _baseNoExt = s.split('.')[0].toUpperCase();
if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(_baseNoExt)) s = '_' + s;
if (s === '__proto__' || s === 'constructor' || s === 'prototype') { _droppedSeg++; continue; }
out.push(s);
if (out.length > 64) break;
}
if ((_truncatedSeg || _droppedSeg) && !_warnedPath) { _warnedPath = true; console.warn('[upload] normalizePath dropped', _droppedSeg, 'segments,', _truncatedSeg ? 'truncated 1+' : ''); }
return out.join('/').slice(0, 1024).replace(/^\/+/, '');
}
let _skipToastLast = 0;
let _skipToastCount = 0;
const _SKIP_TOAST_INTERVAL = 2500;
async function saveFileEntry(file, path, kindHint) {
if (!file) return false;
const kind = kindHint || kindOf(file.name);
if (kind === 'binary') {
_skipToastCount++;
const _now = Date.now();
if (_now - _skipToastLast > _SKIP_TOAST_INTERVAL) { _skipToastLast = _now; try { Toast.show('Skipped unsupported: ' + String(path || '').slice(0, 120) + (_skipToastCount > 1 ? ' (+' + (_skipToastCount - 1) + ' more)' : '')); } catch (e) { console.warn('[upload] skip toast', e); } _skipToastCount = 0; }
return false;
}
const _MAX_TEXT = 128 * 1024 * 1024;
if ((kind === 'markdown' || kind === 'text') && file.size > _MAX_TEXT) { console.warn('[upload] text too large', file.size); try { Toast.error('File too large: ' + String(path || '').slice(0, 120)); } catch (e) { console.warn('[upload] toast', e); } return false; }
const contentHash = await contentHashOf(file);
const _runKeyPre = (contentHash || '') + '|' + normalizePath(path);
if (contentHash && _importedThisRun.has(_runKeyPre)) return false;
let content = '';
let assetKey = null;
if (kind === 'markdown' || kind === 'text') {
const _buf = await file.arrayBuffer();
if (_buf.byteLength > _MAX_TEXT) { console.warn('[upload] buffer too large'); return false; }
let _decoded = false;
const _bom = new Uint8Array(_buf, 0, Math.min(2, _buf.byteLength));
const _isUTF16 = (_buf.byteLength >= 2) && ((_bom[0] === 0xFF && _bom[1] === 0xFE) || (_bom[0] === 0xFE && _bom[1] === 0xFF));
try { content = new TextDecoder(_isUTF16 ? 'utf-16le' : 'utf-8', { fatal: true }).decode(_buf); _decoded = true; } catch (e) { console.warn('[upload] strict decode failed', e); }
if (_decoded && content.length && content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
if (!_decoded) {
try { content = new TextDecoder('utf-8').decode(_buf); } catch (e) { console.warn('[upload] utf-8 failed', e); content = ''; }
if (content.indexOf('\uFFFD') >= 0) { try { content = new TextDecoder('windows-1252').decode(_buf); } catch (e) { console.warn('[upload] 1252 failed', e); } }
}
if (contentHash) {
_importedThisRun.set(_runKeyPre, { id: null });
if (_importedThisRun.size > 50000) { const _it = _importedThisRun.keys(); let _n = 0; for (const _k of _it) { if (_n++ >= 10000) break; _importedThisRun.delete(_k); } }
}
} else {
const h = contentHash;
if (h && dupWarned.has('bin:' + h)) { return false; }
let dup = null;
if (h) {
try { dup = (State.get('libraryItems') || []).find(x => x && x.contentHash === h && x.kind === kind); } catch (e) { console.warn('[upload] dup scan', e); }
}
if (dup && !dupWarned.has('bin:' + h)) { dupWarned.add('bin:' + h); Toast.show('Skipped duplicate: ' + path); return false; }
assetKey = 'asset-' + uuid();
try { await Store.putAsset(assetKey, file); } catch (e) { console.warn('[upload] putAsset failed', e); return false; }
}
let title = String(file.name || '').replace(/\.[^.]+$/, '') || file.name || 'untitled';
if (kind === 'markdown') { try { const m = content.slice(0, 100000).replace(/```[\s\S]*?```/g, '').match(/^#\s+(.+)$/m); if (m && m[1]) title = m[1].trim().slice(0, 300); } catch (e) { console.warn('[upload] title extract', e); } }
if (!title) title = 'untitled';
const all = State.get('libraryItems') || [];
let existing = null;
const _np = normalizePath(path);
const _runKey = (contentHash || '') + '|' + _np;
if (contentHash && _importedThisRun.has(_runKey)) existing = _importedThisRun.get(_runKey);
if (!existing && contentHash) existing = all.find(it => it.contentHash === contentHash && normalizePath(it.path || '') === _np);
if (!existing && !contentHash && (kind === 'markdown' || kind === 'text')) existing = all.find(it => it.kind === kind && it.content === content && normalizePath(it.path || '') === _np);
if (existing) {
const key = contentHash || path;
if (!dupWarned.has(key)) { dupWarned.add(key); try { Toast.show('Skipped duplicate: ' + String(path || '').slice(0, 200)); } catch (e) { console.warn('[upload] dup toast', e); } }
if (dupWarned.size > 10000) dupWarned.clear();
return false;
}
let autoCat = false; try { autoCat = Prefs.get('setting.library.autoCategorize'); } catch (e) { console.warn('[upload] autoCat pref', e); }
const _cleanPath = normalizePath(path);
const _parts = _cleanPath.split('/').filter(Boolean);
const firstSeg = _parts.length > 1 ? _parts[0] : '';
const _safeTitle = String(title || '').replace(/[<>&"']/g, '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 300) || 'untitled';
const rec = {
id: uuid(), title: _safeTitle, icon: iconOf(kind), kind, path: String(_cleanPath).slice(0, 1024), size: file.size,
...(autoCat && firstSeg ? { category: String(firstSeg).slice(0, 100) } : { category: undefined }),
lastModified: Number(file.lastModified) || Date.now(), contentHash: contentHash || null, content, assetKey,
createdAt: Date.now(), tags: [], starred: false, mime: (typeof file.type === 'string' ? file.type.slice(0, 200) : '')
};
try { await Store.put(rec); }
catch (e) {
if (assetKey) { try { await Store.removeAsset(assetKey); } catch (e2) { console.warn('[upload] orphan asset cleanup', e2); } }
if (_importErrors.length < 200) _importErrors.push({ path, message: 'Store failed: ' + (e && e.message ? String(e.message).slice(0, 500) : String(e).slice(0, 500)) });
if (_importErrors.length === 200) console.warn('[upload] error list full, further errors suppressed');
if (contentHash && _importedThisRun.get(_runKeyPre) && _importedThisRun.get(_runKeyPre).id == null) _importedThisRun.delete(_runKeyPre);
return false;
}
if (contentHash) _importedThisRun.set(_runKeyPre, { id: rec.id });
State.set('libraryItems', [...(State.get('libraryItems') || []), rec]);
return true;
}


  let _upRaf2 = null, _upPending2 = null, _lastUpAnn2 = 0;
function showProgress() {
const el = document.getElementById('uploadProgress'); if (el) el.hidden = false;
try { document.body.classList.add('has-upload-progress'); } catch (e) { console.warn('[upload] progress class', e); }
updateProgress('');
}
function hideProgress() {
try {
const el = document.getElementById('uploadProgress'); if (el) el.hidden = true;
document.body.classList.remove('has-upload-progress');
const f = document.getElementById('upFill'); if (f) { f.style.width = '0%'; f.setAttribute('aria-valuenow', '0'); f.setAttribute('aria-valuetext', ''); }
const cur = document.getElementById('upCurrent'); if (cur) cur.textContent = (typeof Strings !== 'undefined' && typeof Strings.t === 'function') ? Strings.t('upload.preparing', 'Preparing…') : 'Preparing…';
const cnt = document.getElementById('upCount'); if (cnt) cnt.textContent = '0 / 0';
if (_upRaf2) { try { cancelAnimationFrame(_upRaf2); } catch (e) { console.warn('[upload] cancelRaf', e); } _upRaf2 = null; }
_upPending2 = null;
processed = 0; total = 0;
} catch (e) { console.warn('[upload] hideProgress', e); }
}
function updateProgress(currentPath) {
_upPending2 = currentPath;
if (_upRaf2) return;
_upRaf2 = requestAnimationFrame(() => {
_upRaf2 = null;
const fill = document.getElementById('upFill');
const cur = document.getElementById('upCurrent');
const cnt = document.getElementById('upCount');
const pct = total ? Math.round(processed / total * 100) : 0;
if (fill) { fill.style.width = pct + '%'; fill.setAttribute('aria-valuenow', String(pct)); fill.setAttribute('aria-valuetext', pct + '%'); }
if (cur && _upPending2) cur.textContent = String(_upPending2).slice(0, 200);
if (cnt) cnt.textContent = processed + ' / ' + total;
});
}
function cancel() { cancelled = true; queue = []; try { hideProgress(); } catch (e) { console.warn('[upload] hideProgress', e); } }
function _resetHashCache() { _hashCache.clear(); _decodeCache.clear(); dupWarned.clear(); _importedThisRun.clear(); }

return { bind: installDropZone, pickFolder, pickFiles, cancel, _resetHashCache, _resetTypes: _refreshTypes };
})();

// js/library/content-view.js (separate file)
const scrollMem = new Map();
let _searchHighlightTerm = '';
const _sizeCache = new Map();
const _normalizedSet = new WeakSet();
function _normalizeItem(it) {
if (!it || typeof it !== 'object') return it;
if (typeof it.id !== 'string' || !it.id || it.id.length > 200) return it;
if (_normalizedSet.has(it)) return it;
_normalizedSet.add(it);
if (typeof it.title !== 'string') it.title = it.title == null ? 'Untitled' : String(it.title).slice(0, 300);
if (it.title.length > 300) it.title = it.title.slice(0, 300);
if (typeof it.title !== 'string' || !it.title) it.title = 'Untitled';
if (typeof it.kind !== 'string' || !it.kind) it.kind = 'text';
if (typeof it.path !== 'string') it.path = '';
if (typeof it.icon !== 'string' || !it.icon) {
const _k = it.kind;
it.icon = _k === 'markdown' ? '📝' : _k === 'text' ? '📄' : _k === 'image' ? '🖼️' : _k === 'audio' ? '🎵' : _k === 'canvas' ? '🎨' : _k === 'card' ? '🎴' : '📦';
}
if (typeof it.size !== 'number' || !Number.isFinite(it.size) || it.size < 0) {
it.size = (it.kind === 'markdown' || it.kind === 'note' || it.kind === 'card') ? (typeof it.content === 'string' ? it.content.length * 2 : 0) : 0;
}
if (typeof it.starred !== 'boolean') it.starred = !!it.starred;
if (!Array.isArray(it.tags)) it.tags = [];
if (!Number.isFinite(it.createdAt)) it.createdAt = Date.now();
if (!Number.isFinite(it.lastModified)) it.lastModified = it.createdAt;
return it;
}
function showProgress() {
const el = document.getElementById('uploadProgress'); if (el) el.hidden = false;
try { document.body.classList.add('has-upload-progress'); } catch (e) { console.warn('[upload] progress class', e); }
updateProgress('');
}
function hideProgress() {
try {
const el = document.getElementById('uploadProgress'); if (el) el.hidden = true;
document.body.classList.remove('has-upload-progress');
const f = document.getElementById('upFill'); if (f) { f.style.width = '0%'; f.setAttribute('aria-valuenow', '0'); f.setAttribute('aria-valuetext', ''); }
const cur = document.getElementById('upCurrent'); if (cur) cur.textContent = (typeof Strings !== 'undefined' && Strings.t) ? Strings.t('upload.preparing', 'Preparing…') : 'Preparing…';
const cnt = document.getElementById('upCount'); if (cnt) cnt.textContent = '0 / 0';
if (_upRaf) { cancelAnimationFrame(_upRaf); _upRaf = null; }
_upPending = null;
} catch (e) { console.warn('[upload] hideProgress', e); }
}
let _lastUpAnn = 0;
let _upRaf = null, _upPending = null;
function updateProgress(currentPath) {
_upPending = currentPath;
if (_upRaf) return;
_upRaf = requestAnimationFrame(() => {
_upRaf = null;
const fill = document.getElementById('upFill');
const cur = document.getElementById('upCurrent');
const cnt = document.getElementById('upCount');
const pct = total ? Math.round(processed / total * 100) : 0;
if (fill) { fill.style.width = pct + '%'; fill.setAttribute('aria-valuenow', String(pct)); fill.setAttribute('aria-valuetext', pct + ' percent, ' + processed + ' of ' + total + ' files'); }
if (cur && _upPending) {
cur.textContent = String(_upPending).slice(0, 200);
const _now = Date.now();
if (_now - _lastUpAnn > 4000) { _lastUpAnn = _now; try { Announce.polite(String(_upPending).slice(0, 200)); } catch (e) { console.warn('[upload] announce', e); } }
}
if (cnt) cnt.textContent = processed + ' / ' + total;
});
}
function cancel() { cancelled = true; queue = []; try { if (window._cwtchUploadAbort && typeof window._cwtchUploadAbort.abort === 'function') window._cwtchUploadAbort.abort(); } catch (e) { console.warn('[upload] abort cancel', e); } try { hideProgress(); } catch (e) { console.warn('[upload] hideProgress', e); } }