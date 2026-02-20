#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function calculatePnL() {
  try {
    console.log('🔍 Finding Henry\'s agent...\n');
    
    // First, find Henry's agent by wallet address
    const henryAgent = await prisma.tradingAgent.findFirst({
      where: {
        evmWalletAddress: {
          contains: '31ySFh'
        }
      }
    });

    if (!henryAgent) {
      console.log('❌ Could not find Henry\'s agent with wallet containing 31ySFh');
      console.log('\n🔍 Searching all agents...');
      
      const allAgents = await prisma.tradingAgent.findMany({
        select: {
          id: true,
          name: true,
          displayName: true,
          evmWalletAddress: true,
          totalTrades: true,
          totalPnl: true,
          winRate: true
        }
      });
      
      console.log(`Found ${allAgents.length} agents:\n`);
      allAgents.forEach(agent => {
        console.log(`- ${agent.displayName || agent.name} (${agent.id})`);
        console.log(`  Wallet: ${agent.evmWalletAddress || 'none'}`);
        console.log(`  Trades: ${agent.totalTrades}, PnL: ${agent.totalPnl}, Win Rate: ${agent.winRate}%\n`);
      });
      
      process.exit(1);
    }

    console.log(`✅ Found agent: ${henryAgent.displayName || henryAgent.name}`);
    console.log(`   ID: ${henryAgent.id}`);
    console.log(`   Wallet: ${henryAgent.evmWalletAddress}`);
    console.log(`   Stored stats: ${henryAgent.totalTrades} trades, ${henryAgent.totalPnl} PnL\n`);

    // Get all trades for this agent
    console.log('📊 Fetching trades from AgentTrade table...\n');
    
    const trades = await prisma.agentTrade.findMany({
      where: {
        agentId: henryAgent.id
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`Found ${trades.length} trades in AgentTrade table\n`);

    if (trades.length === 0) {
      console.log('⚠️  No trades found in AgentTrade table. Checking PaperTrade table...\n');
      
      const paperTrades = await prisma.paperTrade.findMany({
        where: {
          agentId: henryAgent.id
        },
        orderBy: {
          openedAt: 'asc'
        }
      });

      console.log(`Found ${paperTrades.length} paper trades\n`);
      
      if (paperTrades.length === 0) {
        console.log('❌ No trades found in either table');
        process.exit(1);
      }

      // Calculate PnL from paper trades
      return calculatePaperTradePnL(paperTrades, henryAgent);
    }

    // Group trades by token and pair buy/sell
    const tradesByToken = new Map<string, any[]>();
    
    trades.forEach(trade => {
      if (!tradesByToken.has(trade.tokenMint)) {
        tradesByToken.set(trade.tokenMint, []);
      }
      tradesByToken.get(trade.tokenMint)!.push(trade);
    });

    console.log(`📈 Analyzing ${tradesByToken.size} unique tokens...\n`);
    console.log('═'.repeat(80) + '\n');

    let totalPnL = 0;
    let totalPnLSOL = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    const tradeDetails: any[] = [];

    // Analyze each token's trades
    for (const [tokenMint, tokenTrades] of tradesByToken) {
      const buys = tokenTrades.filter(t => t.action === 'BUY');
      const sells = tokenTrades.filter(t => t.action === 'SELL');

      if (buys.length === 0) continue;

      const totalBuySOL = buys.reduce((sum, t) => sum + Number(t.solAmount), 0);
      const totalBuyTokens = buys.reduce((sum, t) => sum + Number(t.tokenAmount), 0);
      const totalSellSOL = sells.reduce((sum, t) => sum + Number(t.solAmount), 0);
      const totalSellTokens = sells.reduce((sum, t) => sum + Number(t.tokenAmount), 0);

      const avgBuyPrice = totalBuySOL / totalBuyTokens;
      const avgSellPrice = totalSellTokens > 0 ? totalSellSOL / totalSellTokens : 0;

      // Calculate PnL in SOL
      const soldPnL = totalSellSOL - (totalSellTokens * avgBuyPrice);
      const remainingValue = (totalBuyTokens - totalSellTokens) * avgSellPrice; // Estimate remaining value
      const tokenPnL = soldPnL + (totalSellTokens > 0 ? remainingValue : 0);

      // Track fees
      const totalFees = tokenTrades.reduce((sum, t) => sum + Number(t.totalFees || 0), 0);
      const netPnL = tokenPnL - totalFees;

      totalPnLSOL += netPnL;

      const symbol = tokenTrades[0].tokenSymbol || 'UNKNOWN';
      const status = totalSellTokens >= totalBuyTokens ? 'CLOSED' : 'OPEN';
      
      if (status === 'CLOSED') {
        if (netPnL > 0) {
          winningTrades++;
        } else {
          losingTrades++;
        }
      }

      tradeDetails.push({
        symbol,
        tokenMint: tokenMint.substring(0, 8) + '...',
        buys: buys.length,
        sells: sells.length,
        buySOL: totalBuySOL.toFixed(4),
        sellSOL: totalSellSOL.toFixed(4),
        pnlSOL: netPnL.toFixed(4),
        status,
        firstTrade: buys[0].createdAt.toISOString().split('T')[0],
        lastTrade: tokenTrades[tokenTrades.length - 1].createdAt.toISOString().split('T')[0]
      });
    }

    // Sort by PnL (best to worst)
    tradeDetails.sort((a, b) => parseFloat(b.pnlSOL) - parseFloat(a.pnlSOL));

    // Display results
    console.log('🏆 TOP PERFORMERS:\n');
    tradeDetails.slice(0, 5).forEach((t, i) => {
      const emoji = parseFloat(t.pnlSOL) > 0 ? '💰' : '📉';
      console.log(`${i + 1}. ${emoji} ${t.symbol}`);
      console.log(`   PnL: ${t.pnlSOL} SOL | ${t.buys} buys, ${t.sells} sells | ${t.status}`);
      console.log(`   Period: ${t.firstTrade} → ${t.lastTrade}\n`);
    });

    console.log('\n📊 BOTTOM PERFORMERS:\n');
    tradeDetails.slice(-5).reverse().forEach((t, i) => {
      const emoji = parseFloat(t.pnlSOL) > 0 ? '💰' : '📉';
      console.log(`${i + 1}. ${emoji} ${t.symbol}`);
      console.log(`   PnL: ${t.pnlSOL} SOL | ${t.buys} buys, ${t.sells} sells | ${t.status}`);
      console.log(`   Period: ${t.firstTrade} → ${t.lastTrade}\n`);
    });

    // Assume SOL price for USD conversion (you can update this)
    const SOL_PRICE_USD = 180; // Update with current price
    const totalPnLUSD = totalPnLSOL * SOL_PRICE_USD;

    const closedTrades = winningTrades + losingTrades;
    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
    const avgPnLPerTrade = closedTrades > 0 ? totalPnLSOL / closedTrades : 0;

    console.log('\n' + '═'.repeat(80));
    console.log('\n💼 FINAL SUMMARY\n');
    console.log(`Agent: ${henryAgent.displayName || henryAgent.name} (${henryAgent.id})`);
    console.log(`Wallet: ${henryAgent.evmWalletAddress}\n`);
    console.log(`📈 Total Trades: ${trades.length}`);
    console.log(`   Unique Tokens: ${tradesByToken.size}`);
    console.log(`   Closed Positions: ${closedTrades}`);
    console.log(`   Open Positions: ${tradesByToken.size - closedTrades}\n`);
    console.log(`💰 Total PnL: ${totalPnLSOL.toFixed(4)} SOL (~$${totalPnLUSD.toFixed(2)} USD)`);
    console.log(`   Winning Trades: ${winningTrades} (${winRate.toFixed(1)}% win rate)`);
    console.log(`   Losing Trades: ${losingTrades}`);
    console.log(`   Avg PnL per Closed Trade: ${avgPnLPerTrade.toFixed(4)} SOL\n`);
    console.log('═'.repeat(80) + '\n');

    // Save to file
    const reportPath = '/Users/henry/.openclaw/workspace/memory/henry-agent-pnl.md';
    const report = generateReport(henryAgent, trades, tradeDetails, totalPnLSOL, totalPnLUSD, winningTrades, losingTrades, winRate, avgPnLPerTrade, SOL_PRICE_USD);
    
    const fs = await import('fs');
    fs.writeFileSync(reportPath, report);
    console.log(`✅ Report saved to: ${reportPath}\n`);

    return {
      totalPnLSOL,
      totalPnLUSD,
      totalTrades: trades.length,
      winningTrades,
      losingTrades,
      winRate,
      avgPnLPerTrade
    };

  } catch (error) {
    console.error('❌ Error calculating PnL:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function calculatePaperTradePnL(paperTrades: any[], agent: any) {
  console.log('📊 Calculating PnL from PaperTrade table...\n');
  
  let totalPnL = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let closedTrades = 0;

  const tradeDetails = paperTrades.map(trade => {
    const pnl = trade.pnl ? Number(trade.pnl) : 0;
    const pnlPercent = trade.pnlPercent ? Number(trade.pnlPercent) : 0;
    
    if (trade.status === 'CLOSED') {
      closedTrades++;
      totalPnL += pnl;
      if (pnl > 0) winningTrades++;
      else if (pnl < 0) losingTrades++;
    }

    return {
      symbol: trade.tokenSymbol,
      action: trade.action,
      pnl: pnl.toFixed(4),
      pnlPercent: pnlPercent.toFixed(2),
      status: trade.status,
      openedAt: trade.openedAt.toISOString().split('T')[0],
      closedAt: trade.closedAt ? trade.closedAt.toISOString().split('T')[0] : 'N/A'
    };
  });

  const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
  const avgPnL = closedTrades > 0 ? totalPnL / closedTrades : 0;

  console.log('\n' + '═'.repeat(80));
  console.log('\n💼 PAPER TRADE SUMMARY\n');
  console.log(`Agent: ${agent.displayName || agent.name}`);
  console.log(`Total Trades: ${paperTrades.length}`);
  console.log(`Closed Trades: ${closedTrades}\n`);
  console.log(`💰 Total PnL: ${totalPnL.toFixed(4)} SOL`);
  console.log(`   Winning: ${winningTrades} (${winRate.toFixed(1)}%)`);
  console.log(`   Losing: ${losingTrades}`);
  console.log(`   Avg PnL: ${avgPnL.toFixed(4)} SOL\n`);
  console.log('═'.repeat(80) + '\n');

  // Save report
  const reportPath = '/Users/henry/.openclaw/workspace/memory/henry-agent-pnl.md';
  const report = generatePaperTradeReport(agent, paperTrades, tradeDetails, totalPnL, winningTrades, losingTrades, winRate, avgPnL);
  
  const fs = await import('fs');
  fs.writeFileSync(reportPath, report);
  console.log(`✅ Report saved to: ${reportPath}\n`);
}

function generateReport(
  agent: any,
  trades: any[],
  tradeDetails: any[],
  totalPnLSOL: number,
  totalPnLUSD: number,
  winningTrades: number,
  losingTrades: number,
  winRate: number,
  avgPnLPerTrade: number,
  solPrice: number
): string {
  const date = new Date().toISOString().split('T')[0];
  
  return `# Henry's Agent Trading Performance Report

**Generated:** ${date}
**Agent:** ${agent.displayName || agent.name}
**Agent ID:** ${agent.id}
**Wallet:** ${agent.evmWalletAddress}

---

## 📊 Summary Statistics

- **Total Trades:** ${trades.length}
- **Unique Tokens Traded:** ${tradeDetails.length}
- **Closed Positions:** ${winningTrades + losingTrades}
- **Open Positions:** ${tradeDetails.length - (winningTrades + losingTrades)}

## 💰 Profit & Loss

- **Total PnL:** ${totalPnLSOL.toFixed(4)} SOL (~$${totalPnLUSD.toFixed(2)} USD)
- **Winning Trades:** ${winningTrades}
- **Losing Trades:** ${losingTrades}
- **Win Rate:** ${winRate.toFixed(1)}%
- **Average PnL per Closed Trade:** ${avgPnLPerTrade.toFixed(4)} SOL

**Note:** USD conversion uses SOL price of $${solPrice}

---

## 🏆 Top 10 Best Performing Tokens

${tradeDetails.slice(0, 10).map((t, i) => `
${i + 1}. **${t.symbol}** (${t.tokenMint})
   - PnL: ${t.pnlSOL} SOL
   - Buys: ${t.buys}, Sells: ${t.sells}
   - Status: ${t.status}
   - Period: ${t.firstTrade} → ${t.lastTrade}
`).join('\n')}

---

## 📉 Bottom 10 Worst Performing Tokens

${tradeDetails.slice(-10).reverse().map((t, i) => `
${i + 1}. **${t.symbol}** (${t.tokenMint})
   - PnL: ${t.pnlSOL} SOL
   - Buys: ${t.buys}, Sells: ${t.sells}
   - Status: ${t.status}
   - Period: ${t.firstTrade} → ${t.lastTrade}
`).join('\n')}

---

## 📋 All Trades Summary

Total of ${tradeDetails.length} tokens traded:

${tradeDetails.map(t => `- **${t.symbol}**: ${t.pnlSOL} SOL (${t.status})`).join('\n')}

---

**Report generated by SuperMolt PnL Calculator**
`;
}

function generatePaperTradeReport(
  agent: any,
  trades: any[],
  tradeDetails: any[],
  totalPnL: number,
  winningTrades: number,
  losingTrades: number,
  winRate: number,
  avgPnL: number
): string {
  const date = new Date().toISOString().split('T')[0];
  
  return `# Henry's Agent Paper Trading Performance Report

**Generated:** ${date}
**Agent:** ${agent.displayName || agent.name}
**Agent ID:** ${agent.id}

---

## 📊 Summary Statistics

- **Total Paper Trades:** ${trades.length}
- **Closed Trades:** ${winningTrades + losingTrades}

## 💰 Profit & Loss

- **Total PnL:** ${totalPnL.toFixed(4)} SOL
- **Winning Trades:** ${winningTrades}
- **Losing Trades:** ${losingTrades}
- **Win Rate:** ${winRate.toFixed(1)}%
- **Average PnL per Trade:** ${avgPnL.toFixed(4)} SOL

---

## 📋 All Trades

${tradeDetails.map((t, i) => `
${i + 1}. **${t.symbol}** - ${t.action}
   - PnL: ${t.pnl} SOL (${t.pnlPercent}%)
   - Status: ${t.status}
   - Opened: ${t.openedAt} | Closed: ${t.closedAt}
`).join('\n')}

---

**Report generated by SuperMolt PnL Calculator**
`;
}

// Run the calculation
calculatePnL()
  .then(() => {
    console.log('✅ PnL calculation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
