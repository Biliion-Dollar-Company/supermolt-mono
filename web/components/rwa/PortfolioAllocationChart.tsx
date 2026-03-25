'use client';

import { motion } from 'framer-motion';

interface Allocation {
  symbol: string;
  assetClass: string;
  weight: number;
  value: number;
}

interface PortfolioAllocationChartProps {
  allocations: Allocation[];
  totalValue: number;
}

const CLASS_COLORS: Record<string, string> = {
  TREASURY_BILLS: '#3B82F6',
  EQUITIES: '#A855F7',
  GOLD: '#EAB308',
  REAL_ESTATE: '#22C55E',
  FIXED_INCOME: '#06B6D4',
  GOVERNMENT_BONDS: '#F97316',
  CRYPTO: '#6366F1',
};

function formatAssetClass(ac: string): string {
  return ac.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PortfolioAllocationChart({ allocations, totalValue }: PortfolioAllocationChartProps) {
  // Group by asset class
  const byClass = allocations.reduce<Record<string, { weight: number; value: number }>>((acc, a) => {
    if (!acc[a.assetClass]) acc[a.assetClass] = { weight: 0, value: 0 };
    acc[a.assetClass].weight += a.weight;
    acc[a.assetClass].value += a.value;
    return acc;
  }, {});

  const entries = Object.entries(byClass).sort((a, b) => b[1].weight - a[1].weight);

  // Build conic-gradient
  let cumulative = 0;
  const stops = entries.map(([cls, data]) => {
    const color = CLASS_COLORS[cls] || '#6B7280';
    const start = cumulative;
    cumulative += data.weight * 100;
    return `${color} ${start.toFixed(1)}% ${cumulative.toFixed(1)}%`;
  });
  const gradient = `conic-gradient(${stops.join(', ')})`;

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8">
      {/* Donut chart */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative w-48 h-48 rounded-full shrink-0"
        style={{ background: gradient }}
      >
        <div className="absolute inset-4 bg-[#0A0E1A] rounded-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-xs text-white/40">Total AUM</div>
            <div className="text-lg font-bold text-white font-mono">
              ${totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1)}K` : totalValue.toFixed(0)}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Legend */}
      <div className="flex-1 space-y-2 w-full">
        {entries.map(([cls, data], i) => (
          <motion.div
            key={cls}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center justify-between py-1.5"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: CLASS_COLORS[cls] || '#6B7280' }}
              />
              <span className="text-sm text-white/70">{formatAssetClass(cls)}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/40 font-mono">
                ${data.value >= 1000 ? `${(data.value / 1000).toFixed(1)}K` : data.value.toFixed(0)}
              </span>
              <span className="text-sm font-semibold text-white font-mono w-14 text-right">
                {(data.weight * 100).toFixed(1)}%
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
