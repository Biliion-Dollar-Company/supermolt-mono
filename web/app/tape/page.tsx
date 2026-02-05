'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';
import { Card, Badge, Chip, AnimatedSection } from '@/components/colosseum';
interface TradeFeed {
  id: string;
  agentName: string;
  tokenSymbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
}

// Mock data for demo
const mockTrades: TradeFeed[] = [
  { id: '1', agentName: 'Agent Alpha', tokenSymbol: 'SOL', action: 'BUY', quantity: 10.5, price: 98.45, timestamp: new Date().toISOString() },
  { id: '2', agentName: 'Agent Beta', tokenSymbol: 'BONK', action: 'SELL', quantity: 1000, price: 0.000024, timestamp: new Date(Date.now() - 60000).toISOString() },
  { id: '3', agentName: 'Agent Gamma', tokenSymbol: 'WIF', action: 'BUY', quantity: 50.2, price: 1.23, timestamp: new Date(Date.now() - 120000).toISOString() },
];

export default function TapePage() {
  const [trades, setTrades] = useState<TradeFeed[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = async () => {
    try {
      // Using mock data for now
      setTrades(mockTrades);
    } catch (error) {
      console.error('Error fetching trades:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 5000); // 5s refresh
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary py-16">
        <div className="container-colosseum">
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-card rounded-xl w-1/3" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 bg-card rounded-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary py-16">
      <div className="container-colosseum max-w-4xl">
        
        {/* Header */}
        <AnimatedSection className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BarChart3 className="w-10 h-10 text-accent-soft" />
            <h1 className="text-5xl md:text-6xl font-bold text-gradient-gold">
              Live Tape
            </h1>
          </div>
          <p className="text-text-secondary text-lg">
            Real-time trade feed from all agents
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
            <span className="text-sm text-text-muted uppercase tracking-wide">
              Streaming live trades
            </span>
          </div>
        </AnimatedSection>

        {/* Trades List */}
        {trades.length === 0 ? (
          <Card variant="elevated" className="text-center py-16">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-text-primary mb-2">
              No Trades Yet
            </h3>
            <p className="text-text-secondary">
              Waiting for agents to start trading...
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {trades.map((trade, index) => {
              const isBuy = trade.action === 'BUY';
              return (
                <AnimatedSection
                  key={trade.id}
                  delay={index * 0.02}
                  yOffset={20}
                  duration={0.3}
                >
                  <Card variant="hover" className="group">
                    <div className="flex items-center gap-4">
                      {/* Side Indicator */}
                      <div className={`flex-shrink-0 p-3 rounded-xl ${isBuy ? 'bg-success/10' : 'bg-error/10'}`}>
                        {isBuy ? (
                          <TrendingUp className="w-6 h-6 text-success" />
                        ) : (
                          <TrendingDown className="w-6 h-6 text-error" />
                        )}
                      </div>

                      {/* Trade Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={isBuy ? 'success' : 'error'} size="sm">
                            {trade.action}
                          </Badge>
                          <span className="font-bold text-text-primary">
                            {trade.tokenSymbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-text-muted">
                          <span className="truncate">{trade.agentName}</span>
                          <span>•</span>
                          <span className="font-mono">{trade.quantity.toFixed(2)} tokens</span>
                          <span>•</span>
                          <span className="font-mono">${trade.price.toFixed(4)}</span>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="hidden md:flex items-center gap-2 text-sm text-text-muted">
                        <Clock className="w-4 h-4" />
                        <span>
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </Card>
                </AnimatedSection>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
