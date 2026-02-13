/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#68ac6e',
          secondary: '#9945ff',
          accent: '#00ff41',
        },
        void: {
          black: '#000000',
          900: '#0a0a0a',
          800: '#121212',
          700: '#1a1a1a',
          600: '#27272a',
        },
        surface: {
          primary: '#0f0f0f',
          secondary: '#1a1a1a',
          tertiary: '#27272a',
        },
        text: {
          primary: '#fafafa',
          secondary: '#a1a1aa',
          muted: '#71717a',
        },
        status: {
          success: '#22c55e',
          error: '#ef4444',
          warning: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
};
