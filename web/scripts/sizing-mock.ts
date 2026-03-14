/**
 * CLI: Position Sizing Optimizer (mock mode)
 *
 * Runs the sizing pipeline with mock data only — no external API calls.
 * Prints the resulting DailyPositionConfig as formatted JSON.
 *
 * Usage: npm run sizing:mock
 */

import { optimizePositionSizingMock } from '../src/strategies/position-sizing-optimizer.ts';

const config = await optimizePositionSizingMock(1_000, false);
console.log(JSON.stringify(config, null, 2));
