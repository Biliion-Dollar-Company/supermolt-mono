'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Trophy, ExternalLink, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { getEpochRewards } from '@/lib/api';
import { EpochReward, AgentAllocation } from '@/lib/types';

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
  const handle = formatTwitterHandle(alloc.twitterHandle);
  const primaryLabel = handle || alloc.agentName;
  const walletLabel = shortenAddress(alloc.walletAddress);
  const avatarSrc = getAvatarSrc(alloc.avatarUrl, alloc.twitterHandle);

  return (
    <div className={`flex items-center gap-4 py-2.5 px-3 ${isCompleted ? 'bg-green-500/[0.03]' : isFailed ? 'bg-red-500/[0.03]' : ''
      }`}>
      {/* Rank */}
      <span className={`text-sm font-mono w-6 text-center flex-shrink-0 ${rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : 'text-text-muted'
        }`}>
        {rank <= 3 ? <Trophy className="w-4 h-4 inline" /> : `#${rank}`}
      </span>

      {/* Agent Name + Avatar */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        {avatarSrc ? (
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
            <Image src={avatarSrc} alt={primaryLabel} fill className="object-cover" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-text-muted">{primaryLabel[0]?.toUpperCase() || '?'}</span>
          </div>
        )}
        <div className="min-w-0">
          <span className="text-base text-text-primary truncate block font-medium leading-tight">
            {primaryLabel}
          </span>
          <span className="text-xs text-text-muted truncate block font-mono">{walletLabel}</span>
        </div>
      </div>

      {/* USDC Amount + Multiplier Badge */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-base font-mono text-accent-primary">{alloc.usdcAmount.toFixed(2)}</span>
        <Image src="/icons/usdc.png" alt="USDC" width={18} height={18} className="inline-block" />
        <span className="text-[10px] font-mono text-text-muted bg-white/[0.06] px-1.5 py-0.5 rounded-full">{alloc.multiplier}x</span>
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
        ) : null}
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
  const [activeTab, setActiveTab] = useState<'SOLANA' | 'BSC'>('SOLANA');
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
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
        <div className="h-5 w-36 bg-white/[0.03] animate-pulse rounded mb-2" />
        <div className="h-3 w-28 bg-white/[0.02] animate-pulse rounded mb-4" />
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
          <div className="w-8 h-8 bg-white/[0.03] animate-pulse rounded-full" />
          <div className="h-7 w-16 bg-white/[0.03] animate-pulse rounded" />
          <div className="h-3 w-8 bg-white/[0.02] animate-pulse rounded" />
        </div>
        <div className="h-3 w-32 bg-white/[0.02] animate-pulse rounded mb-3" />
        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2.5 px-3">
              <div className="w-5 h-5 bg-white/[0.03] animate-pulse rounded-full" />
              <div className="h-4 flex-1 bg-white/[0.03] animate-pulse rounded" />
              <div className="h-4 w-14 bg-white/[0.03] animate-pulse rounded" />
              <div className="h-4 w-8 bg-white/[0.02] animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data?.epoch) {
    return (
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
        <div className="mb-2">
          <div className="text-lg font-bold text-text-primary">Epoch Rewards</div>
          <div className="text-xs text-text-muted font-mono">No active epoch</div>
        </div>
        <div className="text-sm text-text-muted">
          Reward pool is unavailable until the backend publishes an active epoch.
        </div>
      </div>
    );
  }

  const { epoch, allocations, treasury, distributions } = data;
  const hasDistributions = distributions.length > 0;
  const totalProjected = allocations.reduce((sum, a) => sum + a.usdcAmount, 0);
  const hasBSCAllocations = (data.bscAllocations?.length ?? 0) > 0;

  return (
    <div className="relative bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
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

      {/* Chain Tabs */}
      <div className="absolute top-4 right-4 z-20">
        <div className="relative flex items-center gap-2 p-1 border border-white/10 bg-black/35 shadow-[0_8px_20px_rgba(0,0,0,0.45)]">
          <div
            className={`pointer-events-none absolute top-1 bottom-1 w-9 border border-white/25 bg-white/10 transition-transform duration-300 ease-out ${activeTab === 'SOLANA' ? 'translate-x-0' : 'translate-x-[44px]'}`}
          />

          <button
            onClick={() => setActiveTab('SOLANA')}
            className={`relative z-10 w-9 h-9 flex items-center justify-center transition-all duration-300 ${activeTab === 'SOLANA' ? 'scale-105' : 'opacity-80 hover:opacity-100'}`}
            title="Solana Rewards"
            aria-label="Solana Rewards Tab"
          >
            <Image src="/icons/solana.png" alt="Solana" width={18} height={18} />
          </button>

          <button
            onClick={() => setActiveTab('BSC')}
            className={`relative z-10 w-9 h-9 flex items-center justify-center transition-all duration-300 ${activeTab === 'BSC' ? 'scale-105' : 'opacity-80 hover:opacity-100'} ${!hasBSCAllocations ? 'opacity-45' : ''}`}
            title={hasBSCAllocations ? 'BSC Rewards' : 'BSC Rewards (No Data Yet)'}
            aria-label="BSC Rewards Tab"
          >
            <Image src="/icons/bnb.png" alt="BSC" width={18} height={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative min-h-[400px]">
        {/* Solana View */}
        <div className={activeTab === 'SOLANA' ? 'block' : 'hidden'}>
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
            <Image src="/icons/usdc.png" alt="USDC" width={32} height={32} />
            <span className="text-3xl font-bold font-mono text-accent-primary">
              {Math.round(epoch.usdcPool)}
            </span>
            <span className="text-sm text-text-muted">USDC Pool</span>
            {treasury.balance > 0 && (
              <span className="text-xs text-text-muted ml-auto">
                Treasury: {treasury.balance.toFixed(2)}
              </span>
            )}
          </div>

          {allocations.length > 0 ? (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-muted uppercase tracking-wider">
                    {hasDistributions ? 'Distributions' : 'Projected Allocations'}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-mono text-text-muted">
                    {totalProjected.toFixed(2)} <Image src="/icons/usdc.png" alt="USDC" width={12} height={12} className="inline-block" /> total
                  </span>
                </div>

                <div
                  ref={scrollContainerRef}
                  className="divide-y divide-white/[0.04] overflow-y-auto scrollbar-custom"
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
            </>
          ) : (
            <div className="text-center py-6 text-text-muted text-sm">
              No active agents for reward calculation
            </div>
          )}

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

        {/* BSC View */}
        <div className={activeTab === 'BSC' ? 'block' : 'hidden'}>
          {data.bscAllocations && data.bscAllocations.length > 0 ? (
            <>
              {/* BSC Pool Display */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
                <div className="relative w-8 h-8">
                  <Image src="/icons/usdc.png" alt="USDC (BSC)" width={32} height={32} className="opacity-90" />
                  <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-[8px] text-black font-bold px-1 rounded shadow-sm border border-black/20">BSC</div>
                </div>
                <span className="text-3xl font-bold font-mono text-yellow-400">
                  {Math.round(data.bscAllocations.reduce((sum, a) => sum + a.usdcAmount, 0))}
                </span>
                <span className="text-sm text-text-muted">USDC Pool (BSC)</span>
                {data.bscTreasury && data.bscTreasury.balance > 0 && (
                  <span className="text-xs text-text-muted ml-auto">
                    Treasury: {data.bscTreasury.balance.toFixed(2)}
                  </span>
                )}
              </div>

              {/* BSC Allocations Table */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-text-muted uppercase tracking-wider">
                    BSC USDC Rewards
                  </span>
                  <span className="flex items-center gap-1 text-xs font-mono text-text-muted">
                    {data.bscAllocations.reduce((sum, a) => sum + a.usdcAmount, 0).toFixed(2)} USDC total
                  </span>
                </div>

                <div
                  className="divide-y divide-white/[0.04] overflow-y-auto scrollbar-custom"
                  style={{ maxHeight: `${VISIBLE_ROWS * ROW_HEIGHT}px` }}
                >
                  {data.bscAllocations.map((alloc) => {
                    const handle = formatTwitterHandle(alloc.twitterHandle);
                    const primaryLabel = handle || alloc.agentName;
                    const walletLabel = shortenAddress(alloc.evmAddress);
                    const avatarSrc = getAvatarSrc(alloc.avatarUrl, alloc.twitterHandle);
                    return (
                    <div key={alloc.agentId} className="flex items-center gap-4 py-2.5 px-3">
                      <span className={`text-sm font-mono w-6 text-center flex-shrink-0 ${alloc.rank === 1 ? 'text-yellow-400' : alloc.rank === 2 ? 'text-gray-300' : alloc.rank === 3 ? 'text-amber-600' : 'text-text-muted'
                        }`}>
                        {alloc.rank <= 3 ? <Trophy className="w-4 h-4 inline" /> : `#${alloc.rank}`}
                      </span>

                      {/* Agent Name + Avatar */}
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        {avatarSrc ? (
                          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                            <Image src={avatarSrc} alt={primaryLabel} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-text-muted">{primaryLabel[0]?.toUpperCase() || '?'}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-base text-text-primary truncate block font-medium leading-tight">
                            {primaryLabel}
                          </span>
                          <span className="text-xs text-text-muted truncate block font-mono">{walletLabel}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-base font-mono text-yellow-400">{alloc.usdcAmount.toFixed(2)}</span>
                        <span className="text-xs text-yellow-400">USDC</span>
                        <span className="text-[10px] font-mono text-text-muted bg-white/[0.06] px-1.5 py-0.5 rounded-full">{alloc.multiplier}x</span>
                      </div>

                      <div className="w-6 flex-shrink-0 flex justify-center">
                        {alloc.status === 'completed' && alloc.txHash ? (
                          <a
                            href={`https://bscscan.com/tx/${alloc.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-400 hover:text-green-300 transition-colors"
                            title="View on BSCScan"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </a>
                        ) : alloc.status === 'failed' ? (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        ) : null}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-text-muted text-sm">
              No active BSC agents found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
