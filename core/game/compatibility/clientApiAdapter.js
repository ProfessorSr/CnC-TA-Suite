export const CLIENT_ADAPTER_VERSION = '1.0.0';

const CAPABILITIES = Object.freeze({
  mainData: Object.freeze({ required: true, paths: Object.freeze(['Data.MainData.GetInstance']) }),
  player: Object.freeze({ required: false, methods: Object.freeze(['get_Player']) }),
  cities: Object.freeze({ required: false, methods: Object.freeze(['get_Cities']) }),
  world: Object.freeze({ required: false, methods: Object.freeze(['get_World']) }),
  server: Object.freeze({ required: true, methods: Object.freeze(['get_Server']) }),
  battlegroundLoot: Object.freeze({ required: false, paths: Object.freeze(['API.Battleground.GetInstance']) }),
  researchByFaction: Object.freeze({ required: false, paths: Object.freeze(['Base.Tech.GetTechIdFromTechNameAndFaction']) }),
  qooxdooWidgets: Object.freeze({ required: true, environment: 'application' })
});

function pathValue(root, path) {
  return path.split('.').reduce((value, key) => value?.[key], root);
}

export class ClientApiAdapter {
  constructor({ environment, clientLibManager, logger } = {}) {
    this.environment = environment ?? {};
    this.clientLibManager = clientLibManager;
    this.logger = logger;
    this.version = CLIENT_ADAPTER_VERSION;
  }

  mainData() { return this.clientLibManager?.getMainData?.() ?? null; }
  call(target, names, ...args) { return this.clientLibManager?.call?.(target, names, ...args) ?? null; }

  capability(name) {
    const definition = CAPABILITIES[name];
    if (!definition) return Object.freeze({ name, supported: false, required: false, reason: 'Unknown capability.' });
    let supported = false;
    try {
      if (definition.environment) supported = Boolean(this.environment[definition.environment]);
      else if (definition.methods) supported = definition.methods.some((method) => typeof this.mainData()?.[method] === 'function');
      else supported = definition.paths.some((path) => typeof pathValue(this.clientLibManager?.root, path) === 'function');
    } catch { supported = false; }
    return Object.freeze({
      name,
      supported,
      required: definition.required,
      reason: supported ? null : `Client capability "${name}" is unavailable.`
    });
  }

  report() {
    const capabilities = Object.freeze(Object.fromEntries(
      Object.keys(CAPABILITIES).map((name) => [name, this.capability(name)])
    ));
    const missingRequired = Object.freeze(Object.values(capabilities).filter((item) => item.required && !item.supported));
    return Object.freeze({ adapterVersion: this.version, compatible: missingRequired.length === 0, capabilities, missingRequired });
  }
}

export { CAPABILITIES as CLIENT_CAPABILITIES };
