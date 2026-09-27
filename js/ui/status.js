
import { Prefs } from '../core/prefs.js';
import { Bus } from '../core/bus.js';
import { Strings } from '../core/strings.js';
import { EVENTS } from '../core/events.js';

export const Status = (() => {
let bar, modeEl, wordsEl, levelEl, saveEl;
let saveTimer = null;
let _statusInit = false;
let _statusUnsubs = [];
function init() {
if (_statusInit) return;
bar = document.getElementById('statusBar');
if (!bar) return;
_statusInit = true;
modeEl = document.getElementById('statusMode');
wordsEl = document.getElementById('statusWords');
levelEl = document.getElementById('statusLevel');
saveEl = document.getElementById('statusSave');
if (!modeEl || !wordsEl || !saveEl) { console.warn('[status] missing status elements'); }
try {
if (!bar.dataset.statusBound) {
bar.dataset.statusBound = '1';
bar.addEventListener('keydown', e => { if (e.key === 'Escape') { try { bar.blur(); } catch (err) {} } });
}
} catch (e) { console.warn('[status] bind', e); }
if (saveEl && saveEl._origText == null) { saveEl._origText = saveEl.textContent; }
refreshVisibility();
try { const _off = Bus.on(EVENTS.CURRENT_VIEW || 'state:currentView', ({ value }) => setMode(value)); if (typeof _off === 'function') _statusUnsubs.push(_off); } catch (e) { console.warn('[status] bus sub', e); }
const _storage = e => { if (!e || !e.key) return; if (/_statusBar$|statusBar$/.test(e.key)) refreshVisibility(); };
window._statusStorageHandler = _storage;
window.addEventListener('storage', _storage);
_statusUnsubs.push(() => { try { window.removeEventListener('storage', _storage); } catch (e) { console.warn('[status] off storage', e); } });
if (typeof window !== 'undefined' && !window._cwtchStatusPagehideBound) {
window._cwtchStatusPagehideBound = true;
window.addEventListener('pagehide', () => { try { if (saveTimer) clearTimeout(saveTimer); } catch (e) { console.warn('[status] pagehide', e); } });
}
}
function setVisible(on) {
if (!bar || !bar.isConnected) return;
bar.hidden = !on;
if (on) bar.removeAttribute('aria-hidden');
else bar.setAttribute('aria-hidden', 'true');
document.body.classList.toggle('has-status-bar', !!on);
try { document.documentElement.style.setProperty('--status-bar-h', on ? '24px' : '0px'); } catch (e) { console.warn('[status] css var', e); }
}
function refreshVisibility() {
if (!bar) return;
let _on = true;
try {
const _raw = Prefs.get('setting.ui.statusBar');
if (_raw === undefined) { const _legacy = Prefs.get('setting.statusBar', true); _on = _legacy !== false && _legacy !== 'false'; }
else _on = _raw !== false && _raw !== 'false';
} catch (e) { console.warn('[status]', e); }
if (bar._lastVisible === _on) return;
bar._lastVisible = _on;
setVisible(_on);
}
function refreshVisibilityForce() { if (bar) { bar._lastVisible = null; refreshVisibility(); } }
function setMode(mode) {
if (!modeEl || !modeEl.isConnected) return;
let _m = String(mode == null ? '—' : mode).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40) || '—';
if (modeEl._lastMode === _m) return;
modeEl._lastMode = _m;
modeEl.textContent = _m;
modeEl.setAttribute('aria-label', 'Mode: ' + _m);
}
function setWords(n) {
if (!wordsEl || !wordsEl.isConnected) return;
const _num = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(Number(n) || 0)));
if (wordsEl._lastWords === _num && wordsEl._lastWordsText != null) return;
wordsEl._lastWords = _num;
let t;
try { t = _num + ' ' + ((typeof Strings !== 'undefined' && typeof Strings.plural === 'function') ? Strings.plural(_num, 'word', 'words') : (_num === 1 ? 'word' : 'words')); }
catch (e) { console.warn('[status] plural', e); t = _num + ' words'; }
wordsEl._lastWordsText = t;
try { wordsEl.dataset.words = String(_num); } catch (e) { console.warn('[status] dataset', e); }
let _showReading = true;
try { const _rt = Prefs.get('setting.layout.readingTime'); _showReading = _rt !== false && _rt !== 'false'; } catch (e) { console.warn('[status] readingTime pref', e); }
if (_showReading && _num > 0) {
const _min = Math.max(1, Math.round(_num / 220));
t += ' · ~' + _min + ' min';
}
wordsEl.textContent = t;
wordsEl.setAttribute('aria-label', t);
}
function setCount(n, unit) {
if (!wordsEl || !wordsEl.isConnected) return;
const _num = Math.max(0, Math.round(Number(n) || 0));
let _unit = unit;
if (_unit === '' || _unit == null) {
try { _unit = (typeof Strings !== 'undefined' && typeof Strings.plural === 'function') ? Strings.plural(_num, 'item', 'items') : (_num === 1 ? 'item' : 'items'); }
catch (e) { console.warn('[status] plural', e); _unit = 'items'; }
} else _unit = String(_unit).slice(0, 40);
const t = _num + ' ' + _unit;
if (wordsEl._lastCount === t) return;
wordsEl._lastCount = t;
wordsEl.textContent = t;
wordsEl.setAttribute('aria-label', t);
}
function setLevel(n) {
if (!levelEl || !levelEl.isConnected) return;
const _lv = Math.round(Number(n) || 0);
if (_lv <= 0) { levelEl.hidden = true; levelEl.textContent = ''; levelEl.removeAttribute('aria-label'); return; }
levelEl.hidden = false;
levelEl.textContent = 'Lv ' + _lv;
levelEl.setAttribute('aria-label', 'Level ' + _lv);
}
let _saveStamp = 0;
function flashSave(text, type) {
if (!saveEl) return;
if (!saveEl.isConnected) return;
if (saveEl._origText == null) saveEl._origText = saveEl.textContent;
const _origErr = saveEl.classList.contains('is-error');
saveEl.textContent = String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80);
saveEl.classList.toggle('is-error', type === 'error');
saveEl.classList.toggle('is-saved', type === 'saved');
saveEl.classList.toggle('is-dirty', type === 'saving');
const stamp = ++_saveStamp;
clearTimeout(saveTimer);
saveTimer = setTimeout(() => {
if (_saveStamp === stamp && saveEl && saveEl.isConnected) {
saveEl.textContent = (saveEl._origText && saveEl._origText !== '—') ? saveEl._origText : '—';
saveEl.classList.toggle('is-error', !!_origErr);
saveEl.classList.remove('is-saved');
saveEl.classList.remove('is-dirty');
}
saveTimer = null;
}, 2200);
}
function forceClearSave() {
if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
if (saveEl && saveEl.isConnected) { saveEl.textContent = '—'; saveEl.classList.remove('is-error'); saveEl._origText = '—'; saveEl._lastWords = null; saveEl._lastWordsText = null; }
_saveStamp++;
}
function destroy() {
if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
_saveStamp++;
if (saveEl) { saveEl._lastWords = null; saveEl._lastWordsText = null; }
try { window.removeEventListener('storage', _statusStorageHandler); } catch (e) { console.warn('[status] removeStorage', e); }
_statusUnsubs.forEach(fn => { try { if (typeof fn === 'function') fn(); } catch (e) { console.warn('[status] unsub', e); } });
_statusUnsubs = [];
if (bar && bar.isConnected) { bar.hidden = true; bar.setAttribute('aria-hidden', 'true'); }
document.body.classList.remove('has-status-bar');
if (saveEl) { saveEl._prevText = null; saveEl._prevError = false; saveEl._origText = null; }
bar = null; modeEl = null; wordsEl = null; levelEl = null; saveEl = null;
_saveStamp = 0;
_statusInit = false;
}
return { init, setVisible, refreshVisibility, setMode, setWords, setCount, setLevel, flashSave, forceClearSave, destroy, getMode: () => modeEl ? modeEl.textContent : '—' };
})();