// Tracks completeness flags for a backup export.
export const BackupManifest = (() => {
  function create(opts) {
    const options = (opts && typeof opts === 'object') ? opts : {};
    return {
      generatedAt: new Date().toISOString(),
      version: 1,
      itemCount: 0,
      assetCount: 0,
      prefsCount: 0,
      complete: { items: false, assets: false, prefs: false, all: false },
      truncated: { items: false, assets: false, prefs: false },
      hashes: { items: null, assets: null },
      notes: options.notes || null
    };
  }

  function finalize(manifest) {
    if (!manifest || typeof manifest !== 'object') return manifest;
    manifest.complete = {
      items: !manifest.truncated.items,
      assets: !manifest.truncated.assets,
      prefs: !manifest.truncated.prefs
    };
    manifest.complete.all = manifest.complete.items
      && manifest.complete.assets
      && manifest.complete.prefs;
    manifest.finalizedAt = new Date().toISOString();
    return manifest;
  }

  function verify(manifest) {
    if (!manifest || typeof manifest !== 'object') return { ok: false, reason: 'invalid' };
    if (!manifest.complete || typeof manifest.complete !== 'object') return { ok: false, reason: 'no-complete-flag' };
    if (manifest.complete.all !== true) return { ok: false, reason: 'incomplete' };
    return { ok: true };
  }

  return { create, finalize, verify };
})();