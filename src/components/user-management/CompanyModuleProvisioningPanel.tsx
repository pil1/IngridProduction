/**
 * CompanyModuleProvisioningPanel Component
 * Super-admin tool for provisioning modules to companies with custom pricing
 *
 * Features:
 * - Module provisioning with pricing configuration
 * - Cost calculator (monthly + per-user pricing)
 * - Usage analytics
 * - Pricing tier selection (Standard/Custom/Enterprise)
 * - Module enable/disable controls
 * - Beautiful MynaUI design
 * - Super-admin only access
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { EnhancedDialog, EnhancedDialogSection, EnhancedDialogGrid } from '@/components/myna';
import { EnhancedSwitch } from '@/components/myna/forms/enhanced-switch';
import {
  PackageIcon,
  DollarIcon,
  UsersIcon,
  Building2Icon,
  AlertCircleIcon,
  CheckCircleIcon,
  SparklesIcon,
  CalculatorIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@/lib/icons';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import type { EnhancedModule, PricingTier, ModuleTier } from '@/types/permissions-v2';
import { MODULE_TIER_INFO } from '@/types/permissions-v2';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface CompanyModuleProvisioningPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  companyName?: string;
  companyUserCount?: number;
}

interface ModuleConfig {
  is_enabled: boolean;
  pricing_tier: PricingTier;
  monthly_price: number;
  per_user_price: number;
  users_licensed: number;
  billing_notes: string;
}

export const CompanyModuleProvisioningPanel: React.FC<CompanyModuleProvisioningPanelProps> = ({
  open,
  onOpenChange,
  companyId,
  companyName = 'Company',
  companyUserCount = 0,
}) => {
  const { allModules, loadingModules, provisionModule } = useModulePermissions();

  // Always call the hook - React Query will handle the enabled flag
  const {
    data: companyCosts,
    isLoading: loadingCosts,
  } = useQuery({
    queryKey: ['module-permissions', 'company', companyId, 'costs'],
    queryFn: async () => {
      if (!companyId) return null;

      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/module-permissions/company/${companyId}/costs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch company costs');
      const data = await response.json();
      return data.data;
    },
    enabled: !!companyId && open, // Only fetch when dialog is open and companyId exists
  });

  const [moduleConfigs, setModuleConfigs] = React.useState<Record<string, ModuleConfig>>({});
  const [selectedModuleId, setSelectedModuleId] = React.useState<string | null>(null);

  // Initialize module configs from company data
  React.useEffect(() => {
    if (companyCosts?.modules && allModules?.modules) {
      const configs: Record<string, ModuleConfig> = {};

      companyCosts.modules.forEach((companyModule) => {
        const module = allModules.modules.find((m) => m.name === companyModule.module_name);
        if (module) {
          configs[module.id] = {
            is_enabled: true,
            pricing_tier: companyModule.pricing_tier as PricingTier,
            monthly_price: companyModule.monthly_price,
            per_user_price: companyModule.per_user_price,
            users_licensed: companyModule.users_licensed,
            billing_notes: '',
          };
        }
      });

      // Add non-provisioned modules with default values
      allModules.modules.forEach((module) => {
        if (!configs[module.id]) {
          configs[module.id] = {
            is_enabled: false,
            pricing_tier: 'standard',
            monthly_price: module.default_monthly_price,
            per_user_price: module.default_per_user_price,
            users_licensed: companyUserCount || 0,
            billing_notes: '',
          };
        }
      });

      setModuleConfigs(configs);
    }
  }, [companyCosts, allModules, companyUserCount]);

  // Update module config
  const updateModuleConfig = (moduleId: string, updates: Partial<ModuleConfig>) => {
    setModuleConfigs((prev) => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        ...updates,
      },
    }));
  };

  // Calculate monthly cost
  const calculateMonthlyCost = (config: ModuleConfig): number => {
    const basePrice = Number(config.monthly_price) || 0;
    const perUserPrice = Number(config.per_user_price) || 0;
    const usersLicensed = Number(config.users_licensed) || 0;
    return basePrice + (perUserPrice * usersLicensed);
  };

  // Handle module provisioning
  const handleProvisionModule = async (moduleId: string) => {
    if (!companyId) return;

    const config = moduleConfigs[moduleId];
    if (!config) return;

    await provisionModule.mutateAsync({
      company_id: companyId,
      module_id: moduleId,
      is_enabled: config.is_enabled,
      pricing_tier: config.pricing_tier,
      monthly_price: config.monthly_price,
      per_user_price: config.per_user_price,
      users_licensed: config.users_licensed,
      billing_notes: config.billing_notes || undefined,
    });

    setSelectedModuleId(null);
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

  const isLoading = loadingModules || loadingCosts;
  const selectedModule = selectedModuleId
    ? allModules?.modules?.find((m) => m.id === selectedModuleId)
    : null;
  const selectedConfig = selectedModuleId ? moduleConfigs[selectedModuleId] : null;

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
            const config = moduleConfigs[module.id];
            if (!config) return null;

            const monthlyCost = calculateMonthlyCost(config);
            const isExpanded = selectedModuleId === module.id;

            return (
              <div
                key={module.id}
                className={`rounded-lg border-2 p-4 transition-all ${
                  config.is_enabled
                    ? 'border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-950/30'
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
                    checked={config.is_enabled}
                    onCheckedChange={(checked) =>
                      updateModuleConfig(module.id, { is_enabled: checked })
                    }
                    variant={config.is_enabled ? 'success' : 'default'}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Pricing information */}
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-muted-foreground">Pricing Tier</span>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {config.pricing_tier}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <DollarIcon className="h-3 w-3" />
                      <span>Monthly Cost</span>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      ${monthlyCost.toFixed(2)}
                    </span>
                  </div>
                  {Number(config.per_user_price || 0) > 0 && (
                    <div className="flex items-center justify-between text-xs mt-1">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <UsersIcon className="h-3 w-3" />
                        <span>Per User × {config.users_licensed}</span>
                      </div>
                      <span className="text-muted-foreground">
                        ${Number(config.per_user_price || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Collapsible Configuration Section */}
                <Collapsible open={isExpanded} onOpenChange={() => setSelectedModuleId(isExpanded ? null : module.id)}>
                  <CollapsibleTrigger className="w-full mt-3 flex items-center justify-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30">
                    <CalculatorIcon className="h-3 w-3" />
                    <span>{isExpanded ? 'Hide Configuration' : 'Configure Pricing'}</span>
                    {isExpanded ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-3 space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    {/* Pricing Tier Selection */}
                    <div>
                      <Label className="text-xs">Pricing Tier</Label>
                      <Select
                        value={config.pricing_tier}
                        onValueChange={(value) =>
                          updateModuleConfig(module.id, {
                            pricing_tier: value as PricingTier,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Monthly Price */}
                      <div>
                        <Label className="text-xs">Base Price ($)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={config.monthly_price}
                          onChange={(e) =>
                            updateModuleConfig(module.id, {
                              monthly_price: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Per User Price */}
                      <div>
                        <Label className="text-xs">Per User ($)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={config.per_user_price}
                          onChange={(e) =>
                            updateModuleConfig(module.id, {
                              per_user_price: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    {/* Users Licensed */}
                    <div>
                      <Label className="text-xs">Users Licensed</Label>
                      <Input
                        type="number"
                        min="0"
                        value={config.users_licensed}
                        onChange={(e) =>
                          updateModuleConfig(module.id, {
                            users_licensed: parseInt(e.target.value) || 0,
                          })
                        }
                        className="h-8 text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Recommend: {companyUserCount} users
                      </p>
                    </div>

                    {/* Cost Calculation */}
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CalculatorIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          Cost Breakdown
                        </p>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Base</span>
                          <span className="font-medium">${Number(config.monthly_price || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Users ({config.users_licensed} × ${Number(config.per_user_price || 0).toFixed(2)})
                          </span>
                          <span className="font-medium">
                            ${(Number(config.per_user_price || 0) * Number(config.users_licensed || 0)).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-blue-200 dark:border-blue-700">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            Total
                          </span>
                          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            ${calculateMonthlyCost(config).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Billing Notes */}
                    <div>
                      <Label className="text-xs">Billing Notes</Label>
                      <Textarea
                        value={config.billing_notes}
                        onChange={(e) =>
                          updateModuleConfig(module.id, {
                            billing_notes: e.target.value,
                          })
                        }
                        placeholder="Optional notes..."
                        rows={2}
                        className="text-xs resize-none"
                      />
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={() => handleProvisionModule(module.id)}
                      disabled={provisionModule.isPending}
                      className="w-full px-3 py-2 text-xs font-medium text-white bg-gradient-to-r from-green-600 to-green-700 rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {provisionModule.isPending ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-3 w-3" />
                          Save Configuration
                        </>
                      )}
                    </button>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </EnhancedDialogGrid>
      </EnhancedDialogSection>
    );
  };

  return (
    <EnhancedDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Company Module Provisioning"
      subtitle={`Provision and configure modules for ${companyName}`}
      icon={PackageIcon}
      size="lg"
      variant="elevated"
      secondaryAction={{
        label: 'Close',
        onClick: () => onOpenChange(false),
      }}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      ) : (
        <>
          {/* Company Info Section */}
          <EnhancedDialogSection title="Company Information">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white">
                  <Building2Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{companyName}</p>
                  <p className="text-sm text-muted-foreground">{companyUserCount} Users</p>
                </div>
              </div>
              {companyCosts?.summary && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Monthly Cost</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    ${companyCosts.summary.total_licensed_cost.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </EnhancedDialogSection>

          {/* Module cards grouped by tier */}
          {renderModuleCards(modulesByTier.core, 'core')}
          {renderModuleCards(modulesByTier.standard, 'standard')}
          {renderModuleCards(modulesByTier.premium, 'premium')}
        </>
      )}
    </EnhancedDialog>
  );
};

export default CompanyModuleProvisioningPanel;
