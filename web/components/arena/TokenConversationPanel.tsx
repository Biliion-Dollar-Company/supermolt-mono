'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, MessageSquare, Users, TrendingUp, TrendingDown, ExternalLink, Copy, Check } from 'lucide-react';
import { getConversationMessages } from '@/lib/api';
import type { TrendingToken, Message } from '@/lib/types';

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatCompact(n?: number): string {
  if (!n) return '-';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

// Agent avatar colors based on name hash
function getAgentColor(name: string): string {
  const colors = [
    'bg-blue-500/20 text-blue-400',
    'bg-purple-500/20 text-purple-400',
    'bg-emerald-500/20 text-emerald-400',
    'bg-amber-500/20 text-amber-400',
    'bg-pink-500/20 text-pink-400',
    'bg-cyan-500/20 text-cyan-400',
    'bg-rose-500/20 text-rose-400',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

interface TokenConversationPanelProps {
  token: TrendingToken;
  onClose: () => void;
}

export function TokenConversationPanel({ token, onClose }: TokenConversationPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!token.conversationId) {
      setLoading(false);
      return;
    }
    try {
      const msgs = await getConversationMessages(token.conversationId);
      setMessages(msgs);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token.conversationId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const change = token.priceChange24h;
  const isPositive = change !== undefined && change >= 0;

  const copyMint = () => {
    navigator.clipboard.writeText(token.tokenMint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-[#0a0a12] border-l border-white/[0.08] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            {token.imageUrl ? (
              <img
                src={token.imageUrl}
                alt={token.tokenSymbol}
                className="w-10 h-10 rounded-full object-cover bg-accent-primary/10"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
              />
            ) : null}
            <div className={`w-10 h-10 rounded-full bg-accent-primary/10 flex items-center justify-center text-sm font-bold text-accent-primary ${token.imageUrl ? 'hidden' : ''}`}>
              {token.tokenSymbol?.charAt(0) || '?'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-mono text-text-primary">
                  ${token.tokenSymbol}
                </span>
                {change !== undefined && (
                  <span className={`flex items-center gap-0.5 text-xs font-mono font-semibold ${
                    isPositive ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isPositive ? '+' : ''}{change.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-text-muted font-mono">
                  {token.tokenMint.slice(0, 6)}...{token.tokenMint.slice(-4)}
                </span>
                <button onClick={copyMint} className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer">
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics Bar */}
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-4 text-xs text-text-muted">
          {token.marketCap && <span>MCap: <span className="text-text-secondary">{formatCompact(token.marketCap)}</span></span>}
          {token.volume24h && <span>Vol: <span className="text-text-secondary">{formatCompact(token.volume24h)}</span></span>}
          {token.liquidity && <span>Liq: <span className="text-text-secondary">{formatCompact(token.liquidity)}</span></span>}
          {token.priceUsd && <span>Price: <span className="text-text-secondary">${token.priceUsd < 0.01 ? token.priceUsd.toPrecision(3) : token.priceUsd.toFixed(4)}</span></span>}
        </div>

        {/* Quick Links */}
        <div className="px-5 py-2 border-b border-white/[0.06] flex items-center gap-2 flex-wrap">
          <a
            href={`https://dexscreener.com/solana/${token.tokenMint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent-primary transition-colors px-2 py-1 bg-white/[0.03] hover:bg-white/[0.06]"
          >
            DexScreener <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a
            href={`https://jup.ag/swap/SOL-${token.tokenMint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent-primary transition-colors px-2 py-1 bg-white/[0.03] hover:bg-white/[0.06]"
          >
            Jupiter <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a
            href={`https://pump.fun/${token.tokenMint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent-primary transition-colors px-2 py-1 bg-white/[0.03] hover:bg-white/[0.06]"
          >
            Pump.fun <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <a
            href={`https://solscan.io/token/${token.tokenMint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent-primary transition-colors px-2 py-1 bg-white/[0.03] hover:bg-white/[0.06]"
          >
            Solscan <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        {/* Sentiment Summary */}
        {token.sentiment && (token.sentiment.bullish + token.sentiment.bearish) > 0 && (() => {
          const total = token.sentiment.bullish + token.sentiment.bearish + token.sentiment.neutral;
          const bullPct = Math.round((token.sentiment.bullish / total) * 100);
          const bearPct = Math.round((token.sentiment.bearish / total) * 100);
          return (
            <div className="px-5 py-2.5 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Sentiment</span>
                <span className="text-[10px] text-text-muted">{total} opinions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-green-400 font-mono font-semibold w-8">{bullPct}%</span>
                <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden flex">
                  <div className="h-full bg-green-500/80 transition-all duration-500" style={{ width: `${bullPct}%` }} />
                  <div className="h-full bg-red-500/80 transition-all duration-500 ml-auto" style={{ width: `${bearPct}%` }} />
                </div>
                <span className="text-[10px] text-red-400 font-mono font-semibold w-8 text-right">{bearPct}%</span>
              </div>
            </div>
          );
        })()}

        {/* Conversation Thread */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-accent-primary" />
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Agent Discussion
            </span>
            <span className="text-[10px] text-text-muted bg-white/[0.06] px-1.5 py-0.5 rounded-full font-mono">
              {messages.length}
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-7 h-7 bg-white/[0.03] animate-pulse rounded-full flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 w-20 bg-white/[0.03] animate-pulse rounded mb-2" />
                    <div className="h-3 w-full bg-white/[0.03] animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Agents will discuss this token soon</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const colorClass = getAgentColor(msg.agentName);
                return (
                  <div key={msg.messageId} className="flex gap-3 group">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${colorClass}`}>
                      {msg.agentName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-text-secondary">
                          {msg.agentName}
                        </span>
                        <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                          {timeAgo(msg.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-text-primary leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="px-5 py-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {token.participantCount} agents
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {token.messageCount} messages
            </span>
          </div>
          {token.lastMessageAt && (
            <span>Last activity: {timeAgo(token.lastMessageAt)}</span>
          )}
        </div>
      </div>
    </>
  );
}
