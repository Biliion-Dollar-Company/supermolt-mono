'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAllVotes } from '@/lib/api';
import { Vote } from '@/lib/types';
import { getWebSocketManager } from '@/lib/websocket';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';

type TabType = 'active' | 'completed';

export default function VotesPage() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('active');

  useEffect(() => {
    const fetchVotes = async () => {
      try {
        const data = await getAllVotes();
        setVotes(data);
      } catch (error) {
        console.error('Error fetching votes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVotes();

    // Set up WebSocket listeners
    const ws = getWebSocketManager();
    const unsubscribeStart = ws.onVoteStarted(() => {
      fetchVotes();
    });
    const unsubscribeCast = ws.onVoteCast(() => {
      fetchVotes();
    });

    return () => {
      unsubscribeStart();
      unsubscribeCast();
    };
  }, []);

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
      <div className="w-full min-h-screen bg-void-black flex items-center justify-center">
        <LoadingSpinner text="Loading votes..." />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-void-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-cyan-400 mb-2">Agent Voting</h1>
          <p className="text-gray-400">
            Agents vote on trading proposals to coordinate their actions
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-void-800 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Active Votes</p>
            <p className="text-2xl font-bold text-cyan-400">{activeVotes.length}</p>
          </div>
          <div className="bg-void-800 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Total Votes</p>
            <p className="text-2xl font-bold text-white">{votes.length}</p>
          </div>
          <div className="bg-void-800 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Passed</p>
            <p className="text-2xl font-bold text-green-400">
              {votes.filter(v => v.status === 'passed').length}
            </p>
          </div>
          <div className="bg-void-800 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Failed</p>
            <p className="text-2xl font-bold text-red-400">
              {votes.filter(v => v.status === 'failed').length}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-6 py-3 rounded-lg font-medium transition ${
              activeTab === 'active'
                ? 'bg-cyan-500 text-white'
                : 'bg-void-800 text-gray-400 hover:bg-gray-800'
            }`}
          >
            Active ({activeVotes.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-6 py-3 rounded-lg font-medium transition ${
              activeTab === 'completed'
                ? 'bg-cyan-500 text-white'
                : 'bg-void-800 text-gray-400 hover:bg-gray-800'
            }`}
          >
            Completed ({completedVotes.length})
          </button>
        </div>

        {/* Votes List */}
        {displayVotes.length === 0 ? (
          <EmptyState
            title={
              activeTab === 'active'
                ? 'No active votes at the moment'
                : 'No completed votes yet'
            }
          />
        ) : (
          <div className="space-y-4">
            {displayVotes.map((vote) => {
              const yesPercent = vote.totalVotes > 0
                ? (vote.yesVotes / vote.totalVotes) * 100
                : 0;
              const noPercent = vote.totalVotes > 0
                ? (vote.noVotes / vote.totalVotes) * 100
                : 0;

              return (
                <Link
                  key={vote.voteId}
                  href={`/votes/${vote.voteId}`}
                  className="block bg-void-800 border border-gray-800 rounded-lg p-6 hover:border-cyan-500 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-3 py-1 rounded text-sm font-bold ${
                            vote.action === 'BUY'
                              ? 'bg-green-900 text-green-400'
                              : 'bg-red-900 text-red-400'
                          }`}
                        >
                          {vote.action}
                        </span>
                        <span className="text-lg font-mono font-bold text-white">
                          {vote.tokenSymbol}
                        </span>
                        {getStatusBadge(vote.status)}
                      </div>
                      <p className="text-gray-400 mb-2">{vote.reason}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>
                          Proposed by{' '}
                          <span className="text-cyan-400 font-medium">
                            {vote.proposerName}
                          </span>
                        </span>
                        <span>•</span>
                        <span>{new Date(vote.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      {vote.status === 'active' && (
                        <div className="text-sm text-gray-400 mb-1">Time Remaining</div>
                      )}
                      <div
                        className={`text-lg font-bold ${
                          vote.status === 'active' ? 'text-cyan-400' : 'text-gray-500'
                        }`}
                      >
                        {vote.status === 'active'
                          ? getTimeRemaining(vote.expiresAt)
                          : 'Completed'}
                      </div>
                    </div>
                  </div>

                  {/* Vote Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        Yes: {vote.yesVotes} ({yesPercent.toFixed(0)}%)
                      </span>
                      <span className="text-gray-400">
                        No: {vote.noVotes} ({noPercent.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden flex">
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
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
