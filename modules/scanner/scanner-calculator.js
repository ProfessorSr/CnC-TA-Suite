(() => {
  'use strict';

  const HOST = globalThis.window ?? globalThis;
  const ROOT = (HOST.CnCTA = HOST.CnCTA || {});

  const RESOURCE = Object.freeze({ EMPTY: 0, CRYSTAL: 1, TIBERIUM: 2 });
  const FILTERS = Object.freeze([
    { id: 'all', label: 'All Layouts' },
    { id: 't7', label: '7 Tiberium' },
    { id: 't6', label: '6 Tiberium' },
    { id: 't5', label: '5 Tiberium' },
    { id: 'c7', label: '7 Crystal' },
    { id: 'c6', label: '6 Crystal' },
    { id: 'c5', label: '5 Crystal' }
  ]);

  function countResources(layout) {
    let tiberium = 0;
    let crystal = 0;
    for (const row of layout || []) {
      for (const cell of row || []) {
        if (cell === RESOURCE.TIBERIUM) tiberium += 1;
        if (cell === RESOURCE.CRYSTAL) crystal += 1;
      }
    }
    return { tiberium, crystal };
  }

  function classify(layout) {
    const counts = countResources(layout);
    const matches = [];
    if ([5, 6, 7].includes(counts.tiberium)) matches.push(`t${counts.tiberium}`);
    if ([5, 6, 7].includes(counts.crystal)) matches.push(`c${counts.crystal}`);
    return {
      ...counts,
      matches,
      primary: matches[0] || null,
      label: matches.map(id => FILTERS.find(item => item.id === id)?.label).filter(Boolean).join(' / ')
    };
  }

  function matchesFilter(result, filterId) {
    if (!result?.layoutInfo) return false;
    return filterId === 'all' || result.layoutInfo.matches.includes(filterId);
  }

  function normalizeResult(raw) {
    const layout = Array.isArray(raw?.layout) ? raw.layout : [];
    return {
      id: raw?.id ?? null,
      type: raw?.type || 'Unknown',
      name: raw?.name || raw?.type || 'Unknown',
      level: Number(raw?.level || 0),
      x: Number(raw?.x || 0),
      y: Number(raw?.y || 0),
      cp: Number(raw?.cp || 0),
      distance: Number(raw?.distance || 0),
      layout,
      layoutInfo: classify(layout)
    };
  }

  function filterResults(results, filterId = 'all') {
    return (results || [])
      .map(normalizeResult)
      .filter(result => matchesFilter(result, filterId))
      .sort((a, b) => b.level - a.level || a.cp - b.cp || a.distance - b.distance);
  }

  ROOT.ScannerCalculator = Object.freeze({
    RESOURCE,
    FILTERS,
    classify,
    normalizeResult,
    filterResults,
    matchesFilter
  });
})();
