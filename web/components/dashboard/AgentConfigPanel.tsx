'use client';

import { useState, useCallback } from 'react';
import { Settings, User, Twitter, Shield, TrendingUp, Save, Loader2, CheckCircle2, Circle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { updateAgentProfileAuth, saveAgentConfig } from '@/lib/api';
import { OnboardingChecklist } from '@/components/arena/OnboardingChecklist';
import type { OnboardingTask } from '@/lib/types';

// ── Section Wrapper ──────────────────────────────────────────────

function ConfigSection({
    title,
    icon: Icon,
    children,
    defaultOpen = true,
}: {
    title: string;
    icon: any;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="border border-white/[0.06] rounded overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-accent-primary" />
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wider">{title}</span>
                </div>
                {open ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
            </button>
            {open && (
                <div className="px-3 py-3 space-y-3 border-t border-white/[0.04]">
                    {children}
                </div>
            )}
        </div>
    );
}

// ── Input Field ──────────────────────────────────────────────────

function Field({
    label,
    value,
    onChange,
    placeholder,
    disabled,
    multiline,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    multiline?: boolean;
}) {
    const base = "w-full bg-white/[0.03] border border-white/[0.08] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent-primary/30 focus:outline-none transition-colors rounded";

    return (
        <div>
            <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</label>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={3}
                    className={`${base} resize-none`}
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={base}
                />
            )}
        </div>
    );
}

// ── SliderField ──────────────────────────────────────────────────

function SliderField({
    label,
    value,
    onChange,
    min,
    max,
    step,
    unit,
    description,
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
    unit?: string;
    description?: string;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-text-muted uppercase tracking-wider">{label}</label>
                <span className="text-xs font-mono font-bold text-accent-primary">
                    {value}{unit}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-1 bg-white/[0.08] rounded appearance-none cursor-pointer accent-accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(232,180,94,0.4)]"
            />
            {description && <p className="text-[10px] text-text-muted mt-0.5">{description}</p>}
        </div>
    );
}

// ── Chip Toggle ──────────────────────────────────────────────────

function ChipToggle({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer ${active
                ? 'border-accent-primary/30 bg-accent-primary/10 text-accent-primary'
                : 'border-white/[0.06] bg-white/[0.02] text-text-muted hover:bg-white/[0.04]'
                }`}
        >
            {label}
        </button>
    );
}

// ── Main Component ───────────────────────────────────────────────

export function AgentConfigPanel() {
    const { agent, onboardingTasks, onboardingProgress, updateAgent } = useAuthStore();

    // Profile fields
    const [displayName, setDisplayName] = useState(agent?.name || '');
    const [bio, setBio] = useState(agent?.bio || '');
    const [twitterHandle, setTwitterHandle] = useState(agent?.twitterHandle || '');
    const [saving, setSaving] = useState(false);

    // Trading params (configurable)
    const [riskLevel, setRiskLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'>('MEDIUM');
    const [maxPositionSize, setMaxPositionSize] = useState(0.05);
    const [takeProfitPercent, setTakeProfitPercent] = useState(25);
    const [stopLossPercent, setStopLossPercent] = useState(15);
    const [aggression, setAggression] = useState(60);

    // Data source toggles
    const [enabledFeeds, setEnabledFeeds] = useState({
        helius: true,
        devprint: true,
        twitter: true,
        dexscreener: true,
    });

    const handleSaveProfile = useCallback(async () => {
        setSaving(true);
        try {
            await updateAgentProfileAuth({ bio: bio || undefined });
            updateAgent({ bio });
            toast.success('Profile updated');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    }, [bio, updateAgent]);

    // Persist trading config to backend
    const [savingConfig, setSavingConfig] = useState(false);
    const handleSaveConfig = useCallback(async () => {
        setSavingConfig(true);
        try {
            await saveAgentConfig({
                riskLevel,
                maxPositionSize,
                takeProfitPercent,
                stopLossPercent,
                aggression,
                enabledFeeds,
            });
            toast.success('Trading config saved');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err?.message || 'Failed to save config');
        } finally {
            setSavingConfig(false);
        }
    }, [riskLevel, maxPositionSize, takeProfitPercent, stopLossPercent, aggression, enabledFeeds]);

    const toggleFeed = (key: keyof typeof enabledFeeds) => {
        setEnabledFeeds(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (!agent) return null;

    return (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <Settings className="w-4 h-4 text-accent-primary" />
                <h3 className="text-sm font-bold text-text-primary">Agent Configuration</h3>
            </div>

            <div className="p-3 space-y-3">
                {/* Profile Section */}
                <ConfigSection title="Profile" icon={User}>
                    <Field label="Display Name" value={displayName} onChange={setDisplayName} placeholder="Your agent's display name" />
                    <Field label="Bio" value={bio} onChange={setBio} placeholder="Describe your trading strategy…" multiline />
                    <Field label="Twitter" value={twitterHandle} onChange={setTwitterHandle} placeholder="@handle" />
                    <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20 transition-all text-xs font-semibold disabled:opacity-50 cursor-pointer rounded"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {saving ? 'Saving…' : 'Save Profile'}
                    </button>
                </ConfigSection>

                {/* Trading Parameters */}
                <ConfigSection title="Trading Parameters" icon={TrendingUp} defaultOpen={false}>
                    {/* Risk Level */}
                    <div>
                        <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Risk Level</label>
                        <div className="flex gap-1.5">
                            {(['LOW', 'MEDIUM', 'HIGH', 'EXTREME'] as const).map(level => (
                                <ChipToggle
                                    key={level}
                                    label={level}
                                    active={riskLevel === level}
                                    onClick={() => setRiskLevel(level)}
                                />
                            ))}
                        </div>
                    </div>

                    <SliderField
                        label="Max Position Size"
                        value={maxPositionSize}
                        onChange={setMaxPositionSize}
                        min={0.01}
                        max={1.0}
                        step={0.01}
                        unit=" SOL"
                        description="Maximum SOL per trade"
                    />
                    <SliderField
                        label="Take Profit"
                        value={takeProfitPercent}
                        onChange={setTakeProfitPercent}
                        min={5}
                        max={100}
                        step={5}
                        unit="%"
                        description="Auto-sell when profit exceeds this %"
                    />
                    <SliderField
                        label="Stop Loss"
                        value={stopLossPercent}
                        onChange={setStopLossPercent}
                        min={5}
                        max={50}
                        step={5}
                        unit="%"
                        description="Auto-sell when loss exceeds this %"
                    />
                    <SliderField
                        label="Aggression"
                        value={aggression}
                        onChange={setAggression}
                        min={10}
                        max={100}
                        step={5}
                        unit=""
                        description="Higher = more trades, faster entries"
                    />

                    <div className="bg-amber-500/5 border border-amber-500/10 p-2 rounded flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-400/80 leading-tight">
                            Trading parameters are saved to your agent config. Changes take effect on the next trading cycle.
                        </p>
                    </div>

                    <button
                        onClick={handleSaveConfig}
                        disabled={savingConfig}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20 transition-all text-xs font-semibold disabled:opacity-50 cursor-pointer rounded"
                    >
                        {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {savingConfig ? 'Saving…' : 'Save Config'}
                    </button>
                </ConfigSection>

                {/* Data Sources */}
                <ConfigSection title="Data Feeds" icon={Shield} defaultOpen={false}>
                    <p className="text-[10px] text-text-muted mb-2">
                        Toggle which data streams your agent listens to for analysis and trade decisions.
                    </p>
                    {Object.entries({
                        helius: { label: 'Helius WebSocket', desc: 'On-chain transaction monitoring' },
                        devprint: { label: 'DevPrint / J7 Tracker', desc: 'Token discovery + tweet ingestion' },
                        twitter: { label: 'Twitter Intelligence', desc: 'Mindshare density & narrative scanning' },
                        dexscreener: { label: 'DexScreener', desc: 'Price, volume, liquidity data' },
                    }).map(([key, { label, desc }]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0"
                        >
                            <div className="min-w-0">
                                <span className="text-xs font-semibold text-text-primary block">{label}</span>
                                <span className="text-[10px] text-text-muted">{desc}</span>
                            </div>
                            <button
                                onClick={() => toggleFeed(key as keyof typeof enabledFeeds)}
                                className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer ${enabledFeeds[key as keyof typeof enabledFeeds]
                                    ? 'bg-emerald-500/30'
                                    : 'bg-white/[0.08]'
                                    }`}
                            >
                                <div
                                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${enabledFeeds[key as keyof typeof enabledFeeds]
                                        ? 'left-4 bg-emerald-400'
                                        : 'left-0.5 bg-text-muted'
                                        }`}
                                />
                            </button>
                        </div>
                    ))}
                </ConfigSection>

                {/* Onboarding Progress */}
                {onboardingProgress < 100 && (
                    <ConfigSection title="Onboarding" icon={CheckCircle2}>
                        <OnboardingChecklist
                            tasks={onboardingTasks}
                            completedTasks={onboardingTasks.filter((t: OnboardingTask) => t.status === 'VALIDATED').length}
                            totalTasks={onboardingTasks.length}
                        />
                    </ConfigSection>
                )}
            </div>
        </div>
    );
}
