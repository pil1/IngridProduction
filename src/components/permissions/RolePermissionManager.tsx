/**
 * Role Permission Manager Component
 *
 * Super Admin interface for configuring default permissions for each user role.
 * Manages role-based permissions across different modules and categories.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Shield,
  User,
  UserCog,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Copy,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemModules } from '@/hooks/useEnhancedPermissions';
import {
  UserRole,
  Permission,
  RolePermission,
  ALL_PERMISSIONS,
  PermissionCategory,
  DEFAULT_ROLE_PERMISSIONS,
} from '@/types/permissions';

const roleConfig = {
  'user': {
    icon: User,
    color: 'bg-blue-100 text-blue-700',
    description: 'Regular users with limited access to create and manage their own data',
  },
  'admin': {
    icon: UserCog,
    color: 'bg-green-100 text-green-700',
    description: 'Company administrators with broad access within their organization',
  },
  'super-admin': {
    icon: Shield,
    color: 'bg-red-100 text-red-700',
    description: 'System administrators with full access to all features and data',
  },
} as const;

interface RolePermissionData {
  role: UserRole;
  permissions: Permission[];
  rolePermissions: RolePermission[];
}

export const RolePermissionManager: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['core']);
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

  const queryClient = useQueryClient();
  const { data: modules } = useSystemModules();

  // Fetch all permissions and role permissions
  const { data: rolePermissionData, isLoading, refetch } = useQuery({
    queryKey: ['rolePermissions', selectedRole],
    queryFn: async (): Promise<RolePermissionData> => {
      try {
        // For now, return mock data based on role structure
        const mockPermissions: Permission[] = Object.entries(ALL_PERMISSIONS).map(([key, value], index) => ({
          id: `perm_${index}`,
          permission_key: value,
          permission_name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: `Permission to ${key.toLowerCase().replace(/_/g, ' ')}`,
          category: value.split('.')[0] as any,
          module_id: null,
          is_system_permission: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        // Mock role permissions based on selected role
        const mockRolePermissions: RolePermission[] = mockPermissions
          .filter(permission => {
            if (selectedRole === 'super-admin') return true;
            if (selectedRole === 'admin') return !permission.permission_key.includes('delete');
            return permission.permission_key.includes('view') || permission.permission_key.includes('create');
          })
          .map(permission => ({
            id: `role_perm_${permission.id}`,
            role_name: selectedRole,
            permission_id: permission.id,
            module_id: null,
            is_default: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            permission: permission,
          }));

        return {
          role: selectedRole,
          permissions: mockPermissions,
          rolePermissions: mockRolePermissions,
        };
      } catch (error) {
        console.error('Error in rolePermissions query:', error);
        return {
          role: selectedRole,
          permissions: [],
          rolePermissions: [],
        };
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  // Mutation to save role permission changes
  const saveRolePermissions = useMutation({
    mutationFn: async (changes: Record<string, boolean>) => {
      const operations = Object.entries(changes).map(async ([permissionId, isGranted]) => {
        if (isGranted) {
          // Grant permission
          return supabase
            .from('role_permissions')
            .upsert({
              role_name: selectedRole,
              permission_id: permissionId,
              is_default: true,
            }, {
              onConflict: 'role_name,permission_id,module_id'
            });
        } else {
          // Revoke permission
          return supabase
            .from('role_permissions')
            .delete()
            .eq('role_name', selectedRole)
            .eq('permission_id', permissionId);
        }
      });

      const results = await Promise.all(operations);
      const errors = results.filter(result => result.error);

      if (errors.length > 0) {
        throw new Error(`Failed to save ${errors.length} permission changes`);
      }

      return results;
    },
    onSuccess: () => {
      setPendingChanges({});
      setHasChanges(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['rolePermissions'] });
    },
  });

  // Group permissions by category
  const permissionsByCategory = React.useMemo(() => {
    if (!rolePermissionData?.permissions) return {};

    const grouped: Record<PermissionCategory, Permission[]> = {
      core: [],
      admin: [],
      operations: [],
      accounting: [],
      ai: [],
      automation: [],
      analytics: [],
      general: [],
    };

    rolePermissionData.permissions.forEach(permission => {
      const category = permission.category as PermissionCategory;
      if (grouped[category]) {
        grouped[category].push(permission);
      } else {
        grouped.general.push(permission);
      }
    });

    return grouped;
  }, [rolePermissionData?.permissions]);

  // Check if permission is currently granted to role
  const isPermissionGranted = (permissionId: string): boolean => {
    if (pendingChanges[permissionId] !== undefined) {
      return pendingChanges[permissionId];
    }

    return rolePermissionData?.rolePermissions.some(
      rp => rp.permission_id === permissionId
    ) || false;
  };

  // Handle permission toggle
  const handlePermissionToggle = (permissionId: string, granted: boolean) => {
    const currentlyGranted = isPermissionGranted(permissionId);

    if (granted !== currentlyGranted) {
      setPendingChanges(prev => ({
        ...prev,
        [permissionId]: granted,
      }));
      setHasChanges(true);
    } else {
      // Remove from pending changes if reverting to original state
      setPendingChanges(prev => {
        const updated = { ...prev };
        delete updated[permissionId];
        return updated;
      });

      setHasChanges(Object.keys(pendingChanges).length > 1);
    }
  };

  // Reset all changes
  const handleReset = () => {
    setPendingChanges({});
    setHasChanges(false);
  };

  // Copy permissions from another role
  const copyFromRole = async (sourceRole: UserRole) => {
    try {
      const { data: sourceRolePermissions } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_name', sourceRole)
        .eq('is_default', true);

      if (sourceRolePermissions) {
        const newChanges: Record<string, boolean> = {};

        // Mark all current permissions as false
        rolePermissionData?.permissions.forEach(permission => {
          newChanges[permission.id] = false;
        });

        // Mark source permissions as true
        sourceRolePermissions.forEach(rp => {
          newChanges[rp.permission_id] = true;
        });

        setPendingChanges(newChanges);
        setHasChanges(true);
      }
    } catch (error) {
      console.error('Failed to copy permissions:', error);
    }
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const RoleIcon = roleConfig[selectedRole].icon;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded animate-pulse" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Selection */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Role Permission Configuration</h3>
          <p className="text-gray-600 text-sm">Configure default permissions for each user role</p>
        </div>

        <div className="flex items-center gap-4">
          {hasChanges && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">You have unsaved changes</span>
            </div>
          )}

          <Tabs value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
            <TabsList>
              <TabsTrigger value="user" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                User
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <UserCog className="h-4 w-4" />
                Admin
              </TabsTrigger>
              <TabsTrigger value="super-admin" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Super Admin
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Role Information Card */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${roleConfig[selectedRole].color}`}>
              <RoleIcon className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-semibold capitalize">{selectedRole.replace('-', ' ')} Role</h4>
              <p className="text-sm text-gray-600">{roleConfig[selectedRole].description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Copy From Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Copy Permissions From Another Role</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    This will replace all current permissions for the {selectedRole} role with
                    permissions from the selected role.
                  </p>

                  <div className="space-y-2">
                    {(Object.keys(roleConfig) as UserRole[])
                      .filter(role => role !== selectedRole)
                      .map(role => {
                        const RoleIcon = roleConfig[role].icon;
                        return (
                          <Button
                            key={role}
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => copyFromRole(role)}
                          >
                            <RoleIcon className="h-4 w-4 mr-2" />
                            Copy from {role.replace('-', ' ')} role
                          </Button>
                        );
                      })}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {hasChanges && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveRolePermissions.mutate(pendingChanges)}
                  disabled={saveRolePermissions.isPending}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Permissions by Category */}
      <div className="space-y-4">
        {Object.entries(permissionsByCategory).map(([category, permissions]) => {
          if (permissions.length === 0) return null;

          const isExpanded = expandedCategories.includes(category);
          const grantedCount = permissions.filter(p => isPermissionGranted(p.id)).length;

          return (
            <Card key={category}>
              <Collapsible>
                <CollapsibleTrigger
                  onClick={() => toggleCategory(category)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <div className="text-left">
                      <h4 className="font-medium capitalize">{category} Permissions</h4>
                      <p className="text-sm text-gray-500">
                        {grantedCount} of {permissions.length} permissions granted
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {grantedCount}/{permissions.length}
                    </Badge>
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${(grantedCount / permissions.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Permission</TableHead>
                          <TableHead>Key</TableHead>
                          <TableHead>Module</TableHead>
                          <TableHead className="text-center">Granted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {permissions.map((permission) => {
                          const isGranted = isPermissionGranted(permission.id);
                          const isPending = pendingChanges[permission.id] !== undefined;
                          const module = modules?.find(m => m.id === permission.module_id);

                          return (
                            <TableRow key={permission.id} className={isPending ? 'bg-amber-50' : ''}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{permission.permission_name}</div>
                                  {permission.description && (
                                    <div className="text-sm text-gray-500">
                                      {permission.description}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                <code className="px-2 py-1 bg-gray-100 rounded text-xs">
                                  {permission.permission_key}
                                </code>
                              </TableCell>

                              <TableCell>
                                {module ? (
                                  <Badge variant="outline">{module.name}</Badge>
                                ) : (
                                  <span className="text-gray-400">System</span>
                                )}
                              </TableCell>

                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Switch
                                    checked={isGranted}
                                    onCheckedChange={(checked) =>
                                      handlePermissionToggle(permission.id, checked)
                                    }
                                  />
                                  {isPending && (
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Summary Statistics */}
      <Card className="p-4">
        <h4 className="font-medium mb-3">Permission Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {rolePermissionData?.rolePermissions.length || 0}
            </div>
            <div className="text-sm text-gray-500">Total Permissions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {Object.keys(permissionsByCategory).filter(
                category => permissionsByCategory[category as PermissionCategory].some(
                  p => isPermissionGranted(p.id)
                )
              ).length}
            </div>
            <div className="text-sm text-gray-500">Active Categories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">
              {Object.keys(pendingChanges).length}
            </div>
            <div className="text-sm text-gray-500">Pending Changes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {modules?.filter(m =>
                rolePermissionData?.rolePermissions.some(rp => rp.module_id === m.id)
              ).length || 0}
            </div>
            <div className="text-sm text-gray-500">Accessible Modules</div>
          </div>
        </div>
      </Card>
    </div>
  );
};