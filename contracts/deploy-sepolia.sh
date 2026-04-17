#!/usr/bin/env bash
# deploy-sepolia.sh — Deploy ERC-8004 contracts to Sepolia and auto-fill deployments.json
#
# Requirements:
#   export PRIVATE_KEY=0x...        (funded Sepolia wallet)
#   export SEPOLIA_RPC_URL=https://... (Infura/Alchemy/public Sepolia)
#
# Usage:
#   chmod +x deploy-sepolia.sh && ./deploy-sepolia.sh

set -e

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENTS_FILE="$CONTRACTS_DIR/deployments.json"
ENV_FILE="$CONTRACTS_DIR/../backend/.env"

echo "=== Kraken Agent Terminal — ERC-8004 Deployment ==="
echo "Chain: Sepolia (chainId 11155111)"
echo "RPC:   ${SEPOLIA_RPC_URL:-MISSING}"
echo ""

if [ -z "$PRIVATE_KEY" ]; then
  echo "❌ PRIVATE_KEY is required. Run: export PRIVATE_KEY=0x..."
  exit 1
fi

if [ -z "$SEPOLIA_RPC_URL" ]; then
  echo "❌ SEPOLIA_RPC_URL is required. Run: export SEPOLIA_RPC_URL=https://..."
  exit 1
fi

# Deploy via forge script
echo "🚀 Deploying contracts..."
OUTPUT=$(forge script script/Deploy.s.sol \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast \
  --verify \
  -vvvv \
  2>&1)

echo "$OUTPUT"

# Parse addresses from forge output
IDENTITY=$(echo "$OUTPUT" | grep -oE 'AgentIdentityRegistry deployed at: (0x[0-9a-fA-F]{40})' | grep -oE '0x[0-9a-fA-F]{40}')
REPUTATION=$(echo "$OUTPUT" | grep -oE 'AgentReputationRegistry deployed at: (0x[0-9a-fA-F]{40})' | grep -oE '0x[0-9a-fA-F]{40}')
VALIDATION=$(echo "$OUTPUT" | grep -oE 'AgentValidationRegistry deployed at: (0x[0-9a-fA-F]{40})' | grep -oE '0x[0-9a-fA-F]{40}')

if [ -z "$IDENTITY" ] || [ -z "$REPUTATION" ] || [ -z "$VALIDATION" ]; then
  echo ""
  echo "❌ Could not parse addresses from output. Check forge output above."
  exit 1
fi

DEPLOYER=$(cast wallet address "$PRIVATE_KEY" 2>/dev/null || echo "unknown")
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo ""
echo "=== DEPLOYED ADDRESSES ==="
echo "identityRegistry:    $IDENTITY"
echo "reputationRegistry:  $REPUTATION"
echo "validationRegistry:  $VALIDATION"
echo "deployer:            $DEPLOYER"
echo "deployedAt:          $DEPLOYED_AT"

# Update deployments.json
jq \
  --arg identity "$IDENTITY" \
  --arg reputation "$REPUTATION" \
  --arg validation "$VALIDATION" \
  --arg deployer "$DEPLOYER" \
  --arg at "$DEPLOYED_AT" \
  '.sepolia.identityRegistry   = $identity   |
   .sepolia.reputationRegistry = $reputation |
   .sepolia.validationRegistry = $validation |
   .sepolia.deployer           = $deployer   |
   .sepolia.deployedAt         = $at' \
  "$DEPLOYMENTS_FILE" > /tmp/deployments_new.json && mv /tmp/deployments_new.json "$DEPLOYMENTS_FILE"

echo ""
echo "✅ deployments.json updated!"
echo ""

# Update backend .env with the addresses
if [ -f "$ENV_FILE" ]; then
  # Remove old lines if they exist, then append
  grep -v "^IDENTITY_REGISTRY_ADDRESS\|^REPUTATION_REGISTRY_ADDRESS\|^VALIDATION_REGISTRY_ADDRESS\|^ETHEREUM_NETWORK" "$ENV_FILE" > /tmp/env_new && mv /tmp/env_new "$ENV_FILE"
  echo "" >> "$ENV_FILE"
  echo "# ERC-8004 Contract Addresses (Sepolia) — auto-filled by deploy-sepolia.sh" >> "$ENV_FILE"
  echo "IDENTITY_REGISTRY_ADDRESS=$IDENTITY"   >> "$ENV_FILE"
  echo "REPUTATION_REGISTRY_ADDRESS=$REPUTATION" >> "$ENV_FILE"
  echo "VALIDATION_REGISTRY_ADDRESS=$VALIDATION" >> "$ENV_FILE"
  echo "ETHEREUM_NETWORK=sepolia" >> "$ENV_FILE"
  echo "✅ backend/.env updated with contract addresses!"
fi

echo ""
echo "=== NEXT STEPS ==="
echo "1. Add to backend/.env:"
echo "   ETHEREUM_PRIVATE_KEY=$PRIVATE_KEY"
echo "   ETHEREUM_RPC_URL=$SEPOLIA_RPC_URL"
echo ""
echo "2. Bulk-register existing agents:"
echo "   curl -X POST http://localhost:3001/erc8004/register-all"
echo ""
echo "3. Bulk-prove existing trade intents:"
echo "   curl -X POST http://localhost:3001/erc8004/prove-all"
echo ""
echo "Sepolia Etherscan: https://sepolia.etherscan.io/address/$IDENTITY"
