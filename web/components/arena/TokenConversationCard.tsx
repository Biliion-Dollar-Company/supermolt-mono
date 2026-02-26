'use client';

import { MessageSquare, Users, TrendingUp, TrendingDown, Clock, ChevronRight } from 'lucide-react';
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

function formatPrice(n?: number): string {
  if (!n) return '';
  if (n < 0.0001) return `$${n.toPrecision(2)}`;
  if (n < 0.01) return `$${n.toPrecision(3)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

// Deterministic color from agent name
function getAgentAccent(name: string): string {
  const accents = [
    'from-blue-500/20 to-blue-600/5',
    'from-purple-500/20 to-purple-600/5',
    'from-emerald-500/20 to-emerald-600/5',
    'from-amber-500/20 to-amber-600/5',
    'from-pink-500/20 to-pink-600/5',
    'from-cyan-500/20 to-cyan-600/5',
    'from-rose-500/20 to-rose-600/5',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return accents[Math.abs(hash) % accents.length];
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
        w-full text-left overflow-hidden transition-all duration-300 cursor-pointer group relative
        bg-[#0e0e18]/90 backdrop-blur-xl
        hover:bg-[#12121c] hover:shadow-[0_4px_32px_rgba(232,180,94,0.06)]
        ${isNew ? 'animate-card-pulse' : ''}
      `}
    >
      {/* Corner brackets — branded border style */}
      <span className="absolute top-0 left-0 w-5 h-5 border-t border-l border-accent-primary/30 group-hover:border-accent-primary/60 transition-colors duration-300" />
      <span className="absolute top-0 right-0 w-5 h-5 border-t border-r border-accent-primary/30 group-hover:border-accent-primary/60 transition-colors duration-300" />
      <span className="absolute bottom-0 left-0 w-5 h-5 border-b border-l border-accent-primary/30 group-hover:border-accent-primary/60 transition-colors duration-300" />
      <span className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-accent-primary/30 group-hover:border-accent-primary/60 transition-colors duration-300" />
      {/* Edge lines between corners */}
      <span className="absolute top-0 left-5 right-5 h-px bg-white/[0.04] group-hover:bg-white/[0.06] transition-colors" />
      <span className="absolute bottom-0 left-5 right-5 h-px bg-white/[0.04] group-hover:bg-white/[0.06] transition-colors" />
      <span className="absolute left-0 top-5 bottom-5 w-px bg-white/[0.04] group-hover:bg-white/[0.06] transition-colors" />
      <span className="absolute right-0 top-5 bottom-5 w-px bg-white/[0.04] group-hover:bg-white/[0.06] transition-colors" />

      {/* Header: Token Info */}
      <div className="px-4 pt-4 pb-2.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            {/* Token Image */}
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
              {/* Live dot */}
              {hasConversation && token.lastMessageAt && (Date.now() - new Date(token.lastMessageAt).getTime()) < 30 * 60 * 1000 && (
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-[#111118]" />
              )}
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
              {/* Metrics inline under symbol */}
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
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-1 rounded-lg ${
              isPositive ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
            }`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isPositive ? '+' : ''}{change.toFixed(1)}%
            </div>
          )}
        </div>

      </div>

      {/* Conversation Preview */}
      {hasConversation ? (
        <div className="px-4 pb-3.5 pt-2.5 border-t border-white/[0.04]">
          {/* Agent message previews */}
          {token.latestMessages && token.latestMessages.length > 0 ? (
            <div className="space-y-2 mb-2.5">
              {token.latestMessages.slice(0, 2).map((msg, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br ${getAgentAccent(msg.agentName)} flex items-center justify-center text-[9px] font-medium`}>
                    {msg.agentName.match(/^\p{Emoji}/u)?.[0] || msg.agentName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold text-text-primary/80">{msg.agentName.replace(/^\p{Emoji}\s*/u, '')}</span>
                    <p className="text-[10px] text-text-secondary/70 line-clamp-1 leading-snug">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : token.lastMessage ? (
            <p className="text-[11px] text-text-secondary/70 leading-relaxed line-clamp-2 mb-2.5">
              {token.lastMessage}
            </p>
          ) : null}

          {/* Sentiment Bar */}
          {token.sentiment && (token.sentiment.bullish + token.sentiment.bearish) > 0 && (() => {
            const total = token.sentiment.bullish + token.sentiment.bearish + token.sentiment.neutral;
            const bullPct = Math.round((token.sentiment.bullish / total) * 100);
            return (
              <div className="mb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-green-400/80 font-mono font-medium w-6">{bullPct}%</span>
                  <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-green-500/60 rounded-full transition-all duration-700"
                      style={{ width: `${bullPct}%` }}
                    />
                    <div
                      className="h-full bg-red-500/60 rounded-full transition-all duration-700 ml-auto"
                      style={{ width: `${100 - bullPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-red-400/80 font-mono font-medium w-6 text-right">{100 - bullPct}%</span>
                </div>
              </div>
            );
          })()}

          {/* Footer stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] text-text-muted/60">
                <Users className="w-3 h-3" />
                {token.participantCount}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-text-muted/60">
                <MessageSquare className="w-3 h-3" />
                {token.messageCount}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-[10px] text-text-muted/60">
                <Clock className="w-3 h-3" />
                {timeAgo(token.lastMessageAt)}
              </span>
              <ChevronRight className="w-3 h-3 text-text-muted/30 group-hover:text-accent-primary/50 transition-colors" />
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3.5 pt-2.5 border-t border-white/[0.04]">
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
    </button>
  );
}
