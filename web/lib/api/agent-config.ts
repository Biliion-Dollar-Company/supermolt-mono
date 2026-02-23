import { api } from '../api';

export interface TrackedWallet {
  id?: string;
  address: string;
  label?: string;
  chain?: 'SOLANA' | 'BSC';
  createdAt?: string;
}

export interface BuyTrigger {
  id?: string;
  type: 'consensus' | 'volume' | 'liquidity' | 'godwallet' | 'trending';
  enabled: boolean;
  config: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentConfiguration {
  archetypeId?: string;
  config?: Record<string, any>;
  trackedWallets: TrackedWallet[];
  buyTriggers: BuyTrigger[];
}

export interface ConfigUpdatePayload {
  archetypeId?: string;
  trackedWallets?: TrackedWallet[];
  triggers?: BuyTrigger[];
}

/**
 * Get agent configuration
 */
export async function getAgentConfig(token: string): Promise<AgentConfiguration> {
  const response = await api.get<{ success: boolean; data: AgentConfiguration }>('/arena/me/config', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.data;
}

/**
 * Update agent configuration
 */
export async function updateAgentConfig(
  token: string,
  config: ConfigUpdatePayload
): Promise<void> {
  await api.put('/arena/me/config', config, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Add a tracked wallet
 */
export async function addTrackedWallet(
  token: string,
  wallet: TrackedWallet
): Promise<TrackedWallet> {
  const response = await api.post<{ success: boolean; data: TrackedWallet }>(
    '/arena/me/wallets',
    wallet,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.data.data;
}

/**
 * Remove a tracked wallet
 */
export async function removeTrackedWallet(token: string, walletId: string): Promise<void> {
  await api.delete(`/arena/me/wallets/${walletId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
