// Enhanced User Management Page
// Comprehensive user management with granular permissions and module control

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  UserPlus,
  Settings,
  Shield,
  Package,
  Edit3,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight
} from "lucide-react";

import { useSession } from "@/components/SessionContextProvider";
import { useToast } from "@/hooks/use-toast";
import {
  useSystemModules,
  useCompanyModules,
  useIsAdmin,
  useIsSuperAdmin,
  useCanManageUsers,
  useCanManageUserPermissions,
  useGrantPermission,
  useUpdateUserModule,
  useEnableCompanyModule
} from "@/hooks/useEnhancedPermissions";
import {
  HasPermission,
  AdminOnly,
  SuperAdminOnly,
  PermissionGate
} from "@/components/permissions/PermissionWrapper";
import {
  SystemModule,
  UserRole,
  ALL_PERMISSIONS,
  PermissionKey,
  ModuleType
} from "@/types/permissions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ================================================================
// INTERFACES
// ================================================================

interface EnhancedProfile {
  id: string;
  user_id: string;
  company_id: string | null;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  status: string;
  created_at: string;
  modules?: UserModuleStatus[];
  permissions?: UserPermissionStatus[];
}

interface UserModuleStatus {
  module_id: string;
  module_name: string;
  module_type: ModuleType;
  is_enabled: boolean;
  has_access: boolean;
  restrictions?: Record<string, any>;
  expires_at?: string;
}

interface UserPermissionStatus {
  permission_key: PermissionKey;
  permission_name: string;
  has_permission: boolean;
  source: 'direct' | 'role' | 'system';
  expires_at?: string;
}

interface Company {
  id: string;
  name: string;
}

// ================================================================
// MAIN COMPONENT
// ================================================================

const EnhancedUsersPage: React.FC = () => {
  const { profile } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedUser, setSelectedUser] = useState<EnhancedProfile | null>(null);
  const [activeTab, setActiveTab] = useState("users");
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  // Permission checks
  const isAdmin = useIsAdmin();
  const isSuperAdmin = useIsSuperAdmin();
  const canManageUsers = useCanManageUsers();
  const canManagePermissions = useCanManageUserPermissions();

  // ================================================================
  // DATA FETCHING
  // ================================================================

  // Get users for the current company (or all companies for super admin)
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["enhancedUsers", profile?.company_id, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter by company for regular admins
      if (!isSuperAdmin && profile?.company_id) {
        query = query.eq("company_id", profile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EnhancedProfile[];
    },
    enabled: !!profile && canManageUsers,
  });

  // Get companies for super admin
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Company[];
    },
    enabled: isSuperAdmin,
  });

  // Get system modules
  const { data: systemModules = [] } = useSystemModules();

  // Get company modules for current company
  const { data: companyModules = [] } = useCompanyModules(profile?.company_id);

  // ================================================================
  // USER ACTIONS
  // ================================================================

  const toggleUserExpansion = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const handleEditUser = (user: EnhancedProfile) => {
    setSelectedUser(user);
    setIsUserDialogOpen(true);
  };

  const handleManagePermissions = (user: EnhancedProfile) => {
    setSelectedUser(user);
    setIsPermissionDialogOpen(true);
  };

  // ================================================================
  // PERMISSION MANAGEMENT COMPONENT
  // ================================================================

  const UserPermissionManager: React.FC<{ user: EnhancedProfile }> = ({ user }) => {
    const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
    const [selectedPermissions, setSelectedPermissions] = useState<Set<PermissionKey>>(new Set());

    const grantPermissionMutation = useGrantPermission();
    const updateUserModuleMutation = useUpdateUserModule();

    const handleModuleToggle = async (moduleId: string, enabled: boolean) => {
      try {
        await updateUserModuleMutation.mutateAsync({
          user_id: user.user_id,
          module_id: moduleId,
          company_id: user.company_id!,
          is_enabled: enabled,
        });
        toast({ title: "Module access updated successfully" });
      } catch (error) {
        toast({
          title: "Failed to update module access",
          variant: "destructive"
        });
      }
    };

    const handlePermissionToggle = async (permissionKey: PermissionKey, granted: boolean) => {
      try {
        await grantPermissionMutation.mutateAsync({
          user_id: user.user_id,
          permission_key: permissionKey,
          company_id: user.company_id!,
          is_granted: granted,
        });
        toast({ title: "Permission updated successfully" });
      } catch (error) {
        toast({
          title: "Failed to update permission",
          variant: "destructive"
        });
      }
    };

    return (
      <div className="space-y-6">
        {/* Module Access */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Module Access
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemModules.map((module) => {
              const isEnabled = user.modules?.find(m => m.module_id === module.id)?.is_enabled || false;
              const isCore = module.module_type === 'core';

              return (
                <Card key={module.id} className={`p-4 ${isCore ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{module.name}</div>
                      <div className="text-sm text-gray-500">{module.description}</div>
                      <Badge variant={isCore ? "default" : "secondary"} className="mt-1">
                        {module.module_type}
                      </Badge>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleModuleToggle(module.id, checked)}
                      disabled={isCore} // Core modules always enabled
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Individual Permissions */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Individual Permissions
          </h3>

          <Tabs defaultValue="core" className="w-full">
            <TabsList>
              <TabsTrigger value="core">Core</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
              <TabsTrigger value="ai">AI Features</TabsTrigger>
              <TabsTrigger value="accounting">Accounting</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="core" className="space-y-2">
              {Object.entries(ALL_PERMISSIONS)
                .filter(([key]) => key.includes('DASHBOARD') || key.includes('USERS') || key.includes('COMPANY'))
                .map(([key, permissionKey]) => {
                  const hasPermission = user.permissions?.find(p => p.permission_key === permissionKey)?.has_permission || false;

                  return (
                    <div key={key} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{key.replace(/_/g, ' ')}</div>
                        <div className="text-sm text-gray-500">{permissionKey}</div>
                      </div>
                      <Switch
                        checked={hasPermission}
                        onCheckedChange={(checked) => handlePermissionToggle(permissionKey, checked)}
                      />
                    </div>
                  );
                })}
            </TabsContent>

            <TabsContent value="operations" className="space-y-2">
              {Object.entries(ALL_PERMISSIONS)
                .filter(([key]) => key.includes('VENDORS') || key.includes('CUSTOMERS') || key.includes('EXPENSES'))
                .map(([key, permissionKey]) => {
                  const hasPermission = user.permissions?.find(p => p.permission_key === permissionKey)?.has_permission || false;

                  return (
                    <div key={key} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{key.replace(/_/g, ' ')}</div>
                        <div className="text-sm text-gray-500">{permissionKey}</div>
                      </div>
                      <Switch
                        checked={hasPermission}
                        onCheckedChange={(checked) => handlePermissionToggle(permissionKey, checked)}
                      />
                    </div>
                  );
                })}
            </TabsContent>

            <TabsContent value="ai" className="space-y-2">
              {Object.entries(ALL_PERMISSIONS)
                .filter(([key]) => key.includes('INGRID'))
                .map(([key, permissionKey]) => {
                  const hasPermission = user.permissions?.find(p => p.permission_key === permissionKey)?.has_permission || false;

                  return (
                    <div key={key} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{key.replace(/_/g, ' ')}</div>
                        <div className="text-sm text-gray-500">{permissionKey}</div>
                      </div>
                      <Switch
                        checked={hasPermission}
                        onCheckedChange={(checked) => handlePermissionToggle(permissionKey, checked)}
                      />
                    </div>
                  );
                })}
            </TabsContent>

            <TabsContent value="accounting" className="space-y-2">
              {Object.entries(ALL_PERMISSIONS)
                .filter(([key]) => key.includes('GL_') || key.includes('EXPENSE_CATEGORIES'))
                .map(([key, permissionKey]) => {
                  const hasPermission = user.permissions?.find(p => p.permission_key === permissionKey)?.has_permission || false;

                  return (
                    <div key={key} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{key.replace(/_/g, ' ')}</div>
                        <div className="text-sm text-gray-500">{permissionKey}</div>
                      </div>
                      <Switch
                        checked={hasPermission}
                        onCheckedChange={(checked) => handlePermissionToggle(permissionKey, checked)}
                      />
                    </div>
                  );
                })}
            </TabsContent>

            <TabsContent value="analytics" className="space-y-2">
              {Object.entries(ALL_PERMISSIONS)
                .filter(([key]) => key.includes('ANALYTICS'))
                .map(([key, permissionKey]) => {
                  const hasPermission = user.permissions?.find(p => p.permission_key === permissionKey)?.has_permission || false;

                  return (
                    <div key={key} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{key.replace(/_/g, ' ')}</div>
                        <div className="text-sm text-gray-500">{permissionKey}</div>
                      </div>
                      <Switch
                        checked={hasPermission}
                        onCheckedChange={(checked) => handlePermissionToggle(permissionKey, checked)}
                      />
                    </div>
                  );
                })}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  };

  // ================================================================
  // RENDER
  // ================================================================

  if (!canManageUsers) {
    return (
      <PermissionGate
        permissions={[ALL_PERMISSIONS.USERS_VIEW]}
        unauthorizedMessage="You don't have permission to manage users."
      >
        <div />
      </PermissionGate>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Enhanced User Management
          </CardTitle>
          <CardDescription>
            Manage users with granular permissions and module access control
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="users">Users</TabsTrigger>
              <SuperAdminOnly>
                <TabsTrigger value="companies">Companies</TabsTrigger>
              </SuperAdminOnly>
              <TabsTrigger value="permissions">Permission Overview</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">User Management</h3>
                <HasPermission permission={ALL_PERMISSIONS.USERS_CREATE}>
                  <Button onClick={() => setIsUserDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </HasPermission>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Modules</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const isExpanded = expandedUsers.has(user.user_id);
                      const moduleCount = user.modules?.length || 0;
                      const enabledModules = user.modules?.filter(m => m.is_enabled).length || 0;

                      return (
                        <React.Fragment key={user.user_id}>
                          <TableRow>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleUserExpansion(user.user_id)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{user.full_name || user.email}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.role === 'super-admin' ? 'default' : user.role === 'admin' ? 'secondary' : 'outline'}>
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                                {user.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.company_id ? (
                                companies.find(c => c.id === user.company_id)?.name || 'Unknown'
                              ) : (
                                <span className="text-gray-400">No company</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {enabledModules}/{moduleCount} enabled
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <HasPermission permission={ALL_PERMISSIONS.USERS_VIEW}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditUser(user)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </HasPermission>
                                <HasPermission permission={ALL_PERMISSIONS.USERS_EDIT}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditUser(user)}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                </HasPermission>
                                {canManagePermissions && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleManagePermissions(user)}
                                  >
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>

                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-gray-50 p-4">
                                <div className="space-y-4">
                                  <h4 className="font-medium">Module Access Summary</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {user.modules?.map((module) => (
                                      <div
                                        key={module.module_id}
                                        className={`p-2 rounded text-sm ${
                                          module.is_enabled
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-gray-100 text-gray-600'
                                        }`}
                                      >
                                        {module.module_name}
                                        {module.is_enabled ? (
                                          <CheckCircle className="h-3 w-3 inline ml-1" />
                                        ) : (
                                          <XCircle className="h-3 w-3 inline ml-1" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <SuperAdminOnly>
              <TabsContent value="companies" className="space-y-4">
                <h3 className="text-lg font-semibold">Company Module Management</h3>
                {/* Company module management will be implemented next */}
                <div className="text-gray-500">Company module management interface coming next...</div>
              </TabsContent>
            </SuperAdminOnly>

            <TabsContent value="permissions" className="space-y-4">
              <h3 className="text-lg font-semibold">Permission Overview</h3>
              {/* Permission overview will be implemented next */}
              <div className="text-gray-500">Permission overview interface coming next...</div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* User Permissions Dialog */}
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Manage Permissions: {selectedUser?.full_name || selectedUser?.email}
            </DialogTitle>
            <DialogDescription>
              Configure module access and individual permissions for this user
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedUser && <UserPermissionManager user={selectedUser} />}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedUsersPage;