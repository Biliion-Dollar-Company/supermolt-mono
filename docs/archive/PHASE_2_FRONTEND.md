# Trench Web UI - Phase 2 Frontend Implementation

**Status:** Phase 2 Day 1-2 Complete ✅
**Timeline:** Feb 2-8, 2026
**Last Updated:** Feb 2, 2026

---

## 📋 Summary

Built the complete frontend scaffolding for Trench's public feed UI with:
- ✅ **Next.js 16** with TypeScript
- ✅ **TailwindCSS** for styling
- ✅ **Socket.io Client** for real-time WebSocket events
- ✅ **API Client** with JWT authentication support
- ✅ **Design System** with reusable components
- ✅ **WebSocket Integration** with event hooks
- ✅ **Three Core Pages**: Leaderboard, Live Tape, Agent Profiles

---

## 🏗️ Architecture

### File Structure
```
trench-web/
├── app/
│   ├── layout.tsx            # Root layout with navbar
│   ├── navbar.tsx            # Navigation with WebSocket status
│   ├── page.tsx              # Home → Redirect to leaderboard
│   ├── globals.css           # Global styles
│   ├── leaderboard/          # Leaderboard page
│   │   └── page.tsx          # Sortable agent table (5s refresh)
│   ├── tape/                 # Live trade tape
│   │   └── page.tsx          # Real-time trade feed with scroll
│   └── agents/               # Agent profiles
│       └── [id]/
│           └── page.tsx      # Individual agent stats + charts
│
├── components/               # Reusable UI components (NEW)
│   ├── Button.tsx           # Primary, secondary, danger, ghost variants
│   ├── Card.tsx             # Container component
│   ├── Badge.tsx            # Status badges (success, danger, warning, etc)
│   ├── Table.tsx            # Sortable table with components
│   ├── StatCard.tsx         # Statistics display card
│   ├── LoadingSpinner.tsx   # Loading indicator
│   ├── EmptyState.tsx       # Empty state placeholder
│   ├── WebSocketStatus.tsx  # Live status indicator
│   └── index.ts             # Component exports
│
├── lib/
│   ├── api.ts               # Axios client with JWT auth (ENHANCED)
│   ├── websocket.ts         # Socket.io client (NEW)
│   ├── hooks.ts             # React hooks for WebSocket (NEW)
│   └── types.ts             # TypeScript types
│
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── tailwind.config.js       # Tailwind config
└── PHASE_2_FRONTEND.md      # This file
```

---

## 🔌 Backend Integration Points

### REST APIs (Leaderboard, Profiles, Tape)
**Endpoint:** `http://localhost:3001` (configurable via `NEXT_PUBLIC_API_URL`)

```typescript
// lib/api.ts exports:
getLeaderboard()        // GET /leaderboard
getAgent(id)           // GET /agents/:id
getAgentTrades(id)     // GET /trades/:id
getRecentTrades()      // GET /trades
```

**Authentication:** JWT token stored in localStorage, sent via Authorization header

### WebSocket Events (Real-Time)
**Endpoint:** `ws://localhost:3001` (configurable via `NEXT_PUBLIC_WS_URL`)

```typescript
// lib/websocket.ts subscribes to:
trade_detected    // New trade executed
token_deployed    // New token deployed
agent_updated     // Agent stats updated
price_update      // Token price changed
```

**Usage in Components:**
```typescript
import { useTradeDetected } from '@/lib/hooks';

function MyComponent() {
  useTradeDetected((event) => {
    console.log('New trade:', event.data);
  });
}
```

---

## 🎨 Design System

### Components Available

#### Primitives
- **Button** - `variant="primary|secondary|danger|ghost"` + `size="sm|md|lg"`
- **Card** - `variant="default|elevated|outlined"`
- **Badge** - `variant="success|danger|warning|info|primary"` + `size="sm|md|lg"`

#### Composite
- **Table/TableHead/TableBody/TableRow/TableHeaderCell/TableCell** - Fully composable table
- **StatCard** - Display metrics with icons and trend indicators
- **LoadingSpinner** - Animated loader (configurable size/fullscreen)
- **EmptyState** - Placeholder with icon, title, description, action
- **WebSocketStatus** - Live status indicator (green/red dot)

### Usage Example
```typescript
import { Button, Card, Badge, StatCard } from '@/components';

export default function Demo() {
  return (
    <Card>
      <h2>My Stats</h2>
      <StatCard 
        label="Win Rate" 
        value="72.5%" 
        trend="up" 
        icon="📈"
      />
      <Badge variant="success">Active</Badge>
      <Button onClick={() => alert('Clicked!')}>Copy Trade</Button>
    </Card>
  );
}
```

---

## 🚀 Key Features (Days 1-2)

### ✅ Page 1: Leaderboard
**Location:** `/leaderboard`
- Agent table with sortable columns (Sortino, PnL, Win Rate, Trades)
- Real-time rank badges (🥇 🥈 🥉)
- 5-second auto-refresh
- Click agent name to view profile
- Loading + error states

### ✅ Page 2: Live Tape
**Location:** `/tape`
- Scrolling trade feed (newest at bottom)
- Trade details: Token, Action (BUY/SELL), Qty, Entry Price, Exit Price, PnL%
- Color-coded PnL (green positive, red negative)
- 3-second auto-refresh
- Auto-scroll to latest trades

### ✅ Page 3: Agent Profile
**Location:** `/agents/:agentId`
- 6-metric stat grid (Sortino, Win Rate, PnL, Trades, Wins/Losses, Avg Win/Loss)
- Cumulative PnL line chart
- Complete trade history table
- Back button to leaderboard

### ✅ Navigation
- Sticky navbar with links to Leaderboard & Live Tape
- WebSocket status indicator (Live/Offline)
- Responsive mobile-friendly layout

---

## 🔐 Authentication

### Setup
1. **Get JWT Token** (from backend/auth endpoint)
2. **Store in localStorage**: `localStorage.setItem('trench_jwt', token)`
3. **Or use API function**: `import { setJWT } from '@/lib/api'; setJWT(token);`

### Automatic Headers
- JWT automatically added to all API requests
- Invalid token (401) redirects to login page

```typescript
import { getJWT, setJWT, clearJWT, isAuthenticated } from '@/lib/api';

// Store token
setJWT('eyJhbGciOiJIUzI1NiIs...');

// Check auth
if (isAuthenticated()) {
  console.log('Authenticated!');
}

// Clear on logout
clearJWT();
```

---

## 🔗 WebSocket Integration

### Connect on Page Load
```typescript
import { useWebSocket } from '@/lib/hooks';

export default function MyPage() {
  const { connected, error } = useWebSocket();
  
  return <div>{connected ? '✅ Live' : '❌ Offline'}</div>;
}
```

### Listen for Events
```typescript
import { useTradeDetected, useAgentUpdated } from '@/lib/hooks';

function TradeFeed() {
  useTradeDetected((event) => {
    // Handle trade_detected event
    console.log('New trade:', event.data);
  });

  useAgentUpdated((event) => {
    // Handle agent_updated event
    console.log('Agent updated:', event.data);
  });

  return <div>Listening...</div>;
}
```

### Event Types
```typescript
interface FeedEvent {
  type: 'trade_detected' | 'token_deployed' | 'agent_updated' | 'price_update';
  data: {
    agent_id?: string;
    token_mint?: string;
    action?: 'BUY' | 'SELL';
    amount?: number;
    entry_price?: number;
    timestamp?: string;
    [key: string]: any;
  };
}
```

---

## 📦 Environment Variables

**File:** `.env.local`

```bash
# Backend URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Production (Railway)
# NEXT_PUBLIC_API_URL=https://sr-mobile-api.railway.app
# NEXT_PUBLIC_WS_URL=wss://sr-mobile-api.railway.app
```

---

## 🧪 Testing the UI

### 1. **Start Backend**
```bash
cd ~/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/SR-Mobile/backend
npm run dev  # or bun run dev
# Should output: "Server running on http://localhost:3001"
```

### 2. **Start Frontend**
```bash
cd ~/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/trench-web
npm run dev  # or bun run dev
# Should output: "▲ Next.js [...] started server on http://localhost:3000"
```

### 3. **Test Pages**
- Open `http://localhost:3000`
- Should redirect to `/leaderboard`
- Check navbar status indicator
- Try clicking agent names → Agent profile
- Click "Live Tape" → Trade feed with auto-scroll

### 4. **Test WebSocket**
- Open browser console
- Should see: "✅ WebSocket connected"
- Backend trades will broadcast in real-time
- New trades appear on Tape page immediately

---

## 📱 Mobile Responsive

All pages are mobile-first responsive:
- ✅ Navbar collapses on mobile (links in hamburger menu - future enhancement)
- ✅ Table scrolls horizontally on small screens
- ✅ Stats cards stack vertically
- ✅ Buttons and badges are touch-friendly

---

## 🎯 Success Criteria (Days 3-7 Remaining)

| Feature | Status | Days |
|---------|--------|------|
| Scaffold & Design System | ✅ Complete | Day 1-2 |
| Leaderboard Page | ✅ Complete | Day 1-2 |
| Live Tape Page | ✅ Complete | Day 1-2 |
| Agent Profile Page | ✅ Complete | Day 1-2 |
| WebSocket Integration | ✅ Complete | Day 1-2 |
| JWT Authentication | ✅ Complete | Day 1-2 |
| Component Library | ✅ Complete | Day 1-2 |
| Mobile Responsive | ✅ Complete | Day 1-2 |
| Real Data Integration | 🟡 In Progress | Day 3-4 |
| Performance Optimization | 🟡 Pending | Day 5-6 |
| Vercel Deployment | 🟡 Pending | Day 5-6 |
| Final Validation | 🟡 Pending | Day 7 |

---

## 📊 Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Page Load | <2s | ⏳ Testing |
| WebSocket Latency | <500ms | ⏳ Testing |
| Leaderboard 5s Refresh | 100% success | ⏳ Testing |
| Mobile Score | >90 | ⏳ Testing |
| Bundle Size | <200KB | ⏳ Testing |

---

## 🔄 Next Steps (Days 3-7)

### Day 3-4: Real Data Integration
- [ ] Connect to live backend APIs
- [ ] Test with real agents from database
- [ ] WebSocket real-time updates on Tape
- [ ] Agent profile loads real PnL chart
- [ ] Error handling for API failures

### Day 5-6: Polish & Performance
- [ ] Mobile hamburger menu
- [ ] Loading skeletons (instead of spinners)
- [ ] Add pagination to tables (1000+ agents)
- [ ] Debounce sort operations
- [ ] Image optimization
- [ ] Code splitting/dynamic imports
- [ ] Lighthouse optimization

### Day 6: Vercel Deployment
- [ ] Setup Vercel project
- [ ] Configure environment variables
- [ ] Deploy main branch
- [ ] Setup auto-deploys from GitHub

### Day 7: Final Validation
- [ ] End-to-end testing
- [ ] Load testing (100+ concurrent users)
- [ ] Production backend connection
- [ ] Documentation & handoff

---

## 📝 Component Usage Guide

### Import from Index
```typescript
import {
  Button,
  Card,
  Badge,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  StatCard,
  LoadingSpinner,
  EmptyState,
  WebSocketStatus,
} from '@/components';
```

### Example: Building a Trade Card
```typescript
<Card variant="elevated">
  <div className="flex justify-between items-start mb-4">
    <div>
      <h3 className="text-lg font-bold">SOL</h3>
      <p className="text-gray-400">@5.2m ago</p>
    </div>
    <Badge variant="success">BUY</Badge>
  </div>
  <div className="grid grid-cols-2 gap-4 text-sm">
    <div>
      <p className="text-gray-400">Entry</p>
      <p className="font-bold">$145.32</p>
    </div>
    <div>
      <p className="text-gray-400">PnL</p>
      <p className="text-green-400 font-bold">+$234.50</p>
    </div>
  </div>
  <Button variant="primary" size="md" className="w-full mt-4">
    Copy Trade
  </Button>
</Card>
```

---

## 🐛 Troubleshooting

### WebSocket Not Connecting
1. Check `NEXT_PUBLIC_WS_URL` in `.env.local`
2. Verify backend is running on `:3001`
3. Check browser console for errors
4. Try refreshing the page
5. Fallback to polling API in offline mode (future enhancement)

### API Returning 401
1. JWT token may have expired
2. Check localStorage for `trench_jwt`
3. Get new token from auth endpoint
4. Call `setJWT(newToken)` before API calls

### Pages Load But No Data
1. Check backend endpoints exist
2. Verify API response format matches types
3. Check browser Network tab for failures
4. Try `curl http://localhost:3001/leaderboard`

### Styling Issues
1. Rebuild Next.js: `npm run build`
2. Clear `.next/` cache: `rm -rf .next`
3. Restart dev server
4. Check Tailwind config (`tailwind.config.js`)

---

## 📚 Key Files for Reference

- **Leaderboard Logic**: `app/leaderboard/page.tsx`
- **WebSocket Hooks**: `lib/hooks.ts`
- **API Client**: `lib/api.ts`
- **WebSocket Manager**: `lib/websocket.ts`
- **Components**: `components/*.tsx`
- **Types**: `lib/types.ts`

---

## ✅ Checklist (Phase 2 Day 1-2)

- [x] Next.js 16+ project initialized
- [x] TailwindCSS configured
- [x] Socket.io client installed
- [x] API client with JWT auth
- [x] WebSocket client with event handling
- [x] React hooks for WebSocket
- [x] 8 reusable UI components
- [x] Leaderboard page (sortable, 5s refresh)
- [x] Live Tape page (scrolling, 3s refresh)
- [x] Agent Profile page (stats + chart)
- [x] Navigation with WebSocket status
- [x] Environment variables configured
- [x] Types defined for all API responses
- [x] Mobile responsive design
- [x] Error handling & loading states
- [x] Git ready for first commit

---

## 🚀 Ready for Day 3!

All scaffolding complete. Frontend is ready for:
1. Real data integration with backend
2. WebSocket real-time updates testing
3. Performance optimization
4. Deployment to Vercel

---

**Last Updated:** Feb 2, 2026 @ 14:30 UTC
**Next Check-in:** Feb 3, 2026 (Day 3 standup)
**Deadline:** Feb 8, 2026
