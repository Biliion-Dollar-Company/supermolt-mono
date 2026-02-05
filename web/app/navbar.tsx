'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Home, Trophy, Briefcase, MessageSquare, Vote, BarChart3, Menu, X } from 'lucide-react';
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
    <nav className="bg-bg-primary/95 backdrop-blur-lg border-b border-border sticky top-0 z-50">
      <div className="container-colosseum">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-2 rounded-xl bg-accent-gradient transition-transform group-hover:scale-105">
              <Trophy className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="text-xl font-bold text-gradient-gold">
                SuperMolt
              </div>
              <div className="text-xs text-text-muted -mt-0.5">AI Trading Platform</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex gap-1 items-center">
            {navLinks.map((link) => {
              const Icon = link.Icon;
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-pill font-medium transition-all duration-250
                      ${
                        active
                          ? 'bg-accent-gradient text-black'
                          : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{link.label}</span>
                  </Link>
                </li>
              );
            })}
            <li className="border-l border-border ml-2 pl-4">
              <WebSocketStatus showText={false} />
            </li>
          </ul>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-slide-up">
            <ul className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.Icon;
                const active = isActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-250
                        ${
                          active
                            ? 'bg-accent-gradient text-black'
                            : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{link.label}</span>
                    </Link>
                  </li>
                );
              })}
              <li className="pt-2 border-t border-border mt-2">
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
