// Company Module Manager
// Super Admin interface for managing company module access and billing

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Package,
  DollarSign,
  Users,
  Settings,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit3,
  Plus
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import {
  useSystemModules,
  useCompanyModules,
  useEnableCompanyModule,
  useIsSuperAdmin
} from "@/hooks/useEnhancedPermissions";
import { SuperAdminOnly } from "@/components/permissions/PermissionWrapper";
import {
  SystemModule,
  CompanyModule,
  ModuleType,
  EnableCompanyModuleRequest
} from "@/types/permissions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ================================================================
// INTERFACES
// ================================================================

interface Company {
  id: string;
  name: string;
  status: string;
  created_at: string;
  billing_email?: string;
  user_count?: number;
  monthly_cost?: number;
}

interface CompanyModuleStatus extends CompanyModule {
  module: SystemModule;
  user_count: number;
  monthly_cost: number;
  usage_stats?: {
    active_users: number;
    features_used: string[];
    last_activity: string;
  };
}

interface ModuleConfigurationProps {
  company: Company;
  module: SystemModule;
  currentConfig?: CompanyModule;
  onSave: (config: EnableCompanyModuleRequest) => void;
}

// ================================================================
// MODULE CONFIGURATION DIALOG
// ================================================================

const ModuleConfigurationDialog: React.FC<ModuleConfigurationProps> = ({
  company,
  module,
  currentConfig,
  onSave
}) => {
  const [isEnabled, setIsEnabled] = useState(currentConfig?.is_enabled || false);
  const [billingTier, setBillingTier] = useState(currentConfig?.billing_tier || 'standard');
  const [monthlyPrice, setMonthlyPrice] = useState(module.default_monthly_price);
  const [perUserPrice, setPerUserPrice] = useState(module.default_per_user_price);
  const [userLimit, setUserLimit] = useState(currentConfig?.usage_limits?.user_limit || 0);
  const [featureLimit, setFeatureLimit] = useState(currentConfig?.usage_limits?.feature_limit || 0);

  const handleSave = () => {
    onSave({
      company_id: company.id,
      module_id: module.id,
      is_enabled: isEnabled,
      billing_tier: billingTier,
      configuration: {
        monthly_price: monthlyPrice,
        per_user_price: perUserPrice,
      },
      usage_limits: {
        user_limit: userLimit > 0 ? userLimit : undefined,
        feature_limit: featureLimit > 0 ? featureLimit : undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Module Status */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{module.name}</h3>
          <p className="text-sm text-gray-500">{module.description}</p>
          <Badge variant={module.module_type === 'core' ? 'default' : 'secondary'} className="mt-1">
            {module.module_type}
          </Badge>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={setIsEnabled}
          disabled={module.module_type === 'core'} // Core modules always enabled
        />
      </div>

      {isEnabled && module.module_type !== 'core' && (
        <>
          <Separator />

          {/* Billing Configuration */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Billing Configuration
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="billing-tier">Billing Tier</Label>
                <Select value={billingTier} onValueChange={setBillingTier}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="monthly-price">Monthly Base Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(Number(e.target.value))}
                />
              </div>

              <div>
                <Label htmlFor="per-user-price">Per User Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={perUserPrice}
                  onChange={(e) => setPerUserPrice(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Usage Limits */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Usage Limits
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="user-limit">User Limit (0 = unlimited)</Label>
                <Input
                  type="number"
                  value={userLimit}
                  onChange={(e) => setUserLimit(Number(e.target.value))}
                />
              </div>

              <div>
                <Label htmlFor="feature-limit">Feature Limit (0 = unlimited)</Label>
                <Input
                  type="number"
                  value={featureLimit}
                  onChange={(e) => setFeatureLimit(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </>
      )}

      <Separator />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Configuration
        </Button>
      </div>
    </div>
  );
};

// ================================================================
// MAIN COMPONENT
// ================================================================

interface CompanyModuleManagerProps {
  companyId?: string;
}

const CompanyModuleManager: React.FC<CompanyModuleManagerProps> = ({ companyId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = useIsSuperAdmin();

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [configDialogModule, setConfigDialogModule] = useState<SystemModule | null>(null);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);

  // ================================================================
  // DATA FETCHING
  // ================================================================

  // Get all companies
  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select(`
          id,
          name,
          status,
          created_at,
          billing_email,
          profiles(count)
        `)
        .order("name");

      if (error) throw error;

      return data.map(company => ({
        ...company,
        user_count: Array.isArray(company.profiles) ? company.profiles.length : 0,
      })) as Company[];
    },
    enabled: isSuperAdmin,
  });

  // Get system modules
  const { data: systemModules = [] } = useSystemModules();

  // Get company modules for selected company
  const { data: companyModules = [] } = useQuery({
    queryKey: ["companyModuleStatus", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const { data, error } = await supabase
        .from("company_modules")
        .select(`
          *,
          module:modules(*)
        `)
        .eq("company_id", selectedCompany.id);

      if (error) throw error;
      return data as CompanyModuleStatus[];
    },
    enabled: !!selectedCompany?.id,
  });

  // ================================================================
  // MUTATIONS
  // ================================================================

  const enableModuleMutation = useEnableCompanyModule();

  const handleModuleConfiguration = async (config: EnableCompanyModuleRequest) => {
    try {
      await enableModuleMutation.mutateAsync(config);
      toast({
        title: "Module configuration updated",
        description: "The module configuration has been saved successfully.",
      });
      setIsConfigDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["companyModuleStatus"] });
    } catch (error) {
      toast({
        title: "Failed to update module configuration",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const quickToggleModule = async (moduleId: string, enabled: boolean) => {
    if (!selectedCompany) return;

    try {
      await enableModuleMutation.mutateAsync({
        company_id: selectedCompany.id,
        module_id: moduleId,
        is_enabled: enabled,
      });
      toast({
        title: enabled ? "Module enabled" : "Module disabled",
        description: `Module has been ${enabled ? 'enabled' : 'disabled'} for ${selectedCompany.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ["companyModuleStatus"] });
    } catch (error) {
      toast({
        title: "Failed to update module",
        variant: "destructive",
      });
    }
  };

  // ================================================================
  // RENDER
  // ================================================================

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-gray-600">Only Super Admins can manage company modules.</p>
      </div>
    );
  }

  return (
    <SuperAdminOnly>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Module Management
            </CardTitle>
            <CardDescription>
              Configure module access and billing for all companies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="companies" className="w-full">
              <TabsList>
                <TabsTrigger value="companies">Companies</TabsTrigger>
                <TabsTrigger value="modules">Module Overview</TabsTrigger>
                <TabsTrigger value="billing">Billing Summary</TabsTrigger>
              </TabsList>

              <TabsContent value="companies" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Company List */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Companies</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {companies.map((company) => (
                          <div
                            key={company.id}
                            className={`p-3 border rounded cursor-pointer transition-colors ${
                              selectedCompany?.id === company.id
                                ? 'bg-blue-50 border-blue-200'
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => setSelectedCompany(company)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">{company.name}</div>
                                <div className="text-sm text-gray-500">
                                  {company.user_count} users
                                </div>
                              </div>
                              <Badge
                                variant={company.status === 'active' ? 'default' : 'secondary'}
                              >
                                {company.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Module Configuration */}
                  {selectedCompany && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Modules for {selectedCompany.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {systemModules.map((module) => {
                            const companyModule = companyModules.find(
                              cm => cm.module_id === module.id
                            );
                            const isEnabled = companyModule?.is_enabled || module.module_type === 'core';
                            const isCore = module.module_type === 'core';

                            return (
                              <div
                                key={module.id}
                                className={`p-3 border rounded ${isCore ? 'bg-blue-50' : ''}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{module.name}</span>
                                      <Badge
                                        variant={isCore ? 'default' : 'secondary'}
                                        className="text-xs"
                                      >
                                        {module.module_type}
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {module.description}
                                    </div>
                                    {!isCore && (
                                      <div className="text-xs text-gray-400 mt-1">
                                        ${module.default_monthly_price}/mo + ${module.default_per_user_price}/user
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={isEnabled}
                                      onCheckedChange={(checked) =>
                                        quickToggleModule(module.id, checked)
                                      }
                                      disabled={isCore}
                                    />
                                    {!isCore && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setConfigDialogModule(module);
                                          setIsConfigDialogOpen(true);
                                        }}
                                      >
                                        <Settings className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="modules" className="space-y-4">
                <h3 className="text-lg font-semibold">Module Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {systemModules.map((module) => {
                    const enabledCompanies = companyModules.filter(
                      cm => cm.module_id === module.id && cm.is_enabled
                    ).length;

                    return (
                      <Card key={module.id}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">{module.name}</CardTitle>
                          <Badge variant={module.module_type === 'core' ? 'default' : 'secondary'}>
                            {module.module_type}
                          </Badge>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="text-sm text-gray-600">
                              {module.description}
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">{enabledCompanies}</span> companies enabled
                            </div>
                            {module.module_type !== 'core' && (
                              <div className="text-sm text-gray-500">
                                ${module.default_monthly_price}/mo + ${module.default_per_user_price}/user
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="billing" className="space-y-4">
                <h3 className="text-lg font-semibold">Billing Summary</h3>
                <div className="text-gray-500">
                  Billing summary and revenue analytics will be implemented here.
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Module Configuration Dialog */}
        <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Configure Module: {configDialogModule?.name}
              </DialogTitle>
              <DialogDescription>
                Configure billing and usage limits for {selectedCompany?.name}
              </DialogDescription>
            </DialogHeader>
            {configDialogModule && selectedCompany && (
              <ModuleConfigurationDialog
                company={selectedCompany}
                module={configDialogModule}
                currentConfig={companyModules.find(cm => cm.module_id === configDialogModule.id)}
                onSave={handleModuleConfiguration}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminOnly>
  );
};

export default CompanyModuleManager;