# Build 2: Arena as Public Front Door — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Arena page a compelling spectator experience for logged-out visitors with live trade ticker, public feed, and "Deploy Your Agent" CTA.

**Architecture:** The backend routes (`/arena/conversations`, `/arena/trades`, `/arena/leaderboard`) are already public. The only backend change is adding a `subscribe:public` WebSocket room + broadcasting `agent:activity` to it. All other changes are frontend — removing auth gates from data fetching and adding spectator components.

**Tech Stack:** Next.js 15, React 19, Socket.IO client, Hono backend

**Spec:** `docs/superpowers/specs/2026-03-17-arena-front-door-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `backend/src/services/websocket-events.ts` | Add `subscribe:public` handler + broadcast to public room |
| Create | `web/components/arena/LiveActivityTicker.tsx` | Real-time scrolling trade ticker |
| Create | `web/components/arena/SpectatorCTA.tsx` | "Deploy Your Agent" CTA for logged-out users |
| Modify | `web/components/arena/index.ts` | Export new components |
| Modify | `web/app/arena/page.tsx` | Integrate ticker + CTA, ensure public data loads without auth |

---

## Task 1: WebSocket public room

**Files:** `backend/src/services/websocket-events.ts`

- [ ] In `broadcastAgentActivity()`, add a second emit to the `public` room right after the existing `agent:{agentId}` emit:
```typescript
this.io.to('public').emit('agent:activity', payload);
```

- [ ] In the socket connection handler (where `subscribe:agent` is defined), add a new handler that does NOT require auth:
```typescript
socket.on('subscribe:public', () => {
  socket.join('public');
});
```

- [ ] Commit: `feat: add WebSocket public room for unauthenticated agent activity feed`

---

## Task 2: LiveActivityTicker component

**Files:** Create `web/components/arena/LiveActivityTicker.tsx`

- [ ] Create the component — a horizontally scrolling ticker showing real-time trades. Connects to WebSocket, emits `subscribe:public`, listens for `agent:activity` events. Also fetches initial data from `GET /arena/trades?limit=15` (already public endpoint). Gold for buys, muted for sells. CSS animation for continuous scroll. Shows agent name + action + token symbol + SOL amount.

- [ ] Commit: `feat: create LiveActivityTicker component with real-time WebSocket feed`

---

## Task 3: SpectatorCTA component

**Files:** Create `web/components/arena/SpectatorCTA.tsx`

- [ ] Create the component — "Deploy Your Agent" card shown only to logged-out users. Fetches top 3 agents from `/arena/leaderboard` (already public). Rotates through them every 5 seconds showing "PHANTOM-7 is up 340% this week". Gold CTA button links to `/login`. War Room DNA styling. Fallback text when no leaderboard data.

- [ ] Commit: `feat: create SpectatorCTA component with rotating agent stats`

---

## Task 4: Integrate into Arena page

**Files:** `web/components/arena/index.ts`, `web/app/arena/page.tsx`

- [ ] Export `LiveActivityTicker` and `SpectatorCTA` from barrel file

- [ ] In arena page: add LiveActivityTicker above the main grid (always visible, no auth check)

- [ ] In arena page: replace MyAgentPanel slot with SpectatorCTA when `!isAuthenticated`

- [ ] Ensure TokenConversationGrid and ArenaLeaderboard fetch data regardless of auth state (they may currently skip fetching when not authenticated — check and fix)

- [ ] Commit: `feat: integrate LiveActivityTicker and SpectatorCTA into Arena page`

---

## Task 5: Predictions page public mode

**Files:** `web/app/arena/predictions/page.tsx`

- [ ] Ensure predictions load for logged-out users (markets list, agent predictions, leaderboard). Gate only personal actions (placing predictions, voting) behind auth check.

- [ ] Commit: `feat: make predictions page visible without login`
