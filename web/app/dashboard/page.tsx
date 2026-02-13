'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getMyAgent } from '@/lib/api';
import { AgentConfigPanel, AgentDataFlow, TrackedWalletsPanel } from '@/components/dashboard';
import { useIsMobile } from '@/hooks/useIsMobile';

const RisingLines = dynamic(() => import('@/components/react-bits/rising-lines'), { ssr: false });

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

// ── Main Page ────────────────────────────────────────────────────

export default function DashboardPage() {
    if (!IS_DEV) notFound();

    const { isAuthenticated, _hasHydrated, setAuth } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const isMobile = useIsMobile();

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
                <BackgroundLayer isMobile={isMobile} />
                <div className="relative z-10">
                    <DashboardSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg-primary pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[12%] relative">
            <BackgroundLayer isMobile={isMobile} />

            <div className="relative z-10">
                {/* Page Header */}
                <div className="flex items-center gap-4 mb-6">
                    <LayoutDashboard className="w-10 h-10 text-accent-primary flex-shrink-0" />
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Command Center</h1>
                        <p className="text-xs sm:text-sm text-text-muted mt-0.5">Configure your agent, manage tracked wallets, and monitor live data feeds.</p>
                    </div>
                </div>

                <div className="space-y-6 animate-arena-reveal">
                    <AgentDataFlow />
                    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
                        <AgentConfigPanel />
                        <TrackedWalletsPanel />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Background Layer ─────────────────────────────────────────────

function BackgroundLayer({ isMobile }: { isMobile: boolean }) {
    return (
        <>
            <div className="fixed inset-0 z-0">
                <div
                    className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.60) 15%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.95) 100%)',
                    }}
                />
                {!isMobile && (
                    <div className="absolute inset-0 opacity-40">
                        <RisingLines
                            color="#E8B45E"
                            horizonColor="#E8B45E"
                            haloColor="#F5D78E"
                            riseSpeed={0.05}
                            riseScale={8.0}
                            riseIntensity={1.0}
                            flowSpeed={0.1}
                            flowDensity={3.5}
                            flowIntensity={0.5}
                            horizonIntensity={0.7}
                            haloIntensity={5.0}
                            horizonHeight={-0.85}
                            circleScale={-0.5}
                            scale={6.5}
                            brightness={0.9}
                        />
                    </div>
                )}
            </div>
            <div className="fixed inset-0 z-[1] overflow-hidden pointer-events-none">
                <div className="absolute top-[10%] left-[15%] w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.05)_0%,transparent_70%)]" />
                <div className="absolute top-[45%] right-[10%] w-[550px] h-[550px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.04)_0%,transparent_70%)]" />
                <div className="absolute bottom-[5%] left-[35%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.03)_0%,transparent_70%)]" />
            </div>
        </>
    );
}
