# War Room UI Unification — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Leaderboard, Agent Profile, Arena Main, and Dashboard up to Predictions Arena visual quality by stripping old CSS vars / glassmorphism and applying War Room DNA (inline rgba, #07090F BG, 3-color system).

**Architecture:** Each page is self-contained — four parallel rewrites with no shared state changes. The War Room constants (GOLD, YES_C, NO_C, BG, SURF) are the design tokens. All glassmorphism (`backdrop-blur`, `bg-white/[0.025]`, `shadow-[inset_...]`) gets removed; flat borders replace it.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, inline styles for War Room tokens, lucide-react icons.

---

## Shared Constants (reference in every task)

```ts
const GOLD  = '#E8B45E';
const YES_C = '#4ade80';
const NO_C  = '#f87171';
const BG    = '#07090F';
const SURF  = '#0C1020';
```

CSS var → inline replacement table:
| Old class | Replacement |
|-----------|-------------|
| `text-accent-primary` | `style={{ color: GOLD }}` |
| `text-text-primary` | `className="text-white"` |
| `text-text-muted` | `style={{ color: 'rgba(255,255,255,0.35)' }}` |
| `text-text-secondary` | `style={{ color: 'rgba(255,255,255,0.55)' }}` |
| `bg-bg-primary` | `style={{ background: BG }}` |
| `bg-accent-primary/10` | `style={{ background: 'rgba(232,180,94,0.08)' }}` |
| `border-accent-primary/20` | `style={{ borderColor: 'rgba(232,180,94,0.2)' }}` |
| `backdrop-blur-xl/2xl` | remove entirely |
| `bg-white/[0.025] backdrop-blur-2xl shadow-[inset...]` panel | `style={{ background: SURF, border: '1px solid rgba(255,255,255,0.06)' }}` |
| `rounded-xl` on cards | remove (no radius) |
| `green-400` text | `style={{ color: YES_C }}` |
| `red-400` text | `style={{ color: NO_C }}` |

---

## Chunk 1: Leaderboard Full Rewrite

**Files:**
- Rewrite: `app/leaderboard/page.tsx`

### Task 1: Leaderboard — Remove glassmorphism, old vars, emoji icons

The leaderboard is the most visually broken page. It uses `glass` (backdrop-blur), old CSS vars throughout, emoji rank icons (Crown/Medal/Award), and rounded cards. Replace with War Room table design matching the leaderboard panel in `app/arena/predictions/page.tsx`.

- [ ] **Step 1: Remove unused icon imports**

In `app/leaderboard/page.tsx`, delete the `Medal`, `Crown`, `Award` imports (they'll be replaced by rank number badges). Keep `Trophy`, `TrendingUp`, `Users`, `Target`.

- [ ] **Step 2: Remove the `glass` CSS variable**

Delete the line:
```ts
const glass = 'bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)]';
```
Add War Room constants at the top instead:
```ts
const GOLD  = '#E8B45E';
const YES_C = '#4ade80';
const NO_C  = '#f87171';
const BG    = '#07090F';
const SURF  = '#0C1020';
```

- [ ] **Step 3: Replace `getRankIcon` with `RankBadge` component**

Delete the `getRankIcon` function. Replace with:
```tsx
function RankBadge({ rank }: { rank: number }) {
  const isTop3 = rank <= 3;
  return (
    <div
      className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-[11px] font-black font-mono"
      style={{
        background: isTop3 ? `rgba(232,180,94,${0.15 - (rank - 1) * 0.04})` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isTop3 ? `rgba(232,180,94,${0.3 - (rank - 1) * 0.08})` : 'rgba(255,255,255,0.07)'}`,
        color: isTop3 ? GOLD : 'rgba(255,255,255,0.22)',
      }}
    >
      {rank}
    </div>
  );
}
```

- [ ] **Step 4: Replace `Avatar` logic**

Add a square monogram avatar matching predictions page:
```tsx
function Avatar({ name }: { name: string }) {
  const hue = ((name.charCodeAt(0) ?? 0) * 41 + (name.charCodeAt(1) ?? 0) * 17) % 360;
  return (
    <div
      className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-[11px] font-bold font-mono"
      style={{
        background: `hsl(${hue},35%,10%)`,
        border: `1px solid hsl(${hue},35%,20%)`,
        color: `hsl(${hue},60%,58%)`,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
```

- [ ] **Step 5: Rewrite loading skeleton**

Replace the `isLoading` return block. Remove `bg-bg-primary`, `rounded-xl`, bg.png background. New loading state:
```tsx
if (isLoading && agents.length === 0) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
      <div className="flex flex-col items-center gap-5">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgba(232,180,94,0.15)', borderTopColor: GOLD }} />
        <p className="text-[10px] font-mono uppercase tracking-[0.35em] opacity-40" style={{ color: GOLD }}>
          Loading leaderboard
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Rewrite main return — outer shell**

Replace the outer `div` and background setup. Remove bg.png entirely:
```tsx
return (
  <div className="min-h-screen" style={{ background: BG }}>

    {/* ── Sticky header ────────────────────────────────── */}
    <div
      className="sticky top-0 z-30 pt-16 sm:pt-[64px]"
      style={{ background: BG, borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-4 px-4 sm:px-6 py-3">
        <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(232,180,94,0.55)' }} />
        <h1 className="text-base font-black tracking-tight text-white font-mono">LEADERBOARD</h1>
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: YES_C }} />
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Live</span>
        </div>
        <span className="ml-auto text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{agents.length} agents</span>
      </div>

      {/* ── Stat strip ──────────────────────────────────── */}
      <div className="grid grid-cols-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="flex flex-col items-center py-3 px-2"
              style={{ borderRight: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
            >
              <div className="text-[15px] font-black font-mono tabular-nums" style={{ color: GOLD }}>
                {stat.value}
              </div>
              <div className="text-[9px] font-mono uppercase tracking-[0.15em] mt-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* ── Agent rows ─────────────────────────────────────── */}
    <div>
      {agents.length === 0 ? (
        <div className="py-20 text-center">
          <Trophy className="w-8 h-8 mx-auto mb-4 opacity-8 text-white" />
          <p className="text-[13px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>No agents yet — be first</p>
        </div>
      ) : (
        agents.map((agent, index) => (
          <Link key={agent.agentId} href={`/agents/${agent.agentId}`}>
            <div
              className="flex items-center gap-3 px-4 sm:px-6 py-4 group transition-colors"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <RankBadge rank={index + 1} />
              <Avatar name={agent.agentName || agent.walletAddress} />

              {/* Name + wallet */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[13px] font-semibold text-white/75 truncate group-hover:text-white/95 transition-colors">
                    {agent.agentName || `Agent ${agent.walletAddress.slice(0, 8)}`}
                  </p>
                  {index === 0 && (
                    <span
                      className="text-[9px] font-black font-mono px-1.5 py-0.5 flex-shrink-0 tracking-wider"
                      style={{ color: GOLD, background: 'rgba(232,180,94,0.1)', border: '1px solid rgba(232,180,94,0.25)' }}
                    >
                      LEADER
                    </span>
                  )}
                </div>
                {/* Win rate accuracy bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 max-w-[100px] overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full transition-all duration-700"
                      style={{ width: `${Math.min(100, agent.win_rate || 0)}%`, background: 'rgba(232,180,94,0.5)' }}
                    />
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(232,180,94,0.55)' }}>
                    {formatPercent(agent.win_rate)}
                  </span>
                </div>
              </div>

              {/* Desktop stats */}
              <div className="hidden md:flex items-center gap-6">
                {[
                  { label: 'Sortino', val: agent.sortino_ratio?.toFixed(2) || '—', color: undefined },
                  { label: 'P&L', val: formatCurrency(agent.total_pnl), color: agent.total_pnl >= 0 ? YES_C : NO_C },
                  { label: 'Trades', val: String(agent.trade_count || 0), color: undefined },
                ].map((s) => (
                  <div key={s.label} className="text-right">
                    <div className="text-[13px] font-black font-mono" style={{ color: s.color || 'rgba(255,255,255,0.7)' }}>{s.val}</div>
                    <div className="text-[9px] font-mono uppercase tracking-[0.15em] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Mobile: just P&L */}
              <div className="md:hidden text-right flex-shrink-0">
                <div className="text-[13px] font-black font-mono" style={{ color: agent.total_pnl >= 0 ? YES_C : NO_C }}>
                  {formatCurrency(agent.total_pnl)}
                </div>
                <div className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>P&L</div>
              </div>
            </div>
          </Link>
        ))
      )}
    </div>
  </div>
);
```

- [ ] **Step 7: Commit**
```bash
git add app/leaderboard/page.tsx
git commit -m "feat(leaderboard): War Room redesign — kill glassmorphism, rank badges, accuracy bars"
```

---

## Chunk 2: Agent Profile Polish

**Files:**
- Modify: `app/agents/[id]/page.tsx`

### Task 2: Agent Profile — Remove bg.png, square avatar, edge-to-edge layout

- [ ] **Step 1: Add War Room constants**

At the top of `app/agents/[id]/page.tsx`, the constants `GOLD`, `YES_C`, `NO_C`, `BG`, `SURF` are already defined. Verify they match exactly:
```ts
const GOLD = '#E8B45E';
const YES_C = '#4ade80';
const NO_C  = '#f87171';
const BG    = '#07090F';
const SURF  = '#0C1020';
```

- [ ] **Step 2: Add square Avatar component**

Add below the constants, before `TASK_ICONS`:
```tsx
function Avatar({ name }: { name: string }) {
  const hue = ((name.charCodeAt(0) ?? 0) * 41 + (name.charCodeAt(1) ?? 0) * 17) % 360;
  return (
    <div
      className="w-16 h-16 flex-shrink-0 flex items-center justify-center text-xl font-black font-mono"
      style={{
        background: `hsl(${hue},35%,10%)`,
        border: `1px solid hsl(${hue},35%,22%)`,
        color: `hsl(${hue},60%,58%)`,
      }}
    >
      {(name.slice(0, 2)).toUpperCase()}
    </div>
  );
}
```

- [ ] **Step 3: Remove bg.png background from loading state, not-found state, and main return**

In the loading state `if (loading)` block, replace:
```tsx
<div className="min-h-screen pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[15%]" style={{ backgroundColor: BG }}>
  <div className="fixed inset-0 z-0">
    <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }} />
    <div className="absolute inset-0 bg-black/80" />
  </div>
  ...
```
With:
```tsx
<div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
  <div className="flex flex-col items-center gap-5">
    <div className="w-8 h-8 border-2 rounded-full animate-spin"
      style={{ borderColor: 'rgba(232,180,94,0.15)', borderTopColor: GOLD }} />
    <p className="text-[10px] font-mono uppercase tracking-[0.35em] opacity-40" style={{ color: GOLD }}>
      Loading agent
    </p>
  </div>
</div>
```

- [ ] **Step 4: Remove bg.png from not-found state**

Replace the not-found return block's background setup. Remove the `fixed inset-0` bg.png divs. The outer div becomes:
```tsx
<div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
  <div className="p-8 text-center max-w-md"
    style={{ background: SURF, border: '1px solid rgba(255,255,255,0.08)' }}>
    <h2 className="text-xl font-bold text-white mb-4 font-mono">Agent Not Found</h2>
    <button onClick={() => router.back()} className="text-[13px] font-mono hover:opacity-80 transition-opacity" style={{ color: GOLD }}>
      ← Go Back
    </button>
  </div>
</div>
```

- [ ] **Step 5: Remove bg.png from main return — fix outer shell**

In the main `return (...)` block, replace:
```tsx
<div className="min-h-screen pt-20 sm:pt-24 pb-16 px-4 sm:px-[8%] lg:px-[15%] relative" style={{ backgroundColor: BG }}>
  {/* Background */}
  <div className="fixed inset-0 z-0">
    <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/bg.png)' }} />
    <div className="absolute inset-0 bg-black/80" />
    <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.9) 100%)' }} />
  </div>

  <div className="relative z-10">
    {/* Back Button */}
    <div className="mb-6">
      <button onClick={() => router.back()} ... >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
    </div>
```
With:
```tsx
<div className="min-h-screen" style={{ background: BG }}>
  {/* Back button in sticky sub-header */}
  <div className="sticky top-0 z-30 pt-16 sm:pt-[64px]" style={{ background: BG, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
    <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
      <button
        onClick={() => router.back()}
        className="w-8 h-8 flex items-center justify-center flex-shrink-0 transition-all"
        style={{ border: '1px solid rgba(232,180,94,0.18)', color: 'rgba(232,180,94,0.4)' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(232,180,94,0.5)'; e.currentTarget.style.color = GOLD; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(232,180,94,0.18)'; e.currentTarget.style.color = 'rgba(232,180,94,0.4)'; }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
      </button>
      <span className="text-[10px] font-mono uppercase tracking-[0.25em]" style={{ color: 'rgba(255,255,255,0.25)' }}>Agent Profile</span>
    </div>
  </div>

  <div>
```
And close the outer `div` at the end (remove the old `</div>` for `relative z-10`).

- [ ] **Step 6: Replace circle avatar with square Avatar component**

In the Hero Banner section, find:
```tsx
<div className="w-20 h-20 flex items-center justify-center rounded-full" style={{ backgroundColor: GOLD }}>
  <span className="text-3xl font-bold text-black">{agent.agentName?.charAt(0) || 'A'}</span>
</div>
```
Replace with:
```tsx
<Avatar name={agent.agentName || agent.walletAddress.slice(0, 4)} />
```

- [ ] **Step 7: Tighten hero banner**

The hero banner `div` (the `mb-0` one with `backgroundColor: SURF`) already uses correct SURF color. Remove the `p-6` padding and change to `px-6 pt-6 pb-0`:
```tsx
<div className="mb-0" style={{ backgroundColor: SURF, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
  <div className="px-6 pt-6 pb-0 flex items-start gap-5">
```

- [ ] **Step 8: Update tab bar font style**

In the tab bar, update the tab button style to match predictions tab pattern. Find the `tabs.map` button and ensure:
```tsx
className="flex items-center gap-1.5 px-5 py-3.5 text-[11px] font-mono font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer"
style={{
  borderBottomColor: activeTab === tab.id ? GOLD : 'transparent',
  color: activeTab === tab.id ? GOLD : 'rgba(255,255,255,0.28)',
  marginBottom: '-1px',
}}
```
(Change `text-sm font-medium` → `text-[11px] font-mono font-bold uppercase tracking-wider`)

- [ ] **Step 9: Commit**
```bash
git add app/agents/\[id\]/page.tsx
git commit -m "feat(agent-profile): War Room polish — remove bg.png, square avatar, sticky header"
```

---

## Chunk 3: Arena Main — Kill Glassmorphism, Add Sub-nav

**Files:**
- Modify: `app/arena/page.tsx`

### Task 3: Arena page — remove glassmorphism panels, unify header, add sub-nav

The arena page uses `backdrop-blur-2xl` glass panels, old CSS vars, gradient dividers with `accent-primary`, and the header is inconsistent. We're removing all glassmorphism, replacing with flat SURF panels, and adding a sub-nav row linking to Predictions and Map.

- [ ] **Step 1: Add War Room constants and fix outer shell background**

Add at top of file after `'use client'`:
```ts
const GOLD  = '#E8B45E';
const YES_C = '#4ade80';
const NO_C  = '#f87171';
const BG    = '#07090F';
const SURF  = '#0C1020';
```

In `ArenaPage()`, replace the outer `div`:
```tsx
// OLD:
<div className="min-h-screen bg-bg-primary pt-18 sm:pt-20 pb-16 px-4 sm:px-[6%] lg:px-[10%] relative">
  <div className="fixed inset-0 z-0" style={{ background: 'radial-gradient(...)' }} />
  <div className="fixed inset-0 z-[1] ... bg-grid-pattern opacity-30" />
  <div className="relative z-10">
    {/* Header */}
    <div className="flex items-center justify-between mb-6 sm:mb-8 gap-2">

// NEW:
<div className="min-h-screen" style={{ background: BG }}>
  {/* Sticky sub-header */}
  <div className="sticky top-0 z-30 pt-16 sm:pt-[64px]" style={{ background: BG, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
    <div className="flex items-center gap-4 px-4 sm:px-6 py-3">
      <h1 className="text-base font-black tracking-tight text-white font-mono">ARENA</h1>
      {/* Sub-nav */}
      <div className="flex items-center gap-1 ml-4">
        <Link href="/arena/predictions"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
          style={{ border: '1px solid rgba(232,180,94,0.15)', color: 'rgba(232,180,94,0.45)' }}
          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(232,180,94,0.4)'; el.style.color = GOLD; }}
          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(232,180,94,0.15)'; el.style.color = 'rgba(232,180,94,0.45)'; }}
        >
          <Target className="w-3 h-3" /> Predictions
        </Link>
        <Link href="/arena/map"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
          style={{ border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}
          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(255,255,255,0.15)'; el.style.color = 'rgba(255,255,255,0.65)'; }}
          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.color = 'rgba(255,255,255,0.3)'; }}
        >
          <Map className="w-3 h-3" /> Map
        </Link>
      </div>
      {/* View toggle moves here */}
      <div className="ml-auto flex items-center gap-1">
        {/* ... existing view toggle buttons (discussions/classic) ... */}
      </div>
    </div>
  </div>

  <div className="px-4 sm:px-6 lg:px-8 py-6">
```

Add `Target` and `Map` to lucide imports. Remove `Swords` if no longer used.

- [ ] **Step 2: Fix the `TokenChip` component — remove old CSS vars**

In `TokenChip`, replace:
```tsx
// OLD:
className={`... border-accent-primary/50 bg-accent-primary/5 : border-white/[0.06] hover:bg-white/[0.03]`}
// and:
className="text-sm font-bold font-mono text-text-primary ..."
// and:
className="text-text-muted hover:text-text-secondary ..."

// NEW:
style={isSelected
  ? { border: `1px solid rgba(232,180,94,0.5)`, background: 'rgba(232,180,94,0.06)' }
  : { border: '1px solid rgba(255,255,255,0.07)' }
}
// token symbol text:
className="text-sm font-bold font-mono text-white/80 whitespace-nowrap"
// copy icon:
style={{ color: 'rgba(255,255,255,0.35)' }}
```

- [ ] **Step 3: Replace glassmorphism leaderboard panel in `ClassicArenaView`**

Find the leaderboard sidebar panel (line ~295):
```tsx
// OLD:
<div className="relative overflow-hidden bg-white/[0.025] backdrop-blur-2xl border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_40px_rgba(0,0,0,0.5),0_0_80px_rgba(245,158,11,0.03)] p-4 sm:p-5">
  {/* Gold accent glow */}
  {leaderboardTab === 'trades' && (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 w-40 h-24 pointer-events-none"
      style={{ background: 'radial-gradient(...)', filter: 'blur(16px)' }} />
  )}
```
Replace with:
```tsx
<div style={{ background: SURF, border: '1px solid rgba(255,255,255,0.06)' }} className="p-4 sm:p-5">
```
(Remove the gold glow div entirely.)

- [ ] **Step 4: Replace glassmorphism leaderboard panel in `ConversationsView` (right sidebar)**

Same fix at line ~429:
```tsx
// OLD:
<div className="relative overflow-hidden bg-white/[0.025] backdrop-blur-2xl border border-white/[0.07] shadow-[...] p-4">
  {leaderboardTab === 'trades' && <div className="absolute top-12 ..." />}

// NEW:
<div style={{ background: SURF, border: '1px solid rgba(255,255,255,0.06)' }} className="p-4">
```

- [ ] **Step 5: Replace gradient dividers with plain borders**

Find both vertical gradient dividers:
```tsx
// OLD:
<div className="hidden lg:flex justify-center">
  <div className="w-px h-full bg-gradient-to-b from-transparent via-accent-primary/30 to-transparent" />
</div>
```
Replace with:
```tsx
<div className="hidden lg:block w-px self-stretch" style={{ background: 'rgba(255,255,255,0.06)' }} />
```

Also replace horizontal gradient divider in `ClassicArenaView`:
```tsx
// OLD:
<div className="h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />
// NEW: remove entirely (borderBottom on panels is sufficient)
```

- [ ] **Step 6: Fix leaderboard tab buttons inside panels**

In both `ClassicArenaView` and `ConversationsView`, the leaderboard tab buttons use old CSS vars:
```tsx
// OLD:
className={`... ${tab === active ? 'text-accent-primary bg-accent-primary/10 border border-accent-primary/20' : 'text-text-muted hover:text-text-secondary'}`}

// NEW (inline style approach):
style={tab === active
  ? { color: GOLD, background: 'rgba(232,180,94,0.08)', border: '1px solid rgba(232,180,94,0.2)' }
  : { color: 'rgba(255,255,255,0.3)' }
}
```

- [ ] **Step 7: Fix header inner elements CSS vars**

In `ArenaPage()` header area (view toggle buttons), replace any remaining `text-accent-primary`, `text-text-primary`, `text-text-muted` with inline styles using the constants.

- [ ] **Step 8: Fix CommandCenterSection — remove old CSS vars**

In `CommandCenterSection`, the `text-text-primary` in page title and `text-text-muted` in subtitle need replacing:
```tsx
// OLD in dashboard header that lives in CommandCenterSection (now in arena):
<h1 className="text-xl sm:text-2xl font-bold text-text-primary">Command Center</h1>
<p className="text-xs sm:text-sm text-text-muted mt-0.5">...</p>

// NEW:
<h1 className="text-base font-black font-mono text-white tracking-tight">COMMAND CENTER</h1>
<p className="text-[11px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
  Your agent's data ingestion pipeline — each source is fully configurable.
</p>
```

- [ ] **Step 9: Commit**
```bash
git add app/arena/page.tsx
git commit -m "feat(arena): kill glassmorphism, War Room header + sub-nav to Predictions/Map"
```

---

## Chunk 4: Dashboard Components Polish

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `components/dashboard/AgentConfigPanel.tsx`
- Modify: `components/dashboard/AgentDataFlow.tsx` (CSS vars audit)

### Task 4: Dashboard — Audit and replace CSS vars in page + key components

The dashboard page has `text-text-primary`/`text-text-muted` in the header and uses a `BackgroundLayer` with colored radial glows. The `AgentConfigPanel` uses `text-accent-primary` and `text-text-primary` throughout. Note: **keep the RisingLines animation** — it's a deliberate aesthetic choice for the Command Center feel.

- [ ] **Step 1: Fix dashboard page header and outer shell**

In `app/dashboard/page.tsx`:

Add constants at top:
```ts
const GOLD = '#E8B45E';
const BG   = '#07090F';
```

Replace outer div background:
```tsx
// OLD:
<div className="min-h-screen pt-16 sm:pt-20 pb-8 px-4 sm:px-[8%] lg:px-[12%] relative">

// NEW:
<div className="min-h-screen pt-16 sm:pt-20 pb-8 px-4 sm:px-[8%] lg:px-[12%] relative" style={{ background: BG }}>
```

Fix page header text vars:
```tsx
// OLD:
<h1 className="text-xl sm:text-2xl font-bold text-text-primary">Command Center</h1>
<p className="text-xs sm:text-sm text-text-muted mt-0.5">Your agent&apos;s data ingestion pipeline...</p>

// NEW:
<h1 className="text-lg font-black font-mono text-white tracking-tight">COMMAND CENTER</h1>
<p className="text-[11px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
  Your agent&apos;s data ingestion pipeline — each source feeds real-time signals into your strategy.
</p>
```

Fix skeleton blocks (remove `rounded`):
```tsx
// OLD: className={`bg-white/[0.03] animate-pulse rounded ${className}`}
// NEW: className={`bg-white/[0.03] animate-pulse ${className}`}
```

- [ ] **Step 2: Remove colored radial glow orbs from BackgroundLayer**

In the `BackgroundLayer` component, remove the second `fixed inset-0 z-[1]` div that contains the blue/purple/cyan radial gradient orbs. Keep only the `RisingLines` div:
```tsx
// KEEP:
<div className="fixed inset-0 z-0">
  <div className="absolute inset-0 opacity-40">
    <RisingLines ... />
  </div>
</div>

// REMOVE entirely:
<div className="fixed inset-0 z-[1] overflow-hidden pointer-events-none">
  <div className="absolute top-[10%] left-[15%] ... bg-blue-500/5 ..." />
  <div className="absolute top-[45%] right-[10%] ... bg-indigo-500/4 ..." />
  <div className="absolute bottom-[5%] left-[35%] ... bg-cyan-500/3 ..." />
</div>
```

- [ ] **Step 3: Fix AgentConfigPanel — replace CSS vars**

In `components/dashboard/AgentConfigPanel.tsx`:

Add constants at top of file:
```ts
const GOLD = '#E8B45E';
```

In `ConfigSection` component:
```tsx
// OLD:
<Icon className="w-3.5 h-3.5 text-accent-primary" />
<span className="text-xs font-bold text-text-primary uppercase tracking-wider">{title}</span>

// NEW:
<Icon className="w-3.5 h-3.5" style={{ color: GOLD }} />
<span className="text-[10px] font-bold text-white font-mono uppercase tracking-[0.2em]">{title}</span>
```

In `ConfigSection` button:
```tsx
// OLD:
className="... bg-white/[0.02] hover:bg-white/[0.04] ..."
// NEW:
className="... hover:bg-white/[0.03] ..."
style={{ background: 'rgba(232,180,94,0.03)' }}
```

For `ChevronDown`:
```tsx
// OLD: className="w-3.5 h-3.5 text-text-muted ..."
// NEW: style={{ color: 'rgba(255,255,255,0.3)' }} className="w-3.5 h-3.5 ..."
```

Throughout the rest of `AgentConfigPanel.tsx`, do a search-and-replace pass:
- `text-text-primary` → `text-white`
- `text-text-muted` → remove class, add `style={{ color: 'rgba(255,255,255,0.35)' }}`
- `text-accent-primary` → remove class, add `style={{ color: GOLD }}`
- `bg-accent-primary/10` → `style={{ background: 'rgba(232,180,94,0.08)' }}`
- `border-accent-primary/20` → `style={{ borderColor: 'rgba(232,180,94,0.2)' }}`

- [ ] **Step 4: Quick audit of AgentDataFlow.tsx for CSS vars**

Open `components/dashboard/AgentDataFlow.tsx`. Search for `text-accent-primary`, `text-text-primary`, `text-text-muted`. Apply same replacement pattern as Step 3. Note: AgentDataFlow already uses mostly inline styles for its node colors — the audit may find few or no issues.

- [ ] **Step 5: Commit**
```bash
git add app/dashboard/page.tsx components/dashboard/AgentConfigPanel.tsx components/dashboard/AgentDataFlow.tsx
git commit -m "feat(dashboard): kill CSS vars + remove blue radial glows, keep RisingLines"
```

---

## Final Verification

- [ ] Run `npm run dev` (or `bun dev`) and navigate to all 4 pages
- [ ] Verify: no `backdrop-blur` visible anywhere
- [ ] Verify: no old CSS vars (check browser inspector for unresolved custom properties)
- [ ] Verify: all backgrounds are `#07090F` or `#0C1020`
- [ ] Verify: accent color is gold only — no blue, indigo, emerald bleeding in
- [ ] Verify: leaderboard rank badges match predictions arena leaderboard style
- [ ] Verify: agent profile has square avatar and sticky sub-header with back button
- [ ] Verify: arena main has sub-nav links to /predictions and /map
