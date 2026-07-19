import { COMPATIBILITY_RULES } from './compatibilityRules.js';

export class CompatibilityDetector {
  constructor({ logger, rules = COMPATIBILITY_RULES }) {
    this.logger = logger;
    this.rules = rules;
  }

  evaluate(environment, version) {
    const results = this.rules.map((rule) => {
      let passed = false;
      let error = null;

      try {
        passed = Boolean(rule.test(environment));
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }

      return Object.freeze({
        id: rule.id,
        required: rule.required,
        passed,
        message: passed ? null : rule.message,
        error
      });
    });

    const blockingFailures = results.filter(
      (result) => result.required && !result.passed
    );

    const report = Object.freeze({
      compatible: blockingFailures.length === 0,
      version,
      results: Object.freeze(results),
      blockingFailures: Object.freeze(blockingFailures)
    });

    if (!report.compatible) {
      this.logger.error('Game compatibility check failed.', blockingFailures);
    } else {
      this.logger.info('Game compatibility check passed.');
    }

    return report;
  }
}
