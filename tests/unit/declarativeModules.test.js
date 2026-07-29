import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeModuleDefinition, validateModuleDefinition } from '../../core/ui/declarative/moduleDefinition.js';
import { DeclarativeRenderer, declarativeValueAt } from '../../core/ui/declarative/declarativeRenderer.js';
import { suiteStatusDefinition } from '../../modules/suite-status/suiteStatusWindow.js';
import { hotkeysDefinition } from '../../modules/hotkeys/index.js';

test('declarative module definitions validate tabs, actions, and controls', () => {
  assert.equal(validateModuleDefinition(suiteStatusDefinition).valid, true);
  assert.equal(validateModuleDefinition(hotkeysDefinition).valid, true);
  const normalized = normalizeModuleDefinition(suiteStatusDefinition);
  assert.equal(normalized.window.width, 430);
  assert.equal(normalized.manifest.id, 'suite-status');
});

test('declarative definitions reject unsupported controls', () => {
  const report = validateModuleDefinition({
    manifest: { id: 'bad' }, window: { title: 'Bad', tabs: [{ id: 'main', title: 'Main', controls: [{ type: 'mystery' }] }] }
  });
  assert.equal(report.valid, false);
  assert.match(report.errors.join(' '), /Unsupported declarative control/);
});

test('declarative provider bindings resolve paths and computed values', () => {
  const data = { diagnostics: { errors: 2 } };
  assert.equal(declarativeValueAt(data, 'diagnostics.errors'), 2);
  assert.equal(declarativeValueAt(data, (value) => value.diagnostics.errors + 1), 3);
});

test('declarative renderer refreshes providers and executes actions', async () => {
  let calls = 0;
  const definition = normalizeModuleDefinition({
    manifest: { id: 'provider-test' },
    window: { title: 'Provider Test', tabs: [{ id: 'main', title: 'Main' }] },
    providers: { sample: () => ({ value: ++calls }) },
    actions: { increment: ({ providers }) => ({ seen: providers.sample.data.value, refresh: false }) }
  });
  const renderer = new DeclarativeRenderer({ definition, context: {}, owner: null });
  let bound = 0;
  renderer.bindings.push(() => { bound = renderer.providerState.sample.data.value; });
  await renderer.refresh();
  assert.equal(bound, 1);
  assert.deepEqual(await renderer.execute('increment'), { seen: 1, refresh: false });
});
