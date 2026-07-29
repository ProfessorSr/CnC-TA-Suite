import test from 'node:test';
import assert from 'node:assert/strict';
import { ClientApiAdapter } from '../../core/game/compatibility/clientApiAdapter.js';
import { compatibleClientEnvironment, degradedClientEnvironment } from '../fixtures/clientEnvironments.js';

test('Client API adapter reports supported game capabilities', () => {
  const fixture = compatibleClientEnvironment();
  const report = new ClientApiAdapter({ environment: fixture.environment, clientLibManager: fixture.manager }).report();
  assert.equal(report.compatible, true);
  assert.equal(report.capabilities.battlegroundLoot.supported, true);
  assert.equal(report.capabilities.researchByFaction.supported, true);
});

test('Client API adapter permits graceful loss of optional capabilities', () => {
  const fixture = degradedClientEnvironment();
  const report = new ClientApiAdapter({ environment: fixture.environment, clientLibManager: fixture.manager }).report();
  assert.equal(report.compatible, true);
  assert.equal(report.capabilities.battlegroundLoot.supported, false);
  assert.equal(report.missingRequired.length, 0);
});
