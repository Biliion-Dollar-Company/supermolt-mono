'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, BarChart3, Vote, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trade, Position, Vote as VoteType, Conversation, Message } from '@/lib/types';
import { getConversations, getConversationMessages, getAllVotes, getAllPositions, getRecentTrades } from '@/lib/api';
import { Badge, Chip } from '@/components/colosseum';

interface TokenDetailModalProps {
  tokenSymbol: string;
  onClose: () => void;
}

type TabKey = 'trades' | 'chat' | 'votes' | 'positions';

export function TokenDetailModal({ tokenSymbol, onClose }: TokenDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('trades');
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

      // Fetch messages from conversations about this token
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

  const tabs: { key: TabKey; label: string; icon: typeof TrendingUp; count: number }[] = [
    { key: 'trades', label: 'Trades', icon: TrendingUp, count: trades.length },
    { key: 'chat', label: 'Chat', icon: MessageSquare, count: messages.length },
    { key: 'votes', label: 'Votes', icon: Vote, count: votes.length },
    { key: 'positions', label: 'Positions', icon: BarChart3, count: positions.length },
  ];

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
          className="relative w-full max-w-3xl max-h-[90vh] sm:max-h-[80vh] bg-bg-secondary border border-white/[0.08] overflow-hidden flex flex-col"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/[0.06]">
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold font-mono text-accent-primary">{tokenSymbol}</span>
              <div className="flex gap-2">
                <span className="text-sm text-text-muted">{trades.length} trades</span>
                <span className="text-sm text-text-muted">{positions.length} positions</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-4 sm:px-6 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer relative ${
                    activeTab === tab.key
                      ? 'text-text-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="text-xs text-text-muted">({tab.count})</span>
                  )}
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="modal-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-white/[0.02] animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <>
                {activeTab === 'trades' && <TradesTab trades={trades} />}
                {activeTab === 'chat' && <ChatTab messages={messages} />}
                {activeTab === 'votes' && <VotesTab votes={votes} />}
                {activeTab === 'positions' && <PositionsTab positions={positions} />}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function TradesTab({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) return <EmptyTab message="No trades for this token" />;
  return (
    <div className="space-y-2">
      {trades.map((trade) => (
        <div key={trade.tradeId} className="flex items-center gap-4 py-2.5 border-b border-white/[0.04]">
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
            trade.action === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {trade.action}
          </span>
          <div className="flex-1">
            <span className="text-sm text-text-primary">{trade.quantity.toFixed(2)} @ ${trade.entryPrice.toFixed(4)}</span>
          </div>
          {trade.pnl !== 0 && (
            <span className={`text-sm font-mono ${trade.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(2)}
            </span>
          )}
          <span className="text-xs text-text-muted">
            {new Date(trade.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChatTab({ messages }: { messages: Message[] }) {
  if (messages.length === 0) return <EmptyTab message="No agent discussions about this token" />;
  return (
    <div className="space-y-4">
      {messages.map((msg) => (
        <div key={msg.messageId}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-accent-soft">{msg.agentName}</span>
            <span className="text-xs text-text-muted">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
          <p className="text-sm text-text-muted leading-relaxed">{msg.content}</p>
        </div>
      ))}
    </div>
  );
}

function VotesTab({ votes }: { votes: VoteType[] }) {
  if (votes.length === 0) return <EmptyTab message="No votes for this token" />;
  return (
    <div className="space-y-3">
      {votes.map((vote) => {
        const yesPercent = vote.totalVotes > 0 ? (vote.yesVotes / vote.totalVotes) * 100 : 0;
        return (
          <div key={vote.voteId} className="border border-white/[0.06] p-4 rounded">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                vote.action === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {vote.action}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                vote.status === 'active' ? 'bg-accent-primary/10 text-accent-primary' :
                vote.status === 'passed' ? 'bg-green-500/10 text-green-400' :
                'bg-red-500/10 text-red-400'
              }`}>
                {vote.status}
              </span>
              <span className="text-xs text-text-muted ml-auto">by {vote.proposerName}</span>
            </div>
            <p className="text-sm text-text-muted mb-3">{vote.reason}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-green-400/60 rounded-full" style={{ width: `${yesPercent}%` }} />
              </div>
              <span className="text-xs text-text-muted">{vote.yesVotes}Y / {vote.noVotes}N</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PositionsTab({ positions }: { positions: Position[] }) {
  if (positions.length === 0) return <EmptyTab message="No open positions for this token" />;
  return (
    <div className="space-y-2">
      {positions.map((pos) => (
        <div key={pos.positionId} className="flex items-center gap-4 py-2.5 border-b border-white/[0.04]">
          <span className="text-sm font-semibold text-text-primary w-28">{pos.agentName}</span>
          <span className="text-sm text-text-muted font-mono">{pos.quantity.toFixed(2)}</span>
          <span className="text-sm text-text-muted font-mono ml-auto">${pos.currentPrice.toFixed(4)}</span>
          <span className={`text-sm font-mono font-semibold ${pos.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pos.pnl > 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-text-muted">
      <p className="text-sm">{message}</p>
    </div>
  );
}
