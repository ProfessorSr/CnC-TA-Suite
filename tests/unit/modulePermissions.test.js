import test from 'node:test';
import assert from 'node:assert/strict';
import { ModulePermissions } from '../../core/modules/modulePermissions.js';

test('ModulePermissions grants and enforces requested capabilities', () => {
  const permissions = new ModulePermissions();
  permissions.register('sample', ['game', 'events']);
  assert.equal(permissions.allows('sample', 'game'), true);
  assert.equal(permissions.allows('sample', 'storage'), false);
  assert.throws(() => permissions.require('sample', 'storage'), /does not have/i);
});

test('ModulePermissions supports legacy unrestricted modules', () => {
  const permissions = new ModulePermissions();
  permissions.register('legacy', [], { legacyUnrestricted: true });
  assert.equal(permissions.allows('legacy', 'storage'), true);
});
