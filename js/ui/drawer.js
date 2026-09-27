
import { Config } from '../core/config.js';
import { State } from '../core/state.js';
import { EVENTS } from '../core/events.js';
import { HeaderRenderer } from './header.js';
import { Toast } from './toast.js';

export const DrawerController = (() => {
const root = () => document.getElementById('drawerRoot');
const backdrop = () => document.getElementById('drawerBackdrop');
  let openId = null;
  let lastFocus = null;
  let openCleanups = [];
  let _drawerFormHintCounter = 0;
  const _DRAWER_FORBIDDEN = new Set(['__proto__','constructor','prototype','hasOwnProperty','toString','valueOf','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__','isPrototypeOf','propertyIsEnumerable','toLocaleString']);

  function ensureDrawer(id) {
  const _r = root();
  if (!_r) { console.warn('[drawer] root missing'); return null; }
if (typeof id !== 'string' || !id || !/^[A-Za-z0-9_-]+$/.test(id) || id.length > 64) return null;
if (_DRAWER_FORBIDDEN && _DRAWER_FORBIDDEN.has && _DRAWER_FORBIDDEN.has(id)) return null;
let el = document.getElementById('drawer-' + id);
if (el) return el;
if (document.querySelectorAll('.drawer').length > 40) {
const _old = document.querySelectorAll('.drawer:not(.is-open)');
const _evictCount = Math.max(0, _old.length - 20);
for (let i = 0; i < _evictCount && i < _old.length; i++) { try { _old[i].remove(); } catch (e) { console.warn('[drawer] evict', e); } }
}
if (!Config || !Config.drawers || typeof Config.drawers !== 'object') return null;
if (!Object.prototype.hasOwnProperty.call(Config.drawers, id)) return null;
const def = Config.drawers[id];
if (!def || typeof def !== 'object') return null;
if (!def.sections && !def.title && typeof def.render !== 'function') return null;
el = document.createElement('div');
el.className = 'drawer';
el.id = 'drawer-' + id;
el.dataset.drawerId = id;
el.setAttribute('role', 'dialog');
const _safeId = String(id).replace(/[^A-Za-z0-9_-]/g, '') || 'unknown';
el.setAttribute('aria-labelledby', 'drawer-title-' + _safeId);
const _hdr = document.createElement('div');
_hdr.className = 'drawer__handle';
_hdr.setAttribute('role', 'button');
_hdr.setAttribute('tabindex', '0');
_hdr.setAttribute('aria-label', 'Close drawer');
_hdr.setAttribute('aria-hidden', 'false');
_hdr._drawerCloseOnEnter = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(false); } };
_hdr.addEventListener('keydown', _hdr._drawerCloseOnEnter);
const _closeBtn = document.createElement('button');
_closeBtn.className = 'drawer__close';
_closeBtn.setAttribute('aria-label', 'Close');
_closeBtn.textContent = '\u00d7';
const _titleH = document.createElement('h2');
_titleH.className = 'drawer__title';
_titleH.id = 'drawer-title-' + _safeId;
const _bodyDiv = document.createElement('div');
_bodyDiv.className = 'drawer__body';
_bodyDiv.setAttribute('role', 'region');
el.appendChild(_hdr); el.appendChild(_closeBtn); el.appendChild(_titleH); el.appendChild(_bodyDiv);
const _closeEl = el.querySelector('.drawer__close');
if (_closeEl) _closeEl.addEventListener('click', () => close(false));
const handleEl = el.querySelector('.drawer__handle');
if (handleEl) handleEl.addEventListener('click', () => close(false));
if (!handleEl) { console.warn('[drawer] handle missing'); return el; }
let sy = { y: 0, t: 0 };
handleEl.addEventListener('touchstart', e => {
if (!e.touches || !e.touches.length) return;
sy = { y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });
el.addEventListener('keydown', e => {
if (e.isComposing) return;
if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
const ae = document.activeElement;
if (ae && (ae.isContentEditable || /^(input|textarea|select)$/i.test(ae.tagName))) return;
const items = Array.from(el.querySelectorAll('.drawer__item, .drawer__btn'));
if (!items.length) return;
const idx = items.indexOf(document.activeElement);
e.preventDefault();
let next;
if (idx === -1) next = items[0];
else if (e.key === 'ArrowDown') next = items[(idx + 1) % items.length];
else next = items[(idx - 1 + items.length) % items.length];
next.focus();
});
_r.appendChild(el);
const _titleElInit = el.querySelector('.drawer__title');
if (_titleElInit) _titleElInit.textContent = String(def.title || '').slice(0, 200);
const _bodyElInit = el.querySelector('.drawer__body');
if (_bodyElInit) renderBody(_bodyElInit, def);
el.removeAttribute('inert');
el.setAttribute('role', 'dialog');
let _isModal = true;
try { _isModal = window.matchMedia('(max-width: 899px)').matches; } catch (e) { console.warn('[drawer] matchMedia', e); }
if (_isModal) el.setAttribute('aria-modal', 'true');
else el.removeAttribute('aria-modal');
el._isModal = _isModal;
if (!el._focusTrapBound) {
el._focusTrapBound = true;
el.addEventListener('keydown', e => {
if (e.key !== 'Tab') return;
const focusables = Array.from(el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(x => !x.hidden && !x.disabled && typeof x.getClientRects === 'function' && x.getClientRects().length > 0);
if (!focusables.length) return;
const first = focusables[0], last = focusables[focusables.length - 1];
if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  }
  return el;
  }

function open(id) {
if (!id || typeof id !== 'string') return;
if (!id.match(/^[A-Za-z0-9_-]+$/) || id.length > 64) return;
if (_DRAWER_FORBIDDEN.has(id)) return;
if (openId === id) { try { if (HeaderRenderer && HeaderRenderer.setActive) HeaderRenderer.setActive(id); } catch (e) { console.warn('[drawer] setActive noop', e); } try { const _el = document.getElementById('drawer-' + id); if (_el) { const _b = _el.querySelector('.drawer__body'); if (_b && Config.drawers[id]) renderBody(_b, Config.drawers[id]); if (typeof Config.drawers[id].onReopen === 'function') Config.drawers[id].onReopen(_el); } } catch (e) { console.warn('[drawer] refresh on reopen', e); } return; }
if (openId) close(true, true);
if (!Config || !Config.drawers || typeof Config.drawers !== 'object') return;
if (!Object.prototype.hasOwnProperty.call(Config.drawers, id)) return;
const def = Config.drawers[id];
if (!def || typeof def !== 'object') return;
if (!def.sections && !def.title) { console.warn('[drawer] drawer def has no sections or title'); return; }
lastFocus = document.activeElement;
const el = ensureDrawer(id);
if (!el) return;
openId = id;
const _titleEl = el.querySelector('.drawer__title');
if (_titleEl) _titleEl.textContent = String(def.title || '').slice(0, 200);
el.setAttribute('role', 'dialog');
const _safeId2 = String(id).replace(/[^A-Za-z0-9_-]/g, '') || 'unknown';
el.setAttribute('aria-labelledby', 'drawer-title-' + _safeId2);
let _isModal2 = true;
try { _isModal2 = window.matchMedia('(max-width: 899px)').matches; } catch (e) { console.warn('[drawer] matchMedia', e); }
el._isModal = _isModal2;
if (_isModal2) el.setAttribute('aria-modal', 'true');
else el.removeAttribute('aria-modal');
el.classList.add('is-open');
const _bd = backdrop();
if (_bd) _bd.classList.add('is-open');
if (HeaderRenderer && HeaderRenderer.setActive) { try { HeaderRenderer.setActive(id); } catch (e) { console.warn('[drawer] setActive', e); } }
const _closeBtn = el.querySelector('.drawer__close');
if (_closeBtn && typeof _closeBtn.focus === 'function') _closeBtn.focus();
}

function isOpen() { return !!openId; }

function close(silent, keepHeaderActive) {
if (!openId) {
if (silent || keepHeaderActive) return;
if (!silent && !keepHeaderActive) {
const _fa = document.querySelector('.header__option:not([hidden])');
const _ae = document.activeElement;
if (_fa && document.hasFocus() && !(_ae && _ae.closest && _ae.closest('.header__option'))) { try { _fa.focus({ preventScroll: true }); } catch (e) { console.warn('[drawer] focus fa', e); } }
}
try {
const _nested2 = document.querySelectorAll('.drawer.is-open');
_nested2.forEach(d => {
try {
const _b = d.querySelector('.drawer__body');
if (_b) d.querySelectorAll('input, textarea, select').forEach(inp => { if (inp.type === 'password') inp.value = ''; });
d.classList.remove('is-open');
d.setAttribute('inert', '');
} catch (e) { console.warn('[drawer] nested close', e); }
});
if (_nested2.length) { const _bd3 = document.getElementById('drawerBackdrop'); if (_bd3) _bd3.classList.remove('is-open'); }
} catch (e) { console.warn('[drawer] nested cleanup', e); }
return;
}
const _closingId = openId;
if (_DRAWER_FORBIDDEN.has(_closingId)) { openId = null; return; }
const el = document.getElementById('drawer-' + _closingId);
if (el) {
const _ae = document.activeElement;
if (_ae && el.contains(_ae) && typeof _ae.blur === 'function') { try { _ae.blur(); } catch (e) { console.warn('[drawer] blur active', e); } }
try { el.querySelectorAll('input, textarea').forEach(inp => { try { inp.blur(); } catch (e) { console.warn('[drawer] blur input', e); } }); } catch (e) { console.warn('[drawer] blur', e); }
el.classList.remove('is-open');
el.setAttribute('inert', '');
el.removeAttribute('role');
el.removeAttribute('aria-modal');
el.removeAttribute('aria-labelledby');
el.removeAttribute('aria-hidden');
try { el.querySelectorAll('audio, video').forEach(m => { try { m.pause(); } catch (e) { console.warn('[drawer] media pause', e); } }); } catch (e) { console.warn('[drawer] media', e); }
}
const bd = backdrop();
if (bd) bd.classList.remove('is-open');
openCleanups.forEach(fn => { try { fn(); } catch (e) { console.warn('[drawer] cleanup', e); } });
openCleanups = [];
openId = null;
try { document.dispatchEvent(new CustomEvent(EVENTS.DRAWER_CLOSED || 'drawer:closed', { detail: { id: _closingId } })); } catch (e) { console.warn('[drawer] dispatch closed', e); }
if (!keepHeaderActive) {
State.set('activeHeaderId', null);
if (HeaderRenderer && HeaderRenderer.setActive) HeaderRenderer.setActive(null);
}
if (!silent && !keepHeaderActive) history.replaceState(null, '', location.pathname + location.search);
const _lf = lastFocus;
const focusTarget = (_lf && document.contains(_lf) && _lf !== document.body && _lf !== document.documentElement) ? _lf : document.querySelector('.header__option');
if (!silent && focusTarget && typeof focusTarget.focus === 'function' && document.hasFocus()) { try { focusTarget.focus({ preventScroll: true }); } catch (e) { try { focusTarget.focus(); } catch {} } }
lastFocus = null;
}

function refresh() {
if (!openId) return;
const _refreshId = openId;
if (!Config || !Config.drawers || !Object.prototype.hasOwnProperty.call(Config.drawers, _refreshId)) return;
const def = Config.drawers[_refreshId];
const el = document.getElementById('drawer-' + _refreshId);
if (!def || !el || !el.isConnected) return;
if (el._pendingRefresh) return;
const body = el.querySelector('.drawer__body');
if (!body) return;
if (!body.isConnected) return;
el._pendingRefresh = true;
queueMicrotask(() => { try { if (el) el._pendingRefresh = false; } catch (e) { console.warn('[drawer] pendingRefresh reset', e); } });
const savedScroll = body.scrollTop;
const active = document.activeElement;
const hadFocus = body.contains(active);
const selStart = hadFocus && active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
const selEnd = hadFocus && active && typeof active.selectionEnd === 'number' ? active.selectionEnd : null;
const values = new Map();
body.querySelectorAll('input, textarea, select').forEach((inp, i) => {
if (inp.type === 'password') return;
let key = (inp.name || '') + '|' + (inp.id || '') + '|' + (inp.getAttribute('aria-label') || '');
if (!inp.name && !inp.id && !inp.getAttribute('aria-label')) key = 'idx:' + i;
if (inp.type === 'checkbox' || inp.type === 'radio') values.set(key, inp.checked);
else values.set(key, String(inp.value || '').slice(0, 200000));
});
renderBody(body, def);
body.scrollTop = savedScroll;
body.querySelectorAll('input, textarea, select').forEach((inp, i) => {
let key = (inp.name || '') + '|' + (inp.id || '') + '|' + (inp.getAttribute('aria-label') || '');
if (!inp.name && !inp.id && !inp.getAttribute('aria-label')) key = 'idx:' + i;
if (!values.has(key)) return;
if (inp.type === 'checkbox' || inp.type === 'radio') inp.checked = values.get(key);
else { const _v = values.get(key); if (typeof _v === 'string' && _v.length < 200000) inp.value = _v; }
});
if (hadFocus) {
const _all = Array.from(body.querySelectorAll('input, textarea, select, button, [tabindex]:not([tabindex="-1"])'));
const _activeIdx = _all.indexOf(active);
let again = null;
if (active && active.dataset && active.dataset.focusKey) { try { again = body.querySelector('[data-focus-key="' + String(active.dataset.focusKey).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]'); } catch (e) { console.warn('[drawer] focusKey query', e); } }
if (!again && _activeIdx >= 0) again = _all[_activeIdx];
if (!again) { const activeKey = active && (active.getAttribute('aria-label') || active.name || active.id || ''); if (activeKey) { try { again = body.querySelector('[aria-label="' + String(activeKey).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]'); } catch (e) { console.warn('[drawer] aria query', e); } } }
if (!again) again = _all[0];
if (again && typeof again.focus === 'function') { try { again.focus(); } catch {} }
}
}

function renderBody(bodyEl, def) {
if (!bodyEl) return;
bodyEl.replaceChildren();
const _secs = (def && Array.isArray(def.sections)) ? def.sections : [];
_secs.slice(0, 100).forEach(section => {
if (!section || typeof section !== 'object') return;
try { bodyEl.appendChild(renderSection(section)); } catch (e) { console.warn('[drawer] section render failed', e); }
});
try { bodyEl.scrollTop = 0; } catch (e) { console.warn('[drawer] reset scroll', e); }
try { bodyEl.setAttribute('role', 'region'); } catch (e) { console.warn('[drawer] aria role', e); }
}

function renderSection(section) {
if (!section || typeof section !== 'object') return document.createDocumentFragment();
if (section.type && !/^(grid|list|form|custom)$/.test(String(section.type))) { console.warn('[drawer] unknown section type', String(section.type).slice(0, 32)); return document.createDocumentFragment(); }
const _sectionLabel = (section.label && typeof section.label === 'string') ? String(section.label).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) : '';
const sec = document.createElement('div');
sec.className = 'drawer__section';
if (section.label && typeof section.label === 'string') {
const l = document.createElement('div');
l.className = 'drawer__label';
l.textContent = String(section.label).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200);
sec.appendChild(l);
}
if (section.type === 'custom' && typeof section.render === 'function') {
try { section.render(sec); } catch (e) { console.warn('[drawer] custom render failed', e); const _err = document.createElement('div'); _err.className = 'drawer__empty'; _err.textContent = 'Section failed to render'; sec.appendChild(_err); }
return sec;
}
let items = [];
try { items = typeof section.items === 'function' ? (section.items() || []) : (section.items || []); } catch (e) { console.warn('[drawer] items thunk failed', e); items = []; }
if (!Array.isArray(items)) items = [];
items = items.slice(0, 500);
if (section.type === 'grid') items = items.slice(0, 200);
if (section.type === 'form') {
const form = document.createElement('form');
form.className = 'drawer__form';
form.setAttribute('method', 'get');
form.setAttribute('novalidate', '');
form.addEventListener('submit', e => { try { e.preventDefault(); } catch (err) { console.warn('[drawer] preventDefault', err); } });
const _formRole = typeof section.role === 'string' && /^(search|form|none|presentation)$/.test(section.role) ? section.role : 'search';
form.setAttribute('role', _formRole);
const inp = document.createElement('input');
inp.type = 'search';
inp.className = 'drawer__input';
inp.placeholder = String(section.placeholder == null ? '' : section.placeholder).slice(0, 200);
inp.setAttribute('aria-label', String(section.placeholder == null ? 'Search' : section.placeholder).slice(0, 200));
inp.setAttribute('autocomplete', 'off');
inp.setAttribute('autocorrect', 'off');
inp.setAttribute('autocapitalize', 'off');
inp.setAttribute('spellcheck', 'false');
inp.setAttribute('name', 'drawer-search');
form.appendChild(inp);
const results = document.createElement('div');
results.className = 'drawer__list';
form.appendChild(results);
const _hint = document.createElement('span');
if (!_drawerFormHintCounter) _drawerFormHintCounter = 0;
_hint.id = 'drawer-form-hint-' + (++_drawerFormHintCounter);
_hint.className = 'sr-only';
_hint.textContent = 'Type to filter results.';
form.appendChild(_hint);
inp.setAttribute('aria-describedby', _hint.id);
sec.appendChild(form);
if (typeof section.onMount === 'function') section.onMount(inp, results);
return sec;
}
if (!items.length) {
if (section.empty) { const e = document.createElement('div'); e.className = 'drawer__empty'; e.textContent = String(section.empty.text == null ? '' : section.empty.text).slice(0, 500); sec.appendChild(e); }
return sec;
}
const wrap = document.createElement('div');
wrap.className = section.type === 'grid' ? 'drawer__grid' : 'drawer__list';
items.forEach(it => { try { wrap.appendChild(renderItem(it, section.type)); } catch (e) { console.warn('[drawer] item render failed', e); } });
sec.appendChild(wrap);
return sec;
}

function renderItem(item, type) {
if (!item || typeof item !== 'object') return document.createDocumentFragment();
const tplId = type === 'grid' ? 'tpl-drawer-btn' : 'tpl-drawer-item';
const tpl = document.getElementById(tplId);
if (!tpl || !tpl.content || !tpl.content.firstElementChild) return document.createDocumentFragment();
const el = tpl.content.firstElementChild.cloneNode(true);
const _itemType = String(item.type || '');
if (/^(button|submit|reset)$/.test(_itemType)) el.setAttribute('type', _itemType);
else el.setAttribute('type', 'button');
if (item.id && typeof item.id === 'string') el.dataset.itemId = item.id.slice(0, 200);
el.classList.toggle('is-primary', !!item.primary);
el.disabled = item.disabled === true;
if (el.disabled) el.setAttribute('aria-disabled', 'true');
const iconEl = el.querySelector('.d-icon');
if (iconEl) iconEl.textContent = String(item.icon || '').slice(0, 8);
const labelEl = el.querySelector(type === 'grid' ? '.d-label' : '.d-text');
if (labelEl) labelEl.textContent = String(item.label || '').slice(0, 200);
const metaEl = el.querySelector('.d-meta');
if (metaEl) { if (item.meta === null || item.meta === undefined || item.meta === '') { try { metaEl.remove(); } catch (e) { console.warn('[drawer] meta remove', e); } } else metaEl.textContent = String(item.meta).slice(0, 100); }
if (typeof item.onClick === 'function') el.addEventListener('click', item.onClick);
const _existingLabel = el.getAttribute('aria-label');
if (!_existingLabel) el.setAttribute('aria-label', String(item.label || item.icon || 'item').slice(0, 200));
return el;
}

function setCleanup(fn) {
if (typeof fn === 'function') openCleanups.push(fn);
}
function _drainCleanups() {
const _list = openCleanups.slice();
openCleanups = [];
_list.forEach(fn => { try { if (typeof fn === 'function') Promise.resolve().then(() => fn()).catch(e => console.warn('[drawer] async cleanup', e)); } catch (e) { console.warn('[drawer] cleanup failed', e); } });
}

function destroy() {
try {
if (openId) close(true, true);
openCleanups.forEach(fn => { try { if (typeof fn === 'function') fn(); } catch (e) { console.warn('[drawer] destroy cleanup', e); } });
openCleanups = [];
lastFocus = null;
openId = null;
return true;
} catch (e) { console.warn('[drawer] destroy', e); return false; }
}

return { open, close, refresh, getId: () => openId, isOpen, setCleanup, drainCleanups: _drainCleanups, destroy };
})();