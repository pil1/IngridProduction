/**
 * Permission Guard Service
 *
 * Provides graceful degradation when user permissions change.
 * Ensures UI components handle permission loss without breaking.
 */

import { UserRole } from '@/types/permissions';

export interface PermissionCheck {
  key: string;
  description: string;
  required: boolean;
  fallbackBehavior: 'hide' | 'disable' | 'readonly';
}

export interface ModuleAccess {
  moduleId: string;
  moduleName: string;
  isEnabled: boolean;
  isRequired: boolean;
  permissions: PermissionCheck[];
}

export interface UserPermissionState {
  userId: string;
  role: UserRole;
  companyId: string;
  permissions: Record<string, boolean>;
  modules: Record<string, ModuleAccess>;
}

export class PermissionGuardService {
  private static instance: PermissionGuardService;
  private userStates: Map<string, UserPermissionState> = new Map();
  private observers: Map<string, Set<(state: UserPermissionState) => void>> = new Map();

  static getInstance(): PermissionGuardService {
    if (!PermissionGuardService.instance) {
      PermissionGuardService.instance = new PermissionGuardService();
    }
    return PermissionGuardService.instance;
  }

  /**
   * Register a user's current permission state
   */
  registerUserState(userId: string, state: UserPermissionState): void {
    this.userStates.set(userId, state);
    this.notifyObservers(userId, state);
  }

  /**
   * Update a user's permission state when changes occur
   */
  updateUserPermission(
    userId: string,
    permissionKey: string,
    isGranted: boolean
  ): void {
    const currentState = this.userStates.get(userId);
    if (!currentState) return;

    const updatedState = {
      ...currentState,
      permissions: {
        ...currentState.permissions,
        [permissionKey]: isGranted,
      },
    };

    this.userStates.set(userId, updatedState);
    this.notifyObservers(userId, updatedState);
  }

  /**
   * Update a user's module access when changes occur
   */
  updateUserModule(
    userId: string,
    moduleId: string,
    isEnabled: boolean
  ): void {
    const currentState = this.userStates.get(userId);
    if (!currentState) return;

    const moduleState = currentState.modules[moduleId];
    if (!moduleState) return;

    const updatedModuleState = {
      ...moduleState,
      isEnabled,
    };

    const updatedState = {
      ...currentState,
      modules: {
        ...currentState.modules,
        [moduleId]: updatedModuleState,
      },
    };

    this.userStates.set(userId, updatedState);
    this.notifyObservers(userId, updatedState);
  }

  /**
   * Check if a user has a specific permission with graceful fallback
   */
  checkPermission(
    userId: string,
    permissionKey: string,
    options?: {
      fallback?: boolean;
      strictMode?: boolean;
    }
  ): {
    hasPermission: boolean;
    action: 'allow' | 'hide' | 'disable' | 'readonly';
    reason?: string;
  } {
    const userState = this.userStates.get(userId);

    if (!userState) {
      return {
        hasPermission: false,
        action: options?.fallback ? 'disable' : 'hide',
        reason: 'User state not found',
      };
    }

    const hasPermission = userState.permissions[permissionKey] || false;

    if (hasPermission) {
      return { hasPermission: true, action: 'allow' };
    }

    // Graceful degradation based on permission type
    if (permissionKey.includes('delete') || permissionKey.includes('super')) {
      return {
        hasPermission: false,
        action: 'hide',
        reason: 'Destructive action hidden for safety',
      };
    }

    if (permissionKey.includes('edit') || permissionKey.includes('update')) {
      return {
        hasPermission: false,
        action: 'readonly',
        reason: 'Edit permission removed, showing read-only view',
      };
    }

    if (permissionKey.includes('create') || permissionKey.includes('add')) {
      return {
        hasPermission: false,
        action: 'disable',
        reason: 'Create permission removed, button disabled',
      };
    }

    return {
      hasPermission: false,
      action: options?.strictMode ? 'hide' : 'disable',
      reason: 'Permission not granted',
    };
  }

  /**
   * Check if a user has access to a module with graceful fallback
   */
  checkModuleAccess(
    userId: string,
    moduleId: string
  ): {
    hasAccess: boolean;
    action: 'allow' | 'hide' | 'redirect';
    fallbackRoute?: string;
    reason?: string;
  } {
    const userState = this.userStates.get(userId);

    if (!userState) {
      return {
        hasAccess: false,
        action: 'redirect',
        fallbackRoute: '/dashboard',
        reason: 'User state not found',
      };
    }

    const moduleAccess = userState.modules[moduleId];

    if (!moduleAccess) {
      return {
        hasAccess: false,
        action: 'redirect',
        fallbackRoute: '/dashboard',
        reason: 'Module not found in user state',
      };
    }

    if (moduleAccess.isEnabled) {
      return { hasAccess: true, action: 'allow' };
    }

    // If module is required but disabled, show error
    if (moduleAccess.isRequired) {
      return {
        hasAccess: false,
        action: 'hide',
        reason: 'Required module is disabled - contact administrator',
      };
    }

    return {
      hasAccess: false,
      action: 'redirect',
      fallbackRoute: '/dashboard',
      reason: 'Module access has been removed',
    };
  }

  /**
   * Get safe actions for a component based on current permissions
   */
  getSafeActions(
    userId: string,
    requiredPermissions: string[]
  ): {
    allowedActions: string[];
    disabledActions: string[];
    hiddenActions: string[];
    readonlyMode: boolean;
  } {
    const allowedActions: string[] = [];
    const disabledActions: string[] = [];
    const hiddenActions: string[] = [];

    let hasAnyEditPermission = false;

    for (const permission of requiredPermissions) {
      const check = this.checkPermission(userId, permission);

      if (check.action === 'allow') {
        allowedActions.push(permission);
        if (permission.includes('edit') || permission.includes('update')) {
          hasAnyEditPermission = true;
        }
      } else if (check.action === 'disable') {
        disabledActions.push(permission);
      } else if (check.action === 'hide') {
        hiddenActions.push(permission);
      }
    }

    return {
      allowedActions,
      disabledActions,
      hiddenActions,
      readonlyMode: !hasAnyEditPermission,
    };
  }

  /**
   * Subscribe to permission changes for a user
   */
  subscribe(
    userId: string,
    callback: (state: UserPermissionState) => void
  ): () => void {
    if (!this.observers.has(userId)) {
      this.observers.set(userId, new Set());
    }

    this.observers.get(userId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const userObservers = this.observers.get(userId);
      if (userObservers) {
        userObservers.delete(callback);
        if (userObservers.size === 0) {
          this.observers.delete(userId);
        }
      }
    };
  }

  private notifyObservers(userId: string, state: UserPermissionState): void {
    const userObservers = this.observers.get(userId);
    if (userObservers) {
      userObservers.forEach(callback => callback(state));
    }
  }

  /**
   * Clear all state (useful for logout)
   */
  clearAll(): void {
    this.userStates.clear();
    this.observers.clear();
  }

  /**
   * Remove a specific user's state
   */
  removeUser(userId: string): void {
    this.userStates.delete(userId);
    this.observers.delete(userId);
  }
}

export const permissionGuard = PermissionGuardService.getInstance();