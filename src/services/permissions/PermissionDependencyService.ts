/**
 * Permission Dependency Validation Service
 *
 * Handles validation of permission dependencies using the new plain English permissions API.
 * Ensures that permission changes maintain logical hierarchical relationships.
 */

interface PermissionDependency {
  permission_key: string;
  requires_permissions: string[];
  human_description: string;
  permission_group: string;
}

interface DependencyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingDependencies?: string[];
  affectedPermissions?: string[];
}

interface PermissionChange {
  permission_key: string;
  is_granted: boolean;
}

class PermissionDependencyService {
  private permissionsCache: Map<string, PermissionDependency> = new Map();
  private lastCacheUpdate = 0;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  /**
   * Fetch and cache permission dependencies from backend
   */
  private async ensurePermissionsLoaded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate < this.CACHE_DURATION && this.permissionsCache.size > 0) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No access token available');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/permissions/hierarchy`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch permissions: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success || !data.data?.permissions) {
        throw new Error('Invalid permissions response');
      }

      // Update cache
      this.permissionsCache.clear();
      data.data.permissions.forEach((permission: any) => {
        this.permissionsCache.set(permission.permission_key, {
          permission_key: permission.permission_key,
          requires_permissions: permission.requires_permissions || [],
          human_description: permission.human_description,
          permission_group: permission.permission_group,
        });
      });

      this.lastCacheUpdate = now;
    } catch (error) {
      console.error('Failed to load permissions dependencies:', error);
      throw error;
    }
  }

  /**
   * Validate a single permission change against dependencies
   */
  async validatePermissionChange(
    userId: string,
    permissionKey: string,
    isGranting: boolean,
    currentUserPermissions: string[]
  ): Promise<DependencyValidationResult> {
    try {
      await this.ensurePermissionsLoaded();

      const permission = this.permissionsCache.get(permissionKey);
      if (!permission) {
        return {
          isValid: true,
          errors: [],
          warnings: [`Unknown permission: ${permissionKey}`],
        };
      }

      const errors: string[] = [];
      const warnings: string[] = [];
      const missingDependencies: string[] = [];

      if (isGranting) {
        // When granting a permission, check if all required dependencies are met
        if (permission.requires_permissions.length > 0) {
          for (const requiredPermission of permission.requires_permissions) {
            if (!currentUserPermissions.includes(requiredPermission)) {
              const requiredPermissionData = this.permissionsCache.get(requiredPermission);
              missingDependencies.push(requiredPermission);
              errors.push(
                `Cannot grant "${permission.human_description}" because the required permission "${requiredPermissionData?.human_description || requiredPermission}" is not granted.`
              );
            }
          }
        }
      } else {
        // When revoking a permission, check if other permissions depend on it
        const affectedPermissions: string[] = [];

        for (const [otherPermissionKey, otherPermission] of this.permissionsCache.entries()) {
          if (otherPermission.requires_permissions.includes(permissionKey)) {
            if (currentUserPermissions.includes(otherPermissionKey)) {
              affectedPermissions.push(otherPermissionKey);
              warnings.push(
                `Revoking "${permission.human_description}" may affect "${otherPermission.human_description}" which depends on it.`
              );
            }
          }
        }

        return {
          isValid: true,
          errors,
          warnings,
          affectedPermissions,
        };
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        missingDependencies,
      };
    } catch (error) {
      console.error('Error validating permission dependencies:', error);
      return {
        isValid: false,
        errors: ['Failed to validate permission dependencies. Please try again.'],
        warnings: [],
      };
    }
  }

  /**
   * Validate multiple permission changes at once
   */
  async validatePermissionBatch(
    userId: string,
    changes: PermissionChange[],
    currentUserPermissions: string[]
  ): Promise<DependencyValidationResult> {
    try {
      await this.ensurePermissionsLoaded();

      const allErrors: string[] = [];
      const allWarnings: string[] = [];
      const allMissingDependencies: string[] = [];
      const allAffectedPermissions: string[] = [];

      // Simulate the permission state after all changes
      const simulatedPermissions = new Set(currentUserPermissions);

      // Apply all changes to get final state
      changes.forEach(change => {
        if (change.is_granted) {
          simulatedPermissions.add(change.permission_key);
        } else {
          simulatedPermissions.delete(change.permission_key);
        }
      });

      // Validate each change in the context of the final state
      for (const change of changes) {
        // For dependency checking, we need the state before this specific change
        const tempPermissions = new Set(simulatedPermissions);
        if (change.is_granted) {
          tempPermissions.delete(change.permission_key);
        } else {
          tempPermissions.add(change.permission_key);
        }

        const result = await this.validatePermissionChange(
          userId,
          change.permission_key,
          change.is_granted,
          Array.from(tempPermissions)
        );

        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
        if (result.missingDependencies) {
          allMissingDependencies.push(...result.missingDependencies);
        }
        if (result.affectedPermissions) {
          allAffectedPermissions.push(...result.affectedPermissions);
        }
      }

      return {
        isValid: allErrors.length === 0,
        errors: [...new Set(allErrors)], // Remove duplicates
        warnings: [...new Set(allWarnings)],
        missingDependencies: [...new Set(allMissingDependencies)],
        affectedPermissions: [...new Set(allAffectedPermissions)],
      };
    } catch (error) {
      console.error('Error validating permission batch:', error);
      return {
        isValid: false,
        errors: ['Failed to validate permission changes. Please try again.'],
        warnings: [],
      };
    }
  }

  /**
   * Get permission suggestions based on dependencies
   */
  async getPermissionSuggestions(
    currentUserPermissions: string[]
  ): Promise<{ suggested: string[]; reasons: Record<string, string> }> {
    try {
      await this.ensurePermissionsLoaded();

      const suggested: string[] = [];
      const reasons: Record<string, string> = {};

      for (const [permissionKey, permission] of this.permissionsCache.entries()) {
        if (currentUserPermissions.includes(permissionKey)) {
          continue;
        }

        // Check if all dependencies are met
        const canGrant = permission.requires_permissions.every(required =>
          currentUserPermissions.includes(required)
        );

        if (canGrant && permission.requires_permissions.length > 0) {
          suggested.push(permissionKey);
          const dependentPermissions = permission.requires_permissions
            .map(key => this.permissionsCache.get(key)?.human_description || key)
            .join(', ');
          reasons[permissionKey] = `Available because you have: ${dependentPermissions}`;
        }
      }

      return { suggested, reasons };
    } catch (error) {
      console.error('Error getting permission suggestions:', error);
      return { suggested: [], reasons: {} };
    }
  }

  /**
   * Get human-readable permission information
   */
  async getPermissionInfo(permissionKey: string): Promise<PermissionDependency | null> {
    try {
      await this.ensurePermissionsLoaded();
      return this.permissionsCache.get(permissionKey) || null;
    } catch (error) {
      console.error('Error getting permission info:', error);
      return null;
    }
  }

  /**
   * Use the backend API to validate dependencies
   */
  async validateUsingBackendAPI(
    userId: string,
    permissions: string[]
  ): Promise<DependencyValidationResult> {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No access token available');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/permissions/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          permissions,
        }),
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Validation failed');
      }

      // Transform backend response to our format
      return {
        isValid: data.data.every((result: any) => result.is_valid),
        errors: data.data.filter((result: any) => !result.is_valid).map((result: any) => result.error_message),
        warnings: data.data.filter((result: any) => result.warning_message).map((result: any) => result.warning_message),
      };
    } catch (error) {
      console.error('Error using backend validation API:', error);
      return {
        isValid: false,
        errors: ['Failed to validate using backend API. Please try again.'],
        warnings: [],
      };
    }
  }
}

export const permissionDependencyService = new PermissionDependencyService();
export default permissionDependencyService;