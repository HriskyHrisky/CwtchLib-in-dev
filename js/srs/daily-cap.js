// Daily new-card and review caps. Resets at local midnight.
import { Prefs } from '../core/prefs.js';

export const DailyCap = (() => {
  const KEY = 'srs.daily';

  function _today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function getCounters() {
    try {
      const rec = Prefs.get(KEY);
      if (rec && typeof rec === 'object' && rec.day === _today()) {
        return {
          day: rec.day,
          newSeen: Math.max(0, Number(rec.newSeen) || 0),
          reviews: Math.max(0, Number(rec.reviews) || 0)
        };
      }
    } catch (e) { console.warn('[cap] read', e); }
    return { day: _today(), newSeen: 0, reviews: 0 };
  }

  function incr(field, n) {
    if (field !== 'newSeen' && field !== 'reviews') return getCounters();
    const rec = getCounters();
    rec[field] = (Number(rec[field]) || 0) + Math.max(0, Number(n) || 1);
    try { Prefs.set(KEY, rec); }
    catch (e) { console.warn('[cap] write', e); }
    return rec;
  }

  function remaining(field, limit) {
    const rec = getCounters();
    const used = Number(rec[field]) || 0;
    const max = Math.max(0, Number(limit) || 0);
    return Math.max(0, max - used);
  }

  function reset() {
    try { Prefs.set(KEY, { day: _today(), newSeen: 0, reviews: 0 }); }
    catch (e) { console.warn('[cap] reset', e); }
  }

  return { getCounters, incr, remaining, reset };
})();