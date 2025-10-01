# Modal System Quick Reference Card

**🎯 Fast lookup for developers - All modal components are MynaUI controls**

---

## 📦 Import Statement

```typescript
import { EnhancedDialog, EnhancedSheet, EnhancedDrawer } from '@/components/myna';
```

---

## 🎨 Which Component to Use?

| Component | When to Use | Example Use Cases |
|-----------|-------------|-------------------|
| **EnhancedDialog** | Most common modal needs | Forms, confirmations, editing, quick actions |
| **EnhancedSheet** | Extensive content, desktop-first | Filters, settings, detailed panels |
| **EnhancedDrawer** | Mobile-first experiences | Mobile menus, quick selections, touch interfaces |

---

## ⚡ Basic Templates

### EnhancedDialog Template

```typescript
<EnhancedDialog
  open={open}
  onOpenChange={setOpen}
  title="Dialog Title"
  subtitle="Optional subtitle"
  icon={IconName}
  size="md" // sm | md | lg | xl | full
  variant="elevated" // default | elevated | neural | success | warning
  primaryAction={{
    label: "Save",
    onClick: handleSave,
    variant: "gradient",
  }}
  secondaryAction={{
    label: "Cancel",
    onClick: () => setOpen(false),
  }}
>
  {/* Your content */}
</EnhancedDialog>
```

### EnhancedSheet Template

```typescript
<EnhancedSheet
  open={open}
  onOpenChange={setOpen}
  title="Sheet Title"
  subtitle="Optional subtitle"
  icon={IconName}
  side="right" // right | left | top | bottom
  variant="elevated"
>
  <EnhancedSheetSection title="Section Title">
    {/* Your content */}
  </EnhancedSheetSection>
</EnhancedSheet>
```

### EnhancedDrawer Template

```typescript
<EnhancedDrawer
  open={open}
  onOpenChange={setOpen}
  title="Drawer Title"
  subtitle="Optional subtitle"
  icon={IconName}
  variant="elevated"
  showSwipeHandle={true}
  primaryAction={{
    label: "Confirm",
    onClick: handleConfirm,
    variant: "gradient",
  }}
>
  {/* Your content */}
</EnhancedDrawer>
```

---

## 🎨 Variants

| Variant | When to Use | Color Scheme |
|---------|-------------|--------------|
| `default` | Neutral actions | Slate gradient |
| `elevated` | **Recommended default** | Slate to blue gradient |
| `neural` | AI features | Purple/indigo/blue gradient |
| `success` | Confirmations, success | Green/emerald gradient |
| `warning` | Destructive actions | Amber/orange gradient |

---

## 📏 Dialog Sizes

| Size | Max Width | Use For |
|------|-----------|---------|
| `sm` | 28rem (448px) | Confirmations, alerts |
| `md` | 32rem (512px) | **Default** - Standard forms |
| `lg` | 42rem (672px) | Complex forms |
| `xl` | 56rem (896px) | Data-rich content |
| `full` | 80rem (1280px) | Extensive content |

---

## 🔧 Helper Components

### For Dialogs:

```typescript
// Section
<EnhancedDialogSection title="Section Title">
  {/* Content */}
</EnhancedDialogSection>

// Grid Layout (1, 2, or 3 columns)
<EnhancedDialogGrid columns={2}>
  <div>Column 1</div>
  <div>Column 2</div>
</EnhancedDialogGrid>
```

### For Sheets:

```typescript
// Section with optional collapse
<EnhancedSheetSection
  title="Section Title"
  collapsible={true}
  defaultExpanded={true}
>
  {/* Content */}
</EnhancedSheetSection>
```

---

## 💡 Common Patterns

### Confirmation Dialog

```typescript
<EnhancedDialog
  title="Confirm Action"
  icon={AlertCircle}
  size="sm"
  variant="warning"
  primaryAction={{ label: "Confirm", onClick: handleConfirm, variant: "destructive" }}
  secondaryAction={{ label: "Cancel", onClick: () => setOpen(false) }}
>
  <p>Are you sure you want to proceed?</p>
</EnhancedDialog>
```

### Form Dialog

```typescript
<EnhancedDialog
  title="Edit User"
  icon={UserEdit}
  size="lg"
  variant="elevated"
  primaryAction={{ label: "Save", onClick: handleSave, loading: isSaving }}
  secondaryAction={{ label: "Cancel", onClick: () => setOpen(false) }}
>
  <EnhancedDialogSection title="Basic Info">
    <EnhancedDialogGrid columns={2}>
      <input placeholder="First Name" />
      <input placeholder="Last Name" />
    </EnhancedDialogGrid>
  </EnhancedDialogSection>
</EnhancedDialog>
```

### Filter Sheet

```typescript
<EnhancedSheet
  title="Filters"
  icon={Filter}
  side="right"
  variant="elevated"
>
  <EnhancedSheetSection title="Date Range">
    <input type="date" />
    <input type="date" />
  </EnhancedSheetSection>
  <EnhancedSheetSection title="Status" collapsible>
    <label><input type="checkbox" /> Active</label>
    <label><input type="checkbox" /> Pending</label>
  </EnhancedSheetSection>
</EnhancedSheet>
```

### Mobile Actions Drawer

```typescript
<EnhancedDrawer
  title="Actions"
  icon={MoreVertical}
  variant="elevated"
  showSwipeHandle={true}
>
  <button onClick={handleEdit}>Edit</button>
  <button onClick={handleShare}>Share</button>
  <button onClick={handleDelete} className="text-red-600">Delete</button>
</EnhancedDrawer>
```

---

## 🚨 Common Props

### State (Required)
```typescript
open: boolean
onOpenChange: (open: boolean) => void
```

### Content (Required)
```typescript
title: string
subtitle?: string
icon?: LucideIcon
children: React.ReactNode
```

### Behavior
```typescript
closeOnOverlayClick?: boolean  // Default: true
closeOnEscape?: boolean        // Default: true
showCloseButton?: boolean      // Default: true
```

### Actions (Optional)
```typescript
primaryAction?: {
  label: string
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  variant?: "gradient" | "outline" | "destructive" | "success" | "neural"
  icon?: LucideIcon
}
secondaryAction?: {
  // Same as primaryAction
}
```

---

## 📚 Full Documentation

- **Complete Guide**: `INGRID_MODAL_SYSTEM.md`
- **Summary**: `INGRID_MODAL_SYSTEM_SUMMARY.md`
- **Requirements**: `CLAUDE.md` (Requirement #9)

---

## ✅ Checklist for New Modals

- [ ] Import from `@/components/myna`
- [ ] Choose appropriate component (Dialog/Sheet/Drawer)
- [ ] Add icon for visual clarity
- [ ] Set appropriate variant
- [ ] Use helper components for layout
- [ ] Add primaryAction/secondaryAction
- [ ] Test on desktop and mobile
- [ ] Verify keyboard navigation

---

**🎉 All modal components are MynaUI controls following the Ingrid Design System!**