# Expandable Data Grid - Universal Standard
**Official INFOtrac Data Table Pattern - Use System-Wide**

## 🎯 Overview

The **Expandable Data Grid** is the official, standardized data table component for the entire INFOtrac application. It provides a beautiful, professional interface with expandable rows that reveal detailed action cards.

**Status:** ✅ Production-Ready
**Design System:** Ingrid Design System v1.0
**Location:** `@/components/myna/dashboard`

## 🚀 Quick Start

```typescript
import {
  EnhancedDataTable,
  ExpandedActionCard,
  type ActionDetail,
  type ActionButton
} from '@/components/myna';

// Or import directly:
import { EnhancedDataTable } from '@/components/myna/dashboard/enhanced-data-table';
import { ExpandedActionCard } from '@/components/myna/dashboard/expanded-action-card';
```

## 📋 Basic Usage

### Standard Data Table (No Expansion)

```typescript
<EnhancedDataTable
  data={users}
  columns={[
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role' }
  ]}
  actions={[
    {
      label: 'Edit',
      icon: Edit,
      onClick: (user) => handleEdit(user.id)
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: (user) => handleDelete(user.id),
      variant: 'destructive'
    }
  ]}
  searchable={true}
  searchPlaceholder="Search users..."
  loading={isLoading}
/>
```

### Expandable Data Table (Recommended) ⭐

```typescript
<EnhancedDataTable
  data={users}
  columns={columns}
  searchable={true}
  loading={isLoading}
  expandable={true}
  getRowId={(user) => user.id}
  renderExpandedContent={(user) => {
    const details: ActionDetail[] = [
      { label: 'Full Name', value: user.fullName, icon: User },
      { label: 'Email', value: user.email, icon: Mail },
      { label: 'Role', value: user.role, icon: Shield, badge: true },
      { label: 'Status', value: user.status, icon: Activity, badge: true },
    ];

    const actions: ActionButton[] = [
      {
        label: 'Edit User',
        icon: Edit,
        onClick: () => handleEdit(user.id),
        variant: 'gradient',
        category: 'primary'
      },
      {
        label: 'View Details',
        icon: Eye,
        onClick: () => handleView(user.id),
        variant: 'outline',
        category: 'secondary'
      },
      {
        label: 'Delete User',
        icon: Trash2,
        onClick: () => handleDelete(user.id),
        variant: 'destructive',
        category: 'destructive'
      }
    ];

    return (
      <ExpandedActionCard
        title={user.fullName}
        subtitle={`ID: ${user.id}`}
        headerIcon={User}
        details={details}
        actions={actions}
        variant="elevated"
      />
    );
  }}
/>
```

## 🎨 Component Props

### EnhancedDataTable Props

```typescript
interface EnhancedDataTableProps {
  // Core Data
  data: any[];
  columns: TableColumn[];

  // Traditional Actions (dropdown menu)
  actions?: TableAction[];

  // Search & Filters
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  hideSearch?: boolean;

  // Header
  title?: string;
  subtitle?: string;

  // States
  loading?: boolean;
  emptyMessage?: string;

  // Export
  showExport?: boolean;
  onExport?: () => void;

  // Styling
  className?: string;

  // ⭐ EXPANDABLE ROW FEATURES (NEW)
  expandable?: boolean;
  renderExpandedContent?: (item: any) => React.ReactNode;
  expandedRowClassName?: string;
  onRowExpand?: (itemId: string | number) => void;
  onRowCollapse?: (itemId: string | number) => void;
  getRowId?: (item: any) => string | number;
}

interface TableColumn {
  key: string;
  header: string;
  render?: (value: any, item: any) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface TableAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (item: any) => void;
  variant?: "default" | "destructive";
}
```

### ExpandedActionCard Props

```typescript
interface ExpandedActionCardProps {
  // Data to display
  details: ActionDetail[];
  actions: ActionButton[];

  // Layout options
  title?: string;
  subtitle?: string;
  headerIcon?: LucideIcon;

  // Styling
  variant?: "default" | "elevated" | "neural";
  className?: string;

  // Callbacks
  onClose?: () => void;
}

interface ActionDetail {
  label: string;           // Field label (e.g., "Full Name")
  value: React.ReactNode;  // Field value (e.g., "John Doe")
  icon?: LucideIcon;       // Optional icon
  badge?: boolean;         // Render value as badge
  className?: string;      // Custom styling for value
}

interface ActionButton {
  label: string;          // Button label
  icon: LucideIcon;       // Button icon (required)
  onClick: () => void;    // Click handler
  variant?: "gradient" | "outline" | "destructive" | "success" | "neural";
  size?: "sm" | "default" | "lg";
  category?: "primary" | "secondary" | "destructive";
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
}
```

## 🎨 Design Variants

### ExpandedActionCard Variants

```typescript
// Default - Subtle gradient
<ExpandedActionCard variant="default" {...props} />

// Elevated - Blue accent (recommended for most use cases)
<ExpandedActionCard variant="elevated" {...props} />

// Neural - Purple/indigo for AI features
<ExpandedActionCard variant="neural" {...props} />
```

## 📐 Layout Patterns

### Two-Column Grid (Desktop)
```
┌──────────────────────────────────────────────────┐
│  Details (2fr)         │  Actions (1fr)         │
│  ────────────────────  │  ──────────────────    │
│  👤 Name: John Doe     │  [✏️ Edit User]        │
│  📧 Email: john@co     │  [👁️ View Details]     │
│  🛡️ Role: Admin        │  [⚙️ Settings]         │
│  📅 Created: Jan 15    │  ──────────────────    │
│                        │  [🗑️ Delete]           │
└──────────────────────────────────────────────────┘
```

### Single Column (Mobile)
```
┌──────────────────────────┐
│  Details                │
│  ──────────────────     │
│  👤 Name: John Doe      │
│  📧 Email: john@co      │
│  🛡️ Role: Admin         │
│  📅 Created: Jan 15     │
│                         │
│  Actions                │
│  ──────────────────     │
│  [✏️ Edit User]         │
│  [👁️ View Details]      │
│  [⚙️ Settings]          │
│  [🗑️ Delete]            │
└──────────────────────────┘
```

## 🎯 Best Practices

### ✅ DO

1. **Use expandable mode for rich data**
   - When you have 5+ fields to display
   - When actions need context
   - When data is complex

2. **Organize actions by category**
   - Primary: Main actions (Edit, View)
   - Secondary: Additional options (Export, Share)
   - Destructive: Dangerous actions (Delete, Archive)

3. **Use icons consistently**
   - Import from `lucide-react`
   - Match icon to action meaning
   - Use consistently across the app

4. **Add badges for status fields**
   ```typescript
   { label: 'Status', value: 'Active', badge: true }
   ```

5. **Color-code important info**
   ```typescript
   {
     label: 'Account Status',
     value: isActive ? 'Active' : 'Inactive',
     className: isActive ? 'text-green-600' : 'text-red-600'
   }
   ```

### ❌ DON'T

1. **Don't mix expandable and dropdown actions**
   - Choose one pattern per table
   - Expandable is preferred for complex data

2. **Don't overload with actions**
   - Keep it under 6 actions
   - Group related actions

3. **Don't forget loading states**
   ```typescript
   loading={isLoading}
   ```

4. **Don't skip getRowId**
   ```typescript
   getRowId={(item) => item.id} // Required for expansion
   ```

## 📚 Complete Examples

### Example 1: User Management

```typescript
import { EnhancedDataTable, ExpandedActionCard } from '@/components/myna';
import { User, Mail, Shield, Edit, Trash2, Settings } from 'lucide-react';

function UserManagement() {
  const columns = [
    { key: 'fullName', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role' }
  ];

  return (
    <EnhancedDataTable
      data={users}
      columns={columns}
      searchable={true}
      expandable={true}
      getRowId={(user) => user.id}
      renderExpandedContent={(user) => (
        <ExpandedActionCard
          title={user.fullName}
          subtitle={`User ID: ${user.id}`}
          headerIcon={User}
          variant="elevated"
          details={[
            { label: 'Email', value: user.email, icon: Mail },
            { label: 'Role', value: user.role, icon: Shield, badge: true },
            { label: 'Status', value: user.isActive ? 'Active' : 'Inactive', badge: true }
          ]}
          actions={[
            {
              label: 'Edit User',
              icon: Edit,
              onClick: () => handleEdit(user.id),
              variant: 'gradient',
              category: 'primary'
            },
            {
              label: 'Settings',
              icon: Settings,
              onClick: () => handleSettings(user.id),
              variant: 'outline',
              category: 'secondary'
            },
            {
              label: 'Delete',
              icon: Trash2,
              onClick: () => handleDelete(user.id),
              variant: 'destructive',
              category: 'destructive'
            }
          ]}
        />
      )}
    />
  );
}
```

### Example 2: Invoice Management

```typescript
import { EnhancedDataTable, ExpandedActionCard } from '@/components/myna';
import { FileText, DollarSign, Calendar, Download, Send, Trash2 } from 'lucide-react';

function InvoiceManagement() {
  return (
    <EnhancedDataTable
      data={invoices}
      columns={[
        { key: 'invoiceNumber', header: 'Invoice #' },
        { key: 'customerName', header: 'Customer' },
        { key: 'amount', header: 'Amount', render: (val) => `$${val.toFixed(2)}` },
        { key: 'status', header: 'Status' }
      ]}
      expandable={true}
      getRowId={(invoice) => invoice.id}
      renderExpandedContent={(invoice) => (
        <ExpandedActionCard
          title={`Invoice ${invoice.invoiceNumber}`}
          subtitle={`Issued: ${invoice.issueDate}`}
          headerIcon={FileText}
          variant="elevated"
          details={[
            { label: 'Customer', value: invoice.customerName },
            { label: 'Amount', value: `$${invoice.amount.toFixed(2)}`, icon: DollarSign },
            { label: 'Due Date', value: invoice.dueDate, icon: Calendar },
            { label: 'Status', value: invoice.status, badge: true }
          ]}
          actions={[
            {
              label: 'Download PDF',
              icon: Download,
              onClick: () => handleDownload(invoice.id),
              variant: 'gradient',
              category: 'primary'
            },
            {
              label: 'Send Email',
              icon: Send,
              onClick: () => handleSend(invoice.id),
              variant: 'outline',
              category: 'secondary'
            },
            {
              label: 'Delete',
              icon: Trash2,
              onClick: () => handleDelete(invoice.id),
              variant: 'destructive',
              category: 'destructive'
            }
          ]}
        />
      )}
    />
  );
}
```

## 🎨 Styling & Theming

### Custom Expanded Row Styling

```typescript
<EnhancedDataTable
  expandable={true}
  expandedRowClassName="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 to-blue-950"
  {...props}
/>
```

### Custom Action Card Styling

```typescript
<ExpandedActionCard
  className="border-2 border-blue-500 shadow-xl"
  {...props}
/>
```

## 🚀 Migration Guide

### From Old DataTable

**Before:**
```typescript
<DataTable
  data={users}
  columns={columns}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

**After:**
```typescript
<EnhancedDataTable
  data={users}
  columns={columns}
  expandable={true}
  getRowId={(user) => user.id}
  renderExpandedContent={(user) => (
    <ExpandedActionCard
      details={[...]}
      actions={[
        { label: 'Edit', icon: Edit, onClick: () => handleEdit(user.id) },
        { label: 'Delete', icon: Trash2, onClick: () => handleDelete(user.id) }
      ]}
    />
  )}
/>
```

## 📦 Files

### Component Locations
- **EnhancedDataTable**: `src/components/myna/dashboard/enhanced-data-table.tsx`
- **ExpandedActionCard**: `src/components/myna/dashboard/expanded-action-card.tsx`
- **Index Export**: `src/components/myna/dashboard/index.ts`
- **Main Export**: `src/components/myna/index.ts`

### Import Paths
```typescript
// Recommended (auto-exports from index)
import { EnhancedDataTable, ExpandedActionCard } from '@/components/myna';

// Alternative (direct import)
import { EnhancedDataTable } from '@/components/myna/dashboard/enhanced-data-table';
import { ExpandedActionCard } from '@/components/myna/dashboard/expanded-action-card';
```

## ✅ System-Wide Adoption

This is now the **official standard** for all data tables in INFOtrac. Use it for:

- ✅ User Management
- ✅ Module Management
- ✅ Company Management
- ✅ Invoice Management
- ✅ Expense Management
- ✅ Vendor Management
- ✅ Customer Management
- ✅ Any list/table view

## 🎯 Support

For questions or issues:
1. Check this guide
2. See `INGRID_DESIGN_SYSTEM.md`
3. Reference `UserManagementTab.tsx` for a complete example

---

**Version:** 1.0.0
**Last Updated:** September 30, 2025
**Status:** ✅ Production Ready
**Design System:** Ingrid Design System v1.0