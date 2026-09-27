// Signature over a list of {name,size} entries. SHA-256 with FNV fallback.
export const ManifestFingerprint = (() => {
  function _fnv1a(str) {
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return 'fnv1a-' + h.toString(16).padStart(8, '0');
  }

  async function ofList(list) {
    if (!Array.isArray(list)) return null;
    let acc = '';
    for (const entry of list.slice(0, 10000)) {
      if (!entry || typeof entry !== 'object') continue;
      const name = String(entry.name || '').slice(0, 500);
      const size = Number(entry.size) || 0;
      acc += name + ':' + size + '\n';
    }
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle
          && typeof TextEncoder !== 'undefined') {
        const buf = new TextEncoder().encode(acc);
        const h = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(h))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    } catch (e) { console.warn('[manifest] sha256', e); }
    return _fnv1a(acc);
  }

  return { ofList };
})();