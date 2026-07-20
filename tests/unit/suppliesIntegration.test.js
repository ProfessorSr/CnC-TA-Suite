import assert from 'node:assert/strict';
import test from 'node:test';
import { SuppliesIntegration } from '../../modules/resource-transfer/supplies-integration.js';

test('SuppliesIntegration does not construct ShopOverlay during module bootstrap', () => {
  const original = globalThis.webfrontend;
  let constructions = 0;
  globalThis.webfrontend = {
    gui: { monetization: { ShopOverlay: { getInstance() { constructions += 1; return null; } } } }
  };
  try {
    const integration = new SuppliesIntegration({
      logger: { debug() {} },
      moduleSettings: { get(_key, fallback) { return fallback; } }
    });
    assert.equal(integration.install(), false);
    assert.equal(constructions, 0);
  } finally {
    globalThis.webfrontend = original;
  }
});

test('SuppliesIntegration reports a not-ready overlay without leaking constructor errors', () => {
  const original = globalThis.webfrontend;
  globalThis.webfrontend = {
    gui: { monetization: { ShopOverlay: { getInstance() { throw new Error('recursive constructor'); } } } }
  };
  try {
    const integration = new SuppliesIntegration({
      logger: { debug() {} },
      moduleSettings: { get(_key, fallback) { return fallback; } }
    });
    assert.throws(() => integration.open(), /still loading/);
  } finally {
    globalThis.webfrontend = original;
  }
});
