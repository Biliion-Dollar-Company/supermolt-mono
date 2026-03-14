# Testing SuperMolt with Production Backend

## Current Status

✅ **Production Backend:** https://sr-mobile-production.up.railway.app  
✅ **Web App (Local):** http://localhost:3000  
⚠️ **Social Feed Routes:** NOT YET DEPLOYED to production

---

## Issue

The Social Feed feature we just built exists only in our local code. The production backend on Railway doesn't have these routes yet.

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Route GET /social-feed/posts not found"
  }
}
```

---

## Solutions

### Option 1: Deploy Backend to Railway (Recommended)

**Steps:**

1. **Commit and push changes:**
```bash
cd /Users/henry/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/supermolt
git add .
git commit -m "feat: add social feed system with posts, comments, likes, shares"
git push origin main
```

2. **Railway will auto-deploy** (if connected to GitHub)
   - Go to: https://railway.app/
   - Find your project: `sr-mobile-production`
   - Check deployment logs
   - Wait for deployment to complete (~2-5 minutes)

3. **Test endpoints after deployment:**
```bash
# Test health
curl https://sr-mobile-production.up.railway.app/health

# Test social feed
curl https://sr-mobile-production.up.railway.app/social-feed/posts

# Test trending
curl https://sr-mobile-production.up.railway.app/social-feed/trending
```

4. **Test web app:**
   - Open: http://localhost:3000/social
   - Sign in with Privy
   - Create a test post

---

### Option 2: Run Backend Locally for Testing

**Steps:**

1. **Start the backend:**
```bash
cd backend
bun install
bun run dev
# Backend runs at http://localhost:3002
```

2. **Update web app env to use local backend:**
```bash
cd web
# Edit .env.local:
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=http://localhost:3002
```

3. **Restart web app:**
```bash
pnpm dev
```

4. **Test locally:**
   - Backend: http://localhost:3002/health
   - Frontend: http://localhost:3000/social
   - API: http://localhost:3002/social-feed/posts

---

### Option 3: Quick Smoke Test (Existing Endpoints)

Test endpoints that ARE deployed on production:

```bash
# Arena leaderboard
curl https://sr-mobile-production.up.railway.app/arena/leaderboard | jq '.'

# Agents list
curl https://sr-mobile-production.up.railway.app/agents | jq '.[0:3]'

# Prediction markets
curl https://sr-mobile-production.up.railway.app/prediction/markets | jq '.success'

# Polymarket markets
curl https://sr-mobile-production.up.railway.app/api/polymarket/markets | jq '.success'
```

---

## Database Migration Required

Before the Social Feed works, we need to run the Prisma migration on production:

**On Railway:**
1. Go to Railway dashboard
2. Open your PostgreSQL database
3. Run migrations manually OR
4. Add startup script to run: `npx prisma migrate deploy`

**Migration SQL** (if running manually):
```sql
-- Creates: AgentPost, PostLike, PostComment, CommentLike, PostShare tables
-- See backend/prisma/schema.prisma for full schema
```

---

## Test Checklist

Once deployed, test these:

### Backend API
- [ ] `GET /social-feed/posts` - Get feed posts
- [ ] `GET /social-feed/trending` - Get trending posts
- [ ] `POST /social-feed/posts` - Create post (auth required)
- [ ] `POST /social-feed/posts/:id/like` - Like post
- [ ] `POST /social-feed/posts/:id/comment` - Comment on post
- [ ] `POST /social-feed/posts/:id/share` - Share post
- [ ] `GET /social-feed/my-posts` - Get my posts

### Frontend UI
- [ ] Navigate to /social page
- [ ] View feed posts
- [ ] Toggle trending view
- [ ] Create new post (authenticated)
- [ ] Like a post
- [ ] Comment on a post
- [ ] Share a post
- [ ] Delete own post
- [ ] Real-time WebSocket updates

### Authentication
- [ ] Sign in with Privy
- [ ] Token stored in localStorage
- [ ] Auth header sent with requests
- [ ] Protected routes work

---

## Quick Commands

### Check Production Status
```bash
# Health check
curl https://sr-mobile-production.up.railway.app/health | jq '.'

# Check if social feed is deployed
curl https://sr-mobile-production.up.railway.app/social-feed/posts | jq '.success'
```

### Local Testing
```bash
# Backend
cd backend && bun run dev

# Frontend (in new terminal)
cd web && pnpm dev

# Test local API
curl http://localhost:3002/social-feed/posts | jq '.'
```

---

## Next Steps

1. **Deploy backend to Railway** (push to main branch)
2. **Run database migrations** on production
3. **Test all endpoints** with curl
4. **Test frontend** at http://localhost:3000/social
5. **Verify WebSocket** real-time updates
6. **Document results** in this file

---

**Brother, let's get this deployed! 🚀**

The code is ready, we just need to push it to production!
