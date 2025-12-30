# Testing Checklist: Global Asset Context System

## Engineering Perspective - Technical Correctness

### ✅ Core Functionality
- [x] AssetContext store created and persists correctly
- [x] AssetContext component renders and accepts drag/drop
- [x] AssetBrowser shows connections as top-level nodes
- [x] All views use context assets with fallback to selectedAssets
- [x] Drag/drop data format compatibility verified
- [x] Error handling for edge cases added

### ⚠️ Edge Cases to Test
- [ ] No connectors available - should show helpful message
- [ ] API failures - should show error, not crash
- [ ] Empty context - views should show appropriate empty states
- [ ] Very large datasets (All Assets mode) - may need pagination
- [ ] Context persistence across page navigation
- [ ] Multiple rapid context changes - should handle gracefully

### 🔍 Code Quality Checks
- [x] No TypeScript errors
- [x] No linter errors
- [x] Proper error boundaries
- [x] Loading states implemented
- [ ] Memory leaks (check useEffect cleanup)
- [ ] Performance (large asset lists)

## Data Steward Perspective - Usability & Workflow

### ✅ User Workflows
- [x] Can drag connection from AssetBrowser to set context
- [x] Can drag database/schema to set context
- [x] Can select "All Assets" from dropdown
- [x] Can select specific connection from dropdown
- [x] Can clear context
- [x] Context label shows clearly (e.g., "Snowflake > WideWorldImporters")
- [x] Asset count displays correctly

### ⚠️ Workflow Issues to Verify
- [ ] Context persists when navigating between pages
- [ ] All views update immediately when context changes
- [ ] Empty states are clear and actionable
- [ ] Error messages are user-friendly
- [ ] Loading indicators show during asset loading
- [ ] Can still manually select assets (backward compatibility)

### 📊 Data Accuracy
- [ ] Context shows correct asset count
- [ ] Pivot tables show correct data for context
- [ ] Scorecard shows correct scores for context assets
- [ ] No duplicate assets in context
- [ ] Filtering works correctly (hierarchy filter + context)

## New User Perspective - Discoverability & Clarity

### ✅ Onboarding
- [x] AssetContext component has visual hint when empty
- [x] Drag/drop visual feedback (drag-over state)
- [x] Clear labels and icons
- [x] Context selector dropdown is discoverable

### ⚠️ Clarity Issues to Address
- [ ] Tooltip/help text explaining what context does
- [ ] First-time user guidance (maybe a tour?)
- [ ] Clear distinction between "context" and "selected assets"
- [ ] Help text for "All Assets" mode (may be slow)
- [ ] Visual indication when context is loading

### 🎯 User Experience
- [ ] Context changes are obvious (visual feedback)
- [ ] Can undo/clear context easily
- [ ] Error messages explain what went wrong and how to fix
- [ ] Loading states don't block UI unnecessarily
- [ ] Empty states guide user to next action

## Test Scenarios

### Scenario 1: First-Time User
1. Open app → See empty context header
2. Drag connection from AssetBrowser → Context sets, views update
3. Navigate to Pivot Builder → Context persists
4. Change context → All views update

### Scenario 2: Data Steward Workflow
1. Set context to "All Assets" → Wait for loading
2. Apply hierarchy filter in Pivot Builder → Filtered view shows
3. Change context to specific connection → Filter resets appropriately
4. Save pivot view → Context is saved with view

### Scenario 3: Error Handling
1. Try to set context when not connected → See helpful error
2. Try "All Assets" with no connectors → See appropriate message
3. API fails during loading → Error shown, app doesn't crash
4. Clear context → Views show empty states correctly

### Scenario 4: Performance
1. Set context to connection with 1000+ assets → Should load reasonably
2. Switch contexts rapidly → Should handle gracefully
3. "All Assets" with large dataset → May need optimization

## Known Issues / Future Improvements

1. **All Assets Mode**: May be slow with very large datasets - consider:
   - Pagination
   - Lazy loading
   - Progress indicators
   - Option to limit asset types

2. **Context Persistence**: Currently persists in localStorage - verify:
   - Works across browser sessions
   - Doesn't cause issues with stale data
   - Can be cleared if needed

3. **Backward Compatibility**: 
   - Manual asset selection still works
   - Old pivot views may need migration
   - Consider deprecation path

4. **Performance Optimizations**:
   - Debounce rapid context changes
   - Cache computed pivot data
   - Virtual scrolling for large asset lists






