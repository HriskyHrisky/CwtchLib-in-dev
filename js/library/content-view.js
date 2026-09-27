
import { State } from '../core/state.js';
import { Prefs } from '../core/prefs.js';
import { Bus } from '../core/bus.js';
import { Store } from '../core/store.js';
import { Strings } from '../core/strings.js';
import { Config, KIND_LABELS } from '../core/config.js';
import { EVENTS } from '../core/events.js';
import { Navigation } from '../core/navigation.js';
import { escapeHtml } from '../core/escape.js';
import { Tabs } from '../ui/tabs.js';
import { Markdown } from '../markdown/markdown.js';
import { Modal } from '../ui/modal.js';
import { Toast } from '../ui/toast.js';
import { TOC } from '../ui/toc.js';
import { Editor } from '../editor/editor.js';
import { Exporter } from '../output/exporter.js';
import { Undo } from '../editor/undo.js';
import { Status } from '../ui/status.js';
import { Announce } from '../ui/announce.js';
import { DrawerController } from '../ui/drawer.js';
import { FileUploader } from './uploader.js';
import { ReviewEngine } from '../srs/review-engine.js';
import { AudioPlayer } from '../input/audio-player.js';

export const ContentView = (() => {
let mainEl = null;
let _lastLibAnnounce = -1;
let _lastAudioUrl = null;
const scrollMem = new Map();
let _searchHighlightTerm = '';
const _sizeCache = new Map();
const _SIZE_CACHE_MAX = 500;

function _revokeAudioUrl() {
if (_lastAudioUrl) { try { URL.revokeObjectURL(_lastAudioUrl); } catch (e) { console.warn('[content] revoke', e); } _lastAudioUrl = null; }
const _main = document.getElementById('main');
if (_main) _main.querySelectorAll('img[data-asset], [data-asset]').forEach(img => { if (img._assetUrl) { try { URL.revokeObjectURL(img._assetUrl); } catch (e) { console.warn('[content] revoke asset', e); } img._assetUrl = null; } });
}
function _onPageHide() { try { _revokeAudioUrl(); } catch (e) { console.warn('[content] pagehide revoke', e); } }
function ensure() { if (!mainEl || !mainEl.isConnected) mainEl = document.getElementById('main'); return mainEl; }
function _parentOfPath(p) { return String(p || '').split('/').slice(0, -1).join('/'); }
function _parentOf(p) { return _parentOfPath(p); }
if (typeof window !== 'undefined' && !window._cwtchContentPageHideBound) {
window._cwtchContentPageHideBound = true;
window.addEventListener('pagehide', _onPageHide);
}
function show(html) {
const _prevView = State.get('currentView');
if (_prevView !== 'audio') _revokeAudioUrl();
const m = ensure();
if (!m) { console.warn('[content] main missing'); return; }
if (!document.contains(m)) { console.warn('[content] main detached'); return; }
try { if (window._libAbort) { window._libAbort.abort(); window._libAbort = null; } } catch (e) { console.warn('[content] abort prev lib', e); }
m.replaceChildren();
if (typeof html === 'string') {
m.textContent = '';
const _tpl = document.createElement('template');
try { _tpl.innerHTML = html; } catch (e) { console.warn('[content] template parse failed', e); m.textContent = html; return; }
_tpl.content.querySelectorAll('script, iframe, object, embed, link, meta, base, form, use, foreignObject, math, annotation-xml').forEach(n => n.remove());
m.appendChild(_tpl.content);
}
else if (html instanceof HTMLElement) m.appendChild(html);
try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { console.warn('[content] scroll', e); }
document.body.dataset.activeView = State.get('currentView') || 'library';
}

async function showDocument(item, skipTab, keepHash) {
if (!item || typeof item !== 'object') return;
if (typeof item.id !== 'string' || !item.id || item.id.length > 200 || item.id.includes('\u0000')) { console.warn('[doc] missing id'); return; }
State.set('currentView', 'doc');
if (!Number.isFinite(item.size) || item.size < 0) item.size = 0;
_normalizeItem(item);
if (!Array.isArray(item.tags)) item.tags = [];
const _mainRef = document.getElementById('main');
if (!_mainRef) { console.warn('[doc] main missing'); return; }
if (!document.contains(_mainRef)) { console.warn('[doc] main detached'); return; }
const _oldAudioUrl = _lastAudioUrl;
if (item.kind !== 'audio' && _oldAudioUrl) { try { URL.revokeObjectURL(_oldAudioUrl); } catch (e) { console.warn('[doc] revoke', e); } _lastAudioUrl = null; }
const _prevMain = document.getElementById('main');
if (_prevMain) {
_prevMain.querySelectorAll('img[data-asset], [data-asset]').forEach(el => { if (el._assetUrl) { try { URL.revokeObjectURL(el._assetUrl); } catch (e) { console.warn('[doc] revoke asset', e); } el._assetUrl = null; } });
if (item.kind === 'image' || item.kind === 'canvas') _prevMain.dataset.hasAssetImages = '1';
else { delete _prevMain.dataset.hasAssetImages; }
}
const prevId = State.get('activeTabId');
if (prevId && prevId !== item.id) {
if (scrollMem.size > 200) scrollMem.clear();
scrollMem.set(prevId, window.scrollY);
try { Prefs.set('scroll.' + prevId, window.scrollY); } catch (e) { console.warn('[doc] scroll persist', e); }
}
if (!skipTab) Tabs.open(item.id);
let body;
if (item.kind === 'markdown' || item.kind === 'note') {
try { body = Markdown.render(String(item.content || '')); }
catch (err) { console.warn('[doc] markdown render failed', err); body = '<pre>' + escapeHtml(String(item.content || '').slice(0, 500000)) + '</pre>'; }
}
else if (item.kind === 'image') body = item.assetKey ? `<img alt="${escapeHtml(String(item.title || '').slice(0, 300)).replace(/"/g, '&quot;')}" data-asset="${escapeHtml(item.assetKey).replace(/"/g, '&quot;')}" loading="lazy" decoding="async" style="opacity:0;transition:opacity .15s">` : '<div class="drawer__empty">Image data unavailable</div>';
else if (item.kind === 'canvas') body = item.assetKey ? `<div class="canvas-preview" data-asset="${escapeHtml(item.assetKey).replace(/"/g, '&quot;')}">Loading…</div>` : '<div class="drawer__empty">Canvas data unavailable</div>';
else if (item.kind === 'card') {
try { const d = JSON.parse(item.content); body = `<div class="review-card"><div class="front">${escapeHtml(d.front || '')}</div><div class="back">${escapeHtml(d.back || '')}</div></div>`; }
catch { body = `<pre>${escapeHtml(item.content || '')}</pre>`; }
} else if (item.kind === 'audio') {
let audioUrl = '';
const audioDocId = item.id;
if (item.assetKey) {
const blob = await Store.getAsset(item.assetKey);
if (State.get('currentView') !== 'doc' || State.get('activeTabId') !== audioDocId) { State.set('currentView', 'library'); return; }
if (blob) { audioUrl = URL.createObjectURL(blob); if (_oldAudioUrl) { try { URL.revokeObjectURL(_oldAudioUrl); } catch (e) { console.warn('[content] revoke old audio', e); } } _lastAudioUrl = audioUrl; }
else if (_oldAudioUrl) { _lastAudioUrl = _oldAudioUrl; }
}
body = audioUrl ? `<audio controls src="${escapeHtml(audioUrl)}"></audio>` : '<div class="drawer__empty">Audio data unavailable</div>';
} else body = `<pre>${escapeHtml(item.content || '(no content)')}</pre>`;
const m = ensure();
if (document.getElementById('tab-' + item.id)) {
        if (m.dataset.tabpanelFor !== item.id) m.dataset.tabpanelFor = item.id;
m.setAttribute('role', 'tabpanel');
m.setAttribute('aria-labelledby', 'tab-' + item.id);
m.removeAttribute('aria-label');
} else {
delete m.dataset.tabpanelFor;
m.setAttribute('role', 'region');
m.removeAttribute('aria-labelledby');
m.setAttribute('aria-label', item.title || 'Document');
}
const tpl = document.getElementById('tpl-doc');
if (tpl) {
m.replaceChildren();
const docEl = tpl.content.firstElementChild.cloneNode(true);
const _h1 = docEl.querySelector('h1');
if (_h1) _h1.textContent = String(item.title || 'Untitled').slice(0, 300);
const _contentStr = String(item.content || '');
const _wc = (_contentStr.match(/\S+/g) || []).length;
const _metaEl = docEl.querySelector('.doc__meta');
if (_metaEl) _metaEl.textContent = ((KIND_LABELS[item.kind] || item.kind || '') + (item.path ? ' · ' + item.path : '') + ' · ' + _wc + ' words · ~' + Math.max(1, Math.round(_wc / 220)) + ' min read').slice(0, 400);
let _userLvl = 0, _lvlFilter = 0;
try { _userLvl = Number(Prefs.get('setting.levelSystem.userLevel')) || 0; _lvlFilter = Number(Prefs.get('setting.levelSystem.filterRange')) || 0; } catch (e) { console.warn('[doc] level prefs', e); }
if (_userLvl > 0 && _lvlFilter > 0 && typeof body === 'string') {
const tmp = document.createElement('div');
tmp.innerHTML = body;
tmp.querySelectorAll('[data-lvl]').forEach(el => {
const n = parseInt(el.getAttribute('data-lvl'), 10) || 0;
if (n > _userLvl + _lvlFilter) el.remove();
});
body = tmp.innerHTML;
}
const tagsEl = docEl.querySelector('.doc__tags');
const _tagCounts = new Map();
(State.get('libraryItems') || []).forEach(x => {
if (!x || !Array.isArray(x.tags)) return;
for (const _t of x.tags) { if (typeof _t === 'string' && _t) _tagCounts.set(_t, (_tagCounts.get(_t) || 0) + 1); }
});
const _tagSeen = new Set();
(item.tags || []).forEach(t => {
if (typeof t !== 'string' || !t || t.length > 200 || _tagSeen.has(t)) return;
_tagSeen.add(t);
const chip = document.createElement('button');
chip.type = 'button';
chip.className = 'tag-chip';
chip.dataset.tag = t;
chip.setAttribute('aria-label', 'Remove tag ' + String(t).slice(0, 100));
chip.title = String(t).slice(0, 200);
const _tagN = _tagCounts.get(t) || 0;
chip.textContent = String(t).slice(0, 100) + ' (' + _tagN + ') ';
const x = document.createElement('span');
x.className = 'tag-x';
x.setAttribute('aria-hidden', 'true');
x.textContent = '×';
chip.appendChild(x);
tagsEl.appendChild(chip);
});
const actions = docEl.querySelector('.doc__actions');
const _da = docActions(item);
_da.forEach(([act, label]) => {
const b = document.createElement('button');
b.type = 'button';
b.className = 'demo-btn';
b.dataset.act = act;
b.textContent = (label == null ? '' : String(label));
if (act === 'delete') b.style.color = 'var(--danger)';
if (act === 'star' && item.starred) b.style.color = 'var(--star)';
b.setAttribute('aria-label', String(label || act));
actions.appendChild(b);
});
const docBody = docEl.querySelector('.doc__body');
if (!docBody) return;
docBody.classList.add('reader__body');
try { Navigation.push({ view: 'doc', id: item.id }); } catch (e) { console.warn('[content] nav push', e); }
if (typeof body === 'string') {
try {
const _tpl2 = document.createElement('template');
_tpl2.innerHTML = body;
_tpl2.content.querySelectorAll('script, object, embed, iframe, link, style, meta, base, form, use, foreignObject, math, annotation-xml').forEach(n => n.remove());
_tpl2.content.querySelectorAll('*').forEach(n => {
for (const _a of Array.from(n.attributes)) {
const _name = _a.name.toLowerCase();
const _val = String(_a.value || '');
if (_name.startsWith('on')) { n.removeAttribute(_a.name); continue; }
if (_name === 'srcdoc' || _name === 'formaction' || _name === 'xlink:actuate') { n.removeAttribute(_a.name); continue; }
if ((_name === 'href' || _name === 'src' || _name === 'xlink:href' || _name === 'srcset' || _name === 'data') && /^\s*(javascript:|vbscript:|data:(?!image\/))/i.test(_val)) { n.removeAttribute(_a.name); continue; }
}
});
docBody.replaceChildren(_tpl2.content);
} catch (e) { console.warn('[doc] sanitize failed', e); docBody.textContent = body; }
}
else if (body instanceof HTMLElement) docBody.replaceChildren(body);
else docBody.textContent = '';
if (window.hljs && typeof window.hljs.highlightElement === 'function') Array.from(docBody.querySelectorAll('pre code[class*="language-"]:not(.hljs)')).slice(0, 200).forEach(el => { try { window.hljs.highlightElement(el); } catch (e) { console.warn('[hljs]', e); } });
if (window.mermaid && typeof window.mermaid.run === 'function') {
const _mermaidNodes = Array.from(docBody.querySelectorAll('code[data-mermaid]')).slice(0, 50).filter(el => el.dataset.mermaidRendered !== '1');
const _mermaidTargets = [];
_mermaidNodes.forEach(el => {
el.dataset.mermaidRendered = '1';
const code = el.textContent;
if (typeof code !== 'string' || code.length > 100000) { console.warn('[mermaid] source too large, skipped'); return; }
const div = document.createElement('div');
div.className = 'mermaid';
div.textContent = code;
const _pre = el.closest('pre');
if (_pre && _pre.parentNode) _pre.parentNode.replaceChild(div, _pre);
_mermaidTargets.push(div);
});
if (_mermaidTargets.length) { try { const _r = window.mermaid.run({ nodes: _mermaidTargets }); if (_r && typeof _r.catch === 'function') _r.catch(e => console.warn('[mermaid]', e)); } catch (e) { console.warn('[mermaid]', e); } }
}
m.appendChild(docEl);
window.scrollTo({ top: 0, behavior: 'auto' });
const _active = document.activeElement;
const _typingInEditor = _active && m.contains(_active) && (_active.tagName === 'TEXTAREA' || _active.isContentEditable);
if (document.hasFocus() && !_typingInEditor) { try { m.focus({ preventScroll: true }); } catch (e) { console.warn('[doc] focus', e); } }
const _parentKey = _parentOfPath(item.path);
const _sib = (State.get('libraryItems') || []).filter(x => x && _parentOf(x.path) === _parentKey);
const _si = _sib.findIndex(x => x && x.id === item.id);
if (_si >= 0 && _sib.length >= 2) {
const _nav = document.createElement('div');
_nav.style.cssText = 'display:flex;gap:6px;margin-top:12px';
[['prev','‹ Prev'],['next','Next ›']].forEach(([d,l]) => {
const _b = document.createElement('button');
_b.type = 'button';
_b.className = 'demo-btn';
_b.textContent = l;
_b.addEventListener('click', () => {
const _idx = _sib.findIndex(x => x.id === item.id);
if (_idx < 0) return;
const _n = _sib[_idx + (d === 'prev' ? -1 : 1)];
if (_n && _n.id !== item.id) showDocument(_n);
});
_nav.appendChild(_b);
});
const _db = docEl.querySelector('.doc__body');
if (_db && _db.parentNode) _db.parentNode.insertBefore(_nav, _db.nextSibling);
}
}
        const _addBtn = m.querySelector('[data-act="add-tag"]');
        if (_addBtn) _addBtn.addEventListener('click', async () => {
const _allTags = Array.from(new Set([...(Config.tags || []), ...(State.get('libraryItems') || []).flatMap(x => Array.isArray(x.tags) ? x.tags : [])]));
const _counts = new Map();
(State.get('libraryItems') || []).forEach(x => (Array.isArray(x.tags) ? x.tags : []).forEach(t => _counts.set(t, (_counts.get(t) || 0) + 1)));
const _sorted = _allTags.sort((a, b) => (_counts.get(b) || 0) - (_counts.get(a) || 0));
const wrap = document.createElement('div');
const _lbl = document.createElement('div');
_lbl.style.marginBottom = '10px';
_lbl.textContent = 'Add tag';
wrap.appendChild(_lbl);
const inp = document.createElement('input');
inp.type = 'text';
inp.style.cssText = 'width:100%;padding:8px 12px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:7px;font:inherit;font-size:13px;outline:none';
wrap.appendChild(inp);
if (_sorted.length) {
const chips = document.createElement('div');
chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:8px';
_sorted.slice(0, 20).forEach(t => {
const c = document.createElement('button');
c.type = 'button';
c.className = 'tag-chip';
c.textContent = t;
c.addEventListener('click', () => { inp.value = t; inp.focus(); });
chips.appendChild(c);
});
wrap.appendChild(chips);
}
if (_sorted.length === 0 && _allTags.length === 0) { inp.focus(); }
const _ADD = { __add: true };
const _res = await Modal.open({
title: '',
body: wrap,
actions: [
{ label: 'Cancel', value: null },
{ label: 'Add', value: _ADD, primary: true }
]);
if (_res !== _ADD) return;
const name = inp.value.trim();
if (!name) return;
const updatedAdd = Object.assign({}, item, { tags: Array.from(new Set([...(Array.isArray(item.tags) ? item.tags : []), name])).slice(0, 100), lastModified: Date.now() });
try { await Store.put(updatedAdd); } catch (err) { console.warn('[doc] tag add failed', err); try { if (typeof Toast !== 'undefined') Toast.error('Tag add failed'); } catch {} return; }
State.set('libraryItems', (State.get('libraryItems') || []).map(x => x.id === item.id ? updatedAdd : x));
Bus.emit(EVENTS.LIBRARY_CHANGED);
showDocument(updatedAdd, true);
});
m.querySelectorAll('.tag-chip').forEach(chip => {
if (chip._tagBound) return;
chip._tagBound = true;
chip.addEventListener('click', async e => {
if (!e.target || !e.target.classList || !e.target.classList.contains('tag-x')) { const q = chip.dataset.tag; if (q) location.hash = '#search-' + encodeURIComponent(q); return; }
const _rmTag = chip.dataset.tag;
if (!_rmTag) return;
const updatedRemove = Object.assign({}, item, { tags: (Array.isArray(item.tags) ? item.tags : []).filter(t => t !== _rmTag), lastModified: Date.now() });
try { await Store.put(updatedRemove); } catch (err) { console.warn('[doc] tag remove failed', err); try { if (typeof Toast !== 'undefined') Toast.error('Tag remove failed'); } catch {} return; }
Object.assign(item, updatedRemove);
State.set('libraryItems', (State.get('libraryItems') || []).map(x => x.id === item.id ? updatedRemove : x));
Bus.emit(EVENTS.LIBRARY_CHANGED);
showDocument(updatedRemove, true);
});
});
m.querySelector('[data-act="toc"]')?.addEventListener('click', () => { TOC.toggle(); });
m.querySelector('[data-act="edit"]')?.addEventListener('click', () => { Editor.open(item.id); });
m.querySelector('[data-act="bookmark"]')?.addEventListener('click', async () => {
try {
const _bm = Prefs.get('bookmarks.' + item.id);
const _list = Array.isArray(_bm) ? _bm.slice() : [];
let _limit = 50;
try { const _rl = Number(Prefs.get('setting.library.bookmarksLimit')); if (Number.isFinite(_rl) && _rl > 0) _limit = Math.min(_rl, 500); } catch (e) { console.warn('[doc] bookmark limit', e); }
if (Number.isFinite(Number(window._bookmarksLimit)) && Number(window._bookmarksLimit) > 0) _limit = Math.min(Number(window._bookmarksLimit), 500);
_list.push({ at: window.scrollY, t: Date.now() });
while (_list.length > _limit) _list.shift();
Prefs.set('bookmarks.' + item.id, _list);
Toast.success('Bookmark saved (' + _list.length + ')');
} catch (e) { console.warn('[doc] bookmark', e); Toast.error('Bookmark failed'); }
});
m.querySelector('[data-act="highlight"]')?.addEventListener('click', () => {
const sel = window.getSelection();
if (!sel || sel.isCollapsed) { Toast.show('Select text first'); return; }
const txt = sel.toString().trim().slice(0, 500);
if (!txt) { Toast.show('Select text first'); return; }
const q = encodeURIComponent(txt);
try { location.hash = '#search-' + q; } catch (e) { console.warn('[doc] highlight hash', e); }
Toast.show('Searching highlight…');
});
m.querySelector('[data-act="annotate"]')?.addEventListener('click', () => {
const sel = window.getSelection();
if (!sel || sel.isCollapsed) { Toast.show('Select text first'); return; }
const txt = sel.toString().trim().slice(0, 500);
if (!txt) { Toast.show('Select text first'); return; }
Modal.prompt('Annotation for "' + txt.slice(0, 40) + '"', { okLabel: 'Save' }).then(async note => {
if (!note) return;
try {
const _anns = Prefs.get('annotations.' + item.id);
const _list = Array.isArray(_anns) ? _anns.slice() : [];
_list.push({ quote: txt, note, at: Date.now() });
Prefs.set('annotations.' + item.id, _list);
Toast.success('Annotation saved');
} catch (e) { console.warn('[doc] annotate', e); }
});
});
m.querySelector('[data-act="star"]')?.addEventListener('click', async () => {
const updated = Object.assign({}, item, { starred: !item.starred, lastModified: Date.now() });
try { await Store.put(updated); } catch (err) { console.warn('[doc] star failed', err); try { if (typeof Toast !== 'undefined' && Toast.error) Toast.error('Star failed'); } catch {} return; }
Object.assign(item, updated);
State.set('libraryItems', (State.get('libraryItems') || []).map(x => x.id === item.id ? updated : x));
Bus.emit('library:changed');
try { if (typeof Announce !== 'undefined') Announce.polite((updated.starred ? 'Starred ' : 'Unstarred ') + String(updated.title || '').slice(0, 100)); } catch (e) { console.warn('[doc] announce', e); }
showDocument(updated, true);
});
m.querySelector('[data-act="export"]')?.addEventListener('click', () => Exporter.exportItem(item));
m.querySelector('[data-act="print"]')?.addEventListener('click', () => window.print());
m.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
let confirmOn = true;
try { confirmOn = Prefs.get('setting.library.confirmDelete', true) !== false; } catch (e) { console.warn('[doc] confirmDelete pref', e); }
if (confirmOn) { let _ok = false; try { _ok = await Modal.confirm(Strings.t('confirm.delete', 'Delete "{title}"?', { title: String(item.title || '').slice(0, 100) }), { danger: true, okLabel: Strings.t('modal.delete', 'Delete') }); } catch (e2) { console.warn('[doc] confirm', e2); } if (!_ok) return; }
const backup = Object.assign({}, item);
const assetKey = item.assetKey;
let assetBlob = null;
if (assetKey) { try { assetBlob = await Store.getAsset(assetKey); } catch (e) { console.warn('[doc] backup asset', e); } }
try { await Store.putAsset('trash:' + item.id + ':' + Date.now(), new Blob([JSON.stringify(item)])); } catch (e) { console.warn('[doc] trash asset', e); }
try { await Store.remove(item.id); } catch (err) { console.warn('[doc] remove failed', err); try { if (typeof Toast !== 'undefined') Toast.error('Delete failed'); } catch {} return; }
if (assetKey) { try { await Store.removeAsset(assetKey); } catch (e) { console.warn('[doc] remove asset', e); } }
Undo.push({ label: 'Delete ' + String(item.title || '').slice(0, 80), undo: async () => {
try { await Store.put(backup); } catch (e) { console.warn('[doc] undo put', e); }
if (assetKey && assetBlob) { try { await Store.putAsset(assetKey, assetBlob); } catch (e) { console.warn('[doc] undo asset', e); } }
State.set('libraryItems', [...(State.get('libraryItems') || []), backup]);
Bus.emit('library:changed');
Tabs.open(backup.id);
showDocument(backup, true);
} });
Tabs.close(item.id);
Bus.emit('library:changed');
Toast.success('Deleted');
try { Announce.polite('Deleted ' + String(item.title || '').slice(0, 100)); } catch (e) { console.warn('[doc] announce', e); }
});
try { Status.setMode('read'); } catch (e) { console.warn('[doc] setMode', e); }
try { Status.setWords(((item.content || '').match(/\S+/g) || []).length); } catch (e) { console.warn('[doc] setWords', e); }
try { Status.flashSave('—'); } catch (e) { console.warn('[doc] flashSave', e); }
try { if (DrawerController.getId && DrawerController.getId()) DrawerController.close(true, true); } catch (e) { console.warn('[doc] close drawer', e); }
document.title = String(item.title || 'Document').replace(/[\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 100) + ' — CwtchLib';
if (!keepHash) { const nextHash = '#doc-' + encodeURIComponent(item.id); if (location.hash !== nextHash) history.pushState(null, '', nextHash); }
const savedScroll = scrollMem.get(item.id) != null ? scrollMem.get(item.id) : Prefs.get('scroll.' + item.id);
if (savedScroll != null && Number.isFinite(Number(savedScroll)) && Number(savedScroll) >= 0) {
let _scrollApplied = false;
const _applyScroll = () => { if (_scrollApplied) return; _scrollApplied = true; if (State.get('activeTabId') === item.id && State.get('currentView') === 'doc') { try { window.scrollTo({ top: Math.min(Number(savedScroll), document.documentElement.scrollHeight), behavior: 'auto' }); } catch (e) { console.warn('[doc] scroll', e); } } };
requestAnimationFrame(_applyScroll);
setTimeout(_applyScroll, 80);
}
if ((item.kind === 'image' || item.kind === 'canvas') && item.assetKey) {
const docId = item.id;
Store.getAsset(item.assetKey).then(blob => {
if (State.get('currentView') !== 'doc' || State.get('activeTabId') !== docId) return;
if (!document.body.contains(m)) return;
const img = m.querySelector('[data-asset]');
if (!img || !img.isConnected) return;
if (!blob) { const fb = document.createElement('div'); fb.className = 'drawer__empty'; fb.textContent = 'Asset data unavailable'; if (img.parentNode) img.parentNode.replaceChild(fb, img); return; }
if (img.tagName === 'IMG') {
if (img._assetUrl) { try { URL.revokeObjectURL(img._assetUrl); } catch {} }
const url = URL.createObjectURL(blob);
img._assetUrl = url;
img.addEventListener('load', () => { img.style.opacity = '1'; }, { once: true });
img.addEventListener('error', () => {
const fb = document.createElement('div');
fb.className = 'drawer__empty';
fb.textContent = 'Image data unavailable';
if (img.parentNode) img.parentNode.replaceChild(fb, img);
}, { once: true });
img.src = url;
}
}).catch(err => { console.warn('[doc] asset load failed', err); });
}
}

function itemRow(it) {
if (!it || typeof it !== 'object') return null;
if (typeof it.id !== 'string' || !it.id || it.id.length > 200) return null;
_normalizeItem(it);
const _tpl = document.getElementById('tpl-item-row');
if (!_tpl || !_tpl.content || !_tpl.content.firstElementChild) return null;
const node = _tpl.content.firstElementChild.cloneNode(true);
node.className = 'item-row';
node.dataset.id = it.id;
node.dataset.kind = typeof it.kind === 'string' ? it.kind : 'text';
node.setAttribute('aria-label', String(it.title || 'Untitled').slice(0, 200));
const _iconEl = node.querySelector('.d-icon');
if (_iconEl) { _iconEl.textContent = it.icon || '📄'; _iconEl.setAttribute('aria-hidden', 'true'); }
const _titleEl = node.querySelector('.d-text');
if (_searchHighlightTerm && _titleEl) {
let _safeHtml;
try {
const _term = String(_searchHighlightTerm).slice(0, 200);
const _escTerm = escapeHtml(_term);
const _escPat = _escTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const _re = new RegExp('(' + _escPat + ')', 'ig');
_safeHtml = escapeHtml(it.title).replace(_re, '<mark>$1</mark>');
} catch { _safeHtml = escapeHtml(it.title); }
_titleEl.innerHTML = _safeHtml;
node.setAttribute('aria-label', it.title);
} else _titleEl.textContent = it.title;
let _bytes;
const _memoKey = (it.id || '') + ':' + (it.lastModified || 0) + ':' + (it.size || 0) + ':' + (it.contentHash || '');
if (_sizeCache.has(_memoKey)) _bytes = _sizeCache.get(_memoKey);
else {
_bytes = (typeof it.size === 'number' && it.size > 0) ? it.size : ((it.kind === 'markdown' || it.kind === 'note' || it.kind === 'card') ? ((it.content || '').length * 2) : 0);
if (_sizeCache.size > _SIZE_CACHE_MAX) { const _drop = Math.max(1, Math.floor(_sizeCache.size / 10)); let _i = 0; for (const _k of _sizeCache.keys()) { if (_i++ >= _drop) break; _sizeCache.delete(_k); } }
_sizeCache.set(_memoKey, _bytes);
}
if (typeof it.size !== 'number' || it.size <= 0) it.size = _bytes;
const _sizeStr = _bytes > 0 ? (_bytes >= 1048576 ? (Math.round(_bytes / 1048576 * 10) / 10) + 'MB' : Math.max(1, Math.round(_bytes / 1024)) + 'KB') : '';
const _baseTitle = String(it.path || '') ? String(it.path).slice(0, 200) + (it.lastModified ? ' · updated ' + new Date(it.lastModified).toLocaleString() : '') : (it.lastModified ? 'updated ' + new Date(it.lastModified).toLocaleString() : '');
node.title = (_baseTitle + (_sizeStr ? ' · ' + _sizeStr : '') + (it.starred ? ' · ⭐ starred' : '') + (it.level ? ' · Lv ' + it.level : '')).slice(0, 300);
const kindEl = node.querySelector('[data-field="kind"]');
if (kindEl) { kindEl.textContent = KIND_LABELS[it.kind] || it.kind || ''; if (it.kind) kindEl.dataset.kind = it.kind; else delete kindEl.dataset.kind; }
const starEl = node.querySelector('[data-field="star"]');
if (starEl) starEl.hidden = !it.starred;
if (typeof itemRow._showBadges === 'undefined') {
try { itemRow._showBadges = Prefs.get('setting.levelSystem.showBadges') !== false; } catch (e) { console.warn('[content] badge pref', e); itemRow._showBadges = true; }
}
if (itemRow._showBadges) {
const lvl = Number(it.level) || 0;
if (lvl > 0) {
const badge = document.createElement('span');
badge.className = 'level-badge';
badge.dataset.field = 'level';
badge.textContent = 'Lv ' + lvl;
badge.setAttribute('aria-label', 'Level ' + lvl);
node.appendChild(badge);
}
}
node.draggable = true;
if (!node._dragBound) {
node._dragBound = true;
node.addEventListener('dragstart', e => {
try { e.dataTransfer.setData('text/plain', it.id); e.dataTransfer.effectAllowed = 'move'; } catch (err) { console.warn('[content] dragstart', err); }
});
node.addEventListener('dragover', e => { try { if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes && e.dataTransfer.types.includes('text/plain')) { e.preventDefault(); node.style.outline = '2px solid var(--accent)'; } } catch (err) { console.warn('[content] dragover', err); } });
node.addEventListener('dragleave', () => { node.style.outline = ''; });
}
node.addEventListener('drop', e => {
node.style.outline = '';
e.stopPropagation();
let fromId = '';
try { fromId = e.dataTransfer.getData('text/plain'); } catch (err) { console.warn('[content] drop read', err); }
if (!fromId || typeof fromId !== 'string' || fromId.length > 200) return;
if (fromId === it.id) return;
e.preventDefault();
const arr = (State.get('libraryItems') || []).slice();
const fromIdx = arr.findIndex(x => x && x.id === fromId);
const toIdx = arr.findIndex(x => x && x.id === it.id);
if (fromIdx < 0 || toIdx < 0) return;
const [moved] = arr.splice(fromIdx, 1);
const _adjusted = fromIdx < toIdx ? toIdx - 1 : toIdx;
arr.splice(Math.max(0, _adjusted), 0, moved);
State.set('libraryItems', arr);
try { Prefs.set('libraryOrder', arr.filter(x => x && x.id).map(x => x.id).slice(0, 10000)); } catch (err) { console.warn('[content] libraryOrder', err); }
Bus.emit('library:changed');
if (State.get('currentView') === 'library') showLibrary();
});
return node;
}

function bindItems(container, items) {
if (!container || !Array.isArray(items)) return;
if (!(container instanceof HTMLElement) || !container.isConnected) return;
const _BIND_CAP = 500;
const rows = Array.from(container.querySelectorAll('.item-row, .folder-item'));
if (rows.length > _BIND_CAP) { rows.slice(_BIND_CAP).forEach(el => { el.tabIndex = -1; el.setAttribute('aria-hidden', 'true'); try { el.setAttribute('inert', ''); } catch (e) { console.warn('[content] inert', e); } }); }
let _firstUnbound = true;
rows.slice(0, _BIND_CAP).forEach((el, i) => {
if (el.dataset.bound === '1') return;
el.tabIndex = _firstUnbound ? 0 : -1;
_firstUnbound = false;
el.dataset.bound = '1';
el.addEventListener('keydown', ev => {
if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp' && ev.key !== 'Home' && ev.key !== 'End' && ev.key !== 'PageDown' && ev.key !== 'PageUp') return;
const all = Array.from(container.querySelectorAll('.item-row, .folder-item')).filter(x => !x.hidden);
if (!all.length) return;
const idx = all.indexOf(el);
if (idx < 0) return;
ev.preventDefault();
let next;
const STEP = Math.max(1, Math.floor(container.clientHeight / 60) || 10);
if (ev.key === 'Home') next = all[0];
else if (ev.key === 'End') next = all[all.length - 1];
else if (ev.key === 'PageDown') next = all[Math.min(all.length - 1, idx + STEP)];
else if (ev.key === 'PageUp') next = all[Math.max(0, idx - STEP)];
else if (ev.key === 'ArrowDown') next = all[(idx + 1) % all.length];
else next = all[(idx - 1 + all.length) % all.length];
if (!next) return;
all.forEach(r => r.tabIndex = -1);
next.tabIndex = 0;
try { next.focus(); } catch (e) { console.warn('[content] focus', e); }
if (next && typeof next.focus === 'function') { try { next.focus(); } catch {} if (typeof next.scrollIntoView === 'function') { let _reduce = false; try { _reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {} next.scrollIntoView({ block: 'nearest', behavior: _reduce ? 'auto' : 'smooth' }); } }
return;
});
el.addEventListener('click', (e) => {
if (e.shiftKey) { el.classList.toggle('is-selected'); return; }
if (e.defaultPrevented) return;
const it = (State.get('libraryItems') || []).find(x => x && x.id === el.dataset.id);
if (it) showDocument(it);
});
el.addEventListener('contextmenu', e => {
e.preventDefault();
const it = (State.get('libraryItems') || []).find(x => x && x.id === el.dataset.id);
if (!it) return;
showContextMenu(e.clientX, e.clientY, [
{ label: '📖 Open', onClick: () => showDocument(it) },
{ label: it.starred ? '☆ Unstar' : '⭐ Star', onClick: async () => {
const updated = Object.assign({}, it, { starred: !it.starred, lastModified: Date.now() });
try { await Store.put(updated); } catch (e) { console.warn('[content] star', e); return; }
State.set('libraryItems', (State.get('libraryItems') || []).map(x => x.id === it.id ? updated : x));
Bus.emit('library:changed');
if (State.get('currentView') === 'library') showLibrary();
} },
{ label: '✏️ Rename…', onClick: async () => {
const _oldTitle = String(it.title || '').slice(0, 200);
const choice = await Modal.prompt('Rename "' + _oldTitle + '"', { defaultValue: _oldTitle, okLabel: 'Rename' });
if (!choice || choice === it.title) return;
const updated = Object.assign({}, it, { title: String(choice).slice(0, 300), lastModified: Date.now() });
try { await Store.put(updated); } catch (e) { console.warn('[content] rename', e); return; }
State.set('libraryItems', (State.get('libraryItems') || []).map(x => x.id === it.id ? updated : x));
Bus.emit('library:changed');
if (State.get('currentView') === 'library') showLibrary();
} },
{ label: '🏷️ Add tag…', onClick: async () => {
const name = await Modal.prompt('Add tag', { okLabel: 'Add' });
if (!name) return;
const updated = Object.assign({}, it, { tags: Array.from(new Set([...(it.tags || []), name])), lastModified: Date.now() });
await Store.put(updated);
State.set('libraryItems', (State.get('libraryItems') || []).map(x => x.id === it.id ? updated : x));
Bus.emit('library:changed');
if (State.get('currentView') === 'library') showLibrary();
} },
{ separator: true },
{ label: '⬇ Export', onClick: () => Exporter.exportItem(it) },
{ label: '🗑 Delete', onClick: async () => {
const ok = await Modal.confirm('Delete "' + String(it.title || '').slice(0, 100) + '"?', { danger: true, okLabel: 'Delete' });
if (!ok) return;
const backup = Object.assign({}, it);
const assetKey = it.assetKey;
let assetBlob = null;
if (assetKey) { try { assetBlob = await Store.getAsset(assetKey); } catch (e) { console.warn('[content] backup asset', e); } }
try { await Store.putAsset('trash:' + it.id, new Blob([JSON.stringify(it)])); } catch (e) { console.warn('[content] trash', e); }
try { await Store.remove(it.id); } catch (e) { console.warn('[content] remove', e); return; }
if (assetKey) { try { await Store.removeAsset(assetKey); } catch (e) { console.warn('[content] removeAsset', e); } }
Undo.push({ label: 'Delete ' + String(it.title || '').slice(0, 80), undo: async () => {
try { await Store.put(backup); } catch (e) { console.warn('[content] undo put', e); }
if (assetKey && assetBlob) { try { await Store.putAsset(assetKey, assetBlob); } catch (e) { console.warn('[content] undo asset', e); } }
State.set('libraryItems', [...(State.get('libraryItems') || []), backup]);
Bus.emit('library:changed');
} });
Bus.emit('library:changed');
if (State.get('currentView') === 'library') showLibrary();
} }
]);
});
});
}

let _activeCtxCleanup = null;
function closeAnyContextMenu() {
if (typeof _activeCtxCleanup === 'function') { try { _activeCtxCleanup(); } catch (e) { console.warn('[content] ctx cleanup', e); } _activeCtxCleanup = null; }
const _m = document.getElementById('globalContextMenu');
if (_m) { _m.hidden = true; try { _m.replaceChildren(); } catch {} _m.style.visibility = ''; _m.style.left = ''; _m.style.top = ''; _m.removeAttribute('aria-activedescendant'); }
}
function showContextMenu(x, y, entries) {
if (!Array.isArray(entries)) return;
if (!Number.isFinite(x) || !Number.isFinite(y)) { x = 8; y = 8; }
x = Math.max(0, Math.min(x, window.innerWidth - 8));
y = Math.max(0, Math.min(y, window.innerHeight - 8));
closeAnyContextMenu();
const menu = document.getElementById('globalContextMenu') || document.createElement('div');
if (!menu.id) menu.id = 'globalContextMenu';
menu.hidden = false;
menu.replaceChildren();
menu.setAttribute('tabindex', '-1');
menu.setAttribute('role', 'menu');
menu.setAttribute('aria-orientation', 'vertical');
menu.setAttribute('aria-label', 'Context menu');
menu.style.left = x + 'px';
menu.style.top = y + 'px';
menu.style.visibility = 'hidden';
if (!menu.parentNode) document.body.appendChild(menu);
entries.slice(0, 100).forEach(entry => {
if (!entry || typeof entry !== 'object') return;
if (entry.separator) {
const hr = document.createElement('div');
hr.style.cssText = 'height:1px;margin:4px 6px;background:var(--border)';
menu.appendChild(hr);
return;
}
const b = document.createElement('button');
b.type = 'button';
b.setAttribute('role', 'menuitem');
b.textContent = entry.label == null ? '' : String(entry.label);
b.style.cssText = 'display:block;width:100%;text-align:left;padding:6px 10px;border:none;background:transparent;color:var(--text);font:inherit;font-size:13px;border-radius:5px;cursor:pointer';
b.addEventListener('mouseenter', () => { b.style.background = 'var(--bg-hover)'; });
b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
b.addEventListener('click', () => { closeAnyContextMenu(); try { if (typeof entry.onClick === 'function') entry.onClick(); } catch (e) { console.warn('[content] ctxMenu', e); } });
b.addEventListener('keydown', ev => {
if (ev.key === 'Escape') { closeAnyContextMenu(); return; }
if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
ev.preventDefault();
const btns = Array.from(menu.querySelectorAll('button'));
if (!btns.length) return;
const i = btns.indexOf(b);
if (i < 0) return;
const next = ev.key === 'ArrowDown' ? btns[(i + 1) % btns.length] : btns[(i - 1 + btns.length) % btns.length];
if (next) next.focus();
}
});
menu.appendChild(b);
});
const rect = menu.getBoundingClientRect();
if (rect.right > window.innerWidth - 8) menu.style.left = Math.max(8, x - rect.width) + 'px';
if (rect.bottom > window.innerHeight - 8) menu.style.top = Math.max(8, y - rect.height) + 'px';
menu.style.visibility = 'visible';
const _menuDismiss = (ev) => { if (!menu || !menu.isConnected) return; if (!ev || !ev.target) return; if (menu.contains(ev.target)) return; if (ev.type === 'scroll' && menu.contains(ev.target)) return; closeAnyContextMenu(); };
const _menuKey = (ev) => { if (!ev) return; if (ev.key === 'Escape') { try { ev.preventDefault(); } catch {} closeAnyContextMenu(); } };
if (_activeCtxCleanup) { try { _activeCtxCleanup(); } catch (e) { console.warn('[content] ctx prev cleanup', e); } }
_activeCtxCleanup = () => {
try { document.removeEventListener('mousedown', _menuDismiss, true); } catch (e) { console.warn('[content] ctx mousedown off', e); }
try { document.removeEventListener('keydown', _menuKey, true); } catch (e) { console.warn('[content] ctx keydown off', e); }
try { document.removeEventListener('scroll', _menuDismiss, true); } catch (e) { console.warn('[content] ctx scroll off', e); }
if (menu && menu.isConnected) { try { menu.replaceChildren(); } catch {} }
};
requestAnimationFrame(() => {
if (!menu.isConnected) return;
document.addEventListener('mousedown', _menuDismiss, true);
document.addEventListener('keydown', _menuKey, true);
const _ctxScrollTarget = e => { if (menu.contains(e.target)) return; _menuDismiss(e); };
document.addEventListener('scroll', _ctxScrollTarget, true);
const _prevCleanup = _activeCtxCleanup;
_activeCtxCleanup = () => {
if (typeof _prevCleanup === 'function') { try { _prevCleanup(); } catch (e) { console.warn('[content] ctx prev cleanup', e); } }
document.removeEventListener('mousedown', _menuDismiss, true);
document.removeEventListener('keydown', _menuKey, true);
document.removeEventListener('scroll', _ctxScrollTarget, true);
};
});
const _firstBtn = menu.querySelector('button');
if (_firstBtn) _firstBtn.focus();
}

function showLibrary() {
State.set('currentView', 'library');
document.title = 'CwtchLib — Library';
_searchHighlightTerm = '';
if (typeof window._libQuery !== 'string') window._libQuery = '';
const items = Array.isArray(State.get('libraryItems')) ? State.get('libraryItems') : [];
try { if (Status.setMode) Status.setMode('library'); if (Status.setCount) { let _pu = 'items'; try { _pu = (typeof Strings !== 'undefined' && typeof Strings.plural === 'function') ? Strings.plural(items.length, 'item', 'items') : (items.length === 1 ? 'item' : 'items'); } catch (e) { console.warn('[content] plural', e); } Status.setCount(items.length, _pu); } } catch (e) { console.warn('[content]', e); }
const _libCount = items.length;
if (_libCount !== _lastLibAnnounce) { _lastLibAnnounce = _libCount; }
const libM = ensure();
if (!libM) return;
libM.setAttribute('role', 'region');
libM.removeAttribute('aria-labelledby');
libM.setAttribute('aria-label', 'Library');
const folders = new Map();
const _vfRaw = Prefs.get('virtualFolders');
const virtualFolders = Array.isArray(_vfRaw) ? _vfRaw : [];
virtualFolders.forEach(f => { if (typeof f === 'string' && f && !folders.has(f)) folders.set(f, []); });
items.forEach(it => {
_normalizeItem(it);
const dir = (it.path || '').split('/').slice(0, -1).join('/');
if (!folders.has(dir)) folders.set(dir, []);
folders.get(dir).push(it);
});
let html = '<h1>Library</h1>';
let rootItems = folders.get('') || [];
let _sortBy = window._libSortBy;
if (!_sortBy) {
try {
const _sPref = Prefs.get('setting.library.sortMode', 'name-asc');
const _mapInit = { 'name-asc': 'source', 'name-desc': 'title', 'recent': 'recent', 'added': 'recent', 'modified': 'recent', 'size': 'size' };
_sortBy = _mapInit[_sPref] || 'source';
} catch (e) { _sortBy = 'source'; }
window._libSortBy = _sortBy;
}
if (_sortBy === 'title' || _sortBy === 'name-asc' || _sortBy === 'name-desc') {
const _desc = _sortBy === 'name-desc';
const _collator = (typeof Intl !== 'undefined' && Intl.Collator) ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }) : null;
const _cmp = _collator ? (x, y) => _collator.compare(x, y) : (x, y) => x.localeCompare(y);
rootItems = rootItems.slice().sort((a, b) => (_desc ? -1 : 1) * _cmp(a.title || '', b.title || ''));
} else if (_sortBy === 'recent' || _sortBy === 'added' || _sortBy === 'modified') {
rootItems = rootItems.slice().sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
} else if (_sortBy === 'kind') {
rootItems = rootItems.slice().sort((a, b) => (a.kind || '').localeCompare(b.kind || ''));
} else if (_sortBy === 'size') {
rootItems = rootItems.slice().sort((a, b) => (b.size || 0) - (a.size || 0));
}
const _viewMode = Prefs.get('setting.library.viewMode') || 'grid';
html += `<div class="lib-toolbar" style="display:flex;gap:8px;margin:10px 0"><input type="search" placeholder="Filter by title, kind, or path…" aria-label="Filter library" id="libFilter" maxlength="200" style="flex:1;padding:8px 12px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px"><select id="libSort" aria-label="Sort"><option value="source">Source</option><option value="title">Title</option><option value="recent">Recent</option><option value="kind">Kind</option></select></div>`;
const _itemsAll = items.slice();
if (!_itemsAll.length) {
html += `<div class="drawer__empty" style="padding:32px 20px;line-height:1.8">
<div style="font-size:32px;margin-bottom:10px">📚</div>
<div>${escapeHtml(Strings.t('library.empty', 'Your library is empty.'))}</div>
<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
<button class="demo-btn" data-act="import-folder">📁 Import folder</button>
<button class="demo-btn" data-act="import-files">📄 Import files</button>
<button class="demo-btn" data-act="new-note">📝 New note</button>
</div>
<div style="margin-top:12px;font-size:12px;color:var(--text-dim)">Or drag files directly onto the page</div>
</div>`;
show(html);
const m0 = ensure();
m0.querySelector('[data-act="import-folder"]')?.addEventListener('click', () => { try { FileUploader.pickFolder(); } catch (e) { console.warn('[library] pickFolder', e); } });
m0.querySelector('[data-act="import-files"]')?.addEventListener('click', () => { try { FileUploader.pickFiles(); } catch (e) { console.warn('[library] pickFiles', e); } });
m0.querySelector('[data-act="new-note"]')?.addEventListener('click', () => DrawerController.open('note'));
return;
}
const folderKeys = [...folders.keys()].filter(k => k);
html += `<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 0">
<h2 style="font-size:0.95rem">Folders</h2>
<button class="demo-btn" data-act="new-folder" style="padding:4px 10px;font-size:12px">＋ New folder</button>
</div>`;
if (folderKeys.length) {
html += `<div class="folder-list" role="list">`;
folderKeys.slice(0, 500).forEach(k => { const _n = folders.get(k).length; html += `<button class="folder-item" role="listitem" data-folder="${escapeHtml(k)}">📁 <span class="d-text">${escapeHtml(k)}</span> <span class="d-meta">${_n}</span></button>`; });
html += `</div>`;
}
html += `<div style="display:flex;gap:8px;align-items:center;margin:10px 0">
<button type="button" class="demo-btn" data-act="view-toggle">${_viewMode === 'grid' ? '☰ List' : '▦ Grid'}</button>
<span style="font-size:12px;color:var(--text-dim)">${rootItems.length} item${rootItems.length === 1 ? '' : 's'}</span>
</div>`;
if (_viewMode === 'grid') html += `<div class="lib-grid" role="list"></div>`;
else html += `<div class="item-list"></div>`;
show(html);
const m = ensure();
if (!m) return;
m.querySelector('[data-act="view-toggle"]')?.addEventListener('click', () => {
const cur = Prefs.get('setting.library.viewMode') || 'grid';
const next = cur === 'grid' ? 'list' : 'grid';
try { Prefs.set('setting.library.viewMode', next); } catch (e) { console.warn('[library] viewMode', e); }
showLibrary();
});
const fi = m.querySelector('#libFilter');
if (window._libAbort) { try { window._libAbort.abort(); } catch (e) { console.warn('[library] abort prev', e); } }
if (m._libFilterTimer) { clearTimeout(m._libFilterTimer); m._libFilterTimer = null; }
const _ac = new AbortController();
window._libAbort = _ac;
const ls = m.querySelector('#libSort');
if (fi) {
fi.value = window._libQuery || '';
const _apply = () => {
const q = (fi.value || '').trim().toLowerCase();
const list = m.querySelector('.item-list') || m.querySelector('.lib-grid');
if (!list) return;
list.querySelectorAll('.item-row').forEach(row => {
const text = (row.textContent || '').toLowerCase();
row.hidden = !!(q && !text.includes(q));
});
};
fi.addEventListener('input', () => {
clearTimeout(m._libFilterTimer);
m._libFilterTimer = setTimeout(() => { m._libFilterTimer = null; window._libQuery = fi.value; _apply(); }, 120);
}, { signal: _ac.signal });
if (fi.value) requestAnimationFrame(_apply);
}
if (ls) {
const _s = Prefs.get('setting.library.sortMode', 'name-asc');
const _map = { 'name-asc': 'source', 'name-desc': 'title', 'recent': 'recent', 'added': 'recent', 'modified': 'recent', 'size': 'size' };
const _mapped = _map[_s] || 'source';
ls.value = _mapped;
ls.addEventListener('change', () => { window._libSortBy = ls.value; showLibrary(); });
}
const list = m.querySelector('.item-list') || m.querySelector('.lib-grid');
if (list) {
const _raw = Prefs.get('setting.library.pageSize');
const _rawNum = Number(_raw);
const PAGE = (_raw === 'none' || _raw === 'all' || _raw == null) ? rootItems.length : (Number.isFinite(_rawNum) && _rawNum > 0 ? Math.min(_rawNum, 10000) : 200);
list.replaceChildren();
if (rootItems.length) {
const _pageItems = rootItems.slice(0, PAGE);
const _frag = document.createDocumentFragment();
_pageItems.forEach(it => { const row = itemRow(it); if (row) _frag.appendChild(row); });
list.appendChild(_frag);
if (rootItems.length > PAGE) {
const more = document.createElement('button');
more.type = 'button'; more.className = 'demo-btn';
more.style.cssText = 'margin:12px auto;display:block';
more.textContent = 'Load ' + Math.min(500, rootItems.length - PAGE) + ' more';
more.dataset.loadMore = '1';
let cursor = PAGE;
more.addEventListener('click', () => {
const _batch = rootItems.slice(cursor, cursor + 500);
const added = _batch.map(it => itemRow(it)).filter(Boolean);
added.forEach(row => list.appendChild(row));
bindItems(m, rootItems.slice(0, cursor + _batch.length));
cursor += _batch.length;
if (cursor >= rootItems.length) { more.remove(); }
else {
more.textContent = 'Load ' + Math.min(500, rootItems.length - cursor) + ' more (' + (rootItems.length - cursor) + ' remaining)';
more.dataset.nextPage = String(cursor);
}
});
list.appendChild(more);
}
} else list.innerHTML = '<div class="drawer__empty">Items live in folders. Pick a folder above.</div>';
}
bindItems(m, rootItems);
m.querySelectorAll('.folder-item').forEach(el => {
el.addEventListener('click', () => { try { showFolder(el.dataset.folder, false); } catch (e) { console.warn('[library] folder click', e); } });
el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showFolder(el.dataset.folder, false); } });
el.addEventListener('contextmenu', e => {
e.preventDefault();
const folder = el.dataset.folder;
showContextMenu(e.clientX, e.clientY, [
{ label: '✏️ Rename folder', onClick: async () => {
const n = await Modal.prompt('Rename folder', { defaultValue: folder, okLabel: 'Rename' });
if (!n || n === folder) return;
const vf = Prefs.get('virtualFolders');
const _clean = (Array.isArray(vf) ? vf : []).filter(x => typeof x === 'string' && x).map(x => x === folder ? String(n).slice(0, 200) : x);
Prefs.set('virtualFolders', Array.from(new Set(_clean)));
showLibrary();
} },
{ label: '🗑 Delete folder', onClick: () => {
const vf = Prefs.get('virtualFolders');
Prefs.set('virtualFolders', (Array.isArray(vf) ? vf : []).filter(x => x !== folder));
showLibrary();
} }
]);
});
});
m.querySelector('[data-act="new-folder"]')?.addEventListener('click', async () => {
const name = await Modal.prompt('New folder name', { okLabel: 'Create' });
if (!name) return;
const _vf = Prefs.get('virtualFolders');
const arr = Array.isArray(_vf) ? _vf.slice() : [];
if (!arr.includes(name)) arr.push(name);
Prefs.set('virtualFolders', arr);
showLibrary();
});
}

function showBacklinks(docId) {
State.set('currentView', 'library');
document.title = 'CwtchLib — Backlinks';
const items = State.get('libraryItems') || [];
const _target = items.find(x => x && x.id === docId);
if (!_target) return;
const _links = [];
const _seenLinks = new Set();
items.forEach(it => {
if (!it || typeof it.content !== 'string') return;
if (_seenLinks.has(it.id)) return;
const _re = /\[\[([^\]\n]{1,200})\]\]/g;
let _m;
while ((_m = _re.exec(it.content)) !== null) {
const _t = String(_m[1]).trim();
if (_t === _target.title) { _links.push(it); _seenLinks.add(it.id); break; }
}
});
const host = ensure();
host.setAttribute('role', 'region');
host.removeAttribute('aria-labelledby');
host.setAttribute('aria-label', 'Backlinks');
host.innerHTML = '<h1>Backlinks: ' + escapeHtml(_target.title) + '</h1>';
const list = document.createElement('div');
list.className = 'item-list';
if (!_links.length) list.innerHTML = '<div class="drawer__empty">No backlinks found.</div>';
_links.forEach(it => { const row = itemRow(it); if (row) list.appendChild(row); });
host.appendChild(list);
bindItems(host, _links);
}

function showTree() {
State.set('currentView', 'library');
document.title = 'CwtchLib — Tree';
const items = State.get('libraryItems') || [];
const host = ensure();
if (!host) return;
host.setAttribute('role', 'region');
host.removeAttribute('aria-labelledby');
host.setAttribute('aria-label', 'Tree view');
const tree = { name: '/', children: new Map(), items: [] };
items.forEach(it => {
if (!it || typeof it !== 'object') return;
const parts = String(it.path || '').split('/').filter(Boolean).slice(0, 64);
let node = tree;
if (!parts.length) { tree.items.push(it); return; }
parts.slice(0, -1).forEach(p => {
const _key = String(p).slice(0, 200);
if (!node.children.has(_key)) node.children.set(_key, { name: _key, children: new Map(), items: [] });
node = node.children.get(_key);
});
node.items.push(it);
});
const renderNode = (node, depth) => {
const frag = document.createDocumentFragment();
node.children.forEach(child => {
const row = document.createElement('div');
row.className = 'tree-folder';
row.style.paddingLeft = (8 + depth * 16) + 'px';
row.textContent = '📁 ' + child.name;
frag.appendChild(row);
frag.appendChild(renderNode(child, depth + 1));
});
node.items.forEach(it => { const row = itemRow(it); if (row) { row.style.paddingLeft = (8 + depth * 16) + 'px'; frag.appendChild(row); } });
return frag;
};
host.innerHTML = '<h1>Tree</h1>';
const wrapper = document.createElement('div');
wrapper.className = 'item-list';
wrapper.appendChild(renderNode(tree, 0));
host.appendChild(wrapper);
bindItems(host, items);
}

function showPathway(mode, key) {
State.set('currentView', 'pathway');
document.title = 'CwtchLib — Pathways';
_searchHighlightTerm = '';
try { Announce.polite('Pathways view'); } catch (e) { console.warn('[content] announce', e); }
const _mode = (mode === 'kind' || mode === 'folder' || mode === 'tag') ? mode : 'tag';
key = key == null ? '' : String(key).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200);
const _pathwayNextHash = '#pathway-' + encodeURIComponent(_mode + '\u001f' + key);
const items = Array.isArray(State.get('libraryItems')) ? State.get('libraryItems') : [];
const groups = new Map();
items.forEach(it => {
const k = _mode === 'kind' ? (it.kind || 'other') : _mode === 'folder' ? ((it.path || '').split('/').slice(0, -1).join('/') || 'root') : ((it.tags && it.tags.length) ? it.tags.slice().sort().join('+') : (it.kind || 'other'));
if (key && k !== key) return;
if (!groups.has(k)) groups.set(k, []);
groups.get(k).push(it);
});
const m = ensure();
m.setAttribute('role', 'region');
m.removeAttribute('aria-labelledby');
m.setAttribute('aria-label', 'Pathways');
if (!groups.size) {
show('<h1>Pathways</h1><div class="drawer__empty" style="padding:32px 20px">No pathways yet. Import content or add tags first.</div>');
Status.setMode('pathway'); Status.setCount(0, 'pathway');
if (DrawerController.getId()) DrawerController.close(true);
return;
}
const _modeLabel = _mode === 'kind' ? 'kind' : _mode === 'folder' ? 'folder' : 'tag';
let html = `<h1>Pathways${key ? ' — ' + escapeHtml(key) : ''}</h1>`;
html += `<p style="color:var(--text-dim)">Split by ${escapeHtml(_modeLabel)} · ${groups.size} pathway${groups.size === 1 ? '' : 's'} · ${items.length} item${items.length === 1 ? '' : 's'}</p>`;
html += `<div class="pathway-split" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-top:14px">`;
[...groups.entries()].forEach(([k, arr]) => {
html += `<section class="pathway-column" data-pathway="${escapeHtml(k)}" style="border:1px solid var(--border);border-radius:8px;padding:10px;background:var(--bg-elev)">`;
html += `<h2 style="font-size:0.9rem;margin:0 0 8px">📂 ${escapeHtml(k)} <span style="color:var(--text-dim);font-weight:400">(${arr.length})</span></h2>`;
html += `<div class="item-list" role="list"></div>`;
html += `</section>`;
});
html += `</div>`;
show(html);
try { if (location.hash !== _pathwayNextHash) history.replaceState(null, '', _pathwayNextHash); } catch (e) { console.warn('[content] pathway hash', e); }
m.querySelectorAll('.pathway-column').forEach(col => {
const k = col.dataset.pathway;
const arr = groups.get(k) || [];
const list = col.querySelector('.item-list');
if (!list) return;
arr.forEach(it => { const row = itemRow(it); if (row) list.appendChild(row); });
bindItems(list, arr);
});
Status.setMode('pathway'); Status.setCount(groups.size, groups.size === 1 ? 'pathway' : 'pathways');
if (DrawerController.getId()) DrawerController.close(true);
}

function showCanvas() {
State.set('currentView', 'library');
document.title = 'CwtchLib — Canvas';
const host = ensure();
if (!host) return;
host.setAttribute('role', 'region');
host.removeAttribute('aria-labelledby');
host.setAttribute('aria-label', 'Canvas');
host.innerHTML = '<h1>Canvas</h1><div class="drawer__empty">Canvas view is not available in this build. Import an SVG, drawio, or excalidraw file to view it.</div>';
try { DrawerController.close(true, true); } catch (e) { console.warn('[content] canvas close', e); }
}

function showFolder(folder, keepHash) {
if (typeof folder !== 'string' || !folder || folder.length > 500) return;
State.set('currentView', 'library');
try { Announce.polite('Opened folder ' + String(folder).slice(0, 200)); } catch (e) { console.warn('[content] announce', e); }
if (!keepHash) { try { const nextHash = '#folder-' + encodeURIComponent(folder); if (location.hash !== nextHash) history.replaceState(null, '', nextHash); } catch (e) { console.warn('[content] folder hash', e); } }
const items = (State.get('libraryItems') || []).filter(it => {
if (!it || typeof it.path !== 'string') return false;
const dir = it.path.split('/').slice(0, -1).join('/');
return dir === folder || dir.startsWith(folder + '/');
});
show(`<nav aria-label="Breadcrumb"><a href="#library" class="demo-btn">Library</a> / <h1 style="display:inline">📁 ${escapeHtml(folder)}</h1></nav><div class="item-list" role="list"></div>`);
const m = ensure();
m.setAttribute('role', 'region');
m.removeAttribute('aria-labelledby');
m.setAttribute('aria-label', 'Folder');
const list = m.querySelector('.item-list');
if (list) {
list.replaceChildren();
const _psRaw = Prefs.get('setting.library.pageSize');
const PAGE = (_psRaw === 'none' || _psRaw === 'all' || _psRaw == null) ? items.length : (Math.min(Number(_psRaw) || 200, items.length));
const _sorted = items.slice().sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' }));
const shown = _sorted.slice(0, PAGE);
const _frag = document.createDocumentFragment();
shown.forEach(it => { const row = itemRow(it); if (row) _frag.appendChild(row); });
list.appendChild(_frag);
if (!items.length) list.innerHTML = '<div class="drawer__empty">' + escapeHtml(Strings.t('folder.empty', 'Empty folder. Import files from the library drawer.')) + '</div>';
if (items.length > PAGE) {
const more = document.createElement('button');
more.type = 'button'; more.className = 'demo-btn';
more.style.cssText = 'margin:12px auto;display:block';
more.textContent = 'Load all (' + (items.length - PAGE) + ' more)';
more.addEventListener('click', () => {
more.remove();
const _fragRem = document.createDocumentFragment();
items.slice(PAGE).forEach(it => { const row = itemRow(it); if (row) _fragRem.appendChild(row); });
list.appendChild(_fragRem);
bindItems(m, items);
DrawerController.refresh();
});
list.appendChild(more);
}
}
bindItems(m, items);
}

function showSearchResults(hits, q) {
if (!Array.isArray(hits)) hits = [];
hits = hits.filter(x => x && typeof x === 'object' && typeof x.id === 'string').slice(0, 20000);
q = String(q == null ? '' : q).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200);
State.set('currentView', 'library');
document.title = 'CwtchLib — Search: ' + q;
_searchHighlightTerm = q;
try { Announce.polite(hits.length + ' result' + (hits.length === 1 ? '' : 's') + ' for ' + q); } catch (e) { console.warn('[content] announce', e); }
const nextHash = '#search-' + encodeURIComponent(q);
try { if (location.hash !== nextHash) history.replaceState(null, '', nextHash); } catch (e) { console.warn('[content] search hash', e); }
show(`<h1>Search: ${escapeHtml(q)}</h1><div class="item-list" role="list" aria-label="Search results"></div>`);
const m = ensure();
m.setAttribute('role', 'region');
m.removeAttribute('aria-labelledby');
m.setAttribute('aria-label', 'Search results');
const list = m.querySelector('.item-list');
if (list) {
m._searchCursor = 0;
m._searchHits = hits;
const _psRaw = Prefs.get('setting.library.pageSize');
const PAGE = (_psRaw === 'none' || _psRaw === 'all' || _psRaw == null) ? hits.length : (Math.min(Number(_psRaw) || 200, hits.length));
hits.slice(0, PAGE).forEach(it => { const row = itemRow(it); if (row) list.appendChild(row); });
if (!hits.length) list.innerHTML = '<div class="drawer__empty">' + escapeHtml(Strings.t('search.none', 'No matches')) + '</div>';
if (hits.length > PAGE) {
const more = document.createElement('button');
more.type = 'button'; more.className = 'demo-btn';
more.style.cssText = 'margin:12px auto;display:block';
let _cursorS = PAGE;
more.textContent = 'Load ' + Math.min(500, hits.length - _cursorS) + ' more';
more.addEventListener('click', () => {
const _batch = hits.slice(_cursorS, _cursorS + 500);
_batch.forEach(it => { const row = itemRow(it); if (row) list.appendChild(row); });
bindItems(m, _batch);
_cursorS += _batch.length;
if (_cursorS >= hits.length) { more.remove(); }
else { more.textContent = 'Load ' + Math.min(500, hits.length - _cursorS) + ' more'; more.dataset.next = String(_cursorS); }
});
list.appendChild(more);
}
}
bindItems(m, hits);
if (DrawerController.getId()) DrawerController.close(true, true);
}

function showOverview() {
State.set('currentView', 'library');
document.title = 'CwtchLib — ' + (Strings.t ? Strings.t('nav.overview', 'Overview') : 'Overview');
const items = Array.isArray(State.get('libraryItems')) ? State.get('libraryItems') : [];
const counts = Object.create(null);
items.forEach(it => { if (it && typeof it.kind === 'string' && it.kind.length < 64) counts[it.kind] = (counts[it.kind] || 0) + 1; });
const _kinds = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
let due = 0;
try { if (ReviewEngine && typeof ReviewEngine.getDue === 'function') due = ReviewEngine.getDue().length; } catch (e) { console.warn('[overview] due failed', e); }
const ovM = ensure();
ovM.setAttribute('role', 'region');
ovM.removeAttribute('aria-labelledby');
ovM.setAttribute('aria-label', 'Overview');
let _limit = 10;
try { const _rl = Number(Prefs.get('setting.library.recentLimit')); if (Number.isFinite(_rl) && _rl > 0) _limit = Math.min(_rl, 1000); } catch (e) { console.warn('[overview] recentLimit pref', e); }
if (typeof window._recentLimit === 'number' && Number.isFinite(window._recentLimit) && window._recentLimit > 0 && window._recentLimit <= 1000) _limit = window._recentLimit;
const recent = items.slice().sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0)).slice(0, _limit);
const _itemWord = items.length === 1 ? 'item' : 'items';
const _dueWord = due === 1 ? 'due card' : 'due cards';
const _safeHeading = escapeHtml(Strings.t ? Strings.t('overview.heading', 'Overview') : 'Overview');
const _kindSlice = _kinds.slice(0, 5);
const _safeKindSummary = _kindSlice.map(k => escapeHtml(String(k)) + ' ' + (counts[k] || 0)).join(' · ') + (_kinds.length > 5 ? ' · top 5 of ' + _kinds.length + ' kinds' : '');
show(`<h1>${_safeHeading}</h1>

<p>${items.length} ${_itemWord}${_safeKindSummary ? ' · ' + _safeKindSummary : ''} · ${due} ${_dueWord}</p>
<div class="item-list" role="list"></div>`);
const m = ensure();
const list = m.querySelector('.item-list');
if (list) {
if (recent.length) recent.forEach(it => { const row = itemRow(it); if (row) list.appendChild(row); });
else list.innerHTML = '<div class="drawer__empty">No items yet.</div>';
}
bindItems(m, recent);
if (DrawerController.getId && DrawerController.getId()) DrawerController.close(true, true);
}

function showReview(card) {
if (!card || typeof card !== 'object' || typeof card.content !== 'string' || !card.id) return;
if (card.content.length > 200000) { console.warn('[review] content too large'); return; }
State.set('currentView', 'review');
const _mLive = document.getElementById('main');
if (_mLive) _mLive.removeAttribute('aria-live');
let d = {};
try { d = JSON.parse(card.content); if (!d || typeof d !== 'object' || Array.isArray(d)) d = {}; } catch (e) { console.warn('[review] parse failed', e); d = {}; }
if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};
if (typeof d.front !== 'string') d.front = '';
if (typeof d.back !== 'string') d.back = '(no answer)';
d.front = d.front.slice(0, 50000);
d.back = d.back.slice(0, 50000);
try { d._lastRevealAt = 0; } catch {}
document.title = (Strings.t ? Strings.t('nav.review', 'Review') : 'Review') + ' — CwtchLib';
const nextHash = '#review-' + card.id;
if (location.hash !== nextHash) history.pushState(null, '', nextHash);
const m = ensure();
const _tab = document.getElementById('tab-' + card.id);
if (_tab) { m.setAttribute('role', 'tabpanel'); m.setAttribute('aria-labelledby', 'tab-' + card.id); m.removeAttribute('aria-label'); }
else { m.setAttribute('role', 'region'); m.removeAttribute('aria-labelledby'); m.setAttribute('aria-label', 'Review'); }
m.setAttribute('aria-live', 'polite');
m.innerHTML = `<article class="doc">

<h1>${escapeHtml(Strings.t('review.heading', 'Review'))}</h1>
<div class="review-card">
<div class="front">${escapeHtml(d.front || '')}</div>
<div class="back"><em>${escapeHtml(Strings.t('review.prompt', 'Think, then reveal →'))}</em></div>
</div>
<div class="review-btns">
<button class="demo-btn" data-act="show">${escapeHtml(Strings.t ? Strings.t('review.show', '👁 Show answer') : '👁 Show answer')}</button>
</div>
</article>`;
const _showBtn = m.querySelector('[data-act="show"]');
if (!_showBtn) return;
_showBtn.addEventListener('click', () => {
const _back = m.querySelector('.back');
if (_back) _back.textContent = d.back || '(no answer)';
try { d._lastRevealAt = Date.now(); card.content = JSON.stringify(d); } catch (e) { console.warn('[review] reveal', e); }
try { if (typeof Store !== 'undefined' && Store.put) { const _upd = Object.assign({}, card, { content: card.content }); Promise.resolve(Store.put(_upd)).catch(e => console.warn('[review] persist reveal', e)); } } catch (e) { console.warn('[review] persist setup', e); }
const _rb = m.querySelector('.review-btns');
if (_rb) _rb.innerHTML = `
<button class="demo-btn" data-g="1" type="button">😕 Again</button>
<button class="demo-btn" data-g="2" type="button">😐 Hard</button>
<button class="demo-btn" data-g="3" type="button">🙂 Good</button>
<button class="demo-btn" data-g="4" type="button">😄 Easy</button>`;
m.querySelectorAll('[data-g]').forEach(b => {
b.addEventListener('click', async () => {
try {
await ReviewEngine.grade(card, Number(b.dataset.g));
try { Toast.success('Updated'); } catch (toastErr) { console.warn('[review] toast', toastErr); }
} catch (e) { console.warn('[review] grade', e); try { Toast.error('Grade failed'); } catch {} return; }
try { DrawerController.close(true); } catch (e) { console.warn('[review] close', e); }
const _due = (() => { try { return ReviewEngine.getDue() || []; } catch { return []; } })();
if (_due.length && State.get('currentView') === 'review') {
const _n = _due.find(x => x && x.id !== card.id);
if (_n) showReview(_n);
else showLibrary();
}
});
});
});
window.scrollTo({ top: 0, behavior: 'auto' });
if (document.hasFocus()) m.focus({ preventScroll: true });
DrawerController.close(true, true);
}


const DEFAULT_DOC_ACTIONS = [['toc', '☰ TOC'], ['edit', '✏️ Edit'], ['print', '🖨 Print'], ['star', null], ['export', '⬇ Export'], ['delete', '🗑 Delete']];
let _docActionsCache = null;
let _docActionsCacheKey = null;
function docActions(item) {
if (!item || typeof item !== 'object') return DEFAULT_DOC_ACTIONS;
let custom = null;
try { custom = Prefs.get('setting.ui.docActions'); } catch (e) { console.warn('[content] docActions pref', e); }
const _tagsKey = Array.isArray(item.tags) ? item.tags.slice(0, 20).map(t => String(t).replace(/\u001f/g, '').slice(0, 64)).join('\u001f') : '';
const _customKey = (Array.isArray(custom) && custom.length && custom.length <= 40) ? JSON.stringify(custom).slice(0, 4000) : 'default';
const key = _customKey + '|' + (item.starred ? '1' : '0') + '|' + (item.kind || '') + '|' + _tagsKey;
if (_docActionsCache && _docActionsCacheKey === key) return _docActionsCache;
const list = (Array.isArray(custom) && custom.length && custom.every(x => Array.isArray(x) && x.length === 2 && typeof x[0] === 'string')) ? custom : DEFAULT_DOC_ACTIONS;
_docActionsCache = list.map(([a, l]) => [a, a === 'star' ? (item.starred ? '⭐ Starred' : '☆ Star') : l]);
_docActionsCacheKey = key;
return _docActionsCache;
}

function init() { ensure(); }
return { show, showDocument, showLibrary, showFolder, showSearchResults, showOverview, showReview, showTree, showPathway, showCanvas, showBacklinks, docActions, init, showContextMenu };
})();