
import { Prefs } from '../core/prefs.js';
import { Flags } from '../core/flags.js';
import { Toast } from '../ui/toast.js';
import { Announce } from '../ui/announce.js';

export const Undo = (() => {
const stack = [];
const redoStack = [];
let _depthCache = null, _depthCacheRaw = null;
function _maxDepth() {
try {
const raw = Prefs.get('setting.editor.undoDepth');
if (_depthCacheRaw === raw && _depthCache != null) return _depthCache;
const v = Number(raw);
_depthCache = Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), 2000) : 200;
_depthCacheRaw = raw;
return _depthCache;
} catch (e) { console.warn('[Undo] depth', e); return 200; }
}
function push(entry) {
if (!entry || typeof entry !== 'object') return;
if (typeof entry.undo !== 'function') { console.warn('[Undo] entry without undo dropped:', entry && entry.label); return; }
if (entry.redo != null && typeof entry.redo !== 'function') { try { delete entry.redo; } catch (e) { entry.redo = undefined; } }
const m = _maxDepth();
stack.push(entry);
const _over = stack.length - m;
if (_over > 0) stack.splice(0, _over);
redoStack.length = 0;
}
let _inProgress = false;
async function undo() {
if (_inProgress) { try { Toast.show('Undo in progress…'); } catch (err) { console.warn('[Undo] toast', err); } return; }
_inProgress = true;
try {
const e = stack.pop();
if (!e) { try { Toast.show('Nothing to undo'); } catch (err) { console.warn('[Undo] toast', err); } return; }
try {
const _res = await e.undo();
if (_res === false) { stack.push(e); return; }
if (typeof e.redo === 'function') redoStack.push(e);
const _safe = String(e.label == null ? 'action' : e.label).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120);
if (e.silent !== true) { try { Toast.success('Undo: ' + _safe); } catch (err) { console.warn('[Undo] toast', err); } try { Announce.polite('Undo: ' + _safe); } catch (x) { console.warn('[Undo] announce', x); } }
}
catch (err) { stack.push(e); console.warn('[Undo]', err); try { Toast.error('Undo failed'); } catch (err2) { console.warn('[Undo] toast', err2); } }
} finally { _inProgress = false; }
}
async function redo() {
if (_inProgress) { try { Toast.show('Redo in progress…'); } catch (err) { console.warn('[Redo] toast', err); } return; }
_inProgress = true;
try {
const e = redoStack.pop();
if (!e || typeof e.redo !== 'function') { try { Toast.show('Nothing to redo'); } catch (err) { console.warn('[Redo] toast', err); } return; }
try {
const _res = await e.redo();
if (_res === false) { redoStack.push(e); return; }
const m = _maxDepth();
const _over = (stack.length + 1) - m;
if (_over > 0) stack.splice(0, _over);
const _rOver = redoStack.length - m;
if (_rOver > 0) redoStack.splice(0, _rOver);
stack.push(e);
const _safe = String(e.label == null ? 'action' : e.label).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120);
try { Toast.success('Redo: ' + _safe); } catch (err) { console.warn('[Redo] toast', err); }
try { Announce.polite('Redo: ' + _safe); } catch (x) { console.warn('[Redo] announce', x); }
}
catch (err) { redoStack.push(e); console.warn('[Redo]', err); try { Toast.error('Redo failed'); } catch (err2) { console.warn('[Redo] toast', err2); } }
} finally { _inProgress = false; }
}
function clear() { if (_inProgress) { console.warn('[Undo] clear during in-progress'); return; } stack.length = 0; redoStack.length = 0; }
function size() { return { undo: stack.length, redo: redoStack.length }; }
function persistEnabled() { try { return Flags.get('persistUndo'); } catch (e) { console.warn('[Undo] flag', e); return false; } }
function peekUndo() { return stack.length ? stack[stack.length - 1] : null; }
function peekRedo() { return redoStack.length ? redoStack[redoStack.length - 1] : null; }
function setMaxDepth(n, skipPersist) {
const v = Number(n);
if (!Number.isFinite(v) || v <= 0) return;
const _newMax = Math.min(Math.round(v), 2000);
_depthCache = _newMax;
_depthCacheRaw = v;
if (!skipPersist) { try { Prefs.set('setting.editor.undoDepth', _newMax); } catch (e) { console.warn('[Undo] persist maxDepth', e); } }
if (stack.length > _newMax) stack.splice(0, stack.length - _newMax);
if (redoStack.length > _newMax) redoStack.splice(0, redoStack.length - _newMax);
}
return { push, undo, redo, clear, size, setMaxDepth, peekUndo, peekRedo, persistEnabled };
})();