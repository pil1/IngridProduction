/**
 * Module Pricing Manager - Company-Specific Module Pricing
 *
 * Allows super-admins to configure pricing for modules on a per-company basis.
 * Shows default pricing and allows customization with revenue tracking.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  DollarSign,
  Package,
  Edit,
  Loader2,
  Save,
  TrendingUp,
  Users,
  Calculator,
  AlertCircle
} from 'lucide-react';

const pricingUpdateSchema = z.object({
  base_module_price: z.preprocess(
    (val) => val === '' ? 0 : Number(val),
    z.number().min(0, 'Price cannot be negative')
  ),
  per_user_price: z.preprocess(
    (val) => val === '' ? 0 : Number(val),
    z.number().min(0, 'Price cannot be negative')
  ),
});

type PricingUpdateForm = z.infer<typeof pricingUpdateSchema>;

interface ModulePricingManagerProps {
  companyId: string;
  companyName: string;
  isSuperAdmin: boolean;
}

interface ModulePricing {
  id: string;
  name: string;
  description: string;
  module_type: string;
  category: string;
  is_enabled: boolean;
  default_monthly_price: number;
  default_per_user_price: number;
  monthly_price?: number;
  per_user_price?: number;
  user_count?: number;
  monthly_cost?: number;
}

export function ModulePricingManager({ companyId, companyName, isSuperAdmin }: ModulePricingManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingModule, setEditingModule] = useState<string>('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const form = useForm<PricingUpdateForm>({
    resolver: zodResolver(pricingUpdateSchema),
    defaultValues: {
      base_module_price: 0,
      per_user_price: 0,
    },
  });

  // Fetch company module pricing
  const { data: modulePricingData, isLoading: isLoadingPricing } = useQuery({
    queryKey: ['modulePricing', companyId],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/modules/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch module pricing');
      const data = await response.json();

      // Convert string prices to numbers for proper comparison and calculation
      const modules = data.success ? data.data.modules.map((module: any) => ({
        ...module,
        monthly_price: module.monthly_price !== null ? parseFloat(module.monthly_price) : null,
        per_user_price: module.per_user_price !== null ? parseFloat(module.per_user_price) : null,
        default_monthly_price: parseFloat(module.default_monthly_price) || 0,
        default_per_user_price: parseFloat(module.default_per_user_price) || 0,
      })) : [];

      return modules;
    },
    enabled: !!companyId,
  });

  // Get company user count for cost calculations
  const { data: usersData } = useQuery({
    queryKey: ['companyUsers', companyId],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      // Filter for this company's users
      return data.success ? data.data.users.filter((u: any) => u.companyId === companyId) : [];
    },
    enabled: !!companyId,
  });

  // Update module pricing mutation
  const updatePricingMutation = useMutation({
    mutationFn: async ({ moduleId, pricing }: { moduleId: string; pricing: PricingUpdateForm }) => {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/modules/company/${companyId}/pricing/${moduleId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pricing),
      });


      if (!response.ok) {
        const error = await response.json();
        console.error('Pricing update error:', error);
        throw new Error(error.message || 'Failed to update pricing');
      }

      const result = await response.json();
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Pricing Updated",
        description: "Module pricing has been successfully updated.",
      });

      setIsEditDialogOpen(false);
      setEditingModule('');
      queryClient.invalidateQueries({ queryKey: ['modulePricing', companyId] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Pricing",
        description: error.message || "Failed to update module pricing",
        variant: "destructive",
      });
    },
  });

  const handleEditPricing = (module: ModulePricing) => {
    setEditingModule(module.id);
    form.reset({
      base_module_price: module.monthly_price || module.default_monthly_price,
      per_user_price: module.per_user_price || module.default_per_user_price,
    });
    setIsEditDialogOpen(true);
  };

  const onSubmit = (data: PricingUpdateForm) => {
    updatePricingMutation.mutate({
      moduleId: editingModule,
      pricing: data,
    });
  };

  const calculateMonthlyCost = (module: ModulePricing): number => {
    const userCount = usersData?.length || 0;
    // Use custom pricing if set (including 0), otherwise use default
    const basePrice = module.monthly_price !== undefined && module.monthly_price !== null
      ? module.monthly_price
      : (typeof module.default_monthly_price === 'number' ? module.default_monthly_price : 0);
    const perUserPrice = module.per_user_price !== undefined && module.per_user_price !== null
      ? module.per_user_price
      : (typeof module.default_per_user_price === 'number' ? module.default_per_user_price : 0);
    const userCountValue = typeof userCount === 'number' && !isNaN(userCount) ? userCount : 0;

    return basePrice + (perUserPrice * userCountValue);
  };

  const totalMonthlyCost = useMemo(() => {
    if (!modulePricingData || !Array.isArray(modulePricingData)) return 0;

    const cost = modulePricingData.reduce((total: number, module: ModulePricing) => {
      if (!module.is_enabled) return total;
      const moduleCost = calculateMonthlyCost(module);
      return total + (typeof moduleCost === 'number' && !isNaN(moduleCost) ? moduleCost : 0);
    }, 0);

    return typeof cost === 'number' && !isNaN(cost) ? cost : 0;
  }, [modulePricingData, usersData]);

  const enabledModules = modulePricingData?.filter((m: ModulePricing) => m.is_enabled) || [];
  const disabledModules = modulePricingData?.filter((m: ModulePricing) => !m.is_enabled) || [];

  return (
    <div className="space-y-6">
      {/* Pricing Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Monthly Cost</p>
                <p className="text-2xl font-bold">${(typeof totalMonthlyCost === 'number' && !isNaN(totalMonthlyCost) ? totalMonthlyCost : 0).toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Enabled Modules</p>
                <p className="text-2xl font-bold">{enabledModules.length}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{usersData?.length || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Cost/User</p>
                <p className="text-2xl font-bold">
                  ${usersData?.length && totalMonthlyCost > 0 ?
                    (typeof totalMonthlyCost === 'number' && !isNaN(totalMonthlyCost) ?
                      (totalMonthlyCost / usersData.length).toFixed(2) : '0.00') : '0.00'}
                </p>
              </div>
              <Calculator className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Pricing Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Module Pricing - {companyName}
          </CardTitle>
          <CardDescription>
            {isSuperAdmin
              ? "Configure custom pricing for this company. Default system pricing is shown for reference."
              : "View the current pricing structure for your company's modules."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPricing ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading module pricing...
            </div>
          ) : modulePricingData && modulePricingData.length > 0 ? (
            <div className="space-y-6">
              {/* Enabled Modules */}
              {enabledModules.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="default">Enabled</Badge>
                    <span className="font-medium">Active Modules</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Module</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Base Price</TableHead>
                        <TableHead>Per User</TableHead>
                        <TableHead>Monthly Cost</TableHead>
                        {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enabledModules.map((module: ModulePricing) => {

                        const monthlyCost = calculateMonthlyCost(module);
                        const hasCustomMonthlyPrice = (
                          module.monthly_price !== undefined && module.monthly_price !== null &&
                          module.monthly_price !== module.default_monthly_price
                        );
                        const hasCustomPerUserPrice = (
                          module.per_user_price !== undefined && module.per_user_price !== null &&
                          module.per_user_price !== module.default_per_user_price
                        );

                        return (
                          <TableRow key={module.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{module.name}</div>
                                <div className="text-sm text-muted-foreground">{module.description}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{module.module_type}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  ${(() => {
                                    // Use custom pricing if set (including 0), otherwise use default
                                    const price = module.monthly_price !== undefined && module.monthly_price !== null
                                      ? module.monthly_price
                                      : module.default_monthly_price;
                                    return (typeof price === 'number' && !isNaN(price) ? price : 0).toFixed(2);
                                  })()}/mo
                                </span>
                                {hasCustomMonthlyPrice && (
                                  <span className="text-xs text-muted-foreground">
                                    Default: ${(typeof module.default_monthly_price === 'number' && !isNaN(module.default_monthly_price) ? module.default_monthly_price : 0).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  ${(() => {
                                    // Use custom pricing if set (including 0), otherwise use default
                                    const price = module.per_user_price !== undefined && module.per_user_price !== null
                                      ? module.per_user_price
                                      : module.default_per_user_price;
                                    return (typeof price === 'number' && !isNaN(price) ? price : 0).toFixed(2);
                                  })()}/user
                                </span>
                                {hasCustomPerUserPrice && (
                                  <span className="text-xs text-muted-foreground">
                                    Default: ${(typeof module.default_per_user_price === 'number' && !isNaN(module.default_per_user_price) ? module.default_per_user_price : 0).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-green-600">
                                  ${(typeof monthlyCost === 'number' && !isNaN(monthlyCost) ? monthlyCost : 0).toFixed(2)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({usersData?.length || 0} users)
                                </span>
                              </div>
                            </TableCell>
                            {isSuperAdmin && (
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditPricing(module)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Disabled Modules */}
              {disabledModules.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary">Disabled</Badge>
                    <span className="font-medium">Available Modules</span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    These modules are available but not currently enabled for {companyName}.
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Module</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Base Price</TableHead>
                        <TableHead>Per User</TableHead>
                        <TableHead>Potential Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disabledModules.map((module: ModulePricing) => {
                        const potentialCost = calculateMonthlyCost(module);

                        return (
                          <TableRow key={module.id} className="opacity-60">
                            <TableCell>
                              <div>
                                <div className="font-medium">{module.name}</div>
                                <div className="text-sm text-muted-foreground">{module.description}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{module.module_type}</Badge>
                            </TableCell>
                            <TableCell>
                              ${(() => {
                                const price = module.monthly_price || module.default_monthly_price;
                                return (typeof price === 'number' && !isNaN(price) ? price : 0).toFixed(2);
                              })()}/mo
                            </TableCell>
                            <TableCell>
                              ${(() => {
                                const price = module.per_user_price || module.default_per_user_price;
                                return (typeof price === 'number' && !isNaN(price) ? price : 0).toFixed(2);
                              })()}/user
                            </TableCell>
                            <TableCell>
                              <span className="text-muted-foreground">
                                ${(typeof potentialCost === 'number' && !isNaN(potentialCost) ? potentialCost : 0).toFixed(2)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Modules Available</h3>
              <p>No modules are configured for this company.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Pricing Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Module Pricing</DialogTitle>
            <DialogDescription>
              Update pricing for this module for {companyName}. Changes will affect their monthly billing.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Cost Preview Component */}
              <CostPreview form={form} usersData={usersData} />
              <FormField
                control={form.control}
                name="base_module_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Module Price (Monthly)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-10"
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === '' ? 0 : parseFloat(value) || 0);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Fixed monthly cost for this module
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="per_user_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Per User Price (Monthly)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-10"
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === '' ? 0 : parseFloat(value) || 0);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Additional cost per active user
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={updatePricingMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updatePricingMutation.isPending}>
                  {updatePricingMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Pricing
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Access Control Warning */}
      {!isSuperAdmin && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You're viewing pricing information in read-only mode. Only Super Admins can modify module pricing.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Cost Preview Component using useWatch for real-time updates
function CostPreview({ form, usersData }: {
  form: any;
  usersData: any[] | undefined;
}) {
  const basePrice = useWatch({
    control: form.control,
    name: 'base_module_price',
    defaultValue: 0
  });

  const perUserPrice = useWatch({
    control: form.control,
    name: 'per_user_price',
    defaultValue: 0
  });

  const userCount = usersData?.length || 0;

  const safeBasePrice = typeof basePrice === 'number' ? basePrice : parseFloat(basePrice) || 0;
  const safePerUserPrice = typeof perUserPrice === 'number' ? perUserPrice : parseFloat(perUserPrice) || 0;
  const totalCost = safeBasePrice + (safePerUserPrice * userCount);

  return (
    <div className="p-3 border rounded-lg bg-muted/30">
      <div className="text-sm font-medium mb-1">Cost Preview</div>
      <div className="text-xs text-muted-foreground">
        Monthly cost: ${totalCost.toFixed(2)}
        {userCount > 0 && (
          <> ({userCount} users × ${safePerUserPrice.toFixed(2)})</>
        )}
      </div>
    </div>
  );
}