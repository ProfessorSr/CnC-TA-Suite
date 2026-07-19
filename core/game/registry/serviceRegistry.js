export class ServiceRegistry {
  constructor({ logger }) {
    this.logger = logger;
    this.services = new Map();
    this.factories = new Map();
  }

  register(name, service, { replace = false } = {}) {
    if (!replace && this.services.has(name)) {
      throw new Error(`Service already registered: ${name}`);
    }

    this.services.set(name, service);
    this.logger.debug(`Service registered: ${name}`);
    return service;
  }

  registerFactory(name, factory, { replace = false } = {}) {
    if (!replace && (this.factories.has(name) || this.services.has(name))) {
      throw new Error(`Service already registered: ${name}`);
    }

    if (typeof factory !== 'function') {
      throw new TypeError(`Factory must be a function: ${name}`);
    }

    this.factories.set(name, factory);
  }

  get(name) {
    if (this.services.has(name)) {
      return this.services.get(name);
    }

    if (this.factories.has(name)) {
      const service = this.factories.get(name)(this);
      this.services.set(name, service);
      this.factories.delete(name);
      return service;
    }

    throw new Error(`Unknown service: ${name}`);
  }

  has(name) {
    return this.services.has(name) || this.factories.has(name);
  }

  entries() {
    return [...this.services.entries()];
  }

  snapshot() {
    return Object.freeze(
      Object.fromEntries(
        [...this.services.entries()].map(([name, service]) => [
          name,
          Object.freeze({
            name,
            type: service?.constructor?.name || typeof service
          })
        ])
      )
    );
  }
}
