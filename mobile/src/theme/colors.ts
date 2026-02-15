/**
 * SuperMolt Design System Colors
 *
 * These colors match tailwind.config.js for programmatic access.
 * Use these in JS/TS code; use Tailwind classes in JSX.
 */

export const colors = {
  // Brand colors
  brand: {
    primary: '#F97316',     // SuperMolt orange
    secondary: '#9945ff',   // Solana purple
    accent: '#FB923C',      // Light orange
  },

  // Void blacks
  void: {
    black: '#000000',
    900: '#0a0a0a',
    800: '#121212',
    700: '#1a1a1a',
    600: '#27272a',
  },

  // Surface colors
  surface: {
    primary: '#0f0f0f',
    secondary: '#1a1a1a',
    tertiary: '#27272a',
  },

  // Text colors
  text: {
    primary: '#fafafa',
    secondary: '#a1a1aa',
    muted: '#71717a',
  },

  // Status colors
  status: {
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
  },

  // Glass effects (with alpha)
  glass: {
    white: 'rgba(255, 255, 255, 0.05)',
    brand: 'rgba(249, 115, 22, 0.1)',
  },
} as const;

// Type-safe color getter
export type ColorKey = keyof typeof colors;
export type BrandColor = keyof typeof colors.brand;
export type VoidColor = keyof typeof colors.void;
export type SurfaceColor = keyof typeof colors.surface;
export type TextColor = keyof typeof colors.text;
export type StatusColor = keyof typeof colors.status;
export type GlassColor = keyof typeof colors.glass;

// Convenience exports
export const { brand, void: voidColors, surface, text, status, glass } = colors;
