'use client';

import { ReactNode } from 'react';
import './GlassIcons.css';

const gradientMapping: Record<string, string> = {
  blue: 'linear-gradient(hsl(223, 90%, 50%), hsl(208, 90%, 50%))',
  purple: 'linear-gradient(hsl(283, 90%, 50%), hsl(268, 90%, 50%))',
  red: 'linear-gradient(hsl(3, 90%, 50%), hsl(348, 90%, 50%))',
  indigo: 'linear-gradient(hsl(253, 90%, 50%), hsl(238, 90%, 50%))',
  orange: 'linear-gradient(hsl(43, 90%, 50%), hsl(28, 90%, 50%))',
  green: 'linear-gradient(hsl(123, 90%, 40%), hsl(108, 90%, 40%))',
  gold: 'linear-gradient(hsl(38, 80%, 55%), hsl(30, 80%, 45%))',
};

interface GlassIconProps {
  icon: ReactNode;
  color: string;
  className?: string;
}

export default function GlassIcon({ icon, color, className = '' }: GlassIconProps) {
  const bgStyle = gradientMapping[color]
    ? { background: gradientMapping[color] }
    : { background: color };

  return (
    <div className={`glass-icon ${className}`}>
      <span className="glass-icon__back" style={bgStyle} />
      <span className="glass-icon__front">
        {icon}
      </span>
    </div>
  );
}
