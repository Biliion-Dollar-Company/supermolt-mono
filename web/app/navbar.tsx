'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Home, Swords, BookOpen, Menu, X, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import GradientText from '@/components/reactbits/GradientText';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Home', Icon: Home },
    { href: '/arena', label: 'Arena', Icon: Swords },
    { href: '/treasury-flow', label: 'Treasury', Icon: Wallet },
  ];

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-bg-primary/95 backdrop-blur-lg sticky top-0 z-50 relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:h-px after:w-full after:bg-[linear-gradient(90deg,transparent_0%,rgba(232,180,94,0.01)_10%,rgba(232,180,94,0.4)_50%,rgba(232,180,94,0.01)_90%,transparent_100%)]">
      <div className="container-colosseum">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/pfp.png"
              alt="SuperMolt"
              width={56}
              height={52}
              className="rounded object-cover transition-transform group-hover:scale-105 w-[56px] h-auto"
            />
            <div>
              <GradientText
                colors={['#E8B45E', '#D4A04A', '#F0C97A', '#E8B45E']}
                animationSpeed={5}
                className="text-xl font-bold font-display"
              >
                SuperMolt
              </GradientText>
              <div className="text-xs text-text-muted -mt-0.5">Agent Cooperation Arena</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex gap-1 items-center h-full">
            {navLinks.map((link) => {
              const Icon = link.Icon;
              const active = isActive(link.href);
              return (
                <li key={link.href} className="relative h-full flex items-center">
                  <Link
                    href={link.href}
                    className={`
                      relative flex items-center gap-2 px-4 py-2 font-medium transition-all duration-200
                      ${
                        active
                          ? 'text-accent-primary'
                          : 'text-text-secondary hover:text-text-primary'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{link.label}</span>
                  </Link>
                  {active && (
                    <motion.div
                      layoutId="nav-active-indicator"
                      className="absolute bottom-0 left-2 right-2 h-[2px] bg-accent-primary"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </li>
              );
            })}
            <li className="relative h-full flex items-center">
              <a
                href="/api/skill.md"
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex items-center gap-2 px-4 py-2 font-medium transition-all duration-200 text-text-secondary hover:text-text-primary"
              >
                <BookOpen className="w-4 h-4" />
                <span className="text-sm">Docs</span>
              </a>
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
                        flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200
                        ${
                          active
                            ? 'text-accent-primary border-l-2 border-accent-primary bg-accent-primary/5'
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
              <li>
                <a
                  href="/api/skill.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 text-text-secondary hover:text-text-primary hover:bg-white/5"
                >
                  <BookOpen className="w-5 h-5" />
                  <span>Docs</span>
                </a>
              </li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}
