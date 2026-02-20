'use client';

import { useEffect, useRef } from 'react';
import type { FeedEvent } from './types';

interface EventFeedProps {
  events: FeedEvent[];
  /** When true, omit the header row (used when embedded in a larger panel) */
  hideHeader?: boolean;
}

const ACTION_COLORS: Record<FeedEvent['action'], string> = {
  BUY:       '#00ff41',
  SELL:      '#ff0033',
  ANALYZING: '#ffaa00',
};

const ACTION_LABELS: Record<FeedEvent['action'], string> = {
  BUY:       'BUY ',
  SELL:      'SELL',
  ANALYZING: 'SCAN',
};

export default function EventFeed({ events, hideHeader = false }: EventFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  // When hideHeader=true we're embedded in a parent panel (no own border/width)
  const wrapperStyle: React.CSSProperties = hideHeader
    ? { display: 'flex', flexDirection: 'column', height: '100%' }
    : {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '280px',
        minWidth: '280px',
        background: '#0A0A0A',
        borderLeft: '1px solid rgba(232, 180, 94, 0.3)',
      };

  return (
    <div style={wrapperStyle}>
      {/* Header — only shown when not embedded */}
      {!hideHeader && (
        <div
          className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(232, 180, 94, 0.2)' }}
        >
          {/* Pulsing dot */}
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{
              background: '#00ff41',
              boxShadow: '0 0 6px #00ff41',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <h2
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: '#E8B45E', fontFamily: 'JetBrains Mono, monospace' }}
          >
            Live Feed
          </h2>
          <span
            className="ml-auto text-xs"
            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {events.length} events
          </span>
        </div>
      )}

      {/* Event list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(232,180,94,0.2) transparent',
        }}
      >
        {events.length === 0 ? (
          <div
            className="flex items-center justify-center h-full text-xs"
            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace' }}
          >
            Waiting for activity...
          </div>
        ) : (
          <div className="flex flex-col">
            {events.map((evt, i) => (
              <EventRow key={i} event={evt} isLatest={i === events.length - 1} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 flex-shrink-0 text-xs"
        style={{
          borderTop: '1px solid rgba(232, 180, 94, 0.1)',
          color: 'rgba(255,255,255,0.2)',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        OBSERVER MODE — READ ONLY
      </div>
    </div>
  );
}

// ─── EventRow ────────────────────────────────────────────────────────────────

interface EventRowProps {
  event: FeedEvent;
  isLatest: boolean;
}

function EventRow({ event, isLatest }: EventRowProps) {
  const color = ACTION_COLORS[event.action];
  const label = ACTION_LABELS[event.action];

  return (
    <div
      className="px-3 py-2 text-xs border-b"
      style={{
        borderColor: 'rgba(255,255,255,0.04)',
        fontFamily: 'JetBrains Mono, monospace',
        background: isLatest ? 'rgba(232,180,94,0.04)' : 'transparent',
        transition: 'background 0.3s',
      }}
    >
      {/* Timestamp row */}
      <div className="flex items-center gap-2 mb-0.5">
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px' }}>
          {event.timestamp}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-bold"
          style={{
            background: `${color}22`,
            color,
            border: `1px solid ${color}44`,
          }}
        >
          {label}
        </span>
      </div>
      {/* Agent + token row */}
      <div className="flex items-center gap-1">
        <span style={{ color: '#E8B45E', fontWeight: '700', fontSize: '10px' }}>
          {event.agentName}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>→</span>
        <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '10px' }}>
          {event.token}
        </span>
      </div>
    </div>
  );
}
