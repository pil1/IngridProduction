# INFOtrac Permissions System v2.0
## Two-Tier Permission Architecture

**Last Updated:** September 30, 2025
**Migration:** Version 014_refactor_permissions_system.sql
**Status:** ✅ Active

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tier 1: Data Permissions](#tier-1-data-permissions)
4. [Tier 2: Module Permissions](#tier-2-module-permissions)
5. [Permission Workflows](#permission-workflows)
6. [User Onboarding](#user-onboarding)
7. [Developer Guide](#developer-guide)
8. [API Reference](#api-reference)

---

## Overview

INFOtrac's permission system has been redesigned to provide clarity, flexibility, and scalability. The new architecture separates permissions into two clear tiers:

### **Tier 1: Data Permissions (Foundation)**
Basic operational permissions that control access to core data and features. These are **free** and form the foundation of user access.

### **Tier 2: Module Permissions (Premium)**
Advanced features packaged as modules with premium pricing. Each module includes specific permissions and sub-features.

---

## Architecture

### The Problem We Solved

**Before (Old System):**
- ❌ Confusing mix of "modules" and "permissions"
- ❌ Users didn't understand why they couldn't access features
- ❌ Admins struggled to grant the right access
- ❌ No clear pricing model
- ❌ Module access != feature access

**After (New System):**
- ✅ Clear separation: Data Permissions (free) vs Module Permissions (paid)
- ✅ Transparent pricing tied to modules
- ✅ Automatic permission grants when modules are enabled
- ✅ Permission templates for quick user setup
- ✅ Audit trail for all permission changes

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     SUPER ADMIN                              │
│  1. Provisions modules to companies (with custom pricing)   │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                   COMPANY ADMIN                              │
│  2. Manages user data permissions (foundation)              │
│  3. Assigns modules to users (if company has access)        │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                      END USER                                │
│  4. Accesses features based on granted permissions          │
│  5. Module permissions auto-granted when module enabled     │
└─────────────────────────────────────────────────────────────┘
```

---

## Tier 1: Data Permissions

### What Are Data Permissions?

**Data Permissions** are foundation-level operational permissions that control access to core system features. These are **NOT** tied to paid modules—they're basic access controls that every user needs.

### Permission Groups

#### 1. Company Configuration
Controls access to company-wide settings.

| Permission Key | Description | Typical Users |
|---------------|-------------|---------------|
| `company.settings.view` | View company settings | Admin, Manager |
| `company.settings.edit` | Edit company settings | Admin only |

#### 2. Dashboard & Analytics (Basic)
Basic dashboard and reporting access.

| Permission Key | Description | Typical Users |
|---------------|-------------|---------------|
| `dashboard.view` | View dashboard | All users |
| `analytics.view` | View basic analytics | Manager, Admin |

#### 3. Customer Relationship Management
Customer data access and management.

| Permission Key | Description | Typical Users |
|---------------|-------------|---------------|
| `customers.view` | View customers | Sales, Admin |
| `customers.create` | Create new customers | Sales, Admin |
| `customers.edit` | Edit customer information | Sales, Admin |
| `customers.delete` | Delete customers | Admin only |

#### 4. Vendor and Supplier Management
Vendor data access and management.

| Permission Key | Description | Typical Users |
|---------------|-------------|---------------|
| `vendors.view` | View vendors | Purchasing, Admin |
| `vendors.create` | Create new vendors | Purchasing, Admin |
| `vendors.edit` | Edit vendor information | Purchasing, Admin |
| `vendors.delete` | Delete vendors | Admin only |

#### 5. Expense Operations (Basic)
Basic expense tracking (no advanced features).

| Permission Key | Description | Typical Users |
|---------------|-------------|---------------|
| `expenses.view` | View expenses | All users |
| `expenses.create` | Submit expenses | All users |
| `expenses.edit` | Edit own expenses | All users |
| `expenses.delete` | Delete expenses | Manager, Admin |

#### 6. GL Account Management
General ledger account configuration.

| Permission Key | Description | Typical Users |
|---------------|-------------|---------------|
| `gl_accounts.view` | View GL accounts | Accounting, Admin |
| `gl_accounts.create` | Create GL accounts | Accounting, Admin |
| `gl_accounts.edit` | Edit GL accounts | Accounting, Admin |
| `gl_accounts.delete` | Delete GL accounts | Admin only |

#### 7. Expense Category Management
Expense category organization.

| Permission Key | Description | Typical Users |
|---------------|-------------|---------------|
| `expense_categories.view` | View categories | All users |
| `expense_categories.create` | Create categories | Admin |
| `expense_categories.edit` | Edit categories | Admin |
| `expense_categories.delete` | Delete categories | Admin |

#### 8. User Management
User administration permissions.

| Permission Key | Description | Typical Users |
|---------------|-------------|---------------|
| `users.view` | View users | Admin |
| `users.create` | Create new users | Admin |
| `users.edit` | Edit user details | Admin |
| `users.delete` | Delete users | Admin |

#### 9. Notification Management
System and user notifications.

| Permission Key | Description | Typical Users |
|---------------|-------------|---------------|
| `notifications.view` | View notifications | All users |
| `notifications.manage` | Manage notification settings | Admin |

### How to Grant Data Permissions

**As Company Admin:**
1. Navigate to **User Management**
2. Select a user
3. Click **Manage Permissions**
4. In the **Data Permissions** section, toggle permissions by group
5. Click **Save Changes**

**Using Permission Templates (Recommended):**
1. Navigate to **User Management**
2. Click **Create New User**
3. Select a **Permission Template**:
   - **Basic User** - Standard employee access
   - **Expense Reviewer** - Can review and approve expenses
   - **Department Manager** - Full operational access
   - **Controller** - Full financial and accounting access
4. Customize additional permissions if needed

---

## Tier 2: Module Permissions

### What Are Module Permissions?

**Module Permissions** are premium features packaged as modules. Each module:
- Has a monthly base price + per-user price
- Includes specific permissions
- May have sub-features
- Requires super-admin provisioning to companies
- Requires company admin assignment to users

### Module Tiers

#### Core Modules (Free)
Always included, no additional cost.

| Module | Description | Permissions |
|--------|-------------|-------------|
| **Dashboard & Analytics** | Basic dashboard and reporting | `dashboard.view`, `analytics.view` |
| **User Management** | User administration | `users.*` |
| **Company Settings** | Company configuration | `company.settings.*` |
| **Notifications** | System notifications | `notifications.*` |

#### Standard Tier Modules
Entry-level paid modules.

| Module | Base Price | Per User | Permissions | Sub-Features |
|--------|-----------|----------|-------------|--------------|
| **Customer Management** | $9.99/mo | $2.50/user | `customers.*` | Basic CRM |
| **Vendor Management** | $9.99/mo | $2.50/user | `vendors.*` | Vendor tracking |
| **Basic Expense Tracking** | $14.99/mo | $3.99/user | `expenses.view/create/edit` | Simple expense submission |

#### Premium Tier Modules
Advanced features with premium pricing.

| Module | Base Price | Per User | Key Permissions | Sub-Features |
|--------|-----------|----------|-----------------|--------------|
| **Expense Management Suite** | $29.99/mo | $5.99/user | `expenses.approve`, `expenses.review`, `expenses.assign` | • Approval Workflow<br>• Multi-level Review<br>• Assignment & Delegation<br>• Advanced Filtering |
| **Ingrid AI Assistant** | $39.99/mo | $7.99/user | `ingrid.*` | • AI Category Suggestions<br>• AI Vendor Suggestions<br>• Smart Document Naming<br>• Document Intelligence<br>• Chat Interface |
| **Advanced Analytics & Reporting** | $24.99/mo | $4.99/user | `analytics.advanced`, `analytics.export` | • Custom Report Builder<br>• Advanced Visualizations<br>• Export to Excel/PDF<br>• Scheduled Reports |
| **Process Automation** | $34.99/mo | $6.99/user | `automation.*` | • Email Processing<br>• Workflow Automation<br>• Custom Rules Engine<br>• API Integrations |

### How Module Permissions Work

When a super-admin provisions a module to a company:
1. The module becomes **available** to that company
2. Company admins can **assign** the module to specific users
3. When a user receives module access, they **automatically get** all required module permissions
4. Optional module permissions can be granted individually

**Example: Expense Management Suite**

```
User receives module → Automatically granted:
  ✅ expenses.approve
  ✅ expenses.review

Admin can optionally grant:
  ⚙️ expenses.assign (if user is admin)
```

### Pricing Tiers

#### Standard Pricing
Default pricing based on module tier.

| Module Tier | Monthly Base | Per User |
|------------|--------------|----------|
| Core | $0 | $0 |
| Standard | $9.99 | $2.50 |
| Premium | $29.99 | $5.99 |

#### Custom Pricing
Super-admins can set custom pricing per company.

| Pricing Tier | Description |
|--------------|-------------|
| **Standard** | Default module pricing |
| **Custom** | Custom pricing for specific company |
| **Enterprise** | Volume discount pricing |

---

## Permission Workflows

### 1. Super-Admin: Company Module Provisioning

**Goal:** Grant a company access to a premium module with custom pricing.

**Steps:**
1. Navigate to **Super Admin Dashboard** → **Company Management**
2. Select a company
3. Go to **Module Provisioning** tab
4. Select a module to provision
5. Configure pricing:
   - Select pricing tier (Standard/Custom/Enterprise)
   - Set monthly base price
   - Set per-user price
   - Set licensed user count
6. Add billing notes (optional)
7. Click **Provision Module**
8. Module is now available to company admins

**API Call:**
```typescript
POST /api/modules/company/:companyId/provision

{
  "module_id": "uuid",
  "is_enabled": true,
  "pricing_tier": "custom",
  "monthly_price": 29.99,
  "per_user_price": 5.99,
  "users_licensed": 15,
  "billing_notes": "Custom pricing for enterprise client"
}
```

### 2. Company Admin: User Permission Management

**Goal:** Grant a user both data permissions and module access.

**Steps:**

#### A. Grant Data Permissions (Foundation)
1. Navigate to **User Management**
2. Select user → **Manage Permissions**
3. In **Data Permissions** section:
   - Expand permission groups
   - Toggle permissions on/off
   - Review permission dependencies
4. Click **Save Data Permissions**

#### B. Grant Module Access (Premium)
1. In same dialog, go to **Module Permissions** section
2. View modules available to company
3. Toggle module access for user
4. Review included permissions
5. Optionally grant/revoke individual module permissions
6. Click **Save Module Permissions**

**Best Practice:**
Use **Permission Templates** for new users:
- Select template matching user role
- Fine-tune specific permissions
- One-click setup saves time

### 3. Bulk Permission Updates

**Goal:** Update permissions for multiple users at once.

**Steps:**
1. Navigate to **User Management**
2. Select multiple users (checkboxes)
3. Click **Bulk Actions** → **Update Permissions**
4. Choose permissions to grant/revoke
5. Select data permissions or modules
6. Confirm changes
7. Audit log records all changes

**Use Cases:**
- Onboard new department
- Grant module access to team
- Revoke permissions during offboarding

---

## User Onboarding

### New User Registration (Admin-Created)

**Workflow:**
1. Admin creates user
2. Admin selects **Permission Template**:
   - Basic User
   - Expense Reviewer
   - Department Manager
   - Controller
3. System auto-grants data permissions from template
4. Admin optionally grants modules (if company has access)
5. User receives invitation email

### Invited User Onboarding

**Workflow:**
1. User receives invitation link
2. User sets password
3. User completes profile
4. User sees **Welcome Wizard**:
   - Overview of granted permissions
   - Overview of available modules
   - Quick tour of accessible features
5. User directed to dashboard

### First-Login Experience

**New UI Shows:**
- ✅ **Data Permissions** you have
- ✅ **Modules** you can access
- ✅ **Features** available to you
- ℹ️ **Why** you have (or don't have) access
- 📝 **How to request** additional permissions

---

## Developer Guide

### Database Schema

#### Key Tables

```sql
-- Data Permissions (Tier 1)
data_permissions
user_data_permissions

-- Modules (Tier 2)
modules (enhanced with tier, included_permissions, sub_features)
company_modules (enhanced with pricing)
user_modules
module_permissions (junction table)
user_module_permissions

-- Templates & Audit
permission_templates
permission_change_audit
```

### Important Functions

#### `get_user_complete_permissions(user_id, company_id)`
Returns all permissions for a user (data + module + role).

```sql
SELECT * FROM get_user_complete_permissions('user-uuid', 'company-uuid');

-- Returns:
-- permission_key | permission_name | permission_source | module_name | is_granted
```

#### `grant_user_module_access(user_id, module_id, company_id, granted_by)`
Grants module access and automatically grants required permissions.

```sql
SELECT grant_user_module_access(
  'user-uuid',
  'module-uuid',
  'company-uuid',
  'admin-uuid'
);
```

#### `revoke_user_module_access(user_id, module_id, company_id)`
Revokes module access and all module permissions.

```sql
SELECT revoke_user_module_access(
  'user-uuid',
  'module-uuid',
  'company-uuid'
);
```

#### `user_has_permission(user_id, permission_key, company_id)`
Check if user has a specific permission.

```sql
SELECT user_has_permission(
  'user-uuid',
  'expenses.approve',
  'company-uuid'
); -- Returns boolean
```

### Frontend Usage

#### Check Permission
```typescript
import { usePermissions } from '@/hooks/usePermissions';

const { hasPermission, hasModule } = usePermissions();

// Check data permission
if (hasPermission('expenses.approve')) {
  // Show approve button
}

// Check module access
if (hasModule('Expense Management')) {
  // Show module features
}
```

#### Grant Permission
```typescript
import { useGrantPermission } from '@/hooks/usePermissions';

const { mutate: grantPermission } = useGrantPermission();

grantPermission({
  user_id: 'uuid',
  permission_key: 'expenses.approve',
  company_id: 'uuid',
  is_granted: true,
  reason: 'Promoted to expense reviewer'
});
```

#### Provision Module
```typescript
import { useProvisionModule } from '@/hooks/useModules';

const { mutate: provisionModule } = useProvisionModule();

provisionModule({
  company_id: 'uuid',
  module_id: 'uuid',
  is_enabled: true,
  pricing_tier: 'custom',
  monthly_price: 29.99,
  per_user_price: 5.99,
  users_licensed: 15
});
```

---

## API Reference

### Data Permissions

#### Get All Data Permissions
```http
GET /api/permissions/data
```

**Response:**
```json
{
  "success": true,
  "data": {
    "permissions": [...],
    "grouped_by_category": {...}
  }
}
```

#### Get User Data Permissions
```http
GET /api/permissions/user/:userId/data
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "data_permissions": [...],
    "permission_count": 15
  }
}
```

#### Grant/Revoke Data Permission
```http
POST /api/permissions/user/:userId/data/grant
```

**Body:**
```json
{
  "permission_key": "expenses.approve",
  "company_id": "uuid",
  "is_granted": true,
  "reason": "Promoted to reviewer",
  "expires_at": "2026-01-01T00:00:00Z"
}
```

### Module Permissions

#### Get Enhanced Modules
```http
GET /api/modules
```

**Response:**
```json
{
  "success": true,
  "data": {
    "modules": [{
      "id": "uuid",
      "name": "Expense Management",
      "module_tier": "premium",
      "included_permissions": [...],
      "sub_features": [...],
      "default_monthly_price": 29.99,
      "default_per_user_price": 5.99
    }]
  }
}
```

#### Get User's Available Modules
```http
GET /api/modules/user/:userId/available
```

**Response:**
```json
{
  "success": true,
  "data": {
    "modules": [{
      "module": {...},
      "has_access": true,
      "is_company_provisioned": true,
      "user_enabled": true
    }]
  }
}
```

#### Provision Module to Company
```http
POST /api/modules/company/:companyId/provision
```

**Body:**
```json
{
  "module_id": "uuid",
  "is_enabled": true,
  "pricing_tier": "custom",
  "monthly_price": 29.99,
  "per_user_price": 5.99,
  "users_licensed": 15,
  "billing_notes": "Enterprise client discount"
}
```

#### Grant Module to User
```http
POST /api/modules/user/:userId/grant
```

**Body:**
```json
{
  "module_id": "uuid",
  "company_id": "uuid",
  "granted_by": "admin-uuid",
  "restrictions": {},
  "expires_at": null
}
```

### Permission Templates

#### Get Permission Templates
```http
GET /api/permissions/templates
```

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [{
      "id": "uuid",
      "template_name": "basic_user",
      "display_name": "Basic User",
      "description": "Standard employee with basic access",
      "target_role": "user",
      "data_permissions": [...],
      "modules": []
    }]
  }
}
```

#### Apply Template to User
```http
POST /api/permissions/user/:userId/apply-template
```

**Body:**
```json
{
  "template_id": "uuid",
  "company_id": "uuid",
  "applied_by": "admin-uuid"
}
```

---

## Migration Guide

### For Administrators

**Old System → New System:**

| Old Concept | New Concept | Action Required |
|------------|-------------|-----------------|
| "Modules are permissions" | "Modules contain permissions" | Re-assign modules to users |
| Mixed module/permission grants | Separate data/module permissions | Review user access |
| Manual permission assignment | Permission templates | Use templates for new users |
| Unclear pricing | Transparent module pricing | Review company module costs |

**Migration Checklist:**
- [ ] Review all user module assignments
- [ ] Verify data permission grants
- [ ] Apply permission templates where appropriate
- [ ] Update company module provisioning
- [ ] Review and confirm pricing
- [ ] Train admins on new system

### For Developers

**Code Updates Required:**

1. **Import new types:**
```typescript
// Old
import { Permission } from '@/types/permissions';

// New
import { DataPermission, EnhancedModule } from '@/types/permissions-v2';
```

2. **Update permission checks:**
```typescript
// Old
hasPermission('expenses.approve');

// New - Check if it's data or module permission
if (isDataPermission('expenses.approve')) {
  // Handle as data permission
} else if (isModulePermission('expenses.approve')) {
  // Handle as module permission
}
```

3. **Use new API endpoints:**
```typescript
// Old
POST /api/permissions/grant

// New
POST /api/permissions/user/:userId/data/grant (for data permissions)
POST /api/modules/user/:userId/grant (for modules)
```

---

## Troubleshooting

### User Can't Access Feature

**Issue:** User says they can't access a feature they should have.

**Diagnosis:**
1. Check if feature requires **data permission**:
   - Go to User Management → User → Data Permissions
   - Verify permission is granted

2. Check if feature requires **module**:
   - Go to User Management → User → Module Permissions
   - Verify module is enabled for user
   - Verify company has module provisioned

3. Check if feature has **dependencies**:
   - Some permissions require other permissions
   - Review `requires_permissions` in permission definition

4. Check if permission has **expired**:
   - Review `expires_at` in user permissions
   - Grant new permission if expired

### Module Not Showing for User

**Issue:** Company admin can't see module to assign to users.

**Diagnosis:**
1. Verify **company has module provisioned**:
   - Super-admin must provision module first
   - Check company_modules table

2. Verify **module is active**:
   - Check modules.is_active = true

3. Verify **user has permission to assign modules**:
   - User must have `users.edit` data permission

### Pricing Doesn't Match Expected

**Issue:** Module pricing is different than expected.

**Diagnosis:**
1. Check **pricing tier**:
   - Standard = default pricing
   - Custom = company-specific pricing
   - Enterprise = volume discount

2. Check **company_modules.monthly_price**:
   - Overrides default_monthly_price if set

3. Verify **users_licensed** count:
   - Total cost = monthly_price + (per_user_price × users_with_module)

---

## Support & Resources

### Documentation
- [Module Activation System](MODULE_ACTIVATION_SYSTEM.md)
- [Permission API Reference](API_PERMISSIONS.md)
- [User Management Guide](USER_MANAGEMENT.md)

### Developer Resources
- TypeScript Types: `src/types/permissions-v2.ts`
- Database Migration: `database/migrations/014_refactor_permissions_system.sql`
- API Routes: `backend/src/routes/permissions.ts`
- Frontend Hooks: `src/hooks/usePermissions.ts`

### Getting Help
- **For Users:** Contact your system administrator
- **For Admins:** Contact super-admin or INFOtrac support
- **For Developers:** See [CONTRIBUTING.md](CONTRIBUTING.md)

---

**Last Updated:** September 30, 2025
**Version:** 2.0
**Migration:** 014_refactor_permissions_system.sql
