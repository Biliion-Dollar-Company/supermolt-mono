# 🚀 Import SuperMolt Dashboard & Alerts (2 Minutes)

## 📊 **Step 1: Import Dashboard (30 seconds)**

1. Go to **Grafana Cloud** → **Dashboards** (left sidebar)
2. Click **"New"** dropdown → **"Import"**
3. Click **"Upload JSON file"**
4. Select: `monitoring/grafana-dashboard.json` (this file)
5. **Data source:** Select `grafanacloud-henry6262-prom`
6. Click **"Import"**

**Done!** Your dashboard is live with 8 panels:
- Active Agents (big number)
- WebSocket Status (connected/disconnected)
- Memory Usage
- Uptime (hours)
- Request Rate (graph)
- Response Time P95 (graph)
- Error Rate (graph)
- Database Connections (graph)

---

## 🚨 **Step 2: Create Alerts (3 clicks each)**

### **Alert 1: Backend Down** 🔴

1. Go to **Alerting** → **Alert rules** → **"New alert rule"**
2. Copy-paste this:

**Rule name:** `Backend Down`

**Query A:**
```
up{job="supermolt_backend"}
```

**Condition:** Last value of A **is below** `1`

**For:** `1m`

**Folder:** Create new → `SuperMolt`  
**Group:** Create new → `Critical` (interval: 1m)

**Labels:** Add `severity` = `critical`

**Summary:** `🔴 Backend is DOWN`

**Description:**
```
SuperMolt backend unreachable for 1 minute.
Check: https://railway.app
```

Click **"Save rule and exit"**

---

### **Alert 2: High Error Rate** ⚠️

**Rule name:** `High Error Rate`

**Query A:**
```
(sum(rate(supermolt_http_errors_total[5m])) / sum(rate(supermolt_http_requests_total[5m]))) * 100
```

**Condition:** Last value of A **is above** `5`

**For:** `2m`

**Folder:** `SuperMolt`  
**Group:** `Critical`

**Labels:** `severity` = `warning`

**Summary:** `⚠️ High Error Rate (>5%)`

**Description:**
```
Backend error rate is {{ $value | printf "%.1f" }}%
Check logs: https://railway.app
```

Click **"Save rule and exit"**

---

### **Alert 3: WebSocket Disconnected** 🔌

**Rule name:** `WebSocket Disconnected`

**Query A:**
```
supermolt_websocket_connections{type="helius"}
```

**Condition:** Last value of A **is below** `1`

**For:** `3m`

**Folder:** `SuperMolt`  
**Group:** `Critical`

**Labels:** `severity` = `critical`

**Summary:** `🔌 Helius WebSocket Disconnected`

**Description:**
```
Helius WebSocket disconnected for 3 minutes.
Agent trades not being tracked!
```

Click **"Save rule and exit"**

---

## 📲 **Step 3: Connect to Slack (Optional, 2 minutes)**

1. **Alerting** → **Contact points** → **"New contact point"**
2. **Name:** `Slack Alerts`
3. **Integration:** Slack
4. **Webhook URL:** (your Slack webhook from openclaw-devs app)
   - If you don't have one: https://api.slack.com/messaging/webhooks
   - Select channel: `#supermolt-alerts`
5. Click **"Test"** (you should get a message)
6. Click **"Save"**

**Route alerts to Slack:**
1. **Notification policies** → **Edit** default policy
2. **Default contact point:** Select `Slack Alerts`
3. Click **"Update"**

---

## ✅ **You're Done!**

**What you have:**
- ✅ Live dashboard updating every 15s
- ✅ 3 critical alerts monitoring 24/7
- ✅ Slack notifications (if configured)

**View dashboard:**
- Dashboards → SuperMolt Production

**Check alerts:**
- Alerting → Alert rules → SuperMolt folder

---

## 🧪 **Test Alerts**

To verify alerts work:
1. Stop your backend temporarily: `railway service stop SR-Mobile`
2. Wait 1 minute
3. You should get "Backend Down" alert
4. Restart: `railway service start SR-Mobile`
5. Alert should resolve

---

**Total time: 5 minutes to full monitoring setup!** 🚀
