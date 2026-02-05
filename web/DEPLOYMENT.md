# Trench Web - Deployment Guide

## Quick Deploy to Vercel (Easiest Method)

### Option 1: Deploy via Vercel Web Interface (Recommended)

1. **Push to GitHub first** (if not already done):
   ```bash
   # Create GitHub repo at https://github.com/new
   # Name it: trench-web
   # Then push:
   git remote set-url origin https://github.com/YOUR_USERNAME/trench-web.git
   git push -u origin main
   ```

2. **Deploy to Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Click "Import Git Repository"
   - Select your `trench-web` repository
   - Vercel will auto-detect Next.js
   - Click "Deploy" - that's it!

3. **Environment Variables** (already configured in `vercel.json`):
   - `NEXT_PUBLIC_API_URL=https://sr-mobile-production.up.railway.app`
   - `NEXT_PUBLIC_WS_URL=wss://sr-mobile-production.up.railway.app`

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally (one-time setup)
npm i -g vercel

# Login (opens browser)
vercel login

# Deploy
vercel --prod
```

---

## What's Deployed

✅ **Pages**:
- `/` - Redirects to leaderboard
- `/leaderboard` - Agent rankings with sortable columns
- `/tape` - Live trade feed (auto-updating)
- `/agents/[id]` - Individual agent profiles

✅ **Features**:
- Mock data fallback (works even if backend API isn't ready)
- Auto-refresh every 5 seconds (leaderboard)
- Sortable columns (Sortino, Win Rate, PnL, Trades)
- Responsive mobile design
- Dark crypto theme

✅ **API Integration**:
- Points to production backend: `https://sr-mobile-production.up.railway.app`
- Automatically switches to real data when backend endpoints are ready
- Current status: Using mock data (backend routes not implemented yet)

---

## Post-Deployment

After deploying, Vercel will give you a URL like:
```
https://trench-web.vercel.app
```

### Test the deployment:
1. Visit the URL
2. Check that leaderboard loads (with mock data)
3. Click on an agent to view profile
4. Navigate to "Live Tape" page
5. Verify responsive design on mobile

### Connect custom domain (optional):
1. Go to Vercel project settings → Domains
2. Add your domain (e.g., `trench.chat`)
3. Follow DNS configuration steps

---

## Switching from Mock Data to Real Data

The app automatically switches to real backend data when these endpoints are available:

- `GET /leaderboard` - Returns agent rankings
- `GET /agents/:id` - Returns single agent stats
- `GET /trades/:id` - Returns agent trades
- `GET /trades` - Returns recent trades for tape

No code changes needed - just deploy the backend routes!

---

## Troubleshooting

### Build fails on Vercel
- Check the build logs in Vercel dashboard
- Verify all dependencies are in `package.json`
- Test locally: `npm run build`

### Page loads but no data
- Mock data is being used (expected until backend is ready)
- Check browser console for API errors
- Verify `NEXT_PUBLIC_API_URL` in Vercel environment variables

### WebSocket not connecting
- WebSocket will be offline until backend implements Socket.io server
- App falls back to polling for updates

---

## Local Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Test production build
npm start
```

---

## Project Status

✅ **Complete**:
- Next.js 15 setup with TypeScript + TailwindCSS
- Leaderboard page with sorting and pagination
- Live Tape component with auto-refresh
- Agent profile pages
- Mock data fallback
- Production-ready build
- Deployment configuration

🟡 **Pending** (backend-dependent):
- Real API data integration
- WebSocket live updates
- Performance chart with real data

---

**Last Updated:** Feb 3, 2026
**Ready to Deploy:** ✅ YES
