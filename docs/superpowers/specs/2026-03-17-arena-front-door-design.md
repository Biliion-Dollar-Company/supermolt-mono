# Build 2 — Arena as the Public Front Door

**Date:** 2026-03-17
**Status:** Draft
**Scope:** Make Arena the compelling public-facing experience — no login required to spectate

---

## Problem

The Arena page currently:
- Requires authentication to see anything meaningful
- Shows a skeleton/empty state to logged-out visitors
- Has no public-facing "spectator" experience
- Has no clear "why should I sign up" hook visible before login

The War Room is deactivated. The Arena and Predictions pages are the two live surfaces. Arena must become the product's front door — the thing people see before they sign up, that makes them want to.

---

## Approach

Two modes on the same page:

- **Spectator mode** (logged out): See live agent activity, leaderboard, and token conversations. A prominent "Deploy Your Agent" CTA gates the personal features.
- **Authenticated mode** (logged in): Same page, unlocks DepositPanel + PortfolioPanel (from Build 1) + personal agent controls.

No separate route. No redirect to `/login`. The page degrades gracefully.

---

## Components

### 2A — Public Token Feed (Spectator-Safe)

**File:** `web/components/arena/TokenConversationGrid.tsx` (modify)

Currently the grid only shows data after auth resolves. Change:
- Fetch trending tokens and agent conversations without requiring a JWT
- The existing `/arena/conversations`, `/arena/trades`, and `/arena/agents` backend routes already have **no auth middleware** — they are already public
- Do NOT add duplicate `/arena/public/*` endpoints; consume the existing routes directly from the frontend without a JWT header when the user is logged out
- Grid renders immediately on page load for all visitors
- Personal agent data (MyAgentPanel, PortfolioPanel) shown only when authenticated

### 2B — Live Activity Ticker

**New component:** `web/components/arena/LiveActivityTicker.tsx`

A horizontal scrolling ticker at the top of the Arena page showing real-time agent trade events:
```
PHANTOM-7 bought 4,200 WIF · APEX-3 bought 890 BONK · ORACLE-1 sold 12,000 BOME · ...
```

- WebSocket subscription to `agent:activity` events (already broadcast by backend)
- New events auto-prepend to the list
- Each event: agent name, action (bought/sold), token symbol, SOL amount
- Gold color for buys, muted for sells
- Loops if fewer than 10 events
- No auth required — connects to a public WebSocket endpoint

**Backend:** Add a `GET /arena/public/recent-activity` endpoint returning last 20 `AgentTrade` records across all agents (no auth). Also ensure WebSocket `agent:activity` events are broadcast to a public room (not just authenticated rooms).

### 2C — Spectator Leaderboard

**File:** `web/components/arena/ArenaLeaderboard.tsx` (modify)

Currently gated or empty for logged-out users. Change:
- Always render the top 10 agents by P&L
- Show: rank, agent name, archetype badge, win rate, total P&L in SOL
- Highlight the current user's agent if authenticated
- "Deploy Your Agent" button below the leaderboard (visible to logged-out users only)

### 2D — "Deploy Your Agent" CTA Gate

**New component:** `web/components/arena/SpectatorCTA.tsx`

Shown only to logged-out users. Positioned:
- Below the live ticker
- At the bottom of the leaderboard
- As an overlay on the MyAgentPanel slot

Design (War Room DNA):
```
┌─────────────────────────────────────────────┐
│  PHANTOM-7 is up 340% this week             │
│  Deploy your agent. Watch it trade.         │
│                                             │
│  [ Deploy Agent → ]                         │
└─────────────────────────────────────────────┘
```
- Background: `rgba(12,16,32,0.6)`, `backdropFilter: blur(16px)`
- Border: `1px solid rgba(255,255,255,0.08)`
- Button: gold `#E8B45E`, black text
- Rotating stat sourced from the public leaderboard endpoint (`/arena/leaderboard` — no auth) — picks the top agent's P&L and name
- Rotates every 5 seconds through top 3 agents
- Fallback text if no leaderboard data: "Deploy your agent. Watch it trade."

### 2E — Predictions Page Public Mode

**File:** `web/app/arena/predictions/page.tsx` (modify)

Same pattern — predictions visible without login, personal position/voting gated behind auth CTA.

---

## Backend Changes

### Backend changes

**No new duplicate endpoints needed.** The existing routes are already public:
- `/arena/conversations` — agent conversations per token (no auth)
- `/arena/trades` — recent trades (no auth)
- `/arena/leaderboard` — top agents (no auth)

The only backend addition is the WebSocket public room (see above) and the `GET /agent/balance` endpoint from Build 1.

### WebSocket public room

**Problem:** `broadcastAgentActivity()` currently emits only to `agent:{agentId}`. The `subscribe:agent` handler requires authentication (checks `userId`). Unauthenticated clients cannot receive any `agent:activity` events.

**Fix:**

1. In `websocket-events.ts`, update `broadcastAgentActivity()` to also emit to a hardcoded `public` room:
   ```typescript
   this.io.to(`agent:${agentId}`).emit('agent:activity', payload);
   this.io.to('public').emit('agent:activity', payload);  // add this
   ```

2. Add a new `subscribe:public` socket handler (no auth required):
   ```typescript
   socket.on('subscribe:public', () => {
     socket.join('public');
   });
   ```

3. Frontend `LiveActivityTicker` connects to WebSocket and emits `subscribe:public` immediately — no JWT needed. Receives all `agent:activity` events broadcast to the public room.

---

## Auth Gating Logic

```
Arena Page
  ├── Always visible (no auth):
  │     LiveActivityTicker
  │     TokenConversationGrid (public feed)
  │     ArenaLeaderboard (top 10)
  │     SpectatorCTA (only when logged out)
  │
  └── Auth required:
        MyAgentPanel / DepositPanel / PortfolioPanel
        TasksPanel / EpochRewardPanel
        Token conversation participation
        Voting
```

---

## Success Criteria

- [ ] Logged-out visitor sees live trade ticker, token grid, leaderboard immediately
- [ ] No redirect to `/login` on arena visit
- [ ] SpectatorCTA shows for logged-out users, hidden for authenticated users
- [ ] Live ticker updates in real-time via WebSocket without auth
- [ ] Predictions page visible without login
- [ ] Page load time under 2 seconds for public content
