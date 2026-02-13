'use client';

import { useState, useEffect, useCallback } from 'react';
import { Crosshair, Plus, X, Loader2, Wallet, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import {
    getAgentConfig,
    addTrackedWallet,
    removeTrackedWallet,
    type TrackedWallet,
} from '@/lib/api/agent-config';

// ── Helpers ──────────────────────────────────────────────────────

function truncateAddress(addr: string) {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── Wallet Chip ──────────────────────────────────────────────────

function WalletChip({
    wallet,
    onRemove,
    removing,
}: {
    wallet: TrackedWallet;
    onRemove: () => void;
    removing: boolean;
}) {
    const [copied, setCopied] = useState(false);

    const copyAddress = () => {
        navigator.clipboard.writeText(wallet.address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.12] transition-colors group">
            <Wallet className="w-3.5 h-3.5 text-[#818CF8] flex-shrink-0" />
            <div className="flex flex-col min-w-0">
                {wallet.label && (
                    <span className="text-xs font-semibold text-text-primary truncate">{wallet.label}</span>
                )}
                <span className="text-[10px] font-mono text-text-muted truncate">{truncateAddress(wallet.address)}</span>
            </div>
            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                <button
                    onClick={copyAddress}
                    className="p-1 text-text-muted hover:text-text-secondary transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
                <button
                    onClick={onRemove}
                    disabled={removing}
                    className="p-1 text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer disabled:opacity-50"
                >
                    {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                </button>
            </div>
        </div>
    );
}

// ── Add Wallet Inline Form ───────────────────────────────────────

function AddWalletForm({ onAdd, adding }: { onAdd: (address: string, label: string) => void; adding: boolean }) {
    const [address, setAddress] = useState('');
    const [label, setLabel] = useState('');
    const [expanded, setExpanded] = useState(false);

    const handleSubmit = () => {
        if (!address.trim()) return;
        onAdd(address.trim(), label.trim());
        setAddress('');
        setLabel('');
        setExpanded(false);
    };

    if (!expanded) {
        return (
            <button
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-white/[0.12] hover:border-accent-primary/30 hover:bg-white/[0.02] text-text-muted hover:text-accent-primary transition-all text-xs cursor-pointer"
            >
                <Plus className="w-3.5 h-3.5" />
                Add Wallet
            </button>
        );
    }

    return (
        <div className="border border-accent-primary/20 bg-accent-primary/[0.03] p-3 space-y-2">
            <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Solana wallet address..."
                autoFocus
                className="w-full bg-white/[0.03] border border-white/[0.08] px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 focus:border-accent-primary/30 focus:outline-none transition-colors font-mono"
            />
            <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (optional) e.g. God Wallet #1"
                className="w-full bg-white/[0.03] border border-white/[0.08] px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 focus:border-accent-primary/30 focus:outline-none transition-colors"
            />
            <div className="flex items-center gap-2 pt-1">
                <button
                    onClick={handleSubmit}
                    disabled={!address.trim() || adding}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20 transition-all text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                    {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Add
                </button>
                <button
                    onClick={() => { setExpanded(false); setAddress(''); setLabel(''); }}
                    className="px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────

export function TrackedWalletsPanel() {
    const { agent } = useAuthStore();
    const [wallets, setWallets] = useState<TrackedWallet[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    // Load wallets from config
    useEffect(() => {
        if (!agent) { setLoading(false); return; }

        const token = localStorage.getItem('jwt');
        if (!token) { setLoading(false); return; }

        getAgentConfig(token)
            .then((config) => setWallets(config.trackedWallets || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [agent]);

    const handleAdd = useCallback(async (address: string, label: string) => {
        const token = localStorage.getItem('jwt');
        if (!token) return;

        setAdding(true);
        try {
            const wallet = await addTrackedWallet(token, {
                address,
                label: label || undefined,
                chain: 'SOLANA',
            });
            setWallets((prev) => [...prev, wallet]);
            toast.success('Wallet added');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err?.message || 'Failed to add wallet');
        } finally {
            setAdding(false);
        }
    }, []);

    const handleRemove = useCallback(async (wallet: TrackedWallet) => {
        const token = localStorage.getItem('jwt');
        if (!token) return;

        const id = wallet.id || wallet.address;
        setRemovingId(id);
        try {
            await removeTrackedWallet(token, id);
            setWallets((prev) => prev.filter((w) => (w.id || w.address) !== id));
            toast.success('Wallet removed');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err?.message || 'Failed to remove wallet');
        } finally {
            setRemovingId(null);
        }
    }, []);

    if (!agent) return null;

    return (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-[#818CF8]" />
                    <h3 className="text-sm font-bold text-text-primary">Tracked Wallets</h3>
                    <span className="text-[10px] text-text-muted bg-white/[0.04] px-2 py-0.5 rounded-full">
                        {wallets.length}
                    </span>
                </div>
                <AddWalletForm onAdd={handleAdd} adding={adding} />
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
                    </div>
                ) : wallets.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-white/[0.08]">
                        <Wallet className="w-6 h-6 text-white/15 mx-auto mb-2" />
                        <p className="text-xs text-text-muted">No wallets tracked yet</p>
                        <p className="text-[10px] text-text-muted/60 mt-0.5">Agent monitors these wallets for trading signals</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <span className="text-[10px] text-text-muted">
                            Agent monitors these wallets for trading signals
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {wallets.map((wallet) => (
                                <WalletChip
                                    key={wallet.id || wallet.address}
                                    wallet={wallet}
                                    onRemove={() => handleRemove(wallet)}
                                    removing={removingId === (wallet.id || wallet.address)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
