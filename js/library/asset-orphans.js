// Detects and prunes assets in storage that no library item references.
import { State } from '../core/state.js';
import { Store } from '../core/store.js';
import { Prefs } from '../core/prefs.js';
import { Telemetry } from '../core/telemetry.js';

export const AssetOrphans = (() => {
  const KEEP_PREFIXES = ['bg:', 'ver:', 'trash:'];

  async function list() {
    const items = State.get('libraryItems') || [];
    const used = new Set();
    for (const it of items) {
      if (it && typeof it.assetKey === 'string' && it.assetKey) used.add(it.assetKey);
    }
    try {
      const bgKey = Prefs.get('setting.bgAssetKey');
      if (typeof bgKey === 'string' && bgKey) used.add(bgKey);
    } catch (e) { console.warn('[orphans] bgKey', e); }

    let assets = [];
    try {
      if (typeof Store.listAssets === 'function') assets = await Store.listAssets();
    } catch (e) { console.warn('[orphans] list', e); }
    if (!Array.isArray(assets)) return [];

    return assets.filter(k => {
      if (typeof k !== 'string' || !k) return false;
      if (used.has(k)) return false;
      for (const p of KEEP_PREFIXES) if (k.startsWith(p)) return false;
      return true;
    });
  }

  async function prune() {
    const orphans = await list();
    if (!orphans.length) return { removed: 0 };
    let removed = 0;
    for (const k of orphans) {
      try {
        if (typeof Store.removeAsset === 'function') {
          await Store.removeAsset(k);
          removed++;
        }
      } catch (e) { console.warn('[orphans] remove', k, e); }
    }
    try { Telemetry.record('assets.pruned', { removed }); }
    catch (e) { console.warn('[orphans] telemetry', e); }
    return { removed };
  }

  return { list, prune, KEEP_PREFIXES };
})();