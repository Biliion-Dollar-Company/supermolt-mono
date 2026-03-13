import { Connection, PublicKey, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { PumpAgent, getTokenAgentPaymentsPDA, getBuybackAuthorityPDA } from '@pump-fun/agent-payments-sdk';
import { db } from '../lib/db';

// USDC mint on mainnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Service price tiers (in USDC, 6 decimals)
export const SIGNAL_PRICE_USDC = 1_000_000n; // $1 USDC
export const ANALYSIS_PRICE_USDC = 5_000_000n; // $5 USDC

export type ServiceType = 'signal' | 'analysis' | 'positions';

export interface InvoiceParams {
  agentId: string;
  userPubkey: string;
  service: ServiceType;
  currencyMint?: string;
}

export interface InvoiceResult {
  transaction: string; // base64 serialized transaction
  invoiceData: {
    amount: string;
    memo: string;
    startTime: number;
    endTime: number;
    currencyMint: string;
  };
}

export interface ValidatePaymentParams {
  agentId: string;
  userPubkey: string;
  service: ServiceType;
  currencyMint: string;
  amount: string;
  memo: string;
  startTime: number;
  endTime: number;
}

function getConnection(): Connection {
  const rpcUrl = process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

function getServicePrice(service: ServiceType): bigint {
  switch (service) {
    case 'signal': return SIGNAL_PRICE_USDC;
    case 'analysis': return ANALYSIS_PRICE_USDC;
    case 'positions': return ANALYSIS_PRICE_USDC;
    default: return SIGNAL_PRICE_USDC;
  }
}

async function getAgentOrThrow(agentId: string) {
  const agent = await db.tradingAgent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error('Agent not found');
  if (!agent.pumpFunMint) throw new Error('Agent has no pump.fun token configured');
  return agent;
}

export async function generateInvoice(params: InvoiceParams): Promise<InvoiceResult> {
  const agent = await getAgentOrThrow(params.agentId);
  const mint = new PublicKey(agent.pumpFunMint!);
  const pumpAgent = new PumpAgent(mint, 'mainnet', getConnection());

  const currencyMint = params.currencyMint ? new PublicKey(params.currencyMint) : USDC_MINT;
  const amount = getServicePrice(params.service);
  const memo = BigInt(Math.floor(Math.random() * 1_000_000));
  const startTime = BigInt(Math.floor(Date.now() / 1000));
  const endTime = startTime + 300n; // 5 min window
  const user = new PublicKey(params.userPubkey);

  const instructions = await pumpAgent.buildAcceptPaymentInstructions({
    user,
    currencyMint,
    amount,
    memo,
    startTime,
    endTime,
    computeUnitLimit: 150_000,
    computeUnitPrice: 1_000,
  });

  const connection = getConnection();
  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  const serialized = Buffer.from(tx.serialize()).toString('base64');

  return {
    transaction: serialized,
    invoiceData: {
      amount: amount.toString(),
      memo: memo.toString(),
      startTime: Number(startTime),
      endTime: Number(endTime),
      currencyMint: currencyMint.toBase58(),
    },
  };
}

export async function validateAndDeliverService(params: ValidatePaymentParams): Promise<{ valid: boolean; payload?: unknown }> {
  const agent = await getAgentOrThrow(params.agentId);
  const mint = new PublicKey(agent.pumpFunMint!);
  const pumpAgent = new PumpAgent(mint, 'mainnet', getConnection());

  const valid = await pumpAgent.validateInvoicePayment({
    user: new PublicKey(params.userPubkey),
    currencyMint: new PublicKey(params.currencyMint),
    amount: Number(params.amount),
    memo: Number(params.memo),
    startTime: params.startTime,
    endTime: params.endTime,
  });

  if (!valid) return { valid: false };

  let payload: unknown;
  if (params.service === 'signal' || params.service === 'positions') {
    const positions = await db.agentPosition.findMany({
      where: { agentId: params.agentId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    payload = positions;
  } else if (params.service === 'analysis') {
    const trades = await db.paperTrade.findMany({
      where: { agentId: params.agentId },
      orderBy: { openedAt: 'desc' },
      take: 20,
    });
    payload = trades;
  }

  return { valid: true, payload };
}

export async function getVaultBalances(agentId: string) {
  const agent = await getAgentOrThrow(agentId);
  const mint = new PublicKey(agent.pumpFunMint!);
  const pumpAgent = new PumpAgent(mint, 'mainnet', getConnection());

  const [paymentPDA] = getTokenAgentPaymentsPDA(mint);
  const [buybackPDA] = getBuybackAuthorityPDA(mint);

  const usdcBalances = await pumpAgent.getBalances(USDC_MINT);

  return {
    mint: agent.pumpFunMint,
    buybackBps: agent.buybackBps,
    depositAddress: paymentPDA.toBase58(),
    buybackAuthority: buybackPDA.toBase58(),
    vaults: {
      payment: {
        address: usdcBalances.paymentVault.address.toBase58(),
        balanceUsdc: (Number(usdcBalances.paymentVault.balance) / 1_000_000).toFixed(2),
      },
      buyback: {
        address: usdcBalances.buybackVault.address.toBase58(),
        balanceUsdc: (Number(usdcBalances.buybackVault.balance) / 1_000_000).toFixed(2),
      },
      withdraw: {
        address: usdcBalances.withdrawVault.address.toBase58(),
        balanceUsdc: (Number(usdcBalances.withdrawVault.balance) / 1_000_000).toFixed(2),
      },
    },
  };
}

export async function setAgentToken(agentId: string, pumpFunMint: string, buybackBps: number) {
  new PublicKey(pumpFunMint); // throws if invalid

  const [depositPDA] = getTokenAgentPaymentsPDA(new PublicKey(pumpFunMint));

  return db.tradingAgent.update({
    where: { id: agentId },
    data: {
      pumpFunMint,
      buybackBps,
      depositAddress: depositPDA.toBase58(),
    },
  });
}
