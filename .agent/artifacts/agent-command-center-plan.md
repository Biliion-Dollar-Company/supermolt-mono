# Agent Command Center — Implementation Plan

## Vision
A dedicated `/dashboard` page where authenticated users can see, configure, and track the AI agent created for them. The page features a React Flow visualization of all data ingestion pipelines and real-time infrastructure available to the agent.

## Architecture

### Page: `/dashboard` (Next.js App Router)
Protected route — redirects to Arena if not authenticated.

### Layout (4 Sections)

```
┌─────────────────────────────────────────────────────────┐
│  SECTION 1: Agent Identity + Status Bar                 │
│  [Avatar] [Name] [Level/XP] [Status: TRAINING/ACTIVE]   │
│  [Quick Stats: PnL, Trades, Win Rate, Sortino]          │
└─────────────────────────────────────────────────────────┘
┌───────────────────────────┬─────────────────────────────┐
│  SECTION 2: Configure     │  SECTION 3: Data Pipeline   │
│  - Agent Profile          │  React Flow Diagram         │
│  - Trading Params         │  showing all ingestion      │
│  - Risk Settings          │  endpoints & services       │
│  - Twitter Link           │  available to the agent     │
│  - Watchlist              │                             │
│  - Onboarding Progress    │                             │
├───────────────────────────┴─────────────────────────────┤
│  SECTION 4: Live Activity Feed                          │
│  Real-time agent activity, trades, analysis, tasks      │
└─────────────────────────────────────────────────────────┘
```

### React Flow Data Pipeline Nodes

```
[Helius WebSocket] ──→ [Transaction Monitor] ──→ [Position Manager]
        │                                              │
        ▼                                              ▼
[Wallet Tracker] ──→ [SuperRouter Observer] ──→ [Agent Analyzer]
                                                       │
[DevPrint Feed] ──→ [Token Stream] ────────────→ [LLM Analysis]
                 ├──→ [Tweet Stream]                    │
                 └──→ [Training Stream]                 ▼
                                               [Agent Commentary]
[Twitter API] ──→ [Mindshare Scanner] ──────→ [Narrative Engine]
                                                       │
[DexScreener] ──→ [Token Data] ─────────────────→ [Decisions]
                                                       │
[Price Fetcher] ──→ [SOL/USD Prices] ──────────→ [PnL Tracking]
                                                       │
                                               ┌───────┴───────┐
                                               ▼               ▼
                                        [Socket.IO]    [Sortino Cron]
                                        (Real-time)    (Hourly Stats)
```

### Node Categories (color-coded)
1. **Data Sources** (blue) — Helius, DevPrint, Twitter API, DexScreener
2. **Processing** (purple) — Observer, Analyzer, Position Manager
3. **Intelligence** (orange) — LLM, Narrative Engine, Mindshare
4. **Output** (green) — Socket.IO broadcasts, Agent Commentary, Trade Execution
5. **Storage** (gray) — PostgreSQL, Redis

### Backend Endpoints Needed
- `GET /arena/me` — Already exists (agent profile + stats)
- `PATCH /agent-auth/profile/update` — Already exists (update profile)
- `GET /api/system/pipeline-status` — NEW: Returns health/event counts for each pipeline node
- `GET /api/system/feeds` — NEW: Returns DevPrint feed connection status

### Files to Create
1. `web/app/dashboard/page.tsx` — Main dashboard page
2. `web/components/dashboard/AgentIdentityBar.tsx` — Top section
3. `web/components/dashboard/AgentConfigPanel.tsx` — Configuration sidebar
4. `web/components/dashboard/DataPipelineFlow.tsx` — React Flow visualization
5. `web/components/dashboard/ActivityFeed.tsx` — Live activity feed
6. `web/components/dashboard/index.ts` — Barrel exports

### Data Pipeline Node Definitions (for React Flow)
Each node shows:
- Service name + icon
- Status indicator (connected/disconnected)
- Event count (if applicable)
- Description tooltip

## Build Order
1. Create `/dashboard` page with auth gate
2. Build AgentIdentityBar (reuse existing auth store data)
3. Build DataPipelineFlow (React Flow diagram — the showcase piece)
4. Build AgentConfigPanel (profile editing + settings)
5. Build ActivityFeed (Socket.IO subscription)
6. Add `/dashboard` to navbar
7. Add backend pipeline-status endpoint
8. Wire up real-time updates
