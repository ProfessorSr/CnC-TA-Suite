export class CacheManager {
  constructor({ logger, defaultTtl = 1000 } = {}) {
    this.logger = logger;
    this.defaultTtl = defaultTtl;
    this.records = new Map();
    this.metrics = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
  }

  set(key, value, { ttl = this.defaultTtl } = {}) {
    const now = Date.now();
    const record = {
      value,
      createdAt: now,
      expiresAt: ttl === Infinity ? Infinity : now + Math.max(0, ttl)
    };

    this.records.set(key, record);
    this.metrics.sets += 1;
    return value;
  }

  get(key, factory = null, options = {}) {
    const record = this.records.get(key);
    const now = Date.now();

    if (record && (record.expiresAt === Infinity || record.expiresAt > now)) {
      this.metrics.hits += 1;
      return record.value;
    }

    this.metrics.misses += 1;
    if (record) this.records.delete(key);
    if (typeof factory !== 'function') return undefined;

    return this.set(key, factory(), options);
  }

  has(key) {
    const record = this.records.get(key);
    if (!record) return false;
    if (record.expiresAt !== Infinity && record.expiresAt <= Date.now()) {
      this.records.delete(key);
      return false;
    }
    return true;
  }

  invalidate(key) {
    let removed = 0;
    if (key === undefined) {
      removed = this.records.size;
      this.records.clear();
    } else {
      for (const candidate of [...this.records.keys()]) {
        if (candidate === key || candidate.startsWith(`${key}:`)) {
          this.records.delete(candidate);
          removed += 1;
        }
      }
    }
    this.metrics.invalidations += removed;
    return removed;
  }

  clear() {
    return this.invalidate();
  }

  prune() {
    const now = Date.now();
    let removed = 0;
    for (const [key, record] of this.records) {
      if (record.expiresAt !== Infinity && record.expiresAt <= now) {
        this.records.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  snapshot() {
    this.prune();
    const now = Date.now();
    return Object.freeze({
      size: this.records.size,
      metrics: Object.freeze({ ...this.metrics }),
      records: Object.freeze(
        Object.fromEntries(
          [...this.records.entries()].map(([key, record]) => [
            key,
            Object.freeze({
              createdAt: record.createdAt,
              expiresAt: record.expiresAt,
              ageMs: now - record.createdAt
            })
          ])
        )
      )
    });
  }
}
