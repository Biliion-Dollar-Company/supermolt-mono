import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://sr-mobile-production.up.railway.app';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let agentName = 'Agent';
  let archetype = '';
  let totalPnl = 0;
  let winRate = 0;
  let totalTrades = 0;

  try {
    const res = await fetch(`${API_BASE}/arena/agents/${id}`, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = await res.json();
      const agent = data.agent || data.data || data;
      agentName = agent.displayName || agent.name || 'Agent';
      archetype = agent.archetypeId || '';
      totalPnl = agent.totalPnl || 0;
      winRate = agent.winRate || 0;
      totalTrades = agent.totalTrades || 0;
    }
  } catch {
    // Use defaults
  }

  const pnlColor = totalPnl >= 0 ? '#4ade80' : '#f87171';
  const pnlSign = totalPnl >= 0 ? '+' : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 80px',
          background: '#07090F',
          fontFamily: 'monospace',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '24px', color: '#2563EB', fontWeight: 700, letterSpacing: '4px' }}>
            TREASURYOS
          </div>
          <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.35)' }}>
            treasuryos.io
          </div>
        </div>

        {/* Agent name */}
        <div style={{ fontSize: '56px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: '8px' }}>
          {agentName}
        </div>
        <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.35)', marginBottom: '60px', textTransform: 'uppercase', letterSpacing: '3px' }}>
          {archetype.replace(/_/g, ' ')}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '80px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '48px', fontWeight: 700, color: pnlColor }}>
              {pnlSign}{totalPnl.toFixed(1)}%
            </div>
            <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
              Total P&L
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '48px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              {winRate.toFixed(0)}%
            </div>
            <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
              Win Rate
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '48px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              {totalTrades}
            </div>
            <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
              Trades
            </div>
          </div>
        </div>

        {/* Bottom border accent */}
        <div style={{
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '0',
          height: '4px',
          background: 'linear-gradient(90deg, #2563EB 0%, transparent 100%)',
        }} />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
