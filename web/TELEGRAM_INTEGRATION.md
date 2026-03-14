# Telegram Integration — Agent Alpha

## What Was Wired

Three files were created to connect agent-alpha's signal output to the Supermolt Telegram channels:

| File | Purpose |
|------|---------|
| `src/integrations/telegram-broadcaster.ts` | Lightweight integration module — formats signals as HTML and POSTs to Telegram Bot API via native `fetch` (no telegraf dependency required in the web package) |
| `src/agents/agent-alpha-multi-strategy.ts` | Multi-strategy agent (EV-Kelly, Bayesian, Momentum). Calls `shareSignal()` → `recordTrade()` → `broadcastSignalToTelegram()` after each signal |
| `src/agents/agent-alpha-simple.ts` | Single-strategy EV agent. Same wiring pattern, simpler flow |

### Signal flow

```
scanMarkets() / strategy runner
        │
        ▼
  shareSignal(signal, strategy)
        │
        ├── recordTrade()          ← persists to in-memory log (extend for DB)
        │
        └── broadcastSignalToTelegram(signal, strategy)
                  │
                  ├── [BOT_TOKEN missing]   → console.warn, return
                  ├── [SIGNALS_CHANNEL_ID missing] → console.warn, return
                  └── fetch Telegram Bot API → sendMessage (HTML parse mode)
```

---

## How to Enable

Set the following environment variables in `web/.env.local` (or your deployment env):

```env
# Required
BOT_TOKEN=1234567890:ABCDefGhIJKlmNoPQRsTUVwxyZ

# Signals channel (paid subscribers)
SIGNALS_CHANNEL_ID=-1001234567890
# Or use @handle format:
# SIGNALS_CHANNEL_ID=@supermolt_signals
```

> **Tip:** Channel IDs for public Telegram channels start with `-100`. Get yours by forwarding a message from the channel to [@userinfobot](https://t.me/userinfobot) or via the Telegram API.

### Additional channels (optional — see telegram-bot/ for the full bot)

The `telegram-bot/` package exposes additional channels (`ARB_CHANNEL_ID`, `FREE_CHANNEL_ID`, `CONCIERGE_CHANNEL_ID`). These are not wired into agent-alpha by default — extend `broadcastSignalToTelegram` if needed.

---

## What Happens When Env Is Missing

- `BOT_TOKEN` not set → `console.warn('[telegram-broadcaster] BOT_TOKEN not set — skipping Telegram broadcast')`
- `SIGNALS_CHANNEL_ID` not set → `console.warn('[telegram-broadcaster] SIGNALS_CHANNEL_ID not set — skipping Telegram broadcast')`
- Telegram API returns an error → `console.error(...)`, function returns normally
- Network failure → caught, logged, never throws

The agents continue running normally in all cases. Telegram is a side-effect, not a dependency.

---

## Message Format

```
🎯 SIGNAL [ev-kelly]: Will the Fed cut rates in March 2026?

Direction: NO @ 38¢
EV Score: +9.4% edge
Kelly Size: 4.2% of bankroll ($42 on $1,000)
Confidence: 67%
Expires: Mar 19, 2026 | 9 days

Reasoning: CME FedWatch shows 72% probability of hold...

Source: Live | Posted 09:14 UTC
```

---

## Next Steps

1. Replace the `scanMarkets()` / strategy runner stubs in the agent files with real Polymarket CLOB API calls
2. Swap the in-memory `tradeLog` for Supabase / Redis persistence
3. Start the `telegram-bot/` service separately (`cd telegram-bot && npm start`) for the interactive bot commands — agent-alpha uses the Bot API directly and does not require the bot process to be running
