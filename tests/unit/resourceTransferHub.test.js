import test from 'node:test';
import assert from 'node:assert/strict';
import { ResourceTransferHub } from '../../modules/resource-transfer/resource-transfer-hub.js';
import { ResourceTransferModule, normalizeQuickTransferProfile } from '../../modules/resource-transfer/index.js';

test('Resource Transfer normalizes destination-specific quick profiles', () => {
  assert.deepEqual(normalizeQuickTransferProfile({ mode: 'crystal' }), {
    mode: 'crystal', customTiberium: 100, customCrystal: 100,
    tiberiumPercent: 0, crystalPercent: 100
  });
  assert.deepEqual(normalizeQuickTransferProfile({ mode: 'custom', tiberiumPercent: 25, crystalPercent: 75 }), {
    mode: 'custom', customTiberium: 25, customCrystal: 75,
    tiberiumPercent: 25, crystalPercent: 75
  });
});

test('Resource Transfer builds quick plans from the current base profile', () => {
  const module = new ResourceTransferModule();
  module.context = {
    moduleSettings: {
      get: () => ({ home: { mode: 'custom', tiberiumPercent: 20, crystalPercent: 65 } })
    }
  };
  const calls = [];
  module.hub = {
    snapshot: () => ({ currentDestinationId: 'home', cities: [{ id: 'home' }, { id: 'source' }] }),
    plan: (options) => {
      calls.push(options);
      return { ...options, destination: { name: 'Home' }, entries: [], totalAmount: 0, totalCost: 0, credits: 0 };
    }
  };
  const plans = module.quickTransferPlans();
  assert.deepEqual(plans.map((plan) => [plan.resourceName, plan.quickPercent]), [
    ['tiberium', 20], ['crystal', 65]
  ]);
  assert.deepEqual(calls.map((call) => call.fraction), [0.2, 0.65]);
});

test('Resource Transfer does not cap transfers at destination storage', () => {
  const hub = new ResourceTransferHub({});
  hub.root = () => ({ Data: { ETradeError: { None: 0 } } });
  hub.snapshot = () => ({
    credits: 1_000_000,
    cities: [
      { id: 'home', name: 'Home', x: 1, y: 1, amount: 990, storage: 1_000, tradeError: 0 },
      {
        id: 'source', name: 'Source', x: 2, y: 2, amount: 500, storage: 1_000, tradeError: 0,
        city: { CalculateTradeCostToCoord: () => 25 }
      }
    ]
  });
  const plan = hub.plan({
    destinationId: 'home', sourceIds: ['source'], resourceName: 'tiberium', fraction: 1
  });
  assert.equal(plan.totalAmount, 500);
  assert.equal(plan.entries[0].amount, 500);
  assert.equal(plan.remainingCapacity, null);
  assert.equal(plan.storageLimitIgnored, true);
});

test('Resource Transfer submits SelfTrade commands sequentially with native callbacks', async () => {
  const originalWebfrontend = globalThis.webfrontend;
  const calls = [];
  let active = 0;
  let maximumActive = 0;
  const manager = {
    SendCommand(name, payload, callback) {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      calls.push({ name, payload });
      setTimeout(() => {
        active -= 1;
        callback(null, 0);
      }, 1);
    }
  };
  const hub = new ResourceTransferHub({});
  hub.root = () => ({
    Base: { EResourceType: { Tiberium: 1 }, EErrorCode: { Success: 0 } },
    Net: { CommunicationManager: { GetInstance: () => manager }, CommandResult: {} }
  });
  globalThis.webfrontend = {
    phe: { cnc: { Util: { createEventDelegate: (_type, receiver, method) => method.bind(receiver) } } }
  };
  const city = (id) => ({ get_Id: () => id });
  const destination = { name: 'Home', city: city(10) };
  const plan = {
    affordable: true,
    resourceName: 'tiberium',
    destination,
    entries: [
      { eligible: true, amount: 100, source: { name: 'Alpha', city: city(11) }, destination },
      { eligible: true, amount: 200, source: { name: 'Beta', city: city(12) }, destination }
    ]
  };
  try {
    const accepted = await hub.execute(plan);
    assert.equal(accepted.length, 2);
    assert.equal(calls.length, 2);
    assert.equal(maximumActive, 1);
    assert.deepEqual(calls.map((item) => item.payload.sourceCityId), [11, 12]);
  } finally {
    globalThis.webfrontend = originalWebfrontend;
  }
});
