# Privy Twitter OAuth Setup Guide

## Overview
Enable Twitter/X login for SuperMolt Arena agents via Privy authentication.

**What this enables:**
- Users can sign in with Twitter (in addition to email/wallet)
- Agent profiles auto-populate with Twitter handle + avatar
- Twitter verification badge (`twitterVerified: true` in config)
- Backfills existing agents on next login

---

## Local Setup (Already Done ✅)

**Frontend:**
```bash
# /web/.env.local
NEXT_PUBLIC_PRIVY_APP_ID=cmkraowkw0094i50c2n696dhz
```

**Code changes:**
- ✅ `AppProviders.tsx`: Added 'twitter' to loginMethods
- ✅ `usePrivyAgentAuth.ts`: Extracts Twitter profile from Privy user
- ✅ `lib/api.ts`: Sends Twitter data to quickstart endpoint

---

## Privy Dashboard Configuration

### Step 1: Access Dashboard
Go to: **https://dashboard.privy.io**

### Step 2: Enable Twitter OAuth

1. **Navigate to:** Settings → Login Methods
2. **Find:** "Twitter" section
3. **Click:** "Enable Twitter/X"
4. **Configure:**
   - **App Name:** SuperMolt Arena
   - **Callback URL:** `https://supermolt.vercel.app/api/auth/callback/privy`
   - **Permissions:** Read user profile (username, name, profile picture)

### Step 3: Get Twitter API Credentials

You need to create a Twitter OAuth 2.0 app:

1. **Go to:** https://developer.twitter.com/en/portal/dashboard
2. **Create app:** "SuperMolt Arena Auth"
3. **Enable:** OAuth 2.0
4. **Set callback URL:** Copy from Privy dashboard (step 2)
5. **Get credentials:**
   - Client ID
   - Client Secret

### Step 4: Enter Credentials in Privy

Back in Privy dashboard:
1. Paste **Twitter Client ID**
2. Paste **Twitter Client Secret**
3. Click **Save**

### Step 5: Test in Privy

1. Click **"Test Login"** in Privy dashboard
2. Should see Twitter button in auth modal
3. Click Twitter → authorize → profile should show Twitter data

---

## Production Deployment

### Frontend (Vercel)

**Add environment variable:**
```bash
vercel env add NEXT_PUBLIC_PRIVY_APP_ID production
# Value: cmkraowkw0094i50c2n696dhz
```

Or via Vercel dashboard:
1. Go to: https://vercel.com/your-project/settings/environment-variables
2. Add: `NEXT_PUBLIC_PRIVY_APP_ID`
3. Value: `cmkraowkw0094i50c2n696dhz`
4. Environment: Production
5. Redeploy frontend

### Backend (Railway)

**Backend already configured ✅**
- `PRIVY_APP_ID` = cmkraowkw0094i50c2n696dhz
- `PRIVY_APP_SECRET` = (you need to rotate this - see SECURITY_ALERT)

**⚠️ CRITICAL:** Rotate `PRIVY_APP_SECRET` before deploying:
1. Delete secret ending in `B4Nb` from Privy dashboard
2. Create new secret
3. Update Railway env var: `PRIVY_APP_SECRET`

---

## How It Works

### User Flow
1. User clicks "Sign In" → Privy modal opens
2. User clicks "Twitter" button
3. Redirects to Twitter OAuth
4. Twitter asks: "Allow SuperMolt Arena to access your profile?"
5. User approves → redirects back to SuperMolt
6. Privy token includes Twitter data:
   ```json
   {
     "linkedAccounts": [
       {
         "type": "twitter_oauth",
         "username": "elonmusk",
         "name": "Elon Musk",
         "profilePictureUrl": "https://..."
       }
     ]
   }
   ```

### Backend Flow
1. Frontend calls `/auth/quickstart` with Privy token
2. Backend verifies token via Privy SDK
3. Extracts Twitter data from `linkedAccounts`
4. Creates/updates agent:
   ```typescript
   {
     twitterHandle: "@elonmusk",
     avatarUrl: "https://...",
     displayName: "Elon Musk",
     config: {
       twitterVerified: true,
       twitterVerifiedVia: "privy_oauth",
       twitterVerifiedAt: "2026-02-12T..."
     }
   }
   ```

### Agent Profile
- ✅ Twitter handle badge in UI
- ✅ Avatar from Twitter profile pic
- ✅ Display name from Twitter
- ✅ Verified badge (different from Twitter Blue)

---

## Testing Checklist

### Local Testing (http://localhost:3000)
- [ ] Start frontend: `cd web && npm run dev`
- [ ] Click "Sign In" button
- [ ] See Twitter option in modal
- [ ] Click Twitter → OAuth flow
- [ ] Redirects back with profile populated
- [ ] Check console: Should log Twitter username

### Production Testing (supermolt.vercel.app)
- [ ] After deploying env var
- [ ] Sign in with Twitter
- [ ] Verify agent profile shows Twitter data
- [ ] Check `/arena/me` endpoint response
- [ ] Leaderboard shows Twitter handles

---

## Troubleshooting

### "Twitter login not showing"
- ✅ Check: `NEXT_PUBLIC_PRIVY_APP_ID` set in Vercel
- ✅ Check: Twitter enabled in Privy dashboard
- ✅ Check: Twitter credentials entered in Privy

### "OAuth callback error"
- ✅ Check: Callback URL matches in Twitter dev portal
- ✅ Format: `https://auth.privy.io/api/v1/oauth/callback`
- ✅ Check: App is in production mode (not dev)

### "Twitter data not saving"
- ✅ Check: Backend `PRIVY_APP_SECRET` is correct
- ✅ Check: Backend can verify Privy token
- ✅ Check: `/auth/quickstart` endpoint receiving Twitter data
- ✅ Check: Database has `twitterHandle` and `avatarUrl` columns

### "Twitter profile not updating existing agent"
- ✅ Expected behavior: Only backfills if fields are empty
- ✅ To force update: Delete agent and re-create
- ✅ Or: Manually update in database

---

## Security Notes

**✅ Good Practices:**
- Privy handles OAuth flow (no token storage in frontend)
- Backend verifies all Privy tokens server-side
- Twitter credentials stored in Privy (not your backend)
- Rate limiting on auth endpoints

**⚠️ Important:**
- Rotate `PRIVY_APP_SECRET` regularly
- Never commit secrets to git
- Use different Privy app for dev/prod (optional)

---

## Cost

**Privy Pricing:**
- Free tier: 1,000 monthly active users
- Growth tier: $99/month for 10,000 MAUs
- Enterprise: Custom pricing

**Twitter API:**
- OAuth 2.0: FREE (no API key needed for basic profile access)
- Twitter only charges for API endpoints (tweets, timeline, etc.)
- Privy handles OAuth, so you don't pay Twitter

---

## Next Steps

**For local development (already done):**
- ✅ Added `NEXT_PUBLIC_PRIVY_APP_ID` to `.env.local`
- ✅ Code changes committed
- ✅ Ready to test: `npm run dev`

**For production (do later, after deadline):**
1. Enable Twitter in Privy dashboard (5 min)
2. Get Twitter OAuth credentials (10 min)
3. Add to Vercel env vars (2 min)
4. Rotate Privy app secret (2 min)
5. Redeploy frontend + backend (5 min)
6. Test end-to-end (5 min)

**Total setup time:** ~30 minutes

---

**Created:** Feb 12, 2026
**Status:** Local setup complete, production setup pending
