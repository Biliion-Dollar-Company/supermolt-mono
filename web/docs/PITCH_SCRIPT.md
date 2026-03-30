# Trench Terminal — Pitch Video Script (3 minutes)

> Target: Colosseum Frontier Hackathon, AI Track
> Format: Screen recording + voiceover (or face cam + screen)
> Length: Exactly 3 minutes

---

## [0:00 - 0:25] HOOK + PROBLEM (25s)

**[Show: Landing page hero — "TRENCH TERMINAL" with the DecryptedText animation]**

"93% of the top 100 wallets on Pump.fun are bots. The memecoin market isn't human-driven anymore — it's an arms race between automated systems. But here's the problem: every bot out there does exactly one thing. Snipers snipe. Volume bots pump volume. Copy traders copy. Nobody's built the full loop.

Trench Terminal is the first self-improving autonomous trading system on Solana."

---

## [0:25 - 1:15] WHAT IT DOES — THE LOOP (50s)

**[Show: Scroll to Pipeline Flow section — DETECT → DEPLOY → TRADE → LEARN auto-rotating]**

"Here's how it works. Four stages, running continuously.

**[Click DETECT]**
Stage one: DETECT. Our Rust-powered signal pipeline monitors Twitter, Telegram, and Reddit in real-time. A sub-millisecond meme filter scores every signal before it hits the LLM. We've processed over 77,000 signals.

**[Click DEPLOY]**
Stage two: DEPLOY. When a signal scores high enough, a deployer agent launches a token on Pump.fun via Jito MEV bundles — atomically creating the token and seeding liquidity in a single transaction. Signal to deployed token: under 30 seconds.

**[Click TRADE]**
Stage three: TRADE. This is where it gets interesting. Trader agents — a separate class of AI — evaluate each newly deployed token. They analyze liquidity, holder distribution, momentum, and compete against each other in real-time, buying and selling via Jupiter. They're ranked by Sortino ratio — not just PnL, but risk-adjusted returns.

**[Click LEARN]**
Stage four: LEARN. Every outcome is tracked from T+0 to T+24 hours. The outcome tracker labels each deployment — hit, mid, flop, rug, dead. This data feeds back as SFT and DPO training pairs. 48,000 training examples and counting. The system gets smarter every cycle."

---

## [1:15 - 1:50] LIVE DEMO (35s)

**[Show: Scroll to Live Pipeline Feed — events streaming in real-time]**

"This isn't a mockup. Here's the live pipeline feed showing events as they happen — tweets detected, tokens deployed, agents trading, outcomes labeled. Each event is color-coded by stage.

**[Navigate to War Room → click Pipeline tab]**

And this is the War Room — our real-time command center. You can see agents positioned around token stations, live transactions flowing, and the Pipeline view showing the full event stream. Every trade is on-chain. Every decision is verifiable."

---

## [1:50 - 2:25] WHY IT'S DIFFERENT (35s)

**[Show: Landing page features section OR a simple slide]**

"There are 325 projects in Colosseum's AI Agent cluster. 270 in the DeFi Assistants cluster. We've researched every one of them. They all do one piece — either 'deploy agents' or 'AI helps you trade.' Nobody closes the loop.

What makes Trench Terminal different:
- We're the only system where deployer agents create supply AND trader agents create demand — a two-sided autonomous marketplace.
- The feedback loop means the system improves without human intervention.
- And the whole signal pipeline is built in Rust — not TypeScript, not Python — because when you're racing bots, every millisecond counts.

Galaxy Research called this 'agentic capital markets.' Pantera called it 'a new paradigm of autonomous economic activity.' Colosseum's own Request for Products described exactly this model. We built it."

---

## [2:25 - 2:55] TECH + TRACTION (30s)

"Quick tech overview:
- Signal pipeline: 6 Rust microservices connected via Redis Streams
- Agent arena: Hono + Bun backend with real-time WebSocket feeds
- Frontend: Next.js with a PixiJS War Room visualization
- Every Solana primitive in the stack: Helius for RPC, Jupiter for DEX, Jito for MEV bundles, Pump.fun for token launch, Birdeye for real-time prices

Traction: 77,000+ signals processed, 48,000 training examples generated, 12+ competing agents, and a sub-millisecond meme filter that discards 80% of noise before anything hits the LLM."

---

## [2:55 - 3:00] CLOSE (5s)

"Trench Terminal. Autonomous Signal Intelligence on Solana. The loop is live."

**[Show: Landing page hero with logo]**

---

## Recording Tips

- Record at 1080p or higher
- Use a clean browser with no bookmarks bar visible
- Dark mode everything
- Keep mouse movements deliberate and slow
- The pipeline flow auto-rotates — let it play through once, then click to demonstrate interactivity
- The Live Pipeline Feed will show demo events streaming in — let 3-4 accumulate before moving on
- For War Room, make sure it's loaded (takes ~5s) before switching to Pipeline tab
- Total talking time should be ~2:50 to leave 10s buffer
