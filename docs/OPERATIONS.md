# Trench Terminal Operations

## Deployment

### Backend (Railway)

```bash
cd backend
git add . && git commit -m "deploy: ..."
git push origin main   # Railway auto-deploys from main
```

**Post-deploy checklist:**
1. Check Railway logs for startup errors
2. Hit `GET /health` -- should return `{ status: "ok" }`
3. Verify WebSocket: connect to `wss://sr-mobile-production.up.railway.app`
4. Check Helius webhook is receiving: `GET /arena/trades` should show recent activity
5. Verify Sortino cron: `GET /arena/leaderboard` should have fresh `updatedAt`

### Web (Vercel)

```bash
cd web
git push origin main   # Vercel auto-deploys
```

### Contracts (Foundry)

```bash
cd contracts
forge build
forge test
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC --broadcast --verify
```

---

## Environment Variables

### Backend

```env
# Database
DATABASE_URL=postgresql://...

# Blockchain - Solana
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
HELIUS_API_KEY=...

# Auth
JWT_SECRET=...                    # 32+ chars

# Treasury
TREASURY_PRIVATE_KEY=...          # Base64 (Solana USDC)

# Agent Keys (per-agent Solana keypairs)
AGENT_PRIVATE_KEY_{ID}=...        # Base64

# AI
GROQ_API_KEY=...                  # LLM for concept generation
ANTHROPIC_API_KEY=...             # Trade reactor

# External
BIRDEYE_API_KEY=...               # Token prices

# Signal Pipeline
TOGETHER_API_KEY=...              # LLM inference (pipeline)
DRY_RUN=true                     # Token deployer safety default
MAX_LLM_CALLS_PER_HOUR=20        # AI parser rate limit
```

### Web

```env
NEXT_PUBLIC_API_URL=https://sr-mobile-production.up.railway.app
NEXT_PUBLIC_WS_URL=wss://sr-mobile-production.up.railway.app
NEXT_PUBLIC_PRIVY_APP_ID=...
```

### Contracts

```env
SEPOLIA_RPC_URL=...
PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=...
```

---

## Monitoring

### Stack

- **Prometheus** -- metrics collection (port 9090)
- **Grafana** -- dashboards (port 3000)
- **Alertmanager** -- Slack notifications

### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total API requests |
| `http_request_duration_ms` | Histogram | Response times |
| `ws_connections_active` | Gauge | Live WebSocket connections |
| `trades_executed_total` | Counter | Trades by type |
| `trade_execution_ms` | Histogram | Trade latency |
| `treasury_balance_usdc` | Gauge | USDC treasury balance |
| `agents_active_total` | Gauge | Authenticated agents |
| `sortino_calculation_ms` | Histogram | Leaderboard calc time |
| `helius_webhook_latency_ms` | Histogram | Webhook processing time |
| `db_query_duration_ms` | Histogram | Database query time |
| `pipeline_signals_total` | Counter | Signals processed by pipeline |
| `pipeline_filter_latency_ms` | Histogram | Meme filter latency |
| `pipeline_deployments_total` | Counter | Tokens deployed via pipeline |

### Critical Alerts

| Alert | Condition | Channel |
|-------|-----------|---------|
| API Down | No successful health check for 2 min | Slack #alerts |
| High Latency | P95 > 5s for 5 min | Slack #alerts |
| WebSocket Disconnect | 0 connections for 5 min | Slack #alerts |
| Treasury Low | USDC < 100 | Slack #alerts |
| Trade Failures | > 5 failed trades in 10 min | Slack #warnings |
| DB Connection Pool | > 80% utilized | Slack #warnings |
| Pipeline Stall | No signals for 10 min | Slack #warnings |

### Setup

```bash
cd monitoring
docker-compose up -d   # Starts Prometheus + Grafana + Alertmanager
```

Grafana: `http://localhost:3000` (admin/admin)
Prometheus: `http://localhost:9090`

---

## Database

### Migrations

```bash
cd backend
bunx prisma migrate dev --name description_here   # Dev
bunx prisma migrate deploy                         # Production
bunx prisma studio                                 # GUI browser
```

### Key Queries

```sql
-- Active agents with stats
SELECT ta.id, ta."walletAddress", s."sortinoRatio", s."totalPnl"
FROM "TradingAgent" ta
JOIN "AgentStats" s ON s."agentId" = ta.id
ORDER BY s."sortinoRatio" DESC;

-- Open positions
SELECT ap."agentId", ap."tokenMint", ap.quantity, ap."entryPrice"
FROM "AgentPosition" ap
WHERE ap.quantity > 0;

-- Epoch payout status
SELECT se."epochNumber", se.status, se."usdcPool",
       COUNT(ta.id) as allocations
FROM "ScannerEpoch" se
LEFT JOIN "TreasuryAllocation" ta ON ta."epochId" = se.id
GROUP BY se.id;
```

---

## Signal Pipeline Services

### Starting the Pipeline

```bash
cd ../devprint/services

# Start Redis first
redis-server

# Start services (each in its own terminal or via process manager)
cd tweet-ingest && cargo run
cd ai-parser && cargo run
cd token-deployer && cargo run
cd api-gateway && cargo run
cd outcome-tracker && cargo run
```

### Pipeline Health Check

```bash
# Check api-gateway
curl http://localhost:4000/health

# Check Redis streams
redis-cli XLEN pipeline:tweets
redis-cli XLEN pipeline:concepts
redis-cli XLEN pipeline:deployments
```

---

## Troubleshooting

### Helius webhook not firing
1. Check webhook URL in Helius dashboard matches production URL
2. Verify monitored wallets: check `HeliusWebSocketMonitor` logs on startup
3. Test manually: send a small SOL transfer from a monitored wallet

### Sortino leaderboard stale
1. Check hourly cron logs: search for "sortino" in Railway logs
2. Manual recalc: `POST /api/admin/recalculate-sortino` (if endpoint exists)
3. Verify `AgentStats` table has recent `updatedAt`

### Trade not recording
1. Check if agent has `autoBuyEnabled: true` in config
2. Verify `triggerTypes` array includes the relevant trigger
3. Check `AgentTrade` table for the transaction signature
4. If PaperTrade missing: check FIFO close logic in webhook handler

### Treasury distribution failed
1. Check treasury wallet balance: `GET /api/treasury/status`
2. Verify epoch status is `ENDED` (not `ACTIVE` or `PAID`)
3. Check `TreasuryAllocation` table for `FAILED` status entries
4. Retry: `POST /api/treasury/distribute/:epochId`

### WebSocket disconnects
1. Check Railway memory usage (Bun can be memory-hungry with many connections)
2. Verify Socket.IO transport: should use WebSocket, not long-polling
3. Check CORS: frontend URL must be in allowed origins

### Pipeline not processing signals
1. Check Redis is running: `redis-cli ping`
2. Verify `DRY_RUN` setting in token-deployer
3. Check `MAX_LLM_CALLS_PER_HOUR` hasn't been hit
4. Review ai-parser logs for rate limit messages
5. Verify Twitter API credentials are valid
