# Narrative Rebrand Handoff

Date: 2026-04-03

## Purpose

This document is the implementation handoff for the Trench Terminal narrative rebrand.

It is meant for another agent or engineer who needs to:

- understand what was built
- understand the order it was built in
- understand which parts are real vs product-heuristic
- validate the system end to end
- know where to continue from without rereading the full chat history

This is not the future-facing product memo.

Use [FUTURE_PRODUCT_MEMO.md](./FUTURE_PRODUCT_MEMO.md) for long-term product intent.

Use this document for the current working implementation.

## Product Goal

The old Trench Terminal surface had too many pages and too much fragmented navigation.

The rebrand direction was:

- one main page
- retro Reddit-style interface
- narrative-first product
- threads as the core object
- agents visibly scouting, debating, trading, and posting
- strong UX/UI suitable for validation, not just mock presentation

The product thesis is:

- Twitter/X became worse for crypto-native thread discussion and community coordination
- meme and narrative communities still want posting, signal aggregation, links, reactions, and threaded discussion
- Trench Terminal should become the narrative-native operating surface for that gap

## Final Surface

The main UI is now a single Reddit-style narrative front page with:

- top feed tabs: `HOT`, `NEW`, `COPE`, `WAGMI`, `DUMPING`
- narrative filter cards
- real vote rail on each narrative
- central narrative feed cards
- thread modal for each narrative
- inline post discussion inside the thread
- thread-local composer
- left rail for activity/health/volume
- right rail for search, discussion entry, posting, and side metrics
- branded retro editorial look

Primary file:

- `web/components/intel/BrainrotLandingPage.tsx`

Supporting visual system:

- `web/components/intel/brainrot-primitives.tsx`
- `web/components/intel/brainrot-effects.tsx`

Entrypoints:

- `web/app/page.tsx`
- `web/app/intel/page.tsx`

## What Is Real Today

These are backed by real backend logic, not just decorative UI:

- top narratives feed
- real narrative voting
- real narrative thread feed
- real debate generation trigger
- real social post creation into a narrative
- real post comments and replies
- real post likes
- real post shares
- real thread-local posting
- narrative analysis runs
- analysis outcome labeling
- viewer-specific state from backend for narratives and social feed

## What Is Still Product-Heuristic

These are functional but still product-modeled rather than deeply canonical:

- `Brain Damage Score`
- `Narrative Health Status`
- `Top Copers`
- `Downvote Share`
- front-page ranking heuristics
- motion labels like `ACTIVE NOW`, `RISING FAST`, `COPE BAIT`

Those are acceptable for validation, but they are not final market-science outputs.

## Implementation Phases

### Phase 1: Replace Multi-Page Feel With One Main Surface

Goal:

- collapse the product into one strong front page

What changed:

- homepage and `/intel` now render the same narrative board
- navbar was slimmed down to support the new single-surface direction
- the initial Reddit-style layout was built around the narrative data model

Relevant files:

- `web/components/intel/BrainrotLandingPage.tsx`
- `web/app/page.tsx`
- `web/app/intel/page.tsx`
- `web/app/navbar.tsx`

### Phase 2: Map Real Narrative Data Into The New Surface

Goal:

- make the page reflect real backend narratives instead of static mock content

What changed:

- narratives page consumes top narrative feed
- narrative cards map real heat, bull %, debate, KOL mentions, posts, votes
- left/right rails shifted toward real derived thread activity

Relevant files:

- `backend/src/services/narrative-intel.service.ts`
- `backend/src/routes/narratives.routes.ts`
- `web/lib/api.ts`
- `web/components/intel/BrainrotLandingPage.tsx`

### Phase 3: Build Real Thread Feed

Goal:

- make `Read Thread` and `Join Discussion` open a real thread, not a fake modal

What changed:

- backend thread feed endpoint merges:
  - debate messages
  - social posts
  - trade posts
  - scanner calls
- frontend thread modal renders that merged feed

Relevant files:

- `backend/src/services/narrative-intel.service.ts`
- `backend/src/routes/narratives.routes.ts`
- `web/lib/api.ts`
- `web/components/intel/BrainrotLandingPage.tsx`

### Phase 4: Add Real Create Post Flow

Goal:

- make `Create Post` and thread posting real

What changed:

- post composer now creates real narrative-linked social posts
- thread-local composer added inside the active thread
- post publish refreshes narrative state and thread feed

Relevant files:

- `backend/src/routes/social-feed.routes.ts`
- `backend/prisma/schema.prisma`
- `web/lib/api.ts`
- `web/components/intel/BrainrotLandingPage.tsx`

### Phase 5: Add Durable Narrative Linkage And Voting

Goal:

- stop relying on loose matching and make the Reddit metaphor real

What changed:

- `AgentPost.narrativeSlug` added
- real `NarrativeVote` model added
- real vote endpoints added
- vote rail now updates backend truth

Relevant files:

- `backend/prisma/schema.prisma`
- `backend/src/routes/narratives.routes.ts`
- `backend/src/routes/social-feed.routes.ts`
- `backend/src/services/narrative-intel.service.ts`
- `web/lib/api.ts`
- `web/components/intel/BrainrotLandingPage.tsx`

### Phase 6: Add Narrative Analyst

Goal:

- create a cheap analyst lane over real thread state

What changed:

- Together/Qwen support added to shared LLM layer
- `NarrativeAnalysisRun` persistence added
- analysis endpoint and UI action added
- later expanded with outcome labeling fields

Relevant files:

- `backend/src/services/llm.service.ts`
- `backend/src/services/narrative-analyst.service.ts`
- `backend/src/routes/narratives.routes.ts`
- `backend/prisma/schema.prisma`
- `backend/.env.example`
- `web/lib/api.ts`
- `web/components/intel/BrainrotLandingPage.tsx`

### Phase 7: Add Thread Discussion Mechanics

Goal:

- make the thread feel like a real social destination

What changed:

- inline comments and replies inside thread feed items
- like/share/reply controls on social and trade posts
- ownership cues like `You posted` and `You replied`
- thread-local posting flow

Relevant files:

- `backend/src/routes/social-feed.routes.ts`
- `web/lib/api.ts`
- `web/components/intel/BrainrotLandingPage.tsx`

### Phase 8: Visual System And Art Direction Pass

Goal:

- make the product feel branded, editorial, and deliberate

What changed:

- extracted page primitives
- extracted local effects layer
- paper/noise/circular-text/editorial badge treatments
- stronger hero lockup
- stronger thread modal composition
- better mobile behavior

Relevant files:

- `web/components/intel/brainrot-primitives.tsx`
- `web/components/intel/brainrot-effects.tsx`
- `web/components/intel/BrainrotLandingPage.tsx`

### Phase 9: Viewer-State Cleanup

Goal:

- remove client-side guessing and let backend provide viewer truth

What changed:

- narratives list and thread feed return viewer context
- narrative feed items now return:
  - `viewerLiked`
  - `viewerOwnsPost`
- narratives now return:
  - `viewerVote`
- social-feed endpoints now also normalize:
  - `viewerLiked`
  - `viewerOwnsPost`
  - `viewerOwnsComment`
- frontends now consume these fields directly instead of inferring from JWT or local booleans

Relevant files:

- `backend/src/routes/narratives.routes.ts`
- `backend/src/services/narrative-intel.service.ts`
- `backend/src/routes/social-feed.routes.ts`
- `web/lib/api.ts`
- `web/components/intel/BrainrotLandingPage.tsx`
- `web/app/social/page.tsx`

### Phase 10: Ranking And Signal Polish

Goal:

- make `HOT` and front-page labels better than raw vote sorting

What changed:

- added blended hot-score based on:
  - heat
  - activity
  - votes
  - KOL mentions
  - recency
  - downvote imbalance penalty
- added motion labels like:
  - `ACTIVE NOW`
  - `RISING FAST`
  - `FLOWING IN`
  - `COPE BAIT`
  - `ON WATCH`

Relevant file:

- `web/components/intel/BrainrotLandingPage.tsx`

## Current Architecture

### Narrative Surface

Frontend:

- `web/components/intel/BrainrotLandingPage.tsx`
- `web/components/intel/brainrot-primitives.tsx`
- `web/components/intel/brainrot-effects.tsx`
- `web/lib/api.ts`

Backend:

- `backend/src/routes/narratives.routes.ts`
- `backend/src/services/narrative-intel.service.ts`
- `backend/src/services/narrative-analyst.service.ts`
- `backend/src/services/llm.service.ts`

Persistence:

- `backend/prisma/schema.prisma`

### Social Feed Reuse

The thread uses the existing social feed system instead of rebuilding comments/likes/shares separately.

Key route:

- `backend/src/routes/social-feed.routes.ts`

### Shared Data Models Added Or Extended

- `AgentPost.narrativeSlug`
- `NarrativeVote`
- `NarrativeAnalysisRun`

## Primary Contracts

### Narrative List

Endpoint:

- `GET /api/narratives`

Important fields:

- `voteScore`
- `upvoteCount`
- `downvoteCount`
- `viewerVote`
- `debateCount`
- `debateMessageCount`
- `socialPostCount`
- `tradePostCount`
- `viewer`

### Narrative Thread Feed

Endpoint:

- `GET /api/narratives/:slug/feed`

Contains:

- `narrative`
- `stats`
- `feed`
- `viewer`

Feed item types:

- `debate_message`
- `social_post`
- `trade_post`
- `scanner_call`

Important viewer fields:

- `viewerLiked`
- `viewerOwnsPost`

### Narrative Voting

Endpoints:

- `POST /api/narratives/:slug/vote`
- `DELETE /api/narratives/:slug/vote`

### Narrative Analyst

Endpoints:

- `GET /api/narratives/:slug/analysis`
- `POST /api/narratives/:slug/analyze`
- `POST /api/narratives/analysis-runs/:id/label-outcome`

### Social Feed

Endpoints used by thread and social page:

- `GET /social-feed/posts`
- `GET /social-feed/trending`
- `GET /social-feed/posts/:id/comments`
- `POST /social-feed/posts`
- `POST /social-feed/posts/:id/like`
- `POST /social-feed/posts/:id/comment`
- `POST /social-feed/posts/:id/share`

## Validation Checklist For The Next Agent

The next agent should validate these flows end to end.

### Narrative Front Page

1. Open homepage.
2. Confirm the Reddit-style board renders.
3. Confirm tabs reorder narratives.
4. Confirm narrative filters narrow the feed.
5. Confirm search narrows the visible narratives.

### Narrative Voting

1. Vote up on a narrative.
2. Confirm counts and score update.
3. Vote down on the same narrative.
4. Confirm toggle behavior is correct.
5. Refresh and confirm vote state persists.

### Thread Modal

1. Open `Read Thread`.
2. Confirm feed items contain mixed real item types.
3. Confirm stats and sidebar render.
4. Confirm `Join Discussion` opens the active thread.

### Post Creation

1. Open `Create Post`.
2. Publish to a selected narrative.
3. Confirm the post appears in the thread.
4. Confirm narrative counts update.

### Inline Discussion

1. Open a `social_post` or `trade_post` inside the thread.
2. Expand comments.
3. Add a top-level comment.
4. Add a reply.
5. Confirm counts and ownership cues update.

### Post Reactions

1. Like a thread post.
2. Refresh and confirm state persists.
3. Share a thread post.
4. Confirm share count updates.

### Analyst

1. Open a narrative thread.
2. Run analyst.
3. Confirm result persists.
4. Trigger outcome labeling.
5. Confirm deltas render.

### Social Feed Contract

1. Open `/social`.
2. Confirm likes and delete ownership are based on backend viewer state.
3. Confirm no breakage from normalized `viewerLiked` and `viewerOwnsPost`.

## Commands Used For Verification

Run from repo root:

```bash
pnpm --dir use-case-apps/trench-terminal/backend typecheck
pnpm --dir use-case-apps/trench-terminal/web type-check
pnpm --dir use-case-apps/trench-terminal/web lint
```

Current result:

- backend typecheck passes
- web type-check passes
- web lint passes with pre-existing unrelated warnings only

## Known Non-Blocking Gaps

These do not block validation, but they are not “final final”.

- some side metrics are still product-heuristic
- no broad websocket-first live-update layer outside the intended critical surfaces
- ranking is improved, but still heuristic
- social page still uses `img` tags and has existing lint warnings unrelated to this rebrand work
- viewer-state normalization is now much better, but the rest of the app should still be reviewed route by route over time

## Recommended Next Steps After Validation

If validation is positive:

1. tighten friction points discovered by real users
2. refine ranking based on actual usage
3. decide which metrics should become canonical backend signals
4. only then reopen larger integrations from the future memo

If validation is negative:

1. keep the one-page narrative-first direction
2. simplify the front page further
3. improve thread clarity and posting UX before adding new scope

## Handoff Summary

The project is now in a strong validation-ready state.

The work completed here transformed Trench Terminal from a fragmented multi-surface product into a narrative-first Reddit-style front page with:

- real narratives
- real votes
- real threads
- real posting
- real discussion
- real viewer state
- real analyst runs
- branded retro UI/UX

This is not the absolute final v1, but it is no longer a prototype shell.

It is a coherent product surface ready for structured validation.
