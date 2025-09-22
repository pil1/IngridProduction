/**
 * Individual User Permission Management Dialog
 *
 * Comprehensive dialog for managing a single user's permissions and module access.
 * Supports both Super Admin and Admin roles with appropriate restrictions.
 */

import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  User,
  Shield,
  Settings,
  Package,
  AlertTriangle,
  CheckCircle,
  Save,
  RotateCcw,
  Loader2,
  Info,
  Lock,
  UserCog,
  Building2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { UserRole, ALL_PERMISSIONS } from '@/types/permissions';
import { useSystemModules } from '@/hooks/useEnhancedPermissions';
import { useToast } from '@/hooks/use-toast';
import { permissionValidator } from '@/services/permissions/PermissionValidationService';

interface IndividualUserPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onPermissionsUpdated?: () => void;
}

interface UserDetails {
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company_id: string;
  company_name?: string;
  is_active: boolean;
  created_at: string;
  last_sign_in?: string;
}

interface UserPermission {
  permission_key: string;
  is_granted: boolean;
  granted_by?: string;
  granted_at?: string;
}

interface UserModule {
  module_id: string;
  module_name: string;
  is_enabled: boolean;
  granted_by?: string;
  granted_at?: string;
}

interface PermissionChange {
  type: 'permission' | 'module';
  key: string;
  value: boolean;
  originalValue: boolean;
}

export const IndividualUserPermissionDialog: React.FC<IndividualUserPermissionDialogProps> = ({
  open,
  onOpenChange,
  userId,
  onPermissionsUpdated,
}) => {
  const { profile } = useSession();
  const { data: systemModules } = useSystemModules();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [pendingChanges, setPendingChanges] = useState<PermissionChange[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissionFilter, setPermissionFilter] = useState<'all' | 'granted' | 'denied'>('all');

  const isSuperAdmin = profile?.role === 'super-admin';
  const isAdmin = profile?.role === 'admin';

  // Fetch user details
  const { data: userDetails, isLoading: isLoadingUser } = useQuery({
    queryKey: ['userDetails', userId],
    queryFn: async (): Promise<UserDetails | null> => {
      if (!userId) return null;

      try {
        // Get user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(`
            user_id,
            email,
            full_name,
            role,
            company_id,
            created_at
          `)
          .eq('user_id', userId)
          .single();

        if (profileError) throw profileError;

        // Get company name if available
        let companyName = '';
        if (profileData.company_id) {
          const { data: companyData } = await supabase
            .from('companies')
            .select('name')
            .eq('id', profileData.company_id)
            .single();

          if (companyData) {
            companyName = companyData.name;
          }
        }

        return {
          ...profileData,
          company_name: companyName,
          is_active: true, // Simplified for now
        };
      } catch (error) {
        console.error('Error fetching user details:', error);
        return null;
      }
    },
    enabled: !!userId && open,
  });

  // Fetch user permissions
  const { data: userPermissions, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ['userPermissions', userId],
    queryFn: async (): Promise<UserPermission[]> => {
      if (!userId) return [];

      try {
        const { data, error } = await supabase
          .from('user_permissions')
          .select('permission_key, is_granted, granted_by, granted_at')
          .eq('user_id', userId);

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Error fetching user permissions:', error);
        return [];
      }
    },
    enabled: !!userId && open,
  });

  // Fetch user modules
  const { data: userModules, isLoading: isLoadingModules } = useQuery({
    queryKey: ['userModules', userId],
    queryFn: async (): Promise<UserModule[]> => {
      if (!userId || !systemModules) return [];

      try {
        const { data, error } = await supabase
          .from('user_modules')
          .select('module_id, is_enabled, granted_by, granted_at')
          .eq('user_id', userId);

        if (error) throw error;

        // Enhance with module names
        const userModulesWithNames = (data || []).map(um => {
          const module = systemModules.find(m => m.id === um.module_id);
          return {
            ...um,
            module_name: module?.name || 'Unknown Module',
          };
        });

        return userModulesWithNames;
      } catch (error) {
        console.error('Error fetching user modules:', error);
        return [];
      }
    },
    enabled: !!userId && !!systemModules && open,
  });

  // Save changes mutation
  const saveChangesMutation = useMutation({
    mutationFn: async (changes: PermissionChange[]) => {
      if (!userDetails) throw new Error('User details not found');

      const results = [];

      for (const change of changes) {
        if (change.type === 'permission') {
          const { error } = await supabase
            .from('user_permissions')
            .upsert({
              user_id: userId,
              permission_key: change.key,
              company_id: userDetails.company_id,
              is_granted: change.value,
              granted_by: profile?.user_id || 'system',
            });

          if (error) throw error;
        } else if (change.type === 'module') {
          const { error } = await supabase
            .from('user_modules')
            .upsert({
              user_id: userId,
              module_id: change.key,
              company_id: userDetails.company_id,
              is_enabled: change.value,
              granted_by: profile?.user_id || 'system',
            });

          if (error) throw error;
        }
        results.push(change);
      }

      return results;
    },
    onSuccess: () => {
      setPendingChanges([]);
      queryClient.invalidateQueries({ queryKey: ['userPermissions', userId] });
      queryClient.invalidateQueries({ queryKey: ['userModules', userId] });
      queryClient.invalidateQueries({ queryKey: ['usersWithPermissions'] });
      onPermissionsUpdated?.();
      toast({
        title: "Permissions Updated",
        description: "User permissions have been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update user permissions. Please try again.",
        variant: "destructive",
      });
      console.error('Failed to save permission changes:', error);
    },
  });

  // Create permission lookup maps
  const permissionMap = useMemo(() => {
    const map = new Map<string, UserPermission>();
    userPermissions?.forEach(perm => {
      map.set(perm.permission_key, perm);
    });
    return map;
  }, [userPermissions]);

  const moduleMap = useMemo(() => {
    const map = new Map<string, UserModule>();
    userModules?.forEach(mod => {
      map.set(mod.module_id, mod);
    });
    return map;
  }, [userModules]);

  // Check if user can be managed by current admin
  const canManageUser = useMemo(() => {
    if (!userDetails || !profile) return false;

    if (isSuperAdmin) return true;
    if (isAdmin) {
      // Admins can only manage users in their own company
      return userDetails.company_id === profile.company_id && userDetails.role !== 'super-admin';
    }

    return false;
  }, [userDetails, profile, isSuperAdmin, isAdmin]);

  const handlePermissionToggle = (permissionKey: string, granted: boolean) => {
    if (!canManageUser || !userDetails || !profile) return;

    // Validate the permission change
    const validationResult = permissionValidator.validatePermissionChange({
      currentUserRole: profile.role,
      targetUserRole: userDetails.role,
      targetUserId: userDetails.user_id,
      permissionKey,
      action: granted ? 'grant' : 'revoke',
      isGranting: granted,
      companyId: profile.company_id || '',
      targetCompanyId: userDetails.company_id,
    });

    if (!validationResult.isValid) {
      toast({
        title: "Permission Change Blocked",
        description: validationResult.errors[0] || "This permission change is not allowed.",
        variant: "destructive",
      });
      return;
    }

    // Show warnings if any
    if (validationResult.warnings.length > 0) {
      toast({
        title: "Permission Warning",
        description: validationResult.warnings[0],
        variant: "default",
      });
    }

    const currentPermission = permissionMap.get(permissionKey);
    const originalValue = currentPermission?.is_granted || false;

    setPendingChanges(prev => {
      const filtered = prev.filter(change =>
        !(change.type === 'permission' && change.key === permissionKey)
      );

      if (granted !== originalValue) {
        filtered.push({
          type: 'permission',
          key: permissionKey,
          value: granted,
          originalValue,
        });
      }

      return filtered;
    });
  };

  const handleModuleToggle = (moduleId: string, enabled: boolean) => {
    if (!canManageUser || !userDetails || !profile) return;

    // Validate the module change
    const validationResult = permissionValidator.validatePermissionChange({
      currentUserRole: profile.role,
      targetUserRole: userDetails.role,
      targetUserId: userDetails.user_id,
      moduleId,
      action: enabled ? 'grant' : 'revoke',
      isGranting: enabled,
      companyId: profile.company_id || '',
      targetCompanyId: userDetails.company_id,
    });

    if (!validationResult.isValid) {
      toast({
        title: "Module Change Blocked",
        description: validationResult.errors[0] || "This module change is not allowed.",
        variant: "destructive",
      });
      return;
    }

    // Show warnings if any
    if (validationResult.warnings.length > 0) {
      toast({
        title: "Module Warning",
        description: validationResult.warnings[0],
        variant: "default",
      });
    }

    const currentModule = moduleMap.get(moduleId);

    // Calculate original value considering Super Admin default access
    const originalValue = userDetails?.role === 'super-admin'
      ? (currentModule?.is_enabled ?? true)
      : (currentModule?.is_enabled || false);

    setPendingChanges(prev => {
      const filtered = prev.filter(change =>
        !(change.type === 'module' && change.key === moduleId)
      );

      if (enabled !== originalValue) {
        filtered.push({
          type: 'module',
          key: moduleId,
          value: enabled,
          originalValue,
        });
      }

      return filtered;
    });
  };

  const getCurrentPermissionValue = (permissionKey: string): boolean => {
    const pendingChange = pendingChanges.find(
      change => change.type === 'permission' && change.key === permissionKey
    );
    if (pendingChange) return pendingChange.value;

    const currentPermission = permissionMap.get(permissionKey);
    return currentPermission?.is_granted || false;
  };

  const getCurrentModuleValue = (moduleId: string): boolean => {
    const pendingChange = pendingChanges.find(
      change => change.type === 'module' && change.key === moduleId
    );
    if (pendingChange) return pendingChange.value;

    const currentModule = moduleMap.get(moduleId);

    // Super Admins should have access to all modules by default
    if (userDetails?.role === 'super-admin') {
      // If there's an explicit database entry, use it; otherwise default to true
      return currentModule?.is_enabled ?? true;
    }

    // For regular users and admins, require explicit enablement
    return currentModule?.is_enabled || false;
  };

  const handleSave = () => {
    if (pendingChanges.length > 0) {
      saveChangesMutation.mutate(pendingChanges);
    }
  };

  const handleDiscard = () => {
    setPendingChanges([]);
    toast({
      title: "Changes Discarded",
      description: "All unsaved changes have been discarded.",
    });
  };

  // Filter permissions based on search and filter
  const filteredPermissions = useMemo(() => {
    return Object.entries(ALL_PERMISSIONS).filter(([key, permissionKey]) => {
      const matchesSearch = !searchTerm ||
        key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        permissionKey.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (permissionFilter === 'all') return true;

      const isGranted = getCurrentPermissionValue(permissionKey);
      return permissionFilter === 'granted' ? isGranted : !isGranted;
    });
  }, [searchTerm, permissionFilter]);

  const isLoading = isLoadingUser || isLoadingPermissions || isLoadingModules;

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Manage User Permissions
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading user details...</span>
          </div>
        ) : !userDetails ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              User not found or you don't have permission to view this user.
            </AlertDescription>
          </Alert>
        ) : !canManageUser ? (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to manage this user's permissions.
              {isAdmin && "Admins can only manage users within their own company."}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            {/* User Info Header */}
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-medium">{userDetails.full_name}</h3>
                    <Badge variant={
                      userDetails.role === 'super-admin' ? 'destructive' :
                      userDetails.role === 'admin' ? 'secondary' : 'outline'
                    }>
                      {userDetails.role.replace('-', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{userDetails.email}</p>
                  {userDetails.company_name && (
                    <div className="flex items-center gap-1 mt-1">
                      <Building2 className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{userDetails.company_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Unsaved Changes Alert */}
            {pendingChanges.length > 0 && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="flex items-center justify-between">
                  <span className="text-amber-800">
                    You have {pendingChanges.length} unsaved change(s).
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saveChangesMutation.isPending}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {saveChangesMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDiscard}
                      disabled={saveChangesMutation.isPending}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Discard
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Tabs for different permission types */}
            <Tabs defaultValue="modules" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="modules" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Module Access
                </TabsTrigger>
                <TabsTrigger value="permissions" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Individual Permissions
                </TabsTrigger>
              </TabsList>

              {/* Module Access Tab */}
              <TabsContent value="modules" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {systemModules?.map((module) => {
                    const isEnabled = getCurrentModuleValue(module.id);
                    const isRequired = module.is_core_required;
                    const hasChanges = pendingChanges.some(
                      change => change.type === 'module' && change.key === module.id
                    );

                    return (
                      <div
                        key={module.id}
                        className={`p-4 border rounded-lg ${
                          hasChanges ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{module.name}</h4>
                              {isRequired && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Lock className="h-3 w-3 text-gray-400" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Required module - cannot be disabled</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {module.description || 'No description available'}
                            </p>
                            <Badge variant="outline" className="mt-2 text-xs">
                              {module.module_type}
                            </Badge>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleModuleToggle(module.id, checked)}
                            disabled={isRequired || !canManageUser}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              {/* Individual Permissions Tab */}
              <TabsContent value="permissions" className="space-y-4">
                {/* Permission Filters */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="permission-search">Search Permissions</Label>
                    <Input
                      id="permission-search"
                      placeholder="Search by permission name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="permission-filter">Filter</Label>
                    <select
                      id="permission-filter"
                      value={permissionFilter}
                      onChange={(e) => setPermissionFilter(e.target.value as any)}
                      className="border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="all">All Permissions</option>
                      <option value="granted">Granted Only</option>
                      <option value="denied">Denied Only</option>
                    </select>
                  </div>
                </div>

                {/* Permissions List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredPermissions.map(([key, permissionKey]) => {
                    const isGranted = getCurrentPermissionValue(permissionKey);
                    const hasChanges = pendingChanges.some(
                      change => change.type === 'permission' && change.key === permissionKey
                    );
                    const canModify = canManageUser && (isSuperAdmin || !permissionKey.includes('super'));

                    return (
                      <div
                        key={permissionKey}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          hasChanges ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{key.replace(/_/g, ' ')}</div>
                          <div className="text-xs text-gray-500">{permissionKey}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!canModify && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {!isSuperAdmin && permissionKey.includes('super')
                                      ? 'Super Admin permissions can only be managed by Super Admins'
                                      : 'You cannot modify this permission'
                                    }
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <Switch
                            checked={isGranted}
                            onCheckedChange={(checked) => handlePermissionToggle(permissionKey, checked)}
                            disabled={!canModify}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredPermissions.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Info className="h-8 w-8 mx-auto mb-2" />
                    <p>No permissions found matching your search criteria.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};