'use client';

import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://sr-mobile-production.up.railway.app';

interface TickerEvent {
  id: string;
  agentName: string;
  action: 'BUY' | 'SELL';
  tokenSymbol: string;
  amount: number;
}

export function LiveActivityTicker() {
  const [events, setEvents] = useState<TickerEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Fetch initial trades
    fetch(`${API_BASE}/arena/trades?limit=15`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: any) => {
        const trades: any[] = Array.isArray(data) ? data : data?.trades ?? [];
        setEvents(
          trades.map((t: any, i: number) => ({
            id: t.id || `init-${i}`,
            agentName: t.agentName || t.agent?.name || 'Agent',
            action: t.action || (t.type === 'SELL' ? 'SELL' : 'BUY'),
            tokenSymbol: t.tokenSymbol || t.symbol || 'TOKEN',
            amount: t.amountSol ?? t.amount ?? 0,
          }))
        );
      })
      .catch(() => {});

    // WebSocket
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe:public');
    });

    socket.on('agent:activity', (data: any) => {
      const ev: TickerEvent = {
        id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agentName: data.agentName || data.agent?.name || 'Agent',
        action: data.action === 'SELL' ? 'SELL' : 'BUY',
        tokenSymbol: data.tokenSymbol || data.symbol || 'TOKEN',
        amount: data.amountSol ?? data.amount ?? 0,
      };
      setEvents((prev) => [ev, ...prev].slice(0, 30));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Duplicate list if fewer than 5 events to fill the ticker
  const display = events.length > 0 && events.length < 5
    ? [...events, ...events]
    : events;

  if (display.length === 0) return null;

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        background: 'rgba(12,16,32,0.6)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="ticker-track flex items-center gap-8 whitespace-nowrap py-2 px-4">
        {display.map((ev, i) => (
          <span key={`${ev.id}-${i}`} className="inline-flex items-center gap-1.5 text-sm shrink-0">
            <span className="font-bold text-white/80">{ev.agentName}</span>
            <span
              style={ev.action === 'BUY' ? { color: '#2563EB' } : undefined}
              className={ev.action === 'SELL' ? 'text-white/35' : ''}
            >
              {ev.action === 'BUY' ? 'bought' : 'sold'}
            </span>
            <span className="text-white/80">{ev.tokenSymbol}</span>
            <span className="text-white/55">
              {ev.amount > 0 ? `${ev.amount.toFixed(2)} SOL` : ''}
            </span>
          </span>
        ))}
      </div>

      <style jsx>{`
        .ticker-track {
          animation: ticker-scroll 30s linear infinite;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
        @keyframes ticker-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
