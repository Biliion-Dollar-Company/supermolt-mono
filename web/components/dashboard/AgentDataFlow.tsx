'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Wifi, Radio, BarChart3, Brain, Users, ArrowDown, X,
    Zap, Shield, BookOpen, Activity,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getPipelineStatus } from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────

type NodeCategory = 'source' | 'processor';

interface FlowNode {
    id: string;
    label: string;
    subtitle: string;
    icon: typeof Wifi;
    category: NodeCategory;
}

interface SidebarContent {
    id: string;
    label: string;
    subtitle: string;
    icon: typeof Wifi;
    category: NodeCategory;
}

// ── Node definitions ────────────────────────────────────────────

const SOURCES: FlowNode[] = [
    { id: 'helius', label: 'Helius', subtitle: 'On-Chain Data', icon: Wifi, category: 'source' },
    { id: 'twitter', label: 'Twitter', subtitle: 'Social Intelligence', icon: Radio, category: 'source' },
    { id: 'dexscreener', label: 'DexScreener', subtitle: 'Market Data', icon: BarChart3, category: 'source' },
    { id: 'arena', label: 'Arena', subtitle: 'Community Signals', icon: Users, category: 'source' },
];

const PROCESSORS: FlowNode[] = [
    { id: 'signal', label: 'Signal Analyzer', subtitle: 'Combining feeds', icon: Zap, category: 'processor' },
    { id: 'risk', label: 'Risk Engine', subtitle: 'Position sizing', icon: Shield, category: 'processor' },
    { id: 'narrative', label: 'Narrative Engine', subtitle: 'Market narratives', icon: BookOpen, category: 'processor' },
];

const ALL_NODES = [...SOURCES, ...PROCESSORS];

// Source → Processor connections (each source feeds nearest processors)
const SOURCE_TO_PROCESSOR: [string, string][] = [
    ['helius', 'signal'],
    ['twitter', 'signal'],
    ['twitter', 'risk'],
    ['dexscreener', 'risk'],
    ['dexscreener', 'narrative'],
    ['arena', 'narrative'],
];

// ── Layout: top-to-bottom funnel ────────────────────────────────
//    Row 1 (top):    4 sources spread horizontally
//    Row 2 (mid):    3 processors spread horizontally
//    Row 3 (bottom): Agent center

const W = 960;
const H = 640;
const CX = W / 2;

const ROW_Y = { source: 65, processor: 280, agent: 520 };

// Explicit positions for each node
const NODE_POS: Record<string, { x: number; y: number }> = {
    helius:      { x: 130, y: ROW_Y.source },
    twitter:     { x: 370, y: ROW_Y.source },
    dexscreener: { x: 590, y: ROW_Y.source },
    arena:       { x: 830, y: ROW_Y.source },
    signal:      { x: 220, y: ROW_Y.processor },
    risk:        { x: 480, y: ROW_Y.processor },
    narrative:   { x: 740, y: ROW_Y.processor },
};

const AGENT_POS = { x: CX, y: ROW_Y.agent };

function getNodePos(id: string) {
    return NODE_POS[id] ?? { x: CX, y: H / 2 };
}

function buildCurve(from: { x: number; y: number }, to: { x: number; y: number }) {
    const midY = from.y + (to.y - from.y) * 0.5;
    return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
}

// ── Sidebar detail data ─────────────────────────────────────────

const SIDEBAR_DATA: Record<string, { streams: string[]; description: string }> = {
    helius: {
        description: 'Real-time blockchain event monitoring via Helius WebSocket. Tracks wallet activity, token transfers, and DEX swaps as they happen.',
        streams: ['Token transfers & swaps', 'Wallet balance changes', 'DEX trade events', 'LP position updates'],
    },
    twitter: {
        description: 'Social intelligence layer monitoring influencer activity, sentiment shifts, and emerging narratives across crypto Twitter.',
        streams: ['Influencer tweet monitoring', 'Mindshare density scoring', 'Sentiment analysis', 'Engagement tracking'],
    },
    dexscreener: {
        description: 'Market data feeds providing real-time pricing, volume, liquidity metrics, and market cap data across DEXs.',
        streams: ['Real-time token prices', 'Volume & liquidity metrics', 'Market cap tracking', 'Price change alerts'],
    },
    arena: {
        description: 'Cooperative intelligence from the SuperMolt arena — agent votes, task completions, and collective trading signals.',
        streams: ['Agent voting results', 'Task completions & XP', 'Leaderboard signals', 'Collective trade proposals'],
    },
    signal: {
        description: 'Combines all incoming data feeds into actionable trading signals. Your aggression level and enabled feeds determine signal sensitivity.',
        streams: ['Multi-source signal fusion', 'Configurable sensitivity', 'Feed weighting', 'Alert thresholds'],
    },
    risk: {
        description: 'Evaluates every signal against your risk parameters before executing trades. Controls position sizing, take-profit, and stop-loss levels.',
        streams: ['Position size limits', 'Risk level enforcement', 'Take-profit targets', 'Stop-loss protection'],
    },
    narrative: {
        description: 'LLM-powered engine that detects and scores market narratives. Identifies trending themes across social and market data.',
        streams: ['Narrative detection', 'Theme scoring', 'Trend identification', 'Cross-source correlation'],
    },
};

// ── Status hook ─────────────────────────────────────────────────

function usePipelineStatus() {
    const [status, setStatus] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let active = true;
        async function poll() {
            try {
                const res = await getPipelineStatus();
                if (!active) return;
                const s = res.services;
                setStatus({
                    helius: s.helius?.connected ?? false,
                    twitter: s.twitter?.connected ?? false,
                    dexscreener: true,
                    arena: s.socketio?.connected ?? true,
                    signal: s.helius?.connected ?? false,
                    risk: true,
                    narrative: s.llm?.connected ?? false,
                });
            } catch { /* keep defaults */ }
        }
        poll();
        const id = setInterval(poll, 30_000);
        return () => { active = false; clearInterval(id); };
    }, []);

    return status;
}

// ── Mobile check ────────────────────────────────────────────────

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 768px)');
        setIsMobile(mq.matches);
        const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', h);
        return () => mq.removeEventListener('change', h);
    }, []);
    return isMobile;
}

// ── Status config ───────────────────────────────────────────────

const AGENT_STATUS: Record<string, { label: string; color: string; dot: string }> = {
    TRAINING: { label: 'Training', color: 'text-yellow-400', dot: 'bg-yellow-400' },
    ACTIVE: { label: 'Active', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    PAUSED: { label: 'Paused', color: 'text-text-muted', dot: 'bg-text-muted' },
};

// ── Main component ──────────────────────────────────────────────

export function AgentDataFlow() {
    const { agent } = useAuthStore();
    const pipelineStatus = usePipelineStatus();
    const isMobile = useIsMobile();
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const closeSidebar = useCallback(() => setSelectedNode(null), []);

    // Close on click outside
    useEffect(() => {
        if (!selectedNode) return;
        function handleClick(e: MouseEvent) {
            if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
                closeSidebar();
            }
        }
        const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
        return () => { clearTimeout(timer); document.removeEventListener('click', handleClick); };
    }, [selectedNode, closeSidebar]);

    if (isMobile) {
        return <MobileDataFlow agent={agent} status={pipelineStatus} selectedNode={selectedNode} setSelectedNode={setSelectedNode} />;
    }

    const statusInfo = AGENT_STATUS[agent?.status ?? 'TRAINING'] ?? AGENT_STATUS.TRAINING;
    const selectedData = selectedNode ? ALL_NODES.find(n => n.id === selectedNode) : null;

    return (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-6 overflow-hidden">
            <div className="relative w-full" style={{ maxWidth: W, margin: '0 auto', aspectRatio: `${W}/${H}` }}>

                {/* ── SVG connection layer ── */}
                <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full pointer-events-none" fill="none">
                    <defs>
                        {/* Source → Processor gradients (amber) */}
                        {SOURCE_TO_PROCESSOR.map(([srcId, procId], i) => {
                            const from = getNodePos(srcId);
                            const to = getNodePos(procId);
                            return (
                                <linearGradient key={`sg-${i}`} id={`sg-${srcId}-${procId}`} gradientUnits="userSpaceOnUse"
                                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}>
                                    <stop offset="0%" stopColor="#E8B45E" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#E8B45E" stopOpacity="0.1" />
                                </linearGradient>
                            );
                        })}
                        {/* Processor → Agent gradients (blue-purple) */}
                        {PROCESSORS.map(p => {
                            const from = getNodePos(p.id);
                            return (
                                <linearGradient key={`pg-${p.id}`} id={`pg-${p.id}`} gradientUnits="userSpaceOnUse"
                                    x1={from.x} y1={from.y} x2={AGENT_POS.x} y2={AGENT_POS.y}>
                                    <stop offset="0%" stopColor="#818CF8" stopOpacity="0.5" />
                                    <stop offset="100%" stopColor="#E8B45E" stopOpacity="0.15" />
                                </linearGradient>
                            );
                        })}
                    </defs>

                    {/* Source → Processor paths */}
                    {SOURCE_TO_PROCESSOR.map(([srcId, procId], i) => {
                        const from = getNodePos(srcId);
                        const to = getNodePos(procId);
                        const path = buildCurve(from, to);
                        const delay = `${i * 0.5}s`;
                        return (
                            <g key={`sp-${i}`}>
                                <path d={path} stroke={`url(#sg-${srcId}-${procId})`} strokeWidth="1.2" />
                                <circle r="1.8" fill="#E8B45E" opacity="0.8">
                                    <animateMotion dur="3.5s" repeatCount="indefinite" path={path} begin={delay} />
                                </circle>
                                <circle r="4.5" fill="#E8B45E" opacity="0.1">
                                    <animateMotion dur="3.5s" repeatCount="indefinite" path={path} begin={delay} />
                                </circle>
                            </g>
                        );
                    })}

                    {/* Processor → Agent paths */}
                    {PROCESSORS.map((p, i) => {
                        const from = getNodePos(p.id);
                        const path = buildCurve(from, AGENT_POS);
                        const delay = `${i * 0.8}s`;
                        return (
                            <g key={`pa-${p.id}`}>
                                <path d={path} stroke={`url(#pg-${p.id})`} strokeWidth="1.5" />
                                <circle r="2" fill="#818CF8" opacity="0.9">
                                    <animateMotion dur="2.8s" repeatCount="indefinite" path={path} begin={delay} />
                                </circle>
                                <circle r="5" fill="#818CF8" opacity="0.12">
                                    <animateMotion dur="2.8s" repeatCount="indefinite" path={path} begin={delay} />
                                </circle>
                            </g>
                        );
                    })}
                </svg>

                {/* ── Source nodes (outer ring) ── */}
                {SOURCES.map((s) => {
                    const pos = getNodePos(s.id);
                    const Icon = s.icon;
                    const connected = pipelineStatus[s.id] ?? false;
                    const isSelected = selectedNode === s.id;
                    return (
                        <button
                            key={s.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedNode(isSelected ? null : s.id); }}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 group
                                ${isSelected ? 'scale-105 z-20' : 'hover:scale-105'}`}
                            style={{ left: `${(pos.x / W) * 100}%`, top: `${(pos.y / H) * 100}%` }}
                        >
                            <div className={`relative bg-[#12121a]/90 border rounded-lg px-3.5 py-2.5 backdrop-blur-sm transition-colors
                                ${isSelected ? 'border-accent-primary/40 shadow-[0_0_16px_rgba(232,180,94,0.12)]' : 'border-white/[0.1] hover:border-white/[0.2]'}`}>
                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 text-accent-primary/80 flex-shrink-0" />
                                    <div className="text-left">
                                        <div className="text-xs font-bold text-text-primary whitespace-nowrap">{s.label}</div>
                                        <div className="text-[10px] text-text-muted whitespace-nowrap">{s.subtitle}</div>
                                    </div>
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ml-1 ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400/60'}`} />
                                </div>
                            </div>
                        </button>
                    );
                })}

                {/* ── Processor nodes (inner ring) ── */}
                {PROCESSORS.map((p) => {
                    const pos = getNodePos(p.id);
                    const Icon = p.icon;
                    const active = pipelineStatus[p.id] ?? false;
                    const isSelected = selectedNode === p.id;
                    return (
                        <button
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedNode(isSelected ? null : p.id); }}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200
                                ${isSelected ? 'scale-105 z-20' : 'hover:scale-105'}`}
                            style={{ left: `${(pos.x / W) * 100}%`, top: `${(pos.y / H) * 100}%` }}
                        >
                            <div className={`relative bg-[#12121a]/90 border rounded-lg px-3.5 py-2.5 backdrop-blur-sm transition-colors
                                ${isSelected ? 'border-indigo-400/40 shadow-[0_0_16px_rgba(129,140,248,0.12)]' : 'border-indigo-500/[0.15] hover:border-indigo-400/[0.3]'}`}>
                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 text-indigo-400/80 flex-shrink-0" />
                                    <div className="text-left">
                                        <div className="text-xs font-bold text-text-primary whitespace-nowrap">{p.label}</div>
                                        <div className="text-[10px] text-text-muted whitespace-nowrap">{p.subtitle}</div>
                                    </div>
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ml-1 ${active ? 'bg-indigo-400 animate-pulse' : 'bg-red-400/60'}`} />
                                </div>
                            </div>
                        </button>
                    );
                })}

                {/* ── Agent center node ── */}
                <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10" style={{ left: `${(AGENT_POS.x / W) * 100}%`, top: `${(AGENT_POS.y / H) * 100}%` }}>
                    <div className="absolute inset-0 -m-4 rounded-full bg-accent-primary/[0.06] blur-xl" />
                    <div className="relative bg-[#12121a]/90 border border-accent-primary/20 rounded-xl px-6 py-4 flex flex-col items-center gap-2 backdrop-blur-xl shadow-[0_0_30px_rgba(232,180,94,0.08)]">
                        <div className="w-16 h-16 rounded-full bg-accent-primary/10 border-2 border-accent-primary/30 flex items-center justify-center">
                            {agent?.avatarUrl ? (
                                <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span className="text-accent-primary font-bold text-2xl">
                                    {agent?.name?.charAt(0)?.toUpperCase() ?? '?'}
                                </span>
                            )}
                        </div>
                        <div className="text-center">
                            <h3 className="text-sm font-bold text-text-primary">{agent?.name ?? 'Your Agent'}</h3>
                            <div className={`flex items-center justify-center gap-1 text-[10px] font-semibold ${statusInfo.color}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} animate-pulse`} />
                                {statusInfo.label}
                            </div>
                        </div>
                        {agent && (
                            <div className="bg-accent-primary/10 border border-accent-primary/20 rounded px-2.5 py-0.5">
                                <span className="text-[10px] font-bold text-accent-primary">Lv.{agent.level} {agent.levelName}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Detail sidebar ── */}
                <div
                    ref={sidebarRef}
                    className={`absolute top-0 right-0 h-full w-[320px] z-30 transition-transform duration-300 ease-out
                        ${selectedNode ? 'translate-x-0' : 'translate-x-full'}`}
                >
                    {selectedData && (
                        <div className="h-full bg-[#0e0e16]/95 backdrop-blur-xl border-l border-white/[0.08] p-4 overflow-y-auto">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <selectedData.icon className={`w-4.5 h-4.5 ${selectedData.category === 'source' ? 'text-accent-primary' : 'text-indigo-400'}`} />
                                    <div>
                                        <h4 className="text-sm font-bold text-text-primary">{selectedData.label}</h4>
                                        <p className="text-[10px] text-text-muted">{selectedData.subtitle}</p>
                                    </div>
                                </div>
                                <button onClick={closeSidebar} className="text-text-muted hover:text-text-primary transition-colors cursor-pointer p-1">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Status */}
                            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 mb-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Activity className="w-3 h-3 text-text-muted" />
                                    <span className="text-[10px] text-text-muted uppercase tracking-wider">Status</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${pipelineStatus[selectedNode!] ? 'bg-emerald-400 animate-pulse' : 'bg-red-400/60'}`} />
                                    <span className={`text-xs font-semibold ${pipelineStatus[selectedNode!] ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {pipelineStatus[selectedNode!] ? 'Connected' : 'Disconnected'}
                                    </span>
                                </div>
                            </div>

                            {/* Description */}
                            <p className="text-xs text-text-muted leading-relaxed mb-4">
                                {SIDEBAR_DATA[selectedNode!]?.description}
                            </p>

                            {/* Capabilities / Streams */}
                            <div className="mb-4">
                                <h5 className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
                                    {selectedData.category === 'source' ? 'Data Streams' : 'Capabilities'}
                                </h5>
                                <div className="space-y-1.5">
                                    {SIDEBAR_DATA[selectedNode!]?.streams.map((stream, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                                            <div className={`w-1 h-1 rounded-full flex-shrink-0 ${selectedData.category === 'source' ? 'bg-accent-primary/60' : 'bg-indigo-400/60'}`} />
                                            {stream}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Config hint for processors */}
                            {selectedData.category === 'processor' && (
                                <div className="bg-indigo-500/[0.06] border border-indigo-500/[0.12] rounded-lg p-3">
                                    <p className="text-[10px] text-indigo-300/80 leading-relaxed">
                                        Configure this in the <strong>Configure</strong> tab to adjust how your agent processes signals and manages risk.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Mobile layout ───────────────────────────────────────────────

function MobileDataFlow({
    agent, status, selectedNode, setSelectedNode,
}: {
    agent: any;
    status: Record<string, boolean>;
    selectedNode: string | null;
    setSelectedNode: (id: string | null) => void;
}) {
    const statusInfo = AGENT_STATUS[agent?.status ?? 'TRAINING'] ?? AGENT_STATUS.TRAINING;

    return (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4">
            {/* Section label */}
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Data Sources</div>

            {/* Source cards */}
            <div className="grid grid-cols-2 gap-2 mb-2">
                {SOURCES.map((s) => {
                    const Icon = s.icon;
                    const connected = status[s.id] ?? false;
                    return (
                        <button
                            key={s.id}
                            onClick={() => setSelectedNode(selectedNode === s.id ? null : s.id)}
                            className={`bg-white/[0.02] border rounded-lg px-3 py-2.5 flex items-center gap-2 text-left cursor-pointer transition-colors
                                ${selectedNode === s.id ? 'border-accent-primary/30' : 'border-white/[0.06] hover:border-white/[0.12]'}`}
                        >
                            <Icon className="w-3.5 h-3.5 text-accent-primary/70 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-text-secondary truncate">{s.label}</div>
                                <div className="text-[10px] text-text-muted truncate">{s.subtitle}</div>
                            </div>
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400' : 'bg-red-400/60'}`} />
                        </button>
                    );
                })}
            </div>

            {/* Animated connector */}
            <div className="flex flex-col items-center py-1.5">
                <div className="relative w-0.5 h-8 bg-gradient-to-b from-[#E8B45E]/50 to-[#E8B45E]/15">
                    <motion.div
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-3 rounded-full bg-[#E8B45E]/60 blur-[2px]"
                        animate={{ y: [0, 20, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </div>
                <ArrowDown className="w-3 h-3 text-[#E8B45E]/40 -mt-0.5" />
            </div>

            {/* Processor section */}
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Processing</div>
            <div className="grid grid-cols-3 gap-2 mb-2">
                {PROCESSORS.map((p) => {
                    const Icon = p.icon;
                    const active = status[p.id] ?? false;
                    return (
                        <button
                            key={p.id}
                            onClick={() => setSelectedNode(selectedNode === p.id ? null : p.id)}
                            className={`bg-white/[0.02] border rounded-lg px-2 py-2 flex flex-col items-center gap-1 cursor-pointer transition-colors
                                ${selectedNode === p.id ? 'border-indigo-400/30' : 'border-indigo-500/[0.08] hover:border-indigo-500/[0.2]'}`}
                        >
                            <Icon className="w-3.5 h-3.5 text-indigo-400/70" />
                            <div className="text-[10px] font-semibold text-text-secondary text-center leading-tight">{p.label}</div>
                            <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-indigo-400' : 'bg-red-400/60'}`} />
                        </button>
                    );
                })}
            </div>

            {/* Animated connector */}
            <div className="flex flex-col items-center py-1.5">
                <div className="relative w-0.5 h-8 bg-gradient-to-b from-[#818CF8]/50 to-[#818CF8]/15">
                    <motion.div
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-3 rounded-full bg-[#818CF8]/60 blur-[2px]"
                        animate={{ y: [0, 20, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    />
                </div>
                <ArrowDown className="w-3 h-3 text-[#818CF8]/40 -mt-0.5" />
            </div>

            {/* Agent card */}
            <div className="bg-[#12121a]/90 border border-accent-primary/20 rounded-lg p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center flex-shrink-0">
                    {agent?.avatarUrl ? (
                        <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                        <span className="text-accent-primary font-bold text-base">
                            {agent?.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </span>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-text-primary truncate">{agent?.name ?? 'Your Agent'}</h3>
                    <div className={`flex items-center gap-1 text-[10px] font-semibold ${statusInfo.color}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} animate-pulse`} />
                        {statusInfo.label}
                    </div>
                </div>
                {agent && (
                    <div className="bg-accent-primary/10 border border-accent-primary/20 rounded px-2 py-0.5 flex-shrink-0">
                        <span className="text-[10px] font-bold text-accent-primary">Lv.{agent.level}</span>
                    </div>
                )}
            </div>

            {/* Mobile sidebar (bottom sheet style) */}
            {selectedNode && SIDEBAR_DATA[selectedNode] && (
                <div className="mt-3 bg-[#0e0e16]/95 border border-white/[0.08] rounded-lg p-3 animate-arena-reveal">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {(() => { const n = ALL_NODES.find(n => n.id === selectedNode); const Icon = n?.icon ?? Zap; return <Icon className="w-3.5 h-3.5 text-accent-primary" />; })()}
                            <span className="text-xs font-bold text-text-primary">{ALL_NODES.find(n => n.id === selectedNode)?.label}</span>
                        </div>
                        <button onClick={() => setSelectedNode(null)} className="text-text-muted p-1 cursor-pointer">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <p className="text-[11px] text-text-muted leading-relaxed mb-2">{SIDEBAR_DATA[selectedNode].description}</p>
                    <div className="space-y-1">
                        {SIDEBAR_DATA[selectedNode].streams.map((s, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                                <div className="w-1 h-1 rounded-full bg-accent-primary/50 flex-shrink-0" />
                                {s}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
