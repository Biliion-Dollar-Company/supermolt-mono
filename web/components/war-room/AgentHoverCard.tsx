'use client';

import type { AgentData } from './types';

interface Props {
  agent: AgentData;
  x: number;
  y: number;
  currentStation?: string;
}

export default function AgentHoverCard({ agent, x, y, currentStation }: Props) {
  const wins = Math.round(agent.winRate * agent.totalTrades);
  const total = agent.totalTrades;
  const winPct = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

  const addressShort = agent.id.length > 12
    ? agent.id.slice(0, 6) + '...' + agent.id.slice(-4)
    : agent.id;

  const avatarUrl = agent.pfpUrl
    ? agent.pfpUrl
    : `https://api.dicebear.com/7.x/identicon/svg?seed=${agent.id}&backgroundColor=0a0a0a&radius=50`;

  const isGod = agent.trustScore > 0.95;

  // Position: keep card in viewport
  const cardW = 260;
  const cardH = 200;
  const left = Math.min(x + 16, window.innerWidth - cardW - 16);
  const top  = Math.min(y - 20, window.innerHeight - cardH - 16);

  return (
    <div
      style={{
        position:        'fixed',
        left:            left,
        top:             top,
        width:           cardW,
        zIndex:          9999,
        background:      'rgba(10,10,10,0.97)',
        border:          `1px solid ${isGod ? '#E8B45E' : 'rgba(232,180,94,0.3)'}`,
        borderRadius:    8,
        padding:         '12px',
        fontFamily:      'JetBrains Mono, monospace',
        backdropFilter:  'blur(20px)',
        boxShadow:       isGod
          ? '0 0 32px rgba(232,180,94,0.25), 0 0 8px rgba(232,180,94,0.15), inset 0 1px 0 rgba(232,180,94,0.1)'
          : '0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
        pointerEvents:   'none',
        transition:      'opacity 0.15s ease',
      }}
    >
      {/* Top row: avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            style={{
              width:        48,
              height:       48,
              borderRadius: '50%',
              overflow:     'hidden',
              border:       `2px solid ${isGod ? '#E8B45E' : '#333'}`,
              boxShadow:    isGod ? '0 0 12px rgba(232,180,94,0.5)' : 'none',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={agent.name}
              width={48}
              height={48}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  `https://api.dicebear.com/7.x/identicon/svg?seed=${agent.id}&backgroundColor=0a0a0a&radius=50`;
              }}
            />
          </div>
          {isGod && (
            <div
              style={{
                position:   'absolute',
                bottom:     -2,
                right:      -2,
                width:      14,
                height:     14,
                borderRadius: '50%',
                background: '#E8B45E',
                display:    'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize:   8,
                fontWeight: '900',
                color:      '#000',
                border:     '1px solid #000',
              }}
            >
              ★
            </div>
          )}
        </div>

        {/* Name + address */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              color:      isGod ? '#E8B45E' : '#ffffff',
              fontWeight: '700',
              fontSize:   13,
              whiteSpace: 'nowrap',
              overflow:   'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {agent.name}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, marginTop: 2 }}>
            {addressShort}
          </div>
          {agent.twitterHandle && (
            <div style={{ color: '#1DA1F2', fontSize: 9, marginTop: 1 }}>
              @{agent.twitterHandle}
            </div>
          )}
        </div>

        {/* Rank badge */}
        <div
          style={{
            width:      28,
            height:     28,
            borderRadius: '50%',
            background:  isGod ? 'rgba(232,180,94,0.2)' : 'rgba(255,255,255,0.08)',
            border:      `1px solid ${isGod ? '#E8B45E' : 'rgba(255,255,255,0.2)'}`,
            display:     'flex',
            alignItems:  'center',
            justifyContent: 'center',
            fontSize:    11,
            fontWeight:  '900',
            color:       isGod ? '#E8B45E' : '#ffffff',
            flexShrink:  0,
          }}
        >
          #{agent.rank}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }} />

      {/* Win rate row */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>
            Win Rate
          </span>
          <span style={{ color: '#E8B45E', fontSize: 10, fontWeight: '700' }}>
            {wins}/{total} ({winPct}%)
          </span>
        </div>
        {/* Progress bar */}
        <div
          style={{
            width:        '100%',
            height:       4,
            background:   'rgba(255,255,255,0.08)',
            borderRadius: 2,
            overflow:     'hidden',
          }}
        >
          <div
            style={{
              width:        `${winPct}%`,
              height:       '100%',
              background:   `linear-gradient(90deg, #ffaa00, #E8B45E)`,
              borderRadius: 2,
              boxShadow:    '0 0 6px rgba(232,180,94,0.6)',
              transition:   'width 0.5s ease',
            }}
          />
        </div>
      </div>

      {/* Best trade */}
      {agent.bestTradePct != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>
            Best Trade
          </span>
          <span style={{ color: '#00ff41', fontSize: 10, fontWeight: '700' }}>
            +{agent.bestTradePct.toLocaleString('en-US', { maximumFractionDigits: 0 })}%
          </span>
        </div>
      )}

      {/* Current station */}
      {currentStation && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>
            Watching
          </span>
          <span style={{ color: '#ffffff', fontSize: 10, fontWeight: '600' }}>
            🔍 {currentStation}
          </span>
        </div>
      )}

      {/* Notes */}
      {agent.notes && (
        <>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '6px 0' }} />
          <div
            style={{
              color:      'rgba(255,255,255,0.35)',
              fontSize:   9,
              fontStyle:  'italic',
              lineHeight: 1.5,
            }}
          >
            {agent.notes.length > 90 ? agent.notes.slice(0, 87) + '…' : agent.notes}
          </div>
        </>
      )}

      {/* God wallet badge */}
      {isGod && (
        <div
          style={{
            marginTop:    8,
            padding:      '4px 8px',
            background:   'rgba(232,180,94,0.1)',
            border:       '1px solid rgba(232,180,94,0.3)',
            borderRadius: 4,
            textAlign:    'center',
            color:        '#E8B45E',
            fontSize:     9,
            fontWeight:   '700',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          ★ GOD WALLET — TRACK THIS
        </div>
      )}
    </div>
  );
}
