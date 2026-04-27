'use client';

import { useEffect, useState } from 'react';
import { getPnL, SANDBOX_MODE } from '@/lib/api';
import type { Agent, Trade } from '@/lib/types';
import { 
  Cpu,
  Zap,
  Terminal as TerminalIcon,
  Activity,
  Globe
} from 'lucide-react';

// Tactical UI Kit
import { CutCorner } from '@/components/ui-kit/cut-corner';
import { CutButton } from '@/components/ui-kit/cut-button';
import dynamic from 'next/dynamic';

const FaultyTerminal = dynamic(() => import('@/components/react-bits/faulty-terminal/FaultyTerminal'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#050508]" />,
});

/**
 * Trench Terminal — Mission Control
 * The definitive tactical interface. Zero fluff, pure execution.
 */
export function BrainrotLandingPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [totalPnl, setTotalPnl] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const pnlData = await getPnL();
        setTrades(pnlData.trades);
        setTotalPnl(pnlData.totalPnlUsd);
        
        setAgents([
          { id: '1', name: 'PHANTOM', displayName: '⚡ SCALPER_UNIT', archetypeId: 'scalper', level: 8, xp: 2400, totalTrades: 142, winRate: 68.5, totalPnl: 12.4, reputationScore: 92, status: 'ACTIVE' },
          { id: '2', name: 'ORACLE', displayName: '🔮 QUANT_CORE', archetypeId: 'quant-trader', level: 5, xp: 1200, totalTrades: 84, winRate: 72.1, totalPnl: 8.2, reputationScore: 98, status: 'ACTIVE' },
        ]);
      } catch (e) {
        console.error('Terminal Data Sync Failure', e);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#050508] text-white font-mono overflow-hidden">
      
      {/* Matrix background from trecher-id / web3me */}
      <div className="fixed inset-0 z-0 bg-[#050508]">
        <FaultyTerminal
          scale={1.5}
          gridMul={[2, 1]}
          digitSize={1.2}
          timeScale={0.3}
          scanlineIntensity={0.3}
          glitchAmount={1}
          flickerAmount={1}
          noiseAmp={0}
          chromaticAberration={0}
          curvature={0}
          tint="#7132f5"
          mouseReact={true}
          mouseStrength={0.3}
          pageLoadAnimation={false}
          brightness={0.18}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 18%, rgba(113, 50, 245, 0.14) 0%, rgba(113, 50, 245, 0.035) 24%, transparent 52%), linear-gradient(180deg, rgba(5,5,8,0) 0%, rgba(5,5,8,0.58) 100%)',
          }}
        />
      </div>

      {/* Overlay Scanline */}
      <div className="scanline z-50 pointer-events-none" />

      <main className="relative z-10 max-w-[1600px] mx-auto min-h-screen flex flex-col xl:flex-row items-center justify-between px-12 md:px-16 xl:px-20 py-20 gap-20">
        
        {/* 📟 LEFT: THE BRAND & MISSION */}
        <div className="flex-1 space-y-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 px-3 py-1.5 bg-kraken-purple/10 border border-kraken-purple/30 rounded-none transform -skew-x-12">
              <Activity size={14} className="text-kraken-purple animate-pulse" />
              <span className="text-[10px] font-black tracking-[0.2em] text-kraken-purple uppercase skew-x-12">System_Uplink: Synchronized</span>
            </div>
            
            <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.75] uppercase">
              TRENCH<br/>
              <span className="text-kraken-purple">TERMINAL</span>
            </h1>

            <div className="flex items-center gap-4 text-text-secondary">
               <div className="h-px w-12 bg-kraken-purple" />
               <p className="text-sm tracking-widest font-black uppercase opacity-60">Autonomous Execution Layer</p>
            </div>

            <p className="text-text-secondary text-lg leading-relaxed max-w-md font-sans italic opacity-70">
              High-speed signal ingestion. Institutional execution via Kraken CLI. 
              Verifiable trust via ERC-8004.
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <CutButton size="lg" href="/war-room" className="min-w-[240px]">
              LAUNCH_TERMINAL <Zap size={18} fill="currentColor" />
            </CutButton>
            <CutButton size="lg" variant="secondary" href="/leaderboard" className="min-w-[240px]">
              AUDIT_RANKINGS
            </CutButton>
          </div>

          <div className="flex items-center gap-10 pt-10">
             <div className="text-center">
               <div className="text-[10px] text-text-muted font-bold uppercase mb-1">P&L_24H</div>
               <div className="text-2xl font-black text-kraken-green font-mono tracking-tighter">+${totalPnl.toFixed(2)}</div>
             </div>
             <div className="w-px h-10 bg-white/10" />
             <div className="text-center">
               <div className="text-[10px] text-text-muted font-bold uppercase mb-1">Latency</div>
               <div className="text-2xl font-black font-mono tracking-tighter">7.2ms</div>
             </div>
             <div className="w-px h-10 bg-white/10" />
             <div className="text-center">
               <div className="text-[10px] text-text-muted font-bold uppercase mb-1">Verification</div>
               <div className="text-2xl font-black text-kraken-purple font-mono tracking-tighter underline decoration-2 underline-offset-4">ERC-8004</div>
             </div>
          </div>
        </div>

        {/* 🛰️ RIGHT: THE VISUAL HUD */}
        <div className="w-full xl:w-[600px] space-y-6 animate-fade-in">
          
          {/* Tactical Pipeline Visualization */}
          <CutCorner
            cut="md"
            bg="rgba(8, 8, 14, 0.24)"
            borderColor="rgba(113, 50, 245, 0.22)"
            className="p-8 shadow-[0_12px_48px_rgba(0,0,0,0.34)]"
          >
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3 text-xs font-black tracking-widest uppercase">
                  <TerminalIcon size={16} className="text-kraken-purple" /> 
                  Pipeline_Status
                </div>
                <div className="h-2 w-2 rounded-full bg-kraken-green shadow-[0_0_10px_#149e61]" />
              </div>

              <div className="space-y-6">
                <VisualStep icon={<Globe size={20}/>} label="Signal_Capture" desc="Social Sentiment Ingestion" status="ACTIVE" />
                <VisualStep icon={<Cpu size={20}/>} label="AI_Inference" desc="Archetype Strategy Scoring" status="VERIFIED" />
                <VisualStep icon={<Zap size={20}/>} label="Kraken_CLI" desc="Binary Order Execution" status="EXECUTING" color="text-kraken-purple" />
              </div>
            </div>
          </CutCorner>

          {/* Unit Status Hub */}
          <div className="grid grid-cols-2 gap-4">
             {agents.map(a => (
               <CutCorner
                 key={a.id}
                 cut="sm"
                 bg="rgba(8, 8, 14, 0.2)"
                 borderColor="rgba(113, 50, 245, 0.18)"
                 className="p-4 shadow-[0_8px_30px_rgba(0,0,0,0.22)] transition-colors cursor-pointer group hover:[&>div:first-child]:bg-[rgba(113,50,245,0.35)]"
               >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-kraken-purple/20 flex items-center justify-center text-kraken-purple font-black text-xs">
                      {a.name[0]}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-tighter truncate">{a.displayName}</div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="text-[9px] text-text-muted font-bold">REP: {a.reputationScore}%</div>
                    <div className="text-[10px] text-kraken-green font-black">+{a.totalPnl} SOL</div>
                  </div>
                  <div className="mt-2 h-0.5 w-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-kraken-purple animate-pulse" style={{ width: `${a.winRate}%` }} />
                  </div>
               </CutCorner>
             ))}
          </div>

          <div className="text-right">
             <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest italic opacity-50">
               Audit_Trail: 0x852C...FD93 // SECURED_BY_SEPOLIA
             </span>
          </div>

        </div>
      </main>
    </div>
  );
}

function VisualStep({ icon, label, desc, status, color = "text-text-primary" }: { icon: React.ReactNode, label: string, desc: string, status: string, color?: string }) {
  return (
    <div className="flex items-center gap-5 group">
      <div className="p-3 bg-white/5 backdrop-blur-sm border border-white/10 group-hover:border-kraken-purple/50 transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-0.5">{label}</div>
        <div className="text-xs font-sans font-medium text-text-secondary leading-none">{desc}</div>
      </div>
      <div className={`text-[10px] font-black uppercase tracking-tighter ${color} bg-white/5 backdrop-blur-sm px-2 py-1`}>
        {status}
      </div>
    </div>
  );
}
