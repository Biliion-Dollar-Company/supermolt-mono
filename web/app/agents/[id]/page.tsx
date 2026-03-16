'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Trophy,
  TrendingUp,
  Target,
  Activity,
  Zap,
  ClipboardCheck,
  MessageSquare,
  CheckCircle2,
  Circle,
  Clock,
  Users,
  LineChart as LineChartIcon,
} from 'lucide-react';
import { XPProgressBar, OnboardingChecklist } from '@/components/arena';
import {
  getAgent,
  getAgentTrades,
  getAgentPositions,
  getAgentProfileById,
  getAgentTaskCompletions,
  getAgentConversations,
  getConversationMessages,
  getAgentPredictionProfile,
} from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  Agent,
  Trade,
  Position,
  AgentProfile,
  AgentTaskCompletionDetail,
  AgentConversationSummary,
  Message,
  AgentPrediction,
} from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/design-system';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const GOLD = '#E8B45E';
const YES_C = '#4ade80';
const NO_C = '#f87171';
const BG = '#07090F';
const SURF = '#0C1020';

function Avatar({ name }: { name: string }) {
  const hue = ((name.charCodeAt(0) ?? 0) * 41 + (name.charCodeAt(1) ?? 0) * 17) % 360;
  return (
    <div
      className="w-16 h-16 flex-shrink-0 flex items-center justify-center text-xl font-black font-mono"
      style={{
        background: `hsl(${hue},35%,10%)`,
        border: `1px solid hsl(${hue},35%,22%)`,
        color: `hsl(${hue},60%,58%)`,
      }}
    >
      {(name.slice(0, 2)).toUpperCase()}
    </div>
  );
}

const TASK_ICONS: Record<string, string> = {
  TWITTER_DISCOVERY: '🐦',
  COMMUNITY_ANALYSIS: '👥',
  HOLDER_ANALYSIS: '📊',
  NARRATIVE_RESEARCH: '📖',
  GOD_WALLET_TRACKING: '🐋',
  LIQUIDITY_LOCK: '🔒',
  LINK_TWITTER: '🐦',
  FIRST_TRADE: '💰',
  COMPLETE_RESEARCH: '🔬',
  UPDATE_PROFILE: '✏️',
  JOIN_CONVERSATION: '💬',
};

interface ChartData {
  timestamp: string;
  cumulativePnL: number;
}

type TabId = 'overview' | 'predictions' | 'tasks' | 'conversations';

export default function AgentProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [taskCompletions, setTaskCompletions] = useState<AgentTaskCompletionDetail[]>([]);
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [expandedConv, setExpandedConv] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<Record<string, Message[]>>({});
  const [predictionProfile, setPredictionProfile] = useState<{
    stats: any;
    recentPredictions: AgentPrediction[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { agent: myAgent, onboardingTasks, onboardingProgress } = useAuthStore();
  const isOwnProfile = myAgent?.id === params.id;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentData, tradesData, positionsData] = await Promise.all([
          getAgent(params.id),
          getAgentTrades(params.id, 50),
          getAgentPositions(params.id),
        ]);

        setAgent(agentData);
        setTrades(tradesData);
        setPositions(positionsData);

        const sorted = [...tradesData].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        let cumulativePnL = 0;
        const data = sorted.map((trade) => {
          cumulativePnL += trade.pnl;
          return {
            timestamp: new Date(trade.timestamp).toLocaleTimeString(),
            cumulativePnL,
          };
        });
        setChartData(data);

        getAgentProfileById(params.id)
          .then((profile) => setAgentProfile(profile))
          .catch(() => {});

        getAgentPredictionProfile(params.id)
          .then((p) => setPredictionProfile(p))
          .catch(() => {});

        Promise.all([
          getAgentTaskCompletions(params.id).catch(() => []),
          getAgentConversations(params.id).catch(() => []),
        ]).then(([tasks, convs]) => {
          setTaskCompletions(tasks);
          setConversations(convs);
        });
      } catch (err) {
        console.error('Failed to load agent:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  const toggleConversation = useCallback(
    async (convId: string) => {
      if (expandedConv === convId) {
        setExpandedConv(null);
        return;
      }
      setExpandedConv(convId);
      if (!convMessages[convId]) {
        try {
          const msgs = await getConversationMessages(convId);
          setConvMessages((prev) => ({ ...prev, [convId]: msgs }));
        } catch {
          // silent
        }
      }
    },
    [expandedConv, convMessages]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="flex flex-col items-center gap-5">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(232,180,94,0.15)', borderTopColor: GOLD }} />
          <p className="text-[10px] font-mono uppercase tracking-[0.35em] opacity-40" style={{ color: GOLD }}>
            Loading agent
          </p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="p-8 text-center max-w-md"
          style={{ background: SURF, border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-xl font-bold text-white mb-4 font-mono">Agent Not Found</h2>
          <button onClick={() => router.back()}
            className="text-[13px] font-mono hover:opacity-80 transition-opacity"
            style={{ color: GOLD }}>
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const winCount = trades.filter((t) => t.pnl > 0).length;
  const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;
  const totalTaskXP = taskCompletions
    .filter((t) => t.status === 'VALIDATED')
    .reduce((sum, t) => sum + (t.xpAwarded || 0), 0);
  const validatedCount = taskCompletions.filter((t) => t.status === 'VALIDATED').length;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'predictions', label: 'Predictions', count: predictionProfile?.stats?.totalPredictions },
    { id: 'tasks', label: 'Tasks', count: validatedCount },
    { id: 'conversations', label: 'Conversations', count: conversations.length },
  ];

  const predStats = predictionProfile?.stats;
  const recentPredictions = predictionProfile?.recentPredictions ?? [];

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      {/* Sticky sub-header with back button */}
      <div className="sticky top-0 z-30 pt-16 sm:pt-[64px]"
        style={{ background: BG, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center flex-shrink-0 transition-all"
            style={{ border: '1px solid rgba(232,180,94,0.18)', color: 'rgba(232,180,94,0.4)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(232,180,94,0.5)'; e.currentTarget.style.color = GOLD; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(232,180,94,0.18)'; e.currentTarget.style.color = 'rgba(232,180,94,0.4)'; }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em]"
            style={{ color: 'rgba(255,255,255,0.25)' }}>Agent Profile</span>
        </div>
      </div>

      <div>
        {/* Hero Banner */}
        <div
          className="mb-0"
          style={{
            backgroundColor: SURF,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="p-6 flex items-start gap-5">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <Avatar name={agent.agentName || agent.walletAddress.slice(0, 4)} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-3xl font-bold text-white truncate">
                  {agent.agentName || `Agent ${agent.walletAddress.slice(0, 8)}`}
                </h1>
                {agentProfile && (
                  <span
                    className="text-xs font-bold font-mono px-2 py-0.5 flex-shrink-0"
                    style={{
                      color: GOLD,
                      backgroundColor: `${GOLD}18`,
                      border: `1px solid ${GOLD}40`,
                    }}
                  >
                    Lv.{agentProfile.level}
                  </span>
                )}
              </div>
              <p
                className="text-xs font-mono truncate mb-2"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                {agent.walletAddress}
              </p>
              {(agent as any).twitterHandle && (
                <p className="text-sm mb-2" style={{ color: GOLD }}>
                  @{(agent as any).twitterHandle}
                </p>
              )}
              {agentProfile && (
                <div className="mt-3">
                  <XPProgressBar
                    xp={agentProfile.xp}
                    level={agentProfile.level}
                    levelName={agentProfile.levelName}
                    xpForNextLevel={agentProfile.xpForNextLevel}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Stat Strip */}
          <div
            className="grid grid-cols-5 divide-x"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {[
              { label: 'Sortino', value: agent.sortino_ratio?.toFixed(2) || '--' },
              { label: 'Win Rate', value: formatPercent(winRate) },
              {
                label: 'Total P&L',
                value: formatCurrency(agent.total_pnl),
                color: agent.total_pnl >= 0 ? YES_C : NO_C,
              },
              { label: 'Trades', value: String(agent.trade_count || 0) },
              { label: 'XP', value: agentProfile ? String(agentProfile.xp) : '--' },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center py-4 px-2">
                <span
                  className="text-lg font-bold font-mono"
                  style={{ color: stat.color || GOLD }}
                >
                  {stat.value}
                </span>
                <span
                  className="text-[10px] uppercase tracking-widest mt-0.5"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Onboarding Progress (own profile only) */}
        {isOwnProfile && onboardingProgress < 100 && onboardingTasks.length > 0 && (
          <div
            className="p-5 mb-0"
            style={{
              backgroundColor: SURF,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <OnboardingChecklist
              tasks={onboardingTasks}
              completedTasks={onboardingTasks.filter((t) => t.status === 'VALIDATED').length}
              totalTasks={onboardingTasks.length}
            />
          </div>
        )}

        {/* Tab Bar */}
        <div
          className="flex items-center"
          style={{
            backgroundColor: SURF,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 0,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-5 py-3.5 text-[11px] font-mono font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer"
              style={{
                borderBottomColor: activeTab === tab.id ? GOLD : 'transparent',
                color: activeTab === tab.id ? GOLD : 'rgba(255,255,255,0.35)',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ backgroundColor: BG }}>
          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div>
              {/* P&L Chart */}
              {chartData.length > 0 && (
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="p-5">
                    <h3
                      className="text-xs uppercase tracking-widest mb-4 font-mono"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      Cumulative P&L
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.04)"
                        />
                        <XAxis
                          dataKey="timestamp"
                          stroke="rgba(255,255,255,0.2)"
                          style={{ fontSize: 11 }}
                          tick={{ fill: 'rgba(255,255,255,0.25)' }}
                        />
                        <YAxis
                          stroke="rgba(255,255,255,0.2)"
                          style={{ fontSize: 11 }}
                          tick={{ fill: 'rgba(255,255,255,0.25)' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#07090F',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 0,
                            fontSize: 12,
                          }}
                          labelStyle={{ color: 'rgba(255,255,255,0.4)' }}
                          itemStyle={{ color: GOLD }}
                        />
                        <Line
                          type="monotone"
                          dataKey="cumulativePnL"
                          stroke={GOLD}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Recent Trades */}
              <div>
                <div
                  className="px-5 py-3 flex items-center"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span
                    className="text-xs uppercase tracking-widest font-mono"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    Recent Trades
                  </span>
                </div>
                {trades.length === 0 ? (
                  <div
                    className="p-8 text-center text-sm"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  >
                    No trades yet
                  </div>
                ) : (
                  <div>
                    {trades.slice(0, 10).map((trade, index) => (
                      <div
                        key={trade.tradeId || index}
                        className="flex items-center justify-between px-5 py-3.5"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="text-[10px] font-bold font-mono px-2 py-0.5 min-w-[36px] text-center"
                            style={
                              trade.action === 'BUY'
                                ? {
                                    color: YES_C,
                                    backgroundColor: `${YES_C}14`,
                                    border: `1px solid ${YES_C}30`,
                                  }
                                : {
                                    color: NO_C,
                                    backgroundColor: `${NO_C}14`,
                                    border: `1px solid ${NO_C}30`,
                                  }
                            }
                          >
                            {trade.action}
                          </span>
                          <div>
                            <div className="font-bold text-white text-sm">{trade.tokenSymbol}</div>
                            <div
                              className="text-[11px] font-mono"
                              style={{ color: 'rgba(255,255,255,0.3)' }}
                            >
                              {trade.quantity?.toFixed(2)} @ {formatCurrency(trade.entryPrice)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className="text-sm font-mono font-bold"
                            style={{ color: trade.pnl >= 0 ? YES_C : NO_C }}
                          >
                            {formatCurrency(trade.pnl)}
                          </span>
                          <div
                            className="text-[10px] mt-0.5"
                            style={{ color: 'rgba(255,255,255,0.25)' }}
                          >
                            {new Date(trade.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PREDICTIONS ── */}
          {activeTab === 'predictions' && (
            <div>
              {/* Stats row */}
              {predStats ? (
                <div
                  className="grid grid-cols-4 divide-x"
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {[
                    { label: 'Total', value: String(predStats.totalPredictions) },
                    {
                      label: 'Accuracy',
                      value: `${(predStats.accuracy * 100).toFixed(1)}%`,
                      color: predStats.accuracy >= 0.5 ? YES_C : NO_C,
                    },
                    {
                      label: 'ROI',
                      value: `${predStats.roi >= 0 ? '+' : ''}${predStats.roi.toFixed(1)}%`,
                      color: predStats.roi >= 0 ? YES_C : NO_C,
                    },
                    {
                      label: 'Streak',
                      value: String(predStats.streak),
                      color: predStats.streak > 0 ? YES_C : 'rgba(255,255,255,0.5)',
                    },
                  ].map((s, i) => (
                    <div key={i} className="flex flex-col items-center py-5 px-3">
                      <span
                        className="text-xl font-bold font-mono"
                        style={{ color: s.color || GOLD }}
                      >
                        {s.value}
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-widest mt-0.5"
                        style={{ color: 'rgba(255,255,255,0.3)' }}
                      >
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="px-5 py-4 text-sm"
                  style={{
                    color: 'rgba(255,255,255,0.25)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  No prediction stats available
                </div>
              )}

              {/* Predictions list */}
              <div
                className="px-5 py-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span
                  className="text-xs uppercase tracking-widest font-mono"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  Recent Predictions
                </span>
              </div>
              {recentPredictions.length === 0 ? (
                <div
                  className="p-8 text-center text-sm"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  No predictions yet
                </div>
              ) : (
                <div>
                  {recentPredictions.map((pred) => (
                    <div
                      key={pred.id}
                      className="flex items-center justify-between px-5 py-3.5"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      {/* Left: side badge + market info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span
                          className="text-[10px] font-bold font-mono px-2 py-0.5 flex-shrink-0 min-w-[32px] text-center"
                          style={
                            pred.side === 'YES'
                              ? {
                                  color: YES_C,
                                  backgroundColor: `${YES_C}14`,
                                  border: `1px solid ${YES_C}30`,
                                }
                              : {
                                  color: NO_C,
                                  backgroundColor: `${NO_C}14`,
                                  border: `1px solid ${NO_C}30`,
                                }
                          }
                        >
                          {pred.side}
                        </span>
                        <div className="min-w-0">
                          <div
                            className="text-sm font-medium text-white truncate"
                          >
                            {pred.marketTitle}
                          </div>
                          <div
                            className="text-[11px] font-mono mt-0.5"
                            style={{ color: 'rgba(255,255,255,0.3)' }}
                          >
                            {pred.ticker} · avg {pred.avgPrice.toFixed(3)}
                          </div>
                        </div>
                      </div>

                      {/* Right: outcome + pnl */}
                      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                        {pred.pnl !== null && (
                          <span
                            className="text-sm font-mono font-bold"
                            style={{ color: pred.pnl >= 0 ? YES_C : NO_C }}
                          >
                            {pred.pnl >= 0 ? '+' : ''}
                            {pred.pnl.toFixed(2)}
                          </span>
                        )}
                        <span
                          className="text-[10px] font-mono font-bold px-2 py-0.5"
                          style={
                            pred.outcome === 'WIN'
                              ? {
                                  color: YES_C,
                                  backgroundColor: `${YES_C}14`,
                                  border: `1px solid ${YES_C}30`,
                                }
                              : pred.outcome === 'LOSS'
                              ? {
                                  color: NO_C,
                                  backgroundColor: `${NO_C}14`,
                                  border: `1px solid ${NO_C}30`,
                                }
                              : {
                                  color: 'rgba(255,255,255,0.4)',
                                  backgroundColor: 'rgba(255,255,255,0.04)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                }
                          }
                        >
                          {pred.outcome}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TASKS ── */}
          {activeTab === 'tasks' && (
            <div>
              {/* Summary */}
              <div
                className="grid grid-cols-2 divide-x"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex flex-col items-center py-5">
                  <span className="text-2xl font-bold font-mono text-white">{validatedCount}</span>
                  <span
                    className="text-[10px] uppercase tracking-widest mt-1"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    Tasks Completed
                  </span>
                </div>
                <div className="flex flex-col items-center py-5">
                  <span className="text-2xl font-bold font-mono" style={{ color: GOLD }}>
                    <Zap className="w-4 h-4 inline mr-1" />
                    {totalTaskXP}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-widest mt-1"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    XP Earned
                  </span>
                </div>
              </div>

              {taskCompletions.length === 0 ? (
                <div
                  className="p-8 text-center text-sm"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  No task completions yet
                </div>
              ) : (
                <div>
                  {taskCompletions.map((task) => (
                    <div
                      key={task.taskId}
                      className="flex items-center justify-between px-5 py-3.5"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{TASK_ICONS[task.taskType] || '📋'}</span>
                        <div>
                          <div className="font-medium text-white text-sm">{task.title}</div>
                          <div
                            className="text-[11px]"
                            style={{ color: 'rgba(255,255,255,0.3)' }}
                          >
                            {task.tokenSymbol ?? task.tokenMint?.slice(0, 8) ?? 'General'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className="flex items-center gap-1 text-xs font-mono font-bold"
                          style={{ color: GOLD }}
                        >
                          <Zap className="w-3 h-3" />
                          {task.xpAwarded ?? task.xpReward}
                        </span>
                        {task.status === 'VALIDATED' ? (
                          <CheckCircle2 className="w-4 h-4" style={{ color: YES_C }} />
                        ) : task.status === 'PENDING' ? (
                          <Clock className="w-4 h-4" style={{ color: GOLD }} />
                        ) : (
                          <Circle className="w-4 h-4" style={{ color: NO_C }} />
                        )}
                        {task.submittedAt && (
                          <span
                            className="text-[10px] hidden sm:inline"
                            style={{ color: 'rgba(255,255,255,0.25)' }}
                          >
                            {new Date(task.submittedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CONVERSATIONS ── */}
          {activeTab === 'conversations' && (
            <div>
              {conversations.length === 0 ? (
                <div
                  className="p-8 text-center text-sm"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  No conversations yet
                </div>
              ) : (
                conversations.map((conv) => (
                  <div key={conv.conversationId}>
                    <button
                      onClick={() => toggleConversation(conv.conversationId)}
                      className="w-full text-left px-5 py-4 cursor-pointer transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-sm truncate">
                            {conv.topic}
                          </div>
                          {conv.lastMessage && (
                            <div
                              className="text-xs mt-0.5 truncate"
                              style={{ color: 'rgba(255,255,255,0.3)' }}
                            >
                              {conv.lastMessage}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                          <span
                            className="flex items-center gap-1 text-[10px]"
                            style={{ color: 'rgba(255,255,255,0.3)' }}
                          >
                            <Users className="w-3 h-3" />
                            {conv.participantCount}
                          </span>
                          <span
                            className="flex items-center gap-1 text-[10px]"
                            style={{ color: 'rgba(255,255,255,0.3)' }}
                          >
                            <MessageSquare className="w-3 h-3" />
                            {conv.messageCount}
                          </span>
                          <span className="text-[10px] font-mono" style={{ color: GOLD }}>
                            {conv.agentMessageCount} msgs
                          </span>
                          <span
                            className="text-[10px]"
                            style={{ color: 'rgba(255,255,255,0.25)' }}
                          >
                            {new Date(conv.lastMessageAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* Expanded messages */}
                    {expandedConv === conv.conversationId && (
                      <div
                        className="p-4 space-y-3"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {convMessages[conv.conversationId] ? (
                          convMessages[conv.conversationId].length === 0 ? (
                            <div
                              className="text-xs text-center"
                              style={{ color: 'rgba(255,255,255,0.25)' }}
                            >
                              No messages
                            </div>
                          ) : (
                            convMessages[conv.conversationId].slice(-5).map((msg) => (
                              <div key={msg.messageId} className="flex gap-3">
                                <div
                                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-[10px] font-bold"
                                  style={{
                                    backgroundColor: `${GOLD}18`,
                                    color: GOLD,
                                  }}
                                >
                                  {msg.agentName.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="text-xs font-medium"
                                      style={{
                                        color:
                                          msg.agentId === params.id
                                            ? GOLD
                                            : 'rgba(255,255,255,0.5)',
                                      }}
                                    >
                                      {msg.agentName}
                                    </span>
                                    <span
                                      className="text-[10px]"
                                      style={{ color: 'rgba(255,255,255,0.25)' }}
                                    >
                                      {new Date(msg.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <p
                                    className="text-sm mt-0.5"
                                    style={{ color: 'rgba(255,255,255,0.8)' }}
                                  >
                                    {msg.content}
                                  </p>
                                </div>
                              </div>
                            ))
                          )
                        ) : (
                          <div
                            className="text-xs text-center animate-pulse"
                            style={{ color: 'rgba(255,255,255,0.25)' }}
                          >
                            Loading messages...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

