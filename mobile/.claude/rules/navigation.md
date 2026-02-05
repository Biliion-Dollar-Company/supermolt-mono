# Navigation Rules

## Expo Router Basics

Expo Router uses file-based routing. Files in `app/` become routes.

### Route Types

| File | Route |
|------|-------|
| `app/index.tsx` | `/` |
| `app/about.tsx` | `/about` |
| `app/user/[id].tsx` | `/user/:id` (dynamic) |
| `app/(tabs)/index.tsx` | `/` (in tab group) |

### Special Files

| File | Purpose |
|------|---------|
| `_layout.tsx` | Layout wrapper for directory |
| `+not-found.tsx` | 404 page |
| `+html.tsx` | HTML wrapper (web) |

## Route Groups

Parentheses create groups that don't affect URL:

```
app/
├── (auth)/           # Group: unauthenticated users
│   ├── _layout.tsx   # Auth layout
│   └── login.tsx     # /login (NOT /(auth)/login)
├── (tabs)/           # Group: tab navigation
│   ├── _layout.tsx   # Tab bar
│   └── index.tsx     # / (main tab)
└── (modals)/         # Group: modal screens
    └── approve.tsx   # Opens as modal
```

## Layouts

### Root Layout (`app/_layout.tsx`)
```tsx
import { Slot } from 'expo-router';
import { PrivyProvider } from '@privy-io/expo';
import { AuthProvider } from '@/lib/auth/provider';

export default function RootLayout() {
  return (
    <PrivyProvider appId="...">
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </PrivyProvider>
  );
}
```

### Tab Layout (`app/(tabs)/_layout.tsx`)
```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: { backgroundColor: colors.surface.primary },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home" color={color} />,
        }}
      />
    </Tabs>
  );
}
```

## Navigation Methods

### Using `Link`
```tsx
import { Link } from 'expo-router';

<Link href="/settings">Go to Settings</Link>
<Link href={{ pathname: '/user/[id]', params: { id: '123' } }}>
  User Profile
</Link>
```

### Using `useRouter`
```tsx
import { useRouter } from 'expo-router';

function Component() {
  const router = useRouter();

  function handlePress() {
    router.push('/settings');       // Push to stack
    router.replace('/login');       // Replace current
    router.back();                  // Go back
  }
}
```

### Using `Redirect`
```tsx
import { Redirect } from 'expo-router';

function AuthGuard({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  return children;
}
```

## Auth Flow

### Protected Routes
Auth state is checked in `AuthProvider` and redirects accordingly:

```tsx
// In AuthProvider
useEffect(() => {
  if (!isReady) return;

  const inAuthGroup = segments[0] === '(auth)';

  if (!user && !inAuthGroup) {
    router.replace('/');  // To login
  } else if (user && inAuthGroup) {
    router.replace('/(tabs)');  // To app
  }
}, [user, segments, isReady]);
```

### Flow
1. User opens app → `app/index.tsx` (login screen)
2. User authenticates → redirected to `app/(tabs)/`
3. User logs out → redirected to `app/index.tsx`

## Modal Navigation

### Opening Modals
```tsx
router.push('/(modals)/approve-tx');
```

### Modal Layout
```tsx
// app/(modals)/_layout.tsx
import { Stack } from 'expo-router';

export default function ModalLayout() {
  return (
    <Stack screenOptions={{ presentation: 'modal' }} />
  );
}
```

## Best Practices

1. **Use route groups** to organize related screens
2. **Keep layouts minimal** - move logic to providers
3. **Use TypeScript** for type-safe navigation
4. **Handle loading states** during navigation
5. **Protect routes** via AuthProvider redirect logic
