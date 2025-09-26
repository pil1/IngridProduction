# Module Activation System Documentation

## Overview
INFOtrac uses a sophisticated module-based architecture that allows for granular control over features and functionality. This document outlines how modules are created, activated, and provisioned throughout the system.

## Module Architecture

### Core Components
1. **System Modules** (`modules` table) - Defines available modules
2. **Company Modules** (`company_modules` table) - Controls which modules companies can access
3. **User Modules** (`user_modules` table) - Controls which modules individual users can access
4. **Menu System** (`use-user-menu-preferences.tsx`) - Controls UI visibility

### Module Types
- **Core**: Essential system functionality (always required)
- **Add-on**: Optional features that can be enabled/disabled
- **Super**: Advanced features typically for enterprise clients

### Module Categories
- **Core**: Dashboard, User Management, Company Settings
- **Operations**: Vendors, Customers, Expenses
- **Accounting**: GL Accounts, Expense Categories
- **AI**: Ingrid AI features
- **Automation**: Process automation features
- **Analytics**: Reporting and analytics
- **General**: Miscellaneous features

## Module Activation Workflow

### Step 1: Create System Module
When developing a new feature, first create the system module in the database:

```sql
INSERT INTO modules (
    name,
    description,
    module_type,
    category,
    is_core_required,
    is_active,
    default_monthly_price,
    default_per_user_price,
    requires_modules,
    feature_flags,
    api_endpoints,
    ui_components
) VALUES (
    'New Feature Module',
    'Description of the new feature',
    'add-on',  -- or 'core' for essential features
    'operations',  -- appropriate category
    false,  -- true only for essential features
    true,
    10.00,  -- monthly price
    2.50,   -- per-user price
    '[]',   -- JSON array of required module IDs
    '{"advanced_mode": true}',  -- feature flags
    '["/api/new-feature"]',  -- API endpoints
    '["NewFeatureComponent"]'  -- UI components
);
```

### Step 2: Update Menu System
Add the new module to the menu system in `src/hooks/use-user-menu-preferences.tsx`:

```typescript
// Add to DEFAULT_MENU_ITEMS array
{
    id: "new-feature",
    label: "New Feature",
    path: "/new-feature",
    icon: NewFeatureIcon,
    roles: ['admin', 'super-admin'],
    companyRequired: true,
    isHidden: false
}

// Add to getModuleIdForMenuItem function
case "new-feature": return moduleNameToIdMap.get("New Feature Module");
```

### Step 3: Create UI Components and Routes
1. Create the feature components in `src/components/` or `src/pages/`
2. Add routes to `src/App.tsx`
3. Implement proper role-based access control

### Step 4: Super-Admin Provisioning
Super-admins can provision modules for companies through:
- **User Management > Company Access Tab**
- Company creation workflow
- Module management interface

### Step 5: Admin User Assignment
Company admins can assign modules to their users through:
- **User Management > Users Tab**
- Individual user edit dialogs
- Bulk operations

## Current Module Status

### Core Modules (Always Enabled)
- ✅ Dashboard
- ✅ User Management
- ✅ Company Settings
- ✅ Notifications
- ✅ Vendors
- ✅ Customers
- ✅ GL Accounts
- ✅ Expense Categories

### Add-on Modules
- ✅ **Expense Management** - Advanced expense tracking
- ✅ **Ingrid AI** - AI-powered categorization and suggestions
- ✅ **Advanced Analytics** - Enhanced reporting and insights

### Recently Removed Modules
- ❌ **Analytics** (replaced by Advanced Analytics)
- ❌ **Process Automation** (dummy feature, never built)
- ❌ **Customer Management** (doesn't exist, Customers is the real module)

## Database Schema

### modules Table
```sql
- id: UUID (Primary Key)
- name: VARCHAR(100) UNIQUE
- description: TEXT
- module_type: ENUM('core', 'add-on', 'super')
- category: VARCHAR(50)
- is_core_required: BOOLEAN
- is_active: BOOLEAN
- default_monthly_price: DECIMAL(10,2)
- default_per_user_price: DECIMAL(10,2)
- requires_modules: JSONB (array of module IDs)
- feature_flags: JSONB
- api_endpoints: JSONB (array of endpoints)
- ui_components: JSONB (array of component names)
```

### company_modules Table
```sql
- id: UUID (Primary Key)
- company_id: UUID (FK to companies)
- module_id: UUID (FK to modules)
- is_enabled: BOOLEAN
- enabled_by: UUID (FK to profiles)
- enabled_at: TIMESTAMP
- configuration: JSONB
- usage_limits: JSONB
- billing_tier: VARCHAR(50)
```

### user_modules Table
```sql
- id: UUID (Primary Key)
- user_id: UUID (FK to auth.users)
- module_id: UUID (FK to modules)
- company_id: UUID (FK to companies)
- is_enabled: BOOLEAN
- granted_by: UUID (FK to profiles)
- granted_at: TIMESTAMP
- restrictions: JSONB
- expires_at: TIMESTAMP
```

## Access Control Flow

### 1. Route Protection
```typescript
// In App.tsx
<ProtectedRoute allowedRoles={['admin', 'super-admin']}>
    <YourComponent />
</ProtectedRoute>
```

### 2. Module-Based Visibility
```typescript
// In use-user-menu-preferences.tsx
const { data: visibleModules } = useVisibleModules();
const isModuleVisible = visibleModules?.some(m => m.id === moduleId);
```

### 3. Company-Level Access
```typescript
// Check if company has module enabled
const { data: companyModules } = useQuery(['companyModules', companyId]);
const hasModuleAccess = companyModules?.some(cm =>
    cm.module_id === moduleId && cm.is_enabled
);
```

### 4. User-Level Access
```typescript
// Check if user has specific module access
const { data: userModules } = useQuery(['userModules', userId]);
const canAccessModule = userModules?.some(um =>
    um.module_id === moduleId && um.is_enabled
);
```

## Development Guidelines

### For New Features
1. **Always** create the system module first
2. **Always** update the menu system mapping
3. **Always** implement proper access control
4. **Always** test the full activation workflow
5. **Never** hardcode module access - use the database

### For Module Updates
1. Update module metadata in the database
2. Update any dependent UI components
3. Test provisioning and de-provisioning
4. Verify billing impact if applicable

### For Module Removal
1. Remove from menu system first
2. Deprecate UI components
3. Clean up database entries
4. Update documentation

## Testing Module Activation

### Test Scenarios
1. **Super-admin creates company** - Core modules auto-enabled
2. **Super-admin adds add-on** - Module becomes available to company admins
3. **Admin assigns to users** - Users can access the feature
4. **Module removal** - Access properly revoked
5. **Role changes** - Module visibility updates correctly

### Verification Points
- [ ] Module appears in super-admin module management
- [ ] Module can be enabled for companies
- [ ] Company admins see module in user assignment
- [ ] Users with access see menu item
- [ ] Users without access cannot access routes
- [ ] Billing reflects module usage

## Future Enhancements

### Planned Features
- **Dynamic Module Loading** - Load modules without code deployments
- **Module Dependencies** - Automatic enabling of required modules
- **Usage Analytics** - Track module adoption and usage
- **A/B Testing** - Feature flags for gradual rollouts
- **Third-party Modules** - Plugin system for external integrations

### Integration Points
- **SPIRE Integration** - Sync modules with external accounting
- **Billing System** - Automated usage-based billing
- **Analytics Dashboard** - Module performance metrics
- **API Gateway** - Module-based endpoint access control

## Support and Troubleshooting

### Common Issues
1. **Module not visible** - Check company_modules.is_enabled
2. **User can't access** - Check user_modules.is_enabled
3. **Route forbidden** - Check role-based access control
4. **Menu item missing** - Check menu system mapping

### Debug Queries
```sql
-- Check module status for company
SELECT m.name, cm.is_enabled
FROM modules m
LEFT JOIN company_modules cm ON m.id = cm.module_id
WHERE cm.company_id = 'company-uuid';

-- Check user module access
SELECT m.name, um.is_enabled
FROM modules m
LEFT JOIN user_modules um ON m.id = um.module_id
WHERE um.user_id = 'user-uuid';
```

---

*This document should be updated whenever new modules are added or the activation system is modified.*