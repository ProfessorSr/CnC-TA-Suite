import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReport, filterReports, aggregateReports, targetTrends } from '../../modules/combat-reports/report-analytics.js';

test('combat report analytics filters and aggregates PvP/PvE history', () => {
  const reports = [
    normalizeReport({ id: 1, at: Date.UTC(2026, 6, 20), opponent: 'Alpha', ownBase: 'Home', pvp: true, won: true, destroyed: true, cp: 10, repairSeconds: 100, loot: { tiberium: 1000, research: 500 } }),
    normalizeReport({ id: 2, at: Date.UTC(2026, 6, 19), opponent: 'Beta', ownBase: 'Home', pvp: false, won: false, cp: 5, repairSeconds: 50, loot: { crystal: 250 } })
  ];
  assert.equal(filterReports(reports, { query: 'alpha' }).length, 1);
  const totals = aggregateReports(reports);
  assert.equal(totals.attacks, 2);
  assert.equal(totals.pvp, 1);
  assert.equal(totals.pve, 1);
  assert.equal(totals.totalLoot, 1750);
  assert.equal(targetTrends(reports)[0].target, 'Alpha');
});
