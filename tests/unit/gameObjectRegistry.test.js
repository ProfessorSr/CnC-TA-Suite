import { GameObjectRegistry } from '../../core/game/registry/gameObjectRegistry.js';

export function runGameObjectRegistryUnitTest() {
  const registry = new GameObjectRegistry({
    logger: { debug() {} }
  });

  const object = { id: 7 };
  registry.set('test', object, { source: 'unit-test' });

  if (registry.get('test') !== object) {
    throw new Error('GameObjectRegistry returned the wrong object.');
  }

  const snapshot = registry.snapshot();
  if (snapshot.test.metadata.source !== 'unit-test') {
    throw new Error('GameObjectRegistry metadata was not preserved.');
  }

  return true;
}
