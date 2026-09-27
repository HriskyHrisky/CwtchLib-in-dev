// Reading progress per document, persisted to Prefs.
import { Prefs } from './prefs.js';

export const ReadingProgressStore = (() => {
  const MIN = 0, MAX = 100;

  function save(id, pct) {
    if (typeof id !== 'string' || !id) return false;
    const v = Math.max(MIN, Math.min(MAX, Math.round(Number(pct) || 0)));
    try { Prefs.set('read.' + id, v); return true; }
    catch (e) { console.warn('[read] save', e); return false; }
  }

  function load(id) {
    if (typeof id !== 'string' || !id) return null;
    try {
      const v = Prefs.get('read.' + id);
      if (!Number.isFinite(v)) return null;
      return Math.max(MIN, Math.min(MAX, Math.round(Number(v))));
    } catch (e) { console.warn('[read] load', e); return null; }
  }

  function clear(id) {
    if (typeof id !== 'string' || !id) return;
    try { Prefs.remove('read.' + id); }
    catch (e) { console.warn('[read] clear', e); }
  }

  return { save, load, clear, MIN, MAX };
})();