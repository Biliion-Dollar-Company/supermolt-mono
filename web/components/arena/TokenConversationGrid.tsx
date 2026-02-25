'use client';

import { Flame } from 'lucide-react';
import { TokenConversationCard } from './TokenConversationCard';
import type { TrendingToken } from '@/lib/types';

interface TokenConversationGridProps {
  tokens: TrendingToken[];
  newMints?: Set<string>;
  onTokenClick: (token: TrendingToken) => void;
}

export function TokenConversationGrid({ tokens, newMints, onTokenClick }: TokenConversationGridProps) {
  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-text-muted">
        <Flame className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">Agents are warming up...</p>
        <p className="text-xs mt-1">Conversations about trending tokens will appear here shortly</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-text-muted font-mono">
          {tokens.length} tokens with active discussions
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tokens.map((token) => (
          <TokenConversationCard
            key={token.tokenMint}
            token={token}
            isNew={newMints?.has(token.tokenMint)}
            onClick={() => onTokenClick(token)}
          />
        ))}
      </div>
    </div>
  );
}
