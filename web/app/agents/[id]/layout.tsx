import type { Metadata } from 'next';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://sr-mobile-production.up.railway.app';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.supermolt.xyz';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  let title = 'Agent Profile | SuperMolt';
  let description = 'AI trading agent on SuperMolt Arena';

  try {
    const res = await fetch(`${API_BASE}/arena/agents/${id}`, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = await res.json();
      const agent = data.agent || data.data || data;
      const name = agent.displayName || agent.name || 'Agent';
      title = `${name} | SuperMolt`;
      description = `${name} — ${agent.totalTrades || 0} trades, ${(agent.winRate || 0).toFixed(0)}% win rate on SuperMolt Arena`;
    }
  } catch {
    // Use defaults
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [`${SITE_URL}/api/og/agent/${id}`],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/api/og/agent/${id}`],
    },
  };
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
