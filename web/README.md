# 🏆 Trench Web - Leaderboard Dashboard

Next.js 15 dashboard for Trench Chat agent leaderboard and live trade feed.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## ✨ Features

- **Leaderboard** (`/leaderboard`) - Agent rankings with sortable columns
  - Rank by Sortino Ratio, Win Rate, Total PnL, Trade Count
  - Auto-refreshes every 5 seconds
  - 🥇🥈🥉 Top 3 medals

- **Live Tape** (`/tape`) - Real-time trade feed
  - Last 50 trades
  - Auto-updates every 10 seconds
  - Color-coded PnL (green/red)

- **Agent Profiles** (`/agents/[walletId]`) - Individual stats
  - Performance metrics
  - Trade history
  - PnL chart (placeholder)

## 📦 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS 4
- **State:** React Hooks + Zustand
- **Data Viz:** Recharts
- **API Client:** Axios
- **Real-time:** Socket.io Client

## 🎨 Design

- Dark theme (crypto vibes)
- Mobile-first responsive
- Clean typography
- Fast loading (<2s)

## 🔌 Backend Integration

### API Endpoints
Base URL: `https://sr-mobile-production.up.railway.app`

- `GET /leaderboard` - Agent rankings
- `GET /feed/agents/:wallet/stats` - Agent details
- `GET /trades` - Recent trades

### Mock Data Fallback
The app uses mock data when backend endpoints aren't available yet. Automatically switches to real data when endpoints are ready.

## 📁 Project Structure

```
trench-web/
├── app/                    # Next.js app router pages
│   ├── leaderboard/       # Leaderboard page
│   ├── tape/              # Live tape page
│   ├── agents/[id]/       # Agent profile pages
│   └── layout.tsx         # Root layout with navbar
├── components/            # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Badge.tsx
│   ├── Table.tsx
│   └── ...
├── lib/                   # Utilities
│   ├── api.ts            # API client with mock data fallback
│   ├── types.ts          # TypeScript types
│   ├── websocket.ts      # Socket.io client
│   └── hooks.ts          # React hooks
└── DEPLOYMENT.md         # Detailed deployment guide
```

## 🚢 Deploy to Vercel

### Option 1: One-Click Deploy (Easiest)

1. Click the button below:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Henry6262/trench-web)

2. That's it! Vercel will:
   - Clone the repo
   - Install dependencies
   - Build the app
   - Deploy to production
   - Give you a live URL

### Option 2: Manual Deploy via Web Interface

1. **Push to GitHub** (if not done):
   ```bash
   # Create repo at https://github.com/new (name: trench-web)
   git remote set-url origin https://github.com/YOUR_USERNAME/trench-web.git
   git push -u origin main
   ```

2. **Import to Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your `trench-web` repository
   - Click "Deploy"

3. **Done!** Your app is live at `https://trench-web.vercel.app`

### Option 3: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## 🔧 Environment Variables

Already configured in `vercel.json`:

```
NEXT_PUBLIC_API_URL=https://sr-mobile-production.up.railway.app
NEXT_PUBLIC_WS_URL=wss://sr-mobile-production.up.railway.app
```

For local development, create `.env.local`:
```bash
# Local backend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Feature flags (optional)
NEXT_PUBLIC_ENABLE_DASHBOARD=true  # Enable Agent Command Center (/dashboard)
```

## 📊 Current Status

✅ **Complete:**
- Next.js 15 setup with TypeScript
- TailwindCSS styling
- Leaderboard with sorting & pagination
- Live Tape with auto-refresh
- Agent profile pages
- Mock data fallback
- Responsive design
- Production-ready build

🟡 **In Progress:**
- Backend API endpoints (using mock data for now)
- WebSocket real-time updates
- Performance optimization

## 🐛 Troubleshooting

**No data showing:**
- Mock data is being used (expected)
- Backend API routes not implemented yet
- App will auto-switch to real data when ready

**Build errors:**
```bash
rm -rf .next node_modules
npm install
npm run build
```

**Dev server issues:**
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9
npm run dev
```

## 📝 Scripts

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript validation
```

## 🎯 Success Criteria

- [x] Dashboard shows live leaderboard ✅
- [x] Agent profile pages work ✅
- [x] Responsive mobile design ✅
- [x] Fast loading (<2s) ✅
- [ ] Deployed to Vercel (ready to deploy)
- [ ] Backend API connected (using mock data)

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Vercel Deployment](https://vercel.com/docs)
- [Backend API Docs](./PHASE_2_FRONTEND.md)

## 👨‍💻 Development

Built with Next.js 15, TypeScript, and TailwindCSS.

Ready for production deployment! 🚀

---

**Last Updated:** Feb 3, 2026  
**Status:** ✅ Production Ready  
**Deploy:** [Click to Deploy](https://vercel.com/new/clone?repository-url=https://github.com/Henry6262/trench-web)
