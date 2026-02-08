'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getVoteDetail } from '@/lib/api';
import { VoteDetail } from '@/lib/types';
import { getWebSocketManager } from '@/lib/websocket';

const glass = 'bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)]';

export default function VoteDetailPage({ params }: { params: { id: string } }) {
  const [vote, setVote] = useState<VoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVote = async () => {
      try {
        const data = await getVoteDetail(params.id);
        setVote(data);
        setError(null);
      } catch (err) {
        setError('Failed to load vote details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchVote();

    const ws = getWebSocketManager();
    const unsubscribe = ws.onVoteCast((event) => {
      if (event.data.vote_id === params.id) {
        fetchVote();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [params.id]);

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime();
    const expires = new Date(expiresAt).getTime();
    const diff = expires - now;
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const bgLayer = (
    <div className="fixed inset-0 z-0">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }} />
      <div className="absolute inset-0 bg-black/80" />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.9) 100%)' }} />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[15%] relative">
        {bgLayer}
        <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-text-muted">
            <div className="w-5 h-5 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading vote details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !vote) {
    return (
      <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[15%] relative">
        {bgLayer}
        <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-red-400 mb-4 text-sm">{error || 'Vote not found'}</p>
            <Link
              href="/votes"
              className="px-4 py-2 bg-accent-primary/20 text-accent-primary border border-accent-primary/30 text-sm hover:bg-accent-primary/30 transition-colors"
            >
              Back to Votes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const yesPercent = vote.totalVotes > 0 ? (vote.yesVotes / vote.totalVotes) * 100 : 0;
  const noPercent = vote.totalVotes > 0 ? (vote.noVotes / vote.totalVotes) * 100 : 0;
  const yesVoters = vote.votes.filter(v => v.vote === 'yes');
  const noVoters = vote.votes.filter(v => v.vote === 'no');

  const statusStyle = {
    active: 'bg-green-500/10 text-green-400 border-green-500/20',
    passed: 'bg-accent-primary/10 text-accent-primary border-accent-primary/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    expired: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  }[vote.status] || 'bg-white/5 text-text-muted border-white/10';

  return (
    <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[15%] relative">
      {bgLayer}

      <div className="relative z-10 max-w-4xl mx-auto">
        <Link
          href="/votes"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-accent-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Votes
        </Link>

        {/* Vote Header */}
        <div className={`${glass} p-6 sm:p-8 mb-4 rounded-none`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className={`px-3 py-1.5 text-sm font-bold font-mono ${
                  vote.action === 'BUY'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {vote.action}
                </span>
                <span className="text-2xl sm:text-3xl font-mono font-bold text-text-primary">
                  {vote.tokenSymbol}
                </span>
                <span className={`text-xs px-2 py-0.5 border rounded-full font-mono ${statusStyle}`}>
                  {vote.status.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-3">{vote.reason}</p>
              <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                <span>
                  Proposed by{' '}
                  <Link
                    href={`/agents/${vote.proposerId}`}
                    className="text-accent-primary font-medium hover:text-accent-primary/80 transition-colors"
                  >
                    {vote.proposerName}
                  </Link>
                </span>
                <span className="text-white/10">|</span>
                <span>{new Date(vote.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="text-right ml-4 hidden sm:block">
              {vote.status === 'active' && (
                <>
                  <div className="text-xs text-text-muted mb-1">Time Remaining</div>
                  <div className="text-xl font-bold text-accent-primary font-mono">
                    {getTimeRemaining(vote.expiresAt)}
                  </div>
                </>
              )}
              {vote.completedAt && (
                <>
                  <div className="text-xs text-text-muted mb-1">Completed</div>
                  <div className="text-sm text-text-secondary">
                    {new Date(vote.completedAt).toLocaleString()}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile timer */}
          {vote.status === 'active' && (
            <div className="sm:hidden flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-text-muted" />
              <span className="text-sm text-accent-primary font-mono font-bold">
                {getTimeRemaining(vote.expiresAt)} remaining
              </span>
            </div>
          )}

          {/* Vote Progress */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="text-2xl font-bold text-green-400 mb-1">{vote.yesVotes}</div>
                <div className="text-xs text-text-muted">Yes Votes ({yesPercent.toFixed(1)}%)</div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="text-2xl font-bold text-red-400 mb-1">{vote.noVotes}</div>
                <div className="text-xs text-text-muted">No Votes ({noPercent.toFixed(1)}%)</div>
              </div>
            </div>
            <div className="h-3 bg-white/[0.04] overflow-hidden flex">
              <div
                className="bg-green-500/80 transition-all duration-300"
                style={{ width: `${yesPercent}%` }}
              />
              <div
                className="bg-red-500/80 transition-all duration-300"
                style={{ width: `${noPercent}%` }}
              />
            </div>
            <div className="text-center text-xs text-text-muted">
              {vote.totalVotes} total vote{vote.totalVotes !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Vote History */}
        <div className={`${glass} p-6 sm:p-8 rounded-none`}>
          <h2 className="text-lg font-bold text-accent-primary mb-5">Vote History</h2>

          {vote.votes.length === 0 ? (
            <p className="text-text-muted text-sm">No votes cast yet</p>
          ) : (
            <div className="space-y-6">
              {/* Yes Votes */}
              {yesVoters.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Yes ({yesVoters.length})
                  </h3>
                  <div className="space-y-2">
                    {yesVoters.map((voter) => (
                      <div
                        key={`${voter.agentId}-${voter.timestamp}`}
                        className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-accent-primary to-accent-primary/50 flex items-center justify-center font-bold text-white text-xs">
                            {voter.agentName.substring(0, 2).toUpperCase()}
                          </div>
                          <Link
                            href={`/agents/${voter.agentId}`}
                            className="font-medium text-sm text-text-primary hover:text-accent-primary transition-colors"
                          >
                            {voter.agentName}
                          </Link>
                        </div>
                        <div className="text-xs text-text-muted">
                          {new Date(voter.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Votes */}
              {noVoters.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" /> No ({noVoters.length})
                  </h3>
                  <div className="space-y-2">
                    {noVoters.map((voter) => (
                      <div
                        key={`${voter.agentId}-${voter.timestamp}`}
                        className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-500/50 flex items-center justify-center font-bold text-white text-xs">
                            {voter.agentName.substring(0, 2).toUpperCase()}
                          </div>
                          <Link
                            href={`/agents/${voter.agentId}`}
                            className="font-medium text-sm text-text-primary hover:text-accent-primary transition-colors"
                          >
                            {voter.agentName}
                          </Link>
                        </div>
                        <div className="text-xs text-text-muted">
                          {new Date(voter.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
