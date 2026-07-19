import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../core/events/eventBus.js';
import { ModuleManager } from '../../core/modules/moduleManager.js';
import { SampleModule } from '../../modules/sample/index.js';

function createApplicationContext() {
  const values = new Map();
  const notifications = [];

  const logger = {
    child() { return this; },
    debug() {},
    info() {},
    error() {}
  };

  return {
    logger,
    eventBus: new EventBus(),
    settings: {
      get(key, fallback) {
        return values.has(key) ? values.get(key) : fallback;
      },
      async set(key, value) {
        values.set(key, value);
      }
    },
    notifications: {
      show(message) {
        notifications.push(message);
      }
    },
    testState: { values, notifications }
  };
}

test('sample module completes the full module lifecycle', async () => {
  const context = createApplicationContext();
  const manager = new ModuleManager({
    eventBus: context.eventBus,
    logger: context.logger,
    context
  });
  context.modules = manager;

  const emitted = [];
  context.eventBus.on('sample:enabled', (payload) => emitted.push(['enabled', payload]));
  context.eventBus.on('sample:disabled', (payload) => emitted.push(['disabled', payload]));

  manager.register(new SampleModule());

  assert.equal(manager.getState('sample'), 'registered');

  await manager.enable('sample');

  assert.equal(manager.getState('sample'), 'enabled');
  assert.equal(context.testState.notifications[0], 'Sample module enabled.');
  assert.equal(emitted[0][0], 'enabled');
  assert.equal(emitted[0][1].id, 'sample');

  await manager.unload('sample');

  assert.equal(manager.getState('sample'), 'unloaded');
  assert.equal(emitted[1][0], 'disabled');
  assert.equal(emitted[1][1].id, 'sample');
});

test('sample module honors module-scoped settings', async () => {
  const context = createApplicationContext();
  const manager = new ModuleManager({
    eventBus: context.eventBus,
    logger: context.logger,
    context
  });
  context.modules = manager;

  manager.register(new SampleModule());
  await manager.moduleSettings.set('sample', 'showNotificationOnEnable', false);
  await manager.enable('sample');

  assert.deepEqual(context.testState.notifications, []);
});
