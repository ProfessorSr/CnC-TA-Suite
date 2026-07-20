function firstCall(clientLib, target, methodNames, ...args) {
  return clientLib?.call?.(target, methodNames, ...args) ?? null;
}

function freezeRecord(value) {
  return Object.freeze({ ...value });
}

function firstValue(source, names) {
  for (const name of names) {
    try {
      const value = typeof source?.[name] === 'function'
        ? source[name]()
        : source?.[name];
      if (value !== undefined && value !== null) return value;
    } catch {
      // ClientLib accessors can be guarded while game data is refreshing.
    }
  }
  return null;
}

const FALLBACK_MCV_RESOURCE_TYPE = Object.freeze({
  RESEARCH_POINTS: 3,
  CREDITS: 6
});

function resourceRequirement(nextLevel, type) {
  const requirements = Array.isArray(nextLevel?.rr) ? nextLevel.rr : [];
  const record = requirements.find((entry) => Number(entry?.t) === type);
  return firstValue(record, ['c', 'v', 'cost', 'value']);
}

function resourceAmount(value, fallback = 0) {
  if (value != null) {
    const direct = Number(value);
    if (Number.isFinite(direct)) return direct;
  }
  return Number(firstValue(value, [
    'Base', 'base', 'Current', 'current', 'Value', 'value',
    'Amount', 'amount', 'Count', 'count',
    'get_Base', 'get_Current', 'get_Value', 'get_Amount', 'get_Count'
  ])) || fallback;
}

function nextMcvResearch(clientLib, rawPlayer, ownedBaseCount = 0) {
  try {
    const base = clientLib?.root?.Base;

    const techName = base.ETechName.Research_BaseFound;

    const faction =
      typeof rawPlayer?.get_Faction === 'function'
        ? rawPlayer.get_Faction()
        : typeof rawPlayer?.get_FactionType === 'function'
          ? rawPlayer.get_FactionType()
          : null;
    const techId = base.Tech.GetTechIdFromTechNameAndFaction(
      techName,
      faction
    );
    const research =
      typeof rawPlayer?.get_PlayerResearch === 'function'
        ? rawPlayer.get_PlayerResearch()
        : typeof rawPlayer?.get_Research === 'function'
          ? rawPlayer.get_Research()
          : null;
    let item = null;

    if (research && techId != null) {
      if (typeof research.GetResearchItemFomMdbId === 'function') {
        item = research.GetResearchItemFomMdbId(techId);
      } else if (typeof research.GetResearchItemFromMdbId === 'function') {
        item = research.GetResearchItemFromMdbId(techId);
      }
    }

    // This is the supported PlayerResearchItem API used by the game and by the
    // established Maelstrom MCV tool. It already resolves the player's actual
    // next BaseFound level, so do not infer it from obfuscated internal tables.
    const nextLevelInfo = firstValue(item, ['get_NextLevelInfo_Obj']);
    const levels = Array.isArray(item?.SWFVWJ?.r) ? item.SWFVWJ.r : [];
    const reportedLevel = firstValue(item, [
      'get_CurrentLevel',
      'get_Level',
      'get_CurrentLvl',
      'currentLevel',
      'level'
    ]);
    const inferredLevelIndex = reportedLevel != null && Number.isInteger(Number(reportedLevel))
      ? Number(reportedLevel)
      : Math.max(0, Number(ownedBaseCount || 1) - 1);
    const accessorLevelIndex = nextLevelInfo == null ? -1 : levels.indexOf(nextLevelInfo);
    const levelIndex = accessorLevelIndex >= 0 ? accessorLevelIndex : inferredLevelIndex;
    const nextLevel = nextLevelInfo ?? levels[inferredLevelIndex] ?? null;

    return {
      item,
      nextLevel,
      techId,
      faction,
      reportedLevel,
      ownedBaseCount,
      levelIndex,
      legacyIndex: item?.SMLSTI ?? null,
      usedNextLevelAccessor: nextLevelInfo != null
    };
  } catch {
    return {
      item: null,
      nextLevel: null,
      techId: null,
      faction: null,
      reportedLevel: null,
      ownedBaseCount,
      levelIndex: null,
      legacyIndex: null,
      usedNextLevelAccessor: false
    };
  }
}

export class GameDataHub {
  constructor({ game, logger } = {}) {
    this.game = game;
    this.logger = logger;
  }

  snapshot() {
    const services = this.game?.services;
    const playerService = services?.tryGet?.('player');
    const clientLib = services?.tryGet?.('clientLib');
    const cityService = services?.tryGet?.('city');

    const player = playerService?.current?.() ?? null;
    const rawPlayer = playerService?.raw?.() ?? null;
    const ownedBaseCount = cityService?.all?.().length ?? 0;
    const nextMcvResearchData = nextMcvResearch(
      clientLib,
      rawPlayer,
      ownedBaseCount
    );
    const nextMcvItem = nextMcvResearchData.item;
    const nextMcv = nextMcvResearchData.nextLevel;

    const currentCredits = resourceAmount(firstCall(clientLib, rawPlayer, [
      'GetCreditsCount',
      'get_CreditsCount',
    ]), resourceAmount(player?.credits));
    const currentResearch = resourceAmount(firstCall(clientLib, rawPlayer, [
      'GetResearchPoints',
      'get_ResearchPoints'
    ]), resourceAmount(player?.researchPoints));
    const resourceRequirements = Array.isArray(nextMcv?.rr) ? nextMcv.rr : [];
    const resourceTypes = clientLib?.root?.Base?.EResourceType ?? {};
    const creditResourceType = Number.isFinite(Number(resourceTypes.Gold))
      ? Number(resourceTypes.Gold)
      : FALLBACK_MCV_RESOURCE_TYPE.CREDITS;
    const researchResourceType = Number.isFinite(Number(resourceTypes.ResearchPoints))
      ? Number(resourceTypes.ResearchPoints)
      : FALLBACK_MCV_RESOURCE_TYPE.RESEARCH_POINTS;
    const creditsRequired = resourceRequirement(
      nextMcv,
      creditResourceType
    ) ?? firstValue(nextMcv, [
      'cr',
      'credits',
      'Credits',
      'get_Credits',
      'get_CreditCost'
    ]) ?? firstValue(nextMcvItem, [
      'get_NextLevelCredits',
      'get_NextLevelCreditCost'
    ]);
    const researchRequired = resourceRequirement(
      nextMcv,
      researchResourceType
    ) ?? firstValue(nextMcv, [
      'researchPoints',
      'ResearchPoints',
      'get_ResearchPoints',
      'get_ResearchCost'
    ]) ?? firstValue(nextMcvItem, [
      'get_NextLevelResearchPoints',
      'get_NextLevelResearchCost'
    ]);
    const creditsResource = firstCall(clientLib, rawPlayer, ['get_Credits']);
    const stepsPerHour = clientLib?.getMainData?.()?.get_Time?.()?.get_StepsPerHour?.();
    const maelstromCreditGrowth = creditsResource && Number.isFinite(Number(stepsPerHour))
      ? (resourceAmount(creditsResource.Delta) + resourceAmount(creditsResource.ExtraBonusDelta))
        * Number(stepsPerHour)
      : null;
    const creditGrowthPerHour = maelstromCreditGrowth ?? firstCall(clientLib, rawPlayer, [
      'get_CreditGrowthPerHour',
      'get_CreditsGrowthPerHour',
      'get_CreditProduction'
    ]) ?? 0;

    const creditsRemaining = creditsRequired == null
      ? null
      : Math.max(0, creditsRequired - currentCredits);
    const researchRemaining = researchRequired == null
      ? null
      : Math.max(0, researchRequired - currentResearch);
    const creditEtaSeconds = creditsRemaining != null && creditGrowthPerHour > 0
      ? Math.ceil((creditsRemaining / creditGrowthPerHour) * 3600)
      : null;

    return Object.freeze({
      ready: Boolean(this.game?.ready),
      generatedAt: Date.now(),
      player: freezeRecord({
        ...(player ?? {}),
        credits: freezeRecord({
          current: currentCredits,
          growthPerHour: creditGrowthPerHour
        }),
        research: freezeRecord({ current: currentResearch }),
        nextMCV: freezeRecord({
          source: 'Research_BaseFound',
          sourceAvailable: Boolean(nextMcvItem && nextMcv),
          techId: nextMcvResearchData.techId,
          faction: nextMcvResearchData.faction,
          reportedLevel: nextMcvResearchData.reportedLevel,
          ownedBaseCount: nextMcvResearchData.ownedBaseCount,
          levelIndex: nextMcvResearchData.levelIndex,
          legacyIndex: nextMcvResearchData.legacyIndex,
          usedNextLevelAccessor: nextMcvResearchData.usedNextLevelAccessor,
          resourceRequirements: Object.freeze(
            resourceRequirements.map((entry) => freezeRecord(entry))
          ),
          creditsRequired,
          researchRequired,
          creditsRemaining,
          researchRemaining,
          creditEtaSeconds,
          creditPercent: creditsRequired > 0
            ? Math.min(100, (currentCredits / creditsRequired) * 100)
            : 0,
          researchPercent: researchRequired > 0
            ? Math.min(100, (currentResearch / researchRequired) * 100)
            : 0
        })
      }),
      city: this.game?.city?.current?.() ?? null,
      world: this.game?.world?.info?.() ?? null,
      alliance: this.game?.alliance?.current?.() ?? null,
      selection: this.game?.selection?.snapshot?.() ?? null,
      battle: this.game?.battle?.state?.() ?? null
    });
  }

  getSnapshot() {
    return this.snapshot();
  }
}

export default GameDataHub;
