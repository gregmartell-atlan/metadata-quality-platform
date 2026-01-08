# Dropdown Loading Issue - Root Cause Analysis & Fix

## Issue Description
The QuickContextSwitcher dropdown was stuck in "Loading connections..." state and never displayed the connection assets.

## Root Cause
**Primary Issue: Incorrect useEffect dependency array**

In `src/components/layout/QuickContextSwitcher.tsx` (line 116), the useEffect hook that loads connectors had `isLoadingConnectors` in its dependency array:

```typescript
useEffect(() => {
  if (!isOpen || connectors.length > 0 || isLoadingConnectors) return;

  let cancelled = false;
  setIsLoadingConnectors(true);
  getConnectors()
    .then(data => {
      if (!cancelled) setConnectors(data);
    })
    .catch(err => {
      if (!cancelled) console.error(err);
    })
    .finally(() => {
      if (!cancelled) setIsLoadingConnectors(false);
    });

  return () => { cancelled = true; };
}, [isOpen, connectors.length, isLoadingConnectors]); // ← PROBLEM: isLoadingConnectors in deps
```

### Why This Was a Problem
1. **Anti-pattern**: Internal effect state should NOT be in the dependency array
2. **Unnecessary re-renders**: When `isLoadingConnectors` changes, it triggers the effect to re-run
3. **Potential race conditions**: While the early return prevents duplicate API calls, having internal state as a dependency creates complexity and can lead to bugs
4. **Poor error visibility**: Errors were only logged to console, not shown to users

## The Fix

### 1. Removed `isLoadingConnectors` from dependency array
The effect should only depend on external values that determine when to load:
- `isOpen`: When the dropdown opens
- `connectors.length`: To prevent reloading if already loaded

```typescript
}, [isOpen, connectors.length]); // ✓ Only external dependencies
```

### 2. Added proper error handling
- Added `loadError` state to track API errors
- Display errors to users in the UI
- Improved error logging with descriptive messages

### 3. Better error visibility
```typescript
{loadError ? (
  <div className="error-state" style={{ color: 'var(--color-error, #e74c3c)', padding: '12px', textAlign: 'center' }}>
    <span>{loadError}</span>
  </div>
) : isLoadingConnectors ? (
  // ... loading state
) : (
  // ... content
)}
```

## Files Modified
- `src/components/layout/QuickContextSwitcher.tsx`

## Changes Made
1. Line 116: Removed `isLoadingConnectors` from useEffect dependency array
2. Line 43: Added `loadError` state
3. Lines 105-118: Enhanced error handling in getConnectors promise chain
4. Lines 249-252: Added error UI display

## Testing
- ✅ Build succeeds without errors
- ✅ TypeScript compilation passes
- ✅ No linting errors

## Expected Behavior After Fix
1. When dropdown opens, connectors load properly
2. If loading fails, error message is displayed to user
3. No infinite re-render loops or stuck loading states
4. Better debugging with improved error messages

## Related Patterns to Watch For
This is a common React anti-pattern. Watch for:
- Setting state inside useEffect and including that state in dependencies
- Internal effect state being treated as external dependencies
- Always ask: "Does this effect need to re-run when this state changes?"

## Prevention
Use ESLint rule `react-hooks/exhaustive-deps` carefully:
- Don't blindly add all values it suggests
- Internal state managed by the effect itself should NOT be in deps
- Only add external values that should trigger re-execution
