import test from 'node:test';
import assert from 'node:assert/strict';
import { registeredModules } from '../../core/modules/moduleCatalog.generated.js';
import { ModuleManifest } from '../../core/modules/moduleManifest.js';
import { adoptModuleDefinition, UI_SCHEMA_VERSION } from '../../core/ui/declarative/moduleDefinitionBridge.js';
import { validateModuleDefinition } from '../../core/ui/declarative/moduleDefinition.js';

test('every registered module adopts the versioned declarative UI contract', () => {
  const modules = registeredModules.map((ModuleClass) => new ModuleClass());
  for (const module of modules) {
    const manifest = ModuleManifest.normalize(module);
    const definition = adoptModuleDefinition(module, manifest);
    assert.equal(definition.uiSchemaVersion, UI_SCHEMA_VERSION, module.id);
    assert.equal(validateModuleDefinition(definition).valid, true, module.id);
    assert.ok(['declarative', 'custom'].includes(definition.renderer), module.id);
    assert.ok(definition.window.tabs.length >= 1, module.id);
    assert.deepEqual(Object.keys(definition.manifest.settings ?? {}).sort(), Object.keys(manifest.settings).sort(), module.id);
  }
});

test('all specialized modules use the custom-renderer bridge rather than bypassing definitions', () => {
  const modules = registeredModules.map((ModuleClass) => new ModuleClass());
  const custom = [];
  const declarative = [];
  for (const module of modules) {
    adoptModuleDefinition(module, ModuleManifest.normalize(module));
    (module.definition.renderer === 'declarative' ? declarative : custom).push(module.id);
  }
  assert.deepEqual(declarative.sort(), ['command-manual', 'hotkeys', 'suite-status']);
  assert.equal(custom.length, modules.length - declarative.length);
});
