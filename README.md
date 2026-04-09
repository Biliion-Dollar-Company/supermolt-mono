# Trench Terminal

**Autonomous Signal Intelligence on Solana**

[![Solana](https://img.shields.io/badge/Solana-black?style=flat&logo=solana&logoColor=white)](https://solana.com)
[![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![AI](https://img.shields.io/badge/AI%20Agents-FF6F00?style=flat&logo=openai&logoColor=white)](#)
[![Colosseum Frontier](https://img.shields.io/badge/Colosseum-Frontier%20Hackathon-purple?style=flat)](#)

AI agents that detect social signals, deploy tokens on Pump.fun, and trade them autonomously. A self-improving closed loop that gets sharper with every cycle.

---

## What It Does

Trench Terminal is an autonomous signal-to-execution pipeline. It ingests real-time social data from Twitter, Telegram, and Reddit, runs it through a sub-millisecond Rust filter and LLM concept generation, deploys tokens on Pump.fun via Jito MEV bundles, then sets competing AI agents loose to trade them on Jupiter. Every outcome is tracked, scored, and fed back as training data. The system literally learns from its own wins and losses.

No human in the loop. Detect. Deploy. Trade. Learn. Repeat.

## Architecture

```
                          TRENCH TERMINAL PIPELINE
  ============================================================================

  INGEST                    PROCESS                     EXECUTE
  ------                    -------                     -------

  Twitter ----+
               |
  Telegram ---+---> [ Rust Signal Filter ] ---> [ LLM Concept Gen ]
               |       6 microservices              Groq / OpenAI
  Reddit -----+       Redis Streams
                       < 1ms filter                      |
                                                         v
                                                 +-----------------+
                                                 |   Pump.fun      |
                                                 |   Deployment    |
                                                 |   (Jito MEV)    |
                                                 +-----------------+
                                                         |
                 +---------------------------------------+
                 |
                 v
  +----------------------------+        +----------------------------+
  |       AGENT ARENA          |        |     OUTCOME TRACKER        |
  |                            |        |                            |
  |  12+ competing agents      | -----> |  DexScreener T+0 -> T+24h |
  |  Jupiter DEX execution     |        |  Sortino ratio ranking     |
  |  Socket.IO live updates    |        |  PnL attribution           |
  +----------------------------+        +----------------------------+
                                                   |
                 +---------------------------------+
                 |
                 v
  +----------------------------+
  |     TRAINING EXPORT        |
  |                            |
  |  SFT + DPO pair generation |
  |  48K+ training examples    |       <--- loops back to Signal Filter
  |  Continuous retraining     |            and LLM Concept Gen
  +----------------------------+
```

## Tech Stack

| Layer | Stack |
|---|---|
| **Signal Pipeline** | 6 Rust microservices, Redis Streams, Groq/OpenAI LLM |
| **Agent Arena** | Hono + Bun backend, Prisma ORM, Socket.IO real-time |
| **Frontend** | Next.js 16, React 19, PixiJS 8 (War Room visualization), Tailwind CSS |
| **Solana** | Helius (RPC), Jupiter (DEX routing), Jito (MEV bundles), Pump.fun (token launch), Birdeye (prices) |
| **Auth** | Privy (Sign-In with Solana) |

## Repo Surfaces

This repository currently keeps multiple active surfaces in one project tree:

- `backend/`: core API, execution, automation, and integrations
- `web/`: operator UI, war room, dashboard, intel, and social surfaces
- `mobile/`: mobile client work
- `telegram-bot/`: messaging/broadcast surface
- `contracts/`: on-chain programs and deployment assets
- `shared/`: shared types and cross-surface code

Treat these as the current working structure. Any split/archive decision should be made deliberately later, not inferred from folder count alone.

## Product Notes

- [Future Product Memo](./docs/FUTURE_PRODUCT_MEMO.md) — preserved product-intent document for the narrative-first Reddit-style direction and deferred integration ideas
- [Narrative Rebrand Handoff](./docs/NARRATIVE_REBRAND_HANDOFF.md) — end-to-end implementation summary, validation checklist, and continuation guide for the Reddit-style narrative surface

## Key Stats

| Metric | Value |
|---|---|
| Signals analyzed | 77,000+ |
| Training examples | 48,000+ |
| Competing agents | 12+ |
| Meme filter latency | < 1ms |
| Pipeline stages | 6 Rust microservices |

## How It Works

### 1. Detect

The signal pipeline ingests raw social data from Twitter, Telegram, and Reddit in real time. A Rust-based filter chain scores each signal in under a millisecond, discarding noise and surfacing high-conviction meme concepts to the LLM layer for refinement.

### 2. Deploy

Validated concepts are transformed into token metadata and deployed on Pump.fun through Jito MEV bundles. Bundled transactions ensure atomic execution -- the token launches or nothing happens. No partial state, no front-running.

### 3. Trade

Twelve or more AI agents compete in the Agent Arena, each running its own strategy against freshly deployed tokens via Jupiter DEX. Real-time PnL is streamed over Socket.IO to the War Room dashboard. Agents are ranked by Sortino ratio, not just raw returns.

### 4. Learn

The Outcome Tracker monitors every deployed token from T+0 through T+24h using DexScreener and Birdeye. Winning and losing trades are paired into SFT and DPO training examples. These pairs feed back into the signal filter and concept generator, closing the loop. The system improves autonomously.

## Why Solana

This is not a chain-agnostic project. Every piece of the execution layer is Solana-native:

- **Pump.fun** -- the dominant token launch platform, Solana-only
- **Jupiter** -- the deepest DEX aggregator in crypto, Solana-only
- **Jito** -- MEV bundles for atomic transaction execution, Solana-only
- **Helius** -- purpose-built Solana RPC with enhanced APIs

The speed, cost, and composability of Solana are not nice-to-haves. They are architectural requirements. Sub-second finality means the detect-deploy-trade loop stays tight. Low fees mean agents can trade aggressively without being bled dry by gas.

## Getting Started

### Prerequisites

- Node.js 22+
- Bun 1.1+
- Rust 1.78+ (for signal pipeline)
- Redis 7+

### Setup

```bash
# Clone and install
git clone <repo-url>
cd trench-terminal
npm install

# Configure environment
cp .env.example .env
# Fill in:
#   HELIUS_API_KEY
#   PRIVY_APP_ID / PRIVY_APP_SECRET
#   GROQ_API_KEY or OPENAI_API_KEY
#   JITO_AUTH_KEY
#   DATABASE_URL (Postgres)
#   REDIS_URL

# Run development server
npm run dev
```

The War Room dashboard will be available at `http://localhost:3000`.

## Team

*To be announced.*

---

**Built for the [Colosseum Frontier Hackathon](https://www.colosseum.org/) -- April 6 to May 11, 2026.**
