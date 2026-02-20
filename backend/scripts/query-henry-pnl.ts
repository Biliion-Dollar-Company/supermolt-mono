#!/usr/bin/env tsx

import pg from 'pg';
const { Client } = pg;

async function queryPnL() {
  const client = new Client({
    connectionString: 'postgresql://henry@localhost:5432/supermolt'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Find Henry's agent
    console.log('🔍 Looking for agents with wallet containing 31ySFh...\n');
    
    const agentResult = await client.query(`
      SELECT id, name, "displayName", "evmAddress", "totalTrades", "totalPnl", "winRate", "privyWalletId"
      FROM trading_agents 
      WHERE "evmAddress" LIKE '%31ySFh%' 
         OR "privyWalletId" LIKE '%31ySFh%'
      LIMIT 5
    `);

    if (agentResult.rows.length === 0) {
      console.log('❌ No agent found with that wallet. Searching all agents...\n');
      
      const allAgents = await client.query(`
        SELECT id, name, "displayName", "evmAddress", "privyWalletId", "totalTrades", "totalPnl", "winRate"
        FROM trading_agents 
        ORDER BY "totalTrades" DESC
        LIMIT 20
      `);

      console.log(`Found ${allAgents.rows.length} agents:\n`);
      allAgents.rows.forEach((agent, i) => {
        console.log(`${i + 1}. ${agent.displayName || agent.name} (${agent.id})`);
        console.log(`   EVM Wallet: ${agent.evmAddress || 'none'}`);
        console.log(`   Privy Wallet: ${agent.privyWalletId || 'none'}`);
        console.log(`   Stats: ${agent.totalTrades} trades, ${agent.totalPnl} PnL, ${agent.winRate}% win rate\n`);
      });

      await client.end();
      process.exit(1);
    }

    const agent = agentResult.rows[0];
    console.log(`✅ Found agent: ${agent.displayName || agent.name}`);
    console.log(`   ID: ${agent.id}`);
    console.log(`   EVM Wallet: ${agent.evmAddress}`);
    console.log(`   Privy Wallet: ${agent.privyWalletId}`);
    console.log(`   Stored stats: ${agent.totalTrades} trades, ${agent.totalPnl} PnL, ${agent.winRate}% win rate\n`);

    // Get trades from AgentTrade table
    console.log('📊 Querying AgentTrade table...\n');
    
    const tradesResult = await client.query(`
      SELECT 
        id, "agentId", "tokenMint", "tokenSymbol", "tokenName", 
        action, chain, "tokenAmount", "solAmount", 
        signature, "totalFees", "createdAt"
      FROM agent_trades
      WHERE "agentId" = $1
      ORDER BY "createdAt" ASC
    `, [agent.id]);

    const trades = tradesResult.rows;
    console.log(`Found ${trades.length} trades in AgentTrade table\n`);

    if (trades.length === 0) {
      console.log('⚠️  No trades in AgentTrade. Checking PaperTrade...\n');
      
      const paperTradesResult = await client.query(`
        SELECT 
          id, "agentId", "tokenMint", "tokenSymbol", "tokenName",
          action, "entryPrice", "exitPrice", amount, "tokenAmount",
          pnl, "pnlPercent", status, "openedAt", "closedAt"
        FROM paper_trades
        WHERE "agentId" = $1
        ORDER BY "openedAt" ASC
      `, [agent.id]);

      const paperTrades = paperTradesResult.rows;
      console.log(`Found ${paperTrades.rows.length} paper trades\n`);

      if (paperTrades.length === 0) {
        console.log('❌ No trades found in either table');
        await client.end();
        process.exit(1);
      }

      // Calculate from paper trades
      return await calculatePaperTradePnL(paperTrades, agent);
    }

    // Group trades by token
    const tradesByToken = new Map<string, any[]>();
    
    trades.forEach(trade => {
      if (!tradesByToken.has(trade.tokenMint)) {
        tradesByToken.set(trade.tokenMint, []);
      }
      tradesByToken.get(trade.tokenMint)!.push(trade);
    });

    console.log(`📈 Analyzing ${tradesByToken.size} unique tokens...\n`);
    console.log('═'.repeat(80) + '\n');

    let totalPnLSOL = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    const tradeDetails: any[] = [];

    // Analyze each token
    for (const [tokenMint, tokenTrades] of tradesByToken) {
      const buys = tokenTrades.filter(t => t.action === 'BUY');
      const sells = tokenTrades.filter(t => t.action === 'SELL');

      if (buys.length === 0) continue;

      const totalBuySOL = buys.reduce((sum, t) => sum + parseFloat(t.solAmount || 0), 0);
      const totalBuyTokens = buys.reduce((sum, t) => sum + parseFloat(t.tokenAmount || 0), 0);
      const totalSellSOL = sells.reduce((sum, t) => sum + parseFloat(t.solAmount || 0), 0);
      const totalSellTokens = sells.reduce((sum, t) => sum + parseFloat(t.tokenAmount || 0), 0);

      const avgBuyPrice = totalBuyTokens > 0 ? totalBuySOL / totalBuyTokens : 0;
      const avgSellPrice = totalSellTokens > 0 ? totalSellSOL / totalSellTokens : 0;

      // Calculate PnL
      const soldPnL = totalSellSOL - (totalSellTokens * avgBuyPrice);
      const remainingTokens = totalBuyTokens - totalSellTokens;
      const remainingValue = remainingTokens > 0 && avgSellPrice > 0 ? remainingTokens * avgSellPrice : 0;
      const tokenPnL = soldPnL + remainingValue;

      const totalFees = tokenTrades.reduce((sum, t) => sum + parseFloat(t.totalFees || 0), 0);
      const netPnL = tokenPnL - totalFees;

      totalPnLSOL += netPnL;

      const symbol = tokenTrades[0].tokenSymbol || 'UNKNOWN';
      const status = totalSellTokens >= totalBuyTokens ? 'CLOSED' : 'OPEN';
      
      if (status === 'CLOSED') {
        if (netPnL > 0) winningTrades++;
        else if (netPnL < 0) losingTrades++;
      }

      tradeDetails.push({
        symbol,
        tokenMint: tokenMint.substring(0, 8) + '...',
        buys: buys.length,
        sells: sells.length,
        buySOL: totalBuySOL.toFixed(4),
        sellSOL: totalSellSOL.toFixed(4),
        pnlSOL: netPnL.toFixed(4),
        pnlPercent: totalBuySOL > 0 ? ((netPnL / totalBuySOL) * 100).toFixed(2) : '0.00',
        status,
        remainingTokens: remainingTokens.toFixed(2),
        firstTrade: new Date(buys[0].createdAt).toISOString().split('T')[0],
        lastTrade: new Date(tokenTrades[tokenTrades.length - 1].createdAt).toISOString().split('T')[0]
      });
    }

    // Sort by PnL
    tradeDetails.sort((a, b) => parseFloat(b.pnlSOL) - parseFloat(a.pnlSOL));

    // Display results
    console.log('🏆 TOP 5 PERFORMERS:\n');
    tradeDetails.slice(0, 5).forEach((t, i) => {
      const emoji = parseFloat(t.pnlSOL) > 0 ? '💰' : '📉';
      console.log(`${i + 1}. ${emoji} ${t.symbol} (${t.tokenMint})`);
      console.log(`   PnL: ${t.pnlSOL} SOL (${t.pnlPercent}%)`);
      console.log(`   Trades: ${t.buys} buys, ${t.sells} sells | Status: ${t.status}`);
      if (parseFloat(t.remainingTokens) > 0) {
        console.log(`   Remaining: ${t.remainingTokens} tokens`);
      }
      console.log(`   Period: ${t.firstTrade} → ${t.lastTrade}\n`);
    });

    console.log('\n📉 BOTTOM 5 PERFORMERS:\n');
    tradeDetails.slice(-5).reverse().forEach((t, i) => {
      const emoji = parseFloat(t.pnlSOL) > 0 ? '💰' : '📉';
      console.log(`${i + 1}. ${emoji} ${t.symbol} (${t.tokenMint})`);
      console.log(`   PnL: ${t.pnlSOL} SOL (${t.pnlPercent}%)`);
      console.log(`   Trades: ${t.buys} buys, ${t.sells} sells | Status: ${t.status}`);
      if (parseFloat(t.remainingTokens) > 0) {
        console.log(`   Remaining: ${t.remainingTokens} tokens`);
      }
      console.log(`   Period: ${t.firstTrade} → ${t.lastTrade}\n`);
    });

    // Final summary
    const SOL_PRICE_USD = 180;
    const totalPnLUSD = totalPnLSOL * SOL_PRICE_USD;
    const closedTrades = winningTrades + losingTrades;
    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
    const avgPnL = closedTrades > 0 ? totalPnLSOL / closedTrades : 0;

    console.log('\n' + '═'.repeat(80));
    console.log('\n💼 FINAL SUMMARY\n');
    console.log(`Agent: ${agent.displayName || agent.name} (${agent.id})`);
    console.log(`Wallet: ${agent.evmAddress}\n`);
    console.log(`📈 Total Trades: ${trades.length}`);
    console.log(`   Unique Tokens: ${tradesByToken.size}`);
    console.log(`   Closed Positions: ${closedTrades}`);
    console.log(`   Open Positions: ${tradesByToken.size - closedTrades}\n`);
    console.log(`💰 Total PnL: ${totalPnLSOL.toFixed(4)} SOL (~$${totalPnLUSD.toFixed(2)} USD)`);
    console.log(`   Winning Trades: ${winningTrades} (${winRate.toFixed(1)}% win rate)`);
    console.log(`   Losing Trades: ${losingTrades}`);
    console.log(`   Avg PnL per Closed Trade: ${avgPnL.toFixed(4)} SOL\n`);
    console.log('═'.repeat(80) + '\n');

    // Save report
    const report = generateReport(agent, trades, tradeDetails, totalPnLSOL, totalPnLUSD, winningTrades, losingTrades, winRate, avgPnL, SOL_PRICE_USD);
    const fs = await import('fs');
    const reportPath = '/Users/henry/.openclaw/workspace/memory/henry-agent-pnl.md';
    fs.writeFileSync(reportPath, report);
    console.log(`✅ Report saved to: ${reportPath}\n`);

    await client.end();

  } catch (error) {
    console.error('❌ Error:', error);
    await client.end();
    process.exit(1);
  }
}

async function calculatePaperTradePnL(trades: any[], agent: any) {
  console.log('📊 Calculating from PaperTrade table...\n');

  let totalPnL = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let closedTrades = 0;

  const tradeDetails = trades.map(trade => {
    const pnl = parseFloat(trade.pnl || 0);
    const pnlPercent = parseFloat(trade.pnlPercent || 0);

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
      openedAt: new Date(trade.openedAt).toISOString().split('T')[0],
      closedAt: trade.closedAt ? new Date(trade.closedAt).toISOString().split('T')[0] : 'N/A'
    };
  });

  const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
  const avgPnL = closedTrades > 0 ? totalPnL / closedTrades : 0;

  console.log('\n' + '═'.repeat(80));
  console.log('\n💼 PAPER TRADE SUMMARY\n');
  console.log(`Agent: ${agent.displayName || agent.name}`);
  console.log(`Total Trades: ${trades.length}`);
  console.log(`Closed Trades: ${closedTrades}\n`);
  console.log(`💰 Total PnL: ${totalPnL.toFixed(4)} SOL`);
  console.log(`   Winning: ${winningTrades} (${winRate.toFixed(1)}%)`);
  console.log(`   Losing: ${losingTrades}`);
  console.log(`   Avg PnL: ${avgPnL.toFixed(4)} SOL\n`);
  console.log('═'.repeat(80) + '\n');
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
  avgPnL: number,
  solPrice: number
): string {
  const date = new Date().toISOString().split('T')[0];
  
  return `# Henry's Agent Trading Performance Report

**Generated:** ${date}
**Agent:** ${agent.displayName || agent.name}
**Agent ID:** ${agent.id}
**Wallet:** ${agent.evmAddress}

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
- **Average PnL per Closed Trade:** ${avgPnL.toFixed(4)} SOL

**Note:** USD conversion uses SOL price of $${solPrice}

---

## 🏆 Top 10 Best Performing Tokens

${tradeDetails.slice(0, 10).map((t, i) => `
${i + 1}. **${t.symbol}** (${t.tokenMint})
   - PnL: ${t.pnlSOL} SOL (${t.pnlPercent}%)
   - Buys: ${t.buys}, Sells: ${t.sells}
   - Status: ${t.status}
   - Period: ${t.firstTrade} → ${t.lastTrade}
`).join('\n')}

---

## 📉 Bottom 10 Worst Performing Tokens

${tradeDetails.slice(-10).reverse().map((t, i) => `
${i + 1}. **${t.symbol}** (${t.tokenMint})
   - PnL: ${t.pnlSOL} SOL (${t.pnlPercent}%)
   - Buys: ${t.buys}, Sells: ${t.sells}
   - Status: ${t.status}
   - Period: ${t.firstTrade} → ${t.lastTrade}
`).join('\n')}

---

## 📋 All Trades Summary

Total of ${tradeDetails.length} tokens traded:

${tradeDetails.map(t => `- **${t.symbol}**: ${t.pnlSOL} SOL (${t.pnlPercent}%) - ${t.status}`).join('\n')}

---

**Report generated by SuperMolt PnL Calculator**
`;
}

queryPnL()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
