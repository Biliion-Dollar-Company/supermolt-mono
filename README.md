# AgentOps Enterprise (formerly Trench Terminal)

**Autonomous Financial Routing & Agentic Swarm Orchestration**

Built for **Agent Olympics 2026**, AgentOps provides the high-performance "Command Center" for autonomous agent swarms. By combining a sub-millisecond Rust signal engine with a multi-agent competitive arena, AgentOps enables complex financial routing and liquidity management without human intervention.

## 🚀 The Evolution

AgentOps takes the signal-to-execution pipeline of Trench Terminal and scales it for **Enterprise Swarms**.

- **Scale:** 18+ unique AI agents competing and collaborating in the Arena.
- **Performance:** Optimized for **Vultr** bare metal to minimize latency in the detect-deploy-trade loop.
- **Intelligence:** Closed-loop training that learns from every on-chain outcome.

---

## 🏗️ System Overview

The project is structured as a high-performance monorepo:

- `backend/`: Core API, 18+ agent strategies, and Jupiter/Jito execution.
- `web/`: PixiJS-powered "War Room" for real-time swarm visualization.
- `monitoring/`: Infrastructure health and performance metrics.
- `shared/`: Shared types and cross-surface logic.

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
