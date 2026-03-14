# Supermolt Signals — Telegram Bot

> Node.js/TypeScript Telegraf bot for EV-based Polymarket signals, real-time arb alerts, and subscription tier management.

---

## Features

| Command | Description |
|---|---|
| `/start` | Welcome message + channel directory |
| `/status` | Current subscription tier (mock → wire DB) |
| `/signals` | Last 3 EV signals (mock → wire agent-alpha) |
| `/arb` | Latest arb opportunity (mock → wire scanner) |
| `/subscribe` | Payment instructions + Stripe links |

**Broadcaster functions** (for agent-alpha pipeline):
- `broadcastSignal(bot, channels, signal)` → Signals channel
- `broadcastArb(bot, channels, arb)` → Arb Pro channel
- `broadcastFreePreview(bot, channels, preview)` → Free channel
- `broadcastToConcierge(bot, channels, html)` → Concierge group

---

## Setup

### 1. Prerequisites
- Node.js ≥ 20
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- 4 Telegram channels created (free, signals, arb, concierge)
- Bot must be added as **admin** to each channel

### 2. Install

```bash
cd telegram-bot
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your BOT_TOKEN and channel IDs
```

**Getting channel IDs:**
1. Add your bot to the channel as admin
2. Forward any message from the channel to [@userinfobot](https://t.me/userinfobot)
3. The ID shown (usually `-100xxxxxxxxxx`) is your channel ID

### 4. Run in dev mode

```bash
npm run dev
```

This uses `tsx watch` — hot-reloads on file changes. No build step needed.

### 5. Build for production

```bash
npm run build
npm start
```

---

## Broadcasting Signals (from agent-alpha)

Import and call the broadcaster functions directly from your agent pipeline:

```typescript
import { Telegraf } from 'telegraf';
import { broadcastSignal, broadcastArb } from './broadcaster.js';
import type { SignalData, ArbData, ChannelConfig } from './types.js';

const bot = new Telegraf(process.env.BOT_TOKEN!);
const channels: ChannelConfig = {
  freeChannelId:     process.env.FREE_CHANNEL_ID!,
  signalsChannelId:  process.env.SIGNALS_CHANNEL_ID!,
  arbChannelId:      process.env.ARB_CHANNEL_ID!,
  conciergeChannelId: process.env.CONCIERGE_CHANNEL_ID!,
};

// Send a signal from the quant engine
await broadcastSignal(bot, channels, signal);

// Send an arb alert from the scanner
await broadcastArb(bot, channels, arb);
```

### One-shot broadcast (CLI)

```bash
npm run broadcast:signal
```

Edit `src/scripts/broadcast-signal.ts` to pull from a real data source.

---

## Wiring into agent-alpha

The bot is designed to run independently from agent-alpha. The bridge is simple:

1. **agent-alpha** produces a `SignalData` or `ArbData` object
2. It calls `broadcastSignal` / `broadcastArb` from `broadcaster.ts`
3. The broadcaster handles formatting (via `templates.ts`) and posts to the right channel

**Recommended integration pattern:**

```typescript
// In agent-alpha's signal pipeline
import { broadcastSignal } from '../telegram-bot/src/broadcaster.js';
import { bot, channels } from '../telegram-bot/src/bot.js';

const signal = await polymarketScanner.getBestSignal();
await broadcastSignal(bot, channels, signal);
```

Or spawn a standalone broadcaster process:
```bash
BOT_TOKEN=... SIGNALS_CHANNEL_ID=... node dist/scripts/broadcast-signal.js
```

---

## Subscription Gating (Future)

Currently, `/status` returns a mock `free` tier for all users.

**To wire real subscription gating:**

1. Set up Stripe webhooks → your backend
2. On successful payment, store `{ telegramId, tier, expiresAt }` in a DB (Postgres/Redis)
3. Replace `getMockTier()` in `bot.ts` with a real DB lookup
4. Add a Telegraf middleware that checks tier before forwarding to restricted channels

**Recommended stack:** Railway + Postgres + Stripe Webhooks → Telegram bot invite via `createChatInviteLink`.

---

## File Structure

```
telegram-bot/
├── src/
│   ├── bot.ts           # Main bot entry point + command handlers
│   ├── broadcaster.ts   # Channel broadcast functions
│   ├── templates.ts     # Message formatters (signal, arb, teaser, resolved)
│   ├── types.ts         # TypeScript interfaces (SignalData, ArbData, etc.)
│   ├── mock-data.ts     # Realistic sample data for dev/demo
│   ├── config.ts        # Env var loader with validation
│   └── scripts/
│       └── broadcast-signal.ts  # CLI broadcast script
├── .env.example         # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

---

## Notes

- **Geo block:** Polymarket is geo-blocked in Bulgaria. Until Railway deployment is live for data fetching, mark signals with `Source: Estimate (VPN)` or `Source: Live (Railway)`.
- **Legal:** Every channel description and pinned message should include the legal boilerplate from the launch kit: *"This channel provides educational research content only..."*
- **Founding offer:** First 20 subscribers at 50% off. Track manually in Google Sheet until automation is live.
- **Brier score:** Published publicly every Monday. See weekly report template in the launch kit.

---

*Built by Orion for Supermolt — March 2026*
