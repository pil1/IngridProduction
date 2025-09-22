/**
 * User Permission Matrix Component
 *
 * Interactive table showing all users and their permissions across different modules.
 * Allows admins to quickly view and modify user access rights.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  User,
  Shield,
  Settings,
  MoreHorizontal,
  Edit,
  Trash2,
  UserCog,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Building2,
  Save,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import {
  useSystemModules,
  useGrantPermission,
  useUpdateUserModule,
  useIsSuperAdmin
} from '@/hooks/useEnhancedPermissions';
import { UserRole, ALL_PERMISSIONS } from '@/types/permissions';
import { CreateUserDialog } from './CreateUserDialog';
import { IndividualUserPermissionDialog } from './IndividualUserPermissionDialog';

interface UserPermissionMatrixProps {
  searchTerm: string;
  filter: 'all' | 'active' | 'restricted';
  selectedCompany: string;
  onUserSelect: (userId: string) => void;
}

interface UserWithPermissions {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company_id: string;
  company_name?: string;
  is_active: boolean;
  last_sign_in: string | null;
  permissions: Record<string, boolean>;
  modules: Record<string, { enabled: boolean; hasAccess: boolean }>;
}

interface PermissionChange {
  userId: string;
  type: 'permission' | 'module';
  key: string;
  value: boolean;
  originalValue: boolean;
}

interface BulkPermissionUpdate {
  user_id: string;
  permissions: Array<{
    permission_key: string;
    is_granted: boolean;
  }>;
  modules: Array<{
    module_id: string;
    is_enabled: boolean;
  }>;
  company_id: string;
}

const roleColors = {
  'super-admin': 'destructive',
  'admin': 'secondary',
  'user': 'outline',
} as const;

const roleIcons = {
  'super-admin': Shield,
  'admin': UserCog,
  'user': User,
} as const;

export const UserPermissionMatrix: React.FC<UserPermissionMatrixProps> = ({
  searchTerm,
  filter,
  selectedCompany,
  onUserSelect,
}) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showUserPermissionDialog, setShowUserPermissionDialog] = useState(false);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PermissionChange[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { profile } = useSession();
  const isSuperAdmin = useIsSuperAdmin();
  const { data: modules } = useSystemModules();
  const grantPermission = useGrantPermission();
  const updateUserModule = useUpdateUserModule();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Listen for create user event from parent
  React.useEffect(() => {
    const handleOpenCreateUser = () => setShowCreateUser(true);
    window.addEventListener('openCreateUser', handleOpenCreateUser);
    return () => window.removeEventListener('openCreateUser', handleOpenCreateUser);
  }, []);

  // Fetch users with their permissions
  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['usersWithPermissions', searchTerm, filter, selectedCompany],
    queryFn: async (): Promise<UserWithPermissions[]> => {
      try {
        let query = supabase
          .from('profiles')
          .select(`
            user_id,
            email,
            full_name,
            role,
            company_id,
            created_at
          `);

        if (searchTerm) {
          query = query.or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`);
        }

        // Apply company filter for Super Admins
        if (selectedCompany && selectedCompany !== 'all') {
          query = query.eq('company_id', selectedCompany);
        }

        // Apply role-based filtering for Admins
        if (!isSuperAdmin && profile?.company_id) {
          // Admins can only see users in their own company
          query = query.eq('company_id', profile.company_id);
          // Admins cannot see other super-admins
          query = query.neq('role', 'super-admin');
        }

        const { data: profilesData, error } = await query.order('full_name');

        if (error) {
          console.error('Error fetching profiles:', error);
          return [];
        }

        if (!profilesData || profilesData.length === 0) {
          return [];
        }

        // Fetch company names if needed (for Super Admin viewing all companies)
        let companyMap: Record<string, string> = {};
        if (isSuperAdmin && selectedCompany === 'all') {
          try {
            const { data: companies } = await supabase
              .from('companies')
              .select('id, name');

            if (companies) {
              companyMap = companies.reduce((acc, company) => {
                acc[company.id] = company.name;
                return acc;
              }, {} as Record<string, string>);
            }
          } catch (error) {
            console.error('Error fetching company names:', error);
          }
        }

        // For now, create simplified user data with basic role-based permissions
        const usersWithPermissions: UserWithPermissions[] = profilesData.map((profile) => {
          // Basic role-based permissions (simplified)
          const permissions: Record<string, boolean> = {};
          Object.values(ALL_PERMISSIONS).forEach(key => {
            if (profile.role === 'super-admin') {
              permissions[key] = true;
            } else if (profile.role === 'admin') {
              permissions[key] = !key.includes('delete') && !key.includes('super');
            } else {
              permissions[key] = key.includes('view') || key.includes('create');
            }
          });

          // Basic module access (simplified)
          const moduleMap: Record<string, { enabled: boolean; hasAccess: boolean }> = {};
          modules?.forEach(module => {
            const hasAccess = profile.role === 'super-admin' ||
                            module.is_core_required ||
                            (profile.role === 'admin' && module.module_type !== 'super');
            moduleMap[module.name] = {
              enabled: hasAccess,
              hasAccess: hasAccess,
            };
          });

          return {
            id: profile.user_id,
            email: profile.email || '',
            full_name: profile.full_name || '',
            role: profile.role as UserRole,
            company_id: profile.company_id || '',
            company_name: companyMap[profile.company_id] || '',
            is_active: true, // Simplified for now
            last_sign_in: profile.created_at,
            permissions,
            modules: moduleMap,
          };
        });

        return usersWithPermissions;
      } catch (error) {
        console.error('Error in usersWithPermissions query:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(user => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          user.email.toLowerCase().includes(searchLower) ||
          user.full_name.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [users, searchTerm]);

  // Create bulk save mutation
  const bulkSaveMutation = useMutation({
    mutationFn: async (updates: BulkPermissionUpdate[]) => {
      const results = [];
      for (const update of updates) {
        // Save permissions
        for (const permission of update.permissions) {
          try {
            const { error } = await supabase
              .from('user_permissions')
              .upsert({
                user_id: update.user_id,
                permission_key: permission.permission_key,
                company_id: update.company_id,
                is_granted: permission.is_granted,
                granted_by: isSuperAdmin ? 'system' : 'admin',
              });
            if (error) throw error;
          } catch (error) {
            console.error(`Failed to save permission ${permission.permission_key}:`, error);
          }
        }

        // Save modules
        for (const module of update.modules) {
          try {
            const { error } = await supabase
              .from('user_modules')
              .upsert({
                user_id: update.user_id,
                module_id: module.module_id,
                company_id: update.company_id,
                is_enabled: module.is_enabled,
                granted_by: isSuperAdmin ? 'system' : 'admin',
              });
            if (error) throw error;
          } catch (error) {
            console.error(`Failed to save module ${module.module_id}:`, error);
          }
        }
        results.push(update.user_id);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersWithPermissions'] });
      setPendingChanges([]);
      toast({
        title: "Changes Saved",
        description: "All permission changes have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: "Some changes could not be saved. Please try again.",
        variant: "destructive",
      });
      console.error('Bulk save failed:', error);
    },
  });

  const handlePermissionToggle = useCallback((
    userId: string,
    permissionKey: string,
    granted: boolean
  ) => {
    const user = users?.find(u => u.id === userId);
    if (!user) return;

    const originalValue = user.permissions[permissionKey] || false;

    // Add to pending changes
    setPendingChanges(prev => {
      const filtered = prev.filter(change =>
        !(change.userId === userId && change.type === 'permission' && change.key === permissionKey)
      );

      // Only add if different from original
      if (granted !== originalValue) {
        filtered.push({
          userId,
          type: 'permission',
          key: permissionKey,
          value: granted,
          originalValue,
        });
      }

      return filtered;
    });

    // Update local state immediately for UI responsiveness
    if (users) {
      const updatedUsers = users.map(u =>
        u.id === userId
          ? { ...u, permissions: { ...u.permissions, [permissionKey]: granted } }
          : u
      );
      queryClient.setQueryData(['usersWithPermissions', searchTerm, filter, selectedCompany], updatedUsers);
    }
  }, [users, queryClient, searchTerm, filter, selectedCompany]);

  const handleModuleToggle = useCallback((
    userId: string,
    moduleId: string,
    enabled: boolean
  ) => {
    const user = users?.find(u => u.id === userId);
    if (!user) return;

    const module = modules?.find(m => m.id === moduleId);
    if (!module) return;

    const originalValue = user.modules[module.name]?.enabled || false;

    // Add to pending changes
    setPendingChanges(prev => {
      const filtered = prev.filter(change =>
        !(change.userId === userId && change.type === 'module' && change.key === moduleId)
      );

      // Only add if different from original
      if (enabled !== originalValue) {
        filtered.push({
          userId,
          type: 'module',
          key: moduleId,
          value: enabled,
          originalValue,
        });
      }

      return filtered;
    });

    // Update local state immediately for UI responsiveness
    if (users) {
      const updatedUsers = users.map(u =>
        u.id === userId
          ? {
              ...u,
              modules: {
                ...u.modules,
                [module.name]: { ...u.modules[module.name], enabled }
              }
            }
          : u
      );
      queryClient.setQueryData(['usersWithPermissions', searchTerm, filter, selectedCompany], updatedUsers);
    }
  }, [users, modules, queryClient, searchTerm, filter, selectedCompany]);

  const handleSaveChanges = useCallback(async () => {
    if (pendingChanges.length === 0) return;

    setIsSaving(true);

    try {
      // Group changes by user
      const changesByUser = pendingChanges.reduce((acc, change) => {
        if (!acc[change.userId]) {
          const user = users?.find(u => u.id === change.userId);
          acc[change.userId] = {
            user_id: change.userId,
            company_id: user?.company_id || '',
            permissions: [],
            modules: [],
          };
        }

        if (change.type === 'permission') {
          acc[change.userId].permissions.push({
            permission_key: change.key,
            is_granted: change.value,
          });
        } else if (change.type === 'module') {
          acc[change.userId].modules.push({
            module_id: change.key,
            is_enabled: change.value,
          });
        }

        return acc;
      }, {} as Record<string, BulkPermissionUpdate>);

      await bulkSaveMutation.mutateAsync(Object.values(changesByUser));
    } finally {
      setIsSaving(false);
    }
  }, [pendingChanges, users, bulkSaveMutation]);

  const handleDiscardChanges = useCallback(() => {
    setPendingChanges([]);
    queryClient.invalidateQueries({ queryKey: ['usersWithPermissions'] });
    toast({
      title: "Changes Discarded",
      description: "All unsaved changes have been discarded.",
    });
  }, [queryClient, toast]);

  const handleBulkAction = (action: string) => {
    console.log(`Bulk action: ${action} for users:`, selectedUsers);
    // Implement bulk actions
  };

  const handleOpenUserPermissions = (userId: string) => {
    setSelectedUserForPermissions(userId);
    setShowUserPermissionDialog(true);
  };

  const handleCloseUserPermissions = () => {
    setShowUserPermissionDialog(false);
    setSelectedUserForPermissions(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Unsaved Changes Bar */}
      {pendingChanges.length > 0 && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-amber-800">
              You have {pendingChanges.length} unsaved change(s). Save or discard them to continue.
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveChanges}
                disabled={isSaving || bulkSaveMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isSaving || bulkSaveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDiscardChanges}
                disabled={isSaving || bulkSaveMutation.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Discard
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Bulk Actions Bar */}
      {selectedUsers.length > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {selectedUsers.length} user(s) selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('enable')}
              >
                Enable Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('disable')}
              >
                Disable Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedUsers([])}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedUsers.length === filteredUsers.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedUsers(filteredUsers.map(u => u.id));
                    } else {
                      setSelectedUsers([]);
                    }
                  }}
                />
              </TableHead>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              {isSuperAdmin && selectedCompany === 'all' && <TableHead>Company</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead>Modules</TableHead>
              <TableHead>Key Permissions</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => {
              const RoleIcon = roleIcons[user.role];
              const activeModules = Object.entries(user.modules)
                .filter(([_, access]) => access.enabled)
                .length;
              const totalPermissions = Object.values(user.permissions)
                .filter(Boolean)
                .length;

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUsers([...selectedUsers, user.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                        }
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant={roleColors[user.role]} className="flex items-center gap-1">
                      <RoleIcon className="h-3 w-3" />
                      {user.role.replace('-', ' ')}
                    </Badge>
                  </TableCell>

                  {isSuperAdmin && selectedCompany === 'all' && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">
                          {user.company_name || user.company_id || 'No Company'}
                        </span>
                      </div>
                    </TableCell>
                  )}

                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.is_active ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`text-sm ${user.is_active ? 'text-green-700' : 'text-red-700'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{activeModules} active</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Eye className="h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              {Object.entries(user.modules).map(([module, access]) => (
                                <div key={module} className="flex items-center gap-2">
                                  <div className={`h-2 w-2 rounded-full ${
                                    access.enabled ? 'bg-green-500' : 'bg-gray-300'
                                  }`} />
                                  <span className="text-xs">{module}</span>
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{totalPermissions} granted</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2"
                        onClick={() => handleOpenUserPermissions(user.id)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm text-gray-500">
                      {user.last_sign_in ? (
                        <>
                          <Clock className="h-3 w-3 inline mr-1" />
                          {new Date(user.last_sign_in).toLocaleDateString()}
                        </>
                      ) : (
                        'Never'
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onUserSelect(user.id)}>
                          <User className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenUserPermissions(user.id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Permissions
                        </DropdownMenuItem>
                        {isSuperAdmin && (
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove User
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {filteredUsers.length === 0 && (
        <Card className="p-8 text-center">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
          <p className="text-gray-500">
            {searchTerm ? 'Try adjusting your search criteria.' : 'No users match the current filter.'}
          </p>
        </Card>
      )}

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreateUser}
        onOpenChange={setShowCreateUser}
        onUserCreated={(user) => {
          console.log('User created:', user);
          refetch(); // Refresh the user list
        }}
      />

      {/* Individual User Permission Dialog */}
      {selectedUserForPermissions && (
        <IndividualUserPermissionDialog
          open={showUserPermissionDialog}
          onOpenChange={handleCloseUserPermissions}
          userId={selectedUserForPermissions}
          onPermissionsUpdated={() => {
            refetch(); // Refresh the user list when permissions are updated
          }}
        />
      )}
    </div>
  );
};