'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { ExternalLink, Clock, CheckCircle2, AlertCircle, Gift, Info } from 'lucide-react';

import { AgentAllocation } from '@/lib/types';
import { useEpochRewards } from '@/hooks/useArenaData';
import { AgentProfileModal } from './AgentProfileModal';

function formatTwitterHandle(handle?: string): string {
  if (!handle) return '';
  return handle.startsWith('@') ? handle : `@${handle}`;
}

function shortenAddress(addr?: string): string {
  if (!addr) return '';
  if (addr.length <= 11) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function getAvatarSrc(avatarUrl?: string, twitterHandle?: string): string | null {
  if (avatarUrl) return avatarUrl;
  if (!twitterHandle) return null;
  const normalized = twitterHandle.replace(/^@/, '').trim();
  if (!normalized) return null;
  return `https://unavatar.io/twitter/${normalized}`;
}

function AllocationRow({ alloc, rank, onSelect }: { alloc: AgentAllocation; rank: number; onSelect?: (agentId: string) => void }) {
  const isCompleted = alloc.status === 'completed';
  const isFailed = alloc.status === 'failed';
  const handle = formatTwitterHandle(alloc.twitterHandle);
  const primaryLabel = handle || alloc.agentName;
  const walletLabel = shortenAddress(alloc.walletAddress);
  const avatarSrc = getAvatarSrc(alloc.avatarUrl, alloc.twitterHandle);

  return (
    <div
      className={`flex items-center gap-4 py-2.5 px-3 ${isCompleted ? 'bg-green-500/[0.03]' : isFailed ? 'bg-red-500/[0.03]' : ''} ${onSelect ? 'cursor-pointer hover:bg-white/[0.03] transition-colors' : ''}`}
      onClick={() => onSelect?.(alloc.agentId)}
    >
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="relative flex-shrink-0">
          {avatarSrc ? (
            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/10">
              <Image src={avatarSrc} alt={primaryLabel} fill className="object-cover" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <span className="text-xs font-bold text-text-muted">{primaryLabel[0]?.toUpperCase() || '?'}</span>
            </div>
          )}
          <span className={`absolute -bottom-1 -right-1 text-[8px] font-bold font-mono leading-none px-1 py-0.5 rounded-full border ${
            rank === 1 ? 'bg-yellow-400 text-black border-yellow-500/50' :
            rank === 2 ? 'bg-gray-300 text-black border-gray-400/50' :
            rank === 3 ? 'bg-amber-600 text-white border-amber-700/50' :
            'bg-white/10 text-text-muted border-white/20'
          }`}>
            {rank}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-base text-text-primary truncate block font-medium leading-tight">
            {primaryLabel}
          </span>
          <span className="text-xs text-text-muted truncate block font-mono">{walletLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-base font-mono text-accent-primary">{Math.round(alloc.usdcAmount)}</span>
        <div className="relative">
          <Image src="/icons/usdc.png" alt="USDC" width={20} height={20} />
          <span className="absolute -bottom-1.5 -right-3 text-[8px] font-mono font-bold text-accent-primary bg-[#1a1a2e] px-1 py-px rounded-full border border-accent-primary/25">{alloc.multiplier}x</span>
        </div>
      </div>

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
        ) : null}
      </div>
    </div>
  );
}

function EpochProgressBar({ startAt, endAt }: { startAt: string; endAt: string }) {
  const [progress, setProgress] = useState(0);
  const [timeLabel, setTimeLabel] = useState('');

  useEffect(() => {
    const update = () => {
      const start = new Date(startAt).getTime();
      const end = new Date(endAt).getTime();
      const now = Date.now();
      const total = end - start;
      const elapsed = now - start;

      if (total <= 0) {
        setProgress(100);
        setTimeLabel('Ended');
        return;
      }

      const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
      setProgress(pct);

      const diff = end - now;
      if (diff <= 0) {
        setTimeLabel('Ended');
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (days > 0) setTimeLabel(`${days}d ${hours}h remaining`);
        else if (hours > 0) setTimeLabel(`${hours}h ${minutes}m remaining`);
        else setTimeLabel(`${minutes}m remaining`);
      }
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [startAt, endAt]);

  const isEnded = progress >= 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <Clock className="w-3 h-3" />
          {timeLabel}
        </span>
        <span className={`text-[10px] font-mono ${isEnded ? 'text-yellow-400' : 'text-accent-primary'}`}>
          {Math.round(progress)}%
        </span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isEnded ? 'bg-yellow-400/60' : 'bg-accent-primary/70'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

const BATCH_SIZE = 25;
const VISIBLE_ROWS = 5;
const ROW_HEIGHT = 60;

export function EpochRewardPanel() {
  const { data, isLoading: loading } = useEpochRewards(); // deduplicated with ArenaLeaderboard
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
        <div className="h-5 w-36 bg-white/[0.03] animate-pulse rounded mb-2" />
        <div className="h-3 w-28 bg-white/[0.02] animate-pulse rounded mb-4" />
        <div className="h-1.5 bg-white/[0.03] animate-pulse rounded-full mb-4" />
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
          <div className="w-8 h-8 bg-white/[0.03] animate-pulse rounded-full" />
          <div className="h-7 w-16 bg-white/[0.03] animate-pulse rounded" />
          <div className="h-3 w-8 bg-white/[0.02] animate-pulse rounded" />
        </div>
        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2.5 px-3">
              <div className="w-8 h-8 bg-white/[0.03] animate-pulse rounded-full" />
              <div className="h-4 flex-1 bg-white/[0.03] animate-pulse rounded" />
              <div className="h-4 w-14 bg-white/[0.03] animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data?.epoch) {
    return (
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="w-4 h-4 text-text-primary" />
          <span className="text-sm font-bold text-text-primary uppercase tracking-wider">Epoch Rewards</span>
        </div>
        <div className="text-sm text-text-muted">
          No active reward epoch. Check back soon.
        </div>
      </div>
    );
  }

  const { epoch, allocations, treasury, distributions } = data;
  const hasDistributions = distributions.length > 0;
  const totalProjected = allocations.reduce((sum, a) => sum + a.usdcAmount, 0);
  const isEnded = new Date(epoch.endAt).getTime() <= Date.now();

  return (
    <div className="relative bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-text-primary" />
            <div className="text-base font-bold text-text-primary uppercase tracking-wider">
              Epoch Rewards
            </div>
          </div>
          <div className="relative group/info flex items-center gap-1.5">
            <span className="text-xs text-text-muted">Season {epoch.number}</span>
            <Info className="w-3.5 h-3.5 text-text-muted/50 group-hover/info:text-text-secondary transition-colors cursor-help" />
            <div className="absolute right-0 top-full mt-2 w-56 bg-[#1a1a2e] border border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.5)] px-3 py-2.5 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-200 z-50">
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Each season runs for a fixed period. Trade and complete tasks to climb the leaderboard — top performers earn USDC rewards from the pool at the end of the season.
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <EpochProgressBar startAt={epoch.startAt} endAt={epoch.endAt} />
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        <div>
          {/* Pool display */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
            <Image src="/icons/usdc.png" alt="USDC" width={32} height={32} />
            <span className="text-3xl font-bold font-mono text-accent-primary">
              {Math.round(epoch.usdcPool)}
            </span>
            <span className="text-sm text-text-muted">USDC Pool</span>
            {treasury.balance > 0 && (
              <span className="text-xs text-text-muted ml-auto">
                Treasury: {Math.round(treasury.balance)}
              </span>
            )}
          </div>

          {allocations.length > 0 ? (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted uppercase tracking-wider">
                  {hasDistributions ? 'Distributions' : 'Projected Allocations'}
                </span>
                <span className="flex items-center gap-1 text-xs font-mono text-text-muted">
                  {Math.round(totalProjected)} <Image src="/icons/usdc.png" alt="USDC" width={12} height={12} className="inline-block" /> total
                </span>
              </div>

              <div
                ref={scrollContainerRef}
                className="divide-y divide-white/[0.04] overflow-y-auto scrollbar-custom"
                style={{ maxHeight: `${VISIBLE_ROWS * ROW_HEIGHT}px` }}
              >
                {allocations.slice(0, visibleCount).map((alloc) => (
                  <AllocationRow key={alloc.agentId} alloc={alloc} rank={alloc.rank} onSelect={setSelectedAgentId} />
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

          {hasDistributions && (
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Distributed: {Math.round(treasury.distributed)} USDC</span>
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
                    <span className="text-accent-primary ml-auto">{Math.round(d.amount)} USDC</span>
                  </a>
                ))}
                {distributions.length > 3 && (
                  <span className="text-xs text-text-muted">+{distributions.length - 3} more</span>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {selectedAgentId && (
        <AgentProfileModal
          agentId={selectedAgentId}
          onClose={() => setSelectedAgentId(null)}
        />
      )}
    </div>
  );
}
