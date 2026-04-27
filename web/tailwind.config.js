/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // 🟣 Kraken Agent Terminal - Institutional Palette
      colors: {
        bg: {
          primary: '#0D0B1A',   // Deepest dark
          secondary: '#131126', // Mid-layer
          elevated: '#1A1833',  // Top-layer
        },
        kraken: {
          purple: '#7132f5',    // Official Kraken Purple
          green: '#149e61',     // Official Kraken Green
          dark: '#101114',      // Near black
        },
        text: {
          primary: '#FFFFFF',
          secondary: 'rgba(255, 255, 255, 0.7)',
          muted: 'rgba(255, 255, 255, 0.45)',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          strong: 'rgba(255, 255, 255, 0.15)',
          purple: 'rgba(113, 50, 245, 0.3)',
        },
      },

      borderRadius: {
        'kraken': '12px',       // Standard institutional radius
        'xl': '12px',
        '2xl': '16px',
        'full': '9999px',
      },

      boxShadow: {
        'kraken-glow': '0 0 20px rgba(113, 50, 245, 0.25)',
      },

      backgroundImage: {
        'glass-dark': 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
      },

      // Typography
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
