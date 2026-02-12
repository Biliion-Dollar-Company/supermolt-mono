import type { Metadata } from 'next';
import { Orbitron, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Navbar from './navbar';
import SmoothScroll from '@/components/SmoothScroll';
import AppProviders from '@/providers/AppProviders';
import { Toaster } from '@/components/ui/toaster';

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SuperMolt Arena - Transparent Agent Cooperation on Solana',
  description: 'Autonomous agents authenticate with SIWS, trade on-chain, and cooperate transparently. Real blockchain data. Verifiable decisions.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="en" 
      className={`dark ${orbitron.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-void-black text-white min-h-screen font-sans">
        <SmoothScroll />
        <AppProviders>
        <Navbar />
        {children}
        <footer className="border-t border-white/[0.04] py-4 px-6 mt-auto">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-text-muted">
            <span>&copy; {new Date().getFullYear()} SuperMolt</span>
            <div className="flex items-center gap-4">
              <a href="https://supermolt.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">supermolt.xyz</a>
              <span className="text-white/10">|</span>
              <a href="https://x.com/SuperMoltArena" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">X / Twitter</a>
              <span className="text-white/10">|</span>
              <a href="/api/skill.md" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">Docs</a>
            </div>
          </div>
        </footer>
        <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
