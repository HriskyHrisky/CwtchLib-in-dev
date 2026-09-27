// User-consent records. Distinct from Features (dev flags) and Settings.
import { Prefs } from './prefs.js';
import { Bus } from './bus.js';
import { EVENTS } from './events.js';

export const Permissions = (() => {
  const _cache = new Map();

  function has(name) {
    if (typeof name !== 'string' || !name || name.length > 100) return false;
    if (_cache.has(name)) return _cache.get(name);
    let granted = false;
    try { granted = Prefs.get('perms.' + name) === true; }
    catch (e) { console.warn('[perms] read', name, e); }
    _cache.set(name, granted);
    return granted;
  }

  function request(name, opts) {
    if (typeof name !== 'string' || !name || name.length > 100) return Promise.resolve(false);
    if (has(name)) return Promise.resolve(true);
    if (opts && typeof opts.check === 'function') {
      try { if (!opts.check()) return Promise.resolve(false); }
      catch (e) { console.warn('[perms] check', name, e); return Promise.resolve(false); }
    }
    try { Prefs.set('perms.' + name, true); }
    catch (e) { console.warn('[perms] grant', name, e); return Promise.resolve(false); }
    _cache.set(name, true);
    try { Bus.emit(EVENTS.PERMISSION_GRANTED, { name }); }
    catch (e) { console.warn('[perms] emit', e); }
    return Promise.resolve(true);
  }

  function revoke(name) {
    if (typeof name !== 'string' || !name) return;
    // Prefer real removal; fall back to writing false so read returns false.
    try {
      if (Prefs && typeof Prefs.remove === 'function') Prefs.remove('perms.' + name);
      else Prefs.set('perms.' + name, false);
    } catch (e) { console.warn('[perms] revoke', name, e); }
    _cache.delete(name);
  }

  function list() {
    return Array.from(_cache.entries()).map(([name, ok]) => ({ name, ok }));
  }

  function reset() { _cache.clear(); }

  return { has, request, revoke, list, reset };
})();