// Bulk tag operations with undo journal.
import { State } from '../core/state.js';
import { Store } from '../core/store.js';
import { Bus } from '../core/bus.js';
import { EVENTS } from '../core/events.js';
import { Undo } from '../editor/undo.js';
import { Telemetry } from '../core/telemetry.js';

export const BulkOps = (() => {
  const MAX_ITEMS = 5000;
  const MAX_TAGS = 200;

  async function _applyToTag(ids, tag, add) {
    const idSet = new Set(ids.slice(0, MAX_ITEMS));
    const items = State.get('libraryItems') || [];
    const backups = [];
    let ok = 0;

    for (const it of items) {
      if (!it || typeof it.id !== 'string' || !idSet.has(it.id)) continue;
      const cur = Array.isArray(it.tags) ? it.tags : [];
      const has = cur.indexOf(tag) >= 0;
      if (add && has) continue;
      if (!add && !has) continue;
      backups.push(Object.assign({}, it));
      const nextTags = add
        ? Array.from(new Set(cur.concat([tag]))).slice(0, MAX_TAGS)
        : cur.filter(t => t !== tag).slice(0, MAX_TAGS);
      const updated = Object.assign({}, it, { tags: nextTags, lastModified: Date.now() });
      try { await Store.put(updated); ok++; }
      catch (e) { console.warn('[bulk] store', it.id, e); }
    }

    if (ok) {
      State.set('libraryItems', (State.get('libraryItems') || []).map(x => {
        if (!x || !idSet.has(x.id)) return x;
        const cur = Array.isArray(x.tags) ? x.tags : [];
        const nextTags = add
          ? Array.from(new Set(cur.concat([tag]))).slice(0, MAX_TAGS)
          : cur.filter(t => t !== tag).slice(0, MAX_TAGS);
        return Object.assign({}, x, { tags: nextTags, lastModified: Date.now() });
      }));
      Bus.emit(EVENTS.LIBRARY_CHANGED);
    }

    try { Telemetry.record(add ? 'bulk.addTag' : 'bulk.removeTag', { n: ok, tag: String(tag).slice(0, 80) }); }
    catch (e) { console.warn('[bulk] telemetry', e); }

    if (backups.length) {
      const snapshot = backups.slice();
      Undo.push({
        label: (add ? 'Tag ' : 'Untag ') + ok + ' items',
        undo: async () => {
          for (const b of snapshot) {
            try { await Store.put(b); }
            catch (e) { console.warn('[bulk] undo store', e); }
          }
          State.set('libraryItems', (State.get('libraryItems') || []).map(x => {
            const b = snapshot.find(s => s.id === x.id);
            return b ? b : x;
          }));
          Bus.emit(EVENTS.LIBRARY_CHANGED);
        }
      });
    }
    return { ok };
  }

  async function addTag(ids, tag) {
    if (!Array.isArray(ids) || !ids.length) return { ok: 0 };
    if (typeof tag !== 'string' || !tag || tag.length > MAX_TAGS) return { ok: 0 };
    return _applyToTag(ids, tag, true);
  }

  async function removeTag(ids, tag) {
    if (!Array.isArray(ids) || !ids.length) return { ok: 0 };
    if (typeof tag !== 'string' || !tag || tag.length > MAX_TAGS) return { ok: 0 };
    return _applyToTag(ids, tag, false);
  }

  return { addTag, removeTag, MAX_ITEMS, MAX_TAGS };
})();