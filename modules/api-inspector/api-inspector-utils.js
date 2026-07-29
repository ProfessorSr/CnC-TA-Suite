const SENSITIVE_KEY = /(password|passphrase|token|secret|credential|authorization|cookie|session|email|playername|ownername|alliancename)/i;

export function safeClone(value, { redactSensitive = false } = {}, seen = new WeakSet(), depth = 0) {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return '[Function]';
  if (typeof value !== 'object') return String(value);
  if (depth >= 7) return '[Maximum depth]';
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => safeClone(item, { redactSensitive }, seen, depth + 1));
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = key === 'raw'
      ? '[omitted mutable game object]'
      : redactSensitive && SENSITIVE_KEY.test(key)
      ? '[redacted]'
      : safeClone(item, { redactSensitive }, seen, depth + 1);
  }
  return result;
}

function capture(read) {
  try {
    return { available: true, value: safeClone(read()) };
  } catch (error) {
    return { available: false, error: error?.message ?? String(error) };
  }
}

export function inspectPublicApi(api) {
  if (!api) return { ready: false, version: 'unavailable', services: {} };
  return {
    ready: Boolean(api.ready),
    version: api.version ?? 'unknown',
    services: {
      player: capture(() => api.player.current()),
      city: capture(() => ({ current: api.city.current(), owned: api.city.all() })),
      world: capture(() => api.world.info()),
      alliance: capture(() => api.alliance.current()),
      base: capture(() => ({ selected: api.base.selected(), level: api.base.level() })),
      battle: capture(() => ({
        active: api.battle.isActive(),
        state: api.battle.state(),
        target: api.battle.target(),
        attacker: api.battle.attacker(),
        defender: api.battle.defender()
      })),
      selection: capture(() => api.selection.snapshot()),
      objects: capture(() => api.objects.snapshot()),
      cache: capture(() => api.cache.snapshot())
    }
  };
}

export function redactedExport({ suiteVersion, apiSnapshot, diagnostics }) {
  return safeClone({
    generatedAt: new Date().toISOString(),
    suiteVersion,
    api: apiSnapshot,
    diagnostics
  }, { redactSensitive: true });
}
