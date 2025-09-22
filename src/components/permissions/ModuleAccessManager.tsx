/**
 * Module Access Manager Component
 *
 * Comprehensive interface for managing module availability and access
 * across users and companies.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Settings,
  Users,
  Building2,
  Plus,
  Edit,
  Trash2,
  Package,
  DollarSign,
  Shield,
  Zap,
  BarChart3,
  Bot,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  useSystemModules,
  useCompanyModules,
  useEnableCompanyModule,
  useIsSuperAdmin
} from '@/hooks/useEnhancedPermissions';
import { SystemModule, ModuleType, ModuleCategory } from '@/types/permissions';

const moduleTypeColors = {
  'core': 'default',
  'super': 'secondary',
  'add-on': 'outline',
} as const;

const categoryIcons = {
  'core': Shield,
  'operations': Users,
  'accounting': DollarSign,
  'ai': Bot,
  'automation': Zap,
  'analytics': BarChart3,
  'general': Package,
} as const;

interface ModuleUsageStats {
  moduleId: string;
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  activeUsers: number;
  monthlyRevenue: number;
}

interface ModuleAccessManagerProps {
  selectedCompany?: string;
}

export const ModuleAccessManager: React.FC<ModuleAccessManagerProps> = ({
  selectedCompany,
}) => {
  const [selectedModule, setSelectedModule] = useState<SystemModule | null>(null);
  const [editingModule, setEditingModule] = useState<SystemModule | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const isSuperAdmin = useIsSuperAdmin();
  const { data: modules, refetch: refetchModules } = useSystemModules();
  const enableCompanyModule = useEnableCompanyModule();

  // Fetch module usage statistics
  const { data: moduleStats } = useQuery({
    queryKey: ['moduleUsageStats'],
    queryFn: async (): Promise<ModuleUsageStats[]> => {
      const stats: ModuleUsageStats[] = [];

      for (const module of modules || []) {
        const { data: companyModules } = await supabase
          .from('company_modules')
          .select('company_id, is_enabled')
          .eq('module_id', module.id);

        const { data: userModules } = await supabase
          .from('user_modules')
          .select('user_id, is_enabled')
          .eq('module_id', module.id);

        stats.push({
          moduleId: module.id,
          totalCompanies: companyModules?.length || 0,
          activeCompanies: companyModules?.filter(cm => cm.is_enabled).length || 0,
          totalUsers: userModules?.length || 0,
          activeUsers: userModules?.filter(um => um.is_enabled).length || 0,
          monthlyRevenue: 0, // Would calculate from billing data
        });
      }

      return stats;
    },
    enabled: !!modules?.length,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch companies for module assignment
  const { data: companies } = useQuery({
    queryKey: ['companiesForModules', selectedCompany],
    queryFn: async () => {
      try {
        let query = supabase
          .from('companies')
          .select(`
            id,
            name,
            subscription_plan
          `)
          .order('name');

        // Filter by selected company if specified
        if (selectedCompany && selectedCompany !== 'all') {
          query = query.eq('id', selectedCompany);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching companies:', error);
          return [];
        }

        // Add empty company_modules array for now
        return data?.map(company => ({
          ...company,
          company_modules: []
        })) || [];
      } catch (error) {
        console.error('Error in companiesForModules query:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const handleModuleToggleForCompany = async (
    companyId: string,
    moduleId: string,
    enabled: boolean
  ) => {
    try {
      await enableCompanyModule.mutateAsync({
        company_id: companyId,
        module_id: moduleId,
        is_enabled: enabled,
      });
      // Refetch data to update UI
    } catch (error) {
      console.error('Failed to toggle module for company:', error);
    }
  };

  const getModuleStats = (moduleId: string) => {
    return moduleStats?.find(stat => stat.moduleId === moduleId) || {
      totalCompanies: 0,
      activeCompanies: 0,
      totalUsers: 0,
      activeUsers: 0,
      monthlyRevenue: 0,
    };
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Module Overview</TabsTrigger>
          <TabsTrigger value="companies">Company Access</TabsTrigger>
          <TabsTrigger value="analytics">Usage Analytics</TabsTrigger>
        </TabsList>

        {/* Module Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">System Modules</h3>
            {isSuperAdmin && (
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Module
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules?.map((module) => {
              const CategoryIcon = categoryIcons[module.category as ModuleCategory] || Package;
              const stats = getModuleStats(module.id);

              return (
                <Card key={module.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <CategoryIcon className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{module.name}</h4>
                        <Badge variant={moduleTypeColors[module.module_type as ModuleType]}>
                          {module.module_type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {module.is_active ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {module.description}
                  </p>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Companies:</span>
                      <span className="font-medium">
                        {stats.activeCompanies} / {stats.totalCompanies}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Users:</span>
                      <span className="font-medium">
                        {stats.activeUsers} / {stats.totalUsers}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Price:</span>
                      <span className="font-medium">
                        ${module.default_monthly_price}/mo + ${module.default_per_user_price}/user
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedModule(module)}
                      className="flex-1"
                    >
                      View Details
                    </Button>
                    {isSuperAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingModule(module)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Company Access Tab */}
        <TabsContent value="companies" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Company Module Access</h3>
            <div className="text-sm text-gray-500">
              Manage which modules are available to each company
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Plan</TableHead>
                  {modules?.slice(0, 6).map((module) => (
                    <TableHead key={module.id} className="text-center min-w-20">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs">{module.name}</span>
                        <Badge size="sm" variant={moduleTypeColors[module.module_type as ModuleType]}>
                          {module.module_type}
                        </Badge>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies?.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="font-medium">{company.name}</div>
                          <div className="text-sm text-gray-500">
                            {company.is_active ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">
                        {company.subscription_plan || 'Free'}
                      </Badge>
                    </TableCell>

                    {modules?.slice(0, 6).map((module) => {
                      const companyModule = company.company_modules?.find(
                        cm => cm.module_id === module.id
                      );
                      const isEnabled = companyModule?.is_enabled || false;

                      return (
                        <TableCell key={module.id} className="text-center">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) =>
                              handleModuleToggleForCompany(company.id, module.id, checked)
                            }
                            disabled={module.is_core_required || !isSuperAdmin}
                          />
                        </TableCell>
                      );
                    })}

                    <TableCell className="text-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>
                              Manage Modules - {company.name}
                            </DialogTitle>
                          </DialogHeader>

                          <div className="space-y-4">
                            {modules?.map((module) => {
                              const companyModule = company.company_modules?.find(
                                cm => cm.module_id === module.id
                              );
                              const isEnabled = companyModule?.is_enabled || false;
                              const CategoryIcon = categoryIcons[module.category as ModuleCategory] || Package;

                              return (
                                <div key={module.id} className="flex items-center justify-between p-3 border rounded">
                                  <div className="flex items-center gap-3">
                                    <CategoryIcon className="h-5 w-5 text-gray-500" />
                                    <div>
                                      <div className="font-medium">{module.name}</div>
                                      <div className="text-sm text-gray-500">
                                        {module.description}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant={moduleTypeColors[module.module_type as ModuleType]}>
                                          {module.module_type}
                                        </Badge>
                                        {module.is_core_required && (
                                          <Badge variant="secondary">Required</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <Switch
                                    checked={isEnabled}
                                    onCheckedChange={(checked) =>
                                      handleModuleToggleForCompany(company.id, module.id, checked)
                                    }
                                    disabled={module.is_core_required || !isSuperAdmin}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Usage Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules?.map((module) => {
              const stats = getModuleStats(module.id);
              const adoptionRate = stats.totalCompanies > 0
                ? (stats.activeCompanies / stats.totalCompanies) * 100
                : 0;

              return (
                <Card key={module.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{module.name}</h4>
                    <Badge variant={moduleTypeColors[module.module_type as ModuleType]}>
                      {module.module_type}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Adoption Rate:</span>
                      <span className="font-medium">{adoptionRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Active Companies:</span>
                      <span className="font-medium">{stats.activeCompanies}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Active Users:</span>
                      <span className="font-medium">{stats.activeUsers}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Monthly Revenue:</span>
                      <span className="font-medium">${stats.monthlyRevenue}</span>
                    </div>
                  </div>

                  <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${adoptionRate}%` }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Module Details Dialog */}
      {selectedModule && (
        <Dialog open={!!selectedModule} onOpenChange={() => setSelectedModule(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Module Details - {selectedModule.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <p className="mt-1">
                    <Badge variant={moduleTypeColors[selectedModule.module_type as ModuleType]}>
                      {selectedModule.module_type}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <p className="mt-1 capitalize">{selectedModule.category}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Monthly Price</label>
                  <p className="mt-1">${selectedModule.default_monthly_price}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Per User Price</label>
                  <p className="mt-1">${selectedModule.default_per_user_price}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <p className="mt-1 text-gray-900">{selectedModule.description}</p>
              </div>

              {selectedModule.requires_modules?.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Required Modules</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {selectedModule.requires_modules.map((reqModule) => (
                      <Badge key={reqModule} variant="outline">
                        {reqModule}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  selectedModule.is_active ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-sm">
                  {selectedModule.is_active ? 'Active' : 'Inactive'}
                </span>
                {selectedModule.is_core_required && (
                  <Badge variant="secondary" className="ml-2">
                    Core Required
                  </Badge>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};