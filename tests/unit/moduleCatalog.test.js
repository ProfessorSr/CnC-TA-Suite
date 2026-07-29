import test from 'node:test';
import assert from 'node:assert/strict';
import { registeredModules } from '../../core/modules/moduleCatalog.generated.js';
import { ModuleManifest } from '../../core/modules/moduleManifest.js';

test('every generated module exposes a valid unique manifest', () => {
  const ids = new Set();

  for (const ModuleClass of registeredModules) {
    const manifest = ModuleManifest.normalize(new ModuleClass());
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/, `${manifest.id} must expose its own semantic version`);
    assert.equal(ids.has(manifest.id), false, `Duplicate module id: ${manifest.id}`);
    ids.add(manifest.id);
  }

  assert.equal(ids.size, registeredModules.length);
});

test('module release versions are independent from the framework API version', () => {
  const manifest = ModuleManifest.normalize({
    id: 'independent-module', name: 'Independent Module', version: '0.7.3',
    apiVersion: '1.0.0', hubApiVersion: '1.0.0'
  });
  assert.equal(manifest.version, '0.7.3');
  assert.equal(manifest.apiVersion, '1.0.0');
  assert.equal(manifest.hubApiVersion, '1.0.0');
});
