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
  if (name.includes('harvester')) return building.resourceType === 1 ? 'crystal-harvester' : 'tiberium-harvester';
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
  if (type === 'tiberium-harvester') return { tiberium: building.resourceType === 2 ? 12 : -30, crystal: 0, power: 0, credits: 0 };
  if (type === 'crystal-harvester') return { tiberium: 0, crystal: building.resourceType === 1 ? 12 : -30, power: 0, credits: 0 };
  if (type === 'refinery') return { tiberium: 0, crystal: 0, power: 0, credits: count('tiberium-harvester') * 5 };
  if (type === 'power-plant') return { tiberium: 0, crystal: 0, power: count('crystal-harvester') * 5, credits: 0 };
  if (type === 'accumulator') return { tiberium: 0, crystal: 0, power: count('power-plant') * 4, credits: 0 };
  if (type === 'silo') return { tiberium: count('tiberium-harvester') * 4, crystal: count('crystal-harvester') * 4, power: 0, credits: 0 };
  return { tiberium: 0, crystal: 0, power: 0, credits: 0 };
};

const movedCount = (layout, currentById) => layout.reduce((total, building) => {
  const before = currentById.get(String(building.id));
  return total + Number(Boolean(before && (before.x !== building.x || before.y !== building.y)));
}, 0);

const legalPosition = (building, resourceType) => {
  const buildingKind = kind(building);
  if (buildingKind === 'tiberium-harvester' || buildingKind === 'crystal-harvester') {
    return resourceType === 1 || resourceType === 2;
  }
  return resourceType === 0;
};

export class LayoutOptimizer {
  static score(layout, options) {
    const totals = { tiberium: 0, crystal: 0, power: 0, credits: 0 };
    for (const building of layout) {
      const value = resourceValue(layout, building, building.x, building.y);
      const level = Math.max(1, Number(building.level) || 1);
      for (const key of Object.keys(totals)) totals[key] += value[key] * level;
    }
    const weights = options.weights;
    return {
      totals,
      value: totals.tiberium * weights.tiberium
        + totals.crystal * weights.crystal
        + totals.power * weights.power
        + totals.credits * weights.credits
    };
  }

  static optimize(snapshot, options) {
    const current = snapshot.buildings.map((item) => ({ ...item }));
    const scoreOptions = options;
    const currentScore = this.score(current, scoreOptions);
    const fixedIds = options.fixedIds ?? new Set();
    const currentById = new Map(current.map((item) => [String(item.id), item]));
    const terrain = new Map((snapshot.resourceFields ?? []).map((field) => [`${field.x}:${field.y}`, Number(field.type)]));
    const terrainAt = (x, y) => terrain.get(`${x}:${y}`) ?? 0;
    const candidates = [{ name: 'Current layout', layout: current, ...currentScore }];
    let working = current.map((item) => ({ ...item }));
    let workingScore = currentScore;
    const maximumMoves = Math.max(0, Number(options.maximumMoves) || 0);
    for (let step = 0; step < maximumMoves; step += 1) {
      const occupied = new Map(working.map((building) => [`${building.x}:${building.y}`, building]));
      let bestNeighbor = null;
      let bestNeighborScore = workingScore;
      for (const source of working) {
        if (fixedIds.has(String(source.id))) continue;
        for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
          if (source.x === x && source.y === y) continue;
          const destination = occupied.get(`${x}:${y}`);
          if (destination && fixedIds.has(String(destination.id))) continue;
          const sourceTerrain = terrainAt(source.x, source.y);
          const destinationTerrain = terrainAt(x, y);
          if (!legalPosition(source, destinationTerrain)) continue;
          if (destination && !legalPosition(destination, sourceTerrain)) continue;
          const proposal = working.map((building) => ({ ...building }));
          const movedSource = proposal.find((building) => String(building.id) === String(source.id));
          movedSource.x = x;
          movedSource.y = y;
          movedSource.resourceType = destinationTerrain;
          if (destination) {
            const movedDestination = proposal.find((building) => String(building.id) === String(destination.id));
            movedDestination.x = source.x;
            movedDestination.y = source.y;
            movedDestination.resourceType = sourceTerrain;
          }
          if (movedCount(proposal, currentById) > maximumMoves) continue;
          const score = this.score(proposal, scoreOptions);
          if (score.value > bestNeighborScore.value) {
            bestNeighbor = proposal;
            bestNeighborScore = score;
          }
        }
      }
      if (!bestNeighbor) break;
      working = bestNeighbor;
      workingScore = bestNeighborScore;
      candidates.push({
        name: `Optimized layout ${candidates.length}`,
        layout: working,
        ...workingScore
      });
      if (movedCount(working, currentById) >= maximumMoves) break;
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
      .sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'tiberium';
    const desiredName = dominant === 'power' ? 'Accumulator'
      : dominant === 'crystal' ? 'Silo'
        : 'Refinery';
    const replacements = current
      .filter((item) => options.replacementIds.has(String(item.id)))
      .slice(0, options.maximumReplacements)
      .map((item) => {
        const replacement = dominant === 'tiberium' && item.resourceType === 2 ? 'Tiberium Harvester'
          : dominant === 'crystal' && item.resourceType === 1 ? 'Crystal Harvester'
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
    const conflicts = [];
    const weightTotal = Object.values(options.weights).reduce((sum, value) => sum + Number(value || 0), 0);
    if (weightTotal !== 100) conflicts.push(`Custom production weights total ${weightTotal}% rather than 100%.`);
    if (!best.changes.length) conflicts.push('No higher-scoring layout was found within the move and fixed-building constraints.');
    return Object.freeze({ current: ranked.find((item) => item.name === 'Current layout') ?? candidates[0], best, ranked, production, conflicts, recommendations });
  }
}

export { WIDTH, HEIGHT, kind };
