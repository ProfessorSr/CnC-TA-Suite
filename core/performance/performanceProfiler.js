export class PerformanceProfiler {
  constructor({ limits = {}, sampleLimit = 200, violationThreshold = 3, logger } = {}) {
    this.limits = { ...limits };
    this.sampleLimit = sampleLimit;
    this.logger = logger;
    this.violationThreshold = Math.max(1, Number(violationThreshold) || 3);
    this.samples = new Map();
    this.violations = [];
    this.breachState = new Map();
  }

  measure(name, operation) {
    const started = globalThis.performance?.now?.() ?? Date.now();
    try { return operation(); }
    finally { this.record(name, (globalThis.performance?.now?.() ?? Date.now()) - started); }
  }

  async measureAsync(name, operation) {
    const started = globalThis.performance?.now?.() ?? Date.now();
    try { return await operation(); }
    finally { this.record(name, (globalThis.performance?.now?.() ?? Date.now()) - started); }
  }

  record(name, durationMs) {
    const duration = Number(durationMs) || 0;
    const list = this.samples.get(name) ?? [];
    list.push(duration);
    if (list.length > this.sampleLimit) list.shift();
    this.samples.set(name, list);
    const budget = this.limits[name];
    if (Number.isFinite(budget) && duration > budget) {
      const state = this.breachState.get(name) ?? { consecutive: 0, alerted: false };
      state.consecutive += 1;
      if (state.consecutive >= this.violationThreshold && !state.alerted) {
        state.alerted = true;
        const violation = Object.freeze({
          name, durationMs: duration, budgetMs: budget,
          consecutiveBreaches: state.consecutive, threshold: this.violationThreshold, at: Date.now()
        });
        this.violations.push(violation);
        if (this.violations.length > 100) this.violations.shift();
        this.logger?.warn?.(`Sustained performance budget exceeded: ${name}`, violation);
      }
      this.breachState.set(name, state);
    } else if (Number.isFinite(budget)) {
      this.breachState.set(name, { consecutive: 0, alerted: false });
    }
    return duration;
  }

  snapshot() {
    const operations = {};
    for (const [name, samples] of this.samples) {
      const sorted = [...samples].sort((a, b) => a - b);
      const total = samples.reduce((sum, value) => sum + value, 0);
      operations[name] = Object.freeze({
        count: samples.length,
        averageMs: samples.length ? total / samples.length : 0,
        maxMs: sorted.at(-1) ?? 0,
        p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
        budgetMs: this.limits[name] ?? null,
        overBudgetSamples: Number.isFinite(this.limits[name])
          ? samples.filter((value) => value > this.limits[name]).length : 0,
        consecutiveBreaches: this.breachState.get(name)?.consecutive ?? 0
      });
    }
    return Object.freeze({ operations: Object.freeze(operations), violations: Object.freeze([...this.violations]) });
  }
}
