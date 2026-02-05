/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		colors: {
  			'brand-primary': '#68ac6e',
  			'brand-primary-dark': '#4a8050',
  			'brand-primary-light': '#86c98a',
  			'void-black': '#000000',
  			'void-900': '#0a0a0a',
  			'void-800': '#121212',
  			'void-700': '#1a1a1a',
  			'void-600': '#242424',
  			'matrix-green': '#00ff41',
  			'solana-purple': '#9945ff',
  			'alert-red': '#ff0033',
  			'warning-amber': '#ffaa00',
  			'trench-darker': '#0a0a0a',
  			'trench-blue': '#3b82f6',
  			'trench-cyan': '#06b6d4',
  			'trench-slate': '#1e293b',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			display: ['var(--font-display)', 'Space Grotesk', 'sans-serif'],
  			sans: ['var(--font-sans)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
  			mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace']
  		},
  		maxWidth: {
  			container: '1400px'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
