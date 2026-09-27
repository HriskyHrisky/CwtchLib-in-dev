
import { Prefs } from '../core/prefs.js';
import { State } from '../core/state.js';
import { Flags } from '../core/flags.js';
import { Theme } from '../theme/theme.js';
import { DrawerController } from '../ui/drawer.js';
import { Status } from '../ui/status.js';
import { Announce } from '../ui/announce.js';
import { HeaderRenderer } from '../ui/header.js';
import { ReviewEngine } from '../srs/review-engine.js';
import { Editor } from '../editor/editor.js';
import { Keyboard } from '../ui/keyboard.js';
import { SelectionBubble } from '../editor/bubble.js';
import { Undo } from '../editor/undo.js';
import { Toast } from '../ui/toast.js';
import { ContentView } from '../library/content-view.js';
import { Background } from '../theme/background.js';

export const Settings = (() => {
'use strict';
const _typeCache = new Map();
const _TYPE_CACHE_MAX = 2000;
const _modifiedCache = new Map();
const _MOD_CACHE_MAX = 5000;
function _valueEq(a, b, _depth) {
if (a === b) return true;
if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
if (a == null || b == null) return a === b;
if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
if (a instanceof Number || b instanceof Number) {
if (!(a instanceof Number) || !(b instanceof Number)) return false;
const _an = Number(a.valueOf()), _bn = Number(b.valueOf());
return (_an === _bn) || (Number.isNaN(_an) && Number.isNaN(_bn));
}
if (typeof a !== typeof b) return false;
const _d = _depth || 0;
if (_d > 64) { console.warn('[Settings] _valueEq depth exceeded'); return false; }
if (Array.isArray(a) && Array.isArray(b)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!_valueEq(a[i], b[i], _d + 1)) return false; return true; }
if (typeof a === 'object' && typeof b === 'object') {
if (Array.isArray(a) !== Array.isArray(b)) return false;
const ka = Object.keys(a), kb = Object.keys(b);
if (ka.length !== kb.length) return false;
for (let i = 0; i < ka.length; i++) if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
for (const k of ka) if (!_valueEq(a[k], b[k], _d + 1)) return false;
return true;
}
return false;
}
function _isSafeRowId(id) {
if (typeof id !== 'string' || !id || id.length > 120) return false;
if (id === '__proto__' || id === 'constructor' || id === 'prototype') return false;
if (id.indexOf('\u0000') >= 0) return false;
if (id.indexOf('\u001f') >= 0) return false;
if (id.indexOf('\u007f') >= 0) return false;
if (id.indexOf('\u2028') >= 0) return false;
if (id.indexOf('\u2029') >= 0) return false;
return true;
}
function getDef(id) {
if (!_isSafeRowId(id)) return null;
if (_typeCache.has(id)) { const _hit = _typeCache.get(id); _typeCache.delete(id); _typeCache.set(id, _hit); return _hit; }
for (const g of SCHEMA) {
if (!g || !Array.isArray(g.rows)) continue;
const r = g.rows.find(x => x && x.id === id);
if (r) {
const _row = Object.assign({}, r, { _group: g.group });
if (Array.isArray(r.options)) _row.options = r.options.slice();
if (r.def && typeof r.def === 'object' && !Array.isArray(r.def)) _row.def = _cloneDef(r.def);
if (_typeCache.size >= _TYPE_CACHE_MAX) { const _first = _typeCache.keys().next().value; if (_first !== undefined) _typeCache.delete(_first); }
_typeCache.set(id, _row);
return _row;
}
}
return null;
}
function _isModified(row) {
if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id) return false;
try {
const _rev = (typeof State !== 'undefined' && State.getRevision) ? Number(State.getRevision()) || 0 : 0;
const _prefRaw = (() => { try { return Prefs.get('setting.' + row.id); } catch (e) { return undefined; } })();
const _prefKey = (() => { if (_prefRaw === undefined) return 'u'; if (_prefRaw === null) return 'n'; if (typeof _prefRaw === 'string') return 's:' + _prefRaw.length + ':' + _prefRaw.slice(0, 40); if (typeof _prefRaw === 'number') return 'd:' + _prefRaw; if (typeof _prefRaw === 'boolean') return 'b:' + _prefRaw; try { return 'o:' + JSON.stringify(_prefRaw).slice(0, 200); } catch { return 'o:err'; } })();
const _cacheKey = row.id + '|' + _rev + '|' + _prefKey;
if (_modifiedCache.has(_cacheKey)) return _modifiedCache.get(_cacheKey);
const cur = _prefRaw;
const _def = row.def;
if (_modifiedCache.size >= _MOD_CACHE_MAX) { const _first = _modifiedCache.keys().next().value; if (_first !== undefined) _modifiedCache.delete(_first); }
if (cur === undefined) { _modifiedCache.set(_cacheKey, false); return false; }
if (cur == null && _def == null) { _modifiedCache.set(_cacheKey, false); return false; }
if (cur == null || _def == null) { const _r3 = cur !== _def; _modifiedCache.set(_cacheKey, _r3); return _r3; }
if (typeof cur !== typeof _def) { _modifiedCache.set(_cacheKey, true); return true; }
if (typeof cur === 'number' && typeof _def === 'number' && Number.isNaN(cur) && Number.isNaN(_def)) { _modifiedCache.set(_cacheKey, false); return false; }
if (Array.isArray(cur) && Array.isArray(_def)) { const _r1 = !_valueEq(cur, _def); _modifiedCache.set(_cacheKey, _r1); return _r1; }
if (_def instanceof Date && cur instanceof Date) { const _r2 = cur.getTime() !== _def.getTime(); _modifiedCache.set(_cacheKey, _r2); return _r2; }
if (typeof cur === 'object' && typeof _def === 'object') { const _r = !_valueEq(cur, _def); _modifiedCache.set(_cacheKey, _r); return _r; }
const _r = cur !== _def; _modifiedCache.set(_cacheKey, _r); return _r;
} catch (e) { console.warn('[Settings] isModified', e); return false; }
}
function _isPlanned(row) {
if (!row || typeof row !== 'object') return false;
if (row.planned === true) return true;
if (typeof row.planned === 'string' && row.planned.length > 0) return true;
if (row.available === false) return true;
return false;
}
let _plannedStyleInjected = false;
function _ensurePlannedStyle() {
if (_plannedStyleInjected) return;
if (typeof document === 'undefined' || !document.head) return;
if (document.getElementById('settings-planned-style')) { _plannedStyleInjected = true; return; }
try {
const _st = document.createElement('style');
_st.id = 'settings-planned-style';
_st.textContent = '.settings-row[data-planned="1"]{opacity:.55;cursor:not-allowed}';
document.head.appendChild(_st);
_plannedStyleInjected = true;
} catch (e) { console.warn('[Settings] planned style', e); _plannedStyleInjected = false; }
return;
}
if (typeof document !== 'undefined') {
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', () => { try { _ensurePlannedStyle(); } catch (e) { console.warn('[Settings] planned style deferred', e); } }, { once: true });
} else { _ensurePlannedStyle(); }
}
let _expandedWriteTimer = null;
let _expandedPending = null;
let _expandedCache = null;
let _expandedCacheRev = -1;
let _libViewTimer = null;
let _libSortTimer = null;
let _libCoversTimer = null;
let _hdrRenderTimerItems = null;
let _hdrRenderTimerOrder = null;
let _schemaValidated = false;
function _isExpanded(id) { if (typeof id !== 'string' || !id) return false; return (_expandedPending || _expandedSet()).has(id); }
function _setExpanded(id, on) {
        if (typeof id !== 'string' || id.length === 0 || id.length > 200) return;
        if (!/^[A-Za-z0-9._\- ]+$/.test(id)) return;
const _baseSet = _expandedPending || _expandedSet();
if (on ? _baseSet.has(id) : !_baseSet.has(id)) return;
const s = new Set(_baseSet);
if (on) s.add(id); else s.delete(id);
if (s.size > 500) { const _arr = Array.from(s); s.clear(); _arr.slice(-500).forEach(x => s.add(x)); }
_expandedPending = s;
if (_expandedWriteTimer) clearTimeout(_expandedWriteTimer);
_expandedWriteTimer = setTimeout(() => {
_expandedWriteTimer = null;
const _toWrite = _expandedPending;
_expandedPending = null;
if (!_toWrite) return;
try { Prefs.set('setting.ui.settingsExpanded', Array.from(_toWrite).slice(0, 500)); _expandedCache = null; _expandedCacheRev = -1; }
catch (e) { console.warn('[Settings] persist expanded failed', e); }
}, 60);
}
function _flushExpandedWrite() {
if (_expandedWriteTimer) { clearTimeout(_expandedWriteTimer); _expandedWriteTimer = null; }
if (_expandedPending) {
const _toWrite = _expandedPending; _expandedPending = null;
try { Prefs.set('setting.ui.settingsExpanded', Array.from(_toWrite).slice(0, 500)); _expandedCache = null; _expandedCacheRev = -1; }
catch (e) { console.warn('[Settings] flush expanded failed', e); _expandedPending = _toWrite; }
}
}
function _expandedSet() {
let raw;
try { raw = Prefs.get('setting.ui.settingsExpanded'); } catch (e) { console.warn('[Settings]', e); return new Set(); }
const _seen = new Set();
if (!Array.isArray(raw)) {
if (_expandedCacheRev === '' && _expandedCache) return _expandedCache;
_expandedCache = new Set();
_expandedCacheRev = '';
return _expandedCache;
}
for (const _x of raw) { if (typeof _x === 'string' && _x.length < 200 && _x.indexOf('\u0000') < 0 && !_seen.has(_x)) _seen.add(_x); }
const _rev = Array.from(_seen).sort().join('\u0000');
if (_expandedCacheRev === _rev && _expandedCache) return _expandedCache;
_expandedCache = _seen;
_expandedCacheRev = _rev;
return _expandedCache;
}
const SCHEMA = [
{ group: 'Typography', rows: [
{ id: 'typography.baseFontSize', type: 'range', def: 16, min: 1, max: 30, step: 1, label: 'Base font size (px)', apply: v => { const _num = Number(v); const _min = 1, _max = 30; const safe = Number.isFinite(_num) ? Math.max(_min, Math.min(_max, _num)) : 16; document.documentElement.style.setProperty('--reading-size', safe + 'px'); let sc = false; try { sc = Prefs.get('setting.typography.smallCapsHeadings'); } catch (e) { console.warn('[Settings] smallCaps read', e); } const on = !!sc && safe >= 18; document.body.classList.toggle('has-smallcaps-headings', on); document.body.classList.toggle('smallcaps-disabled', !!sc && !on); } },
{ id: 'typography.lineHeight', type: 'range', def: 1.6, min: 1, max: 4, step: 0.05, label: 'Line height', apply: v => { const n = Number(v); const _min = 1, _max = 4; const safe = Number.isFinite(n) ? Math.max(_min, Math.min(_max, n)) : 1.6; document.documentElement.style.setProperty('--line-height', String(safe)); } },
{ id: 'typography.measure', type: 'range', def: 68, min: 20, max: 120, step: 1, label: 'Line length (ch)', apply: v => { const _n = Number(v); const _s = Number.isFinite(_n) ? Math.max(20, Math.min(120, _n)) : 68; document.documentElement.style.setProperty('--measure', _s + 'ch'); } },
{ id: 'typography.paragraphSpacing', type: 'range', def: 1.0, min: 0, max: 3, step: 0.1, label: 'Paragraph spacing (em)', apply: v => { let style = 'block'; try { style = Prefs.get('setting.typography.paragraphStyle', 'block'); } catch (e) { console.warn('[Settings] paragraphStyle read', e); } const _n = Number(v); const _safe = Number.isFinite(_n) ? Math.max(0, Math.min(3, _n)) : 1; if (style === 'indent') document.documentElement.style.setProperty('--para-space', '0em'); else document.documentElement.style.setProperty('--para-space', _safe + 'em'); } },
{ id: 'typography.paragraphStyle', type: 'seg', def: 'block', label: 'Paragraph style', options: ['block','indent'], apply: v => { const _v = (v === 'indent') ? 'indent' : 'block'; document.documentElement.dataset.paraStyle = _v; if (_v === 'indent') document.documentElement.style.setProperty('--para-space', '0em'); else { let sp = 1; try { sp = Prefs.get('setting.typography.paragraphSpacing', 1); } catch {} const num = Number(sp); document.documentElement.style.setProperty('--para-space', (Number.isFinite(num) ? num : 1) + 'em'); } } },
{ id: 'typography.textAlign', type: 'seg', def: 'start', label: 'Text alignment', options: ['start','justify'], apply: v => { const _v = v === 'justify' ? 'justify' : 'start'; document.documentElement.style.setProperty('--text-align', _v); document.documentElement.setAttribute('data-text-align', _v); } },
{ id: 'typography.linkStyle', type: 'seg', def: 'underline', label: 'Link style', options: ['underline','color','both'], apply: v => { const _v = (v === 'color' || v === 'both') ? v : 'underline'; document.documentElement.dataset.linkStyle = _v; document.body.classList.toggle('link-style-color', _v === 'color' || _v === 'both'); } },
{ id: 'typography.dropCaps', type: 'toggle', def: false, label: 'Drop caps', apply: v => { const _on = !!v; document.body.classList.toggle('has-drop-caps', _on); document.body.classList.toggle('no-drop-caps', !_on); } },
{ id: 'typography.firstLetterRaise', type: 'toggle', def: true, label: 'Raise first letter', apply: v => { const _on = !!v; document.body.classList.toggle('has-first-letter-raise', _on); document.body.classList.toggle('no-first-letter-raise', !_on); } },
{ id: 'typography.firstLetterRaiseLines', type: 'range', def: 2, min: 1, max: 4, step: 1, label: 'Raise height (lines)', apply: v => { const _n = Number(v); const _s = Number.isFinite(_n) ? Math.max(1, Math.min(4, Math.round(_n))) : 2; document.documentElement.style.setProperty('--first-letter-lines', String(_s)); } },
{ id: 'typography.headingScale', type: 'range', def: 1.25, min: 1.0, max: 2.0, step: 0.05, label: 'Heading scale', apply: v => { const _n = Number(v); const _s = Number.isFinite(_n) ? Math.max(1.0, Math.min(2.0, _n)) : 1.25; document.documentElement.style.setProperty('--heading-scale', String(_s)); } },
{ id: 'typography.smallCapsHeadings', type: 'toggle', def: false, label: 'Small-caps headings', apply: v => { let base = 16; try { base = Number(Prefs.get('setting.typography.baseFontSize', 16)) || 16; } catch {} const on = !!v && base >= 18; document.body.classList.toggle('has-smallcaps-headings', on); document.body.classList.toggle('smallcaps-disabled', !!v && !on); } },
{ id: 'typography.dyslexic', type: 'toggle', def: false, label: 'OpenDyslexic font', apply: v => { if (v) { document.documentElement.style.setProperty('--reader-font', '"OpenDyslexic", system-ui, sans-serif'); } else { document.documentElement.style.setProperty('--reader-font', 'system-ui, -apple-system, sans-serif'); } } }
]},
{ group: 'Background', rows: [
{ id: 'background.layers', type: 'custom', def: [], label: 'Background layers', apply: v => { try { if (typeof Background !== 'undefined' && Background && typeof Background.setLayers === 'function') Background.setLayers(Array.isArray(v) ? v : []); } catch (e) { console.warn('[Settings] bgLayers', e); } } },
{ id: 'background.dim', type: 'range', def: 0, min: 0, max: 1, step: 0.05, label: 'Dim amount', apply: v => { const _n = Number(v); const _s = Number.isFinite(_n) ? Math.max(0, Math.min(1, _n)) : 0; document.documentElement.style.setProperty('--bg-dim-amount', String(_s)); } },
{ id: 'background.dimColor', type: 'color', def: 'rgba(0,0,0,1)', label: 'Dim color', apply: v => { const _val = String(v == null ? 'rgba(0,0,0,1)' : v).slice(0, 64); const _safe = /^(#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)|hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*[\d.]+)?\s*\))$/i.test(_val) ? _val.toLowerCase() : 'rgba(0,0,0,1)'; document.documentElement.style.setProperty('--bg-dim', _safe); } }
]},
{ group: 'Icons', rows: [
{ id: 'iconTheme', type: 'seg', def: 'default', label: 'Icon style', options: ['default','line','emoji'], apply: v => { const _v = (v === 'line' || v === 'emoji') ? v : 'default'; document.documentElement.dataset.iconTheme = _v; document.body.classList.toggle('icon-theme-line', _v === 'line'); document.body.classList.toggle('icon-theme-emoji', _v === 'emoji'); } },
{ id: 'iconSize', type: 'seg', def: 'md', label: 'Icon size', options: ['sm','md','lg'], apply: v => { const _v = (v === 'sm' || v === 'lg') ? v : 'md'; document.documentElement.dataset.iconSize = _v; document.body.classList.toggle('icon-size-sm', _v === 'sm'); document.body.classList.toggle('icon-size-lg', _v === 'lg'); } }
]},
{ group: 'Layout', rows: [
{ id: 'density', type: 'seg', def: 'cozy', label: 'Interface density', options: ['compact','cozy','roomy'], apply: v => { document.body.dataset.density = (v === 'compact' || v === 'roomy') ? v : 'cozy'; } },
{ id: 'layout.zenMode', type: 'toggle', def: false, label: 'Zen mode (hide chrome)', apply: v => { try { document.body.classList.toggle('zen-mode', !!v); } catch (e) { console.warn('[Settings] zen', e); } } },
{ id: 'layout.typewriterMode', type: 'toggle', def: false, label: 'Typewriter mode', apply: v => { try { document.body.classList.toggle('typewriter-mode', !!v); } catch (e) { console.warn('[Settings] typewriter', e); } } },
{ id: 'layout.focusParagraph', type: 'toggle', def: false, label: 'Dim non-active paragraphs', apply: v => { try { document.body.classList.toggle('focus-paragraph', !!v); } catch (e) { console.warn('[Settings] focus-para', e); } } },
{ id: 'layout.readingTime', type: 'toggle', def: true, label: 'Show reading time in status', apply: () => { try { if (typeof Status !== 'undefined' && Status.setWords) { const _n = (State.get('libraryItems') || []).find(x => x && x.id === State.get('activeTabId')); if (_n) Status.setWords(((_n.content || '').match(/\S+/g) || []).length); } } catch (e) { console.warn('[Settings] readingTime', e); } } },
{ id: 'ui.statusBar', type: 'toggle', def: true, label: 'Show status bar', apply: () => { try { if (typeof Status !== 'undefined' && typeof Status.refreshVisibility === 'function') Status.refreshVisibility(); } catch (e) { console.warn('[Settings] statusBar', e); } } }
]},
{ group: 'Header', rows: [
{ id: 'header.items', type: 'custom', def: [], label: 'Header items', apply: () => { try { if (typeof HeaderRenderer !== 'undefined' && HeaderRenderer.render) { if (_hdrRenderTimerItems) clearTimeout(_hdrRenderTimerItems); _hdrRenderTimerItems = setTimeout(() => { _hdrRenderTimerItems = null; try { HeaderRenderer.render(); } catch (e) { console.warn('[Settings] header render', e); } }, 16); } } catch (e) { console.warn('[Settings] header render', e); } } },
{ id: 'header.order', type: 'custom', def: [], label: 'Order header icons', apply: () => { try { if (typeof HeaderRenderer !== 'undefined' && HeaderRenderer.render) { if (_hdrRenderTimerOrder) clearTimeout(_hdrRenderTimerOrder); _hdrRenderTimerOrder = setTimeout(() => { _hdrRenderTimerOrder = null; try { HeaderRenderer.render(); } catch (e) { console.warn('[Settings] header render', e); } }, 16); } } catch (e) { console.warn('[Settings] header render', e); } } }
]},
{ group: 'Header grid', rows: [
{ id: 'headerGrid.columns', type: 'seg', def: 'auto', label: 'Columns (auto = fit)', options: ['auto','2','3','4'], apply: v => { const _v = (v === '2' || v === '3' || v === '4') ? v : 'auto'; document.documentElement.style.setProperty('--header-grid-cols', _v === 'auto' ? 'auto-fill' : String(_v)); document.body.dataset.headerGridCols = _v; } },
{ id: 'headerGrid.grouped', type: 'toggle', def: true, label: 'Group by section', apply: v => { document.body.classList.toggle('no-grid-groups', !v); } },
{ id: 'headerGrid.showHidden', type: 'toggle', def: false, label: 'Show hidden items', apply: v => { document.body.classList.toggle('grid-show-hidden', !!v); } }
]},
{ group: 'Reader shortcuts', rows: [
{ id: 'header.readerShortcuts', type: 'toggle', def: true, label: 'Show current document', apply: v => { window._headerReaderShortcuts = !!v; try { if (window.Cwtch && window.Cwtch.HeaderRenderer && typeof window.Cwtch.HeaderRenderer.render === 'function') window.Cwtch.HeaderRenderer.render(); } catch (e) { console.warn('[Settings] header render', e); } } },
{ id: 'header.shortcutCount', type: 'range', def: 3, min: 1, max: 20, step: 1, label: 'Shortcut limit', apply: v => { const _n = Number(v); window._headerShortcutCount = Number.isFinite(_n) ? Math.max(1, Math.min(20, Math.round(_n))) : 3; try { if (window.Cwtch && window.Cwtch.HeaderRenderer && typeof window.Cwtch.HeaderRenderer.render === 'function') window.Cwtch.HeaderRenderer.render(); } catch (e) { console.warn('[Settings] header render', e); } } },
{ id: 'header.showBookmark', type: 'toggle', def: true, label: 'Show bookmark button', apply: v => { window._headerShowBookmark = !!v; try { if (window.Cwtch && window.Cwtch.HeaderRenderer && typeof window.Cwtch.HeaderRenderer.render === 'function') window.Cwtch.HeaderRenderer.render(); } catch (e) { console.warn('[Settings] header render', e); } } },
{ id: 'header.showGraph', type: 'toggle', def: true, label: 'Show graph button', apply: v => { window._headerShowGraph = !!v; try { if (window.Cwtch && window.Cwtch.HeaderRenderer && typeof window.Cwtch.HeaderRenderer.render === 'function') window.Cwtch.HeaderRenderer.render(); } catch (e) { console.warn('[Settings] header render', e); } } },
{ id: 'header.showCalendar', type: 'toggle', def: true, label: 'Show calendar button', apply: v => { window._headerShowCalendar = !!v; try { if (window.Cwtch && window.Cwtch.HeaderRenderer && typeof window.Cwtch.HeaderRenderer.render === 'function') window.Cwtch.HeaderRenderer.render(); } catch (e) { console.warn('[Settings] header render', e); } } }
]},
{ group: 'Keyboard', rows: [
{ id: 'keyboard.hints', type: 'toggle', def: true, label: 'Show shortcut hints', planned: true, apply: () => {} },
{ id: 'keyboard.prefixTimeout', type: 'range', def: 1200, min: 1, max: 10000, step: 100, label: 'Prefix timeout (ms)', apply: () => {} },
{ id: 'keyboard.custom', type: 'custom', def: {}, label: 'Custom shortcuts', apply: () => { try { if (typeof Keyboard !== 'undefined' && Keyboard.uninstall && Keyboard.install) { Keyboard.uninstall(); Keyboard.install(); } } catch (e) { console.warn('[Settings] kbd reload', e); } } },
{ id: 'keyboard.macro', type: 'custom', def: [], label: 'Macros', apply: () => { try { if (typeof Keyboard !== 'undefined' && Keyboard.uninstall && Keyboard.install) { Keyboard.uninstall(); Keyboard.install(); } } catch (e) { console.warn('[Settings] kbd reload', e); } } },
{ id: 'keyboard.pageJumpBack', type: 'text', def: 'Alt+ArrowLeft', label: 'Page jump back', apply: v => { window._pageJumpBack = String(v || '').slice(0, 100); } },
{ id: 'keyboard.pageJumpForward', type: 'text', def: 'Alt+ArrowRight', label: 'Page jump forward', apply: v => { window._pageJumpForward = String(v || '').slice(0, 100); } }
]},
{ group: 'Editor', rows: [
{ id: 'editorBackend', type: 'display', def: 'contenteditable', label: 'Editor engine', apply: () => {} },
{ id: 'editor.spellCheck', type: 'toggle', def: false, label: 'Spell check', apply: v => { const _on = !!v; document.querySelectorAll('.editor__body, .editor__raw').forEach(el => { try { el.spellcheck = _on; } catch (e) { console.warn('[Settings] spellcheck', e); } }); if (window._spellCheckObserver) { try { window._spellCheckObserver.disconnect(); } catch {} window._spellCheckObserver = null; } if (!_on) return; if (typeof MutationObserver === 'function') { try { let _spTimer = null; window._spellCheckObserver = new MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) { if (n && n.nodeType === 1 && (n.classList && (n.classList.contains('editor__body') || n.classList.contains('editor__raw')))) { clearTimeout(_spTimer); _spTimer = setTimeout(() => { try { n.spellcheck = !!Prefs.get('setting.editor.spellCheck'); } catch {} }, 0); } } }); window._spellCheckObserver.observe(document.body, { childList: true, subtree: true }); } catch (e) { console.warn('[Settings] spellcheck observer', e); } } } },
{ id: 'editor.autoSave', type: 'toggle', def: true, label: 'Auto-save', apply: v => { if (!v && typeof Editor !== 'undefined' && Editor.flushPendingAutoSave) { try { Promise.resolve(Editor.flushPendingAutoSave()).catch(e => console.warn('[Settings] flush autosave', e)); } catch (e) { console.warn('[Settings]', e); } } } },
{ id: 'editor.debounceMs', type: 'range', def: 1500, min: 1, max: 30000, step: 100, label: 'Save delay (ms)', apply: v => { const _n = Number(v); window._editorDebounceMs = Number.isFinite(_n) ? Math.max(1, Math.min(30000, Math.round(_n))) : 1500; } },
{ id: 'editor.snapshotOnBlur', type: 'toggle', def: true, label: 'Snapshot on blur', planned: true, apply: () => {} },
{ id: 'editor.inputRules', type: 'toggle', def: true, label: 'Markdown quick input', planned: true, apply: () => {} },
{ id: 'editor.autoLink', type: 'toggle', def: true, label: 'Auto-link URLs', planned: true, apply: () => {} },
{ id: 'editor.smartPaste', type: 'toggle', def: true, label: 'Smart paste', planned: true, apply: () => {} },
{ id: 'editor.imeGuard', type: 'toggle', def: true, label: 'IME composition guard', apply: () => {} },
{ id: 'editor.selectionBubble', type: 'toggle', def: true, label: 'Selection bubble', apply: v => { const el = document.getElementById('selBubble'); if (el && !v) { el.hidden = true; } document.body.classList.toggle('no-selection-bubble', !v); try { if (typeof SelectionBubble !== 'undefined' && typeof SelectionBubble.init === 'function') { SelectionBubble.init(); } if (el && !v && typeof SelectionBubble !== 'undefined' && typeof SelectionBubble.hide === 'function') { SelectionBubble.hide(); } } catch (e) { console.warn('[Settings] selectionBubble', e); } } },
{ id: 'editor.liveKatex', type: 'toggle', def: true, label: 'Live formula render', apply: v => { window._editorLiveKatex = !!v; try { if (typeof window._editorRefreshPreview === 'function') window._editorRefreshPreview(); } catch (e) { console.warn('[Settings] katex refresh', e); } } },
{ id: 'editor.liveKatexDelay', type: 'range', def: 1200, min: 1, max: 30000, step: 100, label: 'Render delay (ms)', apply: v => { const _n = Number(v); window._editorLiveKatexDelay = Number.isFinite(_n) ? Math.max(1, Math.min(30000, Math.round(_n))) : 1200; } },
{ id: 'editor.mermaid', type: 'toggle', def: true, label: 'Mermaid render', apply: v => { window._editorMermaid = !!v; try { if (typeof window._editorRefreshPreview === 'function') window._editorRefreshPreview(); } catch (e) { console.warn('[Settings] mermaid refresh', e); } } },
{ id: 'editor.layoutMode', type: 'display', def: 'standard', label: 'Paragraph style', apply: () => {} },
{ id: 'editor.hyphenMode', type: 'seg', def: 'auto', label: 'Hyphenation', options: ['none','manual','auto'], apply: v => { const _v = (v === 'none' || v === 'manual') ? v : 'auto'; document.documentElement.style.setProperty('--hyphens', _v); } },
{ id: 'editor.lintLevel', type: 'seg', def: 'warn', label: 'Lint strictness', options: ['off','warn','error'], planned: true, apply: () => {} },
{ id: 'editor.undoDepth', type: 'range', def: 200, min: 1, max: 2000, step: 1, label: 'Undo stack depth', apply: v => { try { if (typeof Undo !== 'undefined' && typeof Undo.setMaxDepth === 'function') Undo.setMaxDepth(Number(v) || 200, true); } catch (e) { console.warn('[Settings] undoDepth', e); } } },
{ id: 'editor.undoPersist', type: 'toggle', def: false, label: 'Persist undo stack', planned: true, apply: () => {} }
]},
{ group: 'Level system', rows: [
{ id: 'levelSystem.userLevel', type: 'select', def: '3', label: 'Current level', options: ['0','1','2','3','4','5','6','7','8','9','10','99'], apply: v => { const _raw = Number(v); const n = Number.isFinite(_raw) ? Math.max(0, Math.min(99, Math.round(_raw))) : 3; document.documentElement.dataset.userLevel = String(n); } },
{ id: 'levelSystem.labels', type: 'custom', def: {}, label: 'Level names', apply: () => { try { if (typeof window._refreshLevelBadges === 'function') window._refreshLevelBadges(); else if (window.Cwtch && window.Cwtch.Bus && window.Cwtch.Bus.emit) window.Cwtch.Bus.emit('level:changed'); } catch (e) { console.warn('[Settings] level labels', e); } } },
{ id: 'levelSystem.colors', type: 'custom', def: {}, label: 'Level colors', apply: () => { try { if (typeof window._refreshLevelBadges === 'function') window._refreshLevelBadges(); else if (window.Cwtch && window.Cwtch.Bus && window.Cwtch.Bus.emit) window.Cwtch.Bus.emit('level:changed'); } catch (e) { console.warn('[Settings] level colors', e); } } },
{ id: 'levelSystem.showBadges', type: 'toggle', def: true, label: 'Show badges', apply: v => { document.querySelectorAll('.doc__level-badge, .item-row [data-field="level"]').forEach(el => { try { el.hidden = !v; } catch (e) { console.warn('[Settings] badges', e); } }); } },
{ id: 'levelSystem.strictMode', type: 'toggle', def: false, label: 'Strict mode', apply: v => { window._strictLevel = !!v; } },
{ id: 'levelSystem.autoTag', type: 'toggle', def: false, label: 'Auto-tag by level', apply: v => { window._levelAutoTag = !!v; } },
{ id: 'levelSystem.showInToc', type: 'toggle', def: true, label: 'Show level in TOC', apply: v => { window._levelShowInToc = !!v; } }
]},
{ group: 'SRS algorithm', rows: [
{ id: 'srs.algorithm', type: 'display', def: 'sm2', label: 'Algorithm', apply: () => {} },
{ id: 'srs.startEf', type: 'range', def: 2.5, min: 1.3, max: 3.0, step: 0.05, label: 'Start ease (SM-2)', apply: () => { try { ReviewEngine.invalidateDue(); } catch (e) {} } }
]},
{ group: 'SRS limits', rows: [
{ id: 'srs.newCardsEnabled', type: 'toggle', def: true, label: 'New cards per day', apply: () => { try { ReviewEngine.invalidateDue(); } catch (e) {} } },
{ id: 'srs.newCardLimit', type: 'range', def: 20, min: 1, max: 500, step: 1, label: 'New card limit', apply: v => { const _n = Number(v); window._srsNewCardLimit = Number.isFinite(_n) ? Math.max(1, Math.min(500, Math.round(_n))) : 20; try { Prefs.set('setting.srs.newCardLimit', window._srsNewCardLimit); } catch (e) { console.warn('[Settings] newCardLimit persist', e); } try { ReviewEngine.invalidateDue(); } catch (e) { console.warn('[Settings] invalidateDue', e); } } },
{ id: 'srs.reviewsEnabled', type: 'toggle', def: true, label: 'Reviews per day', apply: () => { try { ReviewEngine.invalidateDue(); } catch (e) { console.warn('[Settings] invalidateDue', e); } } },
{ id: 'srs.reviewLimit', type: 'range', def: 200, min: 1, max: 1000, step: 1, label: 'Review limit', apply: v => { const _n = Number(v); window._srsReviewLimit = Number.isFinite(_n) ? Math.max(1, Math.min(1000, Math.round(_n))) : 200; try { Prefs.set('setting.srs.reviewLimit', window._srsReviewLimit); } catch (e) { console.warn('[Settings] reviewLimit persist', e); } try { ReviewEngine.invalidateDue(); } catch (e) { console.warn('[Settings] invalidateDue', e); } } },
{ id: 'srs.learningSteps', type: 'text', def: '1, 10', label: 'Learning steps (min)', apply: v => { const _str = String(v == null ? '' : v).slice(0, 4000); const _parts = _str.split(','); const _clean = _parts.map(s => Number(String(s).trim())).filter(n => Number.isFinite(n) && n > 0 && n <= 100000).slice(0, 50); try { if (typeof ReviewEngine !== 'undefined' && ReviewEngine.invalidateDue) ReviewEngine.invalidateDue(); } catch (e) { console.warn('[Settings] invalidateDue', e); } } },
{ id: 'srs.requeueOnFail', type: 'toggle', def: true, label: 'Requeue on fail', apply: () => { try { ReviewEngine.invalidateDue(); } catch (e) {} } },
{ id: 'srs.showAnswerMs', type: 'range', def: 3000, min: 1, max: 60000, step: 100, label: 'Answer reveal time (ms)', apply: v => { const _n = Number(v); window._srsShowAnswerMs = Number.isFinite(_n) ? Math.max(1, Math.min(60000, _n)) : 3000; try { Prefs.set('setting.srs.showAnswerMs', window._srsShowAnswerMs); } catch (e) { console.warn('[Settings] showAnswerMs persist', e); } } },
]},
{ group: 'SRS card defaults', rows: [
{ id: 'srs.defaultDeckName', type: 'text', def: 'StudyOS', label: 'Default deck name', apply: v => { try { if (typeof ReviewEngine !== 'undefined' && ReviewEngine.invalidateDue) ReviewEngine.invalidateDue(); } catch (e) { console.warn('[Settings] invalidateDue', e); } } },
{ id: 'srs.autoTagNewCards', type: 'toggle', def: true, label: 'Auto-tag new cards', apply: () => {} },
{ id: 'srs.tagNewCardsWith', type: 'text', def: 'StudyOS', label: 'Default tag', validate: v => { if (typeof v !== 'string') return false; if (v.length > 200) return false; if (/[\u0000-\u001f\u007f]/.test(v)) return false; return true; }, apply: v => { try { const _orig = String(v == null ? 'StudyOS' : v); const s = _orig.replace(/[\/\u001f\u007f]+/g, '-').replace(/[\u0000-\u001f]/g, '').slice(0, 80); if (s !== _orig && Prefs.get('setting.srs.tagNewCardsWith') !== s) { setTimeout(() => { try { Prefs.set('setting.srs.tagNewCardsWith', s); } catch (e) { console.warn('[Settings] tagName deferred', e); } }, 0); } } catch (e) { console.warn('[Settings] tagName', e); } } },
{ id: 'srs.clozeEnabled', type: 'toggle', def: true, label: 'Enable cloze deletion {{c1::}}', apply: v => { window._srsClozeEnabled = !!v; } },
{ id: 'srs.clozePrefix', type: 'text', def: 'c', label: 'Cloze key prefix', planned: true, apply: () => {} },
{ id: 'srs.imageOcclusion', type: 'toggle', def: false, label: 'Image occlusion mode', planned: true, apply: () => {} },
{ id: 'srs.cardTemplate', type: 'text', def: 'default', label: 'Card template', planned: true, apply: () => {} },
{ id: 'srs.reviewHint', type: 'toggle', def: true, label: 'Show review hint', apply: v => { window._srsReviewHint = !!v; } },
{ id: 'srs.autoDifficulty', type: 'toggle', def: true, label: 'Auto difficulty from answer time', apply: v => { window._srsAutoDifficulty = !!v; } },
{ id: 'srs.filteredDecks', type: 'custom', def: [], label: 'Filtered decks', apply: () => { try { if (typeof ReviewEngine !== 'undefined' && ReviewEngine.invalidateDue) ReviewEngine.invalidateDue(); } catch (e) { console.warn('[Settings] invalidateDue', e); } } }
]},
{ group: 'Library display', rows: [
{ id: 'library.viewMode', type: 'seg', def: 'grid', label: 'Default view', options: ['grid','list'], apply: v => { const _v = (v === 'list') ? 'list' : 'grid'; if (document.body) { document.body.dataset.libView = _v; document.body.classList.toggle('lib-view-list', _v === 'list'); document.body.classList.toggle('lib-view-grid', _v === 'grid'); } if (State.get('currentView') === 'library' && (State.get('libraryItems') || []).length) { if (_libViewTimer) clearTimeout(_libViewTimer); _libViewTimer = setTimeout(() => { _libViewTimer = null; try { if (typeof ContentView !== 'undefined' && ContentView.showLibrary) ContentView.showLibrary(); } catch (e) { console.warn('[Settings]', e); } }, 300); } } },
{ id: 'library.sortMode', type: 'select', def: 'name-asc', label: 'Default sort', options: ['name-asc','name-desc','recent','added','modified','size'], apply: v => { const _mapped = v === 'name-asc' ? 'source' : v === 'name-desc' ? 'title' : (v === 'recent' || v === 'added' || v === 'modified') ? 'recent' : v === 'size' ? 'size' : 'source'; try { window._libSortBy = _mapped; State.set('librarySortBy', _mapped); } catch (e) { console.warn('[Settings] sortMode', e); } if (State.get('currentView') === 'library' && (State.get('libraryItems') || []).length) { if (_libSortTimer) clearTimeout(_libSortTimer); _libSortTimer = setTimeout(() => { _libSortTimer = null; try { if (typeof ContentView !== 'undefined' && ContentView.showLibrary) ContentView.showLibrary(); } catch (e) { console.warn('[Settings]', e); } }, 300); } } },
{ id: 'library.showCovers', type: 'toggle', def: true, label: 'Show covers', apply: v => { const _on = !!v; document.body.classList.toggle('no-covers', !_on); document.body.classList.toggle('show-covers', _on); if (State.get('currentView') === 'library' && (State.get('libraryItems') || []).length) { if (_libCoversTimer) clearTimeout(_libCoversTimer); _libCoversTimer = setTimeout(() => { _libCoversTimer = null; try { if (typeof ContentView !== 'undefined' && ContentView.showLibrary) ContentView.showLibrary(); } catch (e) { console.warn('[Settings]', e); } }, 200); } } },
{ id: 'library.cardDensity', type: 'seg', def: 'cozy', label: 'Card density', options: ['compact','cozy','roomy'], apply: v => { const _v = (v === 'compact' || v === 'roomy') ? v : 'cozy'; document.documentElement.dataset.cardDensity = _v; document.body.dataset.cardDensity = _v; if (State.get('currentView') === 'library' && (State.get('libraryItems') || []).length) { try { ContentView.showLibrary(); } catch (e) { console.warn('[Settings]', e); } } } }
]},
{ group: 'Library categorization', rows: [
{ id: 'library.autoCategorize', type: 'toggle', def: true, label: 'Auto-categorize', planned: true, apply: () => {} },
{ id: 'library.hideEmptyCategories', type: 'toggle', def: false, label: 'Hide empty categories', planned: true, apply: () => {} },
{ id: 'library.showCounts', type: 'toggle', def: true, label: 'Show counts', planned: true, apply: () => {} },
{ id: 'library.smartFolders', type: 'custom', def: [], label: 'Smart folders', apply: () => { try { if (State.get('currentView') === 'library') ContentView.showLibrary(); } catch (e) { console.warn('[Settings] smartFolders', e); } } },
{ id: 'library.tagAliases', type: 'custom', def: {}, label: 'Tag aliases', apply: () => { try { if (State.get('currentView') === 'library') ContentView.showLibrary(); } catch (e) { console.warn('[Settings] tagAliases', e); } } },
{ id: 'library.tagHierarchy', type: 'custom', def: {}, label: 'Tag hierarchy', apply: () => { try { if (State.get('currentView') === 'library') ContentView.showLibrary(); } catch (e) { console.warn('[Settings] tagHierarchy', e); } } },
{ id: 'library.customProperties', type: 'custom', def: [], label: 'Custom properties', apply: () => { try { if (State.get('currentView') === 'library') ContentView.showLibrary(); } catch (e) { console.warn('[Settings] customProps', e); } } },
{ id: 'library.calendarView', type: 'toggle', def: true, label: 'Enable calendar view', apply: v => { window._libCalendarView = !!v; } },
{ id: 'library.kanbanView', type: 'toggle', def: true, label: 'Enable kanban view', apply: v => { window._libKanbanView = !!v; } },
{ id: 'library.timelineView', type: 'toggle', def: true, label: 'Enable timeline view', apply: v => { window._libTimelineView = !!v; } },
{ id: 'library.graphView', type: 'toggle', def: true, label: 'Enable graph view', apply: v => { window._libGraphView = !!v; } }
]},
{ group: 'Library recent and starred', rows: [
{ id: 'library.recentLimit', type: 'range', def: 100, min: 1, max: 1000, step: 1, label: 'Recent items limit', apply: v => { const _n = Number(v); window._recentLimit = Number.isFinite(_n) ? Math.max(1, Math.min(1000, Math.round(_n))) : 100; } },
{ id: 'library.starOrder', type: 'select', def: 'recent', label: 'Starred sort', options: ['recent','name','added'], apply: v => { window._starOrder = (v === 'name' || v === 'added') ? v : 'recent'; } },
{ id: 'library.bookmarksLimit', type: 'range', def: 50, min: 1, max: 500, step: 1, label: 'Bookmarks per doc', apply: v => { const _n = Number(v); window._bookmarksLimit = Number.isFinite(_n) ? Math.max(1, Math.min(500, Math.round(_n))) : 50; try { Prefs.set('setting.library.bookmarksLimit', window._bookmarksLimit); } catch (e) { console.warn('[Settings] bookmarksLimit persist', e); } } },
{ id: 'library.quickCaptureKey', type: 'text', def: 'Mod+Shift+N', label: 'Quick capture shortcut', apply: () => {} },
{ id: 'library.inboxFolder', type: 'text', def: 'Inbox', label: 'Inbox folder name', apply: v => { window._inboxFolder = v || 'Inbox'; } }
]},
{ group: 'Library user files', rows: [
{ id: 'library.userFilesVisible', type: 'toggle', def: true, label: 'Show user files area', apply: v => { const _on = !!v; document.body.classList.toggle('hide-user-files', !_on); document.body.classList.toggle('show-user-files', _on); } },
{ id: 'library.confirmDelete', type: 'toggle', def: true, label: 'Confirm before delete', apply: v => { window._confirmDelete = !!v; try { Prefs.set('setting.library.confirmDelete', !!v); } catch (e) { console.warn('[Settings] confirmDelete persist', e); } } },
{ id: 'library.dailyNoteFolder', type: 'text', def: 'Daily', label: 'Daily note folder', apply: () => {} },
{ id: 'library.duplicateAction', type: 'toggle', def: true, label: 'Show Duplicate in context menu', planned: true, apply: () => {} },
{ id: 'library.moveAction', type: 'toggle', def: true, label: 'Show Move to folder in context menu', planned: true, apply: () => {} }
]},
{ group: 'Full-text search', rows: [
{ id: 'fts.enabled', type: 'toggle', def: true, label: 'Enable search', apply: v => { window._ftsEnabled = !!v; } },
{ id: 'fts.indexOnSave', type: 'toggle', def: true, label: 'Update index on save', apply: v => { window._ftsIndexOnSave = !!v; } },
{ id: 'fts.boostTitle', type: 'range', def: 3, min: 1, max: 20, step: 1, label: 'Title weight', apply: v => { const _n = Number(v); window._ftsBoostTitle = Number.isFinite(_n) ? Math.max(1, Math.min(20, Math.round(_n))) : 3; } },
{ id: 'fts.recencyHalfLife', type: 'range', def: 60, min: 1, max: 3650, step: 1, label: 'Recency half-life (days)', apply: v => { const _n = Number(v); window._ftsRecencyHalfLife = Number.isFinite(_n) ? Math.max(1, Math.min(3650, Math.round(_n))) : 60; } },
{ id: 'fts.regexSearch', type: 'toggle', def: false, label: 'Regex search mode', apply: v => { window._ftsRegex = !!v; } },
{ id: 'fts.fuzzyMatch', type: 'toggle', def: true, label: 'Fuzzy matching', apply: v => { window._ftsFuzzy = !!v; } },
{ id: 'fts.searchHistory', type: 'toggle', def: true, label: 'Save search history', apply: v => { window._ftsSearchHistory = !!v; } },
{ id: 'fts.searchHistoryLimit', type: 'range', def: 30, min: 5, max: 200, step: 1, label: 'Search history size', apply: v => { const _n = Number(v); window._ftsSearchHistoryLimit = Number.isFinite(_n) ? Math.max(5, Math.min(200, Math.round(_n))) : 30; } },
{ id: 'fts.groupResults', type: 'toggle', def: false, label: 'Group results by kind', apply: v => { window._ftsGroupResults = !!v; } },
{ id: 'fts.tfidfRecommend', type: 'toggle', def: true, label: 'TF-IDF related recommendations', apply: v => { window._ftsTfidf = !!v; } }
]},
{ group: 'Reader', rows: [
{ id: 'reader.invertImages', type: 'toggle', def: true, label: 'Invert images in dark mode', apply: v => { document.body.classList.toggle('invert-images', !!v); } },
{ id: 'reader.showToc', type: 'toggle', def: true, label: 'Show table of contents', apply: v => { window._readerShowToc = !!v; } },
{ id: 'reader.focusMode', type: 'toggle', def: false, label: 'Focus mode (hide UI)', apply: v => { const _on = !!v; document.body.classList.toggle('focus-mode', _on); try { document.querySelectorAll('[data-focus-mode-toggle]').forEach(el => el.setAttribute('aria-pressed', String(_on))); } catch {} } },
{ id: 'reader.showBookmarks', type: 'toggle', def: true, label: 'Show bookmark button', apply: v => { window._readerShowBookmarks = !!v; } },
{ id: 'reader.showBacklinks', type: 'toggle', def: true, label: 'Show backlinks panel', apply: v => { window._readerShowBacklinks = !!v; } },
{ id: 'reader.showProgressRing', type: 'toggle', def: true, label: 'Show reading progress ring', apply: v => { window._readerShowProgressRing = !!v; const el = document.getElementById('readingProgress'); if (el) el.hidden = !v; try { if (window.Cwtch && window.Cwtch.ReadingProgress && typeof window.Cwtch.ReadingProgress.init === 'function') window.Cwtch.ReadingProgress.init(); } catch (e) { console.warn('[Settings] progress init', e); } } },
{ id: 'reader.quickSwitcher', type: 'toggle', def: true, label: 'Quick switcher (Ctrl+O)', apply: v => { window._quickSwitcherEnabled = !!v; } },
{ id: 'reader.pageJumpStackSize', type: 'range', def: 20, min: 5, max: 100, step: 1, label: 'Page jump history size', apply: v => { const _n = Number(v); window._pageJumpStackSize = Number.isFinite(_n) ? Math.max(5, Math.min(100, Math.round(_n))) : 20; } }
]},
{ group: 'Music', rows: [
{ id: 'audio.enabled', type: 'toggle', def: false, label: 'Enable audio playback', apply: v => { const _on = !!v; const el = document.getElementById('audioPlayer'); if (el && !_on) { el.hidden = true; try { const a = document.getElementById('audioEl'); if (a) { a.pause(); a.removeAttribute('src'); if (a._assetUrl) { try { URL.revokeObjectURL(a._assetUrl); } catch {} a._assetUrl = null; } a.load(); } } catch (e) {} } document.body.classList.toggle('no-audio', !_on); document.body.classList.toggle('audio-enabled', _on); } },
{ id: 'audio.volume', type: 'range', def: 0.5, min: 0, max: 1, step: 0.05, label: 'Volume', apply: v => { try { const a = document.getElementById('audioEl'); const _v = Number(v); if (a && Number.isFinite(_v)) a.volume = Math.max(0, Math.min(1, _v)); } catch (e) {} } },
{ id: 'audio.playMode', type: 'seg', def: 'sequential', label: 'Play mode', options: ['sequential','repeat','shuffle'], apply: v => { window._audioPlayMode = (v === 'repeat' || v === 'shuffle') ? v : 'sequential'; } },
{ id: 'audio.defaultPlaylist', type: 'text', def: '', label: 'Default playlist', apply: v => { window._audioDefaultPlaylist = v || ''; } },
{ id: 'audio.duckOnTTS', type: 'toggle', def: true, label: 'Duck on TTS', apply: v => { window._audioDuckOnTTS = !!v; } },
{ id: 'audio.abcNotation', type: 'toggle', def: true, label: 'Render ABC notation', apply: v => { window._audioAbc = !!v; } },
{ id: 'audio.mhchem', type: 'toggle', def: true, label: 'Render mhchem formulas', apply: v => { window._audioMhchem = !!v; } }
]},
{ group: 'Audio storage', rows: [
{ id: 'audio.maxStorageMB', type: 'range', def: 500, min: 1, max: 50000, step: 1, label: 'Storage limit (MB)', apply: v => { const _n = Number(v); window._audioMaxStorageMB = Number.isFinite(_n) ? Math.max(1, Math.min(50000, Math.round(_n))) : 500; } },
{ id: 'audio.compressBitrate', type: 'select', def: '128', label: 'Upload bitrate', options: ['original','128','192','320'], apply: v => { window._audioCompressBitrate = (v === 'original' || v === '192' || v === '320') ? v : '128'; } },
{ id: 'audio.waveform', type: 'toggle', def: true, label: 'Show waveform', apply: v => { window._audioWaveform = !!v; } },
{ id: 'audio.sliceMarkers', type: 'toggle', def: true, label: 'Enable time markers', apply: v => { window._audioSliceMarkers = !!v; } },
{ id: 'audio.ambient', type: 'toggle', def: false, label: 'Ambient sound', apply: v => { window._audioAmbient = !!v; } }
]},
{ group: 'Canvas', rows: [
{ id: 'canvas.preset', type: 'select', def: 'default', label: 'Default canvas size', options: ['default','landscape','A4','A5','square'], apply: v => { window._canvasPreset = (v === 'landscape' || v === 'A4' || v === 'A5' || v === 'square') ? v : 'default'; } },
{ id: 'canvas.strokeWidth', type: 'range', def: 2, min: 0, max: 100, step: 1, label: 'Default stroke width', apply: v => { const _sw = Number(v); window._canvasStrokeWidth = Number.isFinite(_sw) ? Math.max(0, Math.min(100, _sw)) : 2; } },
{ id: 'canvas.color', type: 'color', def: 'rgba(0,0,0,1)', label: 'Default color', apply: v => { const _c = String(v == null ? 'rgba(0,0,0,1)' : v).slice(0, 64); window._canvasColor = /^(#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]{0,40}\))$/i.test(_c) ? _c : 'rgba(0,0,0,1)'; } },
{ id: 'canvas.snap', type: 'toggle', def: true, label: 'Grid snap', apply: v => { window._canvasSnap = !!v; } },
{ id: 'canvas.snapGrid', type: 'range', def: 10, min: 1, max: 200, step: 1, label: 'Snap step', apply: v => { const _n = Number(v); window._canvasSnapGrid = Number.isFinite(_n) ? Math.max(1, Math.min(200, Math.round(_n))) : 10; } },
{ id: 'canvas.smooth', type: 'toggle', def: true, label: 'Stroke smoothing', apply: v => { window._canvasSmooth = !!v; } },
{ id: 'canvas.infinite', type: 'toggle', def: false, label: 'Infinite canvas', apply: v => { window._canvasInfinite = !!v; } },
{ id: 'canvas.layers', type: 'toggle', def: true, label: 'Layer support', apply: v => { window._canvasLayers = !!v; } },
{ id: 'canvas.imageOcclusion', type: 'toggle', def: false, label: 'Image occlusion regions', apply: v => { window._canvasOcclusion = !!v; } }
]},
{ group: 'Text-to-speech', rows: [
{ id: 'tts.voice', type: 'select', def: 'system', label: 'Voice', options: ['system'], apply: v => { window._ttsVoice = v; } },
{ id: 'tts.rate', type: 'range', def: 1.0, min: 0.5, max: 2.0, step: 0.1, label: 'Rate', apply: v => { const _n = Number(v); window._ttsRate = Number.isFinite(_n) ? Math.max(0.5, Math.min(2.0, _n)) : 1.0; } },
{ id: 'tts.pitch', type: 'range', def: 1.0, min: 0, max: 2.0, step: 0.1, label: 'Pitch', apply: v => { const _n = Number(v); window._ttsPitch = Number.isFinite(_n) ? Math.max(0, Math.min(2.0, _n)) : 1.0; } }
]},
{ group: 'Audio timeline', rows: [
{ id: 'audioSync.autoScroll', type: 'toggle', def: true, label: 'Auto-scroll to current line', apply: v => { window._audioSyncAutoScroll = !!v; } },
{ id: 'audioSync.highlightColor', type: 'color', def: 'rgba(74,140,255,1)', label: 'Highlight color', apply: v => { const _c = String(v == null ? 'rgba(74,140,255,1)' : v).slice(0, 64); window._audioSyncHighlightColor = /^(#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]{0,40}\)|hsla?\([^)]{0,40}\))$/i.test(_c) ? _c : 'rgba(74,140,255,1)'; } }
]},
{ group: 'AI assistant', rows: [
{ id: 'ai.enabled', type: 'toggle', def: false, label: 'Enable AI', validate: v => { if (!v) return true; try { const { Permissions } = window.Cwtch || {}; if (!Permissions) return true; if (Permissions.isGranted('ai')) return true; Permissions.grant('ai', 'user-enabled AI assistant', 'Document text and selected passages may be sent to the configured endpoint. No telemetry is collected by CwtchLib itself.'); return true; } catch (e) { console.warn('[Settings] ai consent', e); return true; } }, apply: v => { const _on = !!v; window._aiEnabled = _on; if (_on) { let _ep = ''; try { _ep = String(Prefs.get('setting.ai.endpoint') || '').trim(); } catch {} if (!_ep) { try { if (typeof Toast !== 'undefined') Toast.show('AI enabled but no endpoint configured'); } catch {} } } } },
{ id: 'ai.endpoint', type: 'text', def: 'http://localhost:11434', label: 'Ollama endpoint', apply: v => { window._aiEndpoint = String(v || '').slice(0, 500); } },
{ id: 'ai.model', type: 'text', def: 'llama3.2', label: 'Model', apply: v => { window._aiModel = v || ''; } },
{ id: 'ai.temperature', type: 'range', def: 0.7, min: 0, max: 2, step: 0.1, label: 'Temperature', apply: v => { const _n = Number(v); window._aiTemperature = Number.isFinite(_n) ? Math.max(0, Math.min(2, _n)) : 0.7; } },
{ id: 'ai.streaming', type: 'toggle', def: true, label: 'Streaming output', apply: v => { window._aiStreaming = !!v; } }
]},
{ group: 'Speech recognition', rows: [
{ id: 'asr.provider', type: 'select', def: 'local-whisper', label: 'Provider', options: ['local-whisper','local-server','openai','deepgram','assemblyai','revai'], apply: v => { window._asrProvider = v; } },
{ id: 'asr.serverUrl', type: 'text', def: '', label: 'Local server URL', apply: v => { window._asrServerUrl = v || ''; } },
{ id: 'asr.apiKey', type: 'password', def: '', label: 'API key', apply: v => { try { if (v) console.info('[Settings] ASR API key configured'); } catch {} } },
{ id: 'asr.language', type: 'select', def: 'auto', label: 'Language', options: ['auto','zh','en','ja','ko','es','fr','de','ar','hi'], apply: v => { window._asrLanguage = v; } },
{ id: 'asr.modelSize', type: 'select', def: 'tiny', label: 'Model size', options: ['tiny','base','small','medium','large'], apply: v => { window._asrModelSize = v; } }
]},
{ group: 'OCR', rows: [
{ id: 'ocr.language', type: 'select', def: 'eng', label: 'OCR language', options: ['eng','chi_sim','chi_tra','jpn','kor','ara','heb','dev','fra','deu','spa'], apply: v => { window._ocrLanguage = v; } },
{ id: 'ocr.extractText', type: 'toggle', def: true, label: 'Extract text layer', apply: v => { window._ocrExtractText = !!v; } },
{ id: 'ocr.maxPages', type: 'range', def: 100, min: 1, max: 5000, step: 1, label: 'Max pages', apply: v => { const _n = Number(v); window._ocrMaxPages = Number.isFinite(_n) ? Math.max(1, Math.min(5000, Math.round(_n))) : 100; } }
]},
{ group: 'Mathpix', rows: [
{ id: 'mathpix.appId', type: 'text', def: '', label: 'App ID', apply: v => { window._mathpixAppId = v || ''; } },
{ id: 'mathpix.appKey', type: 'password', def: '', label: 'App key', apply: v => { try { if (v) console.info('[Settings] Mathpix App key configured'); } catch {} } }
]},
{ group: 'Handwriting recognition', rows: [
{ id: 'handwriting.engine', type: 'seg', def: 'local', label: 'Engine', options: ['local','mathpix'], apply: v => { window._handwritingEngine = v; } },
{ id: 'handwriting.matchThreshold', type: 'range', def: 0.5, min: 0, max: 1, step: 0.05, label: 'Match threshold', apply: v => { const _n = Number(v); window._handwritingMatchThreshold = Number.isFinite(_n) ? Math.max(0, Math.min(1, _n)) : 0.5; } }
]},
{ group: 'Collaboration', rows: [
{ id: 'collab.enabled', type: 'toggle', def: false, label: 'Enable collaboration', validate: v => { if (!v) return true; try { const { Permissions } = window.Cwtch || {}; if (!Permissions) return true; if (Permissions.isGranted('collab')) return true; Permissions.grant('collab', 'user-enabled collaboration', 'Document content and presence metadata will be shared with peers connected to the configured signaling server. No data is sent to CwtchLib operators.'); return true; } catch (e) { console.warn('[Settings] collab consent', e); return true; } }, apply: v => { const _on = !!v; window._collabEnabled = _on; if (_on) { let _url = ''; try { _url = String(Prefs.get('setting.collab.serverUrl') || '').trim(); } catch (e) { console.warn('[Settings] collab url', e); } if (!_url) { try { if (typeof Toast !== 'undefined') Toast.show('Collaboration enabled but no signaling server configured'); } catch (e) { console.warn('[Settings] collab toast', e); } } } } },
{ id: 'collab.serverUrl', type: 'text', def: '', label: 'Signaling server', apply: v => { window._collabServerUrl = String(v || '').slice(0, 500); } },
{ id: 'collab.roomId', type: 'text', def: '', label: 'Room ID', apply: v => { window._collabRoomId = v || ''; } },
{ id: 'collab.localSync', type: 'toggle', def: false, label: 'Same-browser sync', apply: v => { window._collabLocalSync = !!v; } },
{ id: 'collab.syncSettings', type: 'toggle', def: false, label: 'Sync settings', apply: v => { window._collabSyncSettings = !!v; } },
{ id: 'collab.remoteCursors', type: 'toggle', def: true, label: 'Show remote cursors', apply: v => { window._collabRemoteCursors = !!v; } },
{ id: 'collab.crdt', type: 'toggle', def: false, label: 'CRDT merge (experimental)', apply: v => { window._collabCrdt = !!v; } },
{ id: 'collab.comments', type: 'toggle', def: false, label: 'Remote comments', apply: v => { window._collabComments = !!v; } },
{ id: 'collab.whiteboard', type: 'toggle', def: false, label: 'Shared whiteboard', apply: v => { window._collabWhiteboard = !!v; } }
]},
{ group: 'TURN relay', rows: [
{ id: 'turn.url', type: 'text', def: '', label: 'TURN URL', apply: v => { window._turnUrl = v || ''; } },
{ id: 'turn.secret', type: 'password', def: '', label: 'Shared secret', apply: v => { try { if (v) console.info('[Settings] TURN secret configured'); } catch {} } },
{ id: 'turn.user', type: 'text', def: 'study-os', label: 'Username', apply: v => { window._turnUser = v || 'study-os'; } }
]},
{ group: 'Backup', rows: [
{ id: 'backup.auto', type: 'toggle', def: false, label: 'Auto backup', apply: v => { window._backupAuto = !!v; } },
{ id: 'backup.intervalHours', type: 'range', def: 24, min: 1, max: 8760, step: 1, label: 'Backup interval (hours)', apply: v => { const _n = Number(v); window._backupIntervalHours = Number.isFinite(_n) ? Math.max(1, Math.min(8760, Math.round(_n))) : 24; } },
{ id: 'backup.location', type: 'select', def: 'vfs', label: 'Backup location', options: ['vfs','local-folder'], apply: v => { window._backupLocation = (v === 'local-folder') ? v : 'vfs'; } },
{ id: 'backup.integrityCheck', type: 'toggle', def: true, label: 'Verify hashes on backup', apply: v => { window._backupIntegrityCheck = !!v; } },
{ id: 'backup.snapshotCount', type: 'range', def: 10, min: 1, max: 100, step: 1, label: 'Keep snapshots', apply: v => { const _n = Number(v); window._backupSnapshotCount = Number.isFinite(_n) ? Math.max(1, Math.min(100, Math.round(_n))) : 10; } },
{ id: 'backup.crashRecovery', type: 'toggle', def: true, label: 'Crash recovery snapshots', apply: v => { window._backupCrashRecovery = !!v; } }
]},
{ group: 'Cache', rows: [
{ id: 'storage.persist', type: 'toggle', def: false, label: 'Request persistent storage', apply: async v => { if (!v) return; try { if (navigator.storage && typeof navigator.storage.persist === 'function') { const _granted = await navigator.storage.persist(); if (typeof window.Cwtch !== 'undefined' && window.Cwtch.Toast && window.Cwtch.Toast.show) window.Cwtch.Toast.show(_granted ? 'Persistent storage granted' : 'Persistent storage was not granted'); } else if (window.Cwtch && window.Cwtch.Toast) window.Cwtch.Toast.show('Persistent storage API unavailable'); } catch (e) { console.warn('[Settings] persist failed', e); } } }
]},
{ group: 'Updates', rows: [
{ id: 'updater.auto', type: 'toggle', def: true, label: 'Auto-check for updates', apply: v => { window._updaterAuto = !!v; } },
{ id: 'updater.intervalHours', type: 'range', def: 24, min: 1, max: 8760, step: 1, label: 'Check interval (hours)', apply: v => { const _n = Number(v); window._updaterIntervalHours = Number.isFinite(_n) ? Math.max(1, Math.min(8760, Math.round(_n))) : 24; } }
]},
{ group: 'Diagnostics', rows: [
{ id: 'diagnostics.visible', type: 'toggle', def: true, label: 'Show diagnostics panel', apply: v => { const _on = !!v; document.body.classList.toggle('hide-diagnostics', !_on); document.body.classList.toggle('show-diagnostics', _on); } },
{ id: 'developer.logging', type: 'toggle', def: false, label: 'Debug logging', apply: v => { window._debugLogging = !!v; } },
{ id: 'developer.lazyLoad', type: 'toggle', def: true, label: 'Lazy-load modules', apply: v => { window._lazyLoadModules = !!v; } },
{ id: 'developer.worker', type: 'toggle', def: false, label: 'Offload to Web Worker', apply: v => { window._useWorker = !!v; } },
{ id: 'developer.axeAudit', type: 'toggle', def: false, label: 'Run axe-core audit on boot', apply: v => { window._axeAudit = !!v; } },
{ id: 'developer.csp', type: 'display', def: 'meta', label: 'CSP mode', apply: () => {} }
]},
{ group: 'Privacy', rows: [
{ id: 'privacy.localOnly', type: 'display', def: 'true', label: 'Local-only data', planned: true, apply: () => {} },
{ id: 'privacy.clearOnExit', type: 'toggle', def: false, label: 'Clear session on exit', apply: v => { const _prev = window._cwtchClearOnExit; if (_prev && _prev.installed && typeof _prev.fn === 'function') { try { window.removeEventListener('beforeunload', _prev.fn); } catch (e) { console.warn('[Settings] removeBeforeUnload', e); } } if (v) { const fn = () => { try { sessionStorage.clear(); } catch (e) { console.warn('[Settings] clearSession', e); } }; window._cwtchClearOnExit = { fn, installed: true }; try { window.addEventListener('beforeunload', fn); } catch (e) { console.warn('[Settings] addBeforeUnload', e); } } else { try { if (window._cwtchClearOnExit && typeof window._cwtchClearOnExit.fn === 'function') window.removeEventListener('beforeunload', window._cwtchClearOnExit.fn); } catch (e) { console.warn('[Settings] removeBeforeUnload2', e); } window._cwtchClearOnExit = null; } } },
{ id: 'privacy.vault', type: 'toggle', def: false, label: 'Encrypted vault (Argon2 + AES-GCM)', apply: v => { const _on = !!v; if (_on && !(window.crypto && window.crypto.subtle)) { try { if (typeof Toast !== 'undefined') Toast.show('Web Crypto not available'); } catch {} window._privacyVault = false; return; } window._privacyVault = _on; } },
{ id: 'privacy.biometric', type: 'toggle', def: false, label: 'Biometric unlock (WebAuthn)', apply: v => { const _on = !!v; if (_on && !(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get)) { try { if (typeof Toast !== 'undefined') Toast.show('WebAuthn not available in this browser'); } catch {} window._privacyBiometric = false; return; } window._privacyBiometric = _on; } },
{ id: 'privacy.sessionLock', type: 'range', def: 0, min: 0, max: 480, step: 1, label: 'Idle lock (min, 0=off)', apply: v => { const _n = Number(v); const _mins = Number.isFinite(_n) ? Math.max(0, Math.min(480, Math.round(_n))) : 0; window._privacySessionLock = _mins; try { if (window._cwtchIdleTimer) { clearTimeout(window._cwtchIdleTimer); window._cwtchIdleTimer = null; } } catch (e) { console.warn('[Settings] idle clear', e); } } },
{ id: 'privacy.telemetry', type: 'display', def: 'off', label: 'Telemetry', apply: () => {} }
]}
];
function _cloneDef(v) {
if (Array.isArray(v)) return v.map(x => _cloneDef(x));
if (v && typeof v === 'object') {
if (v instanceof Date) return new Date(v.getTime());
if (typeof v.then === 'function') return v;
if (typeof v === 'function') return v;
if (v instanceof WeakMap || v instanceof WeakSet || v instanceof WeakRef) return undefined;
if (typeof v === 'symbol') return v;
try { return structuredClone(v); }
catch (e) {
try { return JSON.parse(JSON.stringify(v)); }
catch (e2) { console.warn('[Settings] clone failed', e2); try { return Object.assign({}, v); } catch (e3) { return v; } }
}
}
return v;
}
function applyRow(row) {
if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id) return { ok: false, id: '?', label: '?' };
try {
let _storedPre = undefined;
try { _storedPre = Prefs.get('setting.' + row.id); } catch (e) { console.warn('[Settings] applyRow pre-read', row.id, e); }
if (row.def !== undefined && row.def !== null) {
const _dt1 = typeof row.def;
if (_dt1 !== 'string' && _dt1 !== 'number' && _dt1 !== 'boolean' && _dt1 !== 'object') return { ok: false, val: row.def, id: row.id, label: row.label || row.id, group: row._group || null, error: new TypeError('Unsupported def type: ' + _dt1) };
if (_dt1 === 'object' && typeof row.def.then === 'function') return { ok: false, val: row.def, id: row.id, label: row.label || row.id, group: row._group || null, error: new TypeError('def cannot be a Promise') };
}
if (_storedPre !== undefined) { const _dtS = typeof _storedPre; if (_dtS === 'object' && _storedPre !== null && typeof _storedPre.then === 'function') return { ok: false, val: _storedPre, id: row.id, label: row.label || row.id, group: row._group || null, error: new TypeError('stored value is a Promise') }; try { const _r2 = (typeof row.apply === 'function') ? row.apply(_storedPre) : undefined; if (_r2 && typeof _r2.then === 'function') _r2.catch(e => console.error('[Settings] apply failed for', row.id, e)); return { ok: true, val: _storedPre, id: row.id, label: row.label || row.id, group: row._group || null }; } catch (e) { console.error('[Settings] apply failed for', row.id, e); return { ok: false, val: _storedPre, id: row.id, label: row.label || row.id, group: row._group || null, error: e }; } }
if (row.def !== undefined && row.def !== null) {
const _dt = typeof row.def;
const _okType = _dt === 'string' || _dt === 'number' || _dt === 'boolean' || _dt === 'object' || _dt === 'symbol' || _dt === 'bigint';
if (!_okType) return { ok: false, val: row.def, id: row.id, label: row.label || row.id, group: row._group || null, error: new TypeError('Unsupported def type: ' + _dt) };
if (_dt === 'object' && row.def !== null && typeof row.def.then === 'function') return { ok: false, val: row.def, id: row.id, label: row.label || row.id, group: row._group || null, error: new TypeError('def cannot be a Promise') };
if (_dt === 'object' && row.def !== null && typeof row.def.nodeType === 'number') return { ok: false, val: row.def, id: row.id, label: row.label || row.id, group: row._group || null, error: new TypeError('def cannot be a DOM node') };
if (_dt === 'object' && row.def !== null && (row.def instanceof WeakMap || row.def instanceof WeakSet || row.def instanceof WeakRef)) return { ok: false, val: row.def, id: row.id, label: row.label || row.id, group: row._group || null, error: new TypeError('def cannot be a WeakMap/WeakSet/WeakRef') };
}
let _stored = _storedPre;
let val;
if (_stored === undefined || _stored === null) {
val = _cloneDef(row.def);
} else if (typeof _stored === 'string' && (_stored === 'undefined' || _stored === 'null') && (row.def !== 'undefined' && row.def !== 'null')) {
val = _cloneDef(row.def);
} else {
val = _stored;
}
try {
const _r = (typeof row.apply === 'function') ? row.apply(val) : undefined;
if (_r && typeof _r.then === 'function') _r.catch(e => console.error('[Settings] apply failed for', row.id, e));
} catch (e) {
console.error('[Settings] apply failed for', row.id, e);
return { ok: false, val, id: row.id, label: row.label || row.id, group: row._group || null, error: e };
}
return { ok: true, val, id: row.id, label: row.label || row.id, group: row._group || null };
} catch (e) {
console.error('[Settings] applyRow outer failed', row.id, e);
return { ok: false, id: row.id, label: row.label || row.id, group: row._group || null, error: e };
}
}
  let _applyAllInProgress = false;
  let _applyAllQueued = false;
  let _applyAllQueuedFailures = null;
  function applyAll() {
  if (_applyAllQueued) { console.warn('[Settings] applyAll nested call'); return _applyAllQueuedFailures || []; }
  if (_applyAllInProgress) { _applyAllQueued = true; console.warn('[Settings] applyAll reentered, queued'); return []; }
  _applyAllInProgress = true;
  _applyAllQueuedFailures = null;
  const failures = [];
if (_expandedPending) { try { _flushExpandedWrite(); } catch (e) { console.warn('[Settings] flush before apply', e); } }
try {
const _seenIds = new Set();
SCHEMA.forEach(g => {
if (!g || !Array.isArray(g.rows)) return;
g.rows.forEach(row => {
if (!row || typeof row !== 'object') return;
if (typeof row.id !== 'string' || !row.id) return;
if (_isPlanned(row)) return;
if (_seenIds.has(row.id)) { console.warn('[Settings] duplicate row id in SCHEMA', row.id); return; }
_seenIds.add(row.id);
const r = applyRow(row);
if (!r.ok) failures.push(r);
});
});
if (failures.length) {
try { if (typeof Announce !== 'undefined') Announce.polite(failures.length + ' setting(s) failed to apply'); } catch {}
try {
const names = failures.slice(0, 3).map(f => f.label || f.id).join(', ');
const more = failures.length > 3 ? ' (+' + (failures.length - 3) + ' more)' : '';
if (typeof Toast !== 'undefined') Toast.error('Settings failed: ' + names + more);
} catch (e) { console.warn('[Settings] failure toast', e); }
console.warn('[Settings] applyAll failures:', failures);
try {
const _full = failures.map(f => (f.label || f.id) + (f.error && f.error.message ? ' — ' + f.error.message : '')).join('; ');
console.info('[Settings] applyAll failure detail:', _full.slice(0, 2000));
} catch (e) { console.warn('[Settings] failure detail', e); }
}
return failures;
} finally {
_applyAllInProgress = false;
if (_applyAllQueued) { _applyAllQueued = false; queueMicrotask(() => { try { const _f = applyAll(); _applyAllQueuedFailures = _f; } catch (e) { console.warn('[Settings] queued applyAll', e); _applyAllQueuedFailures = [{ ok: false, id: '?', label: 'crash', error: e }]; } }); }
}
}
function _safeApplyAll() {
try { return applyAll(); }
catch (e) { console.warn('[Settings] safeApplyAll', e); try { if (typeof Toast !== 'undefined' && Toast.error) Toast.error('Settings apply crashed'); } catch {} return [{ ok: false, id: '?', label: 'crash', error: e }]; }
}
function renderInto(container) {
if (!container) return { destroy: () => {} };
if (!_schemaValidated) {
_schemaValidated = true;
try {
SCHEMA.forEach(g => { if (!g || !Array.isArray(g.rows)) return; g.rows.forEach(r => { if (!r || !r.id) return; if (r.def !== undefined && r.def !== null && typeof r.def.then === 'function') console.warn('[Settings] schema def is a Promise', r.id); }); });
} catch (e) { console.warn('[Settings] schema validation', e); }
}
const search = document.createElement('input');
search.type = 'search';
search.id = 'settings-search';
search.setAttribute('role', 'searchbox');
search.className = 'drawer__input';
search.placeholder = 'Search settings…';
search.name = 'cwtch-settings-search';
search.setAttribute('aria-label', 'Search settings');
search.setAttribute('data-role', 'settings-search');
search.autocomplete = 'off';
search.setAttribute('autocapitalize', 'off');
search.setAttribute('autocorrect', 'off');
search.setAttribute('spellcheck', 'false');
search.setAttribute('maxlength', '200');
container.appendChild(search);
const grid = document.createElement('div');
grid.className = 'settings-grid';
grid.setAttribute('role', 'region');
grid.setAttribute('aria-label', 'Settings');
container.appendChild(grid);
let _renderGroupId = 0;
const _render = (query) => {
grid.replaceChildren();
const _seenGroupIds = new Set();
SCHEMA.forEach(g => {
if (!g || typeof g.group !== 'string' || !Array.isArray(g.rows)) return;
const groupEl = document.createElement('div');
groupEl.className = 'drawer__section settings-card';
let _gid = 'settings-group-' + g.group.toLowerCase().replace(/[^a-z0-9]+/g, '-');
if (_seenGroupIds.has(_gid)) { _gid = _gid + '-' + (++_renderGroupId); }
_seenGroupIds.add(_gid);
groupEl.id = _gid;
const _showPlanned = false;
const _ql = query ? String(query).toLowerCase().slice(0, 200) : '';
const _gMatch = _ql ? g.group.toLowerCase().includes(_ql) : false;
const _baseRows = g.rows.filter(r => _showPlanned || !_isPlanned(r));
const _visibleRows = _ql ? _baseRows.filter(r => (String(r.label || '').toLowerCase().includes(_ql) || String(r.id || '').toLowerCase().includes(_ql))) : _baseRows;
if (_ql && !_visibleRows.length && !_gMatch) return;
const label = document.createElement('button');
label.type = 'button';
label.className = 'drawer__label settings-card__head';
label.textContent = g.group;
const _isCollapsed = !query && !_isExpanded(g.group);
groupEl.classList.toggle('is-collapsed', _isCollapsed);
label.setAttribute('aria-expanded', String(!_isCollapsed));
label.addEventListener('click', () => {
const collapsed = groupEl.classList.toggle('is-collapsed');
label.setAttribute('aria-expanded', String(!collapsed));
_setExpanded(g.group, !collapsed);
});
groupEl.appendChild(label);
const list = document.createElement('div');
list.className = 'settings-list';
const _frag = document.createDocumentFragment();
_visibleRows.forEach(row => {
const line = document.createElement('div');
line.className = 'settings-row';
const name = document.createElement('span');
name.className = 'settings-row__label';
name.textContent = String(row.label == null ? row.id : row.label).slice(0, 200);
line.appendChild(name);
const ctrl = document.createElement('span');
ctrl.className = 'settings-row__ctrl';
let val;
try { val = Prefs.get('setting.' + row.id); if (val === undefined || val === null) val = row.def; } catch (e) { val = row.def; }
if (row.type === 'toggle') {
const inp = document.createElement('input');
inp.type = 'checkbox'; inp.checked = !!val;
inp.setAttribute('aria-label', String(row.label || row.id).slice(0, 200));
inp.addEventListener('change', () => {
try { setRow(row.id, inp.checked); } catch (e) { console.warn('[Settings] toggle change', row.id, e); }
if (typeof Announce !== 'undefined') Announce.polite(String(row.label || row.id).slice(0, 100) + ': ' + (inp.checked ? 'on' : 'off'));
});
ctrl.appendChild(inp);
} else if (row.type === 'select') {
const sel = document.createElement('select');
sel.setAttribute('aria-label', String(row.label == null ? row.id : row.label).slice(0, 200));
const _opts = Array.isArray(row.options) ? row.options : [];
const _seenVals = new Set();
_opts.slice(0, 200).forEach(o => {
const _v = (o && typeof o === 'object') ? o.value : o;
if (_seenVals.has(String(_v))) return;
_seenVals.add(String(_v));
const opt = document.createElement('option');
const _l = (o && typeof o === 'object') ? (o.label || o.value) : o;
opt.value = _v; opt.textContent = _l;
if (String(_v) === String(val)) opt.selected = true;
sel.appendChild(opt);
});
if (!Array.from(sel.options).some(o => o.selected) && sel.options.length) {
sel.options[0].selected = true;
if (val !== undefined && val !== null) { try { setRow(row.id, sel.options[0].value); } catch (e) { console.warn('[Settings] select default', e); } }
}
sel.addEventListener('change', () => {
setRow(row.id, sel.value);
const _lbl = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : sel.value;
if (typeof Announce !== 'undefined') Announce.polite(row.label + ': ' + _lbl);
});
ctrl.appendChild(sel);
} else if (row.type === 'seg') {
const seg = document.createElement('span');
seg.className = 'settings-seg';
seg.setAttribute('role', 'radiogroup');
seg.setAttribute('aria-label', String(row.label == null ? row.id : row.label).slice(0, 200));
const _segOpts = Array.isArray(row.options) ? row.options : [];
_segOpts.slice(0, 50).forEach(o => {
const b = document.createElement('button');
b.type = 'button';
b.textContent = String(o).slice(0, 100);
b.className = 'settings-seg__btn';
b.setAttribute('role', 'radio');
b.setAttribute('tabindex', '-1');
const _sel = String(o) === String(val);
b.setAttribute('aria-checked', String(_sel));
if (_sel) { b.classList.add('is-active'); b.setAttribute('tabindex', '0'); }
b.addEventListener('click', () => {
seg.querySelectorAll('.settings-seg__btn').forEach(x => {
x.classList.remove('is-active');
x.setAttribute('aria-checked', 'false');
x.setAttribute('tabindex', '-1');
});
b.classList.add('is-active');
b.setAttribute('aria-checked', 'true');
b.setAttribute('tabindex', '0');
b.focus();
setRow(row.id, o);
if (typeof Announce !== 'undefined') Announce.polite(row.label + ': ' + o);
});
seg.appendChild(b);
});
ctrl.appendChild(seg);
} else if (row.type === 'range') {
const r = document.createElement('input');
r.type = 'range';
r.min = row.min != null ? row.min : 0;
r.max = row.max != null ? row.max : 100;
r.step = row.step == null ? 1 : row.step;
const _numVal = Number(val);
const _min = row.min != null ? Number(row.min) : 0;
const _max = row.max != null ? Number(row.max) : 100;
const _def = row.def != null ? Number(row.def) : 0;
const _safeVal = Number.isFinite(_numVal) ? Math.max(_min, Math.min(_max, _numVal)) : _def;
r.value = _safeVal;
r.setAttribute('aria-label', String(row.label == null ? row.id : row.label).slice(0, 200));
const out = document.createElement('span');
out.className = 'settings-range__val';
out.setAttribute('aria-hidden', 'true');
const _dec = (() => { const s = Number(row.step); if (!Number.isFinite(s) || s <= 0) return 3; const d = String(s).split('.')[1]; return d ? Math.min(d.length, 6) : 0; })();
const fmt = n => { const _nn = Number(n); const _clamped = Number.isFinite(_nn) ? Math.max(_min, Math.min(_max, _nn)) : _def; if (!Number.isFinite(_clamped)) return String(_clamped); let s = _clamped.toFixed(_dec); if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s; };
out.textContent = fmt(_safeVal);
r.setAttribute('aria-valuetext', fmt(_safeVal));
r.addEventListener('input', () => { const _t = fmt(Number(r.value)); out.textContent = _t; r.setAttribute('aria-valuetext', _t); });
r.addEventListener('change', () => { const n = Number(r.value); const safe = Number.isFinite(n) ? n : row.def; const _t = fmt(safe); r.setAttribute('aria-valuetext', _t); setRow(row.id, safe); });
ctrl.appendChild(r); ctrl.appendChild(out);
} else if (row.type === 'color') {
const _rgbaToHex = (str) => {
const s = String(str || '').slice(0, 64);
const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(s);
if (m) { const h = n => { const v = Math.max(0, Math.min(255, Math.round(Number(n)))); return ('0' + v.toString(16)).slice(-2); }; return '#' + h(m[1]) + h(m[2]) + h(m[3]); }
const _hsla = /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i.exec(s);
if (_hsla) {
const _h = Number(_hsla[1]) / 360, _sat = Number(_hsla[2]) / 100, _lig = Number(_hsla[3]) / 100;
const _hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
let _r, _g, _b;
if (_sat === 0) { _r = _g = _b = _lig; }
else { const _q = _lig < 0.5 ? _lig * (1 + _sat) : _lig + _sat - _lig * _sat; const _p = 2 * _lig - _q; _r = _hue2rgb(_p, _q, _h + 1/3); _g = _hue2rgb(_p, _q, _h); _b = _hue2rgb(_p, _q, _h - 1/3); }
const _hh = n => ('0' + Math.max(0, Math.min(255, Math.round(n * 255))).toString(16)).slice(-2);
return '#' + _hh(_r) + _hh(_g) + _hh(_b);
}
const h6 = /^#([0-9a-f]{6})$/i.exec(s);
if (h6) return '#' + h6[1];
const h3 = /^#([0-9a-f]{3})$/i.exec(String(str || ''));
if (h3) return '#' + h3[1][0] + h3[1][0] + h3[1][1] + h3[1][1] + h3[1][2] + h3[1][2];
return '#000000';
};
const c = document.createElement('input');
c.type = 'color'; c.value = _rgbaToHex(val);
c.setAttribute('aria-label', row.label);
c.setAttribute('title', String(val == null ? '' : val));
c.addEventListener('change', () => { setRow(row.id, c.value); });
ctrl.appendChild(c);
if (Array.isArray(row.presets) && row.presets.length) {
const sw = document.createElement('span');
sw.style.cssText = 'display:inline-flex;gap:2px;margin-left:6px';
row.presets.slice(0, 30).forEach(hex => {
if (typeof hex !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(hex)) return;
const b = document.createElement('button');
b.type = 'button';
b.title = hex;
b.setAttribute('aria-label', 'Preset ' + hex);
b.style.cssText = 'width:16px;height:16px;padding:0;border:1px solid var(--border);border-radius:4px;cursor:pointer;background:' + hex;
b.addEventListener('click', () => { c.value = hex; setRow(row.id, hex); });
sw.appendChild(b);
});
ctrl.appendChild(sw);
}
} else if (row.type === 'text' || row.type === 'password') {
const inp = document.createElement('input');
inp.type = row.type === 'password' ? 'password' : 'text';
inp.autocomplete = row.type === 'password' ? 'new-password' : 'off';
inp.value = val == null ? '' : String(val).slice(0, 5000);
inp.setAttribute('aria-label', String(row.label == null ? row.id : row.label).slice(0, 200));
inp.setAttribute('maxlength', '5000');
if (row.placeholder) inp.placeholder = String(row.placeholder).slice(0, 200);
inp.style.cssText = 'padding:3px 6px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:5px;font:inherit;font-size:11.5px;outline:none;min-width:120px';
if (row.type === 'password') {
const toggleBtn = document.createElement('button');
toggleBtn.type = 'button';
toggleBtn.className = 'demo-btn';
toggleBtn.textContent = '👁';
toggleBtn.setAttribute('aria-label', 'Show password');
toggleBtn.style.cssText = 'padding:2px 6px;font-size:11px';
toggleBtn.addEventListener('click', () => {
const showing = inp.type === 'text';
inp.type = showing ? 'password' : 'text';
toggleBtn.textContent = showing ? '👁' : '🙈';
toggleBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});
ctrl.appendChild(toggleBtn);
}
let _lastCommit = null;
let _commitTimer = null;
const commit = () => { const out = inp.value.length > 5000 ? inp.value.slice(0, 5000) : inp.value; if (_lastCommit === out) return; _lastCommit = out; setRow(row.id, out); };
inp.addEventListener('change', () => { _lastCommit = null; clearTimeout(_commitTimer); _commitTimer = setTimeout(() => { _commitTimer = null; commit(); }, 0); });
inp.addEventListener('blur', () => { _lastCommit = null; clearTimeout(_commitTimer); _commitTimer = setTimeout(() => { _commitTimer = null; commit(); }, 0); });
inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); _lastCommit = null; clearTimeout(_commitTimer); commit(); } });
inp.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); inp.value = val == null ? '' : String(val).slice(0, 5000); _lastCommit = null; clearTimeout(_commitTimer); inp.blur(); } });
ctrl.appendChild(inp);
} else if (row.type === 'display') {
const lbl = document.createElement('span');
lbl.className = 'settings-row__display';
lbl.style.cssText = 'min-width:auto;padding:2px 8px;background:var(--bg);border:1px solid var(--border);border-radius:5px';
lbl.textContent = val == null ? '' : String(val).slice(0, 200);
ctrl.appendChild(lbl);
} else if (row.type === 'custom') {
const note = document.createElement('span');
note.className = 'settings-range__val';
note.style.cssText = 'min-width:auto;font-style:italic';
note.textContent = '(custom)';
ctrl.appendChild(note);
if (typeof row.render === 'function') {
try { row.render(ctrl); } catch (e) { console.warn('[Settings] custom render failed', row.id, e); }
}
}
line.appendChild(ctrl);
_trackPlanned(line, row);
_frag.appendChild(line);
});
list.replaceChildren(_frag);
groupEl.appendChild(list);
grid.appendChild(groupEl);
});
};
let _searchTimer = null;
let _searchRaf = null;
const _destroyController = typeof AbortController === 'function' ? new AbortController() : null;
container._settingsDestroy = () => { try { if (_destroyController) _destroyController.abort(); } catch (e) { console.warn('[Settings] abort', e); } if (_searchTimer) { clearTimeout(_searchTimer); _searchTimer = null; } if (_searchRaf) { try { cancelAnimationFrame(_searchRaf); } catch (e) { console.warn('[Settings] cancelRaf', e); } _searchRaf = null; } try { container._settingsDestroy = null; } catch {} };
const _handle = { destroy: container._settingsDestroy, abort: _destroyController };
if (_destroyController) {
search.addEventListener('input', () => {
clearTimeout(_searchTimer);
if (_searchRaf) { cancelAnimationFrame(_searchRaf); _searchRaf = null; }
_searchTimer = setTimeout(() => {
_searchRaf = requestAnimationFrame(() => {
_searchRaf = null;
if (!container.isConnected) return;
try { _render(String(search.value).slice(0, 200)); } catch (e) { console.warn('[Settings] render', e); }
});
}, 80);
}, { signal: _destroyController.signal });
search.addEventListener('keydown', e => {
if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; try { _render(''); } catch (err) { console.warn('[Settings] search reset', err); } }
}, { signal: _destroyController.signal });
}
container._settingsSearchEl = search;
try { _render(''); } catch (e) { console.warn('[Settings] initial render', e); }
return _handle;
}
function _trackPlanned(rowEl, row) {
if (!rowEl || !row) return;
const _p = _isPlanned(row);
rowEl.dataset.planned = _p ? '1' : '0';
if (_p) {
rowEl.setAttribute('aria-disabled', 'true');
rowEl.querySelectorAll('input, select, button').forEach(el => { try { el.disabled = true; el.setAttribute('tabindex', '-1'); } catch (e) { console.warn('[Settings] planned disable', e); } });
}
}
function getHistory() {
let h;
try { h = Prefs.get('settings.history'); } catch (e) { console.warn('[Settings] getHistory read', e); return []; }
if (!Array.isArray(h)) return [];
return h.filter(x => x && typeof x === 'object' && typeof x.id === 'string' && x.id.length < 200 && Number.isFinite(x.at) && x.at > 0)
.slice(-100)
.map(x => { try { return { id: x.id, at: x.at, old: typeof x.old === 'undefined' ? undefined : JSON.parse(JSON.stringify(x.old)) }; } catch (e) { console.warn('[Settings] hist parse', e); return { id: x.id, at: x.at, old: undefined }; } });
}
function setRow(id, value) {
if (typeof id !== 'string' || !id || id.length > 200) return;
const r = getDef(id);
if (!r) { console.warn('[Settings] setRow unknown id', id); return; }
if (_isPlanned(r)) { console.warn('[Settings] setRow on planned id', id); return; }
if (value === undefined) { console.warn('[Settings] setRow undefined value', id); return; }
if (typeof value === 'string' && value.length > 100000) { console.warn('[Settings] setRow value too large', id); return; }
if (value && typeof value === 'object' && typeof value.then === 'function') { console.warn('[Settings] setRow refused Promise value', id); return; }
if (typeof value === 'bigint' || typeof value === 'symbol') { console.warn('[Settings] setRow refused unserializable value', id); return; }
let old; try { old = Prefs.get('setting.' + id); if (old === undefined || old === null) old = r.def; } catch (e) { console.warn('[Settings] setRow read', id, e); return; }
if (_valueEq(old, value)) return;
if (typeof r.apply === 'function' && typeof value === 'object' && value !== null) {
try { value = _cloneDef(value); } catch (e) { console.warn('[Settings] clone value', id, e); }
}
if (typeof r.validate === 'function') {
try {
const _v = r.validate(value);
if (_v && typeof _v.then === 'function') {
_v.then(_ok => { if (_ok === false) { console.warn('[Settings] async validation rejected', id); try { Prefs.set('setting.' + id, old); if (typeof r.apply === 'function') r.apply(old); _modifiedCache.clear(); if (DrawerController && DrawerController.getId && DrawerController.getId()) DrawerController.refresh(); } catch {} } }).catch(e => console.warn('[Settings] async validate threw', id, e));
} else if (_v === false) { console.warn('[Settings] validation rejected', id, value); return; }
} catch (e) { console.warn('[Settings] validate threw', id, e); return; }
}
if (_expandedPending) { try { _flushExpandedWrite(); } catch (e) { console.warn('[Settings] flush before setRow', e); } }
const _newValue = _cloneDef(value);
try { Prefs.set('setting.' + id, _newValue); }
catch (e) { console.warn('[Settings] setRow write failed', id, e); return; }
try { if (typeof r.apply === 'function') { const _p = r.apply(_newValue); if (_p && typeof _p.catch === 'function') _p.catch(e => { console.warn('[Settings] async apply failed, rolling back', id, e); try { Prefs.set('setting.' + id, old); if (typeof r.apply === 'function') r.apply(old); _modifiedCache.clear(); } catch (e2) { console.warn('[Settings] rollback failed', e2); } }); } }
catch (e) {
console.warn('[Settings] apply failed', id, e);
try { Prefs.set('setting.' + id, old); if (typeof r.apply === 'function') r.apply(old); _modifiedCache.clear(); } catch (e2) { console.warn('[Settings] apply rollback failed', e2); }
}
try { if (DrawerController && DrawerController.getId && DrawerController.getId()) { queueMicrotask(() => { try { DrawerController.refresh(); } catch (e) { console.warn('[Settings] refresh', e); } }); } } catch (e) { console.warn('[Settings] refresh', e); }
const histRaw = Prefs.get('settings.history');
const hist = Array.isArray(histRaw) ? histRaw.slice() : [];
if (!_valueEq(old, value)) hist.push({ id, old: _cloneDef(old), at: Date.now() });
while (hist.length > 100) hist.shift();
try { Prefs.set('settings.history', hist); } catch (e) { console.warn('[Settings] history write failed', e); }
_modifiedCache.clear();
}
function invalidateDefCache() { _typeCache.clear(); _modifiedCache.clear(); _expandedCache = null; _expandedCacheRev = -1; _schemaValidated = false; }
function sizeOfTypeCache() { return _typeCache.size; }
function invalidateFlagCaches() { try { Flags._reset(); } catch (e) { console.warn('[Settings] flags reset', e); } }
function listRows() {
const out = [];
SCHEMA.forEach(g => {
if (!g || !Array.isArray(g.rows)) return;
g.rows.forEach(r => {
if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id) return;
if (!_isSafeRowId(r.id)) return;
out.push({ group: g.group, row: Object.assign({}, r, { _group: g.group }) });
});
});
return out;
}
function getGroups() {
return SCHEMA.filter(g => g && typeof g.group === 'string' && Array.isArray(g.rows))
.map(g => ({ group: g.group, rows: g.rows.filter(r => r && typeof r === 'object' && typeof r.id === 'string' && r.id).map(r => Object.assign({}, r, { _group: g.group })) }));
}
function undoLast() {
const _histRaw = Prefs.get('settings.history');
const s = Array.isArray(_histRaw) ? _histRaw.slice() : [];
const last = s.pop();
if (!last || typeof last !== 'object' || typeof last.id !== 'string' || !Object.prototype.hasOwnProperty.call(last, 'old')) { try { Prefs.set('settings.history', s); } catch (e) { console.warn('[Settings] undo restore hist', e); } return; }
const r = getDef(last.id);
if (!r) { console.warn('[Settings] undo unknown setting', last.id); try { Prefs.set('settings.history', s); } catch (e) { console.warn('[Settings] undo restore hist', e); } return; }
if (typeof r.validate === 'function') {
try { const _v = r.validate(last.old); if (_v && typeof _v.then === 'function') { console.warn('[Settings] undo async validator unsupported, skipping'); return; } if (_v === false) { console.warn('[Settings] undo rejected by validator', last.id); try { Prefs.set('settings.history', s); } catch {} return; } } catch (e) { console.warn('[Settings] undo validate threw', last.id, e); try { Prefs.set('settings.history', s); } catch {} return; }
}
let cur; try { cur = Prefs.get('setting.' + last.id, r.def); } catch (e) { console.warn('[Settings] undo read cur', e); return; }
const _refreshIfOpen = () => { try { if (DrawerController && DrawerController.getId && DrawerController.getId()) DrawerController.refresh(); } catch (e) { console.warn('[Settings]', e); } };
try { Prefs.set('setting.' + last.id, last.old); }
catch (e) { console.warn('[Settings] undo write failed', last.id, e); try { Prefs.set('settings.history', s); } catch (e2) { console.warn('[Settings] undo restore hist', e2); } return; }
if (r) {
try { const _p = r.apply(last.old); if (_p && typeof _p.catch === 'function') _p.catch(e => console.warn('[Settings] undo async apply', e)); }
catch (e) {
try { Prefs.set('setting.' + last.id, cur); if (typeof r.apply === 'function') r.apply(cur); }
catch (e2) { console.warn('[Settings] undo rollback failed', e2); }
console.warn('[Settings] apply during undo failed', e);
try { Prefs.set('settings.history', s); } catch (e3) { console.warn('[Settings] undo restore hist', e3); }
return;
}
}
const redoRaw = Prefs.get('settings.redoStack');
const redo = Array.isArray(redoRaw) ? redoRaw.slice() : [];
redo.push({ id: last.id, val: _cloneDef(cur), at: Date.now() });
while (redo.length > 100) redo.shift();
try { Prefs.set('settings.redoStack', redo); } catch (e) { console.warn('[Settings] redo write', e); }
try { Prefs.set('settings.history', s); } catch (e) { console.warn('[Settings] history write', e); }
if (typeof Announce !== 'undefined') { try { Announce.polite('Reverted ' + last.id); } catch {} }
_modifiedCache.clear();
_refreshIfOpen();
}
function resetRow(rowId) {
if (typeof rowId !== 'string' || !rowId || rowId.length > 200) return;
const r = getDef(rowId);
if (!r) { console.warn('[Settings] resetRow unknown id', rowId); return; }
if (_isPlanned(r)) { console.warn('[Settings] resetRow on planned id', rowId); return; }
try { if (_expandedPending) _flushExpandedWrite(); else if (_expandedWriteTimer) { clearTimeout(_expandedWriteTimer); _expandedWriteTimer = null; } } catch (e) { console.warn('[Settings] resetRow flush', e); }
_modifiedCache.clear();
_typeCache.clear();
let old; try { old = Prefs.get('setting.' + rowId, r.def); } catch (e) { console.warn('[Settings] resetRow read', e); return; }
if (!_valueEq(old, _cloneDef(r.def))) {
const _histRaw = Prefs.get('settings.history');
const _hist = Array.isArray(_histRaw) ? _histRaw.slice() : [];
_hist.push({ id: rowId, old: _cloneDef(old), at: Date.now() });
while (_hist.length > 100) _hist.shift();
try { Prefs.set('settings.history', _hist); } catch (e) { console.warn('[Settings] resetRow hist', e); }
}
if (typeof r.validate === 'function') {
try {
const _v = r.validate(_cloneDef(r.def));
if (_v === false) { console.warn('[Settings] resetRow validation rejected', rowId); return; }
} catch (e) { console.warn('[Settings] resetRow validate threw', rowId, e); return; }
}
try { Prefs.remove('setting.' + rowId); } catch (e) { console.warn('[Settings] resetRow remove', rowId, e); }
try { if (typeof r.apply === 'function') { const _p = r.apply(_cloneDef(r.def)); if (_p && typeof _p.catch === 'function') _p.catch(e => console.warn('[Settings] resetRow async apply', e)); } } catch (e) { console.warn('[Settings] resetRow apply', rowId, e); }
try { if (typeof Announce !== 'undefined') Announce.polite('Reset ' + (r.label || rowId)); } catch (e) { console.warn('[Settings] announce', e); }
try { if (DrawerController && DrawerController.getId && DrawerController.getId()) DrawerController.refresh(); } catch (e) { console.warn('[Settings]', e); }
_modifiedCache.clear();
}
function resetAll() {
try { _flushExpandedWrite(); } catch (e) { console.warn('[Settings] resetAll flush', e); }
_typeCache.clear();
_modifiedCache.clear();
_expandedCache = null;
_expandedCacheRev = -1;
_expandedPending = null;
if (_expandedWriteTimer) { clearTimeout(_expandedWriteTimer); _expandedWriteTimer = null; }
SCHEMA.forEach(g => {
if (!g || !Array.isArray(g.rows)) return;
g.rows.forEach(r => {
if (!r || !r.id || !_isSafeRowId(r.id)) return;
try { Prefs.remove('setting.' + r.id); } catch (e) { console.warn('[Settings] resetAll remove', r.id, e); }
try { if (typeof r.apply === 'function') { const _p = r.apply(_cloneDef(r.def)); if (_p && typeof _p.catch === 'function') _p.catch(e => console.warn('[Settings] resetAll async apply', r.id, e)); } } catch (e) { console.warn('[Settings] resetAll apply', r.id, e); }
});
});
  try { Prefs.remove('settings.history'); } catch (e) { console.warn('[Settings] resetAll remove history', e); }
  try { Prefs.remove('settings.redoStack'); } catch (e) { console.warn('[Settings] resetAll remove redoStack', e); }
  try { const _tv = Prefs.get('theme.vars.custom'); if (_tv && typeof _tv === 'object') { Object.keys(_tv).forEach(k => { try { document.documentElement.style.removeProperty('--' + k); } catch {} }); } } catch (e) { console.warn('[Settings] resetAll tv cleanup', e); }
  try { Prefs.remove('theme.vars.custom'); } catch (e) { console.warn('[Settings] resetAll tv remove', e); }
const _prevPrefixes = ['theme.seed', 'theme.seed.hue', 'theme.seed.sat', 'theme.seed.light', 'theme.seed.accentHue', 'theme.seed.accentSat', 'theme.seed.accentLight', 'theme.seed.contrast', 'accentOverride', 'virtualFolders', 'libraryOrder'];
_prevPrefixes.forEach(k => { try { Prefs.remove(k); } catch (e) { console.warn('[Settings] resetAll remove', k, e); } });
try { if (window.Cwtch && window.Cwtch.Theme) { if (Theme.applyTheme) Theme.applyTheme(); } } catch (e) { console.warn('[Settings] resetAll theme', e); }
try { Prefs.remove('setting.ui.settingsExpanded'); } catch (e) { console.warn('[Settings] resetAll remove', 'setting.ui.settingsExpanded', e); }
try { Prefs.remove('hiddenHeaderIds'); } catch (e) { console.warn('[Settings] resetAll remove', 'hiddenHeaderIds', e); }
try { Prefs.remove('libraryOrder'); } catch (e) { console.warn('[Settings] resetAll remove', 'libraryOrder', e); }
try { if (DrawerController && DrawerController.getId && DrawerController.getId()) DrawerController.refresh(); } catch (e) { console.warn('[Settings]', e); }
try { if (HeaderRenderer && HeaderRenderer.render) HeaderRenderer.render(); } catch (e) { console.warn('[Settings] header rerender', e); }
_modifiedCache.clear();
}
function resetGroup(groupName) {
if (typeof groupName !== 'string' || !groupName || groupName.length > 200) return;
const g = SCHEMA.find(x => x && x.group === groupName);
if (!g || !Array.isArray(g.rows)) return;
if (!document || !document.body) return;
try { if (_expandedPending) _flushExpandedWrite(); } catch (e) { console.warn('[Settings] resetGroup flush', e); }
_typeCache.clear();
_modifiedCache.clear();
_expandedCache = null;
_expandedCacheRev = -1;
if (_expandedWriteTimer) { clearTimeout(_expandedWriteTimer); _expandedWriteTimer = null; }
const histRaw = Prefs.get('settings.history');
const hist = Array.isArray(histRaw) ? histRaw.slice() : [];
g.rows.forEach(r => {
if (!r || !r.id) return;
let old;
try { old = Prefs.get('setting.' + r.id, r.def); } catch (e) { console.warn('[Settings] resetGroup read', r.id, e); return; }
if (!_valueEq(old, r.def)) { if (hist.length >= 100) hist.shift(); hist.push({ id: r.id, old: _cloneDef(old), at: Date.now() }); }
try { Prefs.remove('setting.' + r.id); } catch (e) { console.warn('[Settings] resetGroup remove', r.id, e); }
try { if (typeof r.apply === 'function') { const _p = r.apply(_cloneDef(r.def)); if (_p && typeof _p.catch === 'function') _p.catch(e => console.warn('[Settings] resetGroup async apply', r.id, e)); } } catch (e) { console.warn('[Settings] resetGroup apply', r.id, e); }
});
try { Prefs.set('settings.history', hist.slice(-100)); } catch (e) { console.warn('[Settings] resetGroup history', e); }
try { if (DrawerController && DrawerController.getId && DrawerController.getId()) DrawerController.refresh(); } catch (e) { console.warn('[Settings]', e); }
_modifiedCache.clear();
}

function _focusModeToggle() {
const on = !document.body.classList.contains('focus-mode');
try { setRow('reader.focusMode', on); } catch (e) { console.warn('[Settings] focus persist', e); }
        document.body.classList.toggle('focus-mode', on);
        try { Prefs.set('setting.reader.focusMode', !!on); } catch {}
try { document.querySelectorAll('[data-focus-mode-toggle]').forEach(el => el.setAttribute('aria-pressed', String(on))); } catch (e) { console.warn('[Settings] focus aria', e); }
try { if (typeof Announce !== 'undefined') Announce.polite('Focus mode ' + (on ? 'on' : 'off')); } catch (e) { console.warn('[Settings] focus announce', e); }
return on;
}

if (typeof document !== 'undefined' && !window._cwtchSettingsBeforeUnload) {
window._cwtchSettingsBeforeUnload = true;
window.addEventListener('beforeunload', () => { try { _flushExpandedWrite(); } catch (e) { console.warn('[Settings] beforeunload', e); } });
window.addEventListener('pagehide', () => { try { _flushExpandedWrite(); } catch (e) { console.warn('[Settings] pagehide', e); } });
window.addEventListener('visibilitychange', () => { if (document.hidden) { try { _flushExpandedWrite(); } catch (e) { console.warn('[Settings] vis flush', e); } } });
}

return { applyAll, _safeApplyAll, renderInto, undoLast, resetRow, resetCard: resetRow, resetGroup, resetAll, getDef, setRow, getHistory, listRows, getGroups, isModified: _isModified, flushExpandedWrite: _flushExpandedWrite, invalidateDefCache, sizeOfTypeCache, invalidateFlagCaches, toggleFocusMode: _focusModeToggle };
})();