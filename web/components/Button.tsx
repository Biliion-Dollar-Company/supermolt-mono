import React from 'react';
import { cn } from '@/lib/design-system';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  className = '',
  ...props
}) => {
  const variantStyles = {
    primary: 'bg-gradient-to-r from-trench-blue to-trench-cyan text-white hover:shadow-glow active:scale-95',
    secondary: 'bg-trench-slate border border-gray-700 text-gray-100 hover:bg-trench-navy hover:border-gray-600',
    ghost: 'bg-transparent border border-gray-700 text-gray-300 hover:bg-trench-slate hover:text-white',
    danger: 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:shadow-glow active:scale-95',
    success: 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:shadow-glow active:scale-95',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
    xl: 'px-10 py-5 text-xl',
  };

  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'rounded-xl font-semibold transition-all duration-300',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-trench-blue focus:ring-offset-2 focus:ring-offset-trench-dark',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          <span>Loading...</span>
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          {icon && iconPosition === 'left' && <span>{icon}</span>}
          <span>{children}</span>
          {icon && iconPosition === 'right' && <span>{icon}</span>}
        </span>
      )}
    </button>
  );
};

export default Button;
