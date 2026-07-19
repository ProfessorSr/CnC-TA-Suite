import test from 'node:test';
import assert from 'node:assert/strict';
import { ModuleManifest } from '../../core/modules/moduleManifest.js';

test('ModuleManifest normalizes valid metadata', () => {
  const manifest = ModuleManifest.normalize({
    id: 'city.analyzer',
    name: 'City Analyzer',
    version: '1.2.0',
    apiVersion: '1.0.0',
    dependencies: ['core.data'],
    permissions: ['game', 'events'],
    settings: { enabled: { type: 'boolean', default: true } }
  });

  assert.equal(manifest.id, 'city.analyzer');
  assert.deepEqual(manifest.dependencies, ['core.data']);
  assert.deepEqual(manifest.permissions, ['game', 'events']);
});

test('ModuleManifest rejects invalid ids and versions', () => {
  assert.throws(() => ModuleManifest.normalize({ id: 'Bad ID', version: '1.0.0' }), /identifier/i);
  assert.throws(() => ModuleManifest.normalize({ id: 'valid', version: 'latest' }), /semantic version/i);
});
