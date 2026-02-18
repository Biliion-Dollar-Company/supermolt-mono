'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Swords, Trophy } from 'lucide-react';
import { ArenaLeaderboard, EpochRewardPanel, MyAgentPanel, XPLeaderboard, TradeRecommendationBanner } from '@/components/arena';
import { useIsMobile } from '@/hooks/useIsMobile';

const RisingLines = dynamic(() => import('@/components/react-bits/rising-lines'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});


export default function ArenaPage() {
  const [leaderboardTab, setLeaderboardTab] = useState<'trades' | 'xp'>('trades');
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-bg-primary pt-18 sm:pt-20 pb-16 px-4 sm:px-[8%] lg:px-[15%] relative">
      {/* Animated background — RisingLines on desktop, solid dark on mobile */}
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
        <div className="absolute bottom-[5%] left-[35%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.03)_0%,transparent_70%)]" />
      </div>
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
          <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-accent-primary" />
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Arena</h1>
        </div>

        {/* My Agent Panel — XP, stats, onboarding */}
        <div className="mb-6 animate-arena-reveal" style={{ animationDelay: '0ms' }}>
          <MyAgentPanel />
        </div>

        {/* Trade Recommendation Banner */}
        <TradeRecommendationBanner />

        {/* Leaderboard + Epoch */}
        <div className="animate-arena-reveal" style={{ animationDelay: '60ms' }}>
          <div className="grid grid-cols-1 lg:grid-cols-[350px_auto_1fr] gap-6">
            <div className="space-y-6">
              <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-text-primary" />
                    <div className="text-base font-bold text-text-primary uppercase tracking-wider">Leaderboard</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setLeaderboardTab('trades')}
                      className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer ${
                        leaderboardTab === 'trades'
                          ? 'text-accent-primary bg-accent-primary/10 border border-accent-primary/20'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      Trades
                    </button>
                    <button
                      onClick={() => setLeaderboardTab('xp')}
                      className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer ${
                        leaderboardTab === 'xp'
                          ? 'text-accent-primary bg-accent-primary/10 border border-accent-primary/20'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      XP
                    </button>
                  </div>
                </div>
                {leaderboardTab === 'trades' ? <ArenaLeaderboard /> : <XPLeaderboard />}
              </div>
            </div>

            <div className="hidden lg:flex justify-center">
              <div className="w-px h-full bg-gradient-to-b from-transparent via-accent-primary/30 to-transparent" />
            </div>

            <div className="min-w-0 space-y-6">
              <EpochRewardPanel />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

