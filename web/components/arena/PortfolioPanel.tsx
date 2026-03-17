'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, BarChart2 } from 'lucide-react';
import { getMyAgent } from '@/lib/api';

const GOLD = '#E8B45E';
const YES_C = '#4ade80';
const NO_C = '#f87171';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://sr-mobile-production.up.railway.app';

interface AgentTrade {
  id: string;
  tokenSymbol: string;
  tokenMint: string;
  action: 'BUY' | 'SELL';
  solAmount: number;
  tokenAmount: number;
  signature: string | null;
  chain: string;
  createdAt: string;
}

interface AgentPosition {
  tokenMint: string;
  tokenSymbol: string;
  tokenAmount: number;
  avgEntryPrice: number;
  chain: string;
}

export function PortfolioPanel() {
  const [trades, setTrades] = useState<AgentTrade[]>([]);
  const [positions, setPositions] = useState<AgentPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'trades' | 'positions'>('trades');

  useEffect(() => {
    async function load() {
      try {
        const agent = await getMyAgent();
        if (!agent?.id) return;

        const [tradesRes, positionsRes] = await Promise.all([
          fetch(`${API_BASE}/arena/agents/${agent.id}/trades?limit=20`).then(r => r.json()),
          fetch(`${API_BASE}/arena/agents/${agent.id}/positions`).then(r => r.json()),
        ]);

        setTrades(tradesRes.trades || tradesRes.data || []);
        setPositions(positionsRes.positions || positionsRes.data || []);
      } catch (err) {
        console.error('[PortfolioPanel] Failed to load:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div
        className="p-4 animate-pulse"
        style={{
          background: 'rgba(12,16,32,0.6)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="h-4 w-20 bg-white/5 rounded mb-3" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 w-full bg-white/5 rounded mb-2" />
        ))}
      </div>
    );
  }

  const solscanUrl = (sig: string) => `https://solscan.io/tx/${sig}`;

  return (
    <div
      className="p-4"
      style={{
        background: 'rgba(12,16,32,0.6)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={14} style={{ color: GOLD }} />
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-white/80">
          Portfolio
        </span>
      </div>

      <div className="flex items-center gap-1 mb-3">
        {(['trades', 'positions'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer font-mono"
            style={tab === t
              ? { color: GOLD, background: 'rgba(232,180,94,0.08)', border: '1px solid rgba(232,180,94,0.2)' }
              : { color: 'rgba(255,255,255,0.3)', border: '1px solid transparent' }}
          >
            {t} {t === 'trades' ? `(${trades.length})` : `(${positions.length})`}
          </button>
        ))}
      </div>

      {tab === 'trades' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {trades.length === 0 ? (
            <p className="text-xs text-white/25 py-4 text-center">No trades yet</p>
          ) : (
            trades.map(trade => (
              <div
                key={trade.id}
                className="flex items-center justify-between py-1.5 px-2 bg-white/[0.02] rounded"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{
                      color: trade.action === 'BUY' ? YES_C : NO_C,
                      background: trade.action === 'BUY' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                    }}
                  >
                    {trade.action}
                  </span>
                  <span className="text-xs font-mono text-white/80">{trade.tokenSymbol}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-white/55">
                    {trade.solAmount?.toFixed(3)} SOL
                  </span>
                  {trade.signature && (
                    <a
                      href={solscanUrl(trade.signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white/80 transition-colors"
                    >
                      <ExternalLink size={10} className="text-white/25" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'positions' && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {positions.length === 0 ? (
            <p className="text-xs text-white/25 py-4 text-center">No open positions</p>
          ) : (
            positions.map(pos => (
              <div
                key={pos.tokenMint}
                className="flex items-center justify-between py-1.5 px-2 bg-white/[0.02] rounded"
              >
                <span className="text-xs font-mono text-white/80">{pos.tokenSymbol}</span>
                <span className="text-xs font-mono text-white/55">
                  {pos.tokenAmount?.toFixed(2)} tokens
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
