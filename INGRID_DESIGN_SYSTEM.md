# Ingrid Design System
**Version 1.0 - September 2025**

## Overview
The Ingrid Design System establishes consistent, professional branding and UI standards across the entire Ask Ingrid suite of applications, powered by MynaUI components and OKLCH color system.

## Core Design Philosophy
- **Professional & Reserved**: Subtle gradients, muted colors, and refined aesthetics
- **AI-Powered Intelligence**: Visual indicators that communicate AI capabilities without being overwhelming
- **Glass Morphism**: Modern backdrop blur effects with subtle transparency
- **Smooth Animations**: Subtle hover effects that enhance without distracting

## Color Palette - Enhanced with Subtle Gradients ✨ **IMPLEMENTED SYSTEM-WIDE**

### Primary Brand Colors
Professional gradients that add visual interest while maintaining corporate sophistication:

```css
/* Primary Gradients - For headings, important text ✅ APPLIED */
--ingrid-primary-gradient: from-slate-700 via-blue-600 to-slate-600
--ingrid-primary-gradient-dark: from-slate-100 via-blue-300 to-slate-100
--ingrid-primary-gradient-hover: from-slate-600 via-blue-500 to-slate-500

/* Card Background Gradients - Subtle depth ✅ APPLIED */
--ingrid-card-gradient-default-light: from-slate-50/95 via-white/98 to-slate-50/95
--ingrid-card-gradient-default-dark: from-slate-900/95 via-slate-950/98 to-slate-900/95
--ingrid-card-gradient-elevated-light: from-slate-50/95 via-white/98 to-blue-50/95
--ingrid-card-gradient-elevated-dark: from-slate-900/95 via-slate-950/98 to-blue-950/95

/* Component Specific Gradients ✅ APPLIED */
--ingrid-card-neural-light: from-purple-50/95 via-indigo-50/98 to-blue-50/95
--ingrid-card-neural-dark: from-purple-950/20 via-indigo-950/20 to-blue-950/20
--ingrid-card-success-light: from-green-50/95 via-emerald-50/98 to-green-50/95
--ingrid-card-success-dark: from-green-950/20 via-emerald-950/20 to-green-950/20
--ingrid-card-warning-light: from-amber-50/95 via-orange-50/98 to-amber-50/95
--ingrid-card-warning-dark: from-amber-950/20 via-orange-950/20 to-amber-950/20

/* Top Bar Gradient ✅ APPLIED */
--ingrid-topbar-light: from-slate-50/80 via-white/90 to-blue-50/80
--ingrid-topbar-dark: from-slate-900/80 via-slate-950/90 to-blue-950/80

/* Page Background Gradients ✅ APPLIED */
--ingrid-bg-light: from-slate-100 via-gray-200 to-blue-100
--ingrid-bg-dark: from-slate-900 via-gray-900 to-blue-950

/* Button Gradients ✅ APPLIED */
--ingrid-button-default: from-primary to-primary/90
--ingrid-button-gradient: from-blue-600 to-blue-700
--ingrid-button-neural: from-purple-600 to-indigo-600
--ingrid-button-success: from-green-600 to-emerald-600
--ingrid-button-warning: from-amber-600 to-orange-600
--ingrid-button-destructive: from-destructive to-destructive/90

/* Hover Overlays ✅ APPLIED */
--ingrid-hover-overlay: from-transparent via-blue-500/5 to-slate-500/5

/* Text Gradients ✅ APPLIED */
--ingrid-stat-value: from-slate-700 to-blue-600 (light), from-slate-200 to-blue-400 (dark)

/* Badge Gradients ✅ APPLIED */
--ingrid-badge-light: from-slate-100 to-blue-100
--ingrid-badge-dark: from-slate-800 to-blue-900
```

### Where to Apply Gradients

**✅ APPLIED System-Wide:**
- ✅ Page backgrounds (RootLayout fixed gradient)
- ✅ Top menu bar (DynamicHeader gradient)
- ✅ Card backgrounds (EnhancedCard all variants)
- ✅ Stat cards (EnhancedStatCard all variants)
- ✅ Dashboard headers (EnhancedDashboardHeader)
- ✅ All buttons (EnhancedButton all variants)
- ✅ Headings and titles (gradient text)
- ✅ Hover overlays (subtle depth effect)
- ✅ Badges (subtle color enhancement)
- ✅ Stats containers (system health, quick stats)

**❌ Keep Solid Colors:**
- Body text (readability)
- Form inputs (clarity)
- Tables and data (focus on content)
- Borders (clean lines for structure)
- Icons (simplicity and recognition)
- Navigation links (clarity)

### Status & Semantic Colors
```css
/* AI Neural (Primary AI Features) ✅ APPLIED */
--ingrid-neural: purple-600 to indigo-600
--ingrid-neural-bg: from-purple-50/95 via-indigo-50/98 to-blue-50/95 (light)

/* Success States ✅ APPLIED */
--ingrid-success: green-600 to emerald-600
--ingrid-success-bg: from-green-50/95 via-emerald-50/98 to-green-50/95 (light)

/* Warning States ✅ APPLIED */
--ingrid-warning: amber-600 to orange-600
--ingrid-warning-bg: from-amber-50/95 via-orange-50/98 to-amber-50/95 (light)

/* Error States */
--ingrid-error: red-500 to red-600

/* Info States */
--ingrid-info: cyan-500 to cyan-600

/* Gradient Button ✅ APPLIED */
--ingrid-gradient-special: from-blue-600 via-blue-700 to-purple-600
```

### Background Orbs (Subtle Ambient Effects)
```typescript
// Animated background orbs for special pages (login, dashboards)
<div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/15 to-purple-400/10 rounded-full blur-3xl animate-pulse" />
<div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-slate-400/15 to-blue-400/10 rounded-full blur-3xl" />
```

## ✨ Enhanced 3D Shadow System (NEW!)

**Version 2.0 - Enhanced Visual Depth**

The Ingrid shadow system creates consistent 3D depth hierarchy across all components, making UI elements "pop" with professional elevation.

### Shadow Design Tokens

```css
/* CSS Variables (globals.css) */
:root {
  /* Elevation Levels - Consistent 3D Depth */
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  --shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);

  /* Inner Shadows - Inset Depth */
  --shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);

  /* Colored Shadows - For emphasis and interactive states */
  --shadow-blue: 0 10px 15px -3px rgb(59 130 246 / 0.2), 0 4px 6px -4px rgb(59 130 246 / 0.1);
  --shadow-purple: 0 10px 15px -3px rgb(147 51 234 / 0.2), 0 4px 6px -4px rgb(147 51 234 / 0.1);
  --shadow-green: 0 10px 15px -3px rgb(34 197 94 / 0.2), 0 4px 6px -4px rgb(34 197 94 / 0.1);
  --shadow-amber: 0 10px 15px -3px rgb(245 158 11 / 0.2), 0 4px 6px -4px rgb(245 158 11 / 0.1);
  --shadow-red: 0 10px 15px -3px rgb(239 68 68 / 0.2), 0 4px 6px -4px rgb(239 68 68 / 0.1);
}
```

### Shadow Usage Guidelines

**Component Shadow Hierarchy:**

| Component Type | Default Shadow | Hover Shadow | Purpose |
|---|---|---|---|
| **Stat Cards** | `shadow-ingrid-md` | `shadow-ingrid-lg` | Medium depth for dashboard metrics |
| **Standard Cards** | `shadow-ingrid-md` | `shadow-ingrid-lg` | Consistent card elevation |
| **Elevated Cards** | `shadow-ingrid-lg` | `shadow-ingrid-xl` | High-priority content |
| **Buttons (Primary)** | `shadow-ingrid-sm` | `shadow-ingrid-md` | Subtle but present depth |
| **Buttons (Gradient)** | `shadow-ingrid-md` | `shadow-ingrid-blue` | Emphasis with colored glow |
| **Dialogs/Modals** | `shadow-ingrid-2xl` | N/A | Maximum elevation for overlays |
| **Data Tables** | `shadow-ingrid-lg` | `shadow-ingrid-xl` | Strong depth for complex data |
| **Glass Components** | `shadow-ingrid-sm` | `shadow-ingrid-md` | Light depth with transparency |

### Colored Shadow Examples

```typescript
// Neural AI components - purple glow
<EnhancedCard variant="neural" className="shadow-ingrid-md hover:shadow-ingrid-purple">

// Success states - green glow
<EnhancedButton variant="success" className="shadow-ingrid-sm hover:shadow-ingrid-green">

// Warning states - amber glow
<EnhancedStatCard variant="warning" className="shadow-ingrid-md hover:shadow-ingrid-amber">

// Gradient buttons - blue glow
<EnhancedButton variant="gradient" className="shadow-ingrid-md hover:shadow-ingrid-blue">
```

### Tailwind Shadow Utilities

```typescript
// Available Tailwind classes (configured in tailwind.config.ts)
className="shadow-ingrid-xs"    // Extra small shadow
className="shadow-ingrid-sm"    // Small shadow
className="shadow-ingrid-md"    // Medium shadow (default for most cards)
className="shadow-ingrid-lg"    // Large shadow (elevated cards, tables)
className="shadow-ingrid-xl"    // Extra large shadow
className="shadow-ingrid-2xl"   // Maximum shadow (modals)
className="shadow-ingrid-inner" // Inset shadow

// Colored shadows
className="shadow-ingrid-blue"   // Blue colored shadow
className="shadow-ingrid-purple" // Purple colored shadow
className="shadow-ingrid-green"  // Green colored shadow
className="shadow-ingrid-amber"  // Amber colored shadow
className="shadow-ingrid-red"    // Red colored shadow
```

### Dark Mode Shadows

Dark mode automatically uses more pronounced shadows (30-50% opacity) for better contrast:

```css
.dark {
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.3);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.3);
  --shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.5);
}
```

### Enhanced Interactive States

```css
/* Glassy Transparency Effects */
.ingrid-glass-card {
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(255, 255, 255, 0.08) 100%
  );
  backdrop-filter: blur(12px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow:
    0 8px 32px 0 rgba(31, 38, 135, 0.15),
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.4);
}

/* Interactive Card Hover */
.ingrid-interactive-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  background: linear-gradient(135deg,
    rgba(59, 130, 246, 0.05) 0%,
    rgba(255, 255, 255, 1) 50%,
    rgba(147, 51, 234, 0.05) 100%
  );
}

/* Glowing Border Effects */
.ingrid-glow-border {
  border: 1px solid transparent;
  background:
    linear-gradient(white, white) padding-box,
    linear-gradient(135deg, #3b82f6, #8b5cf6) border-box;
}

.ingrid-glow-border:hover {
  box-shadow:
    0 0 20px rgba(59, 130, 246, 0.3),
    0 0 40px rgba(139, 92, 246, 0.2);
}
```

## MynaUI Component Standards

### EnhancedCard Variants
Use these consistently across the application:

```typescript
// Standard Cards (most common use case)
<EnhancedCard variant="default" animation="subtle">

// Glass Cards (special emphasis, floating elements)
<EnhancedCard variant="glass" animation="lift" className="backdrop-blur-xl border-white/30 bg-blue-50/30">

// Neural AI Cards (AI-powered features)
<EnhancedCard variant="neural" animation="lift">

// Status Cards
<EnhancedCard variant="success">     // Positive metrics
<EnhancedCard variant="warning">     // Attention needed
<EnhancedCard variant="elevated">    // High-priority content
```

### EnhancedButton Variants
Consistent button usage patterns:

```typescript
// Primary Actions (main CTAs)
<EnhancedButton variant="gradient" size="lg" animation="lift">

// Neural AI Actions
<EnhancedButton variant="neural" animation="subtle">

// Secondary Actions
<EnhancedButton variant="outline" animation="subtle">

// Glass/Transparent Actions
<EnhancedButton variant="glass" animation="lift">

// Status Actions
<EnhancedButton variant="success">   // Approve, confirm
<EnhancedButton variant="warning">   // Review, caution
<EnhancedButton variant="destructive"> // Delete, reject
```

### Animation Standards
```typescript
// Subtle hover effects (default for most elements)
animation="subtle"     // hover:scale-[1.02]

// Lift effects (important cards and buttons)
animation="lift"       // hover:-translate-y-1

// Glow effects (special emphasis)
animation="glow"       // hover:shadow-primary/25

// No animation (dense data tables, forms)
animation="none"
```

## Typography

### Headings
```typescript
// Page Titles (H1)
<h1 className="text-4xl font-bold bg-gradient-to-r from-slate-700 via-blue-600 to-slate-600 bg-clip-text text-transparent">

// Section Titles (H2)
<h2 className="text-2xl font-semibold text-foreground">

// Subsection Titles (H3)
<h3 className="text-xl font-medium text-foreground">

// Card Titles
<EnhancedCardTitle className="text-primary">
```

### Body Text
```typescript
// Primary text
<p className="text-foreground">

// Muted/secondary text
<p className="text-muted-foreground">

// Small text (captions, metadata)
<p className="text-sm text-muted-foreground">
```

## Layout Patterns

### RootLayout Architecture (NEW!)
The entire application uses a unified layout system with:

1. **Fixed Background Gradient** - Applied at RootLayout level
```typescript
// In RootLayout.tsx
<div className="fixed inset-0 bg-gradient-to-br from-slate-100 via-gray-200 to-blue-100 dark:from-slate-900 dark:via-gray-900 dark:to-blue-950 -z-10">
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/15 rounded-full blur-3xl animate-pulse" />
    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-slate-400/20 to-blue-400/15 rounded-full blur-3xl" />
    <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-gradient-to-br from-indigo-300/15 to-transparent rounded-full blur-2xl animate-pulse" />
  </div>
</div>
```

2. **Enhanced Top Bar** - Card-style header with rounded corners
```typescript
<header className="flex h-14 shrink-0 items-center gap-3 border rounded-xl bg-gradient-to-r from-slate-50/80 via-white/90 to-blue-50/80 dark:from-slate-900/80 dark:via-slate-950/90 dark:to-blue-950/80 backdrop-blur-sm px-6 shadow-md mx-3 mt-3 mb-4">
  <SidebarTrigger />
  <div className="h-6 w-px bg-border mx-2" />
  {/* Page title with icon */}
  {/* Actions (NotificationBell, UserProfileMenu, custom actions) */}
</header>
```

3. **Card-Style Sidebar** - Self-contained card with perfect alignment ✅ FINAL STANDARD
```css
/* Applied in globals.css - DO NOT MODIFY WITHOUT APPROVAL */
[data-sidebar="sidebar"] {
  background: hsl(0 0% 100% / 0.95);
  border: 1px solid hsl(0 0% 89.8%);
  border-radius: 0.75rem; /* Fully rounded - all corners */
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);

  /* Critical Spacing - Matches main content area */
  margin-left: 0.25rem;    /* Tight left spacing */
  margin-right: 0.25rem;   /* Tight right spacing */
  margin-top: 0;           /* Aligns with first rounded corner on page */
  margin-bottom: 1rem;     /* Comfortable bottom padding */

  /* Internal Spacing */
  padding: 1.5rem 1rem;    /* Comfortable internal padding */

  /* Sizing */
  height: calc(100vh - 1rem); /* Full height minus bottom margin */
  width: calc(var(--sidebar-width) + 2rem); /* Wider for comfort */
}

/* Dark mode */
.dark [data-sidebar="sidebar"] {
  background: hsl(0 0% 7% / 0.95);
  border: 1px solid hsl(0 0% 20%);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
}
```

**Key design features (APPROVED STANDARD):**
- ✅ **Fully rounded corners** (0.75rem all sides) - self-contained card
- ✅ **Aligned with page top** - no top margin, starts at first rounded corner
- ✅ **Comfortable bottom padding** - 1rem margin prevents running off page
- ✅ **Tight horizontal spacing** - 0.25rem left/right for efficient layout
- ✅ **Wider sidebar** - Added 2rem width for comfortable menu items
- ✅ **Professional shadow** - Matches top menu bar shadow depth
- ✅ **Semi-transparent background** - 95% opacity for modern look

### Page Content Pattern (Recommended)
Pages should use simple container structure - background is handled by RootLayout:

```typescript
<div className="space-y-8">
  {/* Your page content */}
  <EnhancedDashboardHeader title="..." subtitle="..." />
  <div className="grid gap-6">
    {/* Cards, tables, etc. */}
  </div>
</div>
```

**Key points:**
- No absolute positioning needed
- No manual background gradients in pages
- RootLayout handles all background styling
- Pages focus on content structure only

### Card Grids
```typescript
// 3-column grid (standard)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// 4-column grid (stat cards)
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
```

## Border Standards

### Input Borders
```css
/* Visible but thin borders for inputs */
input, textarea, select {
  border: 1px solid hsl(0 0% 70%);
  border-radius: 0.375rem;
  transition: all 150ms ease-in-out;
}

/* Focus state - subtle but visible darker border */
input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: hsl(0 0% 50%);
  border-width: 1.5px;
}

/* Dark mode - lighter grey for visibility */
.dark input:focus,
.dark textarea:focus,
.dark select:focus {
  border-color: hsl(0 0% 60%);
  border-width: 1.5px;
}
```

### Selected Element Borders
```css
/* INVISIBLE - for standard UI appearance */
[data-state="active"],
[data-highlighted],
[aria-selected="true"] {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}
```

## ✨ MynaUI Icon System (NEW!)

**Version 2.0 - Unified Icon Library**

All icons in INFOtrac use MynaUI icons for brand consistency and visual coherence.

### Centralized Icon Import

```typescript
// ✅ CORRECT - Import from centralized icon helper
import { MenuIcon, AddIcon, EditIcon, DeleteIcon } from '@/lib/icons';

// ❌ WRONG - Do not import directly from lucide-react
import { Menu, Plus, Edit, Trash2 } from 'lucide-react';
```

### Icon Categories

**Navigation Icons:**
```typescript
import {
  MenuIcon, CloseIcon, ChevronDownIcon, ChevronUpIcon,
  ChevronLeftIcon, ChevronRightIcon, ArrowLeftIcon,
  ArrowRightIcon, HomeIcon, SearchIcon
} from '@/lib/icons';
```

**Action Icons:**
```typescript
import {
  AddIcon, EditIcon, DeleteIcon, SaveIcon, CopyIcon,
  DownloadIcon, UploadIcon, RefreshIcon, SettingsIcon,
  MoreHorizontalIcon, MoreVerticalIcon
} from '@/lib/icons';
```

**Status & Indicators:**
```typescript
import {
  CheckIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon,
  XCircleIcon, AlertTriangleIcon, LoaderIcon
} from '@/lib/icons';
```

**Business & Data:**
```typescript
import {
  DollarIcon, FileTextIcon, FileIcon, FolderIcon,
  UsersIcon, UserIcon, BuildingIcon, ShoppingBagIcon,
  TrendingUpIcon, TrendingDownIcon, CalendarIcon, ClockIcon
} from '@/lib/icons';
```

**AI & Special:**
```typescript
import {
  AIIcon, NeuralIcon, AutomationIcon, SecurityIcon,
  KeyIcon, LockIcon, UnlockIcon
} from '@/lib/icons';
```

### Icon Sizes

Use the standardized size constants for consistency:

```typescript
import { ICON_SIZES } from '@/lib/icons';

// Small (inline with text)
<Icon className={ICON_SIZES.sm} /> // h-4 w-4

// Medium (buttons, cards)
<Icon className={ICON_SIZES.md} /> // h-5 w-5

// Large (features, headers)
<Icon className={ICON_SIZES.lg} /> // h-6 w-6

// Extra large (hero sections)
<Icon className={ICON_SIZES.xl} /> // h-8 w-8

// Manual sizing
<Icon className="h-4 w-4" />  // xs
<Icon className="h-5 w-5" />  // sm (default)
<Icon className="h-6 w-6" />  // md
<Icon className="h-8 w-8" />  // lg
<Icon className="h-12 w-12" /> // xl
```

### Icon Colors

Use the standardized color constants for semantic meaning:

```typescript
import { ICON_COLORS } from '@/lib/icons';

// Primary icons (blue)
<Icon className={ICON_COLORS.primary} />

// Success icons (green)
<Icon className={ICON_COLORS.success} />

// Warning icons (amber)
<Icon className={ICON_COLORS.warning} />

// Danger icons (red)
<Icon className={ICON_COLORS.danger} />

// Muted icons (gray)
<Icon className={ICON_COLORS.muted} />

// AI/Neural icons (purple)
<Icon className={ICON_COLORS.neural} />

// Manual coloring
<Icon className="text-blue-600 dark:text-blue-400" />   // Primary
<Icon className="text-green-600 dark:text-green-400" /> // Success
<Icon className="text-amber-600 dark:text-amber-400" /> // Warning
<Icon className="text-red-600 dark:text-red-400" />     // Error
<Icon className="text-muted-foreground" />              // Muted
<Icon className="text-purple-600 dark:text-purple-400" /> // Neural
```

### Complete Icon Usage Example

```typescript
import {
  AddIcon, EditIcon, DeleteIcon, CheckIcon,
  ICON_SIZES, ICON_COLORS
} from '@/lib/icons';

// Add button with icon
<EnhancedButton variant="gradient" leftIcon={<AddIcon className={ICON_SIZES.sm} />}>
  Add Item
</EnhancedButton>

// Stat card with colored icon
<EnhancedStatCard
  title="Total Revenue"
  value="$45,231"
  icon={DollarIcon}
  variant="success"
/>

// Action menu icons
<DropdownMenuItem>
  <EditIcon className={cn(ICON_SIZES.sm, ICON_COLORS.primary)} />
  <span>Edit</span>
</DropdownMenuItem>
<DropdownMenuItem>
  <DeleteIcon className={cn(ICON_SIZES.sm, ICON_COLORS.danger)} />
  <span>Delete</span>
</DropdownMenuItem>
```

### Migration from Lucide Icons

The centralized icon helper includes a `LegacyIconAdapter` for gradual migration:

```typescript
import { LegacyIconAdapter } from '@/lib/icons';

// Map old Lucide names to new MynaUI names
console.log(LegacyIconAdapter['Trash2']); // 'DeleteIcon'
console.log(LegacyIconAdapter['Brain']); // 'NeuralIcon'
```

## Spacing Standards

```typescript
// Section spacing
space-y-8       // Between major sections
space-y-6       // Between cards/components
space-y-4       // Within components
space-y-2       // Between form fields

// Padding
p-6             // Page containers (content)
p-4             // Standard cards and stat cards (COMPACT)
p-3             // Table headers (COMPACT)
p-2             // Compact elements, table cells (COMPACT)
```

## Compact Table Standards (NEW!)

**Philosophy**: Tables must efficiently display large datasets across all screen sizes.

### Table Sizing
```css
/* Global compact table styles in globals.css */
table {
  font-size: 0.875rem; /* 14px */
}

/* Headers - slim and efficient */
table thead th {
  padding: 0.5rem 0.75rem; /* px-3 py-2 */
  font-size: 0.8125rem; /* 13px */
  font-weight: 600;
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Body cells - compact but readable */
table tbody td {
  padding: 0.5rem 0.75rem; /* px-3 py-2 */
  font-size: 0.875rem; /* 14px */
  line-height: 1.3;
}

/* Badges in tables */
table .badge {
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem; /* 12px */
}

/* Action buttons */
table button {
  padding: 0.25rem 0.5rem;
  font-size: 0.8125rem; /* 13px */
}
```

### EnhancedDataTable Component
- **Header padding**: `px-4 py-3` (reduced from `p-6`)
- **Cell padding**: `px-3 py-2` (reduced from `p-4`)
- **Header font**: `text-xs uppercase tracking-wide font-semibold`
- **Body font**: `text-sm`
- **Actions column width**: `w-[80px]` (reduced from `w-[100px]`)

### Stat Cards - Compact Version
- **Padding**: `p-4` (reduced from `p-6`)
- **Icon size**: `h-4 w-4` (reduced from `h-5 w-5`)
- **Title font**: `text-xs` (reduced from `text-sm`)
- **Subtitle font**: `text-[10px]` (reduced from `text-xs`)
- **Value font**: `text-2xl` (reduced from `text-3xl`)
- **Trend font**: `text-[10px]` (reduced from `text-xs`)

## Component Composition Examples

### Stat Card (Dashboard Metrics)
```typescript
<EnhancedCard variant="elevated" animation="subtle">
  <EnhancedCardHeader>
    <div className="flex items-center justify-between">
      <Icon className="h-8 w-8 text-blue-600" />
      <Badge variant="secondary">+12%</Badge>
    </div>
    <EnhancedCardTitle className="text-lg">Total Expenses</EnhancedCardTitle>
  </EnhancedCardHeader>
  <EnhancedCardContent>
    <div className="text-3xl font-bold">$45,231</div>
    <p className="text-sm text-muted-foreground">+$4,231 from last month</p>
  </EnhancedCardContent>
</EnhancedCard>
```

### Feature Card (Homepage)
```typescript
<EnhancedCard variant="neural" animation="lift" className="cursor-pointer">
  <EnhancedCardHeader>
    <div className="flex items-center justify-between">
      <Brain className="h-8 w-8 text-blue-600" />
      <Badge variant="secondary">AI</Badge>
    </div>
    <EnhancedCardTitle className="text-primary">Ingrid AI Assistant</EnhancedCardTitle>
    <EnhancedCardDescription>
      Revolutionary conversational AI that processes any document type
    </EnhancedCardDescription>
  </EnhancedCardHeader>
  <EnhancedCardContent>
    <EnhancedButton variant="neural" className="w-full">
      Try Ingrid AI
    </EnhancedButton>
  </EnhancedCardContent>
</EnhancedCard>
```

### Form Layout
```typescript
<EnhancedCard variant="glass" animation="lift" padding="lg">
  <EnhancedCardHeader>
    <EnhancedCardTitle>Form Title</EnhancedCardTitle>
    <EnhancedCardDescription>Form description</EnhancedCardDescription>
  </EnhancedCardHeader>
  <EnhancedCardContent>
    <form className="space-y-4">
      <div className="space-y-3">
        <Label htmlFor="field" className="text-sm font-medium text-foreground/80">
          Field Label
        </Label>
        <Input
          id="field"
          className="h-11 bg-white/50 dark:bg-gray-800/50"
        />
      </div>
      <EnhancedButton type="submit" variant="gradient" size="lg" className="w-full">
        Submit
      </EnhancedButton>
    </form>
  </EnhancedCardContent>
</EnhancedCard>
```

### Expandable Data Table with Action Cards ⭐ NEW!
**The revolutionary expandable row pattern for data tables**

```typescript
import { EnhancedDataTable } from '@/components/myna/dashboard/enhanced-data-table';
import { ExpandedActionCard, ActionDetail, ActionButton } from '@/components/myna/dashboard/expanded-action-card';
import { User, Mail, Shield, Edit, Trash2, Settings } from 'lucide-react';

<EnhancedDataTable
  data={users}
  columns={columns}
  searchable={true}
  searchPlaceholder="Search users..."
  loading={isLoading}
  expandable={true}
  getRowId={(user) => user.id}
  renderExpandedContent={(user) => {
    // Define details to display
    const details: ActionDetail[] = [
      { label: 'Full Name', value: user.fullName, icon: User },
      { label: 'Email', value: user.email, icon: Mail },
      { label: 'Role', value: user.role, icon: Shield, badge: true },
    ];

    // Define action buttons
    const actionButtons: ActionButton[] = [
      {
        label: 'Edit User',
        icon: Edit,
        onClick: () => handleEdit(user.id),
        variant: 'gradient',
        category: 'primary'
      },
      {
        label: 'Manage Settings',
        icon: Settings,
        onClick: () => handleSettings(user.id),
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
        title={`${user.fullName} Details`}
        subtitle={`User ID: ${user.id}`}
        headerIcon={User}
        details={details}
        actions={actionButtons}
        variant="elevated"
      />
    );
  }}
/>
```

**Features:**
- ✅ **One-click expansion** - Click the chevron to expand/collapse rows
- ✅ **Glass morphism design** - Beautiful gradient backgrounds with backdrop blur
- ✅ **Organized actions** - Primary, secondary, and destructive actions clearly categorized
- ✅ **Rich details** - Display all item information with icons and badges
- ✅ **Smooth animations** - 300ms slide-in/fade-in transitions
- ✅ **Mobile responsive** - Two-column desktop, single-column mobile
- ✅ **Smart state management** - Only one row expanded at a time
- ✅ **Keyboard accessible** - Full keyboard navigation support

**ExpandedActionCard Props:**
```typescript
interface ActionDetail {
  label: string;           // Field label
  value: React.ReactNode;  // Field value
  icon?: LucideIcon;       // Optional icon
  badge?: boolean;         // Render as badge
  className?: string;      // Custom styling
}

interface ActionButton {
  label: string;                          // Button label
  icon: LucideIcon;                       // Button icon
  onClick: () => void;                    // Click handler
  variant?: "gradient" | "outline" | "destructive" | "success" | "neural";
  size?: "sm" | "default" | "lg";
  category?: "primary" | "secondary" | "destructive";
  disabled?: boolean;
  loading?: boolean;
}
```

## Branding Elements

### Logo & Branding
```typescript
// Primary brand display
<span className="text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
  Ask Ingrid
</span>

// Powered by attribution
<p className="text-sm text-muted-foreground">
  Powered by Argyle Integrations
</p>
```

### Ingrid AI Avatar
```typescript
// Use the animated avatar component for AI features
<IngridAnimatedAvatar size="sm" status="online" />
```

## Accessibility

- All interactive elements must have visible focus states
- Maintain WCAG AA contrast ratios (4.5:1 for normal text)
- Use semantic HTML elements
- Provide aria-labels for icon-only buttons
- Support keyboard navigation

## Implementation Checklist

When creating a new page or component:

- [ ] Use gradient background for dashboards/special pages
- [ ] Apply EnhancedCard with appropriate variant
- [ ] Use EnhancedButton with consistent variant patterns
- [ ] Apply heading gradients for page titles
- [ ] Use proper spacing (space-y-8 for sections)
- [ ] Add subtle animations (lift/subtle)
- [ ] Ensure borders follow standards (visible inputs, invisible selections)
- [ ] Use semantic status colors consistently
- [ ] Add appropriate icons with proper sizing
- [ ] Test in both light and dark modes

## Migration Strategy

To update an existing page to use the Ingrid Design System:

1. **Background**: Add gradient background with optional animated orbs
2. **Cards**: Replace old Card components with EnhancedCard variants
3. **Buttons**: Replace old Button components with EnhancedButton variants
4. **Headings**: Apply gradient text for main titles
5. **Colors**: Replace bright colors with reserved slate/blue palette
6. **Spacing**: Standardize to space-y-8, space-y-6 patterns
7. **Animations**: Add subtle or lift animations to cards/buttons
8. **Test**: Verify in light/dark mode and check responsive behavior

## References

- MynaUI Implementation: `MynaUI_IMPLEMENTATION.md`
- Component Documentation: `src/components/myna/`
- Color System: `src/globals.css`
- Example Pages: `src/pages/Login.tsx`, `src/pages/Index.tsx`