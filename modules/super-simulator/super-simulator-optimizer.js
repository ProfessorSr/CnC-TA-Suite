export const FORMATION_WIDTH = 9;
export const FORMATION_HEIGHT = 4;

const identity = (unit) => String(unit.entityId ?? unit.id ?? unit.mdbId);

export function orderWeakestFirst(units = []) {
  return [...units].sort((left, right) =>
    Number(left.level ?? 0) - Number(right.level ?? 0)
    || Number(left.health ?? left.maxHealth ?? 0) - Number(right.health ?? right.maxHealth ?? 0)
    || String(left.name ?? '').localeCompare(String(right.name ?? ''))
    || identity(left).localeCompare(identity(right))
  );
}

export function formationCells() {
  const cells = [];
  for (let y = 0; y < FORMATION_HEIGHT; y += 1) {
    for (let x = 0; x < FORMATION_WIDTH; x += 1) cells.push(Object.freeze({ x, y }));
  }
  return Object.freeze(cells);
}

export function totalGreedySimulations(unitCount) {
  const count = Math.max(0, Math.min(FORMATION_WIDTH * FORMATION_HEIGHT, Math.floor(Number(unitCount) || 0)));
  return count * 36 - (count * (count - 1)) / 2;
}

export function greedyCandidate({ units, orderedUnits, locked = new Map(), activeUnit, cell }) {
  const occupied = new Set([...locked.values()].map((position) => `${position.x}:${position.y}`));
  const activeId = identity(activeUnit);
  if (occupied.has(`${cell.x}:${cell.y}`)) return null;
  occupied.add(`${cell.x}:${cell.y}`);
  const placements = new Map(locked);
  placements.set(activeId, cell);
  const available = formationCells().filter((position) => !occupied.has(`${position.x}:${position.y}`));
  const hidden = orderedUnits.filter((unit) => !placements.has(identity(unit)));
  for (const unit of hidden) {
    const preferredIndex = available.findIndex((position) =>
      position.x === Number(unit.x) && position.y === Number(unit.y));
    const index = preferredIndex >= 0 ? preferredIndex : 0;
    placements.set(identity(unit), available.splice(index, 1)[0]);
  }
  return units.map((unit) => {
    const unitId = identity(unit);
    const position = placements.get(unitId);
    return {
      ...unit,
      x: position.x,
      y: position.y,
      enabled: locked.has(unitId) || unitId === activeId
    };
  });
}

export function stageCells(locked = new Map()) {
  const occupied = new Set([...locked.values()].map((position) => `${position.x}:${position.y}`));
  return formationCells().filter((cell) => !occupied.has(`${cell.x}:${cell.y}`));
}

export function scoreMaximumResearch(analysis = {}) {
  const research = Math.max(0, Number(analysis.research ?? analysis.lootResources?.research) || 0);
  const defenderDamage = Math.max(0, Number(analysis.defenderDamage) || 0);
  const ownRemaining = Math.max(0, Number(analysis.ownRemaining) || 0);
  return Object.freeze({
    research,
    // Lower scores win throughout the optimizer. RP is authoritative; the
    // smaller terms only resolve equal-RP native results.
    score: -research * 1_000_000 - defenderDamage * 1_000 - ownRemaining
  });
}
