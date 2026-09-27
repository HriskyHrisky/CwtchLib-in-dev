// Persistent smart folders (saved filter definitions).
import { Prefs } from '../core/prefs.js';
import { Telemetry } from '../core/telemetry.js';

export const SmartFolders = (() => {
  const KEY = 'library.smartFolders';
  const MAX = 200;

  function list() {
    try {
      const raw = Prefs.get(KEY);
      if (!Array.isArray(raw)) return [];
      return raw
        .filter(f => f && typeof f === 'object'
          && typeof f.id === 'string' && f.id.length < 64
          && typeof f.query === 'string' && f.query.length < 500)
        .slice(0, MAX);
    } catch (e) { console.warn('[smart] list', e); return []; }
  }

  function save(folder) {
    if (!folder || typeof folder !== 'object' || typeof folder.query !== 'string') return false;
    const id = (typeof folder.id === 'string' && folder.id)
      ? folder.id.slice(0, 64)
      : ('sf-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    const rec = {
      id,
      name: String(folder.name || 'Untitled').slice(0, 100),
      query: String(folder.query).slice(0, 500),
      at: Date.now()
    };
    const next = list().filter(f => f.id !== id).concat([rec]).slice(-MAX);
    try { Prefs.set(KEY, next); }
    catch (e) { console.warn('[smart] save', e); return false; }
    try { Telemetry.record('smartFolder.save', { id }); } catch (e) { console.warn('[smart] telemetry', e); }
    return true;
  }

  function remove(id) {
    if (typeof id !== 'string' || !id) return false;
    const next = list().filter(f => f.id !== id);
    try { Prefs.set(KEY, next); return true; }
    catch (e) { console.warn('[smart] remove', e); return false; }
  }

  return { list, save, remove, MAX };
})();