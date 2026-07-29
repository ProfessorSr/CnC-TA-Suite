import test from 'node:test';
import assert from 'node:assert/strict';
import { ModuleSettings } from '../../core/modules/moduleSettings.js';

function createSettings() {
  const values = {};
  return {
    get(path, fallback) { return Object.hasOwn(values, path) ? values[path] : fallback; },
    async set(path, value) { values[path] = value; }
  };
}

test('ModuleSettings provides defaults and validates writes', async () => {
  const service = new ModuleSettings({ settings: createSettings() });
  service.register('sample', {
    enabled: { type: 'boolean', default: true },
    limit: { type: 'number', default: 5, min: 1, max: 10 }
  });

  assert.equal(service.get('sample', 'enabled'), true);
  await service.set('sample', 'limit', 8);
  assert.equal(service.get('sample', 'limit'), 8);
  await assert.rejects(() => service.set('sample', 'limit', 20), /at most 10/i);
});
