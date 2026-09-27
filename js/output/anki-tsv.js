// Anki-compatible TSV writer with BOM + header line.
export const AnkiTsv = (() => {
  const HEADER = ['#separator:tab', '#html:true', 'Front\tBack\tTags\tDeck'];
  const MAX_CARDS = 50000;

  function escape(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\n/g, '<br>');
  }

  function render(cards) {
    const lines = HEADER.slice();
    if (!Array.isArray(cards)) return '\ufeff' + lines.join('\r\n');
    for (const c of cards.slice(0, MAX_CARDS)) {
      if (!c || typeof c !== 'object') continue;
      const deck = (String(c.path || '').split('/')[0]) || 'Default';
      lines.push([
        escape(c.front || ''),
        escape(c.back || ''),
        escape(Array.isArray(c.tags) ? c.tags.join(' ') : ''),
        escape(deck)
      ].join('\t'));
    }
    return '\ufeff' + lines.join('\r\n');
  }

  return { render, escape, HEADER, MAX_CARDS };
})();