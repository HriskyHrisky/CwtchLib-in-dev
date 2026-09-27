// Resolves tag aliases and hierarchy traversal. Cycle-safe.
import { Prefs } from '../core/prefs.js';

export const TagAliases = (() => {
  const ALIAS_KEY = 'library.tagAliases';
  const HIER_KEY = 'library.tagHierarchy';
  const MAX_DEPTH = 20;

  function _aliasMap() {
    try {
      const raw = Prefs.get(ALIAS_KEY);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      const out = {};
      for (const k of Object.keys(raw)) {
        if (typeof k !== 'string' || k.length > 200) continue;
        const v = raw[k];
        if (typeof v === 'string' && v.length <= 200) out[k] = v;
      }
      return out;
    } catch (e) { console.warn('[alias] read', e); return {}; }
  }

  function resolve(tag) {
    if (typeof tag !== 'string' || !tag) return tag;
    const m = _aliasMap();
    let cur = tag;
    const seen = new Set();
    let _guard = 0;
    while (m[cur] && !seen.has(cur) && _guard++ < MAX_DEPTH) {
      seen.add(cur);
      cur = m[cur];
    }
    return cur;
  }

  function hierarchy() {
    try {
      const raw = Prefs.get(HIER_KEY);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      const out = {};
      for (const k of Object.keys(raw)) {
        if (typeof k !== 'string' || k.length > 200) continue;
        const v = raw[k];
        if (typeof v === 'string' && v.length <= 200) out[k] = v;
      }
      return out;
    } catch (e) { console.warn('[hier] read', e); return {}; }
  }

  function ancestors(tag) {
    if (typeof tag !== 'string' || !tag) return [];
    const h = hierarchy();
    const out = [];
    let cur = tag;
    const seen = new Set([tag]);
    let _guard = 0;
    while (h[cur] && !seen.has(h[cur]) && _guard++ < MAX_DEPTH) {
      seen.add(h[cur]);
      out.push(h[cur]);
      cur = h[cur];
    }
    return out;
  }

  function descendants(tag) {
    if (typeof tag !== 'string' || !tag) return [];
    const h = hierarchy();
    const out = [];
    for (const k of Object.keys(h)) if (h[k] === tag) out.push(k);
    return out;
  }

  return { resolve, ancestors, descendants, hierarchy, MAX_DEPTH };
})();