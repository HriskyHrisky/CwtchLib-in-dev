
import { Prefs } from '../core/prefs.js';
import { State } from '../core/state.js';
import { Store } from '../core/store.js';
import { Bus } from '../core/bus.js';
import { EVENTS } from '../core/events.js';
import { Toast } from '../ui/toast.js';
import { Announce } from '../ui/announce.js';
import { ViewErrors } from '../core/errors.js';
import { Clock } from '../core/clock.js';

const SRS_DEFAULTS = { startEase: 2.5, easyBonus: 1.3, lapsePenalty: 0.2, maxIntervalDays: 365, HARD_CAP_DAYS: 36500 };

export const ReviewEngine = (() => {
function parseCloze(text) {
if (!text || typeof text !== 'string') return [];
if (text.length > 100000) { console.warn('[srs] cloze source truncated to 100k'); text = text.slice(0, 100000); }
const out = [];
const re = /\{\{c(\d+)::((?:[^{}]|\{(?!\{)|\}(?!\})){1,1000}?)(?:::\s*((?:[^{}]|\{(?!\{)|\}(?!\})){1,1000}?))?\}\}/g;
let m;
let _guard = 0;
re.lastIndex = 0;
while ((m = re.exec(text)) !== null) {
if (++_guard > 10000) { console.warn('[srs] cloze scan guard hit'); break; }
if (out.length >= 500) { console.warn('[srs] cloze cap reached'); break; }
const n = Number(m[1]);
if (!Number.isFinite(n) || n < 1 || n > 100000) continue;
const _t = m[2] == null ? '' : String(m[2]).slice(0, 5000);
const _h = m[3] == null ? null : String(m[3]).slice(0, 5000);
out.push({ n, text: _t, hint: _h });
}
return out;
}
async function createClozeCard(source, back) {
if (!source || typeof source !== 'string' || source.length > 100000) return null;
const clozes = parseCloze(source);
if (!clozes.length) return null;
if (!_cardContentIndex) _getCardIndex();
const _dupMap = _getCardIndex();
const _dupKey = source.trim() + '\u001f' + (typeof back === 'string' ? back : '');
const _existing = _dupMap.get(_dupKey);
if (_existing && _existing.content && /"isCloze"\s*:\s*true/.test(_existing.content)) return _existing;
const _created = await createCard(source, back || '');
if (!_created) return null;
const rec = _created;
if (rec._clozeMarked === true) return rec;
try {
const d = JSON.parse(rec.content);
d.clozes = clozes;
d.isCloze = true;
const _titleBase = String(d.front || source || 'Cloze').replace(/\s+/g, ' ').trim();
const _title = _titleBase.slice(0, 60) || 'Cloze card';
const _up = Object.assign({}, rec, { content: JSON.stringify(d), title: _title, lastModified: Date.now() });
await Store.put(_up);
Object.assign(rec, _up);
State.set('libraryItems', (State.get('libraryItems') || []).map(x => x.id === rec.id ? _up : x));
} catch (e) { console.warn('[srs] cloze patch', e); }
return rec;
}
function getCardStats(card) {
if (!card || typeof card.content !== 'string') return null;
try {
const d = JSON.parse(card.content);
if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
const lastGradeAt = Number(d._lastGradeAt) || Number(d.lastGradeAt) || 0;
const _easeRaw = Number(d.ease);
return {
reps: Math.max(0, Number(d.reps) || 0),
lapses: Math.max(0, Number(d.lapses) || 0),
ease: Number.isFinite(_easeRaw) ? Math.max(1.3, Math.min(3.5, _easeRaw)) : 2.5,
due: Number(d.due) || 0,
interval: Number(d.interval) || 0,
suspended: !!d.suspended,
buriedUntil: Number(d.buriedUntil) || 0,
lastGradeAt
};
} catch (e) { console.warn('[srs] stats parse', e); return null; }
}
function intervalLadder(card) {
const s = getCardStats(card);
if (!s) return [];
const out = [];
let interval = 1;
const ease = Math.max(1.01, Math.min(3.5, Number(s.ease) || 2.5));
let easyBonus = SRS_DEFAULTS.easyBonus;
try {
const v = Number(Prefs.get('setting.srs.easyBonus'));
if (Number.isFinite(v) && v > 1) easyBonus = v;
} catch (e) { console.warn('[srs] easyBonus pref', e); }
const maxDays = (() => {
try {
const raw = Number(Prefs.get('setting.srs.maxIntervalDays'));
if (Number.isFinite(raw) && raw > 0) return Math.min(raw, SRS_DEFAULTS.HARD_CAP_DAYS);
} catch (e) { console.warn('[srs] maxIntervalDays', e); }
return SRS_DEFAULTS.maxIntervalDays;
})();
const _hardCap = SRS_DEFAULTS.HARD_CAP_DAYS || 36500;
for (let i = 0; i < 10; i++) {
out.push(interval);
const growth = ease * (i % 3 === 2 ? easyBonus : 1);
interval = Math.min(maxDays, Math.max(1, Math.round(interval * growth)));
}
return out;
}
let _cardContentIndex = null;
function _getCardIndex() {
const arr = State.get('libraryItems') || [];
let _h = 2166136261;
let _cardCount = 0;
const _cap = Math.min(arr.length, 20000);
for (let i = 0; i < _cap; i++) {
const it = arr[i];
if (it && it.kind === 'card') {
_cardCount++;
const _clen = typeof it.content === 'string' ? it.content.length : 0;
const s = String(it.id || '') + ':' + (it.lastModified || 0) + ':' + _clen;
for (let j = 0; j < s.length; j++) { _h ^= s.charCodeAt(j); _h = Math.imul(_h, 16777619) | 0; }
}
}
const sig = (_h >>> 0) + ':' + _cardCount;
if (_cardContentIndex && _cardContentIndex.sig === sig) return _cardContentIndex.map;
const map = new Map();
for (const it of arr) {
if (!it || it.kind !== 'card' || typeof it.content !== 'string') continue;
try {
const d = JSON.parse(it.content);
const k = (d.front || '') + '\u001f' + (d.back || '');
if (!map.has(k)) map.set(k, it);
} catch (e) { console.warn('[srs] card index parse', it.id, e); }
}
_cardContentIndex = { sig, map };
return map;
}
async function createCard(front, back) {
if (!front || typeof front !== 'string' || !front.trim()) return null;
const _fbLen = front.length + (typeof back === 'string' ? back.length : 0);
if (_fbLen > 200000) { console.warn('[srs] card too large', _fbLen); try { Toast.error('Card too large (max 200k chars combined)'); } catch (e) { console.warn('[srs] toast', e); } return null; }
if (typeof back !== 'string') back = back == null ? '' : String(back).slice(0, 100000);
front = front.trim().slice(0, 100000);
back = back.slice(0, 100000);
const _dupMap = _getCardIndex();
const _dupKey = front + '\u001f' + back;
const _hit = _dupMap.get(_dupKey);
if (_hit) { try { Toast.show('Duplicate card skipped'); } catch (e) { console.warn('[srs] toast', e); } return _hit; }
let _sePref;
try { _sePref = Prefs.get('setting.srs.startEf'); } catch (e) { console.warn('[srs] startEf', e); _sePref = 2.5; }
try { if (window._srsStartEf != null && Number.isFinite(Number(window._srsStartEf))) _sePref = window._srsStartEf; } catch (e) { console.warn('[srs] startEf window', e); }
let _se;
if (_sePref === 'lenient') _se = 2.0;
else if (_sePref === 'standard') _se = 2.5;
else {
const _seNum = Number(_sePref);
_se = (Number.isFinite(_seNum) && _seNum > 1) ? _seNum : 2.5;
}
_se = Math.max(1.3, Math.min(3.5, _se));
const _stepsRaw = Prefs.get('setting.srs.learningSteps') || '1, 10';
const _steps = String(_stepsRaw).split(',').map(s => Number(String(s).trim())).filter(n => Number.isFinite(n) && n > 0).slice(0, 100);
const FIRST_DUE_MS = (_steps.length ? _steps.reduce((a, b) => a < b ? a : b, Infinity) : 10) * 60 * 1000;
let _deck = '';
try {
_deck = String(Prefs.get('setting.srs.defaultDeckName') || 'StudyOS')
.replace(/[\/\\\u0000-\u001f\u007f]/g, '_')
.replace(/\.+$/, '')
.replace(/^\.+/, '')
.slice(0, 80) || 'StudyOS';
} catch (e) { console.warn('[srs] deck', e); _deck = 'StudyOS'; }
const _autoTag = Prefs.get('setting.srs.autoTagNewCards') !== false;
let _tagName = 'StudyOS';
try { _tagName = String(Prefs.get('setting.srs.tagNewCardsWith') || 'StudyOS').replace(/[\/\\\u001f\u0000-\u001f\u007f]/g, '_').slice(0, 80) || 'StudyOS'; } catch (e) { console.warn('[srs] tag', e); }
const _tags = _autoTag && _tagName ? [_tagName] : [];
const _contentStr = JSON.stringify({ front, back, due: Date.now() + FIRST_DUE_MS, ease: _se, reps: 0, lapses: 0, sourceId: (typeof State.get('activeTabId') === 'string' ? State.get('activeTabId') : (typeof State.get('currentDocId') === 'string' ? State.get('currentDocId') : null)) });
const rec = {
id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : 'card-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
title: front.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Card', icon: '🎴', kind: 'card', path: _deck ? _deck + '/' : '',
size: _contentStr.length, lastModified: Date.now(), createdAt: Date.now(),
content: _contentStr,
tags: _tags, starred: false
};
try { await Store.put(rec); }
catch (e) { console.warn('[srs] store failed', e); try { Toast.error('Card creation failed'); } catch (e2) { console.warn('[srs] toast', e2); } return null; }
State.set('libraryItems', [...(State.get('libraryItems') || []), rec]);
Bus.emit(EVENTS.LIBRARY_CHANGED || 'library:changed');
try { Toast.success('Card added'); } catch (e) { console.warn('[srs] toast', e); }
try { Announce.polite('Card added: ' + rec.title); } catch (e) { console.warn('[srs] announce', e); }
invalidateDue();
try { if (typeof HeaderRenderer !== 'undefined' && HeaderRenderer._refreshDueCache) HeaderRenderer._refreshDueCache(); } catch (e) { console.warn('[srs] header refresh', e); }
return rec;
}
let _dueCache = null;
let _dueCacheKey = null;
function _dueKey() {
const arr = Array.isArray(State.get('libraryItems')) ? State.get('libraryItems') : [];
let h = 2166136261;
let cardCount = 0;
for (const it of arr) {
if (!it || it.kind !== 'card' || typeof it.id !== 'string') continue;
cardCount++;
const _dueVal = (() => { try { const _d = JSON.parse(it.content || '{}'); return Number(_d && _d.due) || 0; } catch (e) { return 0; } })();
const s = it.id + ':' + (it.lastModified || 0) + ':' + (typeof it.content === 'string' ? it.content.length : 0) + ':' + _dueVal + ':' + (it.contentHash || '');
for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) | 0; }
h = (h + 0x01000193) | 0;
}
return String(h >>> 0) + ':' + arr.length + ':' + cardCount;
}
function invalidateDue() { _dueCache = null; _dueCacheKey = null; }
let _duePersistQueued = false;
function getDue() {
const _newLimRaw = (window._srsNewCardLimit != null) ? Number(window._srsNewCardLimit) : Number(Prefs.get('setting.srs.newCardLimit'));
const _newLim = Math.max(0, Math.min(5000, Number.isFinite(_newLimRaw) ? _newLimRaw : 20));
const _revLimRaw = (window._srsReviewLimit != null) ? Number(window._srsReviewLimit) : Number(Prefs.get('setting.srs.reviewLimit'));
const _revLim = Math.max(0, Math.min(5000, Number.isFinite(_revLimRaw) ? _revLimRaw : 200));
const _newOn = Prefs.get('setting.srs.newCardsEnabled') !== false;
const _revOn = Prefs.get('setting.srs.reviewsEnabled') !== false;
const _k = _dueKey() + '|n:' + _newLim + '|r:' + _revLim + '|ne:' + String(_newOn) + '|re:' + String(_revOn);
if (_dueCache && _dueCacheKey === _k) return _dueCache.slice();
const _now = Clock.now();
const _new = [], _due = [];
const _persistUpdates = [];
for (const it of (State.get('libraryItems') || [])) {
if (!it || it.kind !== 'card' || typeof it.content !== 'string') continue;
try {
const d = JSON.parse(it.content);
if (!d || typeof d !== 'object') continue;
if (d.suspended === true) continue;
let _mutated = false;
if (typeof d.buriedUntil === 'number' && d.buriedUntil > 0) {
if (d.buriedUntil > _now) continue;
d.buriedUntil = 0;
_mutated = true;
}
if (typeof d.due !== 'number' || !Number.isFinite(d.due)) { d.due = _now; _mutated = true; }
if (d.due > _now) continue;
if (d.due < _now - 365 * 24 * 60 * 60 * 1000) { d.due = _now; _mutated = true; }
if (!Number.isFinite(d.ease) || d.ease < 1.3) { d.ease = 2.5; _mutated = true; }
if (_mutated) {
const _u = Object.assign({}, it, { content: JSON.stringify(d) });
_persistUpdates.push(_u);
}
(Number(d.reps) > 0 ? _due : _new).push({ it, due: d.due });
} catch (e) { console.warn('[srs] parse due', it.id, e); }
}
if (_persistUpdates.length && !_duePersistQueued) {
_duePersistQueued = true;
const _snapshot = _persistUpdates.slice();
queueMicrotask(async () => {
try {
for (const u of _snapshot) {
try { await Store.put(u); } catch (e) { console.warn('[srs] persist due fix', u.id, e); }
}
const _updateMap = new Map(_snapshot.map(u => [u.id, u]));
State.set('libraryItems', (State.get('libraryItems') || []).map(x => { const _u = _updateMap.get(x.id); return _u ? Object.assign({}, x, _u) : x; }));
_dueCache = null; _dueCacheKey = null;
} finally { _duePersistQueued = false; }
});
}
_new.sort((a, b) => a.due - b.due);
_due.sort((a, b) => a.due - b.due);
const out = [
...(_newOn ? _new.slice(0, _newLim).map(x => x.it) : []),
...(_revOn ? _due.slice(0, _revLim).map(x => x.it) : []),
];
_dueCache = out;
_dueCacheKey = _k;
return out;
}
function _maxIntervalMs() {
let _days = SRS_DEFAULTS.maxIntervalDays;
try {
const raw = Number(Prefs.get('setting.srs.maxIntervalDays'));
if (Number.isFinite(raw) && raw > 0) _days = Math.min(raw, SRS_DEFAULTS.HARD_CAP_DAYS);
} catch (e) { console.warn('[srs] maxIntervalDays', e); }
_days = Math.min(_days, SRS_DEFAULTS.HARD_CAP_DAYS);
return Math.max(24 * 60 * 60 * 1000, _days * 24 * 60 * 60 * 1000);
}
async function grade(card, quality) {
if (!card || typeof card !== 'object' || typeof card.content !== 'string' || typeof card.id !== 'string' || !card.id) return false;
if (!Object.prototype.hasOwnProperty.call(grade, '_inFlight')) grade._inFlight = new Set();
if (grade._inFlight.has(card.id)) { console.warn('[srs] grade already in flight for card', card.id); return false; }
grade._inFlight.add(card.id);
try {
let d;
try { d = JSON.parse(card.content); } catch (e) { console.warn('[srs] parse fail', e); return false; }
if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
const _rawF = Number(quality);
if (!Number.isFinite(_rawF)) { console.warn('[srs] grade non-finite', quality); return false; }
const _raw = Math.round(_rawF);
if (_raw < 1 || _raw > 4) { console.warn('[srs] grade out of range', quality); return false; }
if (d.suspended) { console.warn('[srs] grade on suspended card ignored'); return false; }
const _easeNum = Number(d.ease);
if (!Number.isFinite(_easeNum)) d.ease = 2.5;
if (window._srsAutoDifficulty && Number.isFinite(d._lastRevealAt)) {
const _answerMs = Clock.now() - d._lastRevealAt;
if (_answerMs > 20000 && _raw > 3) d.ease = Math.max(1.3, d.ease - 0.05);
}
if (_raw === 4 && Number.isFinite(d._lastRevealAt) && (Clock.now() - d._lastRevealAt) < 1500) d.ease = Math.max(1.3, d.ease - 0.02);
const _nowMs = Clock.now();
if (Number.isFinite(d._lastGradeAt) && (_nowMs - d._lastGradeAt) < 100) { console.warn('[srs] grade debounced'); return; }
d._lastGradeAt = _nowMs;
const uiQ = Math.max(1, _raw);
if (uiQ > 4) { console.warn('[srs] grade clamped'); return; }
const gradeSM2 = uiQ === 1 ? 0 : uiQ === 2 ? 3 : uiQ === 3 ? 4 : 5;
const lapse = gradeSM2 < 3;
const startEase = (() => {
const raw = Prefs.get('setting.srs.startEf');
if (raw === 'lenient') return 2.0;
if (raw === 'standard') return 2.5;
const v = Number(raw);
return Number.isFinite(v) && v > 1 ? v : SRS_DEFAULTS.startEase;
})();
const easyBonus = (() => {
const v = Number(Prefs.get('setting.srs.easyBonus'));
return Number.isFinite(v) && v > 1 ? v : SRS_DEFAULTS.easyBonus;
})();
const lapsePenalty = (() => {
const v = Number(Prefs.get('setting.srs.lapsePenalty'));
return Number.isFinite(v) && v >= 0 ? v : SRS_DEFAULTS.lapsePenalty;
})();
d.ease = Number.isFinite(d.ease) ? d.ease : startEase;
d.lapses = Number(d.lapses) || 0;
if (lapse) {
d.lapses += 1;
d.reps = 0;
d.ease = Math.max(1.3, d.ease - lapsePenalty);
} else {
d.reps = (d.reps || 0) + 1;
if (gradeSM2 === 5) d.ease = Math.min(3.5, d.ease + 0.15);
else if (gradeSM2 === 3) d.ease = Math.max(1.3, d.ease - 0.15);
}
if (grade._inFlight) grade._inFlight.delete(card.id);
const MIN = 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const _learnStepsRaw = Prefs.get('setting.srs.learningSteps') || '1, 10';
const _learnSteps = String(_learnStepsRaw).split(',').map(s => Number(String(s).trim())).filter(n => Number.isFinite(n) && n > 0).slice(0, 100);
const _reps = Number(d.reps) || 0;
let interval;
if (lapse) {
const _fallback = _learnSteps.length ? _learnSteps.reduce((a, b) => a < b ? a : b, Infinity) * 60 * 1000 : 10 * 60 * 1000;
interval = Math.max(60 * 1000, _fallback * (1 + lapsePenalty * 5));
} else if (_learnSteps.length && _reps >= 1 && _reps <= _learnSteps.length) {
const _idx = Math.max(0, _reps - 1);
interval = (_learnSteps[_idx] || _learnSteps[_learnSteps.length - 1] || 10) * 60 * 1000;
} else if (_reps === _learnSteps.length + 1) interval = DAY;
else if (_reps === _learnSteps.length + 2) interval = 6 * DAY;
else interval = Math.round(Math.max(1, _reps - _learnSteps.length - 1) * DAY * d.ease * (gradeSM2 === 5 ? easyBonus : 1));
const _capMs = _maxIntervalMs();
interval = Math.max(MIN, Math.min(_capMs, interval));
const _fuzz = interval > DAY ? (0.95 + Math.random() * 0.1) : 1;
const _finalInterval = Math.max(MIN, Math.min(_capMs, Math.round(interval * _fuzz)));
d.due = Clock.now() + _finalInterval;
d.interval = _finalInterval;
d._lastGradeAt = _nowMs;
const _updated = Object.assign({}, card, { content: JSON.stringify(d), lastModified: Date.now() });
try { await Store.put(_updated); } catch (e) { console.warn('[srs] store failed', e); try { if (typeof Toast !== 'undefined') Toast.error('Failed to save review'); } catch (e2) { console.warn('[srs] toast', e2); } return; }
Object.assign(card, _updated);
const _arr = (State.get('libraryItems') || []).map(x => x.id === _updated.id ? _updated : x);
State.set('libraryItems', _arr);
invalidateDue();
try { if (typeof HeaderRenderer !== 'undefined' && typeof HeaderRenderer._refreshDueCache === 'function') HeaderRenderer._refreshDueCache(); } catch (e) { console.warn('[srs] header refresh', e); }
Bus.emit(EVENTS.LIBRARY_CHANGED || 'library:changed');
} finally {
if (grade._inFlight) grade._inFlight.delete(card.id);
}
return { createCard, createClozeCard, parseCloze, getCardStats, intervalLadder, getDue, grade, invalidateDue, _resetDueCache: () => { _dueCache = null; _dueCacheKey = null; } };
})();