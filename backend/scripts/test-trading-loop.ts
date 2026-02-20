/**
 * Test Trading Loop
 * 
 * Manually trigger one trading cycle to test the autonomous trading system.
 * 
 * Usage:
 *   bun run scripts/test-trading-loop.ts
 * 
 * Options:
 *   --agents=N      Number of agents per cycle (default: 3)
 *   --confidence=N  Minimum confidence threshold (default: 70)
 *   --max-trades=N  Max trades per cycle (default: 5)
 */

import { triggerManualCycle, getTradingLoopStatus } from '../src/services/agent-trading-loop';

async function main() {
  console.log('🧪 Testing Autonomous Trading Loop\n');

  // Parse command line args
  const args = process.argv.slice(2);
  const options: any = {};

  for (const arg of args) {
    if (arg.startsWith('--agents=')) {
      options.agentsPerCycle = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--confidence=')) {
      options.minConfidence = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--max-trades=')) {
      options.maxTradesPerCycle = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--position=')) {
      options.positionSizeSOL = parseFloat(arg.split('=')[1]);
    }
  }

  console.log('Configuration:');
  console.log('  Agents per cycle:', options.agentsPerCycle || 3);
  console.log('  Min confidence:', options.minConfidence || 70);
  console.log('  Max trades per cycle:', options.maxTradesPerCycle || 5);
  console.log('  Position size:', options.positionSizeSOL || 1.5, 'SOL');
  console.log('');

  try {
    // Trigger one manual cycle
    await triggerManualCycle(options);

    // Show status
    const status = getTradingLoopStatus();
    console.log('\n✅ Test complete');
    console.log('Status:', status);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
