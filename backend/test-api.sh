#!/bin/bash

cd ~/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/sr-mobile-trench/backend

# Kill any existing processes
pkill -9 -f "bun.*index.ts" 2>/dev/null
sleep 2

# Start server
PORT=3002 bun run src/index.ts > /tmp/sr-backend-test.log 2>&1 &
SERVER_PID=$!

echo "Starting server (PID: $SERVER_PID)..."
sleep 6

# Test endpoints
echo ""
echo "Testing GET /feed/leaderboard"
curl -s http://localhost:3002/feed/leaderboard

echo -e "\n\nTesting GET /feed/agents/DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy/stats"
curl -s http://localhost:3002/feed/agents/DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy/stats

# Cleanup
echo -e "\n\nCleaning up..."
kill $SERVER_PID 2>/dev/null
sleep 1
pkill -9 -f "bun.*index.ts" 2>/dev/null

echo "Done!"
