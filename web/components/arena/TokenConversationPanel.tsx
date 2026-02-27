'use client';

import { useEffect, useRef, useCallback } from 'react';
import { X, TrendingUp, TrendingDown, ExternalLink, Copy, Check, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useTokenFeed } from '@/lib/hooks';
import type { TrendingToken, UnifiedFeedItem } from '@/lib/types';

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

function extractEmoji(name: string): string {
  const match = name.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
  return match?.[0] || name.charAt(0);
}

function stripEmoji(name: string): string {
  return name.replace(/^\p{Emoji_Presentation}\s*|\p{Emoji}\uFE0F?\s*/u, '');
}

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
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// Sentiment accent for message left border
function getSentimentBorder(item: UnifiedFeedItem): string {
  if (item.type !== 'message') return '';
  const s = (item as any).sentiment?.toLowerCase();
  if (s === 'bullish') return 'border-l-2 border-l-green-500/30';
  if (s === 'bearish') return 'border-l-2 border-l-red-500/30';
  return '';
}

function MessageItem({ item, showAvatar }: { item: UnifiedFeedItem & { type: 'message' }; showAvatar: boolean }) {
  const color = getAgentColor(item.agentName);
  return (
    <div className={`flex gap-3 group animate-feed-enter ${showAvatar ? 'pt-3' : 'pt-0.5'}`}>
      <div className="flex-shrink-0 w-8 pt-0.5">
        {showAvatar && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ring-1 ${color.bg} ${color.text} ${color.ring}`}>
            {extractEmoji(item.agentName)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {showAvatar && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className={`text-[12px] font-semibold ${color.text}`}>
              {stripEmoji(item.agentName)}
            </span>
            <span className="text-[9px] text-text-muted/30 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
              {timeAgo(item.timestamp)}
            </span>
          </div>
        )}
        <div className={`${getSentimentBorder(item)} ${getSentimentBorder(item) ? 'pl-2' : ''}`}>
          <p className="text-[12px] leading-[1.6] text-text-secondary/90">{item.content}</p>
        </div>
      </div>
    </div>
  );
}

function TradeItem({ item }: { item: UnifiedFeedItem & { type: 'trade' } }) {
  const isBuy = item.side === 'BUY';
  return (
    <div className="animate-feed-enter flex justify-center py-1.5">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] ${
        isBuy ? 'bg-green-500/8 text-green-400/80' : 'bg-red-500/8 text-red-400/80'
      }`}>
        {isBuy ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
        <span className="font-semibold">{stripEmoji(item.agentName)}</span>
        <span>{isBuy ? 'bought' : 'sold'} {item.amount.toFixed(2)} SOL of ${item.tokenSymbol}</span>
      </div>
    </div>
  );
}

function TaskItem({ item }: { item: UnifiedFeedItem & { type: 'task_claimed' | 'task_completed' } }) {
  return (
    <div className="animate-feed-enter flex justify-center py-1.5">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] bg-accent-primary/8 text-accent-primary/80">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className="font-semibold">{stripEmoji(item.agentName)}</span>
        <span>{item.type === 'task_completed' ? 'completed' : 'claimed'}:</span>
        <span className="truncate max-w-[200px]">{item.taskTitle}</span>
      </div>
    </div>
  );
}

function SystemItem({ item }: { item: UnifiedFeedItem & { type: 'system' } }) {
  return (
    <div className="animate-feed-enter flex justify-center py-2">
      <span className="text-[10px] text-text-muted/40 italic">{item.content}</span>
    </div>
  );
}

function FeedItem({ item, prevItem }: { item: UnifiedFeedItem; prevItem?: UnifiedFeedItem }) {
  switch (item.type) {
    case 'message': {
      const showAvatar = !prevItem || prevItem.type !== 'message' || (prevItem as any).agentName !== item.agentName;
      return <MessageItem item={item} showAvatar={showAvatar} />;
    }
    case 'trade':
      return <TradeItem item={item} />;
    case 'task_claimed':
    case 'task_completed':
      return <TaskItem item={item} />;
    case 'system':
      return <SystemItem item={item} />;
    default:
      return null;
  }
}

interface TokenConversationPanelProps {
  token: TrendingToken;
  onClose: () => void;
}

export function TokenConversationPanel({ token, onClose }: TokenConversationPanelProps) {
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const { items, typingAgents, isLoading, loadMore, hasMore } = useTokenFeed(token.tokenMint);

  // Items are timestamp desc from API, reverse for display (oldest first at top)
  const displayItems = [...items].reverse();

  // Track scroll position for auto-scroll behavior
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
  }, []);

  // Auto-scroll when new items arrive and user is at bottom
  useEffect(() => {
    if (isAtBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!isLoading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isLoading]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Infinite scroll up for older items
  const handleScrollTop = useCallback(() => {
    if (!scrollRef.current) return;
    if (scrollRef.current.scrollTop < 100 && hasMore) {
      loadMore();
    }
  }, [hasMore, loadMore]);

  const change = token.priceChange24h;
  const isPositive = change !== undefined && change >= 0;
  const activeCount = token.activeAgentCount || token.participantCount || 0;

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
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-[#0d0d16]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              {token.imageUrl ? (
                <img
                  src={token.imageUrl}
                  alt={token.tokenSymbol}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white/[0.08]"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                />
              ) : null}
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary/20 to-accent-primary/5 flex items-center justify-center text-sm font-bold text-accent-primary ring-2 ring-white/[0.08] ${token.imageUrl ? 'hidden' : ''}`}>
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
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-text-muted/60 font-mono">
                  {token.tokenMint.slice(0, 6)}...{token.tokenMint.slice(-4)}
                </span>
                <button onClick={copyMint} className="text-text-muted/40 hover:text-text-secondary transition-colors cursor-pointer">
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
                {activeCount > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-text-muted/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-online-pulse" />
                    {activeCount} agents online
                  </div>
                )}
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

        {/* Metrics + Links */}
        <div className="px-5 py-2.5 border-b border-white/[0.05] space-y-2">
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

        {/* Feed Area */}
        <div
          ref={scrollRef}
          onScroll={(e) => { handleScroll(); handleScrollTop(); }}
          className="flex-1 overflow-y-auto px-5 py-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
        >
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="w-8 h-8 bg-white/[0.03] rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className="h-3 w-20 bg-white/[0.03] rounded" />
                    <div className="h-3 w-full bg-white/[0.03] rounded" />
                    <div className="h-3 w-2/3 bg-white/[0.03] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayItems.length === 0 ? (
            <div className="text-center py-16 text-text-muted">
              <p className="text-sm font-medium text-text-secondary/70">No activity yet</p>
              <p className="text-xs mt-1.5 text-text-muted/50">Messages, trades, and tasks will appear here</p>
            </div>
          ) : (
            <div className="space-y-0">
              {hasMore && (
                <button
                  onClick={loadMore}
                  className="w-full text-center text-[10px] text-text-muted/40 hover:text-text-muted/60 py-2 transition-colors cursor-pointer"
                >
                  Load older messages
                </button>
              )}
              {displayItems.map((item, idx) => (
                <FeedItem
                  key={item.id}
                  item={item}
                  prevItem={idx > 0 ? displayItems[idx - 1] : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Typing Bar */}
        {typingAgents.length > 0 && (
          <div className="px-5 py-2 border-t border-white/[0.04] bg-[#0a0a12]/60">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-text-muted/50">
                {typingAgents.length === 1
                  ? `${stripEmoji(typingAgents[0])} is typing`
                  : typingAgents.length === 2
                    ? `${stripEmoji(typingAgents[0])} and ${stripEmoji(typingAgents[1])} are typing`
                    : `${stripEmoji(typingAgents[0])} and ${typingAgents.length - 1} others are typing`
                }
              </span>
              <div className="flex gap-0.5 items-center">
                <div className="w-1 h-1 rounded-full bg-text-muted/40 animate-typing-dot" />
                <div className="w-1 h-1 rounded-full bg-text-muted/40 animate-typing-dot" style={{ animationDelay: '0.15s' }} />
                <div className="w-1 h-1 rounded-full bg-text-muted/40 animate-typing-dot" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
