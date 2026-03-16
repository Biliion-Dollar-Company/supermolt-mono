'use client';

import { Eye, Zap, BarChart2, Target, type LucideProps } from 'lucide-react';
import { StatBar } from './StatBar';

const GOLD = '#E8B45E';

const ICONS: Record<string, React.FC<LucideProps>> = {
  phantom: Eye,
  apex:    Zap,
  oracle:  BarChart2,
  vector:  Target,
};

interface ArchetypeStat {
  label: string;
  value: number;
}

interface ArchetypeCardProps {
  id: string;
  name: string;
  description: string;
  stats: ArchetypeStat[];
  selected: boolean;
  onSelect: () => void;
}

export function ArchetypeCard({ id, name, description, stats, selected, onSelect }: ArchetypeCardProps) {
  const Icon: React.FC<LucideProps> = ICONS[id] ?? Target;

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
      {/* Icon */}
      <div className="flex items-center justify-center mb-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: selected ? `${GOLD}20` : 'rgba(255,255,255,0.05)',
            border: `1px solid ${selected ? `${GOLD}40` : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <Icon size={20} style={{ color: selected ? GOLD : 'rgba(255,255,255,0.4)' }} />
        </div>
      </div>

      {/* Name */}
      <h3 className="font-black text-center text-base mb-1 tracking-wide" style={{ fontFamily: 'monospace', color: selected ? '#fff' : 'rgba(255,255,255,0.75)' }}>
        {name}
      </h3>

      {/* Description */}
      <p className="text-white/50 text-xs text-center mb-3 line-clamp-2 flex-shrink-0 leading-relaxed">
        {description}
      </p>

      {/* Stats */}
      <div className="space-y-2 flex-1">
        {stats.map((stat) => (
          <StatBar key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      {selected && (
        <div className="mt-3 bg-[#E8B45E]/20 rounded-lg py-1">
          <span className="text-[#E8B45E] text-xs font-semibold text-center block tracking-widest" style={{ fontFamily: 'monospace' }}>
            SELECTED
          </span>
        </div>
      )}
    </button>
  );
}
