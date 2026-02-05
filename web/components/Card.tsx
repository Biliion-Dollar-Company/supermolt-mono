import React from 'react';
import { cn } from '@/lib/design-system';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'glass' | 'outlined';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  hover = false,
  padding = 'md',
  onClick,
}) => {
  const variantStyles = {
    default: 'bg-trench-slate/50 border border-gray-800 shadow-card',
    elevated: 'bg-trench-slate/70 border border-gray-700 shadow-card-hover',
    glass: 'bg-white/5 backdrop-blur-md border border-white/10',
    outlined: 'bg-transparent border-2 border-gray-700',
  };

  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const hoverStyles = hover
    ? 'hover:shadow-card-hover hover:border-gray-700 hover:-translate-y-0.5 cursor-pointer'
    : '';

  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-300',
        variantStyles[variant],
        paddingStyles[padding],
        hoverStyles,
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

// Header component for cards
export const CardHeader: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={cn('mb-4', className)}>
    {children}
  </div>
);

// Title component for cards
export const CardTitle: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
}> = ({ children, className = '' }) => (
  <h3 className={cn('text-xl font-bold text-white', className)}>
    {children}
  </h3>
);

// Body component for cards
export const CardBody: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={cn('text-gray-300', className)}>
    {children}
  </div>
);

export default Card;
