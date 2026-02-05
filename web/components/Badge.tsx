import React from 'react';
import { cn } from '@/lib/design-system';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'primary';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  dot?: boolean;
  outline?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  dot = false,
  outline = false,
}) => {
  const variantStyles = outline ? {
    default: 'bg-transparent border border-gray-700 text-gray-300',
    success: 'bg-transparent border border-green-500 text-green-400',
    danger: 'bg-transparent border border-red-500 text-red-400',
    warning: 'bg-transparent border border-yellow-500 text-yellow-400',
    info: 'bg-transparent border border-blue-500 text-blue-400',
    primary: 'bg-transparent border border-trench-cyan text-trench-cyan',
  } : {
    default: 'bg-gray-800 text-gray-300 border border-gray-700',
    success: 'bg-green-900/50 text-green-400 border border-green-800',
    danger: 'bg-red-900/50 text-red-400 border border-red-800',
    warning: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
    info: 'bg-blue-900/50 text-blue-400 border border-blue-800',
    primary: 'bg-trench-blue/20 text-trench-cyan border border-trench-blue/30',
  };

  const sizeStyles = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const dotColors = {
    default: 'bg-gray-400',
    success: 'bg-green-400',
    danger: 'bg-red-400',
    warning: 'bg-yellow-400',
    info: 'bg-blue-400',
    primary: 'bg-trench-cyan',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold transition-all',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            dotColors[variant]
          )}
        />
      )}
      <span>{children}</span>
    </span>
  );
};

export default Badge;
