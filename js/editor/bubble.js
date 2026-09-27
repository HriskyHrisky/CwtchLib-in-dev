
import { State } from '../core/state.js';
import { Prefs } from '../core/prefs.js';
import { Store } from '../core/store.js';
import { Bus } from '../core/bus.js';
import { Modal } from '../ui/modal.js';
import { Toast } from '../ui/toast.js';
import { Status } from '../ui/status.js';
import { Announce } from '../ui/announce.js';
import { ReviewEngine } from '../srs/review-engine.js';
import { CryptoUtil } from '../core/crypto.js';

export const SelectionBubble = (() => {
let bubble = null;
let lastRange = null;
let hideTimer = null;
let _sbListenersBound = false;
let _sbAbort = null;
let _sbDocMouseDown = null;
let _sbScroll = null;
let _sbResize = null;
let _sbSelRaf = 0;
let _sbScheduleSel = null;
function init() {
bubble = document.getElementById('selBubble');
if (!bubble) return;
if (_sbListenersBound) return;
const _toolbarBtnsCache = bubble.querySelectorAll('button[data-format]');
if (!_toolbarBtnsCache.length) { console.info('[bubble] no toolbar buttons, deferring init'); return; }
_sbListenersBound = true;
_sbScheduleSel = () => { if (_sbSelRaf) return; _sbSelRaf = requestAnimationFrame(() => { _sbSelRaf = 0; try { scheduleUpdate(); } catch (e) { console.warn('[bubble] update', e); } }); };
try { document.addEventListener('selectionchange', _sbScheduleSel); } catch (e) { console.warn('[bubble] selectionchange bind', e); }
_sbDocMouseDown = e => { if (!bubble || !bubble.contains(e.target)) { const _t = e.target; if (_t && _t.closest && _t.closest('#selBubble')) return; hide(); } };
document.addEventListener('mousedown', _sbDocMouseDown);
_sbScroll = hide;
window.addEventListener('scroll', _sbScroll, { passive: true });
let _sbLastW = window.innerWidth;
_sbResize = () => { if (window.innerWidth !== _sbLastW) { _sbLastW = window.innerWidth; hide(); } };
window.addEventListener('resize', _sbResize, { passive: true });
const toolbarBtns = Array.from(_toolbarBtnsCache);
if (!toolbarBtns.length) { console.info('[bubble] no toolbar buttons'); return; }
toolbarBtns.forEach((btn, i) => {
btn.setAttribute('tabindex', i === 0 ? '0' : '-1');
if (!btn._bound) {
btn._bound = true;
btn.addEventListener('mousedown', e => {
e.preventDefault();
e.stopPropagation();
const _fmt = btn.dataset && btn.dataset.format;
if (!_fmt) return;
Promise.resolve(run(_fmt)).catch(err => { console.warn('[bubble] run failed', err); try { if (typeof Toast !== 'undefined' && Toast.error) Toast.error('Format failed'); } catch {} });
});
}
btn.addEventListener('keydown', e => {
if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
e.preventDefault();
const list = toolbarBtns;
const idx = list.indexOf(btn);
const next = e.key === 'ArrowRight' ? list[(idx + 1) % list.length] : list[(idx - 1 + list.length) % list.length];
list.forEach(b => b.setAttribute('tabindex', '-1'));
if (next) { next.setAttribute('tabindex', '0'); if (typeof next.focus === 'function') next.focus(); }
});
});
}
let _pendingUpdate = 0;
function scheduleUpdate() {
if (_pendingUpdate) return;
_pendingUpdate = requestAnimationFrame(() => {
_pendingUpdate = 0;
try { update(); } catch (e) { console.warn('[bubble] update', e); }
});
}
let _hhCache = 0, _hhCacheTs = 0;
window.addEventListener('resize', () => { _hhCacheTs = 0; _hhCache = 0; }, { passive: true });
try { const _mqCoarse = window.matchMedia('(pointer: coarse)'); const _mqFn = () => { _hhCacheTs = 0; _hhCache = 0; }; if (_mqCoarse.addEventListener) _mqCoarse.addEventListener('change', _mqFn); else if (_mqCoarse.addListener) _mqCoarse.addListener(_mqFn); } catch (e) { console.warn('[bubble] mq', e); }
function _headerHeight() {
const _now = Date.now();
if (_hhCache && _now - _hhCacheTs < 2000) return _hhCache;
try {
const v = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10);
_hhCache = Number.isFinite(v) && v >= 0 && v <= 400 ? v : 56;
} catch (e) { console.warn('[bubble] header-h', e); _hhCache = 56; }
_hhCacheTs = _now;
return _hhCache;
}
const sel = window.getSelection();
if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return hide();
  const text = sel.toString().trim();
  if (!text) return hide();
  try {
    const _sbPref = Prefs.get('setting.editor.selectionBubble');
    if (_sbPref === false || _sbPref === 'false') return hide();
  } catch (e) { console.warn('[bubble] bubble pref', e); }
  const anchor = sel.anchorNode;
const host = anchor && anchor.nodeType === 1 ? anchor : (anchor ? anchor.parentElement : null);
if (!host) return hide();
if (host.closest && host.closest('textarea, input')) return hide();
const scope = host.closest('.editor__body, .doc__body, .reader__body, .editor__raw');
if (!scope) return hide();
const range = sel.getRangeAt(0);
lastRange = range.cloneRange();
const rect = range.getBoundingClientRect();
if (!rect.width && !rect.height) return hide();
bubble.hidden = false;
bubble._lastShowTs = Date.now();
const bw = bubble.offsetWidth || 220;
const bh = bubble.offsetHeight || 36;
const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
bubble.style.direction = rtl ? 'rtl' : 'ltr';
const left = Math.max(8, Math.min(window.innerWidth - bw - 8, rect.left + rect.width / 2 - bw / 2));
let top = rect.top - bh - 8;
if (top < 8) top = rect.bottom + 8;
top = Math.max(8, Math.min(window.innerHeight - bh - 8, top));
bubble.style.left = left + 'px';
bubble.style.top = top + 'px';
}
function hide() {
try { if (bubble) { bubble.hidden = true; if (bubble._delayTimer) { clearTimeout(bubble._delayTimer); bubble._delayTimer = null; } } } catch (e) { console.warn('[bubble] hide', e); }
if (_pendingUpdate) { try { cancelAnimationFrame(_pendingUpdate); } catch (e) { console.warn('[bubble] cancelRaf', e); } _pendingUpdate = 0; }
if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
lastRange = null;
if (_sbSelRaf) { try { cancelAnimationFrame(_sbSelRaf); } catch (e) { console.warn('[bubble] cancelSelRaf', e); } _sbSelRaf = 0; }
}
function restore() {
if (!lastRange) return false;
try {
const _sc = lastRange.startContainer;
const _host = _sc && (_sc.nodeType === 1 ? _sc : _sc.parentNode);
if (!_host || !document.contains(_host)) { lastRange = null; return false; }
const sel = window.getSelection();
if (!sel) { lastRange = null; return false; }
sel.removeAllRanges();
sel.addRange(lastRange);
return true;
} catch (e) { console.warn('[bubble] restore', e); lastRange = null; return false; }
}
function insertTextAtCursor(txt) {
const active = document.activeElement;
if (active && /^(textarea|input)$/i.test(active.tagName) && typeof active.setRangeText === 'function') {
const s = active.selectionStart, e = active.selectionEnd;
active.setRangeText(txt, s, e, 'end');
active.dispatchEvent(new Event('input', { bubbles: true }));
return;
}
const sel = window.getSelection();
if (!sel || !sel.rangeCount) return;
const _node = sel.anchorNode;
const _host = _node && (_node.nodeType === 1 ? _node : _node.parentElement);
if (!_host) return;
const _scope = _host.closest ? _host.closest('textarea, input, [contenteditable="true"], .editor__body, .editor__raw, .doc__body, .reader__body') : null;
if (!_scope) return;
const range = sel.getRangeAt(0);
range.deleteContents();
const node = document.createTextNode(txt);
range.insertNode(node);
range.setStartAfter(node);
range.collapse(true);
sel.removeAllRanges();
sel.addRange(range);
lastRange = range.cloneRange();
if (node.parentNode) {
try { node.parentNode.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: txt })); }
catch (e) { try { node.parentNode.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) { console.warn('[bubble] input event', e2); } }
}
}
async function run(fmt) {
if (!fmt || typeof fmt !== 'string') { hide(); return; }
if (!restore()) return hide();
const sel = window.getSelection();
if (!sel) { hide(); return; }
const text = sel.toString() || '';
switch (fmt) {
case 'bold': { const _t = (text.length >= 4 && text.startsWith('**') && text.endsWith('**')) ? text.slice(2, -2) : '**' + text + '**'; insertTextAtCursor(_t); break; }
case 'italic': { const _t = (text.length >= 2 && text.startsWith('*') && text.endsWith('*') && !(text.length >= 4 && text.startsWith('**') && text.endsWith('**'))) ? text.slice(1, -1) : '*' + text + '*'; insertTextAtCursor(_t); break; }
case 'underline': insertTextAtCursor('<u>' + text + '</u>'); break;
case 'strike': insertTextAtCursor('~~' + text + '~~'); break;
case 'code': insertTextAtCursor('`' + text + '`'); break;
case 'highlight': insertTextAtCursor('==' + text + '=='); break;
case 'link': {
const _savedR = (window.getSelection() && window.getSelection().rangeCount > 0) ? window.getSelection().getRangeAt(0).cloneRange() : null;
(async () => {
let prefill = '';
try {
const _readPromise = (navigator.clipboard && navigator.clipboard.readText) ? navigator.clipboard.readText() : Promise.resolve('');
const _race = await Promise.race([_readPromise.catch(() => ''), new Promise(r => setTimeout(() => r(''), 120))]);
if (typeof _race === 'string') { const t = _race.trim().slice(0, 2000); if (/^https?:\/\//i.test(t)) prefill = t; }
} catch (e) { console.warn('[bubble] clipboard read', e); }
let url = null;
try { url = await Modal.prompt('Link URL', { okLabel: 'Insert', defaultValue: prefill }); } catch (e) { console.warn('[bubble] link prompt failed', e); return hide(); }
if (url == null) return hide();
url = String(url).trim().slice(0, 2000);
if (!url) { Toast.show('Empty URL — link not inserted'); return hide(); }
let safe = /^(https?:|mailto:|#|\/|asset:|\\.)/i.test(url) ? url : ('https://' + url.replace(/^\/+/, ''));
if (!_savedR) { if (!restore()) { Toast.show('Selection lost — link not inserted'); return hide(); } }
else {
lastRange = _savedR.cloneRange();
const sel = window.getSelection();
if (sel) { sel.removeAllRanges(); try { sel.addRange(_savedR); } catch (e) { console.warn('[bubble] link restore savedR', e); } }
}
const s2 = window.getSelection();
const t2 = s2 ? s2.toString() : '';
insertTextAtCursor('[' + (t2 || 'link') + '](' + safe + ')');
hide();
})();
return;
}
case 'level': {
const _savedR2 = (window.getSelection() && window.getSelection().rangeCount > 0) ? window.getSelection().getRangeAt(0).cloneRange() : null;
let _lv = null;
try { _lv = await Modal.prompt('Set level (1-99)', { okLabel: 'Set', defaultValue: '1' }); } catch (e) { console.warn('[bubble] level prompt', e); return hide(); }
if (_lv == null) return hide();
const n = Math.max(1, Math.min(99, parseInt(_lv, 10) || 1));
if (_savedR2) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(_savedR2); }
if (!restore()) { try { Toast.show('Selection lost'); } catch (e) { console.warn('[bubble] toast', e); } return hide(); }
const _escText = text.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]);
insertTextAtCursor('<span data-lvl="' + n + '">' + _escText + '</span>');
Status.setLevel(n);
const _id = State.get('activeTabId');
const _it = (State.get('libraryItems') || []).find(x => x.id === _id);
if (_it && n > 0) {
const _up = Object.assign({}, _it, { level: n, lastModified: Date.now() });
try { await Store.put(_up); } catch (e) { console.warn('[level] store failed', e); }
State.set('libraryItems', (State.get('libraryItems') || []).map(x => x.id === _id ? _up : x));
Bus.emit('library:changed');
}
Announce.polite('Level ' + n + ' applied to selection');
return;
}
case 'card': {
if (text.trim()) {
Promise.resolve(Modal.prompt('Back of card', { okLabel: 'Create' })).then(async back => {
if (back === null || back === undefined) return hide();
try {
if (typeof ReviewEngine.createClozeCard === 'function' && /\{\{c\d+::/.test(text)) {
await ReviewEngine.createClozeCard(text.slice(0, 100000), String(back || '').slice(0, 100000));
Toast.success('Cloze card created');
} else {
await ReviewEngine.createCard(text.trim().slice(0, 100000), String(back || '').slice(0, 100000));
Toast.success('Card created');
}
} catch (e) { Toast.error('Card creation failed: ' + (e && e.message ? e.message : e)); }
hide();
}).catch(err => { console.warn('[bubble] card prompt', err); hide(); });
} else hide();
return;
}
case 'encrypt': {
if (!text.trim()) { hide(); return; }
if (text.length > 100000) { Toast.error('Selection too large to encrypt (>100KB)'); hide(); return; }
try {
const pw = await CryptoUtil.promptPassword();
if (!pw) { hide(); return; }
const payload = await CryptoUtil.encrypt(text, null, pw);
const _json = JSON.stringify(payload);
const _bytes = new TextEncoder().encode(_json);
const _CHUNK = 4096;
const _parts = [];
for (let _i = 0; _i < _bytes.length; _i += _CHUNK) {
const _sub = _bytes.subarray(_i, Math.min(_i + _CHUNK, _bytes.length));
let _part = '';
for (let _j = 0; _j < _sub.length; _j++) _part += String.fromCharCode(_sub[_j]);
_parts.push(_part);
}
const token = 'ENC[' + btoa(_parts.join('')) + ']';
if (token.length > 200000) { Toast.error('Encrypted token too large to insert'); hide(); return; }
insertTextAtCursor(token);
Toast.success('Encrypted (AES-GCM)');
} catch (e) { Toast.error('Encrypt failed: ' + (e && e.message ? e.message : e)); }
hide();
return;
}
case 'decrypt': {
const _m = text.replace(/\s+/g, '').match(/^ENC\[([A-Za-z0-9+/=]{1,200000})\]$/);
if (!_m) { Toast.show('Not an encrypted token'); hide(); return; }
try {
const _bin = atob(_m[1]);
const _bytes = new Uint8Array(_bin.length);
for (let _i = 0; _i < _bin.length; _i++) _bytes[_i] = _bin.charCodeAt(_i);
const payload = JSON.parse(new TextDecoder().decode(_bytes));
const plain = await CryptoUtil.decrypt(payload);
if (!plain) { Toast.error('Decrypt returned empty'); hide(); return; }
insertTextAtCursor(plain);
Toast.success('Decrypted');
} catch (e) { Toast.error('Decrypt failed: ' + e.message); }
hide();
return;
}
}
hide();
}
function destroy() {
if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
if (_pendingUpdate) { try { cancelAnimationFrame(_pendingUpdate); } catch (e) { console.warn('[bubble] cancelRaf', e); } _pendingUpdate = 0; }
if (bubble && bubble._delayTimer) { clearTimeout(bubble._delayTimer); bubble._delayTimer = null; }
if (_sbScheduleSel) { try { document.removeEventListener('selectionchange', _sbScheduleSel); } catch (e) { console.warn('[bubble] removeSel', e); } _sbScheduleSel = null; }
if (_sbDocMouseDown) { try { document.removeEventListener('mousedown', _sbDocMouseDown); } catch (e) { console.warn('[bubble] removeMouse', e); } _sbDocMouseDown = null; }
if (_sbScroll) { try { window.removeEventListener('scroll', _sbScroll); } catch (e) { console.warn('[bubble] removeScroll', e); } _sbScroll = null; }
if (_sbResize) { try { window.removeEventListener('resize', _sbResize); } catch (e) { console.warn('[bubble] removeResize', e); } _sbResize = null; }
if (_sbSelRaf) { try { cancelAnimationFrame(_sbSelRaf); } catch (e) { console.warn('[bubble] cancelSelRaf', e); } _sbSelRaf = 0; }
lastRange = null;
bubble = null;
_sbListenersBound = false;
}
return { init, hide, run, destroy };
})();