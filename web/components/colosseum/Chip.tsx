import { HTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const chipVariants = cva(
  'inline-flex items-center gap-2 rounded-pill text-caption transition-colors duration-200',
  {
    variants: {
      variant: {
        default: 'bg-white/5 border border-border-subtle text-text-secondary',
        accent: 'bg-accent-primary/10 border border-accent-primary/20 text-accent-soft',
        success: 'bg-success/10 border border-success/20 text-success',
        error: 'bg-error/10 border border-error/20 text-error',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-1.5 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ChipProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

const Chip = forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <span
        className={cn(chipVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Chip.displayName = 'Chip';

export { Chip, chipVariants };
