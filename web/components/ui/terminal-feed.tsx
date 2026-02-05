'use client';

import { useState, useEffect, useRef } from 'react';

interface TerminalLine {
  id: string;
  text: string;
  timestamp: Date;
  type: 'trade' | 'system' | 'agent';
}

export function TerminalFeed() {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate live feed
    const interval = setInterval(() => {
      const agents = ['AlphaBot', 'BetaTrader', 'GammaAI', 'DeltaSwing', 'EpsilonHedge'];
      const actions = ['BOUGHT', 'SOLD'];
      const tokens = ['$WIF', '$BONK', '$SOL', '$USDC', '$PEPE'];
      
      const agent = agents[Math.floor(Math.random() * agents.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const token = tokens[Math.floor(Math.random() * tokens.length)];
      const amount = (Math.random() * 10).toFixed(2);

      const newLine: TerminalLine = {
        id: `${Date.now()}-${Math.random()}`,
        text: `[${agent}] ${action} ${amount} SOL of ${token}`,
        timestamp: new Date(),
        type: 'trade',
      };

      setLines((prev) => [...prev.slice(-9), newLine]);
    }, 2000);

    // Add welcome message
    setLines([
      {
        id: '1',
        text: '> Trench Trading Arena initialized...',
        timestamp: new Date(),
        type: 'system',
      },
      {
        id: '2',
        text: '> Monitoring 5 active agents...',
        timestamp: new Date(),
        type: 'system',
      },
    ]);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="bg-void-900 border border-matrix-green rounded-lg p-4 font-mono text-sm h-full min-h-[400px] overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-void-600">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-alert-red" />
          <div className="w-3 h-3 rounded-full bg-warning-amber" />
          <div className="w-3 h-3 rounded-full bg-matrix-green" />
        </div>
        <span className="text-matrix-green text-xs ml-2">LIVE FEED</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="w-2 h-2 bg-matrix-green rounded-full animate-pulse" />
          <span className="text-matrix-green text-xs">STREAMING</span>
        </div>
      </div>
      
      <div ref={scrollRef} className="overflow-y-auto flex-1 space-y-2 pr-2">
        {lines.map((line, idx) => (
          <div
            key={line.id}
            className="text-matrix-green opacity-0 animate-[fadeIn_0.3s_ease_forwards]"
            style={{ animationDelay: `${idx * 0.05}s` }}
          >
            <span className="text-gray-600">
              {line.timestamp.toLocaleTimeString('en-US', { hour12: false })}
            </span>{' '}
            <span className={line.type === 'system' ? 'text-brand-primary' : 'text-matrix-green'}>
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
