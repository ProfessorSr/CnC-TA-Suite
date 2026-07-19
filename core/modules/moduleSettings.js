function normalizeDefinition(key, definition) {
  const normalized = definition && typeof definition === 'object' && !Array.isArray(definition)
    ? { ...definition }
    : { default: definition };

  if (!Object.hasOwn(normalized, 'default')) {
    throw new TypeError(`Module setting "${key}" must define a default value.`);
  }

  normalized.type ??= Array.isArray(normalized.default) ? 'array' : typeof normalized.default;
  if (!['boolean', 'number', 'string', 'array', 'object'].includes(normalized.type)) {
    throw new TypeError(`Module setting "${key}" has unsupported type "${normalized.type}".`);
  }
  if (normalized.enum && (!Array.isArray(normalized.enum) || normalized.enum.length === 0)) {
    throw new TypeError(`Module setting "${key}" enum must be a non-empty array.`);
  }
  return Object.freeze(normalized);
}

function validateValue(key, value, definition) {
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  if (actualType !== definition.type) {
    throw new TypeError(`Module setting "${key}" must be ${definition.type}.`);
  }
  if (definition.enum && !definition.enum.includes(value)) {
    throw new RangeError(`Module setting "${key}" must be one of: ${definition.enum.join(', ')}.`);
  }
  if (typeof value === 'number') {
    if (definition.min !== undefined && value < definition.min) throw new RangeError(`Module setting "${key}" must be at least ${definition.min}.`);
    if (definition.max !== undefined && value > definition.max) throw new RangeError(`Module setting "${key}" must be at most ${definition.max}.`);
  }
}

export class ModuleSettings {
  constructor({ settings, eventBus, logger } = {}) {
    this.settings = settings;
    this.eventBus = eventBus;
    this.logger = logger;
    this.schemas = new Map();
  }

  register(moduleId, definitions = {}) {
    const schema = Object.freeze(Object.fromEntries(
      Object.entries(definitions).map(([key, definition]) => [key, normalizeDefinition(key, definition)])
    ));
    this.schemas.set(moduleId, schema);
    return schema;
  }

  unregister(moduleId) {
    return this.schemas.delete(moduleId);
  }

  schema(moduleId) {
    return this.schemas.get(moduleId) ?? Object.freeze({});
  }

  get(moduleId, key, fallback) {
    const definition = this.schema(moduleId)[key];
    const defaultValue = definition?.default ?? fallback;
    return this.settings?.get?.(`moduleSettings.${moduleId}.${key}`, defaultValue) ?? defaultValue;
  }

  async set(moduleId, key, value) {
    const definition = this.schema(moduleId)[key];
    if (!definition) throw new Error(`Unknown setting "${key}" for module "${moduleId}".`);
    validateValue(key, value, definition);
    await this.settings.set(`moduleSettings.${moduleId}.${key}`, value);
    return value;
  }

  scoped(moduleId) {
    return Object.freeze({
      get: (key, fallback) => this.get(moduleId, key, fallback),
      set: (key, value) => this.set(moduleId, key, value),
      schema: () => this.schema(moduleId)
    });
  }
}
