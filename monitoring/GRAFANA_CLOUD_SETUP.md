# Grafana Cloud Setup - SuperMolt Monitoring

**Status:** ✅ Configured for Grafana Cloud (simpler than self-hosted!)

---

## 🎯 What We're Doing

Instead of running our own Prometheus + Grafana:
- **Backend:** Exposes `/metrics` endpoint ✅ (already live)
- **Grafana Alloy:** Scrapes backend, pushes to Grafana Cloud (deploying now)
- **Grafana Cloud:** Stores metrics + dashboards (you already have account)

**Benefits:**
- ✅ No Grafana maintenance (Grafana Cloud handles it)
- ✅ No Prometheus storage issues (unlimited retention on trial)
- ✅ Better UI (Grafana Cloud is latest version)
- ✅ Free for 14 days, then Free tier (generous limits)

---

## 📋 Deployment Steps

### ✅ Step 1: Backend Metrics (DONE)
Your backend is already exposing metrics at:
`https://sr-mobile-production.up.railway.app/metrics`

### ✅ Step 2: Grafana Cloud Setup (DONE)
You created:
- Grafana Cloud account
- API token for metrics push
- Remote write endpoint configured

### ⏳ Step 3: Deploy Grafana Alloy to Railway (NOW)

**What Alloy does:**
- Scrapes your backend `/metrics` every 15s
- Pushes to Grafana Cloud
- Tiny resource usage (~50MB RAM)

**Deploy command:**
```bash
cd SR-Mobile/monitoring/alloy
railway login
railway link  # Select your DEVPRINT project
railway service create alloy

# Set environment variables (Railway dashboard or CLI)
# Use the values from your Grafana Cloud configuration
railway variables set GRAFANA_CLOUD_URL="<your-grafana-cloud-url>"
railway variables set GRAFANA_CLOUD_USERNAME="<your-username>"
railway variables set GRAFANA_CLOUD_PASSWORD="<your-api-token>"

# Deploy
railway up
```

**Expected output:**
```
✓ Service created: alloy
✓ Building...
✓ Deploying...
✓ Service is live!
```

**Verify it's working:**
1. Go to Grafana Cloud dashboard
2. Navigate to "Explore"
3. Select "Prometheus" datasource
4. Query: `supermolt_agents_active_total`
5. You should see: `47` (your current agent count)

---

## 📊 Build Your First Dashboard

### Quick Dashboard (5 minutes)

1. **Go to Grafana Cloud** → Dashboards → New Dashboard

2. **Add Panel 1: Active Agents**
   - Metric: `supermolt_agents_active_total`
   - Visualization: Stat
   - Title: "Active Agents"

3. **Add Panel 2: Request Rate**
   - Metric: `rate(supermolt_http_requests_total[5m])`
   - Visualization: Graph
   - Title: "Requests per Second"

4. **Add Panel 3: Response Time (P95)**
   - Metric: `histogram_quantile(0.95, rate(supermolt_http_request_duration_seconds_bucket[5m]))`
   - Visualization: Graph
   - Title: "API Response Time (P95)"

5. **Add Panel 4: Error Rate**
   - Metric: `rate(supermolt_http_errors_total[5m])`
   - Visualization: Graph
   - Title: "5xx Errors per Second"

6. **Save Dashboard** → Name: "SuperMolt Production"

---

## 🚨 Set Up Alerts (Optional)

### Critical Alert: Backend Down

1. Go to **Alerting** → **Alert rules** → **New alert rule**
2. Name: "Backend Down"
3. Query: `up{job="supermolt_backend"} == 0`
4. Condition: Alert when `== 0`
5. For: 1 minute
6. Contact point: Create Slack contact point (add your webhook)
7. Save

### Warning Alert: Slow API

1. Name: "Slow API Response Time"
2. Query: `histogram_quantile(0.95, rate(supermolt_http_request_duration_seconds_bucket[5m])) > 1`
3. For: 5 minutes
4. Contact point: Slack
5. Save

---

## 🔍 Useful Queries

### Infrastructure
```promql
# CPU Usage
rate(supermolt_process_cpu_seconds_total[5m])

# Memory Usage (MB)
supermolt_process_resident_memory_bytes / 1024 / 1024

# Open File Descriptors
supermolt_process_open_fds
```

### Application
```promql
# Active Agents
supermolt_agents_active_total

# Agent Signups (last hour)
increase(supermolt_agents_signups_total[1h])

# Trades (last hour)
increase(supermolt_trades_total[1h])

# USDC Pool Size
supermolt_usdc_pool_size
```

### Performance
```promql
# Request Rate
rate(supermolt_http_requests_total[5m])

# P50 Response Time
histogram_quantile(0.50, rate(supermolt_http_request_duration_seconds_bucket[5m]))

# P95 Response Time
histogram_quantile(0.95, rate(supermolt_http_request_duration_seconds_bucket[5m]))

# P99 Response Time
histogram_quantile(0.99, rate(supermolt_http_request_duration_seconds_bucket[5m]))

# Error Rate (%)
(rate(supermolt_http_errors_total[5m]) / rate(supermolt_http_requests_total[5m])) * 100
```

### WebSocket Health
```promql
# Helius Connection Status
supermolt_websocket_connections{type="helius"}

# DevPrint Connection Status
supermolt_websocket_connections{type="devprint"}

# Reconnect Rate
rate(supermolt_websocket_reconnects_total[5m])
```

### Database
```promql
# Active Connections
supermolt_db_connection_pool{state="active"}

# Query Duration (P95)
histogram_quantile(0.95, rate(supermolt_db_query_duration_seconds_bucket[5m]))
```

---

## 💰 Cost

**Grafana Cloud Free Tier (after 14-day trial):**
- 10,000 series (way more than you need)
- 50GB logs per month
- 50GB traces per month
- 3 active users
- 14-day retention

**Railway (Grafana Alloy):**
- ~$2-3/month (tiny service, 50MB RAM)

**Total: ~$2-3/month** (vs $10-20 for self-hosted Prometheus + Grafana)

---

## 🎯 Next Steps

1. ✅ Backend metrics: LIVE
2. ✅ Grafana Cloud: Account created
3. ⏳ Deploy Alloy: Run deployment command above
4. ⏳ Build first dashboard: Follow quick dashboard guide
5. ⏳ Set up alerts: Add critical alerts

---

## 🔧 Troubleshooting

### Alloy not connecting to Grafana Cloud
- Check Railway logs: `railway logs --service alloy`
- Verify credentials in `config.alloy`
- Test backend metrics: `curl https://sr-mobile-production.up.railway.app/metrics`

### No data in Grafana Cloud
- Wait 30 seconds after Alloy deploys (first scrape)
- Check Alloy is running: Railway dashboard
- Query: `up{job="supermolt_backend"}` should return `1`

### Metrics stopped updating
- Check Alloy health: Railway dashboard
- Check backend uptime: `curl https://sr-mobile-production.up.railway.app/health`
- Check Grafana Cloud API token hasn't expired

---

**Ready to deploy!** Run the Railway commands above and you'll have metrics flowing to Grafana Cloud in 5 minutes. 🚀
