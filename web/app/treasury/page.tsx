'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, BarChart3, RefreshCw, ArrowUpDown } from 'lucide-react';
import { PortfolioAllocationChart } from '@/components/rwa/PortfolioAllocationChart';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface Allocation {
  symbol: string;
  assetClass: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number | null;
  weight: number;
  value: number;
}

interface Metrics {
  totalReturn: number;
  sortinoRatio: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
}

interface PortfolioData {
  agentId: string;
  allocations: Allocation[];
  totalValue: number;
  metrics: Metrics | null;
}

interface AgentOption {
  id: string;
  name: string;
  archetypeId: string;
}

export default function TreasuryPage() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [rebalancing, setRebalancing] = useState(false);

  // Fetch agents list
  useEffect(() => {
    fetch(`${API_URL}/agents?limit=20`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.agents) {
          setAgents(data.agents);
          if (data.agents.length > 0) setSelectedAgent(data.agents[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const fetchPortfolio = useCallback(async () => {
    if (!selectedAgent) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/rwa/portfolio/${selectedAgent}`);
      if (res.ok) setPortfolio(await res.json());
    } catch { /* empty state */ } finally {
      setLoading(false);
    }
  }, [selectedAgent]);

  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

  const handleRebalance = async (strategy: string) => {
    if (!selectedAgent) return;
    setRebalancing(true);
    try {
      const res = await fetch(`${API_URL}/rwa/rebalance/${selectedAgent}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      });
      if (res.ok) {
        await fetchPortfolio();
      }
    } catch { /* ignore */ } finally {
      setRebalancing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <div className="mx-auto w-full max-w-[1260px] px-6 sm:px-10 lg:px-16 xl:px-20 2xl:px-24 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Wallet size={24} className="text-[#2563EB]" />
              <h1 className="text-xl font-semibold text-white">Portfolio Dashboard</h1>
            </div>
            <p className="text-sm text-white/30 mt-1 ml-9">AI-managed diversified portfolio across 6 asset classes</p>
          </div>
          <div className="flex items-center gap-3">
            {agents.length > 0 && (
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="bg-[#0F1629] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/60 focus:outline-none focus:border-[#2563EB]/30"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={fetchPortfolio}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-white/50 border border-white/10 rounded-lg hover:bg-white/[0.03] transition-colors"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Metrics Cards */}
        {portfolio?.metrics && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Total AUM', value: `$${portfolio.totalValue >= 1000 ? `${(portfolio.totalValue / 1000).toFixed(1)}K` : portfolio.totalValue.toFixed(0)}`, icon: Wallet, color: '#2563EB' },
              { label: 'Total Return', value: `${portfolio.metrics.totalReturn >= 0 ? '+' : ''}${portfolio.metrics.totalReturn.toFixed(2)}%`, icon: TrendingUp, color: portfolio.metrics.totalReturn >= 0 ? '#4ade80' : '#ef4444' },
              { label: 'Sortino Ratio', value: portfolio.metrics.sortinoRatio.toFixed(2), icon: BarChart3, color: '#A855F7' },
              { label: 'Sharpe Ratio', value: portfolio.metrics.sharpeRatio.toFixed(2), icon: BarChart3, color: '#06B6D4' },
              { label: 'Max Drawdown', value: `-${portfolio.metrics.maxDrawdown.toFixed(2)}%`, icon: TrendingUp, color: '#F97316' },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-[#0F1629] border border-white/[0.08] rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <card.icon size={14} style={{ color: card.color }} />
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">{card.label}</span>
                </div>
                <div className="text-xl font-bold text-white font-mono">{card.value}</div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Allocation Chart */}
          <div className="bg-[#0F1629] border border-white/[0.08] rounded-xl p-6">
            <h3 className="text-sm text-white/40 uppercase tracking-wider mb-6">Asset Allocation</h3>
            {portfolio && portfolio.allocations.length > 0 ? (
              <PortfolioAllocationChart
                allocations={portfolio.allocations}
                totalValue={portfolio.totalValue}
              />
            ) : (
              <div className="text-center py-12 text-white/20 text-sm">
                {loading ? 'Loading portfolio...' : 'No allocations found. Run the seed script to populate demo data.'}
              </div>
            )}
          </div>

          {/* Holdings Table */}
          <div className="bg-[#0F1629] border border-white/[0.08] rounded-xl p-6">
            <h3 className="text-sm text-white/40 uppercase tracking-wider mb-4">Holdings</h3>
            {portfolio && portfolio.allocations.length > 0 ? (
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {portfolio.allocations.map((a, i) => (
                  <motion.div
                    key={`${a.symbol}-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">{a.symbol}</div>
                      <div className="text-[10px] text-white/30">{a.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} units</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white font-mono">
                        ${a.value >= 1000 ? `${(a.value / 1000).toFixed(1)}K` : a.value.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-white/30">{(a.weight * 100).toFixed(1)}%</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-white/20 text-sm">No holdings data</div>
            )}
          </div>
        </div>

        {/* Rebalance Actions */}
        <div className="mt-6 bg-[#0F1629] border border-white/[0.08] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpDown size={16} className="text-[#2563EB]" />
            <h3 className="text-sm text-white/40 uppercase tracking-wider">Rebalance Portfolio</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {['conservative', 'balanced', 'aggressive'].map((s) => (
              <button
                key={s}
                onClick={() => handleRebalance(s)}
                disabled={rebalancing || !selectedAgent}
                className="px-4 py-2 text-sm rounded-lg border border-white/10 text-white/60 hover:bg-[#2563EB]/10 hover:text-[#2563EB] hover:border-[#2563EB]/20 transition-colors disabled:opacity-30"
              >
                {rebalancing ? 'Executing...' : `Rebalance → ${s.charAt(0).toUpperCase() + s.slice(1)}`}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/20 mt-3">
            Rebalancing executes trades via Jupiter Swap to reach the target allocation for the selected strategy.
          </p>
        </div>
      </div>
    </div>
  );
}
