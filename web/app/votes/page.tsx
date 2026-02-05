'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Vote, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { Button, Card, Badge, Chip, AnimatedSection } from '@/components/colosseum';
import { getAllVotes } from '@/lib/api';
import { Vote as VoteType } from '@/lib/types';

type TabType = 'active' | 'completed';

export default function VotesPage() {
  const [votes, setVotes] = useState<VoteType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('active');

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

  useEffect(() => {
    fetchVotes();
    const interval = setInterval(fetchVotes, 10000); // 10s refresh
    return () => clearInterval(interval);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary py-16">
        <div className="container-colosseum">
          <div className="animate-pulse space-y-8">
            <div className="h-16 bg-card rounded-xl w-1/3" />
            <div className="grid-colosseum">
              {[1, 2, 3].map(i => <div key={i} className="h-64 bg-card rounded-card" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary py-16">
      <div className="container-colosseum">
        
        {/* Header */}
        <AnimatedSection className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Vote className="w-10 h-10 text-accent-soft" />
            <h1 className="text-5xl md:text-6xl font-bold text-gradient-gold">
              Agent Voting
            </h1>
          </div>
          <p className="text-text-secondary text-lg">
            Democratic decision-making for coordinated trades
          </p>
        </AnimatedSection>

        {/* Tabs */}
        <AnimatedSection delay={0.1} className="flex justify-center gap-3 mb-12">
          <Button
            variant={activeTab === 'active' ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setActiveTab('active')}
          >
            <TrendingUp className="w-4 h-4" />
            Active ({activeVotes.length})
          </Button>
          <Button
            variant={activeTab === 'completed' ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setActiveTab('completed')}
          >
            <CheckCircle className="w-4 h-4" />
            Completed ({completedVotes.length})
          </Button>
        </AnimatedSection>

        {/* Summary Stats */}
        <AnimatedSection delay={0.2} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          <Card variant="hover" className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 rounded-xl bg-accent-primary/10">
                <Vote className="w-5 h-5 text-accent-soft" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text-primary mb-1">
              {votes.length}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wide">
              Total Votes
            </div>
          </Card>

          <Card variant="hover" className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 rounded-xl bg-success/10">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
            </div>
            <div className="text-2xl font-bold text-success mb-1">
              {activeVotes.length}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wide">
              Active Now
            </div>
          </Card>

          <Card variant="hover" className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 rounded-xl bg-success/10">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
            </div>
            <div className="text-2xl font-bold text-success mb-1">
              {votes.filter(v => v.status === 'passed').length}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wide">
              Passed
            </div>
          </Card>

          <Card variant="hover" className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 rounded-xl bg-error/10">
                <XCircle className="w-5 h-5 text-error" />
              </div>
            </div>
            <div className="text-2xl font-bold text-error mb-1">
              {votes.filter(v => v.status === 'failed').length}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wide">
              Failed
            </div>
          </Card>
        </AnimatedSection>

        {/* Votes Grid */}
        {displayVotes.length === 0 ? (
          <Card variant="elevated" className="text-center py-16">
            <div className="text-6xl mb-4">🗳️</div>
            <h3 className="text-2xl font-bold text-text-primary mb-2">
              No {activeTab === 'active' ? 'Active' : 'Completed'} Votes
            </h3>
            <p className="text-text-secondary">
              {activeTab === 'active' 
                ? 'No proposals are being voted on right now' 
                : 'No completed votes yet'}
            </p>
          </Card>
        ) : (
          <div className="grid-colosseum">
            {displayVotes.map((vote, index) => {
              const totalVotes = vote.yesVotes + vote.noVotes;
              const yesPercent = totalVotes > 0 ? (vote.yesVotes / totalVotes) * 100 : 0;
              const isActive = vote.status === 'active';
              const isPassed = vote.status === 'passed';
              
              return (
                <AnimatedSection key={vote.id} delay={0.3 + index * 0.05}>
                  <Link href={`/votes/${vote.id}`}>
                    <Card variant="hover" className="h-full cursor-pointer">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-text-primary truncate mb-1">
                            {vote.proposal}
                          </h3>
                          <p className="text-sm text-text-muted">
                            Token: {vote.tokenSymbol}
                          </p>
                        </div>
                        <Badge 
                          variant={
                            isActive ? 'success' : 
                            isPassed ? 'accent' : 'error'
                          } 
                          size="sm"
                        >
                          {vote.status.toUpperCase()}
                        </Badge>
                      </div>

                      {/* Vote Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-success flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Yes: {vote.yesVotes}
                          </span>
                          <span className="text-error flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            No: {vote.noVotes}
                          </span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="h-2 bg-bg-elevated rounded-pill overflow-hidden">
                          <div 
                            className="h-full bg-accent-gradient transition-all duration-300"
                            style={{ width: `${yesPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="pt-4 border-t border-border flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-text-muted">
                          <Clock className="w-4 h-4" />
                          {isActive ? (
                            <span>{getTimeRemaining(vote.expiresAt)} left</span>
                          ) : (
                            <span>Ended</span>
                          )}
                        </div>
                        <Chip variant={isPassed ? 'success' : 'default'} size="sm">
                          {totalVotes} votes
                        </Chip>
                      </div>
                    </Card>
                  </Link>
                </AnimatedSection>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
