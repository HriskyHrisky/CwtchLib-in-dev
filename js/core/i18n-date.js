// Locale-aware date and time formatting.
export const I18nDate = (() => {
  let _locale = null;
  const _cache = new Map();

  function setLocale(loc) {
    _locale = loc ? String(loc).slice(0, 32) : null;
    _cache.clear();
  }

  function _fmt(opts) {
    const key = (_locale || '__default__') + '|' + JSON.stringify(opts || {});
    if (_cache.has(key)) return _cache.get(key);
    let f = null;
    try { f = new Intl.DateTimeFormat(_locale || undefined, opts || {}); }
    catch (e) { console.warn('[i18n] date init', e); }
    _cache.set(key, f);
    return f;
  }

  function format(ts, opts) {
    const tsN = Number(ts) || Date.now();
    const o = opts && typeof opts === 'object' ? opts : { dateStyle: 'medium' };
    const f = _fmt(o);
    if (f) {
      try { return f.format(new Date(tsN)); }
      catch (e) { console.warn('[i18n] date format', e); }
    }
    return new Date(tsN).toLocaleDateString();
  }

  function formatTime(ts, opts) {
    const tsN = Number(ts) || Date.now();
    const o = opts && typeof opts === 'object' ? opts : { timeStyle: 'short' };
    const f = _fmt(o);
    if (f) {
      try { return f.format(new Date(tsN)); }
      catch (e) { console.warn('[i18n] time format', e); }
    }
    return new Date(tsN).toLocaleTimeString();
  }

  return { setLocale, format, formatTime, getLocale: () => _locale };
})();