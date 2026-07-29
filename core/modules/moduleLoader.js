export class ModuleLoader {
  constructor({ logger } = {}) {
    this.logger = logger;
  }

  async load(module, context) {
    if (!module) throw new TypeError('Module is required.');

    if (typeof module.initialize === 'function') {
      await module.initialize(context);
    }

    if (typeof module.load === 'function') {
      await module.load(context);
    }

    this.logger?.debug?.(`Module loaded: ${module.id}`);
    return module;
  }

  async unload(module, context) {
    if (typeof module.unload === 'function') {
      await module.unload(context);
    }

    if (typeof module.destroy === 'function') {
      await module.destroy(context);
    }

    this.logger?.debug?.(`Module unloaded: ${module.id}`);
  }
}
