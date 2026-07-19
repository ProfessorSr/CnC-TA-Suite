export class CacheManager {
  constructor({ logger, defaultTtl = 1000 } = {}) {
    this.logger = logger;
    this.defaultTtl = defaultTtl;
    this.records = new Map();
  }

  set(key, value, { ttl = this.defaultTtl } = {}) {
    const now = Date.now();
    const record = {
      value,
      createdAt: now,
      expiresAt: ttl === Infinity ? Infinity : now + Math.max(0, ttl)
    };

    this.records.set(key, record);
    return value;
  }

  get(key, factory = null, options = {}) {
    const record = this.records.get(key);
    const now = Date.now();

    if (record && (record.expiresAt === Infinity || record.expiresAt > now)) {
      return record.value;
    }

    if (record) this.records.delete(key);
    if (typeof factory !== 'function') return undefined;

    return this.set(key, factory(), options);
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  invalidate(key) {
    if (key === undefined) {
      this.clear();
      return;
    }

    for (const candidate of [...this.records.keys()]) {
      if (candidate === key || candidate.startsWith(`${key}:`)) {
        this.records.delete(candidate);
      }
    }
  }

  clear() {
    this.records.clear();
  }

  snapshot() {
    const now = Date.now();
    return Object.freeze(
      Object.fromEntries(
        [...this.records.entries()].map(([key, record]) => [
          key,
          Object.freeze({
            createdAt: record.createdAt,
            expiresAt: record.expiresAt,
            expired: record.expiresAt !== Infinity && record.expiresAt <= now
          })
        ])
      )
    );
  }
}
