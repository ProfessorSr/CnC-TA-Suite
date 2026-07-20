const STORAGE_KEY = 'module:context-actions:strategic-plans:v1';

function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] !== 'function') continue;
      const value = target[name](...args);
      if (value != null) return value;
    } catch { /* World data can be replaced while the region refreshes. */ }
  }
  return null;
}

function hash(value) {
  let result = 2166136261;
  for (const character of JSON.stringify(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

export class StrategicPlanner {
  constructor(context) {
    this.context = context;
    this.operations = [];
    this.loaded = false;
  }

  root() { return this.context?.hub?.game?.services?.tryGet?.('clientLib')?.root ?? globalThis.ClientLib; }
  main() { return this.root()?.Data?.MainData?.GetInstance?.(); }
  world() { return call(this.main(), ['get_World']); }
  currentCity() { return call(call(this.main(), ['get_Cities']), ['get_CurrentOwnCity']); }

  async load() {
    if (this.loaded) return;
    const saved = await this.context.storage?.get?.(STORAGE_KEY, []);
    this.operations = Array.isArray(saved) ? saved.slice(-100) : [];
    this.loaded = true;
  }

  persist() { return this.context.storage?.set?.(STORAGE_KEY, this.operations); }

  add(type, selection, options = {}) {
    if (!selection?.validCoordinates) throw new Error('The selected object has no usable coordinates.');
    const source = { x: Number(selection.x), y: Number(selection.y) };
    const destination = type === 'move'
      ? { x: Number(options.x), y: Number(options.y) }
      : source;
    if (![destination.x, destination.y].every(Number.isFinite)) throw new Error('Enter a valid destination.');
    const operation = Object.freeze({
      id: `${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(), type,
      object: Object.freeze({
        id: selection.id ?? null, name: selection.name, objectType: selection.type,
        category: selection.category, level: Number(selection.level ?? 0),
        radius: Number(selection.territoryRadius ?? 0), ...source
      }),
      destination: Object.freeze(destination),
      level: type === 'level' ? Math.max(Number(selection.level ?? 0) + 1, Number(options.level ?? 1)) : null,
      ruinOwner: type === 'ruin-for' ? String(options.ruinOwner || 'No alliance') : null
    });
    this.operations.push(operation);
    this.operations = this.operations.slice(-100);
    void this.persist();
    return operation;
  }

  undo() { const removed = this.operations.pop() ?? null; void this.persist(); return removed; }
  reset() { this.operations = []; void this.persist(); }
  historyHash() { return hash(this.operations); }

  projectedObjects() {
    const projected = new Map();
    for (const operation of this.operations) {
      const key = operation.object.id != null ? `id:${operation.object.id}` : `xy:${operation.object.x}:${operation.object.y}`;
      const current = projected.get(key) ?? { ...operation.object, removed: false, ruined: false };
      if (operation.type === 'move') Object.assign(current, operation.destination);
      if (operation.type === 'level') current.level = operation.level;
      if (operation.type === 'remove') current.removed = true;
      if (operation.type === 'ruin' || operation.type === 'ruin-for') {
        current.ruined = true;
        current.ruinOwner = operation.ruinOwner;
      }
      projected.set(key, current);
    }
    return [...projected.values()];
  }

  tunnelInfluenceRange() {
    const announcement = String(call(call(this.main(), ['get_Alliance']), ['get_Announcement']) ?? '');
    const configured = announcement.match(/\[tir\]\s*(\d+)\s*\[\/tir\]/i);
    return configured ? Math.max(1, Number(configured[1])) : 6;
  }

  tunnelAnalysis(x, y) {
    const root = this.root();
    const world = this.world();
    const range = this.tunnelInfluenceRange();
    const offense = Number(call(this.currentCity(), ['get_LvlOffense']) ?? 0);
    const activationDifference = Number(call(call(this.main(), ['get_Server']), ['get_POIActivationLevelDifference']) ?? 0);
    const objectTypes = root?.Data?.WorldSector?.ObjectType ?? {};
    const results = [];
    for (let scanY = y - Math.ceil(range); scanY <= y + Math.ceil(range); scanY += 1) {
      for (let scanX = x - Math.ceil(range); scanX <= x + Math.ceil(range); scanX += 1) {
        const distance = Math.hypot(scanX - x, scanY - y);
        if (distance > range) continue;
        const object = call(world, ['GetObjectFromPosition'], scanX, scanY);
        if (!object) continue;
        const worldType = object.Type ?? call(object, ['get_ObjectType']);
        const poiType = call(object, ['get_Type', 'get_POIType']);
        const tunnel = Number(poiType) === 0 && (
          worldType === objectTypes.PointOfInterest
          || worldType === objectTypes.POI
          || /pointofinterest|tunnel/i.test(String(object.constructor?.name ?? ''))
        );
        if (!tunnel) continue;
        const level = Number(call(object, ['get_Level']) ?? object.Level ?? object.l ?? 0);
        const requiredOffense = Math.max(0, level - activationDifference);
        results.push({
          x: scanX, y: scanY, level, distance,
          offense, requiredOffense,
          usable: offense >= requiredOffense
        });
      }
    }
    return results.sort((left, right) => left.distance - right.distance || right.level - left.level);
  }

  analysis(focus = null) {
    const projected = this.projectedObjects();
    const moves = projected.filter((item) => !item.removed);
    const influenceCells = moves.reduce((total, item) => {
      const radius = Math.max(0, Number(item.radius || Math.ceil(item.level / 10) || 0));
      return total + Math.round(Math.PI * radius * radius);
    }, 0);
    const conflicts = [];
    const world = this.world();
    for (const operation of this.operations.filter((item) => item.type === 'move')) {
      const occupied = call(world, ['GetObjectFromPosition'], operation.destination.x, operation.destination.y);
      if (occupied && !(operation.destination.x === operation.object.x && operation.destination.y === operation.object.y)) {
        conflicts.push(`${operation.object.name}: destination ${operation.destination.x}:${operation.destination.y} is occupied in live state`);
      }
    }
    const point = focus?.validCoordinates ? focus : this.operations.at(-1)?.destination;
    const tunnels = point ? this.tunnelAnalysis(Number(point.x), Number(point.y)) : [];
    return Object.freeze({
      operations: Object.freeze([...this.operations]),
      projected: Object.freeze(projected),
      influenceCells,
      conflicts: Object.freeze(conflicts),
      tunnels: Object.freeze(tunnels),
      tunnelRange: this.tunnelInfluenceRange(),
      historyHash: this.historyHash()
    });
  }
}

export { STORAGE_KEY as STRATEGIC_PLANNER_STORAGE_KEY };
