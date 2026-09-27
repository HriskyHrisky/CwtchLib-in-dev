
import { State } from '../core/state.js';
import { Prefs } from '../core/prefs.js';
import { Bus } from '../core/bus.js';
import { EVENTS } from '../core/events.js';
import { Editor } from '../editor/editor.js';
import { Modal } from './modal.js';
import { ContentView } from '../library/content-view.js';
import { Announce } from './announce.js';
import { Toast } from './toast.js';

export const Tabs = (() => {
let _scrollLeft = 0;
let _tabsRenderRaf = null;
function render() {
if (_tabsRenderRaf) return;
_tabsRenderRaf = requestAnimationFrame(() => { _tabsRenderRaf = null; try { _renderNow(); } catch (e) { console.warn('[tabs] render', e); } });
}
function _renderNow() {
const bar = document.getElementById('tabBar');
if (!bar) return;
const view = State.get('currentView');
const isDocView = view === 'doc' || view === 'edit';
const activeId = isDocView ? State.get('activeTabId') : null;
const tpl = document.getElementById('tpl-tab');
if (!tpl) { try { bar.replaceChildren(); } catch (e) { console.warn('[tabs] clear', e); } return; }
const _savedScrollLeft = bar.scrollLeft;
bar.replaceChildren();
const _byId = new Map();
for (const _it of (State.get('libraryItems') || [])) { if (_it && _it.id) _byId.set(_it.id, _it); }
const tabs = Array.isArray(State.get('openTabs')) ? State.get('openTabs') : [];
tabs.forEach((id, i) => {
if (typeof id !== 'string' || !id) return;
const item = _byId.get(id);
if (!item) return;
const node = tpl.content.firstElementChild.cloneNode(true);
node.dataset.id = id;
node.id = 'tab-' + id;
node.setAttribute('aria-controls', 'main');
node.setAttribute('aria-posinset', String(i + 1));
node.setAttribute('aria-setsize', String(tabs.length));
const _idxEl = node.querySelector('.tab-idx');
if (_idxEl) _idxEl.textContent = i < 9 ? String(i + 1) : '';
const _isDirty = (Editor.isDirty && Editor.isDirty() && Editor.dirtyId && Editor.dirtyId() === id);
node.classList.toggle('is-dirty', !!_isDirty);
if (_isDirty) node.setAttribute('data-dirty', 'true');
else node.removeAttribute('data-dirty');
let _pressTimer = null;
let _longPressed = false;
let _startX = 0, _startY = 0;
node.addEventListener('pointerdown', e => {
if (e.pointerType === 'mouse' && e.button !== 0) return;
_longPressed = false;
clearTimeout(_pressTimer);
_startX = e.clientX; _startY = e.clientY;
_pressTimer = setTimeout(() => { _longPressed = true; showTabMenu(id, e.clientX, e.clientY); }, 500);
});
node.addEventListener('pointerup', () => { clearTimeout(_pressTimer); _pressTimer = null; });
node.addEventListener('pointercancel', () => { clearTimeout(_pressTimer); _pressTimer = null; });
node.addEventListener('pointermove', e => {
if (!_pressTimer) return;
if (Math.abs(e.clientX - _startX) > 14 || Math.abs(e.clientY - _startY) > 14) { clearTimeout(_pressTimer); _pressTimer = null; }
});
node.addEventListener('contextmenu', e => { e.preventDefault(); showTabMenu(id, e.clientX, e.clientY); });
node.addEventListener('auxclick', e => { if (e.button === 1) { e.preventDefault(); close(id, false); } });
const _isFirst = i === 0;
node.setAttribute('tabindex', (id === activeId || (!activeId && _isFirst)) ? '0' : '-1');
if (id === activeId) { node.classList.add('is-active'); node.setAttribute('aria-selected', 'true'); }
else { node.classList.remove('is-active'); node.setAttribute('aria-selected', 'false'); }
node.querySelector('.tab-title').textContent = String(item.title || 'Untitled').slice(0, 200);
const _closeBtnEl = node.querySelector('.tab-close');
if (_closeBtnEl) {
_closeBtnEl.dataset.close = id;
_closeBtnEl.setAttribute('aria-label', 'Close ' + String(item.title || 'Untitled').slice(0, 100));
_closeBtnEl.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); close(id); });
}
node.addEventListener('keydown', e => {
if (e.key !== 'Enter' && e.key !== ' ') return;
if (e.target !== node) return;
if (e.isComposing) return;
e.preventDefault();
node.click();
});
node.addEventListener('keydown', e => {
if (e.ctrlKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
e.preventDefault();
const list = (State.get('openTabs') || []).slice();
const i = list.indexOf(id);
if (i === -1) return;
const swapWith = e.key === 'ArrowRight' ? i + 1 : i - 1;
if (swapWith < 0 || swapWith >= list.length) return;
const tmp = list[i]; list[i] = list[swapWith]; list[swapWith] = tmp;
State.set('openTabs', list);
try { Prefs.set('openTabs', list); } catch (err) { console.warn('[tabs] persist reorder', err); }
render();
requestAnimationFrame(() => { const t = document.getElementById('tab-' + id); if (t) { t.setAttribute('tabindex', '0'); t.focus(); } });
return;
}
if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
e.preventDefault();
const allTabs = Array.from(bar.querySelectorAll('.tab'));
const i = allTabs.indexOf(node);
if (i === -1) return;
let nextIdx;
if (e.key === 'ArrowRight') nextIdx = (i + 1) % allTabs.length;
else if (e.key === 'ArrowLeft') nextIdx = (i - 1 + allTabs.length) % allTabs.length;
else if (e.key === 'Home') nextIdx = 0;
else nextIdx = allTabs.length - 1;
const nextNode = allTabs[nextIdx];
const nextId = nextNode && nextNode.dataset.id;
const nextItem = nextId && (State.get('libraryItems') || []).find(x => x.id === nextId);
if (nextItem) {
State.set('activeTabId', nextId);
ContentView.showDocument(nextItem, true);
requestAnimationFrame(() => { const t = document.getElementById('tab-' + nextId); if (t) { t.setAttribute('tabindex', '0'); t.focus(); } });
}
});
node.addEventListener('click', e => {
const _closeBtn = e.target && e.target.closest ? e.target.closest('.tab-close') : null;
if (_closeBtn) { close(_closeBtn.dataset.close || node.dataset.id); return; }
const tid = node.dataset.id;
const it = (State.get('libraryItems') || []).find(x => x && x.id === tid);
if (it) {
if (typeof Editor !== 'undefined' && Editor && Editor.isDirty && Editor.isDirty()) {
Promise.resolve(Modal.confirm('Discard unsaved changes?', { danger: true, okLabel: 'Discard' })).then(ok => {
if (!ok) return;
Editor.clearDirty();
State.set('activeTabId', tid);
ContentView.showDocument(it, true);
}).catch(err => { console.warn('[tabs] confirm', err); });
return;
}
State.set('activeTabId', tid);
ContentView.showDocument(it, true);
try { Announce.polite('Switched to ' + String(it.title || '').slice(0, 100)); } catch (err) { console.warn('[tabs] announce', err); }
}
});
});
if (bar._onTabScroll) { try { bar.removeEventListener('scroll', bar._onTabScroll); } catch (e) { console.warn('[tabs] removeScroll', e); } }
bar._onTabScroll = () => { _scrollLeft = bar.scrollLeft; };
bar.addEventListener('scroll', bar._onTabScroll, { passive: true });
if (bar.isConnected) { try { bar.scrollLeft = _savedScrollLeft || _scrollLeft || 0; } catch (e) { console.warn('[tabs] restore scroll', e); } }
if (!bar._swipeBound) {
bar._swipeBound = true;
let _sx = 0, _sy = 0, _swiping = false;
bar.addEventListener('touchstart', e => {
if (!e.touches || !e.touches.length) return;
_sx = e.touches[0].clientX;
_sy = e.touches[0].clientY;
_swiping = false;
}, { passive: true });
bar.addEventListener('touchmove', e => {
if (!e.touches || e.touches.length !== 1) return;
const dx = Math.abs(e.touches[0].clientX - _sx);
const dy = Math.abs(e.touches[0].clientY - _sy);
if (!_swiping && dx > 24 && dx > dy * 2.5) _swiping = true;
}, { passive: true });
bar.addEventListener('touchend', e => {
if (!_swiping || !e.changedTouches || e.changedTouches.length !== 1) return;
_swiping = false;
const dx = e.changedTouches[0].clientX - _sx;
if (Math.abs(dx) <= 80) return;
const list = State.get('openTabs') || [];
const i = list.indexOf(State.get('activeTabId'));
if (i < 0) return;
const n = list[i + (dx < 0 ? 1 : -1)];
if (!n) return;
State.set('activeTabId', n);
const it = (State.get('libraryItems') || []).find(x => x.id === n);
if (it) ContentView.showDocument(it, true);
}, { passive: true });
}
}
function showTabMenu(id, x, y) {
if (typeof id !== 'string' || !id) return;
if (!Number.isFinite(x) || !Number.isFinite(y)) { x = (window.innerWidth || 800) / 2; y = (window.innerHeight || 600) / 2; }
x = Math.max(0, Math.min(x, (window.innerWidth || 800) - 8));
y = Math.max(0, Math.min(y, (window.innerHeight || 600) - 8));
const item = (State.get('libraryItems') || []).find(t => t && t.id === id);
const label = String(item ? (item.title || 'Untitled') : (id || 'Tab')).slice(0, 200);
if (!ContentView.showContextMenu) { try { Toast.show('Context menu unavailable'); } catch (e) { console.warn('[tabs] ctx toast', e); } return; }
const entries = [
{ label: 'Close', onClick: () => close(id) },
{ label: 'Close others', onClick: () => {
const ids = (State.get('openTabs') || []).filter(t => t !== id);
closeMany(ids);
} },
{ label: 'Close to the right', onClick: () => {
const list = State.get('openTabs') || [];
const idx = list.indexOf(id);
if (idx < 0) return;
closeMany(list.slice(idx + 1).reverse());
} },
{ separator: true },
{ label: 'Copy title', onClick: () => {
try {
if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(label);
else { const ta = document.createElement('textarea'); ta.value = label; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
Toast.success('Title copied');
} catch (e) { Toast.error('Copy failed'); }
} }
];
if (ContentView.showContextMenu) ContentView.showContextMenu(x, y, entries);
}
const _TABS_MAX = 50;
function open(id) {
if (typeof id !== 'string' || !id || id.length > 200) return;
const _idSet = new Set();
const _cur = (State.get('openTabs') || []).filter(x => { if (typeof x !== 'string' || !x || x.length > 200 || _idSet.has(x)) return false; _idSet.add(x); return true; });
let tabs = _cur.includes(id) ? _cur.slice() : [..._cur, id];
if (tabs.length > _TABS_MAX) {
const _dropped = tabs.length - _TABS_MAX;
console.info('[tabs] dropping', _dropped, 'oldest tabs over limit');
tabs = tabs.slice(-_TABS_MAX);
try { Toast.show('Tab limit reached: closed ' + _dropped + ' oldest tab' + (_dropped === 1 ? '' : 's')); } catch (e) { console.warn('[tabs] limit toast', e); }
}
State.set('openTabs', tabs);
State.set('activeTabId', id);
try { Prefs.set('openTabs', tabs); } catch (e) { console.warn('[tabs] write openTabs failed', e); }
try { Prefs.set('activeTabId', id); } catch (e) { console.warn('[tabs] write activeTabId failed', e); }
render();
if (!window._tabsSwitchingFocus) {
window._tabsSwitchingFocus = true;
queueMicrotask(() => {
window._tabsSwitchingFocus = false;
try {
if (document.activeElement === document.body || document.activeElement === document.documentElement) {
const m = document.getElementById('main');
if (m && typeof m.focus === 'function') m.focus({ preventScroll: true });
}
} catch (e) { console.warn('[tabs] focus main', e); }
});
}
}
let _closing = false;
async function closeMany(ids) {
if (!Array.isArray(ids) || !ids.length) return;
ids = Array.from(new Set(ids.filter(x => typeof x === 'string' && x && x.length < 200)));
if (!ids.length) return;
let _dirty = null;
try { _dirty = (Editor.isDirty && Editor.isDirty()) ? (Editor.dirtyId ? Editor.dirtyId() : null) : null; }
catch (e) { console.warn('[tabs] dirty check', e); }
const dirty = _dirty ? ids.filter(tid => tid === _dirty) : [];
if (dirty.length) {
let ok = false;
try { ok = await Modal.confirm(`${dirty.length} tab(s) have unsaved changes. Close anyway?`, { danger: true, okLabel: 'Discard and close' }); }
catch (e) { console.warn('[tabs] confirm failed', e); ok = false; }
if (!ok) return;
if (_dirty && ids.includes(_dirty)) { try { Editor.clearDirty && Editor.clearDirty(); } catch (e) { console.warn('[tabs]', e); } }
}
for (const tid of ids) { try { close(tid, true, true); } catch (e) { console.warn('[tabs]', tid, e); } }
const _active = State.get('activeTabId');
const _activeClosed = _active && ids.includes(_active);
if (_activeClosed) {
try { close(_active, true, false); } catch (e) { console.warn('[tabs] closeMany active', e); }
}
if (_activeClosed && !State.get('activeTabId')) {
try { ContentView.showLibrary(); } catch (e) { console.warn('[tabs] closeMany fallback', e); }
}
}
function close(id, skipConfirm, batch) {
if (typeof id !== 'string' || !id) return;
if (!skipConfirm && typeof Editor !== 'undefined' && Editor && Editor.isDirty && Editor.isDirty() && Editor.dirtyId && Editor.dirtyId() === id && !_closing) {
_closing = true;
Promise.resolve(Modal.confirm('Close tab with unsaved changes?', { danger: true, okLabel: 'Close' })).then(async ok => {
if (ok) {
try { if (Editor.flushPendingAutoSave) await Editor.flushPendingAutoSave(); } catch (e) { console.warn('[tabs] flush', e); }
Editor.clearDirty && Editor.clearDirty();
close(id, true);
}
}).catch((e) => { console.warn('[tabs] close confirm failed', e); }).finally(() => { _closing = false; });
return;
}
try { if (typeof Editor !== 'undefined' && Editor && Editor.flushPendingAutoSave) Promise.resolve(Editor.flushPendingAutoSave()).catch(e => console.warn('[tabs] flush pending', e)); } catch (e) { console.warn('[tabs] flush pending', e); }
if (batch && State.get('activeTabId') === id) return;
if (_closing) return;
const prevTabs = State.get('openTabs') || [];
const idx = prevTabs.indexOf(id);
if (idx === -1) return;
const tabs = prevTabs.filter(x => x !== id);
State.set('openTabs', tabs);
try { Prefs.set('openTabs', tabs); } catch (e) { console.warn('[tabs] persist failed', e); }
let focusTab = false;
if (State.get('activeTabId') === id) {
if (batch) return;
let next = null;
if (tabs.length) { const nextIdx = Math.min(idx, tabs.length - 1); next = tabs[nextIdx]; }
State.set('activeTabId', next);
try { Prefs.set('activeTabId', next); } catch (e) { console.warn('[tabs] persist activeTabId', e); }
if (next) {
const item = (State.get('libraryItems') || []).find(x => x.id === next);
if (item) { ContentView.showDocument(item, true); focusTab = true; }
} else {
try { if (/^#(doc|edit|review)-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); } catch (e) { console.warn('[tabs] replace hash', e); }
ContentView.showLibrary();
const _m = document.getElementById('main');
if (_m) _m.focus({ preventScroll: true });
}
}
render();
if (focusTab) {
const _t = document.getElementById('tab-' + State.get('activeTabId'));
if (_t) { try { _t.focus(); } catch {} }
else { const _m = document.getElementById('main'); if (_m) { try { _m.focus({ preventScroll: true }); } catch {} } }
}
try { Announce.polite('Tab closed'); } catch (e) { console.warn('[tabs] announce', e); }
}
function init() {
const items = Array.isArray(State.get('libraryItems')) ? State.get('libraryItems') : [];
const ids = new Set();
for (const i of items) { if (i && typeof i.id === 'string' && i.id) ids.add(i.id); }
const tabs = (Array.isArray(State.get('openTabs')) ? State.get('openTabs') : []).filter(id => typeof id === 'string' && id && id.length < 200 && ids.has(id));
let _deduped = Array.from(new Set(tabs));
if (_deduped.length > _TABS_MAX) {
console.info('[tabs] dropping', _deduped.length - _TABS_MAX, 'oldest tabs over limit');
_deduped = _deduped.slice(-_TABS_MAX);
}
const _prev = State.get('openTabs') || [];
if (_deduped.length !== _prev.length || _deduped.some((x, i) => x !== _prev[i])) {
State.set('openTabs', _deduped);
try { Prefs.set('openTabs', _deduped); } catch (e) { console.warn('[tabs] init write', e); }
}
const active = State.get('activeTabId');
if (active && !ids.has(active)) { State.set('activeTabId', null); try { Prefs.set('activeTabId', null); } catch (e) { console.warn('[tabs] init active', e); } }
try { Prefs.set('openTabs', _deduped); } catch (e) { console.warn('[tabs] init write openTabs', e); }
render();
try { Bus.emit(EVENTS.TABS_CHANGED || 'tabs:changed', { openTabs: _deduped }); } catch (e) { console.warn('[tabs] bus', e); }
}
return { open, close, closeMany, render, init };
})();