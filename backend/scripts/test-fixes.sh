#!/bin/bash

# Test script for the 3 critical backend fixes
# Usage: ./test-fixes.sh [BASE_URL]
# Example: ./test-fixes.sh https://sr-mobile-production.up.railway.app

BASE_URL="${1:-http://localhost:3001}"

echo "🧪 Testing SR-Mobile Backend Fixes"
echo "   Target: $BASE_URL"
echo ""

# Test 1: CORS Headers
echo "1️⃣  Testing CORS headers..."
CORS_RESPONSE=$(curl -s -I "$BASE_URL/health" \
  -H "Origin: https://trench-web.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS)

if echo "$CORS_RESPONSE" | grep -q "access-control-allow-origin"; then
  echo "   ✅ CORS headers present"
  echo "$CORS_RESPONSE" | grep -i "access-control"
else
  echo "   ❌ CORS headers missing"
fi
echo ""

# Test 2: Webhook Endpoint
echo "2️⃣  Testing webhook endpoint..."
WEBHOOK_RESPONSE=$(curl -s -X POST "$BASE_URL/webhooks/solana" \
  -H "Content-Type: application/json" \
  -d '[]')

WEBHOOK_STATUS=$(echo "$WEBHOOK_RESPONSE" | grep -o '"success":[^,}]*')

if echo "$WEBHOOK_STATUS" | grep -q "true"; then
  echo "   ✅ Webhook endpoint responding (status: $WEBHOOK_STATUS)"
else
  echo "   ⚠️  Webhook endpoint response:"
  echo "   $WEBHOOK_RESPONSE"
fi
echo ""

# Test 3: WebSocket/Socket.IO Connection
echo "3️⃣  Testing Socket.IO endpoint..."

# Extract base URL without protocol
BASE_NO_PROTOCOL=$(echo "$BASE_URL" | sed 's/https\?:\/\///')

# Test Socket.IO polling endpoint (first step in connection)
SOCKET_URL="$BASE_URL/socket.io/?EIO=4&transport=polling"
SOCKET_RESPONSE=$(curl -s "$SOCKET_URL")

if [ -n "$SOCKET_RESPONSE" ]; then
  echo "   ✅ Socket.IO endpoint responding"
  echo "   Response preview: ${SOCKET_RESPONSE:0:100}..."
else
  echo "   ❌ Socket.IO endpoint not responding"
fi
echo ""

echo "📊 Summary:"
echo "   - CORS: $(echo "$CORS_RESPONSE" | grep -q "access-control-allow-origin" && echo "✅" || echo "❌")"
echo "   - Webhook: $(echo "$WEBHOOK_STATUS" | grep -q "true" && echo "✅" || echo "⚠️")"
echo "   - Socket.IO: $([ -n "$SOCKET_RESPONSE" ] && echo "✅" || echo "❌")"
echo ""
echo "🎯 Next steps:"
echo "   1. If Socket.IO fails, check Railway logs for initialization errors"
echo "   2. If webhook fails with auth error, that's expected (needs Helius signature)"
echo "   3. Test real Socket.IO connection from frontend with socket.io-client"
