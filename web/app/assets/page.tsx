'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Coins, RefreshCw, TrendingUp } from 'lucide-react';
import { AssetCard } from '@/components/rwa/AssetCard';
import { YieldTable } from '@/components/rwa/YieldTable';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface RwaToken {
  symbol: string;
  name: string;
  issuer: string;
  assetClass: string;
  currentPrice: number;
  priceChange24h: number;
  estimatedYield: number | null;
  description: string;
}

interface YieldRate {
  symbol: string;
  name: string;
  apy: number;
  issuer: string;
  assetClass: string;
}

export default function AssetsPage() {
  const [tokens, setTokens] = useState<RwaToken[]>([]);
  const [yields, setYields] = useState<YieldRate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tokensRes, yieldsRes] = await Promise.allSettled([
        fetch(`${API_URL}/rwa/tokens`),
        fetch(`${API_URL}/rwa/yields`),
      ]);
      if (tokensRes.status === 'fulfilled' && tokensRes.value.ok) {
        const data = await tokensRes.value.json();
        setTokens(data.tokens || []);
      }
      if (yieldsRes.status === 'fulfilled' && yieldsRes.value.ok) {
        const data = await yieldsRes.value.json();
        setYields(data.yields || []);
      }
    } catch { /* empty state */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <div className="mx-auto w-full max-w-[1260px] px-6 sm:px-10 lg:px-16 xl:px-20 2xl:px-24 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Coins size={24} className="text-[#2563EB]" />
              <h1 className="text-xl font-semibold text-white">RWA Assets</h1>
            </div>
            <p className="text-sm text-white/30 mt-1 ml-9">Tokenized real-world assets available for portfolio allocation</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-white/50 border border-white/10 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((token) => (
              <AssetCard key={token.symbol} {...token} />
            ))}
            {tokens.length === 0 && !loading && (
              <div className="col-span-3 text-center py-12 text-white/20 text-sm">
                No RWA tokens available. Start the backend to load token data.
              </div>
            )}
          </div>

          <div className="bg-[#0F1629] border border-white/[0.08] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-green-400" />
              <h3 className="text-sm text-white/40 uppercase tracking-wider">Yield Comparison</h3>
            </div>
            <YieldTable yields={yields} />
          </div>
        </div>
      </div>
    </div>
  );
}
