import test from 'node:test';
import assert from 'node:assert/strict';
import { registeredModules } from '../../core/modules/moduleCatalog.generated.js';
import { MANUAL_BY_ID, MANUAL_SECTIONS } from '../../modules/command-manual/manual-content.js';
import { manualSearch } from '../../modules/command-manual/command-manual-window.js';

test('Command Manual covers every registered module and core command-center section', () => {
  const ids = registeredModules.map((ModuleClass) => new ModuleClass().id);
  for (const id of ids) assert.ok(MANUAL_BY_ID[id], `Missing Command Manual guide for ${id}`);
  for (const id of ['getting-started', 'new-player-guide', 'faq', 'troubleshooting', 'whats-new', 'glossary']) {
    assert.ok(MANUAL_BY_ID[id], `Missing command-center section ${id}`);
  }
  assert.ok(MANUAL_SECTIONS.length > ids.length);
});

test('Command Manual search returns matching controls and related guides', () => {
  const repair = manualSearch('repair').map((result) => result.label);
  assert.ok(repair.some((label) => /Repair.*Manager/.test(label)));
  assert.ok(repair.some((label) => /Repair Buildings/.test(label)));
  const mcv = manualSearch('MCV').map((result) => result.label);
  assert.ok(mcv.some((label) => /Next MCV/.test(label)));
  assert.ok(mcv.some((label) => /Frequently Asked Questions/.test(label)));
});
