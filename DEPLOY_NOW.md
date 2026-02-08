# 🚀 Deploy Now - Quick Commands

**Status:** Committed and ready  
**Commit:** 31ff212 (backend + frontend changes)

---

## Step 1: Run Migration (Railway Dashboard)

```bash
# Get DATABASE_URL from Railway:
# Dashboard → SuperMolt → PostgreSQL → Connect → Copy DATABASE_URL

export DATABASE_URL='your-railway-postgres-url'

cd /Users/henry/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/supermolt/backend
bash run-migration.sh
```

**Or run SQL directly in Railway console:**

```sql
-- Add XP and Level columns
ALTER TABLE "trading_agents" ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trading_agents" ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 1;

-- Index for leaderboard
CREATE INDEX IF NOT EXISTS "trading_agents_xp_idx" ON "trading_agents"("xp");

-- Make tokenMint optional (for onboarding tasks)
ALTER TABLE "agent_tasks" ALTER COLUMN "tokenMint" DROP NOT NULL;
```

---

## Step 2: Deploy Backend

```bash
cd /Users/henry/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/supermolt/backend
git push origin main
```

Railway auto-deploys in ~2 min.

**Verify:**
```bash
curl https://sr-mobile-production.up.railway.app/health
curl https://sr-mobile-production.up.railway.app/api/arena/leaderboard/xp
```

---

## Step 3: Deploy Frontend

```bash
cd /Users/henry/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/supermolt/web
git add -A
git commit -m "feat: XP leaderboard + enhanced agent profiles

- Add XP leaderboard component with tab switcher
- Enhance agent profile page (XP bar, level badge, checklist)
- Fix SSR hydration mismatch (Zustand)
- Fix double sign-in race condition
- Add API methods for XP + profile endpoints"

git push origin main
```

Vercel auto-deploys in ~90s.

**Verify:**
```bash
curl -I https://www.supermolt.xyz
```

---

## Quick Test

After both deployed:

1. Visit https://www.supermolt.xyz
2. Go to Arena page
3. Click "XP" tab → should see leaderboard
4. Click an agent → profile page with XP bar

---

## What Was Fixed

**Critical:**
- ✅ Auth (SIWS signature verification)
- ✅ Token refresh (agentId missing)
- ✅ Stats accuracy (ACTIVITY markers)

**Medium:**
- ✅ Memory leak (nonce cleanup)
- ✅ Security (error messages)
- ✅ Validation (position tracker + webhooks)

**Features:**
- ✅ XP auto-completes (COMPLETE_RESEARCH, JOIN_CONVERSATION)
- ✅ XP leaderboard endpoint + UI
- ✅ Enhanced agent profiles

---

**Total time:** 10-15 minutes  
**Downtime:** 0 (rolling deploy)  
**Ready!** 🚀
