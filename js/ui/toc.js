
import { State } from '../core/state.js';
import { Toast } from './toast.js';

export const TOC = (() => {
let panel, bodyEl, observer = null;
let lastFocus = null;
let tocOpen = false;
let _tocInited = false;
let _tocRebuildRO = null;
const _folded = new Set();
let _tocEscape = null;
function init() {
if (_tocInited) return;
panel = document.getElementById('tocPanel');
bodyEl = document.getElementById('tocBody');
if (!panel || !bodyEl) return;
_tocInited = true;
const _closeBtn = document.getElementById('tocClose');
if (_closeBtn && !_closeBtn._tocBound) { _closeBtn._tocBound = true; _closeBtn.addEventListener('click', close); }
if (!_tocEscape) {
_tocEscape = e => {
if (e.key === 'Escape' && tocOpen) { e.preventDefault(); close(); }
};
document.addEventListener('keydown', _tocEscape, true);
}
}
function destroy() {
if (_tocEscape) { try { document.removeEventListener('keydown', _tocEscape, true); } catch (e) { console.warn('[toc] removeEscape', e); } _tocEscape = null; }
if (observer) { try { observer.disconnect(); } catch (e) { console.warn('[toc] destroy observer', e); } observer = null; }
if (tocOpen) { tocOpen = false; if (panel) { panel.classList.remove('is-open'); panel.hidden = true; } }
lastFocus = null;
_tocInited = false;
}
function build() {
if (!panel || !bodyEl) return;
const main = document.getElementById('main');
if (!main) return;
bodyEl.replaceChildren();
const links = [];
const _usedIds = new Set();
const _existingPageIds = new Set(Array.from(main.querySelectorAll('[id]')).map(el => el.id).filter(x => typeof x === 'string' && x.length < 200));
const _linkFn = (h) => {
const _userId = (typeof h.id === 'string' && h.id.length > 0 && h.id.length < 200) ? h.id : '';
let _baseId = _userId || (String(h.textContent || 'heading').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)) || 'heading';
let _candidate = _baseId;
if (!_userId) {
let _n = 2;
while (_usedIds.has(_candidate) || _existingPageIds.has(_candidate)) {
_candidate = _baseId + '-' + _n;
_n++;
if (_n > 999) { _candidate = _baseId + '-' + Math.random().toString(36).slice(2, 8); break; }
}
}
h.id = _candidate;
_usedIds.add(h.id);
h.style.cursor = 'pointer';
h.dataset.tocHeading = '1';
if (!h.dataset.tocTitleBound) { h.dataset.tocTitleBound = '1'; if (!h.title) h.title = 'Click to copy link'; }
if (!h._linkBound) {
h._linkBound = true;
h.addEventListener('click', (e) => {
if (e && (e.ctrlKey || e.metaKey)) return;
const u = location.origin + location.pathname + '#' + h.id;
try { navigator.clipboard?.writeText(u); Toast.show('Heading link copied'); } catch {}
});
}
const a = document.createElement('a');
a.href = '#' + h.id;
a.textContent = h.textContent || '(untitled)';
a.dataset.level = h.tagName.slice(1);
a.addEventListener('click', e => { e.preventDefault(); try { let _reduce = false; try { _reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {} h.scrollIntoView({ behavior: _reduce ? 'auto' : 'smooth', block: 'start' }); } catch (err) { h.scrollIntoView(); } });
const _level = parseInt(h.tagName.slice(1), 10);
const _foldBtn = document.createElement('button');
_foldBtn.type = 'button';
_foldBtn.className = 'toc-fold';
_foldBtn.textContent = _folded.has(h.id) ? '▸' : '▾';
_foldBtn.setAttribute('aria-expanded', String(!_folded.has(h.id)));
_foldBtn.setAttribute('aria-label', 'Fold heading');
_foldBtn.style.cssText = 'margin-left:auto;border:none;background:transparent;color:var(--text-dim);cursor:pointer;font-size:11px;padding:0 4px';
_foldBtn.addEventListener('click', ev => {
ev.preventDefault(); ev.stopPropagation();
const _isNowFolded = !_folded.has(h.id);
if (_isNowFolded) _folded.add(h.id); else _folded.delete(h.id);
_foldBtn.textContent = _isNowFolded ? '▸' : '▾';
_foldBtn.setAttribute('aria-expanded', String(!_isNowFolded));
const _curLevel = parseInt(h.tagName.slice(1), 10);
const _myIdx = links.findIndex(l => l.h === h);
links.forEach((lk, i) => {
if (i <= _myIdx) return;
if (lk.level <= _curLevel) return;
const _prev = links[i - 1];
if (_prev.level >= lk.level) return;
lk.row.style.display = _isNowFolded ? 'none' : '';
if (!_isNowFolded) { lk.row.style.display = _folded.has(lk.h.id) ? 'none' : ''; }
});
});
const _row = document.createElement('div');
_row.style.cssText = 'display:flex;align-items:center';
_row.appendChild(a);
_row.appendChild(_foldBtn);
bodyEl.appendChild(_row);
links.push({ a, h, level: _level, row: _row, foldBtn: _foldBtn });
};
Array.from(main.querySelectorAll('h1, h2, h3, h4, h5, h6')).slice(0, 500).forEach(_linkFn);
let _h = 56;
try { _h = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10); } catch (e) { console.warn('[toc] header-h', e); }
if (!Number.isFinite(_h) || _h < 0 || _h > 400) _h = 56;
const _hh = _h;
if (observer) { try { observer.disconnect(); } catch (e) { console.warn('[toc] disconnect', e); } observer = null; }
if (typeof IntersectionObserver !== 'function') { console.warn('[toc] no IntersectionObserver, falling back'); return; }
observer = new IntersectionObserver(entries => {
entries.forEach(en => {
if (!en.isIntersecting) return;
links.forEach(l => {
const active = l.h === en.target;
l.a.classList.toggle('is-active', active);
if (active) l.a.setAttribute('aria-current', 'location');
else l.a.removeAttribute('aria-current');
});
});
}, { rootMargin: `-${_hh + 12}px 0px -72% 0px`, threshold: 0 });
links.forEach(l => observer.observe(l.h));
}
function open() {
if (!panel) return;
if (tocOpen) return;
tocOpen = true;
_folded.clear();
lastFocus = document.activeElement;
build();
panel.hidden = false;
panel.removeAttribute('inert');
requestAnimationFrame(() => panel.classList.add('is-open'));
try { panel.focus({ preventScroll: true }); } catch (e) { console.warn('[toc] focus', e); }
if (typeof ResizeObserver === 'function') {
try {
const mainEl = document.getElementById('main');
if (mainEl) {
let _tocRebuildRaf = 0;
_tocRebuildRO = new ResizeObserver(() => {
if (!tocOpen || _tocRebuildRaf) return;
_tocRebuildRaf = requestAnimationFrame(() => { _tocRebuildRaf = 0; try { build(); } catch (e) { console.warn('[toc] rebuild', e); } });
});
_tocRebuildRO.observe(mainEl);
}
} catch (e) { console.warn('[toc] rebuild RO', e); }
}
}
function close() {
if (!panel) return;
if (!tocOpen) return;
tocOpen = false;
if (observer) { try { observer.disconnect(); } catch (e) { console.warn('[toc] disconnect', e); } observer = null; }
if (_tocRebuildRO) { try { _tocRebuildRO.disconnect(); } catch (e) { console.warn('[toc] rebuild RO off', e); } _tocRebuildRO = null; }
panel.classList.remove('is-open');
let _doneCalled = false;
let _t = null;
const _done = () => {
if (_doneCalled) return;
_doneCalled = true;
if (panel) panel.removeEventListener('transitionend', _onTransitionEnd);
if (_t) { clearTimeout(_t); _t = null; }
if (panel) panel.hidden = true;
if (lastFocus && document.contains(lastFocus) && typeof lastFocus.focus === 'function') { try { lastFocus.focus({ preventScroll: true }); } catch (e) { try { lastFocus.focus(); } catch {} } }
lastFocus = null;
};
const _onTransitionEnd = (e) => { if (e && e.target !== panel) return; _done(); };
if (panel) panel.addEventListener('transitionend', _onTransitionEnd, { once: true });
_t = setTimeout(_done, 400);
}
function toggle() { if (panel) tocOpen ? close() : open(); }
function isOpen() { return tocOpen; }
return { init, destroy, open, close, toggle, build, isOpen };
})();