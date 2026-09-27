// Idle timer wired to setting.privacy.sessionLock. Cancels on activity.
import { Prefs } from './prefs.js';

export const IdleLock = (() => {
  const EVENTS = ['pointerdown', 'keydown', 'mousemove', 'touchstart'];
  const MAX_MINUTES = 480;
  let _timer = null;
  let _cb = null;
  let _active = false;

  function _minutes() {
    let mins = 0;
    try { mins = Number(Prefs.get('setting.privacy.sessionLock')) || 0; }
    catch (e) { console.warn('[idle] read', e); }
    return Math.max(0, Math.min(MAX_MINUTES, mins));
  }

  function _restart() {
    if (_timer) { clearTimeout(_timer); _timer = null; }
    const mins = _minutes();
    if (!mins) return;
    _timer = setTimeout(() => {
      _timer = null;
      try { if (typeof _cb === 'function') _cb(); }
      catch (e) { console.warn('[idle] cb', e); }
    }, mins * 60 * 1000);
  }

  function _onActivity() {
    if (!_active) return;
    _restart();
  }

  function start(cb) {
    stop();
    _cb = (typeof cb === 'function') ? cb : null;
    _active = true;
    for (const ev of EVENTS) {
      try { window.addEventListener(ev, _onActivity, { passive: true }); }
      catch (e) { console.warn('[idle] bind', ev, e); }
    }
    _restart();
  }

  function stop() {
    _active = false;
    if (_timer) { clearTimeout(_timer); _timer = null; }
    for (const ev of EVENTS) {
      try { window.removeEventListener(ev, _onActivity); }
      catch (e) { console.warn('[idle] unbind', ev, e); }
    }
  }

  return { start, stop, restart: _restart, isActive: () => _active, MAX_MINUTES };
})();