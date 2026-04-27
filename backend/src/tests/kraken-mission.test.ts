import { describe, it, expect, beforeAll, spyOn } from 'bun:test';
import { db } from '../lib/db';
import * as tradingLoop from '../services/agent-trading-loop';
import { getPnL } from '../services/kraken-cli.service';
import * as krakenService from '../services/kraken-cli.service';

/**
 * Kraken Mission E2E Test
 * Validates the full autonomous pipeline: Signal -> Decision -> Execution -> PnL
 */
describe('Kraken Mission Pipeline', () => {
  
  beforeAll(async () => {
    // Ensure we are in sandbox mode for tests
    process.env.KRAKEN_SANDBOX_MODE = 'true';
    process.env.TRADING_MIN_CONFIDENCE = '10';
  });

  it('should execute a full trading cycle and generate PnL', async () => {
    console.log('🚀 Starting Mission Validation...');

    // 1. Mock "High Alpha" Kraken Tickers
    const mockTickers: krakenService.KrakenTickerData[] = [
      {
        pair: 'XBTUSD',
        displayPair: 'BTC/USD',
        price: 65000,
        bid: 64990,
        ask: 65010,
        volume24h: 12000, // High volume for scalper
        vwap24h: 64500,
        trades24h: 5000,
        low24h: 63000,
        high24h: 66000,
        openPrice24h: 64000,
      }
    ];

    spyOn(krakenService, 'getTickerData').mockImplementation(async () => mockTickers);

    // 2. Mock Agent Selection to guarantee a trader is picked
    const testAgent = await db.tradingAgent.findFirst({
      where: { archetypeId: 'scalper' }
    }) || await db.tradingAgent.findFirst({
      where: { status: 'ACTIVE' }
    });

    if (!testAgent) throw new Error('No agents found in DB for testing');
    
    // We need to use @ts-ignore because we're spying on a private-ish function or module level
    // @ts-ignore
    spyOn(tradingLoop, 'selectRandomAgents').mockImplementation(async () => [testAgent]);

    // 3. Check Initial State
    const initialTradeCount = await db.paperTrade.count({
      where: { signalSource: 'kraken_trading_loop' }
    });

    console.log(`Initial Stats: Trades=${initialTradeCount}`);

    // 4. Trigger Autonomous Cycle
    await tradingLoop.triggerManualCycle({
      agentsPerCycle: 1,
      minConfidence: 10,
      maxTradesPerCycle: 1
    });

    // 5. Verify Trade Creation
    const midTradeCount = await db.paperTrade.count({
      where: { signalSource: 'kraken_trading_loop' }
    });
    
    expect(midTradeCount).toBeGreaterThan(initialTradeCount);
    console.log(`✅ Entry Phase Complete: ${midTradeCount - initialTradeCount} new trades created.`);

    // 6. Verify ERC-8004 Alignment
    const latestTrade = await db.paperTrade.findFirst({
      where: { signalSource: 'kraken_trading_loop' },
      orderBy: { openedAt: 'desc' },
      include: { agent: true }
    });

    expect(latestTrade?.id).toBeDefined();
    console.log(`✅ Trust Phase Complete: Trade ${latestTrade?.id} anchored to Agent ${latestTrade?.agent.displayName}`);

    // 7. Simulate Position Exit
    const exitPrice = Number(latestTrade?.entryPrice) * 1.05;
    await tradingLoop.closeAgentPosition(latestTrade, exitPrice, 5.0);

    // 8. Verify Final PnL Report
    const finalPnl = await getPnL();
    console.log(`Final Stats: PnL=$${finalPnl.totalPnlUsd}, Trades=${finalPnl.trades.length}`);
    
    expect(finalPnl.trades.length).toBeGreaterThan(0);
    expect(finalPnl.trades.some(t => t.pnlUsd > 0)).toBe(true);

    console.log('🎯 Mission Validation Successful.');
  });
});
