'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Swords, Wifi, WifiOff, MessageSquare } from 'lucide-react';
import { getTrendingTokens } from '@/lib/api';
import type { TrendingToken } from '@/lib/types';
import { TokenConversationGrid, TokenConversationPanel } from '@/components/arena';
import { useIsMobile } from '@/hooks/useIsMobile';

const RisingLines = dynamic(() => import('@/components/react-bits/rising-lines'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-white/[0.03] animate-pulse rounded ${className}`} />;
}

function ArenaPageSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <SkeletonBlock className="h-7 w-24" />
        <SkeletonBlock className="h-7 w-20" />
        <SkeletonBlock className="h-7 w-14" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-[#12121a]/60 border border-white/[0.08] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SkeletonBlock className="w-8 h-8 rounded-full" />
                <SkeletonBlock className="h-4 w-16" />
              </div>
              <SkeletonBlock className="h-5 w-14" />
            </div>
            <div className="flex gap-3 mb-3">
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-3 w-12" />
            </div>
            <div className="border-t border-white/[0.04] pt-3 mt-2">
              <SkeletonBlock className="h-3 w-full mb-2" />
              <SkeletonBlock className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ArenaPage() {
  const isMobile = useIsMobile();
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(true);
  const [selectedToken, setSelectedToken] = useState<TrendingToken | null>(null);
  const initialLoadDone = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await getTrendingTokens();
      setTokens(data);
      setLastRefresh(new Date());
      setIsLive(true);
    } catch {
      setIsLive(false);
    } finally {
      setLoading(false);
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setTimeout(() => setReady(true), 150);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const tokensWithConvos = tokens.filter(t => t.messageCount > 0).length;

  return (
    <div className="min-h-screen bg-bg-primary pt-18 sm:pt-20 pb-16 px-4 sm:px-[6%] lg:px-[10%] relative">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.60) 15%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.95) 100%)',
          }}
        />
        {!isMobile && (
          <div className="absolute inset-0 opacity-40">
            <RisingLines
              color="#E8B45E"
              horizonColor="#E8B45E"
              haloColor="#F5D78E"
              riseSpeed={0.05}
              riseScale={8.0}
              riseIntensity={1.0}
              flowSpeed={0.1}
              flowDensity={3.5}
              flowIntensity={0.5}
              horizonIntensity={0.7}
              haloIntensity={5.0}
              horizonHeight={-0.85}
              circleScale={-0.5}
              scale={6.5}
              brightness={0.9}
            />
          </div>
        )}
      </div>

      {/* Gradient orbs */}
      <div className="fixed inset-0 z-[1] overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[15%] w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.05)_0%,transparent_70%)]" />
        <div className="absolute top-[45%] right-[10%] w-[550px] h-[550px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.04)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-accent-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Arena</h1>
            {tokensWithConvos > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 ml-2 text-xs text-text-muted bg-white/[0.04] px-2.5 py-1 rounded-full">
                <MessageSquare className="w-3 h-3" />
                {tokensWithConvos} active
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs text-text-muted hidden sm:inline" suppressHydrationWarning>
              {lastRefresh.toLocaleTimeString()}
            </span>
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
              isLive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {isLive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isLive ? 'Live' : 'Offline'}
            </div>
          </div>
        </div>

        {/* Content */}
        {!ready ? (
          <ArenaPageSkeleton />
        ) : (
          <div className="animate-arena-reveal">
            <TokenConversationGrid
              tokens={tokens}
              onTokenClick={(token) => setSelectedToken(token)}
            />
          </div>
        )}
      </div>

      {/* Slide-over Panel */}
      {selectedToken && (
        <TokenConversationPanel
          token={selectedToken}
          onClose={() => setSelectedToken(null)}
        />
      )}
    </div>
  );
}
