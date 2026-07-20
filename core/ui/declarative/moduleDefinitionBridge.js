import { normalizeModuleDefinition } from './moduleDefinition.js';

export const UI_SCHEMA_VERSION = '1.0.0';

function customRenderer(module) {
  return ({ context }) => {
    if (typeof module.build === 'function') return module.build(context);
    if (typeof module.buildWindow === 'function') return module.buildWindow(context);
    throw new Error(`Module "${module.id}" owns a specialized window and must be opened through its module action.`);
  };
}

export function adoptModuleDefinition(module, manifest) {
  if (module.definition) {
    const normalized = normalizeModuleDefinition(module.definition);
    module.definition = Object.freeze({ ...normalized, uiSchemaVersion: UI_SCHEMA_VERSION, renderer: 'declarative', generated: false });
    return module.definition;
  }

  const settings = manifest.settings ?? {};
  const definition = normalizeModuleDefinition({
    manifest: { ...manifest, settings },
    window: {
      title: manifest.name,
      icon: module.icon ?? manifest.id,
      tabs: [{
        id: 'main', title: manifest.name,
        controls: [{ type: 'custom', render: customRenderer(module) }]
      }],
      toolbar: []
    },
    providers: {
      moduleState: ({ context }) => ({
        id: manifest.id,
        state: context.modules?.getState?.(manifest.id) ?? 'registered',
        version: manifest.version,
        apiVersion: manifest.apiVersion,
        hubApiVersion: manifest.hubApiVersion
      }),
      ...(module.providers ?? {})
    },
    actions: {
      open: ({ context }) => module.open?.(context),
      enable: ({ context }) => context.modules?.setEnabled?.(manifest.id, true),
      disable: ({ context }) => context.modules?.setEnabled?.(manifest.id, false)
    }
  });
  module.definition = Object.freeze({
    ...definition,
    uiSchemaVersion: UI_SCHEMA_VERSION,
    renderer: 'custom',
    generated: true
  });
  return module.definition;
}

export function definitionSummary(module) {
  const definition = module?.definition;
  return definition ? Object.freeze({
    id: module.id,
    uiSchemaVersion: definition.uiSchemaVersion,
    renderer: definition.renderer,
    generated: definition.generated,
    tabs: definition.window.tabs.map((tab) => tab.id),
    actions: Object.keys(definition.actions),
    providers: Object.keys(definition.providers),
    settings: Object.keys(definition.manifest.settings ?? {})
  }) : null;
}
