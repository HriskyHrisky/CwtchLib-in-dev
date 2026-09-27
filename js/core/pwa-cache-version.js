// Cache-name versioning helper for the service worker update flow.
import { Prefs } from './prefs.js';

export const PwaCacheVersion = (() => {
  const KEY = 'pwa.cacheVersion';
  const DEFAULT = 'v1';

  function current() {
    try {
      const v = Prefs.get(KEY);
      if (typeof v === 'string' && /^v\d{1,6}$/.test(v)) return v;
    } catch (e) { console.warn('[cache] read', e); }
    return DEFAULT;
  }

  function bump() {
    const cur = current();
    const m = /^v(\d+)$/.exec(cur);
    const next = m ? 'v' + (Number(m[1]) + 1) : 'v2';
    try { Prefs.set(KEY, next); }
    catch (e) { console.warn('[cache] bump', e); }
    return next;
  }

  return { current, bump, KEY, DEFAULT };
})();