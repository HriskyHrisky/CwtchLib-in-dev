
import { Prefs } from '../core/prefs.js';
import { State } from '../core/state.js';
import { Store } from '../core/store.js';
import { Bus } from '../core/bus.js';
import { Strings } from '../core/strings.js';
import { EVENTS } from '../core/events.js';
import { escapeHtml } from '../core/escape.js';
import { Markdown } from '../markdown/markdown.js';
import { Undo } from './undo.js';
import { Toast } from '../ui/toast.js';
import { Modal } from '../ui/modal.js';
import { Status } from '../ui/status.js';
import { Announce } from '../ui/announce.js';
import { DrawerController } from '../ui/drawer.js';
import { ContentView } from '../library/content-view.js';
import { Tabs } from '../ui/tabs.js';

export const Editor = (() => {
let dirty = false;
let dirtyItem = null;
let autoSaveTimer = null;
let _openId = null;
let _toolbarHidden = [];
let _openAbort = null;
let _saveInFlight = false;
function open(id) {
if (typeof id !== 'string' || !id || id.length > 200) return;
if (_openAbort) { try { _openAbort.abort(); } catch (e) { console.warn('[editor] abort prev open', e); } }
const _prevMain = document.getElementById('main');
if (_prevMain && _prevMain._ctrlKHandler) { try { _prevMain.removeEventListener('keydown', _prevMain._ctrlKHandler); } catch (e) { console.warn('[editor] removeCtrlK', e); } _prevMain._ctrlKHandler = null; _prevMain._ctrlKBound = false; }
if (_prevMain && _prevMain._editorCtrlKHandler) { try { _prevMain.removeEventListener('keydown', _prevMain._editorCtrlKHandler); } catch (e) { console.warn('[editor] removeCtrlK legacy', e); } _prevMain._editorCtrlKHandler = null; }
_openAbort = (typeof AbortController === 'function') ? new AbortController() : null;
const item = (State.get('libraryItems') || []).find(x => x && x.id === id);
if (!item) return;
_openId = id;
State.set('currentView', 'edit');
if (!Array.isArray(item.tags)) item.tags = [];
if (typeof item.starred !== 'boolean') item.starred = false;
if (typeof item.createdAt !== 'number' || !Number.isFinite(item.createdAt)) item.createdAt = Date.now();
if (typeof item.lastModified !== 'number' || !Number.isFinite(item.lastModified)) item.lastModified = item.createdAt;
if (!Array.isArray(item._snapshots)) item._snapshots = [];
if (item.kind !== 'markdown' && item.kind !== 'text' && item.kind !== 'note') {
try { Toast.show('This item is not editable'); } catch (e) { console.warn('[editor]', e); }
return;
}
try {
_toolbarHidden = Prefs.get('setting.ui.editorToolbarHidden');
if (!Array.isArray(_toolbarHidden)) _toolbarHidden = [];
} catch (e) { console.warn('[editor] toolbarHidden', e); _toolbarHidden = []; }
document.title = String(item.title || 'Editor').replace(/[\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 100) + ' — CwtchLib';
try { Tabs.open(id); } catch (e) { console.warn('[editor] Tabs.open failed', e); }
const nextHash = '#edit-' + id;
try {
const _h = (location.hash && location.hash.startsWith('#edit-')) ? location.hash : nextHash;
if (_h !== nextHash) history.pushState(null, '', nextHash);
} catch (e) { console.warn('[editor] pushState', e); }
const main = document.getElementById('main');
if (!main) return;
main.setAttribute('role', 'tabpanel');
main.setAttribute('aria-labelledby', 'tab-' + id);
main.removeAttribute('aria-label');
const _defaultToolbar = [['back','← Library','Back to library'],['undo','↶','Undo'],['redo','↷','Redo'],['bold','B','Bold'],['italic','I','Italic'],['h1','H1','Heading 1'],['h2','H2','Heading 2'],['ul','• List','Bulleted list'],['table','⊞ Table','Insert table'],['code','{} Code','Insert code block'],['highlight','==','Highlight'],['footnote','[^]','Footnote'],['versions','🕘','Version history'],['diff','±','Diff vs previous'],['focus','⛶ Focus','Toggle focus mode'],['reset','↺ Reset','Reset to last saved'],['save','💾 Save','Save (Ctrl+S)'],['cancel','Cancel','Cancel']];
const _toolbar = (() => {
const custom = Prefs.get('setting.ui.editorToolbar');
if (Array.isArray(custom) && custom.length && custom.every(x => Array.isArray(x) && x.length === 3 && typeof x[0] === 'string')) {
const _validActs = new Set(_defaultToolbar.map(x => x[0]));
const _filtered = custom.filter(x => _validActs.has(x[0]));
if (_filtered.length) return _filtered;
}
const _hiddenSet = new Set(Array.isArray(_toolbarHidden) ? _toolbarHidden : []);
const _out = _defaultToolbar.filter(([tid]) => !_hiddenSet.has(tid));
return _out.length ? _out : _defaultToolbar.slice();
})();
main.innerHTML = `<article class="editor">

<header class="doc__head">
<input class="editor__title" value="${escapeHtml(String(item.title == null ? '' : item.title).slice(0, 300))}" aria-label="Title" maxlength="300" />
<div class="editor__subtabs" role="tablist" aria-label="Editor mode">
<button class="subtab is-active" type="button" role="tab" data-tab="edit" aria-selected="true">${escapeHtml(Strings.t('editor.tab.edit', 'Edit'))}</button>
<button class="subtab" type="button" role="tab" data-tab="raw" aria-selected="false">${escapeHtml(Strings.t('editor.tab.raw', 'Raw'))}</button>
<button class="subtab" type="button" role="tab" data-tab="preview" aria-selected="false">${escapeHtml(Strings.t('editor.tab.preview', 'Preview'))}</button>
</div>
<div class="doc__actions">
${_toolbar.map(([act, txt, title]) => `<button class="demo-btn" data-act="${act}" title="${title}">${txt}</button>`).join('')}
<span class="editor__save-indicator" id="editorSaveDot" aria-hidden="true"></span>
</div>
</header>
<div class="editor__panes">
<div class="editor__pane" id="editor-pane-edit" data-pane="edit" role="region" aria-label="Edit pane"><textarea class="editor__body" spellcheck="true" aria-label="Document body"></textarea></div>
<div class="editor__pane" id="editor-pane-raw" data-pane="raw" role="region" aria-label="Raw markdown pane" hidden><textarea class="editor__raw" aria-label="Raw markdown"></textarea></div>
<div class="editor__pane" id="editor-pane-preview" data-pane="preview" role="region" aria-label="Preview pane" hidden><div class="editor__preview"></div></div>
</div>
</article>`;
const body = main.querySelector('.editor__body');
const raw = main.querySelector('.editor__raw');
if (!body || !raw) { console.warn('[editor] body/raw missing'); return; }
let spellOn = false; try { spellOn = !!Prefs.get('setting.editor.spellCheck'); } catch (e) { console.warn('[editor] spellcheck pref', e); }
try { body.spellcheck = spellOn; raw.spellcheck = spellOn; } catch (e) { console.warn('[editor] spellcheck', e); }
let _syncing = false;
body.addEventListener('input', () => { if (_syncing) return; _syncing = true; try { if (raw.value !== body.value) raw.value = body.value; } finally { _syncing = false; } });
raw.addEventListener('input', () => { if (_syncing) return; _syncing = true; try { if (body.value !== raw.value) body.value = raw.value; } finally { _syncing = false; } });
body.addEventListener('input', scheduleAutoSave);
raw.addEventListener('input', scheduleAutoSave);
const _rawPaneRef = main.querySelector('#editor-pane-raw');
const activeTextareaIsRaw = () => !!(_rawPaneRef && !_rawPaneRef.hidden);
const readBody = () => (activeTextareaIsRaw() ? raw.value : body.value);
const writeBody = (val) => { body.value = val; if (raw.value !== val) raw.value = val; };
writeBody(item.content || '');
const _handleImagePaste = async (e, ta) => {
const cd = e && e.clipboardData;
if (!cd || !cd.items || !ta) return false;
for (const _ci of cd.items) {
if (!_ci || !_ci.type || !_ci.type.startsWith('image/')) continue;
if (_ci.type === 'image/svg+xml') { try { Toast.error('SVG paste disabled for safety'); } catch (err) { console.warn('[editor] svg toast', err); } continue; }
const file = _ci.getAsFile && _ci.getAsFile();
if (!file) continue;
if (file.size > 20 * 1024 * 1024) { try { Toast.error('Image too large (max 20MB)'); } catch (err) { console.warn('[editor] image toast', err); } continue; }
e.preventDefault();
try {
const assetKey = 'asset-' + ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
await Store.putAsset(assetKey, file);
const s = ta.selectionStart, en = ta.selectionEnd;
if (s == null || en == null) return true;
ta.setRangeText('![image](asset:' + assetKey + ')', s, en, 'end');
ta.dispatchEvent(new Event('input', { bubbles: true }));
return true;
} catch (err) { console.warn('[editor] image paste store failed', err); return false; }
}
return false;
};
body.addEventListener('paste', async e => {
try { if (await _handleImagePaste(e, body)) return; } catch (err) { console.warn('[editor] image paste', err); }
const cd = e.clipboardData;
if (!cd) return;
const text = cd.getData('text/plain');
if (text == null) return;
e.preventDefault();
const s = body.selectionStart, en = body.selectionEnd;
if (s == null || en == null) return;
body.setRangeText(text, s, en, 'end');
body.dispatchEvent(new Event('input', { bubbles: true }));
});
raw.addEventListener('paste', async e => {
try { if (await _handleImagePaste(e, raw)) return; } catch (err) { console.warn('[editor] raw image paste', err); }
const cd = e.clipboardData;
if (!cd) return;
const text = cd.getData('text/plain');
if (text == null) return;
e.preventDefault();
const s = raw.selectionStart, en = raw.selectionEnd;
if (s == null || en == null) return;
raw.setRangeText(text, s, en, 'end');
raw.dispatchEvent(new Event('input', { bubbles: true }));
});
const activeTextarea = () => { const rp = main.querySelector('#editor-pane-raw'); if (rp && !rp.hidden) return raw; return body; };
function surroundSelection(before, after) {
const ta = activeTextarea();
if (!ta || typeof before !== 'string' || typeof after !== 'string') return;
const s = ta.selectionStart, e = ta.selectionEnd;
if (s == null || e == null || s === e) return;
if (e - s > 500000) {
try { Toast.error('Selection too large (max 500k chars)'); } catch {}
if (typeof Status !== 'undefined') Status.flashSave('selection too large', 'error');
return;
}
const sel = ta.value.slice(s, e);
const _out = before + sel + after;
if (_out.length > 2 * 1024 * 1024) { try { Toast.error('Result too large'); } catch {} return; }
ta.setRangeText(_out, s, e, 'select');
ta.dispatchEvent(new Event('input', { bubbles: true }));
}
const surroundLineSelection = (pre) => {
const ta = activeTextarea();
const s = ta.selectionStart, en = ta.selectionEnd;
const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
const _lineEndRaw = ta.value.indexOf('\n', en);
const lineEnd = _lineEndRaw === -1 ? ta.value.length : _lineEndRaw;
if (s !== en) {
const _sel = ta.value.slice(lineStart, lineEnd);
const _out = _sel.split('\n').map(l => pre + l).join('\n');
ta.setRangeText(_out, lineStart, lineEnd, 'end');
} else {
ta.setRangeText(pre, lineStart, lineStart, 'end');
}
ta.dispatchEvent(new Event('input', { bubbles: true }));
};
main.querySelector('[data-act="bold"]')?.addEventListener('click', () => surroundSelection('**', '**'));
main.querySelector('[data-act="italic"]')?.addEventListener('click', () => surroundSelection('*', '*'));
main.querySelector('[data-act="h1"]')?.addEventListener('click', () => surroundLineSelection('# '));
main.querySelector('[data-act="h2"]')?.addEventListener('click', () => surroundLineSelection('## '));
main.querySelector('[data-act="undo"]')?.addEventListener('click', () => Undo.undo());
main.querySelector('[data-act="redo"]')?.addEventListener('click', () => Undo.redo());
main.querySelector('[data-act="focus"]')?.addEventListener('click', () => {
const on = !document.body.classList.contains('focus-mode');
document.body.classList.toggle('focus-mode', on);
try { if (window.Cwtch && window.Cwtch.Settings && typeof window.Cwtch.Settings.setRow === 'function') window.Cwtch.Settings.setRow('reader.focusMode', on); else Prefs.set('setting.reader.focusMode', on); } catch (e) { console.warn('[editor] focus toggle', e); }
try { document.querySelectorAll('[data-focus-mode-toggle]').forEach(el => el.setAttribute('aria-pressed', String(on))); } catch (e) { console.warn('[editor] focus aria', e); }
if (typeof Status !== 'undefined' && typeof Status.flashSave === 'function') Status.flashSave(on ? 'focus mode on' : 'focus mode off');
});
main.querySelector('[data-act="table"]')?.addEventListener('click', () => {
const ta = activeTextarea();
if (!ta) return;
const s = ta.selectionStart;
try { ta.setRangeText('\n| A | B |\n|---|---|\n| 1 | 2 |\n', s, ta.selectionEnd, 'end'); } catch (err) { console.warn('[editor] table', err); }
ta.dispatchEvent(new Event('input', { bubbles: true }));
});
main.querySelector('[data-act="code"]')?.addEventListener('click', () => {
const ta = activeTextarea();
if (!ta) return;
const s = ta.selectionStart, e = ta.selectionEnd;
const sel = ta.value.slice(s, e);
try { ta.setRangeText('\n```\n' + sel + '\n```\n', s, e, 'end'); } catch (err) { console.warn('[editor] code', err); }
ta.dispatchEvent(new Event('input', { bubbles: true }));
});
main.querySelector('[data-act="back"]')?.addEventListener('click', () => ContentView.showLibrary());
main.querySelector('[data-act="versions"]')?.addEventListener('click', () => {
const _snaps = Array.isArray(item._snapshots) ? item._snapshots : [];
const _curContent = readBody();
const _curTitle = (main.querySelector('.editor__title') || {}).value || item.title;
const _last = _snaps.length ? _snaps[_snaps.length - 1] : null;
const _isDup = _last && _last.content === _curContent && _last.title === _curTitle;
if (_curContent && !_isDup) { _snaps.push({ at: Date.now(), content: _curContent, title: _curTitle }); }
while (_snaps.length > 20) _snaps.shift();
const wrap = document.createElement('div');
wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;max-height:60vh;overflow-y:auto';
if (!_snaps.length) {
const e = document.createElement('div'); e.className = 'drawer__empty'; e.textContent = 'No snapshots yet.'; wrap.appendChild(e);
} else {
_snaps.slice().reverse().forEach((s, i) => {
const b = document.createElement('button');
b.type = 'button'; b.className = 'drawer__item'; b.style.flex = '1';
b.textContent = new Date(s.at).toLocaleString() + ' · ' + (s.title || '');
b.addEventListener('click', async () => {
const ok = await Modal.confirm('Restore this snapshot?', { okLabel: 'Restore' });
if (!ok) return;
const _up = Object.assign({}, item, { content: s.content, title: s.title || item.title, lastModified: Date.now() });
await Store.put(_up);
Object.assign(item, _up);
State.set('libraryItems', (State.get('libraryItems') || []).map(x => x.id === item.id ? _up : x));
Bus.emit('library:changed');
Modal.dismiss();
Editor.open(item.id);
});
wrap.appendChild(b);
});
}
Modal.open({ title: 'Version history', body: wrap, actions: [{ label: 'Close', value: null }] });
});
main.querySelector('[data-act="diff"]')?.addEventListener('click', async () => {
const _snaps = Array.isArray(item._snapshots) ? item._snapshots : [];
if (!_snaps.length) { Toast.show('No snapshots to diff'); return; }
const _prev = _snaps[_snaps.length - 1];
const _cur = (typeof readBody === 'function' ? readBody() : '') || '';
const _prevLines = String(_prev.content || '').split('\n');
const _curLines = String(_cur).split('\n');
const wrap = document.createElement('div');
wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto;font-family:ui-monospace,monospace;font-size:12px';
const _max = Math.min(20000, Math.max(_prevLines.length, _curLines.length));
if (Math.max(_prevLines.length, _curLines.length) > _max) { Toast.show('Diff truncated to first 20000 lines'); }
for (let i = 0; i < _max; i++) {
const a = _prevLines[i] == null ? '' : _prevLines[i];
const b = _curLines[i] == null ? '' : _curLines[i];
const row = document.createElement('div');
if (a === b) { row.style.cssText = 'color:var(--text-dim)'; row.textContent = '' + a; }
else { row.style.cssText = 'color:var(--warning)'; row.textContent = '± ' + (b || a); }
wrap.appendChild(row);
}
Modal.open({ title: 'Diff vs previous snapshot', body: wrap, actions: [{ label: 'Close', value: null }] });
});
if (main._ctrlKBound && main._ctrlKHandler) { try { main.removeEventListener('keydown', main._ctrlKHandler); } catch (e) { console.warn('[editor] removeCtrlK', e); } }
main._ctrlKHandler = async e => {
if (!e || e.isComposing) return;
if ((e.ctrlKey || e.metaKey) && typeof e.key === 'string' && e.key.toLowerCase() === 'k') {
e.preventDefault();
e.stopImmediatePropagation();
let url = await Modal.prompt('URL:', { okLabel: 'Insert' });
if (url == null) return;
url = String(url).trim();
if (!url) {
try { Toast.show('No URL provided; nothing inserted'); } catch {}
return;
}
if (!/^(https?:|mailto:|#|\/|asset:|\.)/i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
url = url.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 2000);
const ta = activeTextarea();
if (!ta) return;
const s = ta.selectionStart, en = ta.selectionEnd;
const sel = ta.value.slice(s, en) || 'link';
ta.setRangeText('[' + sel + '](' + url + ')', s, en, 'end');
ta.dispatchEvent(new Event('input', { bubbles: true }));
}
};
main.addEventListener('keydown', main._ctrlKHandler);
main._ctrlKBound = true;
const editorPanels = {
edit: main.querySelector('#editor-pane-edit'),
raw: main.querySelector('#editor-pane-raw'),
preview: main.querySelector('#editor-pane-preview')
};
if (!editorPanels.edit || !editorPanels.raw || !editorPanels.preview) {
console.warn('[editor] panes missing');
try { if (typeof Toast !== 'undefined') Toast.error('Editor panes unavailable'); } catch {}
ContentView.showDocument(item, true);
return;
}
const editorSubtabs = Array.from(main.querySelectorAll('.editor__subtabs .subtab'));
function setEditorPane(name) {
if (typeof name !== 'string' || !editorPanels[name]) name = 'edit';
Object.entries(editorPanels).forEach(([k, el]) => { if (el) el.hidden = k !== name; });
editorSubtabs.forEach(t => {
const on = t.dataset.tab === name;
t.classList.toggle('is-active', on);
t.setAttribute('aria-selected', String(on));
t.setAttribute('tabindex', on ? '0' : '-1');
});
if (name === 'edit') body.focus();
else if (name === 'raw') raw.focus();
else if (name === 'preview') {
const prev = editorPanels.preview && editorPanels.preview.querySelector('.editor__preview');
if (prev) {
try {
const _rendered = Markdown.render(readBody());
prev.innerHTML = _rendered;
} catch (err) { console.warn('[editor] preview', err); prev.textContent = readBody(); }
}
}
}
editorSubtabs.forEach(t => {
t.addEventListener('click', () => setEditorPane(t.dataset.tab));
t.addEventListener('keydown', e => {
if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
e.preventDefault();
const list = Array.from(editorSubtabs);
const i = list.indexOf(t);
if (i < 0 || !list.length) return;
const n = e.key === 'ArrowRight' ? list[(i + 1) % list.length] : list[(i - 1 + list.length) % list.length];
if (n) { setEditorPane(n.dataset ? n.dataset.tab : 'edit'); if (typeof n.focus === 'function') { try { n.focus(); } catch {} } }
});
});
let _saving = false;
main.querySelector('[data-act="save"]')?.addEventListener('click', async () => {
if (_saving) return;
_saving = true;
try {
if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
const _titleEl = main.querySelector('.editor__title');
const _content = readBody();
const _title = _titleEl ? _titleEl.value : item.title;
await save(item, _content, _title);
} catch (err) { console.warn('[editor] save failed', err); try { if (typeof Toast !== 'undefined') Toast.error('Save failed'); } catch {} }
finally { _saving = false; }
});
main.querySelector('[data-act="reset"]')?.addEventListener('click', async () => {
if (!dirty) { Toast.show('No changes'); return; }
const ok = await Modal.confirm('Reset to last saved content?', { danger: true, okLabel: 'Reset' });
if (!ok) return;
if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
writeBody(typeof item.content === 'string' ? item.content : '');
dirty = false;
dirtyItem = null;
try { const dotEl = document.getElementById('editorSaveDot'); if (dotEl) { dotEl.classList.remove('is-dirty'); dotEl.classList.add('is-saved'); } } catch (e) { console.warn('[editor] reset dot', e); }
Status.flashSave('reset');
});
main.querySelector('[data-act="cancel"]')?.addEventListener('click', async () => {
if (dirty) {
let ok = false;
try { ok = await Modal.confirm('Discard unsaved changes?', { danger: true, okLabel: 'Discard' }); } catch (e) { console.warn('[editor] confirm cancel', e); return; }
if (!ok) return;
}
if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
dirty = false; dirtyItem = null;
try { if (typeof DrawerController !== 'undefined' && DrawerController.getId && DrawerController.getId()) DrawerController.close(true, true); } catch {}
ContentView.showDocument(item, true);
});
dirty = false;
dirtyItem = item;
setEditorPane('edit');
if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
function scheduleAutoSave() {
try {
let _imeGuard = true;
try { _imeGuard = Prefs.get('setting.editor.imeGuard') !== false; } catch (e) { console.warn('[editor] imeGuard pref', e); }
if (_imeGuard) {
const _ae = document.activeElement;
const _composing = (body && body.isComposing) || (raw && raw.isComposing) || (_ae && _ae.isComposing);
if (_composing) return;
}
} catch (e) { console.warn('[editor] imeGuard', e); }
dirty = true;
const dotEl = document.getElementById('editorSaveDot');
if (dotEl) { dotEl.classList.remove('is-saved'); dotEl.classList.add('is-dirty'); }
let _autoOn = true;
try { _autoOn = Prefs.get('setting.editor.autoSave') !== false; } catch (e) { console.warn('[editor] autoSave pref', e); }
if (!_autoOn) return;
clearTimeout(autoSaveTimer);
const _delayRaw = Number(Prefs.get('setting.editor.debounceMs'));
const delay = Number.isFinite(_delayRaw) && _delayRaw > 0 ? Math.min(_delayRaw, 30000) : 1500;
autoSaveTimer = setTimeout(async () => {
if (!dirty) return;
if (_openId !== item.id) return;
if (State.get('activeTabId') !== item.id) return;
if (!document.contains(main)) return;
if (_openAbort && _openAbort.signal && _openAbort.signal.aborted) return;
const titleEl2 = main.querySelector('.editor__title');
if (!titleEl2) return;
const contentAtStart = readBody();
const titleAtStart = titleEl2.value || item.title;
if (contentAtStart.length > 50 * 1024 * 1024) { console.warn('[autosave] content too large'); return; }
const _prevContent = item.content;
const _prevTitle = item.title;
const _changed = (_prevContent !== contentAtStart) || (_prevTitle !== titleAtStart);
if (_changed && typeof Store.putAsset === 'function') {
try {
const _vsKey = 'ver:' + item.id + ':' + Date.now() + ':' + Math.random().toString(36).slice(2, 8);
const _put = Store.putAsset(_vsKey, new Blob([String(_prevContent || '')]));
if (_put && typeof _put.then === 'function') await _put;
} catch (e) { console.warn('[autosave] version snapshot failed', e); }
}
const updated = Object.assign({}, item, { content: contentAtStart, title: titleAtStart, lastModified: Date.now() });
try { await Store.put(updated); }
catch (err) {
console.warn('[autosave] store failed', err);
Status.flashSave('save failed');
Toast.error('Autosave failed: ' + (err && err.message ? err.message : err));
return;
}
Object.assign(item, updated);
State.set('libraryItems', (State.get('libraryItems') || []).map(x => x.id === item.id ? updated : x));
Bus.emit('library:changed');
const _titleElNow = main.querySelector('.editor__title');
const _contentSame = readBody() === contentAtStart;
const _titleSame = _titleElNow ? ((_titleElNow.value || item.title) === titleAtStart) : false;
if (_contentSame && _titleSame) { dirty = false; dirtyItem = null; }
Status.flashSave('auto-saved');
}, delay);
Status.flashSave('saving…');
}
// Initial scheduleAutoSave removed — autosave fires on first real input event.
const _tabInserter = (ta) => {
if (!ta || ta._tabBound) return;
ta._tabBound = true;
ta.addEventListener('keydown', e => {
if (e.key === 'Escape') { ta.blur(); return; }
if (e.key !== 'Tab') return;
if (e.ctrlKey || e.metaKey || e.altKey) return;
if (e.isComposing) return;
e.preventDefault();
const s = ta.selectionStart, en = ta.selectionEnd;
if (e.shiftKey) {
const lineStart = ta.value.lastIndexOf('\n', Math.max(0, s - 1)) + 1;
if (ta.value[lineStart] === '\t') {
ta.setRangeText('', lineStart, lineStart + 1, 'end');
ta.dispatchEvent(new Event('input', { bubbles: true }));
}
return;
}
if (ta.selectionStart !== ta.selectionEnd) {
const _sel = ta.value.slice(s, en);
const _indented = _sel.split('\n').map(l => '\t' + l).join('\n');
ta.setRangeText(_indented, s, en, 'select');
ta.dispatchEvent(new Event('input', { bubbles: true }));
return;
}
ta.setRangeText('\t', s, en, 'end');
ta.dispatchEvent(new Event('input', { bubbles: true }));
});
};
_tabInserter(body);
_tabInserter(raw);
body.addEventListener('keydown', e => {
const _ins = activeTextarea();
if (!_ins) return;
const _v = _ins.value;
const _ln = _v.lastIndexOf('\n', _ins.selectionStart - 1) + 1;
const _line = _v.slice(_ln, _ins.selectionStart);
if (e.key === ' ' && !e.isComposing && /^(#{1,6}|[-*>]|\d+\.)$/.test(_line)) {
if (_line.startsWith('#')) return;
if (_ins.selectionStart !== _ins.selectionEnd) return;
e.preventDefault();
if (_line === '-' || _line === '*' || _line === '+') { _ins.setRangeText('', _ln, _ins.selectionStart, 'start'); _ins.setRangeText('- ', _ln, _ln, 'end'); }
else if (_line.startsWith('>')) { _ins.setRangeText('', _ln, _ins.selectionStart, 'start'); _ins.setRangeText('> ', _ln, _ln, 'end'); }
else if (/^\d+\.$/.test(_line)) { _ins.setRangeText('', _ln, _ins.selectionStart, 'start'); _ins.setRangeText('1. ', _ln, _ln, 'end'); }
_ins.dispatchEvent(new Event('input', { bubbles: true }));
return;
}
if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
const nl = _v.slice(_ln, _ins.selectionStart);
if (/^#{1,6}\s/.test(nl)) { e.preventDefault(); _ins.setRangeText('\n', _ins.selectionStart, _ins.selectionEnd, 'end'); _ins.dispatchEvent(new Event('input', { bubbles: true })); }
else if (/^(-|\*|\+)$/.test(nl.trim())) { e.preventDefault(); _ins.setRangeText('', _ln, _ins.selectionStart, 'end'); _ins.setRangeText('\n', _ln, _ln, 'end'); _ins.dispatchEvent(new Event('input', { bubbles: true })); }
else if (/^(-|\*|\+)\s/.test(nl)) { e.preventDefault(); _ins.setRangeText('\n- ', _ins.selectionStart, _ins.selectionEnd, 'end'); _ins.dispatchEvent(new Event('input', { bubbles: true })); }
else if (/^>\s/.test(nl)) { e.preventDefault(); _ins.setRangeText('\n> ', _ins.selectionStart, _ins.selectionEnd, 'end'); _ins.dispatchEvent(new Event('input', { bubbles: true })); }
else if (/^```/.test(nl)) { e.preventDefault(); _ins.setRangeText('\n```\n', _ins.selectionStart, _ins.selectionEnd, 'end'); _ins.dispatchEvent(new Event('input', { bubbles: true })); }
else if (/^---+$/.test(nl)) { e.preventDefault(); _ins.setRangeText('\n', _ins.selectionStart, _ins.selectionEnd, 'end'); _ins.dispatchEvent(new Event('input', { bubbles: true })); }
}
});
if (document.hasFocus() && State.get('currentView') === 'edit') { try { body.focus({ preventScroll: true }); } catch (e) { console.warn('[editor] focus', e); } }
try { if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { console.warn('[editor] scroll reset', e); }
DrawerController.close(true, true);
Status.setMode('edit');
let _seg = null;
try { if (window.Intl && Intl.Segmenter) _seg = new Intl.Segmenter(undefined, { granularity: 'word' }); } catch {}
const recount = () => {
const t = readBody();
let n;
if (_seg) { n = 0; for (const s of _seg.segment(t)) if (s.isWordLike) n++; }
else n = (t.match(/\S+/g) || []).length;
if (typeof Status !== 'undefined' && Status.setWords) Status.setWords(n);
};
body.addEventListener('input', recount);
raw.addEventListener('input', recount);
recount();
if (typeof Status !== 'undefined' && typeof Status.flashSave === 'function') Status.flashSave('editing');
}
async function save(item, content, title) {
if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id) { console.warn('[editor] invalid item'); return false; }
if (typeof content !== 'string') { console.warn('[editor] non-string content'); return false; }
if (content.length > 50 * 1024 * 1024) { console.warn('[editor] content too large'); try { if (typeof Toast !== 'undefined' && typeof Toast.error === 'function') Toast.error('Document too large to save'); } catch (e) { console.warn('[editor] toast', e); } if (typeof Status !== 'undefined' && typeof Status.flashSave === 'function') Status.flashSave('save failed', 'error'); return false; }
if (_openAbort && _openAbort.signal && _openAbort.signal.aborted) { console.warn('[editor] save aborted'); return false; }
if (!Number.isFinite(item.lastModified)) item.lastModified = Date.now();
if (!Number.isFinite(item.createdAt)) item.createdAt = Date.now();
if (!Array.isArray(item._snapshots)) item._snapshots = [];
const _snapshotsBefore = item._snapshots.slice();
const _prevContent = String(item.content || '');
const _prevTitle = String(item.title || '');
const nextTitle = (typeof title === 'string' && title !== '') ? title.slice(0, 300) : _prevTitle;
const changed = _prevContent !== content || _prevTitle !== nextTitle;
  if (!changed) {
  dirty = false;
  dirtyItem = null;
  if (typeof Status !== 'undefined' && Status.flashSave) Status.flashSave('unchanged');
  try { if (typeof Announce !== 'undefined') Announce.polite('No changes'); } catch (e) { console.warn('[editor] announce', e); }
  return true;
  }
if (_saveInFlight) { console.warn('[editor] save already in flight, deferring'); return false; }
  _saveInFlight = true;
  try {
  const _snapshotsAfter = _snapshotsBefore.slice();
  const _MAX_SNAPSHOTS = 50;
  const _MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
  if (_prevContent.length * 2 <= _MAX_SNAPSHOT_BYTES) { _snapshotsAfter.push({ at: Date.now(), content: _prevContent, title: _prevTitle }); }
  while (_snapshotsAfter.length > _MAX_SNAPSHOTS) _snapshotsAfter.shift();
  const before = Object.assign({}, item, { _snapshots: _snapshotsBefore.slice() });
  const _next = Object.assign({}, item, { content, title: nextTitle, lastModified: Date.now(), _snapshots: _snapshotsAfter });
  try { await Store.put(_next); }
catch (err) {
console.warn('[editor] store failed', err);
if (typeof Status !== 'undefined') Status.flashSave('save failed', 'error');
try { if (typeof Toast !== 'undefined') Toast.error('Save failed: ' + (err && err.message ? err.message : err)); } catch (e) { console.warn('[editor] save toast', e); }
return;
}
try { if (window._cwtchSaveBroadcast && typeof window._cwtchSaveBroadcast.postMessage === 'function') window._cwtchSaveBroadcast.postMessage({ id: item.id, at: Date.now() }); } catch (e) { console.warn('[editor] broadcast', e); }
Undo.push({ label: 'Edit ' + String(item.title || '').slice(0, 80), undo: async () => {
const restored = Object.assign({}, item, before);
try { await Store.put(restored); } catch (e) { console.warn('[editor] undo store', e); }
State.set('libraryItems', (State.get('libraryItems') || []).map(x => x.id === item.id ? restored : x));
Bus.emit('library:changed');
} });
  Object.assign(item, _next);
  dirty = false;
  dirtyItem = null;
  State.set('libraryItems', (State.get('libraryItems') || []).map(x => x.id === item.id ? _next : x));
  Bus.emit('library:changed');
  try { if (typeof Toast !== 'undefined') Toast.success('Saved'); } catch {}
  try { if (typeof Status !== 'undefined') Status.flashSave('saved'); } catch {}
  try { if (typeof Announce !== 'undefined') Announce.polite('Saved'); } catch (e) { console.warn('[editor] announce', e); }
  } finally { _saveInFlight = false; }
  }
let _flushQueued = false;
async function flushPendingAutoSave() {
if (_saveInFlight) { _flushQueued = true; return; }
if (!dirtyItem || !dirty) return;
if (_openId !== dirtyItem.id) return;
if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
const _m = document.getElementById('main');
if (!_m || !document.contains(_m)) return;
if (!_m.querySelector('.editor')) { dirty = false; dirtyItem = null; return; }
if (_openAbort && _openAbort.signal && _openAbort.signal.aborted) { dirty = false; dirtyItem = null; return; }
_saveInFlight = true;
try {
const _rawPane = _m.querySelector('#editor-pane-raw');
const _useRaw = _rawPane && !_rawPane.hidden;
const _b = _useRaw
? (_m.querySelector('.editor__raw') || _m.querySelector('.editor__body'))
: _m.querySelector('.editor__body');
const _t = _m.querySelector('.editor__title');
if (!_b || !_t) { dirty = false; dirtyItem = null; return; }
await save(dirtyItem, _b.value, _t.value);
} finally {
_saveInFlight = false;
if (_flushQueued) { _flushQueued = false; try { await flushPendingAutoSave(); } catch (e) { console.warn('[editor] flush reentry', e); } }
}
}
if (typeof window !== 'undefined' && !window._cwtchEditorBeforeUnload) {
window._cwtchEditorBeforeUnload = true;
window.addEventListener('beforeunload', (ev) => {
try {
if (dirty && dirtyItem) {
if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
flushPendingAutoSave().catch(e => console.warn('[editor] beforeunload flush', e));
if (ev && typeof ev.preventDefault === 'function') { ev.preventDefault(); ev.returnValue = ''; return ''; }
}
} catch (e) { console.warn('[editor] beforeunload', e); }
});
window.addEventListener('pagehide', () => { try { if (dirty && dirtyItem) { if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; } flushPendingAutoSave().catch(e => console.warn('[editor] pagehide flush', e)); } } catch (e) { console.warn('[editor] pagehide', e); } });
}
return { open, flushPendingAutoSave, isDirty: () => dirty, dirtyId: () => dirtyItem?.id || null, clearDirty: () => { if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; } dirty = false; dirtyItem = null; } };
})();