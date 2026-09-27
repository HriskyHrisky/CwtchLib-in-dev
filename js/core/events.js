// Event name constants. Single source of truth for Bus emits.
export const EVENTS = Object.freeze({
  LIBRARY_CHANGED: 'library:changed',
  LIBRARY_ITEMS: 'state:libraryItems',
  CURRENT_VIEW: 'state:currentView',
  TABS_CHANGED: 'tabs:changed',
  DRAWER_CLOSED: 'drawer:closed',
  LEVEL_CHANGED: 'level:changed',
  FLAGS_CHANGED: 'flags:changed',
  PERMISSION_GRANTED: 'permission:granted',
  PLUGIN_REGISTERED: 'plugin:registered',
  PLUGIN_UNREGISTERED: 'plugin:unregistered',
  TELEMETRY: 'telemetry:record'
});

const _VALUES = Object.values(EVENTS);
const _SET = new Set(_VALUES);

export function isEvent(name) {
  if (typeof name !== 'string') return false;
  return _SET.has(name);
}

export function assertEvent(name) {
  if (isEvent(name)) return true;
  console.warn('[events] unknown event name:', String(name).slice(0, 64));
  return false;
}