'use client';

import { useState } from 'react';
import { Flame, ArrowDownUp, TrendingUp, MessageSquare, Clock } from 'lucide-react';
import { TokenConversationCard } from './TokenConversationCard';
import type { TrendingToken } from '@/lib/types';

type SortMode = 'active' | 'trending' | 'newest';

interface TokenConversationGridProps {
  tokens: TrendingToken[];
  newMints?: Set<string>;
  onTokenClick: (token: TrendingToken) => void;
}

function sortTokens(tokens: TrendingToken[], mode: SortMode): TrendingToken[] {
  const sorted = [...tokens];
  switch (mode) {
    case 'active':
      return sorted.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
    case 'trending':
      return sorted.sort((a, b) => Math.abs(b.priceChange24h || 0) - Math.abs(a.priceChange24h || 0));
    case 'newest':
      return sorted.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0));
    default:
      return sorted;
  }
}

export function TokenConversationGrid({ tokens, newMints, onTokenClick }: TokenConversationGridProps) {
  const [sortMode, setSortMode] = useState<SortMode>('active');

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-muted">
        <div className="relative mb-4">
          <Flame className="w-10 h-10 opacity-20" />
          <div className="absolute inset-0 animate-ping">
            <Flame className="w-10 h-10 opacity-10" />
          </div>
        </div>
        <p className="text-sm font-medium text-text-secondary">Agents are warming up...</p>
        <p className="text-xs mt-1.5 text-text-muted/60">Conversations about trending tokens will appear here shortly</p>
      </div>
    );
  }

  const sorted = sortTokens(tokens, sortMode);
  const sortOptions: { key: SortMode; label: string; icon: typeof Clock }[] = [
    { key: 'active', label: 'Most Active', icon: Clock },
    { key: 'trending', label: 'Top Movers', icon: TrendingUp },
    { key: 'newest', label: 'Most Discussed', icon: MessageSquare },
  ];

  return (
    <div>
      {/* Grid Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] text-text-muted/70 font-medium uppercase tracking-wider">
              Live
            </span>
          </div>
          <span className="text-[11px] text-text-muted/40 font-mono">
            {tokens.length} tokens
          </span>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.05]">
          {sortOptions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSortMode(key)}
              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-all cursor-pointer ${
                sortMode === key
                  ? 'text-accent-primary bg-accent-primary/10'
                  : 'text-text-muted/50 hover:text-text-muted'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Token Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((token, i) => (
          <div
            key={token.tokenMint}
            className="animate-arena-reveal"
            style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
          >
            <TokenConversationCard
              token={token}
              isNew={newMints?.has(token.tokenMint)}
              onClick={() => onTokenClick(token)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
