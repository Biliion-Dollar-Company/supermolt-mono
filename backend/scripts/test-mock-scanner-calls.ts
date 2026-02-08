/**
 * Mock Scanner Calls Test
 * 
 * Creates test scanner calls to populate leaderboard
 */

const API_URL = 'https://sr-mobile-production.up.railway.app';
const EPOCH_ID = 'ab09bf12-2b88-407e-838f-3235df80f8e7';

// Mock token calls (mix of wins and losses)
const mockCalls = [
  // Alpha Scanner - High performance (4 wins, 1 loss)
  { scannerId: 'alpha', tokenMint: 'BONK...', tokenSymbol: 'BONK', entryPrice: 0.00001, exitPrice: 0.000015, outcome: 'WIN' },
  { scannerId: 'alpha', tokenMint: 'WIF...', tokenSymbol: 'WIF', entryPrice: 2.5, exitPrice: 3.2, outcome: 'WIN' },
  { scannerId: 'alpha', tokenMint: 'MYRO...', tokenSymbol: 'MYRO', entryPrice: 0.15, exitPrice: 0.22, outcome: 'WIN' },
  { scannerId: 'alpha', tokenMint: 'SAMO...', tokenSymbol: 'SAMO', entryPrice: 0.008, exitPrice: 0.006, outcome: 'LOSS' },
  { scannerId: 'alpha', tokenMint: 'POPCAT...', tokenSymbol: 'POPCAT', entryPrice: 0.45, exitPrice: 0.58, outcome: 'WIN' },
  
  // Beta Scanner - Medium performance (3 wins, 2 losses)
  { scannerId: 'beta', tokenMint: 'PONKE...', tokenSymbol: 'PONKE', entryPrice: 0.25, exitPrice: 0.31, outcome: 'WIN' },
  { scannerId: 'beta', tokenMint: 'SLERF...', tokenSymbol: 'SLERF', entryPrice: 0.18, exitPrice: 0.14, outcome: 'LOSS' },
  { scannerId: 'beta', tokenMint: 'BOME...', tokenSymbol: 'BOME', entryPrice: 0.012, exitPrice: 0.016, outcome: 'WIN' },
  { scannerId: 'beta', tokenMint: 'MOTHER...', tokenSymbol: 'MOTHER', entryPrice: 0.08, exitPrice: 0.05, outcome: 'LOSS' },
  { scannerId: 'beta', tokenMint: 'WEN...', tokenSymbol: 'WEN', entryPrice: 0.0001, exitPrice: 0.00013, outcome: 'WIN' },
  
  // Gamma Scanner - Good performance (4 wins, 1 loss)
  { scannerId: 'gamma', tokenMint: 'JITO...', tokenSymbol: 'JITO', entryPrice: 3.2, exitPrice: 4.1, outcome: 'WIN' },
  { scannerId: 'gamma', tokenMint: 'JUP...', tokenSymbol: 'JUP', entryPrice: 1.1, exitPrice: 1.35, outcome: 'WIN' },
  { scannerId: 'gamma', tokenMint: 'PYTH...', tokenSymbol: 'PYTH', entryPrice: 0.42, exitPrice: 0.39, outcome: 'LOSS' },
  { scannerId: 'gamma', tokenMint: 'RNDR...', tokenSymbol: 'RNDR', entryPrice: 8.5, exitPrice: 10.2, outcome: 'WIN' },
  { scannerId: 'gamma', tokenMint: 'RAY...', tokenSymbol: 'RAY', entryPrice: 2.8, exitPrice: 3.3, outcome: 'WIN' },
  
  // Delta Scanner - Poor performance (2 wins, 3 losses)
  { scannerId: 'delta', tokenMint: 'ORCA...', tokenSymbol: 'ORCA', entryPrice: 4.5, exitPrice: 5.2, outcome: 'WIN' },
  { scannerId: 'delta', tokenMint: 'MNGO...', tokenSymbol: 'MNGO', entryPrice: 0.25, exitPrice: 0.19, outcome: 'LOSS' },
  { scannerId: 'delta', tokenMint: 'SRM...', tokenSymbol: 'SRM', entryPrice: 0.15, exitPrice: 0.11, outcome: 'LOSS' },
  { scannerId: 'delta', tokenMint: 'FIDA...', tokenSymbol: 'FIDA', entryPrice: 0.32, exitPrice: 0.38, outcome: 'WIN' },
  { scannerId: 'delta', tokenMint: 'STEP...', tokenSymbol: 'STEP', entryPrice: 0.08, exitPrice: 0.05, outcome: 'LOSS' },
  
  // Epsilon Scanner - Worst performance (1 win, 4 losses)
  { scannerId: 'epsilon', tokenMint: 'COPE...', tokenSymbol: 'COPE', entryPrice: 0.05, exitPrice: 0.03, outcome: 'LOSS' },
  { scannerId: 'epsilon', tokenMint: 'MAPS...', tokenSymbol: 'MAPS', entryPrice: 0.12, exitPrice: 0.08, outcome: 'LOSS' },
  { scannerId: 'epsilon', tokenMint: 'MEDIA...', tokenSymbol: 'MEDIA', entryPrice: 0.22, exitPrice: 0.28, outcome: 'WIN' },
  { scannerId: 'epsilon', tokenMint: 'ROPE...', tokenSymbol: 'ROPE', entryPrice: 0.004, exitPrice: 0.002, outcome: 'LOSS' },
  { scannerId: 'epsilon', tokenMint: 'TULIP...', tokenSymbol: 'TULIP', entryPrice: 0.35, exitPrice: 0.21, outcome: 'LOSS' },
];

async function submitCall(call: any) {
  const pnl = call.outcome === 'WIN' 
    ? ((call.exitPrice - call.entryPrice) / call.entryPrice * 100).toFixed(2)
    : ((call.entryPrice - call.exitPrice) / call.entryPrice * -100).toFixed(2);
  
  const payload = {
    scannerId: call.scannerId,
    epochId: EPOCH_ID,
    tokenMint: call.tokenMint,
    tokenSymbol: call.tokenSymbol,
    entryPrice: call.entryPrice,
    exitPrice: call.exitPrice,
    pnl: parseFloat(pnl),
    reason: `AI detected strong ${call.outcome === 'WIN' ? 'bullish' : 'bearish'} signals`
  };
  
  try {
    const response = await fetch(`${API_URL}/api/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ ${call.scannerId}: ${call.tokenSymbol} (${call.outcome}) - PnL: ${pnl}%`);
    } else {
      console.log(`❌ ${call.scannerId}: ${call.tokenSymbol} - Error: ${data.error?.message}`);
    }
    
    return data;
  } catch (error: any) {
    console.log(`❌ ${call.scannerId}: ${call.tokenSymbol} - Failed: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🎯 Submitting mock scanner calls...\n');
  console.log(`API: ${API_URL}`);
  console.log(`Epoch: ${EPOCH_ID}\n`);
  console.log('─'.repeat(60) + '\n');
  
  for (const call of mockCalls) {
    await submitCall(call);
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between calls
  }
  
  console.log('\n' + '─'.repeat(60));
  console.log('\n✨ All calls submitted! Now checking leaderboard...\n');
  
  // Check leaderboard
  try {
    const response = await fetch(`${API_URL}/api/leaderboard`);
    const data = await response.json();
    
    if (data.success) {
      console.log('📊 LEADERBOARD RANKINGS:\n');
      
      data.data.rankings.forEach((rank: any, index: number) => {
        console.log(`#${index + 1} ${rank.scannerName} (${rank.scannerId})`);
        console.log(`   Win Rate: ${rank.winRate}%`);
        console.log(`   Total Calls: ${rank.totalCalls}`);
        console.log(`   Wins: ${rank.wins} | Losses: ${rank.losses}`);
        console.log(`   Performance Score: ${rank.performanceScore}`);
        console.log(`   USDC Allocation: $${rank.usdcAllocated} (${rank.multiplier}x)\n`);
      });
      
      console.log(`Total Scanners: ${data.data.totalScanners}`);
      console.log(`USDC Pool: $${data.data.usdcPool}`);
    } else {
      console.log('❌ Failed to fetch leaderboard:', data.error?.message);
    }
  } catch (error: any) {
    console.log('❌ Failed to fetch leaderboard:', error.message);
  }
}

main().catch(console.error);
