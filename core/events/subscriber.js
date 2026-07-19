export class Subscriber {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.unsubscribers = [];
  }

  subscribe(eventName, handler) {
    const unsubscribe = this.eventBus.on(eventName, handler);
    this.unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  unsubscribeAll() {
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
  }
}
