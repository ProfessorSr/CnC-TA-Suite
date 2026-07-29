const PRESET_KEY = 'module:war-room:formation-presets:v1';

function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] !== 'function') continue;
      const value = target[name](...args);
      if (value != null) return value;
    } catch { /* Region objects can be replaced while the map redraws. */ }
  }
  return null;
}

function basePlateMethod(prototype) {
  let surface = prototype;
  while (surface && surface !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(surface)) {
      const method = surface[name];
      if (typeof method !== 'function' || name === 'constructor') continue;
      const source = Function.prototype.toString.call(method);
      if ((source.includes('Blue') && source.includes('Black'))
        || source.includes('EBackgroundPlateColor')) return { owner: surface, name, method };
    }
    surface = Object.getPrototypeOf(surface);
  }
  return null;
}

export class FormationTargetHighlighter {
  constructor({ context, hub }) {
    this.context = context;
    this.hub = hub;
    this.saved = new Set();
    this.hookIds = [];
    this.installedClasses = new Set();
    this.attackerId = null;
    this.highlightColor = null;
  }

  async refresh() {
    const presets = await this.context.storage?.get?.(PRESET_KEY, []) ?? [];
    this.saved = new Set(presets
      .filter((preset) => preset?.attackerId != null && preset?.target?.id != null)
      .map((preset) => `${String(preset.attackerId)}:${String(preset.target.id)}`));
    this.refreshMap();
  }

  currentAttackerId() {
    return this.attackerId;
  }

  setAttackerId(attackerId) {
    if (String(this.attackerId ?? '') === String(attackerId ?? '')) return;
    this.attackerId = attackerId ?? null;
    this.highlightColor = this.resolveFactionColor();
    this.refreshMap();
  }

  hasFormation(targetId) {
    const attackerId = this.currentAttackerId();
    return attackerId != null && targetId != null
      && this.saved.has(`${String(attackerId)}:${String(targetId)}`);
  }

  resolveFactionColor() {
    const root = this.hub.clientLib()?.root ?? globalThis.ClientLib;
    const player = call(this.hub.mainData(), ['get_Player']);
    const faction = Number(call(player, ['get_Faction', 'get_PlayerFaction']) ?? 0);
    const colors = root?.Vis?.EBackgroundPlateColor ?? {};
    // GDI uses the cool blue/cyan plate; NOD uses the warm orange/red plate.
    return faction === 1
      ? (colors.Cyan ?? colors.Blue)
      : (colors.Orange ?? colors.Red);
  }

  factionColor() { return this.highlightColor; }

  installClass(className) {
    if (this.installedClasses.has(className)) return true;
    const root = this.hub.clientLib()?.root ?? globalThis.ClientLib;
    const prototype = root?.Vis?.Region?.[className]?.prototype;
    const discovered = basePlateMethod(prototype);
    if (!discovered) return false;
    const highlighter = this;
    const { owner, name, method: original } = discovered;
    function suiteFormationBasePlate(...args) {
      const nativeColor = original.apply(this, args);
      try {
        const targetId = call(this, ['get_Id', 'getID', 'get_BaseId']);
        if (!highlighter.hasFormation(targetId)) return nativeColor;
        return highlighter.factionColor() ?? nativeColor;
      } catch {
        return nativeColor;
      }
    }
    owner[name] = suiteFormationBasePlate;
    const hookId = `war-room:formation-target:${className}`;
    this.context.hooks.register(hookId, () => {
      if (owner[name] === suiteFormationBasePlate) owner[name] = original;
    }, { replace: true });
    this.hookIds.push(hookId);
    this.installedClasses.add(className);
    return true;
  }

  install() {
    for (const name of ['RegionCity', 'RegionNPCBase', 'RegionNPCCamp']) this.installClass(name);
  }

  refreshMap() {
    const vis = this.hub.clientLib()?.root?.Vis?.VisMain?.GetInstance?.()
      ?? globalThis.ClientLib?.Vis?.VisMain?.GetInstance?.();
    call(vis, ['Update', 'Refresh', 'Invalidate', 'UpdateRegion']);
  }

  destroy() {
    for (const id of this.hookIds) this.context.hooks?.uninstall?.(id);
    this.hookIds = [];
    this.installedClasses.clear();
    this.saved.clear();
    this.attackerId = null;
    this.highlightColor = null;
  }
}
