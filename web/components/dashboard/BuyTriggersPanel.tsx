'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Loader2, Save, CheckCircle2, Circle, ChevronDown, Wallet, TrendingUp, Droplets, Users, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import {
    getAgentConfig,
    updateAgentConfig,
    type BuyTrigger,
} from '@/lib/api/agent-config';

// ── Trigger Definitions ──────────────────────────────────────────

interface TriggerDef {
    type: string;
    label: string;
    description: string;
    icon: typeof Wallet;
    color: string;
    fields: TriggerField[];
}

interface TriggerField {
    key: string;
    label: string;
    type: 'number' | 'select';
    unit?: string;
    prefix?: string;
    min?: number;
    max?: number;
    step?: number;
    defaultValue: number;
    options?: { value: string; label: string }[];
}

const TRIGGER_DEFS: TriggerDef[] = [
    {
        type: 'godwallet',
        label: 'Copy Trade',
        description: 'Auto-buy when a tracked wallet buys a token',
        icon: Wallet,
        color: 'text-[#818CF8]',
        fields: [
            { key: 'autoBuyAmount', label: 'Buy amount', type: 'number', unit: ' SOL', min: 0.01, max: 5, step: 0.01, defaultValue: 0.1 },
        ],
    },
    {
        type: 'consensus',
        label: 'Consensus Buy',
        description: 'When multiple tracked wallets buy the same token',
        icon: Users,
        color: 'text-emerald-400',
        fields: [
            { key: 'walletCount', label: 'Wallets needed', type: 'select', defaultValue: 3, options: [
                { value: '2', label: '2 wallets' },
                { value: '3', label: '3 wallets' },
                { value: '5', label: '5 wallets' },
            ]},
            { key: 'timeWindowMinutes', label: 'Time window', type: 'select', defaultValue: 60, options: [
                { value: '15', label: '15 min' },
                { value: '30', label: '30 min' },
                { value: '60', label: '1 hour' },
            ]},
            { key: 'autoBuyAmount', label: 'Buy amount', type: 'number', unit: ' SOL', min: 0.01, max: 5, step: 0.01, defaultValue: 0.1 },
        ],
    },
    {
        type: 'volume',
        label: 'Volume Spike',
        description: 'When token 24h volume exceeds threshold',
        icon: TrendingUp,
        color: 'text-amber-400',
        fields: [
            { key: 'volumeThreshold', label: 'Volume threshold', type: 'number', prefix: '$', min: 10000, max: 10000000, step: 10000, defaultValue: 100000 },
            { key: 'autoBuyAmount', label: 'Buy amount', type: 'number', unit: ' SOL', min: 0.01, max: 5, step: 0.01, defaultValue: 0.05 },
        ],
    },
    {
        type: 'liquidity',
        label: 'Liquidity Gate',
        description: 'Only buy tokens with sufficient liquidity',
        icon: Droplets,
        color: 'text-blue-400',
        fields: [
            { key: 'minLiquidity', label: 'Min liquidity', type: 'number', prefix: '$', min: 1000, max: 1000000, step: 1000, defaultValue: 50000 },
            { key: 'autoBuyAmount', label: 'Buy amount', type: 'number', unit: ' SOL', min: 0.01, max: 5, step: 0.01, defaultValue: 0.05 },
        ],
    },
    {
        type: 'trending',
        label: 'Trending',
        description: 'Buy tokens with high arena activity score',
        icon: Flame,
        color: 'text-orange-400',
        fields: [
            { key: 'minActivityScore', label: 'Min activity score', type: 'number', min: 5, max: 100, step: 5, defaultValue: 20 },
            { key: 'autoBuyAmount', label: 'Buy amount', type: 'number', unit: ' SOL', min: 0.01, max: 5, step: 0.01, defaultValue: 0.05 },
        ],
    },
];

// ── Trigger Row ──────────────────────────────────────────────────

function TriggerRow({
    def,
    trigger,
    onToggle,
    onConfigChange,
}: {
    def: TriggerDef;
    trigger: BuyTrigger;
    onToggle: () => void;
    onConfigChange: (key: string, value: number) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const Icon = def.icon;

    return (
        <div className="border border-white/[0.06] overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
                <button
                    onClick={onToggle}
                    className="flex-shrink-0 cursor-pointer"
                >
                    {trigger.enabled ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                        <Circle className="w-4 h-4 text-white/20" />
                    )}
                </button>
                <Icon className={`w-4 h-4 flex-shrink-0 ${trigger.enabled ? def.color : 'text-white/20'}`} />
                <div className="flex-1 min-w-0">
                    <span className={`text-xs font-semibold ${trigger.enabled ? 'text-text-primary' : 'text-text-muted'}`}>
                        {def.label}
                    </span>
                    <span className="text-[10px] text-text-muted block">
                        {def.description}
                    </span>
                </div>
                {trigger.enabled && def.fields.length > 0 && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-1 cursor-pointer"
                    >
                        <ChevronDown
                            className="w-3.5 h-3.5 text-text-muted transition-transform"
                            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        />
                    </button>
                )}
            </div>

            {/* Config Fields */}
            {trigger.enabled && expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-white/[0.04] space-y-2.5">
                    {def.fields.map((field) => (
                        <div key={field.key} className="flex items-center justify-between gap-3">
                            <label className="text-[10px] text-text-muted uppercase tracking-wider flex-shrink-0">
                                {field.label}
                            </label>
                            {field.type === 'select' ? (
                                <select
                                    value={(trigger.config[field.key] ?? field.defaultValue).toString()}
                                    onChange={(e) => onConfigChange(field.key, parseInt(e.target.value))}
                                    className="text-xs bg-white/[0.04] border border-white/[0.08] text-text-primary px-2 py-1.5 outline-none hover:bg-white/[0.06] transition-colors cursor-pointer appearance-none pr-6"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 6px center',
                                    }}
                                >
                                    {field.options?.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="relative">
                                    {field.prefix && (
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">{field.prefix}</span>
                                    )}
                                    <input
                                        type="number"
                                        value={trigger.config[field.key] ?? field.defaultValue}
                                        onChange={(e) => onConfigChange(field.key, parseFloat(e.target.value))}
                                        min={field.min}
                                        max={field.max}
                                        step={field.step}
                                        className={`w-[100px] text-xs bg-white/[0.04] border border-white/[0.08] text-text-primary py-1.5 outline-none focus:border-accent-primary/30 transition-colors font-mono ${field.prefix ? 'pl-5 pr-2' : 'px-2'}`}
                                    />
                                    {field.unit && (
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">{field.unit}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────

export function BuyTriggersPanel() {
    const { agent } = useAuthStore();
    const [triggers, setTriggers] = useState<BuyTrigger[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    // Load triggers from API
    useEffect(() => {
        if (!agent) { setLoading(false); return; }

        const token = localStorage.getItem('jwt');
        if (!token) { setLoading(false); return; }

        getAgentConfig(token)
            .then((config) => {
                const existing = config.buyTriggers || [];
                // Ensure all trigger types exist
                const allTriggers = TRIGGER_DEFS.map((def) => {
                    const found = existing.find((t) => t.type === def.type);
                    if (found) return found;
                    // Create default disabled trigger
                    const defaultConfig: Record<string, number> = {};
                    def.fields.forEach((f) => { defaultConfig[f.key] = f.defaultValue; });
                    return {
                        type: def.type as BuyTrigger['type'],
                        enabled: false,
                        config: defaultConfig,
                    };
                });
                setTriggers(allTriggers);
            })
            .catch(() => {
                // Init with defaults
                const defaults = TRIGGER_DEFS.map((def) => {
                    const defaultConfig: Record<string, number> = {};
                    def.fields.forEach((f) => { defaultConfig[f.key] = f.defaultValue; });
                    return {
                        type: def.type as BuyTrigger['type'],
                        enabled: false,
                        config: defaultConfig,
                    };
                });
                setTriggers(defaults);
            })
            .finally(() => setLoading(false));
    }, [agent]);

    const handleToggle = useCallback((type: string) => {
        setTriggers((prev) =>
            prev.map((t) => t.type === type ? { ...t, enabled: !t.enabled } : t)
        );
        setDirty(true);
    }, []);

    const handleConfigChange = useCallback((type: string, key: string, value: number) => {
        setTriggers((prev) =>
            prev.map((t) => t.type === type ? { ...t, config: { ...t.config, [key]: value } } : t)
        );
        setDirty(true);
    }, []);

    const handleSave = useCallback(async () => {
        const token = localStorage.getItem('jwt');
        if (!token) return;

        setSaving(true);
        try {
            await updateAgentConfig(token, {
                triggers: triggers.filter((t) => t.enabled),
            });
            toast.success('Triggers saved');
            setDirty(false);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save triggers';
            toast.error(message);
        } finally {
            setSaving(false);
        }
    }, [triggers]);

    if (!agent) return null;

    const enabledCount = triggers.filter((t) => t.enabled).length;

    return (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-text-primary">Buy Triggers</h3>
                    <span className="text-[10px] text-text-muted bg-white/[0.04] px-2 py-0.5 rounded-full">
                        {enabledCount} active
                    </span>
                </div>
                {dirty && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20 transition-all text-xs font-semibold disabled:opacity-50 cursor-pointer"
                    >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                )}
            </div>

            <div className="p-3">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <span className="text-[10px] text-text-muted block mb-2">
                            Agent auto-buys when these conditions are met. Max 5 trades/day, 60s cooldown.
                        </span>
                        {TRIGGER_DEFS.map((def) => {
                            const trigger = triggers.find((t) => t.type === def.type);
                            if (!trigger) return null;
                            return (
                                <TriggerRow
                                    key={def.type}
                                    def={def}
                                    trigger={trigger}
                                    onToggle={() => handleToggle(def.type)}
                                    onConfigChange={(key, value) => handleConfigChange(def.type, key, value)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
