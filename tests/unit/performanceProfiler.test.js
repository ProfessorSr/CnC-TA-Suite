import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceProfiler } from '../../core/performance/performanceProfiler.js';

test('Performance profiler aggregates timings and records budget violations', () => {
  const profiler = new PerformanceProfiler({ limits: { scan: 10 } });
  profiler.record('scan', 5); profiler.record('scan', 15);
  const snapshot = profiler.snapshot();
  assert.equal(snapshot.operations.scan.count, 2);
  assert.equal(snapshot.operations.scan.averageMs, 10);
  assert.equal(snapshot.violations.length, 1);
});
