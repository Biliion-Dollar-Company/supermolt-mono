'use client';

import { TrendingUp, TrendingDown, ChevronRight, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import type { TrendingToken, UnifiedFeedItem } from '@/lib/types';

function formatCompact(n?: number): string {
  if (!n) return '-';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function getAgentColor(name: string): string {
  const colors = [
    'text-blue-400', 'text-purple-400', 'text-emerald-400',
    'text-amber-400', 'text-pink-400', 'text-cyan-400', 'text-rose-400',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function extractEmoji(name: string): string {
  const match = name.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
  return match?.[0] || name.charAt(0);
}

function stripEmoji(name: string): string {
  return name.replace(/^\p{Emoji_Presentation}\s*|\p{Emoji}\uFE0F?\s*/u, '');
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function FeedItemPreview({ item }: { item: UnifiedFeedItem }) {
  switch (item.type) {
    case 'message':
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-white/[0.06] flex items-center justify-center text-[8px]">
            {extractEmoji(item.agentName)}
          </span>
          <span className={`text-[10px] font-semibold flex-shrink-0 ${getAgentColor(item.agentName)}`}>
            {stripEmoji(item.agentName).split(' ')[0]}:
          </span>
          <span className="text-[10px] text-text-secondary/70 truncate">
            {item.content}
          </span>
        </div>
      );
    case 'trade':
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          {item.side === 'BUY' ? (
            <ArrowUpRight className="w-3 h-3 text-green-400 flex-shrink-0" />
          ) : (
            <ArrowDownRight className="w-3 h-3 text-red-400 flex-shrink-0" />
          )}
          <span className={`text-[10px] font-semibold flex-shrink-0 ${getAgentColor(item.agentName)}`}>
            {stripEmoji(item.agentName).split(' ')[0]}
          </span>
          <span className={`text-[10px] ${item.side === 'BUY' ? 'text-green-400/80' : 'text-red-400/80'}`}>
            {item.side === 'BUY' ? 'bought' : 'sold'} {item.amount.toFixed(2)} SOL
          </span>
        </div>
      );
    case 'task_claimed':
    case 'task_completed':
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <CheckCircle2 className="w-3 h-3 text-accent-primary/70 flex-shrink-0" />
          <span className={`text-[10px] font-semibold flex-shrink-0 ${getAgentColor(item.agentName)}`}>
            {stripEmoji(item.agentName).split(' ')[0]}
          </span>
          <span className="text-[10px] text-text-muted/60 truncate">
            {item.type === 'task_completed' ? 'completed' : 'claimed'} &ldquo;{item.taskTitle}&rdquo;
          </span>
        </div>
      );
    case 'system':
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-text-muted/50 italic truncate">{item.content}</span>
        </div>
      );
    default:
      return null;
  }
}

interface TokenConversationCardProps {
  token: TrendingToken;
  onClick: () => void;
  isNew?: boolean;
}

export function TokenConversationCard({ token, onClick, isNew }: TokenConversationCardProps) {
  const change = token.priceChange24h;
  const isPositive = change !== undefined && change >= 0;

  // Use feedPreview if available, fall back to latestMessages
  const feedItems: UnifiedFeedItem[] = token.feedPreview && token.feedPreview.length > 0
    ? token.feedPreview
    : (token.latestMessages || []).map((msg, i) => ({
        id: `msg-preview-${i}`,
        timestamp: msg.timestamp,
        tokenMint: token.tokenMint,
        type: 'message' as const,
        agentId: '',
        agentName: msg.agentName,
        content: msg.content,
      }));

  const hasActivity = feedItems.length > 0 || token.messageCount > 0;
  const activeCount = token.activeAgentCount || token.participantCount || 0;
  const typingAgents = token.typingAgents || [];

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left overflow-hidden transition-all duration-300 cursor-pointer group relative
        bg-white/[0.02] backdrop-blur-xl
        shadow-[0_2px_16px_rgba(0,0,0,0.5)]
        hover:bg-white/[0.04] hover:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_24px_rgba(232,180,94,0.06)]
        ${isNew ? 'animate-card-pulse' : ''}
      `}
    >
      {/* Corner brackets */}
      <span className="absolute top-0 left-0 w-5 h-5 border-t border-l border-accent-primary/30 group-hover:border-accent-primary/60 transition-colors duration-300" />
      <span className="absolute top-0 right-0 w-5 h-5 border-t border-r border-accent-primary/30 group-hover:border-accent-primary/60 transition-colors duration-300" />
      <span className="absolute bottom-0 left-0 w-5 h-5 border-b border-l border-accent-primary/30 group-hover:border-accent-primary/60 transition-colors duration-300" />
      <span className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-accent-primary/30 group-hover:border-accent-primary/60 transition-colors duration-300" />
      <span className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <span className="absolute bottom-0 left-5 right-5 h-px bg-white/[0.04] group-hover:bg-white/[0.06] transition-colors" />
      <span className="absolute left-0 top-5 bottom-5 w-px bg-white/[0.04] group-hover:bg-white/[0.06] transition-colors" />
      <span className="absolute right-0 top-5 bottom-5 w-px bg-white/[0.04] group-hover:bg-white/[0.06] transition-colors" />

      {/* Header: Token Info + Price + Online Count */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              {token.imageUrl ? (
                <img
                  src={token.imageUrl}
                  alt={token.tokenSymbol}
                  className="w-9 h-9 rounded-full object-cover ring-1 ring-white/[0.08]"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                />
              ) : null}
              <div className={`w-9 h-9 rounded-full bg-gradient-to-br from-accent-primary/20 to-accent-primary/5 flex items-center justify-center text-xs font-bold text-accent-primary ring-1 ring-white/[0.08] ${token.imageUrl ? 'hidden' : ''}`}>
                {token.tokenSymbol?.charAt(0) || '?'}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold font-mono text-text-primary tracking-wide">
                  ${token.tokenSymbol}
                </span>
                {token.chain && (
                  <span className="text-[8px] text-text-muted/60 uppercase bg-white/[0.04] px-1 py-px rounded font-medium">
                    {token.chain}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-muted/70">
                {token.marketCap ? (
                  <span className="flex items-center gap-0.5">
                    <span className="text-text-muted/40">MC</span>
                    <span className="text-text-secondary/80 font-medium">{formatCompact(token.marketCap)}</span>
                  </span>
                ) : null}
                {token.volume24h ? (
                  <span className="flex items-center gap-0.5">
                    <span className="text-text-muted/40">Vol</span>
                    <span className="text-text-secondary/80 font-medium">{formatCompact(token.volume24h)}</span>
                  </span>
                ) : null}
                {token.liquidity ? (
                  <span className="flex items-center gap-0.5">
                    <span className="text-text-muted/40">Liq</span>
                    <span className="text-text-secondary/80 font-medium">{formatCompact(token.liquidity)}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {change !== undefined && (
              <div className={`flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-1 rounded-lg ${
                isPositive ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
              }`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositive ? '+' : ''}{change.toFixed(1)}%
              </div>
            )}
            {activeCount > 0 && (
              <div className="flex items-center gap-1 text-[9px] text-text-muted/50">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-online-pulse" />
                {activeCount} online
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feed Preview — last 2-3 items */}
      {hasActivity ? (
        <div className="px-3 pb-2">
          <div className="bg-white/[0.015] shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] rounded-md px-2.5 py-2 space-y-1.5">
            {feedItems.slice(0, 3).map((item, i) => (
              <FeedItemPreview key={item.id || i} item={item} />
            ))}
            {feedItems.length === 0 && token.lastMessage && (
              <p className="text-[10px] text-text-secondary/60 truncate">{token.lastMessage}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-text-muted/50 italic">Agents analyzing...</p>
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-accent-primary/30 animate-pulse" />
              <div className="w-1 h-1 rounded-full bg-accent-primary/30 animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="w-1 h-1 rounded-full bg-accent-primary/30 animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Footer: Typing indicator or timestamp */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {typingAgents.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-accent-primary/70 truncate">
                {typingAgents.length === 1
                  ? `${stripEmoji(typingAgents[0])} typing`
                  : `${stripEmoji(typingAgents[0])}, ${stripEmoji(typingAgents[1])}${typingAgents.length > 2 ? ` +${typingAgents.length - 2}` : ''} typing`
                }
              </span>
              <div className="flex gap-0.5 items-center">
                <div className="w-1 h-1 rounded-full bg-accent-primary/60 animate-typing-dot" />
                <div className="w-1 h-1 rounded-full bg-accent-primary/60 animate-typing-dot" style={{ animationDelay: '0.15s' }} />
                <div className="w-1 h-1 rounded-full bg-accent-primary/60 animate-typing-dot" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          ) : token.lastMessageAt ? (
            <span className="text-[9px] text-text-muted/30 font-mono">{timeAgo(token.lastMessageAt)}</span>
          ) : null}
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-text-muted/30 group-hover:text-accent-primary/50 transition-colors flex-shrink-0" />
      </div>
    </button>
  );
}
