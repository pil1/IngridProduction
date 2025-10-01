/**
 * ModulePermissionsManager Component
 * Premium module permissions management with tier badges and sub-features
 *
 * Features:
 * - Module cards with tier badges (Core/Standard/Premium)
 * - Sub-feature display
 * - Cost preview per module
 * - Real-time toggle with pending changes
 * - Company provisioning status
 * - MynaUI design system
 */

import * as React from 'react';
import { EnhancedDialogSection, EnhancedDialogGrid } from '@/components/myna';
import { EnhancedSwitch } from '@/components/myna/forms/enhanced-switch';
import {
  PackageIcon,
  AlertCircleIcon,
  InfoIcon,
  CheckCircleIcon,
  DollarIcon,
  UsersIcon,
  SparklesIcon,
} from '@/lib/icons';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import type { EnhancedModule, ModuleTier } from '@/types/permissions-v2';
import { MODULE_TIER_INFO } from '@/types/permissions-v2';
import { Badge } from '@/components/ui/badge';

interface ModulePermissionsManagerProps {
  userId: string;
  companyId: string;
  userName?: string;
  userRole?: string;
  onModulesChanged?: () => void;
}

export const ModulePermissionsManager: React.FC<ModulePermissionsManagerProps> = ({
  userId,
  companyId,
  userName = 'User',
  userRole = 'user',
  onModulesChanged,
}) => {
  const {
    allModules,
    loadingModules,
    getUserModules,
    grantModule,
    revokeModule,
  } = useModulePermissions();

  const {
    data: userModulesData,
    isLoading: loadingUser,
  } = getUserModules(userId);

  const [pendingChanges, setPendingChanges] = React.useState<Record<string, boolean>>({});

  // Create a map of user's current module access
  const userModuleMap = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    userModulesData?.modules?.forEach((um) => {
      // Handle both possible response structures
      const moduleId = um.module?.id || um.module_id;
      if (moduleId) {
        map[moduleId] = um.user_has_access || um.is_enabled || false;
      }
    });
    return map;
  }, [userModulesData]);

  // Check if module is enabled
  const isModuleEnabled = (moduleId: string) => {
    if (pendingChanges[moduleId] !== undefined) {
      return pendingChanges[moduleId];
    }
    return userModuleMap[moduleId] || false;
  };

  // Handle toggle change
  const handleToggle = (moduleId: string, currentValue: boolean) => {
    const originalValue = userModuleMap[moduleId] || false;
    const newValue = !currentValue;

    // If new value matches original, remove from pending changes
    if (newValue === originalValue) {
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[moduleId];
        return next;
      });
    } else {
      setPendingChanges((prev) => ({
        ...prev,
        [moduleId]: newValue,
      }));
    }
  };

  // Save all pending changes
  const handleSaveChanges = async () => {
    const changes = Object.entries(pendingChanges);
    if (changes.length === 0) return;

    try {
      await Promise.all(
        changes.map(([moduleId, isEnabled]) =>
          isEnabled
            ? grantModule.mutateAsync({
                user_id: userId,
                module_id: moduleId,
                company_id: companyId,
                granted_by: userId, // Will be replaced by current user in backend
              })
            : revokeModule.mutateAsync({
                user_id: userId,
                module_id: moduleId,
                company_id: companyId,
              })
        )
      );

      setPendingChanges({});
      onModulesChanged?.();
    } catch (error) {
      console.error('Failed to save module changes:', error);
    }
  };

  // Clear pending changes
  const handleCancelChanges = () => {
    setPendingChanges({});
  };

  // Get tier badge color
  const getTierColor = (tier: ModuleTier) => {
    const colors = {
      core: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      standard: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      premium: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    };
    return colors[tier];
  };

  // Group modules by tier
  const modulesByTier = React.useMemo(() => {
    if (!allModules?.modules) return { core: [], standard: [], premium: [] };

    const grouped = {
      core: [] as EnhancedModule[],
      standard: [] as EnhancedModule[],
      premium: [] as EnhancedModule[],
    };

    allModules.modules.forEach((module) => {
      grouped[module.module_tier].push(module);
    });

    return grouped;
  }, [allModules]);

  // Get module pricing from user modules data
  const getModulePricing = (moduleId: string) => {
    const userModule = userModulesData?.modules?.find((um) => {
      const id = um.module?.id || um.module_id;
      return id === moduleId;
    });
    return userModule?.pricing;
  };

  // Check if company has provisioned this module
  const isModuleProvisioned = (moduleId: string) => {
    const userModule = userModulesData?.modules?.find((um) => {
      const id = um.module?.id || um.module_id;
      return id === moduleId;
    });
    return userModule?.company_provisioned || false;
  };

  const isLoading = loadingModules || loadingUser;
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;
  const isSaving = grantModule.isPending || revokeModule.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  const renderModuleCards = (modules: EnhancedModule[], tier: ModuleTier) => {
    if (modules.length === 0) return null;

    const tierInfo = MODULE_TIER_INFO[tier];

    return (
      <EnhancedDialogSection
        key={tier}
        title={`${tierInfo.label} Modules`}
        description={tierInfo.description}
      >
        <EnhancedDialogGrid columns={2}>
          {modules.map((module) => {
            const isEnabled = isModuleEnabled(module.id);
            const isPending = pendingChanges[module.id] !== undefined;
            const isProvisioned = isModuleProvisioned(module.id);
            const pricing = getModulePricing(module.id);

            return (
              <div
                key={module.id}
                className={`rounded-lg border-2 p-4 transition-all ${
                  isPending
                    ? 'border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/30'
                    : !isProvisioned
                    ? 'border-slate-200 dark:border-slate-700 opacity-50'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                        {module.name}
                      </h4>
                      <Badge className={getTierColor(module.module_tier)}>
                        {tierInfo.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{module.description}</p>
                  </div>
                  <EnhancedSwitch
                    checked={isEnabled}
                    onCheckedChange={() => handleToggle(module.id, isEnabled)}
                    variant={isEnabled ? 'success' : 'default'}
                    disabled={!isProvisioned}
                  />
                </div>

                {/* Module sub-features */}
                {module.sub_features && module.sub_features.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                      <SparklesIcon className="h-3 w-3" />
                      Sub-Features
                    </p>
                    <ul className="space-y-1">
                      {module.sub_features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-muted-foreground flex items-center gap-1"
                        >
                          <CheckCircleIcon className="h-3 w-3 text-green-500" />
                          {feature.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pricing information */}
                {isProvisioned && pricing && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarIcon className="h-3 w-3" />
                        <span>Monthly Cost</span>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        ${pricing.monthly_cost.toFixed(2)}
                      </span>
                    </div>
                    {pricing.per_user_price > 0 && (
                      <div className="flex items-center justify-between text-xs mt-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <UsersIcon className="h-3 w-3" />
                          <span>Per User</span>
                        </div>
                        <span className="text-muted-foreground">
                          ${pricing.per_user_price.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Not provisioned warning */}
                {!isProvisioned && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircleIcon className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <p>Not provisioned for company. Contact super-admin.</p>
                    </div>
                  </div>
                )}

                {/* Pending change indicator */}
                {isPending && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <InfoIcon className="h-3 w-3" />
                    <span>
                      Pending: Will be {pendingChanges[module.id] ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </EnhancedDialogGrid>
      </EnhancedDialogSection>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with save/cancel buttons */}
      {hasPendingChanges && (
        <div className="sticky top-0 z-10 rounded-lg bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-400 dark:border-amber-600 p-4 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {Object.keys(pendingChanges).length} Unsaved Module Change{Object.keys(pendingChanges).length > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Save your changes or cancel to revert.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelChanges}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-4 w-4" />
                    Save {Object.keys(pendingChanges).length} Change{Object.keys(pendingChanges).length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Module cards grouped by tier */}
      {renderModuleCards(modulesByTier.core, 'core')}
      {renderModuleCards(modulesByTier.standard, 'standard')}
      {renderModuleCards(modulesByTier.premium, 'premium')}

      {/* No modules available */}
      {allModules?.modules?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <PackageIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No modules available.</p>
        </div>
      )}
    </div>
  );
};

export default ModulePermissionsManager;
