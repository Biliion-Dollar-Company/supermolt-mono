/**
 * Alpha Scanner - God Wallet Tracking
 * 
 * Monitors 24 whale wallets and submits high-conviction calls
 */

import { GOD_WALLETS, analyzeTransaction, isTokenEligible } from './god-wallets';

const API_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

interface Transaction {
  signature: string;
  timestamp: number;
  wallet: string;
  type: 'BUY' | 'SELL';
  tokenMint: string;
  tokenSymbol?: string;
  amount: number;
  price: number;
}

/**
 * Fetch recent transactions for god wallets
 */
async function fetchGodWalletActivity(): Promise<Transaction[]> {
  if (!HELIUS_API_KEY) {
    console.warn('[Alpha Scanner] HELIUS_API_KEY not configured');
    return [];
  }
  
  const transactions: Transaction[] = [];
  const { parseSwapInstruction } = await import('../lib/swap-parser');
  
  for (const wallet of GOD_WALLETS) {
    try {
      // Fetch last 10 transactions via Helius Enhanced API
      const response = await fetch(
        `https://api.helius.xyz/v0/addresses/${wallet.pubkey}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=10`
      );
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      // Parse each transaction using our swap parser
      for (const tx of data) {
        const swapInfo = parseSwapInstruction(tx);
        
        if (!swapInfo) continue;
        
        // Determine if this is a buy (SOL/USDC → Token) or sell (Token → SOL/USDC)
        const isBuy = swapInfo.inputMint === 'So11111111111111111111111111111111111111112' || // WSOL
                     swapInfo.inputMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
        
        if (!isBuy) continue; // Only track buys (follow the whales)
        
        transactions.push({
          signature: tx.signature,
          timestamp: tx.timestamp * 1000,
          wallet: wallet.pubkey,
          type: 'BUY',
          tokenMint: swapInfo.outputMint,
          tokenSymbol: undefined, // Will fetch from metadata
          amount: swapInfo.inputAmount,
          price: swapInfo.outputAmount ? swapInfo.inputAmount / swapInfo.outputAmount : 0
        });
      }
    } catch (error) {
      console.error(`[Alpha Scanner] Error fetching ${wallet.name}:`, error);
    }
  }
  
  return transactions;
}

/**
 * Filter transactions to high-conviction signals
 */
async function filterSignals(transactions: Transaction[]): Promise<Transaction[]> {
  const signals: Transaction[] = [];
  const { getTokenInfo } = await import('../lib/birdeye');
  
  for (const tx of transactions) {
    // Find wallet config
    const wallet = GOD_WALLETS.find(w => w.pubkey === tx.wallet);
    if (!wallet) continue;
    
    // Calculate conviction score
    const conviction = analyzeTransaction(tx, wallet);
    
    // Only high-conviction signals
    if (conviction < 0.75) continue;
    
    // Fetch token metadata
    try {
      const tokenInfo = await getTokenInfo(tx.tokenMint);
      
      if (!tokenInfo) {
        console.log(`[Alpha Scanner] ⚠️  No metadata for ${tx.tokenMint}, skipping`);
        continue;
      }
      
      // Add token symbol
      tx.tokenSymbol = tokenInfo.symbol;
      
      // Check token eligibility
      if (!isTokenEligible(tx.tokenMint, tokenInfo)) {
        console.log(`[Alpha Scanner] ⚠️  ${tokenInfo.symbol} failed eligibility check, skipping`);
        continue;
      }
      
      signals.push(tx);
    } catch (error) {
      console.error(`[Alpha Scanner] Error fetching metadata for ${tx.tokenMint}:`, error);
    }
  }
  
  return signals;
}

/**
 * Submit scanner call for a signal
 */
async function submitCall(tx: Transaction, conviction: number): Promise<boolean> {
  try {
    const payload = {
      scannerId: 'alpha',
      tokenAddress: tx.tokenMint,
      tokenSymbol: tx.tokenSymbol || 'UNKNOWN',
      convictionScore: conviction,
      reasoning: [
        `God wallet ${GOD_WALLETS.find(w => w.pubkey === tx.wallet)?.name} bought`,
        `Transaction size: ${tx.amount.toFixed(2)} SOL`,
        `High-conviction signal detected`
      ],
      takeProfitPct: 50,
      stopLossPct: 20
    };
    
    const response = await fetch(`${API_URL}/api/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`[Alpha Scanner] ✅ Submitted call for ${tx.tokenSymbol} (conviction: ${conviction})`);
      return true;
    } else {
      console.log(`[Alpha Scanner] ❌ Failed to submit: ${data.error?.message}`);
      return false;
    }
  } catch (error: any) {
    console.error(`[Alpha Scanner] Error submitting call:`, error.message);
    return false;
  }
}

/**
 * Run Alpha Scanner - Main execution
 */
export async function runAlphaScanner() {
  console.log('[Alpha Scanner] 🔍 Starting scan...');
  console.log(`[Alpha Scanner] Monitoring ${GOD_WALLETS.length} god wallets\n`);
  
  // Fetch recent activity
  const transactions = await fetchGodWalletActivity();
  console.log(`[Alpha Scanner] Found ${transactions.length} recent transactions`);
  
  // Filter to high-conviction signals
  const signals = await filterSignals(transactions);
  console.log(`[Alpha Scanner] ${signals.length} high-conviction signals detected\n`);
  
  // Submit calls
  let submitted = 0;
  for (const signal of signals) {
    const wallet = GOD_WALLETS.find(w => w.pubkey === signal.wallet);
    const conviction = analyzeTransaction(signal, wallet!);
    
    const success = await submitCall(signal, conviction);
    if (success) submitted++;
    
    // Small delay between submissions
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n[Alpha Scanner] ✅ Scan complete: ${submitted}/${signals.length} calls submitted`);
  
  return { transactions: transactions.length, signals: signals.length, submitted };
}

// Run if executed directly
if (import.meta.main) {
  runAlphaScanner()
    .then(results => {
      console.log('\n' + '='.repeat(60));
      console.log('SCAN RESULTS:');
      console.log(`  Transactions analyzed: ${results.transactions}`);
      console.log(`  Signals detected: ${results.signals}`);
      console.log(`  Calls submitted: ${results.submitted}`);
      console.log('='.repeat(60));
    })
    .catch(error => {
      console.error('[Alpha Scanner] Fatal error:', error);
      process.exit(1);
    });
}
