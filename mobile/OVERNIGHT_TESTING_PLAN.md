# 🌙 Overnight Mobile App Testing & Fixing Plan

**Date:** February 13, 2026  
**Duration:** While Henry sleeps (6-8 hours)  
**Goal:** Fully test mobile app, fix all issues, document everything

---

## 📋 Phase 1: Build & Launch (30-45 min)

### Tasks:
- [x] Start iOS build for iPhone 17 Pro simulator
- [ ] Monitor build completion
- [ ] Launch app on simulator
- [ ] Capture first launch screenshots
- [ ] Document any immediate crashes

### Success Criteria:
- ✅ App builds without errors
- ✅ App launches on simulator
- ✅ No instant crashes
- ✅ Splash screen displays correctly

---

## 📋 Phase 2: Authentication Flow Testing (1 hour)

### Test Cases:

#### 1. **Initial Launch**
- [ ] Onboarding screen appears
- [ ] Privy modal opens
- [ ] Twitter login works
- [ ] Wallet creation succeeds
- [ ] JWT token received & stored

#### 2. **Session Persistence**
- [ ] Close and reopen app
- [ ] User stays logged in
- [ ] No re-auth required
- [ ] Profile data loads

#### 3. **Logout & Re-login**
- [ ] Logout button works
- [ ] Auth state clears
- [ ] Re-login successful
- [ ] Data refreshes correctly

### Expected Issues & Fixes:

**Issue:** Privy modal doesn't open
- **Fix:** Check EXPO_PUBLIC_PRIVY_APP_ID in .env
- **Fix:** Verify Privy SDK initialization in _layout.tsx

**Issue:** Twitter login fails
- **Fix:** Check Privy dashboard for redirect URLs
- **Fix:** Add `exp://localhost:8081` to allowed redirects

**Issue:** JWT not stored
- **Fix:** Check SecureStore permissions
- **Fix:** Add fallback to AsyncStorage for simulator

---

## 📋 Phase 3: API Connection Testing (1 hour)

### Endpoints to Test:

#### 1. **Agent Profile** (`GET /arena/me`)
- [ ] Fetches user's agent data
- [ ] Displays name, level, XP correctly
- [ ] Shows Twitter handle
- [ ] Renders avatar (or placeholder)

#### 2. **Leaderboard** (`GET /api/leaderboard`)
- [ ] Returns 18+ agents
- [ ] Sorted by Sortino ratio
- [ ] All fields present (name, stats, etc.)
- [ ] Pagination works (if implemented)

#### 3. **Feed** (`GET /arena/feed`)
- [ ] Returns recent trades
- [ ] Shows agent names
- [ ] Token symbols display
- [ ] Timestamps formatted correctly

#### 4. **Conversations** (`GET /conversations`)
- [ ] Returns 4 conversations
- [ ] Messages load for each
- [ ] Agent avatars show
- [ ] Timestamps display

### Expected Issues & Fixes:

**Issue:** 404 errors on /arena/* routes
- **Fix:** Check backend has arena routes mounted
- **Fix:** Verify API_URL points to correct backend
- **Fix:** Add CORS headers if needed

**Issue:** Unauthorized (401) errors
- **Fix:** Check JWT token in Authorization header
- **Fix:** Verify token not expired
- **Fix:** Re-authenticate if needed

**Issue:** Network errors
- **Fix:** Check backend is running (http://localhost:3002)
- **Fix:** Point to Railway URL if local is down
- **Fix:** Add timeout handling

---

## 📋 Phase 4: Screen-by-Screen Testing (2-3 hours)

### 1. **Home Screen** (`app/(tabs)/index.tsx`)

**What to Check:**
- [ ] Hero section renders
- [ ] Stats cards display
- [ ] Quick actions work
- [ ] Navigation to other tabs

**Expected Issues:**
- Missing images → Add placeholder images
- Layout breaks on small screens → Add responsive styles
- Stats don't load → Add loading states

### 2. **Arena Screen** (`app/(tabs)/arena.tsx`)

**What to Check:**
- [ ] Leaderboard loads
- [ ] 18 agents display
- [ ] Agent cards render correctly
- [ ] Tap to view profile works
- [ ] Stats (Sortino, Win Rate, PnL) show
- [ ] XP progress bars animate

**Expected Issues:**
- Performance lag with 18 cards → Add FlatList virtualization
- Images don't load → Add fallback avatars
- Stats formatting wrong → Fix number formatting

### 3. **Feed Screen** (`app/(tabs)/feed.tsx`)

**What to Check:**
- [ ] Trade feed loads
- [ ] Latest 50 trades display
- [ ] Pull to refresh works
- [ ] Infinite scroll works
- [ ] Trade cards show all info
- [ ] Colors (green/red for PnL) correct

**Expected Issues:**
- Feed doesn't refresh → Check WebSocket connection
- Infinite scroll broken → Fix pagination logic
- Missing token logos → Add placeholder icons

### 4. **Settings Screen** (`app/(tabs)/settings.tsx`)

**What to Check:**
- [ ] Profile section shows
- [ ] Twitter handle displays
- [ ] Logout button works
- [ ] Theme toggle works (if exists)
- [ ] Version number shows

**Expected Issues:**
- Profile data missing → Add loading state
- Logout doesn't clear state → Fix auth context

### 5. **Agent Profile Screen** (`app/agent/[id].tsx`)

**What to Check:**
- [ ] Profile loads from URL param
- [ ] Agent stats display
- [ ] Trade history shows
- [ ] Current positions visible
- [ ] Back button works

**Expected Issues:**
- Dynamic routing broken → Check Expo Router setup
- Data doesn't load → Fix API call with ID
- Images missing → Add placeholders

### 6. **Onboarding Screen** (`app/(auth)/onboarding.tsx`)

**What to Check:**
- [ ] Archetype selection shows
- [ ] Cards render correctly
- [ ] Selection persists
- [ ] Submit creates agent
- [ ] Navigation to main app

**Expected Issues:**
- Archetype data missing → Add mock data
- Submit fails → Check API endpoint
- Navigation broken → Fix router push

---

## 📋 Phase 5: WebSocket Real-Time Features (1 hour)

### Test Cases:

#### 1. **Live Feed Updates**
- [ ] Connect to WebSocket on app start
- [ ] Receive new trade events
- [ ] Feed updates automatically
- [ ] No duplicates
- [ ] Reconnects on disconnect

#### 2. **Leaderboard Live Updates**
- [ ] Sortino scores update in real-time
- [ ] Positions shift when rankings change
- [ ] Animations smooth
- [ ] No flickering

### Expected Issues & Fixes:

**Issue:** WebSocket won't connect
- **Fix:** Check WS URL (wss:// not https://)
- **Fix:** Verify backend WebSocket server running
- **Fix:** Add connection retry logic

**Issue:** Events not received
- **Fix:** Check event names match backend
- **Fix:** Add console logs to debug
- **Fix:** Verify authentication on WS connection

**Issue:** Memory leaks from WS
- **Fix:** Add cleanup on unmount
- **Fix:** Unsubscribe from events properly

---

## 📋 Phase 6: UI/UX Polish (1-2 hours)

### Tasks:

#### 1. **Visual Bugs**
- [ ] Check all text is readable
- [ ] Verify colors match design
- [ ] Fix any layout shifts
- [ ] Ensure buttons are tappable (min 44x44)
- [ ] Add loading states everywhere

#### 2. **Animations**
- [ ] Add fade-in for lists
- [ ] Smooth transitions between screens
- [ ] Progress bars animate
- [ ] Pull-to-refresh has feedback

#### 3. **Error Handling**
- [ ] Network errors show toast
- [ ] API errors display properly
- [ ] Retry buttons work
- [ ] Fallback states exist

#### 4. **Performance**
- [ ] Lists scroll smoothly (60fps)
- [ ] Images load efficiently
- [ ] No memory leaks
- [ ] App feels snappy

### Common Fixes:
- Replace ScrollView with FlatList for long lists
- Add `useCallback` to prevent re-renders
- Memoize expensive computations
- Lazy load images with placeholder

---

## 📋 Phase 7: Edge Cases & Stress Testing (1 hour)

### Test Cases:

#### 1. **No Data States**
- [ ] Empty leaderboard → Show placeholder
- [ ] No trades → Show "No activity yet"
- [ ] No conversations → Show onboarding prompt
- [ ] No internet → Show offline banner

#### 2. **Large Data Sets**
- [ ] 100+ trades in feed → Pagination works
- [ ] 50+ agents → Leaderboard still fast
- [ ] Long agent bios → Text truncates

#### 3. **Network Issues**
- [ ] Slow 3G → Loading states show
- [ ] Offline → Cached data displays
- [ ] Reconnect → Data syncs

#### 4. **Device Variations**
- [ ] Small screens (iPhone SE) → Layout adapts
- [ ] Large screens (iPhone Pro Max) → Uses space well
- [ ] Different iOS versions → No crashes

---

## 📋 Phase 8: Documentation & Handoff (30 min)

### Deliverables:

1. **TESTING_RESULTS.md**
   - All test cases with ✅/❌
   - Screenshots of each screen
   - List of bugs found
   - List of bugs fixed

2. **KNOWN_ISSUES.md**
   - Bugs that still exist
   - Workarounds if any
   - Priority level (P0/P1/P2)
   - Estimated fix time

3. **FIXES_APPLIED.md**
   - All code changes made
   - Files modified
   - Reasoning for each fix
   - Before/after comparisons

4. **NEXT_STEPS.md**
   - Features ready to build
   - API endpoints needed
   - Design assets needed
   - Estimated timeline

---

## 🔧 Common Fixes Reference

### 1. **API Connection Issues**

```typescript
// In src/lib/api/client.ts
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002';

// Add timeout
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### 2. **WebSocket Connection**

```typescript
// In src/lib/websocket/provider.tsx
const WS_URL = process.env.EXPO_PUBLIC_API_URL?.replace('https://', 'wss://').replace('http://', 'ws://');

useEffect(() => {
  const socket = io(WS_URL, {
    transports: ['websocket'],
    auth: { token },
  });

  socket.on('connect', () => console.log('WS Connected'));
  socket.on('trade:new', handleNewTrade);

  return () => {
    socket.off('trade:new');
    socket.disconnect();
  };
}, [token]);
```

### 3. **Image Loading with Fallback**

```typescript
// In AgentCard component
<Image
  source={{ uri: agent.avatarUrl }}
  defaultSource={require('../../assets/default-avatar.png')}
  style={styles.avatar}
/>
```

### 4. **Performance Optimization**

```typescript
// Use FlatList instead of ScrollView
<FlatList
  data={agents}
  renderItem={({ item }) => <AgentCard agent={item} />}
  keyExtractor={(item) => item.id}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

---

## ✅ Success Criteria

By the end of overnight testing, we should have:

- ✅ **App builds and runs** on iOS simulator
- ✅ **All screens accessible** and rendering
- ✅ **Authentication works** end-to-end
- ✅ **API calls succeed** for all endpoints
- ✅ **WebSocket connects** and receives events
- ✅ **No critical bugs** (crashes, broken flows)
- ✅ **Performance acceptable** (smooth scrolling, fast loads)
- ✅ **Documentation complete** (results, issues, fixes)

---

## 📞 Wake-Up Summary

When Henry wakes up, provide:

1. **One-sentence status**: "App is [working/broken], [X] bugs fixed, [Y] remain"
2. **Top 3 wins**: Major things that work now
3. **Top 3 issues**: Critical bugs that need attention
4. **Demo video**: Recording of app in action (if working)
5. **Next actions**: What to do first when you wake up

---

**Let's ship this! 🚀**
