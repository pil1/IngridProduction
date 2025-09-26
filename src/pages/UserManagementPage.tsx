/**
 * User Management Page - Production Ready
 *
 * Complete rewrite of the User Management system with proper role-based access,
 * company context switching, and module cascade logic.
 *
 * Features:
 * - Super-Admin: Company provisioning + user management with company dropdown
 * - Admin: User management for their company only
 * - Module cascade visibility (super-admin disables -> admin can't see -> users lose access)
 * - Real-time API integration with proper error handling
 * - Mobile-responsive design with accessibility compliance
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, Building, Shield, AlertCircle } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import usePermissions from '@/hooks/usePermissions';
import { CORE_PERMISSIONS } from '@/types/permissions';
import { UserManagementTab } from '@/components/user-management/UserManagementTab';
import { ModulePricingManager } from '@/components/user-management/ModulePricingManager';

interface Company {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export default function UserManagementPage() {
  const { profile } = useSession();
  const { hasPermission } = usePermissions();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Check if user has access to User Management module
  const hasUserManagementAccess = hasPermission(CORE_PERMISSIONS.USERS_VIEW);
  const isSuperAdmin = profile?.role === 'super-admin';
  const isAdmin = profile?.role === 'admin';

  // Fetch companies for super-admin dropdown
  const { data: companiesData, isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/companies`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch companies');
      const data = await response.json();
      return data.success ? data.data : [];
    },
    enabled: isSuperAdmin,
  });

  // Auto-select admin's company or first company for super-admin
  useEffect(() => {
    if (isAdmin && profile?.company_id) {
      setSelectedCompanyId(profile.company_id);
    } else if (isSuperAdmin && companiesData && companiesData.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companiesData[0].id);
    }
  }, [isAdmin, isSuperAdmin, profile?.company_id, companiesData, selectedCompanyId]);

  // Access control
  if (!hasUserManagementAccess) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access User Management. This module is only available to Admins and Super Admins.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            User Management is only available to Admins and Super Admins.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const selectedCompany = companiesData?.find((c: Company) => c.id === selectedCompanyId);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin
              ? "Manage companies, users, and module assignments across the system"
              : "Manage users and module assignments for your company"
            }
          </p>
        </div>
        <Badge variant={isSuperAdmin ? "default" : "secondary"} className="px-3 py-1">
          <Shield className="h-3 w-3 mr-1" />
          {isSuperAdmin ? "Super Admin" : "Admin"}
        </Badge>
      </div>

      {/* Company Selection for Super Admin */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Company Context
            </CardTitle>
            <CardDescription>
              Select a company to manage its users and modules. All operations will be scoped to the selected company.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCompanies ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading companies...
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-md">
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a company..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companiesData?.map((company: Company) => (
                        <SelectItem key={company.id} value={company.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{company.name}</span>
                            {!company.is_active && (
                              <Badge variant="secondary" className="ml-2">Inactive</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedCompany && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {selectedCompany.slug}
                    </Badge>
                    {!selectedCompany.is_active && (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <div className="space-y-6">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid grid-cols-2 lg:w-[300px]">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="pricing" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Module Pricing
            </TabsTrigger>
          </TabsList>

          {/* User Management Tab */}
          <TabsContent value="users" className="mt-6">
            {selectedCompanyId ? (
              <UserManagementTab
                companyId={selectedCompanyId}
                companyName={selectedCompany?.name || 'Selected Company'}
                isSuperAdmin={isSuperAdmin}
              />
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    {isSuperAdmin
                      ? "Please select a company to manage its users"
                      : "Loading your company information..."
                    }
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Module Pricing Tab */}
          <TabsContent value="pricing" className="mt-6">
            {selectedCompanyId ? (
              <ModulePricingManager
                companyId={selectedCompanyId}
                companyName={selectedCompany?.name || 'Selected Company'}
                isSuperAdmin={isSuperAdmin}
              />
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    {isSuperAdmin
                      ? "Please select a company to manage its module pricing"
                      : "Loading your company information..."
                    }
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}