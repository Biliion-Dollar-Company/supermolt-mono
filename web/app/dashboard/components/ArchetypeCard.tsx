'use client';

import { StatBar } from './StatBar';

interface ArchetypeStat {
  label: string;
  value: number; // 0-100
}

interface ArchetypeCardProps {
  id: string;
  emoji: string;
  name: string;
  description: string;
  stats: ArchetypeStat[];
  selected: boolean;
  onSelect: () => void;
}

export function ArchetypeCard({
  emoji,
  name,
  description,
  stats,
  selected,
  onSelect,
}: ArchetypeCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`
        flex-1 rounded-2xl p-4 transition-all duration-200
        min-h-[240px] flex flex-col
        ${selected
          ? 'border-2 border-[#E8B45E] bg-[#E8B45E]/10'
          : 'border-2 border-transparent bg-white/[0.04] hover:bg-white/[0.06]'
        }
      `}
    >
      {/* Emoji */}
      <div className="text-4xl text-center mb-2">
        {emoji}
      </div>

      {/* Name */}
      <h3 className="text-white font-bold text-center text-base mb-1">
        {name}
      </h3>

      {/* Description */}
      <p className="text-white/50 text-xs text-center mb-3 line-clamp-2 flex-shrink-0">
        {description}
      </p>

      {/* Stats */}
      <div className="space-y-2 flex-1">
        {stats.map((stat) => (
          <StatBar key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      {/* Selected badge */}
      {selected && (
        <div className="mt-3 bg-[#E8B45E]/20 rounded-lg py-1">
          <span className="text-[#E8B45E] text-xs font-semibold text-center block">
            Selected
          </span>
        </div>
      )}
    </button>
  );
}
