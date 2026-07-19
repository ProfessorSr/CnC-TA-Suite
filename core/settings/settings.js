import { DEFAULT_SETTINGS } from './defaults.js';
import { validateSettings } from './validator.js';
import { deepMerge } from '../utils/helpers.js';
import { Events } from '../events/eventTypes.js';

export class SettingsService {
  constructor({ storage, eventBus, logger }) {
    this.storage = storage;
    this.eventBus = eventBus;
    this.logger = logger;
    this.key = 'settings';
    this.values = structuredClone(DEFAULT_SETTINGS);
  }

  async load() {
    const saved = await this.storage.get(this.key, {});
    const merged = deepMerge(DEFAULT_SETTINGS, saved);
    const validation = validateSettings(merged);
    if (!validation.valid) {
      this.logger.warn('Invalid saved settings; defaults restored.', validation.errors);
      this.values = structuredClone(DEFAULT_SETTINGS);
      await this.save();
    } else {
      this.values = merged;
    }
    return this.values;
  }

  get(path, fallback) {
    const value = path.split('.').reduce((current, key) => current?.[key], this.values);
    return value === undefined ? fallback : value;
  }

  async set(path, value) {
    const parts = path.split('.');
    let current = this.values;
    while (parts.length > 1) {
      const key = parts.shift();
      current[key] ??= {};
      current = current[key];
    }
    current[parts[0]] = value;

    const validation = validateSettings(this.values);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    await this.save();
    this.eventBus.emit(Events.SETTINGS_CHANGED, { path, value });
  }

  async save() {
    await this.storage.set(this.key, this.values);
  }
}
