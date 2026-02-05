# File Structure Rules

## Directory Organization

```
mobile/
├── app/                    # Expo Router pages (file-based routing)
│   ├── _layout.tsx        # Root layout with providers
│   ├── index.tsx          # Entry point (login screen)
│   ├── +not-found.tsx     # 404 screen
│   ├── (auth)/            # Auth route group
│   │   ├── _layout.tsx    # Auth layout
│   │   └── login.tsx      # Login screen
│   ├── (tabs)/            # Tab navigation group
│   │   ├── _layout.tsx    # Tab bar layout
│   │   ├── index.tsx      # Home/Portfolio tab
│   │   ├── agent.tsx      # AI Agent tab
│   │   ├── feed.tsx       # Trade feed tab
│   │   └── settings.tsx   # Settings tab
│   └── (modals)/          # Modal screens
│       ├── _layout.tsx    # Modal layout
│       └── approve-tx.tsx # Transaction approval modal
│
├── src/
│   ├── components/        # Reusable components
│   │   ├── ui/           # Design system components
│   │   │   ├── Button.tsx
│   │   │   ├── Text.tsx
│   │   │   ├── Card.tsx
│   │   │   └── index.ts
│   │   ├── auth/         # Auth components
│   │   │   ├── TwitterLoginButton.tsx
│   │   │   └── index.ts
│   │   └── portfolio/    # Portfolio components
│   │       ├── PortfolioHeader.tsx
│   │       ├── PositionCard.tsx
│   │       └── MilestoneProgress.tsx
│   │
│   ├── hooks/            # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── usePositions.ts
│   │   ├── useAgent.ts
│   │   └── useTradeFeed.ts
│   │
│   ├── lib/              # Library code and providers
│   │   ├── auth/
│   │   │   └── provider.tsx
│   │   └── websocket/
│   │       └── provider.tsx
│   │
│   ├── store/            # Zustand stores
│   │   ├── portfolio.ts
│   │   ├── agent.ts
│   │   └── settings.ts
│   │
│   └── theme/            # Design system
│       ├── colors.ts
│       └── index.ts
│
├── .claude/              # Claude configuration
│   ├── CLAUDE.md
│   ├── agents/
│   ├── rules/
│   └── skills/
│
├── tailwind.config.js    # NativeWind configuration
├── tsconfig.json         # TypeScript configuration
└── package.json
```

## Naming Conventions

### Files
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase.tsx | `Button.tsx`, `PositionCard.tsx` |
| Hooks | camelCase.ts (use prefix) | `useAuth.ts`, `usePositions.ts` |
| Stores | camelCase.ts | `portfolio.ts`, `settings.ts` |
| Providers | camelCase or provider.tsx | `provider.tsx` |
| Config | camelCase | `tailwind.config.js` |

### Exports
- Components: Named exports (`export function Button`)
- Hooks: Named exports (`export function useAuth`)
- Stores: Named exports (`export const usePortfolioStore`)
- Index files: Re-export all (`export * from './Button'`)

## Import Aliases

Configured in `tsconfig.json`:
- `@/*` → `./src/*`

Use: `import { Button } from '@/components/ui'`

## Route Groups

Expo Router uses parentheses for route groups:
- `(auth)` - Unauthenticated routes
- `(tabs)` - Tab navigation (authenticated)
- `(modals)` - Modal screens

Groups don't affect the URL, only organization.

## File Creation Rules

1. **New component?** → `src/components/{category}/{ComponentName}.tsx`
2. **New hook?** → `src/hooks/use{Name}.ts`
3. **New store?** → `src/store/{name}.ts`
4. **New screen?** → `app/{group}/{name}.tsx`
5. **New provider?** → `src/lib/{name}/provider.tsx`
