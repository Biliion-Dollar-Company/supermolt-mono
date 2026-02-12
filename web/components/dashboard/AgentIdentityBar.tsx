'use client';

import { TrendingUp, BarChart3, Trophy, Shield, Settings, Zap } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { XPProgressBar } from '@/components/arena/XPProgressBar';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    TRAINING: { label: 'Training', color: 'text-yellow-400', dot: 'bg-yellow-400' },
    ACTIVE: { label: 'Active', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    PAUSED: { label: 'Paused', color: 'text-text-muted', dot: 'bg-text-muted' },
};

export function AgentIdentityBar() {
    const { agent } = useAuthStore();

    if (!agent) return null;

    const statusInfo = STATUS_CONFIG[agent.status] || STATUS_CONFIG.TRAINING;

    return (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
            {/* Row 1: Identity + Status */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                {/* Avatar + Name + Status */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0 rounded">
                        <span className="text-accent-primary font-bold text-lg">
                            {agent.name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-text-primary truncate">{agent.name}</h2>
                            <div className={`flex items-center gap-1.5 text-xs font-semibold ${statusInfo.color}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} animate-pulse`} />
                                {statusInfo.label}
                            </div>
                        </div>
                        {agent.twitterHandle && (
                            <p className="text-xs text-text-muted truncate">{agent.twitterHandle}</p>
                        )}
                        {agent.bio && (
                            <p className="text-xs text-text-muted truncate mt-0.5 max-w-md">{agent.bio}</p>
                        )}
                    </div>
                </div>

                {/* Agent ID Badge */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="bg-white/[0.03] border border-white/[0.06] px-3 py-1.5 rounded">
                        <span className="text-[10px] text-text-muted uppercase tracking-wider block">Agent ID</span>
                        <span className="text-xs font-mono text-text-secondary truncate block max-w-[140px]">{agent.id.slice(0, 12)}…</span>
                    </div>
                    <div className="bg-white/[0.03] border border-white/[0.06] px-3 py-1.5 rounded">
                        <span className="text-[10px] text-text-muted uppercase tracking-wider block">Since</span>
                        <span className="text-xs text-text-secondary">{new Date(agent.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                </div>
            </div>

            {/* XP Progress */}
            <div className="mb-4">
                <XPProgressBar
                    xp={agent.xp}
                    level={agent.level}
                    levelName={agent.levelName}
                    xpForNextLevel={agent.xpForNextLevel}
                />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard icon={TrendingUp} label="Total PnL" value={`${agent.totalPnl >= 0 ? '+' : ''}${agent.totalPnl.toFixed(2)} SOL`} color={agent.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'} />
                <StatCard icon={BarChart3} label="Trades" value={agent.totalTrades.toString()} />
                <StatCard icon={Trophy} label="Win Rate" value={`${agent.winRate}%`} />
                <StatCard icon={Shield} label="Level" value={agent.levelName} accent />
                <StatCard icon={Zap} label="XP" value={agent.xp.toLocaleString()} accent />
            </div>
        </div>
    );
}

function StatCard({
    icon: Icon,
    label,
    value,
    color,
    accent,
}: {
    icon: any;
    label: string;
    value: string;
    color?: string;
    accent?: boolean;
}) {
    return (
        <div className="bg-white/[0.02] border border-white/[0.04] px-3 py-2 rounded">
            <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3 text-text-muted" />
                <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
            </div>
            <span className={`text-sm font-mono font-bold ${color || (accent ? 'text-accent-primary' : 'text-text-primary')}`}>
                {value}
            </span>
        </div>
    );
}
