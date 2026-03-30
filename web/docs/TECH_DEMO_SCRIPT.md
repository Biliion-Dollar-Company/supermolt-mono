# Trench Terminal — Technical Demo Script (3 minutes)

> Target: Colosseum Frontier Hackathon, AI Track
> Format: Screen recording showing code + architecture + live system
> Length: Exactly 3 minutes

---

## [0:00 - 0:30] ARCHITECTURE OVERVIEW (30s)

**[Show: README.md architecture diagram in VS Code or terminal]**

"Let me walk you through the technical architecture of Trench Terminal.

Two systems working together. The signal pipeline — 6 Rust microservices connected via Redis Streams — handles detection and deployment. The agent arena — a Hono + Bun TypeScript backend — handles trading and competition. They communicate over WebSocket with a deployment trigger bridge.

The key design decision: Rust for the hot path. Our meme filter processes signals in under 1 millisecond. The LLM concept generator runs on Groq at 200ms average. And Jito MEV bundles give us atomic token deployment. Total signal-to-token latency: under 30 seconds."

---

## [0:30 - 1:10] SIGNAL PIPELINE DEEP DIVE (40s)

**[Show: devprint/services/ directory structure in editor]**

"The pipeline has 6 stages, each a separate Rust service:

**[Open tweet-ingest/src/main.rs — show tier polling config]**
Tweet-ingest polls Twitter with tiered intervals — KOLs every 3 seconds, degen accounts every 10. Each tweet becomes a `RawTweet` on the Redis `pipeline:tweets` stream.

**[Open ai-parser/src/parser.rs — show meme filter + LLM call]**
The AI parser runs a two-phase filter. Phase one: a Rust heuristic scorer — zero allocations, sub-millisecond. This filters 80% of noise before phase two: an LLM call to Groq that generates the token name, ticker, and narrative. Rate-limited to 20 calls per hour to control cost.

**[Open token-deployer/src/deployer.rs — show Jito bundle construction]**
When a concept passes threshold, the token deployer constructs a Jito MEV bundle — token creation plus initial buy in a single atomic transaction on Pump.fun. DRY_RUN mode is the default for safety."

---

## [1:10 - 1:50] INTEGRATION BRIDGE (40s)

**[Show: backend/src/services/devprint-feed.service.ts]**

"This is the integration bridge — the piece that connects the Rust pipeline to the TypeScript agent arena.

**[Highlight EVENT_ROUTING map — show deployments, pipeline, positions channels]**
The DevPrint feed service subscribes to the pipeline's WebSocket streams and routes events to typed channels — deployments, pipeline status, position updates. When a `token_deployed` event arrives...

**[Scroll to deployment trigger section]**
...it calls `evaluateDeploymentTrigger`. This queries all agents with active deployment triggers, runs safety checks — rate limits, cooldown, max positions, duplicate detection — and queues auto-buy requests.

**[Show: trigger-engine.ts — evaluateDeploymentTrigger function]**
Each agent's buy amount comes from their trigger config, capped by max position size. The auto-buy executor drains the queue every 5 seconds and routes through Jupiter for execution.

This is how a tweet becomes a traded token — fully autonomous, no human in the loop."

---

## [1:50 - 2:25] FRONTEND + WAR ROOM (35s)

**[Show: components/pipeline-flow/PipelineFlow.tsx]**

"The frontend uses Next.js 16 with two custom visualization systems.

**[Show the pipeline flow component code briefly — STEPS array + auto-rotate logic]**
The pipeline flow stepper auto-rotates every 5 seconds with a progress bar. Each step expands into a detail panel with live stats.

**[Show: components/pipeline-flow/LivePipelineFeed.tsx — isMounted guard + event mappers]**
The live feed connects to the WebSocket manager, maps raw events to pipeline stages, and falls back to demo mode after 10 seconds if no live connection. We handle cleanup properly — isMounted guards prevent state updates on unmounted components.

**[Navigate to War Room in browser]**
The War Room is a PixiJS 8 canvas with real-time agent positioning, token station rendering, and a new Pipeline tab that shows the live event stream alongside the visualization."

---

## [2:25 - 2:55] SOLANA STACK + DATA (30s)

**[Show: Quick montage of key integration points]**

"Every piece of Solana infrastructure is in the stack:
- Helius WebSocket for real-time migration detection and RPC
- Jupiter Lite API for DEX routing and swap execution
- Jito MEV bundles for atomic token deployment
- Pump.fun PumpPortal API for token creation
- Birdeye WebSocket for real-time price monitoring
- DexScreener for outcome tracking at T+0 through T+24h

The data speaks for itself: 77,000 signals analyzed, 48,000 SFT and DPO training pairs exported, and a pipeline that runs 24/7 with DRY_RUN safety as the default."

---

## [2:55 - 3:00] CLOSE (5s)

"Trench Terminal. Built in Rust and TypeScript. Every transaction on Solana. The loop is live."

---

## Recording Tips

- Show code in VS Code or your editor with a dark theme
- Use a large font size (16-18px) so code is readable
- When showing files, highlight the key section with your cursor — don't expect people to read the whole file
- Keep terminal commands visible but brief
- If you can, have the War Room loading in a browser tab ready to switch to
- This is the TECHNICAL demo — show code, architecture, and design decisions. The pitch video handles the "why"
