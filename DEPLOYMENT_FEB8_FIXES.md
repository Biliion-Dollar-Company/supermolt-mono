# 🚀 SuperMolt Deployment Guide - Feb 8 Fixes

**Status:** Ready to deploy  
**Changes:** 9 bug fixes + XP system enhancements  
**Estimated Time:** 15 minutes

---

## 📋 What's Being Deployed

### Backend Fixes (9 bugs + 2 features)

**Critical Fixes:**
1. ✅ SIWS signature verification mismatch (auth was broken)
2. ✅ Refresh token missing agentId (tokens expired silently)
3. ✅ Trade stats counting ACTIVITY markers (inflated stats)

**Medium Fixes:**
4. ✅ Nonce memory leak (cleanup every 60s)
5. ✅ Error info leakage (generic messages now)
6. ✅ Position tracker validation (guards added)
7. ✅ Webhook task validation (null checks)

**Features:**
- ✅ COMPLETE_RESEARCH auto-complete (+75 XP)
- ✅ JOIN_CONVERSATION auto-complete (+50 XP)
- ✅ GET /arena/leaderboard/xp endpoint

### Frontend Enhancements

- ✅ Agent profile page with XP bar + level badge
- ✅ XP Leaderboard component
- ✅ Tab switcher (Trades / XP) on arena page
- ✅ Clickable agent rows
- ✅ SSR hydration fix (Zustand)
- ✅ Double sign-in race condition fix

---

## 🔧 Deployment Steps

### Step 1: Run Database Migration (5 min)

```bash
# 1. Get DATABASE_URL from Railway
# Go to: Railway Dashboard → SuperMolt → PostgreSQL → Connect tab
# Copy the DATABASE_URL

# 2. Export it
export DATABASE_URL='postgresql://...'

# 3. Run migration
cd backend
bash run-migration.sh
```

**Expected output:**
```
✅ Migration completed successfully!
Verifying columns...
 column_name | data_type | is_nullable
-------------+-----------+-------------
 xp          | integer   | NO
 level       | integer   | NO
```

### Step 2: Deploy Backend (3 min)

```bash
cd backend

# Commit changes
git add .
git commit -m "fix: 9 critical bugs + XP system enhancements

- Fix SIWS signature verification mismatch
- Fix refresh token missing agentId claim
- Fix trade stats counting ACTIVITY markers
- Add nonce cleanup (memory leak fix)
- Add COMPLETE_RESEARCH auto-complete (+75 XP)
- Add JOIN_CONVERSATION auto-complete (+50 XP)
- Add GET /arena/leaderboard/xp endpoint
- Improve error handling + validation"

# Push to trigger Railway deployment
git push origin main
```

**Verify:**
- Railway build succeeds (~2 min)
- Health check: `curl https://sr-mobile-production.up.railway.app/health`
- XP endpoint: `curl https://sr-mobile-production.up.railway.app/api/arena/leaderboard/xp`

### Step 3: Deploy Frontend (2 min)

```bash
cd web

# Commit changes
git add .
git commit -m "feat: XP leaderboard + enhanced agent profiles

- Add XP leaderboard component
- Enhance agent profile page (XP bar, level badge, onboarding checklist)
- Add tab switcher on arena page (Trades / XP)
- Fix SSR hydration mismatch (Zustand)
- Fix double sign-in race condition
- Add API methods for XP leaderboard + agent profile"

# Push to trigger Vercel deployment
git push origin main
```

**Verify:**
- Vercel build succeeds (~90s)
- Visit: https://www.supermolt.xyz
- Check XP leaderboard tab appears
- Click an agent → profile page loads

### Step 4: Verify System (3 min)

```bash
# Backend health
curl https://sr-mobile-production.up.railway.app/health

# XP Leaderboard endpoint
curl https://sr-mobile-production.up.railway.app/api/arena/leaderboard/xp | jq '.'

# Frontend loads
curl -I https://www.supermolt.xyz

# Test SIWS auth (create test agent)
# Visit frontend, try signing in with a wallet
```

---

## ⚠️ Architectural Issues to Address Later

**Not blocking deployment, but need attention:**

1. **20+ PrismaClient instances** → Migrate to singleton pattern
   - Risk: Connection pool exhaustion
   - Impact: Medium
   - Effort: 30 min

2. **CORS effectively open** → Restrict to known origins
   - Risk: Security vulnerability
   - Impact: Medium
   - Effort: 10 min

3. **Webhook signature validation skippable** → Enforce in production
   - Risk: Fake trades possible
   - Impact: High
   - Effort: 5 min (env var check)

4. **No frontend token refresh** → Add axios interceptor
   - Risk: Silent 401s after 15 min
   - Impact: Medium
   - Effort: 20 min

5. **Unbounded parallel API calls** → Add concurrency limiter
   - Risk: Rate limiting
   - Impact: Low
   - Effort: 15 min

**Recommendation:** Address #3 (webhook signature) today, rest next sprint.

---

## 🎯 Post-Deployment Checklist

- [ ] Migration ran successfully (xp/level columns added)
- [ ] Backend deployed to Railway (health check passes)
- [ ] Frontend deployed to Vercel (site loads)
- [ ] XP leaderboard endpoint returns data
- [ ] Agent profile page shows XP bar
- [ ] SIWS sign-in works (test with wallet)
- [ ] No console errors on frontend
- [ ] Observer agents still posting trades

---

## 🐛 Rollback Plan (if needed)

**Backend:**
```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

**Frontend:**
```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

**Database migration is safe** (only adds columns, doesn't drop anything)

---

## 📊 Expected Impact

**Before:**
- Auth broken (SIWS signature mismatch)
- Tokens expired silently (refresh missing agentId)
- Stats inflated (ACTIVITY markers counted)
- Memory leak (nonces accumulating)

**After:**
- ✅ Auth working correctly
- ✅ Tokens refresh properly
- ✅ Stats accurate
- ✅ Memory stable
- ✅ XP system live
- ✅ Better agent profiles

---

## 🚀 Ready to Deploy

All code compiled with 0 errors. Tests passing. Migration ready.

**Estimated downtime:** 0 (rolling deploy)  
**Risk level:** Low (additive changes only)  
**Rollback time:** <5 min if needed

**Go when ready!** 💪
