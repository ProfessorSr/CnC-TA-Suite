import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../../core/events/eventBus.js';
import { ModuleManager } from '../../core/modules/moduleManager.js';

function createContext() {
  const values = new Map();
  const logger = {
    child() { return this; },
    debug() {},
    error() {}
  };
  return {
    eventBus: new EventBus(),
    logger,
    settings: {
      get: (key, fallback) => values.has(key) ? values.get(key) : fallback,
      async set(key, value) { values.set(key, value); }
    },
    testState: { values }
  };
}

test('ModuleManager runs lifecycle in order', async () => {
  const calls = [];
  const context = createContext();
  const manager = new ModuleManager({
    eventBus: context.eventBus,
    logger: context.logger,
    context
  });
  context.modules = manager;

  manager.register({
    id: 'sample',
    dependencies: [],
    async initialize() { calls.push('initialize'); },
    async load() { calls.push('load'); },
    async enable() { calls.push('enable'); },
    async disable() { calls.push('disable'); },
    async unload() { calls.push('unload'); },
    async destroy() { calls.push('destroy'); }
  });

  await manager.enable('sample');
  await manager.unload('sample');

  assert.deepEqual(calls, ['initialize', 'load', 'enable', 'disable', 'unload', 'destroy']);
  assert.equal(manager.getState('sample'), 'unloaded');
});

test('ModuleManager enables dependencies first', async () => {
  const calls = [];
  const context = createContext();
  const manager = new ModuleManager({ eventBus: context.eventBus, logger: context.logger, context });
  context.modules = manager;

  manager.registerMany([
    { id: 'core', dependencies: [], async enable() { calls.push('core'); } },
    { id: 'feature', dependencies: ['core'], async enable() { calls.push('feature'); } }
  ]);

  await manager.enable('feature');
  assert.deepEqual(calls, ['core', 'feature']);
});

test('ModuleManager persists enabled state as a module boolean', async () => {
  const context = createContext();
  const manager = new ModuleManager({ eventBus: context.eventBus, logger: context.logger, context });
  context.modules = manager;

  manager.register({
    id: 'legacy',
    settingsKey: 'legacyModule',
    dependencies: [],
    async enable() {},
    async disable() {}
  });

  await manager.setEnabled('legacy', true);
  assert.equal(context.testState.values.get('modules.legacyModule'), true);
  assert.equal(context.testState.values.has('modules.legacyModule.enabled'), false);

  await manager.setEnabled('legacy', false);
  assert.equal(context.testState.values.get('modules.legacyModule'), false);
  assert.equal(manager.getState('legacy'), 'disabled');
});
