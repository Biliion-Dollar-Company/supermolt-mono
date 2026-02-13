'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Plus, X, Wallet, Zap, Save, Loader2, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore, useAuthHydrated } from '@/store/authStore';
import { getJWT } from '@/lib/api';
import {
  getAgentConfig,
  updateAgentConfig,
  addTrackedWallet,
  removeTrackedWallet,
  type TrackedWallet,
  type BuyTrigger,
  type AgentConfiguration,
} from '@/lib/api/agent-config';

// Default triggers created for new agents
const DEFAULT_TRIGGERS: BuyTrigger[] = [
  {
    type: 'godwallet',
    enabled: true,
    config: { autoBuyAmount: 0.1 },
  },
  {
    type: 'consensus',
    enabled: false,
    config: { walletCount: 2, timeWindowMinutes: 60 },
  },
  {
    type: 'volume',
    enabled: false,
    config: { volumeThreshold: 100000, autoBuyAmount: 0.05 },
  },
  {
    type: 'liquidity',
    enabled: false,
    config: { minLiquidity: 50000, autoBuyAmount: 0.05 },
  },
];

function truncateAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function AgentConfigPanel() {
  const hydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const agent = useAuthStore((s) => s.agent);

  const [config, setConfig] = useState<AgentConfiguration | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Wallet dialog state
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newChain, setNewChain] = useState<'SOLANA' | 'BSC'>('SOLANA');

  // Local trigger state
  const [triggers, setTriggers] = useState<BuyTrigger[]>([]);

  const fetchConfig = useCallback(async () => {
    const token = getJWT();
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const data = await getAgentConfig(token);
      setConfig(data);
      setTriggers(
        data.buyTriggers.length > 0
          ? data.buyTriggers
          : DEFAULT_TRIGGERS
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      fetchConfig();
    }
  }, [hydrated, isAuthenticated, fetchConfig]);

  if (!hydrated || !isAuthenticated || !agent) return null;

  // ── Wallet Management ──────────────────────────────────

  const handleAddWallet = async () => {
    if (!newAddress.trim()) return;
    const token = getJWT();
    if (!token) return;

    try {
      const wallet = await addTrackedWallet(token, {
        address: newAddress.trim(),
        label: newLabel.trim() || undefined,
        chain: newChain,
      });
      setConfig((prev) =>
        prev
          ? { ...prev, trackedWallets: [...prev.trackedWallets, wallet] }
          : prev
      );
      setNewAddress('');
      setNewLabel('');
      setNewChain('SOLANA');
      setWalletDialogOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to add wallet');
    }
  };

  const handleRemoveWallet = async (walletId: string) => {
    const token = getJWT();
    if (!token || !walletId) return;

    try {
      await removeTrackedWallet(token, walletId);
      setConfig((prev) =>
        prev
          ? { ...prev, trackedWallets: prev.trackedWallets.filter((w) => w.id !== walletId) }
          : prev
      );
    } catch (err: any) {
      setError(err.message || 'Failed to remove wallet');
    }
  };

  // ── Trigger Management ─────────────────────────────────

  const toggleTrigger = (type: string) => {
    setTriggers((prev) =>
      prev.map((t) => (t.type === type ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const updateTriggerConfig = (type: string, patch: Record<string, any>) => {
    setTriggers((prev) =>
      prev.map((t) =>
        t.type === type ? { ...t, config: { ...t.config, ...patch } } : t
      )
    );
  };

  // ── Save All ───────────────────────────────────────────

  const handleSave = async () => {
    const token = getJWT();
    if (!token) return;

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateAgentConfig(token, { triggers });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
      </div>
    );
  }

  const wallets = config?.trackedWallets ?? [];
  const godwalletTrigger = triggers.find((t) => t.type === 'godwallet');
  const consensusTrigger = triggers.find((t) => t.type === 'consensus');
  const volumeTrigger = triggers.find((t) => t.type === 'volume');
  const liquidityTrigger = triggers.find((t) => t.type === 'liquidity');

  return (
    <div className="max-w-2xl space-y-6">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400/50 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          Configuration saved successfully
        </div>
      )}

      {/* ── Tracked Wallets ──────────────────────────────── */}
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold text-base flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#E8B45E]" />
              Tracked Wallets
            </h3>
            <p className="text-white/40 text-xs mt-1">
              Monitor these wallets for trading signals. Your agent auto-buys when they trade.
            </p>
          </div>
          <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs border-dashed border-white/20 text-white/70 hover:text-white">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-[#0f0f0f] border-white/[0.08]">
              <DialogHeader>
                <DialogTitle className="text-white">Add Tracked Wallet</DialogTitle>
                <DialogDescription className="text-white/50">
                  Add a wallet address to track for trading signals
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm text-white/70 mb-1.5 block">Chain</label>
                  <Select value={newChain} onValueChange={(v) => setNewChain(v as 'SOLANA' | 'BSC')}>
                    <SelectTrigger className="bg-white/[0.04] border-white/[0.12] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-white/[0.12]">
                      <SelectItem value="SOLANA">Solana</SelectItem>
                      <SelectItem value="BSC">BSC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-white/70 mb-1.5 block">Wallet Address *</label>
                  <Input
                    placeholder={newChain === 'SOLANA' ? 'Enter Solana address...' : 'Enter BSC address (0x...)'}
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="bg-white/[0.04] border-white/[0.12] text-white font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-white/70 mb-1.5 block">Label (Optional)</label>
                  <Input
                    placeholder="e.g., God Wallet, Alpha Trader..."
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="bg-white/[0.04] border-white/[0.12] text-white"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setWalletDialogOpen(false)} className="text-white/70 border-white/[0.12]">
                    Cancel
                  </Button>
                  <Button onClick={handleAddWallet} disabled={!newAddress.trim()} className="bg-accent-primary hover:bg-accent-primary/80 text-black">
                    Add Wallet
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Wallet chips */}
        {wallets.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {wallets.map((w) => (
              <div
                key={w.id || w.address}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.06] border border-white/[0.10] rounded-full text-sm"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${w.chain === 'BSC' ? 'bg-yellow-400' : 'bg-purple-400'}`} />
                <span className="text-white font-mono text-xs">
                  {w.label || truncateAddress(w.address)}
                </span>
                <span className="text-white/30 text-[10px]">{w.chain}</span>
                <button onClick={() => handleRemoveWallet(w.id!)} className="text-white/30 hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 border-2 border-dashed border-white/[0.06] rounded-lg">
            <Wallet className="w-6 h-6 text-white/15 mx-auto mb-2" />
            <p className="text-white/40 text-xs">No wallets tracked yet</p>
            <p className="text-white/25 text-[10px] mt-1">Add wallets to receive trading signals</p>
          </div>
        )}
      </div>

      {/* ── Buy Triggers ─────────────────────────────────── */}
      <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] rounded-lg p-5">
        <div className="mb-4">
          <h3 className="text-white font-semibold text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent-primary" />
            Buy Triggers
          </h3>
          <p className="text-white/40 text-xs mt-1">
            Automatically queue buy orders when these conditions are met.
          </p>
        </div>

        <div className="space-y-3">
          {/* God Wallet Copy */}
          {godwalletTrigger && (
            <TriggerCard
              title="God Wallet Copy"
              description="Auto-buy when a tracked wallet buys"
              enabled={godwalletTrigger.enabled}
              onToggle={() => toggleTrigger('godwallet')}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/60">Buy amount:</span>
                <Input
                  type="number"
                  step="0.01"
                  value={godwalletTrigger.config.autoBuyAmount ?? 0.1}
                  onChange={(e) => updateTriggerConfig('godwallet', { autoBuyAmount: parseFloat(e.target.value) || 0.1 })}
                  className="w-[90px] bg-white/[0.04] border-white/[0.12] text-white text-sm h-8"
                />
                <span className="text-white/60">SOL</span>
              </div>
            </TriggerCard>
          )}

          {/* Consensus Buy */}
          {consensusTrigger && (
            <TriggerCard
              title="Consensus Buy"
              description="When multiple tracked wallets buy the same token"
              enabled={consensusTrigger.enabled}
              onToggle={() => toggleTrigger('consensus')}
            >
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-white/60">When</span>
                <Select
                  value={String(consensusTrigger.config.walletCount ?? 2)}
                  onValueChange={(v) => updateTriggerConfig('consensus', { walletCount: parseInt(v) })}
                >
                  <SelectTrigger className="w-[110px] bg-white/[0.04] border-white/[0.12] text-white h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-white/[0.12]">
                    <SelectItem value="2">2 wallets</SelectItem>
                    <SelectItem value="3">3 wallets</SelectItem>
                    <SelectItem value="5">5 wallets</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-white/60">buy within</span>
                <Input
                  type="number"
                  value={consensusTrigger.config.timeWindowMinutes ?? 60}
                  onChange={(e) => updateTriggerConfig('consensus', { timeWindowMinutes: parseInt(e.target.value) || 60 })}
                  className="w-[70px] bg-white/[0.04] border-white/[0.12] text-white text-sm h-8"
                />
                <span className="text-white/60">min</span>
              </div>
            </TriggerCard>
          )}

          {/* Volume Spike */}
          {volumeTrigger && (
            <TriggerCard
              title="Volume Spike"
              description="When 24h volume exceeds threshold"
              enabled={volumeTrigger.enabled}
              onToggle={() => toggleTrigger('volume')}
            >
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-white/60">Volume above</span>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
                  <Input
                    type="number"
                    value={volumeTrigger.config.volumeThreshold ?? 100000}
                    onChange={(e) => updateTriggerConfig('volume', { volumeThreshold: parseInt(e.target.value) || 100000 })}
                    className="w-[120px] pl-5 bg-white/[0.04] border-white/[0.12] text-white text-sm h-8"
                  />
                </div>
                <span className="text-white/60">| Buy:</span>
                <Input
                  type="number"
                  step="0.01"
                  value={volumeTrigger.config.autoBuyAmount ?? 0.05}
                  onChange={(e) => updateTriggerConfig('volume', { autoBuyAmount: parseFloat(e.target.value) || 0.05 })}
                  className="w-[80px] bg-white/[0.04] border-white/[0.12] text-white text-sm h-8"
                />
                <span className="text-white/60">SOL</span>
              </div>
            </TriggerCard>
          )}

          {/* Liquidity Gate */}
          {liquidityTrigger && (
            <TriggerCard
              title="Liquidity Gate"
              description="Only buy tokens with sufficient liquidity"
              enabled={liquidityTrigger.enabled}
              onToggle={() => toggleTrigger('liquidity')}
            >
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-white/60">Min liquidity</span>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
                  <Input
                    type="number"
                    value={liquidityTrigger.config.minLiquidity ?? 50000}
                    onChange={(e) => updateTriggerConfig('liquidity', { minLiquidity: parseInt(e.target.value) || 50000 })}
                    className="w-[120px] pl-5 bg-white/[0.04] border-white/[0.12] text-white text-sm h-8"
                  />
                </div>
                <span className="text-white/60">| Buy:</span>
                <Input
                  type="number"
                  step="0.01"
                  value={liquidityTrigger.config.autoBuyAmount ?? 0.05}
                  onChange={(e) => updateTriggerConfig('liquidity', { autoBuyAmount: parseFloat(e.target.value) || 0.05 })}
                  className="w-[80px] bg-white/[0.04] border-white/[0.12] text-white text-sm h-8"
                />
                <span className="text-white/60">SOL</span>
              </div>
            </TriggerCard>
          )}
        </div>
      </div>

      {/* ── Save Button ──────────────────────────────────── */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-accent-primary hover:bg-accent-primary/80 text-black font-medium px-6"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Triggers
        </Button>
      </div>
    </div>
  );
}

// ── Trigger Card Sub-component ──────────────────────────

function TriggerCard({
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`border rounded-lg p-4 transition-colors ${enabled ? 'border-accent-primary/30 bg-accent-primary/[0.02]' : 'border-white/[0.06]'}`}>
      <button onClick={onToggle} className="flex items-start gap-3 w-full text-left mb-2">
        {enabled ? (
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
        ) : (
          <Circle className="w-5 h-5 text-white/25 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <h4 className="text-white font-medium text-sm">{title}</h4>
          <p className="text-white/40 text-xs mt-0.5">{description}</p>
        </div>
      </button>
      {enabled && <div className="ml-8">{children}</div>}
    </div>
  );
}
