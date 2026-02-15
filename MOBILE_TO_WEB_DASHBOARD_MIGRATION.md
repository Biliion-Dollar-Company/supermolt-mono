# Mobile → Web Dashboard UI Migration Plan

**Goal:** Port mobile app's beautiful UI/UX to web dashboard for full agent configuration

---

## 📱 Mobile UI Components to Port

### 1. **ArchetypeCard** (`mobile/src/components/onboarding/ArchetypeCard.tsx`)
**What it does:**
- Visual archetype selection cards
- Emoji + name + description
- Stat bars with dynamic colors (green/yellow/gray based on value)
- Selected state with brand-primary border + badge

**What to port:**
```tsx
// Mobile Component Features:
- Emoji display (32px, centered)
- Name (bold, centered)
- Description (2 lines max, muted)
- 3-4 stat bars with labels + percentage
- Dynamic bar colors (>70% = green, >40% = yellow, else gray)
- Selected state (border-2 + background tint + "Selected" badge)
```

**Web equivalent:**
- Use shadcn/ui Card component as base
- Add stat progress bars with color logic
- Hover/click states with transitions
- Responsive grid layout

---

### 2. **AgentCard** (`mobile/src/components/home/AgentCard.tsx`)
**What it does:**
- Agent avatar with active ring glow
- Name + status (Active/Paused)
- Fallback gradient avatar with initials
- Green glowing ring when active

**What to port:**
```tsx
// Mobile Component Features:
- 56x56px avatar with 2px brand-primary ring (when active)
- Green glowing shadow effect (#c4f70e)
- Active indicator dot (bottom-right, 12x12px)
- Fallback gradient background (#c4f70e → #68ac6e)
- Initials (2 letters, white, bold)
- Status text ("Active • Trading" or "Paused")
```

**Web equivalent:**
- CSS box-shadow for glow effect
- Framer Motion for smooth ring animation
- Next.js Image for avatar
- Gradient background with CSS

---

### 3. **WatchlistChips** (`mobile/src/components/home/WatchlistChips.tsx`)
**What it does:**
- Horizontal scrollable chips for tracked wallets
- Each chip shows wallet badge/name
- Add/remove functionality

**What to port:**
```tsx
// Likely features:
- ScrollView horizontal (web: overflow-x-scroll)
- Chip with icon + truncated address
- Add button (+) to add new wallet
- Remove icon (x) on hover
```

**Web equivalent:**
- Horizontal flex with scroll
- shadcn/ui Badge components
- Dialog for adding wallets
- Smooth scroll behavior

---

### 4. **PnLChart** (`mobile/src/components/home/PnLChart.tsx`)
**What it does:**
- Visual PnL chart/graph
- Likely sparkline or area chart

**What to port:**
- Recharts or Chart.js for web
- Green/red colors based on profit/loss
- Responsive sizing

---

### 5. **TerminalLog** (`mobile/src/components/home/TerminalLog.tsx`)
**What it does:**
- Terminal-style log output
- Recent agent actions/decisions

**What to port:**
- Monospace font (JetBrains Mono)
- Dark terminal aesthetic
- Auto-scroll to bottom
- Syntax highlighting (optional)

---

### 6. **PositionCard** (`mobile/src/components/trading/PositionCard.tsx`)
**What it does:**
- Shows open position details
- Token avatar, symbol, amount
- PnL (profit/loss) with color coding

**What to port:**
- Card with token branding
- Color-coded PnL (green/red)
- Action buttons (close position, etc.)

---

### 7. **ProgressBar** (`mobile/src/components/trading/ProgressBar.tsx`)
**What it does:**
- Visual progress indicator
- Used for milestones/goals

**What to port:**
- shadcn/ui Progress component
- Custom styling to match mobile
- Animated fill

---

### 8. **TokenAvatar** (`mobile/src/components/trading/TokenAvatar.tsx`)
**What it does:**
- Token logo with fallback
- Likely uses DexScreener/Birdeye API

**What to port:**
- Image with error handling
- Gradient fallback with symbol
- Circular shape

---

## 🎨 Design System Migration

### Colors (from mobile theme)
```tsx
// Mobile colors to match in web:
Brand Primary: #68ac6e (SuperRouter Green)
Brand Secondary: #9945ff (Solana Purple)
Brand Accent: #c4f70e (Matrix Green/Neon)

Surface Primary: #0f0f0f (almost black)
Surface Secondary: #1a1a1a
Surface Tertiary: #27272a

Text Primary: #fafafa (white)
Text Secondary: #a1a1aa (light gray)
Text Muted: #71717a (medium gray)

Status Success: #22c55e
Status Error: #ef4444
Status Warning: #f59e0b
```

**Action:** Update `web/src/index.css` CSS variables to match mobile exactly.

---

## 📋 New Features to Build

### 1. **Agent Configuration Panel**
**Located:** `/dashboard/configure` or `/dashboard` tab

**Components needed:**
- `ArchetypeSelector.tsx` - Port from mobile ArchetypeCard
- `TrackedWalletsConfig.tsx` - Wallet address input/chips
- `BuyTriggersConfig.tsx` - Trigger rules UI
- `AgentSettingsForm.tsx` - Other agent parameters

**UI Flow:**
```
┌─────────────────────────────────────┐
│ Agent Configuration                 │
├─────────────────────────────────────┤
│                                     │
│ 1. Select Archetype                 │
│    [Card] [Card] [Card] [Card]      │
│                                     │
│ 2. Tracked Wallets                  │
│    [Chip] [Chip] [Chip] [+ Add]     │
│                                     │
│ 3. Buy Triggers                     │
│    ☑ When 2+ wallets buy same token │
│    ☑ When god wallet buys >$10k     │
│    ☐ When volume >$100k in 1h       │
│                                     │
│ 4. Risk Parameters                  │
│    Max position size: [____] SOL    │
│    Stop loss: [____] %              │
│                                     │
│ 5. Trading Preferences              │
│    Auto-sign trades: [Toggle]       │
│    Notifications: [Toggle]          │
│                                     │
│ [Save Configuration]                │
└─────────────────────────────────────┘
```

---

### 2. **Tracked Wallets Manager**
**Component:** `TrackedWalletsConfig.tsx`

**Features:**
- Add wallet (paste address or ENS/name lookup)
- Remove wallet (x icon)
- Wallet labels/nicknames
- Import from list (god wallets, top traders, etc.)
- Activity indicator (has this wallet traded recently?)

**UI Mock:**
```tsx
<Card>
  <h3>Tracked Wallets</h3>
  <p className="text-muted">
    Agent monitors these wallets for trading signals
  </p>

  <div className="flex gap-2 flex-wrap mt-4">
    {wallets.map(wallet => (
      <Badge key={wallet.address} variant="secondary">
        <WalletIcon />
        <span>{wallet.label || truncate(wallet.address)}</span>
        <X onClick={() => remove(wallet.address)} />
      </Badge>
    ))}
    <Button onClick={openAddDialog}>
      <Plus /> Add Wallet
    </Button>
  </div>

  <Dialog>
    <Input placeholder="Paste wallet address or name" />
    <Input placeholder="Label (optional)" />
    <Button>Add</Button>
  </Dialog>
</Card>
```

---

### 3. **Buy Triggers Configuration**
**Component:** `BuyTriggersConfig.tsx`

**Trigger Types:**
- **Consensus Buy:** X out of Y tracked wallets buy same token within Z minutes
- **Volume Spike:** Token volume >X in last Y minutes
- **Liquidity Gate:** Only buy if liquidity >$X
- **God Wallet:** Specific wallet buys >$X amount
- **Social Signal:** X mentions on Twitter in Y minutes
- **Custom Logic:** (future: AI-generated conditions)

**UI Mock:**
```tsx
<Card>
  <h3>Buy Triggers</h3>
  <p>Agent automatically buys when these conditions are met</p>

  <div className="space-y-4">
    <TriggerRule
      type="consensus"
      label="Consensus Buy"
      description="When multiple tracked wallets buy the same token"
    >
      <Select value={walletCount}>
        <option>2 wallets</option>
        <option>3 wallets</option>
        <option>5 wallets</option>
      </Select>
      <span>within</span>
      <Input type="number" value={minutes} />
      <span>minutes</span>
    </TriggerRule>

    <TriggerRule
      type="volume"
      label="Volume Spike"
      description="When token volume exceeds threshold"
    >
      <Input type="number" value={volumeThreshold} />
      <span>USD in last</span>
      <Select value={timeWindow}>
        <option>5 minutes</option>
        <option>15 minutes</option>
        <option>1 hour</option>
      </Select>
    </TriggerRule>

    <Button variant="outline">
      <Plus /> Add Custom Trigger
    </Button>
  </div>
</Card>
```

---

## 🎯 Implementation Plan

### Phase 1: Port Core UI Components (Week 1)
1. ✅ **AgentCard.tsx** - Avatar with active ring
2. ✅ **ArchetypeCard.tsx** - Archetype selector cards
3. ✅ **StatBar.tsx** - Progress bars with dynamic colors
4. ✅ **TokenAvatar.tsx** - Token logo component
5. ✅ **Update CSS variables** - Match mobile colors exactly

**Deliverable:** Reusable component library ready

---

### Phase 2: Agent Configuration UI (Week 1-2)
1. ✅ **ArchetypeSelector.tsx** - Grid of archetype cards
2. ✅ **TrackedWalletsConfig.tsx** - Wallet chips + add/remove
3. ✅ **BuyTriggersConfig.tsx** - Trigger rule builder
4. ✅ **RiskParametersForm.tsx** - Sliders/inputs for limits
5. ✅ **AgentPreferencesForm.tsx** - Toggles for settings

**Deliverable:** Full configuration panel

---

### Phase 3: Backend Integration (Week 2)
1. ✅ **API endpoints:**
   - `PUT /arena/me/config` - Save agent configuration
   - `GET /arena/me/config` - Load configuration
   - `POST /arena/wallets` - Add tracked wallet
   - `DELETE /arena/wallets/:id` - Remove wallet
   - `POST /arena/triggers` - Create trigger rule
   - `PUT /arena/triggers/:id` - Update trigger
   - `DELETE /arena/triggers/:id` - Delete trigger

2. ✅ **Database schema updates:**
   ```prisma
   model TradingAgent {
     // ... existing fields
     config Json @default("{}")  // Already exists!
   }

   model TrackedWallet {
     id        String   @id @default(cuid())
     agentId   String
     address   String
     label     String?
     chain     Chain    @default(SOLANA)
     createdAt DateTime @default(now())

     agent TradingAgent @relation(fields: [agentId], references: [id], onDelete: Cascade)

     @@unique([agentId, address, chain])
     @@index([agentId])
     @@map("tracked_wallets")
   }

   model BuyTrigger {
     id          String   @id @default(cuid())
     agentId     String
     type        String   // "consensus", "volume", "liquidity", "godwallet"
     enabled     Boolean  @default(true)
     config      Json     // Type-specific configuration
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt

     agent TradingAgent @relation(fields: [agentId], references: [id], onDelete: Cascade)

     @@index([agentId])
     @@index([agentId, enabled])
     @@map("buy_triggers")
   }
   ```

---

### Phase 4: Testing & Polish (Week 2)
1. ✅ **Visual regression testing** - Compare to mobile
2. ✅ **Responsive design** - Mobile/tablet/desktop
3. ✅ **Accessibility** - Keyboard navigation, ARIA
4. ✅ **Performance** - Lazy loading, code splitting

---

## 🎨 Component Mapping Table

| Mobile Component | Web Component | Location | Status |
|-----------------|---------------|----------|--------|
| ArchetypeCard | ArchetypeCard.tsx | /dashboard/components | ⏳ TODO |
| AgentCard | AgentAvatar.tsx | /dashboard/components | ⏳ TODO |
| WatchlistChips | WalletChips.tsx | /dashboard/components | ⏳ TODO |
| PnLChart | PnLChart.tsx | /dashboard/components | ⏳ TODO |
| TerminalLog | TerminalLog.tsx | /dashboard/components | ⏳ TODO |
| PositionCard | PositionCard.tsx | /arena/components | ⏳ TODO |
| ProgressBar | StatBar.tsx | /dashboard/components | ⏳ TODO |
| TokenAvatar | TokenAvatar.tsx | /dashboard/components | ⏳ TODO |

---

## 📁 File Structure (New)

```
web/
├── app/
│   └── dashboard/
│       ├── page.tsx              # Main dashboard (existing)
│       ├── configure/
│       │   └── page.tsx          # Agent configuration page
│       └── components/
│           ├── AgentAvatar.tsx   # Port from mobile AgentCard
│           ├── ArchetypeCard.tsx # Port from mobile
│           ├── ArchetypeSelector.tsx
│           ├── TrackedWalletsConfig.tsx
│           ├── BuyTriggersConfig.tsx
│           ├── RiskParametersForm.tsx
│           ├── StatBar.tsx       # Port from mobile ProgressBar
│           ├── TokenAvatar.tsx   # Port from mobile
│           ├── WalletChips.tsx   # Port from mobile WatchlistChips
│           ├── PnLChart.tsx      # Port from mobile
│           └── TerminalLog.tsx   # Port from mobile
│
├── components/
│   └── ui/                       # shadcn/ui (existing)
│
└── lib/
    └── api/
        └── agent-config.ts       # API client for configuration
```

---

## 🚀 Getting Started (Next Steps)

1. **Port AgentCard first** - Visual identity of agent
2. **Port ArchetypeCard** - Archetype selection is core UX
3. **Build TrackedWalletsConfig** - Most requested feature
4. **Build BuyTriggersConfig** - Core automation feature
5. **Wire up backend** - Persistence layer

**Estimated time:** 1-2 weeks for full migration

---

**Created:** Feb 12, 2026
**Status:** Planning phase - Ready to implement
