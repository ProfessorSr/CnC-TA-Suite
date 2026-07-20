import test from 'node:test';
import assert from 'node:assert/strict';
import { rightDockDefinitions } from '../../modules/repair-manager/repair-quick-dock.js';

test('every right-side Suite shortcut has its own icon', () => {
  const definitions = rightDockDefinitions();
  const icons = definitions.map((definition) => definition.icon);
  assert.equal(new Set(icons).size, icons.length);
  assert.equal(definitions.every((definition) => Boolean(definition.icon)), true);
});
