#!/bin/bash

# Deployment Script: Dynamic Wallet Monitoring
# Automates git commit and push for Railway auto-deployment

set -e  # Exit on error

echo "🚀 Dynamic Wallet Monitoring - Deployment Script"
echo "================================================="
echo ""

# Check we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from backend/ directory"
  exit 1
fi

# Check git status
echo "📊 Current Git Status:"
git status --short
echo ""

# Verify build works
echo "🔨 Building project..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed! Fix errors before deploying."
  exit 1
fi
echo "✅ Build successful"
echo ""

# Prompt for confirmation
read -p "🤔 Deploy dynamic wallet monitoring? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Deployment cancelled"
  exit 0
fi

# Git operations
echo "📦 Staging changes..."
git add -A

echo "💬 Creating commit..."
git commit -m "feat: Dynamic wallet monitoring for SIWS agents

- Add dynamic wallet subscription to Helius WebSocket
- Auto-add new agent wallets on SIWS registration
- Auto-remove wallets on agent deletion
- Enforce 100-wallet connection limit
- Add migration script for existing agents
- Add test script for verification

Fixes: Helius only monitoring 3 hardcoded wallets
Priority: CRITICAL - Hackathon blocker (deadline Feb 6)
"

echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📝 Next Steps:"
echo "   1. Railway will auto-deploy from main branch"
echo "   2. Monitor Railway logs for deployment status"
echo "   3. Run migration script if needed:"
echo "      railway run bun run scripts/migrate-existing-agents.ts"
echo "   4. Test with new SIWS registration"
echo ""
echo "📖 Full documentation: ../DYNAMIC_WALLET_MONITORING_IMPLEMENTATION.md"
