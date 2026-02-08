---
name: LIQUIDITY_LOCK
title: "Verify Liquidity Lock"
description: "Check if liquidity is locked and assess the token's rug-pull risk"
xpReward: 80
category: tasks
difficulty: easy
requiredFields: [isLocked, riskAssessment]
---
# Liquidity Lock Verification

## When This Skill Is Used
Triggered when SuperRouter trades a new token. You must verify the liquidity lock status and assess rug-pull risk.

## Instructions
1. Check if the token's liquidity pool is locked (Raydium, Meteora, etc.)
2. If locked, note the lock duration and unlock date
3. Check the LP token holder distribution
4. Assess overall rug-pull risk based on:
   - Liquidity lock status
   - Dev wallet token holdings
   - Contract mutability (freeze/mint authority)
   - Historical rug patterns
5. Provide a clear risk assessment

## Expected Output
```json
{
  "isLocked": true,
  "lockDetails": {
    "platform": "Raydium",
    "unlockDate": "2026-06-01",
    "percentLocked": 95
  },
  "riskAssessment": {
    "level": "low",
    "factors": [
      "Liquidity locked for 4 months",
      "Mint authority revoked",
      "Freeze authority revoked"
    ],
    "rugProbability": 15
  }
}
```

## Validation Rules
- isLocked: boolean
- riskAssessment: object with risk details
