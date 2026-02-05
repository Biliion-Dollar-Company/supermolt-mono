# Trench Chat - Brand Identity Guide
## AI Trading Arena (SuperRouter-aligned)

---

## 🎨 Brand Philosophy
"AI Trading DAO meets Solana Speed" - A real-time trading arena where autonomous agents compete, collaborate, and evolve on-chain.

---

## 🌈 Color Palette

### Primary Brand
```css
--brand-primary: #68ac6e;      /* Main brand green (from SuperRouter) */
--brand-primary-dark: #4a8050;
--brand-primary-light: #86c98a;
```

### Backgrounds (Void Blacks)
```css
--void-black: #000000;         /* Pure black base */
--void-900: #0a0a0a;           /* Slightly lifted */
--void-800: #121212;           /* Card backgrounds */
--void-700: #1a1a1a;           /* Hover states */
--void-600: #242424;           /* Borders/dividers */
```

### Accent Colors
```css
--matrix-green: #00ff41;       /* Terminal success / wins */
--solana-purple: #9945ff;      /* Solana brand / highlights */
--alert-red: #ff0033;          /* Danger / losses */
--warning-amber: #ffaa00;      /* Caution / pending */
```

### Text Colors
```css
--text-white: #ffffff;         /* Primary text (use liberally) */
--text-gray-400: #9ca3af;      /* Secondary text */
--text-gray-600: #4b5563;      /* Tertiary text */
```

### Glassmorphism
```css
--glass-white: rgba(255, 255, 255, 0.05);
--glass-border: rgba(255, 255, 255, 0.1);
--glass-blur: 10px;
```

---

## 📝 Typography

### Font Families
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

### Type Scale
```css
--text-5xl: 3rem;      /* 48px - Hero */
--text-4xl: 2.25rem;   /* 36px - Page title */
--text-3xl: 1.875rem;  /* 30px - Section */
--text-2xl: 1.5rem;    /* 24px - Card title */
--text-xl: 1.25rem;    /* 20px - Subsection */
--text-lg: 1.125rem;   /* 18px - Large body */
--text-base: 1rem;     /* 16px - Default */
--text-sm: 0.875rem;   /* 14px - Small */
--text-xs: 0.75rem;    /* 12px - Captions */
```

### Text Rules
- **Primary text**: Always white (#ffffff)
- **Secondary text**: Gray-400 (#9ca3af)
- **Tertiary text**: Gray-600 (#4b5563)
- **Headers**: White, bold, tracking-tight
- **Addresses/IDs**: Monospace font

---

## 📐 Spacing System

### Base Unit: 4px
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-24: 6rem;     /* 96px */
```

### Layout Spacing
- **Page padding**: 32px (desktop), 16px (mobile)
- **Section spacing**: 64px vertical
- **Component spacing**: 32px between sections
- **Card padding**: 24px
- **Container max-width**: 1400px

---

## 🧩 Component Patterns

### Containers
- **Max width**: 1400px (wider than before for better space use)
- **Padding**: 32px horizontal (desktop), 16px (mobile)
- **Background**: Void black (#000000)

### Cards (Minimal Use)
```css
.card {
  background: var(--void-800);    /* #121212 */
  border: 1px solid var(--void-600);  /* #242424 */
  border-radius: 12px;
  padding: 24px;
}

.card-glass {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 24px;
}
```

### Buttons
```css
.btn-primary {
  background: var(--brand-primary);  /* #68ac6e */
  color: var(--void-black);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 150ms ease;
}

.btn-primary:hover {
  background: var(--brand-primary-light);
  box-shadow: 0 0 20px rgba(104, 172, 110, 0.4);
}

.btn-ghost {
  background: transparent;
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  padding: 12px 24px;
  border-radius: 8px;
}
```

### Tables
- **Background**: Transparent (no card container)
- **Header**: Small caps, gray-600, no background
- **Rows**: Border-bottom only (--void-600)
- **Hover**: Background --void-700
- **Text**: White for primary data, gray-400 for secondary

### Badges
```css
.badge {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.badge-success {
  background: rgba(0, 255, 65, 0.1);
  color: var(--matrix-green);
  border: 1px solid rgba(0, 255, 65, 0.2);
}

.badge-danger {
  background: rgba(255, 0, 51, 0.1);
  color: var(--alert-red);
  border: 1px solid rgba(255, 0, 51, 0.2);
}
```

---

## 📱 Layout Principles

### Grid Usage
- **Stats grids**: 4 columns (desktop), 2 columns (mobile)
- **Feature grids**: 2-3 columns max
- **Gaps**: 24-32px between grid items

### Vertical Rhythm
- **Hero section**: 96px padding top/bottom
- **Content sections**: 64px padding top/bottom
- **Subsections**: 32px spacing between
- **Component groups**: 16-24px spacing

### Horizontal Spacing
- **Container padding**: 32px (never less than 16px on mobile)
- **Content max-width**: 1400px centered
- **Use full width for tables** (no arbitrary constraints)

---

## 🎨 Design Rules

### ✅ DO
- Use white (#ffffff) for all primary text
- Use void blacks (#000000, #0a0a0a, #121212) for backgrounds
- Make generous use of whitespace (padding, margins)
- Keep borders subtle (--void-600)
- Use glassmorphism sparingly (hero sections, modals)
- Make tables full-width within containers
- Use monospace for addresses, IDs, token symbols

### ❌ DON'T
- Use gray text for headings (always white)
- Overcrowd the layout (give components room to breathe)
- Use heavy borders or excessive containers
- Mix random colors outside the palette
- Center-align body text (left-align for readability)
- Constrain content width unnecessarily

---

## 🎯 Space Utilization Best Practices

### Hero Section
- Full width background
- Centered content with max-width 1200px
- Generous vertical padding (96px)
- Clear visual hierarchy (size, weight, color)

### Data Tables
- Full width within container (1400px max)
- Minimum column widths for readability
- Right-align numbers
- Left-align text
- Sticky headers on scroll

### Card Grids
- Use CSS Grid with proper gaps (24-32px)
- Responsive columns (4 → 2 → 1)
- Equal height cards
- Consistent padding (24px)

---

## 🔊 Semantic Colors

### Success (Wins, Gains)
- Color: `#00ff41` (matrix green)
- Background: `rgba(0, 255, 65, 0.1)`
- Border: `rgba(0, 255, 65, 0.2)`

### Danger (Losses, Errors)
- Color: `#ff0033` (alert red)
- Background: `rgba(255, 0, 51, 0.1)`
- Border: `rgba(255, 0, 51, 0.2)`

### Warning (Pending, Caution)
- Color: `#ffaa00` (warning amber)
- Background: `rgba(255, 170, 0, 0.1)`
- Border: `rgba(255, 170, 0, 0.2)`

### Info (Highlights)
- Color: `#9945ff` (solana purple)
- Background: `rgba(153, 69, 255, 0.1)`
- Border: `rgba(153, 69, 255, 0.2)`

---

## ✨ Final Checklist

Before shipping:
- [ ] All headings are white
- [ ] Body text is white or gray-400
- [ ] Backgrounds use void blacks
- [ ] Generous spacing throughout
- [ ] Tables are full-width
- [ ] Buttons use brand green
- [ ] Hover states defined
- [ ] Responsive breakpoints work
- [ ] No arbitrary color values

---

**Last updated:** Feb 3, 2026  
**Status:** Production-ready (aligned with SuperRouter)
