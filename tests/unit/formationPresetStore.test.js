import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formationTargetMatches,
  loadFormationPresets,
  saveFormationPresets
} from '../../modules/war-room/formation-preset-store.js';

test('formation presets survive a storage round trip with serializable unit data', async () => {
  const values = new Map();
  const storage = {
    async get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
    async set(key, value) { values.set(key, structuredClone(value)); }
  };
  const originalLocalStorage = globalThis.localStorage;
  const local = new Map();
  globalThis.localStorage = {
    getItem: (key) => local.get(key) ?? null,
    setItem: (key, value) => local.set(key, value)
  };
  try {
    await saveFormationPresets(storage, [{
      id: 'saved-1', name: 'Rush', attackerId: 10, attackerName: 'Alpha',
      target: { id: 20, name: 'Base', x: 100, y: 200 }, updatedAt: 123,
      units: [{ entityId: 30, mdbId: 40, name: 'Unit', level: 12, x: 2, y: 1 }]
    }]);
    const [loaded] = await loadFormationPresets(storage);
    assert.equal(loaded.name, 'Rush');
    assert.deepEqual(loaded.units[0], {
      entityId: 30, mdbId: 40, name: 'Unit', level: 12, x: 2, y: 1,
      enabled: true, transporterId: null, garrisonId: null
    });
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
});

test('formation target matching falls back to stable coordinates after target IDs refresh', () => {
  assert.equal(formationTargetMatches(
    { id: 20, x: 100, y: 200 },
    { id: 999, x: 100, y: 200 }
  ), true);
  assert.equal(formationTargetMatches(
    { id: 20, x: 100, y: 200 },
    { id: 999, x: 101, y: 200 }
  ), false);
});
