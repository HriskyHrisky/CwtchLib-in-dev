
import { Prefs } from '../core/prefs.js';
import { State } from '../core/state.js';
import { Store } from '../core/store.js';
import { Bus } from '../core/bus.js';
import { EVENTS } from '../core/events.js';
import { Telemetry } from '../core/telemetry.js';
import { Toast } from '../ui/toast.js';
import { Announce } from '../ui/announce.js';

export const NoteEngine = (() => {
async function create(text) {
if (!text || typeof text !== 'string') { try { Toast.show('Note is empty'); } catch (e) { console.warn('[note] toast', e); } return null; }
if (text.length > 2 * 1024 * 1024) { try { Toast.error('Note too large (>2MB)'); } catch (e) { console.warn('[note] toast', e); } return null; }
const _byteLen = (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(text).length : text.length;
if (_byteLen > 2 * 1024 * 1024) { try { Toast.error('Note too large (>2MB)'); } catch (e) { console.warn('[note] toast', e); } return null; }
if (!text.trim()) { try { Toast.show('Note is empty'); } catch (e) { console.warn('[note] toast', e); } return null; }
const _MAX_TITLE = 80;
const _firstLineRaw = (text.split('\n')[0] || 'Note');
const _raw = _firstLineRaw.trim();
const _stripped = _raw
.replace(/^#{1,6}\s+/, '')
.replace(/^[-*>]+\s*/, '')
.replace(/^\s+/, '')
.replace(/\s+$/, '')
.replace(/[.,;:!?]+$/, '');
const _firstLine = _stripped.trim() || 'Note';
const _truncTitle = _firstLine.length > _MAX_TITLE ? (_firstLine.slice(0, _MAX_TITLE).replace(/\s+\S*$/, '') || _firstLine.slice(0, _MAX_TITLE)) : _firstLine;
const _title = _truncTitle || 'Note';
const _id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : 'note-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
const rec = {
id: _id,
title: _title,
icon: '📝', kind: 'note', path: '',
size: (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).length : text.length), lastModified: Date.now(), createdAt: Date.now(),
content: text, tags: [], starred: false,
level: 0
};
try { await Store.put(rec); }
catch (e) { try { if (typeof Toast !== 'undefined') Toast.error('Note creation failed: ' + (e && e.message ? e.message : e)); } catch {} return null; }
State.set('libraryItems', [...(State.get('libraryItems') || []), rec]);
Bus.emit(EVENTS.LIBRARY_CHANGED || 'library:changed');
try { Telemetry.record('note.created', { kind: 'note' }); } catch (e) { console.warn('[note] telemetry', e); }
try { if (typeof Toast !== 'undefined') Toast.success('Note created'); } catch {}
try { if (typeof Announce !== 'undefined') Announce.polite('Note created: ' + rec.title); } catch (e) { console.warn('[note] announce', e); }
return rec;
}
async function openDaily() {
let folder = 'Daily';
try { folder = String(Prefs.get('setting.library.dailyNoteFolder') || 'Daily').trim() || 'Daily'; } catch (e) { console.warn('[note] dailyFolder', e); }
folder = folder.replace(/[\/\\\u0000-\u001f\u007f]+/g, '_').replace(/^\.+/, '').replace(/\.+$/, '').slice(0, 80) || 'Daily';
const now = new Date();
const _pad = n => String(n).padStart(2, '0');
const iso = now.getFullYear() + '-' + _pad(now.getMonth() + 1) + '-' + _pad(now.getDate());
const items = State.get('libraryItems') || [];
const _targetPath = folder ? folder + '/' : '';
const _normPath = p => String(p || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '');
const _tpNorm = _normPath(_targetPath);
const _isoNorm = String(iso).trim().toLowerCase();
const existing = items.find(i => i && i.kind === 'note' && _normPath(i.path) === _tpNorm && (String(i.title || '').trim().toLowerCase() === _isoNorm || (typeof i.dailyDate === 'string' && i.dailyDate === iso)));
if (existing) return existing;
const text = '# ' + iso + '\n\n';
const _id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : 'note-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
const _size = (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).length : text.length);
const rec = {
id: _id, title: iso, icon: '📝', kind: 'note',
path: folder ? folder + '/' : '',
size: _size, lastModified: Date.now(), createdAt: Date.now(),
content: text, tags: [], starred: false, level: 0,
dailyDate: iso
};
try { await Store.put(rec); } catch (e) { Toast.error('Daily note creation failed: ' + (e && e.message ? e.message : e)); return null; }
State.set('libraryItems', [...(State.get('libraryItems') || []), rec]);
Bus.emit('library:changed');
Toast.success('Daily note created');
try { Announce.polite('Daily note: ' + rec.title); } catch (e) { console.warn('[note] announce', e); }
return rec;
}
return { create, openDaily };
})();