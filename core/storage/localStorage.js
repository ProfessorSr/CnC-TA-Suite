export class LocalStorageAdapter {
  constructor(prefix = 'cnc-ta-suite:') {
    this.prefix = prefix;
  }

  getKey(key) {
    return `${this.prefix}${key}`;
  }

  async get(key) {
    const raw = localStorage.getItem(this.getKey(key));
    return raw === null ? undefined : JSON.parse(raw);
  }

  async set(key, value) {
    localStorage.setItem(this.getKey(key), JSON.stringify(value));
    return true;
  }

  async remove(key) {
    localStorage.removeItem(this.getKey(key));
    return true;
  }

  async clear() {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(this.prefix));
    for (const key of keys) localStorage.removeItem(key);
    return true;
  }
}
