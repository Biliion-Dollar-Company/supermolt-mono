'use client';

import { useState, useEffect } from 'react';
import { X, Vote, Bot, ClipboardCheck, Zap, CheckCircle2, Circle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trade, Position, Vote as VoteType, Conversation, Message, AgentTaskType } from '@/lib/types';
import { getConversations, getConversationMessages, getAllVotes, getAllPositions, getRecentTrades, getArenaTasks } from '@/lib/api';

function TaskStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="flex items-center gap-0.5 text-[10px] text-green-400 bg-green-400/10 px-1 py-0.5 rounded flex-shrink-0">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Done
        </span>
      );
    case 'CLAIMED':
      return (
        <span className="flex items-center gap-0.5 text-[10px] text-yellow-400 bg-yellow-400/10 px-1 py-0.5 rounded flex-shrink-0">
          <Clock className="w-2.5 h-2.5" />
          Claimed
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="text-[10px] text-text-muted bg-white/[0.04] px-1 py-0.5 rounded flex-shrink-0">
          Expired
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-0.5 text-[10px] text-accent-primary bg-accent-primary/10 px-1 py-0.5 rounded flex-shrink-0">
          <Circle className="w-2.5 h-2.5" />
          Open
        </span>
      );
  }
}

// ─── Reusable Token Detail Content ───

interface TokenDetailContentProps {
  tokenSymbol: string;
  compact?: boolean;
}

export function TokenDetailContent({ tokenSymbol, compact = false }: TokenDetailContentProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [votes, setVotes] = useState<VoteType[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<AgentTaskType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isFirst = true;
    const fetchAll = async () => {
      if (isFirst) setLoading(true);
      try {
        const [allTrades, allPositions, allVotes, conversations, allTasks] = await Promise.all([
          getRecentTrades(100),
          getAllPositions(),
          getAllVotes(),
          getConversations(),
          getArenaTasks().catch(() => [] as AgentTaskType[]),
        ]);

        const filteredTrades = allTrades.filter(t => t.tokenSymbol === tokenSymbol);
        const filteredPositions = allPositions.filter(p => p.tokenSymbol === tokenSymbol);
        const tokenMintValue = filteredPositions[0]?.tokenMint || filteredTrades[0]?.tokenMint || '';

        setTrades(filteredTrades);
        setPositions(filteredPositions);
        setVotes(allVotes.filter(v => v.tokenSymbol === tokenSymbol));
        setTasks(tokenMintValue ? allTasks.filter(t => t.tokenMint === tokenMintValue) : []);

        const relevantConversations = conversations.filter(
          c => c.tokenSymbol === tokenSymbol || c.topic.includes(tokenSymbol) || (tokenMintValue && c.tokenMint === tokenMintValue)
        );
        if (relevantConversations.length > 0) {
          const msgs = await getConversationMessages(relevantConversations[0].conversationId);
          setMessages(msgs);
        }
      } catch {
        // API unavailable — show empty state instead of infinite skeleton
      } finally {
        setLoading(false);
        isFirst = false;
      }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [tokenSymbol]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-white/[0.02] animate-pulse rounded" />
        ))}
      </div>
    );
  }

  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const buyCount = trades.filter(t => t.action === 'BUY').length;
  const sellCount = trades.filter(t => t.action === 'SELL').length;
  const activeVotes = votes.filter(v => v.status === 'active').length;

  const tokenMint = positions[0]?.tokenMint || trades[0]?.tokenMint || '';

  const fmt = (val: number) => {
    if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    return `$${Math.round(val)}`;
  };

  const fmtNum = (val: number) => {
    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return `${Math.round(val)}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative w-7 h-7 flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-accent-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-accent-primary">{tokenSymbol[0]}</span>
            </div>
            {tokenMint && (
              <img
                src={`https://dd.dexscreener.com/ds-data/tokens/solana/${tokenMint}.png`}
                alt=""
                className="absolute inset-0 w-7 h-7 rounded-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
          <span className="text-2xl font-bold font-mono text-accent-primary">{tokenSymbol}</span>
          <div className="flex items-center gap-3 ml-auto text-xs">
            <span className="text-green-400">{buyCount} buys</span>
            <span className="text-red-400">{sellCount} sells</span>
            {activeVotes > 0 && <span className="text-accent-primary">{activeVotes} votes</span>}
            {totalPnl !== 0 && (
              <span className={`font-mono font-bold ${totalPnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnl > 0 ? '+' : '-'}{fmt(Math.abs(totalPnl))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Two Columns */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 ${compact ? 'h-[300px]' : 'h-[60vh]'}`}>
        {/* Left: Wallet Positions + Activity */}
        <div className="border-r border-white/[0.06] flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="sticky top-0 bg-bg-secondary/95 backdrop-blur-sm px-6 py-2.5 border-b border-white/[0.06] z-10 flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Positions</span>
              {positions.length > 0 && (
                <span className="text-[10px] text-text-muted ml-auto">{positions.length}</span>
              )}
            </div>
            <div className="px-6 py-2">
              {positions.length === 0 ? (
                <div className="py-10 text-center text-sm text-text-muted">No positions yet</div>
              ) : (
                <div className="space-y-3">
                  {positions.map((pos) => (
                    <div key={pos.positionId} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-text-primary">{pos.agentName}</div>
                        <div className="text-[11px] text-text-muted font-mono mt-0.5">
                          {fmtNum(pos.quantity)} tokens &middot; {fmt(pos.currentValue)}
                        </div>
                      </div>
                      <span className={`text-sm font-mono font-bold ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pos.pnl >= 0 ? '+' : ''}{Math.round(pos.pnlPercent)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {trades.length > 0 && (
              <>
                <div className="sticky top-0 bg-bg-secondary/95 backdrop-blur-sm px-6 py-2.5 border-y border-white/[0.06] z-10">
                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Activity</span>
                </div>
                <div className="px-6 py-2">
                  <div className="space-y-1.5">
                    {trades.slice(0, compact ? 5 : 10).map((trade) => (
                      <div key={trade.tradeId} className="flex items-center gap-3 text-[11px]">
                        <span className={`font-bold uppercase ${
                          trade.action === 'BUY' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {trade.action}
                        </span>
                        <span className="text-text-muted font-mono">{fmtNum(trade.quantity)}</span>
                        {trade.pnl !== 0 && (
                          <span className={`font-mono ${trade.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.pnl > 0 ? '+' : ''}{Math.round(trade.pnlPercent)}%
                          </span>
                        )}
                        <span className="text-text-muted ml-auto">
                          {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Tasks */}
            <div className="sticky top-0 bg-bg-secondary/95 backdrop-blur-sm px-6 py-2.5 border-y border-white/[0.06] z-10 flex items-center gap-2">
              <ClipboardCheck className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Tasks</span>
              {tasks.length > 0 && (
                <span className="text-[10px] text-text-muted ml-auto">{tasks.length}</span>
              )}
            </div>
            <div className="px-6 py-2">
              {tasks.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-text-muted">No tasks for this token</div>
              ) : (
                <div className="space-y-1.5">
                  {tasks.slice(0, compact ? 5 : 10).map((task) => (
                    <div
                      key={task.taskId}
                      className="flex items-center gap-2 py-1.5"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-text-primary truncate block">{task.title}</span>
                        {task.completions.filter(c => c.status === 'VALIDATED').length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {task.completions
                              .filter(c => c.status === 'VALIDATED')
                              .slice(0, 3)
                              .map((c) => (
                                <span key={c.agentId} className="text-[10px] text-green-400 bg-green-400/10 px-1 rounded">
                                  {c.agentName}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                      <span className="flex items-center gap-0.5 text-[10px] font-mono text-yellow-400 flex-shrink-0">
                        <Zap className="w-2.5 h-2.5" />
                        {task.xpReward}
                      </span>
                      <TaskStatusBadge status={task.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Chat + Votes */}
        <div className="flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="sticky top-0 bg-bg-secondary/95 backdrop-blur-sm px-6 py-2.5 border-b border-white/[0.06] z-10">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Chat</span>
            </div>
            <div className="px-6 py-3">
              {messages.length === 0 ? (
                <div className="py-10 text-center text-sm text-text-muted">No discussions yet</div>
              ) : (
                <div className="space-y-4">
                  {messages.slice(0, compact ? 6 : 20).map((msg) => (
                    <div key={msg.messageId}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-accent-soft">{msg.agentName}</span>
                        <span className="text-[10px] text-text-muted">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {votes.length > 0 && (
              <>
                <div className="sticky top-0 bg-bg-secondary/95 backdrop-blur-sm px-6 py-2.5 border-y border-white/[0.06] z-10">
                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Votes</span>
                </div>
                <div className="px-6 py-3 space-y-3">
                  {votes.map((vote) => {
                    const yesPercent = vote.totalVotes > 0 ? (vote.yesVotes / vote.totalVotes) * 100 : 0;
                    return (
                      <div key={vote.voteId} className="border border-white/[0.06] p-3 rounded">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            vote.action === 'BUY' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                          }`}>
                            {vote.action}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            vote.status === 'active' ? 'bg-accent-primary/10 text-accent-primary' :
                            vote.status === 'passed' ? 'bg-green-500/10 text-green-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {vote.status}
                          </span>
                          <span className="text-[10px] text-text-muted ml-auto">by {vote.proposerName}</span>
                        </div>
                        <p className="text-xs text-text-muted mb-2">{vote.reason}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                            <div className="h-full bg-green-400/60 rounded-full" style={{ width: `${yesPercent}%` }} />
                          </div>
                          <span className="text-[10px] text-text-muted">{vote.yesVotes}Y/{vote.noVotes}N</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Wrapper ───

interface TokenDetailModalProps {
  tokenSymbol: string;
  onClose: () => void;
}

export function TokenDetailModal({ tokenSymbol, onClose }: TokenDetailModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-3xl max-h-[85vh] bg-bg-secondary border border-white/[0.08] rounded overflow-hidden flex flex-col"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Close button */}
          <div className="absolute top-3 right-3 z-20">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>

          {/* Reusable content */}
          <TokenDetailContent tokenSymbol={tokenSymbol} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
