
import { Prefs } from '../core/prefs.js';
import { State } from '../core/state.js';
import { Telemetry } from '../core/telemetry.js';

export const ReadingProgress = (() => {
let el = null;
let raf = null;
let _onScroll = null, _onResize = null, _ro = null, _cleanupFns = [];
let _inited = false;
function _destroy() {
if (_onScroll) { try { window.removeEventListener('scroll', _onScroll); } catch (e) { console.warn('[progress] removeScroll', e); } _onScroll = null; }
if (_onResize) { try { window.removeEventListener('resize', _onResize); } catch (e) { console.warn('[progress] removeResize', e); } _onResize = null; }
if (_ro) { try { _ro.disconnect(); } catch (e) { console.warn('[progress] destroy RO', e); } _ro = null; }
try { if (_onTouchMove) document.removeEventListener('touchmove', _onTouchMove); } catch (e) { console.warn('[progress] touchmove', e); }
_onTouchMove = null;
try { if (_onTouchEnd) document.removeEventListener('touchend', _onTouchEnd); } catch (e) { console.warn('[progress] touchend', e); }
_onTouchEnd = null;
if (_readSaver) { clearTimeout(_readSaver); _readSaver = null; }
if (window._pinchSaveTimer) { clearTimeout(window._pinchSaveTimer); window._pinchSaveTimer = null; }
_cleanupFns.forEach(fn => { try { fn(); } catch (e) { console.warn('[progress] cleanup', e); } });
_cleanupFns = [];
if (raf) { cancelAnimationFrame(raf); raf = null; }
el = null;
_inited = false;
}
let _onTouchMove = null;
let _onTouchEnd = null;
let _readSaver = null;
function init() {
if (el) return;
if (_inited) return;
try {
try { if (window.top !== window.self) { console.info('[reading-progress] iframe detected, skipping'); return; } } catch (e) { console.info('[reading-progress] cross-origin iframe, skipping'); return; }
} catch (e) { console.info('[reading-progress] iframe check failed, skipping'); return; }
el = document.getElementById('readingProgress');
if (!el) { console.warn('[reading-progress] #readingProgress not found'); return; }
_onScroll = () => { try { schedule(); } catch (e) { console.warn('[progress] schedule', e); } };
window.addEventListener('scroll', _onScroll, { passive: true });
try {
const _mqPrint = window.matchMedia('print');
const _printFn = e => { if (el) el.hidden = e.matches; };
if (_mqPrint.addEventListener) _mqPrint.addEventListener('change', _printFn);
else if (_mqPrint.addListener) _mqPrint.addListener(_printFn);
_cleanupFns.push(() => { try { if (_mqPrint.removeEventListener) _mqPrint.removeEventListener('change', _printFn); else if (_mqPrint.removeListener) _mqPrint.removeListener(_printFn); } catch {} });
} catch (e) { console.warn('[reading-progress] print mq', e); }
_onResize = () => schedule();
window.addEventListener('resize', _onResize, { passive: true });
let _d=0, _pinchPending=false, _pinchLastSize=null, _pinchCanceled=false, _pinchSawTwo=false;
_onTouchMove = e=>{
if (!e.touches || e.touches.length !== 2) { _d = 0; if (_pinchSawTwo) _pinchCanceled = true; return; }
if (!e.cancelable) return;
_pinchSawTwo = true;
_pinchCanceled = false;
const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
if (_d) {
let s = 16;
try { s = Number(Prefs.get('setting.typography.baseFontSize')) || 16; } catch (e) { console.warn('[progress] baseFontSize', e); }
_pinchLastSize = Math.max(12, Math.min(22, s + (d - _d) * 0.05));
if (!_pinchPending) {
_pinchPending = true;
requestAnimationFrame(() => {
_pinchPending = false;
if (_pinchLastSize != null && !_pinchCanceled) {
document.documentElement.style.setProperty('--reading-size', _pinchLastSize + 'px');
clearTimeout(window._pinchSaveTimer);
window._pinchSaveTimer = setTimeout(() => { try { Prefs.set('setting.typography.baseFontSize', _pinchLastSize); } catch (e2) { console.warn('[progress] save pinch', e2); } }, 300);
}
});
}
}
_d = d;
};
_onTouchEnd = (e) => {
if (e.touches && e.touches.length >= 2) return;
_d = 0;
if (_pinchLastSize != null && !_pinchCanceled) {
try { Prefs.set('setting.typography.baseFontSize', _pinchLastSize); } catch (e2) { console.warn('[progress] persist pinch', e2); }
try { if (window.Cwtch && window.Cwtch.DrawerController && window.Cwtch.DrawerController.refresh) window.Cwtch.DrawerController.refresh(); } catch (e2) { console.warn('[progress] refresh', e2); }
}
_pinchLastSize = null;
_pinchCanceled = false;
_pinchSawTwo = false;
};
document.addEventListener('touchmove', _onTouchMove, { passive: false });
document.addEventListener('touchend', _onTouchEnd, { passive: true });
_inited = true;
try { schedule(); } catch (e) { console.warn('[progress] initial schedule', e); }
}
function schedule() {
if (raf) cancelAnimationFrame(raf);
raf = requestAnimationFrame(() => { raf = null; try { update(); } catch (e) { console.warn('[progress] update', e); } });
}
function update() {
if (!el || !el.isConnected) return;
let _showRing = true;
try {
const _rawRing = Prefs.get('setting.reader.showProgressRing');
_showRing = _rawRing !== false && _rawRing !== 'false';
} catch (e) { console.warn('[progress] pref', e); }
if (!_inited) { el.hidden = true; return; }
if (!_showRing) { el.hidden = true; el.setAttribute('aria-valuenow', '0'); el.setAttribute('aria-hidden', 'true'); return; }
const _se = document.scrollingElement || document.documentElement;
const h = _se.scrollHeight - window.innerHeight;
const _st = Number(_se.scrollTop) || Number(window.scrollY) || 0;
const pct = h > 4 ? Math.max(0, Math.min(100, (_st / h) * 100)) : 0;
try { el.style.setProperty('--read-progress-num', String(pct / 100)); } catch (e) { console.warn('[progress] setProp', e); }
const view = State.get('currentView');
const reading = (view === 'doc' || view === 'edit') && pct > 1;
el.hidden = !reading;
if (reading) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true');
el.setAttribute('aria-valuenow', String(reading ? Math.round(pct) : 0));
const _pctRounded = Math.round(pct);
if (el._lastPct !== _pctRounded) { el._lastPct = _pctRounded; if (reading) el.setAttribute('aria-valuetext', _pctRounded + '% read'); else el.removeAttribute('aria-valuetext'); }
const _aid = State.get('activeTabId');
if (_aid) {
clearTimeout(_readSaver);
const _rounded = Math.round(pct);
if (el._lastSavedPct !== _rounded) {
el._lastSavedPct = _rounded;
_readSaver = setTimeout(() => {
try { Prefs.set('read.' + _aid, _rounded); } catch (e) { console.warn('[progress] save', e); }
try { if (_rounded >= 100) Telemetry.record('doc.read.complete', { id: _aid }); } catch (e) { console.warn('[progress] telemetry', e); }
}, 800);
}
}
}
return { init, destroy: _destroy, refresh: schedule };
})();