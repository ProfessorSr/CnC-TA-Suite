export class ModuleRegistry {
  constructor({ logger } = {}) {
    this.logger = logger;
    this.modules = new Map();
  }

  register(module, { replace = false } = {}) {
    if (!module?.id || typeof module.id !== 'string') {
      throw new TypeError('Module must define a non-empty string id.');
    }

    if (!replace && this.modules.has(module.id)) {
      throw new Error(`Duplicate module: ${module.id}`);
    }

    this.modules.set(module.id, module);
    this.logger?.debug?.(`Module registered: ${module.id}`);
    return module;
  }

  unregister(id) {
    const module = this.modules.get(id) ?? null;
    this.modules.delete(id);
    return module;
  }

  get(id) {
    if (!this.modules.has(id)) throw new Error(`Unknown module: ${id}`);
    return this.modules.get(id);
  }

  tryGet(id) {
    return this.modules.get(id) ?? null;
  }

  has(id) {
    return this.modules.has(id);
  }

  values() {
    return [...this.modules.values()];
  }

  entries() {
    return [...this.modules.entries()];
  }

  clear() {
    this.modules.clear();
  }

  snapshot(states = new Map()) {
    return Object.freeze(Object.fromEntries(this.entries().map(([id, module]) => [
      id,
      Object.freeze({
        id,
        name: module.name ?? id,
        version: module.version ?? '0.0.0',
        dependencies: Object.freeze([...(module.dependencies ?? [])]),
        state: states.get(id) ?? 'registered'
      })
    ])));
  }
}
