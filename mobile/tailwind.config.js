/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand colors - SuperRouter design system
        brand: {
          primary: '#68ac6e',     // SuperRouter green
          secondary: '#9945ff',   // Solana purple
          accent: '#00ff41',      // Matrix green (neon)
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
        // Glass effects
        glass: {
          white: 'rgba(255, 255, 255, 0.05)',
          green: 'rgba(104, 172, 110, 0.1)',
        },
        // Backwards compatibility
        background: {
          DEFAULT: '#0f0f0f',
          secondary: '#1a1a1a',
          tertiary: '#27272a',
        },
        foreground: {
          DEFAULT: '#fafafa',
          secondary: '#a1a1aa',
          muted: '#71717a',
        },
        card: {
          DEFAULT: '#1a1a1a',
          hover: '#27272a',
        },
        border: {
          DEFAULT: '#27272a',
          focus: '#68ac6e',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
    },
  },
  plugins: [],
};
