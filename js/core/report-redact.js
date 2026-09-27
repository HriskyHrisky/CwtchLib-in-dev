// Removes sensitive values from diagnostic exports before write.
export const ReportRedact = (() => {
  const SENSITIVE = /(?:password|apikey|secret|token|passphrase|credential|privatekey|api[_-]?key|endpoint|serverurl|server_url)/i;

  function scrub(obj, depth) {
    const d = Number.isFinite(depth) ? depth : 0;
    if (d > 6) return '[deep]';
    if (obj == null) return obj;
    if (typeof obj === 'string') {
      return obj.length > 2000 ? obj.slice(0, 2000) + '…' : obj;
    }
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.slice(0, 200).map(x => scrub(x, d + 1));
    const out = {};
    for (const k of Object.keys(obj)) {
      out[k] = SENSITIVE.test(k) ? '[redacted]' : scrub(obj[k], d + 1);
    }
    return out;
  }

  return { scrub, SENSITIVE };
})();