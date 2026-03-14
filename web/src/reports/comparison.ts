/**
 * Strategy Comparison CLI Entry Point
 *
 * Usage:
 *   npm run comparison           # Live mode (reads data/paper-positions.json)
 *   npm run comparison:mock      # Mock mode (built-in synthetic trades, no external calls)
 *
 * @module
 */

import { compareStrategies, formatComparison } from './strategy-comparison.ts';

/**
 * Main entry point for the comparison CLI.
 */
async function main(): Promise<void> {
  const mock = process.env['MOCK_DATA'] === 'true';

  if (mock) {
    console.error('\n[comparison] Running in MOCK mode — no external API calls\n');
  }

  try {
    const report = await compareStrategies();
    console.log(formatComparison(report));
  } catch (err) {
    console.error('[comparison] Fatal error generating report:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
