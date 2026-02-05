/**
 * Mock Scanner Calls Test - LOCAL
 * 
 * Test with local backend
 */

const API_URL = 'http://localhost:3001';

// Mock token calls (mix of wins and losses)
const mockCalls = [
  // Alpha Scanner - High performance (4 wins, 1 loss - 80% win rate)
  { scannerId: 'alpha', tokenAddress: 'BONK1111111111111111111111111111111111111', tokenSymbol: 'BONK', convictionScore: 0.85, outcome: 'win', exitPrice: 0.000015, entryPrice: 0.00001 },
  { scannerId: 'alpha', tokenAddress: 'WIF11111111111111111111111111111111111111', tokenSymbol: 'WIF', convictionScore: 0.92, outcome: 'win', exitPrice: 3.2, entryPrice: 2.5 },
  { scannerId: 'alpha', tokenAddress: 'MYRO1111111111111111111111111111111111111', tokenSymbol: 'MYRO', convictionScore: 0.78, outcome: 'win', exitPrice: 0.22, entryPrice: 0.15 },
  { scannerId: 'alpha', tokenAddress: 'SAMO1111111111111111111111111111111111111', tokenSymbol: 'SAMO', convictionScore: 0.65, outcome: 'loss', exitPrice: 0.006, entryPrice: 0.008 },
  { scannerId: 'alpha', tokenAddress: 'POPCAT111111111111111111111111111111111', tokenSymbol: 'POPCAT', convictionScore: 0.88, outcome: 'win', exitPrice: 0.58, entryPrice: 0.45 },
  
  // Gamma Scanner - Good performance (4 wins, 1 loss - 80% win rate)
  { scannerId: 'gamma', tokenAddress: 'JITO1111111111111111111111111111111111111', tokenSymbol: 'JITO', convictionScore: 0.82, outcome: 'win', exitPrice: 4.1, entryPrice: 3.2 },
  { scannerId: 'gamma', tokenAddress: 'JUP11111111111111111111111111111111111111', tokenSymbol: 'JUP', convictionScore: 0.76, outcome: 'win', exitPrice: 1.35, entryPrice: 1.1 },
  { scannerId: 'gamma', tokenAddress: 'PYTH1111111111111111111111111111111111111', tokenSymbol: 'PYTH', convictionScore: 0.62, outcome: 'loss', exitPrice: 0.39, entryPrice: 0.42 },
  { scannerId: 'gamma', tokenAddress: 'RNDR1111111111111111111111111111111111111', tokenSymbol: 'RNDR', convictionScore: 0.90, outcome: 'win', exitPrice: 10.2, entryPrice: 8.5 },
  { scannerId: 'gamma', tokenAddress: 'RAY11111111111111111111111111111111111111', tokenSymbol: 'RAY', convictionScore: 0.84, outcome: 'win', exitPrice: 3.3, entryPrice: 2.8 },
  
  // Beta Scanner - Medium performance (3 wins, 2 losses - 60% win rate)
  { scannerId: 'beta', tokenAddress: 'PONKE111111111111111111111111111111111111', tokenSymbol: 'PONKE', convictionScore: 0.72, outcome: 'win', exitPrice: 0.31, entryPrice: 0.25 },
  { scannerId: 'beta', tokenAddress: 'SLERF111111111111111111111111111111111111', tokenSymbol: 'SLERF', convictionScore: 0.68, outcome: 'loss', exitPrice: 0.14, entryPrice: 0.18 },
  { scannerId: 'beta', tokenAddress: 'BOME1111111111111111111111111111111111111', tokenSymbol: 'BOME', convictionScore: 0.75, outcome: 'win', exitPrice: 0.016, entryPrice: 0.012 },
  { scannerId: 'beta', tokenAddress: 'MOTHER111111111111111111111111111111111', tokenSymbol: 'MOTHER', convictionScore: 0.58, outcome: 'loss', exitPrice: 0.05, entryPrice: 0.08 },
  { scannerId: 'beta', tokenAddress: 'WEN11111111111111111111111111111111111111', tokenSymbol: 'WEN', convictionScore: 0.70, outcome: 'win', exitPrice: 0.00013, entryPrice: 0.0001 },
  
  // Delta Scanner - Poor performance (2 wins, 3 losses - 40% win rate)
  { scannerId: 'delta', tokenAddress: 'ORCA1111111111111111111111111111111111111', tokenSymbol: 'ORCA', convictionScore: 0.65, outcome: 'win', exitPrice: 5.2, entryPrice: 4.5 },
  { scannerId: 'delta', tokenAddress: 'MNGO1111111111111111111111111111111111111', tokenSymbol: 'MNGO', convictionScore: 0.55, outcome: 'loss', exitPrice: 0.19, entryPrice: 0.25 },
  { scannerId: 'delta', tokenAddress: 'SRM11111111111111111111111111111111111111', tokenSymbol: 'SRM', convictionScore: 0.52, outcome: 'loss', exitPrice: 0.11, entryPrice: 0.15 },
  { scannerId: 'delta', tokenAddress: 'FIDA1111111111111111111111111111111111111', tokenSymbol: 'FIDA', convictionScore: 0.60, outcome: 'win', exitPrice: 0.38, entryPrice: 0.32 },
  { scannerId: 'delta', tokenAddress: 'STEP1111111111111111111111111111111111111', tokenSymbol: 'STEP', convictionScore: 0.48, outcome: 'loss', exitPrice: 0.05, entryPrice: 0.08 },
  
  // Epsilon Scanner - Worst performance (1 win, 4 losses - 20% win rate)
  { scannerId: 'epsilon', tokenAddress: 'COPE1111111111111111111111111111111111111', tokenSymbol: 'COPE', convictionScore: 0.45, outcome: 'loss', exitPrice: 0.03, entryPrice: 0.05 },
  { scannerId: 'epsilon', tokenAddress: 'MAPS1111111111111111111111111111111111111', tokenSymbol: 'MAPS', convictionScore: 0.42, outcome: 'loss', exitPrice: 0.08, entryPrice: 0.12 },
  { scannerId: 'epsilon', tokenAddress: 'MEDIA111111111111111111111111111111111111', tokenSymbol: 'MEDIA', convictionScore: 0.58, outcome: 'win', exitPrice: 0.28, entryPrice: 0.22 },
  { scannerId: 'epsilon', tokenAddress: 'ROPE1111111111111111111111111111111111111', tokenSymbol: 'ROPE', convictionScore: 0.38, outcome: 'loss', exitPrice: 0.002, entryPrice: 0.004 },
  { scannerId: 'epsilon', tokenAddress: 'TULIP111111111111111111111111111111111111', tokenSymbol: 'TULIP', convictionScore: 0.40, outcome: 'loss', exitPrice: 0.21, entryPrice: 0.35 },
];

async function submitAndCloseCall(call: any) {
  // Step 1: Submit call
  const submitPayload = {
    scannerId: call.scannerId,
    tokenAddress: call.tokenAddress,
    tokenSymbol: call.tokenSymbol,
    convictionScore: call.convictionScore,
    reasoning: [
      `High conviction ${call.outcome === 'win' ? 'bullish' : 'bearish'} signals detected`,
      `Technical indicators ${call.outcome === 'win' ? 'positive' : 'negative'}`,
      `Risk/reward ratio favorable`
    ],
    takeProfitPct: 50,
    stopLossPct: 20
  };
  
  try {
    const submitResponse = await fetch(`${API_URL}/api/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitPayload)
    });
    
    const submitData = await submitResponse.json();
    
    if (!submitData.success) {
      console.log(`❌ ${call.scannerId}: ${call.tokenSymbol} - Submit failed: ${submitData.error?.message}`);
      return null;
    }
    
    const callId = submitData.data.id;
    
    // Step 2: Close call with outcome
    const closePayload = {
      exitPrice: call.exitPrice,
      status: call.outcome
    };
    
    const closeResponse = await fetch(`${API_URL}/api/calls/${callId}/close`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closePayload)
    });
    
    const closeData = await closeResponse.json();
    
    if (closeData.success) {
      const pnl = ((call.exitPrice - call.entryPrice) / call.entryPrice * 100).toFixed(2);
      const icon = call.outcome === 'win' ? '✅' : '❌';
      console.log(`${icon} ${call.scannerId}: ${call.tokenSymbol} (${call.outcome.toUpperCase()}) - PnL: ${pnl}%`);
      return closeData;
    } else {
      console.log(`⚠️  ${call.scannerId}: ${call.tokenSymbol} - Close failed: ${closeData.error?.message}`);
      return null;
    }
    
  } catch (error: any) {
    console.log(`❌ ${call.scannerId}: ${call.tokenSymbol} - Failed: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🎯 Submitting mock scanner calls (LOCAL)...\n');
  console.log(`API: ${API_URL}\n`);
  console.log('─'.repeat(70) + '\n');
  
  for (const call of mockCalls) {
    await submitAndCloseCall(call);
    await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between calls
  }
  
  console.log('\n' + '─'.repeat(70));
  console.log('\n✨ All calls submitted! Now checking leaderboard...\n');
  
  // Check leaderboard
  try {
    const response = await fetch(`${API_URL}/api/leaderboard`);
    const data = await response.json();
    
    if (data.success) {
      console.log('📊 LEADERBOARD RANKINGS:\n');
      console.log('═'.repeat(70) + '\n');
      
      data.data.rankings.forEach((rank: any, index: number) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        console.log(`${medal} #${rank.rank} ${rank.scannerName} (${rank.scannerId})`);
        console.log(`   ├─ Win Rate: ${rank.winRate}% (${rank.wins}W/${rank.losses}L)`);
        console.log(`   ├─ Total Calls: ${rank.totalCalls}`);
        console.log(`   ├─ Performance Score: ${rank.performanceScore}`);
        console.log(`   └─ USDC Allocation: $${rank.usdcAllocated} (${rank.multiplier}x multiplier)\n`);
      });
      
      console.log('═'.repeat(70) + '\n');
      console.log(`Total Scanners: ${data.data.totalScanners}`);
      console.log(`USDC Pool: $${data.data.usdcPool}`);
      console.log(`Epoch: ${data.data.epochName} (#${data.data.epochNumber})`);
      console.log(`Status: ${data.data.status}`);
    } else {
      console.log('❌ Failed to fetch leaderboard:', data.error?.message);
    }
  } catch (error: any) {
    console.log('❌ Failed to fetch leaderboard:', error.message);
  }
}

main().catch(console.error);
