import test from 'node:test';
import assert from 'node:assert/strict';
import { registeredModules } from '../../core/modules/moduleCatalog.generated.js';
import { ModuleManifest } from '../../core/modules/moduleManifest.js';

test('every generated module exposes a valid unique manifest', () => {
  const ids = new Set();

  for (const ModuleClass of registeredModules) {
    const manifest = ModuleManifest.normalize(new ModuleClass());
    assert.equal(ids.has(manifest.id), false, `Duplicate module id: ${manifest.id}`);
    ids.add(manifest.id);
  }

  assert.equal(ids.size, registeredModules.length);
});
