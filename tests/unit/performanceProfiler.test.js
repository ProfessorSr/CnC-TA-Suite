import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceProfiler } from '../../core/performance/performanceProfiler.js';

test('Performance profiler aggregates timings and records budget violations', () => {
  const profiler = new PerformanceProfiler({ limits: { scan: 10 } });
  profiler.record('scan', 5);
  profiler.record('scan', 15);
  profiler.record('scan', 16);
  assert.equal(profiler.snapshot().violations.length, 0);
  profiler.record('scan', 17);
  const snapshot = profiler.snapshot();
  assert.equal(snapshot.operations.scan.count, 4);
  assert.equal(snapshot.operations.scan.overBudgetSamples, 3);
  assert.equal(snapshot.violations.length, 1);
  assert.equal(snapshot.violations[0].consecutiveBreaches, 3);
});
