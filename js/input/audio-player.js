
import { Prefs } from '../core/prefs.js';
import { State } from '../core/state.js';
import { Store } from '../core/store.js';

export const AudioPlayer = (() => {
let el, playBtn, titleEl, fillEl;
let playlist = [];
let idx = -1;
let _initDone = false;
let _destroyed = false;
let _restoreTimer = null;
let _audioListeners = [];
function init() {
if (_initDone) return;
_destroyed = false;
if (typeof document === 'undefined') return;
el = document.getElementById('audioEl');
playBtn = document.getElementById('audioPlay');
titleEl = document.getElementById('audioTitle');
fillEl = document.getElementById('audioFill');
const panel = document.getElementById('audioPlayer');
if (!el || !panel) { console.info('[audio] player not mounted'); return; }
let _initEnabled = true;
try { const _ae = Prefs.get('setting.audio.enabled'); _initEnabled = _ae !== false && _ae !== 'false'; } catch (e) { console.warn('[audio] init pref', e); }
if (!_initEnabled) { panel.hidden = true; return; }
if (el.dataset && el.dataset.audioBound === '1') { _initDone = true; return; }
if (el.dataset) el.dataset.audioBound = '1';
_initDone = true;
_audioListeners = [];
const _bind = (t, ev, fn) => { t.addEventListener(ev, fn); _audioListeners.push([t, ev, fn]); };
try { if (Prefs.get('setting.audio.enabled') === false) { panel.hidden = true; } } catch (e) { console.warn('[audio] enabled pref', e); }
let _savedTrack = null;
try { _savedTrack = Prefs.get('audio.lastTrack'); } catch (e) { console.warn('[audio] lastTrack', e); }
let _restoreOnLoad = false;
try { _restoreOnLoad = Prefs.get('audio.restoreOnLoad') === true; } catch (e) { console.warn('[audio] restoreOnLoad', e); }
if (_savedTrack && _restoreOnLoad) {
let _resumed = false;
const resume = () => {
if (_resumed) return;
_resumed = true;
try { window.removeEventListener('pointerdown', resume); } catch (e) { console.warn('[audio] rm pointerdown', e); }
try { window.removeEventListener('keydown', resume); } catch (e) { console.warn('[audio] rm keydown', e); }
if (_restoreTimer) { clearTimeout(_restoreTimer); _restoreTimer = null; }
const it = (State.get('libraryItems') || []).find(x => x && x.id === _savedTrack);
if (it) Promise.resolve(play(it)).catch(e => console.warn('[audio] restore failed', e));
};
window.addEventListener('pointerdown', resume, { once: true });
window.addEventListener('keydown', resume, { once: true });
_restoreTimer = setTimeout(() => {
try { window.removeEventListener('pointerdown', resume); } catch (e) { console.warn('[audio] remove pointerdown', e); }
try { window.removeEventListener('keydown', resume); } catch (e) { console.warn('[audio] remove keydown', e); }
_restoreTimer = null;
}, 5 * 60 * 1000);
}
if (playBtn) _bind(playBtn, 'click', togglePlay);
const _prevBtn = document.getElementById('audioPrev');
if (_prevBtn) _bind(_prevBtn, 'click', prev);
const _nextBtn = document.getElementById('audioNext');
if (_nextBtn) _bind(_nextBtn, 'click', next);
const _closeBtnA = document.getElementById('audioClose');
if (_closeBtnA) _bind(_closeBtnA, 'click', () => {
try { el.pause(); } catch (e) { console.warn('[audio]', e); }
if (el._assetUrl) { try { URL.revokeObjectURL(el._assetUrl); } catch (e) { console.warn('[audio]', e); } el._assetUrl = null; }
try { el.removeAttribute('src'); } catch {}
panel.hidden = true;
try { Prefs.remove('audio.lastTrack'); } catch (e) { console.warn('[audio]', e); }
try { el.load(); } catch (e) { console.warn('[audio]', e); }
});
_bind(el, 'ended', () => { try { next(); } catch (e) { console.warn('[audio] ended', e); } });
_bind(el, 'play', syncPlayLabel);
_bind(el, 'pause', syncPlayLabel);
let _volWriteTimer = null;
_bind(el, 'volumechange', () => { try { if (Number.isFinite(el.volume)) { clearTimeout(_volWriteTimer); _volWriteTimer = setTimeout(() => { _volWriteTimer = null; try { Prefs.set('audio.lastVolume', el.volume); } catch (e2) { console.warn('[audio] lastVolume write', e2); } }, 200); } } catch (e) { console.warn('[audio] lastVolume', e); } });
_bind(el, 'timeupdate', () => {
if (!fillEl) return;
if (Number.isFinite(el.duration) && el.duration > 0 && Number.isFinite(el.currentTime)) {
const pct = Math.max(0, Math.min(100, (el.currentTime / el.duration) * 100));
fillEl.style.width = pct + '%';
fillEl.setAttribute('aria-valuenow', String(Math.round(pct)));
}
});
_bind(el, 'error', () => {
const _code = el.error && el.error.code;
const _map = { 1: 'aborted', 2: 'network', 3: 'decode', 4: 'src-not-supported' };
const _reason = _map[_code] || 'unknown';
if (titleEl) titleEl.textContent = 'Audio failed (' + _reason + ')';
try { if (window.Cwtch && window.Cwtch.Toast && window.Cwtch.Toast.error) window.Cwtch.Toast.error('Audio failed: ' + _reason); } catch (e) { console.warn('[audio] error toast', e); }
syncPlayLabel();
});
}
async function play(item, _depth) {
const _d = _depth || 0;
if (_d > 5) { console.warn('[audio] play recursion cap'); return; }
if (_destroyed) return;
const panel = document.getElementById('audioPlayer');
if (!el || !item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id) return;
if (typeof el._urlKept !== 'boolean') el._urlKept = false;
if (item.path && /^(javascript:|data:text\/html|vbscript:|file:)/i.test(String(item.path).slice(0, 2000))) { console.warn('[audio] refusing unsafe path'); return; }
if (idx >= 0 && playlist[idx] && playlist[idx].id === item.id) {
if (el.paused) { const _p = el.play(); if (_p && typeof _p.catch === 'function') _p.catch(e => console.warn('[audio] play', e)); }
else { try { el.pause(); } catch (e) { console.warn('[audio] pause', e); } }
return;
}
if (!playlist.find(x => x.id === item.id)) {
while (playlist.length >= 100) playlist.shift();
playlist.push(item);
}
if (idx < 0 || !playlist[idx] || playlist[idx].id !== item.id) idx = playlist.findIndex(x => x.id === item.id);
if (idx < 0) idx = 0;
if (panel) panel.hidden = false;
try { if (typeof Prefs.set === 'function') Prefs.set('audio.lastTrack', item.id); } catch (e) { console.warn('[audio] lastTrack write', e); }
let src = null;
if (item.assetKey) {
try { const blob = await Store.getAsset(item.assetKey); if (blob) src = URL.createObjectURL(blob); }
catch (e) { console.warn('[audio] asset load failed', e); }
}
if (!src && item.path && /^(https?:|blob:|data:audio\/)/i.test(item.path)) {
if (/^(javascript:|vbscript:|data:text\/html|file:)/i.test(item.path)) src = null;
else src = item.path;
}
if (!src) {
if (titleEl) titleEl.textContent = 'Audio unavailable: ' + String(item.title || '').slice(0, 200);
if (panel) panel.hidden = false;
if (playlist.length > 1) {
const start = idx;
const _seen = new Set([start]);
for (let step = 1; step < playlist.length; step++) {
const _nextIdx = (idx + step) % playlist.length;
if (_seen.has(_nextIdx)) break;
_seen.add(_nextIdx);
const nxt = playlist[_nextIdx];
if (!nxt) { console.warn('[audio] playlist entry missing', _nextIdx); continue; }
if (nxt.path && /^javascript:/i.test(nxt.path)) continue;
if (!nxt.assetKey && !/^(https?:|blob:|data:)/.test(nxt.path || '')) continue;
idx = _nextIdx;
return play(nxt, _d + 1);
}
}
return;
}
const oldUrl = el._assetUrl;
if (!src || typeof src !== 'string') { if (titleEl) titleEl.textContent = 'Audio source invalid'; return; }
try { el.currentTime = 0; } catch (e) { console.warn('[audio] currentTime reset', e); }
el.src = src;
el._assetUrl = /^blob:/i.test(src) ? src : null;
el._urlKept = !/^blob:/i.test(src);
try { el.load(); } catch (e) { console.warn('[audio] load', e); }
if (oldUrl && oldUrl !== src && /^blob:/i.test(oldUrl)) {
setTimeout(() => { try { URL.revokeObjectURL(oldUrl); } catch (e) { console.warn('[audio] revoke old', e); } }, 5000);
}
if (titleEl) titleEl.textContent = String(item.title || 'Audio').slice(0, 200);
if (panel) panel.hidden = false;
try { await el.play(); } catch (err) {
console.warn('[audio] playback failed', err);
try { if (window.Cwtch && window.Cwtch.Toast) window.Cwtch.Toast.error('Playback failed: ' + (err && err.name ? err.name : 'unknown')); } catch (e) { console.warn('[audio] toast', e); }
syncPlayLabel();
}
}
function syncPlayLabel() {
if (!playBtn || !playBtn.isConnected) return;
if (el && !el.paused && !el.ended) { playBtn.textContent = '⏸'; playBtn.setAttribute('aria-label', 'Pause'); }
else { playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', 'Play'); }
}
function togglePlay() {
if (!el) return;
if (el.paused || el.ended) { Promise.resolve(el.play()).catch(e => console.warn('[audio] play', e)); }
else { try { el.pause(); } catch (e) { console.warn('[audio] pause', e); } }
syncPlayLabel();
}
function next() {
if (_destroyed || !el || !playlist.length) return;
if (idx === -1) idx = 0;
else if (playlist.length === 1) { try { el.currentTime = 0; Promise.resolve(el.play()).catch(err => console.warn('[audio] replay', err)); } catch (e) { console.warn('[audio]', e); } return; }
else idx = (idx + 1) % playlist.length;
const _it = playlist[idx];
if (_it) Promise.resolve(play(_it)).catch(err => console.warn('[audio] next', err));
else { console.warn('[audio] next: no track'); syncPlayLabel(); }
}
function prev() {
if (_destroyed || !el || !playlist.length) return;
if (idx === -1) idx = 0;
else if (playlist.length === 1) { try { el.currentTime = 0; Promise.resolve(el.play()).catch(err => console.warn('[audio] replay', err)); } catch (e) { console.warn('[audio]', e); } return; }
else idx = (idx - 1 + playlist.length) % playlist.length;
const _it = playlist[idx];
if (_it) Promise.resolve(play(_it)).catch(err => console.warn('[audio] prev', err));
else { console.warn('[audio] prev: no track'); syncPlayLabel(); }
}
function setPlaylist(items) {
if (!Array.isArray(items)) return;
const _currentId = (idx >= 0 && playlist[idx]) ? playlist[idx].id : null;
const _seen = new Set();
playlist = items.filter(x => {
if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id || x.id.length > 200) return false;
if (_seen.has(x.id)) return false;
_seen.add(x.id);
return true;
}).slice(0, 200);
if (playlist.length === 0) { idx = -1; if (titleEl) titleEl.textContent = 'No audio'; const _panel = document.getElementById('audioPlayer'); if (_panel) _panel.hidden = true; if (el) { try { el.pause(); if (el._assetUrl && !el._urlKept) { try { URL.revokeObjectURL(el._assetUrl); } catch (e2) { console.warn('[audio] revoke', e2); } } el._assetUrl = null; el._urlKept = false; el.removeAttribute('src'); el.load(); } catch (e) { console.warn('[audio] pause empty', e); } } return; }
const _stillPresent = _currentId && playlist.findIndex(x => x.id === _currentId) >= 0;
if (_currentId && !_stillPresent) {
if (el) { try { el.pause(); if (el._assetUrl && !el._urlKept) { try { URL.revokeObjectURL(el._assetUrl); } catch (e2) { console.warn('[audio] revoke', e2); } } el._assetUrl = null; el._urlKept = false; el.removeAttribute('src'); el.load(); } catch (e) { console.warn('[audio] pause removed', e); } }
if (titleEl) titleEl.textContent = 'No audio';
idx = -1;
} else if (_currentId) {
idx = playlist.findIndex(x => x.id === _currentId);
} else {
idx = Math.max(0, Math.min(idx, playlist.length - 1));
}
}
function destroy() {
if (_destroyed) return;
_destroyed = true;
const _oldEl = el;
if (_oldEl) {
try { _oldEl.pause(); } catch (e) { console.warn('[audio] pause', e); }
if (_oldEl._assetUrl && !_oldEl._urlKept) { try { URL.revokeObjectURL(_oldEl._assetUrl); } catch (e) { console.warn('[audio] revoke', e); } }
_oldEl._assetUrl = null;
try { _oldEl.removeAttribute('src'); _oldEl.load(); } catch (e) { console.warn('[audio] teardown src', e); }
if (_oldEl.dataset) _oldEl.dataset.audioBound = '0';
}
_audioListeners.forEach(([t, ev, fn]) => { try { t.removeEventListener(ev, fn); } catch (e) { console.warn('[audio] removeListener', e); } });
_audioListeners = [];
if (_restoreTimer) { clearTimeout(_restoreTimer); _restoreTimer = null; }
playlist = []; idx = -1; _initDone = false; el = null; playBtn = null; titleEl = null; fillEl = null;
}
return { init, play, setPlaylist, destroy, isPlaying: () => el ? !el.paused : false };
})();