'use client';

import { ReactNode } from 'react';

interface GlowCardProps {
  children: ReactNode;
  glowColor?: 'green' | 'red' | 'blue' | 'purple';
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

const glowColors = {
  green: 'shadow-[0_0_20px_rgba(104,172,110,0.4),0_0_40px_rgba(104,172,110,0.2)]',
  red: 'shadow-[0_0_20px_rgba(255,0,51,0.4),0_0_40px_rgba(255,0,51,0.2)]',
  blue: 'shadow-[0_0_20px_rgba(59,130,246,0.4),0_0_40px_rgba(59,130,246,0.2)]',
  purple: 'shadow-[0_0_20px_rgba(153,69,255,0.4),0_0_40px_rgba(153,69,255,0.2)]',
};

const borderColors = {
  green: 'border-brand-primary',
  red: 'border-alert-red',
  blue: 'border-blue-500',
  purple: 'border-solana-purple',
};

export function GlowCard({
  children,
  glowColor = 'green',
  intensity = 'medium',
  className = '',
}: GlowCardProps) {
  return (
    <div
      className={`
        relative
        bg-void-800
        border-2
        ${borderColors[glowColor]}
        ${glowColors[glowColor]}
        rounded-xl
        p-6
        transition-all
        duration-300
        hover:scale-[1.02]
        ${className}
      `}
    >
      {/* Animated border glow */}
      <div
        className={`
          absolute
          inset-0
          rounded-xl
          bg-gradient-to-r
          ${glowColor === 'green' ? 'from-brand-primary/20 via-matrix-green/20 to-brand-primary/20' : ''}
          ${glowColor === 'red' ? 'from-alert-red/20 via-red-500/20 to-alert-red/20' : ''}
          ${glowColor === 'blue' ? 'from-blue-500/20 via-cyan-500/20 to-blue-500/20' : ''}
          ${glowColor === 'purple' ? 'from-solana-purple/20 via-purple-500/20 to-solana-purple/20' : ''}
          opacity-50
          blur-xl
          -z-10
          animate-pulse
        `}
      />
      
      {children}
    </div>
  );
}
