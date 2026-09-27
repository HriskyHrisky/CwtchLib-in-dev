// Hard limits enforced before import operations allocate buffers.
export const ImportSize = (() => {
  const LIMITS = Object.freeze({
    jsonBytes: 200 * 1024 * 1024,
    zipBytes: 500 * 1024 * 1024,
    itemBytes: 128 * 1024 * 1024,
    itemCount: 500000,
    assetCount: 10000,
    assetBytes: 100 * 1024 * 1024
  });

  function check(key, value) {
    if (!Object.prototype.hasOwnProperty.call(LIMITS, key)) return { ok: true };
    const n = Number(value) || 0;
    if (n <= LIMITS[key]) return { ok: true };
    return { ok: false, limit: LIMITS[key], actual: n };
  }

  return { check, LIMITS };
})();