'use client';

interface XPProgressBarProps {
  xp: number;
  level: number;
  levelName: string;
  xpForNextLevel: number;
}

// Level thresholds matching backend
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 2000];

export function XPProgressBar({ xp, level, levelName, xpForNextLevel }: XPProgressBarProps) {
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const range = xpForNextLevel - currentThreshold;
  const progress = range > 0 ? Math.min(((xp - currentThreshold) / range) * 100, 100) : 100;
  const isMaxLevel = level >= 6;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-accent-primary bg-accent-primary/10 px-2 py-0.5 font-mono">
            Lv.{level}
          </span>
          <span className="text-sm font-medium text-text-primary">{levelName}</span>
        </div>
        <span className="text-xs text-text-muted font-mono">
          {xp} / {isMaxLevel ? 'MAX' : xpForNextLevel} XP
        </span>
      </div>
      <div className="w-full h-2 bg-white/[0.06] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent-primary/80 to-accent-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
