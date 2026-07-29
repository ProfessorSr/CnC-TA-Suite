import test from 'node:test';
import assert from 'node:assert/strict';
import { DependencyResolver } from '../../core/modules/dependencyResolver.js';

test('DependencyResolver orders dependencies before dependents', () => {
  const modules = new Map([
    ['feature', { id: 'feature', dependencies: ['core'] }],
    ['core', { id: 'core', dependencies: [] }]
  ]);

  const ordered = new DependencyResolver().resolve(modules);
  assert.deepEqual(ordered.map((module) => module.id), ['core', 'feature']);
});

test('DependencyResolver rejects missing dependencies', () => {
  assert.throws(
    () => new DependencyResolver().resolve([{ id: 'feature', dependencies: ['missing'] }]),
    /missing dependency/i
  );
});

test('DependencyResolver rejects circular dependencies', () => {
  assert.throws(
    () => new DependencyResolver().resolve([
      { id: 'alpha', dependencies: ['beta'] },
      { id: 'beta', dependencies: ['alpha'] }
    ]),
    /circular module dependency/i
  );
});
