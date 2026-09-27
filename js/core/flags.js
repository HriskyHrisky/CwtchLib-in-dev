// Feature flags. Dev-controlled. Not shown in Settings UI.
import { Prefs } from './prefs.js';
import { Bus } from './bus.js';
import { EVENTS } from './events.js';

export const Flags = (() => {
  const DEFAULTS = Object.freeze({
    crdtMerge: false,
    workerOffload: false,
    trustedTypes: false,
    strictCsp: false,
    pluginApi: false,
    telemetryLocal: false
  });
  const _cache = new Map();

  function get(name) {
    if (typeof name !== 'string' || !name) return false;
    if (_cache.has(name)) return _cache.get(name);
    let v = Object.prototype.hasOwnProperty.call(DEFAULTS, name) ? DEFAULTS[name] : false;
    try {
      const raw = Prefs.get('flag.' + name);
      if (typeof raw === 'boolean') v = raw;
    } catch (e) { console.warn('[flags] read', name, e); }
    _cache.set(name, v);
    return v;
  }

  function set(name, on) {
    if (typeof name !== 'string' || !name || name.length > 64) return;
    const v = !!on;
    try { Prefs.set('flag.' + name, v); }
    catch (e) { console.warn('[flags] write', name, e); }
    _cache.set(name, v);
    try { Bus.emit(EVENTS.FLAGS_CHANGED, { name, value: v }); }
    catch (e) { console.warn('[flags] emit', e); }
  }

  function all() {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) out[k] = get(k);
    return out;
  }

  function reset() { _cache.clear(); }

  return { get, set, all, reset, DEFAULTS, size: () => _cache.size };
})();