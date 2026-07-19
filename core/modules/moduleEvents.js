export class ModuleEvents {
  constructor({ eventBus, moduleId, permissions } = {}) {
    this.eventBus = eventBus;
    this.moduleId = moduleId;
    this.permissions = permissions;
    this.subscriptions = new Set();
  }

  assertAllowed() {
    this.permissions?.require?.(this.moduleId, 'events');
  }

  on(eventName, handler) {
    this.assertAllowed();
    const unsubscribe = this.eventBus.on(eventName, handler);
    this.subscriptions.add(unsubscribe);
    return () => {
      this.subscriptions.delete(unsubscribe);
      unsubscribe();
    };
  }

  once(eventName, handler) {
    this.assertAllowed();
    let unsubscribe;
    unsubscribe = this.eventBus.once(eventName, (...args) => {
      this.subscriptions.delete(unsubscribe);
      handler(...args);
    });
    this.subscriptions.add(unsubscribe);
    return unsubscribe;
  }

  emit(eventName, payload) {
    this.assertAllowed();
    this.eventBus.emit(eventName, payload);
  }

  clear() {
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions.clear();
  }

  get size() {
    return this.subscriptions.size;
  }
}
