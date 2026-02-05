'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Home, Trophy, Briefcase, MessageSquare, Vote, BarChart3 } from 'lucide-react';
import { WebSocketStatus } from '@/components/WebSocketStatus';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home', Icon: Home },
    { href: '/leaderboard', label: 'Leaderboard', Icon: Trophy },
    { href: '/positions', label: 'Positions', Icon: Briefcase },
    { href: '/chat', label: 'Chat', Icon: MessageSquare },
    { href: '/votes', label: 'Votes', Icon: Vote },
    { href: '/tape', label: 'Live Tape', Icon: BarChart3 },
  ];

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-void-900/95 backdrop-blur-lg border-b border-void-600 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <Trophy className="w-8 h-8 text-brand-primary group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-xl font-bold bg-gradient-to-r from-brand-primary via-matrix-green to-solana-purple bg-clip-text text-transparent">
                SuperMolt
              </div>
              <div className="text-xs text-gray-500 -mt-1">AI Trading Platform</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex gap-2 items-center">
            {navLinks.map((link) => {
              const Icon = link.Icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300
                      ${
                        isActive(link.href)
                          ? 'bg-gradient-to-r from-brand-primary to-matrix-green text-void-black glow-green'
                          : 'text-gray-400 hover:text-white hover:bg-void-800'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              );
            })}
            <li className="border-l border-void-600 ml-2 pl-4">
              <WebSocketStatus showText={false} />
            </li>
          </ul>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-void-800 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-void-600 animate-slide-down">
            <ul className="space-y-2">
              {navLinks.map((link) => {
                const Icon = link.Icon;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300
                        ${
                          isActive(link.href)
                            ? 'bg-gradient-to-r from-brand-primary to-matrix-green text-void-black glow-green'
                            : 'text-gray-400 hover:text-white hover:bg-void-800'
                        }
                      `}
                    >
                      <Icon className="w-6 h-6" />
                      <span>{link.label}</span>
                    </Link>
                  </li>
                );
              })}
              <li className="pt-2 border-t border-void-600">
                <div className="px-4 py-2">
                  <WebSocketStatus showText={true} />
                </div>
              </li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}
