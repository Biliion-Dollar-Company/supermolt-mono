'use client';

import { MessageSquare, Users, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import type { TrendingToken } from '@/lib/types';

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

function formatCompact(n?: number): string {
  if (!n) return '-';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

interface TokenConversationCardProps {
  token: TrendingToken;
  onClick: () => void;
  isNew?: boolean;
}

export function TokenConversationCard({ token, onClick, isNew }: TokenConversationCardProps) {
  const change = token.priceChange24h;
  const isPositive = change !== undefined && change >= 0;
  const hasConversation = token.messageCount > 0;

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left bg-[#12121a]/60 backdrop-blur-xl border transition-all duration-200 cursor-pointer group
        hover:bg-[#16161f]/80 hover:border-accent-primary/20 hover:shadow-[0_0_24px_rgba(232,180,94,0.05)]
        ${isNew ? 'animate-card-pulse border-accent-primary/30' : 'border-white/[0.08]'}
      `}
    >
      {/* Header: Symbol + Price Change */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Token icon placeholder */}
            <div className="w-8 h-8 rounded-full bg-accent-primary/10 flex items-center justify-center text-xs font-bold text-accent-primary">
              {token.tokenSymbol?.charAt(0) || '?'}
            </div>
            <div>
              <span className="text-sm font-bold font-mono text-text-primary">
                ${token.tokenSymbol}
              </span>
              {token.chain && (
                <span className="ml-1.5 text-[9px] text-text-muted uppercase bg-white/[0.04] px-1 py-0.5 rounded">
                  {token.chain}
                </span>
              )}
            </div>
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-mono font-semibold px-2 py-1 rounded ${
              isPositive ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
            }`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isPositive ? '+' : ''}{change.toFixed(1)}%
            </div>
          )}
        </div>

        {/* Compact Metrics */}
        <div className="flex items-center gap-3 text-[10px] text-text-muted">
          {token.marketCap && (
            <span>MCap {formatCompact(token.marketCap)}</span>
          )}
          {token.volume24h && (
            <span>Vol {formatCompact(token.volume24h)}</span>
          )}
          {token.liquidity && (
            <span>Liq {formatCompact(token.liquidity)}</span>
          )}
        </div>
      </div>

      {/* Conversation Preview */}
      {hasConversation ? (
        <div className="px-4 pb-3 pt-2 border-t border-white/[0.04] mt-2">
          {token.lastMessage && (
            <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-2">
              {token.lastMessage}
            </p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] text-text-muted">
                <Users className="w-3 h-3" />
                {token.participantCount}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-text-muted">
                <MessageSquare className="w-3 h-3" />
                {token.messageCount}
              </span>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <Clock className="w-3 h-3" />
              {timeAgo(token.lastMessageAt)}
            </span>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3 pt-2 border-t border-white/[0.04] mt-2">
          <p className="text-[10px] text-text-muted italic">No agent discussions yet</p>
        </div>
      )}
    </button>
  );
}
