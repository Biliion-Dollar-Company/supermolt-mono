'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Handle,
  NodeTypes,
  Position,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AgentMapFeed, FeedEntry } from './AgentMapFeed';

// ─────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────

const TOKEN_DATA = [
  { id: 't-bonk',     position: { x: 120,  y: 80  }, data: { symbol: '$BONK',     change: +8.4,  cap: '2.1M', hot: true  } },
  { id: 't-wif',      position: { x: 520,  y: 60  }, data: { symbol: '$WIF',      change: +12.1, cap: '4.8M', hot: true  } },
  { id: 't-popcat',   position: { x: 900,  y: 140 }, data: { symbol: '$POPCAT',   change: -3.2,  cap: '890K', hot: false } },
  { id: 't-trump',    position: { x: 200,  y: 380 }, data: { symbol: '$TRUMP',    change: +22.0, cap: '8.2M', hot: true  } },
  { id: 't-fartcoin', position: { x: 660,  y: 320 }, data: { symbol: '$FARTCOIN', change: -7.8,  cap: '340K', hot: false } },
  { id: 't-boden',    position: { x: 980,  y: 420 }, data: { symbol: '$BODEN',    change: +4.1,  cap: '1.2M', hot: false } },
  { id: 't-new',      position: { x: 440,  y: 220 }, data: { symbol: '🔥 NEW',    change: +91.0, cap: '45K',  hot: true  } },
];

const AGENTS_DEF = [
  { id: 'alpha',   label: 'α Alpha',   color: '#ff6666', emoji: '🔴', tokenIdx: 0 },
  { id: 'beta',    label: 'β Beta',    color: '#6699ff', emoji: '🔵', tokenIdx: 1 },
  { id: 'gamma',   label: 'γ Gamma',   color: '#66ff88', emoji: '🟢', tokenIdx: 2 },
  { id: 'delta',   label: 'δ Delta',   color: '#ffdd44', emoji: '🟡', tokenIdx: 3 },
  { id: 'epsilon', label: 'ε Epsilon', color: '#cc88ff', emoji: '🟣', tokenIdx: 4 },
];

const SENTIMENTS = ['BULLISH 🚀', 'BEARISH 📉', 'ANALYZING...'];
const EDGE_LABELS = ['watching', 'LONG 0.5 SOL', 'LONG 1.2 SOL', 'ANALYZING', 'watching'];

function now(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─────────────────────────────────────────────
// Custom node: Token
// ─────────────────────────────────────────────

interface TokenNodeData {
  symbol: string;
  change: number;
  cap: string;
  hot: boolean;
  godWallet?: boolean;
}

const TokenNode = memo(({ data }: NodeProps<TokenNodeData>) => {
  const size = data.hot ? 88 : 72;
  const isUp = data.change >= 0;
  const glowColor = data.godWallet ? '#E8B45E' : isUp ? '#4ade80' : '#f87171';
  const borderColor = data.godWallet ? '#E8B45E' : isUp ? '#4ade80' : '#f87171';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* Pulsing ring for hot tokens */}
      {(data.hot || data.godWallet) && (
        <div
          style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: `2px solid ${glowColor}`,
            opacity: 0.5,
            animation: 'token-pulse 2s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Main circle */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: data.godWallet
            ? 'radial-gradient(circle, rgba(232,180,94,0.25) 0%, rgba(5,5,5,0.95) 70%)'
            : isUp
            ? 'radial-gradient(circle, rgba(74,222,128,0.15) 0%, rgba(5,5,5,0.95) 70%)'
            : 'radial-gradient(circle, rgba(248,113,113,0.15) 0%, rgba(5,5,5,0.95) 70%)',
          border: `2px solid ${borderColor}`,
          boxShadow: `0 0 ${data.godWallet ? 24 : 12}px ${glowColor}66, inset 0 0 8px ${glowColor}22`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
          transition: 'all 0.3s ease',
          gap: 1,
        }}
      >
        <div
          style={{
            fontSize: data.hot ? 9 : 8,
            fontWeight: 700,
            color: '#f9fafb',
            fontFamily: 'JetBrains Mono, monospace',
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: size - 12,
            wordBreak: 'break-word',
            letterSpacing: '-0.02em',
          }}
        >
          {data.symbol.replace('$', '')}
        </div>
        <div
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: glowColor,
            fontFamily: 'JetBrains Mono, monospace',
            lineHeight: 1,
          }}
        >
          {isUp ? '+' : ''}{data.change.toFixed(1)}%
        </div>
        <div
          style={{
            fontSize: 7,
            color: '#6b7280',
            fontFamily: 'JetBrains Mono, monospace',
            lineHeight: 1,
          }}
        >
          {data.cap}
        </div>
      </div>

      {/* ReactFlow handles (invisible) */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
});
TokenNode.displayName = 'TokenNode';

// ─────────────────────────────────────────────
// Custom node: Agent
// ─────────────────────────────────────────────

interface AgentNodeData {
  label: string;
  color: string;
  emoji: string;
  sentiment: string;
  arriving?: boolean;
}

const AgentNode = memo(({ data }: NodeProps<AgentNodeData>) => {
  const sentimentColor =
    data.sentiment.includes('BULLISH') ? '#4ade80'
    : data.sentiment.includes('BEARISH') ? '#f87171'
    : '#6b7280';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {/* Arrival badge */}
      {data.arriving && (
        <div
          style={{
            position: 'absolute',
            top: -28,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(5,5,5,0.95)',
            border: `1px solid ${sentimentColor}`,
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 9,
            fontFamily: 'JetBrains Mono, monospace',
            color: sentimentColor,
            whiteSpace: 'nowrap',
            boxShadow: `0 0 8px ${sentimentColor}44`,
            zIndex: 100,
          }}
        >
          {data.sentiment}
        </div>
      )}

      {/* Main circle */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${data.color}33 0%, rgba(5,5,5,0.9) 70%)`,
          border: `2px solid ${data.color}`,
          boxShadow: `0 0 14px ${data.color}66, 0 0 28px ${data.color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          cursor: 'default',
          transition: 'box-shadow 0.3s ease',
        }}
      >
        {data.emoji}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: 9,
          fontFamily: 'JetBrains Mono, monospace',
          color: data.color,
          fontWeight: 700,
          textShadow: `0 0 6px ${data.color}88`,
          lineHeight: 1,
        }}
      >
        {data.label}
      </div>

      {/* Sentiment badge */}
      <div
        style={{
          fontSize: 8,
          fontFamily: 'JetBrains Mono, monospace',
          color: sentimentColor,
          lineHeight: 1,
          opacity: 0.8,
        }}
      >
        {data.sentiment}
      </div>

      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
});
AgentNode.displayName = 'AgentNode';

// ─────────────────────────────────────────────
// Node types registration
// ─────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  tokenNode: TokenNode as unknown as NodeTypes[string],
  agentNode: AgentNode as unknown as NodeTypes[string],
};

// ─────────────────────────────────────────────
// Build initial nodes/edges
// ─────────────────────────────────────────────

function buildInitialNodes(): Node[] {
  const tokenNodes: Node[] = TOKEN_DATA.map((t) => ({
    id: t.id,
    type: 'tokenNode',
    position: t.position,
    data: t.data,
    draggable: false,
    selectable: false,
  }));

  const agentNodes: Node[] = AGENTS_DEF.map((a, i) => {
    const token = TOKEN_DATA[a.tokenIdx];
    const offsetX = (i % 2 === 0 ? 1 : -1) * 30;
    const offsetY = -60;
    return {
      id: `agent-${a.id}`,
      type: 'agentNode',
      position: { x: token.position.x + offsetX, y: token.position.y + offsetY },
      data: {
        label: a.label,
        color: a.color,
        emoji: a.emoji,
        sentiment: 'ANALYZING...',
        arriving: false,
      },
      draggable: false,
      selectable: false,
      zIndex: 10,
    };
  });

  return [...tokenNodes, ...agentNodes];
}

function buildInitialEdges(): Edge[] {
  return AGENTS_DEF.map((a, i) => ({
    id: `edge-${a.id}`,
    source: `agent-${a.id}`,
    target: TOKEN_DATA[a.tokenIdx].id,
    animated: true,
    style: { stroke: a.color, strokeWidth: 1.5, strokeDasharray: '5 3' },
    label: EDGE_LABELS[i % EDGE_LABELS.length],
    labelStyle: { fill: a.color, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' },
    labelBgStyle: { fill: 'rgba(5,5,5,0.8)', fillOpacity: 1 },
    type: 'default',
  }));
}

// ─────────────────────────────────────────────
// Inner map component (must be inside ReactFlowProvider)
// ─────────────────────────────────────────────

function AgentMapInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(buildInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildInitialEdges());
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);

  // Track which token each agent is currently at
  const agentTargets = useRef<Record<string, string>>(
    Object.fromEntries(AGENTS_DEF.map((a) => [`agent-${a.id}`, TOKEN_DATA[a.tokenIdx].id]))
  );

  const addFeedEntry = useCallback((text: string, color: FeedEntry['color']) => {
    setFeedEntries((prev) => {
      const entry: FeedEntry = {
        id: `${Date.now()}-${Math.random()}`,
        text,
        color,
        timestamp: now(),
      };
      return [entry, ...prev].slice(0, 40);
    });
  }, []);

  // Move an agent to a token
  const moveAgentToToken = useCallback(
    (agentId: string, tokenId: string, sentiment: string, label: string) => {
      const agentDef = AGENTS_DEF.find((a) => `agent-${a.id}` === agentId)!;
      const token = TOKEN_DATA.find((t) => t.id === tokenId)!;
      const offsetX = Math.random() * 60 - 30;
      const offsetY = -65 + Math.random() * 20 - 10;

      agentTargets.current[agentId] = tokenId;

      // Update node position + mark as arriving
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === agentId) {
            return {
              ...n,
              position: { x: token.position.x + offsetX, y: token.position.y + offsetY },
              data: { ...n.data, sentiment, arriving: true },
            };
          }
          return n;
        })
      );

      // Update edge
      setEdges((prev) =>
        prev.map((e) => {
          if (e.id === `edge-${agentDef.id}`) {
            return {
              ...e,
              source: agentId,
              target: tokenId,
              label,
              style: { stroke: agentDef.color, strokeWidth: 1.5, strokeDasharray: '5 3' },
              labelStyle: { fill: agentDef.color, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' },
            };
          }
          return e;
        })
      );

      // Feed entry
      const sentimentColor: FeedEntry['color'] =
        sentiment.includes('BULLISH') ? 'green' : sentiment.includes('BEARISH') ? 'red' : 'dim';
      addFeedEntry(
        `${agentDef.emoji} ${agentDef.label.split(' ')[1]} → ${token.data.symbol} — ${sentiment}`,
        sentimentColor
      );

      // Paper trade event (sometimes)
      if (sentiment.includes('BULLISH') && Math.random() < 0.4) {
        setTimeout(() => {
          const sol = (Math.random() * 1.5 + 0.3).toFixed(1);
          addFeedEntry(
            `📊 Paper trade: ${agentDef.label.split(' ')[1]} LONG ${token.data.symbol} ${sol} SOL`,
            'gold'
          );
        }, 800);
      }

      // Clear arriving badge after 3s
      setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === agentId ? { ...n, data: { ...n.data, arriving: false } } : n
          )
        );
      }, 3000);
    },
    [setNodes, setEdges, addFeedEntry]
  );

  // God wallet event
  const triggerGodWallet = useCallback(() => {
    const token = randomItem(TOKEN_DATA);
    addFeedEntry(`⚡ God Wallet Buy detected — ${token.data.symbol}`, 'gold');

    // Flash token gold
    setNodes((prev) =>
      prev.map((n) =>
        n.id === token.id ? { ...n, data: { ...n.data, godWallet: true } } : n
      )
    );

    // Move all agents toward the token with staggered delay
    AGENTS_DEF.forEach((a, i) => {
      setTimeout(() => {
        const conf = randomInt(65, 95);
        moveAgentToToken(
          `agent-${a.id}`,
          token.id,
          `BULLISH 🚀 conf ${conf}%`,
          'LONG 0.5 SOL'
        );
      }, i * 400);
    });

    // Clear gold flash after 2s
    setTimeout(() => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === token.id ? { ...n, data: { ...n.data, godWallet: false } } : n
        )
      );
    }, 2000);
  }, [addFeedEntry, setNodes, moveAgentToToken]);

  // Regular agent movement every 6-8s
  useEffect(() => {
    let moveTimer: ReturnType<typeof setTimeout>;

    function scheduleNextMove() {
      const delay = randomInt(6000, 8000);
      moveTimer = setTimeout(() => {
        const agentDef = randomItem(AGENTS_DEF);
        const agentId = `agent-${agentDef.id}`;
        const currentToken = agentTargets.current[agentId];

        // Pick a different token
        const candidates = TOKEN_DATA.filter((t) => t.id !== currentToken);
        const targetToken = randomItem(candidates);

        const sentimentRoll = Math.random();
        const sentiment =
          sentimentRoll < 0.45
            ? `BULLISH 🚀 conf ${randomInt(60, 90)}%`
            : sentimentRoll < 0.75
            ? `BEARISH 📉 conf ${randomInt(52, 75)}%`
            : 'ANALYZING...';

        const label = randomItem(EDGE_LABELS);
        moveAgentToToken(agentId, targetToken.id, sentiment, label);

        scheduleNextMove();
      }, delay);
    }

    scheduleNextMove();
    return () => clearTimeout(moveTimer);
  }, [moveAgentToToken]);

  // God wallet events every 25-35s
  useEffect(() => {
    let godTimer: ReturnType<typeof setTimeout>;

    function scheduleGod() {
      const delay = randomInt(25000, 35000);
      godTimer = setTimeout(() => {
        triggerGodWallet();
        scheduleGod();
      }, delay);
    }

    // First god wallet after 10s for demo feel
    const firstTimer = setTimeout(() => {
      scheduleGod();
    }, 10000);

    return () => {
      clearTimeout(firstTimer);
      clearTimeout(godTimer);
    };
  }, [triggerGodWallet]);

  // Subtle idle drift — shift agent positions slightly every 3s
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes((prev) =>
        prev.map((n) => {
          if (!n.id.startsWith('agent-')) return n;
          const drift = () => (Math.random() - 0.5) * 4;
          return {
            ...n,
            position: {
              x: n.position.x + drift(),
              y: n.position.y + drift(),
            },
          };
        })
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [setNodes]);

  return (
    <div className="flex h-full w-full" style={{ background: '#050505' }}>
      {/* Canvas area */}
      <div className="flex-1 relative" style={{ minWidth: 0 }}>
        {/* CRT scanline overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 10,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.015) 2px, rgba(0,255,0,0.015) 3px)',
          }}
        />

        {/* Pulse keyframe injected via style tag */}
        <style>{`
          @keyframes token-pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.15); opacity: 0.2; }
          }
          .react-flow__edge-path {
            animation: dash 1s linear infinite;
          }
        `}</style>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          panOnScroll={false}
          zoomOnScroll={false}
          panOnDrag={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          style={{ background: '#050505' }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="rgba(255,255,255,0.06)"
            gap={24}
            size={1}
          />
        </ReactFlow>
      </div>

      {/* Live feed sidebar */}
      <div
        className="flex-shrink-0 border-l h-full overflow-hidden"
        style={{ borderColor: 'rgba(232,180,94,0.15)' }}
      >
        <AgentMapFeed entries={feedEntries} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Exported wrapper with ReactFlowProvider
// ─────────────────────────────────────────────

export function AgentMap() {
  return (
    <ReactFlowProvider>
      <AgentMapInner />
    </ReactFlowProvider>
  );
}
