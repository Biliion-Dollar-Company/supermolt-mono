/**
 * Agent Simulator - Manages 5 Trading Agents
 * 
 * Features:
 * - Loads existing wallet from private key (Agent Alpha)
 * - Generates new wallets for other agents
 * - Executes trades via Jupiter
 * - Logs all decisions
 * - Auto-creates agents in database on first trade
 */

import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { keyManager } from './key-manager.service';
import { prisma } from '../lib/db';
import { 
  ALL_AGENTS, 
  AGENT_ALPHA, 
  type AgentPersonality 
} from './agent-config';

// Jupiter API v6
const JUPITER_API = 'https://quote-api.jup.ag/v6';

export interface AgentKeypair {
  agent: AgentPersonality;
  keypair: Keypair;
}

/**
 * Load Agent Alpha's wallet from environment variable
 * 
 * Expects: AGENT_ALPHA_PRIVATE_KEY in base58 format
 * 
 * Security:
 * - Private key stored in .env (never committed to git)
 * - Only loaded for LIVE trades
 * - Use .env.example for setup instructions
 */
export function loadAlphaWallet(): Keypair {
  return keyManager.requireSolanaKeypair('AGENT_ALPHA_PRIVATE_KEY', 'agent-simulator');
}

/**
 * Generate or load wallet for an agent
 * 
 * - Agent Alpha: Loads from env (Henry's existing wallet)
 * - Other agents: Generates new keypairs (or loads from storage)
 */
export function loadAgentKeypair(agent: AgentPersonality): Keypair {
  if (agent.id === 'alpha-wolf') {
    return loadAlphaWallet();
  }
  
  // For other agents, generate new keypairs
  // TODO: Persist these to secure storage (not in code)
  const keypair = Keypair.generate();
  console.log(`🔑 Generated wallet for ${agent.name}: ${keypair.publicKey.toBase58()}`);
  return keypair;
}

/**
 * Initialize all agent keypairs
 */
export function initializeAgents(): AgentKeypair[] {
  console.log('🚀 Initializing 5 trading agents...\n');
  
  const agentKeypairs: AgentKeypair[] = [];
  
  for (const agent of ALL_AGENTS) {
    try {
      const keypair = loadAgentKeypair(agent);
      agentKeypairs.push({ agent, keypair });
      console.log(`✅ ${agent.emoji} ${agent.name} (${agent.riskLevel}): ${keypair.publicKey.toBase58()}`);
    } catch (error) {
      if (agent.id === 'alpha-wolf') {
        console.error(`❌ Failed to load ${agent.name}:`, error instanceof Error ? error.message : error);
        console.log('⚠️  Skipping Agent Alpha until private key is provided.\n');
      } else {
        console.error(`❌ Failed to initialize ${agent.name}:`, error);
      }
    }
  }
  
  console.log(`\n✨ Initialized ${agentKeypairs.length}/${ALL_AGENTS.length} agents\n`);
  return agentKeypairs;
}

/**
 * Get Jupiter quote for a swap
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number, // in lamports/smallest unit
  slippageBps: number = 50 // 0.5% default slippage
) {
  const url = `${JUPITER_API}/quote?` + new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Jupiter quote failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Execute swap via Jupiter
 * 
 * @param keypair - Agent's keypair
 * @param inputMint - Input token mint address
 * @param outputMint - Output token mint address
 * @param amount - Amount in lamports/smallest unit
 * @returns Transaction signature
 */
export async function executeSwap(
  connection: Connection,
  keypair: Keypair,
  inputMint: string,
  outputMint: string,
  amount: number
): Promise<string> {
  console.log(`🔄 Getting Jupiter quote...`);
  const quoteResponse = await getJupiterQuote(inputMint, outputMint, amount);

  console.log(`💱 Quote received:`, {
    inputAmount: quoteResponse.inAmount,
    outputAmount: quoteResponse.outAmount,
    priceImpactPct: quoteResponse.priceImpactPct,
  });

  // Get swap transaction
  const swapResponse = await fetch(`${JUPITER_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: keypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });

  if (!swapResponse.ok) {
    throw new Error(`Jupiter swap failed: ${swapResponse.statusText}`);
  }

  const { swapTransaction } = await swapResponse.json();

  // Deserialize and sign transaction
  const transactionBuf = Buffer.from(swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(transactionBuf);
  transaction.sign([keypair]);

  // Send transaction
  console.log(`📤 Sending transaction...`);
  const signature = await connection.sendTransaction(transaction, {
    skipPreflight: false,
    maxRetries: 3,
  });

  // Wait for confirmation
  console.log(`⏳ Waiting for confirmation...`);
  await connection.confirmTransaction(signature, 'confirmed');

  console.log(`✅ Swap confirmed! Signature: ${signature}`);
  return signature;
}

/**
 * Execute a test trade for an agent
 * 
 * This is a convenience function for testing. In production,
 * agents would use a more sophisticated decision-making process.
 * 
 * @param agent - Agent personality
 * @param keypair - Agent's keypair
 * @param tokenSymbol - Token to trade (e.g., 'BONK')
 * @param action - 'BUY' or 'SELL'
 * @param solAmount - Amount of SOL to spend (for BUY) or token value (for SELL)
 */
export async function executeTestTrade(
  agent: AgentPersonality,
  keypair: Keypair,
  tokenSymbol: string,
  action: 'BUY' | 'SELL',
  solAmount: number = 0.01 // Default 0.01 SOL
): Promise<string> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🤖 ${agent.emoji} ${agent.name} - ${action} ${tokenSymbol}`);
  console.log(`${'='.repeat(60)}\n`);

  // Find token mint from agent's watchlist
  const tokenIndex = agent.tokenWatchlist.indexOf(tokenSymbol);
  if (tokenIndex === -1) {
    throw new Error(`Token ${tokenSymbol} not in ${agent.name}'s watchlist`);
  }
  const tokenMint = agent.tokenMints[tokenIndex];

  // Solana connection (devnet for hackathon)
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    'confirmed'
  );

  // Check wallet balance
  const balance = await connection.getBalance(keypair.publicKey);
  const solBalance = balance / 1e9;
  console.log(`💰 Wallet balance: ${solBalance.toFixed(4)} SOL`);

  if (solBalance < solAmount) {
    throw new Error(`Insufficient balance. Need ${solAmount} SOL, have ${solBalance.toFixed(4)} SOL`);
  }

  // Define swap parameters
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const amountLamports = Math.floor(solAmount * 1e9);

  let signature: string;
  if (action === 'BUY') {
    // BUY: SOL → Token
    signature = await executeSwap(
      connection,
      keypair,
      SOL_MINT,
      tokenMint,
      amountLamports
    );
  } else {
    // SELL: Token → SOL
    // For simplicity, assume we're selling equivalent SOL value
    // In production, you'd query the agent's token balance
    signature = await executeSwap(
      connection,
      keypair,
      tokenMint,
      SOL_MINT,
      amountLamports
    );
  }

  console.log(`\n✅ ${action} complete!`);
  console.log(`🔗 View on Solscan: https://solscan.io/tx/${signature}`);
  console.log(`\n${'='.repeat(60)}\n`);

  return signature;
}

/**
 * Auto-create agent in database if doesn't exist
 * 
 * Called automatically when webhook detects a trade from an agent wallet
 */
export async function ensureAgentExists(walletAddress: string): Promise<void> {
  // Check if agent already exists
  // Note: userId in TradingAgent stores the wallet pubkey
  const existingAgent = await prisma.tradingAgent.findFirst({
    where: { userId: walletAddress },
  });

  if (existingAgent) {
    console.log(`✅ Agent already exists: ${existingAgent.name}`);
    return;
  }

  // Find agent config
  const agentConfig = ALL_AGENTS.find(a => a.walletAddress === walletAddress);
  if (!agentConfig) {
    console.log(`⚠️  Unknown wallet ${walletAddress}, creating generic agent`);
    // Create generic agent
    await prisma.tradingAgent.create({
      data: {
        userId: walletAddress, // Store wallet as userId
        name: `Agent-${walletAddress.slice(0, 8)}`,
        archetypeId: 'smart_money',
        config: {},
      },
    });
    return;
  }

  // Create agent from config
  console.log(`🆕 Creating agent: ${agentConfig.name}`);
  await prisma.tradingAgent.create({
    data: {
      userId: walletAddress, // Store wallet as userId
      name: agentConfig.name,
      archetypeId: agentConfig.riskLevel === 'HIGH' ? 'degen_hunter' : 'smart_money',
      config: {
        riskLevel: agentConfig.riskLevel,
        aggression: agentConfig.aggression,
        patience: agentConfig.patience,
        tokenWatchlist: agentConfig.tokenWatchlist,
        maxPositionSize: agentConfig.maxPositionSize,
      },
    },
  });

  console.log(`✅ Agent created: ${agentConfig.name} (${walletAddress})`);
}
