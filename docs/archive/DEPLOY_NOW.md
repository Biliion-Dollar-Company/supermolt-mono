# 🚀 Ready to Deploy - Quick Start

Your Trench Web dashboard is **100% complete** and ready for deployment!

## ✅ What's Done

- ✅ Next.js 15 + TypeScript + TailwindCSS configured
- ✅ Leaderboard page with sortable columns (Sortino, Win Rate, PnL, Trades)
- ✅ Live Tape component with auto-refresh (10s polling)
- ✅ Agent profile pages with stats and trade history
- ✅ Mock data fallback (works without backend)
- ✅ Production build tested and passing
- ✅ Environment configured for Railway backend
- ✅ Responsive mobile design
- ✅ Dark crypto theme applied

## 🎯 Deploy in 3 Steps

### Step 1: Create GitHub Repository

```bash
# Go to https://github.com/new
# Repository name: trench-web
# Make it public or private
# Click "Create repository"
```

### Step 2: Push Code

```bash
cd ~/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/trench-web

# Set your GitHub repo (replace YOUR_USERNAME)
git remote set-url origin https://github.com/YOUR_USERNAME/trench-web.git

# Push
git push -u origin main
```

### Step 3: Deploy to Vercel

**Option A: One-Click Deploy Button**
1. Open your GitHub repo
2. Add this to your repo's README (already there!)
3. Click the "Deploy with Vercel" button

**Option B: Import from Vercel Dashboard**
1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select `trench-web`
4. Click "Deploy" (that's it!)

**Option C: Vercel CLI**
```bash
npm i -g vercel     # Install CLI
vercel login        # Login (opens browser)
vercel --prod       # Deploy
```

## 🔧 What Happens During Deployment

Vercel will automatically:
1. Detect Next.js project
2. Install dependencies
3. Run `npm run build`
4. Deploy to global CDN
5. Give you a URL: `https://trench-web.vercel.app`

Environment variables are already configured in `vercel.json`:
- `NEXT_PUBLIC_API_URL=https://sr-mobile-production.up.railway.app`
- `NEXT_PUBLIC_WS_URL=wss://sr-mobile-production.up.railway.app`

## 📊 What You'll See

### Live Features (Mock Data):
- ✅ Leaderboard with 12 mock agents
- ✅ Sortable columns
- ✅ Agent profile pages
- ✅ Live tape with trades
- ✅ Auto-refresh every 5-10 seconds

### Auto-Upgrade (When Backend Ready):
- 🔄 Automatically switches to real data
- 🔄 WebSocket connects for live updates
- 🔄 No code changes needed!

## 🎉 After Deployment

You'll get a URL like: `https://trench-web-abc123.vercel.app`

Share it with your team! The dashboard is fully functional with mock data and will seamlessly transition to real data once the backend API endpoints are implemented.

## 🐛 Troubleshooting

**GitHub push fails?**
```bash
# Make sure you created the repo on GitHub first
# Then set the correct remote URL
git remote -v  # Check current remote
git remote set-url origin https://github.com/YOUR_USERNAME/trench-web.git
```

**Vercel deploy fails?**
- Check build logs in Vercel dashboard
- Test locally: `npm run build`
- All dependencies are in `package.json`

**Need help?**
- Check `DEPLOYMENT.md` for detailed instructions
- Vercel docs: https://vercel.com/docs
- Next.js docs: https://nextjs.org/docs

---

## 📝 Quick Reference

```bash
# Local development
npm run dev       # http://localhost:3000

# Test production build
npm run build
npm start

# Deploy
vercel --prod
```

---

**Status:** ✅ **READY TO DEPLOY**  
**Build:** ✅ **PASSING**  
**Mock Data:** ✅ **WORKING**  
**Next Step:** Push to GitHub → Deploy to Vercel → Share URL!

---

*Built: Feb 3, 2026*  
*Tech: Next.js 15, TypeScript, TailwindCSS 4*
