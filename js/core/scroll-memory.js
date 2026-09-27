// Scroll position per document. LRU-bounded memory cache + Prefs persistence.
import { Prefs } from './prefs.js';

export const ScrollMemory = (() => {
  const MAX = 300;
  const _mem = new Map();

  function remember(id, y) {
    if (typeof id !== 'string' || !id) return;
    const val = Math.max(0, Math.round(Number(y) || 0));
    if (_mem.has(id)) _mem.delete(id);
    _mem.set(id, val);
    while (_mem.size > MAX) {
      const first = _mem.keys().next().value;
      if (first === undefined) break;
      _mem.delete(first);
    }
    try { Prefs.set('scroll.' + id, val); }
    catch (e) { console.warn('[scroll-mem] write', e); }
  }

  function recall(id) {
    if (typeof id !== 'string' || !id) return null;
    if (_mem.has(id)) {
      const v = _mem.get(id);
      _mem.delete(id);
      _mem.set(id, v);
      return v;
    }
    try {
      const v = Number(Prefs.get('scroll.' + id));
      if (Number.isFinite(v) && v >= 0) {
        _mem.set(id, v);
        return v;
      }
    } catch (e) { console.warn('[scroll-mem] read', e); }
    return null;
  }

  function forget(id) {
    if (typeof id !== 'string' || !id) return;
    _mem.delete(id);
    try { Prefs.remove('scroll.' + id); }
    catch (e) { console.warn('[scroll-mem] forget', e); }
  }

  return { remember, recall, forget, size: () => _mem.size, MAX };
})();