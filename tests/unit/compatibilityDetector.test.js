import { CompatibilityDetector } from '../../core/game/compatibility/compatibilityDetector.js';

export function runCompatibilityDetectorUnitTest() {
  const detector = new CompatibilityDetector({
    logger: {
      info() {},
      error() {}
    },
    rules: [
      {
        id: 'required-pass',
        required: true,
        test: () => true,
        message: 'Should pass.'
      },
      {
        id: 'optional-fail',
        required: false,
        test: () => false,
        message: 'Optional failure.'
      }
    ]
  });

  const report = detector.evaluate({}, { normalized: 'test' });

  if (!report.compatible) {
    throw new Error('Optional compatibility failures must not block startup.');
  }

  return true;
}
