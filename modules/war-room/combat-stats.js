const STORAGE_KEY = 'module:war-room:combat-stats:v1';

function duration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const remainder = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function compactTarget(target) {
  if (!target) return null;
  return {
    id: target.id,
    name: target.name ?? 'Unknown',
    level: Number(target.level ?? 0),
    x: Number(target.x ?? 0),
    y: Number(target.y ?? 0),
    owner: target.owner ?? '',
    alliance: target.alliance ?? '',
    npc: Boolean(target.npc)
  };
}

export class CombatStats {
  constructor(storage = null) {
    this.storage = storage;
    this.history = [];
    this.favorites = new Map();
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;
    const saved = await this.storage?.get?.(STORAGE_KEY, {}) ?? {};
    this.history = Array.isArray(saved.history) ? saved.history.slice(0, 100) : [];
    this.favorites = new Map((Array.isArray(saved.favorites) ? saved.favorites : [])
      .filter((target) => target?.id != null)
      .map((target) => [String(target.id), target]));
    this.loaded = true;
  }

  persist() {
    return this.storage?.set?.(STORAGE_KEY, {
      history: this.history,
      favorites: [...this.favorites.values()]
    });
  }

  record(snapshot, summary, formation = '') {
    if (!snapshot?.target?.id || !summary) return false;
    const target = compactTarget(snapshot.target);
    const previous = this.history[0];
    const signature = `${target.id}:${formation}`;
    const entry = {
      at: Date.now(),
      signature,
      target,
      attacker: compactTarget(snapshot.attacker),
      cpCost: Number(snapshot.cpCost ?? 0),
      summary: {
        cyRemaining: summary.cyRemaining,
        dfRemaining: summary.dfRemaining,
        defenderRemaining: Number(summary.defenderRemaining ?? 100),
        ownRemaining: Number(summary.ownRemaining ?? 100),
        repairSeconds: Number(summary.repairSeconds ?? 0),
        loot: Number(summary.loot ?? 0),
        research: Number(summary.research ?? 0),
        durationSeconds: Number(summary.durationSeconds ?? 0)
      }
    };
    if (previous?.signature === signature
      && Math.abs(Number(previous.at) - entry.at) < 15000) {
      this.history[0] = entry;
    } else {
      this.history.unshift(entry);
      this.history.length = Math.min(this.history.length, 100);
    }
    void this.persist();
    return true;
  }

  toggleFavorite(target) {
    if (!target?.id) return false;
    const key = String(target.id);
    if (this.favorites.has(key)) this.favorites.delete(key);
    else this.favorites.set(key, compactTarget(target));
    void this.persist();
    return this.favorites.has(key);
  }

  isFavorite(target) {
    return target?.id != null && this.favorites.has(String(target.id));
  }

  clearHistory() {
    this.history = [];
    void this.persist();
  }

  rows() {
    return this.history.map((entry) => [
      new Date(entry.at).toLocaleString(),
      entry.target?.name ?? 'Unknown',
      entry.cpCost ?? 0,
      Math.round(entry.summary?.loot ?? 0),
      `${Math.round(100 - Number(entry.summary?.defenderRemaining ?? 100))}% damage`
    ]);
  }

  analysisRows(nativeReports = []) {
    const groups = new Map();
    for (const entry of this.history) {
      const key = String(entry.target?.id ?? entry.target?.name ?? 'unknown');
      const group = groups.get(key) ?? { target: entry.target?.name ?? 'Unknown', attacks: 0, kills: 0, cp: 0, loot: 0, rp: 0, repair: 0, damage: 0 };
      group.attacks += 1;
      group.kills += Number(entry.summary?.defenderRemaining ?? 100) <= 0 ? 1 : 0;
      group.cp += Number(entry.cpCost ?? 0);
      group.loot += Number(entry.summary?.loot ?? 0);
      group.rp += Number(entry.summary?.research ?? 0);
      group.repair += Number(entry.summary?.repairSeconds ?? 0);
      group.damage += Math.max(0, 100 - Number(entry.summary?.defenderRemaining ?? 100));
      groups.set(key, group);
    }
    // Native reports enrich totals even when a simulation was not recorded.
    for (const report of nativeReports) {
      const key = `native:${report.target}`;
      if ([...groups.values()].some((group) => group.target === report.target)) continue;
      const group = groups.get(key) ?? { target: report.target, attacks: 0, kills: 0, cp: 0, loot: 0, rp: 0, repair: 0, damage: 0 };
      group.attacks += 1;
      group.kills += report.destroyed ? 1 : 0;
      group.cp += Number(report.cp ?? 0);
      group.loot += Object.values(report.loot ?? {}).reduce((sum, value) => sum + Number(value || 0), 0);
      group.repair += Number(report.repairSeconds ?? 0);
      groups.set(key, group);
    }
    return [...groups.values()].map((group) => {
      const avgDamage = group.attacks ? group.damage / group.attacks : 0;
      return [
        group.target, group.attacks, group.kills,
        group.attacks ? (group.cp / group.attacks).toFixed(1) : '0',
        Math.round(group.loot), group.cp ? Math.round(group.loot / group.cp) : 0,
        group.attacks ? Math.round(group.rp / group.attacks) : 0,
        group.attacks ? Math.round(group.repair / group.attacks) : 0,
        `${avgDamage.toFixed(1)}%`, avgDamage > 0 ? Math.ceil(100 / avgDamage) : '—',
        group.repair > 0 ? (group.loot / (group.repair / 3600)).toFixed(0) : '—'
      ];
    }).sort((left, right) => Number(right[5]) - Number(left[5]));
  }

  analysisSummary(nativeReports = []) {
    const rows = this.analysisRows(nativeReports);
    const attacks = rows.reduce((sum, row) => sum + Number(row[1]), 0);
    const kills = rows.reduce((sum, row) => sum + Number(row[2]), 0);
    return `${attacks} analyzed attacks · ${kills} target kills · ${rows.length} targets · ranked by loot per CP; `
      + 'estimated hits-to-kill uses average defender damage per simulation.';
  }

  overviewRows(nativeReports = []) {
    // EA's report-tab names describe native folders, not intuitive combat
    // direction. Keep this explicit mapping aligned with the live UI.
    const attacking = (report) => report.category === 'offense' || report.category === 'others';
    const defending = (report) => report.category === 'defense' || report.category === 'forgotten';
    const sections = [
      ['Attacking other players', (report) => report.category === 'others'],
      ['Attacking Forgotten', (report) => report.category === 'offense'],
      ['Defending against Forgotten', (report) => report.category === 'forgotten'],
      ['Defending vs players', (report) => report.category === 'defense'],
      ['All attacks', attacking],
      ['All defense', defending]
    ];
    return sections.map(([name, predicate]) => {
      const reports = nativeReports.filter(predicate);
      const wins = reports.filter((report) => report.won).length;
      const destroyed = reports.filter((report) => report.destroyed).length;
      const cp = reports.reduce((sum, report) => sum + Number(report.cp || 0), 0);
      const loot = reports.reduce((sum, report) => sum
        + Object.values(report.loot ?? {}).reduce((total, value) => total + Number(value || 0), 0), 0);
      const repair = reports.reduce((sum, report) => sum + Number(report.repairSeconds || 0), 0);
      return [
        name, reports.length, wins, reports.length - wins,
        reports.length ? `${(wins / reports.length * 100).toFixed(1)}%` : '—',
        destroyed, cp, Math.round(loot), cp ? Math.round(loot / cp) : 0,
        reports.length ? Math.round(repair / reports.length) : 0
      ];
    });
  }

  overviewSummary(nativeReports = []) {
    const rows = this.overviewRows(nativeReports);
    const attacks = rows.find((row) => row[0] === 'All attacks');
    const defense = rows.find((row) => row[0] === 'All defense');
    return `${nativeReports.length} combat reports analyzed · attacks: ${attacks?.[1] ?? 0} reports / ${attacks?.[4] ?? '—'} success · `
      + `defense: ${defense?.[1] ?? 0} reports / ${defense?.[4] ?? '—'} success.`;
  }

  overviewMatrix(nativeReports = [], baseName = 'All bases') {
    const filtered = baseName === 'All bases'
      ? nativeReports
      : nativeReports.filter((report) => String(report.ownBase) === String(baseName));
    const sections = this.overviewRows(filtered);
    const metrics = [
      ['Combat section', 0], ['Reports', 1], ['Wins', 2], ['Losses', 3],
      ['Success', 4], ['Loot', 7], ['Average repair', 9]
    ];
    return metrics.map(([label, index]) => [label, ...sections.map((section) =>
      index === 9 ? duration(section[index]) : section[index])]);
  }

  exportText() {
    const header = 'Time\tTarget\tCoordinates\tCP\tLoot\tRP\tDefender damage\tOwn damage\tRepair\tDuration';
    const rows = this.history.map((entry) => {
      const summary = entry.summary ?? {};
      return [
        new Date(entry.at).toISOString(),
        entry.target?.name ?? 'Unknown',
        `${entry.target?.x ?? 0}:${entry.target?.y ?? 0}`,
        entry.cpCost ?? 0,
        Math.round(summary.loot ?? 0),
        Math.round(summary.research ?? 0),
        `${Math.round(100 - Number(summary.defenderRemaining ?? 100))}%`,
        `${Math.round(100 - Number(summary.ownRemaining ?? 100))}%`,
        Math.round(summary.repairSeconds ?? 0),
        Math.round(summary.durationSeconds ?? 0)
      ].join('\t');
    });
    return [header, ...rows].join('\n');
  }
}
