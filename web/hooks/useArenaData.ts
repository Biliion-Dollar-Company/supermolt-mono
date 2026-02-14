import useSWR from 'swr';
import { getLeaderboard, getEpochRewards, getMyAgent, getXPLeaderboard } from '@/lib/api';
import type { Agent, EpochReward, AgentMeResponse, XPLeaderboardEntry } from '@/lib/types';

// SWR keys — shared across components for automatic deduplication
const KEYS = {
  leaderboard: '/arena/leaderboard',
  epochRewards: '/arena/epoch/rewards',
  myAgent: '/arena/me',
  xpLeaderboard: '/arena/leaderboard/xp',
} as const;

// Default SWR config for arena data: show stale data instantly, revalidate in background
const ARENA_SWR_CONFIG = {
  revalidateOnFocus: false,
  dedupingInterval: 5000, // deduplicate requests within 5s window
};

export function useLeaderboard() {
  return useSWR<Agent[]>(KEYS.leaderboard, getLeaderboard, {
    ...ARENA_SWR_CONFIG,
    refreshInterval: 10000,
  });
}

export function useEpochRewards() {
  return useSWR<EpochReward>(KEYS.epochRewards, getEpochRewards, {
    ...ARENA_SWR_CONFIG,
    refreshInterval: 10000,
  });
}

export function useMyAgent(isAuthenticated: boolean) {
  return useSWR<AgentMeResponse>(
    isAuthenticated ? KEYS.myAgent : null, // null key = don't fetch
    getMyAgent,
    {
      ...ARENA_SWR_CONFIG,
      refreshInterval: 30000,
    }
  );
}

export function useXPLeaderboard() {
  return useSWR<XPLeaderboardEntry[]>(KEYS.xpLeaderboard, getXPLeaderboard, {
    ...ARENA_SWR_CONFIG,
    refreshInterval: 30000,
  });
}
