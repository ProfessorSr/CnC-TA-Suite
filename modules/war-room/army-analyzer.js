export class ArmyAnalyzer {
  static rows(snapshot) {
    return snapshot.units.map((unit) => [
      unit.name,
      unit.level,
      `${Math.round(Number(unit.health) <= 1 ? Number(unit.health) * 100 : Number(unit.health))}%`,
      `${unit.x}:${unit.y}`,
      unit.group ?? '—'
    ]);
  }
}
