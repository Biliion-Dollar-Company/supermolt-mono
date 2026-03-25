'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface AssetCardProps {
  symbol: string;
  name: string;
  issuer: string;
  assetClass: string;
  currentPrice: number;
  priceChange24h: number;
  estimatedYield: number | null;
  description: string;
}

const ASSET_CLASS_COLORS: Record<string, string> = {
  TREASURY_BILLS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  EQUITIES: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  GOLD: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  REAL_ESTATE: 'bg-green-500/10 text-green-400 border-green-500/20',
  FIXED_INCOME: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  GOVERNMENT_BONDS: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  CRYPTO: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

function formatAssetClass(ac: string): string {
  return ac.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function AssetCard({ symbol, name, issuer, assetClass, currentPrice, priceChange24h, estimatedYield, description }: AssetCardProps) {
  const isPositive = priceChange24h >= 0;
  const classColor = ASSET_CLASS_COLORS[assetClass] || 'bg-white/5 text-white/40 border-white/10';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0F1629] border border-white/[0.08] rounded-xl p-5 hover:border-white/[0.15] transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-lg font-semibold text-white">{symbol}</div>
          <div className="text-xs text-white/40">{name}</div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${classColor}`}>
          {formatAssetClass(assetClass)}
        </span>
      </div>

      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-2xl font-bold text-white font-mono">
          ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {isPositive ? '+' : ''}{priceChange24h.toFixed(2)}%
        </span>
      </div>

      {estimatedYield && (
        <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-green-500/5 border border-green-500/10 rounded-lg">
          <span className="text-xs text-green-400/60">Yield</span>
          <span className="text-sm font-semibold text-green-400">{estimatedYield}% APY</span>
        </div>
      )}

      <p className="text-xs text-white/30 mb-3 line-clamp-2">{description}</p>
      <div className="text-[10px] text-white/20">Issued by {issuer}</div>
    </motion.div>
  );
}
