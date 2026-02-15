# Authentication & Wallet Creation Flow

**Date:** February 12, 2026
**Status:** ✅ Multi-chain wallet creation enabled

---

## 🔐 How Users Sign Up

### Login Methods Available:

| Method | Icon | What It Gives |
|--------|------|---------------|
| **Twitter** | 🐦 | OAuth login + embedded wallets |
| **GitHub** | 🐙 | OAuth login + embedded wallets |
| **Google** | 🔍 | OAuth login + embedded wallets |
| **Email** | 📧 | Magic link + embedded wallets |
| **Wallet** | 👛 | Connect existing Phantom/MetaMask |

---

## 💼 What Gets Created Automatically

### For EVERY User (regardless of login method):

**Privy Embedded Wallets:**
1. **Solana Wallet** 🟣
   - Fully functional Solana address
   - Can receive SOL, SPL tokens
   - Used for pump.fun trading, SuperRouter tracking
   - No seed phrase needed initially (MPC-based)

2. **EVM Wallet** 🔷
   - Ethereum-compatible address (also works on BSC)
   - Can receive BNB, ERC-20 tokens
   - Used for four.meme trading, BSC agent operations
   - Same non-custodial MPC security

### User Flow Example:

```
User clicks "Sign In" button
  ↓
Selects "Continue with Twitter" (or GitHub/Google/Email)
  ↓
Privy OAuth flow (authorize app)
  ↓
Redirected back to app
  ↓
✅ Logged in + 2 wallets created automatically
  ↓
Backend receives Privy token → creates TradingAgent record
  ↓
User can now:
  - Configure agent (archetypes, tracked wallets, triggers)
  - Trade on Solana (pump.fun)
  - Trade on BSC (four.meme)
  - Track other wallets
  - Complete tasks for XP
```

---

## 🔗 Linking Additional Accounts

Users can link multiple accounts to the same Privy identity:

**Primary Login:** Twitter (@elonmusk)
- **Link GitHub:** Settings → "Link GitHub" → same agent
- **Link Google:** Settings → "Link Google" → same agent
- **Link Email:** Settings → "Link Email" → same agent

**Result:** One agent, multiple login options, same wallets.

---

## 🔑 Wallet Management

### Embedded Wallets (Default):
- **Created automatically** when user logs in
- **MPC-based** (Multi-Party Computation) - no single point of failure
- **Non-custodial** - Privy cannot access funds
- **Exportable** - Users can export private keys anytime
- **Recovery** - Can be recovered via Privy account

### External Wallets (Optional):
Users can also **connect existing wallets:**
- Phantom (Solana)
- MetaMask (EVM/BSC)
- WalletConnect
- Coinbase Wallet

**Use Case:** Power users who want to use their existing wallets instead of embedded ones.

---

## 🌐 Supported Chains

| Chain | Chain ID | Purpose |
|-------|----------|---------|
| **Solana** | 501 | pump.fun trading, SuperRouter tracking |
| **BSC Mainnet** | 56 | four.meme trading, PancakeSwap |
| **BSC Testnet** | 97 | Testing BSC integrations |

---

## 🚀 Complete User Journey

### 1. **First Time User (Human)**
```
Visit /dashboard
  ↓
Click "Sign In" button
  ↓
Choose login method (Twitter/GitHub/Google/Email/Wallet)
  ↓
Complete OAuth/Magic Link/Wallet Connect
  ↓
✅ Authenticated + 2 wallets created
  ↓
Redirected to /dashboard
  ↓
See "Configure Agent" tab
  ↓
Select archetype, add tracked wallets, set buy triggers
  ↓
Click "Save Configuration"
  ↓
Agent is now active and ready to trade!
```

### 2. **Returning User**
```
Visit /dashboard
  ↓
Privy auto-login (if session active)
  ↓
OR click "Sign In" → same login method
  ↓
Back to dashboard instantly
```

### 3. **Agent (Autonomous)**
```
Backend creates TradingAgent record
  ↓
Assigns Solana wallet (for SuperRouter observer agents)
  ↓
Trades detected via Helius webhook
  ↓
Appears on leaderboard
  ↓
No human login needed (system-created)
```

---

## 🔧 Configuration Requirements

### Privy Dashboard Setup:

**Required OAuth Apps:**
1. **Twitter OAuth 2.0**
   - Get Client ID from Twitter Developer Portal
   - Add callback URL: `https://auth.privy.io/oauth/callback`
   - Paste Client ID + Secret in Privy Dashboard

2. **GitHub OAuth**
   - Get Client ID from GitHub Developer Settings
   - Add callback URL: `https://auth.privy.io/oauth/callback`
   - Paste Client ID + Secret in Privy Dashboard

3. **Google OAuth**
   - Get Client ID from Google Cloud Console
   - Add callback URL: `https://auth.privy.io/oauth/callback`
   - Paste Client ID + Secret in Privy Dashboard

**Note:** Email login requires no additional setup (handled by Privy).

---

## 📊 Backend Integration

### What Backend Receives:

When user logs in with Privy:

```typescript
// Frontend calls backend
POST /auth/login
{
  "privyToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// Backend verifies Privy token, creates/updates TradingAgent
{
  "success": true,
  "data": {
    "jwt": "backend_jwt_token",
    "agent": {
      "id": "clx123abc",
      "name": "Agent-ABC",
      "userId": "privy_user_id",
      "walletAddress": "Solana_wallet_pubkey", // From Privy embedded wallet
      "evmAddress": "0x123...def", // From Privy EVM embedded wallet
      "chain": "SOLANA",
      "status": "ACTIVE"
    }
  }
}
```

### Wallet Assignment:
- **Solana wallet** → `TradingAgent.walletAddress` (existing field)
- **EVM wallet** → `TradingAgent.evmAddress` (added in BSC integration)
- Both wallets stored, user can trade on both chains

---

## 🎯 Key Features

✅ **Social Login** - No Web3 knowledge required
✅ **Auto-Wallet Creation** - Both Solana + EVM automatically
✅ **Multi-Chain** - Trade on Solana + BSC with one account
✅ **Link Multiple Accounts** - Twitter + GitHub + Google → same agent
✅ **Non-Custodial** - Users own their keys (can export)
✅ **MPC Security** - No single point of failure
✅ **Easy Onboarding** - No seed phrases, no wallet downloads

---

## 🔒 Security Notes

1. **Private Keys:**
   - Stored in Privy's MPC infrastructure (split across multiple parties)
   - Never stored in plaintext anywhere
   - User can export to take full custody

2. **Backend JWT:**
   - Separate from Privy token
   - Used for API authentication
   - Short-lived with refresh tokens

3. **Wallet Permissions:**
   - Embedded wallets require user approval for transactions
   - External wallets (MetaMask/Phantom) follow wallet's approval flow

---

## 🚦 Current Status

✅ Twitter OAuth configured (step-by-step guide provided earlier)
✅ GitHub OAuth enabled (needs Privy dashboard setup)
✅ Google OAuth enabled (needs Privy dashboard setup)
✅ Email login ready (no setup needed)
✅ Embedded wallets enabled (Solana + EVM)
✅ Multi-chain support configured (Solana + BSC)
✅ Backend integration complete (`/auth/login` endpoint)

**Next:** Configure GitHub + Google OAuth in Privy Dashboard (same process as Twitter)

---

## 📱 Environment Variables

**Frontend (.env.local):**
```bash
# Privy Authentication (REQUIRED)
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
```

**Backend (.env):**
```bash
# Privy Verification (if needed server-side)
PRIVY_APP_SECRET=your_privy_app_secret
```

---

**Status:** ✅ **COMPLETE - Multi-Auth + Multi-Chain Wallets Ready**
