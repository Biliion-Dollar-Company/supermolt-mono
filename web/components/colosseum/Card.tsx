import { HTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'rounded-card border transition-all duration-250 ease-smooth',
  {
    variants: {
      variant: {
        base: 'bg-card border-border p-6',
        hover:
          'bg-card border-border p-6 hover:-translate-y-1 hover:border-accent-primary/35 hover:shadow-glow-gold cursor-pointer',
        elevated: 'bg-card-elevated border-border-strong p-6 shadow-glow',
        flat: 'bg-bg-secondary border-border-subtle p-4',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'base',
    },
  }
);

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => {
    return (
      <div
        className={cn(cardVariants({ variant, padding, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

export { Card, cardVariants };
