
import { Prefs } from '../core/prefs.js';
import { Store } from '../core/store.js';
import { Telemetry } from '../core/telemetry.js';
import { Toast } from '../ui/toast.js';
import { Modal } from '../ui/modal.js';
import { Announce } from '../ui/announce.js';

export const ErrorBoundary = (() => {
let _fatal = false;
let _prevTitle = '';
function hideFatal() {
_fatal = false;
const el = document.getElementById('fatalError');
if (el) el.hidden = true;
try { document.body.classList.remove('has-fatal-error'); } catch (e) { console.warn('[fatal]', e); }
try { document.title = _prevTitle || 'CwtchLib'; } catch (e) { console.warn('[fatal] title restore', e); }
_prevTitle = '';
try { if (typeof DrawerController !== 'undefined' && DrawerController.getId && DrawerController.getId()) DrawerController.close(true, false); } catch (e) { console.warn('[fatal]', e); }
try { const _m = document.getElementById('main'); if (_m && typeof _m.focus === 'function') _m.focus({ preventScroll: true }); } catch (e) { console.warn('[fatal] focus restore', e); }
}
function showFatal(msg) {
if (_fatal) return;
if (msg && typeof msg === 'object') { if (typeof msg.message === 'string') msg = msg.message; else try { msg = JSON.stringify(msg).slice(0, 2000); } catch (e) { console.warn('[fatal] stringify', e); msg = String(msg); } }
const el = document.getElementById('fatalError');
if (!el) { console.error('[fatal] no container', msg); return; }
_fatal = true;
const _detailEl = document.getElementById('fatalErrorDetail');
if (_detailEl) _detailEl.textContent = String(msg == null ? 'unknown' : msg).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, 4000);
try { document.body.classList.add('has-fatal-error'); } catch (e) { console.warn('[fatal] class', e); }
if (!_prevTitle) _prevTitle = document.title || 'CwtchLib';
document.title = 'Error — CwtchLib';
el.hidden = false;
const _rf = document.getElementById('fatalReload');
if (_rf) { try { _rf.focus(); } catch {} }
const skel = document.getElementById('bootSkeleton');
if (skel) skel.hidden = true;
try { document.querySelectorAll('.drawer').forEach(d => { d.classList.remove('is-open'); d.setAttribute('inert', ''); }); } catch {}
try { const back = document.getElementById('drawerBackdrop'); if (back) back.classList.remove('is-open'); } catch {}
try { const shell = document.getElementById('modalShell'); if (shell) shell.classList.remove('is-open'); } catch {}
try { if (typeof DrawerController !== 'undefined' && DrawerController.destroy) DrawerController.destroy(); } catch (e) { console.warn('[fatal] drawer destroy', e); }
try { Announce.assertive('Fatal error: ' + (msg || 'unknown')); } catch {}
}
let _lastErrMsg = '', _lastErrTime = 0;
let _listenersInstalled = false;
let _visTimer = null;
let _boundError = null;
let _boundRejection = null;
let _boundOnline = null;
let _boundOffline = null;
let _boundVisibility = null;
function _removeListeners() {
if (_visTimer) { clearTimeout(_visTimer); _visTimer = null; window._cwtchErrorBoundaryVisTimer = null; }
if (_boundError) { try { window.removeEventListener('error', _boundError); } catch (e) { console.warn('[fatal] rm error', e); } _boundError = null; }
if (_boundRejection) { try { window.removeEventListener('unhandledrejection', _boundRejection); } catch (e) { console.warn('[fatal] rm rej', e); } _boundRejection = null; }
if (_boundOnline) { try { window.removeEventListener('online', _boundOnline); } catch (e) { console.warn('[fatal] rm online', e); } _boundOnline = null; }
if (_boundOffline) { try { window.removeEventListener('offline', _boundOffline); } catch (e) { console.warn('[fatal] rm offline', e); } _boundOffline = null; }
if (_boundVisibility) { try { document.removeEventListener('visibilitychange', _boundVisibility); } catch (e) { console.warn('[fatal] rm vis', e); } _boundVisibility = null; }
}
function uninstall() { _removeListeners(); _listenersInstalled = false; }
let _installRetries = 0;
function install() {
if (_listenersInstalled) return;
if (!document.body) {
if (_installRetries >= 50) { console.warn('[error-boundary] body never available, giving up'); return; }
_installRetries++;
setTimeout(install, 100);
return;
}
_installRetries = 0;
_listenersInstalled = true;
if (_boundError || _boundRejection) _removeListeners();
_boundError = e => {
if (!e || e.defaultPrevented) return;
const _msg0 = String(e.message || (e.error && e.error.message) || 'unknown').slice(0, 500);
if (/ResizeObserver loop/i.test(_msg0)) return;
if (/Script error\./i.test(_msg0)) return;
try { if (window._cwtchErrorCount == null) window._cwtchErrorCount = 0; window._cwtchErrorCount++; if (window._cwtchErrorCount > 200) { console.warn('[error-boundary] error count cap reached, muting'); return; } } catch (cntErr) { console.warn('[error-boundary] count', cntErr); }
  console.warn('[error]', e.error || e.message);
  const skel = document.getElementById('bootSkeleton');
  if (skel && !skel.hidden) { showFatal(e.error || e.message); return; }
  const msg = String(e.message || 'unknown').slice(0, 500);
if (!msg || msg === 'Script error.' || msg === 'ResizeObserver loop completed with undelivered notifications.') return;
const now = Date.now();
if (msg === _lastErrMsg && now - _lastErrTime < 5000) return;
_lastErrMsg = msg; _lastErrTime = now;
try { Telemetry.record('window.error', { msg: msg.slice(0, 200) }); }
catch (_te) { console.warn('[error-boundary] telemetry', _te); }
try {
const _raw = Prefs.get('errors.log');
const _list = Array.isArray(_raw) ? _raw.slice(-19) : [];
_list.push({ msg: String(msg).slice(0, 500), at: now, stack: (e.error && e.error.stack) ? String(e.error.stack).slice(0, 2000) : null });
while (_list.length > 20) _list.shift();
try { Prefs.set('errors.log', _list); } catch (_pe) { console.warn('[error-boundary] pref write failed', _pe); }
} catch (_logErr) { console.warn('[error-boundary] log failed', _logErr); }
try { if (typeof Toast !== 'undefined' && typeof Toast.error === 'function') Toast.error('Error: ' + msg); } catch (toastErr) { console.warn('[error-boundary] toast', toastErr); }
};
window.addEventListener('error', _boundError);
_boundRejection = e => {
const reason = e.reason;
const msg = String((reason && reason.message) ? reason.message : (reason || 'unknown')).slice(0, 500);
console.warn('[rejection]', reason);
if (!msg || msg === 'Script error.' || /ResizeObserver loop/i.test(msg)) return;
if (window._cwtchErrorCount != null && window._cwtchErrorCount > 200) { console.warn('[rejection] too many errors, muting'); return; }
const skel = document.getElementById('bootSkeleton');
if (skel && !skel.hidden) { showFatal(msg); return; }
const now = Date.now();
if (msg === _lastErrMsg && now - _lastErrTime < 5000) return;
_lastErrMsg = msg; _lastErrTime = now;
try {
const _raw = Prefs.get('errors.log');
const _list = Array.isArray(_raw) ? _raw.slice(-19) : [];
_list.push({ msg: String(msg).slice(0, 500), at: now, stack: (reason && reason.stack) ? String(reason.stack).slice(0, 2000) : null });
while (_list.length > 20) _list.shift();
Prefs.set('errors.log', _list);
} catch (e2) { console.warn('[rejection] log', e2); }
try { if (typeof Toast !== 'undefined' && typeof Toast.error === 'function') Toast.error('Error: ' + msg); } catch (e3) { console.warn('[rejection] toast', e3); }
};
window.addEventListener('unhandledrejection', _boundRejection);
const _rl = document.getElementById('fatalReload');
const _prevRlClick = _rl && _rl._fatalReloadClick;
if (_rl && _prevRlClick) { try { _rl.removeEventListener('click', _prevRlClick); } catch (e) { console.warn('[fatal] removeReload', e); } }
const _reloadHandler = () => { try { location.reload(); } catch (e) { console.warn('[fatal] reload', e); } };
if (_rl) { if (_rl._fatalReloadClick) { try { _rl.removeEventListener('click', _rl._fatalReloadClick); } catch (e) { console.warn('[fatal] rmReload', e); } } _rl.addEventListener('click', _reloadHandler); _rl._fatalReloadClick = _reloadHandler; }
const rs = document.getElementById('fatalReset');
if (rs && !rs._fatalResetBound) { rs._fatalResetBound = true; rs.addEventListener('click', async () => {
let ok = false;
try { ok = await Modal.confirm('Delete all settings and library data? This cannot be undone.', { danger: true, okLabel: 'Reset all' }); } catch (e) { console.warn('[error-boundary] confirm', e); return; }
if (!ok) return;
try { if (typeof Store.clearItems === 'function') await Store.clearItems(); } catch (e) { console.warn('[error-boundary] clearItems failed', e); }
try { if (typeof Store.clear === 'function') await Store.clear(); } catch (e) { console.warn('[error-boundary] clear failed', e); }
try { if (typeof Prefs.clearAll === 'function') Prefs.clearAll(); }
catch (e) {
console.warn('[error-boundary] Prefs.clearAll failed', e);
try { if (typeof Store.clearItems === 'function') await Store.clearItems(); } catch (e2) { console.warn('[error-boundary] clearItems fallback', e2); }
try { if (typeof Prefs.clear === 'function') Prefs.clear(); }
catch (e2) {
const _PREFIXES = ['cwtch.', 'studyOS.', 'sd.', 'cwtch-', 'cwtchlib.'];
Object.keys(localStorage).filter(k => _PREFIXES.some(p => k.startsWith(p))).forEach(k => { try { localStorage.removeItem(k); } catch {} });
}
}
location.reload();
}); }
const cp = document.getElementById('fatalCopy');
if (cp && !cp._fatalCopyBound) { cp._fatalCopyBound = true; cp.addEventListener('click', async () => {
const detail = document.getElementById('fatalErrorDetail');
const text = String(detail ? detail.textContent : '').slice(0, 100000);
try {
if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); }
else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { console.warn('[error-boundary] copy', e); } ta.remove(); }
cp.textContent = 'Copied';
setTimeout(() => { cp.textContent = 'Copy details'; }, 1600);
} catch (e) {
console.warn('[error-boundary] copy failed', e);
try {
const ta = document.createElement('textarea');
ta.value = text.slice(0, 50000);
ta.setAttribute('readonly', '');
ta.style.cssText = 'position:fixed;left:-9999px';
document.body.appendChild(ta);
ta.select();
try { document.execCommand('copy'); cp.textContent = 'Copied'; } catch (e2) { console.warn('[error-boundary] execCommand copy', e2); }
ta.remove();
} catch (e3) { console.warn('[error-boundary] copy fallback', e3); }
}
}); }
const off = document.getElementById('offlineBanner');
const _syncOffline = () => { if (!off || !off.isConnected) return; off.hidden = navigator.onLine !== false; };
_syncOffline();
_boundOnline = _syncOffline;
_boundOffline = _syncOffline;
try { window.addEventListener('online', _boundOnline); } catch (e) { console.warn('[error-boundary] online', e); }
try { window.addEventListener('offline', _boundOffline); } catch (e) { console.warn('[error-boundary] offline', e); }
if (window._cwtchErrorBoundaryVisTimer) { clearTimeout(window._cwtchErrorBoundaryVisTimer); window._cwtchErrorBoundaryVisTimer = null; }
_visTimer = null;
_boundVisibility = () => { if (!document.hidden) { clearTimeout(_visTimer); _visTimer = setTimeout(() => { _visTimer = null; window._cwtchErrorBoundaryVisTimer = null; _syncOffline(); }, 500); window._cwtchErrorBoundaryVisTimer = _visTimer; } };
document.addEventListener('visibilitychange', _boundVisibility);
}
return { install, uninstall, showFatal, hideFatal };
})();