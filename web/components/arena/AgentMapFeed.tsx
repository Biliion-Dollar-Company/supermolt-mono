'use client';

import { useEffect, useRef } from 'react';

export interface FeedEntry {
  id: string;
  text: string;
  color: 'gold' | 'green' | 'red' | 'dim';
  timestamp: string;
}

interface AgentMapFeedProps {
  entries: FeedEntry[];
}

export function AgentMapFeed({ entries }: AgentMapFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new entry added
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [entries.length]);

  const colorClass = (color: FeedEntry['color']) => {
    switch (color) {
      case 'gold': return '#E8B45E';
      case 'green': return '#4ade80';
      case 'red': return '#f87171';
      case 'dim': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ width: 280, minWidth: 280 }}>
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center gap-2 flex-shrink-0"
        style={{ borderColor: 'rgba(232,180,94,0.2)', background: 'rgba(5,5,5,0.9)' }}
      >
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: '#4ade80', boxShadow: '0 0 6px #4ade80' }}
        />
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: '#E8B45E' }}
        >
          Live Feed
        </span>
      </div>

      {/* Feed entries */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          background: 'rgba(5,5,5,0.95)',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(232,180,94,0.2) transparent',
        }}
      >
        {entries.length === 0 ? (
          <div
            className="px-4 py-6 text-center text-xs"
            style={{ color: '#4b5563', fontFamily: 'JetBrains Mono, monospace' }}
          >
            Awaiting signals...
          </div>
        ) : (
          <div className="flex flex-col">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="px-3 py-2 border-b text-xs leading-relaxed"
                style={{
                  borderColor: 'rgba(255,255,255,0.04)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                <div style={{ color: colorClass(entry.color) }}>{entry.text}</div>
                <div className="mt-0.5" style={{ color: '#374151', fontSize: '10px' }}>
                  {entry.timestamp}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer count */}
      <div
        className="px-4 py-2 border-t text-center flex-shrink-0"
        style={{
          borderColor: 'rgba(232,180,94,0.1)',
          background: 'rgba(5,5,5,0.9)',
          fontFamily: 'JetBrains Mono, monospace',
          color: '#374151',
          fontSize: '10px',
        }}
      >
        {entries.length} events logged
      </div>
    </div>
  );
}
