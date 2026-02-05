# SR-Mobile Rules Index

This directory contains development rules and conventions for the SR-Mobile project.

## Rule Files

| File | Description |
|------|-------------|
| `structure.md` | Folder organization and file naming conventions |
| `components.md` | Component patterns and design system usage |
| `navigation.md` | Expo Router patterns and navigation flows |

## Quick Reference

### File Naming
- Components: `PascalCase.tsx` (e.g., `Button.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useAuth.ts`)
- Stores: `camelCase.ts` (e.g., `portfolio.ts`)
- Types: `PascalCase.ts` or inline

### Component Structure
```tsx
// 1. Imports
import { ... } from 'react-native';
import { colors } from '@/theme/colors';

// 2. Types
interface Props { ... }

// 3. Component
export function ComponentName({ ... }: Props) {
  return ( ... );
}
```

### Import Order
1. React/React Native
2. Third-party libraries
3. Local components (`@/components/*`)
4. Hooks (`@/hooks/*`)
5. Stores (`@/store/*`)
6. Theme (`@/theme/*`)
7. Types

## When to Read Rules

- **Before creating new components:** Read `components.md`
- **Before creating new screens:** Read `navigation.md`
- **Before creating new files:** Read `structure.md`
