/**
 * ERC-8004 Identity Service
 * Register and manage AI agent identities on-chain
 */

import { db } from '../lib/db';
import { uploadToIPFS } from '../lib/ipfs';
import { createERC8004Client } from '../contracts/client';
import { keyManager } from './key-manager.service';

const RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY';
const NETWORK = (process.env.ETHEREUM_NETWORK || 'sepolia') as 'sepolia' | 'arbitrumSepolia' | 'arbitrum' | 'baseSepolia' | 'base';

// Warn at startup if key is absent; actual reads go through keyManager at call time
if (!keyManager.getKey('ETHEREUM_PRIVATE_KEY', 'erc8004-identity')) {
  console.warn('[ERC-8004 Identity] ETHEREUM_PRIVATE_KEY not set — contract writes will fail');
}

export interface AgentRegistrationResult {
  onChainId: number;
  ipfsUri: string;
  txHash: string;
}

/**
 * Register a SuperMolt trading agent on-chain as ERC-8004 identity
 */
export async function registerAgentOnChain(agentId: string): Promise<AgentRegistrationResult> {
  // 1. Fetch agent from database
  const agent = await db.tradingAgent.findUnique({
    where: { id: agentId },
  });

  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  if (agent.onChainAgentId) {
    throw new Error(`Agent ${agentId} already registered with on-chain ID ${agent.onChainAgentId}`);
  }

  // 2. Build ERC-8004 registration JSON
  const registration = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: agent.displayName || agent.name,
    description: `AI trading agent - ${agent.archetypeId} strategy on ${agent.chain}`,
    image: agent.avatarUrl || undefined,
    services: [
      {
        name: 'web',
        endpoint: `https://www.supermolt.xyz/agents/${agentId}`,
      },
    ],
    supportedTrust: ['reputation', 'validation'],
    metadata: {
      archetypeId: agent.archetypeId,
      chain: agent.chain,
      level: agent.level,
      xp: agent.xp,
      totalTrades: agent.totalTrades,
      winRate: agent.winRate.toString(),
      totalPnl: agent.totalPnl.toString(),
    },
  };

  // 3. Upload to IPFS
  const ipfsUri = await uploadToIPFS(registration);
  console.log(`[Identity] Uploaded registration for ${agent.name} to ${ipfsUri}`);

  // 4. Register on-chain
  const client = createERC8004Client(
    RPC_URL,
    NETWORK,
    keyManager.getKey('ETHEREUM_PRIVATE_KEY', 'erc8004-identity') ?? undefined,
  );
  const onChainId = await client.registerAgent(ipfsUri);

  // 5. Update database
  await db.tradingAgent.update({
    where: { id: agentId },
    data: {
      onChainAgentId: onChainId.toString(),
      registrationURI: ipfsUri,
    },
  });

  console.log(`[Identity] Registered agent ${agent.name} with on-chain ID ${onChainId}`);

  // Get transaction hash from last transaction
  const txHash = 'pending'; // ethers v6 doesn't expose tx hash directly from receipt easily
  
  return {
    onChainId,
    ipfsUri,
    txHash,
  };
}

/**
 * Update agent metadata on-chain
 */
export async function updateAgentMetadata(
  agentId: string,
  key: string,
  value: string
): Promise<void> {
  const agent = await db.tradingAgent.findUnique({
    where: { id: agentId },
  });

  if (!agent?.onChainAgentId) {
    throw new Error(`Agent ${agentId} not registered on-chain`);
  }

  const client = createERC8004Client(
    RPC_URL,
    NETWORK,
    keyManager.getKey('ETHEREUM_PRIVATE_KEY', 'erc8004-identity') ?? undefined,
  );
  await client.setAgentMetadata(Number(agent.onChainAgentId), key, value);

  console.log(`[Identity] Updated metadata ${key}=${value} for agent ${agent.name}`);
}

/**
 * Get agent's on-chain wallet address
 */
export async function getAgentWallet(agentId: string): Promise<string | null> {
  const agent = await db.tradingAgent.findUnique({
    where: { id: agentId },
  });

  if (!agent?.onChainAgentId) {
    return null;
  }

  const client = createERC8004Client(RPC_URL, NETWORK);
  const wallet = await client.getAgentWallet(Number(agent.onChainAgentId));

  return wallet;
}

/**
 * Bulk register all unregistered agents
 */
export async function registerAllAgents(): Promise<{
  registered: number;
  failed: number;
  skipped: number;
}> {
  const agents = await db.tradingAgent.findMany({
    where: {
      onChainAgentId: null,
    },
  });

  console.log(`[Identity] Found ${agents.length} unregistered agents`);

  let registered = 0;
  let failed = 0;

  for (const agent of agents) {
    try {
      await registerAgentOnChain(agent.id);
      registered++;
      
      // Rate limit to avoid spamming RPC
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`[Identity] Failed to register ${agent.name}:`, error.message);
      failed++;
    }
  }

  return {
    registered,
    failed,
    skipped: 0,
  };
}

/**
 * Get agent registration details from chain
 */
export async function getAgentRegistration(agentId: string): Promise<{
  onChainId: number;
  tokenURI: string;
  owner: string;
  wallet: string;
} | null> {
  const agent = await db.tradingAgent.findUnique({
    where: { id: agentId },
  });

  if (!agent?.onChainAgentId) {
    return null;
  }

  const client = createERC8004Client(RPC_URL, NETWORK);
  const onChainId = Number(agent.onChainAgentId);

  const [tokenURI, owner, wallet] = await Promise.all([
    client.getAgentTokenURI(onChainId),
    client.getAgentOwner(onChainId),
    client.getAgentWallet(onChainId),
  ]);

  return {
    onChainId,
    tokenURI,
    owner,
    wallet,
  };
}
