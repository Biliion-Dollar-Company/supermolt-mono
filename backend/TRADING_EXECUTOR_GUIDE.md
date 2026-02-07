# Trading Executor - Backend Engineer Guide
**Day 1 Goal:** First successful mainnet BUY trade by one agent

---

## 🎯 Your Mission

Build the trading executor service that allows agents to execute BUY/SELL trades via Jupiter SDK on Solana mainnet.

**Quality over speed.** No rushing. Use proven DevPrint patterns.

---

## 📚 Documentation Links

**1. Master Build Plan:**
```bash
cat /Users/henry/.openclaw/workspace/memory/TRADING_EXECUTION_BUILD_PLAN.md
```

**2. DevPrint Reference Code (MUST READ):**
```bash
# Jupiter integration (400 lines)
cat ~/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/devprint/apps/core/src/trading/jupiter.rs

# Buy/Sell execution (1200 lines)
cat ~/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/devprint/apps/core/src/trading/executor.rs

# Position tracking (1000 lines)
cat ~/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/devprint/apps/core/src/trading/position.rs
```

**3. Jupiter SDK Docs:**
- API: https://station.jup.ag/docs/apis/swap-api
- Free lite API: `lite-api.jup.ag/swap/v1`
- Rate limits: 10 req/min (sufficient for 5 agents)

---

## 🔧 What You're Building

**File:** `src/services/trading-executor.ts` (~800 lines)

### Core Class Structure

```typescript
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct?: string;
}

interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded
  lastValidBlockHeight: number;
}

interface BuyResult {
  signature: string;
  amountSol: number;
  tokensReceived: number;
  priorityFeeLamports: number;
  swapFeeSol: number;
  totalFeesSol: number;
  executionMs: number;
}

export class TradingExecutor {
  private connection: Connection;
  private jupiterApiUrl = 'https://lite-api.jup.ag/swap/v1';
  
  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl);
  }
  
  // 1. Get quote from Jupiter
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<JupiterQuote> {
    const url = `${this.jupiterApiUrl}/quote?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${amount}&` +
      `slippageBps=${slippageBps}&` +
      `restrictIntermediateTokens=true`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jupiter quote failed: ${error}`);
    }
    
    return response.json();
  }
  
  // 2. Get swap transaction from Jupiter
  async getSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: string,
    priorityFeeLamports: number
  ): Promise<JupiterSwapResponse> {
    const url = `${this.jupiterApiUrl}/swap`;
    
    const body = {
      quoteResponse: quote,
      userPublicKey,
      wrapUnwrapSOL: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: priorityFeeLamports,
          priorityLevel: this.getPriorityLevel(priorityFeeLamports)
        }
      }
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jupiter swap failed: ${error}`);
    }
    
    return response.json();
  }
  
  // 3. Execute BUY trade
  async executeBuy(
    agentKeypair: Keypair,
    tokenMint: string,
    solAmount: number,
    maxRetries: number = 3
  ): Promise<BuyResult> {
    const startTime = Date.now();
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    
    // Convert SOL to lamports
    const lamports = Math.floor(solAmount * 1e9);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Progressive priority fees (DevPrint pattern)
        const priorityFee = this.getPriorityFeeForAttempt(attempt);
        
        // 1. Get quote
        const quote = await this.getQuote(
          SOL_MINT,
          tokenMint,
          lamports,
          50 + (attempt - 1) * 50 // Increase slippage on retry
        );
        
        // 2. Get swap transaction
        const swapResponse = await this.getSwapTransaction(
          quote,
          agentKeypair.publicKey.toString(),
          priorityFee
        );
        
        // 3. Deserialize and sign transaction
        const txBuffer = Buffer.from(swapResponse.swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(txBuffer);
        transaction.sign([agentKeypair]);
        
        // 4. Send transaction
        const signature = await this.connection.sendRawTransaction(
          transaction.serialize(),
          {
            skipPreflight: true,
            maxRetries: 0
          }
        );
        
        // 5. Confirm transaction
        await this.connection.confirmTransaction(signature, 'confirmed');
        
        // 6. Calculate results
        const tokensReceived = parseFloat(quote.outAmount);
        const executionMs = Date.now() - startTime;
        
        return {
          signature,
          amountSol: solAmount,
          tokensReceived,
          priorityFeeLamports: priorityFee,
          swapFeeSol: this.estimateSwapFee(solAmount),
          totalFeesSol: (priorityFee / 1e9) + this.estimateSwapFee(solAmount),
          executionMs
        };
        
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    throw new Error('All retry attempts failed');
  }
  
  // Helper: Progressive priority fees (from DevPrint)
  private getPriorityFeeForAttempt(attempt: number): number {
    switch (attempt) {
      case 1: return 10_000;      // 0.00001 SOL (~$0.002)
      case 2: return 100_000;     // 0.0001 SOL (~$0.02)
      case 3: return 1_000_000;   // 0.001 SOL (~$0.20)
      default: return 10_000_000; // 0.01 SOL (~$2)
    }
  }
  
  private getPriorityLevel(lamports: number): string {
    if (lamports < 50_000) return 'min';
    if (lamports < 500_000) return 'low';
    if (lamports < 5_000_000) return 'medium';
    return 'high';
  }
  
  private estimateSwapFee(solAmount: number): number {
    // Jupiter typically charges ~0.5% swap fee
    return solAmount * 0.005;
  }
}
```

---

## 🧪 Test Script

**File:** `test-agent-trade.ts`

```typescript
import { Keypair } from '@solana/web3.js';
import { TradingExecutor } from './src/services/trading-executor';
import bs58 from 'bs58';

async function testAgentTrade() {
  // 1. Get agent keypair (ask Henry for storage location)
  const agentPrivateKey = process.env.AGENT_PRIVATE_KEY!; // Base58 encoded
  const agentKeypair = Keypair.fromSecretKey(bs58.decode(agentPrivateKey));
  
  console.log('Agent wallet:', agentKeypair.publicKey.toString());
  
  // 2. Initialize executor
  const executor = new TradingExecutor(process.env.HELIUS_RPC_URL!);
  
  // 3. Test buy (0.01 SOL of BONK - very liquid)
  const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
  
  console.log('Executing test buy: 0.01 SOL → BONK');
  
  const result = await executor.executeBuy(
    agentKeypair,
    BONK_MINT,
    0.01 // 0.01 SOL
  );
  
  console.log('✅ Trade successful!');
  console.log('Signature:', result.signature);
  console.log('Tokens received:', result.tokensReceived);
  console.log('Total fees:', result.totalFeesSol, 'SOL');
  console.log('Execution time:', result.executionMs, 'ms');
  console.log('Solscan:', `https://solscan.io/tx/${result.signature}`);
}

testAgentTrade().catch(console.error);
```

**Run test:**
```bash
cd SR-Mobile/backend
AGENT_PRIVATE_KEY="<base58_key>" bun run test-agent-trade.ts
```

---

## 📊 Success Criteria

**Day 1 Complete When:**
- ✅ `trading-executor.ts` created (~800 lines)
- ✅ Jupiter lite API integration working
- ✅ One agent executes BUY trade successfully
- ✅ Transaction confirmed on-chain (verify via Solscan)
- ✅ Fees <1% of trade value
- ✅ Code committed to git

---

## 🚨 Questions to Ask Henry

1. **Where are agent private keys stored?**
   - Database encrypted?
   - Environment variables?
   - KMS/Vault?

2. **Which agent should I use for testing?**
   - Observer agent ID?
   - Already funded with SOL?

3. **Cost approval:**
   - OK to spend ~0.02 SOL ($4) on test trades?

---

## 📈 Next Steps (Day 2)

After Day 1 success:
1. Add SELL functionality
2. Add position tracking (database)
3. Integrate with existing webhook system
4. Add all 5 agents

---

**Start here:** Read DevPrint `jupiter.rs` to understand the pattern, then build! 🚀
