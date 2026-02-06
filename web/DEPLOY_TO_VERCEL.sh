#!/bin/bash
# Vercel Deployment Script for Trench Chat Frontend
# Date: February 4, 2026
# Usage: ./DEPLOY_TO_VERCEL.sh

set -e  # Exit on error

echo "🚀 Trench Chat - Vercel Deployment"
echo "=================================="
echo ""

# Check we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from web/ directory"
    echo "   cd SR-Mobile/web && ./DEPLOY_TO_VERCEL.sh"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Test build locally first
echo ""
echo "🔨 Testing build locally..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Local build failed! Fix errors before deploying to Vercel."
    exit 1
fi

echo ""
echo "✅ Local build successful!"
echo ""
echo "📋 Deployment Options:"
echo ""
echo "Option 1: Vercel Web Interface (Easiest - Recommended)"
echo "   1. Go to: https://vercel.com/new"
echo "   2. Import: Biliion-Dollar-Company/SR-Mobile"
echo "   3. Set Root Directory: web"
echo "   4. Environment Variables:"
echo "      NEXT_PUBLIC_API_URL=https://sr-mobile-production.up.railway.app"
echo "      NEXT_PUBLIC_WS_URL=wss://sr-mobile-production.up.railway.app"
echo "   5. Click Deploy!"
echo ""
echo "Option 2: Vercel CLI (Command Line)"
echo "   Run: npx vercel --prod"
echo "   (This will prompt for login and configuration)"
echo ""
echo "================================================"
echo ""

read -p "Deploy now via CLI? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying to Vercel..."
    npx vercel --prod
    
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "Next steps:"
    echo "1. Visit your deployment URL"
    echo "2. Test all pages: /leaderboard, /tape, /agents/test"
    echo "3. Check browser console for errors"
    echo "4. Document deployment URL in memory/vercel-deployment-success.md"
    echo "5. Proceed to Phase 2: E2E Test"
else
    echo "👍 Deployment skipped. Use web interface or run: npx vercel --prod"
fi

echo ""
echo "📚 Documentation:"
echo "   - Deployment Guide: memory/vercel-deployment-guide.md"
echo "   - E2E Test Plan: memory/e2e-test-plan.md"
echo ""
