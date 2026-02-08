'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Trophy, ExternalLink, Clock, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';
import { getEpochRewards } from '@/lib/api';
import { EpochReward, AgentAllocation } from '@/lib/types';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-500/10 text-green-400 border-green-500/20',
    ENDED: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    PAID: 'bg-accent-primary/10 text-accent-primary border-accent-primary/20',
    UPCOMING: 'bg-white/5 text-text-muted border-white/10',
  };

  return (
    <span className={`text-xs px-2 py-0.5 border rounded-full font-mono ${styles[status] || styles.UPCOMING}`}>
      {status}
    </span>
  );
}

function AllocationRow({ alloc, rank }: { alloc: AgentAllocation; rank: number }) {
  const isCompleted = alloc.status === 'completed';
  const isFailed = alloc.status === 'failed';

  return (
    <div className={`flex items-center gap-3 py-2 px-2 ${
      isCompleted ? 'bg-green-500/[0.03]' : isFailed ? 'bg-red-500/[0.03]' : ''
    }`}>
      {/* Rank */}
      <span className={`text-xs font-mono w-5 text-center flex-shrink-0 ${
        rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-text-muted'
      }`}>
        {rank <= 3 ? <Trophy className="w-3 h-3 inline" /> : `#${rank}`}
      </span>

      {/* Agent Name */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-text-primary truncate block">{alloc.agentName}</span>
        <span className="text-xs text-text-muted font-mono">{alloc.multiplier}x</span>
      </div>

      {/* USDC Amount */}
      <div className="text-right flex-shrink-0">
        <span className="text-sm font-mono text-accent-primary">{alloc.usdcAmount.toFixed(2)}</span>
        <span className="text-xs text-text-muted ml-1">USDC</span>
      </div>

      {/* Status Icon / TX Link */}
      <div className="w-6 flex-shrink-0 flex justify-center">
        {isCompleted && alloc.txSignature ? (
          <a
            href={`https://explorer.solana.com/tx/${alloc.txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 hover:text-green-300 transition-colors"
            title="View on Solana Explorer"
          >
            <CheckCircle2 className="w-4 h-4" />
          </a>
        ) : isFailed ? (
          <AlertCircle className="w-4 h-4 text-red-400" />
        ) : (
          <span className="text-xs text-text-muted italic">est.</span>
        )}
      </div>
    </div>
  );
}

function CountdownTimer({ endAt }: { endAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const end = new Date(endAt).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m`);
      }
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [endAt]);

  return <span>{timeLeft}</span>;
}

const BATCH_SIZE = 25;
const VISIBLE_ROWS = 5;
const ROW_HEIGHT = 60;

export function EpochRewardPanel() {
  const [data, setData] = useState<EpochReward | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getEpochRewards();
      setData(result);
    } catch {
      // Silently fail — panel just won't show data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Infinite scroll: load next batch when sentinel becomes visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + BATCH_SIZE);
        }
      },
      { root: scrollContainerRef.current, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [data]);

  if (loading) {
    return (
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-4 sm:p-5">
        <div className="h-6 w-48 bg-white/[0.02] animate-pulse rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-white/[0.02] animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.epoch) {
    return null;
  }

  const { epoch, allocations, treasury, distributions } = data;
  const hasDistributions = distributions.length > 0;
  const totalProjected = allocations.reduce((sum, a) => sum + a.usdcAmount, 0);

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-4 sm:p-5">
      {/* Epoch Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-accent-primary" />
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Epoch Rewards
          </h2>
        </div>
        <StatusBadge status={epoch.status} />
      </div>

      {/* Epoch Info */}
      <div className="mb-4">
        <div className="text-lg font-bold text-text-primary">{epoch.name}</div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-text-muted font-mono">Epoch #{epoch.number}</span>
          <span className="text-xs text-text-muted">|</span>
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <Clock className="w-3 h-3" />
            <CountdownTimer endAt={epoch.endAt} />
          </span>
        </div>
      </div>

      {/* USDC Pool Display */}
      <div className="flex items-baseline gap-2 mb-4 pb-4 border-b border-white/[0.06]">
        <span className="text-2xl font-bold font-mono text-accent-primary">
          {epoch.usdcPool.toFixed(2)}
        </span>
        <span className="text-sm text-text-muted">USDC Pool</span>
        {treasury.balance > 0 && (
          <span className="text-xs text-text-muted ml-auto">
            Treasury: {treasury.balance.toFixed(2)} USDC
          </span>
        )}
      </div>

      {/* Allocation Table */}
      {allocations.length > 0 ? (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted uppercase tracking-wider">
              {hasDistributions ? 'Distributions' : 'Projected Allocations'}
            </span>
            <span className="text-xs font-mono text-text-muted">
              {totalProjected.toFixed(2)} USDC total
            </span>
          </div>

          <div
            ref={scrollContainerRef}
            className="divide-y divide-white/[0.04] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent px-[5%]"
            style={{ maxHeight: `${VISIBLE_ROWS * ROW_HEIGHT}px` }}
          >
            {allocations.slice(0, visibleCount).map((alloc) => (
              <AllocationRow key={alloc.agentId} alloc={alloc} rank={alloc.rank} />
            ))}
            {visibleCount < allocations.length && (
              <div ref={sentinelRef} className="h-1" />
            )}
          </div>

          {allocations.length > VISIBLE_ROWS && (
            <div className="text-center pt-2">
              <span className="text-[10px] text-text-muted/50">
                {Math.min(visibleCount, allocations.length)} of {allocations.length} agents
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 text-text-muted text-sm">
          No active agents for reward calculation
        </div>
      )}

      {/* Distribution Summary */}
      {hasDistributions && (
        <div className="pt-3 border-t border-white/[0.06]">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Distributed: {treasury.distributed.toFixed(2)} USDC</span>
            <span>{distributions.length} transactions</span>
          </div>
          <div className="mt-2 space-y-1">
            {distributions.slice(0, 3).map((d) => (
              <a
                key={d.txSignature}
                href={`https://explorer.solana.com/tx/${d.txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-primary transition-colors group"
              >
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                <span className="font-mono truncate">{d.txSignature.slice(0, 16)}...</span>
                <span className="text-accent-primary ml-auto">{d.amount.toFixed(2)} USDC</span>
              </a>
            ))}
            {distributions.length > 3 && (
              <span className="text-xs text-text-muted">+{distributions.length - 3} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
