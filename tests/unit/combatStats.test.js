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

test('CombatStats answers attack and defense performance by opponent class', () => {
  const stats = new CombatStats();
  const reports = [
    { category: 'offense', target: 'Enemy', won: true, destroyed: true, cp: 10, loot: { 1: 1000 }, repairSeconds: 60 },
    { category: 'forgotten', target: 'Camp 20', npc: true, won: false, destroyed: false, cp: 12, loot: { 1: 500 }, repairSeconds: 120 },
    { category: 'defense', target: 'Raider', won: true, destroyed: false, cp: 0, loot: {}, repairSeconds: 30 },
    { category: 'defense', target: 'Forgotten', npc: true, won: false, destroyed: false, cp: 0, loot: {}, repairSeconds: 90 }
  ];
  const rows = stats.overviewRows(reports);
  assert.deepEqual(rows.map((row) => [row[0], row[1], row[2]]), [
    ['Attacking other players', 0, 0],
    ['Attacking Forgotten', 1, 1],
    ['Defending against Forgotten', 1, 0],
    ['Defending vs players', 2, 1],
    ['All attacks', 1, 1],
    ['All defense', 3, 1]
  ]);
});

test('CombatStats transposes combat sections into metric rows and filters by base', () => {
  const stats = new CombatStats();
  const reports = [
    { category: 'offense', ownBase: 'Alpha', won: true, destroyed: true, cp: 10, loot: { 1: 100 }, repairSeconds: 60 },
    { category: 'others', ownBase: 'Beta', won: false, destroyed: false, cp: 8, loot: {}, repairSeconds: 30 }
  ];
  const matrix = stats.overviewMatrix(reports, 'Alpha');
  assert.equal(matrix.length, 7);
  assert.equal(matrix[0][0], 'Combat section');
  assert.equal(matrix[1][0], 'Reports');
  assert.equal(matrix[1][2], 1);
  assert.equal(matrix[1][1], 0);
});
