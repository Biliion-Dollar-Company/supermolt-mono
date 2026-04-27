'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Zap, Trophy, ShieldCheck, Menu, X } from 'lucide-react';
import { useState } from 'react';
import UserAuthButton from '@/components/auth/UserAuthButton';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'TERMINAL', Icon: Zap },
    { href: '/leaderboard', label: 'LEADERBOARD', Icon: Trophy },
    { href: '/compliance', label: 'AUDIT', Icon: ShieldCheck },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-bg-primary border-b border-border/50 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-kraken bg-kraken-purple flex items-center justify-center shadow-kraken-glow group-hover:scale-110 transition-transform">
            <Zap size={14} fill="white" className="text-white" />
          </div>
          <span className="font-black text-lg tracking-tighter text-white">TRENCH <span className="text-kraken-purple">TERMINAL</span></span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[11px] font-black tracking-widest transition-colors ${
                  active ? 'text-kraken-purple' : 'text-text-muted hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="h-4 w-px bg-border mx-2" />
          <UserAuthButton />
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-white" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={20}/> : <Menu size={20}/>}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-bg-secondary border-b border-border p-6 flex flex-col gap-4 animate-in slide-in-from-top duration-200">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-xs font-black tracking-widest text-text-muted"
            >
              {link.label}
            </Link>
          ))}
          <UserAuthButton />
        </div>
      )}
    </nav>
  );
}
