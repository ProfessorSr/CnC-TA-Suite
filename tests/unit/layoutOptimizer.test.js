import test from 'node:test';
import assert from 'node:assert/strict';
import { LayoutOptimizer } from '../../modules/layout-optimizer/layout-optimizer.js';

const buildings = [
  { id: 'h1', name: 'Harvester', level: 20, x: 0, y: 0, resourceType: 1 },
  { id: 'h2', name: 'Harvester', level: 20, x: 8, y: 7, resourceType: 2 },
  { id: 'r', name: 'Refinery', level: 20, x: 7, y: 7, resourceType: 0 },
  { id: 'p', name: 'Power Plant', level: 20, x: 1, y: 0, resourceType: 0 },
  { id: 'a', name: 'Accumulator', level: 20, x: 4, y: 4, resourceType: 0 }
];

test('LayoutOptimizer returns a ranked visual proposal within move limits', () => {
  const result = LayoutOptimizer.optimize({
    buildings,
    production: { tiberium: 1000, crystal: 900, power: 800 }
  }, {
    weights: { tiberium: 34, crystal: 33, power: 33, storage: 5 },
    minimumStorage: 0,
    maximumMoves: 4,
    maximumReplacements: 0,
    fixedIds: new Set(['h1']),
    replacementIds: new Set()
  });
  assert.ok(result.ranked.length >= 1);
  assert.ok(result.best.changes.length <= 4);
  assert.equal(result.best.layout.find((item) => item.id === 'h1').x, 0);
  assert.equal(result.best.layout.length, buildings.length);
  assert.ok(result.production.tiberium);
});

test('LayoutOptimizer reports unmet minimum-storage constraints', () => {
  const result = LayoutOptimizer.optimize({ buildings, production: { tiberium: 1, crystal: 1, power: 1 } }, {
    weights: { tiberium: 1, crystal: 1, power: 1, storage: 1 },
    minimumStorage: 100000,
    maximumMoves: 0,
    maximumReplacements: 0,
    fixedIds: new Set(),
    replacementIds: new Set()
  });
  assert.ok(result.conflicts.some((message) => message.includes('Minimum storage')));
});
