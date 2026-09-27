// RFC 4180 CSV escaping plus formula-injection defence.
export const CsvEscape = (() => {
  const DANGEROUS = /^[=+\-@\t\r]/;

  function cell(v) {
    let s = String(v == null ? '' : v)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
    if (DANGEROUS.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function row(cells) {
    if (!Array.isArray(cells)) return '';
    return cells.map(cell).join(',');
  }

  function table(rows) {
    if (!Array.isArray(rows)) return '';
    return rows.map(row).join('\r\n');
  }

  return { cell, row, table, DANGEROUS };
})();