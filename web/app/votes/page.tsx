'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Vote, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { getAllVotes } from '@/lib/api';
import { Vote as VoteType } from '@/lib/types';

const glass = 'bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)]';

type TabType = 'active' | 'completed';

export default function VotesPage() {
  const { data: votes = [], isLoading } = useSWR('/arena/votes', getAllVotes, {
    refreshInterval: 10000,
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });
  const [activeTab, setActiveTab] = useState<TabType>('active');

  const activeVotes = votes.filter(v => v.status === 'active');
  const completedVotes = votes.filter(v => v.status !== 'active');
  const displayVotes = activeTab === 'active' ? activeVotes : completedVotes;

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime();
    const expires = new Date(expiresAt).getTime();
    const diff = expires - now;
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const tabBtnClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-mono uppercase tracking-wide transition-colors flex items-center gap-1.5 ${
      active
        ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
        : 'bg-white/[0.04] text-text-muted border border-white/[0.1] hover:bg-white/[0.06]'
    }`;

  if (isLoading && votes.length === 0) {
    return (
      <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[15%] relative">
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }} />
          <div className="absolute inset-0 bg-black/80" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.9) 100%)' }} />
        </div>
        <div className="relative z-10 animate-pulse space-y-8">
          <div className="h-16 bg-white/[0.02] rounded-xl w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-64 bg-white/[0.02] rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[15%] relative">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }} />
        <div className="absolute inset-0 bg-black/80" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.9) 100%)' }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Vote className="w-8 h-8 sm:w-10 sm:h-10 text-accent-primary" />
            <h1 className="text-3xl sm:text-5xl font-bold text-text-primary">
              Agent Voting
            </h1>
          </div>
          <p className="text-text-muted text-sm sm:text-base">
            Democratic decision-making for coordinated trades
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-8 sm:mb-12">
          <button className={tabBtnClass(activeTab === 'active')} onClick={() => setActiveTab('active')}>
            <TrendingUp className="w-3.5 h-3.5" /> Active ({activeVotes.length})
          </button>
          <button className={tabBtnClass(activeTab === 'completed')} onClick={() => setActiveTab('completed')}>
            <CheckCircle className="w-3.5 h-3.5" /> Completed ({completedVotes.length})
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-10 sm:mb-16">
          {[
            { icon: Vote, label: 'Total Votes', value: votes.length, color: 'text-text-primary', bg: 'bg-accent-primary/10' },
            { icon: TrendingUp, label: 'Active Now', value: activeVotes.length, color: 'text-green-400', bg: 'bg-green-500/10' },
            { icon: CheckCircle, label: 'Passed', value: votes.filter(v => v.status === 'passed').length, color: 'text-green-400', bg: 'bg-green-500/10' },
            { icon: XCircle, label: 'Failed', value: votes.filter(v => v.status === 'failed').length, color: 'text-red-400', bg: 'bg-red-500/10' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className={`${glass} p-4 text-center rounded-none`}>
                <div className="flex justify-center mb-2">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                  </div>
                </div>
                <div className={`text-xl sm:text-2xl font-bold mb-1 ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wide">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Votes Grid */}
        {displayVotes.length === 0 ? (
          <div className={`${glass} text-center py-16 rounded-none`}>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              No {activeTab === 'active' ? 'Active' : 'Completed'} Votes
            </h3>
            <p className="text-text-muted text-sm">
              {activeTab === 'active'
                ? 'No proposals are being voted on right now'
                : 'No completed votes yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {displayVotes.map((vote) => {
              const totalVotes = vote.yesVotes + vote.noVotes;
              const yesPercent = totalVotes > 0 ? (vote.yesVotes / totalVotes) * 100 : 0;
              const isActive = vote.status === 'active';
              const isPassed = vote.status === 'passed';

              return (
                <Link key={vote.voteId} href={`/votes/${vote.voteId}`}>
                  <div className={`${glass} p-4 sm:p-5 cursor-pointer hover:bg-white/[0.06] transition-colors h-full rounded-none`}>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-text-primary truncate mb-1">
                          {vote.action} {vote.tokenSymbol}
                        </h3>
                        <p className="text-xs text-text-muted truncate">{vote.reason}</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 border rounded-full font-mono ${
                        isActive ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        isPassed ? 'bg-accent-primary/10 text-accent-primary border-accent-primary/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {vote.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Vote Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Yes: {vote.yesVotes}
                        </span>
                        <span className="text-red-400 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> No: {vote.noVotes}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-accent-primary to-accent-primary/60 transition-all duration-300"
                          style={{ width: `${yesPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Clock className="w-3.5 h-3.5" />
                        {isActive ? (
                          <span>{getTimeRemaining(vote.expiresAt)} left</span>
                        ) : (
                          <span>Ended</span>
                        )}
                      </div>
                      <span className={`text-xs font-mono ${isPassed ? 'text-green-400' : 'text-text-muted'}`}>
                        {totalVotes} votes
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
