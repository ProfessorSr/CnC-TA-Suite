export function describeObject(value) {
  if (value == null) return { type: String(value) };
  const ctor = value.constructor?.name || typeof value;
  const methods = [];
  let proto = value;
  const seen = new Set();

  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (!seen.has(name) && typeof value[name] === 'function') {
        seen.add(name);
        methods.push(name);
      }
    }
    proto = Object.getPrototypeOf(proto);
  }

  return { type: ctor, methods: methods.sort() };
}
