import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../core/events/eventBus.js';
import { Module } from '../../core/interfaces/module.js';
import { ModuleManager } from '../../core/modules/moduleManager.js';

const testManifest = Object.freeze({
  id: 'lifecycle-fixture',
  name: 'Lifecycle Fixture',
  version: '1.0.0',
  apiVersion: '1.0.0',
  permissions: Object.freeze(['events', 'notifications', 'settings']),
  settings: Object.freeze({
    showNotificationOnEnable: Object.freeze({ type: 'boolean', default: true })
  })
});

class LifecycleFixtureModule extends Module {
  constructor() { super(testManifest); }
  async enable(context) {
    context.events.emit('fixture:enabled', { id: this.id });
    if (context.moduleSettings.get('showNotificationOnEnable', true)) {
      context.notifications.show('Lifecycle fixture enabled.');
    }
  }
  async disable(context) { context.events.emit('fixture:disabled', { id: this.id }); }
}

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

test('a module completes the full module lifecycle', async () => {
  const context = createApplicationContext();
  const manager = new ModuleManager({
    eventBus: context.eventBus,
    logger: context.logger,
    context
  });
  context.modules = manager;

  const emitted = [];
  context.eventBus.on('fixture:enabled', (payload) => emitted.push(['enabled', payload]));
  context.eventBus.on('fixture:disabled', (payload) => emitted.push(['disabled', payload]));

  manager.register(new LifecycleFixtureModule());

  assert.equal(manager.getState('lifecycle-fixture'), 'registered');

  await manager.enable('lifecycle-fixture');

  assert.equal(manager.getState('lifecycle-fixture'), 'enabled');
  assert.equal(context.testState.notifications[0], 'Lifecycle fixture enabled.');
  assert.equal(emitted[0][0], 'enabled');
  assert.equal(emitted[0][1].id, 'lifecycle-fixture');

  await manager.unload('lifecycle-fixture');

  assert.equal(manager.getState('lifecycle-fixture'), 'unloaded');
  assert.equal(emitted[1][0], 'disabled');
  assert.equal(emitted[1][1].id, 'lifecycle-fixture');
});

test('a module honors module-scoped settings', async () => {
  const context = createApplicationContext();
  const manager = new ModuleManager({
    eventBus: context.eventBus,
    logger: context.logger,
    context
  });
  context.modules = manager;

  manager.register(new LifecycleFixtureModule());
  await manager.moduleSettings.set('lifecycle-fixture', 'showNotificationOnEnable', false);
  await manager.enable('lifecycle-fixture');

  assert.deepEqual(context.testState.notifications, []);
});
