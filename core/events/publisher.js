export class Publisher {
  constructor(eventBus, namespace = '') {
    this.eventBus = eventBus;
    this.namespace = namespace;
  }

  publish(eventName, payload) {
    const name = this.namespace ? `${this.namespace}:${eventName}` : eventName;
    this.eventBus.emit(name, payload);
  }
}
