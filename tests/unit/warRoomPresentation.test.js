import test from 'node:test';
import assert from 'node:assert/strict';
import { ArmyAnalyzer } from '../../modules/war-room/army-analyzer.js';
import { ReportSummary } from '../../modules/war-room/report-summary.js';
import { WarRoomHub } from '../../modules/war-room/war-room-hub.js';

test('War Room presents ratio health as a percentage', () => {
  const rows = ArmyAnalyzer.rows({
    units: [{ name: 'Pitbull', level: 20, health: 1, x: 2, y: 1, group: 'vehicle' }]
  });
  assert.equal(rows[0][2], '100%');
});

test('War Room report summary resolves ClientLib resource names', () => {
  const rows = ReportSummary.rows({
    resourceTypes: { Tiberium: 1, Crystal: 2, Gold: 3, ResearchPoints: 4 },
    loot: { 1: 100, 2: 200, 3: 300, 4: 400 },
    repair: { infantry: 0, vehicle: 0, aircraft: 0 }
  });
  assert.deepEqual(rows.slice(0, 4).map(([name]) => name), [
    'Tiberium', 'Crystal', 'Credits', 'Research Points'
  ]);
});

test('War Room accepts Qooxdoo-shaped native simulation event collections', async () => {
  const originalWebfrontend = globalThis.webfrontend;
  const hub = new WarRoomHub({ hub: {} });
  hub.snapshot = () => ({ target: { id: 22 }, attacker: { id: 11 } });
  const event = { Key: 1, Value: { h: 100 } };
  const communication = {
    SendSimpleCommand(_name, _payload, callback) {
      callback(null, { d: { s: [], d: [], a: [] }, e: { l: [event] } });
    }
  };
  hub.clientLib = () => ({
    root: {
      Net: {
        CommunicationManager: { GetInstance: () => communication },
        CommandResult: {}
      }
    }
  });
  globalThis.webfrontend = {
    phe: { cnc: { Util: { createEventDelegate: (_type, receiver, method) => method.bind(receiver) } } }
  };
  try {
    const result = await hub.simulateFormation([
      { entityId: 7, enabled: true, health: 100, x: 2, y: 1 }
    ]);
    assert.deepEqual(result.e, [event]);
  } finally {
    globalThis.webfrontend = originalWebfrontend;
  }
});
