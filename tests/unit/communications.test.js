import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinateBbcode } from '../../modules/communications/index.js';

test('communications formats selected coordinates for native chat and mail', () => {
  assert.equal(coordinateBbcode(123.4, 456.6), '[coords]123:457[/coords]');
});
