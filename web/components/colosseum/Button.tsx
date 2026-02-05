import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-250 ease-smooth disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-accent-gradient text-black hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]',
        secondary:
          'bg-transparent border border-border text-text-primary hover:bg-white/5 hover:border-border-strong active:scale-[0.98]',
        ghost:
          'bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5',
        danger:
          'bg-error text-white hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]',
      },
      size: {
        sm: 'px-4 py-2 text-sm rounded-pill',
        md: 'px-6 py-3 text-base rounded-pill',
        lg: 'px-8 py-4 text-lg rounded-pill',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
