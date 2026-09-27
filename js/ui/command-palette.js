
import { Config } from '../core/config.js';
import { Prefs } from '../core/prefs.js';
import { EVENTS } from '../core/events.js';
import { Flags } from '../core/flags.js';
import { Telemetry } from '../core/telemetry.js';
import { Settings } from '../settings/settings.js';
import { escapeHtml } from '../core/escape.js';
import { DrawerController } from './drawer.js';
import { ContentView } from '../library/content-view.js';
import { Exporter } from '../output/exporter.js';
import { Background } from '../theme/background.js';
import { Theme } from '../theme/theme.js';
import { TOC } from './toc.js';

import { State } from '../core/state.js';

export const CommandPalette = (() => {
let el = null, inputEl = null, listEl = null, backdropEl = null;
let commands = [];
let activeIndex = 0;
let lastFocus = null;
let _cmdCache = null;
let _cmdCacheKey = '';
const _CMD_CACHE_CAP = 500;
let _cmdKeyCache = null, _cmdKeyCacheRev = 0;
let _cmdKeyCacheLast = 0;
function _cmdKey() {
try {
const _now = Date.now();
if (_cmdKeyCache && _now - _cmdKeyCacheLast < 200) return _cmdKeyCache;
_cmdKeyCacheLast = _now;
const _rev = (State && typeof State.getRevision === 'function') ? (Number(State.getRevision()) || 0) : 0;
const _items = Array.isArray(State.get('libraryItems')) ? State.get('libraryItems') : [];
let _h = 2166136261;
let _tagCount = 0, _starCount = 0;
const _cap = Math.min(_items.length, 2000);
for (let i = 0; i < _cap; i++) {
const it = _items[i];
if (!it || typeof it !== 'object') continue;
const _tags = Array.isArray(it.tags) ? it.tags : [];
_tagCount += _tags.length;
if (it.starred) _starCount++;
const s = String(it.id || '') + ':' + String(it.lastModified || 0) + ':' + String(it.title || '').length + ':' + String(it.kind || '') + ':' + String(it.starred ? 1 : 0) + ':' + _tags.join('\u001f');
for (let j = 0; j < s.length; j++) { _h ^= s.charCodeAt(j); _h = Math.imul(_h, 16777619) | 0; }
}
const _revKey = _rev + ':' + _items.length + ':' + _tagCount + ':' + _starCount + ':' + (_h >>> 0);
if (_cmdKeyCache != null && _cmdKeyCacheRev === _revKey) return _cmdKeyCache;
const _d = (Config && Config.drawers) ? Object.entries(Config.drawers).map(([k, d]) => [k, d && d.title ? d.title : '']).slice(0, 500) : [];
const _hdr = Array.isArray(Config && Config.headerAll) ? Config.headerAll.map(h => [h && h.id, h && h.label]).slice(0, 500) : [];
const _t = (Theme && Theme.THEMES) ? Object.keys(Theme.THEMES).slice(0, 200) : [];
const _a = (Theme && Array.isArray(Theme.ACCENTS)) ? Theme.ACCENTS.map(a => a && a.id).slice(0, 200) : [];
const _hidRaw = Prefs.get('hiddenHeaderIds');
const _hid = Array.isArray(_hidRaw) ? _hidRaw.slice().sort().slice(0, 500) : [];
_d.sort((x, y) => String(x[0]).localeCompare(String(y[0])));
_hdr.sort((x, y) => String(x[0]).localeCompare(String(y[0])));
_cmdKeyCache = JSON.stringify([_revKey, _d, _hdr, _t.sort(), _a.sort(), _hid]);
_cmdKeyCacheRev = _revKey;
return _cmdKeyCache;
} catch (e) { console.warn('[palette] cmdKey', e); return 'fallback'; }
}
function _buildCommands() {
const key = _cmdKey();
if (_cmdCache && _cmdCacheKey === key) return _cmdCache;
const out = [];
const _hiddenRaw = Prefs.get('hiddenHeaderIds');
const _hidden = Array.isArray(_hiddenRaw) ? _hiddenRaw.filter(x => typeof x === 'string') : [];
const _settingsGroups = (Settings.getGroups && Array.isArray(Settings.getGroups())) ? Settings.getGroups() : [];
_settingsGroups.forEach(g => {
if (!g || typeof g.group !== 'string') return;
const _gid = 'settings-group-' + g.group.toLowerCase().replace(/[^a-z0-9]+/g, '-');
out.push({ icon: '⚙️', label: 'Settings: ' + g.group, meta: 'settings', run: () => {
try {
DrawerController.open('settings');
requestAnimationFrame(() => {
const card = document.getElementById(_gid);
if (card) card.scrollIntoView({ block: 'start' });
});
} catch (e) { console.warn('[palette]', e); }
} });
});
const _all = Array.isArray(Config.headerAll) ? Config.headerAll : [];
_all.forEach(h => {
if (!h || !h.id || _hidden.includes(h.id)) return;
const hasDrawer = !!(Config.drawers && Config.drawers[h.id]);
const _label = String(h.label || h.id).slice(0, 100);
out.push({ icon: h.icon, label: 'Open ' + _label, meta: hasDrawer ? 'section' : 'view', run: () => { if (hasDrawer) DrawerController.open(h.id); else { location.hash = '#' + h.id; } } });
if (hasDrawer) { const d = Config.drawers[h.id]; if (d && d.title && d.title !== _label) out.push({ icon: h.icon, label: 'Open ' + String(d.title).slice(0, 100), meta: 'section', run: () => DrawerController.open(h.id) }); }
});
if (Config && Config.drawers && typeof Config.drawers === 'object') {
Object.keys(Config.drawers).forEach(id => {
if (!id || typeof id !== 'string' || id.length > 64) return;
if (!_all.some(h => h && h.id === id)) {
const meta = { theme: '🎨', invert: '🌓', background: '🖼️', export: '📤', help: '❓' }[id];
out.push({ icon: meta || '•', label: 'Open ' + id, meta: 'drawer', run: () => DrawerController.open(id) });
}
});
}
out.push({ icon: '📚', label: 'Show library', meta: 'view', run: () => ContentView.showLibrary() });
out.push({ icon: '🧭', label: 'Show pathways', meta: 'view', run: () => ContentView.showPathway() });
out.push({ icon: '📊', label: 'Show overview', meta: 'view', run: () => ContentView.showOverview && ContentView.showOverview() });
out.push({ icon: '🌲', label: 'Show contents', meta: 'toc', run: () => { try { if (typeof TOC !== 'undefined' && TOC.open) TOC.open(); } catch (e) { console.warn('[palette] toc', e); } } });
out.push({ icon: '⌨️', label: 'Show shortcuts', meta: 'help', run: () => { try { DrawerController.open('help'); } catch (e) { console.warn('[palette] help', e); } } });
out.push({ icon: '⛶', label: 'Toggle focus mode', meta: 'zen', run: () => {
const on = !document.body.classList.contains('focus-mode');
document.body.classList.toggle('focus-mode', on);
try { if (Settings && Settings.setRow) Settings.setRow('reader.focusMode', on); } catch (e) { console.warn('[palette] focus', e); }
} });
out.push({ icon: '⬇️', label: 'Export all', meta: 'data', run: () => { try { Telemetry.record('palette.export'); Exporter.exportAll(); } catch (e) { console.warn('[palette]', e); } } });
out.push({ icon: '⬆️', label: 'Import backup', meta: 'data', run: () => { try { Telemetry.record('palette.import'); Exporter.importAll(); } catch (e) { console.warn('[palette]', e); } } });
out.push({ icon: '🖼️', label: 'Set background image', meta: 'background', run: () => { try { Background.pickImage(); } catch (e) { console.warn('[palette]', e); } } });
out.push({ icon: '🎬', label: 'Set background video', meta: 'background', run: () => { try { Background.pickVideo(); } catch (e) { console.warn('[palette]', e); } } });
out.push({ icon: '🚫', label: 'Clear background', meta: 'background', run: () => { try { Background.clear(); } catch (e) { console.warn('[palette]', e); } } });
['dark','light','auto'].forEach(m => out.push({ icon: m === 'dark' ? '🌙' : m === 'light' ? '☀️' : '🖥️', label: 'Theme: ' + m, meta: 'theme', run: () => Theme.setMode(m) }));
if (Theme && Theme.THEMES && typeof Theme.THEMES === 'object') {
Object.keys(Theme.THEMES).forEach(id => {
const t = Theme.THEMES[id];
if (!t) return;
out.push({ icon: t.icon || '🎨', label: 'Palette: ' + (t.label || id), meta: 'theme', run: () => Theme.setTheme(id) });
});
}
if (out.length > _CMD_CACHE_CAP) out.length = _CMD_CACHE_CAP;
_cmdCache = out;
_cmdCacheKey = key;
return out;
}
let _filtered = [];
function _render(q) {
if (!listEl) return;
const query = (q == null ? '' : String(q)).replace(/[\u0000-\u001f\u007f]/g, '').trim().toLowerCase().slice(0, 200);
const _norm = (s) => { const str = String(s); return typeof str.normalize === 'function' ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : str; };
const _q = _norm(query);
const _src = Array.isArray(commands) ? commands : [];
_filtered = _q
? _src.filter(c => c && typeof c === 'object' && ((_norm(String(c.label || '')).toLowerCase().includes(_q)) || (_norm(String(c.meta || '')).toLowerCase().includes(_q))))
: _src.slice();
_filtered = _filtered.slice(0, 500);
if (activeIndex < 0 || activeIndex >= _filtered.length) activeIndex = 0;
listEl.replaceChildren();
if (!_filtered.length) {
const e = document.createElement('div');
e.className = 'drawer__empty';
e.textContent = 'No commands match.';
listEl.appendChild(e);
if (inputEl) { inputEl.removeAttribute('aria-activedescendant'); inputEl.setAttribute('aria-expanded', 'false'); }
listEl._filtered = [];
return;
}
_filtered.forEach((c, i) => {
const b = document.createElement('div');
b.tabIndex = -1;
b.setAttribute('role', 'option');
b.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
b.className = 'command-palette__item' + (i === activeIndex ? ' is-active' : '');
b.dataset.cmdIndex = String(i);
const _iconText = String(c.icon == null ? '' : c.icon).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 4);
b.innerHTML = `<span class="d-icon" aria-hidden="true">${escapeHtml(_iconText)}</span><span class="d-text">${escapeHtml(String(c.label || ''))}</span><span class="d-meta">${escapeHtml(String(c.meta || ''))}</span>`;
b.addEventListener('click', () => { close(); try { c.run(); } catch (err) { console.warn('[palette] run failed', err); } });
if (i === activeIndex) b.id = 'cp-active-option';
listEl.appendChild(b);
});
if (inputEl) {
if (activeIndex >= 0 && _filtered.length) inputEl.setAttribute('aria-activedescendant', 'cp-active-option');
else inputEl.removeAttribute('aria-activedescendant');
inputEl.setAttribute('aria-expanded', 'true');
}
listEl._filtered = _filtered;
const _active = listEl.querySelector('.is-active');
if (_active && _active.scrollIntoView) _active.scrollIntoView({ block: 'nearest' });
}
function open() {
if (!el) init();
if (!el) { console.warn('[palette] root missing'); return; }
if (!el.hidden) return;
lastFocus = document.activeElement;
try { commands = _buildCommands(); } catch (e) { console.warn('[palette] build', e); commands = []; }
activeIndex = 0;
el.hidden = false;
el._openedAt = Date.now();
if (backdropEl) backdropEl.hidden = false;
document.body.classList.add('has-command-palette');
let _initial = '';
try { _initial = String(Prefs.get('palette.lastQuery') || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200); } catch (e) { console.warn('[palette] lastQuery', e); }
_render(_initial);
if (inputEl) { inputEl.value = _initial; try { inputEl.focus({ preventScroll: true }); } catch (e) { try { inputEl.focus(); } catch (e2) { console.warn('[palette] focus', e2); } } }
}
function close() {
if (!el || el.hidden) return;
try { if (inputEl && inputEl.value) Prefs.set('palette.lastQuery', String(inputEl.value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200)); } catch (e) { console.warn('[palette] save query', e); }
_cmdKeyCache = null; _cmdKeyCacheRev = 0;
_cmdKeyCacheLast = 0;
el.hidden = true;
if (backdropEl) backdropEl.hidden = true;
try { document.body.classList.remove('has-command-palette'); } catch (e) { console.warn('[palette] class', e); }
activeIndex = 0;
_cmdCache = null;
_cmdCacheKey = '';
if (inputEl) { inputEl.value = ''; inputEl.removeAttribute('aria-activedescendant'); inputEl.setAttribute('aria-expanded', 'false'); }
if (listEl) { listEl.replaceChildren(); listEl._filtered = []; }
if (lastFocus && document.contains(lastFocus)) { try { if (typeof lastFocus.focus === 'function') lastFocus.focus(); } catch (e) { console.warn('[palette] restore focus', e); } }
lastFocus = null;
}
function init() {
if (el) return;
el = document.getElementById('commandPalette');
if (!el) return;
if (el._paletteBound) return;
el._paletteBound = true;
el.setAttribute('role', 'dialog');
el.setAttribute('aria-modal', 'true');
el.setAttribute('aria-label', 'Command palette');
backdropEl = document.getElementById('commandPaletteBackdrop');
if (backdropEl && !backdropEl._bound) {
backdropEl._bound = true;
backdropEl.addEventListener('mousedown', (e) => {
if (e.target !== backdropEl) return;
if (Date.now() - (el._openedAt || 0) < 100) return;
close();
});
}
inputEl = el.querySelector('.command-palette__input');
listEl = el.querySelector('.command-palette__list');
if (listEl) listEl.setAttribute('role', 'listbox');
if (inputEl) {
inputEl.setAttribute('role', 'combobox');
inputEl.setAttribute('aria-autocomplete', 'list');
inputEl.setAttribute('aria-haspopup', 'listbox');
inputEl.setAttribute('aria-controls', 'command-palette-list');
inputEl.setAttribute('aria-expanded', 'false');
}
if (listEl) listEl.id = 'command-palette-list';
if (inputEl) {
let _paletteInputTimer = null;
inputEl.addEventListener('input', () => { activeIndex = 0; clearTimeout(_paletteInputTimer); _paletteInputTimer = setTimeout(() => { _render(inputEl.value); }, 60); });
inputEl.addEventListener('keydown', e => {
if (e.isComposing) return;
const _len = Math.max(0, (listEl._filtered || []).length);
if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, Math.max(0, _len - 1)); _render(inputEl.value); }
else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); _render(inputEl.value); }
else if (e.key === 'Home') { e.preventDefault(); activeIndex = 0; _render(inputEl.value); }
else if (e.key === 'End') { e.preventDefault(); activeIndex = Math.max(0, _len - 1); _render(inputEl.value); }
else if (e.key === 'PageDown') { e.preventDefault(); activeIndex = Math.min(_len - 1, activeIndex + 10); _render(inputEl.value); }
else if (e.key === 'PageUp') { e.preventDefault(); activeIndex = Math.max(0, activeIndex - 10); _render(inputEl.value); }
else if (e.key === 'Enter') { e.preventDefault(); const cur = (listEl._filtered || [])[activeIndex]; if (cur) { close(); queueMicrotask(() => { try { cur.run(); } catch (err) { console.warn('[palette]', err); try { if (typeof Toast !== 'undefined' && Toast.error) Toast.error('Command failed: ' + (err && err.message ? err.message : err)); } catch {} } }); } }
else if (e.key === 'Escape') { e.preventDefault(); close(); }
}, { capture: false });
}
el.addEventListener('keydown', e => {
if (e.key !== 'Tab') return;
const focusable = Array.from(el.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])'))
.filter(x => !x.hidden && !x.disabled && typeof x.getClientRects === 'function' && x.getClientRects().length > 0);
if (!focusable.length) { e.preventDefault(); return; }
const first = focusable[0], last = focusable[focusable.length - 1];
if (e.shiftKey && document.activeElement === first) { e.preventDefault(); try { last.focus(); } catch (err) { console.warn('[palette] focus', err); } }
else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); try { first.focus(); } catch (err) { console.warn('[palette] focus', err); } }
});
}
return { init, open, close };
})();