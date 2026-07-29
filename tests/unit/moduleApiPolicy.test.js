import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleApiCompatibility } from '../../core/modules/moduleApiPolicy.js';
import { ModuleManifest } from '../../core/modules/moduleManifest.js';

test('module API policy accepts current major and reports older minor as deprecated', () => {
  assert.equal(moduleApiCompatibility('1.0.0').compatible, true);
  assert.equal(moduleApiCompatibility('1.1.0').deprecated, true);
});

test('module manifests reject incompatible Suite API major versions', () => {
  assert.throws(() => ModuleManifest.normalize({ id: 'future', name: 'Future', version: '1.0.0', apiVersion: '2.0.0' }), /supports 1\.0\.0/);
});

test('module manifests reject incompatible Hub API major versions', () => {
  assert.throws(() => ModuleManifest.normalize({ id: 'future-hub', name: 'Future Hub', version: '1.0.0', apiVersion: '1.0.0', hubApiVersion: '2.0.0' }), /publishes 1\.0\.0/);
});
