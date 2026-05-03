# CLAUDE.md — supermolt-mono

> Read `~/Documents/Gazillion-dollars/AGENTS.md` first.

## What it is

supermolt-mono is a signal intelligence platform — Bun + Hono + Prisma backend with React
Native frontend, Solidity contracts, and integrations for Privy, Solana, Kalshi, and
@pump-fun/agent-payments-sdk. 214 backend TS files. Intelligence layer is mechanical
(not LLM-driven) so far.

## Status: DECISION PENDING

**Do not add features until this is resolved.**

- Option A: Complement to DevPrint — signal pre-processor feeding the trading bot
- Option B: Standalone DEX aggregator — independent product

Log the decision to `Obsidian-brain/final-fantasy/Decisions/log.md` before any new work.

If Option A: merge conceptual scope into DevPrint pipeline, no separate product build.
If Option B: define its own revenue tier and critical path.

## Tech stack

- Backend: Bun + Hono + Prisma (214 TS files)
- Mobile: React Native
- Contracts: Solidity
- Integrations: Privy, Solana, Kalshi, @pump-fun/agent-payments-sdk

## What NOT to do

- Don't build features before the A vs B decision is logged.
- Don't treat this as a DevPrint complement until that's an explicit decision.
- Don't start new work here while DevPrint T1 gate is open.

## Last updated

2026-05-02
