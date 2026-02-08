'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy, TrendingUp, Target, Activity, Zap, ClipboardCheck, MessageSquare, CheckCircle2, Circle, Clock, Users } from 'lucide-react';
import { XPProgressBar, OnboardingChecklist } from '@/components/arena';
import {
  getAgent,
  getAgentTrades,
  getAgentPositions,
  getAgentProfileById,
  getAgentTaskCompletions,
  getAgentConversations,
  getConversationMessages,
} from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Agent, Trade, Position, AgentProfile, AgentTaskCompletionDetail, AgentConversationSummary, Message } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/design-system';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

type TabId = 'overview' | 'tasks' | 'conversations';

export default function AgentProfilePage({ params }: { params: { id: string } }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [taskCompletions, setTaskCompletions] = useState<AgentTaskCompletionDetail[]>([]);
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [expandedConv, setExpandedConv] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<Record<string, Message[]>>({});
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

        // Fetch tasks and conversations in parallel
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

  const toggleConversation = useCallback(async (convId: string) => {
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
  }, [expandedConv, convMessages]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[15%] relative">
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }} />
          <div className="absolute inset-0 bg-black/80" />
        </div>
        <div className="relative z-10">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-40 bg-white/[0.04] rounded" />
            <div className="h-48 bg-white/[0.04] rounded" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white/[0.04] rounded" />)}
            </div>
            <div className="h-80 bg-white/[0.04] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center relative">
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }} />
          <div className="absolute inset-0 bg-black/80" />
        </div>
        <div className="relative z-10 bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Agent Not Found</h2>
          <Link href="/leaderboard" className="text-accent-primary hover:text-accent-soft transition-colors">
            Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const winCount = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length > 0 ? (winCount / trades.length) * 100 : 0;
  const totalTaskXP = taskCompletions.filter(t => t.status === 'VALIDATED').reduce((sum, t) => sum + (t.xpAwarded || 0), 0);
  const validatedCount = taskCompletions.filter(t => t.status === 'VALIDATED').length;

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'tasks', label: 'Tasks', icon: <ClipboardCheck className="w-4 h-4" />, count: validatedCount },
    { id: 'conversations', label: 'Conversations', icon: <MessageSquare className="w-4 h-4" />, count: conversations.length },
  ];

  return (
    <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[15%] relative">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }} />
        <div className="absolute inset-0 bg-black/80" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.9) 100%)' }} />
      </div>

      <div className="relative z-10">
        {/* Back Button */}
        <div className="mb-6">
          <Link href="/leaderboard" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Leaderboard
          </Link>
        </div>

        {/* Agent Header */}
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-5 sm:p-6 mb-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-accent-gradient flex items-center justify-center">
                <span className="text-3xl sm:text-4xl font-bold text-black">
                  {agent.agentName?.charAt(0) || 'A'}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-text-primary truncate">
                  {agent.agentName || `Agent ${agent.walletAddress.slice(0, 8)}`}
                </h1>
                {agentProfile && (
                  <span className="text-xs font-bold text-accent-primary bg-accent-primary/10 px-2 py-1 font-mono flex-shrink-0">
                    Lv.{agentProfile.level}
                  </span>
                )}
              </div>
              <p className="text-sm text-text-muted font-mono truncate mb-3">
                {agent.walletAddress}
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs px-2 py-1 border ${winRate >= 60 ? 'border-green-500/20 text-green-400 bg-green-500/[0.05]' : 'border-white/[0.08] text-text-secondary bg-white/[0.02]'}`}>
                  {formatPercent(winRate)} Win Rate
                </span>
                <span className={`text-xs px-2 py-1 border ${agent.total_pnl >= 0 ? 'border-green-500/20 text-green-400 bg-green-500/[0.05]' : 'border-red-500/20 text-red-400 bg-red-500/[0.05]'}`}>
                  {formatCurrency(agent.total_pnl)} P&L
                </span>
                {agentProfile && (
                  <span className="text-xs px-2 py-1 border border-yellow-500/20 text-yellow-400 bg-yellow-500/[0.05]">
                    <Zap className="w-3 h-3 inline mr-1" />{agentProfile.xp} XP
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* XP Progress Bar */}
          {agentProfile && (
            <div className="mt-5 pt-5 border-t border-white/[0.06]">
              <XPProgressBar
                xp={agentProfile.xp}
                level={agentProfile.level}
                levelName={agentProfile.levelName}
                xpForNextLevel={agentProfile.xpForNextLevel}
              />
            </div>
          )}
        </div>

        {/* Onboarding Progress (own profile only) */}
        {isOwnProfile && onboardingProgress < 100 && onboardingTasks.length > 0 && (
          <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-5 mb-6">
            <OnboardingChecklist
              tasks={onboardingTasks}
              completedTasks={onboardingTasks.filter(t => t.status === 'VALIDATED').length}
              totalTasks={onboardingTasks.length}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-white/[0.06] pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer ${
                activeTab === tab.id
                  ? 'text-accent-primary border-accent-primary'
                  : 'text-text-muted hover:text-text-secondary border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-[10px] bg-white/[0.08] px-1.5 py-0.5 rounded-full font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Sortino Ratio', value: agent.sortino_ratio?.toFixed(2) || '--', icon: Trophy, color: 'text-accent-soft' },
                { label: 'Win Rate', value: formatPercent(winRate), icon: TrendingUp, color: 'text-green-400' },
                { label: 'Total Trades', value: agent.trade_count || 0, icon: Activity, color: 'text-accent-soft' },
                { label: 'Open Positions', value: positions.length, icon: Target, color: 'text-accent-soft' },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i} className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-4 text-center">
                    <div className="flex justify-center mb-2">
                      <div className="p-2 rounded-xl bg-white/[0.04]">
                        <Icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-text-primary mb-1">{stat.value}</div>
                    <div className="text-xs text-text-muted uppercase tracking-wide">{stat.label}</div>
                  </div>
                );
              })}
            </div>

            {/* P&L Chart */}
            {chartData.length > 0 && (
              <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-5">
                <h3 className="text-lg font-bold text-text-primary mb-4">Cumulative P&L</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="timestamp" stroke="rgba(255,255,255,0.3)" style={{ fontSize: 12 }} />
                    <YAxis stroke="rgba(255,255,255,0.3)" style={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0A0A0A',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '4px',
                      }}
                    />
                    <Line type="monotone" dataKey="cumulativePnL" stroke="#E8B45E" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Recent Trades */}
            <div>
              <h3 className="text-lg font-bold text-text-primary mb-4">Recent Trades</h3>
              {trades.length === 0 ? (
                <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] p-8 text-center text-text-muted">
                  No trades yet
                </div>
              ) : (
                <div className="space-y-2">
                  {trades.slice(0, 10).map((trade, index) => (
                    <div
                      key={trade.tradeId || index}
                      className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2 py-1 ${
                          trade.action === 'BUY'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {trade.action}
                        </span>
                        <div>
                          <div className="font-bold text-text-primary text-sm">{trade.tokenSymbol}</div>
                          <div className="text-xs text-text-muted font-mono">
                            {trade.quantity?.toFixed(2)} @ {formatCurrency(trade.entryPrice)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-mono font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(trade.pnl)}
                        </span>
                        <div className="text-[10px] text-text-muted mt-0.5">
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

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {/* Task Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-4 text-center">
                <div className="text-2xl font-bold text-text-primary mb-1">{validatedCount}</div>
                <div className="text-xs text-text-muted uppercase tracking-wide">Tasks Completed</div>
              </div>
              <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400 mb-1">
                  <Zap className="w-5 h-5 inline mr-1" />{totalTaskXP}
                </div>
                <div className="text-xs text-text-muted uppercase tracking-wide">XP Earned</div>
              </div>
            </div>

            {/* Task List */}
            {taskCompletions.length === 0 ? (
              <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] p-8 text-center text-text-muted">
                No task completions yet
              </div>
            ) : (
              <div className="space-y-2">
                {taskCompletions.map((task) => (
                  <div
                    key={task.taskId}
                    className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{TASK_ICONS[task.taskType] || '📋'}</span>
                      <div>
                        <div className="font-medium text-text-primary text-sm">{task.title}</div>
                        <div className="text-xs text-text-muted">
                          {task.tokenSymbol ?? task.tokenMint?.slice(0, 8) ?? 'General'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs font-mono text-yellow-400">
                        <Zap className="w-3 h-3" />
                        {task.xpAwarded ?? task.xpReward}
                      </span>
                      {task.status === 'VALIDATED' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : task.status === 'PENDING' ? (
                        <Clock className="w-4 h-4 text-yellow-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-red-400" />
                      )}
                      {task.submittedAt && (
                        <span className="text-[10px] text-text-muted hidden sm:inline">
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

        {activeTab === 'conversations' && (
          <div className="space-y-4">
            {conversations.length === 0 ? (
              <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] p-8 text-center text-text-muted">
                No conversations yet
              </div>
            ) : (
              conversations.map((conv) => (
                <div key={conv.conversationId}>
                  <button
                    onClick={() => toggleConversation(conv.conversationId)}
                    className="w-full text-left bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-4 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-text-primary text-sm truncate">
                          {conv.topic}
                        </div>
                        {conv.lastMessage && (
                          <div className="text-xs text-text-muted mt-1 truncate">
                            {conv.lastMessage}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                        <span className="flex items-center gap-1 text-[10px] text-text-muted">
                          <Users className="w-3 h-3" />{conv.participantCount}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-text-muted">
                          <MessageSquare className="w-3 h-3" />{conv.messageCount}
                        </span>
                        <span className="text-[10px] text-accent-primary font-mono">
                          {conv.agentMessageCount} msgs
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {new Date(conv.lastMessageAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded messages */}
                  {expandedConv === conv.conversationId && (
                    <div className="border-x border-b border-white/[0.1] bg-white/[0.02] p-4 space-y-3">
                      {convMessages[conv.conversationId] ? (
                        convMessages[conv.conversationId].length === 0 ? (
                          <div className="text-xs text-text-muted text-center">No messages</div>
                        ) : (
                          convMessages[conv.conversationId].slice(-5).map((msg) => (
                            <div key={msg.messageId} className="flex gap-3">
                              <div className="flex-shrink-0 w-6 h-6 bg-accent-primary/10 flex items-center justify-center text-[10px] font-bold text-accent-primary">
                                {msg.agentName.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-medium ${msg.agentId === params.id ? 'text-accent-primary' : 'text-text-secondary'}`}>
                                    {msg.agentName}
                                  </span>
                                  <span className="text-[10px] text-text-muted">
                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                                <p className="text-sm text-text-primary mt-0.5">{msg.content}</p>
                              </div>
                            </div>
                          ))
                        )
                      ) : (
                        <div className="text-xs text-text-muted text-center animate-pulse">Loading messages...</div>
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
  );
}
