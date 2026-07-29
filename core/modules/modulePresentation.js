const STATUS = Object.freeze({
  enabled: Object.freeze({ label: 'Running', color: '#62c985' }),
  disabled: Object.freeze({ label: 'Disabled', color: '#aeb6bd' }),
  error: Object.freeze({ label: 'Error', color: '#ff6666' }),
  registered: Object.freeze({ label: 'Ready', color: '#72b9e6' }),
  loaded: Object.freeze({ label: 'Ready', color: '#72b9e6' }),
  unloaded: Object.freeze({ label: 'Unloaded', color: '#aeb6bd' })
});

export function moduleStatus(state) {
  return STATUS[state] ?? Object.freeze({ label: 'Unknown', color: '#d6b85a' });
}

export function moduleVersion(module) {
  return module?.manifest?.version ?? module?.version ?? '0.0.0';
}

export function availableModuleVersion(module) {
  return module?.manifest?.availableVersion ?? module?.availableVersion ?? module?.latestVersion ?? null;
}

function parts(value) {
  return String(value ?? '0.0.0').split(/[.+-]/).slice(0, 3).map((item) => Number(item) || 0);
}

export function hasModuleUpdate(module) {
  const installed = parts(moduleVersion(module));
  const available = parts(availableModuleVersion(module));
  if (!availableModuleVersion(module)) return false;
  for (let index = 0; index < 3; index += 1) {
    if (available[index] !== installed[index]) return available[index] > installed[index];
  }
  return false;
}
