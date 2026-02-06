import type { Metadata } from 'next';
import { Orbitron, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Navbar from './navbar';

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
        <Navbar />
        {children}
      </body>
    </html>
  );
}
