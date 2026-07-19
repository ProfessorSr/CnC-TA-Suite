import { ChromeStorageAdapter } from './chromeStorage.js';
import { LocalStorageAdapter } from './localStorage.js';

export class StorageService {
  constructor(logger) {
    this.logger = logger;
    this.primary = new ChromeStorageAdapter();
    this.fallback = new LocalStorageAdapter();
  }

  async get(key, defaultValue) {
    try {
      const value = await this.primary.get(key);
      return value === undefined ? defaultValue : value;
    } catch (error) {
      this.logger.warn('Chrome storage unavailable; using localStorage fallback.', error);
      const value = await this.fallback.get(key);
      return value === undefined ? defaultValue : value;
    }
  }

  async set(key, value) {
    try {
      return await this.primary.set(key, value);
    } catch (error) {
      this.logger.warn('Chrome storage write failed; using localStorage fallback.', error);
      return this.fallback.set(key, value);
    }
  }

  async remove(key) {
    try {
      return await this.primary.remove(key);
    } catch {
      return this.fallback.remove(key);
    }
  }
}
