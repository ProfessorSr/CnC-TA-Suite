import test from 'node:test';
import assert from 'node:assert/strict';
import { registeredModules } from '../../core/modules/moduleCatalog.generated.js';
import { MANUAL_BY_ID, MANUAL_SECTIONS } from '../../modules/command-manual/manual-content.js';
import { manualSearch, moduleManualSections } from '../../modules/command-manual/command-manual-window.js';

test('each module owns a Command Manual contribution', () => {
  for (const ModuleClass of registeredModules) {
    const module = new ModuleClass();
    assert.equal(module.manual.id, module.id);
    assert.ok(module.manual.title);
    assert.ok(module.manual.summary, `Missing Command Manual summary for ${module.id}`);
  }
});

test('Command Manual keeps framework chapters separate from module guides', () => {
  for (const id of ['getting-started', 'new-player-guide', 'faq', 'troubleshooting', 'whats-new', 'glossary']) {
    assert.ok(MANUAL_BY_ID[id], `Missing command-center section ${id}`);
  }
  const moduleIds = new Set(registeredModules.map((ModuleClass) => new ModuleClass().id));
  assert.equal(MANUAL_SECTIONS.some((section) => moduleIds.has(section.id)), false);
});

test('Command Manual discovers only enabled module guides', () => {
  const modules = registeredModules.slice(0, 3).map((ModuleClass) => new ModuleClass());
  const states = new Map(modules.map((module, index) => [module.id, index === 1 ? 'disabled' : 'enabled']));
  const context = { modules: {
    registry: { values: () => modules },
    getState: (id) => states.get(id)
  } };
  const sections = moduleManualSections(context);
  assert.deepEqual(sections.map((section) => section.id), [modules[0].id, modules[2].id]);
  assert.equal(sections.some((section) => section.id === modules[1].id), false);
});

test('Command Manual search searches the supplied live chapter set', () => {
  const sections = [...MANUAL_SECTIONS, {
    id: 'sample-module', title: 'Sample Repair Module', summary: 'Repairs buildings',
    steps: [], controls: [['Repair Buildings', 'Repairs eligible buildings.']], notes: []
  }];
  const repair = manualSearch('repair', sections).map((result) => result.label);
  assert.ok(repair.some((label) => /Sample Repair Module/.test(label)));
  assert.ok(repair.some((label) => /Repair Buildings/.test(label)));
});
