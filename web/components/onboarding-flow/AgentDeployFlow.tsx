'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Zap, BarChart2, Target, Twitter, CheckCircle } from 'lucide-react';

/* ── Brand ───────────────────────────────────────────────────────── */
const GOLD   = '#2563EB';
const BG     = '#08080F';
const SURF   = '#111118';
const SURF2  = '#1a1a26';
const BORDER = 'rgba(255,255,255,0.07)';

/* ── Step types ──────────────────────────────────────────────────── */
type Step = 'welcome' | 'pick_style' | 'enter_name' | 'connect_twitter' | 'launching' | 'success';

const STEP_ORDER: Step[] = ['welcome', 'pick_style', 'enter_name', 'connect_twitter', 'launching', 'success'];
const STEP_DURATION: Record<Step, number> = {
  welcome:         3200,
  pick_style:      4000,
  enter_name:      3600,
  connect_twitter: 3400,
  launching:       2800,
  success:         4000,
};

const STYLES = [
  { id: 'phantom', Icon: Eye,       label: 'PHANTOM',  desc: 'Ghost-mode execution. Follows smart money silently.' },
  { id: 'apex',    Icon: Zap,       label: 'APEX',     desc: 'Aggressive first-mover. Catches narratives at source.' },
  { id: 'oracle',  Icon: BarChart2, label: 'ORACLE',   desc: 'Signal-driven. Waits for multi-source confirmation.' },
  { id: 'vector',  Icon: Target,    label: 'VECTOR',   desc: 'Rapid scalper. High frequency, quick exits.' },
];

const BUBBLES: Record<Step, string> = {
  welcome:         "I'm Molt. Let's get your agent live — it trades and broadcasts calls while you sleep.",
  pick_style:      "Each profile has a different edge. Pick the one that matches your strategy.",
  enter_name:      "Give your agent a callsign. It carries this into every battle.",
  connect_twitter: "Link your X account so your agent broadcasts calls to your followers in real time.",
  launching:       "Deploying to the arena...",
  success:         "Agent live. Your first call drops when the next signal hits.",
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
        className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden flex-shrink-0"
        style={{ border: `1px solid ${GOLD}30` }}
      >
        <Image src="/pfp.png" alt="Molt" width={32} height={32} className="w-full h-full object-cover" />
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
            className="relative w-20 h-20 rounded-full overflow-hidden"
            style={{ border: `2px solid ${GOLD}40` }}
          >
            <Image src="/pfp.png" alt="Trench Terminal" width={80} height={80} className="w-full h-full object-cover" />
          </div>
        </motion.div>

        <div className="text-center">
          <div className="text-lg font-black text-white" style={{ fontFamily: 'monospace', letterSpacing: '-0.5px' }}>
            Trench Terminal
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            AI-Powered Portfolio Intelligence
          </div>
        </div>

        {/* Step hints */}
        <div className="w-full space-y-2">
          {['Pick your agent profile', 'Name your agent', 'Connect X account', 'Start managing'].map((label, i) => (
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
          Deploy Agent →
        </motion.div>
      </div>
    </div>
  );
}

/* ── SCREEN: Pick Style ──────────────────────────────────────────── */
function PickStyleScreen() {
  const [selected, setSelected] = useState('phantom');
  useEffect(() => {
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
        <div className="text-sm font-black text-white" style={{ fontFamily: 'monospace' }}>Agent Profile</div>
        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Choose your operational mode</div>
      </div>

      <div className="flex-1 px-4 space-y-2 overflow-hidden">
        {STYLES.map(({ id, Icon, label, desc }, i) => {
          const active = selected === id;
          return (
            <motion.div
              key={id}
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
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: active ? `${GOLD}20` : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? `${GOLD}40` : BORDER}` }}
              >
                <Icon size={14} style={{ color: active ? GOLD : 'rgba(255,255,255,0.35)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-black tracking-wide" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.55)', fontFamily: 'monospace' }}>{label}</div>
                <div className="text-[9px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>{desc}</div>
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
  const typed = useTypedText('GhostOp', true, 110);
  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <div className="px-5 pt-2 pb-3">
        <div className="text-sm font-black text-white" style={{ fontFamily: 'monospace' }}>Agent Callsign</div>
        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Your identity in the arena</div>
      </div>

      <div className="flex-1 px-4 pt-2">
        <div
          className="w-full px-4 py-3 rounded-xl flex items-center gap-2"
          style={{ background: SURF, border: `1.5px solid ${typed ? `${GOLD}60` : BORDER}`, transition: 'border-color 0.3s' }}
        >
          <span className="text-[14px] font-semibold text-white tracking-wide flex-1" style={{ fontFamily: 'monospace' }}>
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

        <div className="flex flex-wrap gap-1.5 mt-3">
          {['GhostOp', 'Apex7', 'OracleX', 'VectorMX'].map((name, i) => (
            <motion.div
              key={name}
              className="px-2.5 py-1 rounded-lg text-[9px] font-mono"
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
          style={{
            background: typed.length > 0 ? GOLD : 'rgba(37,99,235,0.15)',
            color: typed.length > 0 ? '#08080F' : `${GOLD}40`,
            fontFamily: 'monospace',
            transition: 'all 0.4s ease',
          }}
        >
          Next →
        </div>
      </div>
    </div>
  );
}

/* ── SCREEN: Connect Twitter ─────────────────────────────────────── */
function ConnectTwitterScreen() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setConnected(true), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <StatusBar />
      <div className="px-5 pt-2 pb-3">
        <div className="text-sm font-black text-white" style={{ fontFamily: 'monospace' }}>Connect X Account</div>
        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Your agent broadcasts calls to your followers</div>
      </div>

      <div className="flex-1 px-4 pt-2 flex flex-col gap-3">
        {/* Twitter connect card */}
        <motion.div
          className="w-full px-4 py-4 rounded-xl flex items-center gap-3"
          style={{ background: SURF, border: `1.5px solid ${connected ? 'rgba(29,155,240,0.4)' : BORDER}`, transition: 'border-color 0.4s' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: connected ? 'rgba(29,155,240,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${connected ? 'rgba(29,155,240,0.3)' : BORDER}`, transition: 'all 0.4s' }}
          >
            <Twitter size={16} style={{ color: connected ? '#1D9BF0' : 'rgba(255,255,255,0.35)' }} />
          </div>
          <div className="flex-1 min-w-0">
            {connected ? (
              <>
                <div className="text-[11px] font-bold text-white">@soltrader</div>
                <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>2.4K followers · Connected</div>
              </>
            ) : (
              <>
                <div className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>Not connected</div>
                <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>Tap to link your account</div>
              </>
            )}
          </div>
          {connected && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
              <CheckCircle size={16} style={{ color: '#1D9BF0', flexShrink: 0 }} />
            </motion.div>
          )}
        </motion.div>

        {/* What your agent will post */}
        <motion.div
          className="w-full px-4 py-3 rounded-xl space-y-2"
          style={{ background: SURF, border: `1px solid ${BORDER}` }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-[9px] font-black tracking-wider uppercase" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>Agent will post</div>
          {['Trade signals & entries', 'PnL updates', 'Arena rankings'].map((item, i) => (
            <div key={item} className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: GOLD }} />
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{item}</span>
            </div>
          ))}
        </motion.div>

        {/* Skip */}
        <motion.div
          className="text-center text-[9px]"
          style={{ color: 'rgba(255,255,255,0.25)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Skip for now — connect later in settings
        </motion.div>
      </div>

      <div className="px-5 pb-4">
        <CharBubble msg={BUBBLES.connect_twitter} />
        <motion.div
          className="w-full py-3 rounded-xl text-[13px] font-black text-center"
          style={{ background: connected ? GOLD : 'rgba(29,155,240,0.85)', color: '#fff', fontFamily: 'monospace', transition: 'background 0.4s' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {connected ? 'Deploy Agent →' : 'Connect X Account'}
        </motion.div>
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
            className="relative w-20 h-20 rounded-full overflow-hidden z-10"
            style={{ border: `2px solid ${GOLD}50` }}
          >
            <Image src="/pfp.png" alt="Trench Terminal" width={80} height={80} className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="text-center">
          <div className="text-sm font-black text-white mb-1" style={{ fontFamily: 'monospace' }}>Deploying...</div>
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Your agent is initializing portfolio</div>
        </div>

        <DotLoader />

        <div className="w-52 space-y-1.5">
          {['Identity verified', 'Strategy compiled', 'X account linked', 'Entering arena...'].map((label, i) => (
            <motion.div
              key={label}
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.45 }}
            >
              <motion.div
                className="w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ border: `1.5px solid ${GOLD}` }}
                animate={{ background: [`${GOLD}00`, GOLD] }}
                transition={{ delay: 0.6 + i * 0.45, duration: 0.3 }}
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: BG }}
                  animate={{ opacity: [0, 1] }}
                  transition={{ delay: 0.7 + i * 0.45 }}
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
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 250, damping: 18 }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.12)', border: '2px solid rgba(52,211,153,0.4)' }}
          >
            <CheckCircle size={32} style={{ color: 'rgba(52,211,153,0.9)' }} />
          </div>
        </motion.div>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="text-base font-black text-white mb-1" style={{ fontFamily: 'monospace' }}>Agent Deployed</div>
          <div className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Operational. First signal drops automatically.
          </div>
        </motion.div>

        <motion.div
          className="grid grid-cols-3 gap-2 w-full"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          {[
            { label: 'Rank',      value: '#—' },
            { label: 'Signals',   value: '0' },
            { label: 'XP',        value: '0' },
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
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}
          >
            <Eye size={16} style={{ color: GOLD }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-white font-mono">GhostOp</div>
            <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>PHANTOM · @soltrader</div>
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
          Enter the Arena →
        </motion.div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
const SCREENS: Record<Step, React.FC> = {
  welcome:         WelcomeScreen,
  pick_style:      PickStyleScreen,
  enter_name:      EnterNameScreen,
  connect_twitter: ConnectTwitterScreen,
  launching:       LaunchingScreen,
  success:         SuccessScreen,
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
