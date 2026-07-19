export class EventBus {
  constructor() {
    this.listeners = new Map();
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
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) this.listeners.delete(eventName);
  }

  emit(eventName, payload) {
    const handlers = [...(this.listeners.get(eventName) || [])];
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[CnC-TA-Suite] Event handler failed for ${eventName}`, error);
      }
    }
  }

  clear(eventName) {
    eventName ? this.listeners.delete(eventName) : this.listeners.clear();
  }
}

export const eventBus = new EventBus();
