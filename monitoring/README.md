# SuperMolt Monitoring Stack

**Prometheus + Grafana + Alertmanager** with Slack notifications

---

## 🎯 What's Included

### Metrics Collected
- **HTTP:** Request duration, total requests, error rates
- **Application:** Active agents, signups, trades, Twitter verifications
- **WebSocket:** Connections (Helius, DevPrint), messages, reconnects
- **Database:** Query duration, connection pool
- **Auth:** SIWS attempts, JWT tokens issued
- **External APIs:** Calls to Helius, Birdeye, TwitterAPI.io
- **Business:** Leaderboard queries, USDC pool size, Sortino calculations

### Alerts Configured
**Critical (Slack @here ping):**
- Backend down (1min)
- High error rate >5% (2min)
- Database connection pool >80 (5min)
- WebSocket disconnected (5min)

**Warning (Slack notification):**
- Slow response time P95 >1s (10min)
- High memory >1.5GB (15min)
- Frequent WebSocket reconnects

**Info (Slack #supermolt-metrics):**
- No agent signups (1 hour)
- Epoch ending soon (<24h)

---

## 🚀 Railway Deployment (Quickest)

### Step 1: Push Backend Changes

```bash
cd SR-Mobile/backend
git push origin main
```

Backend now exposes `/metrics` endpoint ✅

### Step 2: Create Prometheus Service on Railway

```bash
cd SR-Mobile/monitoring/prometheus
railway init
railway service create prometheus
railway up
```

**Environment Variables (Railway Dashboard):**
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/HERE
```

### Step 3: Create Grafana Service on Railway

```bash
cd ../grafana
railway service create grafana
railway up
```

**Environment Variables (Railway Dashboard):**
```
GF_SECURITY_ADMIN_PASSWORD=<your-secure-password>
GF_SERVER_ROOT_URL=https://grafana-production.up.railway.app
PROMETHEUS_URL=http://prometheus.railway.internal:9090
```

### Step 4: Create Slack Channels

Create these Slack channels:
- `#supermolt-alerts` (critical + warnings)
- `#supermolt-metrics` (info notifications)

### Step 5: Get Slack Webhook URL

1. Go to https://api.slack.com/messaging/webhooks
2. Create incoming webhook
3. Select `#supermolt-alerts` channel
4. Copy webhook URL
5. Add to Railway Prometheus env vars

---

## 📊 Access Your Dashboards

After deployment:

**Prometheus:** `https://prometheus-production.up.railway.app`
**Grafana:** `https://grafana-production.up.railway.app`
**Metrics Endpoint:** `https://sr-mobile-production.up.railway.app/metrics`

---

## 🎨 Grafana Dashboard Setup

### Option A: Import Pre-Built (Recommended)

1. Login to Grafana (`admin` / `<your-password>`)
2. Go to Dashboards → Import
3. Upload `dashboards/supermolt-main.json`
4. Select "Prometheus" datasource
5. Click Import

### Option B: Build Your Own

**Key Panels to Create:**

1. **Uptime** (Stat)
   - Query: `up{job="backend"}`
   - Display: Green = 1, Red = 0

2. **Request Rate** (Graph)
   - Query: `rate(supermolt_http_requests_total[5m])`
   
3. **Response Time (P95)** (Graph)
   - Query: `histogram_quantile(0.95, rate(supermolt_http_request_duration_seconds_bucket[5m]))`

4. **Active Agents** (Stat)
   - Query: `supermolt_agents_active_total`

5. **Error Rate** (Graph)
   - Query: `rate(supermolt_http_errors_total[5m])`

6. **WebSocket Health** (Stat)
   - Query: `supermolt_websocket_connections{type="helius"}`

---

## 🚨 Testing Alerts

### Test Backend Down Alert

```bash
# Stop backend temporarily
railway service stop SR-Mobile

# Wait 1 minute → Should get Slack alert
# Restart
railway service start SR-Mobile
```

### Test High Error Rate

```bash
# Trigger 500 errors manually
for i in {1..100}; do
  curl https://sr-mobile-production.up.railway.app/nonexistent
done
```

---

## 💰 Cost Estimate

**Railway (2 services):**
- Prometheus: ~$5/month (512MB RAM, low CPU)
- Grafana: ~$5/month (512MB RAM, low CPU)

**Total: ~$10/month**

Free tier may cover this entirely depending on usage.

---

## 📋 Next Steps

1. ✅ Backend metrics endpoint deployed
2. ⏳ Deploy Prometheus to Railway
3. ⏳ Deploy Grafana to Railway
4. ⏳ Create Slack channels
5. ⏳ Configure Slack webhook
6. ⏳ Import Grafana dashboards
7. ⏳ Test alerts

---

## 🔧 Troubleshooting

### Prometheus can't scrape backend
- Check Railway internal networking
- Verify `/metrics` endpoint is public
- Check Prometheus logs: `railway logs --service prometheus`

### Grafana can't connect to Prometheus
- Verify `PROMETHEUS_URL` env var
- Try Railway internal URL: `http://prometheus.railway.internal:9090`

### Alerts not firing
- Check Alertmanager logs
- Verify `SLACK_WEBHOOK_URL` is set
- Test webhook manually: `curl -X POST -d '{"text":"test"}' $SLACK_WEBHOOK_URL`

### Metrics not updating
- Check backend logs for errors
- Verify `/metrics` endpoint returns data
- Check Prometheus targets: `http://prometheus:9090/targets`

---

## 📚 Resources

- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Docs](https://grafana.com/docs/)
- [PromQL Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Railway Internal Networking](https://docs.railway.app/guides/private-networking)

---

**Ready to deploy!** 🚀

Run through Steps 1-5 and you'll have full observability in ~30 minutes.
