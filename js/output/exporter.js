
import { Prefs } from '../core/prefs.js';
import { State } from '../core/state.js';
import { Store } from '../core/store.js';
import { Bus } from '../core/bus.js';
import { escapeHtml } from '../core/escape.js';
import { Markdown } from '../markdown/markdown.js';
import { Modal } from '../ui/modal.js';
import { Toast } from '../ui/toast.js';
import { Settings } from '../settings/settings.js';
import { Background } from '../theme/background.js';
import { HeaderRenderer } from '../ui/header.js';
import { DrawerController } from '../ui/drawer.js';

export const Exporter = (() => {
function download(filename, data, mime) {
const safeName = String(filename == null ? 'download' : filename).replace(/[\u0000-\u001f\u007f\\/:?"<>|*]+/g, '_').replace(/^\.+/, '').replace(/\.+$/, '').slice(0, 200) || 'download';
if (data == null || (typeof data === 'string' && data.length === 0) || (typeof data === 'object' && data.size === 0)) { console.warn('[export] empty download payload'); return; }
let blob;
try { blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/json' }); }
catch (e) { console.warn('[export] blob failed', e); try { if (typeof Toast !== 'undefined' && typeof Toast.error === 'function') Toast.error('Export data invalid'); } catch (e2) { console.warn('[export] toast', e2); } return; }
let url;
try { url = URL.createObjectURL(blob); } catch (e) { console.warn('[export] url failed', e); return; }
const a = document.createElement('a');
a.setAttribute('aria-hidden', 'true');
a.href = url; a.download = safeName; a.rel = 'noopener';
a.style.display = 'none';
document.body.appendChild(a);
try { a.click(); } catch (e) { console.warn('[export] click failed', e); }
setTimeout(() => { try { a.remove(); } catch (e) { console.warn('[export] remove', e); } }, 0);
setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { console.warn('[export] revoke', e); } }, 60 * 1000);
}
async function exportAll() {
try {
let items = await Store.list();
if (!Array.isArray(items)) { try { Toast.error('Export failed: item list unavailable'); } catch (e) { console.warn('[export] toast', e); } return; }
items = items.filter(it => it && typeof it === 'object' && typeof it.id === 'string' && it.id.length > 0 && it.id.length < 200 && !it.id.includes('\u0000'));
items = items.map(it => { if (it && typeof it === 'object' && it._snapshots && Array.isArray(it._snapshots) && it._snapshots.length > 20) { const _c = Object.assign({}, it); _c._snapshots = it._snapshots.slice(-20); return _c; } return it; });
if (!items.length) { try { Toast.show('Nothing to export'); } catch (e) { console.warn('[export] toast', e); } return; }
const assets = Object.create(null);
const _seenAssetKeys = new Set();
const _MAX_SEEN_ASSETS = 50000;
const _includeAssets = Prefs.get('setting.exportAssets') !== false;
let _assetBytes = 0;
const _ASSET_TOTAL_CAP = 100 * 1024 * 1024;
const _ASSET_ITEM_CAP = 200 * 1024 * 1024;
if (items.length > 500000) { try { Toast.error('Too many items to export'); } catch (e) { console.warn('[export] toast', e); } return; }
const _collectAsset = async (key) => {
if (_assetBytes >= _ASSET_TOTAL_CAP) return;
if (_seenAssetKeys.size >= _MAX_SEEN_ASSETS) return;
if (!key || typeof key !== 'string' || key.length > 300) return;
if (_seenAssetKeys.has(key)) return;
_seenAssetKeys.add(key);
try {
if (typeof Store.getAsset !== 'function') return;
const blob = await Store.getAsset(key);
if (!blob) return;
if (typeof blob.size === 'number') _assetBytes += blob.size;
const dataUrl = await new Promise((res, rej) => {
const fr = new FileReader();
fr.onload = () => res(fr.result);
fr.onerror = () => rej(fr.error);
fr.onabort = () => rej(new Error('read aborted'));
fr.readAsDataURL(blob);
});
if (typeof dataUrl !== 'string') return;
if (dataUrl.length > _ASSET_ITEM_CAP) { console.warn('[export] asset too large for inline export', key); return; }
assets[key] = dataUrl;
} catch (err) { console.warn('[export] asset', key, err); }
};
if (_includeAssets) {
await _collectAsset(Prefs.get('setting.bgAssetKey'));
const _concurrency = 8;
let _i = 0;
const _worker = async () => {
while (_i < items.length) {
if (_assetBytes >= _ASSET_TOTAL_CAP) return;
const _cur = _i++;
if (_assetBytes >= _ASSET_TOTAL_CAP) return;
await _collectAsset(items[_cur] && items[_cur].assetKey);
}
};
await Promise.all(Array.from({ length: _concurrency }, () => _worker()));
}
const _scope = Prefs.get('setting.exportScope') || 'all';
const _exportItemsBase = _scope === 'current' ? items.filter(i => i && i.id === State.get('activeTabId')) : items;
const _exportItems = _exportItemsBase.map(it => {
if (!it || typeof it !== 'object') return it;
if (!Array.isArray(it._snapshots) || !it._snapshots.length) return it;
const _c = Object.assign({}, it);
delete _c._snapshots;
return _c;
});
if (_exportItems.length > 100000) { Toast.error('Too many items to serialize safely'); return; }
const data = {
version: 4,
exportedAt: Date.now(),
items: _exportItems,
assets,
prefs: (() => {
const out = {};
const _SENSITIVE = /(?:^|\.)(password|apikey|secret|token|passphrase|credential|privatekey|api[_-]?key)$/i;
const _TRANSIENT = /(\.tmp$|\.cache$|lastScroll|(?:^|\.)scroll\.|(?:^|\.)read\.|palette\.lastQuery|errors\.log|backup\.|version\.available)/i;
const _SAFE_PREFIX = /^cwtch\./;
for (let i = 0; i < localStorage.length; i++) {
let k;
try { k = localStorage.key(i); } catch (e) { console.warn('[export] localStorage key', e); continue; }
if (!k) continue;
if (!_SAFE_PREFIX.test(k)) continue;
if (/^cwtch-(backup|tmp|sw-)/.test(k)) continue;
const _bare = k.replace(/^cwtch\./, '');
if (_SENSITIVE.test(_bare)) { out[k] = { __raw: null }; continue; }
if (_TRANSIENT.test(_bare)) continue;
try { out[k] = { __raw: localStorage.getItem(k) }; } catch (e) { console.warn('[export] pref read', k, e); }
}
return out;
})()
};
let json;
try { json = JSON.stringify(data, null, 2); }
catch (err) { try { Toast.error('Export failed to serialise: ' + (err && err.message ? err.message : err)); } catch (e) { console.warn('[export] toast', e); } return; }
const _byteLen = new TextEncoder().encode(json).byteLength;
if (_byteLen > 100 * 1024 * 1024) { try { Toast.error('Export too large (' + Math.round(_byteLen / 1024 / 1024) + 'MB); disable assets or use ZIP export'); } catch (e) { console.warn('[export] toast', e); } return; }
if (typeof window.fflate !== 'undefined' && _includeAssets) {
try {
const payload = { 'backup.json': fflate.strToU8(json) };
try {
const _usedDocNames = new Set();
let _docNamesCounter = 0;
for (let it of items) {
if (++_docNamesCounter > 100000) break;
if (it.kind === 'markdown' || it.kind === 'note' || it.kind === 'text') {
try { if (it._snapshots) it = Object.assign({}, it, { _snapshots: [] }); } catch {}
const safe = String(it.title || it.id).replace(/[^a-z0-9.-]+/gi, '').slice(0, 80) || 'doc';
let key = 'docs/' + String(it.id || 'x').replace(/[^a-z0-9-]/gi, '') + '-' + safe + '.md';
let n = 2;
while (_usedDocNames.has(key)) { key = 'docs/' + String(it.id || 'x').replace(/[^a-z0-9-]/gi, '') + '-' + safe + '-' + n + '.md'; n++; }
_usedDocNames.add(key);
payload[key] = fflate.strToU8(it.content || '');
}
}
try {
const prefsOut = {};
const _SENSITIVE_ZIP = /(?:^|\.)(password|apikey|secret|token|passphrase|credential|privatekey|key)$/i;
const _TRANSIENT_ZIP = /(\.tmp$|\.cache$|lastScroll|scroll\.|read\.|palette\.lastQuery|errors\.log)/i;
for (let i = 0; i < localStorage.length; i++) {
const k = localStorage.key(i);
if (!k || !k.startsWith('cwtch.')) continue;
const _bareK = k.replace(/^cwtch\./, '');
if (_SENSITIVE_ZIP.test(_bareK)) { prefsOut[k] = null; continue; }
if (_TRANSIENT_ZIP.test(_bareK)) continue;
try { prefsOut[k] = JSON.parse(localStorage.getItem(k)); } catch { prefsOut[k] = localStorage.getItem(k); }
}
payload['settings.json'] = fflate.strToU8(JSON.stringify(prefsOut, null, 2));
} catch (e) { console.warn('[export] settings.json failed', e); }
} catch (e) { console.warn('[export] zip payload enrichment failed', e); }
const zip = fflate.zipSync(payload);
download('cwtch-backup-' + Date.now() + '.zip', zip, 'application/zip');
} catch (e) { console.warn('[export] zip failed, falling back to json', e); download('cwtch-backup-' + Date.now() + '.json', json); }
} else download('cwtch-backup-' + Date.now() + '.json', json);
const assetCount = Object.keys(assets).length;
Toast.success('Exported ' + _exportItems.length + ' items' + (assetCount ? ', ' + assetCount + ' assets' : ''));
} catch (e) { Toast.error('Export failed: ' + e.message); }
}
async function importAll() {
if (window._cwtchImportInProgress) { try { Toast.show('Import already running'); } catch (e) { console.warn('[import] toast', e); } return; }
if (typeof document === 'undefined' || !document.body) { try { Toast.error('Import unavailable: no document body'); } catch (e) { console.warn('[import] toast', e); } return; }
if (typeof FileReader === 'undefined' && typeof Blob === 'undefined') { try { Toast.error('Import unavailable: no file APIs'); } catch (e) { console.warn('[import] toast', e); } return; }
const _prevImportFocus = document.activeElement;
const inp = document.createElement('input');
inp.type = 'file'; inp.accept = 'application/json,.json,.zip';
inp.style.display = 'none';
inp.setAttribute('aria-hidden', 'true');
inp.setAttribute('tabindex', '-1');
document.body.appendChild(inp);
inp.onchange = async () => {
const file = inp.files && inp.files[0];
if (!file) { try { inp.remove(); } catch (e) { console.warn('[import] remove input (cancel)', e); } return; }
inp.value = '';
window._cwtchImportInProgress = true;
try {
let jsonText;
const _isZip = /\.zip$/i.test(file.name) || file.type === 'application/zip';
if (_isZip) {
if (typeof window.fflate === 'undefined') throw new Error('ZIP import requires the fflate library');
if (file.size > 500 * 1024 * 1024) throw new Error('ZIP too large (>500MB)');
const buf = new Uint8Array(await file.arrayBuffer());
let files;
try { files = fflate.unzipSync(buf); }
catch (zipErr) { throw new Error('ZIP is corrupted or unsupported: ' + (zipErr && zipErr.message ? zipErr.message : zipErr)); }
let entry = null;
for (const k of Object.keys(files)) {
if (k === 'backup.json' || k.endsWith('/backup.json')) { entry = files[k]; break; }
}
if (!entry) throw new Error('ZIP has no backup.json inside');
jsonText = fflate.strFromU8(entry);
} else {
if (file.size > 200 * 1024 * 1024) throw new Error('Backup too large (>200MB)');
jsonText = await file.text();
}
const data = JSON.parse(jsonText);
if (!data || typeof data !== 'object') throw new Error('Invalid backup: not an object');
if (data.version == null || !Number.isFinite(Number(data.version))) throw new Error('Invalid backup: missing version');
if (Number(data.version) < 1) throw new Error('Unsupported backup version: ' + data.version);
const _newer = Number(data.version) > 4;
if (_newer) { console.warn('[import] backup version newer than supported'); }
if (!Array.isArray(data.items) && !data.prefs) throw new Error('Invalid backup format: no items or prefs');
if (!Array.isArray(data.items)) data.items = [];
if (data.items.length > 500000) throw new Error('Backup too large: ' + data.items.length + ' items');
data.items = data.items.filter(it => it && typeof it === 'object' && typeof it.id === 'string' && it.id.length > 0 && it.id.length < 200);
const _total = data.items.length + Object.keys(data.assets || {}).length;
if (_total > 200000) throw new Error('Backup too large: ' + _total + ' entries');
const _importMsg = 'Import ' + data.items.length + ' item(s)? Existing items will be merged.'
+ (_newer ? '\n\nNote: this backup was created by a newer version.' : '');
if (typeof Modal === 'undefined' || typeof Modal.confirm !== 'function') { try { Toast.error('Import unavailable'); } catch (e) { console.warn('[import] toast', e); } return; }
let ok = false;
try { ok = await Modal.confirm(_importMsg, { okLabel: _newer ? 'Import anyway' : 'Import', danger: !!_newer }); } catch (e) { console.warn('[import] confirm', e); return; }
if (!ok) return;
const _dataUrlToBlob = (dataUrl) => {
if (typeof dataUrl !== 'string' || dataUrl.length > 30 * 1024 * 1024) throw new Error('Data URL too large');
const m = dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
if (!m) throw new Error('Bad data URL');
const _SAFE_MIME = /^(image\/(png|jpe?g|gif|webp|bmp|svg\+xml|x-icon|vnd\.microsoft\.icon|avif|heic|heif)|audio\/(mpeg|wav|ogg|mp4|flac|aac|opus|webm|x-m4a|x-wav|x-flac)|video\/(mp4|webm|ogg|quicktime|x-matroska)|application\/(json|octet-stream|pdf|zip|epub\+zip|x-zip-compressed|x-rar-compressed|vnd\.rar|7z-compressed|x-7z-compressed|x-font-ttf|x-font-otf|vnd\.ms-fontobject)|font\/(ttf|otf|woff|woff2)|text\/(plain|markdown|csv|x-markdown))$/i;
const _mimeRaw = String(m[1] || '').toLowerCase().split(';')[0].trim();
const mime = _SAFE_MIME.test(_mimeRaw) ? _mimeRaw : 'application/octet-stream';
const isB64 = !!m[2];
const dataStr = m[3];
if (isB64) {
if (dataStr.length > 200 * 1024 * 1024) throw new Error('Base64 too large');
if (!/^[A-Za-z0-9+/=]+$/.test(dataStr)) throw new Error('Invalid base64');
const bin = atob(dataStr);
const bytes = new Uint8Array(bin.length);
for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
return new Blob([bytes], { type: mime });
}
try { return new Blob([decodeURIComponent(dataStr)], { type: mime }); }
catch (e) { return new Blob([dataStr], { type: mime }); }
};
if (data.assets && typeof data.assets === 'object') {
let _importedAssets = 0;
let _failedAssets = 0;
let _processedAssets = 0;
const _MAX_ASSETS = 10000;
const _FORBIDDEN_ASSET = /(^|[/\\])(\.\.|__proto__|constructor|prototype)([/\\]|$)/;
const _assetsEntries = Object.entries(data.assets || {}).slice(0, _MAX_ASSETS + 1);
for (const [key, dataUrl] of _assetsEntries) {
if (_processedAssets++ >= _MAX_ASSETS) { _failedAssets++; continue; }
if (typeof key !== 'string' || key.length > 300 || _FORBIDDEN_ASSET.test(key) || key.includes('\u0000') || key.includes('\u001f') || key.includes('\u2028') || key.includes('\u2029')) { _failedAssets++; continue; }
if (typeof dataUrl !== 'string' || dataUrl.length > 100 * 1024 * 1024 || !/^data:[^,]+,/.test(dataUrl)) { _failedAssets++; continue; }
if (!/^(asset-|bg:|ver:|trash:)/.test(key)) { _failedAssets++; continue; }
try { const blob = _dataUrlToBlob(dataUrl); await Store.putAsset(key, blob); _importedAssets++; }
catch (err) { _failedAssets++; console.warn('[import] asset', key, err); }
}
if (_failedAssets) { try { Toast.show('Imported ' + _importedAssets + ' assets, ' + _failedAssets + ' failed'); } catch (e) { console.warn('[import] toast', e); } }
}
const bgKey = Object.keys(data.assets || {}).find(k => k.startsWith('bg:'));
if (bgKey) {
Prefs.set('setting.bgAssetKey', bgKey);
let bgType = 'image';
const _rawBgType = data.prefs && data.prefs['setting.bgType'];
if (typeof _rawBgType === 'string') bgType = _rawBgType;
else if (_rawBgType && typeof _rawBgType === 'object' && Object.prototype.hasOwnProperty.call(_rawBgType, '__raw')) bgType = String(_rawBgType.__raw || 'image');
if (bgType !== 'image' && bgType !== 'video' && bgType !== 'color') bgType = 'image';
try { Prefs.set('setting.bgType', bgType); } catch (e) { console.warn('[import] bgType pref', e); }
try { if (Background.setType) Background.setType(bgType); } catch (e) { console.warn('[import] Background.setType', e); }
}
const existingIds = new Set((State.get('libraryItems') || []).map(x => x.id));
let _importedCount = 0;
let _skipped = 0;
const _KNOWN_KINDS = new Set(['markdown','note','text','image','audio','canvas','card','binary']);
const _FORBIDDEN_KEYS = new Set(['__proto__','constructor','prototype']);
data.items = data.items.filter(it => {
if (!it || typeof it !== 'object') return false;
const _keys = Object.keys(it);
for (let i = 0; i < _keys.length; i++) {
if (_FORBIDDEN_KEYS.has(_keys[i])) { console.warn('[import] forbidden key in item', _keys[i]); return false; }
if (_keys[i].includes('\u0000') || _keys[i].includes('\u001f') || _keys[i].includes('\u2028') || _keys[i].includes('\u2029')) return false;
}
return true;
});
data.items = data.items.slice().sort((a, b) => (Number(a.lastModified) || 0) - (Number(b.lastModified) || 0));
const _NOW_FUTURE = Date.now() + 365 * 24 * 60 * 60 * 1000;
for (const it of data.items) {
if (!it || typeof it !== 'object' || !it.id) { _skipped++; continue; }
if (typeof it.id !== 'string' || it.id.length > 200 || it.id.indexOf('\u0000') >= 0) { _skipped++; continue; }
if (!_KNOWN_KINDS.has(it.kind)) { console.warn('[import] unknown kind, defaulting to text:', it.kind); it.kind = 'text'; }
if (!Array.isArray(it.tags)) it.tags = [];
if (typeof it.starred !== 'boolean') it.starred = false;
if (typeof it.createdAt !== 'number' || !Number.isFinite(it.createdAt)) it.createdAt = Date.now();
if (!Number.isFinite(Number(it.lastModified)) || Number(it.lastModified) > _NOW_FUTURE) { it.lastModified = Date.now(); }
try {
const existing = existingIds.has(it.id) ? (State.get('libraryItems') || []).find(x => x.id === it.id) : null;
let merged;
if (existing) {
const existingLM = Number(existing.lastModified) || 0;
const incomingLM = Number(it.lastModified) || 0;
if (incomingLM < existingLM) { _skipped++; continue; }
if (incomingLM === existingLM) {
const _eq = String(existing.title || '') === String(it.title || '') && String(existing.content || '') === String(it.content || '');
if (_eq) { _skipped++; continue; }
}
merged = Object.assign({}, existing, it);
} else merged = it;
if (!Object.prototype.hasOwnProperty.call(merged, 'tags') || !Array.isArray(merged.tags)) merged.tags = [];
if (typeof merged.kind !== 'string') merged.kind = 'text';
if (!Number.isFinite(Number(merged.createdAt))) merged.createdAt = Date.now();
if (!Number.isFinite(Number(merged.lastModified))) merged.lastModified = merged.createdAt;
if (typeof merged.title !== 'string') merged.title = 'Untitled';
merged.title = merged.title.slice(0, 300);
if (typeof merged.content !== 'string') merged.content = String(merged.content == null ? '' : merged.content);
if (merged.content.length > 128 * 1024 * 1024) { console.warn('[import] content too large, skipping', it.id); _skipped++; continue; }
await Store.put(merged);
_importedCount++;
} catch (err) { _skipped++; console.warn('[import] item', it.id, err); }
}
try {
const _snapshotsRestored = data.items.filter(x => Array.isArray(x._snapshots) && x._snapshots.length).length;
if (_snapshotsRestored) console.info('[import] restored snapshots for', _snapshotsRestored, 'items');
} catch {}
if (_skipped) Toast.show('Imported ' + _importedCount + ', skipped ' + _skipped);
if (data.prefs && typeof data.prefs === 'object') {
const FORBIDDEN = new Set(['__proto__','prototype','constructor','toString','valueOf','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','toLocaleString','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__']);
const _SENSITIVE_PREF = /(?:^|\.)(password|apikey|secret|token|key|credential|passphrase|privatekey|endpoint|serverUrl|server_url|api[_-]?key)$/i;
const _PREFIXES = ['cwtch.', 'studyOS.', 'sd.'];
const _prefCount = Object.keys(data.prefs).length;
if (_prefCount > 100000) { console.warn('[import] too many prefs, skipping pref import'); }
else Object.entries(data.prefs).forEach(([k, v]) => {
if (FORBIDDEN.has(k)) return;
if (typeof k !== 'string' || k.length > 200 || k.includes('\u0000')) return;
if (!_PREFIXES.some(p => k.startsWith(p))) return;
if (_SENSITIVE_PREF.test(k.replace(/^cwtch\./, ''))) { console.info('[import] skipped sensitive pref', k); return; }
try {
let raw;
if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, '__raw')) raw = v.__raw;
else raw = JSON.stringify(v);
if (typeof raw !== 'string') { console.warn('[import] non-string pref', k); return; }
if (raw.length > 512 * 1024) { console.warn('[import] skipping oversized pref', k); return; }
try { const _parsed = JSON.parse(raw); Prefs.set(k.replace(/^cwtch\./, ''), _parsed); } catch { if (/^\d+(\.\d+)?$/.test(raw)) { Prefs.set(k.replace(/^cwtch\./, ''), Number(raw)); } else if (raw === 'true') Prefs.set(k.replace(/^cwtch\./, ''), true); else if (raw === 'false') Prefs.set(k.replace(/^cwtch\./, ''), false); else if (raw === 'null') Prefs.set(k.replace(/^cwtch\./, ''), null); else return; }
} catch {}
});
try { if (Prefs && typeof Prefs._reload === 'function') Prefs._reload(); } catch (e) { console.warn('[import] pref reload', e); }
}
try {
document.body.classList.toggle('invert-ui', !!Prefs.get('setting.invertUI', false));
document.body.classList.toggle('invert-images', !!Prefs.get('setting.invertImages', false));
} catch {}
try { if (typeof Settings !== 'undefined' && Settings && typeof Settings.applyAll === 'function') Settings.applyAll(); } catch (e) { console.warn('[import] Settings.applyAll', e); }
Bus.emit('library:changed');
if (typeof HeaderRenderer !== 'undefined' && HeaderRenderer.render) {
try { HeaderRenderer.render(); } catch (_) {}
}
if (typeof DrawerController !== 'undefined' && DrawerController.refresh) {
try { DrawerController.refresh(); } catch (_) {}
}
Toast.success('Imported ' + _importedCount + ' of ' + data.items.length + ' items' + (_skipped ? ' (' + _skipped + ' skipped)' : ''));
} catch (e) { Toast.error('Import failed: ' + e.message); }
finally { window._cwtchImportInProgress = false; try { inp.remove(); } catch (e) { console.warn('[import] remove input', e); } try { if (_prevImportFocus && document.contains(_prevImportFocus) && typeof _prevImportFocus.focus === 'function') _prevImportFocus.focus({ preventScroll: true }); } catch (e) { console.warn('[import] restore focus', e); } }
};
inp.addEventListener('cancel', () => { try { inp.remove(); } catch (e) { console.warn('[import] remove input (cancel)', e); } });
inp.click();
}
async function exportCsv(items) {
if (!Array.isArray(items)) return;
const _rows = [['id','title','kind','path','tags','createdAt','lastModified','size']];
if (items.length > 50000) { try { Toast.error('Too many items to export as CSV (max 50000)'); } catch (e) { console.warn('[export] toast', e); } return; }
if (!items.length) { try { if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') Toast.show('No items to export'); } catch (e) { console.warn('[export] toast', e); } return; }
const _csvCell = v => {
const s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
return '"' + s.replace(/"/g, '""') + '"';
};
items.forEach(it => {
if (!it || typeof it !== 'object') return;
_rows.push([it.id, it.title, it.kind, it.path || '', (Array.isArray(it.tags) ? it.tags : []).join('|'), it.createdAt || '', it.lastModified || '', it.size || 0]);
});
const _headers = _rows[0].map(_csvCell).join(',');
const csv = [_headers, ..._rows.slice(1).map(r => r.map(_csvCell).join(','))].join('\r\n');
download('cwtch-export-' + Date.now() + '.csv', '\ufeff' + csv, 'text/csv');
try { Toast.success('CSV exported'); } catch {}
}
async function exportAnki(items) {
if (!Array.isArray(items)) return;
const _cards = items.filter(i => i && i.kind === 'card').slice(0, 20000);
if (!_cards.length) { try { Toast.error('No cards to export'); } catch (e) { console.warn('[export] toast', e); } return; }
const _csvCell = v => '"' + String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f\u2028\u2029\t]/g, ' ').replace(/"/g, '""') + '"';
const _rows = [['Front','Back','Tags','Deck']];
_cards.forEach(it => {
let d = {};
try { d = JSON.parse(it.content); } catch (e) { console.warn('[export] anki card parse', e); }
if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
const _deck = (it.path || '').split('/')[0] || 'Default';
_rows.push([d.front || '', d.back || '', (Array.isArray(it.tags) ? it.tags : []).join(' '), _deck]);
});
const csv = _rows.map(r => r.map(_csvCell).join('\t')).join('\r\n');
download('cwtch-anki-' + Date.now() + '.tsv', '\ufeff' + csv, 'text/tab-separated-values');
try { Toast.success('Anki TSV exported (' + _cards.length + ' cards)'); } catch {}
}
async function exportItem(item) {
try {
if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id) { try { Toast.error('No item to export'); } catch (e) { console.warn('[export] toast', e); } return; }
if (!/^[A-Za-z0-9_.-]{1,200}$/.test(item.id)) { try { Toast.error('Invalid item id'); } catch (e) { console.warn('[export] invalid id toast', e); } return; }
if (item.id.indexOf('\u0000') >= 0) { try { Toast.error('Invalid item id'); } catch {} return; }
try { if (Prefs.get('setting.backup.integrityCheck') !== false && typeof Store.list === 'function') { const _all = await Store.list(); if (!Array.isArray(_all) || !_all.some(x => x && x.id === item.id)) { console.warn('[export] item not present in store'); } } } catch (e) { console.warn('[export] verify', e); }
if (!Array.isArray(item.tags)) item.tags = [];
if (item.kind !== 'markdown' && item.kind !== 'text' && item.kind !== 'note' && item.kind !== 'image' && item.kind !== 'audio' && item.kind !== 'card' && item.kind !== 'canvas') {
try { Toast.error('Unsupported export kind: ' + (item.kind || 'unknown')); } catch (e) { console.warn('[export] unsupported kind toast', e); }
return;
}
if (typeof item.title !== 'string') item.title = 'document';
if (item.kind === 'card') { await exportCsv([item]); return; }
if (item.kind === 'canvas') {
if (!item.assetKey) { try { Toast.error('Canvas asset unavailable'); } catch (e) { console.warn('[export] canvas toast', e); } return; }
const _cBlob = await Store.getAsset(item.assetKey);
if (!_cBlob) { try { Toast.error('Canvas asset unavailable'); } catch (e) { console.warn('[export] canvas toast', e); } return; }
const _cExt = (() => { const t = String(_cBlob.type || '').toLowerCase(); if (/svg/.test(t)) return '.svg'; if (/png/.test(t)) return '.png'; if (/jpe?g/.test(t)) return '.jpg'; if (/json/.test(t)) return '.drawio'; return '.bin'; })();
const _cA = document.createElement('a');
const _cUrl = URL.createObjectURL(_cBlob);
_cA.href = _cUrl;
_cA.download = (String(item.title || 'canvas').replace(/[\\/:?"<>|*]+/g, '_').slice(0, 120) || 'canvas') + _cExt;
_cA.rel = 'noopener';
_cA.style.display = 'none';
document.body.appendChild(_cA);
try { _cA.click(); } catch (e) { console.warn('[export] canvas click', e); }
setTimeout(() => { try { _cA.remove(); } catch (e) { console.warn('[export] canvas remove', e); } }, 0);
setTimeout(() => URL.revokeObjectURL(_cUrl), 30000);
Toast.success('Exported');
return;
}
if ((item.kind === 'markdown' || item.kind === 'note') && typeof item.content === 'string') {
if (item.content.length > 10 * 1024 * 1024) { try { Toast.error('Document too large to export'); } catch (e) { console.warn('[export] doc too large toast', e); } return; }
const _safeTitle = String(item.title).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200);
let rendered;
try { rendered = Markdown.render(item.content); }
catch (err) { console.warn('[export] markdown render failed', err); Toast.error('Render failed'); return; }
let fmt = 'html'; try { fmt = Prefs.get('setting.exportFormat') || 'html'; } catch {}
if (fmt === 'epub' && typeof window.fflate !== 'undefined') {
const css = 'body{font-family:serif;line-height:1.6;margin:1em}pre{background:#f4f5f7;padding:1em;overflow-x:auto}';
const _renderedX = String(rendered).replace(/<br\s*\/?>/gi, '<br/>').replace(/<hr\s*\/?>/gi, '<hr/>').replace(/<img([^>]*?)\/?>/gi, (m, attrs) => `<img${attrs}/>`);
const _titleEsc = escapeHtml(item.title).replace(/]]>/g, ']]&gt;');
const _bodyForEpub = _renderedX.replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;').replace(/<(?!\/?[a-zA-Z!])/g, '&lt;');
const chapter = `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><title>${_titleEsc}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body><h1>${_titleEsc}</h1>${_bodyForEpub}</body></html>`;
const container = '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
const nav = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="utf-8"/><title>Contents</title></head>
<body><nav epub:type="toc"><h1>Contents</h1>
<ol><li><a href="chapter.xhtml">${escapeHtml(item.title)}</a></li></ol>
</nav></body></html>`;
const opf = `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeHtml(item.title)}</dc:title><dc:identifier id="bookid">urn:uuid:${item.id}</dc:identifier><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="css" href="style.css" media-type="text/css"/></manifest><spine><itemref idref="nav"/><itemref idref="chapter"/></spine></package>`;
const _zip = fflate.zipSync([
['mimetype', [fflate.strToU8('application/epub+zip'), { level: 0 }]],
['META-INF/container.xml', fflate.strToU8(container)],
['OEBPS/content.opf', fflate.strToU8(opf)],
['OEBPS/nav.xhtml', fflate.strToU8(nav)],
['OEBPS/chapter.xhtml', fflate.strToU8(chapter)],
['OEBPS/style.css', fflate.strToU8(css)]
], { level: 6 });
const zip = _zip;
download((item.title || 'book') + '.epub', zip, 'application/epub+zip');
Toast.success('Exported ePub');
return;
}
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(item.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.7;color:#222}pre{background:#f4f5f7;padding:12px;border-radius:8px;overflow-x:auto}@media print{.no-print{display:none}}</style></head><body>${rendered}</body></html>`;
const _safeName = String(item.title || 'document').replace(/[\\/:?"<>|*]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'document';
download(_safeName + '.html', html, 'text/html');
} else if (item.kind === 'text') {
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(item.title)}</title></head><body><pre>${escapeHtml(String(item.content || '').slice(0, 500000))}</pre></body></html>`;
download(String(item.title || 'text') + '.html', html, 'text/html');
} else if ((item.kind === 'image' || item.kind === 'audio') && item.assetKey) {
const blob = await Store.getAsset(item.assetKey);
if (blob) {
const a = document.createElement('a');
const _objUrl = URL.createObjectURL(blob);
a.href = _objUrl;
a.download = String(item.title || 'asset').replace(/[\\/:?"<>|*]+/g, '_').slice(0, 120) || 'asset';
a.rel = 'noopener';
a.style.display = 'none';
document.body.appendChild(a);
try { a.click(); } catch (e) { console.warn('[export] asset click', e); }
setTimeout(() => { try { a.remove(); } catch (e) { console.warn('[export] asset remove', e); } }, 0);
setTimeout(() => URL.revokeObjectURL(_objUrl), 30000);
} else { Toast.error('Asset unavailable'); return; }
} else if (item.kind === 'image' || item.kind === 'audio') {
Toast.error('Asset unavailable'); return;
} else {
const _safeName = String(item.title || 'document').replace(/[\\/:?"<>|*]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'document';
download(_safeName + '.txt', String(item.content == null ? '' : item.content), 'text/plain');
}
Toast.success('Exported');
} catch (e) { Toast.error('Export failed: ' + e.message); }
}
return { exportAll, importAll, exportItem, exportCsv, exportAnki };
})();