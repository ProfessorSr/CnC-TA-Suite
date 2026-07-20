function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function text(value, fallback = '') { return value == null ? fallback : String(value); }

export function normalizeReport(raw = {}) {
  const loot = raw.loot ?? raw.Loot ?? {};
  const damage = raw.damage ?? raw.Damage ?? {};
  const losses = raw.losses ?? raw.Losses ?? {};
  const at = number(raw.at ?? raw.time ?? raw.Timestamp ?? raw.Date ?? Date.now());
  const opponent = text(raw.opponent ?? raw.target ?? raw.TargetName ?? raw.DefenderName, 'Unknown');
  const ownBase = text(raw.ownBase ?? raw.base ?? raw.AttackerBaseName ?? raw.CityName, 'Unknown');
  const pvp = Boolean(raw.pvp ?? raw.isPvp ?? raw.IsPvP ?? raw.PlayerReport);
  return Object.freeze({
    id: text(raw.id ?? raw.Id ?? `${at}:${opponent}`), at, opponent, ownBase,
    type: text(raw.type ?? raw.Type ?? (pvp ? 'PvP' : 'PvE')), pvp,
    won: Boolean(raw.won ?? raw.victory ?? raw.Won), destroyed: Boolean(raw.destroyed ?? raw.Destroyed),
    cp: number(raw.cp ?? raw.commandPoints ?? raw.Cost), repairSeconds: number(raw.repairSeconds ?? raw.RepairTime),
    deathRepairSeconds: number(raw.deathRepairSeconds ?? raw.DestroyedBaseRepairTime),
    score: number(raw.score ?? raw.Score), loot: Object.freeze({
      tiberium: number(loot.tiberium ?? loot.Tiberium), crystal: number(loot.crystal ?? loot.Crystal),
      credits: number(loot.credits ?? loot.Credits), research: number(loot.research ?? loot.ResearchPoints)
    }),
    damage: Object.freeze({ offense: number(damage.offense), defense: number(damage.defense), structures: number(damage.structures) }),
    losses: Object.freeze({ infantry: number(losses.infantry), vehicle: number(losses.vehicle), aircraft: number(losses.aircraft) })
  });
}

export function filterReports(reports, filters = {}) {
  const from = filters.from ? new Date(filters.from).getTime() : -Infinity;
  const to = filters.to ? new Date(filters.to).getTime() + 86400000 : Infinity;
  const query = text(filters.query).trim().toLowerCase();
  return reports.filter((report) => report.at >= from && report.at < to
    && (!filters.type || filters.type === 'All' || report.type === filters.type)
    && (!query || `${report.opponent} ${report.ownBase}`.toLowerCase().includes(query)));
}

export function aggregateReports(reports) {
  const totals = { attacks: reports.length, wins: 0, kills: 0, pvp: 0, pve: 0, cp: 0, repairSeconds: 0, score: 0,
    loot: { tiberium: 0, crystal: 0, credits: 0, research: 0 },
    damage: { offense: 0, defense: 0, structures: 0 }, losses: { infantry: 0, vehicle: 0, aircraft: 0 } };
  for (const report of reports) {
    totals.wins += report.won ? 1 : 0; totals.kills += report.destroyed ? 1 : 0;
    totals[report.pvp ? 'pvp' : 'pve'] += 1; totals.cp += report.cp; totals.repairSeconds += report.repairSeconds; totals.score += report.score;
    for (const key of Object.keys(totals.loot)) totals.loot[key] += report.loot[key];
    for (const key of Object.keys(totals.damage)) totals.damage[key] += report.damage[key];
    for (const key of Object.keys(totals.losses)) totals.losses[key] += report.losses[key];
  }
  totals.totalLoot = Object.values(totals.loot).reduce((sum, value) => sum + value, 0);
  totals.lootPerCp = totals.cp > 0 ? totals.totalLoot / totals.cp : 0;
  totals.winRate = totals.attacks ? totals.wins / totals.attacks : 0;
  return totals;
}

export function targetTrends(reports) {
  const targets = new Map();
  for (const report of reports) {
    const entry = targets.get(report.opponent) ?? { target: report.opponent, attacks: 0, wins: 0, loot: 0, repairSeconds: 0, lastAt: 0 };
    entry.attacks += 1; entry.wins += report.won ? 1 : 0;
    entry.loot += Object.values(report.loot).reduce((sum, value) => sum + value, 0);
    entry.repairSeconds += report.repairSeconds; entry.lastAt = Math.max(entry.lastAt, report.at);
    targets.set(report.opponent, entry);
  }
  return [...targets.values()].sort((a, b) => b.lastAt - a.lastAt);
}
