function call(target, names, ...args) {
  for (const name of names) {
    try {
      if (typeof target?.[name] === 'function') {
        const value = target[name](...args);
        if (value !== undefined && value !== null) return value;
      }
    } catch {
      // ClientLib can refresh objects while the War Room is reading them.
    }
  }
  return null;
}

function values(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection.filter(Boolean);
  const source = collection.l ?? collection.d ?? collection;
  return Array.isArray(source)
    ? source.filter(Boolean)
    : Object.values(source).filter((value) => value && typeof value === 'object');
}

export function estimatePossibleAttacks({ cpAvailable = 0, cpCost = 0, repair = {}, repairStorage = {} } = {}) {
  const commandPointAttacks = Number(cpCost) > 0
    ? Math.floor(Math.max(0, Number(cpAvailable) || 0) / Number(cpCost))
    : 0;
  const activeGroups = ['infantry', 'vehicle', 'aircraft']
    .map((name) => ({
      name,
      required: Math.max(0, Number(repair[name]) || 0),
      available: Math.max(0, Number(repairStorage[name]?.stored) || 0)
    }))
    .filter((group) => group.required > 0);
  const maxRepairSeconds = Math.max(0, ...activeGroups.map((group) => group.required));
  const repairAvailableSeconds = activeGroups.length
    ? Math.min(...activeGroups.map((group) => group.available))
    : 0;
  const repairTimeAttacks = maxRepairSeconds > 0
    ? Math.floor(repairAvailableSeconds / maxRepairSeconds)
    : Infinity;
  return Object.freeze({
    cpAvailable: Math.max(0, Number(cpAvailable) || 0),
    cpCost: Math.max(0, Number(cpCost) || 0),
    commandPointAttacks,
    maxRepairSeconds,
    repairAvailableSeconds,
    repairTimeAttacks,
    possibleAttacks: Math.max(0, Math.min(commandPointAttacks, repairTimeAttacks))
  });
}

function percent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 100;
  return Math.max(0, Math.min(100, number <= 1 ? number * 100 : number));
}

function describeUnit(unit) {
  const data = call(unit, ['get_UnitGameData_Obj', 'get_UnitGameData']);
  return Object.freeze({
    id: call(unit, ['get_MdbUnitId', 'get_MdbId', 'get_Id']),
    entityId: call(unit, ['get_Id']),
    name: call(data, ['get_Name', 'get_DisplayName']) ?? data?.dn ?? data?.n ?? 'Unit',
    level: Number(call(unit, ['get_CurrentLevel', 'get_Level', 'get_Lvl']) ?? 0),
    health: percent(call(unit, ['get_HitpointsPercent', 'get_Health']) ?? 1),
    enabled: Boolean(call(unit, ['get_Enabled']) ?? true),
    x: Number(call(unit, ['get_CoordX', 'get_X']) ?? unit?.x ?? 0),
    y: Number(call(unit, ['get_CoordY', 'get_Y']) ?? unit?.y ?? 0),
    group: call(data, ['get_UnitGroupType', 'get_UnitGroup']) ?? data?.ug ?? null,
    movementType: call(data, ['get_MovementType', 'get_UnitMovementType']) ?? data?.mt ?? null,
    armorType: call(data, ['get_ArmorType', 'get_UnitArmorType']) ?? data?.ptt ?? null,
    attackRange: Number(call(data, ['get_AttackRange', 'get_Range']) ?? data?.ar ?? 0),
    speed: Number(call(data, ['get_MovementSpeed', 'get_Speed']) ?? data?.ms ?? 0)
    , transporterId: call(unit, ['get_TransporterId', 'get_TransportUnitId', 'get_CarrierId']) ?? null
    , garrisonId: call(unit, ['get_GarrisonId', 'get_GarrisonUnitId', 'get_TransportedById']) ?? null
  });
}

function describeTargetEntity(entity) {
  const data = call(entity, ['get_UnitGameData_Obj', 'get_UnitGameData']);
  const requirements = values(call(entity, ['get_UnitLevelRepairRequirements']));
  return Object.freeze({
    id: call(entity, ['get_MdbUnitId', 'get_MdbId', 'get_Id']),
    name: call(data, ['get_Name', 'get_DisplayName']) ?? data?.dn ?? data?.n ?? 'Unknown',
    level: Number(call(entity, ['get_CurrentLevel', 'get_Level', 'get_Lvl']) ?? 0),
    health: percent(call(entity, ['get_HitpointsPercent', 'get_Health']) ?? 1),
    x: Number(call(entity, ['get_CoordX', 'get_X']) ?? 0),
    y: Number(call(entity, ['get_CoordY', 'get_Y']) ?? 0),
    movementType: call(data, ['get_MovementType', 'get_UnitMovementType']) ?? data?.mt ?? null,
    armorType: call(data, ['get_ArmorType', 'get_UnitArmorType']) ?? data?.ptt ?? null,
    attackRange: Number(call(data, ['get_AttackRange', 'get_Range']) ?? data?.ar ?? 0),
    requirements: Object.freeze(requirements.map((item) => Object.freeze({
      type: item.Type,
      amount: Number(item.Count ?? 0)
    })))
  });
}

function describeCity(city) {
  if (!city) return null;
  return Object.freeze({
    raw: city,
    id: call(city, ['get_Id', 'get_CityId']),
    version: call(city, ['get_Version', 'get_BaseVersion', 'get_LayoutVersion']) ?? 0,
    name: call(city, ['get_Name', 'get_CityName']) ?? 'Unknown target',
    level: Number(call(city, ['get_LvlBase', 'get_BaseLevel', 'get_Level']) ?? 0),
    x: Number(call(city, ['get_PosX', 'get_X']) ?? 0),
    y: Number(call(city, ['get_PosY', 'get_Y']) ?? 0),
    owner: call(city, ['get_PlayerName', 'get_OwnerName']) ?? 'Forgotten',
    alliance: call(city, ['get_AllianceName', 'get_OwnerAllianceName']) ?? '',
    npc: Boolean(call(city, ['IsNPC', 'get_IsNPC']))
  });
}

export class WarRoomHub {
  constructor(context) {
    this.context = context;
    this.hub = context?.hub;
    this.lastCombatTargetId = null;
  }

  clientLib() {
    return this.hub?.game?.services?.tryGet?.('clientLib') ?? null;
  }

  mainData() {
    return this.clientLib()?.getMainData?.() ?? null;
  }

  snapshot() {
    const clientLib = this.clientLib();
    const root = clientLib?.root;
    const main = this.mainData();
    const cities = call(main, ['get_Cities']);
    const attackerRaw = call(cities, ['get_CurrentOwnCity']);
    const targetRaw = call(cities, ['get_CurrentCity']);
    const attacker = describeCity(attackerRaw);
    const describedTarget = describeCity(targetRaw);
    const target = describedTarget?.id != null
      && String(describedTarget.id) !== String(attacker?.id)
      ? describedTarget
      : null;
    const selectedTargetRaw = target ? targetRaw : null;
    const formationManager = call(attackerRaw, ['get_CityArmyFormationsManager']);
    const formation = target?.id == null
      ? null
      : call(formationManager, ['GetFormationByTargetBaseId'], target.id);
    const units = values(call(formation, ['get_ArmyUnits'])).map(describeUnit);
    const targetUnitData = call(selectedTargetRaw, ['get_CityUnitsData']);
    const defenseUnits = values(call(targetUnitData, ['get_DefenseUnits']))
      .map(describeTargetEntity);
    const buildings = values(call(selectedTargetRaw, ['get_Buildings']))
      .map(describeTargetEntity);
    const cpCost = target && attackerRaw
      ? Number(call(attackerRaw, ['CalculateAttackCommandPointCostToCoord'], target.x, target.y) ?? 0)
      : 0;
    const player = call(main, ['get_Player']);
    const cpAvailable = Number(call(player, ['GetCommandPointCount', 'get_CommandPointCount']) ?? 0);
    const loot = {};
    for (const entry of values(root?.API?.Battleground?.GetInstance?.()?.GetLootFromCurrentCity?.())) {
      loot[entry.Type] = Number(entry.Count ?? 0);
    }
    const unitData = call(attackerRaw, ['get_CityUnitsData']);
    const groups = root?.Data?.EUnitGroup ?? {};
    const resourceTypes = root?.Base?.EResourceType ?? {};
    const repair = {};
    const repairStorage = {};
    for (const [name, group] of [
      ['infantry', groups.Infantry],
      ['vehicle', groups.Vehicle],
      ['aircraft', groups.Aircraft]
    ]) {
      repair[name] = Number(call(unitData, ['GetRepairTimeFromEUnitGroup'], group, false) ?? 0);
      const type = name === 'infantry' ? resourceTypes.RepairChargeInf
        : name === 'vehicle' ? resourceTypes.RepairChargeVeh : resourceTypes.RepairChargeAir;
      repairStorage[name] = Object.freeze({
        stored: Number(call(attackerRaw, ['GetResourceCount'], type) ?? 0),
        capacity: Number(call(attackerRaw, ['GetResourceMaxStorage'], type) ?? 0)
      });
    }
    const alliance = call(main, ['get_Alliance']);
    const allianceBonuses = [
      'get_POIInfantryBonus', 'get_POIVehicleBonus', 'get_POIAirBonus', 'get_POIDefenseBonus'
    ].map((name) => Number(call(alliance, [name]) ?? 0));

    const attackEstimate = estimatePossibleAttacks({ cpAvailable, cpCost, repair, repairStorage });
    return Object.freeze({
      generatedAt: Date.now(),
      attacker,
      target,
      units: Object.freeze(units),
      defenseUnits: Object.freeze(defenseUnits),
      buildings: Object.freeze(buildings),
      resourceTypes: Object.freeze({ ...(root?.Base?.EResourceType ?? {}) }),
      cpCost,
      cpAvailable,
      attackEstimate,
      loot: Object.freeze(loot),
      repair: Object.freeze(repair),
      repairStorage: Object.freeze(repairStorage),
      allianceBonuses: Object.freeze(allianceBonuses),
      canSimulate: Boolean(attacker && target && units.length)
    });
  }

  openCombatSetup() {
    const snapshot = this.snapshot();
    const targetId = snapshot.target?.id ?? this.lastCombatTargetId;
    if (!targetId) throw new Error('Select a target in the game first.');
    const root = this.clientLib()?.root ?? globalThis.ClientLib;
    const mode = root?.Data?.PlayerAreaViewMode?.pavmCombatSetupDefense;
    const app = globalThis.qx?.core?.Init?.getApplication?.();
    app?.getBackgroundArea?.()?.closeCityInfo?.();
    if (mode == null || !app?.getPlayArea?.()?.setView) {
      throw new Error('The native attack setup view is unavailable.');
    }
    app.getPlayArea().setView(mode, targetId, 0, 0);
    return snapshot;
  }

  isAttackSetupOpen(snapshot = null) {
    const root = this.clientLib()?.root ?? globalThis.ClientLib;
    const playArea = globalThis.qx?.core?.Init?.getApplication?.()?.getPlayArea?.();
    const current = call(playArea, ['getViewMode', 'get_ViewMode', 'getMode']);
    const modes = [
      root?.Data?.PlayerAreaViewMode?.pavmCombatSetupDefense,
      root?.Data?.PlayerAreaViewMode?.pavmCombatSetupBase
    ].filter((value) => value != null).map(Number);
    return modes.includes(Number(current)) && Boolean((snapshot ?? this.snapshot()).target?.id);
  }

  searchTargets(options) {
    const scanner = this.hub?.scanner;
    if (!scanner?.findTargets) {
      const host = globalThis.window ?? globalThis;
      host.CnCTA?.installScannerHubExtension?.(this.hub);
    }
    if (!this.hub?.scanner?.findTargets) {
      throw new Error('The shared Scanner Hub service is unavailable.');
    }
    return this.hub.scanner.findTargets(options);
  }

  getSearchOptions() {
    const host = globalThis.window ?? globalThis;
    if (!this.hub?.scanner?.getOptionsSnapshot) host.CnCTA?.installScannerHubExtension?.(this.hub);
    return this.hub?.scanner?.getOptionsSnapshot?.() ?? { ownCities: [], maxAttackDistance: 10 };
  }

  getAllianceOptions(options) {
    const scanner = this.hub?.scanner;
    if (!scanner?.getAllianceOptions) {
      const host = globalThis.window ?? globalThis;
      host.CnCTA?.installScannerHubExtension?.(this.hub);
    }
    return this.hub?.scanner?.getAllianceOptions?.(options) ?? [];
  }

  simulateFormation(units) {
    const snapshot = this.snapshot();
    if (!snapshot.target?.id || !snapshot.attacker?.id) {
      return Promise.reject(new Error('Open a target in combat setup first.'));
    }
    const communication = this.clientLib()?.root?.Net?.CommunicationManager?.GetInstance?.();
    const commandResult = this.clientLib()?.root?.Net?.CommandResult;
    const delegateFactory = globalThis.webfrontend?.phe?.cnc?.Util?.createEventDelegate;
    if (!communication?.SendSimpleCommand || !delegateFactory) {
      return Promise.reject(new Error('The native battle simulation API is unavailable.'));
    }
    const armyUnits = units
      .filter((unit) => unit.entityId != null && unit.enabled !== false && Number(unit.health) > 0)
      .map((unit) => ({ i: unit.entityId, x: unit.x, y: unit.y }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Battle simulation timed out.')), 12000);
      const receiver = {
        done(status, response) {
          clearTimeout(timeout);
          const payload = response?.d ? response : status?.d ? status : null;
          if (!payload?.d || payload.e == null) {
            const detail = response?.error ?? response?.message ?? status?.error ?? status?.message;
            reject(new Error(`The game returned no battle simulation data${detail ? `: ${detail}` : '.'}`));
            return;
          }
          const events = Array.isArray(payload.e)
            ? payload.e
            : typeof payload.e?.map === 'function'
              ? Array.from(payload.e)
              : values(payload.e);
          resolve({ ...payload, e: events });
        }
      };
      communication.SendSimpleCommand('SimulateBattle', {
        battleSetup: {
          d: snapshot.target.id,
          a: snapshot.attacker.id,
          u: armyUnits,
          s: 0
        }
      }, delegateFactory(commandResult, receiver, receiver.done), null);
    });
  }

  playSimulation(response) {
    const snapshot = this.snapshot();
    if (!snapshot.target?.id || !response?.d) {
      throw new Error('No native simulation is available to replay.');
    }
    this.lastCombatTargetId = snapshot.target.id;
    const clientLib = this.clientLib()?.root ?? globalThis.ClientLib;
    const app = globalThis.qx?.core?.Init?.getApplication?.();
    const playArea = app?.getPlayArea?.();
    const mode = clientLib?.Data?.PlayerAreaViewMode?.pavmCombatReplay;
    const battleground = clientLib?.Vis?.VisMain?.GetInstance?.()?.get_Battleground?.();
    let loadCombat = battleground?.LoadCombatDirect;
    if (typeof loadCombat !== 'function') {
      try {
        const apiPrototype = clientLib?.API?.Battleground?.prototype;
        const simulateSource = apiPrototype?.SimulateBattle?.toString?.() ?? '';
        const callbackName = simulateSource.match(/\{battleSetup:[a-z]+\},\s?\(new \$I\.[A-Z]{6}\)\.[A-Z]{6}\(this,this\.([A-Z]{6})\),\s?this\)/)?.[1];
        const callbackSource = callbackName ? apiPrototype?.[callbackName]?.toString?.() ?? '' : '';
        const loaderName = callbackSource.match(/\$I\.[A-Z]{6}\.[A-Z]{6}\(\)\.[A-Z]{6}\(\)\.([A-Z]{6})\([a-z]\.d\)/)?.[1];
        if (loaderName && typeof battleground?.[loaderName] === 'function') {
          loadCombat = battleground[loaderName];
        }
      } catch {
        // A clearer error is reported below when this game build cannot be resolved.
      }
    }
    if (!playArea?.setView || mode == null || typeof loadCombat !== 'function') {
      throw new Error('The native combat replay viewer is unavailable.');
    }
    playArea.setView(mode, snapshot.target.id, 0, 0);
    battleground.Init?.();
    loadCombat.call(battleground, response.d);
    const start = () => {
      battleground.RestartReplay?.();
      battleground.set_ReplaySpeed?.(1);
    };
    if (globalThis.qx?.event?.Timer?.once) {
      globalThis.qx.event.Timer.once(start, this, 0);
    } else {
      setTimeout(start, 0);
    }
    return response;
  }

  captureFormation() {
    const snapshot = this.snapshot();
    if (!snapshot.attacker?.id || !snapshot.target?.id || !snapshot.units.length) {
      throw new Error('Open a target attack screen with an offensive formation first.');
    }
    return Object.freeze({
      attackerId: snapshot.attacker.id,
      attackerName: snapshot.attacker.name,
      target: Object.freeze({ id: snapshot.target.id, name: snapshot.target.name,
        x: snapshot.target.x, y: snapshot.target.y, version: snapshot.target.version }),
      units: Object.freeze(snapshot.units.map((unit) => Object.freeze({
        entityId: unit.entityId,
        mdbId: unit.id,
        name: unit.name,
        level: unit.level,
        x: unit.x,
        y: unit.y,
        enabled: unit.enabled !== false
        , transporterId: unit.transporterId ?? null
        , garrisonId: unit.garrisonId ?? null
      })))
    });
  }

  applyFormation(preset) {
    const snapshot = this.snapshot();
    if (!snapshot.attacker?.id || !snapshot.target?.id) {
      throw new Error('Open a target attack screen before loading a formation.');
    }
    if (String(preset?.attackerId) !== String(snapshot.attacker.id)) {
      throw new Error(`This formation belongs to ${preset?.attackerName || 'another attacking base'}.`);
    }
    const signature = (units, idKey) => units
      .map((unit) => `${unit[idKey]}:${Number(unit.level || 0)}`)
      .sort()
      .join('|');
    if (signature(preset.units ?? [], 'mdbId') !== signature(snapshot.units, 'id')) {
      throw new Error('The current offensive army does not match this saved formation.');
    }

    const main = this.mainData();
    const cities = call(main, ['get_Cities']);
    const ownCity = call(cities, ['get_CurrentOwnCity']);
    const manager = call(ownCity, ['get_CityArmyFormationsManager']);
    const formation = call(manager, ['GetFormationByTargetBaseId'], snapshot.target.id);
    const rawUnits = values(call(formation, ['get_ArmyUnits']));
    const byEntityId = new Map(rawUnits.map((unit) => [String(call(unit, ['get_Id'])), unit]));
    const used = new Set();

    for (const saved of preset.units) {
      let unit = byEntityId.get(String(saved.entityId));
      if (!unit) {
        unit = rawUnits.find((candidate) =>
          !used.has(candidate)
          && Number(call(candidate, ['get_MdbUnitId', 'get_MdbId'])) === Number(saved.mdbId)
          && Number(call(candidate, ['get_CurrentLevel', 'get_Level'])) === Number(saved.level)
        );
      }
      if (!unit) throw new Error(`Could not match saved unit ${saved.name || saved.mdbId}.`);
      used.add(unit);
      const currentX = Number(call(unit, ['get_CoordX', 'get_X']) ?? 0);
      const currentY = Number(call(unit, ['get_CoordY', 'get_Y']) ?? 0);
      const occupant = call(formation, ['GetUnitByCoord'], saved.x, saved.y);
      if (occupant && occupant !== unit) {
        if (typeof occupant.MoveBattleUnit !== 'function') {
          throw new Error(`The game cannot swap the unit occupying ${saved.x + 1}:${saved.y + 1}.`);
        }
        occupant.MoveBattleUnit(currentX, currentY);
      }
      call(unit, ['set_Enabled'], saved.enabled !== false);
      const alreadyThere = currentX === Number(saved.x) && currentY === Number(saved.y);
      const canMove = call(unit, ['CanMoveBattleUnit'], saved.x, saved.y);
      if (!alreadyThere && canMove === false) {
        throw new Error(`The game rejected the move for ${saved.name || saved.mdbId} to ${saved.x + 1}:${saved.y + 1}.`);
      }
      if (!alreadyThere) {
        if (typeof unit.MoveBattleUnit !== 'function') {
          throw new Error(`Movement is unavailable for ${saved.name || saved.mdbId}.`);
        }
        unit.MoveBattleUnit(saved.x, saved.y);
      }
    }
    return this.snapshot();
  }

  applyRecommendedFormation(units) {
    const snapshot = this.snapshot();
    if (!snapshot.attacker?.id || !snapshot.target?.id || !snapshot.units.length) {
      throw new Error('Open a target attack screen with an offensive formation first.');
    }
    if (!Array.isArray(units) || units.length !== snapshot.units.length) {
      throw new Error('The recommendation does not match the active offensive army.');
    }
    return this.applyFormation({
      attackerId: snapshot.attacker.id,
      attackerName: snapshot.attacker.name,
      units: units.map((unit) => ({
        entityId: unit.entityId,
        mdbId: unit.id ?? unit.mdbId,
        name: unit.name,
        level: unit.level,
        x: unit.x,
        y: unit.y,
        enabled: unit.enabled !== false
      }))
    });
  }

  openTargetAttack(target) {
    if (!target?.id) throw new Error('Choose a target first.');
    this.lastCombatTargetId = target.id;
    const clientLib = this.clientLib();
    const root = clientLib?.root;
    const main = this.mainData();
    const cities = call(main, ['get_Cities']);
    call(cities, ['set_CurrentCityId'], target.id);
    root?.Net?.CommunicationManager?.GetInstance?.()?.UserAction?.();
    const mode = root?.Data?.PlayerAreaViewMode?.pavmCombatSetupDefense;
    const app = globalThis.qx?.core?.Init?.getApplication?.();
    app?.getBackgroundArea?.()?.closeCityInfo?.();
    app?.getPlayArea?.()?.setView?.(mode, target.id, 0, 0);
    return target;
  }

  async getTargetInformation(target) {
    if (!this.hub?.scanner?.getTargetIntel) {
      throw new Error('The shared target-intelligence service is unavailable.');
    }
    const intel = await this.hub.scanner.getTargetIntel(target);
    return Object.freeze({ ...intel, attackEstimate: this.snapshot().attackEstimate });
  }
}
