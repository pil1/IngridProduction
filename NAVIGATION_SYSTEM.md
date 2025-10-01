# Universal Navigation System Documentation
**Version 3.0 - September 30, 2025**

## 🎯 CRITICAL: MynaUI Sidebar Standard

**ALL navigation sidebars MUST use the MynaUI Enhanced Sidebar pattern.**

❌ **NEVER use shadcn/ui Sidebar components** - they cause overlay/positioning issues
✅ **ALWAYS use MynaEnhancedSidebar** - fixed positioning, no overlaps, professional UX

**Reference Implementation:** `src/components/navigation/MynaEnhancedSidebar.tsx`

---

## Overview
The Universal Navigation System provides a comprehensive, consistent, and responsive navigation framework for the entire INFOtrac application, built with MynaUI components and design standards.

## 🎯 Key Features

### ✅ Enhanced Page Header Context
- **Breadcrumb navigation** with icons and links
- **Tab navigation** with badges, counts, and disabled states
- **Structured actions** (primary, secondary, legacy support)
- **Filter integration** with active count tracking
- **Badge/status indicators** for quick stats

### ✅ Dynamic Header Component
- Automatically renders breadcrumbs, tabs, filters based on context
- MynaUI gradient styling throughout
- Mobile-responsive with overflow handling
- Smooth animations and transitions

### ✅ Universal Layout Components
- **StandardPageLayout** - General-purpose page layout
- **TabbedPageLayout** - Pages with integrated tab navigation
- **DataTableLayout** - Data tables with filters and bulk actions
- **GridContainer** - Responsive card grids
- **SectionContainer** - Organized content sections

### ✅ Navigation Utilities
- **FilterBar** - Universal filter component with presets
- **useTabNavigation** - Smart tab hook with URL sync
- **usePageTitle** - Enhanced page header configuration

---

## 📚 Component Reference

### 1. usePageTitle Hook

The primary way to configure page headers. Supports all navigation features.

```typescript
import { usePageTitle } from '@/hooks/usePageTitle';
import { Receipt, LayoutDashboard } from 'lucide-react';

// Basic usage
usePageTitle({
  title: "Expenses",
  subtitle: "Manage expense submissions",
  icon: Receipt
});

// With breadcrumbs
usePageTitle({
  breadcrumbs: [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Expenses", path: "/expenses", icon: Receipt },
    { label: "Review" } // No path = current page
  ]
});

// With tabs
usePageTitle({
  title: "Expenses",
  tabs: [
    { id: "review-inbox", label: "Review Inbox", icon: ClipboardCheck, count: 12 },
    { id: "all", label: "All", count: 156 },
    { id: "pending", label: "Pending", count: 8 }
  ],
  activeTab: currentTab,
  onTabChange: setCurrentTab
});

// With actions
usePageTitle({
  title: "Vendors",
  primaryAction: (
    <EnhancedButton variant="gradient">
      <Plus className="h-4 w-4 mr-2" />
      Add Vendor
    </EnhancedButton>
  ),
  secondaryActions: (
    <>
      <EnhancedButton variant="outline" size="sm">Export</EnhancedButton>
      <EnhancedButton variant="outline" size="sm">Import</EnhancedButton>
    </>
  )
});

// With filters
usePageTitle({
  title: "Users",
  showFilters: true,
  filterComponent: <FilterBar filters={filters} onClearFilter={handleClear} />,
  activeFilterCount: 3
});
```

### 2. StandardPageLayout

General-purpose page layout with sidebar support, loading states, and empty states.

```typescript
import { StandardPageLayout, GridContainer, SectionContainer } from '@/components/layouts';

// Basic page
<StandardPageLayout>
  <SectionContainer title="Overview" description="Key metrics and statistics">
    <GridContainer columns={4} gap="md">
      <StatCard title="Total Sales" value="$45,231" />
      <StatCard title="Orders" value="156" />
      <StatCard title="Customers" value="89" />
      <StatCard title="Pending" value="12" />
    </GridContainer>
  </SectionContainer>
</StandardPageLayout>

// With sidebar
<StandardPageLayout
  sidebar={<FilterPanel />}
  sidebarPosition="right"
  sidebarWidth="md"
>
  <YourContent />
</StandardPageLayout>

// With loading state
<StandardPageLayout loading={isLoading}>
  <YourContent />
</StandardPageLayout>

// With empty state
<StandardPageLayout
  empty={data.length === 0}
  emptyTitle="No expenses found"
  emptyDescription="Start by creating your first expense"
  emptyAction={<EnhancedButton>Add Expense</EnhancedButton>}
>
  <YourContent />
</StandardPageLayout>

// With error state
<StandardPageLayout
  error={error}
  onRetry={handleRetry}
>
  <YourContent />
</StandardPageLayout>
```

### 3. TabbedPageLayout

Specialized layout for tabbed interfaces with URL synchronization.

```typescript
import { TabbedPageLayout, TabPanel } from '@/components/layouts';
import { Receipt, Check, Clock, X } from 'lucide-react';

const tabs = [
  {
    id: 'all',
    label: 'All Expenses',
    icon: Receipt,
    count: 156,
    content: <AllExpensesTab />
  },
  {
    id: 'pending',
    label: 'Pending Review',
    icon: Clock,
    count: 12,
    content: <PendingTab />
  },
  {
    id: 'approved',
    label: 'Approved',
    icon: Check,
    count: 133,
    content: <ApprovedTab />
  },
  {
    id: 'rejected',
    label: 'Rejected',
    icon: X,
    count: 11,
    content: <RejectedTab />
  }
];

<TabbedPageLayout
  title="Expenses"
  subtitle="Manage and review expense submissions"
  icon={Receipt}
  tabs={tabs}
  defaultTab="all"
  urlSync={true} // Syncs with URL ?tab=pending
  primaryAction={<EnhancedButton>Add Expense</EnhancedButton>}
  tabActions={{
    pending: <EnhancedButton>Approve All</EnhancedButton>,
    approved: <EnhancedButton>Export Approved</EnhancedButton>
  }}
/>

// Individual tab content with loading
<TabPanel loading={isLoading}>
  <ExpenseTable data={expenses} />
</TabPanel>
```

### 4. DataTableLayout

Optimized layout for data tables with integrated filtering and bulk actions.

```typescript
import { DataTableLayout } from '@/components/layouts';
import { Users } from 'lucide-react';

<DataTableLayout
  title="Users"
  subtitle="Manage user accounts and permissions"
  icon={Users}
  data={users}
  loading={isLoading}

  // Table configuration
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (user) => <RoleBadge role={user.role} /> }
  ]}

  // Or custom table
  renderTable={(data) => <CustomUserTable users={data} />}

  // Search
  searchable={true}
  searchPlaceholder="Search users..."
  onSearch={handleSearch}

  // Filters
  filterComponent={
    <FilterGroup label="Role">
      <Select value={roleFilter} onValueChange={setRoleFilter}>
        <SelectItem value="all">All Roles</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="user">User</SelectItem>
      </Select>
    </FilterGroup>
  }
  activeFilters={[
    { id: 'role', label: 'Role: Admin', value: 'admin' }
  ]}
  onClearFilter={handleClearFilter}
  onClearAllFilters={handleClearAll}

  // Bulk actions
  selectable={true}
  selectedItems={selectedUsers}
  onSelectionChange={setSelectedUsers}
  bulkActions={
    <div className="flex gap-2">
      <EnhancedButton size="sm">Activate Selected</EnhancedButton>
      <EnhancedButton size="sm" variant="destructive">Delete Selected</EnhancedButton>
    </div>
  }

  // Actions
  primaryAction={<EnhancedButton>Invite User</EnhancedButton>}
  onExport={handleExport}
  onImport={handleImport}

  // Empty state
  emptyTitle="No users found"
  emptyDescription="Invite your first user to get started"
  emptyAction={<EnhancedButton>Invite User</EnhancedButton>}
/>
```

### 5. FilterBar Component

Universal filtering component with quick filters, advanced filters, and presets.

```typescript
import { FilterBar, FilterGroup, type ActiveFilter, type QuickFilter } from '@/components/navigation';

const quickFilters: QuickFilter[] = [
  { id: 'today', label: 'Today', count: 5 },
  { id: 'this-week', label: 'This Week', count: 23, active: true },
  { id: 'this-month', label: 'This Month', count: 156 }
];

const activeFilters: ActiveFilter[] = [
  { id: 'status', label: 'Status: Pending', value: 'pending' },
  { id: 'amount', label: 'Amount: >$100', value: { min: 100 } }
];

<FilterBar
  // Search
  searchPlaceholder="Search expenses..."
  searchValue={searchQuery}
  onSearch={setSearchQuery}

  // Quick filters
  quickFilters={quickFilters}
  onQuickFilterClick={handleQuickFilter}

  // Active filters
  activeFilters={activeFilters}
  onClearFilter={handleClearFilter}
  onClearAll={handleClearAll}

  // Advanced filters
  advancedFilters={
    <>
      <FilterGroup label="Status">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
        </Select>
      </FilterGroup>

      <FilterGroup label="Date Range">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </FilterGroup>

      <FilterGroup label="Amount">
        <div className="flex gap-2">
          <Input type="number" placeholder="Min" />
          <Input type="number" placeholder="Max" />
        </div>
      </FilterGroup>
    </>
  }

  // Presets
  presets={[
    { id: 'this-week', label: 'This Week', filters: { dateRange: 'week' } },
    { id: 'pending', label: 'Pending Review', filters: { status: 'pending' } }
  ]}
  activePreset={currentPreset}
  onPresetSelect={setPreset}
  onSavePreset={handleSavePreset}
/>
```

### 6. useTabNavigation Hook

Smart tab navigation with URL sync and localStorage caching.

```typescript
import { useTabNavigation, useUrlTab, usePersistentTab } from '@/hooks/useTabNavigation';

// Basic usage
const { activeTab, setActiveTab, isActiveTab } = useTabNavigation({
  tabs: ['all', 'pending', 'approved'] as const,
  defaultTab: 'all'
});

// With URL sync (syncs to ?tab=pending)
const { activeTab, setActiveTab } = useUrlTab(
  ['all', 'pending', 'approved'] as const,
  'tab', // URL param name
  'all'  // default
);

// With localStorage persistence
const { activeTab, setActiveTab } = usePersistentTab(
  ['all', 'pending', 'approved'] as const,
  'expense-tab-preference', // storage key
  'all'
);

// Full featured
const {
  activeTab,
  setActiveTab,
  isActiveTab,
  nextTab,
  previousTab,
  canGoNext,
  canGoPrevious
} = useTabNavigation({
  tabs: ['all', 'pending', 'approved'] as const,
  defaultTab: 'all',
  urlSync: true,
  urlParamName: 'tab',
  cacheKey: 'expense-tab',
  onTabChange: (newTab, oldTab) => {
    console.log(`Changed from ${oldTab} to ${newTab}`);
  },
  validateTab: (tab) => {
    // Custom validation logic
    return hasPermission(tab);
  }
});

// Use with TabbedPageLayout
<TabbedPageLayout
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>

// Or manually
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="all">All</TabsTrigger>
    <TabsTrigger value="pending">Pending</TabsTrigger>
  </TabsList>
</Tabs>
```

---

## 🎨 MynaUI Design Integration

All components follow MynaUI design standards:

### Gradients
```css
/* Header backgrounds */
from-slate-50/80 via-white/90 to-blue-50/80
dark:from-slate-900/80 dark:via-slate-950/90 dark:to-blue-950/80

/* Active tabs */
from-blue-600 to-blue-700

/* Text gradients */
from-slate-700 to-blue-600
dark:from-slate-200 dark:to-blue-400
```

### Spacing
- Section spacing: `space-y-8`
- Card spacing: `space-y-6`
- Component spacing: `space-y-4`

### Border Radius
- Cards: `rounded-xl`
- Buttons/Inputs: `rounded-lg`
- Badges: `rounded-md`

### Shadows
- Headers: `shadow-md`
- Cards: `shadow-lg` (elevated variant)
- Active elements: `shadow-md`

### Animations
- Transitions: `transition-all duration-200`
- Hover effects: `hover:scale-[1.02]`, `hover:-translate-y-1`
- Fade in: `animate-in fade-in duration-200`

---

## 📖 Usage Patterns

### Pattern 1: Simple Page with Actions

```typescript
import { StandardPageLayout, GridContainer } from '@/components/layouts';
import { usePageTitle } from '@/hooks/usePageTitle';
import { EnhancedButton } from '@/components/myna/elements/enhanced-button';
import { Plus } from 'lucide-react';

export const DashboardPage = () => {
  usePageTitle({
    title: "Dashboard",
    subtitle: "Overview of your business metrics",
    icon: LayoutDashboard,
    primaryAction: (
      <EnhancedButton variant="gradient">
        <Plus className="h-4 w-4 mr-2" />
        Quick Action
      </EnhancedButton>
    )
  });

  return (
    <StandardPageLayout>
      <GridContainer columns={4} gap="md">
        {/* Your stats cards */}
      </GridContainer>
    </StandardPageLayout>
  );
};
```

### Pattern 2: Tabbed Interface with URL Sync

```typescript
import { TabbedPageLayout } from '@/components/layouts';
import { useUrlTab } from '@/hooks/useTabNavigation';
import { Receipt } from 'lucide-react';

export const ExpensesPage = () => {
  const { activeTab, setActiveTab } = useUrlTab(
    ['all', 'pending', 'approved'] as const,
    'tab',
    'all'
  );

  const tabs = [
    { id: 'all', label: 'All', content: <AllTab />, count: 156 },
    { id: 'pending', label: 'Pending', content: <PendingTab />, count: 12 },
    { id: 'approved', label: 'Approved', content: <ApprovedTab />, count: 144 }
  ];

  return (
    <TabbedPageLayout
      title="Expenses"
      icon={Receipt}
      tabs={tabs}
      defaultTab="all"
      urlSync={true}
    />
  );
};
```

### Pattern 3: Data Table with Filters

```typescript
import { DataTableLayout } from '@/components/layouts';
import { FilterBar, FilterGroup } from '@/components/navigation';
import { Users } from 'lucide-react';

export const UsersPage = () => {
  const [filters, setFilters] = useState({});
  const { data, isLoading } = useUsers(filters);

  return (
    <DataTableLayout
      title="Users"
      icon={Users}
      data={data}
      loading={isLoading}

      searchable={true}
      onSearch={(q) => setFilters({ ...filters, search: q })}

      filterComponent={
        <div className="grid grid-cols-3 gap-4">
          <FilterGroup label="Role">
            <RoleSelect />
          </FilterGroup>
          <FilterGroup label="Status">
            <StatusSelect />
          </FilterGroup>
          <FilterGroup label="Joined">
            <DateRangePicker />
          </FilterGroup>
        </div>
      }

      primaryAction={<EnhancedButton>Invite User</EnhancedButton>}
      onExport={handleExport}
    />
  );
};
```

---

## 🚀 Migration Guide

### Migrating Existing Pages

#### Before (Old System):
```typescript
const ExpensesPage = () => {
  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1>Expenses</h1>
        <Button>Add Expense</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          {/* Content */}
        </TabsContent>
      </Tabs>
    </div>
  );
};
```

#### After (New System):
```typescript
const ExpensesPage = () => {
  const tabs = [
    { id: 'all', label: 'All', content: <AllTab /> },
    { id: 'pending', label: 'Pending', content: <PendingTab /> }
  ];

  return (
    <TabbedPageLayout
      title="Expenses"
      tabs={tabs}
      defaultTab="all"
      urlSync={true}
      primaryAction={<EnhancedButton>Add Expense</EnhancedButton>}
    />
  );
};
```

Benefits:
✅ Automatic URL sync
✅ Consistent MynaUI styling
✅ Mobile-responsive tabs
✅ Less boilerplate code
✅ Built-in loading/error states

---

## 🎯 Best Practices

### 1. **Always use usePageTitle for headers**
```typescript
// ✅ Good
usePageTitle({ title: "Expenses", icon: Receipt });

// ❌ Bad - Don't manually create headers
<h1>Expenses</h1>
```

### 2. **Prefer layout components over custom structure**
```typescript
// ✅ Good
<StandardPageLayout>
  <GridContainer columns={3}>
    {/* Cards */}
  </GridContainer>
</StandardPageLayout>

// ❌ Bad
<div className="p-6">
  <div className="grid grid-cols-3">
    {/* Cards */}
  </div>
</div>
```

### 3. **Use URL sync for tab persistence**
```typescript
// ✅ Good - Survives page reload
const { activeTab } = useUrlTab(['all', 'pending'] as const, 'tab');

// ⚠️ OK - But state is lost on reload
const [activeTab, setActiveTab] = useState('all');
```

### 4. **Leverage FilterBar for consistency**
```typescript
// ✅ Good
<FilterBar
  quickFilters={quickFilters}
  advancedFilters={<YourFilters />}
/>

// ❌ Bad - Reinventing the wheel
<div>
  <Input placeholder="Search" />
  <Button>Filters</Button>
  {/* Custom filter UI */}
</div>
```

### 5. **Use TypeScript const assertions for tabs**
```typescript
// ✅ Good - Type-safe
const tabs = ['all', 'pending', 'approved'] as const;
type Tab = typeof tabs[number]; // 'all' | 'pending' | 'approved'

// ❌ Bad - Loses type safety
const tabs = ['all', 'pending', 'approved'];
```

---

## 📋 Complete Example

Here's a complete example combining all features:

```typescript
import { TabbedPageLayout } from '@/components/layouts';
import { FilterBar, FilterGroup } from '@/components/navigation';
import { useUrlTab } from '@/hooks/useTabNavigation';
import { EnhancedButton } from '@/components/myna/elements/enhanced-button';
import { Plus, Download, Upload, Receipt } from 'lucide-react';

export const ComprehensiveExpensePage = () => {
  // Tab management
  const { activeTab, setActiveTab } = useUrlTab(
    ['all', 'review', 'pending', 'approved', 'rejected'] as const,
    'tab',
    'all'
  );

  // Filter state
  const [filters, setFilters] = useState<FilterState>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Data fetching
  const { data: expenses, isLoading } = useExpenses({ ...filters, search: searchQuery });

  // Filter configuration
  const quickFilters = [
    { id: 'today', label: 'Today', count: 5 },
    { id: 'week', label: 'This Week', count: 23 },
    { id: 'month', label: 'This Month', count: 156 }
  ];

  const activeFilters = Object.entries(filters)
    .filter(([_, value]) => value)
    .map(([key, value]) => ({
      id: key,
      label: `${key}: ${value}`,
      value
    }));

  // Tab definitions
  const tabs = [
    {
      id: 'all',
      label: 'All Expenses',
      icon: Receipt,
      count: expenses?.total || 0,
      content: <AllExpensesTab data={expenses?.all || []} />
    },
    {
      id: 'review',
      label: 'Review Inbox',
      icon: ClipboardCheck,
      count: expenses?.needsReview || 0,
      content: <ReviewInboxTab data={expenses?.review || []} />
    },
    {
      id: 'pending',
      label: 'Pending',
      icon: Clock,
      count: expenses?.pending || 0,
      content: <PendingTab data={expenses?.pending || []} />
    },
    {
      id: 'approved',
      label: 'Approved',
      icon: Check,
      count: expenses?.approved || 0,
      content: <ApprovedTab data={expenses?.approved || []} />
    }
  ];

  return (
    <TabbedPageLayout
      title="Expenses"
      subtitle="Manage and review expense submissions"
      icon={Receipt}
      breadcrumbs={[
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Expenses' }
      ]}
      tabs={tabs}
      defaultTab="all"
      urlSync={true}

      primaryAction={
        <EnhancedButton variant="gradient">
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </EnhancedButton>
      }

      secondaryActions={
        <>
          <EnhancedButton variant="outline" size="sm" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </EnhancedButton>
          <EnhancedButton variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </EnhancedButton>
        </>
      }

      filterComponent={
        <FilterBar
          searchPlaceholder="Search expenses..."
          searchValue={searchQuery}
          onSearch={setSearchQuery}

          quickFilters={quickFilters}
          onQuickFilterClick={(id) => setFilters({ dateRange: id })}

          activeFilters={activeFilters}
          onClearFilter={(id) => setFilters({ ...filters, [id]: null })}
          onClearAll={() => setFilters({})}

          advancedFilters={
            <div className="grid grid-cols-3 gap-4">
              <FilterGroup label="Status">
                <StatusSelect value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} />
              </FilterGroup>
              <FilterGroup label="Amount Range">
                <AmountRangeInput value={filters.amount} onChange={(v) => setFilters({ ...filters, amount: v })} />
              </FilterGroup>
              <FilterGroup label="Submitter">
                <UserSelect value={filters.submitter} onChange={(v) => setFilters({ ...filters, submitter: v })} />
              </FilterGroup>
            </div>
          }
        />
      }

      activeFilterCount={activeFilters.length}
    />
  );
};
```

---

## 🔧 Troubleshooting

### Issue: Tabs not syncing with URL
**Solution**: Ensure you're using `urlSync={true}` in TabbedPageLayout or useUrlTab hook.

### Issue: Filter state lost on page reload
**Solution**: Use `cacheKey` prop in FilterBar or implement URL parameter syncing.

### Issue: Header actions not appearing
**Solution**: Ensure usePageTitle is called with the correct action props, and verify timing (should be called after component mounts).

### Issue: Mobile layout breaking
**Solution**: Check that you're using responsive utility classes (`md:`, `lg:`) and that sidebar components have proper `hidden lg:block` classes.

---

## 📚 Additional Resources

- [MynaUI Implementation Guide](MynaUI_IMPLEMENTATION.md)
- [Ingrid Design System](INGRID_DESIGN_SYSTEM.md)
- [Component Documentation](src/components/README.md)

---

**Built with ❤️ using MynaUI and React**
---

## 🎨 MynaUI Sidebar Standard

### Architecture

**Fixed Sidebar + Dynamic Content Layout**

```tsx
<div className="flex min-h-screen">
  {/* Fixed Sidebar - Stays in place while content scrolls */}
  <MynaEnhancedSidebar
    isCollapsed={collapsed}
    onToggle={toggleCollapsed}
    className="fixed top-0 left-0 z-30"
  />
  
  {/* Main Content - Adjusts margin for sidebar */}
  <div className={cn(
    "flex-1 transition-[margin] duration-300",
    collapsed ? "md:ml-20" : "md:ml-64"
  )}>
    <DynamicHeader />
    <main><Outlet /></main>
  </div>
</div>
```

### Key Features

1. **✅ Fixed Positioning**
   - Sidebar uses `position: fixed` to stay persistent
   - Always visible, doesn't scroll with page content
   - Professional SaaS application behavior

2. **✅ No Overlaps**
   - Content area uses left margin to account for sidebar width
   - Smooth transitions when collapsing (300ms)
   - Responsive width adjustments

3. **✅ Collapsible Behavior**
   - Expanded: 256px (w-64) with full labels
   - Collapsed: 80px (w-20) with icons only
   - Toggle button in sidebar footer

4. **✅ MynaUI Styling**
   - Gradient backgrounds and hover effects
   - Glassmorphism and smooth animations
   - Consistent with Ingrid brand

### Component Structure

```typescript
<MynaEnhancedSidebar>
  <Header>
    Logo + Branding
  </Header>
  
  <Navigation>
    Draggable Menu Items
    Collapsible Submenus
    Active State Indicators
  </Navigation>
  
  <Footer>
    Collapse Toggle (primary)
    Edit Menu
    Notifications / Profile / Logout
  </Footer>
</MynaEnhancedSidebar>
```

### Implementation Checklist

- [ ] Remove all shadcn/ui Sidebar imports
- [ ] Import MynaEnhancedSidebar from `@/components/navigation`
- [ ] Add state management for `isCollapsed`
- [ ] Apply margin to content area (`ml-20` or `ml-64`)
- [ ] Test scrolling behavior with long pages
- [ ] Verify mobile responsiveness (hidden on mobile)

### Why This Standard?

**shadcn/ui Sidebar Problems:**
- ❌ Complex peer-data attribute system
- ❌ Requires specific variants to work correctly
- ❌ Fixed positioning causes overlay issues
- ❌ Content needs manual margin adjustments
- ❌ Inconsistent behavior across variants

**MynaUI Enhanced Sidebar Benefits:**
- ✅ Simple, predictable flex-based layout
- ✅ Works out of the box, no configuration needed
- ✅ Fixed positioning with proper content margins
- ✅ Smooth animations and transitions
- ✅ Full MynaUI styling integration
- ✅ Professional UX matching modern SaaS apps

### Migration from Legacy Sidebars

If you have existing shadcn/ui sidebars:

1. **Remove old imports:**
```typescript
// ❌ Remove these
import { Sidebar, SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
```

2. **Add new import:**
```typescript
// ✅ Add this
import { MynaEnhancedSidebar } from '@/components/navigation/MynaEnhancedSidebar';
```

3. **Update layout:**
```typescript
// ❌ Old (complex, buggy)
<SidebarProvider>
  <Sidebar variant="inset">...</Sidebar>
  <SidebarInset className="peer-data-[state=collapsed]:md:ml-12">
    <Content />
  </SidebarInset>
</SidebarProvider>

// ✅ New (simple, reliable)
<MynaEnhancedSidebar isCollapsed={collapsed} onToggle={toggle} />
<div className={collapsed ? "md:ml-20" : "md:ml-64"}>
  <Content />
</div>
```

4. **Test thoroughly:**
   - Collapse/expand functionality
   - Scrolling behavior
   - Mobile responsiveness
   - Menu item interactions

---

