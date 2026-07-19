import { SETTINGS_SCHEMA } from './schema.js';

function readPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

export function validateSettings(settings) {
  const errors = [];
  for (const [path, rule] of Object.entries(SETTINGS_SCHEMA)) {
    const value = readPath(settings, path);
    if (Array.isArray(rule)) {
      if (!rule.includes(value)) errors.push(`${path} must be one of: ${rule.join(', ')}`);
    } else if (typeof value !== rule) {
      errors.push(`${path} must be ${rule}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
