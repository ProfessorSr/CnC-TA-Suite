(() => {
  'use strict';

  const HOST = globalThis.window ?? globalThis;
  const ROOT = (HOST.CnCTA = HOST.CnCTA || {});
  const TYPE = Object.freeze({ PLAYER: 1, BASE: 2, CAMP: 3 });

  function hiddenMemberFromRegion(method) {
    if (typeof method !== 'function') return null;
    const match = method.toString().match(/return\s+this\.[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)/);
    return match?.[1] ?? null;
  }

  function installWorldObjectAccessors(clientLib) {
    const definitions = [
      ['City', 'City'],
      ['NPCBase', 'NPCBase'],
      ['NPCCamp', 'NPCCamp']
    ];

    for (const [worldName, regionName] of definitions) {
      const worldPrototype = clientLib?.Data?.WorldSector?.[`WorldObject${worldName}`]?.prototype;
      const regionPrototype = clientLib?.Vis?.Region?.[`Region${regionName}`]?.prototype;
      if (!worldPrototype || !regionPrototype) continue;

      if (typeof worldPrototype.get_BaseLevel !== 'function') {
        const member = hiddenMemberFromRegion(regionPrototype.get_BaseLevel);
        if (member) worldPrototype.get_BaseLevel = function getBaseLevel() {
          return this[member];
        };
      }

      if (typeof worldPrototype.getID !== 'function') {
        const member = hiddenMemberFromRegion(regionPrototype.get_Id);
        if (member) worldPrototype.getID = function getID() {
          return this[member];
        };
      }

      if (worldName === 'City') {
        for (const accessor of ['get_AllianceId', 'get_AllianceName']) {
          if (typeof worldPrototype[accessor] === 'function') continue;
          const member = hiddenMemberFromRegion(regionPrototype[accessor]);
          if (member) worldPrototype[accessor] = function getAllianceValue() {
            return this[member];
          };
        }
      }

      if (worldName === 'NPCCamp' && typeof worldPrototype.get_CampType !== 'function') {
        const member = hiddenMemberFromRegion(regionPrototype.get_CampType);
        if (member) worldPrototype.get_CampType = function getCampType() {
          return this[member];
        };
      }
    }
  }

  function safeCall(target, names, ...args) {
    for (const name of names) {
      try {
        if (target && typeof target[name] === 'function') {
          const value = target[name](...args);
          if (value !== undefined && value !== null) return value;
        }
      } catch (_) {}
    }
    return null;
  }

  function resolveObjectId(object) {
    for (const key of ['ID', 'Id', 'id', 'BaseId', 'baseId']) {
      const value = object?.[key];
      if (value !== undefined && value !== null && value !== 0) return value;
    }
    for (const name of [
      'getID',
      'get_Id',
      'get_IdRaw',
      'get_BaseId',
      'getBaseId',
      'GetId'
    ]) {
      try {
        const value = object?.[name]?.();
        if (value !== undefined && value !== null && value !== 0) return value;
      } catch (_) {}
    }

    const seen = new Set();
    let surface = object;
    while (surface && surface !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(surface)) {
        if (seen.has(name) || !/id/i.test(name)) continue;
        seen.add(name);
        try {
          const member = object?.[name];
          const value = typeof member === 'function' && member.length === 0
            ? member.call(object)
            : member;
          if (
            value !== undefined
            && value !== null
            && value !== 0
            && typeof value !== 'function'
          ) {
            return value;
          }
        } catch (_) {}
      }
      surface = Object.getPrototypeOf(surface);
    }
    return null;
  }

  function resolveObjectLevel(object) {
    return Number(safeCall(object, ['get_BaseLevel', 'getLevel', 'get_Level']) || 0);
  }

  function resolveCampType(object) {
    return Number(safeCall(object, ['get_CampType', 'getCampType']) || 0);
  }

  function resolveObjectType(object) {
    const direct = Number(object?.Type ?? object?.type);
    if (Number.isFinite(direct)) return direct;
    return Number(safeCall(object, ['get_Type', 'getType', 'get_ObjectType']) || 0);
  }

  function classifyWorldObject(object) {
    if (!object) return null;
    const type = resolveObjectType(object);
    if (type === TYPE.BASE) return 'Base';
    if (type === TYPE.CAMP) {
      const campType = resolveCampType(object);
      return campType === 3 ? 'Outpost' : 'Camp';
    }
    if (type === TYPE.PLAYER) return 'Player';
    return null;
  }

  function isAttackableWorldObject(object) {
    if (!object) return false;
    if (safeCall(object, ['get_IsGhostMode', 'get_IsGhost', 'get_IsDestroyed'])) return false;
    if (safeCall(object, ['get_IsValid', 'get_Valid']) === false) return false;
    return safeCall(object, ['get_CanAttack', 'get_IsAttackable']) !== false;
  }

  function allianceRelationships(main) {
    const ownAlliance = safeCall(main, ['get_Alliance']);
    const source = safeCall(ownAlliance, ['get_Relationships', 'get_Diplomacy']);
    const records = source?.d ?? source?.l ?? source ?? {};
    const result = new Map();
    for (const record of Object.values(records)) {
      const id = record?.AllianceId ?? record?.Id ?? safeCall(record, ['get_AllianceId', 'get_Id']);
      const raw = record?.RelationshipName ?? record?.Name ?? record?.Relationship ?? record?.Type
        ?? safeCall(record, ['get_Relationship', 'get_Type']);
      const name = String(raw ?? '').toLowerCase();
      const relationship = /nap|non.?aggression/.test(name) ? 'nap'
        : /friend|ally|allied/.test(name) ? 'allied'
          : /enemy|war|hostile/.test(name) ? 'enemy' : 'neutral';
      if (id != null) result.set(String(id), relationship);
    }
    return { ownId: safeCall(ownAlliance, ['get_Id']), result };
  }

  function resolveAlliance(object) {
    const id = safeCall(object, ['get_AllianceId', 'get_AllianceID', 'get_OwnerAllianceId'])
      ?? object?.AllianceId
      ?? object?.allianceId
      ?? null;
    const name = safeCall(object, ['get_AllianceName', 'get_OwnerAllianceName'])
      ?? object?.AllianceName
      ?? object?.allianceName
      ?? '';
    return { id, name: String(name || '').trim() };
  }

  function worldSectors(world) {
    for (const value of Object.values(world ?? {})) {
      const dictionary = value?.d;
      if (!dictionary || typeof dictionary !== 'object') continue;
      const first = Object.values(dictionary).find(Boolean);
      if (typeof first?.ConvertToWorldX === 'function') return Object.values(dictionary);
    }
    return [];
  }

  function worldAlliances(world) {
    const alliances = new Map();
    for (const sector of worldSectors(world)) {
      for (let index = 1; index < 10000; index += 1) {
        const record = safeCall(sector, ['GetAlliance'], index);
        if (!record) break;
        const entries = Object.entries(record);
        const name = entries.find(([, value]) => typeof value === 'string' && value.trim())?.[1] ?? '';
        const id = record.Id
          ?? record.ID
          ?? entries.find(([, value]) => Number.isInteger(value) && value > 0)?.[1]
          ?? index;
        if (!name) continue;
        const key = String(id);
        if (!alliances.has(key)) alliances.set(key, { id, name: name.trim() });
      }
    }
    return alliances;
  }

  function createLayout(city) {
    const rows = [];
    for (let y = 0; y < 8; y += 1) {
      const row = [];
      for (let x = 0; x < 9; x += 1) {
        row.push(Number(safeCall(city, ['GetResourceType'], x, y) || 0));
      }
      rows.push(row);
    }
    return rows;
  }

  function describeEntities(collection) {
    const source = collection?.d ?? collection?.l ?? collection ?? {};
    const entities = Array.isArray(source) ? source : Object.values(source);
    return entities.filter(Boolean).map((entity) => {
      const data = safeCall(entity, ['get_UnitGameData_Obj', 'get_TechGameData_Obj']);
      const health = Number(safeCall(entity, ['get_HitpointsPercent', 'get_Health']) ?? 1);
      return {
        id: safeCall(entity, ['get_MdbUnitId', 'get_MdbId', 'get_Id']),
        name: safeCall(data, ['get_Name', 'get_DisplayName']) ?? data?.dn ?? data?.n ?? 'Unknown',
        level: Number(safeCall(entity, ['get_CurrentLevel', 'get_Level']) ?? 0),
        condition: Math.max(0, Math.min(100, Math.round(health <= 1 ? health * 100 : health)))
      };
    });
  }

  function summarizeEntities(entities) {
    if (!entities.length) return { count: 0, averageLevel: 0, damaged: 0, composition: [] };
    const counts = new Map();
    for (const entity of entities) counts.set(entity.name, (counts.get(entity.name) ?? 0) + 1);
    return {
      count: entities.length,
      averageLevel: entities.reduce((sum, entity) => sum + entity.level, 0) / entities.length,
      damaged: entities.filter((entity) => entity.condition < 100).length,
      composition: [...counts].map(([name, count]) => ({ name, count }))
    };
  }

  function cityReady(city) {
    if (!city) return false;
    const version = Number(safeCall(city, ['get_Version']) || 0);
    const condition = Number(safeCall(city, ['GetBuildingsConditionInPercent']) || 0);
    return version > 0 || condition > 0;
  }

  function waitForCity(cities, id, signal, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (signal?.aborted) return reject(new DOMException('Scan stopped', 'AbortError'));
        const city = safeCall(cities, ['GetCity'], id);
        if (cityReady(city)) return resolve(city);
        if (Date.now() - started >= timeoutMs) return resolve(null);
        setTimeout(tick, 175);
      };
      tick();
    });
  }

  function getOwnCities(cities) {
    const all = safeCall(cities, ['get_AllCities']);
    const dictionary = all?.d || all || {};
    return Object.values(dictionary).filter(Boolean).map(city => ({
      id: safeCall(city, ['get_Id']),
      name: safeCall(city, ['get_Name']) || 'Base',
      x: Number(safeCall(city, ['get_PosX']) || 0),
      y: Number(safeCall(city, ['get_PosY']) || 0),
      raw: city
    }));
  }

  function install(gameDataHub) {
    if (!gameDataHub || gameDataHub.scanner) return gameDataHub?.scanner;

    const scanner = {
      getOptionsSnapshot() {
        installWorldObjectAccessors(ClientLib);
        const main = ClientLib.Data.MainData.GetInstance();
        const cities = main.get_Cities();
        const server = main.get_Server();
        return {
          ownCities: getOwnCities(cities),
          maxAttackDistance: Number(server.get_MaxAttackDistance() || 0)
        };
      },

      getAllianceOptions(options = {}) {
        installWorldObjectAccessors(ClientLib);
        const main = ClientLib.Data.MainData.GetInstance();
        const cities = main.get_Cities();
        const world = main.get_World();
        const own = getOwnCities(cities);
        const origin = own.find((city) => String(city.id) === String(options.originCityId)) || own[0];
        if (!origin) return [];
        const radius = Number(options.radius || main.get_Server().get_MaxAttackDistance() || 0);
        const alliances = worldAlliances(world);

        if (!alliances.size) {
          for (let y = origin.y - Math.ceil(radius); y <= origin.y + Math.ceil(radius); y += 1) {
            for (let x = origin.x - Math.ceil(radius); x <= origin.x + Math.ceil(radius); x += 1) {
              if (Math.hypot(origin.x - x, origin.y - y) > radius) continue;
              const object = world.GetObjectFromPosition(x, y);
              if (resolveObjectType(object) !== TYPE.PLAYER) continue;
              const alliance = resolveAlliance(object);
              if (!alliance.name) continue;
              const key = alliance.id == null ? alliance.name.toLowerCase() : String(alliance.id);
              if (!alliances.has(key)) alliances.set(key, alliance);
            }
          }
        }

        return [...alliances.values()].sort((left, right) =>
          left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
        );
      },

      findTargets(options = {}) {
        installWorldObjectAccessors(ClientLib);
        const main = ClientLib.Data.MainData.GetInstance();
        const cities = main.get_Cities();
        const world = main.get_World();
        const own = getOwnCities(cities);
        const origin = own.find((city) => String(city.id) === String(options.originCityId)) || own[0];
        if (!origin) throw new Error('No player base is available for target search.');

        const selectedBase = origin.raw;
        const radius = Number(options.radius || main.get_Server().get_MaxAttackDistance() || 0);
        const cpLimit = Number(options.cpLimit ?? 99);
        const minLevel = Number(options.minLevel ?? 1);
        const maxLevel = Number(options.maxLevel ?? Number.POSITIVE_INFINITY);
        const selectedTypes = new Set(options.types || ['Base', 'Outpost', 'Camp']);
        const selectedAlliance = String(options.allianceName || '').trim().toLowerCase();
        const selectedRelationships = new Set(options.relationships ?? ['allied', 'nap', 'enemy', 'neutral']);
        const diplomacy = allianceRelationships(main);
        const ownIds = new Set(own.map((city) => String(city.id)));
        const targets = [];

        for (let y = origin.y - Math.ceil(radius); y <= origin.y + Math.ceil(radius); y += 1) {
          for (let x = origin.x - Math.ceil(radius); x <= origin.x + Math.ceil(radius); x += 1) {
            const distance = Math.hypot(origin.x - x, origin.y - y);
            if (distance > radius) continue;
            const object = world.GetObjectFromPosition(x, y);
            const objectType = resolveObjectType(object);
            const alliance = objectType === TYPE.PLAYER ? resolveAlliance(object) : null;
            const allianceMatch = Boolean(
              selectedAlliance
              && alliance?.name.toLowerCase() === selectedAlliance
            );
            const type = allianceMatch ? 'Alliance' : classifyWorldObject(object);
            if (!type || (type !== 'Alliance' && !selectedTypes.has(type))) continue;
            const id = resolveObjectId(object);
            const level = resolveObjectLevel(object);
            if (!id || ownIds.has(String(id)) || !isAttackableWorldObject(object) || level < minLevel || level > maxLevel) continue;
            const relationship = objectType === TYPE.PLAYER
              ? (String(alliance?.id) === String(diplomacy.ownId) ? 'allied' : diplomacy.result.get(String(alliance?.id)) ?? 'neutral')
              : null;
            if (type === 'Player' && !selectedRelationships.has(relationship)) continue;
            const cp = Number(selectedBase.CalculateAttackCommandPointCostToCoord(x, y) || 0);
            if (cp > cpLimit) continue;
            targets.push({
              id,
              type: type === 'Alliance' ? 'Base' : type,
              level,
              x,
              y,
              cp,
              distance,
              allianceId: alliance?.id ?? null,
              alliance: alliance?.name ?? '',
              relationship
            });
          }
        }

        return targets.sort((left, right) =>
          left.cp - right.cp || right.level - left.level || left.distance - right.distance
        );
      },

      async getTargetIntel(target, signal) {
        if (!target?.id) throw new Error('A target is required.');
        installWorldObjectAccessors(ClientLib);
        const main = ClientLib.Data.MainData.GetInstance();
        const cities = main.get_Cities();
        const world = main.get_World();
        const server = main.get_Server();
        const own = getOwnCities(cities);
        const attacker = own[0] ?? null;
        cities.set_CurrentCityId(target.id);
        safeCall(ClientLib?.Net?.CommunicationManager?.GetInstance?.(), ['UserAction']);
        const city = await waitForCity(cities, target.id, signal, 10000);
        if (!city) throw new Error('Target city data did not load.');

        const buildings = Object.values(safeCall(city, ['get_Buildings'])?.d ?? {});
        const cityUnits = safeCall(city, ['get_CityUnitsData']);
        const buildingEntities = describeEntities(buildings);
        const defenseEntities = describeEntities(safeCall(cityUnits, ['get_DefenseUnits']));
        const offenseEntities = describeEntities(safeCall(cityUnits, ['get_OffenseUnits']));
        const supportBuilding = buildings.find((building) => {
          const id = Number(safeCall(building, ['get_MdbUnitId', 'get_MdbId']) || 0);
          return id >= 200 && id <= 205;
        }) ?? null;
        const supportData = safeCall(supportBuilding, ['get_UnitGameData_Obj', 'get_UnitGameData']);
        const lootEntries = ClientLib?.API?.Battleground?.GetInstance?.()?.GetLootFromCurrentCity?.() ?? [];
        const resourceNames = {};
        for (const [name, value] of Object.entries(ClientLib?.Base?.EResourceType ?? {})) {
          if (typeof value === 'number') resourceNames[value] = name;
        }
        const loot = Array.from(lootEntries).map((entry) => ({
          type: entry.Type,
          name: resourceNames[entry.Type] ?? `Resource ${entry.Type}`,
          amount: Number(entry.Count ?? 0)
        }));
        const groups = ClientLib?.Data?.EUnitGroup ?? {};
        const repair = {
          infantry: Number(safeCall(cityUnits, ['GetRepairTimeFromEUnitGroup'], groups.Infantry, false) || 0),
          vehicle: Number(safeCall(cityUnits, ['GetRepairTimeFromEUnitGroup'], groups.Vehicle, false) || 0),
          aircraft: Number(safeCall(cityUnits, ['GetRepairTimeFromEUnitGroup'], groups.Aircraft, false) || 0)
        };

        const range = Number(server.get_MaxAttackDistance?.() || 0);
        const surrounding = [];
        const forgotten = [];
        for (let y = target.y - Math.ceil(range); y <= target.y + Math.ceil(range); y += 1) {
          for (let x = target.x - Math.ceil(range); x <= target.x + Math.ceil(range); x += 1) {
            if (Math.hypot(target.x - x, target.y - y) > range) continue;
            const object = world.GetObjectFromPosition(x, y);
            if (!object || (x === target.x && y === target.y)) continue;
            const type = resolveObjectType(object);
            if ([TYPE.PLAYER, TYPE.BASE, TYPE.CAMP].includes(type)) surrounding.push(object);
            if (type === TYPE.BASE) forgotten.push(resolveObjectLevel(object));
          }
        }
        const levelCounts = {};
        for (const level of forgotten) levelCounts[level] = (levelCounts[level] ?? 0) + 1;

        return {
          id: target.id,
          type: target.type,
          name: safeCall(city, ['get_Name']) || target.type,
          level: Number(safeCall(city, ['get_LvlBase', 'get_BaseLevel', 'get_Level']) || target.level || 0),
          x: target.x,
          y: target.y,
          cp: target.cp,
          owner: safeCall(city, ['get_PlayerName', 'get_OwnerName']) || 'Forgotten',
          alliance: safeCall(city, ['get_AllianceName', 'get_OwnerAllianceName']) || '',
          baseCondition: Number(safeCall(city, ['GetBuildingsConditionInPercent']) || 0),
          defenseCondition: Number(safeCall(city, ['GetDefenseConditionInPercent']) || 0),
          attackPossible: Boolean(attacker && Number(target.cp) <= 99),
          attacker: attacker?.name ?? 'Current base',
          surroundingBases: surrounding.length,
          forgottenInRange: forgotten.length,
          waves: Math.ceil(forgotten.length / 4),
          forgottenLevels: levelCounts,
          support: supportBuilding ? {
            name: safeCall(supportData, ['get_Name', 'get_DisplayName']) || 'Support weapon',
            level: Number(safeCall(supportBuilding, ['get_CurrentLevel', 'get_Level']) || 0),
            condition: Math.round(Number(safeCall(supportBuilding, ['get_HitpointsPercent']) || 0) * 100)
          } : null,
          composition: {
            buildings: summarizeEntities(buildingEntities),
            defense: summarizeEntities(defenseEntities),
            offense: summarizeEntities(offenseEntities)
          },
          repair,
          loot
        };
      },

      async scan(options, onProgress, signal, cache = null) {
        installWorldObjectAccessors(ClientLib);
        const main = ClientLib.Data.MainData.GetInstance();
        const cities = main.get_Cities();
        const world = main.get_World();
        const own = getOwnCities(cities);
        const origin = own.find(city => String(city.id) === String(options.originCityId)) || own[0];
        if (!origin) throw new Error('No player base is available for scanning.');

        const selectedBase = origin.raw;
        const maxDistance = Number(options.radius || main.get_Server().get_MaxAttackDistance() || 0);
        const cpLimit = Number(options.cpLimit || 99);
        const minLevel = Number(options.minLevel || 1);
        const maxLevel = Number(options.maxLevel ?? Number.POSITIVE_INFINITY);
        const selectedTypes = new Set(options.types || ['Base', 'Outpost', 'Camp']);
        const selectedRelationships = new Set(options.relationships ?? ['allied', 'nap', 'enemy', 'neutral']);
        const diplomacy = allianceRelationships(main);
        const ownIds = new Set(own.map(city => String(city.id)));
        const candidates = [];
        const discovery = {
          positions: 0,
          objects: 0,
          observedTypes: new Set(),
          unsupportedType: 0,
          filteredType: 0,
          missingId: 0,
          ownBase: 0,
          belowLevel: 0,
          aboveLevel: 0,
          aboveCp: 0
        };

        ClientLib.Vis.VisMain.GetInstance().CenterGridPosition(origin.x, origin.y);
        ClientLib.Vis.VisMain.GetInstance().Update();
        ClientLib.Vis.VisMain.GetInstance().ViewUpdate();

        for (let y = origin.y - Math.ceil(maxDistance); y <= origin.y + Math.ceil(maxDistance); y += 1) {
          for (let x = origin.x - Math.ceil(maxDistance); x <= origin.x + Math.ceil(maxDistance); x += 1) {
            if (signal?.aborted) throw new DOMException('Scan stopped', 'AbortError');
            const dx = origin.x - x;
            const dy = origin.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > maxDistance) continue;
            discovery.positions += 1;

            const object = world.GetObjectFromPosition(x, y);
            if (object) {
              discovery.objects += 1;
              discovery.observedTypes.add(resolveObjectType(object));
            }
            const type = classifyWorldObject(object);
            if (!type) {
              if (object) discovery.unsupportedType += 1;
              continue;
            }
            if (!selectedTypes.has(type)) {
              discovery.filteredType += 1;
              continue;
            }

            const id = resolveObjectId(object);
            const level = resolveObjectLevel(object);
            if (!id || !isAttackableWorldObject(object)) {
              discovery.missingId += 1;
              continue;
            }
            if (ownIds.has(String(id))) {
              discovery.ownBase += 1;
              continue;
            }
            const alliance = type === 'Player' ? resolveAlliance(object) : null;
            const relationship = type === 'Player'
              ? (String(alliance?.id) === String(diplomacy.ownId) ? 'allied' : diplomacy.result.get(String(alliance?.id)) ?? 'neutral')
              : null;
            if (type === 'Player' && !selectedRelationships.has(relationship)) {
              discovery.filteredType += 1;
              continue;
            }
            if (level < minLevel) {
              discovery.belowLevel += 1;
              continue;
            }
            if (level > maxLevel) {
              discovery.aboveLevel += 1;
              continue;
            }

            const cp = Number(selectedBase.CalculateAttackCommandPointCostToCoord(x, y) || 0);
            if (cp > cpLimit) {
              discovery.aboveCp += 1;
              continue;
            }
            const version = safeCall(object, [
              'get_Version', 'get_BaseVersion', 'get_LayoutVersion', 'get_LastChange'
            ]) ?? `${type}:${level}`;
            candidates.push({ id, type, level, x, y, cp, distance, version,
              allianceId: alliance?.id ?? null, alliance: alliance?.name ?? '', relationship });
          }
        }

        const discoverySummary = {
          ...discovery,
          observedTypes: [...discovery.observedTypes].sort((a, b) => a - b)
        };
        onProgress?.({
          phase: 'layouts',
          current: 0,
          total: candidates.length,
          discovery: discoverySummary
        });
        const results = [];
        const resumeFrom = Math.max(0, Math.min(candidates.length, Number(options.resumeFrom ?? 0)));
        for (let index = resumeFrom; index < candidates.length; index += 1) {
          if (signal?.aborted) throw new DOMException('Scan stopped', 'AbortError');
          const candidate = candidates[index];
          onProgress?.({ phase: 'layouts', current: index, total: candidates.length, candidate });
          const cacheKey = String(candidate.id);
          const cached = cache?.get?.(cacheKey);
          if (cached && String(cached.version) === String(candidate.version)) {
            const result = { ...cached.result, ...candidate };
            results.push(result);
            onProgress?.({ phase: 'layouts', current: index + 1, total: candidates.length, candidate, result, cached: true });
            continue;
          }
          cities.set_CurrentCityId(candidate.id);
          safeCall(
            ClientLib?.Net?.CommunicationManager?.GetInstance?.(),
            ['UserAction']
          );
          const city = await waitForCity(cities, candidate.id, signal);
          if (city && !safeCall(city, ['get_IsGhostMode'])) {
            const result = {
              ...candidate,
              name: safeCall(city, ['get_Name']) || candidate.type,
              layout: createLayout(city)
            };
            results.push(result);
            cache?.set?.(cacheKey, { version: candidate.version, result });
            onProgress?.({ phase: 'result', current: index + 1, total: candidates.length, candidate, result });
          }
          onProgress?.({
            phase: 'layouts',
            current: index + 1,
            total: candidates.length,
            candidate
          });
        }
        onProgress?.({
          phase: 'complete',
          current: candidates.length,
          total: candidates.length,
          matches: results.length,
          discovery: discoverySummary
        });
        return results;
      },

      focusResult(result, openCombat = false) {
        ClientLib.Vis.VisMain.GetInstance().CenterGridPosition(result.x, result.y);
        if (openCombat && result.id) {
          const app = qx.core.Init.getApplication();
          app.getBackgroundArea().closeCityInfo();
          app.getPlayArea().setView(ClientLib.Data.PlayerAreaViewMode.pavmCombatSetupDefense, result.id, 0, 0);
        }
      }
    };

    gameDataHub.scanner = scanner;
    return scanner;
  }

  ROOT.installScannerHubExtension = install;
})();
