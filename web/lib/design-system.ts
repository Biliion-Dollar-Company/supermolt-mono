// Design System Constants
// Consistent spacing, colors, and styles across the app

export const colors = {
  // Base
  darker: '#050714',
  dark: '#0a0e27',
  navy: '#0f172a',
  slate: '#1a1f3a',
  
  // Accents
  purple: '#8b5cf6',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  
  // Semantic
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
} as const;

export const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
} as const;

export const borderRadius = {
  sm: '0.5rem',     // 8px
  md: '0.75rem',    // 12px
  lg: '1rem',       // 16px
  xl: '1.5rem',     // 24px
  '2xl': '2rem',    // 32px
  full: '9999px',
} as const;

export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    mono: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", "Courier New", monospace',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
    '6xl': '3.75rem', // 60px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  base: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
  md: '0 6px 12px -2px rgba(0, 0, 0, 0.4)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  glow: '0 0 20px rgba(59, 130, 246, 0.4)',
  glowPurple: '0 0 20px rgba(139, 92, 246, 0.4)',
  glowCyan: '0 0 20px rgba(6, 182, 212, 0.4)',
} as const;

export const transitions = {
  fast: '150ms ease-in-out',
  base: '300ms ease-in-out',
  slow: '500ms ease-in-out',
} as const;

// Component variants
export const variants = {
  card: {
    default: 'bg-trench-slate/50 border border-gray-800 rounded-2xl shadow-card',
    elevated: 'bg-trench-slate/70 border border-gray-700 rounded-2xl shadow-lg',
    glass: 'bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl',
    outlined: 'bg-transparent border-2 border-gray-700 rounded-2xl',
  },
  button: {
    primary: 'bg-gradient-to-r from-trench-blue to-trench-cyan text-white hover:shadow-glow',
    secondary: 'bg-trench-slate border border-gray-700 text-gray-100 hover:bg-trench-navy',
    ghost: 'bg-transparent border border-gray-700 text-gray-300 hover:bg-trench-slate',
    danger: 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:shadow-glow',
    success: 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:shadow-glow',
  },
  badge: {
    default: 'bg-gray-800 text-gray-300 border border-gray-700',
    primary: 'bg-trench-blue/20 text-trench-cyan border border-trench-blue/30',
    success: 'bg-green-900/50 text-green-400 border border-green-800',
    danger: 'bg-red-900/50 text-red-400 border border-red-800',
    warning: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
    info: 'bg-blue-900/50 text-blue-400 border border-blue-800',
  },
} as const;

// Utility functions
export const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

export const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatCurrency = (amount: number, decimals: number = 2): string => {
  return `$${formatNumber(amount, decimals)}`;
};

export const formatPercent = (value: number, decimals: number = 2): string => {
  return `${formatNumber(value, decimals)}%`;
};

export const getPnLColor = (value: number): string => {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-gray-400';
};

export const getPnLBgColor = (value: number): string => {
  if (value > 0) return 'bg-green-900/50';
  if (value < 0) return 'bg-red-900/50';
  return 'bg-gray-800/50';
};
