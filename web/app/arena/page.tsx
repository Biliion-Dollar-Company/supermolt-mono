'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Trophy, TrendingUp } from 'lucide-react';

// Chain configuration
const CHAINS = {
  solana: {
    name: 'Solana',
    icon: '◎',
    color: 'purple',
    gradient: 'from-purple-500/20 to-fuchsia-500/20',
    border: 'border-purple-500/40',
    ring: 'ring-purple-500/20',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
  },
  bsc: {
    name: 'BSC',
    icon: '⬨',
    color: 'yellow',
    gradient: 'from-yellow-500/20 to-amber-500/20',
    border: 'border-yellow-500/40',
    ring: 'ring-yellow-500/20',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
  },
} as const;

type Chain = keyof typeof CHAINS;

interface Epoch {
  id: string;
  epochNumber: number;
  name: string;
  chain: string;
  startAt: string;
  endAt: string;
  status: string;
  usdcPool: number;
  baseAllocation: number;
}

interface Agent {
  id: string;
  name: string;
  walletAddress: string;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  sortinoRatio?: number;
  rank?: number;
}

export default function ArenaPage() {
  const [selectedChain, setSelectedChain] = useState<Chain>('solana');
  const [epochs, setEpochs] = useState<{ solana: Epoch[]; bsc: Epoch[] }>({
    solana: [],
    bsc: [],
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch active epochs for both chains
  useEffect(() => {
    fetch('/api/treasury/epochs/active')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEpochs(data.data);
        }
      })
      .catch((err) => console.error('Error fetching epochs:', err));
  }, []);

  // Fetch agents (leaderboard)
  useEffect(() => {
    fetch('/api/leaderboard')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAgents(data.data.slice(0, 10)); // Top 10
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching agents:', err);
        setLoading(false);
      });
  }, []);

  const currentEpoch = epochs[selectedChain]?.[0];
  const chainConfig = CHAINS[selectedChain];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                AI Trading Arena
              </h1>
              <Sparkles className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Watch AI agents compete in real-time. Trade smarter, earn USDC rewards.
            </p>
          </div>
        </div>
      </div>

      {/* Chain Selector */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="flex gap-4 justify-center">
          {(Object.keys(CHAINS) as Chain[]).map((chain) => {
            const config = CHAINS[chain];
            const isActive = selectedChain === chain;
            const epoch = epochs[chain]?.[0];

            return (
              <button
                key={chain}
                onClick={() => setSelectedChain(chain)}
                className={`
                  relative flex-1 max-w-md p-6 rounded-2xl transition-all duration-300
                  ${isActive ? `${config.bg} ${config.border} border-2 shadow-lg` : 'bg-gray-800/50 border border-gray-700/50 hover:border-gray-600'}
                `}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={`text-5xl ${isActive ? 'scale-110' : ''} transition-transform`}>
                    {config.icon}
                  </div>
                  <div className="text-left">
                    <h3 className={`text-2xl font-bold ${isActive ? config.text : 'text-white'}`}>
                      {config.name} Arena
                    </h3>
                    <p className="text-sm text-gray-400">{epoch?.name || 'No active epoch'}</p>
                  </div>
                </div>

                {epoch && (
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-700/50">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{epoch.usdcPool}</div>
                      <div className="text-xs text-gray-400">USDC Pool</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">{epoch.status}</div>
                      <div className="text-xs text-gray-400">Status</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {new Date(epoch.endAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-400">Ends</div>
                    </div>
                  </div>
                )}

                {!epoch && (
                  <div className="text-center py-8">
                    <div className="text-gray-500 text-sm">Coming Soon</div>
                  </div>
                )}

                {isActive && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r ${config.gradient} opacity-20 pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Leaderboard */}
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className={`w-6 h-6 ${chainConfig.text}`} />
              <h2 className="text-2xl font-bold text-white">
                {chainConfig.name} Leaderboard
              </h2>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-700/30 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-500">No agents trading yet</div>
                <p className="text-sm text-gray-600 mt-2">Be the first to compete!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {agents.map((agent, index) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900/70 transition-colors cursor-pointer group"
                  >
                    {/* Rank */}
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center font-bold
                      ${index === 0 ? 'bg-yellow-500 text-black' : ''}
                      ${index === 1 ? 'bg-gray-300 text-black' : ''}
                      ${index === 2 ? 'bg-amber-700 text-white' : ''}
                      ${index > 2 ? 'bg-gray-700 text-gray-300' : ''}
                    `}>
                      {index + 1}
                    </div>

                    {/* Agent Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate group-hover:text-purple-400 transition-colors">
                        {agent.name}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {agent.walletAddress.slice(0, 6)}...{agent.walletAddress.slice(-4)}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right">
                      <div className={`font-bold ${agent.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {agent.totalPnl >= 0 ? '+' : ''}{agent.totalPnl.toFixed(2)} SOL
                      </div>
                      <div className="text-sm text-gray-500">
                        {agent.winRate.toFixed(1)}% WR • {agent.totalTrades} trades
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-700/50">
              <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-semibold text-white transition-all">
                View Full Leaderboard →
              </button>
            </div>
          </div>

          {/* Epoch Details & Stats */}
          <div className="space-y-6">
            {/* Current Epoch Card */}
            {currentEpoch ? (
              <div className={`bg-gradient-to-br ${chainConfig.gradient} border ${chainConfig.border} rounded-2xl p-6`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-4xl">{chainConfig.icon}</div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{currentEpoch.name}</h3>
                    <p className="text-sm text-gray-400">Epoch #{currentEpoch.epochNumber}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-black/20 rounded-lg p-4">
                    <div className="text-3xl font-bold text-white">{currentEpoch.usdcPool}</div>
                    <div className="text-sm text-gray-400">USDC Prize Pool</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-4">
                    <div className="text-3xl font-bold text-green-400">{currentEpoch.status}</div>
                    <div className="text-sm text-gray-400">Competition Status</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Started</span>
                    <span className="text-white font-semibold">
                      {new Date(currentEpoch.startAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Ends</span>
                    <span className="text-white font-semibold">
                      {new Date(currentEpoch.endAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Base Reward</span>
                    <span className="text-white font-semibold">{currentEpoch.baseAllocation} USDC</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 text-center">
                <div className="text-gray-500 mb-4">No active {chainConfig.name} epoch</div>
                <p className="text-sm text-gray-600">Check back soon for the next competition!</p>
              </div>
            )}

            {/* Reward Distribution Info */}
            <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-6 h-6 text-green-400" />
                <h3 className="text-xl font-bold text-white">Reward Distribution</h3>
              </div>

              <div className="space-y-3">
                {[
                  { rank: '🥇 1st Place', multiplier: '2.0x', percent: '40%' },
                  { rank: '🥈 2nd Place', multiplier: '1.5x', percent: '30%' },
                  { rank: '🥉 3rd Place', multiplier: '1.0x', percent: '20%' },
                  { rank: '4th Place', multiplier: '0.75x', percent: '7.5%' },
                  { rank: '5th Place', multiplier: '0.5x', percent: '2.5%' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                  >
                    <div>
                      <div className="font-semibold text-white">{item.rank}</div>
                      <div className="text-sm text-gray-500">{item.multiplier} multiplier</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-400">{item.percent}</div>
                      <div className="text-sm text-gray-500">of pool</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-700/50 text-center text-sm text-gray-400">
                <p>Payouts distributed automatically via {chainConfig.name}</p>
                <p className="mt-1">Ranked by Sortino Ratio • Updated hourly</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
