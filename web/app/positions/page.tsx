'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { getAllPositions } from '@/lib/api';
import { Position } from '@/lib/types';
import { getWebSocketManager } from '@/lib/websocket';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Container } from '@/components/Container';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { formatCurrency, formatPercent, getPnLColor } from '@/lib/design-system';

type FilterType = 'all' | 'positive' | 'negative';
type ViewMode = 'grid' | 'table';

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [tokenFilter, setTokenFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const data = await getAllPositions();
        setPositions(data);
      } catch (error) {
        console.error('Error fetching positions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();

    // Set up refresh interval (5 seconds)
    const interval = setInterval(() => {
      fetchPositions();
      setLastUpdate(new Date());
    }, 5000);

    // Set up WebSocket listeners
    const ws = getWebSocketManager();
    const unsubscribeOpen = ws.onPositionOpened(() => {
      fetchPositions();
    });
    const unsubscribeClose = ws.onPositionClosed(() => {
      fetchPositions();
    });
    const unsubscribePrice = ws.onPriceUpdate(() => {
      fetchPositions();
    });

    return () => {
      clearInterval(interval);
      unsubscribeOpen();
      unsubscribeClose();
      unsubscribePrice();
    };
  }, []);

  // Get unique agents and tokens for filters
  const uniqueAgents = useMemo(() => {
    const agents = Array.from(new Set(positions.map(p => p.agentName))).sort();
    return agents;
  }, [positions]);

  const uniqueTokens = useMemo(() => {
    const tokens = Array.from(new Set(positions.map(p => p.tokenSymbol))).sort();
    return tokens;
  }, [positions]);

  // Filter positions
  const filteredPositions = useMemo(() => {
    return positions.filter(position => {
      if (filter === 'positive' && position.pnl <= 0) return false;
      if (filter === 'negative' && position.pnl >= 0) return false;
      if (agentFilter !== 'all' && position.agentName !== agentFilter) return false;
      if (tokenFilter !== 'all' && position.tokenSymbol !== tokenFilter) return false;
      return true;
    });
  }, [positions, filter, agentFilter, tokenFilter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalValue = filteredPositions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalPnl = filteredPositions.reduce((sum, p) => sum + p.pnl, 0);
    const positiveCount = filteredPositions.filter(p => p.pnl > 0).length;
    const negativeCount = filteredPositions.filter(p => p.pnl < 0).length;

    return {
      totalValue,
      totalPnl,
      positiveCount,
      negativeCount,
      count: filteredPositions.length,
    };
  }, [filteredPositions]);

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-gradient-dark py-8">
        <Container>
          <div className="mb-8">
            <Skeleton width="300px" height={40} className="mb-2" />
            <Skeleton width="200px" height={20} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[...Array(5)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-dark py-8">
      <Container>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              <span className="text-gradient">Agent Positions</span> 💼
            </h1>
            <p className="text-gray-400 text-lg">Real-time view of all agent holdings</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="success" dot>
              Live · Updated {lastUpdate.toLocaleTimeString()}
            </Badge>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card padding="md" className="text-center">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-sm text-gray-400 mb-1">Total Positions</div>
            <div className="text-2xl font-bold text-gradient">{stats.count}</div>
          </Card>
          <Card padding="md" className="text-center">
            <div className="text-3xl mb-2">💰</div>
            <div className="text-sm text-gray-400 mb-1">Total Value</div>
            <div className="text-2xl font-bold text-white">{formatCurrency(stats.totalValue)}</div>
          </Card>
          <Card padding="md" className="text-center">
            <div className="text-3xl mb-2">📈</div>
            <div className="text-sm text-gray-400 mb-1">Total P&L</div>
            <div className={`text-2xl font-bold ${getPnLColor(stats.totalPnl)}`}>
              {formatCurrency(stats.totalPnl)}
            </div>
          </Card>
          <Card padding="md" className="text-center">
            <div className="text-3xl mb-2">✅</div>
            <div className="text-sm text-gray-400 mb-1">Winning</div>
            <div className="text-2xl font-bold text-green-400">{stats.positiveCount}</div>
          </Card>
          <Card padding="md" className="text-center">
            <div className="text-3xl mb-2">❌</div>
            <div className="text-sm text-gray-400 mb-1">Losing</div>
            <div className="text-2xl font-bold text-red-400">{stats.negativeCount}</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* P&L Filter */}
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-3 font-medium">P&L Filter</label>
              <div className="flex gap-2">
                <Button
                  onClick={() => setFilter('all')}
                  variant={filter === 'all' ? 'primary' : 'ghost'}
                  size="sm"
                  className="flex-1"
                >
                  All
                </Button>
                <Button
                  onClick={() => setFilter('positive')}
                  variant={filter === 'positive' ? 'success' : 'ghost'}
                  size="sm"
                  className="flex-1"
                >
                  Winning
                </Button>
                <Button
                  onClick={() => setFilter('negative')}
                  variant={filter === 'negative' ? 'danger' : 'ghost'}
                  size="sm"
                  className="flex-1"
                >
                  Losing
                </Button>
              </div>
            </div>

            {/* Agent Filter */}
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-3 font-medium">Agent</label>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="input"
              >
                <option value="all">All Agents</option>
                {uniqueAgents.map(agent => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>
            </div>

            {/* Token Filter */}
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-3 font-medium">Token</label>
              <select
                value={tokenFilter}
                onChange={(e) => setTokenFilter(e.target.value)}
                className="input"
              >
                <option value="all">All Tokens</option>
                {uniqueTokens.map(token => (
                  <option key={token} value={token}>{token}</option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex-shrink-0">
              <label className="block text-sm text-gray-400 mb-3 font-medium">View</label>
              <div className="flex gap-2">
                <Button
                  onClick={() => setViewMode('grid')}
                  variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                  size="sm"
                >
                  🔲 Grid
                </Button>
                <Button
                  onClick={() => setViewMode('table')}
                  variant={viewMode === 'table' ? 'primary' : 'ghost'}
                  size="sm"
                >
                  📊 Table
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Positions Display */}
        {filteredPositions.length === 0 ? (
          <Card className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <EmptyState title="No positions match your filters" />
          </Card>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPositions.map((position) => (
              <Card
                key={position.positionId}
                hover
                variant="elevated"
                className="group"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Link
                      href={`/agents/${position.agentId}`}
                      className="text-lg font-semibold text-trench-cyan hover:text-trench-blue transition"
                    >
                      {position.agentName}
                    </Link>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {new Date(position.openedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge
                    variant={position.pnl >= 0 ? 'success' : 'danger'}
                    size="sm"
                  >
                    {position.pnl >= 0 ? '↗' : '↘'} {formatPercent(position.pnlPercent, 1)}
                  </Badge>
                </div>

                {/* Token */}
                <div className="mb-4">
                  <div className="text-3xl font-bold font-mono text-white">
                    {position.tokenSymbol}
                  </div>
                  <div className="text-sm text-gray-400">
                    {position.quantity.toFixed(2)} tokens
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Entry Price</div>
                    <div className="text-sm font-mono text-gray-300">
                      ${position.entryPrice.toFixed(6)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Current Price</div>
                    <div className="text-sm font-mono text-white font-semibold">
                      ${position.currentPrice.toFixed(6)}
                    </div>
                  </div>
                </div>

                {/* P&L Section */}
                <div className="pt-4 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Profit & Loss</div>
                      <div className={`text-xl font-bold ${getPnLColor(position.pnl)}`}>
                        {position.pnl >= 0 ? '+' : ''}{formatCurrency(position.pnl)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">Current Value</div>
                      <div className="text-lg font-semibold text-white">
                        {formatCurrency(position.currentValue)}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          /* Table View */
          <Card padding="none" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-trench-slate/50">
                  <th className="px-6 py-4 text-left text-gray-400 font-semibold">Agent</th>
                  <th className="px-6 py-4 text-left text-gray-400 font-semibold">Token</th>
                  <th className="px-6 py-4 text-right text-gray-400 font-semibold">Quantity</th>
                  <th className="px-6 py-4 text-right text-gray-400 font-semibold">Entry</th>
                  <th className="px-6 py-4 text-right text-gray-400 font-semibold">Current</th>
                  <th className="px-6 py-4 text-right text-gray-400 font-semibold">Value</th>
                  <th className="px-6 py-4 text-right text-gray-400 font-semibold">P&L</th>
                  <th className="px-6 py-4 text-right text-gray-400 font-semibold">P&L %</th>
                  <th className="px-6 py-4 text-left text-gray-400 font-semibold">Opened</th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map((position) => (
                  <tr
                    key={position.positionId}
                    className="border-b border-gray-800 hover:bg-trench-slate/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/agents/${position.agentId}`}
                        className="text-trench-cyan hover:text-trench-blue font-semibold transition"
                      >
                        {position.agentName}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-white font-bold">
                        {position.tokenSymbol}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-white font-mono">
                      {position.quantity.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-400 font-mono text-xs">
                      ${position.entryPrice.toFixed(6)}
                    </td>
                    <td className="px-6 py-4 text-right text-white font-mono text-xs font-semibold">
                      ${position.currentPrice.toFixed(6)}
                    </td>
                    <td className="px-6 py-4 text-right text-white font-semibold">
                      {formatCurrency(position.currentValue)}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${getPnLColor(position.pnl)}`}>
                      {position.pnl >= 0 ? '+' : ''}{formatCurrency(position.pnl)}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${getPnLColor(position.pnl)}`}>
                      {position.pnl >= 0 ? '+' : ''}{formatPercent(position.pnlPercent, 1)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(position.openedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Container>
    </div>
  );
}
