
import { Config } from '../core/config.js';
import { escapeHtml } from '../core/escape.js';

export const Markdown = (() => {
const esc = escapeHtml;
const _mathCache = new Map();
const _MATH_CACHE_MAX = 500;
function _renderMath(m) {
if (m == null) return '';
const _str = String(m);
if (_str.length > 5000) { console.warn('[math] expression too large, truncating'); return '<code>' + esc(_str.slice(0, 5000)) + '</code>'; }
if (_str.indexOf('$') >= 0) { console.warn('[math] nested $ in expression'); }
const _key = _str;
if (_mathCache.has(_key)) { const _v = _mathCache.get(_key); _mathCache.delete(_key); _mathCache.set(_key, _v); return _v; }
if (_mathCache.size >= _MATH_CACHE_MAX) {
let _i = 0;
const _drop = Math.max(1, Math.floor(_MATH_CACHE_MAX / 5));
for (const _k of _mathCache.keys()) { if (_i++ >= _drop) break; _mathCache.delete(_k); }
}
let r;
try {
const _katex = (typeof window !== 'undefined' && window.katex) ? window.katex : (typeof katex !== 'undefined' ? katex : null);
r = (_katex && typeof _katex.renderToString === 'function')
? _katex.renderToString(_key, { throwOnError: false, output: 'html', strict: 'ignore', trust: false, maxExpand: 1000 })
: '<span class="math-inline">' + esc(_key) + '</span>';
} catch (e) {
console.warn('[math] render failed', e);
r = '<code>' + esc(_key) + '</code>';
}
_mathCache.set(_key, r);
return r;
}
function inline(s) {
if (s == null) return '';
if (typeof s !== 'string') s = String(s);
const _codeStore = [];
s = s.replace(/`([^`\n]+?)`/g, (_, c) => { const i = _codeStore.length; _codeStore.push(c); return '\u0000C' + i + '\u0000'; });
s = s
.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
.replace(/(^|[^=])==([^=\n]+?)==(?!=)/g, '$1<mark>$2</mark>')
.replace(/(^|\s)__([^_\n]+?)__(?=\s|$|[.,;:!?])/g, '$1<u>$2</u>')
.replace(/\[\^([^\]\n]{1,200})\]/g, (_, k) => { const _safeK = encodeURIComponent(String(k).slice(0, 200)); return `<sup class="footnote-ref"><a href="#fn-${_safeK}" id="fnref-${_safeK}">[${esc(k)}]</a></sup>`; })
.replace(/\{\{c(\d+)::((?:[^}]|\}(?!\}\})){1,5000}?)(?:::\s*((?:[^}]|\}(?!\}\})){1,5000}?))?\}\}/g, (_, n, t, h) => { const _safeN = String(n).replace(/[^0-9]/g, '').slice(0, 6); return `<span class="cloze" data-cloze="${_safeN}">${h ? esc(h) : '[' + esc(t) + ']'}</span>`; })
.replace(/\[\[([^\]\n]{1,200})]]/g, (_, t) => { const _enc = encodeURIComponent(String(t).slice(0, 200)); return `<a href="#search-${_enc}" class="wikilink" data-wikilink="${_enc}">${esc(t)}</a>`; })
.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
.replace(_mathRe(), (_, pre, m) => pre + _renderMath(m))
.replace(/!\[([^\]]{0,500})\]\(([^()]{0,2000}(?:\([^()]*\)[^()]*){0,5})\)/g, (_, a, u) => {
const _rawUrl = String(u || '').trim().slice(0, 2000);
const _safeScheme = /^(https?:|asset:|\.\/|\.\.\/|\/)/i.test(_rawUrl);
if (!_safeScheme) return '<span class="img-broken" role="img" aria-label="' + esc(String(a).slice(0, 500)) + ' — ' + esc(_rawUrl) + '">[image: ' + esc(String(a).slice(0, 500)) + ' → ' + esc(_rawUrl) + ']</span>';
const safeUrl = esc(_rawUrl).replace(/"/g, '%22');
return '<img alt="' + esc(String(a).slice(0, 500)).replace(/"/g, '&quot;') + '" src="' + safeUrl + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
})
.replace(/\[([^\]\n]{1,500})\]\(([^()]{0,2000}(?:\([^()]*\)[^()]*){0,5})\)/g, (m, text, url) => {
const _rawUrl = String(url || '').trim();
if (/^\s*(javascript|data|vbscript):/i.test(_rawUrl)) return esc(text);
const safe = /^(https?:|mailto:|#|\/|\.)/i.test(_rawUrl) ? _rawUrl.replace(/"/g, '%22') : '#';
return `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${esc(text)}</a>`;
})
.replace(/(^|[^\w])((?:https?:)?\/\/[^\s<>"']+?)([.,;:!?)\]]*)(?=\s|$)/g, (_, a, u, trail) => { const _abs = /^\/\//.test(u) ? (location.protocol + u) : u; const _safeHref = String(_abs).replace(/"/g, '%22'); return `${a}<a href="${esc(_safeHref)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${esc(u)}</a>${trail}`; })
.replace(/\u0000C(\d+)\u0000/g, (_, i) => { const c = _codeStore[Number(i)]; return c == null ? '' : '<code>' + esc(c) + '</code>'; });
return s;
}
let _cachedCalloutRe = null;
let _cachedCalloutReKinds = '';
function _buildCalloutRe() {
let _kinds = 'NOTE|TIP|WARNING|IMPORTANT|DANGER|INFO';
try {
if (Config && Config.callouts && typeof Config.callouts === 'object') {
const _keys = Object.keys(Config.callouts).filter(k => /^[A-Z][A-Z0-9_]{0,20}$/i.test(k));
if (_keys.length) _kinds = _keys.join('|');
}
} catch (e) { console.warn('[markdown] callout kinds', e); }
  if (_cachedCalloutRe && _cachedCalloutReKinds === _kinds) return _cachedCalloutRe;
  try {
_cachedCalloutRe = new RegExp('^\\s*>\\s*\\[!(' + _kinds + ')\\](?![A-Za-z0-9_])[ \\t]*(.*)$', 'i');
} catch (e) { console.warn('[markdown] callout regex failed', e); _cachedCalloutRe = new RegExp('^\\s*>\\s*\\[!(NOTE|TIP|WARNING|IMPORTANT|DANGER|INFO)\\](?![A-Za-z0-9_])[ \\t]*(.*)$', 'i'); }
  _cachedCalloutReKinds = _kinds;
  return _cachedCalloutRe;
}
const _MATH_RE = /(^|[^\\])\$([^$\n]{1,5000}?)\$(?!\d)/gm;
function _mathRe() {
_MATH_RE.lastIndex = 0;
return _MATH_RE;
}
function render(src) {
if (src == null) return '';
if (typeof src !== 'string') src = String(src);
if (!src) return '';
if (src.length > 5 * 1024 * 1024) {
console.warn('[markdown] source too large');
try { if (window.Cwtch && window.Cwtch.Toast) window.Cwtch.Toast.show('Document truncated to 5MB for rendering'); } catch (e) {}
src = src.slice(0, 5 * 1024 * 1024);
}
if (src.indexOf('\u0000') >= 0) src = src.replace(/\u0000/g, '');
if (!src.trim()) return '';
src = src.replace(/[\uE000\uE001]/g, '');
const _fnDefs = [];
src = src.replace(/^\[\^([^\]]+)\]:[ \t]*([\s\S]*?)(?=\n\[\^|\n(?![ \t])|$)/gm, (_, k, t) => { _fnDefs.push({ k, t: String(t).replace(/\s+$/, '') }); return ''; });
const _lvlStore = [];
const _LVL_CAP = 2000;
const _src = src.replace(/\r\n?/g, '\n').replace(/\r/g, '\n').replace(/<span\s+data-lvl="(\d{1,3})"\s*>((?:[^<]|<(?!\/span>))*?)<\/span>/g, (_, n, inner) => {
const _i = _lvlStore.length;
if (_i >= _LVL_CAP) { console.warn('[markdown] lvl cap reached'); return inner == null ? '' : inline(esc(String(inner).slice(0, 5000))); }
_lvlStore.push({ n, inner });
return '\uE000LVL' + _i + '\uE001';
});
const lines = _src.split('\n');
if (lines.length > 500000) { console.warn('[markdown] too many lines'); return '<pre>Document too large to render</pre>'; }
const out = [];
let inCode = false, listType = null, inTable = false;
let _bqDepth = 0;
let _pendingTableRow = null;
let _pendingTableLine = null;
const closeList = () => { if (listType) { out.push('</' + listType + '>'); listType = null; } };
const closeTable = () => { if (inTable) { out.push('</tbody></table>'); inTable = false; } };
let paraBuf = [];
const flushPara = () => { if (paraBuf.length) { out.push('<p>' + inline(esc(paraBuf.join(' '))) + '</p>'); paraBuf = []; } };
const flushQuote = () => { while (_bqDepth > 0) { out.push('</blockquote>'); _bqDepth--; } };
const flushAll = () => { flushPara(); flushQuote(); closeList(); closeTable(); };
for (const raw of lines) {
const line = raw;
if (inCode) {
if (/^(?:```|~~~)\s*$/.test(line)) { flushAll(); inCode = false; if (out.length && out[out.length - 1].endsWith('\n')) out[out.length - 1] = out[out.length - 1].slice(0, -1); out.push('</code></pre>'); continue; }
out.push(esc(line));
if (line !== '') out[out.length - 1] += '\n';
continue;
}
const _fenceM = /^(?:```|~~~)\s*([a-z0-9_+\-]*)\s*(\{.*\})?\s*$/i.exec(line);
if (_fenceM) {
const _lang = String(_fenceM[1] || '').replace(/[^a-z0-9_+\-]/gi, '').slice(0, 32);
flushAll();
inCode = true;
out.push('<pre><code class="language-' + esc(_lang) + '"' + (_lang === 'mermaid' ? ' data-mermaid' : '') + '>');
continue;
}
if (_pendingTableRow && !/^\s*\|.*\|\s*$/.test(line)) {
const _cells = _pendingTableRow;
if (_cells.length >= 1) {
flushPara();
out.push('<table><thead><tr>' + _cells.map(c => '<th>' + inline(esc(c)) + '</th>').join('') + '</tr></thead><tbody></tbody></table>');
} else {
paraBuf.push(_pendingTableLine);
}
_pendingTableRow = null; _pendingTableLine = null;
}
const h = line.match(/^(#{1,6})[\s\u00a0]+(.*?)\s*$/);
if (h) { flushAll(); const _ln = Math.min(6, h[1].length); out.push(`<h${_ln}>${inline(esc(h[2]))}</h${_ln}>`); continue; }
const _callout = line.match(_buildCalloutRe());
if (_callout) {
flushAll();
const _kind = String(_callout[1] || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 32) || 'NOTE';
const _icon = (Config.callouts && Config.callouts[_kind] && Config.callouts[_kind].icon) || '';
const _body = _callout[2] == null ? '' : String(_callout[2]).slice(0, 10000);
const _safeKind = /^[A-Z][A-Z0-9_]*$/.test(_kind) ? _kind : 'NOTE';
const _safeIcon = String(_icon).replace(/[<>"'`]/g, '').slice(0, 8);
out.push('<aside class="callout callout--' + _safeKind.toLowerCase() + '">' + (_safeIcon ? '<span class="callout__icon" aria-hidden="true">' + esc(_safeIcon) + '</span>' : '') + '<strong>' + esc(_safeKind) + '</strong>' + (_body ? ' ' + inline(esc(_body)) : '') + '</aside>');
continue;
}
if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) { flushAll(); out.push('<hr>'); continue; }
const ul = line.match(/^(\s{0,12})[-*+]\s+(.*)$/);
if (ul) {
flushPara(); flushQuote();
if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
const depth = Math.min(6, Math.floor(ul[1].length / 2));
const _task = ul[2].match(/^\[([ xX])\]\s*(.*)$/);
const _li = _task ? '<input type="checkbox" disabled readonly aria-label="' + (/[xX]/.test(_task[1]) ? 'Completed task' : 'Incomplete task') + '"' + (/[xX]/.test(_task[1]) ? ' checked' : '') + '> ' + inline(esc(_task[2])) : inline(esc(ul[2]));
out.push('<li' + (depth ? ' data-depth="' + depth + '"' : '') + '>' + _li + '</li>');
continue;
}
const ol = line.match(/^(\s{0,12})\d+[.)][ \t]+(.*)$/);
if (/^\s*\|.*\|\s*$/.test(line) && line.split('|').length >= 3 && !inCode) {
const cells = line.split('|').slice(1, -1).map(c => c.trim());
if (cells.length < 1) { closeTable(); paraBuf.push(line); continue; }
const _isSep = cells.length > 0 && cells.every(c => /^[-: ]+$/.test(c)) && cells.some(c => /^-/.test(c));
if (_isSep) {
flushPara(); closeList();
const _headerCells = _pendingTableRow;
_pendingTableRow = null; _pendingTableLine = null;
if (!inTable) {
out.push('<table><thead>');
if (_headerCells) out.push('<tr>' + _headerCells.map(c => '<th>' + inline(esc(c)) + '</th>').join('') + '</tr>');
out.push('</thead><tbody>');
inTable = true;
}
continue;
}
if (inTable) { out.push('<tr>' + cells.map(c => '<td>' + inline(esc(c)) + '</td>').join('') + '</tr>'); continue; }
if (_pendingTableRow) paraBuf.push(_pendingTableLine);
_pendingTableRow = cells;
_pendingTableLine = line;
continue;
}
if (ol) { flushPara(); flushQuote(); if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; } const depth = Math.min(6, Math.floor(ol[1].length / 2)); out.push('<li' + (depth ? ' data-depth="' + depth + '"' : '') + '>' + inline(esc(ol[2])) + '</li>'); continue; }
const _bq = line.match(/^(\s{0,12})(>+)\s*(.*)$/);
if (_bq) {
flushPara(); closeList();
const _target = Math.min(20, _bq[2].length);
while (_bqDepth > _target) { out.push('</blockquote>'); _bqDepth--; }
while (_bqDepth < _target) { out.push('<blockquote>'); _bqDepth++; }
out.push('<p>' + inline(esc(_bq[3])) + '</p>');
continue;
}
closeList(); flushQuote();
paraBuf.push(line);
}
if (_pendingTableRow) {
const _cells = _pendingTableRow;
if (_cells.length >= 1) {
out.push('<table><thead><tr>' + _cells.map(c => '<th>' + inline(esc(c)) + '</th>').join('') + '</tr></thead><tbody></tbody></table>');
}
_pendingTableRow = null; _pendingTableLine = null;
}
if (inCode) { if (out.length && out[out.length - 1].endsWith('\n')) out[out.length - 1] = out[out.length - 1].slice(0, -1); out.push('</code></pre>'); }
flushAll();
if (_fnDefs.length) {
out.push('<hr class="footnotes-sep"><section class="footnotes"><ol>');
_fnDefs.forEach(({k, t}) => { out.push('<li id="fn-' + encodeURIComponent(k) + '">' + inline(esc(t)) + ' <a href="#fnref-' + encodeURIComponent(k) + '" class="footnote-back">↩</a></li>'); });
out.push('</ol></section>');
}
let _html = out.join('\n');
const _lvlRe = /\uE000LVL(\d+)\uE001/g;
_html = _html.replace(_lvlRe, (_, i) => {
const rec = _lvlStore[Number(i)];
if (!rec) return '';
const _n = Math.max(0, Math.min(99, parseInt(rec.n, 10) || 0));
return '<span data-lvl="' + _n + '">' + inline(esc(rec.inner)) + '</span>';
});
_lvlStore.length = 0;
return _html;
}
return { render, _clearMathCache: () => { _mathCache.clear(); } };
})();