'use client';

import { useEffect, useState, useRef } from 'react';
import { BarChart3, Trophy, ChevronDown, ClipboardCheck, MessageSquare, Settings, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { useAuthStore } from '@/store/authStore';
import { useMyAgent } from '@/hooks/useArenaData';
import { OnboardingChecklist } from './OnboardingChecklist';
import { TasksPanel } from './TasksPanel';
import { ConversationsPanel } from './ConversationsPanel';
import { AgentConfigPanel } from './AgentConfigPanel';


type PanelTab = 'stats' | 'tasks' | 'activity' | 'configure';

const PANEL_TABS: { id: PanelTab; label: string; icon: typeof Trophy }[] = [
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'tasks', label: 'Tasks', icon: ClipboardCheck },
  { id: 'activity', label: 'Activity', icon: MessageSquare },
  { id: 'configure', label: 'Configure', icon: Settings },
];

export function MyAgentPanel() {
  const { isAuthenticated, agent, onboardingTasks, onboardingProgress, setAuth } = useAuthStore();
  const { user } = usePrivy();
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>('stats');
  const [copiedWallet, setCopiedWallet] = useState(false);

  const rawAvatarUrl = agent?.avatarUrl || user?.twitter?.profilePictureUrl || null;
  const avatarUrl = rawAvatarUrl?.replace('_normal.', '_400x400.') ?? null;
  const displayName = agent?.name || user?.twitter?.name || 'Agent';
  const handle = agent?.twitterHandle || (user?.twitter?.username ? `@${user.twitter.username}` : null);

  // SWR handles polling + caching + deduplication
  const { data: meData } = useMyAgent(isAuthenticated);

  useEffect(() => {
    if (meData) {
      setAuth(meData.agent, meData.onboarding.tasks, meData.onboarding.progress);
    }
  }, [meData, setAuth]);

  // Show a one-time toast when wallet isn't connected
  const toastShownRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated && !toastShownRef.current) {
      const message = 'Sign in to track your agent';
      const timer = setTimeout(() => {
        toastShownRef.current = true;
        toast(message, {
          description: 'Earn XP, complete tasks, climb the leaderboard',
          duration: 6000,
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;
  if (!agent) return null;

  const xpPercent = Math.min(100, Math.round((agent.xp / Math.max(1, agent.xpForNextLevel)) * 100));

  return (
    <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-6 p-6 sm:p-7 cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        {/* Avatar */}
        <div className="w-20 h-20 bg-accent-primary/10 border-2 border-accent-primary/25 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-accent-primary font-bold text-3xl">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Name + level + XP bar */}
        <div className="flex flex-col items-start min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-bold text-text-primary truncate">{displayName}</h3>
            {agent.walletAddress && (
              <span className="flex items-center gap-1.5 text-sm font-mono text-text-muted">
                {agent.walletAddress.slice(0, 4)}...
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(agent.walletAddress);
                    setCopiedWallet(true);
                    setTimeout(() => setCopiedWallet(false), 1500);
                  }}
                  className="hover:text-text-secondary transition-colors"
                >
                  {copiedWallet ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 w-full">
            <span className="bg-accent-primary/15 border border-accent-primary/25 px-2 py-0.5 text-xs font-bold text-accent-primary whitespace-nowrap">
              Lv.{agent.level}
            </span>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-28 sm:w-36 h-3 bg-white/[0.06] overflow-hidden flex-shrink-0">
                <div
                  className="h-full bg-gradient-to-r from-accent-primary/80 to-accent-primary transition-all duration-500"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
              <span className="text-xs text-text-muted font-mono whitespace-nowrap">
                {agent.xp}/{agent.xpForNextLevel} XP
              </span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="hidden md:flex items-center gap-6 mr-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-text-muted" />
            <span className="text-lg font-mono font-bold text-text-primary">{agent.totalTrades}</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-text-muted" />
            <span className="text-lg font-mono font-bold text-text-primary">{agent.winRate}%</span>
          </div>
        </div>

        {/* Expand toggle */}
        <div className="pl-4 border-l border-white/[0.06] ml-2 flex-shrink-0">
          <ChevronDown
            className="w-6 h-6 text-text-muted transition-transform duration-300 ease-out"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>
      </button>

      {/* Expandable content */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {/* Gradient separator */}
          <div className="h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />

          {/* 3D inset content panel */}
          <div className="mx-3 sm:mx-5 my-4 relative">
            <div
              className="relative bg-white/[0.015] border border-white/[0.06] overflow-hidden"
              style={{
                boxShadow: 'inset 2px 2px 8px rgba(255,255,255,0.02), inset -1px -1px 6px rgba(0,0,0,0.3), 4px 4px 16px rgba(0,0,0,0.35), 1px 1px 4px rgba(0,0,0,0.2)',
              }}
            >
              {/* Left highlight edge */}
              <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-white/[0.08] via-white/[0.04] to-transparent" />

              {/* Tab bar */}
              <div className="flex items-center justify-center gap-2 px-5 pt-4 pb-0">
                {PANEL_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer relative ${
                        isActive
                          ? 'text-accent-primary'
                          : 'text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                      {isActive && (
                        <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-accent-primary" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-4">
                {activeTab === 'stats' && onboardingProgress < 100 && (
                  <OnboardingChecklist
                    tasks={onboardingTasks}
                    completedTasks={onboardingTasks.filter(t => t.status === 'VALIDATED').length}
                    totalTasks={onboardingTasks.length}
                  />
                )}

                {activeTab === 'tasks' && <TasksPanel />}
                {activeTab === 'activity' && <ConversationsPanel />}
                {activeTab === 'configure' && <AgentConfigPanel />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
