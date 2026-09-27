// Canonical schema for events emitted on the Bus.
import { EVENTS } from './events.js';

export const EventSchema = Object.freeze({
  [EVENTS.LIBRARY_CHANGED]: { fields: [], desc: 'Library contents changed' },
  [EVENTS.LIBRARY_ITEMS]: { fields: ['value'], desc: 'libraryItems state updated' },
  [EVENTS.CURRENT_VIEW]: { fields: ['value'], desc: 'View transitioned' },
  [EVENTS.TABS_CHANGED]: { fields: ['openTabs'], desc: 'Open tabs updated' },
  [EVENTS.DRAWER_CLOSED]: { fields: ['id'], desc: 'Drawer dismissed' },
  [EVENTS.LEVEL_CHANGED]: { fields: [], desc: 'Level system updated' },
  [EVENTS.FLAGS_CHANGED]: { fields: ['name', 'value'], desc: 'Feature flag toggled' },
  [EVENTS.PERMISSION_GRANTED]: { fields: ['name'], desc: 'Permission granted' },
  [EVENTS.PLUGIN_REGISTERED]: { fields: ['id', 'version'], desc: 'Plugin registered' },
  [EVENTS.PLUGIN_UNREGISTERED]: { fields: ['id'], desc: 'Plugin removed' },
  [EVENTS.TELEMETRY]: { fields: ['name', 'meta'], desc: 'Telemetry event' }
});

export function validate(name, detail) {
  const schema = EventSchema[name];
  if (!schema) return { ok: false, reason: 'unknown-event' };
  const d = detail && typeof detail === 'object' ? detail : {};
  const missing = (schema.fields || []).filter(f => !(f in d));
  if (missing.length) return { ok: false, reason: 'missing-fields', missing };
  return { ok: true };
}