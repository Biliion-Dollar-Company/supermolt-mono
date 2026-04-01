# War Room UI Changes - Feb 23, 2026

## ✅ Changes Applied

### 1. **Bigger Token Images**
- **Collapsed:** 28px → **36px** (+29% larger)
- **Expanded:** 26px → **32px** (+23% larger)

### 2. **Chain Badge Overlay**
**Before:**
- Chain badge was in bottom-left corner of card container

**After:**
- Chain badge now overlays **top-right corner of token image**
- **Collapsed:** 6px radius circle
- **Expanded:** 7px radius circle
- Improved contrast: 1.2px black border (80% opacity)

### 3. **Removed Card Container/Border**
**Removed:**
- Background box (`cBox`) — no more dark container
- Fancy border (`cBorder`) — no more outlined edges

**Result:**
- **Floating token images** with chain badge overlay
- Ticker text below image (slightly larger: 9px)
- Cleaner, more minimal look
- Glow only around image (not old container)

### 4. **Adjusted Positioning**
- Image now centered vertically (no top padding from removed container)
- "NEW" badge repositioned above image (top-right)
- Dot indicator repositioned below image
- Coordination ring scaled to match smaller footprint
- Chat icon positioned at top-right of image

### 5. **Glow Enhancement**
- Glow now wraps tightly around image only
- Slightly stronger opacity (since smaller area)
- Smooth interpolation from collapsed → expanded states

---

## Visual Comparison

**Before:**
```
┌─────────────────┐
│  [Container]    │  ← Dark background box
│   ┌──────┐      │
│   │ IMG  │      │  ← 28px image
│   └──────┘      │
│   $TOKEN        │  ← Ticker
│  [S]            │  ← Chain badge (corner)
└─────────────────┘
```

**After:**
```
    ┌──────┐ [S]      ← Chain badge overlays image
    │ IMG  │          ← 36px image (floating)
    └──────┘
    $TOKEN           ← Ticker below
```

---

## Files Modified

**File:** `web/components/war-room/systems/station-manager.ts`

**Lines changed:** ~15 edits across:
- Size constants (C_IMG, E_IMG)
- Chain badge positioning (collapsed + expanded)
- Container rendering (removed cBox, cBorder)
- Glow sizing
- Dot positioning
- Animation interpolation

---

## Testing

**How to test:**
1. Navigate to https://www.trench-terminal.com/war-room
2. Refresh page (hard refresh: Cmd+Shift+R)
3. Verify:
   - ✅ Token images are **bigger**
   - ✅ Chain badges **overlay top-right of images**
   - ✅ No dark container boxes around images
   - ✅ Images float cleanly on tunnel background
   - ✅ Expanded cards still work (click to expand)

**Expected result:**
- Cleaner, more modern look
- Chain badges clearly visible over images
- Tokens stand out more against background

---

## Rollback (if needed)

If you need to revert:
```bash
cd /Users/henry/Documents/Gazillion-dollars/Ponzinomics/use-case-apps/trench-terminal/web
git diff components/war-room/systems/station-manager.ts
git checkout components/war-room/systems/station-manager.ts  # revert
```

---

**Changes completed:** Feb 23, 2026 21:10 Sofia  
**Agent:** Orion
