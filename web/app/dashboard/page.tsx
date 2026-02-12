'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Settings, Activity, GitBranch } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getMyAgent } from '@/lib/api';
import { AgentIdentityBar, AgentConfigPanel, DataPipelineFlow, ActivityFeed } from '@/components/dashboard';

// ── Skeleton ─────────────────────────────────────────────────────

function SkeletonBlock({ className = '' }: { className?: string }) {
    return <div className={`bg-white/[0.03] animate-pulse rounded ${className}`} />;
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* Identity bar skeleton */}
            <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <SkeletonBlock className="w-12 h-12 rounded" />
                    <div className="space-y-2 flex-1">
                        <SkeletonBlock className="h-5 w-40" />
                        <SkeletonBlock className="h-3 w-24" />
                    </div>
                </div>
                <SkeletonBlock className="h-3 w-full" />
                <div className="grid grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonBlock key={i} className="h-16" />
                    ))}
                </div>
            </div>
            {/* Pipeline skeleton */}
            <SkeletonBlock className="h-[550px]" />
            {/* Bottom row skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
                <SkeletonBlock className="h-[400px]" />
                <SkeletonBlock className="h-[400px]" />
            </div>
        </div>
    );
}

// ── Tab System ───────────────────────────────────────────────────

type DashboardTab = 'overview' | 'pipeline' | 'config' | 'activity';

const TABS: { key: DashboardTab; label: string; Icon: any }[] = [
    { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { key: 'pipeline', label: 'Data Pipeline', Icon: GitBranch },
    { key: 'config', label: 'Configure', Icon: Settings },
    { key: 'activity', label: 'Activity', Icon: Activity },
];

// ── Main Page ────────────────────────────────────────────────────

export default function DashboardPage() {
    const router = useRouter();
    const { isAuthenticated, agent, _hasHydrated, setAuth } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

    // Wait for store hydration, then redirect if not authed
    useEffect(() => {
        if (!_hasHydrated) return;

        // Feature flag: redirect if dashboard is disabled
        if (process.env.NEXT_PUBLIC_ENABLE_DASHBOARD !== 'true') {
            router.push('/arena');
            return;
        }

        if (!isAuthenticated) {
            router.push('/arena');
            return;
        }

        // Refresh agent data
        getMyAgent()
            .then((me) => {
                setAuth(me.agent, me.onboarding.tasks, me.onboarding.progress);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, [_hasHydrated, isAuthenticated, router, setAuth]);

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[12%] relative">
                <BackgroundLayer />
                <div className="relative z-10">
                    <DashboardSkeleton />
                </div>
            </div>
        );
    }

    if (!isAuthenticated || !agent) {
        return null; // Will redirect via useEffect
    }

    return (
        <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[12%] relative">
            <BackgroundLayer />

            <div className="relative z-10">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                    <div className="flex items-center gap-3">
                        <LayoutDashboard className="w-5 h-5 text-accent-primary" />
                        <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Command Center</h1>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded p-1">
                        {TABS.map(({ key, label, Icon }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded transition-all cursor-pointer ${activeTab === key
                                    ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                                    : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'
                                    }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <div className="space-y-6 animate-arena-reveal">
                        {/* Identity Bar */}
                        <AgentIdentityBar />

                        {/* Data Pipeline (compact) */}
                        <DataPipelineFlow />

                        {/* Config + Activity side by side */}
                        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
                            <AgentConfigPanel />
                            <ActivityFeed />
                        </div>
                    </div>
                )}

                {activeTab === 'pipeline' && (
                    <div className="space-y-6 animate-arena-reveal">
                        <AgentIdentityBar />
                        <DataPipelineFlow />
                    </div>
                )}

                {activeTab === 'config' && (
                    <div className="space-y-6 animate-arena-reveal">
                        <AgentIdentityBar />
                        <div className="max-w-xl">
                            <AgentConfigPanel />
                        </div>
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="space-y-6 animate-arena-reveal">
                        <AgentIdentityBar />
                        <ActivityFeed />
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Background Layer (shared with Arena) ─────────────────────────

function BackgroundLayer() {
    return (
        <>
            <div className="fixed inset-0 z-0">
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: 'url(/bg.png)' }}
                />
                <div className="absolute inset-0 bg-black/82" />
                <div
                    className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.52) 18%, rgba(0,0,0,0.86) 62%, rgba(0,0,0,0.98) 100%)',
                    }}
                />
            </div>
            <div className="fixed inset-0 z-[1] overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[15%] w-[700px] h-[700px] bg-blue-500/[0.05] rounded-full blur-[240px]" />
                <div className="absolute top-[45%] right-[10%] w-[550px] h-[550px] bg-indigo-500/[0.04] rounded-full blur-[220px]" />
                <div className="absolute bottom-[5%] left-[35%] w-[500px] h-[500px] bg-cyan-500/[0.03] rounded-full blur-[200px]" />
            </div>
        </>
    );
}
