function healthPercent(unit) {
  const value = Number(unit?.health);
  return Math.max(0, Math.min(100, value <= 1 ? value * 100 : value));
}

function movementRole(unit, snapshot) {
  const types = snapshot?.movementTypes ?? {};
  const movement = Number(unit?.movementType);
  if ([types.Air, types.Air2].some((value) => value != null && Number(value) === movement)) return 'Aircraft';
  if (types.Feet != null && Number(types.Feet) === movement) return 'Infantry';
  if (types.Track != null && Number(types.Track) === movement) return 'Tracked vehicle';
  if (types.Wheel != null && Number(types.Wheel) === movement) return 'Wheeled vehicle';
  return unit?.attackRange > 1 ? 'Ranged unit' : 'Front-line unit';
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function armorLabel(unit, snapshot) {
  const armor = finite(unit?.preferredArmorType);
  if (armor === null) return 'General';
  const name = Object.entries(snapshot?.armorTypes ?? {})
    .find(([, value]) => Number(value) === armor)?.[0];
  return name ? name.replace(/([a-z])([A-Z])/g, '$1 $2') : `Armor ${armor}`;
}

function soloEstimate(unit, snapshot) {
  const level = Math.max(0, finite(unit?.level) ?? 0);
  const preferred = finite(unit?.preferredArmorType) !== null;
  // This is a comparison aid, not a replacement for native simulation. A
  // preferred-target matchup receives a conservative level allowance.
  return `${armorLabel(unit, snapshot)} ≤ L${Math.max(1, Math.floor(level + (preferred ? 3 : 1)))}`;
}

export class ArmyAnalyzer {
  static rows(snapshot) {
    const resources = snapshot.resourceTypes ?? {};
    return snapshot.units.map((unit) => [
      unit.name,
      movementRole(unit, snapshot),
      unit.level,
      `${Math.round(healthPercent(unit))}%`,
      unit.enabled === false ? 'Hidden' : healthPercent(unit) < 100 ? 'Damaged' : 'Ready',
      `${Number(unit.x) + 1}:${Number(unit.y) + 1}`,
      finite(unit.attackRange) === null ? '—' : finite(unit.attackRange).toFixed(1),
      finite(unit.speed) === null ? '—' : finite(unit.speed).toFixed(1),
      armorLabel(unit, snapshot),
      soloEstimate(unit, snapshot),
      Math.round(Number(unit.repairCosts?.[resources.Crystal ?? resources.Chrystal] ?? 0))
    ]);
  }

  static summarize(snapshot) {
    const units = snapshot.units ?? [];
    const ready = units.filter((unit) => unit.enabled !== false && healthPercent(unit) >= 100).length;
    const hidden = units.filter((unit) => unit.enabled === false).length;
    const damaged = units.filter((unit) => healthPercent(unit) < 100).length;
    const averageLevel = units.length ? units.reduce((sum, unit) => sum + Number(unit.level || 0), 0) / units.length : 0;
    const averageHealth = units.length ? units.reduce((sum, unit) => sum + healthPercent(unit), 0) / units.length : 0;
    const powerIndex = units.reduce((sum, unit) => sum + Number(unit.level || 0) * healthPercent(unit) / 100 * (unit.enabled === false ? 0 : 1), 0);
    const roles = units.reduce((counts, unit) => {
      const role = movementRole(unit, snapshot).replace(/^(Tracked|Wheeled) /, '');
      counts[role] = (counts[role] ?? 0) + 1;
      return counts;
    }, {});
    return {
      unitCount: units.length,
      ready,
      damaged,
      hidden,
      averageLevel,
      averageHealth,
      readinessIndex: powerIndex,
      roles,
      text: `${units.length} units · ${ready} fully ready · ${damaged} damaged · ${hidden} hidden · `
        + `avg level ${averageLevel.toFixed(1)} · avg health ${averageHealth.toFixed(1)}% · `
        + `readiness index ${powerIndex.toFixed(1)} · ${Object.entries(roles).map(([name, count]) => `${name} ${count}`).join(' / ')}`
    };
  }
}
