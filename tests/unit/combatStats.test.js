import assert from 'node:assert/strict';
import test from 'node:test';
import { CombatStats } from '../../modules/war-room/combat-stats.js';

test('CombatStats persists normalized battle history and favorites', async () => {
  const values = new Map();
  const storage = {
    async get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
    async set(key, value) { values.set(key, value); }
  };
  const stats = new CombatStats(storage);
  await stats.load();
  const snapshot = {
    attacker: { id: 1, name: 'Alpha' },
    target: { id: 2, name: 'Camp', x: 10, y: 20 },
    cpCost: 7
  };
  stats.record(snapshot, {
    defenderRemaining: 25,
    ownRemaining: 80,
    loot: 1234,
    research: 55,
    repairSeconds: 60,
    durationSeconds: 30
  }, 'formation-a');
  assert.equal(stats.rows()[0][3], 1234);
  assert.equal(stats.toggleFavorite(snapshot.target), true);
  await stats.persist();

  const restored = new CombatStats(storage);
  await restored.load();
  assert.equal(restored.history.length, 1);
  assert.equal(restored.isFavorite(snapshot.target), true);
  assert.match(restored.exportText(), /Camp/);
});
