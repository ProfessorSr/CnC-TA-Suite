(() => {
  'use strict';

  const HOST = globalThis.window ?? globalThis;
  const ROOT = (HOST.CnCTA = HOST.CnCTA || {});

  const RESOURCE = Object.freeze({ EMPTY: 0, CRYSTAL: 1, TIBERIUM: 2 });
  const FILTERS = Object.freeze([
    { id: 'all', label: 'All Layouts' },
    { id: 't7c5', label: '7 Tiberium / 5 Crystal' },
    { id: 't6c6', label: '6 Tiberium / 6 Crystal' },
    { id: 't5c7', label: '5 Tiberium / 7 Crystal' }
  ]);
  const SILO_FILTERS = Object.freeze([
    { id: 'none', label: 'Silo Touch: N/A' },
    { id: 't4', label: '2 Touch 4 Tiberium' },
    { id: 't5', label: '2 Touch 5 Tiberium' }
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
    if (counts.tiberium === 7 && counts.crystal === 5) matches.push('t7c5');
    if (counts.tiberium === 6 && counts.crystal === 6) matches.push('t6c6');
    if (counts.tiberium === 5 && counts.crystal === 7) matches.push('t5c7');
    const siloSpots = [];
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 9; x += 1) {
        if (Number(layout?.[y]?.[x] ?? 0) !== RESOURCE.EMPTY) continue;
        let tiberiumTouches = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if ((!dx && !dy) || Number(layout?.[y + dy]?.[x + dx] ?? 0) !== RESOURCE.TIBERIUM) continue;
            tiberiumTouches += 1;
          }
        }
        if (tiberiumTouches >= 4) siloSpots.push({ x, y, tiberiumTouches });
      }
    }
    const fourTouchSpots = siloSpots.length;
    const fiveTouchSpots = siloSpots.filter(spot => spot.tiberiumTouches >= 5).length;
    return {
      ...counts,
      matches,
      siloSpots,
      fourTouchSpots,
      fiveTouchSpots,
      primary: matches[0] || null,
      label: matches.map(id => FILTERS.find(item => item.id === id)?.label).filter(Boolean).join(' / ')
    };
  }

  function matchesFilter(result, filterId, siloFilterId = 'none') {
    if (!result?.layoutInfo) return false;
    const resourcesMatch = filterId === 'all' || result.layoutInfo.matches.includes(filterId);
    const siloMatch = siloFilterId === 'none'
      || (siloFilterId === 't4' && result.layoutInfo.fourTouchSpots >= 2)
      || (siloFilterId === 't5' && result.layoutInfo.fiveTouchSpots >= 2);
    return resourcesMatch && siloMatch;
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

  function filterResults(results, filterId = 'all', siloFilterId = 'none') {
    return (results || [])
      .map(normalizeResult)
      .filter(result => matchesFilter(result, filterId, siloFilterId))
      .sort((a, b) => b.level - a.level || a.cp - b.cp || a.distance - b.distance);
  }

  function miniCncOptLink(result) {
    const normalized = normalizeResult(result);
    let layout = '';
    for (let y = 0; y < 20; y += 1) {
      for (let x = 0; x < 9; x += 1) {
        const terrain = y < 8 ? Number(normalized.layout?.[y]?.[x] ?? 0) : 0;
        layout += terrain === RESOURCE.CRYSTAL ? 'c' : terrain === RESOURCE.TIBERIUM ? 't' : '.';
      }
    }
    return `http://cncopt.com/?map=3|F|G|${encodeURIComponent(normalized.name)}|${layout}`;
  }

  function exportLayouts(results) {
    return (results || []).map(result => {
      const normalized = normalizeResult(result);
      return `${normalized.x}:${normalized.y}\t${miniCncOptLink(normalized)}`;
    }).join('\n');
  }

  ROOT.ScannerCalculator = Object.freeze({
    RESOURCE,
    FILTERS,
    SILO_FILTERS,
    classify,
    normalizeResult,
    filterResults,
    matchesFilter,
    miniCncOptLink,
    exportLayouts
  });
})();
