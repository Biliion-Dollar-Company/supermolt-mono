# SR-Mobile Architecture

## Executive Summary

**SR-Mobile** is a React Native mobile application for the Solana Seeker and PSG1 platforms, extending the existing DevPrint AI trading system to mobile. The app follows a "Remote Brain, Local Hands" architecture where the AI trading logic runs server-side while the mobile app handles secure transaction signing via hardware wallets.

**Target Platforms:**
- Solana Seeker (primary) - Seed Vault integration
- PlaySolana Gen1 (PSG1) - SvalGuard + controller support
- Android (Google Play) - Non-custodial companion
- iOS (App Store) - Read-only portfolio tracker

**Hackathon:** Pump.fun "Build in Public" ($250k per project, 12 projects)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXISTING INFRASTRUCTURE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────────┐        ┌──────────────────────┐          │
│   │  DevPrint Backend    │        │  SuperRouter Web     │          │
│   │  (Rust on Railway)   │◄──────►│  (Next.js)           │          │
│   │                      │        │                      │          │
│   │  • AI Trading Engine │        │  • Web Dashboard     │          │
│   │  • Position Mgmt     │        │  • Analytics         │          │
│   │  • WebSocket API     │        │  • Config UI         │          │
│   │  • REST API          │        │                      │          │
│   └──────────┬───────────┘        └──────────────────────┘          │
│              │                                                       │
└──────────────┼───────────────────────────────────────────────────────┘
               │
               │ WebSocket + REST
               │
┌──────────────▼───────────────────────────────────────────────────────┐
│                         SR-MOBILE (NEW)                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                    React Native + Expo                        │  │
│   │                                                               │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │
│   │  │   Privy     │  │   MWA       │  │   UI Layer          │   │  │
│   │  │   Auth      │  │   Client    │  │   (NativeWind)      │   │  │
│   │  │             │  │             │  │                     │   │  │
│   │  │  • Email    │  │  • Seed     │  │  • Portfolio View   │   │  │
│   │  │  • Google   │  │    Vault    │  │  • Agent Controls   │   │  │
│   │  │  • Wallet   │  │  • SvalGuard│  │  • Trade Feed       │   │  │
│   │  │  • MPC      │  │  • Phantom  │  │  • Config Panel     │   │  │
│   │  └─────────────┘  └─────────────┘  └─────────────────────┘   │  │
│   │                                                               │  │
│   │  ┌───────────────────────────────────────────────────────┐   │  │
│   │  │              State Management (Zustand)                │   │  │
│   │  │                                                        │   │  │
│   │  │  • Auth State    • Positions    • Agent Config         │   │  │
│   │  │  • WebSocket     • Real-time    • Notifications        │   │  │
│   │  └───────────────────────────────────────────────────────┘   │  │
│   │                                                               │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                   Hardware Security Layer                     │  │
│   │                                                               │  │
│   │   Seeker: Seed Vault (TEE)    PSG1: SvalGuard (TEE)          │  │
│   │   • Biometric signing          • Fingerprint signing          │  │
│   │   • Genesis Token              • Controller input             │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### "Remote Brain, Local Hands" Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                    REMOTE BRAIN (Server)                         │
│                                                                  │
│   1. AI monitors Pump.fun for new tokens                        │
│   2. AI analyzes token (liquidity, holders, momentum)           │
│   3. AI decides: BUY signal                                     │
│   4. AI constructs UNSIGNED transaction                         │
│                                                                  │
│   Output: { tx: "base64...", action: "buy", token: "PENGU" }    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Push Notification / WebSocket
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LOCAL HANDS (Mobile)                          │
│                                                                  │
│   5. App receives transaction intent                            │
│   6. App displays approval UI: "Buy 1 SOL of PENGU?"           │
│   7. User taps "Approve" (or hardware button on PSG1)          │
│   8. MWA triggers Seed Vault / SvalGuard                        │
│   9. Hardware signs transaction (biometric confirm)             │
│   10. App broadcasts signed tx to blockchain                    │
│                                                                  │
│   Security: Private keys NEVER leave hardware enclave           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Mobile App (SR-Mobile)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | React Native 0.76+ | SMS official support, TypeScript sharing |
| Build System | Expo SDK 52 (Managed) | Config plugins, polyfills, OTA updates |
| Language | TypeScript (strict) | Type safety, shared types with web |
| UI Framework | NativeWind (Tailwind) | Familiar styling, responsive design |
| Navigation | Expo Router | File-based, deep linking support |
| State | Zustand | Lightweight, works with RN, persist support |
| Auth | Privy (@privy-io/expo) | Embedded + external wallets |
| Wallet | Mobile Wallet Adapter | MWA 2.0 protocol |
| Blockchain | @solana/web3.js v1.98 | Stable, MWA compatible |

### Existing Backend (DevPrint)

| Component | Technology | Status |
|-----------|------------|--------|
| Runtime | Rust + Tokio | ✅ Production (Railway) |
| API | Axum | ✅ REST + WebSocket |
| Database | Supabase (PostgreSQL) | ✅ Production |
| Real-time | WebSocket | ✅ Broadcasting |
| Trading | Jupiter Aggregator | ✅ Integrated |
| Monitoring | Prometheus + Grafana | ✅ Production |

### External Services

| Service | Purpose | Status |
|---------|---------|--------|
| Privy | Auth + embedded wallets | 🔧 To integrate |
| Supabase | User data, session storage | ✅ Existing |
| Jupiter | Token swaps | ✅ Existing |
| Pump.fun | Token discovery | ✅ Existing |

---

## Authentication Architecture

### Dual-Path Authentication

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRIVY AUTHENTICATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   PATH A: "Tourist" (New Users)                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Email / Google / SMS Login                              │   │
│   │           ↓                                              │   │
│   │  Privy creates MPC wallet (key shards)                   │   │
│   │           ↓                                              │   │
│   │  User gets Solana address immediately                    │   │
│   │           ↓                                              │   │
│   │  Can receive tokens, view portfolio                      │   │
│   │           ↓                                              │   │
│   │  Signing: Privy MPC (2-of-2 threshold)                   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   PATH B: "Citizen" (Crypto Native)                             │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Connect External Wallet                                 │   │
│   │           ↓                                              │   │
│   │  MWA triggers wallet selection                           │   │
│   │           ↓                                              │   │
│   │  Options: Seed Vault, Phantom, Solflare, Backpack        │   │
│   │           ↓                                              │   │
│   │  Wallet returns public key                               │   │
│   │           ↓                                              │   │
│   │  Signing: Hardware wallet (TEE)                          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   UNIFIED: Both paths get same app experience                   │
│            Session stored in Zustand + AsyncStorage             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Privy Configuration

```typescript
// Detailed Privy setup for Solana + MWA
import { PrivyProvider } from '@privy-io/expo';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

export function AuthProvider({ children }) {
  return (
    <PrivyProvider
      appId={process.env.EXPO_PUBLIC_PRIVY_APP_ID}
      config={{
        appearance: {
          walletChainType: 'solana-only',
          theme: 'dark',
          logo: require('./assets/logo.png'),
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
        },
        loginMethods: ['email', 'google', 'wallet'],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

---

## Data Flow Architecture

### Real-Time Updates

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET DATA FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   DevPrint Backend (Railway)                                    │
│   │                                                              │
│   │  Events:                                                     │
│   │  • holdings_snapshot    (position updates)                  │
│   │  • price_update         (real-time prices)                  │
│   │  • take_profit_triggered (TP hit)                           │
│   │  • trade_executed       (buy/sell complete)                 │
│   │  • agent_decision       (AI reasoning)                      │
│   │                                                              │
│   └──────────────────────────────┬──────────────────────────────┘
│                                  │
│                                  │ wss://devprint-v2-production.up.railway.app
│                                  │
│                                  ▼
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              SR-Mobile WebSocket Client                   │  │
│   │                                                           │  │
│   │   const ws = new WebSocket(WS_URL);                       │  │
│   │                                                           │  │
│   │   ws.onmessage = (event) => {                             │  │
│   │     const data = JSON.parse(event.data);                  │  │
│   │                                                           │  │
│   │     switch(data.type) {                                   │  │
│   │       case 'holdings_snapshot':                           │  │
│   │         useStore.setState({ holdings: data.holdings });   │  │
│   │         break;                                            │  │
│   │       case 'take_profit_triggered':                       │  │
│   │         showNotification('TP Hit! 🎯', data.details);     │  │
│   │         Haptics.notificationAsync('success');             │  │
│   │         break;                                            │  │
│   │       case 'trade_executed':                              │  │
│   │         // Request signature if auto-trade disabled       │  │
│   │         if (!data.autoSigned) {                           │  │
│   │           requestTransactionApproval(data.tx);            │  │
│   │         }                                                 │  │
│   │         break;                                            │  │
│   │     }                                                     │  │
│   │   };                                                      │  │
│   │                                                           │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Transaction Signing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSACTION SIGNING FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. AI detects opportunity, creates intent                     │
│      │                                                           │
│      ▼                                                           │
│   2. Backend constructs unsigned transaction                    │
│      │                                                           │
│      ▼                                                           │
│   3. Push notification to mobile                                │
│      │                                                           │
│      ▼                                                           │
│   4. App displays approval UI                                   │
│      ┌───────────────────────────────────────┐                  │
│      │  🤖 AI Agent Request                  │                  │
│      │                                        │                  │
│      │  Buy 1.5 SOL of $PENGU               │                  │
│      │  Price: $0.000025                     │                  │
│      │  Slippage: 1%                         │                  │
│      │                                        │                  │
│      │  [Reject]            [Approve ✓]      │                  │
│      └───────────────────────────────────────┘                  │
│      │                                                           │
│      ▼                                                           │
│   5. User taps Approve                                          │
│      │                                                           │
│      ▼                                                           │
│   6. MWA opens Seed Vault / SvalGuard                           │
│      ┌───────────────────────────────────────┐                  │
│      │  Seed Vault                           │                  │
│      │                                        │                  │
│      │  Sign transaction?                    │                  │
│      │  Program: Jupiter V6                  │                  │
│      │  Fee: 0.000005 SOL                    │                  │
│      │                                        │                  │
│      │  [ Touch fingerprint to sign ]        │                  │
│      └───────────────────────────────────────┘                  │
│      │                                                           │
│      ▼                                                           │
│   7. Hardware signs (key never exposed)                         │
│      │                                                           │
│      ▼                                                           │
│   8. App broadcasts to Solana                                   │
│      │                                                           │
│      ▼                                                           │
│   9. Confirmation shown, position tracked                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Screen Architecture

### Navigation Structure

```
Root (Expo Router)
├── (auth)
│   ├── login.tsx          # Privy login screen
│   └── onboarding.tsx     # First-time user flow
│
├── (tabs)
│   ├── index.tsx          # Home / Portfolio Overview
│   ├── agent.tsx          # AI Agent Controls
│   ├── feed.tsx           # Trade Feed / Activity
│   └── settings.tsx       # Configuration
│
├── (modals)
│   ├── approve-tx.tsx     # Transaction approval
│   ├── position.tsx       # Position details
│   └── token.tsx          # Token info
│
└── _layout.tsx            # Root layout with providers
```

### Key Screens

#### 1. Portfolio Screen (Home)
```
┌─────────────────────────────────┐
│  🏦 Portfolio          ⚙️ 🔔  │
├─────────────────────────────────┤
│                                 │
│  Total Value                    │
│  ◉ 45.23 SOL ($4,523.00)       │
│  ↑ +12.4% today                │
│                                 │
├─────────────────────────────────┤
│  Active Positions (3)           │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 🐧 PENGU     +245%      │   │
│  │ Entry → TP1 ✓ → TP2 ○   │   │
│  │ 0.5 SOL → 1.72 SOL      │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 🌙 MOON      +45%       │   │
│  │ Entry → TP1 ○           │   │
│  │ 1.0 SOL → 1.45 SOL      │   │
│  └─────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│  [Home]  [Agent]  [Feed]  [⚙️] │
└─────────────────────────────────┘
```

#### 2. Agent Screen
```
┌─────────────────────────────────┐
│  🤖 AI Agent           Status  │
├─────────────────────────────────┤
│                                 │
│  Agent: SuperRouter v1.2.0     │
│  Status: ● Active (watching)   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  Today's Stats          │   │
│  │                         │   │
│  │  Trades: 7              │   │
│  │  Win Rate: 71%          │   │
│  │  P&L: +2.34 SOL         │   │
│  └─────────────────────────┘   │
│                                 │
│  Recent Decisions              │
│  ┌─────────────────────────┐   │
│  │ 2:34 PM - Bought PENGU  │   │
│  │ "Strong momentum..."    │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ 2:12 PM - Skipped DOGE  │   │
│  │ "Low liquidity..."      │   │
│  └─────────────────────────┘   │
│                                 │
│  [Pause Agent]   [Settings]    │
│                                 │
├─────────────────────────────────┤
│  [Home]  [Agent]  [Feed]  [⚙️] │
└─────────────────────────────────┘
```

#### 3. PSG1 Controller Layout (Landscape)
```
┌──────────────────────────────────────────────────────────────┐
│  ◀ Back                 SuperRouter                      ⚙️  │
├────────────────────────────┬─────────────────────────────────┤
│                            │                                 │
│  Agent Activity            │  Portfolio                      │
│                            │                                 │
│  ● Active                  │  Total: 45.23 SOL              │
│  Watching 234 tokens       │                                 │
│                            │  PENGU  +245%  [A] Buy More    │
│  Last Decision:            │  MOON   +45%   [B] Sell        │
│  "Bought PENGU at..."      │  WIF    -12%   [X] Details     │
│                            │                                 │
│  ┌─────────────────────┐   │  Navigation:                   │
│  │  D-Pad: Navigate    │   │  ↑↓ Select position           │
│  │  A: Confirm/Buy     │   │  A: Quick buy                 │
│  │  B: Back/Sell       │   │  B: Quick sell                │
│  │  X: Details         │   │  X: View details              │
│  │  Y: Agent menu      │   │  Y: Agent controls            │
│  └─────────────────────┘   │                                 │
│                            │                                 │
├────────────────────────────┴─────────────────────────────────┤
│  L1: Prev Tab          Controls          R1: Next Tab        │
└──────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
SR-Mobile/
├── app/                          # Expo Router screens
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── onboarding.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx            # Portfolio
│   │   ├── agent.tsx            # Agent controls
│   │   ├── feed.tsx             # Activity feed
│   │   └── settings.tsx         # Configuration
│   ├── (modals)/
│   │   ├── approve-tx.tsx
│   │   ├── position/[id].tsx
│   │   └── token/[mint].tsx
│   ├── _layout.tsx              # Root layout
│   └── +not-found.tsx
│
├── src/
│   ├── components/
│   │   ├── ui/                  # Base components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   └── ...
│   │   ├── portfolio/
│   │   │   ├── PositionCard.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── MilestoneIndicator.tsx
│   │   ├── agent/
│   │   │   ├── AgentStatus.tsx
│   │   │   ├── DecisionCard.tsx
│   │   │   └── StatsPanel.tsx
│   │   └── transaction/
│   │       ├── ApprovalSheet.tsx
│   │       └── SigningStatus.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts           # Privy auth hook
│   │   ├── useWallet.ts         # MWA wallet hook
│   │   ├── useWebSocket.ts      # Real-time connection
│   │   ├── usePositions.ts      # Portfolio data
│   │   ├── useAgent.ts          # Agent controls
│   │   └── useGamepad.ts        # PSG1 controller
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts        # HTTP client
│   │   │   ├── endpoints.ts     # API routes
│   │   │   └── types.ts         # API types
│   │   ├── wallet/
│   │   │   ├── mwa.ts           # MWA utilities
│   │   │   ├── transaction.ts   # TX building
│   │   │   └── signing.ts       # Signing flow
│   │   ├── websocket/
│   │   │   ├── client.ts        # WS connection
│   │   │   └── handlers.ts      # Event handlers
│   │   └── utils/
│   │       ├── format.ts        # Number/date formatting
│   │       └── notifications.ts # Push notifications
│   │
│   ├── store/
│   │   ├── auth.ts              # Auth state
│   │   ├── portfolio.ts         # Positions state
│   │   ├── agent.ts             # Agent state
│   │   └── settings.ts          # User preferences
│   │
│   └── types/
│       ├── api.ts               # API response types
│       ├── position.ts          # Position types
│       ├── agent.ts             # Agent types
│       └── index.ts             # Re-exports
│
├── assets/
│   ├── images/
│   └── fonts/
│
├── app.json                     # Expo config
├── babel.config.js
├── metro.config.js              # Polyfills config
├── tailwind.config.js           # NativeWind config
├── tsconfig.json
├── package.json
└── .env.example
```

---

## API Integration

### Existing Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/trading/holdings` | GET | Get all positions |
| `/api/trading/config` | GET/PUT | Trading configuration |
| `/api/trading/history` | GET | Trade history |
| `/api/versions` | GET | Agent versions |
| `/api/versions/active` | GET | Current active version |
| `/api/metrics` | GET | Performance metrics |
| `/ws` | WebSocket | Real-time updates |

### New Endpoints Needed (Mobile-Specific)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mobile/auth` | POST | Register device + wallet |
| `/api/mobile/session` | GET/POST | Session management |
| `/api/mobile/notifications` | POST | Push token registration |
| `/api/mobile/pending-txs` | GET | Unsigned transactions queue |
| `/api/mobile/sign` | POST | Submit signed transaction |

---

## Distribution Strategy

### Platform Matrix

| Platform | Version | Features | Store |
|----------|---------|----------|-------|
| Solana Seeker | Full | All features + Genesis Token gating | Solana dApp Store |
| PSG1 | Full + Controller | Landscape UI + controller support | PSG1 Play Store |
| Android | Non-custodial | Standard features | Google Play |
| iOS | Read-only | Portfolio view, alerts only | App Store |

### App Store Compliance

**Google Play:**
- Declare "Non-Custodial Wallet" in financial services
- No auto-trading without user confirmation
- Age rating: 18+ (financial content)

**Apple App Store:**
- Remove trading functionality
- Portfolio tracker only
- Push notifications for opportunities
- Link to web app for trading

**Solana dApp Store:**
- Full features enabled
- Publisher NFT required
- APK hosted on Arweave
- No restrictions on trading

---

## 4-Week Development Roadmap

### Week 1: Foundation
- [ ] Expo project setup with polyfills
- [ ] Privy integration (email + Google login)
- [ ] Basic navigation structure
- [ ] Connect to existing WebSocket
- [ ] Display portfolio (read-only)
- **BiP Milestone:** Tweet video of "First Portfolio Load"

### Week 2: Wallet Integration
- [ ] MWA integration (Seed Vault, Phantom)
- [ ] Transaction approval flow
- [ ] Signing with hardware wallet
- [ ] Position cards with milestones
- [ ] Agent status display
- **BiP Milestone:** Tweet video of "First Hardware Signed Trade"

### Week 3: Full Features
- [ ] PSG1 controller support
- [ ] Landscape layout for PSG1
- [ ] Push notifications
- [ ] Agent configuration panel
- [ ] Trade history view
- [ ] Genesis Token gating
- **BiP Milestone:** Tweet PSG1 gameplay demo

### Week 4: Polish + Launch
- [ ] iOS read-only version
- [ ] Google Play compliance review
- [ ] Solana dApp Store submission
- [ ] Performance optimization
- [ ] Bug fixes + testing
- **BiP Milestone:** Launch video + token launch

---

## Environment Variables

```bash
# Privy
EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id

# Backend
EXPO_PUBLIC_API_URL=https://devprint-v2-production.up.railway.app
EXPO_PUBLIC_WS_URL=wss://devprint-v2-production.up.railway.app/ws

# Solana
EXPO_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
EXPO_PUBLIC_NETWORK=mainnet-beta

# Features
EXPO_PUBLIC_ENABLE_TRADING=true
EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS=true
```

---

## Security Considerations

### Key Principles

1. **Keys Never Leave Hardware**
   - All signing happens in TEE (Seed Vault / SvalGuard)
   - App only handles unsigned transactions
   - Private keys never exposed to JavaScript

2. **Human-in-the-Loop**
   - Every trade requires explicit user approval
   - No "auto-sign" mode (except for advanced users opt-in)
   - Clear transaction details before signing

3. **Session Security**
   - JWT tokens stored in secure storage
   - Biometric lock for app access
   - Session timeout after inactivity

4. **Input Validation**
   - All API responses validated
   - Transaction simulation before signing
   - Slippage protection enforced

---

## Success Metrics

### Hackathon Metrics (Market Judge)
- Token price performance
- Community engagement (Twitter, Discord)
- Shipping velocity (weekly releases)
- User downloads on dApp Store

### Product Metrics
- DAU (Daily Active Users)
- Transaction volume
- Session duration
- Trade success rate via app

---

## Next Steps

1. **Initialize Expo project** with proper polyfills
2. **Set up Privy account** and get app ID
3. **Create basic screens** with mock data
4. **Integrate WebSocket** for real-time updates
5. **Build MWA signing flow** on Seeker device

---

*Document Version: 1.0*
*Created: 2026-01-23*
*Project: SR-Mobile (Pump.fun BiP Hackathon)*
