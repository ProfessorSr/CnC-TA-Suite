export class GameObjectRegistry {
  constructor({ logger }) {
    this.logger = logger;
    this.objects = new Map();
  }

  set(name, value, metadata = {}) {
    const record = Object.freeze({
      name,
      value,
      metadata: Object.freeze({ ...metadata }),
      updatedAt: Date.now()
    });

    this.objects.set(name, record);
    return record;
  }

  get(name) {
    return this.objects.get(name)?.value ?? null;
  }

  getRecord(name) {
    return this.objects.get(name) || null;
  }

  has(name) {
    return this.objects.has(name);
  }

  remove(name) {
    return this.objects.delete(name);
  }

  clear() {
    this.objects.clear();
  }

  snapshot() {
    return Object.freeze(
      Object.fromEntries(
        [...this.objects.entries()].map(([name, record]) => [
          name,
          Object.freeze({
            metadata: record.metadata,
            updatedAt: record.updatedAt,
            type: record.value?.constructor?.name || typeof record.value
          })
        ])
      )
    );
  }
}
