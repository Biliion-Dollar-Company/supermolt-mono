'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Pill, Crosshair, Swords, Drama, Rocket, Zap, ChevronDown, ListChecks, MessageSquare, TrendingUp, Clock, ArrowUpRight, ArrowDownRight, Activity, Eye, BarChart3, Users, Flame, Sparkles, Target, Globe } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useAuthStore } from '@/store/authStore';
import { getArenaTasks, getAgentPositions, getAgentConversations } from '@/lib/api';
import type { AgentTaskType, Position, AgentConversationSummary } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';

// ── Feed node definitions ───────────────────────────────────────

const FEEDS = [
    { id: 'pumpfun', label: 'PumpFun', desc: 'New token launches', icon: Pill, color: '#E8B45E' },
    { id: 'wallets', label: 'Tracker', desc: 'Smart money moves', icon: Crosshair, color: '#818CF8' },
    { id: 'blitz', label: 'Blitzkrieg', desc: 'Community buy signals', icon: Swords, color: '#34D399' },
    { id: 'narrative', label: 'Narratives', desc: 'Trends & rising themes', icon: Drama, color: '#F472B6' },
];

const FEED_DETAILS: Record<string, {
    tagline: string;
    description: string;
    features: { icon: typeof Activity; title: string; desc: string }[];
    stats: { label: string; value: string }[];
}> = {
    pumpfun: {
        tagline: 'Real-time new token launch detection',
        description: 'Monitors PumpFun for newly created tokens the moment they launch. Your agent analyzes launch patterns, initial liquidity, developer wallet history, and early trading volume to identify high-potential entries before the crowd.',
        features: [
            { icon: Zap, title: 'Instant Detection', desc: 'Sub-second alerts on new token deployments as they hit the blockchain' },
            { icon: Eye, title: 'Dev Wallet Analysis', desc: 'Screens creator wallets for past rug history, funding patterns, and credibility signals' },
            { icon: BarChart3, title: 'Liquidity Scoring', desc: 'Evaluates initial liquidity depth and bonding curve progression to gauge launch quality' },
            { icon: Flame, title: 'Momentum Tracking', desc: 'Monitors buy/sell ratio and holder growth in the critical first minutes after launch' },
        ],
        stats: [
            { label: 'Avg detection time', value: '<1s' },
            { label: 'Tokens scanned daily', value: '2,000+' },
            { label: 'Filter pass rate', value: '~8%' },
        ],
    },
    wallets: {
        tagline: 'Follow the smart money in real-time',
        description: 'Tracks whale wallets and proven profitable traders across Solana. When a tracked wallet makes a significant move — buying, selling, or rotating — your agent receives the signal instantly and can act on it.',
        features: [
            { icon: Target, title: 'Wallet Tracking', desc: 'Monitor any Solana wallet address and get real-time alerts on their transactions' },
            { icon: Activity, title: 'Trade Mirroring', desc: 'Agent can automatically mirror trades from your highest-conviction wallets' },
            { icon: TrendingUp, title: 'PnL Analysis', desc: 'Tracks the historical performance of each wallet to weight signal quality' },
            { icon: Users, title: 'Whale Clustering', desc: 'Detects when multiple tracked wallets converge on the same token simultaneously' },
        ],
        stats: [
            { label: 'Signal latency', value: '<2s' },
            { label: 'Wallets trackable', value: 'Unlimited' },
            { label: 'Avg whale alpha', value: '+34%' },
        ],
    },
    blitz: {
        tagline: 'Community-driven buy signal aggregation',
        description: 'Aggregates buy signals from community channels, group chats, and coordinated trading groups. Blitzkrieg detects when momentum is building around a token before it shows up on charts, giving your agent a first-mover advantage.',
        features: [
            { icon: Users, title: 'Signal Aggregation', desc: 'Combines signals from multiple community sources into a single conviction score' },
            { icon: Flame, title: 'Momentum Detection', desc: 'Identifies when coordinated buying pressure is forming around a specific token' },
            { icon: Clock, title: 'Time-Sensitive Alerts', desc: 'Blitz signals are time-critical — your agent acts within seconds of detection' },
            { icon: Sparkles, title: 'Sentiment Analysis', desc: 'NLP processing of community messages to gauge genuine excitement vs noise' },
        ],
        stats: [
            { label: 'Sources monitored', value: '50+' },
            { label: 'Avg signal lead', value: '~3min' },
            { label: 'Hit rate', value: '~62%' },
        ],
    },
    narrative: {
        tagline: 'Catch emerging narratives before they trend',
        description: 'Scans crypto Twitter, forums, and news feeds to identify emerging market narratives and sector rotations. When a new theme starts gaining traction — AI tokens, RWA, meme seasons — your agent positions early.',
        features: [
            { icon: Globe, title: 'Trend Detection', desc: 'Monitors thousands of sources to identify rising narratives and thematic shifts' },
            { icon: TrendingUp, title: 'Sector Rotation', desc: 'Tracks capital flow between sectors to identify where money is moving next' },
            { icon: Sparkles, title: 'Early Signal', desc: 'Detects narrative formation 12-48 hours before it becomes mainstream consensus' },
            { icon: BarChart3, title: 'Narrative Scoring', desc: 'Assigns conviction scores based on engagement velocity, influencer overlap, and on-chain data' },
        ],
        stats: [
            { label: 'Sources tracked', value: '1,200+' },
            { label: 'Avg early signal', value: '~24h' },
            { label: 'Narrative accuracy', value: '~71%' },
        ],
    },
};

const AGENT_STATUS: Record<string, { label: string; color: string; dot: string }> = {
    TRAINING: { label: 'Training', color: 'text-yellow-400', dot: 'bg-yellow-400' },
    ACTIVE: { label: 'Active', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    PAUSED: { label: 'Paused', color: 'text-text-muted', dot: 'bg-text-muted' },
};

// ── Pulse animation engine ──────────────────────────────────────

interface Pulse {
    id: string;
    feedIndex: number;
    startTime: number;
}

function usePulseEngine(feedCount: number, duration: number, interval: number) {
    const [pulses, setPulses] = useState<Pulse[]>([]);

    useEffect(() => {
        const timeouts: NodeJS.Timeout[] = [];

        const spawn = (i: number) => {
            setPulses(prev => [
                ...prev,
                { id: `${i}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, feedIndex: i, startTime: Date.now() },
            ]);
            timeouts.push(setTimeout(() => spawn(i), interval * 1000 * (0.7 + Math.random() * 0.6)));
        };

        for (let i = 0; i < feedCount; i++) {
            timeouts.push(setTimeout(() => spawn(i), Math.random() * interval * 1000));
        }

        return () => timeouts.forEach(clearTimeout);
    }, [feedCount, interval]);

    // Prune expired
    useEffect(() => {
        let raf: number;
        const durationMs = duration * 1000;
        const tick = () => {
            const now = Date.now();
            setPulses(prev => prev.filter(p => (now - p.startTime) / durationMs < 1));
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [duration]);

    return pulses;
}

// ── SVG pulse layer ─────────────────────────────────────────────

function PulseLayer({
    feedPositions,
    agentPos,
    pulses,
    duration,
    width,
    height,
}: {
    feedPositions: { x: number; y: number }[];
    agentPos: { x: number; y: number };
    pulses: Pulse[];
    duration: number;
    width: number;
    height: number;
}) {
    const pathCacheRef = useRef<Map<number, SVGPathElement>>(new Map());
    const [segments, setSegments] = useState<{ id: string; d: string; opacity: number; color: string }[]>([]);

    useEffect(() => {
        pathCacheRef.current.clear();
    }, [feedPositions, agentPos]);

    useEffect(() => {
        let raf: number;
        const durationMs = duration * 1000;

        const calc = () => {
            const now = Date.now();
            const segs: typeof segments = [];

            for (const pulse of pulses) {
                const from = feedPositions[pulse.feedIndex];
                if (!from) continue;

                let path = pathCacheRef.current.get(pulse.feedIndex);
                if (!path) {
                    path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    const dx = agentPos.x - from.x;
                    const dy = agentPos.y - from.y;
                    path.setAttribute('d', `M ${from.x} ${from.y} C ${from.x + dx * 0.3} ${from.y + dy * 0.6}, ${agentPos.x - dx * 0.3} ${agentPos.y - dy * 0.3}, ${agentPos.x} ${agentPos.y}`);
                    pathCacheRef.current.set(pulse.feedIndex, path);
                }

                const progress = Math.min((now - pulse.startTime) / durationMs, 1);
                if (progress <= 0 || progress >= 1) continue;

                const length = path.getTotalLength();
                const headPos = progress;
                const tailPos = Math.max(0, progress - 0.3);
                const pts: { x: number; y: number }[] = [];
                for (let i = 0; i <= 8; i++) {
                    const pt = path.getPointAtLength(length * (tailPos + (headPos - tailPos) * (i / 8)));
                    pts.push({ x: pt.x, y: pt.y });
                }
                if (pts.length < 2) continue;

                const opacity = Math.min(1, progress / 0.15) * Math.min(1, (1 - progress) / 0.15);
                segs.push({
                    id: pulse.id,
                    d: `M ${pts[0].x} ${pts[0].y}` + pts.slice(1).map(p => ` L ${p.x} ${p.y}`).join(''),
                    opacity,
                    color: FEEDS[pulse.feedIndex]?.color ?? '#E8B45E',
                });
            }

            setSegments(segs);
            raf = requestAnimationFrame(calc);
        };
        raf = requestAnimationFrame(calc);
        return () => cancelAnimationFrame(raf);
    }, [pulses, feedPositions, agentPos, duration]);

    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            <defs>
                <filter id="pulseGlow2" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Static connection lines */}
            {feedPositions.map((from, i) => {
                const dx = agentPos.x - from.x;
                const dy = agentPos.y - from.y;
                const d = `M ${from.x} ${from.y} C ${from.x + dx * 0.3} ${from.y + dy * 0.6}, ${agentPos.x - dx * 0.3} ${agentPos.y - dy * 0.3}, ${agentPos.x} ${agentPos.y}`;
                return (
                    <path key={`line-${i}`} d={d} fill="none" stroke={FEEDS[i]?.color ?? '#333'} strokeWidth={1.5} opacity={0.12} />
                );
            })}

            {/* Animated pulses */}
            {segments.map(seg => (
                <g key={seg.id}>
                    <path d={seg.d} fill="none" stroke={seg.color} strokeWidth={4} strokeLinecap="round" opacity={seg.opacity * 0.3} filter="url(#pulseGlow2)" />
                    <path d={seg.d} fill="none" stroke={seg.color} strokeWidth={1.5} strokeLinecap="round" opacity={seg.opacity} />
                </g>
            ))}
        </svg>
    );
}

// ── Main component ──────────────────────────────────────────────

type DetailTab = 'tasks' | 'positions' | 'chats';

const DETAIL_TABS: { id: DetailTab; label: string; icon: typeof ListChecks }[] = [
    { id: 'tasks', label: 'Tasks', icon: ListChecks },
    { id: 'positions', label: 'Positions', icon: TrendingUp },
    { id: 'chats', label: 'Chats', icon: MessageSquare },
];

export function AgentDataFlow() {
    const { agent } = useAuthStore();
    const { user, authenticated, login } = usePrivy();
    const rawAvatarUrl = agent?.avatarUrl || user?.twitter?.profilePictureUrl || null;
    const avatarUrl = rawAvatarUrl?.replace('_normal.', '_400x400.') ?? null;
    const containerRef = useRef<HTMLDivElement>(null);
    const [dims, setDims] = useState({ w: 800, h: 500 });
    const statusInfo = AGENT_STATUS[agent?.status ?? 'TRAINING'] ?? AGENT_STATUS.TRAINING;

    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<DetailTab>('tasks');
    const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
    const isMobile = useIsMobile();
    const [tasks, setTasks] = useState<AgentTaskType[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [chats, setChats] = useState<AgentConversationSummary[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const fetchedRef = useRef(false);

    useEffect(() => {
        const update = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                setDims({ w: width, h: height });
            }
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // Fetch detail data when expanded for the first time
    useEffect(() => {
        if (!expanded || !agent || fetchedRef.current) return;
        fetchedRef.current = true;
        setDetailLoading(true);

        Promise.allSettled([
            getArenaTasks().catch(() => []),
            getAgentPositions(agent.id).catch(() => []),
            getAgentConversations(agent.id).catch(() => []),
        ]).then(([tasksRes, posRes, chatsRes]) => {
            if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value as AgentTaskType[]);
            if (posRes.status === 'fulfilled') setPositions(posRes.value as Position[]);
            if (chatsRes.status === 'fulfilled') setChats(chatsRes.value as AgentConversationSummary[]);
            setDetailLoading(false);
        });
    }, [expanded, agent]);

    const pulses = usePulseEngine(FEEDS.length, 3.5, 5);

    const feedPositions = useMemo(() => {
        const y = 55;
        const margin = dims.w * 0.12;
        const usable = dims.w - margin * 2;
        return FEEDS.map((_, i) => ({
            x: margin + (usable / (FEEDS.length - 1)) * i,
            y,
        }));
    }, [dims.w]);

    const agentPos = useMemo(() => ({ x: dims.w / 2, y: dims.h * 0.68 }), [dims]);

    const xpPercent = agent ? Math.min(100, Math.round((agent.xp / Math.max(1, agent.xpForNextLevel)) * 100)) : 0;
    const hasAgent = !!agent;

    const activeTasks = useMemo(() => tasks.filter(t => t.status === 'OPEN' || t.status === 'CLAIMED'), [tasks]);
    const openPositions = useMemo(() => positions.filter(p => !p.closedAt), [positions]);

    // ── Mobile layout ──────────────────────────────────────────
    if (isMobile) {
        return (
            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
                {/* DNA flow animation styles */}
                <style>{`
                    @keyframes dnaFlow {
                        0% { stroke-dashoffset: 80; }
                        100% { stroke-dashoffset: 0; }
                    }
                    @keyframes dnaFlowReverse {
                        0% { stroke-dashoffset: -80; }
                        100% { stroke-dashoffset: 0; }
                    }
                    .dna-pulse { animation: dnaFlow 2.5s ease-in-out infinite; }
                    .dna-pulse-reverse { animation: dnaFlowReverse 2.5s ease-in-out infinite; }
                `}</style>

                {/* Feed flow — centered cards with DNA helix connectors */}
                <div className="relative px-4 pt-5 pb-0">
                    {FEEDS.map((feed, i) => {
                        const Icon = feed.icon;
                        const c = `${feed.color}40`;
                        return (
                            <div key={feed.id}>
                                {/* DNA helix connector from previous card */}
                                {i > 0 && (
                                    <div className="relative h-14">
                                        <svg
                                            className="absolute inset-0 w-full h-full"
                                            viewBox="0 0 100 56"
                                            preserveAspectRatio="none"
                                            fill="none"
                                        >
                                            {/* Static strands */}
                                            <path
                                                d="M 36 0 C 36 22, 64 34, 64 56"
                                                stroke={FEEDS[i - 1].color}
                                                strokeWidth="1.5"
                                                opacity="0.3"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                            <path
                                                d="M 64 0 C 64 22, 36 34, 36 56"
                                                stroke={feed.color}
                                                strokeWidth="1.5"
                                                opacity="0.3"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                            {/* Animated flowing pulses */}
                                            <path
                                                d="M 36 0 C 36 22, 64 34, 64 56"
                                                stroke={FEEDS[i - 1].color}
                                                strokeWidth="2"
                                                opacity="0.6"
                                                vectorEffect="non-scaling-stroke"
                                                strokeDasharray="12 68"
                                                className="dna-pulse"
                                                style={{ animationDelay: `${i * 0.4}s` }}
                                            />
                                            <path
                                                d="M 64 0 C 64 22, 36 34, 36 56"
                                                stroke={feed.color}
                                                strokeWidth="2"
                                                opacity="0.6"
                                                vectorEffect="non-scaling-stroke"
                                                strokeDasharray="12 68"
                                                className="dna-pulse-reverse"
                                                style={{ animationDelay: `${i * 0.4 + 1.2}s` }}
                                            />
                                        </svg>
                                        {/* Center crossing node */}
                                        <div
                                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                                            style={{
                                                background: `linear-gradient(135deg, ${FEEDS[i - 1].color}, ${feed.color})`,
                                                opacity: 0.35,
                                            }}
                                        />
                                    </div>
                                )}
                                {/* Feed card */}
                                <div className="flex justify-center">
                                    <button
                                        onClick={() => setSelectedFeed(feed.id)}
                                        className="relative bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] px-4 py-2.5 cursor-pointer active:bg-white/[0.1] transition-colors w-[72%]"
                                    >
                                        <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l" style={{ borderColor: c }} />
                                        <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r" style={{ borderColor: c }} />
                                        <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l" style={{ borderColor: c }} />
                                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r" style={{ borderColor: c }} />

                                        <div className="flex items-center gap-3">
                                            <Icon className="w-6 h-6 flex-shrink-0" style={{ color: feed.color }} />
                                            <div className="min-w-0 text-left">
                                                <div className="text-sm font-bold text-text-primary leading-tight">{feed.label}</div>
                                                <div className="text-[10px] text-text-muted">{feed.desc}</div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Final convergence — both strands merge to center toward the agent */}
                    <div className="relative h-10">
                        <svg
                            className="absolute inset-0 w-full h-full"
                            viewBox="0 0 100 40"
                            preserveAspectRatio="none"
                            fill="none"
                        >
                            <path
                                d="M 36 0 C 36 16, 50 28, 50 40"
                                stroke={FEEDS[FEEDS.length - 1].color}
                                strokeWidth="1.5"
                                opacity="0.25"
                                vectorEffect="non-scaling-stroke"
                            />
                            <path
                                d="M 64 0 C 64 16, 50 28, 50 40"
                                stroke={FEEDS[FEEDS.length - 1].color}
                                strokeWidth="1.5"
                                opacity="0.25"
                                vectorEffect="non-scaling-stroke"
                            />
                            {/* Animated convergence pulses */}
                            <path
                                d="M 36 0 C 36 16, 50 28, 50 40"
                                stroke={FEEDS[FEEDS.length - 1].color}
                                strokeWidth="2"
                                opacity="0.5"
                                vectorEffect="non-scaling-stroke"
                                strokeDasharray="10 50"
                                className="dna-pulse"
                                style={{ animationDelay: '1.6s' }}
                            />
                            <path
                                d="M 64 0 C 64 16, 50 28, 50 40"
                                stroke={FEEDS[FEEDS.length - 1].color}
                                strokeWidth="2"
                                opacity="0.5"
                                vectorEffect="non-scaling-stroke"
                                strokeDasharray="10 50"
                                className="dna-pulse-reverse"
                                style={{ animationDelay: '2.8s' }}
                            />
                        </svg>
                    </div>
                </div>

                {/* Agent card */}
                <div className="mx-4 mb-4 mt-2 bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    {hasAgent ? (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="w-full px-4 py-4 flex items-center gap-3.5 cursor-pointer active:bg-white/[0.04] transition-colors"
                        >
                            <div className="w-11 h-11 rounded-full bg-accent-primary/10 border-2 border-accent-primary/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={agent.name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <span className="text-accent-primary font-bold text-lg">
                                        {agent.name?.charAt(0)?.toUpperCase() ?? '?'}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-text-primary truncate">{agent.name}</span>
                                    <span className="bg-accent-primary/15 border border-accent-primary/25 px-1.5 py-0.5 text-[10px] font-bold text-accent-primary">
                                        Lv.{agent.level}
                                    </span>
                                    <div className={`flex items-center gap-1 text-[10px] font-semibold ${statusInfo.color}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} animate-pulse`} />
                                        {statusInfo.label}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="flex-1 h-1.5 bg-white/[0.06] overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-accent-primary/80 to-accent-primary transition-all duration-500"
                                            style={{ width: `${xpPercent}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-text-muted font-mono whitespace-nowrap">
                                        {agent.xp}/{agent.xpForNextLevel}
                                    </span>
                                </div>
                            </div>
                            <ChevronDown
                                className="w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-300"
                                style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            />
                        </button>
                    ) : (
                        <button
                            onClick={() => { if (!authenticated) login(); }}
                            className="w-full relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform duration-150"
                        >
                            {/* Animated glow background */}
                            <div className="absolute inset-0 bg-gradient-to-b from-accent-primary/[0.08] via-accent-primary/[0.03] to-transparent" />
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[1px] bg-gradient-to-r from-transparent via-accent-primary/60 to-transparent" />

                            <div className="relative px-4 py-5">
                                {/* Title row — full width */}
                                <h3 className="text-base font-bold text-text-primary text-center w-full">
                                    {authenticated ? 'Deploy Your Agent' : 'Deploy Your Agent'}
                                </h3>
                                <p className="text-[11px] text-text-muted text-center mt-1 leading-relaxed">
                                    {authenticated
                                        ? 'All data feeds are live. Configure your strategy and start trading.'
                                        : 'All data feeds converge here. Sign in to activate your AI trading agent.'}
                                </p>

                                {/* CTA button */}
                                <div className="mt-4">
                                    <div className="relative">
                                        <div className="absolute -inset-1 bg-accent-primary/20 blur-lg" />
                                        <div className="relative w-full py-3 bg-accent-primary/15 border border-accent-primary/40 flex items-center justify-center">
                                            <span className="text-base font-bold text-accent-primary tracking-wide">
                                                {authenticated ? 'Create' : 'Create'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom accent line */}
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-accent-primary/40 to-transparent" />
                        </button>
                    )}
                </div>

                {/* Expandable detail panel */}
                {hasAgent && (
                    <div
                        className="grid transition-[grid-template-rows] duration-300 ease-out"
                        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                    >
                        <div className="overflow-hidden">
                            <div className="border-t border-white/[0.06]">
                                <div className="flex items-center justify-between px-4 py-2.5">
                                    <span className="text-xs font-bold text-text-primary">
                                        {DETAIL_TABS.find(t => t.id === activeTab)?.label}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {DETAIL_TABS.map((tab) => {
                                            const Icon = tab.icon;
                                            const isActive = activeTab === tab.id;
                                            const count = tab.id === 'tasks' ? activeTasks.length
                                                : tab.id === 'positions' ? openPositions.length
                                                : chats.length;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActiveTab(tab.id)}
                                                    className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold transition-all cursor-pointer ${
                                                        isActive
                                                            ? 'text-accent-primary bg-accent-primary/10 border border-accent-primary/20'
                                                            : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03] border border-transparent'
                                                    }`}
                                                >
                                                    <Icon className="w-3.5 h-3.5" />
                                                    {count > 0 && (
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                                            isActive ? 'bg-accent-primary/20 text-accent-primary' : 'bg-white/[0.06] text-text-muted'
                                                        }`}>
                                                            {count}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="px-4 pb-4 min-h-[120px] max-h-[280px] overflow-y-auto">
                                    {detailLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <div className="w-5 h-5 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
                                        </div>
                                    ) : activeTab === 'tasks' ? (
                                        <TasksSection tasks={activeTasks} />
                                    ) : activeTab === 'positions' ? (
                                        <PositionsSection positions={openPositions} />
                                    ) : (
                                        <ChatsSection chats={chats} />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <FeedDetailSheet
                    feedId={selectedFeed}
                    open={!!selectedFeed}
                    onClose={() => setSelectedFeed(null)}
                    isMobile={isMobile}
                />
            </div>
        );
    }

    // ── Desktop layout ──────────────────────────────────────────
    return (
        <div className="bg-[#0a0a12]/60 backdrop-blur-xl border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
            <div ref={containerRef} className="relative h-[320px]">

                {/* Pulse animation layer */}
                <PulseLayer
                    feedPositions={feedPositions}
                    agentPos={agentPos}
                    pulses={pulses}
                    duration={3.5}
                    width={dims.w}
                    height={dims.h}
                />

                {/* ── Feed nodes (top row) ── */}
                {FEEDS.map((feed, i) => {
                    const Icon = feed.icon;
                    const pos = feedPositions[i];
                    const c = `${feed.color}40`;
                    return (
                        <div
                            key={feed.id}
                            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                            style={{ left: pos?.x, top: pos?.y }}
                        >
                            <div
                                className="relative bg-[#0e0e18]/90 backdrop-blur-md px-6 py-3.5 cursor-pointer group hover:bg-[#0e0e18] transition-colors duration-200"
                                onClick={() => setSelectedFeed(feed.id)}
                            >
                                {/* Corner brackets */}
                                <span className="absolute top-0 left-0 w-3 h-3 border-t border-l" style={{ borderColor: c }} />
                                <span className="absolute top-0 right-0 w-3 h-3 border-t border-r" style={{ borderColor: c }} />
                                <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l" style={{ borderColor: c }} />
                                <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r" style={{ borderColor: c }} />

                                <div className="flex items-center gap-3.5">
                                    <Icon className="w-6 h-6 flex-shrink-0" style={{ color: feed.color }} />
                                    <div className="flex flex-col">
                                        <span className="text-base font-bold text-text-primary whitespace-nowrap leading-tight">{feed.label}</span>
                                        <span className="text-[10px] text-text-muted whitespace-nowrap">{feed.desc}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* ── Agent card (bottom center) ── */}
                <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                    style={{ left: agentPos.x, top: agentPos.y }}
                >
                    {hasAgent ? (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="relative cursor-pointer group"
                        >
                            {/* Glow */}
                            <div className="absolute -inset-3 bg-accent-primary/[0.06] blur-xl pointer-events-none group-hover:bg-accent-primary/[0.1] transition-all duration-300" />

                            <div className="relative bg-[#0e0e18]/95 backdrop-blur-xl px-8 py-5 flex items-center gap-5 shadow-[0_0_40px_rgba(232,180,94,0.06)] group-hover:bg-[#0e0e18] transition-colors duration-200">
                                {/* Corner brackets */}
                                <span className="absolute top-0 left-0 w-4 h-4 border-t border-l border-accent-primary/40 group-hover:border-accent-primary/60 transition-colors" />
                                <span className="absolute top-0 right-0 w-4 h-4 border-t border-r border-accent-primary/40 group-hover:border-accent-primary/60 transition-colors" />
                                <span className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-accent-primary/40 group-hover:border-accent-primary/60 transition-colors" />
                                <span className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-accent-primary/40 group-hover:border-accent-primary/60 transition-colors" />

                                {/* Avatar */}
                                <div className="w-16 h-16 rounded-full bg-accent-primary/10 border-2 border-accent-primary/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={agent.name} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        <span className="text-accent-primary font-bold text-2xl">
                                            {agent.name?.charAt(0)?.toUpperCase() ?? '?'}
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex flex-col gap-1.5 min-w-0 text-left">
                                    <div className="flex items-center gap-2.5">
                                        <h3 className="text-lg font-bold text-text-primary truncate">{agent.name}</h3>
                                        <span className="bg-accent-primary/15 border border-accent-primary/25 px-2 py-0.5 text-xs font-bold text-accent-primary whitespace-nowrap">
                                            Lv.{agent.level}
                                        </span>
                                        <div className={`flex items-center gap-1 text-[10px] font-semibold ${statusInfo.color}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} animate-pulse`} />
                                            {statusInfo.label}
                                        </div>
                                    </div>

                                    {/* XP bar */}
                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="w-44 h-2 bg-white/[0.06] overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-accent-primary/80 to-accent-primary transition-all duration-500"
                                                style={{ width: `${xpPercent}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-text-muted font-mono whitespace-nowrap">
                                            {agent.xp} / {agent.xpForNextLevel} XP
                                        </span>
                                    </div>
                                </div>

                                {/* Expand chevron */}
                                <div className="pl-3 border-l border-white/[0.06] ml-2 flex-shrink-0">
                                    <ChevronDown
                                        className="w-5 h-5 text-text-muted transition-transform duration-300 ease-out"
                                        style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                    />
                                </div>
                            </div>
                        </button>
                    ) : (
                        /* No agent — CTA */
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-accent-primary/[0.06] blur-2xl pointer-events-none group-hover:bg-accent-primary/[0.1] transition-all duration-500" />
                            <button
                                onClick={() => { if (!authenticated) login(); }}
                                className="relative bg-[#0e0e18]/95 backdrop-blur-xl px-8 py-5 flex flex-col items-center gap-3 max-w-md cursor-pointer hover:bg-[#0e0e18] transition-all duration-300"
                            >
                                {/* Corner brackets */}
                                <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent-primary/40 group-hover:border-accent-primary/70 transition-colors duration-300" />
                                <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent-primary/40 group-hover:border-accent-primary/70 transition-colors duration-300" />
                                <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent-primary/40 group-hover:border-accent-primary/70 transition-colors duration-300" />
                                <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent-primary/40 group-hover:border-accent-primary/70 transition-colors duration-300" />

                                <div className="w-12 h-12 rounded-full bg-accent-primary/10 border-2 border-accent-primary/25 flex items-center justify-center group-hover:border-accent-primary/50 group-hover:bg-accent-primary/15 transition-all duration-300">
                                    <Rocket className="w-5 h-5 text-accent-primary" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-base font-bold text-text-primary mb-1">
                                        {authenticated ? 'Create Your Agent' : 'Sign In to Deploy'}
                                    </h3>
                                    <p className="text-[11px] text-text-muted leading-relaxed max-w-[260px]">
                                        {authenticated
                                            ? 'Set up your AI trading agent to start receiving live feeds and executing trades automatically.'
                                            : 'Connect with Twitter to deploy your own AI trading agent and join the arena.'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-1.5 bg-accent-primary/10 border border-accent-primary/30 group-hover:bg-accent-primary/20 group-hover:border-accent-primary/50 transition-all duration-300">
                                    <Zap className="w-3.5 h-3.5 text-accent-primary" />
                                    <span className="text-xs font-bold text-accent-primary">
                                        {authenticated ? 'Get Started' : 'Sign In with Twitter'}
                                    </span>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

            </div>


            {/* Expandable detail panel */}
            {hasAgent && (
                <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                >
                    <div className="overflow-hidden">
                        <div className="border-t border-white/[0.06]">
                            {/* Tab icons — top right */}
                            <div className="flex items-center justify-between px-4 py-2.5">
                                <span className="text-xs font-bold text-text-primary">
                                    {DETAIL_TABS.find(t => t.id === activeTab)?.label}
                                </span>
                                <div className="flex items-center gap-1">
                                    {DETAIL_TABS.map((tab) => {
                                        const Icon = tab.icon;
                                        const isActive = activeTab === tab.id;
                                        const count = tab.id === 'tasks' ? activeTasks.length
                                            : tab.id === 'positions' ? openPositions.length
                                            : chats.length;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold transition-all cursor-pointer ${
                                                    isActive
                                                        ? 'text-accent-primary bg-accent-primary/10 border border-accent-primary/20'
                                                        : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03] border border-transparent'
                                                }`}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">{tab.label}</span>
                                                {count > 0 && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                                        isActive ? 'bg-accent-primary/20 text-accent-primary' : 'bg-white/[0.06] text-text-muted'
                                                    }`}>
                                                        {count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Tab content */}
                            <div className="px-4 pb-4 min-h-[120px] max-h-[280px] overflow-y-auto">
                                {detailLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="w-5 h-5 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
                                    </div>
                                ) : activeTab === 'tasks' ? (
                                    <TasksSection tasks={activeTasks} />
                                ) : activeTab === 'positions' ? (
                                    <PositionsSection positions={openPositions} />
                                ) : (
                                    <ChatsSection chats={chats} />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Feed Detail Sheet */}
            <FeedDetailSheet
                feedId={selectedFeed}
                open={!!selectedFeed}
                onClose={() => setSelectedFeed(null)}
                isMobile={isMobile}
            />
        </div>
    );
}

// ── Feed Detail Sheet ───────────────────────────────────────────

function FeedDetailSheet({ feedId, open, onClose, isMobile }: { feedId: string | null; open: boolean; onClose: () => void; isMobile: boolean }) {
    const feed = FEEDS.find(f => f.id === feedId);
    const details = feedId ? FEED_DETAILS[feedId] : null;
    if (!feed || !details) return null;

    const Icon = feed.icon;

    return (
        <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <SheetContent side={isMobile ? 'bottom' : 'right'} className="overflow-y-auto">
                <SheetHeader className="text-left">
                    <div className="flex items-center gap-3 mb-1">
                        <div
                            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${feed.color}15`, border: `1px solid ${feed.color}30` }}
                        >
                            <Icon className="w-5 h-5" style={{ color: feed.color }} />
                        </div>
                        <div>
                            <SheetTitle className="text-lg font-bold text-text-primary">{feed.label}</SheetTitle>
                            <SheetDescription className="text-xs text-text-muted mt-0">{details.tagline}</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="mt-5 space-y-6 px-1">
                    {/* Description */}
                    <p className="text-sm text-text-secondary leading-relaxed">
                        {details.description}
                    </p>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                        {details.stats.map((stat) => (
                            <div key={stat.label} className="bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-center">
                                <div className="text-base font-bold font-mono" style={{ color: feed.color }}>{stat.value}</div>
                                <div className="text-[10px] text-text-muted mt-0.5">{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Features */}
                    <div>
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3">How it works</h4>
                        <div className="space-y-3">
                            {details.features.map((feature) => {
                                const FeatureIcon = feature.icon;
                                return (
                                    <div key={feature.title} className="flex gap-3">
                                        <div
                                            className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5"
                                            style={{ backgroundColor: `${feed.color}10` }}
                                        >
                                            <FeatureIcon className="w-4 h-4" style={{ color: feed.color }} />
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-semibold text-text-primary">{feature.title}</h5>
                                            <p className="text-xs text-text-muted leading-relaxed mt-0.5">{feature.desc}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Status indicator */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.02] border border-white/[0.06]">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs text-text-muted">Feed active — delivering signals to your agent</span>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ── Detail section components ────────────────────────────────────

function TasksSection({ tasks }: { tasks: AgentTaskType[] }) {
    if (tasks.length === 0) {
        return (
            <div className="text-center py-6">
                <ListChecks className="w-6 h-6 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-text-muted">No active tasks</p>
            </div>
        );
    }
    return (
        <div className="space-y-2">
            {tasks.map((task) => (
                <div key={task.taskId} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'CLAIMED' ? 'bg-yellow-400' : 'bg-emerald-400'}`} />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-text-muted uppercase">{task.taskType}</span>
                            {task.tokenSymbol && (
                                <span className="text-[10px] text-accent-primary font-mono">${task.tokenSymbol}</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-accent-primary/10 border border-accent-primary/20 flex-shrink-0">
                        <Zap className="w-3 h-3 text-accent-primary" />
                        <span className="text-[10px] font-bold text-accent-primary">+{task.xpReward} XP</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function PositionsSection({ positions }: { positions: Position[] }) {
    if (positions.length === 0) {
        return (
            <div className="text-center py-6">
                <TrendingUp className="w-6 h-6 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-text-muted">No open positions</p>
            </div>
        );
    }
    return (
        <div className="space-y-2">
            {positions.map((pos) => {
                const isProfit = pos.pnl >= 0;
                return (
                    <div key={pos.positionId} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                        <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${isProfit ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                            {isProfit ? (
                                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <ArrowDownRight className="w-4 h-4 text-red-400" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-text-primary">${pos.tokenSymbol}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-text-muted font-mono">
                                    Entry: ${pos.entryPrice.toFixed(6)}
                                </span>
                                <span className="text-[10px] text-text-muted">→</span>
                                <span className="text-[10px] text-text-muted font-mono">
                                    Now: ${pos.currentPrice.toFixed(6)}
                                </span>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className={`text-xs font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isProfit ? '+' : ''}{pos.pnlPercent.toFixed(1)}%
                            </p>
                            <p className="text-[10px] text-text-muted font-mono">
                                ${pos.currentValue.toFixed(2)}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ChatsSection({ chats }: { chats: AgentConversationSummary[] }) {
    if (chats.length === 0) {
        return (
            <div className="text-center py-6">
                <MessageSquare className="w-6 h-6 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-text-muted">No conversations yet</p>
            </div>
        );
    }
    return (
        <div className="space-y-2">
            {chats.map((chat) => (
                <div key={chat.conversationId} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                    <div className="w-8 h-8 bg-[#818CF8]/10 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-4 h-4 text-[#818CF8]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate">{chat.topic}</p>
                        {chat.lastMessage && (
                            <p className="text-[10px] text-text-muted truncate mt-0.5">{chat.lastMessage}</p>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-text-muted">{chat.agentMessageCount} msgs</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-text-muted">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(chat.lastMessageAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
