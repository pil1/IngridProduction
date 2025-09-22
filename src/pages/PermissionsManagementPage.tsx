/**
 * Permissions Management Page
 *
 * Comprehensive interface for Superadmins and Admins to manage user permissions,
 * module access, and role configurations across the organization.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Shield,
  Users,
  Settings,
  Search,
  Plus,
  Eye,
  EyeOff,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Building2
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useSystemModules,
  useCanManageUserPermissions,
  useIsSuperAdmin,
  useIsAdmin
} from '@/hooks/useEnhancedPermissions';
import { SuperAdminOnly, AdminOnly } from '@/components/permissions/PermissionWrapper';
import { UserPermissionMatrix } from '@/components/permissions/UserPermissionMatrix';
import { ModuleAccessManager } from '@/components/permissions/ModuleAccessManager';
import { RolePermissionManager } from '@/components/permissions/RolePermissionManager';
import { PermissionAuditLog } from '@/components/permissions/PermissionAuditLog';
import { CreateCompanyDialog } from '@/components/permissions/CreateCompanyDialog';
import { supabase } from '@/integrations/supabase/client';

const PermissionsManagementPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'restricted'>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [showCreateCompany, setShowCreateCompany] = useState(false);

  const { isSuperAdmin, isAdmin } = usePermissions();
  const canManagePermissions = useCanManageUserPermissions();

  // Fetch companies for Super Admin filtering
  const { data: companies } = useQuery({
    queryKey: ['companiesForFiltering'],
    queryFn: async () => {
      if (!isSuperAdmin) return [];

      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, subscription_plan, created_at')
          .order('name');

        if (error) {
          // If table doesn't exist (400 error), return empty array for graceful degradation
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            console.warn('companies table does not exist, using fallback data');
            return [];
          }
          console.error('Error fetching companies:', error);
          return [];
        }

        return data || [];
      } catch (error) {
        console.error('Error in companies query:', error);
        return [];
      }
    },
    enabled: isSuperAdmin,
    staleTime: 1000 * 60 * 5,
  });

  // Redirect if user doesn't have permission
  if (!canManagePermissions && !isAdmin && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to manage user permissions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-600" />
            User Management
          </h1>
          <p className="text-gray-600 mt-1">
            {isSuperAdmin
              ? "Manage users, permissions, and modules across all companies"
              : "Manage user permissions, module access, and role configurations"
            }
          </p>
        </div>

        <div className="flex items-center gap-4">
          {isSuperAdmin && (
            <>
              {companies && companies.length > 0 && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm min-w-48"
                  >
                    <option value="all">All Companies ({companies.length})</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateCompany(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Company
              </Button>
            </>
          )}

          <Badge variant={isSuperAdmin ? "destructive" : "secondary"}>
            {isSuperAdmin ? "Super Admin" : "Admin"}
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-xl font-semibold">--</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Modules</p>
              <p className="text-xl font-semibold">--</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Reviews</p>
              <p className="text-xl font-semibold">--</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Security Alerts</p>
              <p className="text-xl font-semibold">--</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Permissions
          </TabsTrigger>
          <TabsTrigger value="modules" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Module Access
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Role Management
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* User Permissions Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">User Permission Matrix</h3>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <select
                      value={activeFilter}
                      onChange={(e) => setActiveFilter(e.target.value as any)}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                    >
                      <option value="all">All Users</option>
                      <option value="active">Active Users</option>
                      <option value="restricted">Restricted Users</option>
                    </select>
                  </div>

                  <AdminOnly>
                    <Button
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => {
                        // This will be handled by the UserPermissionMatrix component
                        const event = new CustomEvent('openCreateUser');
                        window.dispatchEvent(event);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Create User
                    </Button>
                  </AdminOnly>
                </div>
              </div>
            </div>

            <div className="p-6">
              <UserPermissionMatrix
                searchTerm={searchTerm}
                filter={activeFilter}
                selectedCompany={selectedCompany}
                onUserSelect={setSelectedUser}
              />
            </div>
          </Card>
        </TabsContent>

        {/* Module Access Tab */}
        <TabsContent value="modules" className="space-y-6">
          <Card>
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Module Access Management</h3>
              <p className="text-gray-600 mt-1">
                Configure which modules are available to users and companies
              </p>
            </div>

            <div className="p-6">
              <ModuleAccessManager selectedCompany={selectedCompany} />
            </div>
          </Card>
        </TabsContent>

        {/* Role Management Tab */}
        <TabsContent value="roles" className="space-y-6">
          <SuperAdminOnly fallback={
            <Card className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Super Admin Only</h3>
              <p className="text-gray-600">Role management is restricted to Super Administrators.</p>
            </Card>
          }>
            <Card>
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Role Permission Configuration</h3>
                <p className="text-gray-600 mt-1">
                  Configure default permissions for each user role
                </p>
              </div>

              <div className="p-6">
                <RolePermissionManager />
              </div>
            </Card>
          </SuperAdminOnly>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card>
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Permission Audit Log</h3>
              <p className="text-gray-600 mt-1">
                Track all permission changes and access attempts
              </p>
            </div>

            <div className="p-6">
              <PermissionAuditLog />
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Company Dialog */}
      <CreateCompanyDialog
        open={showCreateCompany}
        onOpenChange={setShowCreateCompany}
        onCompanyCreated={(company) => {
          // Refresh companies list and optionally select the new company
          setSelectedCompany(company.id);
        }}
      />
    </div>
  );
};

export default PermissionsManagementPage;