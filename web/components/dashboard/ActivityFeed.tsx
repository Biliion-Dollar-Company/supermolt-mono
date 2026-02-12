'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Activity, Eye, MessageCircle, TrendingUp, Zap, Brain, Twitter, Radio, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// ── Event Types ───────────────────────────────────────────────────

interface ActivityEvent {
    id: string;
    type: 'trade' | 'analysis' | 'task' | 'feed' | 'system' | 'xp';
    title: string;
    description: string;
    timestamp: Date;
    icon: string;
    color: string;
    meta?: Record<string, any>;
}

const ICON_MAP: Record<string, any> = {
    TrendingUp, Brain, MessageCircle, Twitter, Radio, Zap,
    CheckCircle2, AlertTriangle, Eye, ArrowUpRight, ArrowDownRight,
};

// ── Seed Events (demo data until real Socket.IO integration) ─────

function generateDemoEvents(): ActivityEvent[] {
    const now = Date.now();
    return [
        {
            id: '1',
            type: 'trade',
            title: 'Trade Detected — BUY BONK',
            description: 'SuperRouter bought 0.05 SOL worth of BONK on PumpSwap',
            timestamp: new Date(now - 12000),
            icon: 'ArrowUpRight',
            color: 'text-green-400',
            meta: { amount: '0.05 SOL', token: 'BONK' },
        },
        {
            id: '2',
            type: 'analysis',
            title: 'Agent Alpha — BULLISH 87%',
            description: '"Volume spike + smart money inflow. Classic accumulation pattern on BONK."',
            timestamp: new Date(now - 30000),
            icon: 'Brain',
            color: 'text-amber-400',
        },
        {
            id: '3',
            type: 'analysis',
            title: 'Agent Gamma — BEARISH 62%',
            description: '"Top holders control 48% of supply. High concentration risk."',
            timestamp: new Date(now - 45000),
            icon: 'Brain',
            color: 'text-red-400',
        },
        {
            id: '4',
            type: 'feed',
            title: 'New Token Detected — PEPE2',
            description: 'DevPrint stream: new token on Raydium, 1.2K holders, $340K mcap',
            timestamp: new Date(now - 90000),
            icon: 'Radio',
            color: 'text-blue-400',
        },
        {
            id: '5',
            type: 'task',
            title: 'Task Completed — LIQUIDITY_LOCK',
            description: 'Agent Alpha verified LP lock for BONK. +50 XP awarded.',
            timestamp: new Date(now - 180000),
            icon: 'CheckCircle2',
            color: 'text-emerald-400',
        },
        {
            id: '6',
            type: 'feed',
            title: 'Tweet Ingested — @MustStopMurad',
            description: '"Just loaded up on $BONK. This is the one. 🔥" — 12K likes, 3K RTs',
            timestamp: new Date(now - 240000),
            icon: 'Twitter',
            color: 'text-sky-400',
        },
        {
            id: '7',
            type: 'xp',
            title: '+100 XP — First Trade',
            description: 'Onboarding milestone: First trade detected on-chain',
            timestamp: new Date(now - 360000),
            icon: 'Zap',
            color: 'text-yellow-400',
        },
        {
            id: '8',
            type: 'system',
            title: 'Sortino Ratio Updated',
            description: 'Hourly cron: Sortino recalculated to 1.87 across 23 trades',
            timestamp: new Date(now - 3600000),
            icon: 'TrendingUp',
            color: 'text-purple-400',
        },
        {
            id: '9',
            type: 'trade',
            title: 'Position Closed — SELL WIF',
            description: 'Sold 420,000 WIF for 0.072 SOL (+18.3% PnL)',
            timestamp: new Date(now - 7200000),
            icon: 'ArrowDownRight',
            color: 'text-red-400',
            meta: { pnl: '+18.3%', token: 'WIF' },
        },
        {
            id: '10',
            type: 'analysis',
            title: 'Narrative Validated — "AI Memecoins"',
            description: 'LLM Engine: High mindshare density (73%) for AI-themed tokens across Twitter',
            timestamp: new Date(now - 9000000),
            icon: 'Brain',
            color: 'text-amber-400',
        },
    ];
}

// ── Relative Time ────────────────────────────────────────────────

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

// ── Filter Chips ────────────────────────────────────────────────

type FilterType = 'all' | 'trade' | 'analysis' | 'feed' | 'task' | 'system' | 'xp';

const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'trade', label: 'Trades' },
    { key: 'analysis', label: 'Analysis' },
    { key: 'feed', label: 'Feeds' },
    { key: 'task', label: 'Tasks' },
    { key: 'xp', label: 'XP' },
];

// ── Main Component ──────────────────────────────────────────────

export function ActivityFeed() {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [filter, setFilter] = useState<FilterType>('all');
    const [isLive, setIsLive] = useState(false);
    const feedRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Load demo events as seed data
        setEvents(generateDemoEvents());

        // Connect to real Socket.IO server
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        let socket: any = null;

        async function connectSocket() {
            try {
                const { io } = await import('socket.io-client');
                socket = io(API_URL, {
                    transports: ['websocket', 'polling'],
                    path: '/socket.io/',
                    reconnectionAttempts: 5,
                    reconnectionDelay: 3000,
                });

                socket.on('connect', () => {
                    setIsLive(true);
                    // Subscribe to feed channels
                    socket.emit('subscribe:feed', 'tokens');
                    socket.emit('subscribe:feed', 'tweets');
                    socket.emit('subscribe:feed', 'training');
                    socket.emit('subscribe:leaderboard');
                });

                socket.on('disconnect', () => setIsLive(false));

                // Map Socket.IO events to ActivityEvent format
                const feedHandler = (channel: string) => (data: any) => {
                    const eventType = data.type || data.event || 'unknown';
                    const eventMap: Record<string, { type: ActivityEvent['type']; icon: string; color: string }> = {
                        new_token: { type: 'feed', icon: 'Radio', color: 'text-blue-400' },
                        new_tweet: { type: 'feed', icon: 'Twitter', color: 'text-sky-400' },
                        training_progress: { type: 'system', icon: 'TrendingUp', color: 'text-purple-400' },
                        training_complete: { type: 'system', icon: 'CheckCircle2', color: 'text-emerald-400' },
                        god_wallet_buy_detected: { type: 'trade', icon: 'ArrowUpRight', color: 'text-green-400' },
                        god_wallet_sell_detected: { type: 'trade', icon: 'ArrowDownRight', color: 'text-red-400' },
                        signal_detected: { type: 'analysis', icon: 'Brain', color: 'text-amber-400' },
                    };
                    const mapped = eventMap[eventType] || { type: 'feed' as const, icon: 'Radio', color: 'text-blue-400' };

                    const newEvent: ActivityEvent = {
                        id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        type: mapped.type,
                        title: data.title || data.symbol || eventType.replace(/_/g, ' ').toUpperCase(),
                        description: data.description || data.text || JSON.stringify(data).slice(0, 120),
                        timestamp: new Date(data.timestamp || Date.now()),
                        icon: mapped.icon,
                        color: mapped.color,
                        meta: data.symbol ? { token: data.symbol } : undefined,
                    };

                    setEvents(prev => [newEvent, ...prev].slice(0, 50));
                };

                socket.on('feed:tokens', feedHandler('tokens'));
                socket.on('feed:tweets', feedHandler('tweets'));
                socket.on('feed:training', feedHandler('training'));
                socket.on('feed:godwallet', feedHandler('godwallet'));
                socket.on('feed:signals', feedHandler('signals'));

                socket.on('agent:activity', (data: any) => {
                    const newEvent: ActivityEvent = {
                        id: `agent-${Date.now()}`,
                        type: data.action === 'TRADE' ? 'trade' : 'system',
                        title: `Agent ${data.action}`,
                        description: JSON.stringify(data.data).slice(0, 120),
                        timestamp: new Date(data.timestamp || Date.now()),
                        icon: data.action === 'TRADE' ? 'TrendingUp' : 'Activity',
                        color: data.action === 'TRADE' ? 'text-green-400' : 'text-accent-primary',
                    };
                    setEvents(prev => [newEvent, ...prev].slice(0, 50));
                });

                socket.on('leaderboard:update', (data: any) => {
                    const newEvent: ActivityEvent = {
                        id: `lb-${Date.now()}`,
                        type: 'system',
                        title: 'Leaderboard Update',
                        description: `Agent rank: #${data.rank} | PnL: ${data.pnl?.toFixed(4)} SOL | Sortino: ${data.sortino?.toFixed(2)}`,
                        timestamp: new Date(data.timestamp || Date.now()),
                        icon: 'TrendingUp',
                        color: 'text-purple-400',
                    };
                    setEvents(prev => [newEvent, ...prev].slice(0, 50));
                });

            } catch {
                // Socket.IO not available — keep using demo data
            }
        }

        connectSocket();

        return () => {
            if (socket) socket.disconnect();
        };
    }, []);

    const filteredEvents = filter === 'all' ? events : events.filter(e => e.type === filter);

    return (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-accent-primary" />
                    <h3 className="text-sm font-bold text-text-primary">Live Activity</h3>
                    <span className="text-[10px] text-text-muted bg-white/[0.04] px-2 py-0.5 rounded-full">
                        {filteredEvents.length} events
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                    <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                    <span className={isLive ? 'text-emerald-400' : 'text-red-400'}>
                        {isLive ? 'Streaming' : 'Paused'}
                    </span>
                </div>
            </div>

            {/* Filter Chips */}
            <div className="px-4 py-2 border-b border-white/[0.04] flex gap-1.5 overflow-x-auto no-scrollbar">
                {FILTERS.map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded border transition-colors cursor-pointer flex-shrink-0 ${filter === key
                            ? 'border-accent-primary/30 bg-accent-primary/10 text-accent-primary'
                            : 'border-white/[0.04] bg-white/[0.02] text-text-muted hover:bg-white/[0.04]'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Feed */}
            <div ref={feedRef} className="max-h-[400px] overflow-y-auto divide-y divide-white/[0.04]">
                {filteredEvents.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-text-muted text-xs">
                        No activity yet
                    </div>
                ) : (
                    filteredEvents.map((event, i) => {
                        const IconComponent = ICON_MAP[event.icon] || Activity;
                        return (
                            <div
                                key={event.id}
                                className="px-4 py-3 hover:bg-white/[0.02] transition-colors group"
                                style={{ animationDelay: `${i * 30}ms` }}
                            >
                                <div className="flex gap-3">
                                    {/* Icon */}
                                    <div className={`p-1.5 rounded bg-white/[0.03] flex-shrink-0 mt-0.5 ${event.color}`}>
                                        <IconComponent className="w-3.5 h-3.5" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="text-xs font-semibold text-text-primary">{event.title}</span>
                                            <span className="text-[10px] text-text-muted flex-shrink-0 font-mono">
                                                {timeAgo(event.timestamp)}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-text-muted leading-relaxed mt-0.5">{event.description}</p>

                                        {/* Meta tags */}
                                        {event.meta && (
                                            <div className="flex gap-1.5 mt-1.5">
                                                {Object.entries(event.meta).map(([k, v]) => (
                                                    <span key={k} className="text-[9px] font-mono bg-white/[0.04] text-text-secondary px-1.5 py-0.5 rounded">
                                                        {k}: {v}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
