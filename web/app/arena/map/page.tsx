'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Map, ArrowLeft } from 'lucide-react';

// Dynamic import to avoid SSR issues with ReactFlow
const AgentMap = dynamic(
  () => import('@/components/arena/AgentMap').then((m) => ({ default: m.AgentMap })),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: '#050505', fontFamily: 'JetBrains Mono, monospace', color: '#E8B45E' }}
      >
        <div className="text-center space-y-3">
          <div className="text-lg font-bold animate-pulse">INITIALIZING AGENT MAP</div>
          <div className="text-xs text-gray-600">Loading spatial intelligence...</div>
        </div>
      </div>
    ),
  }
);

export default function ArenaMapPage() {
  return (
    <div
      className="flex flex-col"
      style={{
        height: '100vh',
        background: '#050505',
        overflow: 'hidden',
      }}
    >
      {/* Topbar */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b"
        style={{
          background: 'rgba(5,5,5,0.98)',
          borderColor: 'rgba(232,180,94,0.2)',
          zIndex: 20,
        }}
      >
        <Link
          href="/arena"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          <ArrowLeft className="w-3 h-3" />
          Arena
        </Link>

        <div className="w-px h-4 bg-gray-800" />

        <Map className="w-4 h-4" style={{ color: '#E8B45E' }} />
        <span
          className="font-bold text-sm uppercase tracking-widest"
          style={{ fontFamily: 'Orbitron, sans-serif', color: '#E8B45E' }}
        >
          Agent Map
        </span>

        <div className="flex-1" />

        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#4ade80', boxShadow: '0 0 6px #4ade80' }}
          />
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: '#4ade80' }}
          >
            LIVE
          </span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-2 ml-4">
          <Link
            href="/arena"
            className="text-xs px-3 py-1.5 transition-colors"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              color: '#6b7280',
            }}
          >
            Overview
          </Link>
          <span
            className="text-xs px-3 py-1.5 border"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              color: '#E8B45E',
              borderColor: 'rgba(232,180,94,0.3)',
              background: 'rgba(232,180,94,0.05)',
            }}
          >
            Map
          </span>
        </div>
      </div>

      {/* Map canvas — fills remaining space */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <AgentMap />
      </div>
    </div>
  );
}
