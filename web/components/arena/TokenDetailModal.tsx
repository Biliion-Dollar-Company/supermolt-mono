'use client';

import { useState, useEffect } from 'react';
import { X, Vote } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trade, Position, Vote as VoteType, Conversation, Message } from '@/lib/types';
import { getConversations, getConversationMessages, getAllVotes, getAllPositions, getRecentTrades } from '@/lib/api';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [allTrades, allPositions, allVotes, conversations] = await Promise.all([
        getRecentTrades(100),
        getAllPositions(),
        getAllVotes(),
        getConversations(),
      ]);

      setTrades(allTrades.filter(t => t.tokenSymbol === tokenSymbol));
      setPositions(allPositions.filter(p => p.tokenSymbol === tokenSymbol));
      setVotes(allVotes.filter(v => v.tokenSymbol === tokenSymbol));

      const relevantConversations = conversations.filter(
        c => c.tokenSymbol === tokenSymbol || c.topic.includes(tokenSymbol)
      );
      if (relevantConversations.length > 0) {
        const msgs = await getConversationMessages(relevantConversations[0].conversationId);
        setMessages(msgs);
      }

      setLoading(false);
    };
    fetchAll();
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

  // Compute estimated market cap from positions (quantity * currentPrice as a proxy)
  const totalHoldings = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const estimatedMcap = positions.length > 0
    ? positions[0].currentPrice * 1_000_000_000 // rough estimate: price × 1B supply
    : trades.length > 0 ? trades[0].entryPrice * 1_000_000_000 : 0;

  const fmt = (val: number) => {
    if (val >= 1_000_000_000) return `$${Math.round(val / 1_000_000_000)}B`;
    if (val >= 1_000_000) return `$${Math.round(val / 1_000_000)}M`;
    if (val >= 1_000) return `$${Math.round(val / 1_000)}K`;
    return `$${Math.round(val)}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/[0.06]">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-2xl font-bold font-mono text-accent-primary">{tokenSymbol}</span>
          {estimatedMcap > 0 && (
            <span className="text-sm font-mono text-text-muted">MCap {fmt(estimatedMcap)}</span>
          )}
          {totalPnl !== 0 && (
            <span className={`ml-auto text-sm font-mono font-bold ${totalPnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl > 0 ? '+' : '-'}{fmt(Math.abs(totalPnl))}
            </span>
          )}
        </div>
        <div className="flex gap-6 text-xs text-text-muted">
          <span>{positions.length} holders</span>
          <span>{fmt(totalHoldings)} held</span>
          <span className="text-green-400">{buyCount} buys</span>
          <span className="text-red-400">{sellCount} sells</span>
          {activeVotes > 0 && <span className="text-accent-primary">{activeVotes} active votes</span>}
        </div>
      </div>

      {/* Main Content: Two Columns */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 ${compact ? 'max-h-[350px]' : 'max-h-[50vh]'}`}>
        {/* Left: Wallet Positions + Activity */}
        <div className="border-r border-white/[0.06] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="sticky top-0 bg-bg-secondary/95 backdrop-blur-sm px-6 py-2.5 border-b border-white/[0.06] z-10">
              <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Positions</span>
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
                          {Math.round(pos.quantity)} tokens &middot; {fmt(pos.currentValue)}
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
                        <span className="text-text-muted font-mono">{Math.round(trade.quantity)}</span>
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
          </div>
        </div>

        {/* Right: Chat + Votes */}
        <div className="flex flex-col overflow-hidden">
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
