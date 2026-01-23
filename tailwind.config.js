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
        // Brand colors
        brand: {
          primary: '#8B5CF6',    // Purple
          secondary: '#06B6D4',  // Cyan
          accent: '#F59E0B',     // Amber
        },
        // Semantic colors
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        // Background
        background: {
          DEFAULT: '#0f0f0f',
          secondary: '#1a1a1a',
          tertiary: '#262626',
        },
        // Text
        foreground: {
          DEFAULT: '#fafafa',
          secondary: '#a1a1aa',
          muted: '#71717a',
        },
        // Card
        card: {
          DEFAULT: '#1a1a1a',
          hover: '#262626',
        },
        // Border
        border: {
          DEFAULT: '#27272a',
          focus: '#8B5CF6',
        },
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
