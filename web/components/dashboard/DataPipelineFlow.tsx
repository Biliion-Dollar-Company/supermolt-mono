'use client';

import { useCallback, useMemo, useEffect, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    MarkerType,
    Node,
    Edge,
    Position,
    Handle,
    NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Activity, Wifi, WifiOff, Zap, Database, Brain, Globe, Radio, TrendingUp, MessageCircle, Eye, BarChart3, Shield, Twitter } from 'lucide-react';

// ── Node Category Styles ──────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { bg: string; border: string; glow: string; icon: string; badge: string }> = {
    source: {
        bg: 'bg-gradient-to-br from-blue-500/15 to-blue-600/5',
        border: 'border-blue-500/30',
        glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
        icon: 'text-blue-400',
        badge: 'bg-blue-500/20 text-blue-300',
    },
    processing: {
        bg: 'bg-gradient-to-br from-purple-500/15 to-purple-600/5',
        border: 'border-purple-500/30',
        glow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]',
        icon: 'text-purple-400',
        badge: 'bg-purple-500/20 text-purple-300',
    },
    intelligence: {
        bg: 'bg-gradient-to-br from-amber-500/15 to-orange-600/5',
        border: 'border-amber-500/30',
        glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
        icon: 'text-amber-400',
        badge: 'bg-amber-500/20 text-amber-300',
    },
    output: {
        bg: 'bg-gradient-to-br from-emerald-500/15 to-green-600/5',
        border: 'border-emerald-500/30',
        glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
        icon: 'text-emerald-400',
        badge: 'bg-emerald-500/20 text-emerald-300',
    },
    storage: {
        bg: 'bg-gradient-to-br from-slate-500/15 to-slate-600/5',
        border: 'border-slate-500/30',
        glow: 'shadow-[0_0_20px_rgba(100,116,139,0.1)]',
        icon: 'text-slate-400',
        badge: 'bg-slate-500/20 text-slate-300',
    },
};

const ICON_MAP: Record<string, any> = {
    Wifi, Radio, Globe, Twitter, TrendingUp, Eye, Brain,
    MessageCircle, BarChart3, Activity, Database, Shield, Zap,
};

// ── Custom Node Component ─────────────────────────────────────────

function PipelineNode({ data }: NodeProps) {
    const cat = CATEGORY_STYLES[data.category] || CATEGORY_STYLES.source;
    const IconComponent = ICON_MAP[data.icon] || Activity;
    const isConnected = data.status === 'connected';
    const StatusIcon = isConnected ? Wifi : WifiOff;

    return (
        <div className={`
      relative min-w-[180px] max-w-[220px] rounded-lg border backdrop-blur-md
      ${cat.bg} ${cat.border} ${cat.glow}
      hover:scale-[1.02] transition-all duration-200
    `}>
            {/* Handles */}
            <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-white/30 !border-white/20" />
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-white/30 !border-white/20" />
            <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-white/30 !border-white/20" />
            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-white/30 !border-white/20" />

            <div className="px-3 py-2.5">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1.5">
                    <div className={`p-1 rounded ${cat.badge}`}>
                        <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-text-primary truncate">{data.label}</span>
                    {data.status && (
                        <StatusIcon className={`w-3 h-3 ml-auto flex-shrink-0 ${isConnected ? 'text-emerald-400' : 'text-red-400/50'}`} />
                    )}
                </div>

                {/* Description */}
                <p className="text-[10px] text-text-muted leading-tight mb-1.5">{data.description}</p>

                {/* Stats row */}
                {(data.eventCount !== undefined || data.latency) && (
                    <div className="flex items-center gap-2 text-[10px]">
                        {data.eventCount !== undefined && (
                            <span className={`font-mono ${cat.badge} px-1.5 py-0.5 rounded`}>
                                {data.eventCount.toLocaleString()} events
                            </span>
                        )}
                        {data.latency && (
                            <span className="font-mono text-text-muted">
                                {data.latency}
                            </span>
                        )}
                    </div>
                )}

                {/* Category badge */}
                <div className="mt-1.5">
                    <span className={`text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded ${cat.badge}`}>
                        {data.category}
                    </span>
                </div>
            </div>
        </div>
    );
}

const nodeTypes = { pipeline: PipelineNode };

// ── Pipeline Definition ───────────────────────────────────────────

interface PipelineStatus {
    [key: string]: { connected: boolean; events: number };
}

function buildNodes(status: PipelineStatus): Node[] {
    return [
        // DATA SOURCES (Row 1)
        {
            id: 'helius',
            type: 'pipeline',
            position: { x: 0, y: 0 },
            data: {
                label: 'Helius WebSocket',
                description: 'Real-time Solana transaction stream (mainnet RPC)',
                icon: 'Wifi',
                category: 'source',
                status: status.helius?.connected ? 'connected' : 'disconnected',
                eventCount: status.helius?.events || 0,
            },
        },
        {
            id: 'devprint',
            type: 'pipeline',
            position: { x: 280, y: 0 },
            data: {
                label: 'DevPrint Feed',
                description: 'J7 Tracker — new tokens, tweets, training progress',
                icon: 'Radio',
                category: 'source',
                status: status.devprint?.connected ? 'connected' : 'disconnected',
                eventCount: status.devprint?.events || 0,
            },
        },
        {
            id: 'twitter',
            type: 'pipeline',
            position: { x: 560, y: 0 },
            data: {
                label: 'Twitter API',
                description: 'TwitterAPI.io — tweet search, user profiles, verification',
                icon: 'Twitter',
                category: 'source',
                status: status.twitter?.connected ? 'connected' : 'disconnected',
            },
        },
        {
            id: 'dexscreener',
            type: 'pipeline',
            position: { x: 840, y: 0 },
            data: {
                label: 'DexScreener',
                description: 'Free token data — price, volume, liquidity, holders',
                icon: 'Globe',
                category: 'source',
                status: 'connected',
            },
        },

        // PROCESSING (Row 2)
        {
            id: 'wallet-tracker',
            type: 'pipeline',
            position: { x: 0, y: 160 },
            data: {
                label: 'Wallet Tracker',
                description: 'Monitors tracked wallets for swaps & transfers on-chain',
                icon: 'Eye',
                category: 'processing',
                eventCount: status.walletTracker?.events || 0,
            },
        },
        {
            id: 'superrouter-observer',
            type: 'pipeline',
            position: { x: 280, y: 160 },
            data: {
                label: 'SuperRouter Observer',
                description: 'Detects SuperRouter trades → triggers multi-agent analysis',
                icon: 'Activity',
                category: 'processing',
                eventCount: status.observer?.events || 0,
            },
        },
        {
            id: 'position-manager',
            type: 'pipeline',
            position: { x: 560, y: 160 },
            data: {
                label: 'Position Manager',
                description: 'Tracks open/closed positions, PnL, entry/exit prices',
                icon: 'BarChart3',
                category: 'processing',
            },
        },
        {
            id: 'price-fetcher',
            type: 'pipeline',
            position: { x: 840, y: 160 },
            data: {
                label: 'Price Fetcher',
                description: 'Jupiter + Pyth — real-time SOL/USD token prices',
                icon: 'TrendingUp',
                category: 'processing',
            },
        },

        // INTELLIGENCE (Row 3)
        {
            id: 'agent-analyzer',
            type: 'pipeline',
            position: { x: 140, y: 320 },
            data: {
                label: 'Agent Analyzer',
                description: '5 AI personalities analyze each trade from different angles',
                icon: 'Brain',
                category: 'intelligence',
            },
        },
        {
            id: 'llm-engine',
            type: 'pipeline',
            position: { x: 420, y: 320 },
            data: {
                label: 'LLM Engine',
                description: 'Groq (Llama-3.3-70b) / Anthropic / OpenAI — narrative analysis',
                icon: 'Zap',
                category: 'intelligence',
                status: status.llm?.connected ? 'connected' : 'disconnected',
            },
        },
        {
            id: 'narrative-engine',
            type: 'pipeline',
            position: { x: 700, y: 320 },
            data: {
                label: 'Narrative Engine',
                description: 'Mindshare density, context graphs, narrative validation',
                icon: 'Brain',
                category: 'intelligence',
            },
        },

        // OUTPUT (Row 4)
        {
            id: 'socketio',
            type: 'pipeline',
            position: { x: 0, y: 480 },
            data: {
                label: 'Socket.IO',
                description: `Real-time broadcasts — ${status.socketio?.events || 0} clients connected`,
                icon: 'Radio',
                category: 'output',
                status: 'connected',
                eventCount: status.socketio?.events || 0,
            },
        },
        {
            id: 'agent-commentary',
            type: 'pipeline',
            position: { x: 280, y: 480 },
            data: {
                label: 'Agent Commentary',
                description: 'Multi-agent conversations posted to arena threads',
                icon: 'MessageCircle',
                category: 'output',
            },
        },
        {
            id: 'task-system',
            type: 'pipeline',
            position: { x: 560, y: 480 },
            data: {
                label: 'Task System',
                description: 'Auto-generate & validate tasks per token discovery',
                icon: 'Shield',
                category: 'output',
            },
        },
        {
            id: 'sortino-cron',
            type: 'pipeline',
            position: { x: 840, y: 480 },
            data: {
                label: 'Sortino Cron',
                description: 'Hourly risk-adjusted performance calculation (distributed lock)',
                icon: 'BarChart3',
                category: 'output',
                latency: '1h interval',
            },
        },

        // STORAGE (Row 5)
        {
            id: 'postgresql',
            type: 'pipeline',
            position: { x: 280, y: 620 },
            data: {
                label: 'PostgreSQL',
                description: 'Prisma ORM — agents, trades, positions, tasks, epochs',
                icon: 'Database',
                category: 'storage',
                status: 'connected',
            },
        },
        {
            id: 'redis',
            type: 'pipeline',
            position: { x: 560, y: 620 },
            data: {
                label: 'Redis',
                description: 'Socket.IO adapter, webhook queue, distributed locks',
                icon: 'Database',
                category: 'storage',
                status: status.redis?.connected ? 'connected' : 'disconnected',
            },
        },
    ];
}

function buildEdges(): Edge[] {
    const edgeDefaults = {
        animated: true,
        style: { stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(255,255,255,0.25)', width: 14, height: 14 },
    };

    return [
        // Sources → Processing
        { id: 'e-helius-wallet', source: 'helius', target: 'wallet-tracker', ...edgeDefaults },
        { id: 'e-helius-observer', source: 'helius', target: 'superrouter-observer', ...edgeDefaults },
        { id: 'e-devprint-observer', source: 'devprint', target: 'superrouter-observer', ...edgeDefaults },
        { id: 'e-devprint-socketio', source: 'devprint', target: 'socketio', ...edgeDefaults },
        { id: 'e-dex-position', source: 'dexscreener', target: 'position-manager', ...edgeDefaults },
        { id: 'e-dex-price', source: 'dexscreener', target: 'price-fetcher', ...edgeDefaults },

        // Processing → Intelligence
        { id: 'e-wallet-observer', source: 'wallet-tracker', target: 'superrouter-observer', ...edgeDefaults },
        { id: 'e-observer-analyzer', source: 'superrouter-observer', target: 'agent-analyzer', ...edgeDefaults },
        { id: 'e-observer-position', source: 'superrouter-observer', target: 'position-manager', ...edgeDefaults },
        { id: 'e-position-price', source: 'price-fetcher', target: 'position-manager', ...edgeDefaults },
        { id: 'e-twitter-narrative', source: 'twitter', target: 'narrative-engine', ...edgeDefaults },

        // Intelligence → Intelligence
        { id: 'e-analyzer-llm', source: 'agent-analyzer', target: 'llm-engine', ...edgeDefaults },
        { id: 'e-llm-narrative', source: 'llm-engine', target: 'narrative-engine', ...edgeDefaults },

        // Intelligence → Output
        { id: 'e-analyzer-commentary', source: 'agent-analyzer', target: 'agent-commentary', ...edgeDefaults },
        { id: 'e-llm-commentary', source: 'llm-engine', target: 'agent-commentary', ...edgeDefaults },
        { id: 'e-observer-tasks', source: 'superrouter-observer', target: 'task-system', ...edgeDefaults },
        { id: 'e-position-sortino', source: 'position-manager', target: 'sortino-cron', ...edgeDefaults },

        // Output → Storage
        { id: 'e-commentary-pg', source: 'agent-commentary', target: 'postgresql', ...edgeDefaults },
        { id: 'e-tasks-pg', source: 'task-system', target: 'postgresql', ...edgeDefaults },
        { id: 'e-sortino-pg', source: 'sortino-cron', target: 'postgresql', ...edgeDefaults },
        { id: 'e-socketio-redis', source: 'socketio', target: 'redis', ...edgeDefaults },
        { id: 'e-position-pg', source: 'position-manager', target: 'postgresql', ...edgeDefaults },
    ];
}

// ── Legend ──────────────────────────────────────────────────────────

function PipelineLegend() {
    const categories = [
        { key: 'source', label: 'Data Sources', count: 4 },
        { key: 'processing', label: 'Processing', count: 4 },
        { key: 'intelligence', label: 'AI Intelligence', count: 3 },
        { key: 'output', label: 'Output', count: 4 },
        { key: 'storage', label: 'Storage', count: 2 },
    ];

    return (
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
            {categories.map(({ key, label, count }) => {
                const cat = CATEGORY_STYLES[key];
                return (
                    <div key={key} className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded border ${cat.bg} ${cat.border}`}>
                        <div className={`w-2 h-2 rounded-full ${cat.badge}`} />
                        <span className={cat.icon}>{label}</span>
                        <span className="text-text-muted">({count})</span>
                    </div>
                );
            })}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────

export function DataPipelineFlow() {
    const [status, setStatus] = useState<PipelineStatus>({
        helius: { connected: false, events: 0 },
        devprint: { connected: false, events: 0 },
        twitter: { connected: false, events: 0 },
        walletTracker: { connected: false, events: 0 },
        observer: { connected: false, events: 0 },
        llm: { connected: false, events: 0 },
        socketio: { connected: false, events: 0 },
        redis: { connected: false, events: 0 },
    });
    const [allHealthy, setAllHealthy] = useState(true);

    // Fetch real pipeline status from backend
    useEffect(() => {
        async function fetchStatus() {
            try {
                const { getPipelineStatus } = await import('@/lib/api');
                const res = await getPipelineStatus();
                const s = res.services;
                setStatus({
                    helius: { connected: s.helius?.connected ?? false, events: s.helius?.trackedWallets ?? 0 },
                    devprint: { connected: s.devprint?.connected ?? false, events: s.devprint?.events ?? 0 },
                    twitter: { connected: s.twitter?.connected ?? false, events: 0 },
                    walletTracker: { connected: s.helius?.connected ?? false, events: s.helius?.trackedWallets ?? 0 },
                    observer: { connected: s.helius?.connected ?? false, events: 0 },
                    llm: { connected: s.llm?.connected ?? false, events: 0 },
                    socketio: { connected: true, events: s.socketio?.clients ?? 0 },
                    redis: { connected: s.redis?.connected ?? false, events: 0 },
                });
                // Check if any critical service is down
                const critical = [s.helius, s.devprint, s.socketio];
                setAllHealthy(critical.every(svc => svc?.connected));
            } catch {
                // Keep defaults on error — still render the diagram
            }
        }
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const initialNodes = useMemo(() => buildNodes(status), [status]);
    const initialEdges = useMemo(() => buildEdges(), []);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Update nodes when status changes
    useEffect(() => {
        setNodes(buildNodes(status));
    }, [status, setNodes]);

    return (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden relative">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-accent-primary" />
                    <h3 className="text-sm font-bold text-text-primary">Data Pipeline</h3>
                    <span className="text-[10px] text-text-muted bg-white/[0.04] px-2 py-0.5 rounded-full">
                        {initialNodes.length} services • {initialEdges.length} connections
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-[10px]">
                        <div className={`w-1.5 h-1.5 rounded-full ${allHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                        <span className={`font-semibold ${allHealthy ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {allHealthy ? 'All Systems Operational' : 'Partial — Some Services Offline'}
                        </span>
                    </div>
                </div>
            </div>

            {/* React Flow Canvas */}
            <div className="h-[550px] relative">
                <PipelineLegend />
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.15 }}
                    proOptions={{ hideAttribution: true }}
                    minZoom={0.3}
                    maxZoom={1.5}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                >
                    <Background color="rgba(255,255,255,0.03)" gap={24} size={1} />
                    <Controls
                        position="bottom-right"
                        className="!bg-bg-primary/80 !border-white/[0.08] !shadow-lg [&>button]:!bg-white/[0.05] [&>button]:!border-white/[0.08] [&>button]:!text-text-muted [&>button:hover]:!bg-white/[0.1] [&>button]:!fill-text-muted"
                    />
                    <MiniMap
                        position="bottom-left"
                        className="!bg-bg-primary/80 !border-white/[0.08]"
                        nodeColor={(node) => {
                            const cat = node.data?.category as string;
                            const colors: Record<string, string> = {
                                source: '#3b82f6',
                                processing: '#a855f7',
                                intelligence: '#f59e0b',
                                output: '#10b981',
                                storage: '#64748b',
                            };
                            return colors[cat] || '#64748b';
                        }}
                        maskColor="rgba(0,0,0,0.7)"
                    />
                </ReactFlow>
            </div>
        </div>
    );
}
