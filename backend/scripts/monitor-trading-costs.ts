/**
 * Trading Cost Monitor
 * 
 * Analyzes trading costs and alerts if fees exceed target.
 * Tracks:
 * - Total volume
 * - Total fees
 * - Average fee percentage
 * - Costs by agent
 * - Cost breakdown (priority, network, swap)
 * 
 * Usage:
 *   bun run scripts/monitor-trading-costs.ts [hours]
 *   
 * Examples:
 *   bun run scripts/monitor-trading-costs.ts      # Last 24 hours
 *   bun run scripts/monitor-trading-costs.ts 1    # Last 1 hour
 *   bun run scripts/monitor-trading-costs.ts 168  # Last 7 days
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cost targets
const TARGET_FEE_PERCENT = 1.0;  // <1% target
const WARNING_FEE_PERCENT = 0.75; // Warn at 0.75%

interface CostMetrics {
  totalTrades: number;
  totalVolumeSol: number;
  totalFeesSol: number;
  avgFeePerTrade: number;
  avgFeePercent: number;
  priorityFeesTotal: number;
  swapFeesTotal: number;
  byAgent: Array<{
    agentId: string;
    trades: number;
    volume: number;
    fees: number;
    avgFee: number;
    avgFeePercent: number;
  }>;
  byAction: {
    buy: { count: number; volume: number; fees: number };
    sell: { count: number; volume: number; fees: number };
  };
}

async function analyzeCosts(sinceHours: number): Promise<CostMetrics> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  // Query all trades since timestamp
  const trades = await prisma.agentTrade.findMany({
    where: {
      createdAt: {
        gte: since
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (trades.length === 0) {
    return {
      totalTrades: 0,
      totalVolumeSol: 0,
      totalFeesSol: 0,
      avgFeePerTrade: 0,
      avgFeePercent: 0,
      priorityFeesTotal: 0,
      swapFeesTotal: 0,
      byAgent: [],
      byAction: {
        buy: { count: 0, volume: 0, fees: 0 },
        sell: { count: 0, volume: 0, fees: 0 }
      }
    };
  }

  // Calculate overall metrics
  const totalVolumeSol = trades.reduce((sum, t) => sum + parseFloat(t.solAmount.toString()), 0);
  const totalFeesSol = trades.reduce((sum, t) => sum + parseFloat(t.totalFees?.toString() || '0'), 0);
  const avgFeePercent = totalVolumeSol > 0 ? (totalFeesSol / totalVolumeSol) * 100 : 0;

  const priorityFeesTotal = trades.reduce((sum, t) => sum + (t.priorityFee || 0), 0) / 1e9; // Convert lamports to SOL
  const swapFeesTotal = trades.reduce((sum, t) => sum + parseFloat(t.swapFee?.toString() || '0'), 0);

  // Group by agent
  const agentMap = new Map<string, any>();
  trades.forEach(trade => {
    const agentId = trade.agentId;
    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, { agentId, trades: 0, volume: 0, fees: 0 });
    }
    const stats = agentMap.get(agentId);
    stats.trades++;
    stats.volume += parseFloat(trade.solAmount.toString());
    stats.fees += parseFloat(trade.totalFees?.toString() || '0');
  });

  const byAgent = Array.from(agentMap.values()).map(a => ({
    ...a,
    avgFee: a.fees / a.trades,
    avgFeePercent: (a.fees / a.volume) * 100
  }));

  // Group by action
  const buyTrades = trades.filter(t => t.action === 'BUY');
  const sellTrades = trades.filter(t => t.action === 'SELL');

  const byAction = {
    buy: {
      count: buyTrades.length,
      volume: buyTrades.reduce((sum, t) => sum + parseFloat(t.solAmount.toString()), 0),
      fees: buyTrades.reduce((sum, t) => sum + parseFloat(t.totalFees?.toString() || '0'), 0)
    },
    sell: {
      count: sellTrades.length,
      volume: sellTrades.reduce((sum, t) => sum + parseFloat(t.solAmount.toString()), 0),
      fees: sellTrades.reduce((sum, t) => sum + parseFloat(t.totalFees?.toString() || '0'), 0)
    }
  };

  return {
    totalTrades: trades.length,
    totalVolumeSol,
    totalFeesSol,
    avgFeePerTrade: totalFeesSol / trades.length,
    avgFeePercent,
    priorityFeesTotal,
    swapFeesTotal,
    byAgent,
    byAction
  };
}

async function monitorCosts(hours: number) {
  console.log('📊 Trading Cost Analysis\n');
  console.log('='.repeat(70));
  console.log(`Period: Last ${hours} hour${hours === 1 ? '' : 's'}`);
  console.log('='.repeat(70));

  const metrics = await analyzeCosts(hours);

  if (metrics.totalTrades === 0) {
    console.log('\n❌ No trades found in this period.');
    return;
  }

  // Overall metrics
  console.log('\n📈 Overall Metrics:');
  console.log(`  Total Trades:        ${metrics.totalTrades}`);
  console.log(`  Total Volume:        ${metrics.totalVolumeSol.toFixed(4)} SOL`);
  console.log(`  Total Fees:          ${metrics.totalFeesSol.toFixed(6)} SOL`);
  console.log(`  Avg Fee/Trade:       ${metrics.avgFeePerTrade.toFixed(6)} SOL`);
  console.log(`  Avg Fee %:           ${metrics.avgFeePercent.toFixed(2)}%`);

  // Alert if exceeding target
  if (metrics.avgFeePercent > TARGET_FEE_PERCENT) {
    console.log(`  🔴 ALERT: Fees exceed ${TARGET_FEE_PERCENT}% target!`);
  } else if (metrics.avgFeePercent > WARNING_FEE_PERCENT) {
    console.log(`  🟡 WARNING: Fees approaching ${TARGET_FEE_PERCENT}% target`);
  } else {
    console.log(`  ✅ Fees within ${TARGET_FEE_PERCENT}% target`);
  }

  // Fee breakdown
  console.log('\n💰 Fee Breakdown:');
  console.log(`  Priority Fees:       ${metrics.priorityFeesTotal.toFixed(6)} SOL (${((metrics.priorityFeesTotal / metrics.totalFeesSol) * 100).toFixed(1)}%)`);
  console.log(`  Swap Fees:           ${metrics.swapFeesTotal.toFixed(6)} SOL (${((metrics.swapFeesTotal / metrics.totalFeesSol) * 100).toFixed(1)}%)`);
  console.log(`  Network Fees (est):  ${(metrics.totalFeesSol - metrics.priorityFeesTotal - metrics.swapFeesTotal).toFixed(6)} SOL`);

  // By action
  console.log('\n📊 By Action:');
  console.log(`  BUY Trades:          ${metrics.byAction.buy.count} (${metrics.byAction.buy.volume.toFixed(4)} SOL volume, ${metrics.byAction.buy.fees.toFixed(6)} SOL fees)`);
  console.log(`  SELL Trades:         ${metrics.byAction.sell.count} (${metrics.byAction.sell.volume.toFixed(4)} SOL volume, ${metrics.byAction.sell.fees.toFixed(6)} SOL fees)`);

  // By agent
  if (metrics.byAgent.length > 0) {
    console.log('\n🤖 By Agent:');
    metrics.byAgent
      .sort((a, b) => b.fees - a.fees)
      .forEach(agent => {
        const status = agent.avgFeePercent > TARGET_FEE_PERCENT ? '🔴' :
                       agent.avgFeePercent > WARNING_FEE_PERCENT ? '🟡' : '✅';
        console.log(`  ${status} ${agent.agentId.padEnd(25)} ${agent.trades} trades, ${agent.fees.toFixed(6)} SOL fees (${agent.avgFeePercent.toFixed(2)}%)`);
      });
  }

  console.log('\n' + '='.repeat(70));

  // Recommendations
  if (metrics.avgFeePercent > WARNING_FEE_PERCENT) {
    console.log('\n💡 Recommendations:');
    if (metrics.priorityFeesTotal / metrics.totalFeesSol > 0.3) {
      console.log('  - Priority fees are high - consider lowering initial priority fee');
    }
    if (metrics.swapFeesTotal / metrics.totalFeesSol > 0.7) {
      console.log('  - Swap fees are high - Jupiter taking large cut (normal for small trades)');
    }
    console.log('  - Consider larger trade sizes to amortize fixed costs');
  }

  console.log();
}

async function main() {
  const hours = parseInt(process.argv[2] || '24');
  await monitorCosts(hours);
  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
