
import { Prefs } from '../core/prefs.js';
import { State } from '../core/state.js';
import { Config } from '../core/config.js';
import { Navigation } from '../core/navigation.js';
import { Toast } from './toast.js';
import { Modal } from './modal.js';
import { DrawerController } from './drawer.js';
import { CommandPalette } from './command-palette.js';
import { Router } from '../core/router.js';
import { TOC } from './toc.js';
import { Undo } from '../editor/undo.js';
import { Exporter } from '../output/exporter.js';
import { ContentView } from '../library/content-view.js';

// _gmap maps g-prefix keys to drawer ids (see _onGPrefix)
export const Keyboard = (() => {
function _onKeyDown(e) {
if (!e || e.isComposing || e.keyCode === 229) return;
if (e.defaultPrevented) return;
if (e.target && e.target.isContentEditable && e.target.closest && e.target.closest('.editor__body, .editor__raw')) return;
const _modalOpen = document.querySelector('.modal.is-open, #modalShell.is-open');
if (_modalOpen && e.key !== 'Escape' && e.key !== 'Tab') return;
const _hiddenHost = e.target && e.target.closest && e.target.closest('[hidden], [aria-hidden="true"]');
if (_hiddenHost && _hiddenHost.id !== 'kbdPrefixHint') return;
const _ae = document.activeElement;
if (_ae && _ae.isContentEditable && (e.key === 'j' || e.key === 'k') && !e.ctrlKey && !e.metaKey && !e.altKey) return;
const mod = e.ctrlKey || e.metaKey;
const _k = (typeof e.key === 'string') ? e.key.toLowerCase() : '';
if (mod && _k === 'f' && !e.shiftKey && !e.altKey) {
const ae = document.activeElement;
if (ae && (/^(input|textarea)$/i.test(ae.tagName) || ae.isContentEditable)) return;
if (document.querySelector('.modal.is-open, #modalShell.is-open')) return;
e.preventDefault();
Modal.prompt('Find in document:', { okLabel: 'Find' }).then(q => {
if (!q) return;
try {
if (typeof window.find === 'function') {
window.find(q, false, false, true, false, false, false);
} else {
try { Toast.show('In-page find is not available in this browser'); } catch {}
}
} catch (err) { console.warn('[kbd] find failed', err); }
}).catch(err => console.warn('[kbd] find prompt failed', err));
return;
}
if (mod && e.shiftKey && !e.altKey && _k === 'e') {
e.preventDefault();
const _aid = State.get('activeTabId');
const _item = _aid ? (State.get('libraryItems') || []).find(x => x && x.id === _aid) : null;
if (!_item) { try { Toast.show('No active document to export'); } catch {} return; }
try { Exporter.exportItem(_item); }
catch (toastErr) { console.warn('[kbd] export', toastErr); try { Toast.show('Export failed'); } catch {} }
return;
}
if (mod && !e.shiftKey && !e.altKey && _k === 'k') { e.preventDefault(); e.stopPropagation(); try { CommandPalette.open(); } catch (err) { console.warn('[kbd]', err); } return; }
if (mod && e.shiftKey && !e.altKey && _k === 'p') { e.preventDefault(); e.stopPropagation(); try { CommandPalette.open(); } catch (err) { console.warn('[kbd]', err); } return; }
if (mod && !e.shiftKey && !e.altKey && _k === 'z') {
const ae = document.activeElement;
const editable = ae && (ae.isContentEditable || /^(input|textarea)$/i.test(ae.tagName));
if (editable) return;
if (e.target && e.target.closest && e.target.closest('#commandPalette:not([hidden])')) return;
e.preventDefault();
e.stopImmediatePropagation();
Promise.resolve(Undo.undo()).catch(err => console.warn('[kbd] undo', err));
return;
}
if (mod && !e.shiftKey && !e.altKey && _k === 's') {
const ae = document.activeElement;
const _inEditor = (ae && (ae.classList && (ae.classList.contains('editor__body') || ae.classList.contains('editor__raw') || (ae.closest && ae.closest('.editor'))))) || State.get('currentView') === 'edit' || State.get('currentView') === 'doc';
if (_inEditor) {
e.preventDefault();
const btn = document.querySelector('#main .editor [data-act="save"]');
if (btn && typeof btn.click === 'function') btn.click();
else { try { if (window.Cwtch && window.Cwtch.Editor && window.Cwtch.Editor.flushPendingAutoSave) Promise.resolve(window.Cwtch.Editor.flushPendingAutoSave()).catch(e => console.warn('[kbd] save fallback', e)); } catch (err) { console.warn('[kbd] save fallback', err); } }
return;
}
return;
}
if (mod && !e.shiftKey && !e.altKey && (_k === 'b' || _k === 'i')) {
const ae = document.activeElement;
const inEditor = ae && (
ae.classList?.contains('editor__body') ||
ae.classList?.contains('editor__raw') ||
ae.closest?.('.editor'));
if (inEditor) {
e.preventDefault();
document.querySelector('.editor [data-act="' + (_k === 'b' ? 'bold' : 'italic') + '"]')?.click();
}
return;
}
if ((e.key === '/' || e.code === 'Slash') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
if (e.repeat) return;
const ae = document.activeElement;
if (ae && typeof ae.matches === 'function') {
if (ae.isContentEditable) return;
if (ae.closest && ae.closest('[contenteditable="true"]')) return;
if (ae.matches('input, textarea, select, [contenteditable="true"]')) return;
}
e.preventDefault();
try { DrawerController.open('search'); } catch (err) { console.warn('[kbd] open search', err); }
setTimeout(() => { try { const _inp = document.querySelector('#drawer-search .drawer__input'); if (_inp && document.activeElement !== _inp && typeof _inp.focus === 'function') _inp.focus(); } catch (err) { console.warn('[kbd] focus search', err); } }, 60);
return;
}
if (e.key === 'j' || e.key === 'k') {
if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
if (e.repeat) return;
if (gPending) { gPending = false; clearTimeout(gTimer); if (typeof _showHint === 'function') _showHint(''); e.preventDefault(); return; }
const target = document.activeElement;
if (target && typeof target.matches === 'function' &&
target.matches('input, textarea, select, [contenteditable="true"]')) return;
if (target && target.isContentEditable) return;
const allRows = document.querySelectorAll('#main .item-row, #main .folder-item, #main .drawer__item, #main [role="option"]');
const rows = [];
for (let _i = 0; _i < allRows.length; _i++) { const _r = allRows[_i]; if (!_r.hidden) rows.push(_r); }
if (!rows.length) return;
const inMain = (!target || target === document.body || target === document.documentElement)
? true
: !!(target.closest && target.closest('#main'));
if (!inMain) return;
e.preventDefault();
const idx = rows.indexOf(target);
const next = idx === -1 ? rows[0]
: e.key === 'j' ? rows[(idx + 1) % rows.length]
: rows[(idx - 1 + rows.length) % rows.length];
if (next && typeof next.focus === 'function') { try { next.focus(); } catch {} if (typeof next.scrollIntoView === 'function') next.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
return;
}
}
function _onQuestionMark(e) {
if (!e || e.isComposing || e.keyCode === 229) return;
if (e.defaultPrevented) return;
if (e.ctrlKey || e.metaKey || e.altKey) return;
if (!e.shiftKey) return;
if (e.repeat) return;
if (e.key !== '?' && e.key !== '/') return;
const ae = document.activeElement;
if (ae && /^(input|textarea|select)$/i.test(ae.tagName)) return;
if (ae && ae.isContentEditable) return;
if (document.querySelector('.modal.is-open, #modalShell.is-open')) return;
if (document.getElementById('drawer-help') && document.getElementById('drawer-help').classList.contains('is-open')) return;
e.preventDefault();
DrawerController.open('help');
}
if (typeof window !== 'undefined' && !window._cwtchFocusShortcut) {
window._cwtchFocusShortcut = true;
window._cwtchFocusShortcutFn = e => {
if (!e || e.isComposing || e.keyCode === 229) return;
if (e.key !== 'F11' || !(e.ctrlKey || e.metaKey)) return;
const ae = document.activeElement;
if (ae && /^(input|textarea|select)$/i.test(ae.tagName)) return;
if (ae && ae.isContentEditable) return;
e.preventDefault();
e.stopImmediatePropagation();
const on = document.body.classList.toggle('focus-mode');
try { if (window.Cwtch && window.Cwtch.Settings && typeof window.Cwtch.Settings.setRow === 'function') window.Cwtch.Settings.setRow('reader.focusMode', on); else Prefs.set('setting.reader.focusMode', on); } catch (err) { console.warn('[kbd] focus persist', err); }
try { document.querySelectorAll('[data-focus-mode-toggle]').forEach(el => el.setAttribute('aria-pressed', String(on))); } catch (err) { console.warn('[kbd] focus aria', err); }
try { if (window.Cwtch && window.Cwtch.Toast && typeof window.Cwtch.Toast.show === 'function') window.Cwtch.Toast.show(on ? 'Focus mode on' : 'Focus mode off'); } catch (err) { console.warn('[kbd] focus toast', err); }
};
document.addEventListener('keydown', window._cwtchFocusShortcutFn, true);
}
let _kbdInstalled = false;
let _onEscape = null;
function install() {
if (_kbdInstalled) return;
_kbdInstalled = true;
try { document.addEventListener('keydown', _onKeyDown, true); } catch (e) { console.warn('[kbd] bind onKeyDown', e); }
try { document.addEventListener('keydown', _onGPrefix, true); } catch (e) { console.warn('[kbd] bind onGPrefix', e); }
try { document.addEventListener('keydown', _onQuestionMark, true); } catch (e) { console.warn('[kbd] bind onQuestionMark', e); }
if (typeof window !== 'undefined' && !window._cwtchGlobalEscBound) {
window._cwtchGlobalEscBound = true;
window._cwtchGlobalEscFn = e => {
if (e.key !== 'Escape' || e.defaultPrevented) return;
const ae = document.activeElement;
if (ae && ae !== document.body && ae !== document.documentElement) return;
const _pal = document.getElementById('commandPalette');
if (_pal && !_pal.hidden) return;
if (document.querySelector('.modal.is-open, #modalShell.is-open')) return;
try { if (typeof DrawerController !== 'undefined' && DrawerController.getId && DrawerController.getId()) { e.preventDefault(); DrawerController.close(); } } catch (err) { console.warn('[kbd] global esc drawer', err); }
};
document.addEventListener('keydown', window._cwtchGlobalEscFn, true);
}
_onEscape = e => {
const _modals = document.querySelectorAll('.modal.is-open');
if (_modals.length) { e.preventDefault(); e.stopPropagation(); try { if (typeof Modal !== 'undefined' && Modal.dismiss) Modal.dismiss(); else _modals[_modals.length - 1].classList.remove('is-open'); } catch (err) { console.warn('[kbd] dismiss modal', err); } return; }
const drawerOpen = document.querySelector('.drawer.is-open');
if (drawerOpen) { e.preventDefault(); e.stopPropagation(); DrawerController.close(); return; }
const tocPanel = document.getElementById('tocPanel');
if (tocPanel && tocPanel.classList.contains('is-open')) { e.preventDefault(); if (typeof TOC !== 'undefined' && TOC.toggle) TOC.toggle(); return; }
const _ae = document.activeElement;
if (_ae && _ae !== document.body && _ae !== document.documentElement && (/^(input|textarea|select)$/i.test(_ae.tagName) || _ae.isContentEditable)) return;
e.preventDefault();
const _wasFocus = document.body.classList.contains('focus-mode');
document.body.classList.remove('focus-mode');
try {
if (window.Cwtch && window.Cwtch.Settings && typeof window.Cwtch.Settings.setRow === 'function') { window.Cwtch.Settings.setRow('reader.focusMode', false); }
else { Prefs.set('setting.reader.focusMode', false); }
} catch (err) { console.warn('[kbd] exit focus mode', err); }
if (_wasFocus) { try { if (window.Cwtch && window.Cwtch.Toast && window.Cwtch.Toast.show) window.Cwtch.Toast.show('Focus mode off'); } catch {} }
};
try { document.addEventListener('keydown', _onEscape, true); } catch (e) { console.warn('[kbd] bind onEscape', e); }
}
function uninstall() {
if (!_kbdInstalled) return;
_kbdInstalled = false;
gPending = false;
if (gTimer) { clearTimeout(gTimer); gTimer = null; }
if (_hintTimer) { clearTimeout(_hintTimer); _hintTimer = null; }
if (typeof _showHint === 'function') { try { _showHint(''); } catch (e) { console.warn('[kbd] showHint', e); } }
document.removeEventListener('keydown', _onKeyDown, true);
document.removeEventListener('keydown', _onGPrefix, true);
document.removeEventListener('keydown', _onQuestionMark, true);
if (_onEscape) document.removeEventListener('keydown', _onEscape, true);
_onEscape = null;
try { if (window._cwtchGlobalEscFn) { document.removeEventListener('keydown', window._cwtchGlobalEscFn, true); window._cwtchGlobalEscFn = null; window._cwtchGlobalEscBound = false; } } catch (e) { console.warn('[kbd] remove globalEsc', e); }
_prefixTimeoutCache = null;
_prefixTimeoutCacheKey = null;
try { if (window._cwtchFocusShortcutFn) { document.removeEventListener('keydown', window._cwtchFocusShortcutFn, true); window._cwtchFocusShortcutFn = null; window._cwtchFocusShortcut = false; } } catch (e) { console.warn('[kbd] remove focus shortcut', e); }
}
let gPending = false, gTimer = null;
const _gmap = {
l: 'library',
s: 'search',
n: 'note',
e: 'edit',
t: 'settings',
i: 'invert',
d: 'background',
a: 'canvas'
};
const _hintEl = () => document.getElementById('kbdPrefixHint');
let _hintTimer = null;
let _prefixTimeoutCache = null, _prefixTimeoutCacheKey = null;
function _gTimeout() {
let raw;
try { raw = Prefs.get('setting.keyboard.prefixTimeout'); } catch (e) { console.warn('[kbd] prefix timeout', e); return 1200; }
const _key = String(raw) + '|' + typeof raw;
if (_prefixTimeoutCacheKey === _key && _prefixTimeoutCache != null) return _prefixTimeoutCache;
const v = Number(raw);
const out = Number.isFinite(v) && v > 0 ? Math.min(Math.max(v, 100), 10000) : 1200;
_prefixTimeoutCache = out; _prefixTimeoutCacheKey = _key;
return out;
}
function invalidatePrefixTimeoutCache() { _prefixTimeoutCache = null; _prefixTimeoutCacheKey = null; }
function _showHint(txt) {
const el = _hintEl();
if (!el) return;
if (_hintTimer) { clearTimeout(_hintTimer); _hintTimer = null; }
if (txt && typeof txt === 'string') {
const parts = txt.split('·').map(s => s.trim()).filter(Boolean).slice(0, 50);
const _frag = document.createDocumentFragment();
parts.forEach(p => {
const m = p.match(/^([a-z?/]+)\s+(.*)$/i);
if (m) {
const k = document.createElement('kbd'); k.textContent = String(m[1]).slice(0, 8);
const s = document.createElement('span'); s.textContent = ' ' + String(m[2]).slice(0, 80) + ' ';
_frag.appendChild(k); _frag.appendChild(s);
} else {
const s = document.createElement('span'); s.textContent = String(p).slice(0, 100) + ' ';
_frag.appendChild(s);
}
});
el.replaceChildren(_frag);
el.hidden = false;
_hintTimer = setTimeout(() => { el.hidden = true; el.replaceChildren(); _hintTimer = null; }, _gTimeout());
} else { el.hidden = true; el.replaceChildren(); }
}
if (typeof document !== 'undefined' && !window._cwtchHintBound) {
window._cwtchHintBound = true;
document.addEventListener('visibilitychange', () => {
if (document.hidden) { const el = document.getElementById('kbdPrefixHint'); if (el) { el.hidden = true; el.replaceChildren(); } }
});
}
function _onGPrefix(e) {
if (!e || e.isComposing || e.keyCode === 229) return;
if (!e.key || typeof e.key !== 'string') return;
if (e.ctrlKey || e.metaKey || e.altKey) return;
if (e.repeat) return;
const _hiddenHost2 = e.target && e.target.closest && e.target.closest('[hidden], [aria-hidden="true"]');
if (_hiddenHost2 && _hiddenHost2.id !== 'kbdPrefixHint') return;
if (e.target && typeof e.target.closest === 'function' && e.target.closest('.modal.is-open, #modalShell.is-open, #commandPalette:not([hidden])')) return;
const _tg = e.target;
if (_tg && _tg.isContentEditable) return;
if (_tg && _tg.closest && _tg.closest('[contenteditable="true"]')) return;
if (_tg && typeof _tg.matches === 'function' && _tg.matches('input, textarea, select, [contenteditable="true"]')) return;
if (document.activeElement && document.activeElement.isContentEditable) return;
if ((e.key === 'g' || e.key === 'G') && !gPending) {
gPending = true;
clearTimeout(gTimer);
_showHint('g · l library · s search · n note · e edit · t settings · i invert · d background · a canvas');
gTimer = setTimeout(() => { gPending = false; _showHint(''); }, _gTimeout());
return;
}
if (gPending) {
gPending = false;
clearTimeout(gTimer);
_showHint('');
const target = _gmap[e.key.toLowerCase()];
if (!target) return;
e.preventDefault();
if (target === 'canvas') { try { ContentView.showCanvas(); if (window.Cwtch && window.Cwtch.HeaderRenderer && window.Cwtch.HeaderRenderer.setActive) window.Cwtch.HeaderRenderer.setActive('canvas'); } catch (err) { console.warn('[kbd] canvas', err); } }
else if (target && Config.drawers && Object.prototype.hasOwnProperty.call(Config.drawers, target)) { if (window.Cwtch && window.Cwtch.HeaderRenderer && window.Cwtch.HeaderRenderer.setActive) window.Cwtch.HeaderRenderer.setActive(target); DrawerController.open(target); }
}
}
return { install, uninstall };
})();