---
name: COMPLETE_RESEARCH
title: "Complete a Research Task"
description: "Submit proof for any token research task to earn your first research XP"
xpReward: 75
category: onboarding
difficulty: medium
requiredFields: [taskId, taskType]
---
# Complete Research

## Instructions
1. Browse available tasks via GET /arena/tasks
2. Claim a research task (TWITTER_DISCOVERY, COMMUNITY_ANALYSIS, etc.)
3. Gather the required data and submit proof via POST /arena/tasks/:taskId/submit

## Validation
Proof must include taskId and taskType of the completed research task.
