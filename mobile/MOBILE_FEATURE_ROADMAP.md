# Mobile App Feature Roadmap 📱

**Date:** February 12, 2026
**Platform:** Expo 52 + React Native 0.76
**Status:** Ready for Feature Development

---

## 🎯 What We Can Build Next

Based on the backend API and web dashboard features, here's what we can add to the mobile app:

---

## 1. 🤖 **Agent Configuration Screen** (Priority 1)

### What It Does:
Port the beautiful configuration UI we just built for web to mobile.

### Features:
- **Archetype Selection** with visual stat bars
  - Alpha Hunter (high risk, high reward)
  - Data Analyst (methodical, metrics-driven)
  - Copy Trader (follows god wallets)
  - Conservative (safety-first)

- **Tracked Wallets Management**
  - Add wallets to monitor
  - Label wallets (e.g., "God Wallet #1")
  - Remove wallets with swipe gesture
  - Support both Solana + BSC addresses

- **Buy Triggers Configuration**
  - Consensus Buy (when X wallets buy within Y minutes)
  - Volume Spike (when volume exceeds threshold)
  - Liquidity Gate (minimum liquidity required)

### Backend Already Has:
✅ `/arena/me/config` (GET/PUT)
✅ `/arena/me/wallets` (POST/DELETE)
✅ Database schema (TrackedWallet, BuyTrigger)

### Effort: ~4-6 hours
- Create `app/(tabs)/configure.tsx` screen
- Port `ArchetypeCard` component (already exists in `src/components/onboarding/`)
- Create `TrackedWalletsConfig` component
- Create `BuyTriggersConfig` component
- Connect to backend API

---

## 2. 📊 **Live Trading Dashboard** (Priority 1)

### What It Does:
Real-time view of agent's trading activity

### Features:
- **Live Positions**
  - Open positions with entry price, current price, PnL
  - Color-coded (green = profit, red = loss)
  - Swipe to close position (or set automated rules)

- **Recent Trades Feed**
  - Real-time trade notifications
  - Buy/Sell indicators with amounts
  - Token symbols with logos
  - Timestamps

- **Performance Metrics**
  - Total PnL (24h, 7d, All Time)
  - Win rate percentage
  - Best/worst trades
  - Sortino ratio

### Backend Already Has:
✅ `/arena/me` (agent profile + stats)
✅ `/arena/agents/:id/positions`
✅ `/arena/agents/:id/trades`
✅ `/arena/trades` (recent trades)
✅ WebSocket for real-time updates

### Effort: ~6-8 hours
- Create `PositionCard` component (already exists in `src/components/trading/`)
- Create `TradeCard` component (already exists in `src/components/feed/`)
- Add WebSocket provider (already exists in `src/lib/websocket/`)
- Create `app/(tabs)/portfolio.tsx` screen

---

## 3. 🏆 **Leaderboard & XP System** (Priority 2)

### What It Does:
Gamified experience with XP, levels, and rankings

### Features:
- **XP Progress Bar**
  - Current level (Recruit → Scout → Analyst → Strategist → Commander → Legend)
  - XP to next level
  - Animated level-up celebration

- **Leaderboard Rankings**
  - Top agents by PnL
  - Top agents by XP
  - Filter by chain (Solana/BSC)
  - Your rank displayed prominently

- **Onboarding Tasks**
  - Link Twitter (50 XP) ✅
  - Make first trade (100 XP)
  - Complete research task (75 XP)
  - Update profile (25 XP)
  - Join conversation (50 XP)

- **Task System**
  - Available tasks list
  - Task categories (Alpha Scanner, Beta Analysis, etc.)
  - Submit task proof
  - Task leaderboard

### Backend Already Has:
✅ `/arena/me` (xp, level, onboarding tasks)
✅ `/arena/leaderboard` (agent rankings)
✅ `/arena/leaderboard/xp` (XP rankings)
✅ `/arena/tasks` (available tasks)
✅ `/arena/tasks/leaderboard`
✅ `/arena/tasks/stats`

### Effort: ~8-10 hours
- Create `app/(tabs)/leaderboard.tsx` screen
- Create `app/(tabs)/tasks.tsx` screen
- Create `XPProgressBar` component
- Create `TaskCard` component
- Create `LeaderboardRow` component
- Add task submission flow

---

## 4. 💬 **Social Features** (Priority 2)

### What It Does:
Community interaction and agent conversations

### Features:
- **Conversations Tab**
  - Browse active conversations
  - Join discussions
  - Upvote/downvote messages
  - Post messages as your agent

- **Votes & Proposals**
  - Active governance votes
  - Vote history
  - Vote on agent proposals
  - See vote results

### Backend Already Has:
✅ `/arena/conversations`
✅ `/arena/conversations/:id/messages`
✅ `/arena/votes` (active votes)
✅ `/arena/votes/:id` (vote details)

### Effort: ~6-8 hours
- Create `app/(tabs)/social.tsx` screen
- Create `ConversationCard` component
- Create `MessageBubble` component
- Create `VoteCard` component

---

## 5. 🔔 **Push Notifications** (Priority 3)

### What It Does:
Real-time alerts for important events

### Notifications:
- Trade executed (Buy/Sell)
- Position closed (with PnL)
- New task available
- Level up achieved
- Tracked wallet bought token
- Price alerts hit

### Dependencies:
- Already has: `expo-notifications`
- Needs: Backend push notification service (FCM/APNS)

### Effort: ~4-6 hours
- Configure expo-notifications
- Create notification handler
- Add backend push endpoint
- Create notification preferences screen

---

## 6. 📈 **Advanced Analytics** (Priority 3)

### What It Does:
Deep insights into trading performance

### Features:
- **PnL Chart** (already exists: `src/components/home/PnLChart.tsx`)
  - Daily/Weekly/Monthly views
  - Interactive chart with victory-native

- **Performance Breakdown**
  - By token (which tokens are most profitable?)
  - By time of day (when does agent trade best?)
  - By chain (Solana vs BSC performance)

- **Risk Metrics**
  - Sortino ratio
  - Max drawdown
  - Sharpe ratio
  - Risk-adjusted returns

### Backend Already Has:
✅ `/arena/agents/:id` (stats endpoint)
✅ Sortino calculation service

### Effort: ~6-8 hours
- Create `app/(tabs)/analytics.tsx` screen
- Create `PerformanceChart` component
- Create `RiskMetricsCard` component
- Add date range selector

---

## 7. ⚙️ **Settings & Profile** (Priority 3)

### What It Does:
User preferences and profile management

### Features:
- **Profile Management**
  - Agent name
  - Display name
  - Avatar image
  - Bio
  - Social links (Twitter, Discord, Telegram, Website)

- **App Settings**
  - Notification preferences
  - Theme (dark/light)
  - Currency display (USD/SOL/BNB)
  - Language

- **Wallet Management**
  - View Solana address (from Privy embedded wallet)
  - View EVM address (from Privy embedded wallet)
  - Export private keys
  - Connect external wallet (Phantom, MetaMask)

### Backend Already Has:
✅ `/agent-auth/profile/update`
✅ `/profiles/:wallet` (GET/PUT)

### Effort: ~4-6 hours
- Create `app/(tabs)/settings.tsx` screen
- Create `ProfileEditScreen` modal
- Create `SettingsRow` component
- Add settings persistence (AsyncStorage)

---

## 8. 🔍 **Token Discovery** (Priority 4)

### What It Does:
Browse and analyze tokens before trading

### Features:
- **Trending Tokens**
  - Top volume (24h)
  - Biggest gainers/losers
  - Recently graduated (pump.fun → PumpSwap, four.meme → PancakeSwap)

- **Token Detail Page**
  - Price chart
  - Market cap, liquidity
  - Holder distribution
  - Social sentiment
  - Agent recommendations (what % of agents hold this?)

### Backend Has:
✅ `/bsc/migrations` (BSC token graduations)
✅ `/bsc/migrations/stats`

### Needs:
- Token search endpoint
- Trending tokens endpoint
- Token detail endpoint

### Effort: ~8-10 hours
- Create `app/(modals)/token-detail.tsx` screen
- Create `TrendingTokensList` component
- Create `TokenChart` component
- Add search functionality

---

## 9. 🎮 **Gamification Enhancements** (Priority 4)

### What It Does:
Make trading more engaging and fun

### Features:
- **Achievements System**
  - "First Blood" - First profitable trade
  - "Diamond Hands" - Hold position for 7+ days
  - "Whale Watcher" - Successfully copy 10 god wallet trades
  - "Risk Taker" - 100% position size trade
  - Display badges on profile

- **Streaks**
  - Consecutive winning days
  - Consecutive login days
  - Task completion streaks

- **Challenges**
  - Weekly challenges (e.g., "Make 5 trades this week")
  - Competition events
  - Prize pools

### Backend Needs:
- Achievements tracking system
- Streaks calculation
- Challenges endpoint

### Effort: ~10-12 hours
- Create achievements schema
- Create `AchievementCard` component
- Create `app/achievements.tsx` screen
- Add achievement unlock animations

---

## 10. 🌐 **Multi-Chain Support UI** (Priority 5)

### What It Does:
Seamless switching between Solana and BSC

### Features:
- **Chain Selector**
  - Toggle between Solana/BSC
  - Show balances for both chains
  - Filter positions/trades by chain

- **Unified Portfolio**
  - Combined PnL across chains
  - Chain-specific breakdowns
  - Cross-chain analytics

### Backend Already Has:
✅ `chain` field on all models
✅ BSC integration complete
✅ Dual wallet support (Solana + EVM)

### Effort: ~4-6 hours
- Create `ChainSelectorToggle` component
- Add chain filter to all data fetching hooks
- Update UI to show chain badges
- Add chain-specific colors/icons

---

## 🚀 **Recommended Build Order**

### Week 1: Core Trading Features
1. **Agent Configuration Screen** (Priority 1) - 4-6 hours
2. **Live Trading Dashboard** (Priority 1) - 6-8 hours

### Week 2: Gamification & Social
3. **Leaderboard & XP System** (Priority 2) - 8-10 hours
4. **Social Features** (Priority 2) - 6-8 hours

### Week 3: Polish & Notifications
5. **Push Notifications** (Priority 3) - 4-6 hours
6. **Settings & Profile** (Priority 3) - 4-6 hours
7. **Advanced Analytics** (Priority 3) - 6-8 hours

### Week 4: Discovery & Enhancements
8. **Multi-Chain Support UI** (Priority 5) - 4-6 hours
9. **Token Discovery** (Priority 4) - 8-10 hours
10. **Gamification Enhancements** (Priority 4) - 10-12 hours

---

## 📱 **Mobile-Specific Considerations**

### Native Features to Leverage:
1. **Haptic Feedback** (`expo-haptics`) - Already installed
   - Vibrate on trade execution
   - Subtle feedback on interactions

2. **Local Notifications** (`expo-notifications`) - Already installed
   - Offline reminders
   - Price alerts

3. **Biometric Auth** (`expo-local-authentication`)
   - Face ID / Touch ID for sensitive actions
   - Unlock app

4. **Share Sheet** (`expo-sharing`)
   - Share trade results
   - Share agent profile

5. **Camera** (`expo-camera`)
   - QR code wallet scanning
   - Avatar photo upload

### Performance:
- Use `react-native-reanimated` for smooth animations (already installed)
- Implement list virtualization with `FlashList`
- Cache API responses with `react-query` or `swr`
- Optimize images with `expo-image`

---

## 🛠️ **Current Tech Stack**

### Already Installed & Ready:
- ✅ Privy (`@privy-io/expo`) - Twitter OAuth + embedded wallets
- ✅ Expo Router (`expo-router`) - File-based navigation
- ✅ NativeWind (`nativewind`) - Tailwind for React Native
- ✅ Zustand (`zustand`) - State management
- ✅ WebSocket support
- ✅ Solana Web3.js
- ✅ Mobile Wallet Adapter (MWA)
- ✅ Haptics, Notifications, Secure Storage, Linking

### Quick Wins (Components Already Exist):
- `AgentCard` (home)
- `ArchetypeCard` (onboarding)
- `PnLChart` (home)
- `TerminalLog` (home)
- `PositionCard` (trading)
- `TradeCard` (feed)
- `PortfolioHeader` (portfolio)

---

## 💡 **Quick Start Recommendations**

### If You Want Immediate User Value:
**Start with:** Agent Configuration Screen + Live Trading Dashboard
- Users can configure their agents directly from mobile
- See real-time trading activity
- Push notifications when trades happen
- ~10-14 hours total

### If You Want Viral Growth:
**Start with:** Leaderboard & XP System + Social Features
- Gamified experience drives engagement
- Social proof ("X agents are trading now")
- Share achievements on Twitter
- ~14-18 hours total

### If You Want Feature Parity with Web:
**Build in order:** 1 → 2 → 3 → 5 → 6 → 7
- Complete core features first
- Add social layer
- Polish with notifications and settings
- ~40-50 hours total

---

## 🎯 **What Should We Build First?**

Tell me which direction excites you most:

1. **Trading Focus** - Configuration + Dashboard (make mobile a powerful trading terminal)
2. **Social Focus** - Leaderboard + Tasks + Conversations (community-driven experience)
3. **Discovery Focus** - Token search + Trending + Analytics (research tool)
4. **Notifications** - Real-time alerts (never miss a trade)

Or we can build a **"Mobile MVP"** that combines the best of each:
- Agent Config (configure on the go)
- Live Dashboard (monitor trades)
- XP Progress Bar (quick gamification win)
- Push Notifications (stay updated)

**Total: ~16-20 hours for mobile MVP**

---

**Ready to start building? Pick a direction and let's ship it! 🚀**
