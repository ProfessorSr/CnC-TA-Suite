function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function firstValue(source, paths, fallback = null) {
  for (const path of paths) {
    let value = source;

    for (const part of path.split('.')) {
      if (value == null) break;
      value = typeof value[part] === 'function'
        ? value[part]()
        : value[part];
    }

    if (value != null) return value;
  }

  return fallback;
}

function percent(current, required) {
  if (required <= 0) return 0;
  const normalized = Math.max(0, Math.min(100, (current / required) * 100));
  return Math.round(normalized * 1_000_000) / 1_000_000;
}

function secondsUntil(current, required, growthPerHour) {
  if (current >= required) return 0;
  if (growthPerHour <= 0) return null;
  return Math.ceil(((required - current) / growthPerHour) * 3600);
}

export class NextMCVCalculator {
  static readHub(context) {
    const hub = context?.hub;

    if (!hub) {
      throw new Error('The Suite Hub is unavailable.');
    }

    const snapshot =
      hub.snapshot?.() ??
      hub.getSnapshot?.() ??
      hub.state?.snapshot?.() ??
      hub.state ??
      hub;

    const currentCredits = finiteNumber(firstValue(snapshot, [
      'player.credits.current',
      'player.resources.credits.current',
      'economy.credits.current',
      'credits.current',
      'credits'
    ]));

    const requiredCredits = finiteNumber(firstValue(snapshot, [
      'player.nextMCV.creditsRequired',
      'player.nextMcv.creditsRequired',
      'research.nextMCV.creditsRequired',
      'research.nextMcv.creditsRequired',
      'nextMCV.creditsRequired',
      'nextMcv.creditsRequired'
    ]));

    const currentResearch = finiteNumber(firstValue(snapshot, [
      'player.research.current',
      'player.resources.research.current',
      'economy.research.current',
      'research.current',
      'researchPoints'
    ]));

    const requiredResearch = finiteNumber(firstValue(snapshot, [
      'player.nextMCV.researchRequired',
      'player.nextMcv.researchRequired',
      'research.nextMCV.researchRequired',
      'research.nextMcv.researchRequired',
      'nextMCV.researchRequired',
      'nextMcv.researchRequired'
    ]));

    const creditGrowthPerHour = finiteNumber(firstValue(snapshot, [
      'player.credits.growthPerHour',
      'player.resources.credits.growthPerHour',
      'economy.credits.growthPerHour',
      'credits.growthPerHour',
      'creditGrowthPerHour'
    ]));

    if (requiredCredits <= 0 && requiredResearch <= 0) {
      throw new Error('The Hub has not published next-MCV requirements yet.');
    }

    const creditPercent = percent(currentCredits, requiredCredits);
    const researchPercent = percent(currentResearch, requiredResearch);
    const hubCreditsRemaining = firstValue(snapshot, [
      'player.nextMCV.creditsRemaining'
    ]);
    const hubResearchRemaining = firstValue(snapshot, [
      'player.nextMCV.researchRemaining'
    ]);
    const hubCreditEta = firstValue(snapshot, [
      'player.nextMCV.creditEtaSeconds'
    ]);

    return {
      credits: {
        current: currentCredits,
        required: requiredCredits,
        remaining: finiteNumber(
          hubCreditsRemaining,
          Math.max(0, requiredCredits - currentCredits)
        ),
        growthPerHour: creditGrowthPerHour,
        percent: creditPercent,
        complete: requiredCredits > 0 && currentCredits >= requiredCredits,
        etaSeconds: hubCreditEta == null
          ? secondsUntil(currentCredits, requiredCredits, creditGrowthPerHour)
          : finiteNumber(hubCreditEta)
      },
      research: {
        current: currentResearch,
        required: requiredResearch,
        remaining: finiteNumber(
          hubResearchRemaining,
          Math.max(0, requiredResearch - currentResearch)
        ),
        percent: researchPercent,
        complete: requiredResearch > 0 && currentResearch >= requiredResearch
      },
      overallPercent: (creditPercent + researchPercent) / 2,
      ready: creditPercent >= 100 && researchPercent >= 100,
      updatedAt: Date.now()
    };
  }
}
