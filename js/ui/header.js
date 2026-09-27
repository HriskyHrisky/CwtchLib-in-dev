
import { State } from '../core/state.js';
import { Config } from '../core/config.js';
import { escapeHtml } from '../core/escape.js';
import { Prefs } from '../core/prefs.js';
import { Toast } from './toast.js';
import { Modal } from './modal.js';
import { DrawerController } from './drawer.js';
import { ContentView } from '../library/content-view.js';
import { Editor } from '../editor/editor.js';
import { ReviewEngine } from '../srs/review-engine.js';
import { Theme } from '../theme/theme.js';
import { TOC } from './toc.js';

export const HeaderRenderer = (() => {
let track;
let _dueCache = null;
let _dueCacheRev = -1;
const HANDLERS = {
library: () => {
try { ContentView.showLibrary(); } catch (e) { console.warn('[header]', e); }
try { if (DrawerController.getId && DrawerController.getId()) DrawerController.close(); } catch (e) { console.warn('[header] drawer close', e); }
},
search: () => { try { DrawerController.open('search'); } catch (e) { console.warn('[header] search open', e); } },
starred: () => {
const raw = State.get('libraryItems') || [];
const items = raw.filter(x => x && x.starred === true);
if (!items.length) { try { Toast.show('No starred items yet. Star a document to see it here.'); } catch (e) { console.warn('[header] starred toast', e); } return; }
if (ContentView.showSearchResults) { ContentView.showSearchResults(items, '★ starred'); try { if (DrawerController.getId && DrawerController.getId()) DrawerController.close(); } catch (e) { console.warn('[header] close after starred', e); } }
else Toast.show('Starred view unavailable');
},
delete: () => Toast.show('Delete is available in the document toolbar'),
  note: () => DrawerController.open('note'),
  edit: () => { const id = State.get('activeTabId'); if (!id) { Toast.show('Open a document first'); return; } try { Editor.open(id); } catch (e) { console.warn('[header] Editor.open failed', e); Toast.show('Editor unavailable'); } },
review: () => DrawerController.open('review'),
tags: () => DrawerController.open('tags'),
settings: () => DrawerController.open('settings'),
help: () => DrawerController.open('help'),
headerGrid: () => openHeaderGrid(),
tts: () => { const el = document.getElementById('ttsBar'); if (!el) { Toast.show('Text-to-speech is not enabled'); return; } const _on = el.hidden; el.hidden = !_on; try { if (_on && typeof window._ttsStart === 'function') window._ttsStart(); else if (!_on && typeof window._ttsStop === 'function') window._ttsStop(); } catch (e) { console.warn('[header] tts toggle', e); } },
theme: () => { const cur = (typeof Theme !== 'undefined' && typeof Theme.getMode === 'function') ? Theme.getMode() : (document.body.dataset.theme === 'light' ? 'light' : 'dark'); const next = cur === 'dark' ? 'light' : 'dark'; try { if (typeof Theme !== 'undefined' && typeof Theme.setMode === 'function') Theme.setMode(next); else document.body.dataset.theme = next; } catch (e) { console.warn('[header] theme toggle failed', e); } Toast.show('Theme: ' + next); },
readerNav: () => { if (typeof TOC !== 'undefined' && typeof TOC.toggle === 'function') TOC.toggle(); },
annotate: () => Toast.show('Annotate menu not wired'),
media: () => Toast.show('Media panel not wired'),
collab: () => Toast.show('Collaboration not wired'),
saveStatus: () => Toast.show('Save status: ' + (State.get('currentView') === 'edit' ? 'editing' : 'idle')),
docTools: () => Toast.show('Document tools not wired'),
ai: () => Toast.show('AI assistant not wired'),
zen: () => {
const on = !document.body.classList.contains('zen-mode');
        document.body.classList.toggle('zen-mode', on);
try { Prefs.set('setting.layout.zenMode', on); } catch (e) { console.warn('[header] zen persist', e); }
Toast.show('Zen mode ' + (on ? 'on' : 'off'));
},
typewriter: () => {
const on = !document.body.classList.contains('typewriter-mode');
        document.body.classList.toggle('typewriter-mode', on);
try { Prefs.set('setting.layout.typewriterMode', on); } catch (e) { console.warn('[header] typewriter persist', e); }
Toast.show('Typewriter mode ' + (on ? 'on' : 'off'));
},
focusParagraph: () => {
const on = !document.body.classList.contains('focus-paragraph');
        document.body.classList.toggle('focus-paragraph', on);
try { Prefs.set('setting.layout.focusParagraph', on); } catch (e) { console.warn('[header] focus-para persist', e); }
Toast.show('Focus paragraph ' + (on ? 'on' : 'off'));
},
fullscreen: () => {
try {
if (document.fullscreenElement) { const _p = document.exitFullscreen(); if (_p && typeof _p.catch === 'function') _p.catch(e => console.warn('[header] exit fs', e)); }
else { const _p2 = document.documentElement.requestFullscreen(); if (_p2 && typeof _p2.catch === 'function') _p2.catch(e => console.warn('[header] fs', e)); }
} catch (e) { console.warn('[header] fullscreen', e); }
},
};
const _loggedUnknown = new Set();
function _condVisible(id) {
const view = State.get('currentView');
switch (id) {
case 'annotate-menu': return view === 'edit' || view === 'doc';
case 'ai': { try { return !!Prefs.get('setting.ai.enabled'); } catch (e) { console.warn('[header] ai pref', e); return false; } }
case 'collab': { try { return !!Prefs.get('setting.collab.enabled'); } catch (e) { console.warn('[header] collab pref', e); return false; } }
default: return false;
}
}
function _visibleHeaderItems() {
let hidden;
try { hidden = Prefs.get('hiddenHeaderIds'); } catch (e) { console.warn('[header] hiddenHeaderIds read', e); hidden = null; }
const hiddenArr = Array.isArray(hidden) ? hidden.filter(x => typeof x === 'string' && x.length < 64) : [];
const _all = Array.isArray(Config.headerAll) ? Config.headerAll : [];
const _condAll = Array.isArray(Config.headerConditionalSafe) ? Config.headerConditionalSafe : [];
const _seen = new Set();
const base = _all.filter(it => { if (!it || typeof it.id !== 'string' || !it.id || hiddenArr.includes(it.id) || _seen.has(it.id)) return false; _seen.add(it.id); return true; });
const cond = _condAll.filter(it => { if (!it || typeof it.id !== 'string' || !it.id || _seen.has(it.id) || hiddenArr.includes(it.id)) return false; if (!_condVisible(it.id)) return false; _seen.add(it.id); return true; });
const merged = [...base, ...cond];
return merged;
}
function openHeaderGrid() {
const wrap = document.createElement('div');
wrap.setAttribute('role', 'menu');
wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow-y:auto';
if (typeof Modal === 'undefined' || typeof Modal.open !== 'function') { console.warn('[header] Modal unavailable'); try { if (typeof Toast !== 'undefined' && Toast.show) Toast.show('Modal unavailable'); } catch (e) { console.warn('[header] modal toast', e); } return; }
const _cat = Array.isArray(Config.headerCatalog) ? Config.headerCatalog : [];
const _cond = Array.isArray(Config.headerConditional) ? Config.headerConditional : [];
const _seenHdr = new Set();
const all = [..._cat, ..._cond].filter(h => {
if (!h || typeof h !== 'object' || typeof h.id !== 'string' || !h.id) return false;
if (_seenHdr.has(h.id)) return false;
_seenHdr.add(h.id);
return true;
}).slice(0, 500);
const hidden = Prefs.get('hiddenHeaderIds');
const hiddenArr = Array.isArray(hidden) ? hidden.filter(x => typeof x === 'string') : [];
all.forEach(h => {
if (!h || typeof h.id !== 'string' || !h.id) return;
const row = document.createElement('div');
row.style.cssText = 'display:flex;align-items:center;gap:6px';
const b = document.createElement('button');
b.type = 'button';
b.className = 'drawer__item';
b.style.flex = '1';
const isHidden = hiddenArr.includes(h.id);
b.innerHTML = '<span class="d-icon" aria-hidden="true">' + escapeHtml(h.icon || '') + '</span><span class="d-text">' + escapeHtml(h.label || h.id) + '</span><span class="d-meta">' + (isHidden ? 'hidden' : h.placement || 'header') + '</span>';
b.addEventListener('click', () => { try { Modal.dismiss(); } catch (e) { console.warn('[header] modal dismiss', e); } const fn = HANDLERS[h.handler] || HANDLERS[h.id]; if (typeof fn === 'function') { try { fn(); } catch (e) { console.warn('[header] handler threw', e); } } else Toast.show('No handler for ' + h.id); });
row.appendChild(b);
const toggleBtn = document.createElement('button');
toggleBtn.type = 'button';
toggleBtn.className = 'drawer__btn' + (isHidden ? ' is-primary' : '');
toggleBtn.style.cssText = 'padding:4px 10px;font-size:12px';
toggleBtn.textContent = isHidden ? 'Show' : 'Hide';
toggleBtn.addEventListener('click', () => {
const _curRaw = Prefs.get('hiddenHeaderIds');
const _cur = Array.isArray(_curRaw) ? _curRaw.slice() : [];
const i = _cur.indexOf(h.id);
if (i >= 0) _cur.splice(i, 1); else _cur.push(h.id);
Prefs.set('hiddenHeaderIds', _cur);
HeaderRenderer.render();
const _nowHidden = _cur.includes(h.id);
toggleBtn.textContent = _nowHidden ? 'Show' : 'Hide';
toggleBtn.classList.toggle('is-primary', _nowHidden);
const _meta = row.querySelector('.d-meta');
if (_meta) _meta.textContent = _nowHidden ? 'hidden' : (h.placement || 'header');
});
row.appendChild(toggleBtn);
wrap.appendChild(row);
});
try { Modal.open({ title: 'All sections', body: wrap, actions: [{ label: 'Close', value: null }] }); } catch (e) { console.warn('[header] modal open', e); }
}
let _tagCountCache = null, _tagCountCacheRev = -1;
function getBadges() {
const items = Array.isArray(State.get('libraryItems')) ? State.get('libraryItems') : [];
let _rev = '0:' + items.length;
let _starRev = 0;
let _tagFingerprint = 0;
try {
const _rawRev = (State.getRevision && typeof State.getRevision === 'function') ? State.getRevision() : 0;
_rev = String(_rawRev) + ':' + items.length;
} catch (e) { console.warn('[header] rev', e); }
try {
let _h = 2166136261;
const _cap = Math.min(items.length, 5000);
for (let i = 0; i < _cap; i++) {
const x = items[i];
if (!x) continue;
if (x.starred) _starRev++;
const _tags = Array.isArray(x.tags) ? x.tags : [];
for (let j = 0; j < _tags.length; j++) {
const s = String(_tags[j]).slice(0, 120);
for (let k = 0; k < s.length; k++) { _h ^= s.charCodeAt(k); _h = Math.imul(_h, 16777619) | 0; }
}
_h = Math.imul(_h ^ i, 16777619) | 0;
}
_tagFingerprint = _h >>> 0;
} catch (e) { console.warn('[header] tagsRev', e); }
if (_tagCountCacheRev !== _rev + ':' + _tagFingerprint + ':' + _starRev) {
_tagCountCacheRev = _rev + ':' + _tagFingerprint + ':' + _starRev;
const _seen = new Set();
for (const i of items) {
if (!i || typeof i !== 'object') continue;
const t = i.tags;
if (!Array.isArray(t)) continue;
for (const _tt of t) { if (typeof _tt === 'string' && _tt && _tt.length < 200) _seen.add(_tt); }
}
_tagCountCache = _seen.size;
}
return { review: _refreshDueCache(), tags: _tagCountCache || 0 };
}
function _refreshDueCache() {
const _items = State.get('libraryItems') || [];
let _h = 2166136261;
let _cardCount = 0;
const _cap = Math.min(_items.length, 20000);
for (let i = 0; i < _cap; i++) {
const it = _items[i];
if (!it || it.kind !== 'card') continue;
_cardCount++;
let _susp = 0;
try { const _d = JSON.parse(String(it.content || '{}')); if (_d && _d.suspended === true) _susp = 1; } catch (e) { if (!_refreshDueCache._warned) { _refreshDueCache._warned = true; console.debug('[header] card content parse skipped'); } }
const s = String(it.id || '') + ':' + (it.lastModified || 0) + ':' + (typeof it.content === 'string' ? it.content.length : 0) + ':' + (it.contentHash || '') + ':' + _susp;
for (let j = 0; j < s.length; j++) { _h ^= s.charCodeAt(j); _h = Math.imul(_h, 16777619) | 0; }
}
const _sig = String(_h >>> 0) + ':' + _items.length + ':' + _cardCount;
if (_dueCacheRev !== _sig) {
_dueCacheRev = _sig;
try { if (typeof ReviewEngine !== 'undefined' && ReviewEngine.getDue) { const _due = ReviewEngine.getDue(); _dueCache = Array.isArray(_due) ? _due.length : 0; } else _dueCache = State.get('reviewCount') || 0; }
catch (e) { console.warn('[header] due cache failed', e); _dueCache = 0; }
}
return _dueCache || 0;
}
let lastSig = '';
let _raf = null;
function render() {
if (_raf) cancelAnimationFrame(_raf);
_raf = requestAnimationFrame(() => {
_raf = null;
try { _renderNow(); } catch (e) { console.warn('[header] render', e); }
});
}
function destroy() {
if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
if (typeof window._onHeaderResizeBoundFn === 'function') { try { window.removeEventListener('resize', window._onHeaderResizeBoundFn, { passive: true }); } catch (e) { console.warn('[header] destroy resize', e); } window._onHeaderResizeBoundFn = null; window._onHeaderResizeBound = false; }
if (track && track._onHeaderRO) { try { track._onHeaderRO.disconnect(); } catch (e) { console.warn('[header] RO destroy', e); } track._onHeaderRO = null; }
if (track && track._onHeaderScrollBoundFn) { try { track.removeEventListener('scroll', track._onHeaderScrollBoundFn, { passive: true }); } catch (e) { console.warn('[header] removeScroll destroy', e); } track._onHeaderScrollBound = false; track._onHeaderScrollBoundFn = null; }
if (track && track._onHeaderClick) { try { track.removeEventListener('click', track._onHeaderClick); } catch (e) { console.warn('[header] removeClick destroy', e); } track._onHeaderClick = null; }
if (Config) { Config._headerCache = null; Config._headerCacheKey = null; }
_dueCacheRev = -1; _dueCache = null;
_tagCountCacheRev = -1; _tagCountCache = null;
_loggedUnknown.clear();
try { if (window._cwtchFocusShortcutFn) { document.removeEventListener('keydown', window._cwtchFocusShortcutFn, true); window._cwtchFocusShortcutFn = null; window._cwtchFocusShortcut = false; } } catch (e) { console.warn('[header] remove focus shortcut', e); }
track = null; lastSig = '';
}
function _headerSignature(_items, badges) {
let _h = 2166136261;
if (!Array.isArray(_items)) return '';
const _step = _items.length > 20000 ? Math.ceil(_items.length / 20000) : 1;
for (let i = 0; i < _items.length; i += _step) {
const it = _items[i];
if (!it) continue;
const _b = (badges && (it.id === 'review' ? badges.review : it.id === 'tags' ? badges.tags : 0)) || 0;
const _cl = it.content && typeof it.content === 'string' ? it.content.length : 0;
const s = String(it.id || '') + '|' + String(it.icon || '').slice(0, 8) + '|' + String(it.label || '').slice(0, 64) + '|' + _b + '|' + _cl + ';';
for (let j = 0; j < s.length; j++) { _h ^= s.charCodeAt(j); _h = Math.imul(_h, 16777619) | 0; }
}
return String(_h >>> 0) + ':' + _items.length + ':' + _step;
}
function _renderNow() {
try {
const _cur = document.getElementById('headerTrack');
if (!_cur) { track = null; return; }
if (_cur && _cur !== track) {
if (track && track._onHeaderClick) { try { track.removeEventListener('click', track._onHeaderClick); } catch (e) { console.warn('[header] removeClick', e); } }
if (track && track._onHeaderScrollBoundFn) { try { track.removeEventListener('scroll', track._onHeaderScrollBoundFn, { passive: true }); } catch (e) { console.warn('[header] removeScroll', e); } }
if (track && track._onHeaderRO) { try { track._onHeaderRO.disconnect(); } catch (e) { console.warn('[header] RO disconnect', e); } }
if (track) { track._onHeaderClick = null; track._onHeaderScrollBound = false; track._onHeaderScrollBoundFn = null; track._onHeaderRO = null; }
track = _cur;
}
if (!track) return;
if (!track._onHeaderClick) {
track._onHeaderClick = e => {
const btn = e.target && e.target.closest ? e.target.closest('.header__option') : null;
if (!btn || !track.contains(btn)) return;
if (btn.hidden) return;
if (e.defaultPrevented) return;
if (e.button !== undefined && e.button !== 0) return;
try { onSelect(btn.dataset.id); } catch (err) { console.warn('[header] onSelect threw', err); }
};
track.addEventListener('click', track._onHeaderClick);
}
const badges = getBadges();
const _items = _visibleHeaderItems();
const sig = _headerSignature(_items, badges);
if (sig !== lastSig) {
lastSig = sig;
const prevFocusEl = track.contains(document.activeElement) ? document.activeElement : null;
const prevFocusId = prevFocusEl && prevFocusEl.dataset ? prevFocusEl.dataset.id : null;
let rovingTabindex = false;
track.innerHTML = _items.slice(0, 200).map(item => {
if (!item || typeof item.id !== 'string' || item.id.length > 200) return '';
const tabbable = !rovingTabindex;
if (tabbable) rovingTabindex = true;
const safeId = escapeHtml(item.id);
const safeIcon = escapeHtml(String(item.icon || '').slice(0, 8));
const count = Math.max(0, Number(badges[item.id]) || 0);
const _countStr = count > 999 ? '999+' : String(count);
const badgeHtml = count > 0 ? '<span class="hdr-badge" aria-hidden="true">' + _countStr + '</span>' : '';
const ariaLabel = String(item.label || item.id).slice(0, 100) + (count > 0 ? ' (' + _countStr + ')' : '');
return '<button type="button" class="header__option" data-id="' + safeId + '" tabindex="' + (tabbable ? '0' : '-1') + '" aria-label="' + escapeHtml(ariaLabel) + '" title="' + escapeHtml(ariaLabel) + '">' +
'<span class="hdr-icon" aria-hidden="true">' + safeIcon + '</span>' +
'<span class="hdr-label">' + escapeHtml(String(item.label || item.id).slice(0, 100)) + '</span>' +
badgeHtml +
'</button>';
}).join('');
if (prevFocusId && typeof prevFocusId === 'string') {
let restored = null;
try {
if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
restored = track.querySelector('[data-id="' + CSS.escape(prevFocusId) + '"]');
}
} catch (e) { console.warn('[header] restore query', e); }
if (restored && !restored.hidden) { try { restored.focus(); } catch (e) { console.warn('[header] restore focus', e); } }
else { const first = track.querySelector('.header__option:not([hidden])'); if (first) { try { first.focus(); } catch (e) { console.warn('[header] restore focus first', e); } } }
}
function updateHeaderOverflowHint() {
const trackEl = document.getElementById('headerTrack');
if (!trackEl) return;
const atEnd = trackEl.scrollLeft + trackEl.clientWidth >= trackEl.scrollWidth - 2;
const hasOverflow = trackEl.scrollWidth > trackEl.clientWidth + 2;
trackEl.classList.toggle('has-overflow-end', hasOverflow && !atEnd);
}
if (!track._onHeaderScrollBound) {
track._onHeaderScrollBound = true;
track._onHeaderScrollBoundFn = updateHeaderOverflowHint;
track.addEventListener('scroll', updateHeaderOverflowHint, { passive: true });
}
if (!window._onHeaderResizeBound) {
window._onHeaderResizeBound = true;
window._onHeaderResizeBoundFn = updateHeaderOverflowHint;
window.addEventListener('resize', window._onHeaderResizeBoundFn, { passive: true });
}
if (typeof ResizeObserver === 'function' && !track._onHeaderRO) {
try {
let _roRaf = 0;
track._onHeaderRO = new ResizeObserver(() => { if (_roRaf) return; _roRaf = requestAnimationFrame(() => { _roRaf = 0; updateHeaderOverflowHint(); }); });
track._onHeaderRO.observe(track);
} catch (e) { console.warn('[header] RO', e); }
}
let activeId = State.get('activeHeaderId');
if (activeId === undefined) activeId = 'library';
let activeBtn = null;
try { activeBtn = activeId ? track.querySelector('[data-id="' + CSS.escape(activeId) + '"]') : null; } catch (e) { console.warn('[header] activeBtn', e); }
if (activeId && (!activeBtn || activeBtn.hidden)) {
const first = track.querySelector('.header__option:not([hidden])');
activeId = first && first.dataset ? first.dataset.id : null;
if (activeId) State.set('activeHeaderId', activeId);
}
setActive(activeId);
requestAnimationFrame(updateHeaderOverflowHint);
} else {
let activeId = State.get('activeHeaderId');
if (activeId === undefined) activeId = 'library';
let activeBtn = null;
try { activeBtn = activeId ? track.querySelector('[data-id="' + CSS.escape(activeId) + '"]') : null; } catch (e) { console.warn('[header] activeBtn', e); }
if (activeId && (!activeBtn || activeBtn.hidden)) {
const first = track.querySelector('.header__option:not([hidden])');
activeId = first && first.dataset ? first.dataset.id : null;
if (activeId) State.set('activeHeaderId', activeId);
}
setActive(activeId);
}
function setActive(id) {
if (!track) return false;
const buttons = Array.from(track.querySelectorAll('.header__option'));
let matched = false;
let _firstVisible = null;
buttons.forEach(btn => {
const on = !!id && btn.dataset.id === id;
if (on && !btn.hidden) matched = true;
if (!btn.hidden && !_firstVisible) _firstVisible = btn;
btn.classList.toggle('is-active', on);
if (on) { btn.setAttribute('aria-current', 'page'); btn.setAttribute('tabindex', '0'); }
else { btn.removeAttribute('aria-current'); btn.setAttribute('tabindex', '-1'); }
});
if (!matched && _firstVisible) { _firstVisible.setAttribute('tabindex', '0'); return true; }
return matched;
}
function onSelect(id) {
if (typeof id !== 'string' || !id || id.length > 64) return;
if (!/^[A-Za-z0-9_.\-]{1,64}$/.test(id)) { console.warn('[header] invalid id', id); return; }
if (!Object.prototype.hasOwnProperty.call(HANDLERS, id)) { console.warn('[header] no handler for', id); if (!_loggedUnknown.has(id)) { _loggedUnknown.add(id); try { if (typeof Toast !== 'undefined') Toast.show('No handler for ' + id); } catch (e) { console.warn('[header] unknown toast', e); } } return; }
const fn = HANDLERS[id];
if (typeof fn !== 'function') { console.warn('[header] no handler for', id); return; }
try {
State.set('activeHeaderId', id);
setActive(id);
fn();
} catch (e) { console.warn('[header] onSelect', id, e); }
}
return { render, setActive, _refreshDueCache, openHeaderGrid, destroy, onSelect };
})();