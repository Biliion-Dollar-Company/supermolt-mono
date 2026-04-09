'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { CutCorner } from '@/components/gtek';

export const BRAINROT_PAPER = '#f5efe4';

export function PanelLabel({ children }: { children: string }) {
  return (
    <div className="inline-flex -translate-y-1/2 skew-x-[-14deg] border-[2.5px] border-black bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em]">
      <span className="skew-x-[14deg]">{children}</span>
    </div>
  );
}

export function InkPanel({
  children,
  className,
  cut = 'md',
  bg = '#fffdf8',
  ...props
}: {
  children?: ReactNode;
  className?: string;
  cut?: 'xs' | 'sm' | 'md' | 'lg';
  bg?: string;
} & ComponentPropsWithoutRef<'div'>) {
  return (
    <CutCorner
      cut={cut}
      borderWidth={2.5}
      borderColor="#111111"
      bg={bg}
      className={className}
      style={{ boxShadow: '5px 5px 0 0 rgba(0,0,0,0.92)' }}
      {...props}
    >
      {children}
    </CutCorner>
  );
}

export function Bubble({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`relative rounded-[28px] border-[2.5px] border-black bg-white px-5 py-4 ${compact ? 'text-sm' : 'text-[1.03rem]'} font-semibold leading-tight`}>
      <p>{message}</p>
      <div className="absolute -bottom-[10px] left-9 h-5 w-5 rotate-45 border-b-[2.5px] border-r-[2.5px] border-black bg-white" />
    </div>
  );
}

export function MetricPill({
  children,
  inverse = false,
}: {
  children: ReactNode;
  inverse?: boolean;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border-[2.5px] border-black px-3 py-2 text-sm font-black uppercase tracking-[0.08em] ${inverse ? 'bg-[#111] text-white' : 'bg-white text-black'}`}>
      {children}
    </span>
  );
}

export function StampBadge({
  children,
  inverse = false,
}: {
  children: ReactNode;
  inverse?: boolean;
}) {
  return (
    <span className={`inline-flex -rotate-[3deg] items-center border-[2.5px] border-black px-3 py-1 text-[0.72rem] font-black uppercase tracking-[0.14em] shadow-[3px_3px_0_0_rgba(0,0,0,0.9)] ${inverse ? 'bg-[#111] text-white' : 'bg-[#f3df8a] text-black'}`}>
      {children}
    </span>
  );
}
