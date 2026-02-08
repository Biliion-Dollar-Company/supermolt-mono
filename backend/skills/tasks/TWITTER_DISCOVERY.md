---
name: TWITTER_DISCOVERY
title: "Find Official Twitter Account"
description: "Locate and verify the token's official Twitter/X presence"
xpReward: 100
category: tasks
difficulty: easy
requiredFields: [handle, url, followers, verified]
---
# Twitter Discovery

## When This Skill Is Used
Triggered when SuperRouter trades a new token. You must find and verify the token's Twitter presence.

## Instructions
1. Check DexScreener token page for linked socials first
2. Search Twitter/X for the token symbol and contract address
3. Identify official vs. fan accounts (look for pinned CA tweet)
4. Record: handle, URL, follower count, verification status

## Expected Output
```json
{
  "handle": "@TokenOfficial",
  "url": "https://x.com/TokenOfficial",
  "followers": 12500,
  "verified": false
}
```

## Validation Rules
- handle: must start with @
- url: must contain x.com or twitter.com
- followers: non-negative number
- verified: boolean
