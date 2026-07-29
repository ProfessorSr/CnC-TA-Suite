import test from 'node:test';
import assert from 'node:assert/strict';
import { NextMCVCalculator } from '../../modules/next-mcv/nextMCVCalculator.js';

test('NextMCVCalculator derives progress percentages from current and required totals', () => {
  const context = {
    hub: {
      snapshot: () => ({
        player: {
          credits: { current: 3_000_000, growthPerHour: 100_000 },
          research: { current: 2_375_000 },
          nextMCV: {
            creditsRequired: 12_000_000,
            researchRequired: 9_500_000,
            creditsRemaining: 9_000_000,
            researchRemaining: 7_125_000
          }
        }
      })
    }
  };

  const result = NextMCVCalculator.readHub(context);

  assert.equal(result.credits.percent, 25);
  assert.equal(result.research.percent, 25);
  assert.equal(result.overallPercent, 25);
  assert.equal(result.credits.remaining, 9_000_000);
  assert.equal(result.research.remaining, 7_125_000);
});

test('NextMCVCalculator averages credit and research progress', () => {
  const result = NextMCVCalculator.readHub({
    hub: {
      snapshot: () => ({
        player: {
          credits: { current: 12_000_000 },
          research: { current: 2_755_000 },
          nextMCV: {
            creditsRequired: 12_000_000,
            researchRequired: 9_500_000
          }
        }
      })
    }
  });

  assert.equal(result.credits.percent, 100);
  assert.equal(result.research.percent, 29);
  assert.equal(result.overallPercent, 64.5);
});
