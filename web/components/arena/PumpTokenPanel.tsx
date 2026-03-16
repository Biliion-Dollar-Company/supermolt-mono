'use client';

import { useState, useEffect } from 'react';
import { Flame, TrendingUp, Wallet, ExternalLink, Copy, Check } from 'lucide-react';
import { getPumpVaultBalances, type PumpVaultBalances } from '@/lib/api';

const PUMP_FUN_BASE = 'https://pump.fun';

export function PumpTokenPanel({ agentId, pumpFunMint }: { agentId: string; pumpFunMint?: string | null }) {
  const [balances, setBalances] = useState<PumpVaultBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pumpFunMint) return;
    setLoading(true);
    getPumpVaultBalances(agentId)
      .then(setBalances)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId, pumpFunMint]);

  if (!pumpFunMint) return null;

  function copyMint() {
    navigator.clipboard.writeText(pumpFunMint!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const shortMint = `${pumpFunMint.slice(0, 4)}...${pumpFunMint.slice(-4)}`;
  const totalRevenue = balances
    ? (parseFloat(balances.vaults.payment.balanceUsdc) + parseFloat(balances.vaults.buyback.balanceUsdc)).toFixed(2)
    : '—';

  return (
    <div className="relative overflow-hidden rounded-lg border border-amber-500/20 bg-gradient-to-b from-amber-950/30 to-transparent p-4">
      {/* Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-12 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse,rgba(245,158,11,0.2) 0%,transparent 70%)', filter: 'blur(12px)' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase">Tokenized Agent</span>
        </div>
        <a
          href={`${PUMP_FUN_BASE}/coin/${pumpFunMint}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-mono text-amber-400/60 hover:text-amber-400 transition-colors"
        >
          pump.fun <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      {/* Mint address */}
      <button
        onClick={copyMint}
        className="flex items-center gap-2 mb-3 text-[10px] font-mono text-white/35 hover:text-white/55 transition-colors"
      >
        <Wallet className="w-3 h-3" />
        {shortMint}
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      </button>

      {/* Vault stats */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 bg-white/[0.03] animate-pulse rounded" />
          ))}
        </div>
      ) : balances ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-white/[0.04] rounded p-2">
            <div className="text-[9px] font-mono text-white/35 uppercase tracking-wider mb-1">Revenue</div>
            <div className="text-sm font-mono font-bold text-amber-400">${totalRevenue}</div>
            <div className="text-[8px] text-white/35 font-mono">USDC collected</div>
          </div>
          <div className="bg-white/[0.04] rounded p-2">
            <div className="text-[9px] font-mono text-white/35 uppercase tracking-wider mb-1">Buyback %</div>
            <div className="text-sm font-mono font-bold text-green-400">
              {balances.buybackBps ? (balances.buybackBps / 100).toFixed(0) : '—'}%
            </div>
            <div className="text-[8px] text-white/35 font-mono">of revenue burned</div>
          </div>
        </div>
      ) : null}

      {/* Buyback info */}
      <div className="flex items-center gap-1.5 text-[9px] font-mono text-white/35">
        <TrendingUp className="w-3 h-3 text-amber-400/50" />
        Revenue → auto buyback + burn every hour
      </div>
    </div>
  );
}
