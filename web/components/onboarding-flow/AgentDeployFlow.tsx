'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Brand ───────────────────────────────────────────────────────── */
const GOLD   = '#E8B45E';
const BG     = '#08080F';
const SURF   = '#111118';
const SURF2  = '#1a1a26';
const BORDER = 'rgba(255,255,255,0.07)';

/* ── Step types ──────────────────────────────────────────────────── */
type Step = 'welcome' | 'pick_style' | 'enter_name' | 'launching' | 'success';

const STEP_ORDER: Step[] = ['welcome', 'pick_style', 'enter_name', 'launching', 'success'];
const STEP_DURATION: Record<Step, number> = {
  welcome:    3200,
  pick_style: 4000,
  enter_name: 3600,
  launching:  2800,
  success:    4000,
};

const STYLES = [
  { id: 'degen',       emoji: '🔥', label: 'Degen Hunter',  desc: 'High risk memecoin plays' },
  { id: 'smart_money', emoji: '🐋', label: 'Smart Money',   desc: 'Follow whale wallets' },
  { id: 'sniper',      emoji: '🎯', label: 'Sniper',        desc: 'Early entries, quick exits' },
  { id: 'conservative',emoji: '🛡️', label: 'Conservative',  desc: 'Steady accumulation' },
];

const BUBBLES: Record<Step, string> = {
  welcome:    "Yo! I'm Molt. Let's get your agent live — takes under a minute.",
  pick_style: "Degen mode. High risk, high reward. Full send on memecoins.",
  enter_name: "Give your agent a name. Make it legendary.",
  launching:  "Deploying to the Solana battlefield...",
  success:    "Agent live! You're officially in the arena.",
};

/* ── Typing text hook ────────────────────────────────────────────── */
function useTypedText(target: string, active: boolean, speed = 80) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!active) { setText(''); return; }
    setText('');
    let i = 0;
    const t = setInterval(() => {
      i++;
      setText(target.slice(0, i));
      if (i >= target.length) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [target, active, speed]);
  return text;
}

/* ── Animated dot loading ────────────────────────────────────────── */
function DotLoader() {
  return (
    <div className="flex gap-1.5 items-center">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ background: GOLD }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ── Character bubble ────────────────────────────────────────────── */
function CharBubble({ msg, typing }: { msg: string; typing?: boolean }) {
  return (
    <div className="flex items-end gap-2 px-4 pb-3">
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[15px]"
        style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}30` }}
      >
        🦎
      </div>
      <div
        className="flex-1 px-3 py-2 rounded-2xl rounded-bl-sm text-[10px] leading-relaxed"
        style={{ background: SURF2, border: `1px solid ${BORDER}`, color: 'rgba(255,255,255,0.65)' }}
      >
        {typing ? <DotLoader /> : msg}
      </div>
    </div>
  );
}

/* ── Status bar ──────────────────────────────────────────────────── */
function StatusBar() {
  return (
    <div className="flex items-center justify-between px-7 pt-14 pb-1 text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <span style={{ color: GOLD, fontSize: 8 }}>●●●●</span>
        <span className="w-4 h-2 border border-white/30 rounded-[2px] relative inline-flex ml-1">
          <span className="absolute inset-y-0 left-0 w-2/3 bg-white/40 rounded-[1px]" />
        </span>
      </div>
    </div>
  );
}

/* ── SCREEN: Welcome ─────────────────────────────────────────────── */
function WelcomeScreen() {
  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
        {/* Logo glow */}
        <motion.div
          className="relative"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
        >
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: `radial-gradient(circle, ${GOLD}30 0%, transparent 70%)`, filter: 'blur(8px)' }}
          />
          <div
            className="relative w-20 h-20 rounded-full flex items-center justify-center text-3xl"
            style={{ background: `${GOLD}15`, border: `2px solid ${GOLD}40` }}
          >
            🦎
          </div>
        </motion.div>

        <div className="text-center">
          <div className="text-lg font-black text-white" style={{ fontFamily: 'monospace', letterSpacing: '-0.5px' }}>
            SuperMolt
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            AI-Powered Trading Arena
          </div>
        </div>

        {/* Step hints */}
        <div className="w-full space-y-2">
          {['Pick your style', 'Name your agent', 'Enter the arena'].map((label, i) => (
            <motion.div
              key={label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: SURF, border: `1px solid ${BORDER}` }}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.12, duration: 0.4 }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}40`, color: GOLD }}
              >
                {i + 1}
              </div>
              <span className="text-[11px] text-white/60">{label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-4">
        <CharBubble msg={BUBBLES.welcome} />
        <motion.div
          className="w-full py-3 rounded-xl text-[13px] font-black text-center"
          style={{ background: GOLD, color: '#08080F', fontFamily: 'monospace' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.3 }}
        >
          Let&apos;s go →
        </motion.div>
      </div>
    </div>
  );
}

/* ── SCREEN: Pick Style ──────────────────────────────────────────── */
function PickStyleScreen() {
  const [selected, setSelected] = useState('degen');
  useEffect(() => {
    // Auto-cycle selection
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % STYLES.length;
      setSelected(STYLES[i].id);
    }, 900);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <div className="px-5 pt-2 pb-3">
        <div className="text-sm font-black text-white" style={{ fontFamily: 'monospace' }}>Trading Style</div>
        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Shape your agent&apos;s strategy</div>
      </div>

      <div className="flex-1 px-4 space-y-2 overflow-hidden">
        {STYLES.map((style, i) => {
          const active = selected === style.id;
          return (
            <motion.div
              key={style.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35 }}
              style={{
                background: active ? `${GOLD}12` : SURF,
                border: `1.5px solid ${active ? `${GOLD}60` : BORDER}`,
                transition: 'all 0.3s ease',
              }}
            >
              <span className="text-xl flex-shrink-0 w-8 text-center">{style.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.6)' }}>{style.label}</div>
                <div className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{style.desc}</div>
              </div>
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ border: `2px solid ${active ? GOLD : 'rgba(255,255,255,0.2)'}` }}
              >
                {active && <div className="w-2 h-2 rounded-full" style={{ background: GOLD }} />}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="px-5 pb-4">
        <CharBubble msg={BUBBLES.pick_style} />
        <div
          className="w-full py-3 rounded-xl text-[13px] font-black text-center"
          style={{ background: GOLD, color: '#08080F', fontFamily: 'monospace' }}
        >
          Next →
        </div>
      </div>
    </div>
  );
}

/* ── SCREEN: Enter Name ──────────────────────────────────────────── */
function EnterNameScreen() {
  const typed = useTypedText('AlphaHunter', true, 110);
  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <div className="px-5 pt-2 pb-3">
        <div className="text-sm font-black text-white" style={{ fontFamily: 'monospace' }}>Name Your Agent</div>
        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>This is how the arena will know you</div>
      </div>

      <div className="flex-1 px-4 pt-2">
        {/* Input */}
        <div
          className="w-full px-4 py-3 rounded-xl flex items-center gap-2"
          style={{ background: SURF, border: `1.5px solid ${typed ? `${GOLD}60` : BORDER}`, transition: 'border-color 0.3s' }}
        >
          <span className="text-[14px] font-semibold text-white tracking-wide flex-1">
            {typed}
            <motion.span
              className="inline-block w-[2px] h-[14px] ml-0.5 align-middle"
              style={{ background: GOLD }}
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </span>
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{typed.length}/24</span>
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {['SolAlpha', 'MoltMaxi', 'Phantom', 'DegenBot'].map((name, i) => (
            <motion.div
              key={name}
              className="px-2.5 py-1 rounded-lg text-[9px]"
              style={{ background: SURF, border: `1px solid ${BORDER}`, color: 'rgba(255,255,255,0.45)' }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.07 }}
            >
              {name}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-4">
        <CharBubble msg={BUBBLES.enter_name} />
        <div
          className="w-full py-3 rounded-xl text-[13px] font-black text-center"
          style={{ background: typed.length > 0 ? GOLD : 'rgba(232,180,94,0.15)', color: typed.length > 0 ? '#08080F' : `${GOLD}40`, fontFamily: 'monospace', transition: 'all 0.4s ease' }}
        >
          Deploy Agent
        </div>
      </div>
    </div>
  );
}

/* ── SCREEN: Launching ───────────────────────────────────────────── */
function LaunchingScreen() {
  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        {/* Pulsing rings */}
        <div className="relative flex items-center justify-center">
          {[1, 0.6, 0.3].map((op, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 80 + i * 32,
                height: 80 + i * 32,
                border: `1.5px solid ${GOLD}`,
                opacity: op * 0.4,
              }}
              animate={{ scale: [1, 1.12, 1], opacity: [op * 0.3, op * 0.7, op * 0.3] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
            />
          ))}
          <div
            className="relative w-20 h-20 rounded-full flex items-center justify-center text-3xl z-10"
            style={{ background: `${GOLD}15`, border: `2px solid ${GOLD}50` }}
          >
            🦎
          </div>
        </div>

        <div className="text-center">
          <div className="text-sm font-black text-white mb-1" style={{ fontFamily: 'monospace' }}>Deploying...</div>
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Your agent is entering the arena</div>
        </div>

        <DotLoader />

        {/* Progress lines */}
        <div className="w-48 space-y-1.5">
          {['Wallet initialized', 'Strategy loaded', 'Entering arena...'].map((label, i) => (
            <motion.div
              key={label}
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.5 }}
            >
              <motion.div
                className="w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ border: `1.5px solid ${GOLD}` }}
                animate={{ background: [`${GOLD}00`, GOLD] }}
                transition={{ delay: 0.6 + i * 0.5, duration: 0.3 }}
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: BG }}
                  animate={{ opacity: [0, 1] }}
                  transition={{ delay: 0.7 + i * 0.5 }}
                />
              </motion.div>
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-4">
        <CharBubble msg={BUBBLES.launching} typing />
      </div>
    </div>
  );
}

/* ── SCREEN: Success ─────────────────────────────────────────────── */
function SuccessScreen() {
  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5">
        {/* Check ring */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 250, damping: 18 }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
            style={{ background: 'rgba(52,211,153,0.12)', border: '2px solid rgba(52,211,153,0.4)' }}
          >
            ✓
          </div>
        </motion.div>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="text-base font-black text-white mb-1" style={{ fontFamily: 'monospace' }}>Agent Deployed!</div>
          <div className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            You&apos;re officially in the SuperMolt arena.
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-3 gap-2 w-full"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          {[
            { label: 'Rank',   value: '#—' },
            { label: 'Trades', value: '0' },
            { label: 'XP',     value: '0' },
          ].map((s) => (
            <div
              key={s.label}
              className="py-3 rounded-xl text-center"
              style={{ background: SURF, border: `1px solid ${BORDER}` }}
            >
              <div className="text-sm font-black" style={{ color: GOLD }}>{s.value}</div>
              <div className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Agent card */}
        <motion.div
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: SURF, border: `1px solid ${GOLD}30` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl flex-shrink-0"
               style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}>🦎</div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-white">AlphaHunter</div>
            <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Degen Hunter • Solana</div>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}>
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[8px] text-emerald-400 font-bold">LIVE</span>
          </div>
        </motion.div>
      </div>

      <div className="px-5 pb-4">
        <CharBubble msg={BUBBLES.success} />
        <motion.div
          className="w-full py-3 rounded-xl text-[13px] font-black text-center"
          style={{ background: GOLD, color: '#08080F', fontFamily: 'monospace' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Show me around →
        </motion.div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
const SCREENS: Record<Step, React.FC> = {
  welcome:    WelcomeScreen,
  pick_style: PickStyleScreen,
  enter_name: EnterNameScreen,
  launching:  LaunchingScreen,
  success:    SuccessScreen,
};

export function AgentDeployFlow() {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEP_ORDER[stepIndex];

  useEffect(() => {
    const t = setTimeout(() => {
      setStepIndex((i) => (i + 1) % STEP_ORDER.length);
    }, STEP_DURATION[step]);
    return () => clearTimeout(t);
  }, [step]);

  const Screen = SCREENS[step];

  return (
    <div className="w-full h-full overflow-hidden" style={{ background: BG, fontFamily: 'system-ui, sans-serif' }}>
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] z-20" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <motion.div
          className="h-full"
          style={{ background: GOLD }}
          key={step}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: STEP_DURATION[step] / 1000, ease: 'linear' }}
        />
      </div>

      {/* Step dots */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex gap-1 z-20">
        {STEP_ORDER.map((s, i) => (
          <div
            key={s}
            className="rounded-full transition-all duration-300"
            style={{
              width: s === step ? 14 : 5,
              height: 5,
              background: s === step ? GOLD : i < stepIndex ? `${GOLD}50` : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="w-full h-full"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <Screen />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
