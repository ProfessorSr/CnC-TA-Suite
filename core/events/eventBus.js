export class EventBus {
  constructor({ historyLimit = 100 } = {}) {
    this.listeners = new Map();
    this.historyLimit = historyLimit;
    this.history = [];
    this.metrics = {
      emitted: 0,
      handled: 0,
      failed: 0,
      byEvent: new Map()
    };
  }

  on(eventName, handler) {
    if (typeof handler !== 'function') throw new TypeError('Event handler must be a function.');
    const handlers = this.listeners.get(eventName) || new Set();
    handlers.add(handler);
    this.listeners.set(eventName, handlers);
    return () => this.off(eventName, handler);
  }

  once(eventName, handler) {
    const unsubscribe = this.on(eventName, (...args) => {
      unsubscribe();
      handler(...args);
    });
    return unsubscribe;
  }

  off(eventName, handler) {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return false;
    const removed = handlers.delete(handler);
    if (handlers.size === 0) this.listeners.delete(eventName);
    return removed;
  }

  emit(eventName, payload) {
    const handlers = [...(this.listeners.get(eventName) || [])];
    const timestamp = Date.now();

    this.metrics.emitted += 1;
    this.metrics.byEvent.set(eventName, (this.metrics.byEvent.get(eventName) || 0) + 1);
    this.history.push(Object.freeze({ eventName, timestamp, listenerCount: handlers.length }));
    if (this.history.length > this.historyLimit) this.history.shift();

    for (const handler of handlers) {
      try {
        handler(payload);
        this.metrics.handled += 1;
      } catch (error) {
        this.metrics.failed += 1;
        console.error(`[CnC-TA-Suite] Event handler failed for ${eventName}`, error);
      }
    }
  }

  clear(eventName) {
    eventName ? this.listeners.delete(eventName) : this.listeners.clear();
  }

  snapshot() {
    return Object.freeze({
      listenerGroups: this.listeners.size,
      listenerCount: [...this.listeners.values()].reduce((sum, handlers) => sum + handlers.size, 0),
      emitted: this.metrics.emitted,
      handled: this.metrics.handled,
      failed: this.metrics.failed,
      byEvent: Object.freeze(Object.fromEntries(this.metrics.byEvent)),
      recent: Object.freeze([...this.history])
    });
  }
}

export const eventBus = new EventBus();
