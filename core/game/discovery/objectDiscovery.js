export class ObjectDiscovery {
  constructor({ logger }) {
    this.logger = logger;
  }

  findByPath(root, path) {
    return String(path)
      .split('.')
      .filter(Boolean)
      .reduce((value, key) => value?.[key], root);
  }

  findFirst(root, candidates) {
    for (const candidate of candidates) {
      const value = typeof candidate === 'function'
        ? candidate(root)
        : this.findByPath(root, candidate);

      if (value !== undefined && value !== null) {
        return value;
      }
    }

    return null;
  }

  describe(value) {
    if (value === null || value === undefined) {
      return { type: String(value), methods: [] };
    }

    const methods = new Set();
    let current = value;

    while (current && current !== Object.prototype) {
      for (const key of Object.getOwnPropertyNames(current)) {
        try {
          if (typeof value[key] === 'function') methods.add(key);
        } catch {
          // Some game objects expose guarded properties.
        }
      }
      current = Object.getPrototypeOf(current);
    }

    return {
      type: value.constructor?.name || typeof value,
      methods: [...methods].sort()
    };
  }
}
