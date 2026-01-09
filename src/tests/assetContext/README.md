# Asset Context Testing & Verification Guide

## Quick Start

### Run Verification in Browser Console

```javascript
// Verify all components are properly subscribed
verifyAssetContext()

// Run performance benchmarks
benchmarkAssetContext(100)

// Access subscription tracker
window.__assetContextSubscriptionTracker.getStatistics()

// Access performance monitor
window.__assetContextPerformanceMonitor.getAllReports()

// Access component verifier
window.__assetContextComponentVerifier.getReport()
```

## Testing Suite

### Unit Tests

Run all asset context tests:

```bash
npm test src/tests/assetContext
```

### Test Files

1. **`assetContext.test.tsx`** - Basic store operations and component integration
2. **`edgeCases.test.tsx`** - Edge cases, race conditions, error scenarios
3. **`componentIntegration.test.tsx`** - Component subscription and update verification

## Component Verification Checklist

### ✅ Verified Components

- [x] **AssetContext** - Sets and manages context
- [x] **Scorecard** - Subscribes to `contextAssets`, calculates scores
- [x] **StatsRow** - Subscribes to `contextAssets`, calculates statistics
- [x] **PreBuiltPivots** - Subscribes to `contextAssets`, builds pivot tables
- [x] **RealPivotBuilder** - Subscribes to `contextAssets` (with fallback)
- [x] **LineageViewPage** - Subscribes to `contextAssets` (with fallback)
- [x] **PivotBuilder** - Subscribes to `contextAssets` (with fallback)

## Performance Benchmarks

### Expected Performance

- **setContext**: < 1ms for < 1000 assets
- **setContextAssets**: < 1ms for < 1000 assets
- **clearContext**: < 0.5ms
- **Component re-render**: < 16ms (60fps target)
- **Calculation**: < 100ms for typical operations

### Running Benchmarks

```javascript
// In browser console
benchmarkAssetContext(100) // Run 100 iterations
```

## Edge Cases Tested

### ✅ Covered Edge Cases

1. **Empty Assets Array** - Components show appropriate empty states
2. **Large Asset Arrays** - Performance tested up to 50,000 assets
3. **Rapid Context Changes** - Race conditions handled by Zustand batching
4. **Concurrent Updates** - Atomic updates ensure consistency
5. **Component Unmounting** - Automatic cleanup on unmount
6. **Invalid Data** - Graceful handling of missing/null fields
7. **Duplicate GUIDs** - Store accepts, components handle as needed
8. **Persistence** - Context persists, assets reload on refresh
9. **Manual Context** - Assets lost on refresh (documented limitation)
10. **Memory Leaks** - No retained references to old assets

## Debugging

### Enable Detailed Logging

All operations are logged with the `logger` utility. Check browser console for:

- `[AssetContextStore]` - Store operations
- `[SubscriptionTracker]` - Component subscriptions
- `[PerformanceMonitor]` - Performance metrics
- `[ComponentVerifier]` - Component verification

### Get Comprehensive Report

```javascript
// In browser console
const report = window.__assetContextComponentVerifier.getReport()
console.log(report)
```

### Check for Issues

```javascript
// Subscription issues
window.__assetContextSubscriptionTracker.diagnose()

// Performance issues
window.__assetContextPerformanceMonitor.diagnosePerformance()
```

## Common Issues & Solutions

### Issue: Component not updating

**Check:**
1. Component uses `useAssetContextStore()` hook
2. Component subscribes to `contextAssets` or `context`
3. Component has proper dependency array in `useEffect`

**Solution:**
```typescript
// Correct subscription
const { contextAssets } = useAssetContextStore();

// Correct effect dependency
useEffect(() => {
  // Use contextAssets
}, [contextAssets]);
```

### Issue: Excessive re-renders

**Check:**
1. Use selective subscriptions
2. Memoize expensive calculations
3. Check for unnecessary dependencies

**Solution:**
```typescript
// Selective subscription (only re-renders when contextAssets changes)
const contextAssets = useAssetContextStore((state) => state.contextAssets);

// Memoize calculations
const result = useMemo(() => {
  return expensiveCalculation(contextAssets);
}, [contextAssets]);
```

### Issue: Calculations not updating

**Check:**
1. Calculation depends on `contextAssets` in `useEffect`
2. Calculation runs when `contextAssets.length > 0`

**Solution:**
```typescript
useEffect(() => {
  if (contextAssets.length > 0) {
    performCalculation(contextAssets);
  }
}, [contextAssets]);
```

## Performance Optimization

### Best Practices

1. **Selective Subscriptions**: Only subscribe to fields you need
2. **Memoization**: Use `useMemo` for expensive calculations
3. **Batching**: Batch multiple context updates when possible
4. **Virtualization**: Consider virtualization for large lists (>1000 items)

### Monitoring

Monitor performance in production:

```javascript
// Get performance report
const reports = window.__assetContextPerformanceMonitor.getAllReports()
console.table(reports)
```

## Testing in Development

### Add Verification to Component

```typescript
import { useAssetContextVerification } from '../utils/assetContextComponentVerifier';

function MyComponent() {
  const { contextAssets, context } = useAssetContextVerification(
    'MyComponent',
    ['contextAssets', 'context']
  );
  
  // Component logic
}
```

### Run Verification Script

```typescript
import { verifyAssetContext } from '../scripts/verifyAssetContext';

// In your app initialization
verifyAssetContext();
```

## Continuous Monitoring

### Production Monitoring

1. Log performance metrics to analytics
2. Monitor component render counts
3. Track calculation durations
4. Alert on performance degradation

### Health Checks

```javascript
// Check subscription health
const stats = window.__assetContextSubscriptionTracker.getStatistics()
if (stats.totalSubscriptions === 0) {
  console.warn('No components subscribed to asset context')
}

// Check performance
const diagnosis = window.__assetContextPerformanceMonitor.diagnosePerformance()
if (diagnosis.issues.length > 0) {
  console.warn('Performance issues detected', diagnosis.issues)
}
```

## Documentation

See `src/docs/ASSET_CONTEXT_REVIEW.md` for comprehensive architecture and design documentation.





