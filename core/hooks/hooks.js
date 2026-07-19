export class HookRegistry {
  constructor(logger) {
    this.logger = logger;
    this.hooks = new Map();
  }

  register(id, uninstall) {
    if (this.hooks.has(id)) throw new Error(`Hook already registered: ${id}`);
    this.hooks.set(id, uninstall);
  }

  uninstall(id) {
    const uninstall = this.hooks.get(id);
    if (!uninstall) return;
    uninstall();
    this.hooks.delete(id);
  }

  uninstallAll() {
    for (const id of [...this.hooks.keys()]) this.uninstall(id);
  }
}
