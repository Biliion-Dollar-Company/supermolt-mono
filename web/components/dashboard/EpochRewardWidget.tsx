'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Gift, Clock, ExternalLink, Trophy, TrendingUp, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useEpochRewards } from '@/hooks/useArenaData';
import { useAuthStore } from '@/store/authStore';

// ── Countdown ────────────────────────────────────────────────────

function useCountdown(endAt: string) {
    const [label, setLabel] = useState('');
    const [progress, setProgress] = useState(0);
    const [isEnded, setIsEnded] = useState(false);

    useEffect(() => {
        const update = (startAt?: string) => {
            const end = new Date(endAt).getTime();
            const now = Date.now();
            const diff = end - now;

            if (diff <= 0) {
                setLabel('Ended');
                setProgress(100);
                setIsEnded(true);
                return;
            }

            setIsEnded(false);
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (days > 0) setLabel(`${days}d ${hours}h left`);
            else if (hours > 0) setLabel(`${hours}h ${minutes}m left`);
            else setLabel(`${minutes}m left`);
        };

        update();
        const interval = setInterval(update, 60000);
        return () => clearInterval(interval);
    }, [endAt]);

    return { label, progress, isEnded };
}

// ── Main Widget ──────────────────────────────────────────────────

export function EpochRewardWidget() {
    const { agent } = useAuthStore();
    const { data, isLoading } = useEpochRewards();

    if (isLoading) {
        return (
            <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                    <div className="h-4 w-28 bg-white/[0.03] animate-pulse rounded" />
                </div>
                <div className="p-4 space-y-3">
                    <div className="h-10 bg-white/[0.03] animate-pulse rounded" />
                    <div className="h-4 bg-white/[0.03] animate-pulse rounded" />
                    <div className="h-16 bg-white/[0.03] animate-pulse rounded" />
                </div>
            </div>
        );
    }

    if (!data?.epoch) {
        return (
            <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                    <Gift className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-text-primary">Epoch Rewards</h3>
                </div>
                <div className="p-4 text-sm text-text-muted text-center py-6">
                    No active epoch. Check back soon.
                </div>
            </div>
        );
    }

    const { epoch, allocations, treasury, distributions } = data;

    return (
        <EpochContent
            epoch={epoch}
            allocations={allocations}
            treasury={treasury}
            distributions={distributions}
            agentId={agent?.id}
        />
    );
}

// ── Content ──────────────────────────────────────────────────────

function EpochContent({
    epoch,
    allocations,
    treasury,
    distributions,
    agentId,
}: {
    epoch: { number: number; startAt: string; endAt: string; usdcPool: number; status: string };
    allocations: { agentId: string; agentName: string; rank: number; usdcAmount: number; multiplier: number; status: string; txSignature?: string }[];
    treasury: { balance: number; distributed: number; available: number };
    distributions: { agentName: string; amount: number; txSignature: string; completedAt: string }[];
    agentId?: string;
}) {
    const { label, isEnded } = useCountdown(epoch.endAt);

    // Find current user's allocation
    const myAllocation = agentId
        ? allocations.find((a) => a.agentId === agentId)
        : null;

    const totalProjected = allocations.reduce((sum, a) => sum + a.usdcAmount, 0);
    const hasDistributions = distributions.length > 0;
    const topThree = allocations.slice(0, 3);

    return (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-text-primary">Epoch Rewards</h3>
                    <span className="text-[10px] text-text-muted bg-white/[0.04] px-2 py-0.5 rounded-full">
                        Season {epoch.number}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Clock className="w-3 h-3" />
                    <span className={isEnded ? 'text-yellow-400' : ''}>{label}</span>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* USDC Pool */}
                <div className="flex items-center gap-3">
                    <Image src="/icons/usdc.png" alt="USDC" width={28} height={28} />
                    <div>
                        <span className="text-2xl font-bold font-mono text-accent-primary">
                            {Math.round(epoch.usdcPool).toLocaleString()}
                        </span>
                        <span className="text-xs text-text-muted ml-2">USDC Pool</span>
                    </div>
                </div>

                {/* My Allocation (if authenticated and ranked) */}
                {myAllocation && (
                    <div className="bg-accent-primary/[0.06] border border-accent-primary/20 p-3">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-text-muted uppercase tracking-wider">Your Allocation</span>
                            <span className="text-[10px] font-mono text-accent-primary">{myAllocation.multiplier}x multiplier</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-yellow-400" />
                                <span className="text-sm font-semibold text-text-primary">
                                    Rank #{myAllocation.rank}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-lg font-bold font-mono text-accent-primary">
                                    {Math.round(myAllocation.usdcAmount)}
                                </span>
                                <Image src="/icons/usdc.png" alt="USDC" width={16} height={16} />
                            </div>
                        </div>
                        {myAllocation.status === 'completed' && myAllocation.txSignature && (
                            <a
                                href={`https://explorer.solana.com/tx/${myAllocation.txSignature}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 mt-2 text-xs text-green-400 hover:text-green-300 transition-colors"
                            >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Claimed</span>
                                <ExternalLink className="w-3 h-3 ml-auto" />
                            </a>
                        )}
                    </div>
                )}

                {/* Top 3 Preview */}
                {topThree.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-text-muted uppercase tracking-wider">
                                {hasDistributions ? 'Top Earners' : 'Projected Top 3'}
                            </span>
                            <span className="text-[10px] font-mono text-text-muted">
                                {Math.round(totalProjected)} USDC total
                            </span>
                        </div>
                        <div className="space-y-1">
                            {topThree.map((alloc) => (
                                <div
                                    key={alloc.agentId}
                                    className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-white/[0.02] transition-colors"
                                >
                                    <span className={`text-[10px] font-bold font-mono w-5 text-center ${
                                        alloc.rank === 1 ? 'text-yellow-400' :
                                        alloc.rank === 2 ? 'text-gray-300' :
                                        'text-amber-600'
                                    }`}>
                                        #{alloc.rank}
                                    </span>
                                    <span className="text-xs text-text-primary truncate flex-1">
                                        {alloc.agentName}
                                    </span>
                                    <span className="text-xs font-mono text-accent-primary">
                                        {Math.round(alloc.usdcAmount)}
                                    </span>
                                    <Image src="/icons/usdc.png" alt="USDC" width={12} height={12} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stats Row */}
                <div className="flex items-center gap-4 pt-2 border-t border-white/[0.06]">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <TrendingUp className="w-3 h-3" />
                        <span>{allocations.length} agents</span>
                    </div>
                    {hasDistributions && (
                        <div className="text-xs text-text-muted">
                            {Math.round(treasury.distributed)} USDC paid
                        </div>
                    )}
                    <Link
                        href="/arena"
                        className="flex items-center gap-1 text-xs text-accent-primary hover:text-accent-primary/80 transition-colors ml-auto"
                    >
                        Full Leaderboard
                        <ChevronRight className="w-3 h-3" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
