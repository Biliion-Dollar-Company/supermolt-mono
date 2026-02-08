#!/bin/bash
# Add DR wallet to Helius webhook monitoring

HELIUS_API_KEY="${HELIUS_API_KEY:-}"
DR_WALLET="DRhKVNHRwkh59puYfFekZxTNdaEqUGTzf692zoGtAoSy"
WEBHOOK_URL="https://sr-mobile-production.up.railway.app/webhooks/solana"

if [ -z "$HELIUS_API_KEY" ]; then
  echo "❌ Error: HELIUS_API_KEY environment variable not set"
  echo ""
  echo "Usage: HELIUS_API_KEY=your-key-here ./add-wallet-to-helius.sh"
  echo ""
  echo "Or get your Helius API key from: https://dashboard.helius.dev"
  exit 1
fi

echo "🔧 Adding DR wallet to Helius webhook..."
echo "   Wallet: $DR_WALLET"
echo "   Webhook: $WEBHOOK_URL"
echo ""

# First, get existing webhook ID
echo "📋 Fetching existing webhooks..."
WEBHOOKS=$(curl -s "https://api.helius.xyz/v0/webhooks?api-key=$HELIUS_API_KEY")
echo "$WEBHOOKS" | jq '.'

# Extract webhook ID for our URL (if it exists)
WEBHOOK_ID=$(echo "$WEBHOOKS" | jq -r ".[] | select(.webhookURL == \"$WEBHOOK_URL\") | .webhookID" | head -1)

if [ -z "$WEBHOOK_ID" ] || [ "$WEBHOOK_ID" = "null" ]; then
  echo ""
  echo "⚠️  No existing webhook found for $WEBHOOK_URL"
  echo "Creating new webhook..."
  
  RESPONSE=$(curl -s -X POST "https://api.helius.xyz/v0/webhooks?api-key=$HELIUS_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"webhookURL\": \"$WEBHOOK_URL\",
      \"transactionTypes\": [\"SWAP\"],
      \"accountAddresses\": [\"$DR_WALLET\"],
      \"webhookType\": \"enhanced\"
    }")
  
  echo "$RESPONSE" | jq '.'
  
  if echo "$RESPONSE" | jq -e '.webhookID' > /dev/null 2>&1; then
    echo ""
    echo "✅ Webhook created successfully!"
    echo "   Webhook ID: $(echo "$RESPONSE" | jq -r '.webhookID')"
  else
    echo ""
    echo "❌ Failed to create webhook"
    exit 1
  fi
else
  echo ""
  echo "✅ Found existing webhook: $WEBHOOK_ID"
  echo "Updating to add DR wallet..."
  
  # Get current addresses
  CURRENT_ADDRESSES=$(echo "$WEBHOOKS" | jq -r ".[] | select(.webhookID == \"$WEBHOOK_ID\") | .accountAddresses[]" | tr '\n' ',' | sed 's/,$//')
  
  # Add DR wallet if not already present
  if echo "$CURRENT_ADDRESSES" | grep -q "$DR_WALLET"; then
    echo ""
    echo "✅ DR wallet already in monitoring list!"
  else
    # Combine addresses
    NEW_ADDRESSES="$CURRENT_ADDRESSES,$DR_WALLET"
    
    RESPONSE=$(curl -s -X PUT "https://api.helius.xyz/v0/webhooks/$WEBHOOK_ID?api-key=$HELIUS_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"webhookURL\": \"$WEBHOOK_URL\",
        \"transactionTypes\": [\"SWAP\"],
        \"accountAddresses\": [\"$(echo $NEW_ADDRESSES | tr ',' '\n' | jq -R . | jq -s .)\"],
        \"webhookType\": \"enhanced\"
      }")
    
    echo "$RESPONSE" | jq '.'
    
    echo ""
    echo "✅ Webhook updated!"
  fi
fi

echo ""
echo "🎉 Done! DR wallet is now being monitored by Helius."
echo ""
echo "Next steps:"
echo "1. Make a small swap from DR wallet in Phantom"
echo "2. Wait 10-30 seconds for webhook to fire"
echo "3. Check: curl https://sr-mobile-production.up.railway.app/feed/activity?limit=5"
