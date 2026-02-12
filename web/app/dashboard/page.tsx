'use client';

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { LayoutDashboard, Settings } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getMyAgent } from '@/lib/api';
import { AgentConfigPanel, AgentDataFlow, ActivityFeed } from '@/components/dashboard';

const IS_DEV = process.env.NODE_ENV !== 'production';

// ── Skeleton ─────────────────────────────────────────────────────

function SkeletonBlock({ className = '' }: { className?: string }) {
    return <div className={`bg-white/[0.03] animate-pulse rounded ${className}`} />;
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <SkeletonBlock className="h-[420px]" />
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
                <SkeletonBlock className="h-[400px]" />
                <SkeletonBlock className="h-[400px]" />
            </div>
        </div>
    );
}

// ── Tab System ───────────────────────────────────────────────────

type DashboardTab = 'overview' | 'config';

const TABS: { key: DashboardTab; label: string; Icon: any }[] = [
    { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { key: 'config', label: 'Configure', Icon: Settings },
];

// ── Main Page ────────────────────────────────────────────────────

export default function DashboardPage() {
    if (!IS_DEV) notFound();

    const { isAuthenticated, _hasHydrated, setAuth } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

    // Wait for store hydration, then refresh agent data if authed
    useEffect(() => {
        if (!_hasHydrated) return;

        if (isAuthenticated) {
            getMyAgent()
                .then((me) => {
                    setAuth(me.agent, me.onboarding.tasks, me.onboarding.progress);
                    setLoading(false);
                })
                .catch(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [_hasHydrated, isAuthenticated, setAuth]);

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
                        <AgentDataFlow />
                        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
                            <AgentConfigPanel />
                            <ActivityFeed />
                        </div>
                    </div>
                )}

                {activeTab === 'config' && (
                    <div className="space-y-6 animate-arena-reveal">
                        <AgentDataFlow />
                        <div className="max-w-xl">
                            <AgentConfigPanel />
                        </div>
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
                <div className="absolute top-[10%] left-[15%] w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.05)_0%,transparent_70%)]" />
                <div className="absolute top-[45%] right-[10%] w-[550px] h-[550px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.04)_0%,transparent_70%)]" />
                <div className="absolute bottom-[5%] left-[35%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.03)_0%,transparent_70%)]" />
            </div>
        </>
    );
}
