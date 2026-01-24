# Component Rules

## Design System Components

Located in `src/components/ui/`:

### Button
```tsx
import { Button } from '@/components/ui';

<Button
  variant="primary"    // primary | secondary | outline | ghost
  size="md"            // sm | md | lg
  loading={false}
  disabled={false}
  leftIcon={<Icon />}
  rightIcon={<Icon />}
  onPress={() => {}}
>
  <Text>Button Text</Text>
</Button>
```

### Text
```tsx
import { Text } from '@/components/ui';

<Text
  variant="body"       // h1 | h2 | h3 | body | bodySmall | caption | label
  color="primary"      // primary | secondary | muted | success | error | warning | brand
  weight="600"         // Optional override
  align="center"       // Optional alignment
>
  Text content
</Text>
```

### Card
```tsx
import { Card } from '@/components/ui';

<Card
  variant="default"    // default | outlined | glass
  padding="md"         // none | sm | md | lg
>
  Card content
</Card>
```

## Component Patterns

### Structure
```tsx
import { View, ViewProps } from 'react-native';
import { ReactNode } from 'react';
import { colors } from '@/theme/colors';

// 1. Types first
interface ComponentProps extends ViewProps {
  variant?: 'primary' | 'secondary';
  children: ReactNode;
}

// 2. Component function
export function Component({
  variant = 'primary',
  children,
  style,
  ...props
}: ComponentProps) {
  // 3. Logic
  const backgroundColor = variant === 'primary'
    ? colors.brand.primary
    : colors.surface.secondary;

  // 4. Render
  return (
    <View
      style={[{ backgroundColor }, style]}
      {...props}
    >
      {children}
    </View>
  );
}
```

### Props Interface
- Always define explicit TypeScript interfaces
- Extend base React Native props when appropriate
- Use discriminated unions for variants
- Provide sensible defaults

### Styling Rules
```tsx
// GOOD - Use theme colors
import { colors } from '@/theme/colors';
<View style={{ backgroundColor: colors.surface.primary }} />

// BAD - Hardcoded colors
<View style={{ backgroundColor: '#0f0f0f' }} />
```

## Color Usage

Always import from theme:
```tsx
import { colors } from '@/theme/colors';

// Brand colors
colors.brand.primary    // #68ac6e (SuperRouter green)
colors.brand.secondary  // #9945ff (Solana purple)
colors.brand.accent     // #00ff41 (Matrix green)

// Surface colors
colors.surface.primary   // #0f0f0f
colors.surface.secondary // #1a1a1a
colors.surface.tertiary  // #27272a

// Text colors
colors.text.primary     // #fafafa
colors.text.secondary   // #a1a1aa
colors.text.muted       // #71717a

// Status colors
colors.status.success   // #22c55e
colors.status.error     // #ef4444
colors.status.warning   // #f59e0b
```

## State Management

### Loading States
```tsx
function Component() {
  const { data, isLoading, error } = useData();

  if (isLoading) {
    return <ActivityIndicator color={colors.brand.primary} />;
  }

  if (error) {
    return <Text color="error">{error.message}</Text>;
  }

  return <View>{/* content */}</View>;
}
```

### Error Handling
- Always handle potential errors
- Show user-friendly error messages
- Use status colors for feedback

## Accessibility

- Use `accessibilityLabel` for interactive elements
- Use `accessibilityRole` appropriately
- Ensure sufficient color contrast
- Support dynamic type sizes
