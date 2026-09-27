// View-scoped error handler. Falls back to Toast + Announce.
import { Toast } from '../ui/toast.js';
import { Announce } from '../ui/announce.js';

export const ViewErrors = (() => {
  const _handlers = new Map();

  function register(view, fn) {
    if (typeof view !== 'string' || !view || view.length > 64) return;
    if (typeof fn !== 'function') return;
    _handlers.set(view, fn);
  }

  function unregister(view) { _handlers.delete(view); }

  function handle(view, err) {
    const msg = String(err && err.message ? err.message : err || 'unknown').slice(0, 500);
    console.warn('[view-error]', view, msg);
    const fn = _handlers.get(view);
    if (fn) {
      try { fn(err); return; }
      catch (e) { console.warn('[view-error] handler threw', e); }
    }
    try { Toast.error('Error in ' + view + ': ' + msg); } catch (e) { console.warn('[view-error] toast', e); }
    try { Announce.assertive('Error in ' + view); } catch (e) { console.warn('[view-error] announce', e); }
  }

  function wrap(view, fn) {
    if (typeof fn !== 'function') return fn;
    return function wrapped() {
      try { return fn.apply(this, arguments); }
      catch (e) { handle(view, e); return undefined; }
    };
  }

  function list() { return Array.from(_handlers.keys()); }

  return { register, unregister, handle, wrap, list };
})();