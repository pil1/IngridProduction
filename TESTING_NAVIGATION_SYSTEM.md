# Testing the Navigation System Refactored Pages

## 🧪 Quick Test Guide

### Step 1: Swap the Files

```bash
# Backup the original
mv src/pages/EnhancedExpensesPage.tsx src/pages/EnhancedExpensesPage.backup.tsx

# Use the refactored version
mv src/pages/EnhancedExpensesPage.refactored.tsx src/pages/EnhancedExpensesPage.tsx
```

### Step 2: Fix Any Import Issues

The refactored version uses new imports. Check for any errors:

```bash
# Check for TypeScript errors
npx tsc --noEmit

# If errors, fix the import paths in the file
```

### Step 3: Start Development Server

```bash
# Cloud development (recommended)
docker-compose -f docker-compose.dev.yml up -d

# Then access at https://dev.onbb.ca:8443
```

### Step 4: Test These Features

#### ✅ Tab Navigation
1. Navigate to `/expenses`
2. Click different tabs (All, Pending, Approved, etc.)
3. **Expected**: URL changes to `/expenses?tab=pending`
4. **Expected**: Refresh page - tab selection persists
5. **Expected**: Browser back button works correctly

#### ✅ Breadcrumbs (if implemented)
1. Look for breadcrumb trail at top
2. Click breadcrumb links
3. **Expected**: Navigate to correct pages

#### ✅ Filters
1. Click "Filters" button in header
2. Use quick filters (Today, This Week, etc.)
3. Use advanced filters (Status, Category, Submitter)
4. **Expected**: Active filters show as badges
5. **Expected**: Clear individual filters works
6. **Expected**: "Clear all" removes all filters

#### ✅ Actions
1. Check action buttons in header (Add Expense, Export, etc.)
2. Select some expenses
3. **Expected**: Bulk action toolbar appears
4. **Expected**: Individual action buttons hide when bulk selected

#### ✅ Search
1. Type in search box
2. **Expected**: Results filter in real-time
3. **Expected**: Active search shows in filter badges

#### ✅ Mobile Responsiveness
1. Resize browser to mobile size (< 768px)
2. **Expected**: Tabs scroll horizontally
3. **Expected**: Filters move to drawer/collapse
4. **Expected**: Table switches to card view (if implemented)

#### ✅ Performance
1. Switch between tabs rapidly
2. **Expected**: Smooth transitions
3. **Expected**: No flickering or layout shifts
4. **Expected**: Data loads quickly

### Step 5: Check Console for Errors

```bash
# Open browser console (F12)
# Check for:
# - Red errors (fix immediately)
# - Yellow warnings (review and fix if critical)
# - Network errors (check API calls)
```

### Step 6: Rollback if Needed

```bash
# If issues found, rollback
mv src/pages/EnhancedExpensesPage.tsx src/pages/EnhancedExpensesPage.refactored.tsx
mv src/pages/EnhancedExpensesPage.backup.tsx src/pages/EnhancedExpensesPage.tsx
```

## 🐛 Common Issues & Fixes

### Issue 1: Import Errors
```typescript
// ❌ Error: Cannot find module '@/components/layouts'
// ✅ Fix: Verify the file exists at src/components/layouts/index.ts

// If missing, you may need to use direct imports:
import { TabbedPageLayout } from '@/components/layouts/TabbedPageLayout';
```

### Issue 2: Type Errors
```typescript
// ❌ Error: Type 'string' is not assignable to type 'TabId'
// ✅ Fix: Use const assertion for tab IDs
const TAB_IDS = ['all', 'pending', 'approved'] as const;
type TabId = typeof TAB_IDS[number];
```

### Issue 3: Query Import Path
```typescript
// ❌ Error: Cannot find '@tanstack/react-query'
// ✅ Fix: Check your package.json - might be '@tanstack/react-query' or 'react-query'
import { useQuery } from "@tanstack/react-query"; // v5
// OR
import { useQuery } from "react-query"; // v3
```

### Issue 4: Missing Components
```typescript
// ❌ Error: Cannot find EnhancedButton
// ✅ Fix: Verify MynaUI components exist
import { EnhancedButton } from '@/components/myna/elements/enhanced-button';

// If missing, use regular Button temporarily:
import { Button } from '@/components/ui/button';
```

### Issue 5: Tab Content Not Rendering
```typescript
// ❌ Issue: Tabs exist but content is blank
// ✅ Fix: Check that TabPanel wraps the content:
content: (
  <TabPanel loading={isLoading} error={error}>
    <YourComponent />
  </TabPanel>
)
```

## 📋 Testing Checklist

Before marking as complete, verify:

- [ ] All tabs are clickable and render content
- [ ] URL parameter updates when changing tabs (?tab=pending)
- [ ] Page refresh preserves tab selection
- [ ] Browser back/forward buttons work
- [ ] Search filters data correctly
- [ ] Quick filters apply correctly
- [ ] Advanced filters work
- [ ] Active filter badges display
- [ ] Clear filter works (individual and all)
- [ ] Primary action button works (Add Expense, etc.)
- [ ] Secondary actions work (Export, Import, etc.)
- [ ] Bulk selection shows bulk action toolbar
- [ ] Bulk actions work correctly
- [ ] Loading states display properly
- [ ] Error states display properly
- [ ] Empty states display properly
- [ ] Mobile view is responsive
- [ ] No console errors
- [ ] No console warnings (major ones)
- [ ] Performance is good (no lag)

## 🎯 Performance Benchmarks

Expected performance:

- **Initial Load**: < 2 seconds
- **Tab Switch**: < 200ms
- **Filter Apply**: < 100ms
- **Search Results**: < 300ms

If slower, investigate:

1. Check network tab for slow API calls
2. Check React DevTools for unnecessary re-renders
3. Verify memoization is working (useMemo, useCallback)

## 📊 Comparison Test

Run side-by-side comparison:

1. Keep old version in one browser
2. Open refactored version in another
3. Perform same actions in both
4. Compare behavior and performance

## ✅ Success Criteria

The refactored page is successful when:

1. **Functionality**: All features work as before
2. **URL Sync**: Tab state persists across reloads
3. **Performance**: Same or better than original
4. **Mobile**: Better responsive behavior
5. **Code**: Cleaner and more maintainable
6. **UX**: Smoother interactions and transitions

## 🚀 Deploy When Ready

After all tests pass:

1. Commit the refactored version
2. Delete the backup file
3. Deploy to development environment
4. Monitor for issues
5. Deploy to production after 1-2 days

## 📝 Feedback Loop

Document any issues found:

```markdown
## Issues Found During Testing

### Issue: Tab not persisting on refresh
- **When**: Clicking "Pending" tab and refreshing
- **Expected**: Stay on Pending tab
- **Actual**: Reverts to All tab
- **Fix**: Verify urlSync={true} is set
```

Share feedback to improve the system!