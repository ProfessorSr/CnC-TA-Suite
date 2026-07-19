export class BattleObjectRegistry {
  constructor({ logger }) {
    this.logger = logger;
    this.records = new Map();
  }

  register(id, object, metadata = {}) {
    if (id === null || id === undefined) {
      throw new Error('Battle object id is required.');
    }

    const record = Object.freeze({
      id,
      object,
      metadata: Object.freeze({ ...metadata }),
      registeredAt: Date.now()
    });

    this.records.set(String(id), record);
    return record;
  }

  get(id) {
    return this.records.get(String(id))?.object ?? null;
  }

  getRecord(id) {
    return this.records.get(String(id)) ?? null;
  }

  remove(id) {
    return this.records.delete(String(id));
  }

  clear() {
    this.records.clear();
  }

  values() {
    return [...this.records.values()].map((record) => record.object);
  }

  snapshot() {
    return Object.freeze(
      [...this.records.values()].map((record) => ({
        id: record.id,
        metadata: record.metadata,
        registeredAt: record.registeredAt,
        type: record.object?.constructor?.name ?? typeof record.object
      }))
    );
  }
}
