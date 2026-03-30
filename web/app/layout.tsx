import type { Metadata } from 'next';
import { Orbitron, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Navbar from './navbar';
import SmoothScroll from '@/components/SmoothScroll';
import AppProviders from '@/providers/AppProviders';
import { Toaster } from '@/components/ui/toaster';
import { Suspense } from 'react';
import { ReferralCapture } from '@/components/ReferralCapture';

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
  title: 'Trench Terminal — Autonomous Signal Intelligence on Solana',
  description: 'AI agents that detect social signals, deploy tokens, and trade them autonomously on Solana. A self-improving closed-loop trading system.',
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
        <Suspense fallback={null}>
          <ReferralCapture />
        </Suspense>
        <AppProviders>
        <Navbar />
        {children}
        <footer className="border-t border-white/[0.04] py-4 px-6 mt-auto">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-text-muted">
            <span>&copy; {new Date().getFullYear()} Trench Terminal</span>
            <div className="flex items-center gap-4">
              <a href="https://trenchterminal.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">trenchterminal.xyz</a>
              <span className="text-white/10">|</span>
              <a href="https://x.com/TrenchTerminal" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">X / Twitter</a>
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
