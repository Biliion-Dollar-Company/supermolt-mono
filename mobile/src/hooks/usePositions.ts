import { useState, useCallback, useEffect } from 'react';
import type { PositionData } from '@/components/trading';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

// Mock data matching superRouter PositionProgressCard structure
// Using pump.fun style tokens
const MOCK_POSITIONS: PositionData[] = [
  {
    id: '1',
    mint: 'HJAoYbnsf16Z8xqPqBgBaW6gbANJkhZ6RkKh9LLxpump',
    ticker: 'WOJAK',
    tokenName: 'Wojak',
    localImage: 'pump-fun',
    entryMcap: 400000000,
    entrySolValue: 0.5,
    entryTime: new Date(Date.now() - 180000).toISOString(),
    currentMcap: 1000000000,
    multiplier: 2.5,
    pnlPct: 150,
    pnlSol: 0.75,
    peakPnlPct: 165,
    nextTarget: 3.0,
    targetProgress: 0.75,
    targetsHit: [1, 2],
    buySignature: '3xK9vH2mNpQrT5wL8yZ1cB4dF6gJ7hM0nS2aE5iU8oP',
  },
  {
    id: '2',
    mint: '9RtqVz3BcKfNwX5mL2pHjY8dC1eA4sG6hT7uI0oMpump',
    ticker: 'GIGA',
    tokenName: 'GigaChad',
    entryMcap: 28000,
    entrySolValue: 0.3,
    entryTime: new Date(Date.now() - 120000).toISOString(),
    currentMcap: 40320,
    multiplier: 1.44,
    pnlPct: 44,
    pnlSol: 0.132,
    peakPnlPct: 52,
    nextTarget: 1.5,
    targetProgress: 0.88,
    targetsHit: [],
    buySignature: '7mK2nL5pQ8rS1tU4vW6xY9zA3bC0dE5fG7hI8jK1lM',
  },
  {
    id: '3',
    mint: '5PqR8sT2uV4wX6yZ1aB3cD5eF7gH9iJ0kL2mN4oPpump',
    ticker: 'MOCHI',
    tokenName: 'Mochi Cat',
    entryMcap: 65000,
    entrySolValue: 0.4,
    entryTime: new Date(Date.now() - 240000).toISOString(),
    currentMcap: 52000,
    multiplier: 0.8,
    pnlPct: -20,
    pnlSol: -0.08,
    peakPnlPct: 15,
    nextTarget: 1.5,
    targetProgress: 0,
    targetsHit: [],
  },
  {
    id: '4',
    mint: '2LmN4oP6qR8sT0uV2wX4yZ6aB8cD0eF2gH4iJ6kLpump',
    ticker: 'LARRY',
    tokenName: 'Larry the Lobster',
    entryMcap: 38000,
    entrySolValue: 0.8,
    entryTime: new Date(Date.now() - 60000).toISOString(),
    currentMcap: 79800,
    multiplier: 2.1,
    pnlPct: 110,
    pnlSol: 0.88,
    peakPnlPct: 125,
    nextTarget: 3.0,
    targetProgress: 0.55,
    targetsHit: [1, 2],
    buySignature: '4nO6pQ8rS0tU2vW4xY6zA8bC0dE2fG4hI6jK8lM0nO',
  },
];

export function usePositions() {
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      setIsLoading(true);
      // Updated endpoint to match trench backend
      const response = await fetch(`${API_URL}/positions/agents/wallet/positions`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Map API response to PositionData type
        const mapped: PositionData[] = data.data.map((p: any) => ({
          id: p.id,
          mint: p.token_mint || p.mint,
          ticker: p.ticker || p.symbol,
          tokenName: p.token_name || p.name,
          imageUrl: p.image_url,
          entryMcap: p.entry_mcap || p.entry_market_cap,
          entrySolValue: p.entry_sol_value || p.invested_sol,
          entryTime: p.entry_time || p.created_at,
          currentMcap: p.current_mcap || p.current_market_cap,
          multiplier: p.multiplier,
          pnlPct: p.pnl_pct,
          pnlSol: p.pnl_sol,
          peakPnlPct: p.peak_pnl_pct || 0,
          nextTarget: p.next_target,
          targetProgress: p.target_progress,
          targetsHit: p.targets_hit || [],
          buySignature: p.buy_signature,
        }));
        setPositions(mapped);
      } else {
        // Use mock data
        setPositions(MOCK_POSITIONS);
      }
    } catch (err) {
      console.log('[Positions] API unavailable, using mock data');
      setPositions(MOCK_POSITIONS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Calculate totals
  const totalValue = positions.reduce((sum, p) => {
    return sum + p.entrySolValue + p.pnlSol;
  }, 0);

  const totalPnl = positions.reduce((sum, p) => sum + p.pnlSol, 0);
  const totalInvested = positions.reduce((sum, p) => sum + p.entrySolValue, 0);
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  useEffect(() => {
    fetchPositions();
  }, []);

  return {
    positions,
    totalValue,
    pnl: {
      value: totalPnl,
      percentage: totalPnlPct,
    },
    isLoading,
    error,
    refresh: fetchPositions,
  };
}
