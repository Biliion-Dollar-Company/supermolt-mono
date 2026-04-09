'use client';

import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type CutButtonVariant = 'primary' | 'secondary' | 'ghost';
type CutButtonSize = 'sm' | 'md' | 'lg';

const SIZE: Record<CutButtonSize, { cut: string; px: string; py: string; text: string }> = {
  sm: { cut: '6px', px: '12px', py: '6px', text: 'text-xs' },
  md: { cut: '10px', px: '20px', py: '10px', text: 'text-sm' },
  lg: { cut: '14px', px: '28px', py: '14px', text: 'text-base' },
};

const VARIANT: Record<CutButtonVariant, { border: string; bg: string; text: string }> = {
  primary: { border: 'var(--trench-accent)', bg: 'var(--trench-accent)', text: 'text-black font-bold' },
  secondary: { border: 'var(--trench-border)', bg: 'var(--trench-surface-elevated)', text: 'text-[var(--trench-text)]' },
  ghost: { border: 'transparent', bg: 'transparent', text: 'text-[var(--trench-text-muted)]' },
};

function clipPath(cut: string) {
  return `polygon(${cut} 0%, 100% 0%, 100% calc(100% - ${cut}), calc(100% - ${cut}) 100%, 0% 100%, 0% ${cut})`;
}

interface BaseCutButtonProps {
  children: ReactNode;
  variant?: CutButtonVariant;
  size?: CutButtonSize;
  className?: string;
  disabled?: boolean;
}

type CutButtonProps =
  | (BaseCutButtonProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className' | 'href'>)
  | (BaseCutButtonProps & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'disabled'>);

export function CutButton({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  href,
  ...rest
}: CutButtonProps) {
  const s = SIZE[size];
  const v = VARIANT[variant];
  const clip = clipPath(s.cut);

  const outer = cn(
    'relative inline-block cursor-pointer transition-all active:scale-[0.97]',
    disabled && 'pointer-events-none opacity-50',
    className,
  );

  const inner = (
    <>
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: v.border }} />
      <div style={{ margin: 1, clipPath: clip, background: v.bg, padding: `${s.py} ${s.px}` }}>
        <span
          className={cn(
            'flex items-center gap-2 font-mono font-semibold leading-none whitespace-nowrap',
            s.text,
            v.text,
          )}
        >
          {children}
        </span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={outer}
        style={{ clipPath: clip }}
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      disabled={disabled}
      className={outer}
      style={{ clipPath: clip }}
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {inner}
    </button>
  );
}
