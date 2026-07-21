import { ChromeStorageAdapter } from './chromeStorage.js';
import { LocalStorageAdapter } from './localStorage.js';

export class StorageService {
  constructor(logger, { primary = null, fallback = null } = {}) {
    this.logger = logger;
    this.primary = primary ?? new ChromeStorageAdapter();
    this.fallback = fallback ?? new LocalStorageAdapter();
    this.primaryUnavailable = false;
    this.fallbackWarningLogged = false;
  }

  useFallback(error) {
    this.primaryUnavailable = true;
    if (!this.fallbackWarningLogged) {
      this.fallbackWarningLogged = true;
      this.logger.warn('Chrome storage unavailable; using localStorage for this session.', error);
    }
  }

  async get(key, defaultValue) {
    if (this.primaryUnavailable) {
      const value = await this.fallback.get(key);
      return value === undefined ? defaultValue : value;
    }
    try {
      const value = await this.primary.get(key);
      return value === undefined ? defaultValue : value;
    } catch (error) {
      this.useFallback(error);
      const value = await this.fallback.get(key);
      return value === undefined ? defaultValue : value;
    }
  }

  async set(key, value) {
    if (this.primaryUnavailable) return this.fallback.set(key, value);
    try {
      return await this.primary.set(key, value);
    } catch (error) {
      this.useFallback(error);
      return this.fallback.set(key, value);
    }
  }

  async remove(key) {
    if (this.primaryUnavailable) return this.fallback.remove(key);
    try {
      return await this.primary.remove(key);
    } catch (error) {
      this.useFallback(error);
      return this.fallback.remove(key);
    }
  }
}
