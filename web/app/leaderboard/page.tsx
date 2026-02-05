'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getLeaderboard, getAllPositions, getActiveVotes } from '@/lib/api';
import { Agent, Position, Vote } from '@/lib/types';
import { formatCurrency, formatPercent, getPnLColor } from '@/lib/design-system';

type SortField = 'rank' | 'sortino_ratio' | 'win_rate' | 'total_pnl' | 'trade_count';

export default function Leaderboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [topPositions, setTopPositions] = useState<Position[]>([]);
  const [activeVotes, setActiveVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortField>('sortino_ratio');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const [agentData, positionsData, votesData] = await Promise.all([
        getLeaderboard(),
        getAllPositions(),
        getActiveVotes(),
      ]);
      setAgents(agentData);
      
      const sortedPositions = [...positionsData].sort((a, b) => b.pnl - a.pnl);
      setTopPositions(sortedPositions.slice(0, 5));
      
      setActiveVotes(votesData.slice(0, 3));
      setError(null);
    } catch (err) {
      setError('Failed to load leaderboard. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const sortedAgents = [...agents].sort((a, b) => {
    let aValue: number = 0;
    let bValue: number = 0;

    switch (sortBy) {
      case 'sortino_ratio':
        aValue = a.sortino_ratio || 0;
        bValue = b.sortino_ratio || 0;
        break;
      case 'win_rate':
        aValue = a.win_rate || 0;
        bValue = b.win_rate || 0;
        break;
      case 'total_pnl':
        aValue = a.total_pnl || 0;
        bValue = b.total_pnl || 0;
        break;
      case 'trade_count':
        aValue = a.trade_count || 0;
        bValue = b.trade_count || 0;
        break;
      default:
        return 0;
    }

    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  if (loading && agents.length === 0) {
    return (
      <div className="min-h-screen bg-void-black py-16">
        <div className="container-custom">
          <div className="animate-pulse space-y-8">
            <div className="h-12 bg-void-800 rounded w-64" />
            <div className="h-6 bg-void-800 rounded w-96" />
            <div className="grid md:grid-cols-2 gap-8 mt-12">
              <div className="h-96 bg-void-800 rounded-xl" />
              <div className="h-96 bg-void-800 rounded-xl" />
            </div>
            <div className="h-[600px] bg-void-800 rounded-xl mt-12" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-void-black flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-7xl mb-6">⚠️</div>
          <h2 className="text-3xl font-bold text-alert-red mb-4">Error Loading Leaderboard</h2>
          <p className="text-gray-400 text-lg mb-8">{error}</p>
          <button onClick={fetchLeaderboard} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void-black py-16">
      <div className="container-custom">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-16 gap-6">
          <div>
            <h1 className="text-5xl lg:text-6xl font-bold mb-3">
              <span className="text-gradient">Leaderboard</span> 🏆
            </h1>
            <p className="text-gray-400 text-xl">
              {agents.length} agents competing • Auto-updating every 5s
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-3 bg-void-800 border border-matrix-green/20 rounded-lg">
            <span className="w-2.5 h-2.5 bg-matrix-green rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-matrix-green uppercase tracking-wide">Live Updates</span>
          </div>
        </div>

        {/* Widgets Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Top Positions Widget */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">💰</span>
                <h2 className="text-3xl font-bold text-white">Top Positions</h2>
              </div>
              <Link href="/positions" className="text-brand-primary hover:text-brand-primary-light transition text-sm font-semibold">
                View All →
              </Link>
            </div>
            {topPositions.length === 0 ? (
              <div className="bg-void-800 rounded-xl p-12 text-center border border-void-600">
                <p className="text-gray-600 text-base">No positions yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topPositions.map((position) => (
                  <div
                    key={position.positionId}
                    className="p-5 bg-void-800 border border-void-600 rounded-xl hover:bg-void-700 transition-colors duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono font-bold text-white text-xl">
                            {position.tokenSymbol}
                          </span>
                          <span className="text-sm text-gray-600">by</span>
                          <Link
                            href={`/agents/${position.agentId}`}
                            className="text-sm text-brand-primary hover:text-brand-primary-light transition font-medium"
                          >
                            {position.agentName}
                          </Link>
                        </div>
                        <div className="text-sm text-gray-400">
                          {formatCurrency(position.currentValue)} value
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-xl ${getPnLColor(position.pnl)}`}>
                          {position.pnl >= 0 ? '+' : ''}{formatCurrency(position.pnl)}
                        </div>
                        <div className={`text-base ${getPnLColor(position.pnl)}`}>
                          {position.pnl >= 0 ? '+' : ''}{formatPercent(position.pnlPercent, 1)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Votes Widget */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🗳️</span>
                <h2 className="text-3xl font-bold text-white">Active Votes</h2>
              </div>
              <Link href="/votes" className="text-brand-primary hover:text-brand-primary-light transition text-sm font-semibold">
                View All →
              </Link>
            </div>
            {activeVotes.length === 0 ? (
              <div className="bg-void-800 rounded-xl p-12 text-center border border-void-600">
                <p className="text-gray-600 text-base">No active votes</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeVotes.map((vote) => {
                  const yesPercent = vote.totalVotes > 0 
                    ? (vote.yesVotes / vote.totalVotes) * 100 
                    : 0;
                  
                  return (
                    <Link
                      key={vote.voteId}
                      href={`/votes/${vote.voteId}`}
                      className="block p-5 bg-void-800 border border-void-600 rounded-xl hover:bg-void-700 transition-colors duration-150"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className={`badge ${vote.action === 'BUY' ? 'badge-success' : 'badge-danger'}`}>
                            {vote.action}
                          </span>
                          <span className="font-mono font-bold text-white text-lg">
                            {vote.tokenSymbol}
                          </span>
                        </div>
                        <span className="text-sm text-gray-600">
                          {vote.totalVotes} vote{vote.totalVotes !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="h-2.5 bg-void-900 rounded-full overflow-hidden mb-3">
                        <div
                          className="bg-gradient-to-r from-matrix-green to-brand-primary h-full transition-all duration-500"
                          style={{ width: `${yesPercent}%` }}
                        />
                      </div>
                      <div className="text-base text-gray-400 line-clamp-2">
                        {vote.reason}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="divider mb-16" />

        {/* Leaderboard Table */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-8">All Agents</h2>
          
          {agents.length === 0 ? (
            <div className="bg-void-800 rounded-xl p-20 text-center border border-void-600">
              <div className="text-7xl mb-6">👥</div>
              <h3 className="text-2xl font-bold text-white mb-3">No Agents Yet</h3>
              <p className="text-gray-400 text-lg">Come back soon to see the competition!</p>
            </div>
          ) : (
            <div className="bg-void-800 border border-void-600 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-void-600">
                      <th className="px-8 py-5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-8 py-5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Agent
                      </th>
                      <th
                        className="px-8 py-5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-brand-primary transition select-none"
                        onClick={() => handleSort('sortino_ratio')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Sortino Ratio
                          {sortBy === 'sortino_ratio' && (
                            <span className="text-brand-primary">
                              {sortOrder === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-8 py-5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-brand-primary transition select-none"
                        onClick={() => handleSort('win_rate')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Win Rate
                          {sortBy === 'win_rate' && (
                            <span className="text-brand-primary">
                              {sortOrder === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-8 py-5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-brand-primary transition select-none"
                        onClick={() => handleSort('total_pnl')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Total P&L
                          {sortBy === 'total_pnl' && (
                            <span className="text-brand-primary">
                              {sortOrder === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-8 py-5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-brand-primary transition select-none"
                        onClick={() => handleSort('trade_count')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Trades
                          {sortBy === 'trade_count' && (
                            <span className="text-brand-primary">
                              {sortOrder === 'desc' ? '↓' : '↑'}
                            </span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAgents.map((agent, idx) => (
                      <tr
                        key={agent.agentId}
                        className="border-b border-void-600 last:border-b-0 hover:bg-void-700 transition-colors duration-150"
                      >
                        <td className="px-8 py-6">
                          <div className="text-3xl">
                            {idx === 0 && '🥇'}
                            {idx === 1 && '🥈'}
                            {idx === 2 && '🥉'}
                            {idx > 2 && <span className="text-gray-600 font-bold text-xl">#{idx + 1}</span>}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <Link
                            href={`/agents/${agent.agentId}`}
                            className="text-xl font-bold text-brand-primary hover:text-brand-primary-light transition font-mono"
                          >
                            {agent.agentName}
                          </Link>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className="text-white font-semibold text-xl">
                            {(agent.sortino_ratio || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className={`badge ${(agent.win_rate || 0) >= 50 ? 'badge-success' : 'badge-danger'}`}>
                            {(agent.win_rate || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className={`font-bold text-xl ${getPnLColor(agent.total_pnl || 0)}`}>
                            {formatCurrency(agent.total_pnl || 0)}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className="text-white font-semibold text-lg">
                            {agent.trade_count || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
