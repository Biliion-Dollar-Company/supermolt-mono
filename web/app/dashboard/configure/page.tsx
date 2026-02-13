'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useAuthHydrated } from '@/store/authStore';
import { AgentAvatar } from '../components/AgentAvatar';
import { ArchetypeCard } from '../components/ArchetypeCard';
import { TrackedWalletsConfig } from '../components/TrackedWalletsConfig';
import { BuyTriggersConfig } from '../components/BuyTriggersConfig';
import { useToast } from '@/hooks/use-toast';
import {
  getAgentConfig,
  updateAgentConfig,
  type TrackedWallet,
  type BuyTrigger,
} from '@/lib/api/agent-config';

// Mock archetypes (replace with API call)
const ARCHETYPES = [
  {
    id: 'alpha',
    emoji: '🎯',
    name: 'Alpha Hunter',
    description: 'High-risk, high-reward trader focused on early meme tokens',
    stats: [
      { label: 'Aggression', value: 85 },
      { label: 'Risk Tolerance', value: 90 },
      { label: 'Speed', value: 80 },
    ],
  },
  {
    id: 'beta',
    emoji: '📊',
    name: 'Data Analyst',
    description: 'Methodical trader relying on metrics and fundamentals',
    stats: [
      { label: 'Analysis Depth', value: 90 },
      { label: 'Risk Tolerance', value: 50 },
      { label: 'Speed', value: 60 },
    ],
  },
  {
    id: 'gamma',
    emoji: '🤝',
    name: 'Copy Trader',
    description: 'Follows god wallets and successful traders',
    stats: [
      { label: 'Signal Sensitivity', value: 75 },
      { label: 'Risk Tolerance', value: 60 },
      { label: 'Speed', value: 85 },
    ],
  },
  {
    id: 'delta',
    emoji: '🛡️',
    name: 'Conservative',
    description: 'Safety-first approach with strict risk management',
    stats: [
      { label: 'Safety Priority', value: 95 },
      { label: 'Risk Tolerance', value: 30 },
      { label: 'Speed', value: 50 },
    ],
  },
];

export default function ConfigurePage() {
  const router = useRouter();
  const { agent } = useAuthStore();
  const hydrated = useAuthHydrated();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [selectedArchetype, setSelectedArchetype] = useState('alpha');
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>([]);
  const [triggers, setTriggers] = useState([
    {
      id: 'consensus',
      type: 'consensus' as const,
      enabled: true,
      config: { walletCount: 2, timeWindow: 15 },
    },
    {
      id: 'volume',
      type: 'volume' as const,
      enabled: false,
      config: { threshold: 100000, timeWindow: 15 },
    },
    {
      id: 'liquidity',
      type: 'liquidity' as const,
      enabled: true,
      config: { minLiquidity: 50000 },
    },
  ]);
  const [saving, setSaving] = useState(false);

  // Load existing configuration
  useEffect(() => {
    const loadConfig = async () => {
      if (!hydrated || !agent) return;

      try {
        setLoading(true);
        const token = localStorage.getItem('jwt');
        if (!token) return;

        const config = await getAgentConfig(token);

        if (config.archetypeId) setSelectedArchetype(config.archetypeId);
        if (config.trackedWallets) setTrackedWallets(config.trackedWallets);
        if (config.buyTriggers) setTriggers(config.buyTriggers as any);
      } catch (error) {
        console.error('Failed to load configuration:', error);
        toast({
          title: 'Failed to Load',
          description: 'Could not load agent configuration',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [hydrated, agent]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const token = localStorage.getItem('jwt');
      if (!token) {
        throw new Error('Not authenticated');
      }

      await updateAgentConfig(token, {
        archetypeId: selectedArchetype,
        trackedWallets: trackedWallets.map(w => ({
          address: w.address,
          label: w.label,
          chain: w.chain,
        })),
        triggers: triggers as any,
      });

      toast({
        title: 'Configuration Saved',
        description: 'Your agent configuration has been updated successfully.',
      });

      router.push('/dashboard');
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save configuration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Wait for Zustand to hydrate from localStorage
  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  // After hydration, if no agent → redirect to dashboard
  if (!agent) {
    router.replace('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      {/* Header */}
      <div className="bg-white/[0.02] border-b border-white/[0.08] sticky top-0 z-10 backdrop-blur-lg">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="text-white/70 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-white text-xl font-bold">Agent Configuration</h1>
                <p className="text-white/50 text-sm">Customize your trading agent</p>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#E8B45E] hover:bg-[#D4A04A] text-black"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Agent Profile */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-6">
          <AgentAvatar
            name={agent.name}
            avatarUrl={agent.avatarUrl}
            isActive={agent.status === 'ACTIVE'}
            size="lg"
          />
        </div>

        {/* Archetype Selection */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-6">
          <div className="mb-6">
            <h3 className="text-white font-semibold text-lg mb-1">Select Archetype</h3>
            <p className="text-white/50 text-sm">
              Choose your agent's trading personality and strategy
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ARCHETYPES.map((archetype) => (
              <ArchetypeCard
                key={archetype.id}
                id={archetype.id}
                emoji={archetype.emoji}
                name={archetype.name}
                description={archetype.description}
                stats={archetype.stats}
                selected={selectedArchetype === archetype.id}
                onSelect={() => setSelectedArchetype(archetype.id)}
              />
            ))}
          </div>
        </div>

        {/* Tracked Wallets */}
        <TrackedWalletsConfig
          wallets={trackedWallets}
          onAdd={(wallet) => setTrackedWallets([...trackedWallets, wallet])}
          onRemove={(address) =>
            setTrackedWallets(trackedWallets.filter((w) => w.address !== address))
          }
        />

        {/* Buy Triggers */}
        <BuyTriggersConfig triggers={triggers} onUpdate={setTriggers} />

        {/* Save button (bottom) */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="bg-[#E8B45E] hover:bg-[#D4A04A] text-black px-8"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving Configuration...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
