import test from 'node:test';
import assert from 'node:assert/strict';
import { CityService } from '../../core/game/city/cityService.js';
import { PerformanceProfiler } from '../../core/performance/performanceProfiler.js';

test('city normalization remains inside the large-account performance budget', () => {
  const cities = Array.from({ length: 500 }, (_, id) => ({
    get_Id: () => id, get_Name: () => `Base ${id}`, get_LvlBase: () => 50,
    get_X: () => id % 100, get_Y: () => Math.floor(id / 100)
  }));
  const profiler = new PerformanceProfiler({ limits: { 'city.normalize-all': 25 } });
  const service = new CityService({
    clientLib: { getCities: () => ({}), call(target, names) { for (const name of names) if (typeof target?.[name] === 'function') return target[name](); return null; } },
    cache: { get(key, getter) { return key === 'city:all:raw' ? cities : getter(); }, invalidate() {} },
    performance: profiler
  });
  assert.equal(service.all().length, 500);
  assert.equal(profiler.snapshot().violations.length, 0);
});
