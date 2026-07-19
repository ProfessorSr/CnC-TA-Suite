import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../core/events/eventBus.js';
import { ModuleEvents } from '../../core/modules/moduleEvents.js';
import { ModulePermissions } from '../../core/modules/modulePermissions.js';

test('ModuleEvents tracks and clears subscriptions', () => {
  const eventBus = new EventBus();
  const permissions = new ModulePermissions();
  permissions.register('sample', ['events']);
  const events = new ModuleEvents({ eventBus, moduleId: 'sample', permissions });
  let calls = 0;
  events.on('test', () => { calls += 1; });
  eventBus.emit('test');
  events.clear();
  eventBus.emit('test');
  assert.equal(calls, 1);
  assert.equal(events.size, 0);
});
