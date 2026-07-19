export class HookRegistry {
  constructor(logger) {
    this.logger = logger;
    this.hooks = new Map();
  }

  register(id, uninstall, { replace = false } = {}) {
    if (typeof uninstall !== 'function') {
      throw new TypeError(`Hook uninstall must be a function: ${id}`);
    }

    if (this.hooks.has(id)) {
      if (!replace) throw new Error(`Hook already registered: ${id}`);
      this.uninstall(id);
    }

    this.hooks.set(id, uninstall);
    this.logger.debug(`Hook registered: ${id}`);
    return () => this.uninstall(id);
  }

  has(id) {
    return this.hooks.has(id);
  }

  uninstall(id) {
    const uninstall = this.hooks.get(id);
    if (!uninstall) return false;

    try {
      uninstall();
    } catch (error) {
      this.logger.warn(`Hook uninstall failed: ${id}`, error);
    } finally {
      this.hooks.delete(id);
    }

    return true;
  }

  uninstallAll() {
    for (const id of [...this.hooks.keys()]) this.uninstall(id);
  }

  snapshot() {
    return Object.freeze([...this.hooks.keys()]);
  }
}
