// Pre-unzip validation for attacker-controlled ZIP entries.
export const ZipIntegrity = (() => {
  function check(files) {
    if (!files || typeof files !== 'object') return { ok: false, reason: 'missing' };
    const names = Object.keys(files);
    if (!names.length) return { ok: false, reason: 'empty' };
    for (const n of names) {
      if (typeof n !== 'string' || n.length > 500) {
        return { ok: false, reason: 'bad-name', name: String(n).slice(0, 100) };
      }
      if (n.indexOf('\u0000') >= 0) return { ok: false, reason: 'null-byte' };
      const segs = n.split('/');
      for (const s of segs) {
        if (s === '..') return { ok: false, reason: 'path-traversal', name: n };
      }
    }
    return { ok: true, count: names.length };
  }

  return { check };
})();