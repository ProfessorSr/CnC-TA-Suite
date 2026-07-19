import { ServiceRegistry } from '../../core/game/registry/serviceRegistry.js';

export function runServiceRegistryUnitTest() {
  const logger = {
    debug() {}
  };

  const registry = new ServiceRegistry({ logger });
  registry.register('alpha', { value: 1 });

  if (!registry.has('alpha')) {
    throw new Error('ServiceRegistry failed to register service.');
  }

  if (registry.get('alpha').value !== 1) {
    throw new Error('ServiceRegistry returned incorrect service.');
  }

  registry.registerFactory('beta', () => ({ value: 2 }));

  if (registry.get('beta').value !== 2) {
    throw new Error('ServiceRegistry factory failed.');
  }

  return true;
}
