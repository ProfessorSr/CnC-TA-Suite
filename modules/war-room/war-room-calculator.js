export class WarRoomCalculator {
  static combatProfile(entity) {
    const name = String(entity?.name ?? '').toLowerCase();
    const includes = (...terms) => terms.some((term) => name.includes(term));
    let domain = 'vehicle';
    if (includes(
      'rifle', 'missile squad', 'commando', 'zone trooper', 'black hand',
      'confessor', 'militant', 'rocket fist', 'forgotten infantry'
    )) domain = 'infantry';
    if (includes(
      'orca', 'firehawk', 'cobra', 'vertigo', 'salamander', 'venom',
      'paladin', 'hawk', 'aircraft'
    )) domain = 'air';

    let counter = 'any';
    if (includes('machine gun', 'mg nest', 'sniper', 'shredder', 'anti infantry')) counter = 'infantry';
    if (includes('cannon', 'predator', 'mammoth', 'avatar', 'scorpion', 'anti vehicle')) counter = 'vehicle';
    if (includes('flak', 'sam', 'pitbull', 'slingshot', 'anti air')) counter = 'air';

    const support = includes('guardian', 'paladin', 'confessor', 'support');
    const ranged = Number(entity?.attackRange || 0) > 1
      || includes('missile', 'rocket', 'sniper', 'artillery', 'juggernaut', 'specter', 'firehawk');
    const tank = includes(
      'mammoth', 'avatar', 'predator', 'scorpion', 'reckoner', 'guardian',
      'zone trooper', 'black hand'
    );
    const structure = includes('facility', 'yard', 'center', 'hq', 'turret', 'cannon', 'flak', 'nest');
    return Object.freeze({ domain, counter, support, ranged, tank, structure });
  }

  static summarize(snapshot) {
    const levels = snapshot.units.map((unit) => unit.level).filter(Number.isFinite);
    const averageLevel = levels.length
      ? levels.reduce((sum, level) => sum + level, 0) / levels.length
      : 0;
    const damaged = snapshot.units.filter((unit) =>
      unit.health < (unit.health <= 1 ? 1 : 100)
    ).length;
    const totalRepair = Object.values(snapshot.repair).reduce((sum, value) => sum + Number(value || 0), 0);
    const lootTotal = Object.values(snapshot.loot).reduce((sum, value) => sum + Number(value || 0), 0);
    return Object.freeze({
      unitCount: snapshot.units.length,
      averageLevel,
      damaged,
      totalRepair,
      lootTotal,
      cpEfficiency: snapshot.cpCost > 0 ? lootTotal / snapshot.cpCost : 0,
      levelDelta: averageLevel - Number(snapshot.target?.level || 0),
      readiness: !snapshot.target ? 'No target' : snapshot.units.length ? 'Formation ready' : 'No formation'
    });
  }

  static objective(snapshot, goal) {
    const buildings = snapshot.buildings ?? [];
    if (goal === 'cy') {
      return buildings.find((item) => /construction|yard|cy\b/i.test(item.name))
        ?? buildings.find((item) => [112, 151, 177].includes(Number(item.id)))
        ?? null;
    }
    if (goal === 'df') {
      return buildings.find((item) => /defen[cs]e facility|\bdf\b/i.test(item.name))
        ?? null;
    }
    if (goal === 'cc') {
      return buildings.find((item) => /command center|command centre|\bcc\b/i.test(item.name))
        ?? null;
    }
    if (goal === 'defense') {
      return [...(snapshot.defenseUnits ?? [])].sort((left, right) =>
        Number(right.level || 0) - Number(left.level || 0)
      )[0] ?? null;
    }
    const researchType = snapshot.resourceTypes?.ResearchPoints;
    return [...buildings].sort((left, right) => {
      const value = (item) => item.requirements
        .filter((entry) => entry.type === researchType)
        .reduce((sum, entry) => sum + entry.amount, 0);
      return value(right) - value(left);
    })[0] ?? null;
  }

  static recommendFormation(snapshot, goal = 'cy') {
    const width = 9;
    const height = 4;
    const objective = this.objective(snapshot, goal);
    const objectiveColumn = Math.max(0, Math.min(width - 1, Number(objective?.x ?? 4)));
    const threats = Array.from({ length: width }, () => 0);
    const laneThreats = Array.from({ length: width }, () => ({
      infantry: 0,
      vehicle: 0,
      air: 0,
      any: 0
    }));
    for (const defender of snapshot.defenseUnits ?? []) {
      const column = Math.max(0, Math.min(width - 1, Number(defender.x || 0)));
      const health = defender.health <= 1 ? defender.health : defender.health / 100;
      const power = defender.level * Math.max(0.1, health);
      const profile = this.combatProfile(defender);
      threats[column] += power;
      laneThreats[column][profile.counter] += power;
    }

    const objectiveValue = goal === 'rp' ? 9 : goal === 'df' || goal === 'defense' ? 13 : 16;
    const laneScore = (unit, column) => {
      const profile = this.combatProfile(unit);
      const distance = Math.abs(column - objectiveColumn);
      const directThreat = laneThreats[column][profile.domain] + laneThreats[column].any;
      const adjacentThreat = [column - 1, column + 1]
        .filter((value) => value >= 0 && value < width)
        .reduce((sum, value) => sum + laneThreats[value][profile.domain] * 0.3, 0);
      const levelPower = Math.max(1, Number(unit.level || 0));
      const reportedHealth = Number(unit.health);
      const health = Number.isFinite(reportedHealth)
        ? Math.max(0.1, reportedHealth <= 1 ? reportedHealth : reportedHealth / 100)
        : 1;
      const durability = levelPower * health * (profile.tank ? 1.3 : 1);
      const danger = directThreat + adjacentThreat;
      const survivalPenalty = danger / Math.max(1, durability) * (profile.ranged ? 8 : 5);
      const objectivePull = distance * objectiveValue;
      const supportBonus = profile.support && distance <= 1 ? 5 : 0;
      const clearLaneBonus = Math.max(0, 8 - threats[column] / Math.max(1, levelPower));
      return objectivePull + survivalPenalty - supportBonus - clearLaneBonus;
    };

    const grid = Array.from({ length: height }, () => Array(width).fill(null));
    const units = [...snapshot.units].sort((left, right) => {
      const leftProfile = this.combatProfile(left);
      const rightProfile = this.combatProfile(right);
      return Number(rightProfile.tank) - Number(leftProfile.tank)
        || right.level - left.level;
    });
    const laneCounts = Array(width).fill(0);
    let totalScore = 0;
    for (const unit of units) {
      const profile = this.combatProfile(unit);
      const candidates = [];
      for (let column = 0; column < width; column += 1) {
        for (let row = 0; row < height; row += 1) {
          if (grid[row][column]) continue;
          const desiredRow = profile.ranged || profile.support ? height - 1 : profile.tank ? 0 : 1;
          const rowPenalty = Math.abs(row - desiredRow) * (profile.ranged ? 7 : 4);
          const congestion = laneCounts[column] * 3;
          const supportAdjacency = profile.support
            ? 0
            : [column - 1, column, column + 1].some((lane) =>
              grid.some((cells) => this.combatProfile(cells[lane]).support)
            ) ? -3 : 0;
          candidates.push({
            column,
            row,
            score: laneScore(unit, column) + rowPenalty + congestion + supportAdjacency
          });
        }
      }
      candidates.sort((left, right) => left.score - right.score);
      const best = candidates[0];
      if (!best) break;
      grid[best.row][best.column] = unit;
      laneCounts[best.column] += 1;
      totalScore += best.score;
    }
    return Object.freeze({
      goal,
      objective,
      objectiveColumn,
      threats: Object.freeze(threats),
      laneThreats: Object.freeze(laneThreats.map((lane) => Object.freeze(lane))),
      score: totalScore,
      grid: Object.freeze(grid.map((row) => Object.freeze(row)))
    });
  }

  static candidateFormations(snapshot, goal = 'cy', detail = 'detailed') {
    const requestedCount = Number.isFinite(Number(detail))
      ? Math.max(1, Math.floor(Number(detail)))
      : detail === 'exhaustive' ? 200 : detail === 'quick' ? 25 : 50;
    const width = 9;
    const height = 4;
    const seen = new Set();
    const candidates = [];
    const add = (name, units) => {
      const normalized = units.map((unit) => ({
        ...unit,
        x: Math.max(0, Math.min(width - 1, Number(unit.x) || 0)),
        y: Math.max(0, Math.min(height - 1, Number(unit.y) || 0))
      }));
      const key = normalized
        .map((unit) => `${unit.entityId ?? unit.id}:${unit.x}:${unit.y}`)
        .sort()
        .join('|');
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({ name, units: normalized });
      }
    };
    const current = snapshot.units.map((unit) => ({ ...unit }));
    add('Current formation', current);
    for (const shift of [-4, -3, -2, -1, 1, 2, 3, 4]) {
      add(`Horizontal shift ${shift > 0 ? '+' : ''}${shift}`, current.map((unit) => ({
        ...unit,
        x: (Number(unit.x || 0) + shift + width) % width
      })));
    }
    add('Horizontal mirror', current.map((unit) => ({ ...unit, x: width - 1 - Number(unit.x || 0) })));
    const objectiveColumn = Math.max(0, Math.min(width - 1, Number(this.objective(snapshot, goal)?.x ?? 4)));
    for (const moveCount of [1, 2, 3]) {
      const nudged = current.map((unit) => ({ ...unit }));
      const movers = [...nudged]
        .sort((left, right) => right.level - left.level)
        .slice(0, Math.min(moveCount, nudged.length));
      const occupied = new Set(nudged
        .filter((unit) => !movers.includes(unit))
        .map((unit) => `${unit.x}:${unit.y}`));
      for (const unit of movers) {
        const positions = [];
        for (let offset = 0; offset < width; offset += 1) {
          for (const column of [objectiveColumn - offset, objectiveColumn + offset]) {
            if (column < 0 || column >= width) continue;
            for (const row of [unit.y, 0, 1, 2, 3]) {
              const key = `${column}:${row}`;
              if (!occupied.has(key)) positions.push({ column, row, key });
            }
          }
        }
        const position = positions[0];
        if (!position) continue;
        unit.x = position.column;
        unit.y = position.row;
        occupied.add(position.key);
      }
      add(`Objective nudge (${moveCount} troop${moveCount === 1 ? '' : 's'})`, nudged);
    }
    const recommendation = this.recommendFormation(snapshot, goal);
    const focused = [];
    recommendation.grid.forEach((row, y) => row.forEach((unit, x) => {
      if (unit) focused.push({ ...unit, x, y });
    }));
    add('Objective-focused formation', focused);

    // Native simulations are the judge. Generate legal, targeted single-unit moves
    // and swaps instead of assuming the whole army should shift as one block.
    const emptyCells = [];
    const occupiedCells = new Map(current.map((unit) => [`${unit.x}:${unit.y}`, unit]));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!occupiedCells.has(`${x}:${y}`)) emptyCells.push({ x, y });
      }
    }
    const orderedCells = [...emptyCells].sort((left, right) =>
      Math.abs(left.x - objectiveColumn) - Math.abs(right.x - objectiveColumn)
      || left.y - right.y
    );
    const orderedUnits = [...current].sort((left, right) =>
      Number(right.level || 0) - Number(left.level || 0)
    );
    const moveLimit = requestedCount >= 150 ? orderedUnits.length : requestedCount <= 25 ? 3 : requestedCount >= 100 ? 10 : 7;
    const cellLimit = requestedCount >= 150 ? orderedCells.length : requestedCount <= 25 ? 3 : requestedCount >= 100 ? 10 : 7;
    for (const unit of orderedUnits.slice(0, moveLimit)) {
      for (const cell of orderedCells.slice(0, cellLimit)) {
        add(`Move ${unit.name} to ${cell.x + 1}:${cell.y + 1}`, current.map((item) =>
          item === unit ? { ...item, x: cell.x, y: cell.y } : { ...item }
        ));
      }
    }
    const swapLimit = requestedCount >= 150 ? orderedUnits.length : requestedCount <= 25 ? 3 : requestedCount >= 100 ? 10 : 6;
    for (let first = 0; first < Math.min(swapLimit, orderedUnits.length); first += 1) {
      for (let second = first + 1; second < Math.min(swapLimit, orderedUnits.length); second += 1) {
        const left = orderedUnits[first], right = orderedUnits[second];
        add(`Swap ${left.name} / ${right.name}`, current.map((item) => {
          if (item === left) return { ...item, x: right.x, y: right.y };
          if (item === right) return { ...item, x: left.x, y: left.y };
          return { ...item };
        }));
      }
    }
    return Object.freeze(candidates.slice(0, requestedCount).map((candidate) => Object.freeze(candidate)));
  }

  static scoreSimulation(response, snapshot, goal = 'cy') {
    const objective = this.objective(snapshot, goal);
    if (!objective) return Object.freeze({ score: Number.POSITIVE_INFINITY, objectivePercent: 100 });
    const states = new Map((response?.e ?? []).map((entry) => [entry.Key, entry.Value]));
    const buildings = response?.d?.s ?? [];
    const defenders = response?.d?.d ?? [];
    const objectivePool = goal === 'defense' ? defenders : buildings;
    const objectiveRecord = objectivePool.find((record) =>
      (Number(record.x) === Number(objective.x) && Number(record.y) === Number(objective.y))
      || Number(record.i) === Number(objective.id)
    );
    if (!objectiveRecord) return Object.freeze({ score: Number.POSITIVE_INFINITY, objectivePercent: 100 });
    const remaining = (record) => Number(states.get(record.ci)?.h ?? record.h * 16 ?? 0);
    const starting = (record) => Math.max(1,
      Number(states.get(record.ci)?.sh ?? Number(record.h || 0) * 16));
    const objectivePercent = Math.max(0, remaining(objectiveRecord) / starting(objectiveRecord) * 100);
    const blockers = [...buildings, ...defenders].filter((record) =>
      Number(record.x) === Number(objectiveRecord.x)
      && Number(record.y) > Number(objectiveRecord.y)
    );
    const blockerStart = blockers.reduce((sum, record) => sum + starting(record), 0);
    const blockerEnd = blockers.reduce((sum, record) => sum + remaining(record), 0);
    const blockerPercent = blockerStart > 0 ? blockerEnd / blockerStart * 100 : 0;
    const allTargets = [...buildings, ...defenders];
    const defenderStart = allTargets.reduce((sum, record) => sum + starting(record), 0);
    const defenderEnd = allTargets.reduce((sum, record) => sum + remaining(record), 0);
    const defenderPercent = defenderStart > 0 ? defenderEnd / defenderStart * 100 : 0;
    const oneShot = defenderPercent <= 0.05;
    return Object.freeze({
      score: (oneShot ? -1_000_000_000_000 : 0)
        + objectivePercent * 1_000_000
        + defenderPercent * 10_000
        + blockerPercent * 100,
      objectivePercent,
      blockerPercent,
      defenderPercent,
      oneShot
    });
  }

  static analyzeNativeSimulation(response, snapshot, label = 'Live formation') {
    const states = new Map((response?.e ?? []).map((entry) => [entry.Key, entry.Value]));
    const buildings = response?.d?.s ?? [];
    const defenders = response?.d?.d ?? [];
    const attackers = response?.d?.a ?? [];
    const remaining = (record) => Number(states.get(record.ci)?.h ?? Number(record.h || 0) * 16);
    const starting = (record) => Math.max(1, Number(record.h || 0) * 16);
    const snapshotEntities = [
      ...(snapshot.buildings ?? []),
      ...(snapshot.defenseUnits ?? []),
      ...(snapshot.units ?? [])
    ];
    const maximum = (record) => {
      const entity = atPosition(snapshotEntities, record);
      // Match the established TABS normalization exactly: player targets use
      // the simulator's mh, while every Forgotten structure AND defense unit
      // uses ClientLib.API.Util.GetUnitMaxHealthByLevel(..., false) * 16 as
      // published into the Hub snapshot. Forgotten `mh` is differently scaled
      // and was the cause of the understated defensive-unit state.
      const simulatedMaximum = !snapshot.target?.npc
        ? Number(states.get(record.ci)?.mh ?? 0) : 0;
      return Math.max(starting(record), simulatedMaximum, Number(entity?.maxHealth ?? 0));
    };
    const remainingPercent = (records) => {
      const start = records.reduce((sum, record) => sum + maximum(record), 0);
      const end = records.reduce((sum, record) => sum + remaining(record), 0);
      return start > 0 ? Math.max(0, Math.min(100, end / start * 100)) : 100;
    };
    const healthSummary = (records) => {
      const start = records.reduce((sum, record) => sum + maximum(record), 0);
      const end = records.reduce((sum, record) => sum + remaining(record), 0);
      return Object.freeze({ start, end, damage: Math.max(0, start - end),
        remainingPercent: start > 0 ? Math.max(0, Math.min(100, end / start * 100)) : 100 });
    };
    const atPosition = (items, record) => items.find((item) =>
      (Number(item.x) === Number(record.x) && Number(item.y) === Number(record.y))
      || Number(item.id) === Number(record.i));
    const armored = defenders.filter((record) => {
      const item = atPosition(snapshot.defenseUnits ?? [], record);
      const armor = String(item?.armorType ?? '').toLowerCase();
      return /vehicle|heavy|armou?r|tank/.test(armor) || this.combatProfile(item).tank;
    });
    const armoredSet = new Set(armored);
    const attackerGroups = { infantry: [], vehicle: [], aircraft: [] };
    for (const record of attackers) {
      const item = atPosition(snapshot.units ?? [], record);
      const domain = this.combatProfile(item).domain;
      attackerGroups[domain === 'air' ? 'aircraft' : domain]?.push(record);
    }
    const repairTimeByGroup = Object.freeze(Object.fromEntries(
      Object.entries(attackerGroups).map(([group, records]) => {
        const damagePercent = 100 - remainingPercent(records);
        return [group, Number(snapshot.repair?.[group] ?? 0) * damagePercent / 100];
      })
    ));
    const repairSeconds = Math.max(0, ...Object.values(repairTimeByGroup));
    const repairCosts = {};
    const repairCostsByGroup = { infantry: {}, vehicle: {}, aircraft: {} };
    for (const record of attackers) {
      const item = atPosition(snapshot.units ?? [], record);
      if (!item) continue;
      const domain = this.combatProfile(item).domain;
      const group = domain === 'air' ? 'aircraft' : domain;
      const damageRatio = Math.max(0, Math.min(1,
        (starting(record) - remaining(record)) / maximum(record)
      ));
      for (const [type, fullCost] of Object.entries(item.repairCosts ?? {})) {
        const amount = Number(fullCost || 0) * damageRatio;
        repairCosts[type] = (repairCosts[type] ?? 0) + amount;
        repairCostsByGroup[group][type] = (repairCostsByGroup[group][type] ?? 0) + amount;
      }
    }
    const objectivePercent = (goal) => {
      const objective = this.objective(snapshot, goal);
      if (!objective) return null;
      const record = buildings.find((building) =>
        (Number(building.x) === Number(objective.x) && Number(building.y) === Number(objective.y))
        || Number(building.i) === Number(objective.id)
      );
      return record ? remainingPercent([record]) : null;
    };
    const namedBuildingPercent = (pattern) => {
      const objective = (snapshot.buildings ?? []).find((building) => pattern.test(String(building.name ?? '')));
      if (!objective) return null;
      const record = buildings.find((building) =>
        (Number(building.x) === Number(objective.x) && Number(building.y) === Number(objective.y))
        || Number(building.i) === Number(objective.id));
      return record ? remainingPercent([record]) : null;
    };
    const nativeSummary = response?.nativeCombatReport?.summary ?? {};
    const nativeBattleStats = response?.nativeBattleStats ?? {};
    const nativePercent = (value, fallback) => Number.isFinite(Number(value))
      ? Math.max(0, Math.min(100, Number(value))) : fallback;
    const calculatedStructures = healthSummary(buildings);
    const calculatedDefense = healthSummary(defenders);
    const defenderRemaining = nativePercent(
      nativeSummary.targetState,
      nativePercent(nativeBattleStats.targetState, remainingPercent([...buildings, ...defenders]))
    );
    const ownRemaining = nativePercent(nativeSummary.armyState,
      nativePercent(nativeBattleStats.armyState, remainingPercent(attackers)));
    const defenderDamage = 100 - defenderRemaining;
    const ownDamage = 100 - ownRemaining;
    const resourceName = (...wantedNames) => {
      const entries = Object.entries(snapshot.resourceTypes ?? {});
      const normalized = wantedNames.map((name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, ''));
      const exact = entries.find(([name]) => normalized.includes(
        String(name).toLowerCase().replace(/[^a-z0-9]/g, '')
      ));
      if (exact) return exact[1];
      return entries.find(([name]) => normalized.some((wanted) =>
        String(name).toLowerCase().replace(/[^a-z0-9]/g, '').includes(wanted)
      ))?.[1];
    };
    const rewardTypes = [
      resourceName('Tiberium'),
      resourceName('Crystal', 'Chrystal'),
      resourceName('Credits', 'Gold'),
      resourceName('ResearchPoints')
    ].filter((type) => type != null);
    const reportRepairCosts = response?.nativeCombatReport?.repairCosts ?? {};
    const nativeOffenseRepair = response?.nativeOffenseRepair ?? null;
    const hasNativeRepairCosts = Object.keys(reportRepairCosts).length > 0;
    const nativeRepairTimeByGroup = {
      infantry: Number(reportRepairCosts[resourceName('RepairChargeInf')] ?? 0),
      vehicle: Number(reportRepairCosts[resourceName('RepairChargeVeh')] ?? 0),
      aircraft: Number(reportRepairCosts[resourceName('RepairChargeAir')] ?? 0)
    };
    const effectiveRepairTimeByGroup = hasNativeRepairCosts
      ? Object.freeze(nativeRepairTimeByGroup)
      : nativeOffenseRepair?.timeByGroup
        ?? Object.freeze({ infantry: 0, vehicle: 0, aircraft: 0 });
    const effectiveRepairSeconds = Math.max(0, ...Object.values(effectiveRepairTimeByGroup));
    const effectiveRepairCostsByGroup = nativeOffenseRepair?.costsByGroup
      ?? Object.freeze({ infantry: {}, vehicle: {}, aircraft: {} });
    const groupedRepairCosts = {};
    for (const costs of Object.values(effectiveRepairCostsByGroup)) {
      for (const [type, amount] of Object.entries(costs)) {
        groupedRepairCosts[type] = (groupedRepairCosts[type] ?? 0) + Number(amount || 0);
      }
    }
    const effectiveRepairCosts = hasNativeRepairCosts ? { ...reportRepairCosts } : groupedRepairCosts;
    const nativeLoot = {};
    const lootDiagnostics = [];
    let hasNativeResourceValues = false;
    for (const record of [...buildings, ...defenders]) {
      const entity = atPosition([...(snapshot.buildings ?? []), ...(snapshot.defenseUnits ?? [])], record);
      const values = entity?.resourceValue ?? {};
      if (Object.keys(values).length) hasNativeResourceValues = true;
      const maximumHealth = maximum(record);
      const damageRatio = Math.max(0, Math.min(1,
        (starting(record) - remaining(record)) / maximumHealth
      ));
      const attackCounter = Math.max(0, Number(record.ac ?? entity?.attackCounter ?? 0));
      const attackDecay = Math.pow(0.7, attackCounter);
      const entityLoot = {};
      for (const type of rewardTypes) {
        const fullValue = Number(values[type] ?? 0);
        let amount = fullValue * damageRatio * attackDecay;
        amount = Math.max(0, amount);
        // Research Points are explicitly floored by the native client and have
        // a minimum award of one whenever a damaged entity carries RP. Other
        // resources retain precision until the presentation layer rounds the
        // aggregate, avoiding per-entity rounding drift.
        if (type === resourceName('ResearchPoints') && fullValue > 0 && damageRatio > 0) {
          amount = Math.max(1, Math.floor(amount));
        }
        entityLoot[type] = amount;
        nativeLoot[type] = (nativeLoot[type] ?? 0) + amount;
      }
      lootDiagnostics.push(Object.freeze({
        id: Number(record.i ?? entity?.id ?? 0),
        x: Number(record.x ?? entity?.x ?? 0),
        y: Number(record.y ?? entity?.y ?? 0),
        startHealth: starting(record),
        endHealth: remaining(record),
        maxHealth: maximumHealth,
        damageRatio,
        attackCounter,
        attackDecay,
        resources: Object.freeze(entityLoot)
      }));
    }
    // Older/unknown game builds may not expose target repair values. Retain a
    // clearly secondary compatibility estimate there, but use the native
    // per-entity values whenever the client provides them.
    const reportLoot = response?.nativeReportLoot;
    const hasNativeReportLoot = reportLoot && Object.keys(reportLoot).length > 0;
    const interpretedLoot = response?.nativeEntityLoot;
    const hasInterpretedLoot = interpretedLoot && Object.keys(interpretedLoot).length > 0;
    // TABS statistics are derived from GetUnitRepairCosts for every damaged
    // defender entity. The combat report is used by TACS's separate compact
    // game panel, but does not represent the TABS cached-stat columns.
    const lootByResource = hasNativeReportLoot
      ? Object.fromEntries(rewardTypes.map((type) => [type, Number(reportLoot[type] ?? 0)]))
      : hasInterpretedLoot
        ? Object.fromEntries(rewardTypes.map((type) => [type, Number(interpretedLoot[type] ?? 0)]))
      : Object.fromEntries(rewardTypes.map((type) => [type, 0]));
    const lootTotal = rewardTypes.reduce((sum, type) => sum + Number(lootByResource[type] ?? 0), 0);
    const researchType = resourceName('ResearchPoints');
    const researchTotal = Number(lootByResource[researchType] ?? 0);
    return Object.freeze({
      label,
      cyRemaining: nativePercent(nativeBattleStats.cy, objectivePercent('cy')),
      dfRemaining: nativePercent(nativeBattleStats.df, objectivePercent('df')),
      ccRemaining: objectivePercent('cc'),
      defenseHqRemaining: nativePercent(nativeBattleStats.dhq,
        namedBuildingPercent(/defen[cs]e\s*(?:hq|headquarters)/i)),
      defenderRemaining,
      ownRemaining,
      defenderDamage,
      ownDamage,
      repairSeconds: effectiveRepairSeconds,
      repairTimeByGroup: effectiveRepairTimeByGroup,
      repairCosts: Object.freeze({ ...effectiveRepairCosts }),
      repairCostsByGroup: Object.freeze(Object.fromEntries(Object.entries(effectiveRepairCostsByGroup)
        .map(([group, costs]) => [group, Object.freeze(costs)]))),
      repairCostResources: Object.freeze({
        tiberium: Number(effectiveRepairCosts[resourceName('Tiberium')] ?? 0),
        crystal: Number(effectiveRepairCosts[resourceName('Crystal', 'Chrystal')] ?? 0),
        credits: Number(effectiveRepairCosts[resourceName('Credits', 'Gold')] ?? 0),
        power: Number(effectiveRepairCosts[resourceName('Power')] ?? 0)
      }),
      loot: lootTotal,
      research: researchTotal,
      lootByResource: Object.freeze(lootByResource),
      lootResources: Object.freeze({
        tiberium: Number(lootByResource[resourceName('Tiberium')] ?? 0),
        crystal: Number(lootByResource[resourceName('Crystal', 'Chrystal')] ?? 0),
        credits: Number(lootByResource[resourceName('Credits', 'Gold')] ?? 0),
        research: Number(lootByResource[resourceName('ResearchPoints')] ?? 0)
      }),
      calculationDiagnostics: Object.freeze({
        source: hasInterpretedLoot ? 'tabs-data-d' : 'tabs-data-unavailable',
        nativeReportAvailable: Boolean(response?.nativeCombatReport),
        entities: Object.freeze(lootDiagnostics)
      }),
      durationSeconds: response?.d?.cs != null
        ? Number(response.d.cs) / 10
          + (Number(response.d.cs) < Number(response.d.md ?? 0) * 10 ? 3 : 0)
        : Number(nativeSummary.durationSeconds ?? 0),
      reportedAt: Number(nativeSummary.timestamp ?? 0) || null,
      outcome: typeof nativeSummary.outcome === 'string' && nativeSummary.outcome
        ? nativeSummary.outcome
        : ownRemaining <= 0 ? 'Defeat' : defenderRemaining <= 0 ? 'Total Victory' : 'Victory',
      morale: Number(snapshot.morale?.deficit ?? response?.d?.m ?? response?.d?.morale ?? 0),
      moraleEffectiveness: Number(snapshot.morale?.effectiveness ?? 100),
      autoRepair: Boolean(response?.d?.ar ?? response?.d?.autoRepair),
      repairStorage: snapshot.repairStorage ?? {},
      defenderBreakdown: Object.freeze({
        structures: Object.freeze({ ...calculatedStructures,
          remainingPercent: nativePercent(nativeSummary.baseState,
            nativePercent(nativeBattleStats.baseState, calculatedStructures.remainingPercent)) }),
        defense: Object.freeze({ ...calculatedDefense,
          remainingPercent: nativePercent(nativeSummary.defenseState,
            nativePercent(nativeBattleStats.defenseState, calculatedDefense.remainingPercent)) }),
        armored: healthSummary(armored),
        unarmored: healthSummary(defenders.filter((record) => !armoredSet.has(record)))
      }),
      offenseBreakdown: Object.freeze({
        infantry: Object.freeze({ ...healthSummary(attackerGroups.infantry),
          remainingPercent: nativePercent(nativeBattleStats.infantryState,
            healthSummary(attackerGroups.infantry).remainingPercent) }),
        vehicle: Object.freeze({ ...healthSummary(attackerGroups.vehicle),
          remainingPercent: nativePercent(nativeBattleStats.vehicleState,
            healthSummary(attackerGroups.vehicle).remainingPercent) }),
        aircraft: Object.freeze({ ...healthSummary(attackerGroups.aircraft),
          remainingPercent: nativePercent(nativeBattleStats.aircraftState,
            healthSummary(attackerGroups.aircraft).remainingPercent) })
      })
    });
  }

  static simulate(snapshot, goal = 'cy') {
    const recommendation = this.recommendFormation(snapshot, goal);
    const healthFactor = (value) => Math.max(0.05, value <= 1 ? value : value / 100);
    const offensePower = snapshot.units.reduce(
      (sum, unit) => sum + unit.level * healthFactor(unit.health), 0
    );
    const defensePower = snapshot.defenseUnits.reduce(
      (sum, unit) => sum + unit.level * healthFactor(unit.health), 0
    ) + snapshot.buildings.reduce(
      (sum, building) => sum + building.level * healthFactor(building.health) * 0.35, 0
    );
    const goalFactor = goal === 'rp' ? 0.92 : goal === 'df' ? 1.04 : 1;
    const winChance = Math.max(0, Math.min(100,
      (offensePower / Math.max(1, offensePower + defensePower * goalFactor)) * 135
    ));
    const defenderDamage = Math.max(0, Math.min(100, winChance * 1.08));
    const ownDamage = Math.max(0, Math.min(100,
      (defensePower / Math.max(1, offensePower)) * 52 * goalFactor
    ));
    const lootTotal = Object.values(snapshot.loot).reduce((sum, value) => sum + Number(value || 0), 0);
    const researchType = snapshot.resourceTypes?.ResearchPoints;
    const research = Number(snapshot.loot?.[researchType] ?? 0);
    const repairSeconds = Object.values(snapshot.repair)
      .reduce((sum, value) => sum + Number(value || 0), 0) * (ownDamage / 100);
    return Object.freeze({
      goal,
      objective: recommendation.objective?.name ?? 'Primary target',
      winChance,
      defenderDamage,
      ownDamage,
      repairSeconds,
      loot: lootTotal * (defenderDamage / 100),
      research: research * (goal === 'rp' ? 1 : defenderDamage / 100),
      cp: snapshot.cpCost,
      efficiency: snapshot.cpCost > 0 ? (lootTotal * defenderDamage / 100) / snapshot.cpCost : 0
    });
  }
}
