'use client';

import { useEffect, useState, useRef } from 'react';
import { getRecentTrades } from '@/lib/api';
import { Trade } from '@/lib/types';

export default function LiveTape() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchTrades = async () => {
    try {
      const data = await getRecentTrades(100);
      setTrades(data);
      setError(null);
    } catch (err) {
      setError('Failed to load trades. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
    // Refresh every 3 seconds for live updates
    const interval = setInterval(fetchTrades, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new trades arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [trades]);

  if (loading && trades.length === 0) {
    return (
      <div className="w-full min-h-screen bg-void-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading live trades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-void-black p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-cyan-400 mb-2">📊 Live Trade Tape</h1>
          <p className="text-gray-400">
            {trades.length} trades • Auto-updating every 3s
          </p>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div
          ref={scrollRef}
          className="bg-gray-900 border border-gray-800 rounded-lg overflow-y-auto h-[600px]"
        >
          {trades.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400">No trades yet. Come back soon!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {trades.map((trade) => (
                <div
                  key={trade.tradeId}
                  className={`p-4 hover:bg-gray-800 transition border-l-4 ${
                    trade.pnl > 0 ? 'border-l-green-500' : 'border-l-red-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-gray-500">
                        {new Date(trade.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-cyan-400 font-bold">{trade.tokenSymbol}</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          trade.action === 'BUY'
                            ? 'bg-green-900 text-green-400'
                            : 'bg-red-900 text-red-400'
                        }`}
                      >
                        {trade.action}
                      </span>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-gray-400 text-xs">Quantity</p>
                        <p className="text-gray-200 font-mono">
                          {trade.quantity.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs">Entry Price</p>
                        <p className="text-gray-200 font-mono">
                          ${trade.entryPrice.toFixed(6)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs">Exit Price</p>
                        <p className="text-gray-200 font-mono">
                          ${(trade.exitPrice || 0).toFixed(6)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs">PnL %</p>
                        <p
                          className={`font-bold font-mono ${
                            trade.pnl > 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {trade.pnlPercent.toFixed(2)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs">PnL</p>
                        <p
                          className={`font-bold font-mono text-lg ${
                            trade.pnl > 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {trade.pnl > 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>Scroll down to see latest trades</p>
        </div>
      </div>
    </div>
  );
}
