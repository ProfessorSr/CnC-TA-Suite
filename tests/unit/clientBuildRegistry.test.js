import test from 'node:test';
import assert from 'node:assert/strict';
import { assessClientBuild } from '../../core/game/compatibility/clientBuildRegistry.js';

test('unknown EA client fingerprints require migration validation', () => {
  const result = assessClientBuild({ normalized: 'unknown', runtimeFingerprint: 'runtime-new' }, {});
  assert.equal(result.known, false);
  assert.equal(result.migrationRequired, true);
});

test('verified EA client fingerprints do not require migration', () => {
  const registry = { stable: { status: 'verified' } };
  const result = assessClientBuild({ normalized: 'unknown', runtimeFingerprint: 'stable' }, registry);
  assert.equal(result.migrationRequired, false);
});
