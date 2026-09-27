
import { Prefs } from '../core/prefs.js';

export const Scrollbar = (() => {
let el = null;
let track = null;
let thumb = null;
let target = null;
let hideTimer = 0;
let raf = 0;
let dragging = false;
let dragStartY = 0;
let dragStartScrollTop = 0;
let _inited = false;
let _onScroll = null;
let _onResize = null;
let _onVisibilityChange = null;
let _thumbDragHandlers = null;

const HIDE_DELAY = 1000;
const MIN_THUMB = 24;

function _enabled() {
try {
const _raw = Prefs.get('setting.ui.customScrollbar', true);
return _raw !== false && _raw !== 'false';
}
catch (e) { console.warn('[scrollbar] pref', e); return true; }
}

function _resolveTarget() {
const se = document.scrollingElement;
if (se && typeof se.scrollTop === 'number') return se;
const de = document.documentElement;
if (de && typeof de.scrollTop === 'number') return de;
const b = document.body;
if (b && typeof b.scrollTop === 'number') return b;
return document.documentElement;
}

function _metrics() {
if (!target || !track || !track.isConnected) return { scrollTop: 0, scrollHeight: 0, clientHeight: 0, maxScroll: 0, trackH: 0, thumbH: MIN_THUMB, maxThumbTop: 0, thumbTop: 0 };
const scrollTop = Number(target.scrollTop) || 0;
const scrollHeight = Number(target.scrollHeight) || 0;
const clientHeight = Number(target.clientHeight) || 0;
const maxScroll = Math.max(0, scrollHeight - clientHeight);
const trackH = Math.max(0, track.clientHeight) || 0;
if (trackH === 0) return { scrollTop, scrollHeight, clientHeight, maxScroll, trackH: 0, thumbH: MIN_THUMB, maxThumbTop: 0, thumbTop: 0 };
const thumbH = Math.max(MIN_THUMB, (clientHeight / Math.max(1, scrollHeight)) * trackH);
const maxThumbTop = Math.max(0, trackH - thumbH);
const thumbTop = maxScroll > 0 ? (scrollTop / maxScroll) * maxThumbTop : 0;
return { scrollTop, scrollHeight, clientHeight, maxScroll, trackH, thumbH, maxThumbTop, thumbTop };
}

function _render() {
raf = 0;
if (!el || !el.isConnected || !thumb || !target) return;
if (!_enabled()) { el.hidden = true; el.classList.remove('is-visible'); return; }
const m = _metrics();
thumb.style.height = Math.max(0, m.thumbH) + 'px';
thumb.style.transform = 'translateY(' + Math.max(0, m.thumbTop) + 'px)';
const percent = m.maxScroll > 0 ? Math.round((m.scrollTop / m.maxScroll) * 100) : 0;
if (el._lastPercent !== percent) {
el._lastPercent = percent;
try {
el.setAttribute('aria-valuenow', String(percent));
el.setAttribute('aria-valuetext', percent + '%');
} catch (e) { console.warn('[scrollbar] aria', e); }
}
const hasScroll = m.maxScroll > 1;
el.hidden = !hasScroll;
if (!hasScroll) el.classList.remove('is-visible');
}

function _schedule() {
if (raf) return;
raf = requestAnimationFrame(_render);
}

function _show() { if (el) el.classList.add('is-visible'); }

function _hide() {
if (!el) return;
if (dragging) return;
if (el.matches(':hover')) return;
if (el.contains(document.activeElement)) return;
el.classList.remove('is-visible');
}

function _keepAlive() {
_show();
clearTimeout(hideTimer);
hideTimer = setTimeout(_hide, HIDE_DELAY);
}

function _onScroll() { _keepAlive(); _schedule(); }
function _onResize() { _schedule(); }

function _onKeyDown(e) {
if (!el || document.activeElement !== el || !target) return;
if (e.isComposing || e.keyCode === 229 || e.ctrlKey || e.metaKey || e.altKey) return;
const m = _metrics();
const step = Math.max(40, m.clientHeight * 0.9);
let handled = true;
const _isSpace = e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar';
if (e.key === 'ArrowDown') target.scrollTop += 40;
else if (e.key === 'ArrowUp') target.scrollTop -= 40;
else if (e.key === 'PageDown' || (_isSpace && !e.shiftKey)) target.scrollTop += step;
else if (e.key === 'PageUp' || (_isSpace && e.shiftKey)) target.scrollTop -= step;
else if (e.key === 'Home') target.scrollTop = 0;
else if (e.key === 'End') target.scrollTop = m.maxScroll;
else handled = false;
if (handled) { e.preventDefault(); e.stopPropagation(); _keepAlive(); }
}

function _bindThumbDrag() {
if (!thumb || thumb._sbBound) return;
thumb._sbBound = true;
thumb.addEventListener('pointerdown', e => {
if (e.button !== 0 && e.pointerType === 'mouse') return;
if (!target) return;
e.preventDefault();
dragging = true;
if (el) el.classList.add('is-dragging');
dragStartY = e.clientY;
dragStartScrollTop = target.scrollTop;
try { thumb.setPointerCapture(e.pointerId); } catch (err) { console.warn('[scrollbar] capture', err); }
_show();
});
thumb.addEventListener('lostpointercapture', () => {
if (dragging) { dragging = false; if (el) el.classList.remove('is-dragging'); _keepAlive(); }
});
thumb._sbPointerMove = e => {
if (!dragging) return;
const m = _metrics();
const deltaY = e.clientY - dragStartY;
const ratio = m.maxThumbTop > 0 ? m.maxScroll / m.maxThumbTop : 0;
target.scrollTop = dragStartScrollTop + deltaY * ratio;
};
thumb.addEventListener('pointermove', thumb._sbPointerMove);
const _end = e => {
if (!dragging) return;
dragging = false;
if (el) el.classList.remove('is-dragging');
try { if (e && e.pointerId != null && thumb && thumb.releasePointerCapture) thumb.releasePointerCapture(e.pointerId); } catch (err) { console.warn('[scrollbar] release', err); }
_keepAlive();
};
thumb.addEventListener('pointerup', _end);
thumb.addEventListener('pointercancel', _end);
thumb._sbPointerUp = _end;
thumb._sbPointerCancel = _end;
}

function _bindTrackClick() {
if (!track || track._sbBound) return;
track._sbBound = true;
const _trackClick = e => {
if (e.button !== 0) return;
if (e.target === thumb || (thumb && thumb.contains(e.target))) return;
if (!target) return;
const rect = track.getBoundingClientRect();
const y = e.clientY - rect.top;
const m = _metrics();
const ratio = m.trackH > 0 ? Math.max(0, Math.min(1, y / m.trackH)) : 0;
target.scrollTop = ratio * m.maxScroll;
_keepAlive();
};
track._sbTrackPointer = _trackClick;
track.addEventListener('pointerdown', _trackClick);
}

function _bindHoverFocus() {
if (!el || el._sbHoverBound) return;
el._sbHoverBound = true;
el._sbMouseEnter = () => { clearTimeout(hideTimer); _show(); };
el._sbMouseLeave = () => { _keepAlive(); };
el._sbFocusIn = () => { clearTimeout(hideTimer); _show(); };
el._sbFocusOut = () => { _keepAlive(); };
el._sbWheel = () => { _keepAlive(); };
el.addEventListener('mouseenter', el._sbMouseEnter);
el.addEventListener('mouseleave', el._sbMouseLeave);
el.addEventListener('focusin', el._sbFocusIn);
el.addEventListener('focusout', el._sbFocusOut);
el.addEventListener('keydown', _onKeyDown);
el.addEventListener('wheel', el._sbWheel, { passive: true });
}

function init() {
if (_inited) return;
el = document.getElementById('customScroller');
if (!el) { console.warn('[scrollbar] #customScroller not found'); return; }
track = el.querySelector('.custom-scroller__track');
thumb = el.querySelector('.custom-scroller__thumb');
if (!track || !thumb) { console.warn('[scrollbar] track/thumb missing'); return; }
_inited = true;
if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
let _scrollbarEnabled = true;
try { _scrollbarEnabled = Prefs.get('setting.ui.customScrollbar', true) !== false; } catch (e) { console.warn('[scrollbar] pref', e); }
if (!_scrollbarEnabled) { el.hidden = true; return; }
_attach();
_schedule();
}

function _attach() {
if (!el || el._sbAttached) return;
el._sbAttached = true;
target = _resolveTarget() || document.body;
window.addEventListener('scroll', _onScroll, { passive: true });
window.addEventListener('resize', _onResize, { passive: true });
_onVisibilityChange = () => { _keepAlive(); _schedule(); };
document.addEventListener('visibilitychange', _onVisibilityChange);
if (!el.dataset.sbBound) { el.dataset.sbBound = '1'; }
if ('ResizeObserver' in window) {
try {
const ro = new ResizeObserver(_schedule);
ro.observe(document.body);
if (target instanceof Element) ro.observe(target);
el._sbRO = ro;
} catch (e) { console.warn('[scrollbar] RO', e); }
}
if ('MutationObserver' in window) {
try {
let _moRaf = 0;
const mo = new MutationObserver(() => { if (_moRaf) return; _moRaf = requestAnimationFrame(() => { _moRaf = 0; _schedule(); }); });
mo.observe(document.body, { childList: true, subtree: true });
el._sbMO = mo;
} catch (e) { console.warn('[scrollbar] MO', e); }
}
_bindThumbDrag();
_bindTrackClick();
_bindHoverFocus();
}

function refresh() {
if (!_inited) return;
try { if (!_enabled()) { if (el) { el.hidden = true; el.classList.remove('is-visible'); } return; } } catch (e) { console.warn('[scrollbar] refresh pref', e); }
if (el && el.isConnected) el.hidden = false;
_attach();
target = _resolveTarget() || document.body;
_schedule();
}

function destroy() {
if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }
if (raf) { cancelAnimationFrame(raf); raf = 0; }
try {
if (el) {
if (el._sbHoverBound) {
el.removeEventListener('keydown', _onKeyDown);
}
el.removeEventListener('mouseenter', el._sbMouseEnter);
el.removeEventListener('mouseleave', el._sbMouseLeave);
el.removeEventListener('focusin', el._sbFocusIn);
el.removeEventListener('focusout', el._sbFocusOut);
el.removeEventListener('wheel', el._sbWheel);
el._sbMouseEnter = null; el._sbMouseLeave = null; el._sbFocusIn = null; el._sbFocusOut = null; el._sbWheel = null;
el._sbHoverBound = false;
if (el._sbRO) { el._sbRO.disconnect(); el._sbRO = null; }
if (el._sbMO) { el._sbMO.disconnect(); el._sbMO = null; }
}
} catch (e) { console.warn('[scrollbar] destroy', e); }
if (thumb && thumb._sbPointerUp) { try { thumb.removeEventListener('pointerup', thumb._sbPointerUp); } catch (e) { console.warn('[scrollbar] removePointerUp', e); } }
if (thumb && thumb._sbPointerCancel) { try { thumb.removeEventListener('pointercancel', thumb._sbPointerCancel); } catch (e) { console.warn('[scrollbar] removePointerCancel', e); } }
if (thumb && thumb._sbPointerMove) { try { thumb.removeEventListener('pointermove', thumb._sbPointerMove); } catch (e) { console.warn('[scrollbar] removePointerMove', e); } }
if (track && track._sbTrackPointer) { try { track.removeEventListener('pointerdown', track._sbTrackPointer); } catch (e) { console.warn('[scrollbar] removeTrackPointer', e); } }
try { window.removeEventListener('scroll', _onScroll); } catch (e) { console.warn('[scrollbar] removeScroll', e); }
try { window.removeEventListener('resize', _onResize); } catch (e) { console.warn('[scrollbar] removeResize', e); }
try { document.removeEventListener('visibilitychange', _onVisibilityChange); } catch (e) { console.warn('[scrollbar] removeVis', e); }
if (thumb && thumb._sbBound) { thumb._sbBound = false; }
if (track && track._sbBound) { track._sbBound = false; }
if (el) { el._lastPercent = undefined; el._sbAttached = false; }
_inited = false;
el = null; track = null; thumb = null; target = null; dragging = false;
}

return { init, refresh, destroy, isEnabled: _enabled };
})();
