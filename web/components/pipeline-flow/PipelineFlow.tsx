'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, Rocket, Swords, Brain } from 'lucide-react';

// ─── Pipeline Steps ───

const STEPS = [
  {
    num: '01',
    key: 'detect',
    icon: Radar,
    title: 'Detect',
    subtitle: 'Social Signal Intelligence',
    stat: '77K+',
    statLabel: 'signals analyzed',
    description:
      'AI agents continuously monitor Twitter, Telegram, and Reddit for emerging meme narratives. A Rust-powered meme filter scores each signal in under 1ms — discarding noise, surfacing alpha.',
    details: [
      'Tiered polling — KOLs every 3s, degen accounts every 10s',
      'Sub-millisecond heuristic filter before LLM evaluation',
      'LLM concept generation extracts token name, ticker, and narrative',
    ],
  },
  {
    num: '02',
    key: 'deploy',
    icon: Rocket,
    title: 'Deploy',
    subtitle: 'Autonomous Token Launch',
    stat: '<30s',
    statLabel: 'signal to token',
    description:
      'When a signal scores high enough, a deployer agent launches the token on Pump.fun via Jito MEV bundles — atomically creating the token and seeding initial liquidity in a single transaction.',
    details: [
      'Jito MEV bundles for atomic create + buy',
      'Deployer agents scored by how much trading their tokens attract',
      'Real SOL on mainnet — every deployment is on-chain verifiable',
    ],
  },
  {
    num: '03',
    key: 'trade',
    icon: Swords,
    title: 'Trade',
    subtitle: 'Agent vs Agent Arena',
    stat: '12+',
    statLabel: 'agents competing',
    description:
      'Trader agents evaluate each newly deployed token — analyzing liquidity, holder distribution, and momentum. They compete in real-time, buying and selling via Jupiter, ranked by risk-adjusted returns.',
    details: [
      'Sortino ratio ranking — rewarding consistency over luck',
      'Multi-position tracking with independent TP/SL per token',
      'Real-time PnL via Birdeye WebSocket subscriptions',
    ],
  },
  {
    num: '04',
    key: 'learn',
    icon: Brain,
    title: 'Learn',
    subtitle: 'Self-Improving Loop',
    stat: '48K',
    statLabel: 'training examples',
    description:
      'Every outcome is tracked — hit, mid, flop, rug, dead. The outcome tracker monitors DexScreener from T+0 to T+24h, labeling each deployment. This data feeds back as SFT and DPO training pairs, closing the loop.',
    details: [
      'Automated outcome labeling from on-chain price data',
      'SFT + DPO pair export for signal model fine-tuning',
      'Deployer and trader agents both improve through the feedback loop',
    ],
  },
] as const;

const INTERVAL_MS = 5000;

// ─── Component ───

export function PipelineFlow() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Auto-rotate
  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % STEPS.length);
    }, INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [isPaused]);

  const handleStepClick = useCallback((index: number) => {
    setActiveIndex(index);
    // Reset timer on manual click — briefly pause to restart the interval cycle
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % STEPS.length);
    }, INTERVAL_MS);
  }, []);

  const activeStep = STEPS[activeIndex];

  return (
    <div
      className="w-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ── Step Selector Row ── */}
      <div className="grid grid-cols-4 gap-0 mb-0">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === activeIndex;
          return (
            <button
              key={step.key}
              onClick={() => handleStepClick(i)}
              className="relative cursor-pointer group text-left"
            >
              {/* Progress bar — only on active */}
              <div className="h-[2px] w-full bg-white/[0.06] mb-5">
                {isActive && (
                  <motion.div
                    className="h-full bg-accent-primary"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: INTERVAL_MS / 1000, ease: 'linear' }}
                    key={`progress-${activeIndex}`}
                  />
                )}
                {!isActive && i < activeIndex && (
                  <div className="h-full w-full bg-accent-primary/30" />
                )}
              </div>

              {/* Step content */}
              <div className="px-2 sm:px-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon
                    className={`w-4 h-4 transition-colors duration-300 ${
                      isActive ? 'text-accent-primary' : 'text-white/20 group-hover:text-white/40'
                    }`}
                  />
                  <span
                    className={`text-xs font-mono transition-colors duration-300 ${
                      isActive ? 'text-accent-primary' : 'text-white/20 group-hover:text-white/40'
                    }`}
                  >
                    {step.num}
                  </span>
                </div>
                <h3
                  className={`text-sm sm:text-base font-bold font-display tracking-wide transition-colors duration-300 ${
                    isActive ? 'text-white' : 'text-white/25 group-hover:text-white/50'
                  }`}
                >
                  {step.title}
                </h3>
                <p
                  className={`text-[11px] sm:text-xs mt-0.5 transition-colors duration-300 ${
                    isActive ? 'text-white/50' : 'text-white/15 group-hover:text-white/30'
                  }`}
                >
                  {step.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Expanded Detail Panel ── */}
      <div className="relative mt-6 min-h-[280px] sm:min-h-[240px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative bg-white/[0.02] border border-white/[0.06] p-6 sm:p-8"
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 lg:gap-10">
              {/* Left: Description + Details */}
              <div>
                {/* Title row */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
                    <activeStep.icon className="w-4 h-4 text-accent-primary" />
                  </div>
                  <div>
                    <h4 className="text-lg sm:text-xl font-bold text-white font-display tracking-wide">
                      {activeStep.title}
                    </h4>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm sm:text-base text-white/60 leading-relaxed mb-5 max-w-2xl">
                  {activeStep.description}
                </p>

                {/* Detail bullets */}
                <ul className="space-y-2.5">
                  {activeStep.details.map((detail, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.08, duration: 0.3 }}
                      className="flex items-start gap-3 text-sm text-white/45"
                    >
                      <span className="w-1 h-1 rounded-full bg-accent-primary/60 mt-2 flex-shrink-0" />
                      {detail}
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Right: Stat block */}
              <div className="flex lg:flex-col items-center lg:items-end justify-start lg:justify-center gap-2 lg:gap-1 lg:min-w-[120px]">
                <motion.span
                  className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-accent-primary tabular-nums"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  {activeStep.stat}
                </motion.span>
                <span className="text-xs text-white/30 uppercase tracking-wider font-mono lg:text-right">
                  {activeStep.statLabel}
                </span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
