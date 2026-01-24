# Claude Configuration - SR-Mobile

## Project Overview

**SR-Mobile** is a mobile trading application for the Pump.fun hackathon, built with the "Remote Brain, Local Hands" architecture. The mobile app serves as the user interface while a backend AI agent handles trading decisions.

**Core Value Proposition:** AI-powered trading on Solana, optimized for the Solana Seeker device.

## Tech Stack

### Mobile App
- **Framework:** Expo 52 + React Native 0.76
- **Language:** TypeScript (strict mode)
- **Styling:** NativeWind 4.x (Tailwind for React Native)
- **Navigation:** Expo Router 4.x (file-based routing)
- **State Management:** Zustand 5.x
- **Authentication:** Privy (Twitter OAuth only)
- **Wallet:** Mobile Wallet Adapter (MWA) for Solana

### Backend
- **Runtime:** Node.js + Express
- **Database:** PostgreSQL (via Railway)
- **Cache:** Redis (via Upstash)
- **Auth:** Privy server-side verification
- **AI Agent:** Trading decision engine

## Architecture: "Remote Brain, Local Hands"

```
Mobile App (UI Layer)           Backend (Brain)
┌─────────────────────┐        ┌─────────────────────┐
│  User Interface     │        │  AI Trading Agent   │
│  Twitter Auth       │ ────── │  Decision Engine    │
│  Wallet Signing     │        │  Market Analysis    │
│  Trade Approval     │        │  Risk Management    │
└─────────────────────┘        └─────────────────────┘
```

**Mobile responsibilities:**
- User authentication (Privy + Twitter)
- Display portfolio and trade feed
- Request wallet signatures (MWA)
- Approve/reject AI trade recommendations

**Backend responsibilities:**
- AI agent logic and decision-making
- Market data aggregation
- Trade execution via Jupiter
- Portfolio tracking

## Design System

**Primary Color:** `#68ac6e` (SuperRouter Green)
**Secondary Color:** `#9945ff` (Solana Purple)
**Accent Color:** `#00ff41` (Matrix Green)

### Color Categories
- `brand.*` - Brand colors (primary, secondary, accent)
- `void.*` - Black shades (black, 900-600)
- `surface.*` - Background surfaces (primary, secondary, tertiary)
- `text.*` - Text colors (primary, secondary, muted)
- `status.*` - Status colors (success, error, warning)
- `glass.*` - Glass effect colors with alpha

### Component Library
Located in `src/components/ui/`:
- `Button` - Configurable button (variants: primary, secondary, outline, ghost)
- `Text` - Typography component (variants: h1, h2, h3, body, bodySmall, caption, label)
- `Card` - Card container (variants: default, outlined, glass)

**Usage:** Import from `@/components/ui` or `@/components/auth`

## Authentication

**Method:** Privy with Twitter OAuth only

```tsx
import { useAuth } from '@/hooks/useAuth';

const { loginWithTwitter, logout, user, isAuthenticated } = useAuth();
```

**Privy Configuration:**
- App ID: `cmkraowkw0094i50c2n696dhz`
- Client ID: `client-WY5gKa3L5wUkNj33WrNyYNXmVbVnvhLe6GZfk1zf9hQdV`

## File Structure

```
mobile/
├── app/                    # Expo Router pages
│   ├── _layout.tsx        # Root layout (providers)
│   ├── index.tsx          # Entry/login screen
│   ├── (auth)/            # Auth group (unauthenticated)
│   ├── (tabs)/            # Main app (authenticated)
│   └── (modals)/          # Modal screens
├── src/
│   ├── components/
│   │   ├── ui/            # Reusable UI components
│   │   ├── auth/          # Auth-specific components
│   │   └── portfolio/     # Portfolio components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Libraries and providers
│   ├── store/             # Zustand stores
│   └── theme/             # Design system constants
├── .claude/               # Claude configuration
└── tailwind.config.js     # NativeWind configuration
```

## Development Workflow

### Commands
```bash
npm run dev        # Start Expo development server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run typecheck  # Run TypeScript checks
npm run lint       # Run ESLint
```

### Path Aliases
- `@/*` → `src/*` (configured in tsconfig.json)

## Performance Targets

- App launch: < 2 seconds
- Screen transitions: < 300ms
- API response display: < 500ms after fetch
- Smooth 60fps animations

## Critical Constraints

### MUST
- Use TypeScript with strict mode
- Follow design system colors (never hardcode)
- Use Privy for authentication (Twitter only)
- Use Zustand for global state
- Handle loading and error states
- Support iOS and Android

### MUST NOT
- Skip TypeScript types (no `any`)
- Hardcode colors (use theme constants)
- Use other auth methods (Twitter only via Privy)
- Block the main thread
- Ignore accessibility

## Agent Identity

When operating as the mobile-lead agent, reference `.claude/agents/mobile-lead.md` for role-specific instructions.

## Related Documentation

- `rules/README.md` - Rules index
- `rules/structure.md` - Folder/file conventions
- `rules/components.md` - Component patterns
- `rules/navigation.md` - Expo Router patterns
- `INTEGRATION_STATUS.json` - Epic tracking
