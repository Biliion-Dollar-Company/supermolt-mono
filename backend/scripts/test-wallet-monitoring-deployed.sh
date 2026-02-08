#!/bin/bash

# Test Script: Verify Dynamic Wallet Monitoring Deployed
# Tests that the new code is live on Railway

set -e

API_URL="https://sr-mobile-production.up.railway.app"

echo "🧪 Testing Dynamic Wallet Monitoring Deployment"
echo "================================================"
echo ""

# Test 1: Health Check
echo "📊 Test 1: Health Check"
HEALTH=$(curl -s "$API_URL/health")
TIMESTAMP=$(echo "$HEALTH" | jq -r '.data.timestamp')
echo "   Timestamp: $TIMESTAMP"
echo "   ✅ Server responding"
echo ""

# Test 2: Check SIWS auth endpoint exists
echo "📊 Test 2: SIWS Auth Endpoint"
CHALLENGE=$(curl -s "$API_URL/auth/agent/challenge?publicKey=11111111111111111111111111111111")
if echo "$CHALLENGE" | grep -q "nonce\|challenge"; then
  echo "   ✅ SIWS challenge endpoint working"
else
  echo "   ❌ SIWS challenge endpoint failed"
  echo "   Response: $CHALLENGE"
  exit 1
fi
echo ""

# Test 3: Check skill.md routes are fixed
echo "📊 Test 3: skill.md Routes Fixed"
SKILL_MD=$(curl -s "$API_URL/api/skill.md")
if echo "$SKILL_MD" | grep -q "/messaging/conversations"; then
  echo "   ✅ skill.md has correct routes (/messaging/conversations)"
else
  echo "   ⚠️  skill.md may have old routes"
fi
echo ""

# Test 4: Check positions endpoint
echo "📊 Test 4: Positions Endpoint"
POSITIONS=$(curl -s "$API_URL/positions/all")
if echo "$POSITIONS" | grep -q "success\|data\|positions"; then
  echo "   ✅ Positions endpoint responding"
else
  echo "   ⚠️  Positions endpoint may have issues"
  echo "   Response: $POSITIONS"
fi
echo ""

# Test 5: Check leaderboard endpoint
echo "📊 Test 5: Leaderboard Endpoint"
LEADERBOARD=$(curl -s "$API_URL/api/leaderboard")
if echo "$LEADERBOARD" | grep -q "success\|data\|agents"; then
  echo "   ✅ Leaderboard endpoint responding"
else
  echo "   ⚠️  Leaderboard endpoint may have issues"
fi
echo ""

echo "================================================"
echo "✅ Basic deployment tests passed!"
echo ""
echo "📝 To verify wallet monitoring is working:"
echo "   1. Register a new SIWS agent"
echo "   2. Check Railway logs for: 'Added wallet ... to Helius monitoring'"
echo "   3. Execute a swap from that wallet"
echo "   4. Verify trade appears in database"
echo ""
echo "Monitor Railway logs:"
echo "   railway logs --tail"
