import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPublicApi, redactedExport, safeClone } from '../../modules/api-inspector/api-inspector-utils.js';

test('API Inspector clones public snapshots without retaining mutable references', () => {
  const player = { name: 'Commander', score: 42, raw: { internal: true } };
  const api = {
    ready: true,
    version: 'game-test',
    player: { current: () => player },
    city: { current: () => null, all: () => [] },
    world: { info: () => ({ id: 1 }) },
    alliance: { current: () => null },
    base: { selected: () => null, level: () => 0 },
    battle: { isActive: () => false, state: () => null, target: () => null, attacker: () => null, defender: () => null },
    selection: { snapshot: () => null },
    objects: { snapshot: () => ({ size: 0 }) },
    cache: { snapshot: () => ({ size: 0 }) }
  };
  const snapshot = inspectPublicApi(api);
  player.score = 100;
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.services.player.value.score, 42);
  assert.equal(snapshot.services.player.value.raw, '[omitted mutable game object]');
});

test('API Inspector redacts sensitive export fields and handles cycles', () => {
  const diagnostics = { playerName: 'Commander', token: 'secret', healthy: true };
  diagnostics.self = diagnostics;
  const exported = redactedExport({ suiteVersion: '0.4.0', apiSnapshot: {}, diagnostics });
  assert.equal(exported.diagnostics.playerName, '[redacted]');
  assert.equal(exported.diagnostics.token, '[redacted]');
  assert.equal(exported.diagnostics.healthy, true);
  assert.equal(exported.diagnostics.self, '[Circular]');
  assert.deepEqual(safeClone({ value: 1 }), { value: 1 });
});
