'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Bot, BarChart3, BookOpen, Menu, X, Shield, Coins, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GradientText from '@/components/reactbits/GradientText';
import UserAuthButton from '@/components/auth/UserAuthButton';
import { DexscreenerIcon } from '@/components/icons/action-icons';

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/arena',             label: 'Arena',       Icon: Bot },
    { href: '/war-room',          label: 'War Room',    Icon: BarChart3 },
    { href: '/leaderboard',       label: 'Leaderboard', Icon: Coins },
    { href: '/positions',         label: 'Positions',   Icon: Shield },
  ];

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    if (pathname === href) return true;
    // Don't activate a parent route when a more-specific sibling nav entry owns this path
    const ownedByChild = navLinks.some(
      l => l.href !== href && l.href.startsWith(href + '/') && pathname.startsWith(l.href),
    );
    if (ownedByChild) return false;
    return pathname.startsWith(href + '/');
  };

  return (
    <nav className="bg-bg-primary/95 backdrop-blur-lg sticky top-0 z-50 relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:h-px after:w-full after:bg-[linear-gradient(90deg,transparent_0%,rgba(37,99,235,0.01)_10%,rgba(37,99,235,0.4)_50%,rgba(37,99,235,0.01)_90%,transparent_100%)]">
      <div className="container-colosseum">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/pfp.png"
              alt="Trench Terminal"
              width={56}
              height={52}
              className="rounded object-cover transition-transform group-hover:scale-105 w-[56px] h-auto"
            />
            <div>
              <GradientText
                colors={['#2563EB', '#1D4ED8', '#60A5FA', '#2563EB']}
                animationSpeed={5}
                className="text-xl font-bold font-display"
              >
                Trench Terminal
              </GradientText>
              <div className="text-xs text-text-muted -mt-0.5">Autonomous Signal Intelligence</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex gap-0 items-center h-full overflow-x-auto scrollbar-none">
            {navLinks.map((link) => {
              const Icon = link.Icon;
              const active = isActive(link.href);
              return (
                <li key={link.href} className="relative h-full flex items-center">
                  <Link
                    href={link.href}
                    className={`
                      relative flex items-center gap-1.5 px-3 py-2.5 rounded-none font-medium transition-all duration-200 text-sm whitespace-nowrap
                      ${active
                        ? 'text-accent-primary'
                        : 'text-text-secondary hover:text-text-primary'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
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
                className="relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all duration-200 text-text-secondary hover:text-text-primary whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4" />
                <span>Docs</span>
              </a>
            </li>
            <li className="relative h-full flex items-center">
              <a
                href="https://dexscreener.com/solana"
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all duration-200 text-text-secondary hover:text-text-primary whitespace-nowrap"
                title="DexScreener"
              >
                <DexscreenerIcon className="w-4 h-4" />
                <span>Chart</span>
              </a>
            </li>
            <li className="relative h-full flex items-center">
              <a
                href="https://x.com/SupermoltSol"
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all duration-200 text-text-secondary hover:text-text-primary whitespace-nowrap"
                title="X / Twitter"
              >
                <XIcon className="w-4 h-4" />
              </a>
            </li>
            <li className="relative h-full flex items-center ml-2">
              <UserAuthButton />
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
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="md:hidden overflow-hidden border-t border-border relative z-50"
            >
              <ul className="space-y-1 py-4">
                {navLinks.map((link, i) => {
                  const Icon = link.Icon;
                  const active = isActive(link.href);
                  return (
                    <motion.li
                      key={link.href}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2, delay: i * 0.05 }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`
                          flex items-center gap-3 px-4 py-3 rounded-none font-medium transition-all duration-200
                          ${active
                            ? 'text-accent-primary border-l-2 border-accent-primary bg-accent-primary/5'
                            : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{link.label}</span>
                      </Link>
                    </motion.li>
                  );
                })}
                <motion.li
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2, delay: navLinks.length * 0.05 }}
                >
                  <a
                    href="https://dexscreener.com/solana"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-none font-medium transition-all duration-200 text-text-secondary hover:text-text-primary hover:bg-white/5"
                  >
                    <DexscreenerIcon className="w-5 h-5" />
                    <span>Chart</span>
                  </a>
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2, delay: (navLinks.length + 1) * 0.05 }}
                >
                  <a
                    href="https://x.com/SupermoltSol"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-none font-medium transition-all duration-200 text-text-secondary hover:text-text-primary hover:bg-white/5"
                  >
                    <XIcon className="w-5 h-5" />
                    <span>Twitter</span>
                  </a>
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2, delay: (navLinks.length + 2) * 0.05 }}
                >
                  <a
                    href="/api/skill.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-none font-medium transition-all duration-200 text-text-secondary hover:text-text-primary hover:bg-white/5"
                  >
                    <BookOpen className="w-5 h-5" />
                    <span>Docs</span>
                  </a>
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2, delay: (navLinks.length + 3) * 0.05 }}
                  className="px-4 pt-2"
                >
                  <UserAuthButton />
                </motion.li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Backdrop overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-16 bg-black/60 backdrop-blur-sm md:hidden"
            style={{ zIndex: 40 }}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </nav>
  );
}
