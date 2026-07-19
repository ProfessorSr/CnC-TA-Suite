import assert from 'node:assert/strict';
import { CacheManager } from '../../core/game/cache/cacheManager.js';

const cache = new CacheManager({ defaultTtl: 100 });
cache.set('player:one', 1);
assert.equal(cache.get('player:one'), 1);
assert.equal(cache.invalidate('player'), 1);
assert.equal(cache.get('player:one'), undefined);
assert.equal(cache.snapshot().metrics.hits, 1);
console.log('cacheManager.test.js passed');
