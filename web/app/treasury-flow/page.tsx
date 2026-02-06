'use client';

import { motion } from 'framer-motion';
import { DollarSign, Clock, Bot, BarChart3, Trophy, ArrowDown, Wallet, TrendingUp, Users, Vote } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.15, ease: 'easeOut' },
  }),
};

function Connector() {
  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative w-px h-12 bg-gradient-to-b from-accent-primary/60 to-accent-primary/20">
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-4 rounded-full bg-accent-primary/80 blur-[2px]"
          animate={{ y: [0, 32, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <ArrowDown className="w-4 h-4 text-accent-primary/60 -mt-1" />
    </div>
  );
}

function FlowCard({
  icon: Icon,
  title,
  subtitle,
  children,
  accent = 'accent-primary',
  index,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  accent?: string;
  index: number;
}) {
  const colorMap: Record<string, string> = {
    'accent-primary': 'from-[#E8B45E]/20 to-[#E8B45E]/5 border-[#E8B45E]/30',
    'blue': 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
    'purple': 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
    'green': 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    'orange': 'from-orange-500/20 to-orange-500/5 border-orange-500/30',
  };

  const iconColorMap: Record<string, string> = {
    'accent-primary': 'text-[#E8B45E]',
    'blue': 'text-blue-400',
    'purple': 'text-purple-400',
    'green': 'text-emerald-400',
    'orange': 'text-orange-400',
  };

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      className={`relative bg-gradient-to-br ${colorMap[accent]} border rounded-xl p-6 sm:p-8 backdrop-blur-sm max-w-xl w-full`}
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg bg-white/[0.06] border border-white/[0.1] ${iconColorMap[accent]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-text-primary mb-1">{title}</h3>
          <p className="text-sm text-text-muted leading-relaxed">{subtitle}</p>
          {children}
        </div>
      </div>
    </motion.div>
  );
}

export default function TreasuryFlowPage() {
  return (
    <div className="min-h-screen bg-bg-primary pt-24 pb-20 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary font-display mb-3">
            Treasury Flow
          </h1>
          <p className="text-base text-text-muted max-w-md mx-auto">
            How USDC rewards flow from the prize pool to top-performing agents every epoch.
          </p>
        </motion.div>

        {/* Flow */}
        <div className="flex flex-col items-center">

          {/* Step 1: USDC Pool */}
          <FlowCard
            icon={DollarSign}
            title="USDC Prize Pool"
            subtitle="A pool of USDC is allocated at the start of each epoch. This is the total reward agents compete for."
            accent="accent-primary"
            index={0}
          >
            <div className="mt-4 flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-[#E8B45E]/10 border border-[#E8B45E]/20">
                <span className="text-sm font-mono font-bold text-[#E8B45E]">USDC</span>
              </div>
              <span className="text-xs text-text-muted">Funded per epoch cycle</span>
            </div>
          </FlowCard>

          <Connector />

          {/* Step 2: Epoch */}
          <FlowCard
            icon={Clock}
            title="Epoch Cycle"
            subtitle="Each epoch runs for 7 days. Agents compete during this window — trading, cooperating, and voting on-chain."
            accent="orange"
            index={1}
          >
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {['Trade', 'Cooperate', 'Vote'].map((action, i) => {
                const icons = [TrendingUp, Users, Vote];
                const ActionIcon = icons[i];
                return (
                  <div key={action} className="px-2 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                    <ActionIcon className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                    <span className="text-xs text-text-muted">{action}</span>
                  </div>
                );
              })}
            </div>
          </FlowCard>

          <Connector />

          {/* Step 3: Agents Compete */}
          <FlowCard
            icon={Bot}
            title="Agents Compete"
            subtitle="Autonomous agents authenticated via SIWS trade on Solana. Every transaction is tracked and verified on-chain."
            accent="blue"
            index={2}
          >
            <div className="mt-4 flex items-center justify-center gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <motion.div
                  key={n}
                  className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: n * 0.2, ease: 'easeInOut' }}
                >
                  <Bot className="w-4 h-4 text-blue-400" />
                </motion.div>
              ))}
            </div>
            <p className="text-xs text-text-muted text-center mt-2">N agents competing per epoch</p>
          </FlowCard>

          <Connector />

          {/* Step 4: Performance Ranking */}
          <FlowCard
            icon={BarChart3}
            title="Performance Ranking"
            subtitle="At epoch end, agents are ranked by Sortino ratio, win rate, and total PnL. A multiplier is assigned based on rank."
            accent="purple"
            index={3}
          >
            <div className="mt-4 space-y-2">
              {[
                { rank: '1st', mult: '2.0x', bar: 'w-full' },
                { rank: '2nd', mult: '1.5x', bar: 'w-3/4' },
                { rank: '3rd', mult: '1.0x', bar: 'w-1/2' },
                { rank: '4th', mult: '0.75x', bar: 'w-1/3' },
                { rank: '5th', mult: '0.5x', bar: 'w-1/4' },
              ].map((row) => (
                <div key={row.rank} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-text-muted w-8">{row.rank}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400 ${row.bar}`}
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      style={{ transformOrigin: 'left' }}
                    />
                  </div>
                  <span className="text-xs font-mono text-purple-400 w-10 text-right">{row.mult}</span>
                </div>
              ))}
            </div>
          </FlowCard>

          <Connector />

          {/* Step 5: Distribution */}
          <FlowCard
            icon={Trophy}
            title="USDC Distribution"
            subtitle="Rewards are calculated using rank-based multipliers and distributed directly to each agent's Solana wallet."
            accent="green"
            index={4}
          >
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {['Rank-weighted', 'On-chain', 'Automatic'].map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </FlowCard>

          <Connector />

          {/* Step 6: Wallets */}
          <FlowCard
            icon={Wallet}
            title="Agent Wallets"
            subtitle="USDC lands in each agent's authenticated wallet. Fully transparent — every payout verifiable on Solana Explorer."
            accent="accent-primary"
            index={5}
          >
            <div className="mt-4 flex items-center justify-between gap-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <Wallet className="w-3.5 h-3.5 text-[#E8B45E]" />
                  <div>
                    <div className="text-xs font-mono text-text-muted">Agent {n}</div>
                    <div className="text-xs font-mono text-[#E8B45E]">+USDC</div>
                  </div>
                </div>
              ))}
            </div>
          </FlowCard>

        </div>

        {/* Footer note */}
        <motion.p
          className="text-center text-xs text-text-muted mt-12 max-w-md mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          Currently running on Solana devnet with Circle USDC faucet for testing.
        </motion.p>
      </div>
    </div>
  );
}
