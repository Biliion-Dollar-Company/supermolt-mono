# Quality Checklist

Use this checklist before marking any milestone as COMPLETED.

## Code Quality

### TypeScript
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No `any` types used
- [ ] All props have explicit interfaces
- [ ] Proper null/undefined handling

### Linting
- [ ] ESLint passes (`npm run lint`)
- [ ] No console.log statements in production code
- [ ] Consistent import ordering

### Components
- [ ] Uses design system components (`@/components/ui`)
- [ ] Uses theme colors (`@/theme/colors`)
- [ ] No hardcoded colors or magic numbers
- [ ] Proper loading state handling
- [ ] Proper error state handling

## Functionality

### User Experience
- [ ] Feature works as expected
- [ ] Smooth animations (60fps)
- [ ] Responsive to user input
- [ ] Appropriate feedback for actions

### Edge Cases
- [ ] Handles empty states
- [ ] Handles error states
- [ ] Handles loading states
- [ ] Handles network failures gracefully

## Platform Testing

### iOS
- [ ] Works on iOS Simulator
- [ ] Safe area handled correctly
- [ ] Gestures work as expected

### Android (if available)
- [ ] Works on Android Emulator
- [ ] Back button behavior correct
- [ ] Navigation patterns follow platform conventions

## Security

- [ ] No sensitive data in logs
- [ ] Auth tokens handled securely
- [ ] Input validation where needed

## Performance

- [ ] No unnecessary re-renders
- [ ] Large lists use FlatList/FlashList
- [ ] Images optimized
- [ ] No memory leaks (cleanup in useEffect)

---

## Quick Validation Commands

```bash
# TypeScript check
npm run typecheck

# Lint check
npm run lint

# Start dev server
npm run dev

# Run on iOS
npm run ios
```

## Milestone Completion

Only mark a milestone as COMPLETED when:
1. All relevant checklist items pass
2. Feature is tested on at least iOS
3. TypeScript and ESLint pass
4. Design system is followed
