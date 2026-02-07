'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Trophy, Bot, Twitter, MessageCircle, Gem, BookOpen, Wallet, Lock, type LucideIcon } from 'lucide-react';

interface QuestsLeaderboardsDemoProps {
  className?: string;
}

// Hook to detect if we're on mobile
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = (): void => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// Animated CountUp hook
function useCountUp(targetValue: number, isActive: boolean, duration: number = 1500): number {
  const [value, setValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setValue(0);
      startTimeRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      return;
    }

    const animate = (currentTime: number): void => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setValue(Math.round(eased * targetValue));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isActive, targetValue, duration]);

  return value;
}

// Format number with K suffix for thousands
function formatPoints(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return value.toString();
}

// USDC Pool Counter for Rewards View
function USDCPoolCounter({ isActive }: { isActive: boolean }): ReactNode {
  const poolAmount = useCountUp(1000, isActive, 2000);
  return <>{poolAmount.toLocaleString()} USDC</>;
}

// SVG Icons
function CheckIcon({ className }: { className?: string }): ReactNode {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }): ReactNode {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function USDCIcon({ className }: { className?: string }): ReactNode {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icons/usdc.png" alt="USDC" className={className} />
  );
}


// Toast notification component
function Toast({
  points,
  isVisible,
  countUpActive,
}: {
  points: number;
  isVisible: boolean;
  countUpActive: boolean;
}): ReactNode {
  const displayPoints = useCountUp(points, countUpActive, 800);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, x: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="absolute -right-2 -top-2 z-50"
        >
          <motion.div
            className={cn(
              'flex items-center gap-3 rounded-sm px-4 py-3',
              'border-accent-primary/50 border bg-white/[0.04] backdrop-blur-xl',
              'shadow-accent-primary/20 shadow-lg'
            )}
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(232, 180, 94, 0.2)',
                '0 0 20px 4px rgba(232, 180, 94, 0.3)',
                '0 0 0 0 rgba(232, 180, 94, 0.2)',
              ],
            }}
            transition={{ duration: 1.5, repeat: 1 }}
          >
            <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 0.5, delay: 0.2 }}>
              <StarIcon className="text-accent-primary h-5 w-5" />
            </motion.div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-400">Claimed!</span>
              <span className="text-accent-primary text-lg font-bold">+{displayPoints} PTS</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Quest phases for storytelling
type QuestPhase =
  | 'idle'
  | 'quest_available'
  | 'quest_ready'
  | 'claiming'
  | 'celebration'
  | 'complete';
type LeaderboardPhase =
  | 'idle'
  | 'show_board'
  | 'points_incoming'
  | 'climbing'
  | 'podium'
  | 'complete';
type RewardsPhase =
  | 'idle'
  | 'show_pool'
  | 'calculate'
  | 'distribute'
  | 'celebrate'
  | 'complete';

interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  change: 'up' | 'down' | 'same';
  isYou?: boolean;
}

interface ClimbEntry {
  rank: number;
  name: string;
  points: number;
  isYou?: boolean;
}

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: 'DiamondHands', points: 2450, change: 'same' },
  { rank: 2, name: 'MoonWatcher', points: 2100, change: 'up' },
  { rank: 3, name: 'CryptoKing', points: 1850, change: 'down' },
  { rank: 4, name: 'SatoshiFan', points: 1700, change: 'up' },
  { rank: 5, name: 'You', points: 1650, change: 'same', isYou: true },
  { rank: 6, name: 'HODLer', points: 1400, change: 'down' },
];

// Slot machine climbing constants - responsive
const CLIMB_ITEM_HEIGHT = 44;
const CLIMB_ITEM_HEIGHT_DESKTOP = 52;
const VISIBLE_CLIMB_ITEMS = 4;
const VISIBLE_CLIMB_ITEMS_DESKTOP = 6;

// Names for generating middle ranks
const RANDOM_NAMES = [
  'ApeKing',
  'MoonShot',
  'DeFiGod',
  'TokenLord',
  'ChadPump',
  'GMwagmi',
  'SolMaxi',
  'EthBull',
  'BagHunter',
  'RektProof',
];

// Generate full climbing entries
const CLIMB_ENTRIES: ClimbEntry[] = [
  { rank: 1, name: 'DiamondHands', points: 2450 },
  { rank: 2, name: 'You', points: 2380, isYou: true },
  { rank: 3, name: 'MoonWatcher', points: 2350 },
  { rank: 4, name: 'CryptoKing', points: 2190 },
  { rank: 5, name: 'SatoshiFan', points: 2100 },
  { rank: 6, name: 'HODLer', points: 2000 },
  { rank: 7, name: 'WhaleAlert', points: 1950 },
  ...Array.from({ length: 40 }, (_, i) => ({
    rank: 8 + i,
    name: RANDOM_NAMES[i % RANDOM_NAMES.length]!,
    points: 1900 - i * 15,
  })),
  { rank: 244, name: 'PaperHands', points: 1700 },
  { rank: 245, name: 'DipBuyer', points: 1690 },
  { rank: 246, name: 'GasGuzzler', points: 1680 },
  { rank: 247, name: 'BagHolder', points: 1660 },
  { rank: 248, name: 'You', points: 1650, isYou: true },
  { rank: 249, name: 'FOMOchaser', points: 1640 },
  { rank: 250, name: 'RugPulled', points: 1620 },
  { rank: 251, name: 'LateApe', points: 1600 },
  { rank: 252, name: 'SellLow', points: 1580 },
  { rank: 253, name: 'NoLambo', points: 1560 },
  { rank: 254, name: 'StillHODL', points: 1540 },
  { rank: 255, name: 'Copium', points: 1520 },
  { rank: 256, name: 'Hopium', points: 1500 },
  { rank: 257, name: 'McWagies', points: 1480 },
  { rank: 258, name: 'Liquidated', points: 1460 },
  { rank: 259, name: 'LastPlace', points: 1440 },
  { rank: 260, name: 'RektAgain', points: 1420 },
];

const AVATAR_COLORS = [
  'border-amber-400/30 text-amber-400/80',
  'border-white/[0.15] text-white/50',
  'border-orange-400/30 text-orange-400/70',
  'border-purple-400/30 text-purple-400/70',
  'border-emerald-400/30 text-emerald-400/70',
  'border-cyan-400/30 text-cyan-400/70',
];

// Slot machine row for climbing animation
function ClimbRow({ entry, isClimbing, itemHeight }: { entry: ClimbEntry; isClimbing: boolean; itemHeight: number }): ReactNode {
  const isTop3 = entry.rank <= 3;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 px-3 lg:gap-3 lg:px-4',
        'border-b border-white/[0.06]',
        entry.isYou && 'border-accent-primary border-l-2'
      )}
      style={{ height: itemHeight }}
    >
      <span
        className={cn(
          'w-10 text-center text-base font-bold tabular-nums',
          entry.isYou ? 'text-accent-primary' : isTop3 ? 'text-amber-400' : 'text-text-muted'
        )}
      >
        #{entry.rank}
      </span>

      {entry.isYou && isClimbing && (
        <motion.span
          className="text-sm text-emerald-400"
          animate={{ y: [0, -2, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.4, repeat: Infinity }}
        >
          ▲▲
        </motion.span>
      )}

      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-sm border bg-white/[0.04] backdrop-blur-sm',
          entry.isYou
            ? 'border-accent-primary/40 text-accent-primary'
            : AVATAR_COLORS[entry.rank % AVATAR_COLORS.length]
        )}
      >
        <Bot className="h-4 w-4" />
      </div>

      <span
        className={cn(
          'flex-1 truncate text-sm font-medium',
          entry.isYou ? 'text-accent-primary' : 'text-white'
        )}
      >
        {entry.name}
        {entry.isYou && <span className="ml-1 text-text-muted">(You)</span>}
      </span>

      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          entry.isYou ? 'text-accent-primary' : 'text-text-muted'
        )}
      >
        {formatPoints(entry.points)}
      </span>
    </div>
  );
}

// Slot machine leaderboard container
function SlotMachineLeaderboard({
  entries,
  scrollOffset,
  isClimbing,
  currentRank,
  currentPoints,
  hasLanded,
  isMobile,
}: {
  entries: ClimbEntry[];
  scrollOffset: number;
  isClimbing: boolean;
  currentRank: number;
  currentPoints: number;
  hasLanded: boolean;
  isMobile: boolean;
}): ReactNode {
  const isTop3 = currentRank <= 3;
  const itemHeight = isMobile ? CLIMB_ITEM_HEIGHT : CLIMB_ITEM_HEIGHT_DESKTOP;
  const visibleItems = isMobile ? VISIBLE_CLIMB_ITEMS : VISIBLE_CLIMB_ITEMS_DESKTOP;
  const youCenterOffset = (visibleItems * itemHeight) / 2 - itemHeight / 2;

  return (
    <div className="relative h-full">
      {/* Speed lines during climb */}
      {isClimbing && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          {[...Array(isMobile ? 4 : 6)].map((_, i) => (
            <motion.div
              key={i}
              className="via-accent-primary/30 absolute left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent"
              style={{ top: `${15 + i * (isMobile ? 20 : 15)}%` }}
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 0.3, repeat: Infinity, delay: i * 0.05 }}
            />
          ))}
        </div>
      )}

      {/* Scroll container */}
      <div
        className="relative overflow-hidden rounded-sm border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl"
        style={{ height: visibleItems * itemHeight }}
      >
        {/* Background scrolling entries */}
        <div
          className="flex flex-col opacity-40"
          style={{
            transform: `translateY(-${scrollOffset}px)`,
            willChange: 'transform',
          }}
        >
          {entries
            .filter((e) => !e.isYou)
            .map((entry, idx) => (
              <ClimbRow key={`${entry.rank}-${idx}`} entry={entry} isClimbing={isClimbing} itemHeight={itemHeight} />
            ))}
        </div>

        {/* Fade gradients */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-black to-transparent lg:h-8" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-black to-transparent lg:h-8" />

        {/* FIXED "You" overlay */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 z-30"
          style={{ top: youCenterOffset, height: itemHeight }}
          initial={{ y: -20, opacity: 0, scale: 0.95 }}
          animate={
            hasLanded ? { y: [0, 8, 0], opacity: 1, scale: 1 } : { y: 0, opacity: 1, scale: 1 }
          }
          transition={
            hasLanded
              ? { y: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }, opacity: { duration: 0.2 } }
              : { duration: 0.3, ease: 'easeOut' }
          }
        >
          <motion.div
            className={cn(
              'absolute inset-0 border-y-2 transition-colors duration-300',
              isClimbing ? 'border-accent-primary bg-black/80 backdrop-blur-xl' : 'border-accent-primary/50 bg-black/60 backdrop-blur-xl'
            )}
            animate={
              hasLanded
                ? {
                    boxShadow: [
                      '0 0 0px rgba(232,180,94,0)',
                      '0 0 40px rgba(232,180,94,0.6)',
                      '0 0 25px rgba(232,180,94,0.3)',
                    ],
                  }
                : isClimbing
                  ? { boxShadow: '0 0 25px rgba(232,180,94,0.4)' }
                  : { boxShadow: '0 0 0px rgba(232,180,94,0)' }
            }
            transition={{ duration: 0.5 }}
          />

          {/* Left side gradient fade overlay */}
          <motion.div
            className="absolute left-0 top-0 bottom-0 w-6 lg:w-10"
            style={{
              background: isClimbing
                ? 'linear-gradient(to right, rgba(232,180,94,0.25) 0%, rgba(232,180,94,0.08) 40%, transparent 100%)'
                : 'linear-gradient(to right, rgba(232,180,94,0.15) 0%, transparent 100%)',
            }}
            animate={
              isClimbing
                ? { opacity: [0.6, 1, 0.6] }
                : { opacity: 1 }
            }
            transition={{ duration: 0.8, repeat: isClimbing ? Infinity : 0 }}
          />

          {/* Right side gradient fade overlay */}
          <motion.div
            className="absolute right-0 top-0 bottom-0 w-6 lg:w-10"
            style={{
              background: isClimbing
                ? 'linear-gradient(to left, rgba(232,180,94,0.25) 0%, rgba(232,180,94,0.08) 40%, transparent 100%)'
                : 'linear-gradient(to left, rgba(232,180,94,0.15) 0%, transparent 100%)',
            }}
            animate={
              isClimbing
                ? { opacity: [0.6, 1, 0.6] }
                : { opacity: 1 }
            }
            transition={{ duration: 0.8, repeat: isClimbing ? Infinity : 0, delay: 0.4 }}
          />

          {/* Fixed You content */}
          <div className="relative flex h-full items-center gap-2 px-3 lg:gap-3 lg:px-4">
            <motion.span
              className={cn(
                'w-10 text-center text-base font-bold tabular-nums lg:w-12 lg:text-lg',
                isTop3 ? 'text-amber-400' : 'text-accent-primary'
              )}
              key={currentRank}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              #{currentRank}
            </motion.span>

            {isClimbing && (
              <motion.span
                className="text-base text-emerald-400 lg:text-lg"
                animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.25, repeat: Infinity }}
              >
                ▲
              </motion.span>
            )}

            <motion.div
              className="flex h-7 w-7 items-center justify-center rounded-sm border border-accent-primary/40 bg-accent-primary/[0.1] text-accent-primary shadow-[0_0_12px_rgba(232,180,94,0.2)] backdrop-blur-sm lg:h-9 lg:w-9"
              animate={hasLanded ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Bot className="h-4 w-4 lg:h-5 lg:w-5" />
            </motion.div>

            <span className="text-accent-primary flex-1 text-sm font-semibold lg:text-base">You</span>

            <motion.span
              className="text-accent-primary text-sm font-bold tabular-nums lg:text-base"
              key={currentPoints}
              animate={hasLanded ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              {formatPoints(currentPoints)}
            </motion.span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Minimal podium spot
function PodiumSpot({
  entry,
  place,
  isYou,
}: {
  entry?: LeaderboardEntry;
  place: 1 | 2 | 3;
  isYou?: boolean;
}): ReactNode {
  const heights: Record<1 | 2 | 3, string> = { 1: 'h-16 lg:h-24', 2: 'h-12 lg:h-20', 3: 'h-10 lg:h-16' };
  const podiumColors: Record<1 | 2 | 3, string> = {
    1: 'bg-amber-400/[0.08] border-amber-400/40 shadow-[0_0_24px_rgba(251,191,36,0.25),inset_0_1px_0_rgba(251,191,36,0.15)]',
    2: 'bg-white/[0.05] border-white/[0.2] shadow-[0_0_18px_rgba(255,255,255,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]',
    3: isYou
      ? 'bg-accent-primary/[0.1] border-accent-primary/40 shadow-[0_0_24px_rgba(232,180,94,0.3),inset_0_1px_0_rgba(232,180,94,0.15)]'
      : 'bg-orange-400/[0.06] border-orange-400/30 shadow-[0_0_16px_rgba(251,146,60,0.15),inset_0_1px_0_rgba(251,146,60,0.1)]',
  };
  const staggerDelays: Record<1 | 2 | 3, number> = { 1: 0.15, 2: 0.05, 3: 0.25 };

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 350,
        damping: 25,
        delay: staggerDelays[place],
      }}
    >
      <motion.div
        className={cn(
          heights[place],
          'flex w-20 flex-col items-center justify-center rounded-t-sm border-t border-l border-r lg:w-32',
          'backdrop-blur-xl',
          podiumColors[place]
        )}
        animate={isYou ? { y: [0, -4, 0] } : {}}
        transition={{
          duration: 0.5,
          repeat: 2,
          ease: [0.4, 0, 0.2, 1],
          delay: isYou ? 0.4 : 0,
        }}
      >
        <span className={cn('text-xl font-black lg:text-3xl', isYou ? 'text-accent-primary' : 'text-white/80')}>
          {place}
        </span>
      </motion.div>

      <div className="mt-2 text-center lg:mt-3">
        <p
          className={cn(
            'max-w-[80px] truncate text-sm font-semibold lg:max-w-[120px] lg:text-base',
            isYou ? 'text-accent-primary' : 'text-white'
          )}
        >
          {entry?.name}
        </p>
        <p className={cn('text-xs tabular-nums lg:text-sm', isYou ? 'text-accent-primary/80' : 'text-text-muted')}>
          {entry?.points ? formatPoints(entry.points) : ''}
        </p>
      </div>
    </motion.div>
  );
}

// Clean horizontal podium component
function CompactPodium({ entries }: { entries: LeaderboardEntry[] }): ReactNode {
  const first = entries[0];
  const second = entries[1];
  const third = entries[2];

  return (
    <motion.div
      initial={{ opacity: 0, y: 25, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 280,
        damping: 24,
        mass: 0.9,
        delay: 0.1,
      }}
      className="flex items-end justify-center gap-2 py-2 lg:gap-4 lg:py-3"
    >
      <PodiumSpot entry={second} place={2} isYou={second?.isYou} />
      <PodiumSpot entry={first} place={1} isYou={first?.isYou} />
      <PodiumSpot entry={third} place={3} isYou={third?.isYou} />
    </motion.div>
  );
}

// Tab durations in ms
const QUEST_TAB_DURATION_MS = 7500;
const LEADERBOARD_TAB_DURATION_MS = 10500;
const REWARDS_TAB_DURATION_MS = 8000;

export function QuestsLeaderboardsDemo({ className }: QuestsLeaderboardsDemoProps): ReactNode {
  const isMobile = useIsMobile();
  const [view, setView] = useState<'quests' | 'leaderboard' | 'rewards'>('quests');
  const [questPhase, setQuestPhase] = useState<QuestPhase>('idle');
  const [leaderboardPhase, setLeaderboardPhase] = useState<LeaderboardPhase>('idle');
  const [rewardsPhase, setRewardsPhase] = useState<RewardsPhase>('idle');
  const [totalPoints, setTotalPoints] = useState(1650);
  const [showToast, setShowToast] = useState(false);
  const [toastCountActive, setToastCountActive] = useState(false);
  const [leaderboard, setLeaderboard] = useState(INITIAL_LEADERBOARD);
  const [climbScrollOffset, setClimbScrollOffset] = useState(0);
  const [tabProgress, setTabProgress] = useState(0);
  const [showFloatingPoints, setShowFloatingPoints] = useState(false);
  const [floatingPointsMerging, setFloatingPointsMerging] = useState(false);
  const [hasLanded, setHasLanded] = useState(false);
  const tabAnimationRef = useRef<number | null>(null);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const climbRafRef = useRef<number | null>(null);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (climbRafRef.current) {
      cancelAnimationFrame(climbRafRef.current);
      climbRafRef.current = null;
    }
    if (tabAnimationRef.current) {
      cancelAnimationFrame(tabAnimationRef.current);
      tabAnimationRef.current = null;
    }
  }, []);

  // Tab progress animation
  useEffect(() => {
    setTabProgress(0);
    const duration = view === 'quests' ? QUEST_TAB_DURATION_MS : view === 'leaderboard' ? LEADERBOARD_TAB_DURATION_MS : REWARDS_TAB_DURATION_MS;
    const startTime = Date.now();

    const tick = (): void => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setTabProgress(progress);

      if (progress < 1) {
        tabAnimationRef.current = requestAnimationFrame(tick);
      }
    };

    tabAnimationRef.current = requestAnimationFrame(tick);

    return () => {
      if (tabAnimationRef.current) {
        cancelAnimationFrame(tabAnimationRef.current);
      }
    };
  }, [view]);

  const [animatedPoints, setAnimatedPoints] = useState(totalPoints);
  const [animatedRank, setAnimatedRank] = useState(248);

  const setAnimatedPointsRef = useRef(setAnimatedPoints);
  const setAnimatedRankRef = useRef(setAnimatedRank);
  const setTotalPointsRef = useRef(setTotalPoints);
  setAnimatedPointsRef.current = setAnimatedPoints;
  setAnimatedRankRef.current = setAnimatedRank;
  setTotalPointsRef.current = setTotalPoints;

  // Slot machine climb scroll animation
  const startClimbScroll = useCallback(
    (duration: number, startPoints: number, endPoints: number, onComplete?: () => void) => {
      const itemHeight = isMobile ? CLIMB_ITEM_HEIGHT : CLIMB_ITEM_HEIGHT_DESKTOP;
      const visibleItems = isMobile ? VISIBLE_CLIMB_ITEMS : VISIBLE_CLIMB_ITEMS_DESKTOP;

      const startYouIndex = CLIMB_ENTRIES.findIndex((e) => e.rank === 248 && e.isYou);
      const endYouIndex = CLIMB_ENTRIES.findIndex((e) => e.rank === 2 && e.isYou);

      const centerOffset = Math.floor(visibleItems / 2);
      const startScroll = Math.max(0, (startYouIndex - centerOffset) * itemHeight);
      const endScroll = Math.max(0, (endYouIndex - centerOffset) * itemHeight);

      setClimbScrollOffset(startScroll);

      const startTime = Date.now();

      const animate = (): void => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3.5);

        const currentScroll = startScroll + (endScroll - startScroll) * eased;
        setClimbScrollOffset(Math.max(0, currentScroll));

        const currentPoints = Math.round(startPoints + (endPoints - startPoints) * eased);
        setAnimatedPointsRef.current(currentPoints);

        const currentRank = Math.round(248 - (248 - 2) * eased);
        setAnimatedRankRef.current(currentRank);

        if (progress < 1) {
          climbRafRef.current = requestAnimationFrame(animate);
        } else {
          setClimbScrollOffset(endScroll);
          setAnimatedPointsRef.current(endPoints);
          setAnimatedRankRef.current(2);
          setTotalPointsRef.current(endPoints);
          if (onComplete) {
            onComplete();
          }
        }
      };

      climbRafRef.current = requestAnimationFrame(animate);
    },
    [isMobile]
  );

  // Quest demo sequence
  const runQuestDemo = useCallback(() => {
    clearAllTimeouts();
    setQuestPhase('idle');
    setShowToast(false);
    setToastCountActive(false);
    setTotalPoints(1650);

    timeoutsRef.current.push(setTimeout(() => setQuestPhase('quest_available'), 500));
    timeoutsRef.current.push(setTimeout(() => setQuestPhase('quest_ready'), 2000));
    timeoutsRef.current.push(setTimeout(() => setQuestPhase('claiming'), 3500));

    timeoutsRef.current.push(
      setTimeout(() => {
        setQuestPhase('celebration');
        setShowToast(true);
        setTimeout(() => setToastCountActive(true), 100);
        setTotalPoints(1700);
      }, 4000)
    );

    timeoutsRef.current.push(
      setTimeout(() => {
        setQuestPhase('complete');
        setShowToast(false);
      }, 6500)
    );
  }, [clearAllTimeouts]);

  // Leaderboard demo sequence
  const runLeaderboardDemo = useCallback(() => {
    clearAllTimeouts();
    setLeaderboardPhase('idle');
    setLeaderboard(INITIAL_LEADERBOARD);
    setTotalPoints(1650);
    setAnimatedPoints(1650);
    setAnimatedRank(248);
    setShowFloatingPoints(false);
    setFloatingPointsMerging(false);
    setHasLanded(false);

    const itemHeight = isMobile ? CLIMB_ITEM_HEIGHT : CLIMB_ITEM_HEIGHT_DESKTOP;
    const visibleItems = isMobile ? VISIBLE_CLIMB_ITEMS : VISIBLE_CLIMB_ITEMS_DESKTOP;

    const startYouIndex = CLIMB_ENTRIES.findIndex((e) => e.rank === 248 && e.isYou);
    const centerOffset = Math.floor(visibleItems / 2);
    setClimbScrollOffset(Math.max(0, (startYouIndex - centerOffset) * itemHeight));

    timeoutsRef.current.push(setTimeout(() => setLeaderboardPhase('show_board'), 500));

    timeoutsRef.current.push(
      setTimeout(() => {
        setLeaderboardPhase('points_incoming');
        setShowFloatingPoints(true);
      }, 1500)
    );

    timeoutsRef.current.push(
      setTimeout(() => {
        setFloatingPointsMerging(true);
      }, 2500)
    );

    timeoutsRef.current.push(
      setTimeout(() => {
        setLeaderboardPhase('climbing');
        setShowFloatingPoints(false);
        setFloatingPointsMerging(false);
        startClimbScroll(4500, 1650, 2380, () => {
          setHasLanded(true);
        });
      }, 3000)
    );

    timeoutsRef.current.push(
      setTimeout(() => {
        setLeaderboardPhase('podium');
        setLeaderboard([
          { rank: 1, name: 'DiamondHands', points: 2450, change: 'same' },
          { rank: 2, name: 'You', points: 2380, change: 'up', isYou: true },
          { rank: 3, name: 'MoonWatcher', points: 2100, change: 'down' },
          { rank: 4, name: 'CryptoKing', points: 1850, change: 'down' },
          { rank: 5, name: 'SatoshiFan', points: 1700, change: 'down' },
          { rank: 6, name: 'HODLer', points: 1400, change: 'same' },
        ]);
      }, 8000)
    );

    timeoutsRef.current.push(setTimeout(() => setLeaderboardPhase('complete'), 10000));
  }, [clearAllTimeouts, startClimbScroll, isMobile]);

  // Rewards demo sequence
  const runRewardsDemo = useCallback(() => {
    clearAllTimeouts();
    setRewardsPhase('idle');

    timeoutsRef.current.push(setTimeout(() => setRewardsPhase('show_pool'), 500));
    timeoutsRef.current.push(setTimeout(() => setRewardsPhase('calculate'), 2000));
    timeoutsRef.current.push(setTimeout(() => setRewardsPhase('distribute'), 3500));
    timeoutsRef.current.push(setTimeout(() => setRewardsPhase('celebrate'), 5500));
    timeoutsRef.current.push(setTimeout(() => setRewardsPhase('complete'), 7500));
  }, [clearAllTimeouts]);

  // Run demo when view changes
  useEffect(() => {
    if (view === 'quests') {
      runQuestDemo();
    } else if (view === 'leaderboard') {
      runLeaderboardDemo();
    } else {
      runRewardsDemo();
    }
    return () => clearAllTimeouts();
  }, [view, runQuestDemo, runLeaderboardDemo, runRewardsDemo, clearAllTimeouts]);

  // Auto-switch between tabs
  useEffect(() => {
    if (questPhase === 'complete' && view === 'quests') {
      const switchTimeout = setTimeout(() => {
        setView('leaderboard');
      }, 500);
      return () => clearTimeout(switchTimeout);
    }
    if (leaderboardPhase === 'complete' && view === 'leaderboard') {
      const switchTimeout = setTimeout(() => {
        setView('rewards');
      }, 500);
      return () => clearTimeout(switchTimeout);
    }
    if (rewardsPhase === 'complete' && view === 'rewards') {
      const switchTimeout = setTimeout(() => {
        setView('quests');
      }, 500);
      return () => clearTimeout(switchTimeout);
    }
  }, [questPhase, leaderboardPhase, rewardsPhase, view]);

  const isQuestReady = questPhase === 'quest_ready';
  const isClaiming = questPhase === 'claiming';
  const isCelebrating = questPhase === 'celebration' || questPhase === 'complete';

  const isClimbing = leaderboardPhase === 'climbing';

  const questPhases: QuestPhase[] = ['quest_available', 'quest_ready', 'claiming', 'celebration'];
  const leaderboardPhases: LeaderboardPhase[] = [
    'show_board',
    'points_incoming',
    'climbing',
    'podium',
  ];
  const rewardsPhases: RewardsPhase[] = ['show_pool', 'calculate', 'distribute', 'celebrate'];

  return (
    <div className={cn('relative flex h-full flex-col gap-3 lg:gap-4', className)}>
      {/* Toast notification */}
      <Toast points={50} isVisible={showToast} countUpActive={toastCountActive} />

      {/* Header: Tabs + Points */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1 rounded-sm border border-white/[0.08] bg-white/[0.04] p-1 backdrop-blur-xl lg:gap-1.5 lg:p-1.5">
          {(['quests', 'leaderboard', 'rewards'] as const).map((tab) => {
            const isActive = view === tab;
            const label = tab === 'quests' ? 'Quests' : 'Ranks';
            return (
              <motion.button
                key={tab}
                onClick={() => setView(tab)}
                type="button"
                className={cn(
                  'relative rounded-sm px-3 py-2 text-xs font-semibold lg:px-5 lg:py-2.5 lg:text-sm',
                  isActive ? 'text-gray-950' : 'text-text-muted'
                )}
                whileHover={!isActive ? { scale: 1.02 } : undefined}
                whileTap={{ scale: 0.98 }}
                animate={{
                  color: isActive ? 'rgb(3, 7, 18)' : 'rgba(255, 255, 255, 0.45)',
                }}
                transition={{ duration: 0.2 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="demoActiveTab"
                    className="bg-accent-primary absolute inset-0 rounded-sm"
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 30,
                      mass: 1,
                    }}
                  >
                    <motion.div
                      className="absolute inset-0 rounded-sm"
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: 1,
                        boxShadow: [
                          '0 0 20px rgba(232, 180, 94, 0.3), 0 0 40px rgba(232, 180, 94, 0.15)',
                          '0 0 25px rgba(232, 180, 94, 0.4), 0 0 50px rgba(232, 180, 94, 0.2)',
                          '0 0 20px rgba(232, 180, 94, 0.3), 0 0 40px rgba(232, 180, 94, 0.15)',
                        ],
                      }}
                      transition={{
                        opacity: { duration: 0.3 },
                        boxShadow: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                      }}
                    />
                  </motion.div>
                )}
                {isActive && (
                  <motion.div
                    className="absolute bottom-0.5 left-0 right-0 mx-auto h-0.5 overflow-hidden rounded-sm"
                    style={{ width: '50%' }}
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ delay: 0.15, duration: 0.25 }}
                  >
                    <motion.div
                      className="h-full origin-left bg-gray-950/30"
                      style={{ width: `${tabProgress * 100}%` }}
                    />
                  </motion.div>
                )}
                <motion.span
                  className="relative z-10 whitespace-nowrap"
                  initial={false}
                  animate={{ scale: isActive ? 1 : 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  {tab === 'quests' ? 'Quests' : tab === 'leaderboard' ? 'Ranks' : 'Rewards'}
                </motion.span>
              </motion.button>
            );
          })}
        </div>

        <div className="relative">
          {/* Floating +730 points (All 6 Agent Tasks) */}
          <AnimatePresence>
            {showFloatingPoints && (
              <motion.div
                initial={{ opacity: 0, y: -30, scale: 0.8 }}
                animate={
                  floatingPointsMerging
                    ? { opacity: 0, y: 0, scale: 0.6 }
                    : { opacity: 1, y: -35, scale: 1 }
                }
                exit={{ opacity: 0, y: 0, scale: 0.5 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="absolute -top-2 left-1/2 z-10 -translate-x-1/2"
              >
                <motion.span
                  className="text-accent-primary flex items-center gap-1 text-lg font-bold drop-shadow-[0_0_12px_rgba(232,180,94,0.8)]"
                  animate={!floatingPointsMerging ? { y: [0, -3, 0] } : {}}
                  transition={{ duration: 0.6, repeat: Infinity }}
                >
                  <StarIcon className="h-4 w-4" />
                  +730
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className={cn(
              'flex items-center gap-1.5 rounded-sm px-3 py-2 transition-all duration-300 lg:gap-2 lg:px-5 lg:py-3',
              isClimbing
                ? 'bg-accent-primary/20 shadow-accent-primary/30 ring-accent-primary/50 shadow-lg ring-2'
                : showFloatingPoints
                  ? 'bg-accent-primary/15 ring-accent-primary/30 ring-1'
                  : 'bg-accent-primary/10'
            )}
            animate={
              isClimbing
                ? {
                    scale: [1, 1.02, 1],
                    boxShadow: [
                      '0 0 0 0 rgba(232, 180, 94, 0.2)',
                      '0 0 20px 4px rgba(232, 180, 94, 0.4)',
                      '0 0 0 0 rgba(232, 180, 94, 0.2)',
                    ],
                  }
                : floatingPointsMerging
                  ? { scale: [1, 1.08, 1] }
                  : isCelebrating
                    ? { scale: [1, 1.05, 1] }
                    : {}
            }
            transition={isClimbing ? { duration: 0.8, repeat: Infinity } : { duration: 0.3 }}
          >
            <motion.div
              animate={
                isClimbing
                  ? { rotate: [0, 10, -10, 0] }
                  : floatingPointsMerging
                    ? { rotate: [0, 15, 0] }
                    : {}
              }
              transition={{ duration: 0.5, repeat: isClimbing ? Infinity : 1 }}
            >
              <Trophy className="text-accent-primary h-4 w-4 lg:h-5 lg:w-5" />
            </motion.div>
            <motion.span
              className={cn(
                'text-base font-bold tabular-nums transition-all lg:text-xl',
                isClimbing || floatingPointsMerging
                  ? 'text-accent-primary drop-shadow-[0_0_8px_rgba(232,180,94,0.6)]'
                  : 'text-accent-primary'
              )}
            >
              {formatPoints(isClimbing ? animatedPoints : totalPoints)}
            </motion.span>
            {isClimbing && (
              <motion.span
                className="text-xs text-emerald-400 lg:text-sm"
                animate={{ y: [0, -2, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.3, repeat: Infinity }}
              >
                ▲
              </motion.span>
            )}
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 overflow-hidden">
        {/* Quests View */}
        <motion.div
          initial={false}
          animate={{
            opacity: view === 'quests' ? 1 : 0,
            x: view === 'quests' ? 0 : -30,
            scale: view === 'quests' ? 1 : 0.96,
            filter: view === 'quests' ? 'blur(0px)' : 'blur(4px)',
            pointerEvents: view === 'quests' ? 'auto' : 'none',
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 28,
            mass: 0.9,
            opacity: { duration: 0.2 },
            filter: { duration: 0.25 },
          }}
          className="absolute inset-0 flex h-full flex-col gap-4 pt-4"
          style={{ position: view === 'quests' ? 'relative' : 'absolute' }}
        >
          {/* Daily Login Quest */}
          <AnimatePresence mode="wait">
            {questPhase !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{
                  opacity: isCelebrating ? 0.6 : 1,
                  y: 0,
                  scale: isClaiming ? 0.98 : 1,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={cn(
                  'relative rounded-sm border p-3 transition-all duration-500 lg:p-5',
                  questPhase === 'quest_available' && 'border-white/[0.08] bg-white/[0.03] backdrop-blur-xl',
                  isQuestReady &&
                    'border-accent-primary/50 bg-accent-primary/[0.06] shadow-[0_0_20px_rgba(232,180,94,0.15)] backdrop-blur-xl',
                  isClaiming && 'border-accent-primary bg-accent-primary/[0.1] backdrop-blur-xl',
                  isCelebrating && 'border-accent-primary/20 bg-white/[0.02] backdrop-blur-xl'
                )}
              >
                {isQuestReady && (
                  <motion.div
                    className="border-accent-primary absolute inset-0 rounded-sm border"
                    animate={{
                      scale: [1, 1.02, 1],
                      opacity: [0.5, 0.2, 0.5],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}

                <div className="flex items-center gap-3 lg:gap-5">
                  <motion.div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-sm transition-all duration-300 lg:h-14 lg:w-14',
                      questPhase === 'quest_available' && 'bg-white/[0.04] border border-white/[0.08] text-text-muted',
                      isQuestReady && 'bg-accent-primary/[0.08] border border-accent-primary/30 text-accent-primary',
                      isClaiming && 'bg-accent-primary/[0.12] border border-accent-primary/40 text-accent-primary',
                      isCelebrating && 'bg-accent-primary/[0.15] border border-accent-primary/50 text-accent-primary'
                    )}
                    animate={isQuestReady ? { rotate: [0, 5, -5, 0] } : {}}
                    transition={{
                      duration: 0.5,
                      repeat: isQuestReady ? Infinity : 0,
                      repeatDelay: 2,
                    }}
                  >
                    {isCelebrating ? (
                      <CheckIcon className="h-5 w-5 lg:h-7 lg:w-7" />
                    ) : (
                      <USDCIcon className="h-5 w-5 lg:h-7 lg:w-7" />
                    )}
                  </motion.div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm font-semibold transition-colors lg:text-lg',
                        isCelebrating ? 'text-text-muted line-through' : 'text-white'
                      )}
                    >
                      Daily Login
                    </p>
                    <p
                      className={cn(
                        'truncate text-xs transition-colors lg:text-sm',
                        questPhase === 'quest_available' ? 'text-text-muted' : 'text-text-secondary'
                      )}
                    >
                      {isCelebrating
                        ? 'Completed!'
                        : isQuestReady
                          ? 'Ready to claim!'
                          : 'Log in daily for rewards'}
                    </p>
                  </div>

                  <motion.div
                    className="shrink-0"
                    animate={isQuestReady ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.8, repeat: isQuestReady ? Infinity : 0 }}
                  >
                    {isCelebrating ? (
                      <motion.div
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                        className="bg-accent-primary flex h-9 w-9 items-center justify-center rounded-sm lg:h-12 lg:w-12"
                      >
                        <CheckIcon className="h-4 w-4 text-gray-950 lg:h-6 lg:w-6" />
                      </motion.div>
                    ) : (
                      <span
                        className={cn(
                          'rounded-sm px-3 py-2 text-xs font-bold transition-all duration-300 lg:px-5 lg:py-3 lg:text-base',
                          questPhase === 'quest_available' && 'bg-white/[0.06] text-text-muted',
                          isQuestReady && 'bg-accent-primary/[0.15] border border-accent-primary/50 cursor-pointer text-accent-primary shadow-[0_0_16px_rgba(232,180,94,0.2)]',
                          isClaiming && 'bg-accent-primary/[0.1] border border-accent-primary/30 text-accent-primary/60'
                        )}
                      >
                        {isQuestReady ? 'Claim' : '+50'}
                      </span>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Other quests (static) - ACTUAL TRENCH TASKS */}
          <div className="space-y-2 lg:space-y-3">
            {([
              { icon: Twitter, title: 'Twitter Discovery', shortTitle: 'Twitter', points: 100, type: 'twitter', desc: 'Find official account' },
              { icon: MessageCircle, title: 'Community Analysis', shortTitle: 'Community', points: 75, type: 'social', desc: 'Sentiment + mentions' },
              { icon: Gem, title: 'Holder Analysis', shortTitle: 'Holders', points: 150, type: 'onchain', desc: 'Top 10 holders' },
              { icon: BookOpen, title: 'Narrative Research', shortTitle: 'Narrative', points: 125, type: 'research', desc: 'Token story' },
              { icon: Wallet, title: 'God Wallet Tracking', shortTitle: 'Whales', points: 200, type: 'onchain', desc: 'Track known whales' },
              { icon: Lock, title: 'Liquidity Lock Check', shortTitle: 'Lock Check', points: 80, type: 'onchain', desc: 'Verify lock status' },
            ] as { icon: LucideIcon; title: string; shortTitle: string; points: number; type: string; desc: string }[]).map((quest, i) => {
              const QuestIcon = quest.icon;
              return (
              <motion.div
                key={quest.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.3 + i * 0.08 }}
                className="rounded-sm border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl px-3 py-2 lg:px-4 lg:py-3"
              >
                <div className="flex items-center gap-2 lg:gap-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center text-text-muted lg:h-10 lg:w-10">
                    <QuestIcon className="h-4 w-4 lg:h-5 lg:w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text-secondary lg:text-sm">
                      <span className="lg:hidden">{quest.shortTitle}</span>
                      <span className="hidden lg:inline">{quest.title}</span>
                    </p>
                    {quest.desc && (
                      <p className="hidden lg:block truncate text-[10px] text-text-muted mt-0.5">
                        {quest.desc}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-sm bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-text-muted lg:px-3 lg:py-1.5 lg:text-xs">
                    +{quest.points}
                  </span>
                </div>
              </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Leaderboard View */}
        <motion.div
          initial={false}
          animate={{
            opacity: view === 'leaderboard' ? 1 : 0,
            x: view === 'leaderboard' ? 0 : 30,
            scale: view === 'leaderboard' ? 1 : 0.96,
            filter: view === 'leaderboard' ? 'blur(0px)' : 'blur(4px)',
            pointerEvents: view === 'leaderboard' ? 'auto' : 'none',
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 28,
            mass: 0.9,
            opacity: { duration: 0.2 },
            filter: { duration: 0.25 },
          }}
          className="absolute inset-0 flex h-full flex-col gap-3"
          style={{ position: view === 'leaderboard' ? 'relative' : 'absolute' }}
        >
          <CompactPodium entries={leaderboard} />

          <div className="flex-1">
            <SlotMachineLeaderboard
              entries={CLIMB_ENTRIES}
              scrollOffset={climbScrollOffset}
              isClimbing={isClimbing}
              currentRank={animatedRank}
              currentPoints={animatedPoints}
              hasLanded={hasLanded}
              isMobile={isMobile}
            />
          </div>
        </motion.div>

        {/* Rewards View */}
        <motion.div
          initial={false}
          animate={{
            opacity: view === 'rewards' ? 1 : 0,
            x: view === 'rewards' ? 0 : 30,
            scale: view === 'rewards' ? 1 : 0.96,
            filter: view === 'rewards' ? 'blur(0px)' : 'blur(4px)',
            pointerEvents: view === 'rewards' ? 'auto' : 'none',
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 28,
            mass: 0.9,
            opacity: { duration: 0.2 },
            filter: { duration: 0.25 },
          }}
          className="absolute inset-0 flex h-full flex-col items-center justify-center gap-6"
          style={{ position: view === 'rewards' ? 'relative' : 'absolute' }}
        >
          {/* USDC Pool Display */}
          <AnimatePresence mode="wait">
            {rewardsPhase !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  y: 0,
                  boxShadow: rewardsPhase === 'distribute' || rewardsPhase === 'celebrate'
                    ? [
                        '0 0 0 0 rgba(232, 180, 94, 0.2)',
                        '0 0 40px 8px rgba(232, 180, 94, 0.4)',
                        '0 0 0 0 rgba(232, 180, 94, 0.2)',
                      ]
                    : '0 0 20px rgba(232, 180, 94, 0.2)'
                }}
                transition={{ 
                  type: 'spring', 
                  stiffness: 400, 
                  damping: 25,
                  boxShadow: { duration: 1.5, repeat: Infinity }
                }}
                className="relative"
              >
                <motion.div
                  className="flex flex-col items-center gap-4 rounded-sm border border-accent-primary/30 bg-gradient-to-b from-accent-primary/10 to-accent-primary/5 backdrop-blur-xl px-8 py-10 lg:px-12 lg:py-12"
                  animate={rewardsPhase === 'celebrate' ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 0.5, repeat: 2 }}
                >
                  <motion.div
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-primary/20 lg:h-20 lg:w-20"
                    animate={
                      rewardsPhase === 'distribute' || rewardsPhase === 'celebrate'
                        ? { rotate: [0, 10, -10, 0] }
                        : {}
                    }
                    transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}
                  >
                    <USDCIcon className="h-8 w-8 lg:h-10 lg:w-10" />
                  </motion.div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-text-muted lg:text-sm">USDC Reward Pool</span>
                    <motion.span 
                      className="text-4xl font-bold text-accent-primary tabular-nums lg:text-5xl"
                      animate={rewardsPhase === 'distribute' ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.4 }}
                    >
                      <USDCPoolCounter isActive={rewardsPhase === 'show_pool' || rewardsPhase === 'calculate'} />
                    </motion.span>
                  </div>

                  {rewardsPhase === 'calculate' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center"
                    >
                      <p className="text-sm text-text-secondary">Calculating distribution...</p>
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reward Distribution Animation */}
          <AnimatePresence>
            {(rewardsPhase === 'distribute' || rewardsPhase === 'celebrate') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col gap-3 w-full px-4"
              >
                {[
                  { rank: 1, name: 'DiamondHands', multiplier: '2.0x', usdc: 400 },
                  { rank: 2, name: 'You', multiplier: '1.5x', usdc: 300, isYou: true },
                  { rank: 3, name: 'MoonWatcher', multiplier: '1.0x', usdc: 200 },
                  { rank: 4, name: 'CryptoKing', multiplier: '0.75x', usdc: 150 },
                  { rank: 5, name: 'SatoshiFan', multiplier: '0.5x', usdc: 100 },
                ].map((agent, i) => (
                  <motion.div
                    key={agent.rank}
                    initial={{ opacity: 0, x: -20, scale: 0.9 }}
                    animate={{ 
                      opacity: 1, 
                      x: 0, 
                      scale: 1,
                      backgroundColor: agent.isYou ? 'rgba(232, 180, 94, 0.1)' : 'rgba(255, 255, 255, 0.02)'
                    }}
                    transition={{ 
                      delay: i * 0.15,
                      type: 'spring',
                      stiffness: 400,
                      damping: 25
                    }}
                    className={cn(
                      'flex items-center justify-between rounded-sm border px-4 py-3 backdrop-blur-xl',
                      agent.isYou ? 'border-accent-primary/40 shadow-[0_0_20px_rgba(232,180,94,0.2)]' : 'border-white/[0.08]'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'text-sm font-bold',
                        agent.rank <= 3 ? 'text-amber-400' : 'text-text-muted'
                      )}>
                        #{agent.rank}
                      </span>
                      <span className={cn(
                        'text-sm font-medium',
                        agent.isYou ? 'text-accent-primary' : 'text-white'
                      )}>
                        {agent.name}
                        {agent.isYou && <span className="ml-1 text-text-muted">(You)</span>}
                      </span>
                      <span className="text-xs text-text-muted">×{agent.multiplier}</span>
                    </div>
                    <motion.span
                      className={cn(
                        'text-base font-bold tabular-nums',
                        agent.isYou ? 'text-accent-primary' : 'text-emerald-400'
                      )}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.15 + 0.2, type: 'spring', stiffness: 500 }}
                    >
                      +{agent.usdc} USDC
                    </motion.span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Phase Progress Dots */}
      <div className="mt-auto flex items-center justify-center gap-2 pt-2">
        {(view === 'quests' ? questPhases : view === 'leaderboard' ? leaderboardPhases : rewardsPhases).map((phase, i) => {
          const currentPhases = view === 'quests' ? questPhases : view === 'leaderboard' ? leaderboardPhases : rewardsPhases;
          const currentPhase = view === 'quests' ? questPhase : view === 'leaderboard' ? leaderboardPhase : rewardsPhase;
          const currentIdx = (currentPhases as readonly string[]).indexOf(currentPhase);
          const isActive = currentPhase === phase;
          const isPassed = currentIdx > i;

          return (
            <motion.div
              key={phase}
              className={cn(
                'rounded-sm transition-all duration-300',
                isActive
                  ? 'bg-accent-primary h-2 w-6'
                  : isPassed
                    ? 'bg-accent-primary/50 h-2 w-2'
                    : 'h-2 w-2 bg-white/[0.12]'
              )}
              animate={isActive ? { opacity: [1, 0.5, 1] } : {}}
              transition={{ duration: 0.8, repeat: isActive ? Infinity : 0 }}
            />
          );
        })}
      </div>
    </div>
  );
}
