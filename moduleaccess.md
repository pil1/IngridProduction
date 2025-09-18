### `moduleaccess.md`

This document summarizes the required changes for the "Module Access" tab within the "Edit User" dialog.

**Frontend Changes (`src/components/EditUserDialog.tsx`):**

*   **Module Display Filtering:**
    *   Ensure the list of modules presented to the administrator is filtered based on the `editingUser`'s assigned role and the modules currently enabled for their associated company.
*   **Dynamic Checkbox Disablement:**
    *   Update the `disabled` state for module checkboxes to reflect granular permissions:
        *   `super-admin` users can modify all module access.
        *   `admin` users can only modify module access for users within their own company.
        *   System-locked ("core") modules should remain disabled for modification by `admin` users.
        *   Maintain existing loading/saving state disablement.

**Backend Changes (`supabase/functions/upsert-user-module/index.ts`):**

*   **Granular Authorization Enforcement:**
    *   Implement robust checks to verify the `currentUser`'s role and `company_id`.
    *   Allow `super-admin` users full control over any user's module access.
    *   Restrict `admin` users to only manage module access for users belonging to their *own* company. Deny access if company IDs do not match or if the `admin` is not associated with a company.
    *   Deny access for any other user roles.
*   **System Module Locking:**
    *   Enforce that modules marked as `is_locked_by_system` (e.g., "core" modules) cannot be disabled or have their pricing altered by `admin` users. This ensures critical modules remain active and priced as configured by the system.