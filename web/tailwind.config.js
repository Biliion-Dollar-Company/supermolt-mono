/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		// 🌑 Colosseum Color System
  		colors: {
  			// Background Layers (Pure Black System)
  			bg: {
  				primary: '#000000',
  				secondary: '#0A0A0A',
  				elevated: '#111111',
  				surface: '#141414',
  			},
  			
  			// Card System
  			card: {
  				DEFAULT: '#0A0A0A',
  				elevated: '#111111',
  			},
  			
  			// Luxury Gold Accent (Colosseum Brand)
  			accent: {
  				primary: '#E8B45E',
  				soft: '#F5C978',
  				dark: '#D6A04B',
  			},
  			
  			// Border System
  			border: {
  				subtle: 'rgba(255, 255, 255, 0.06)',
  				DEFAULT: 'rgba(255, 255, 255, 0.08)',
  				strong: 'rgba(255, 255, 255, 0.12)',
  			},
  			
  			divider: '#1E1E1E',
  			
  			// Text Hierarchy
  			text: {
  				primary: '#FFFFFF',
  				secondary: 'rgba(255, 255, 255, 0.7)',
  				muted: 'rgba(255, 255, 255, 0.45)',
  			},
  			
  			// Status Colors
  			success: '#00ff41',
  			error: '#ff0033',
  			warning: '#ffaa00',
  			
  			// Keep backward compatibility
  			'brand-primary': '#E8B45E',
  			'matrix-green': '#00ff41',
  			'solana-purple': '#9945ff',
  		},
  		
  		// ✍️ Typography
  		fontFamily: {
  			display: ['var(--font-display)', 'Orbitron', 'sans-serif'],
  			sans: ['var(--font-sans)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
  			mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace']
  		},
  		
  		fontSize: {
  			hero: ['64px', { lineHeight: '1.1', fontWeight: '700' }],
  			'hero-mobile': ['40px', { lineHeight: '1.1', fontWeight: '700' }],
  			section: ['44px', { lineHeight: '1.2', fontWeight: '600' }],
  			subheading: ['24px', { lineHeight: '1.3', fontWeight: '600' }],
  			body: ['16px', { lineHeight: '1.6', fontWeight: '400' }],
  			caption: ['14px', { lineHeight: '1.5', fontWeight: '500' }],
  		},
  		
  		// 📐 Spacing System (4px base grid)
  		spacing: {
  			'1': '4px',
  			'2': '8px',
  			'3': '12px',
  			'4': '16px',
  			'6': '24px',
  			'8': '32px',
  			'12': '48px',
  			'16': '64px',
  			'24': '96px',
  			'32': '128px',
  		},
  		
  		// 📦 Container
  		maxWidth: {
  			container: '1320px',
  		},
  		
  		// 🔲 Border Radius (Colosseum Style)
  		borderRadius: {
  			'card': '16px',
  			'xl': '16px',
  			'pill': '9999px',
  			'button': '9999px',
  		},
  		
  		// ✨ Shadows
  		boxShadow: {
  			glow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  			'glow-gold': '0 20px 60px rgba(232, 180, 94, 0.3)',
  			'card-hover': '0 8px 32px rgba(0, 0, 0, 0.4)',
  		},
  		
  		// 🎭 Animations
  		transitionDuration: {
  			'250': '250ms',
  		},
  		
  		transitionTimingFunction: {
  			'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
  		},
  		
  		// 🎨 Background Gradients
  		backgroundImage: {
  			'accent-gradient': 'linear-gradient(135deg, #F5C978, #E8B45E)',
  			'glow-radial': 'radial-gradient(circle at 50% 0%, rgba(232, 180, 94, 0.25), transparent 60%)',
  		},
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
