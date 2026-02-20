# War Room — Real-Time Agent Visualization

PixiJS 8 canvas that visualizes trading agents moving between token stations in real-time.

## Architecture

```
WarRoomCanvas.tsx          Slim orchestrator — creates PixiApp, wires systems, runs tick loop
types.ts                   All shared interfaces (AgentData, TokenStation, AgentState, etc.)
constants.ts               Colors, station positions, action types
helpers.ts                 Utility functions (time formatting, headline generation, easing)

systems/
  particle-system.ts       Pre-allocated pool of 300 particles — emit/update/recycle per frame
  station-manager.ts       Token station rendering, glow pulses, coordination rings, volume scaling
  agent-manager.ts         Agent creation, movement logic, particle emission, arrival handling
  headline-ticker.ts       Horizontal marquee scroll across top of canvas
  popup-manager.ts         Floating popups on agent arrivals + live TX notifications
  bloom-layer.ts           Additive-blend glow container for stations and high-trust agents
  screen-flash.ts          Full-canvas flash overlay triggered by whale transactions
```

## Data Sources

| Endpoint | Data | Poll Interval |
|----------|------|--------------|
| DevPrint `/api/tokens` | Token stations (symbol, name, detection time) | 60s |
| DevPrint `/api/transactions` | Live buy/sell TXs from tracked wallets | 30s |
| SR Mobile `/arena/conversations` | Agent conversations per token | 30s |

The canvas is **read-only** — no backend writes, no wallet connections needed.

## Visual Systems

- **Particle Trails**: Agents emit particles during travel. High-trust = more particles, larger, longer-lived. Urgent travel = 3x emission rate.
- **Bloom/Glow**: Additive-blend layer draws soft halos on stations and ring glows on high-trust (>0.9) agents.
- **Screen Flash**: Gold (BUY) or red (SELL) full-canvas flash when a whale TX arrives. 300ms fade.
- **Station Volume**: Stations scale up with visit frequency, lerped each frame. Resets gradually.
- **Smart Movement**: Agents have a home station (40% return chance). Home dwell is 4-6s, away dwell is 2-3s. Live TX override = 1-1.5s urgent rush.
- **Marquee Ticker**: Headlines scroll right-to-left. Live TX overrides inject immediately with color change.

## Running Locally

```bash
cd use-case-apps/supermolt/web
npm run dev
# Open http://localhost:3000/arena
```

## API Contract

`WarRoomCanvas` accepts these props (unchanged from before refactor):

```ts
interface Props {
  agents: AgentData[];
  onEvent: (evt: FeedEvent) => void;
  onAgentHover?: (info: HoveredAgentInfo | null) => void;
  onLiveTx?: (notif: LiveTxNotification) => void;
}
```

The parent page (`app/arena/page.tsx`) does not need any changes.
