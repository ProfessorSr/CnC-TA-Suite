const WIDTH = 9;
const HEIGHT = 8;

const neighbors = (x, y) => {
  const result = [];
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    if ((dx || dy) && x + dx >= 0 && x + dx < WIDTH && y + dy >= 0 && y + dy < HEIGHT) {
      result.push([x + dx, y + dy]);
    }
  }
  return result;
};

const kind = (building) => {
  const name = String(building.name).toLowerCase();
  if (name.includes('harvester')) return building.resourceType === 2 ? 'crystal-harvester' : 'tiberium-harvester';
  if (name.includes('refinery')) return 'refinery';
  if (name.includes('power plant')) return 'power-plant';
  if (name.includes('accumulator')) return 'accumulator';
  if (name.includes('silo')) return 'silo';
  return 'other';
};

const resourceValue = (layout, building, x, y) => {
  const type = kind(building);
  const at = new Map(layout.map((item) => [`${item.x}:${item.y}`, kind(item)]));
  const nearby = neighbors(x, y).map(([nx, ny]) => at.get(`${nx}:${ny}`));
  const count = (value) => nearby.filter((item) => item === value).length;
  if (type === 'tiberium-harvester') return { tiberium: building.resourceType === 1 ? 12 : -30, crystal: 0, power: 0, storage: 0 };
  if (type === 'crystal-harvester') return { tiberium: 0, crystal: building.resourceType === 2 ? 12 : -30, power: 0, storage: 0 };
  if (type === 'refinery') return { tiberium: count('tiberium-harvester') * 5, crystal: 0, power: 0, storage: 0 };
  if (type === 'power-plant') return { tiberium: 0, crystal: 0, power: count('crystal-harvester') * 5, storage: 0 };
  if (type === 'accumulator') return { tiberium: 0, crystal: 0, power: count('power-plant') * 4, storage: 8 };
  if (type === 'silo') return { tiberium: 0, crystal: 0, power: 0, storage: (count('tiberium-harvester') + count('crystal-harvester')) * 4 + 8 };
  return { tiberium: 0, crystal: 0, power: 0, storage: 0 };
};

export class LayoutOptimizer {
  static score(layout, options) {
    const totals = { tiberium: 0, crystal: 0, power: 0, storage: 0 };
    for (const building of layout) {
      const value = resourceValue(layout, building, building.x, building.y);
      const level = Math.max(1, Number(building.level) || 1);
      for (const key of Object.keys(totals)) totals[key] += value[key] * level;
    }
    const weights = options.weights;
    const shortfall = Math.max(0, Number(options.minimumStorage || 0) - totals.storage);
    return {
      totals,
      value: totals.tiberium * weights.tiberium
        + totals.crystal * weights.crystal
        + totals.power * weights.power
        + totals.storage * weights.storage
        - shortfall * 1000,
      shortfall
    };
  }

  static optimize(snapshot, options) {
    const current = snapshot.buildings.map((item) => ({ ...item }));
    const scoreOptions = { ...options, minimumStorage: 0 };
    const currentScore = this.score(current, scoreOptions);
    const movable = current.filter((item) => !options.fixedIds.has(String(item.id)));
    const candidates = [{ name: 'Current layout', layout: current, ...currentScore }];
    const attempts = Math.max(30, movable.length * movable.length);
    let working = current.map((item) => ({ ...item }));
    let workingScore = currentScore;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const left = movable[attempt % Math.max(1, movable.length)];
      const right = movable[Math.floor(attempt / Math.max(1, movable.length)) % Math.max(1, movable.length)];
      if (!left || !right || left.id === right.id) continue;
      const proposal = working.map((item) => ({ ...item }));
      const a = proposal.find((item) => String(item.id) === String(left.id));
      const b = proposal.find((item) => String(item.id) === String(right.id));
      [a.x, b.x] = [b.x, a.x];
      [a.y, b.y] = [b.y, a.y];
      [a.resourceType, b.resourceType] = [b.resourceType, a.resourceType];
      const score = this.score(proposal, scoreOptions);
      const moves = proposal.filter((item) => {
        const before = current.find((old) => String(old.id) === String(item.id));
        return before.x !== item.x || before.y !== item.y;
      }).length;
      if (moves <= options.maximumMoves && score.value > workingScore.value) {
        working = proposal;
        workingScore = score;
        candidates.push({ name: `Optimized layout ${candidates.length}`, layout: working, ...score });
      }
    }
    const ranked = candidates.sort((a, b) => b.value - a.value).slice(0, 5).map((candidate, index) => {
      const changes = candidate.layout.flatMap((item) => {
        const before = current.find((old) => String(old.id) === String(item.id));
        return before.x === item.x && before.y === item.y ? [] : [{
          action: 'Move', id: item.id, name: item.name, fromX: before.x, fromY: before.y,
          toX: item.x, toY: item.y, level: item.level
        }];
      });
      return Object.freeze({ ...candidate, rank: index + 1, changes: Object.freeze(changes) });
    });
    const best = ranked[0];
    const dominant = Object.entries(options.weights)
      .filter(([key]) => key !== 'storage')
      .sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'tiberium';
    const desiredName = dominant === 'power' ? 'Accumulator'
      : dominant === 'crystal' ? 'Silo'
        : 'Refinery';
    const replacements = current
      .filter((item) => options.replacementIds.has(String(item.id)))
      .slice(0, options.maximumReplacements)
      .map((item) => {
        const replacement = dominant === 'tiberium' && item.resourceType === 1 ? 'Tiberium Harvester'
          : dominant === 'crystal' && item.resourceType === 2 ? 'Crystal Harvester'
            : desiredName;
        return {
        action: 'Replace', id: item.id, name: `${item.name} → ${replacement}`,
        fromX: item.x, fromY: item.y, toX: item.x, toY: item.y, level: item.level,
        estimatedCost: null
      }; });
    const productive = current.filter((item) => kind(item) !== 'other')
      .sort((left, right) => right.level - left.level);
    const upgrades = productive.slice(0, 3).map((item) => ({
      action: 'Upgrade', id: item.id, name: item.name,
      fromX: item.x, fromY: item.y, toX: item.x, toY: item.y,
      level: `${item.level} → ${item.level + 1}`, estimatedCost: item.upgradeCost
    }));
    const occupied = new Set(current.map((item) => `${item.x}:${item.y}`));
    const empty = [];
    for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
      if (!occupied.has(`${x}:${y}`) && !snapshot.resourceFields?.some((field) => field.x === x && field.y === y)) empty.push({ x, y });
    }
    const additions = options.maximumReplacements > replacements.length && empty.length
      ? [{ action: 'Add', id: null, name: desiredName, fromX: null, fromY: null,
        toX: empty[0].x, toY: empty[0].y, level: 1, estimatedCost: null }]
      : [];
    const recommendations = Object.freeze([...best.changes, ...replacements, ...additions, ...upgrades]);
    const scale = (key) => currentScore.totals[key] > 0
      ? best.totals[key] / currentScore.totals[key]
      : 1 + Math.max(0, best.totals[key]) / 100;
    const production = Object.fromEntries(Object.entries(snapshot.production).map(([key, value]) => [key, {
      current: value,
      proposed: value * scale(key),
      gain: value * scale(key) - value
    }]));
    const storageValues = Object.values(snapshot.storage ?? {}).filter((value) => value > 0);
    const currentStorage = storageValues.length ? Math.min(...storageValues) : 0;
    const storageScale = scale('storage');
    const proposedStorage = currentStorage * storageScale;
    const conflicts = [];
    if (options.minimumStorage > 0 && proposedStorage < options.minimumStorage) {
      conflicts.push(`Minimum storage remains short by ${Math.ceil(options.minimumStorage - proposedStorage).toLocaleString()}.`);
    }
    const weightTotal = Object.values(options.weights).reduce((sum, value) => sum + Number(value || 0), 0);
    if (weightTotal !== 100 && options.weights.storage === 0) conflicts.push(`Custom production weights total ${weightTotal}% rather than 100%.`);
    if (!best.changes.length) conflicts.push('No higher-scoring layout was found within the move and fixed-building constraints.');
    return Object.freeze({ current: ranked.find((item) => item.name === 'Current layout') ?? candidates[0], best, ranked, production, storage: { current: currentStorage, proposed: proposedStorage }, conflicts, recommendations });
  }
}

export { WIDTH, HEIGHT, kind };
