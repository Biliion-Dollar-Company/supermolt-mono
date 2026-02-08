# 🚀 Quick Start - Dynamic Wallet Monitoring

## Deploy Now (Copy-Paste)

```bash
cd ~/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/supermolt/backend
./scripts/deploy-dynamic-monitoring.sh
```

That's it. Railway auto-deploys.

---

## Test After Deploy

```bash
# 1. Get challenge
curl https://sr-mobile-production.up.railway.app/auth/agent/challenge

# 2. Register agent (use your SIWS client to sign)
# Wallet should auto-appear in Helius logs

# 3. Execute swap from that wallet

# 4. Check database for trade record
```

---

## What Changed

| Component | Change |
|-----------|--------|
| Helius WebSocket | Now tracks all agent wallets dynamically |
| SIWS Registration | Auto-adds wallet to monitoring |
| Agent Deletion | Auto-removes wallet |
| Limit | 100 wallets max (enforced) |

---

## Files Changed

- `backend/src/services/helius-websocket.ts`
- `backend/src/index.ts`
- `backend/src/routes/auth.siws.ts`
- `backend/src/services/agent.service.ts`

---

## If Something Breaks

```bash
git revert HEAD
git push origin main
```

Railway rolls back automatically.

---

## Full Docs

- `DEPLOYMENT_READY.md` - Quick overview
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `DYNAMIC_WALLET_MONITORING_IMPLEMENTATION.md` - Complete reference

---

**Status:** ✅ Ready to ship  
**Risk:** 🟢 Low (graceful failures, easy rollback)  
**Time:** ⚡ 5 minutes to deploy
