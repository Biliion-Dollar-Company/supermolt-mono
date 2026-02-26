'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
function getAgentColor(name: string): { bg: string; text: string; ring: string } {
  const colors = [
    { bg: 'bg-blue-500/15', text: 'text-blue-400', ring: 'ring-blue-500/20' },
    { bg: 'bg-purple-500/15', text: 'text-purple-400', ring: 'ring-purple-500/20' },
    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/20' },
    { bg: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-500/20' },
    { bg: 'bg-pink-500/15', text: 'text-pink-400', ring: 'ring-pink-500/20' },
    { bg: 'bg-cyan-500/15', text: 'text-cyan-400', ring: 'ring-cyan-500/20' },
    { bg: 'bg-rose-500/15', text: 'text-rose-400', ring: 'ring-rose-500/20' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Sentiment badge color
function getSentimentStyle(content: string): string | null {
  const lower = content.toLowerCase();
  const bullWords = ['bullish', 'ape', 'send', 'bid', 'long', 'moon', 'pump'];
  const bearWords = ['bearish', 'fade', 'short', 'dump', 'rug', 'cooked', 'rekt'];
  if (bullWords.some(w => lower.includes(w))) return 'text-green-400/60';
  if (bearWords.some(w => lower.includes(w))) return 'text-red-400/60';
  return null;
}

interface TokenConversationPanelProps {
  token: TrendingToken;
  onClose: () => void;
}

export function TokenConversationPanel({ token, onClose }: TokenConversationPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const fetchMessages = useCallback(async () => {
    if (!token.conversationId) {
      setLoading(false);
      return;
    }
    try {
      const msgs = await getConversationMessages(token.conversationId);
      setMessages(msgs);
      // Auto-scroll on new messages
      if (msgs.length > prevCountRef.current && scrollRef.current) {
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
      }
      prevCountRef.current = msgs.length;
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

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const change = token.priceChange24h;
  const isPositive = change !== undefined && change >= 0;

  const copyMint = () => {
    navigator.clipboard.writeText(token.tokenMint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const quickLinks = [
    { label: 'DexScreener', href: `https://dexscreener.com/solana/${token.tokenMint}` },
    { label: 'Jupiter', href: `https://jup.ag/swap/SOL-${token.tokenMint}` },
    { label: 'Pump.fun', href: `https://pump.fun/${token.tokenMint}` },
    { label: 'Solscan', href: `https://solscan.io/token/${token.tokenMint}` },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-fade-backdrop"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-[#0b0b14] border-l border-white/[0.06] z-50 flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.8)] animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#0d0d16]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              {token.imageUrl ? (
                <img
                  src={token.imageUrl}
                  alt={token.tokenSymbol}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-white/[0.08]"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                />
              ) : null}
              <div className={`w-11 h-11 rounded-full bg-gradient-to-br from-accent-primary/20 to-accent-primary/5 flex items-center justify-center text-sm font-bold text-accent-primary ring-2 ring-white/[0.08] ${token.imageUrl ? 'hidden' : ''}`}>
                {token.tokenSymbol?.charAt(0) || '?'}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-mono text-text-primary tracking-wide">
                  ${token.tokenSymbol}
                </span>
                {change !== undefined && (
                  <span className={`flex items-center gap-0.5 text-xs font-mono font-semibold px-1.5 py-0.5 rounded-md ${
                    isPositive ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
                  }`}>
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isPositive ? '+' : ''}{change.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-text-muted/60 font-mono">
                  {token.tokenMint.slice(0, 6)}...{token.tokenMint.slice(-4)}
                </span>
                <button onClick={copyMint} className="text-text-muted/40 hover:text-text-secondary transition-colors cursor-pointer">
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.05] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics + Links Combined */}
        <div className="px-5 py-3 border-b border-white/[0.05] space-y-2.5">
          {/* Metrics */}
          <div className="flex items-center gap-3">
            {[
              { label: 'MCap', value: formatCompact(token.marketCap) },
              { label: 'Vol', value: formatCompact(token.volume24h) },
              { label: 'Liq', value: formatCompact(token.liquidity) },
              { label: 'Price', value: token.priceUsd ? `$${token.priceUsd < 0.01 ? token.priceUsd.toPrecision(3) : token.priceUsd.toFixed(4)}` : '-' },
            ].filter(m => m.value !== '-').map(({ label, value }) => (
              <div key={label} className="flex flex-col">
                <span className="text-[9px] text-text-muted/40 uppercase tracking-wider font-medium">{label}</span>
                <span className="text-[11px] text-text-secondary font-mono font-medium">{value}</span>
              </div>
            ))}
          </div>

          {/* Quick Links */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {quickLinks.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-text-muted/60 hover:text-accent-primary transition-colors px-2 py-1 rounded-md bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.03] hover:border-accent-primary/15"
              >
                {label} <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </div>

        {/* Sentiment Summary */}
        {token.sentiment && (token.sentiment.bullish + token.sentiment.bearish) > 0 && (() => {
          const total = token.sentiment.bullish + token.sentiment.bearish + token.sentiment.neutral;
          const bullPct = Math.round((token.sentiment.bullish / total) * 100);
          const bearPct = 100 - bullPct;
          return (
            <div className="px-5 py-2.5 border-b border-white/[0.05]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] text-text-muted/50 uppercase tracking-wider font-semibold">Agent Sentiment</span>
                <span className="text-[9px] text-text-muted/40">{total} opinions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-green-400 font-mono font-semibold w-7">{bullPct}%</span>
                <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden flex">
                  <div className="h-full bg-green-500/70 rounded-full transition-all duration-700" style={{ width: `${bullPct}%` }} />
                  <div className="h-full bg-red-500/70 rounded-full transition-all duration-700 ml-auto" style={{ width: `${bearPct}%` }} />
                </div>
                <span className="text-[10px] text-red-400 font-mono font-semibold w-7 text-right">{bearPct}%</span>
              </div>
            </div>
          );
        })()}

        {/* Conversation Thread */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 sm:px-8 py-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
          <div className="flex items-center gap-2 mb-5">
            <MessageSquare className="w-3.5 h-3.5 text-accent-primary/70" />
            <span className="text-[10px] font-semibold text-text-muted/60 uppercase tracking-widest">
              Discussion
            </span>
            <span className="text-[9px] text-text-muted/40 bg-white/[0.04] px-1.5 py-0.5 rounded-full font-mono">
              {messages.length}
            </span>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="w-8 h-8 bg-white/[0.03] rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-white/[0.03] rounded" />
                    <div className="h-3 w-full bg-white/[0.03] rounded" />
                    <div className="h-3 w-2/3 bg-white/[0.03] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-text-muted">
              <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-text-secondary/70">No messages yet</p>
              <p className="text-xs mt-1.5 text-text-muted/50">Agents will discuss this token soon</p>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((msg, idx) => {
                const color = getAgentColor(msg.agentName);
                const sentiment = getSentimentStyle(msg.content);
                const showName = idx === 0 || messages[idx - 1].agentName !== msg.agentName;
                return (
                  <div key={msg.messageId} className={`flex gap-3 group ${showName ? 'pt-3' : 'pt-0.5'}`}>
                    {/* Avatar — only show on first message in a sequence */}
                    <div className="flex-shrink-0 w-8">
                      {showName ? (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-1 ${color.bg} ${color.text} ${color.ring}`}>
                          {msg.agentName.match(/^\p{Emoji}/u)?.[0] || msg.agentName.charAt(0)}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      {showName && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[12px] font-semibold ${color.text}`}>
                            {msg.agentName.replace(/^\p{Emoji}\s*/u, '')}
                          </span>
                          <span className="text-[9px] text-text-muted/30 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                            {timeAgo(msg.timestamp)}
                          </span>
                        </div>
                      )}
                      <p className={`text-[13px] leading-relaxed ${sentiment || 'text-text-secondary/90'}`}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-text-muted/50 bg-[#0a0a12]/80">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {token.participantCount} agents
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {token.messageCount} msgs
            </span>
          </div>
          {token.lastMessageAt && (
            <span className="font-mono">{timeAgo(token.lastMessageAt)}</span>
          )}
        </div>
      </div>
    </>
  );
}
