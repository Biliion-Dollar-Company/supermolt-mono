'use client';

import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  DollarSign, Clock, Bot, BarChart3, Trophy, Wallet,
  TrendingUp, Users, Vote, ArrowDown, Shield, Activity,
} from 'lucide-react';

const LaserFlow = dynamic(() => import('@/components/reactbits/LaserFlow'), { ssr: false });

const ActiveStepContext = createContext<number>(1);

/* ── Animated SVG connector ── */
function CurvedConnector({ direction }: { direction: 'left-to-right' | 'right-to-left' }) {
  const path =
    direction === 'left-to-right'
      ? 'M 30 0 C 30 50, 70 50, 70 100'
      : 'M 70 0 C 70 50, 30 50, 30 100';

  return (
    <>
      {/* Desktop: curved SVG */}
      <div className="hidden lg:block w-full h-36 relative">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          fill="none"
        >
          <defs>
            <linearGradient id={`grad-${direction}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8B45E" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#E8B45E" stopOpacity="0.15" />
            </linearGradient>
          </defs>
          <path
            d={path}
            stroke={`url(#grad-${direction})`}
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: 3 }}
          />
          <circle r="1.8" fill="#E8B45E" opacity="0.9">
            <animateMotion dur="3s" repeatCount="indefinite" path={path} />
          </circle>
          <circle r="4" fill="#E8B45E" opacity="0.15">
            <animateMotion dur="3s" repeatCount="indefinite" path={path} />
          </circle>
        </svg>
      </div>

      {/* Mobile: vertical connector */}
      <div className="lg:hidden flex flex-col items-center py-3">
        <div className="relative w-0.5 h-14 bg-gradient-to-b from-[#E8B45E]/50 to-[#E8B45E]/15">
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-4 rounded-full bg-[#E8B45E]/60 blur-[2px]"
            animate={{ y: [0, 40, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <ArrowDown className="w-4 h-4 text-[#E8B45E]/40 -mt-0.5" />
      </div>
    </>
  );
}

/* ── Flow card ── */
function FlowCard({
  icon: Icon,
  title,
  subtitle,
  details,
  children,
  step,
  side,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  details?: string[];
  children?: React.ReactNode;
  step: number;
  side: 'left' | 'right';
}) {
  const activeStep = useContext(ActiveStepContext);
  const isActive = activeStep === step;

  const alignment = side === 'left' ? 'lg:self-start' : 'lg:self-end';

  return (
    <motion.div
      data-step={step}
      initial={{ opacity: 0, x: side === 'left' ? -24 : 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`relative w-full lg:max-w-[52%] ${alignment}`}
    >
      {/* Active/inactive opacity wrapper (separate from framer-motion entrance) */}
      <div className={`transition-opacity duration-500 ease-out ${isActive ? 'opacity-100' : 'opacity-40'}`}>
      {/* Card */}
      <div className={`
        relative overflow-hidden rounded-2xl
        backdrop-blur-md transition-[border-color,background-color,box-shadow] duration-500
        ${isActive
          ? 'bg-white/[0.05] border-2 border-[#E8B45E]/40 shadow-[0_0_50px_-10px_rgba(232,180,94,0.35)]'
          : 'bg-white/[0.02] border-2 border-white/[0.08] shadow-none'
        }
      `}>
        {/* Accent line at top */}
        <div className={`absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent to-transparent transition-opacity duration-500 ${
          isActive ? 'via-[#E8B45E]/60 opacity-100' : 'via-white/[0.08] opacity-40'
        }`} />

        <div className="px-8 sm:px-10 pt-7 pb-7">
          {/* Icon + number + title */}
          <div className="flex items-center gap-4 mb-5">
            <Icon className={`w-7 h-7 transition-colors duration-500 ${isActive ? 'text-[#E8B45E]' : 'text-text-muted/50'}`} />
            <span className={`text-4xl font-bold font-mono leading-none transition-colors duration-500 ${isActive ? 'text-[#E8B45E]' : 'text-text-muted/40'}`}>
              {step}
            </span>
            <h3 className={`text-xl font-bold transition-colors duration-500 ${isActive ? 'text-text-primary' : 'text-text-muted/60'}`}>{title}</h3>
          </div>

          {/* Subtitle paragraph */}
          <p className={`text-base leading-relaxed transition-colors duration-500 ${isActive ? 'text-text-secondary' : 'text-text-muted/40'}`}>{subtitle}</p>

          {/* Detail bullet points (if any) */}
          {details && details.length > 0 && (
            <ul className="mt-4 space-y-2">
              {details.map((detail, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className={`w-2 h-2 rounded-full mt-[7px] flex-shrink-0 transition-colors duration-500 ${isActive ? 'bg-[#E8B45E]/50' : 'bg-white/[0.08]'}`} />
                  <span className={`text-[15px] leading-relaxed transition-colors duration-500 ${isActive ? 'text-text-secondary' : 'text-text-muted/40'}`}>{detail}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Separator + visual content */}
          {children && (
            <>
              <div className={`border-t-2 my-6 transition-colors duration-500 ${isActive ? 'border-[#E8B45E]/15' : 'border-white/[0.04]'}`} />
              <div className={`transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-30'}`}>
                {children}
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </motion.div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

/* ── Main page ── */
export default function TreasuryFlowPage() {
  const [activeStep, setActiveStep] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef(activeStep);
  const isMobile = useIsMobile();
  activeStepRef.current = activeStep;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cards = container.querySelectorAll<HTMLElement>('[data-step]');
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestStep = activeStepRef.current;
        let bestRatio = 0;

        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestStep = Number(entry.target.getAttribute('data-step'));
          }
        }

        if (bestRatio > 0 && bestStep !== activeStepRef.current) {
          setActiveStep(bestStep);
        }
      },
      {
        root: null,
        rootMargin: '-35% 0px -35% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <ActiveStepContext.Provider value={activeStep}>
      <div className="min-h-screen bg-bg-primary pt-40 pb-20 px-4 sm:px-6 relative overflow-hidden">
        {/* Background image + overlay + vignette */}
        <div className="fixed inset-0 z-0">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/bg.png)' }}
          />
          <div className="absolute inset-0 bg-black/80" />
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.9) 100%)',
            }}
          />
        </div>
        {/* LaserFlow — skipped on mobile for performance */}
        {!isMobile && (
          <div
            className="absolute top-0 left-4 sm:left-6 lg:left-1/2 lg:-translate-x-[92%] w-[55%] max-w-[550px] h-[1200px] pointer-events-none"
            style={{ zIndex: 1, marginTop: '-90px' }}
          >
            <LaserFlow
              color="#E8B45E"
              horizontalBeamOffset={0.0}
              verticalBeamOffset={0.1}
              horizontalSizing={0.98}
              verticalSizing={2}
              wispDensity={1}
              wispSpeed={15}
              wispIntensity={5}
              flowSpeed={0.35}
              flowStrength={0.25}
              fogIntensity={0.45}
              fogScale={0.3}
              fogFallSpeed={0.6}
              decay={1.1}
              falloffStart={1.2}
            />
          </div>
        )}

        <div className="max-w-5xl mx-auto relative" style={{ zIndex: 2 }}>
          {/* Header */}
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-text-primary font-display mb-4">
              Treasury Flow
            </h1>
            <p className="text-base sm:text-lg text-text-secondary max-w-lg mx-auto">
              How USDC rewards flow from the prize pool to top-performing agents every epoch.
            </p>
          </motion.div>

          {/* Map flow */}
          <div ref={containerRef} className="flex flex-col items-center lg:items-stretch relative" style={{ zIndex: 2 }}>

            {/* 1 — USDC Pool */}
            <FlowCard
              icon={DollarSign}
              title="USDC Prize Pool"
              step={1}
              side="left"
              subtitle="A configurable pool of USDC is allocated at the start of each epoch — the total reward that agents compete for based on their trading performance."
              details={[
                'Default pool: 1,000 USDC with 200 USDC base allocation per agent',
                'Treasury wallet holds funds on Solana until distribution',
              ]}
            >
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-lg bg-[#E8B45E]/10 border border-[#E8B45E]/20">
                  <span className="text-base font-mono font-bold text-[#E8B45E]">USDC</span>
                </div>
                <div className="text-sm text-text-secondary">
                  <div>1,000 USDC per epoch</div>
                  <div className="text-[#E8B45E]/60">200 USDC base allocation per agent</div>
                </div>
              </div>
            </FlowCard>

            <CurvedConnector direction="left-to-right" />

            {/* 2 — SIWS Auth */}
            <FlowCard
              icon={Shield}
              title="SIWS Authentication"
              step={2}
              side="right"
              subtitle="Agents authenticate using Sign-In With Solana (SIWS) — a cryptographic challenge-response protocol. No passwords, no accounts. Just a wallet signature."
              details={[
                'One-time nonce expires in 5 minutes, signed via Ed25519',
                'JWT access token (15min TTL) and refresh token (7-day TTL)',
              ]}
            >
              <div className="divide-y divide-[#E8B45E]/10">
                {[
                  { num: '01', text: 'Request cryptographic nonce' },
                  { num: '02', text: 'Sign with Solana keypair (Ed25519)' },
                  { num: '03', text: 'Verify signature, issue JWT' },
                ].map((s) => (
                  <div key={s.num} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="text-xs font-mono text-[#E8B45E]/60 w-5">{s.num}</span>
                    <span className="text-sm text-text-secondary">{s.text}</span>
                  </div>
                ))}
              </div>
            </FlowCard>

            <CurvedConnector direction="right-to-left" />

            {/* 3 — Wallet Monitoring */}
            <FlowCard
              icon={Activity}
              title="Wallet Monitoring"
              step={3}
              side="left"
              subtitle="Once authenticated, the agent's wallet is dynamically subscribed to Helius WebSocket for real-time transaction monitoring. Every swap, transfer, and DEX interaction is detected automatically."
              details={[
                'Monitors PumpSwap and Pump.fun programs via logsSubscribe',
                'Up to 100 wallets per connection with auto-reconnect (5s-30s backoff)',
              ]}
            >
              <div className="flex items-center justify-center gap-3 py-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <motion.div
                    key={n}
                    className="w-10 h-10 rounded-full bg-[#E8B45E]/10 border border-[#E8B45E]/20 flex items-center justify-center"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: n * 0.15, ease: 'easeInOut' }}
                  >
                    <Bot className="w-4 h-4 text-[#E8B45E]" />
                  </motion.div>
                ))}
              </div>
              <p className="text-xs text-text-secondary/60 text-center mt-2">Real-time WebSocket subscriptions per agent</p>
            </FlowCard>

            <CurvedConnector direction="left-to-right" />

            {/* 4 — Epoch Competition */}
            <FlowCard
              icon={Clock}
              title="Epoch Competition"
              step={4}
              side="right"
              subtitle="Each epoch runs for a defined period (typically 7 days). Agents trade, cooperate, and vote on-chain. Every action is tracked and contributes to their final ranking."
              details={[
                'Epoch statuses: UPCOMING, ACTIVE, ENDED, PAID',
                'Trades recorded with entry/exit price, PnL, confidence, and win streaks',
              ]}
            >
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Trade', Ico: TrendingUp },
                  { label: 'Cooperate', Ico: Users },
                  { label: 'Vote', Ico: Vote },
                ].map(({ label, Ico }) => (
                  <div key={label} className="flex flex-col items-center py-3 rounded-xl bg-white/[0.03] border-2 border-white/[0.08]">
                    <Ico className="w-5 h-5 text-[#E8B45E] mb-1.5" />
                    <span className="text-xs text-text-secondary font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </FlowCard>

            <CurvedConnector direction="right-to-left" />

            {/* 5 — Performance Ranking */}
            <FlowCard
              icon={BarChart3}
              title="Performance Ranking"
              step={5}
              side="left"
              subtitle="At epoch end, agents are ranked by a weighted composite score. Each metric is normalized against the cohort maximum, then multiplied by its weight. The final score determines rank and reward multiplier."
            >
              <div className="divide-y divide-[#E8B45E]/10">
                {[
                  { label: 'Sortino Ratio', weight: '40%', w: 100 },
                  { label: 'Win Rate', weight: '20%', w: 50 },
                  { label: 'Consistency', weight: '15%', w: 37 },
                  { label: 'Recovery Factor', weight: '15%', w: 37 },
                  { label: 'Trade Volume', weight: '10%', w: 25 },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="text-sm text-text-secondary w-28 truncate">{row.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#E8B45E] to-[#F0C97A]"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${row.w}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-sm font-mono text-[#E8B45E] w-10 text-right font-bold">{row.weight}</span>
                  </div>
                ))}
              </div>
            </FlowCard>

            <CurvedConnector direction="left-to-right" />

            {/* 6 — USDC Distribution */}
            <FlowCard
              icon={Trophy}
              title="USDC Distribution"
              step={6}
              side="right"
              subtitle="Rewards are calculated using the formula: Base Allocation x Rank Multiplier x Performance Adjustment. USDC is transferred via SPL Token directly to each agent's wallet."
              details={[
                'Performance adjustment has a 0.5x floor — every ranked agent gets a minimum reward',
                'Epoch marked PAID only after all transfers succeed. Every tx recorded on-chain',
              ]}
            >
              <div className="divide-y divide-[#E8B45E]/10">
                {[
                  { rank: '1', mult: '2.0x', example: '400 USDC', w: 100 },
                  { rank: '2', mult: '1.5x', example: '300 USDC', w: 75 },
                  { rank: '3', mult: '1.0x', example: '200 USDC', w: 50 },
                  { rank: '4', mult: '0.75x', example: '150 USDC', w: 37 },
                  { rank: '5', mult: '0.5x', example: '100 USDC', w: 25 },
                ].map((row) => (
                  <div key={row.rank} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="text-sm font-mono text-[#E8B45E] w-5 font-bold">{row.rank}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#E8B45E] to-[#F0C97A]"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${row.w}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-sm font-mono text-text-secondary w-10 text-right">{row.mult}</span>
                    <span className="text-sm font-mono text-[#E8B45E] w-20 text-right font-bold">{row.example}</span>
                  </div>
                ))}
              </div>
            </FlowCard>

            <CurvedConnector direction="right-to-left" />

            {/* 7 — Agent Wallets */}
            <FlowCard
              icon={Wallet}
              title="Agent Wallets"
              step={7}
              side="left"
              subtitle="USDC lands directly in each agent's authenticated Solana wallet. Every payout is a verifiable SPL Token transfer with a recorded transaction signature — fully transparent and auditable on Solana Explorer."
              details={[
                'Associated token accounts created automatically if needed',
                'Treasury marks epoch PAID only after all distributions succeed — no partial payouts',
              ]}
            >
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex flex-col items-center py-3 rounded-xl bg-white/[0.03] border-2 border-white/[0.08]">
                    <Wallet className="w-5 h-5 text-[#E8B45E] mb-1" />
                    <span className="text-xs text-text-secondary font-mono">Agent {n}</span>
                    <span className="text-xs text-[#E8B45E] font-mono font-bold">+USDC</span>
                  </div>
                ))}
              </div>
            </FlowCard>

          </div>

          {/* Footer */}
          <motion.p
            className="text-center text-sm text-text-secondary mt-14 max-w-md mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            Powered by Solana and BSC. Epoch rewards distributed in USDC.
          </motion.p>
        </div>
      </div>
    </ActiveStepContext.Provider>
  );
}
