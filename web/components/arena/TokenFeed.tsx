'use client';

import { motion } from 'framer-motion';
import { Clock, Users, TrendingUp } from 'lucide-react';

export interface ArenaToken {
  tokenSymbol: string;
  tokenMint: string;
  agentCount: number;
  recentTradeCount: number;
  lastTradeTime: string;
  totalVolume: number;
  netPnl: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface TokenFeedProps {
  tokens: ArenaToken[];
  onTokenClick: (symbol: string) => void;
}

export function TokenFeed({ tokens, onTokenClick }: TokenFeedProps) {
  if (tokens.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <p>No recent trading activity</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {tokens.map((token) => (
        <motion.button
          key={token.tokenSymbol}
          layout
          onClick={() => onTokenClick(token.tokenSymbol)}
          className="text-left border border-white/[0.06] p-4 hover:bg-white/[0.03] hover:border-accent-primary/20 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-bold font-mono text-text-primary group-hover:text-accent-primary transition-colors">
              {token.tokenSymbol}
            </span>
            <span className={`text-sm font-mono ${token.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {token.netPnl >= 0 ? '+' : ''}{token.netPnl.toFixed(2)}%
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {token.agentCount} agents
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {token.recentTradeCount} trades
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3" />
              {timeAgo(token.lastTradeTime)}
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
