import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type CutSize = 'xs' | 'sm' | 'md' | 'lg';

const CUT_PX: Record<CutSize, string> = {
  xs: '4px',
  sm: '7px',
  md: '12px',
  lg: '18px',
};

function clipPath(cut: string) {
  return `polygon(${cut} 0%, 100% 0%, 100% calc(100% - ${cut}), calc(100% - ${cut}) 100%, 0% 100%, 0% ${cut})`;
}

interface CutCornerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'onClick'> {
  children?: ReactNode;
  className?: string;
  cut?: CutSize;
  borderWidth?: number;
  borderColor?: string;
  bg?: string;
  style?: CSSProperties;
  onClick?: HTMLAttributes<HTMLDivElement>['onClick'];
}

export function CutCorner({
  children,
  className,
  cut = 'md',
  borderWidth = 1,
  borderColor = 'var(--trench-border)',
  bg = 'rgba(255,255,255,0.03)',
  style,
  onClick,
  ...rest
}: CutCornerProps) {
  const cutVal = CUT_PX[cut];
  const clip = clipPath(cutVal);

  return (
    <div className={cn('relative', className)} style={{ clipPath: clip, ...style }} onClick={onClick} {...rest}>
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: borderColor }} />
      <div className="relative" style={{ margin: borderWidth, clipPath: clip, background: bg }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
