import test from 'node:test';
import assert from 'node:assert/strict';
import { HUB_API_VERSION, validateHubSnapshot } from '../../core/game/hub/hubContract.js';

test('Hub contract accepts a versioned normalized snapshot', () => {
  assert.equal(validateHubSnapshot({ schemaVersion: HUB_API_VERSION, ready: true, generatedAt: 1, player: {} }).valid, true);
});

test('Hub contract identifies schema drift', () => {
  const report = validateHubSnapshot({ schemaVersion: '2.0.0', ready: 'yes' });
  assert.equal(report.valid, false);
  assert.ok(report.errors.length >= 2);
});
