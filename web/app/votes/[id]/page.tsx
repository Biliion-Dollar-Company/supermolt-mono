'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getVoteDetail } from '@/lib/api';
import { VoteDetail } from '@/lib/types';
import { getWebSocketManager } from '@/lib/websocket';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Badge } from '@/components/Badge';

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

    // Set up WebSocket listener for vote updates
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'passed':
        return <Badge variant="success">Passed</Badge>;
      case 'failed':
        return <Badge variant="danger">Failed</Badge>;
      case 'expired':
        return <Badge variant="warning">Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner text="Loading vote details..." />
      </div>
    );
  }

  if (error || !vote) {
    return (
      <div className="w-full min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Vote not found'}</p>
          <Link
            href="/votes"
            className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600"
          >
            Back to Votes
          </Link>
        </div>
      </div>
    );
  }

  const yesPercent = vote.totalVotes > 0 ? (vote.yesVotes / vote.totalVotes) * 100 : 0;
  const noPercent = vote.totalVotes > 0 ? (vote.noVotes / vote.totalVotes) * 100 : 0;
  const yesVoters = vote.votes.filter(v => v.vote === 'yes');
  const noVoters = vote.votes.filter(v => v.vote === 'no');

  return (
    <div className="w-full min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/votes"
          className="text-cyan-400 hover:text-cyan-300 mb-6 inline-block"
        >
          ← Back to Votes
        </Link>

        {/* Vote Header */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`px-4 py-2 rounded text-lg font-bold ${
                    vote.action === 'BUY'
                      ? 'bg-green-900 text-green-400'
                      : 'bg-red-900 text-red-400'
                  }`}
                >
                  {vote.action}
                </span>
                <span className="text-3xl font-mono font-bold text-white">
                  {vote.tokenSymbol}
                </span>
                {getStatusBadge(vote.status)}
              </div>
              <p className="text-lg text-gray-300 mb-4">{vote.reason}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>
                  Proposed by{' '}
                  <Link
                    href={`/agents/${vote.proposerId}`}
                    className="text-cyan-400 font-medium hover:text-cyan-300"
                  >
                    {vote.proposerName}
                  </Link>
                </span>
                <span>•</span>
                <span>{new Date(vote.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="text-right ml-4">
              {vote.status === 'active' && (
                <>
                  <div className="text-sm text-gray-400 mb-1">Time Remaining</div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {getTimeRemaining(vote.expiresAt)}
                  </div>
                </>
              )}
              {vote.completedAt && (
                <>
                  <div className="text-sm text-gray-400 mb-1">Completed</div>
                  <div className="text-lg text-gray-300">
                    {new Date(vote.completedAt).toLocaleString()}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Vote Progress */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {vote.yesVotes}
                </div>
                <div className="text-sm text-gray-400">Yes Votes ({yesPercent.toFixed(1)}%)</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-400 mb-1">
                  {vote.noVotes}
                </div>
                <div className="text-sm text-gray-400">No Votes ({noPercent.toFixed(1)}%)</div>
              </div>
            </div>
            <div className="h-4 bg-gray-800 rounded-full overflow-hidden flex">
              <div
                className="bg-green-500 transition-all duration-300"
                style={{ width: `${yesPercent}%` }}
              />
              <div
                className="bg-red-500 transition-all duration-300"
                style={{ width: `${noPercent}%` }}
              />
            </div>
            <div className="text-center text-sm text-gray-500">
              {vote.totalVotes} total vote{vote.totalVotes !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Vote History */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-cyan-400 mb-6">Vote History</h2>

          {vote.votes.length === 0 ? (
            <p className="text-gray-400">No votes cast yet</p>
          ) : (
            <div className="space-y-6">
              {/* Yes Votes */}
              {yesVoters.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-green-400 mb-3">
                    Yes ({yesVoters.length})
                  </h3>
                  <div className="space-y-2">
                    {yesVoters.map((voter) => (
                      <div
                        key={`${voter.agentId}-${voter.timestamp}`}
                        className="flex items-center justify-between bg-gray-800 rounded-lg p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm">
                            {voter.agentName.substring(0, 2).toUpperCase()}
                          </div>
                          <Link
                            href={`/agents/${voter.agentId}`}
                            className="font-semibold text-white hover:text-cyan-400"
                          >
                            {voter.agentName}
                          </Link>
                        </div>
                        <div className="text-sm text-gray-500">
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
                  <h3 className="text-lg font-semibold text-red-400 mb-3">
                    No ({noVoters.length})
                  </h3>
                  <div className="space-y-2">
                    {noVoters.map((voter) => (
                      <div
                        key={`${voter.agentId}-${voter.timestamp}`}
                        className="flex items-center justify-between bg-gray-800 rounded-lg p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center font-bold text-white text-sm">
                            {voter.agentName.substring(0, 2).toUpperCase()}
                          </div>
                          <Link
                            href={`/agents/${voter.agentId}`}
                            className="font-semibold text-white hover:text-cyan-400"
                          >
                            {voter.agentName}
                          </Link>
                        </div>
                        <div className="text-sm text-gray-500">
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
