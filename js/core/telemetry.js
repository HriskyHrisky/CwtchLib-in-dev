// Local-only event ring buffer. Never transmitted.
import { Prefs } from './prefs.js';

export const Telemetry = (() => {
  const CAP = 500;
  const KEY = 'telemetry.buffer';
  const ENABLED_KEY = 'telemetry.local';
  let _enabled = false;

  try { _enabled = Prefs.get(ENABLED_KEY) === true; }
  catch (e) { console.warn('[telemetry] init', e); }

  function _buffer() {
    try {
      const raw = Prefs.get(KEY);
      return Array.isArray(raw) ? raw : [];
    } catch (e) { console.warn('[telemetry] read', e); return []; }
  }

  function record(name, meta) {
    if (!_enabled) return;
    if (typeof name !== 'string' || !name || name.length > 80) return;
    try {
      const buf = _buffer();
      let safeMeta = null;
      if (meta && typeof meta === 'object') {
        try { safeMeta = JSON.parse(JSON.stringify(meta)); }
        catch { safeMeta = null; }
      }
      buf.push({ name: name.slice(0, 80), meta: safeMeta, at: Date.now() });
      while (buf.length > CAP) buf.shift();
      Prefs.set(KEY, buf);
    } catch (e) { console.warn('[telemetry] record', e); }
  }

  function snapshot() { return _buffer().slice(); }

  function clear() {
    try { Prefs.remove(KEY); }
    catch (e) { console.warn('[telemetry] clear', e); }
  }

  function enable(on) {
    _enabled = !!on;
    try { Prefs.set(ENABLED_KEY, _enabled); }
    catch (e) { console.warn('[telemetry] persist', e); }
  }

  function isEnabled() { return _enabled; }

  function exportJson() {
    try { return JSON.stringify(_buffer()); }
    catch (e) { console.warn('[telemetry] export', e); return '[]'; }
  }

  return { record, snapshot, clear, enable, isEnabled, export: exportJson, CAP };
})();