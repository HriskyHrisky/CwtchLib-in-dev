// Pluralisation via Intl.PluralRules.
export const I18nPlural = (() => {
  let _locale = null;
  const _cache = new Map();

  function setLocale(loc) {
    _locale = loc ? String(loc).slice(0, 32) : null;
    _cache.clear();
  }

  function _rules() {
    const key = _locale || '__default__';
    if (_cache.has(key)) return _cache.get(key);
    let pr = null;
    try { pr = new Intl.PluralRules(_locale || undefined); }
    catch (e) { console.warn('[i18n] plural init', e); }
    _cache.set(key, pr);
    return pr;
  }

  function select(n, locale) {
    if (locale && locale !== _locale) setLocale(locale);
    const pr = _rules();
    if (pr) {
      try { return pr.select(Number(n) || 0); }
      catch (e) { console.warn('[i18n] select', e); }
    }
    return Number(n) === 1 ? 'one' : 'other';
  }

  function format(forms, n, locale) {
    if (!forms || typeof forms !== 'object') return String(n);
    const cat = select(n, locale);
    return forms[cat] || forms.other || forms.one || String(n);
  }

  return { select, format, setLocale, getLocale: () => _locale };
})();