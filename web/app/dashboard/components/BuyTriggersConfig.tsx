'use client';

import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface TriggerRule {
  id: string;
  type: 'consensus' | 'volume' | 'liquidity' | 'godwallet';
  enabled: boolean;
  config: Record<string, any>;
}

interface BuyTriggersConfigProps {
  triggers: TriggerRule[];
  onUpdate: (triggers: any[]) => void;
}

export function BuyTriggersConfig({ triggers, onUpdate }: BuyTriggersConfigProps) {
  const toggleTrigger = (id: string) => {
    onUpdate(
      triggers.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const updateTriggerConfig = (id: string, config: Record<string, any>) => {
    onUpdate(
      triggers.map((t) => (t.id === id ? { ...t, config: { ...t.config, ...config } } : t))
    );
  };

  const consensusTrigger = triggers.find((t) => t.type === 'consensus');
  const volumeTrigger = triggers.find((t) => t.type === 'volume');
  const liquidityTrigger = triggers.find((t) => t.type === 'liquidity');

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-white font-semibold text-lg mb-1">Buy Triggers</h3>
        <p className="text-white/50 text-sm">
          Agent automatically buys when these conditions are met
        </p>
      </div>

      <div className="space-y-4">
        {/* Consensus Buy Trigger */}
        {consensusTrigger && (
          <div className="border border-white/[0.08] rounded-lg p-4">
            <button
              onClick={() => toggleTrigger(consensusTrigger.id)}
              className="flex items-start gap-3 w-full text-left mb-3"
            >
              {consensusTrigger.enabled ? (
                <CheckCircle2 className="w-5 h-5 text-[#22c55e] flex-shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-white/30 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className="text-white font-medium text-sm">Consensus Buy</h4>
                <p className="text-white/50 text-xs mt-0.5">
                  When multiple tracked wallets buy the same token
                </p>
              </div>
            </button>

            {consensusTrigger.enabled && (
              <div className="ml-8 flex items-center gap-2 flex-wrap text-sm">
                <span className="text-white/70">When</span>
                <Select
                  value={consensusTrigger.config.walletCount?.toString() || '2'}
                  onValueChange={(value) =>
                    updateTriggerConfig(consensusTrigger.id, { walletCount: parseInt(value) })
                  }
                >
                  <SelectTrigger className="w-[120px] bg-white/[0.04] border-white/[0.12] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/[0.12]">
                    <SelectItem value="2">2 wallets</SelectItem>
                    <SelectItem value="3">3 wallets</SelectItem>
                    <SelectItem value="5">5 wallets</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-white/70">buy within</span>
                <Input
                  type="number"
                  value={consensusTrigger.config.timeWindow || 15}
                  onChange={(e) =>
                    updateTriggerConfig(consensusTrigger.id, {
                      timeWindow: parseInt(e.target.value),
                    })
                  }
                  className="w-[80px] bg-white/[0.04] border-white/[0.12] text-white"
                />
                <span className="text-white/70">minutes</span>
              </div>
            )}
          </div>
        )}

        {/* Volume Spike Trigger */}
        {volumeTrigger && (
          <div className="border border-white/[0.08] rounded-lg p-4">
            <button
              onClick={() => toggleTrigger(volumeTrigger.id)}
              className="flex items-start gap-3 w-full text-left mb-3"
            >
              {volumeTrigger.enabled ? (
                <CheckCircle2 className="w-5 h-5 text-[#22c55e] flex-shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-white/30 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className="text-white font-medium text-sm">Volume Spike</h4>
                <p className="text-white/50 text-xs mt-0.5">
                  When token volume exceeds threshold
                </p>
              </div>
            </button>

            {volumeTrigger.enabled && (
              <div className="ml-8 flex items-center gap-2 flex-wrap text-sm">
                <span className="text-white/70">When volume exceeds</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">$</span>
                  <Input
                    type="number"
                    value={volumeTrigger.config.threshold || 100000}
                    onChange={(e) =>
                      updateTriggerConfig(volumeTrigger.id, {
                        threshold: parseInt(e.target.value),
                      })
                    }
                    className="w-[140px] pl-7 bg-white/[0.04] border-white/[0.12] text-white"
                  />
                </div>
                <span className="text-white/70">in last</span>
                <Select
                  value={volumeTrigger.config.timeWindow?.toString() || '15'}
                  onValueChange={(value) =>
                    updateTriggerConfig(volumeTrigger.id, { timeWindow: parseInt(value) })
                  }
                >
                  <SelectTrigger className="w-[130px] bg-white/[0.04] border-white/[0.12] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/[0.12]">
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Liquidity Gate */}
        {liquidityTrigger && (
          <div className="border border-white/[0.08] rounded-lg p-4">
            <button
              onClick={() => toggleTrigger(liquidityTrigger.id)}
              className="flex items-start gap-3 w-full text-left mb-3"
            >
              {liquidityTrigger.enabled ? (
                <CheckCircle2 className="w-5 h-5 text-[#22c55e] flex-shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-white/30 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h4 className="text-white font-medium text-sm">Liquidity Gate</h4>
                <p className="text-white/50 text-xs mt-0.5">
                  Only buy tokens with sufficient liquidity
                </p>
              </div>
            </button>

            {liquidityTrigger.enabled && (
              <div className="ml-8 flex items-center gap-2 flex-wrap text-sm">
                <span className="text-white/70">Minimum liquidity</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">$</span>
                  <Input
                    type="number"
                    value={liquidityTrigger.config.minLiquidity || 50000}
                    onChange={(e) =>
                      updateTriggerConfig(liquidityTrigger.id, {
                        minLiquidity: parseInt(e.target.value),
                      })
                    }
                    className="w-[140px] pl-7 bg-white/[0.04] border-white/[0.12] text-white"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
