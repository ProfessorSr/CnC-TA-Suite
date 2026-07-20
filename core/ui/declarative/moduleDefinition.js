const CONTROL_TYPES = new Set(['text', 'status-list', 'settings', 'custom']);

export function validateModuleDefinition(definition) {
  const errors = [];
  if (!definition || typeof definition !== 'object') errors.push('Definition must be an object.');
  if (!definition?.manifest?.id) errors.push('Definition manifest.id is required.');
  if (!definition?.window?.title) errors.push('Definition window.title is required.');
  const tabs = definition?.window?.tabs ?? [];
  if (!Array.isArray(tabs)) errors.push('Definition window.tabs must be an array.');
  for (const tab of Array.isArray(tabs) ? tabs : []) {
    if (!tab.id || !tab.title) errors.push('Every tab requires id and title.');
    for (const control of tab.controls ?? []) {
      if (!CONTROL_TYPES.has(control.type)) errors.push(`Unsupported declarative control type: ${control.type}`);
      if (control.type === 'custom' && typeof control.render !== 'function') errors.push(`Custom control in tab "${tab.id}" requires render().`);
    }
  }
  for (const action of definition?.window?.toolbar ?? []) {
    if (!action.id || !action.label) errors.push('Every toolbar action requires id and label.');
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function normalizeModuleDefinition(definition) {
  const report = validateModuleDefinition(definition);
  if (!report.valid) throw new TypeError(`Invalid declarative module definition: ${report.errors.join(' ')}`);
  return Object.freeze({
    ...definition,
    manifest: Object.freeze({ ...definition.manifest }),
    providers: Object.freeze({ ...(definition.providers ?? {}) }),
    actions: Object.freeze({ ...(definition.actions ?? {}) }),
    window: Object.freeze({
      width: 520, height: 420, x: 180, y: 90, resizable: true, singleton: true,
      ...definition.window,
      toolbar: Object.freeze([...(definition.window.toolbar ?? [])]),
      tabs: Object.freeze([...(definition.window.tabs ?? [])])
    })
  });
}
