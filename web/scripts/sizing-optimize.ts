/**
 * CLI: Position Sizing Optimizer (live mode)
 *
 * Runs the full sizing pipeline, calling external APIs for regime detection.
 * Saves result to data/daily-position-config.json and prints to stdout.
 *
 * Usage: npm run sizing:optimize
 */

import { optimizePositionSizing } from '../src/strategies/position-sizing-optimizer.ts';

const config = await optimizePositionSizing([], 1_000, true);
console.log(JSON.stringify(config, null, 2));
