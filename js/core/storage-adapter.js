// Storage backend swap point. Native adapter wraps the existing Store.
import { Store } from './store.js';

export const StorageAdapter = (() => {
  const _adapters = new Map();
  let _backend = null;

  function register(name, adapter) {
    if (typeof name !== 'string' || !name || name.length > 64) return false;
    if (!adapter || typeof adapter !== 'object') return false;
    _adapters.set(name, adapter);
    return true;
  }

  function use(name) {
    const a = _adapters.get(name);
    if (!a) { console.warn('[storage] unknown adapter', String(name).slice(0, 64)); return false; }
    _backend = a;
    return true;
  }

  function current() { return _backend; }
  function list() { return Array.from(_adapters.keys()); }

  const _native = Object.freeze({
    name: 'indexeddb',
    get: (k) => Store.get(k),
    put: (v) => Store.put(v),
    remove: (k) => Store.remove(k),
    list: () => Store.list(),
    putAsset: (k, b) => Store.putAsset(k, b),
    getAsset: (k) => Store.getAsset(k),
    removeAsset: (k) => Store.removeAsset(k),
    listAssets: () => (typeof Store.listAssets === 'function' ? Store.listAssets() : Promise.resolve([]))
  });

  register('indexeddb', _native);
  _backend = _native;

  return { register, use, current, list };
})();