export function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createId(prefix = 'cnc') {
  return `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

export function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  const output = Array.isArray(target) ? [...target] : { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = deepMerge(output[key] || {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
}
