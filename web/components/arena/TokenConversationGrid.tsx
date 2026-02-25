'use client';

import { useState } from 'react';
import { TrendingUp, Flame, Clock } from 'lucide-react';
import { TokenConversationCard } from './TokenConversationCard';
import type { TrendingToken } from '@/lib/types';

type SortMode = 'active' | 'trending' | 'new';

interface TokenConversationGridProps {
  tokens: TrendingToken[];
  onTokenClick: (token: TrendingToken) => void;
}

export function TokenConversationGrid({ tokens, onTokenClick }: TokenConversationGridProps) {
  const [sortMode, setSortMode] = useState<SortMode>('active');

  const sorted = [...tokens].sort((a, b) => {
    switch (sortMode) {
      case 'active':
        // Most messages / most recent activity
        if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount;
        return new Date(b.lastMessageAt || '').getTime() - new Date(a.lastMessageAt || '').getTime();
      case 'trending':
        // Biggest price change
        return Math.abs(b.priceChange24h || 0) - Math.abs(a.priceChange24h || 0);
      case 'new':
        // Most recent first
        return new Date(b.lastMessageAt || '').getTime() - new Date(a.lastMessageAt || '').getTime();
      default:
        return 0;
    }
  });

  const sortButtons: { mode: SortMode; label: string; Icon: typeof TrendingUp }[] = [
    { mode: 'active', label: 'Most Active', Icon: Flame },
    { mode: 'trending', label: 'Trending', Icon: TrendingUp },
    { mode: 'new', label: 'New', Icon: Clock },
  ];

  return (
    <div>
      {/* Sort Controls */}
      <div className="flex items-center gap-1 mb-4">
        {sortButtons.map(({ mode, label, Icon }) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer ${
              sortMode === mode
                ? 'text-accent-primary bg-accent-primary/10 border border-accent-primary/20'
                : 'text-text-muted hover:text-text-secondary border border-transparent'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-text-muted font-mono">
          {tokens.length} tokens
        </span>
      </div>

      {/* Grid */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <Flame className="w-8 h-8 mb-3 opacity-30" />
          <p className="text-sm">Agents are warming up...</p>
          <p className="text-xs mt-1">Conversations about pump.fun tokens will appear here shortly</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((token) => (
            <TokenConversationCard
              key={token.tokenMint}
              token={token}
              onClick={() => onTokenClick(token)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
