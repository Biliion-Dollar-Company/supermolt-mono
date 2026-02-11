'use client';

import { useEffect, useState, useCallback } from 'react';
import { Rocket, ExternalLink, ArrowUpRight, BarChart3 } from 'lucide-react';
import { getBSCMigrations, getBSCMigrationStats } from '@/lib/api';
import { BSCTokenGraduation, BSCMigrationStats } from '@/lib/types';

function PlatformBadge({ platform }: { platform: string | null }) {
  if (platform === 'four.meme') {
    return (
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
        4meme
      </span>
    );
  }
  if (platform === 'flap') {
    return (
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
        Flap
      </span>
    );
  }
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/5 text-text-muted border border-white/10">
      BSC
    </span>
  );
}

function QuoteBadge({ quote }: { quote: string | null }) {
  if (!quote) return null;

  const colors: Record<string, string> = {
    WBNB: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    USDT: 'bg-green-500/10 text-green-400 border-green-500/20',
    USD1: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${colors[quote] || 'bg-white/5 text-text-muted border-white/10'}`}>
      {quote}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function GraduationRow({ token }: { token: BSCTokenGraduation }) {
  const displayName = token.tokenName === 'Unknown' ? token.tokenSymbol : token.tokenName;
  const truncatedName = displayName.length > 20 ? displayName.slice(0, 20) + '...' : displayName;

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-white/[0.02] transition-colors">
      {/* Rocket icon */}
      <Rocket className="w-4 h-4 text-accent-primary flex-shrink-0" />

      {/* Token info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-text-primary truncate">
            {token.tokenSymbol !== 'UNKNOWN' ? token.tokenSymbol : truncatedName}
          </span>
          <PlatformBadge platform={token.platform} />
          <QuoteBadge quote={token.quoteToken} />
        </div>
        {token.tokenSymbol !== 'UNKNOWN' && token.tokenName !== 'Unknown' && (
          <span className="text-xs text-text-muted truncate block">{truncatedName}</span>
        )}
      </div>

      {/* Time */}
      <span className="text-xs text-text-muted flex-shrink-0">
        {token.graduationTime ? timeAgo(token.graduationTime) : ''}
      </span>

      {/* Links */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {token.pancakeSwapUrl && (
          <a
            href={token.pancakeSwapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-accent-primary transition-colors"
            title="Trade on PancakeSwap"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        )}
        <a
          href={token.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:text-text-secondary transition-colors"
          title="View on BSCscan"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

export function GraduationPanel() {
  const [graduations, setGraduations] = useState<BSCTokenGraduation[]>([]);
  const [stats, setStats] = useState<BSCMigrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const platformStats = stats?.byPlatform ?? { 'four.meme': 0, flap: 0 };

  const fetchData = useCallback(async () => {
    try {
      const [migrations, migrationStats] = await Promise.all([
        getBSCMigrations(15),
        getBSCMigrationStats(),
      ]);
      setGraduations(migrations);
      setStats(migrationStats);
    } catch {
      // Silently fail — panel won't show data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
        <div className="h-5 w-44 bg-white/[0.03] animate-pulse rounded mb-3" />
        <div className="flex gap-3 mb-4">
          <div className="h-10 flex-1 bg-white/[0.03] animate-pulse rounded" />
          <div className="h-10 flex-1 bg-white/[0.03] animate-pulse rounded" />
          <div className="h-10 flex-1 bg-white/[0.03] animate-pulse rounded" />
        </div>
        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 px-3">
              <div className="w-4 h-4 bg-white/[0.03] animate-pulse rounded" />
              <div className="h-4 flex-1 bg-white/[0.03] animate-pulse rounded" />
              <div className="h-3 w-10 bg-white/[0.02] animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-accent-primary" />
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            BSC Graduations
          </h3>
        </div>
        {stats && (
          <span className="text-xs text-text-muted">
            {stats.totalGraduated} graduated
          </span>
        )}
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-center">
            <div className="text-lg font-bold font-mono text-text-primary">{stats.totalCreated.toLocaleString()}</div>
            <div className="text-[10px] text-text-muted uppercase">Created</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-center">
            <div className="text-lg font-bold font-mono text-accent-primary">{stats.totalGraduated}</div>
            <div className="text-[10px] text-text-muted uppercase">Graduated</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-center">
            <div className="text-lg font-bold font-mono text-text-primary">{stats.graduationRate}%</div>
            <div className="text-[10px] text-text-muted uppercase">Rate</div>
          </div>
        </div>
      )}

      {/* Platform breakdown */}
      {stats && (platformStats['four.meme'] > 0 || platformStats['flap'] > 0) && (
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/[0.06]">
          <BarChart3 className="w-3 h-3 text-text-muted" />
          <div className="flex items-center gap-2">
            <PlatformBadge platform="four.meme" />
            <span className="text-xs font-mono text-text-muted">{platformStats['four.meme']}</span>
          </div>
          <div className="flex items-center gap-2">
            <PlatformBadge platform="flap" />
            <span className="text-xs font-mono text-text-muted">{platformStats['flap']}</span>
          </div>
        </div>
      )}

      {/* Graduation list */}
      {graduations.length > 0 ? (
        <div className="divide-y divide-white/[0.04] max-h-[300px] overflow-y-auto scrollbar-custom">
          {graduations.map((token) => (
            <GraduationRow key={token.id} token={token} />
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-text-muted text-sm">
          No graduated tokens yet
        </div>
      )}
    </div>
  );
}
