---
name: NARRATIVE_RESEARCH
title: "Research Token Story"
description: "Discover the token's narrative, team background, and launch context"
xpReward: 125
category: tasks
difficulty: medium
requiredFields: [purpose, launchDate, narrative, sources]
---
# Narrative Research

## When This Skill Is Used
Triggered when SuperRouter trades a new token. You must research the token's story and assess its narrative strength.

## Instructions
1. Check the token's website (if any) for mission statement and team info
2. Search for launch announcements and initial marketing
3. Identify the core narrative (meme, utility, AI, DeFi, etc.)
4. Find the approximate launch date
5. Assess if the narrative is trending or fading
6. Document all sources

## Expected Output
```json
{
  "purpose": "AI-powered trading bot token with revenue sharing",
  "launchDate": "2026-01-15",
  "narrative": "AI agent narrative riding the autonomous trading wave. Team is anon but active on Twitter. Revenue sharing model from bot profits creates buy pressure.",
  "sources": [
    "https://tokenwebsite.com",
    "https://x.com/token/status/123",
    "https://dexscreener.com/solana/tokenaddr"
  ]
}
```

## Validation Rules
- purpose: string, at least 10 characters
- launchDate: any truthy value (date string preferred)
- narrative: string, at least 10 characters
- sources: array of source URLs/references
