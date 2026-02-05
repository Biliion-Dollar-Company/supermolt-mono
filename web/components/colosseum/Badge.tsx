import { HTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide rounded-pill',
  {
    variants: {
      variant: {
        success: 'bg-success/10 border border-success/20 text-success',
        error: 'bg-error/10 border border-error/20 text-error',
        warning: 'bg-warning/10 border border-warning/20 text-warning',
        neutral: 'bg-white/5 border border-border-subtle text-text-muted',
        accent: 'bg-accent-primary/10 border border-accent-primary/20 text-accent-soft',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-1 text-xs',
        lg: 'px-3 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <span
        className={cn(badgeVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
