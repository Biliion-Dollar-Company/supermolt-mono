# Devnet Migration Checklist

**Status:** 80% Complete (Code Done, Manual Steps Remaining)  
**Date:** February 5, 2026  
**Deadline:** February 8, 12 PM PST  

---

## ✅ Completed (Automated)

### Code Changes
- [x] Updated RPC endpoint to devnet (`https://api.devnet.solana.com`)
- [x] Updated USDC mint to devnet (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`)
- [x] Updated 5 files:
  - `src/routes/webhooks.ts`
  - `src/services/treasury-manager.service.ts`
  - `src/services/agent-simulator.ts`
  - `src/services/helius-websocket.ts`
  - `.env.example`
- [x] Created seed script: `scripts/seed-devnet-scanners.ts`
- [x] Created funding script: `scripts/fund-devnet-wallets.ts`
- [x] Committed + pushed to GitHub
- [x] Railway deploying automatically

---

## ⏳ Manual Steps (Required)

### 1. Fund Devnet Wallets with SOL

**Why:** Wallets need SOL for transaction fees

**Wallets to Fund (6 total):**

| Name | Public Key | Amount |
|------|------------|--------|
| Treasury | `4K4jo23HtuCvRXbjahzQNkcAiqH8bQrfaeD7goFkKKPR` | 2 SOL |
| Alpha Scanner | `FwhhaoXG67kQiAG7P2siN6HPvbyQ49E799uxcmnez5qk` | 2 SOL |
| Beta Scanner | `2aHP2HhXxiy7fMZUTx3TYjiko6ydsFZJ1ybg4FxL6A5F` | 2 SOL |
| Gamma Scanner | `EjAqcB9RL5xfcrbjcbFT8ecewf9cqxcbjnjyR3eLjFK9` | 2 SOL |
| Delta Scanner | `5hEdpKeQWZ2bFAUdb3ibsJSzZpUqpksDF3Gw1278qKPw` | 2 SOL |
| Epsilon Scanner | `7hZnE7Vu7ToNjcugDwoB4w6xu1BeTP7MKNiQNpKrUo9V` | 2 SOL |

**How to Fund:**
1. Visit: https://faucet.solana.com/
2. Select "Devnet" network
3. Paste wallet address
4. Request 2 SOL
5. Wait for confirmation (~10s)
6. Repeat for all 6 wallets

**Alternative (CLI):**
```bash
solana airdrop 2 <WALLET_ADDRESS> --url devnet
```

**Note:** Faucet has rate limits. If you hit the limit, wait 1 hour or use different IP.

---

### 2. Fund Treasury with Devnet USDC

**Why:** Treasury needs USDC to distribute rewards

**Amount:** 1000 USDC (or 100 for testing)

**How to Get Devnet USDC:**

**Option A: Circle Faucet (Recommended)**
1. Visit: https://faucet.circle.com/
2. Connect wallet: `4K4jo23HtuCvRXbjahzQNkcAiqH8bQrfaeD7goFkKKPR`
3. Select "Solana Devnet"
4. Request USDC
5. Receive 100-1000 USDC

**Option B: SPL Token CLI**
```bash
# Create USDC token account
spl-token create-account 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --owner 4K4jo23HtuCvRXbjahzQNkcAiqH8bQrfaeD7goFkKKPR \
  --url devnet

# Mint USDC (if you have mint authority)
spl-token mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU 1000 \
  --url devnet
```

---

### 3. Update Railway Environment Variables

**Why:** Production backend needs devnet configuration

**Variables to Add/Update:**

```bash
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
TREASURY_PRIVATE_KEY=0VuJy7yODLvmT6pCyuRH7amiixCWtF2B/dSNc37HSPQxM73gcxpKuzQFGmOnppzdiIVwO298eOUGBxWlq9F73A==
AGENT_ALPHA_PRIVATE_KEY=fYJ3pwQuQafVWGPWHSdC30HcbccYcm4CO18opW6br8veBv/9ZbHceFitTUKVlp7VBYLB5tk+NqLrPzWkJ3kEcw==
```

**How to Update:**
1. Go to Railway dashboard: https://railway.app/
2. Select SR-Mobile backend project
3. Go to "Variables" tab
4. Add/update the above variables
5. Trigger redeploy (or wait for automatic deployment)

---

### 4. Seed Database with Devnet Scanners

**Why:** Database needs the 5 scanner wallet addresses

**Run:**
```bash
cd SR-Mobile/backend
bun run scripts/seed-devnet-scanners.ts
```

**Expected Output:**
```
✅ Alpha Scanner: FwhhaoXG67kQiAG7P2siN6HPvbyQ49E799uxcmnez5qk
✅ Beta Scanner: 2aHP2HhXxiy7fMZUTx3TYjiko6ydsFZJ1ybg4FxL6A5F
✅ Gamma Scanner: EjAqcB9RL5xfcrbjcbFT8ecewf9cqxcbjnjyR3eLjFK9
✅ Delta Scanner: 5hEdpKeQWZ2bFAUdb3ibsJSzZpUqpksDF3Gw1278qKPw
✅ Epsilon Scanner: 7hZnE7Vu7ToNjcugDwoB4w6xu1BeTP7MKNiQNpKrUo9V
```

---

### 5. Update Helius Webhook (Devnet)

**Why:** Helius needs to listen to devnet transactions

**Steps:**
1. Go to Helius dashboard: https://dashboard.helius.xyz/
2. Navigate to "Webhooks"
3. Update webhook URL (if needed)
4. **Change network to DEVNET**
5. Add devnet wallet addresses:
   - Treasury: `4K4jo23HtuCvRXbjahzQNkcAiqH8bQrfaeD7goFkKKPR`
   - 5 Scanners (see above)
6. Save changes

---

### 6. Test Treasury Distribution (E2E)

**Why:** Verify entire flow works on devnet

**Test Steps:**

1. **Check Treasury Balance**
   ```bash
   curl https://sr-mobile-production.up.railway.app/treasury/status
   ```
   Expected: Shows devnet USDC balance

2. **Get Active Epoch**
   ```bash
   curl https://sr-mobile-production.up.railway.app/epochs/active
   ```
   Expected: Shows epoch with 5 scanners

3. **Preview Allocations**
   ```bash
   curl https://sr-mobile-production.up.railway.app/treasury/allocations/:epochId
   ```
   Expected: Shows USDC amounts for each scanner

4. **Execute Distribution**
   ```bash
   curl -X POST https://sr-mobile-production.up.railway.app/treasury/distribute/:epochId
   ```
   Expected: Returns transaction signatures

5. **Verify on Explorer**
   - Visit: https://explorer.solana.com/tx/{signature}?cluster=devnet
   - Confirm USDC transferred to scanner wallets

---

## ✅ Success Criteria

**When you know it's working:**

- [x] Railway deployed with devnet config
- [ ] Treasury has devnet USDC balance
- [ ] 5 scanners seeded in database
- [ ] Distribution sends devnet USDC to scanners
- [ ] Explorer shows devnet transactions
- [ ] Helius webhook receives devnet events

---

## 🔗 Quick Links

**Devnet Resources:**
- Solana Devnet Faucet: https://faucet.solana.com/
- Circle USDC Faucet: https://faucet.circle.com/
- Solana Explorer (Devnet): https://explorer.solana.com/?cluster=devnet
- Helius Dashboard: https://dashboard.helius.xyz/

**Wallet Addresses:**
- Treasury: `4K4jo23HtuCvRXbjahzQNkcAiqH8bQrfaeD7goFkKKPR`
- Full list: See `memory/trench-team-updates/DEVNET_WALLETS_SECURE.md`

**Backend:**
- Railway: https://sr-mobile-production.up.railway.app
- GitHub: https://github.com/Biliion-Dollar-Company/SR-Mobile

---

## ⏰ Timeline

- **Today (Feb 5):** Complete manual steps 1-6
- **Tomorrow (Feb 6):** Frontend env vars + full E2E test
- **Feb 7:** Demo video recording
- **Feb 8, 12 PM PST:** Submit to Moltbook

---

## 📞 Questions?

Ping Orion or Henry in #trench-dev on Slack.

**Status:** Ready for manual execution! 🚀
