/**
 * User Module Dialog - Module Assignment with Cascade Logic
 *
 * Allows admins to assign/revoke module access for individual users.
 * Shows cascade logic: only modules enabled for the company are available.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Save,
  User,
  Shield,
  Package,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react';

interface UserModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  companyId: string;
  companyName: string;
  onModulesUpdated?: () => void;
}

interface UserDetails {
  id: string;
  email: string;
  fullName: string;
  role: string;
  companyId: string;
}

interface UserModule {
  id: string;
  name: string;
  description: string;
  module_type: string;
  category: string;
  is_core_required: boolean;
  is_enabled: boolean; // Company level
  user_has_access: boolean; // User level
  access_source: string;
}

export function UserModuleDialog({
  open,
  onOpenChange,
  userId,
  companyId,
  companyName,
  onModulesUpdated
}: UserModuleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

  // Fetch user details
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['userDetails', userId],
    queryFn: async (): Promise<UserDetails> => {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch user');
      const data = await response.json();
      return data.success ? data.data.user : null;
    },
    enabled: !!userId && open,
  });

  // Fetch user's current module access
  const { data: userModules, isLoading: isLoadingModules } = useQuery({
    queryKey: ['userModules', userId, companyId],
    queryFn: async (): Promise<UserModule[]> => {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');

      // Get company modules first
      const companyResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/modules/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!companyResponse.ok) throw new Error('Failed to fetch company modules');
      const companyData = await companyResponse.json();
      const companyModules = companyData.success ? companyData.data.modules : [];

      // Get user's current module access
      const userResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/modules/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      let userModuleAccess: any[] = [];
      if (userResponse.ok) {
        const userData = await userResponse.json();
        userModuleAccess = userData.success ? userData.data.modules : [];
      }

      // Combine company modules with user access status
      return companyModules.map((module: any) => {
        const userAccess = userModuleAccess.find((um: any) => um.module_id === module.id);
        return {
          ...module,
          user_has_access: userAccess?.is_enabled || false,
          access_source: userAccess?.granted_by ? 'explicitly_granted' : 'inherited',
        };
      });
    },
    enabled: !!userId && !!companyId && open,
  });

  // Save module access changes
  const saveModulesMutation = useMutation({
    mutationFn: async (changes: Record<string, boolean>) => {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');

      const results = [];
      for (const [moduleId, hasAccess] of Object.entries(changes)) {
        const endpoint = hasAccess ? 'enable' : 'disable';
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/modules/user/${userId}/${endpoint}/${moduleId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to ${endpoint} module`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || `Failed to ${endpoint} module`);
        }
        results.push({ moduleId, hasAccess });
      }
      return results;
    },
    onSuccess: () => {
      setPendingChanges({});
      toast({
        title: "Module Access Updated",
        description: "User module access has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['userModules', userId, companyId] });
      onModulesUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update module access",
        variant: "destructive",
      });
    },
  });

  const handleModuleToggle = (moduleId: string, newValue: boolean) => {
    const currentModule = userModules?.find(m => m.id === moduleId);
    const originalValue = currentModule?.user_has_access || false;

    if (newValue === originalValue) {
      // Remove from pending changes if reverting to original
      const newPending = { ...pendingChanges };
      delete newPending[moduleId];
      setPendingChanges(newPending);
    } else {
      // Add to pending changes
      setPendingChanges(prev => ({
        ...prev,
        [moduleId]: newValue
      }));
    }
  };

  const handleSave = () => {
    if (Object.keys(pendingChanges).length > 0) {
      saveModulesMutation.mutate(pendingChanges);
    }
  };

  const handleClose = () => {
    setPendingChanges({});
    onOpenChange(false);
  };

  const getCurrentValue = (moduleId: string): boolean => {
    if (moduleId in pendingChanges) {
      return pendingChanges[moduleId];
    }
    return userModules?.find(m => m.id === moduleId)?.user_has_access || false;
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;
  const isLoading = isLoadingUser || isLoadingModules;

  // Separate modules by type
  const coreModules = userModules?.filter(m => m.is_core_required || m.module_type === 'core') || [];
  const addOnModules = userModules?.filter(m => !m.is_core_required && m.module_type === 'add-on') || [];
  const enabledModules = userModules?.filter(m => m.is_enabled) || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Manage Module Access
          </DialogTitle>
          <DialogDescription>
            Configure which modules this user can access. Only modules enabled for {companyName} are available.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading user module access...
          </div>
        ) : (
          <div className="space-y-6">
            {/* User Info */}
            {user && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5" />
                  <div>
                    <h3 className="font-semibold text-lg">{user.fullName}</h3>
                    <p className="text-muted-foreground">{user.email}</p>
                    <Badge variant="secondary" className="mt-1">
                      {user.role === 'admin' ? (
                        <>
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </>
                      ) : (
                        'User'
                      )}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Cascade Information */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Module access follows a cascade system: Super Admin enables modules for {companyName},
                then you can assign those modules to individual users. Users can only access modules
                that are both enabled for the company and specifically assigned to them.
              </AlertDescription>
            </Alert>

            {/* Modules List */}
            <div className="space-y-6">
              {/* Company Status Summary */}
              <div className="p-4 border rounded-lg bg-card">
                <h4 className="font-medium mb-2">Company Module Status</h4>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>{enabledModules.length} modules enabled for {companyName}</span>
                  </div>
                  {userModules && userModules.length > enabledModules.length && (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span>{userModules.length - enabledModules.length} modules disabled</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Core Modules */}
              {coreModules.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="default">Core</Badge>
                    <span className="font-medium">Core Modules</span>
                    <span className="text-sm text-muted-foreground">(Required for all admins)</span>
                  </div>
                  <div className="grid gap-3">
                    {coreModules.map((module) => {
                      const currentValue = getCurrentValue(module.id);
                      const hasChanged = module.id in pendingChanges;

                      return (
                        <div
                          key={module.id}
                          className={`p-4 border rounded-lg ${
                            hasChanged
                              ? 'border-amber-300 bg-amber-50'
                              : module.is_enabled
                                ? 'border-border'
                                : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{module.name}</span>
                                {!module.is_enabled && (
                                  <Badge variant="destructive" className="text-xs">
                                    Disabled for Company
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {module.description}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Category: {module.category} • Type: {module.module_type}
                              </div>
                            </div>
                            <Switch
                              checked={currentValue}
                              onCheckedChange={(checked) => handleModuleToggle(module.id, checked)}
                              disabled={!module.is_enabled || saveModulesMutation.isPending}
                            />
                          </div>
                          {!module.is_enabled && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-red-600">
                              <AlertCircle className="h-3 w-3" />
                              This module is disabled for {companyName}. Contact your super admin to enable it.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add-on Modules */}
              {addOnModules.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary">Add-on</Badge>
                    <span className="font-medium">Add-on Modules</span>
                    <span className="text-sm text-muted-foreground">(Optional features)</span>
                  </div>
                  <div className="grid gap-3">
                    {addOnModules.map((module) => {
                      const currentValue = getCurrentValue(module.id);
                      const hasChanged = module.id in pendingChanges;

                      return (
                        <div
                          key={module.id}
                          className={`p-4 border rounded-lg ${
                            hasChanged
                              ? 'border-amber-300 bg-amber-50'
                              : module.is_enabled
                                ? 'border-border'
                                : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{module.name}</span>
                                {!module.is_enabled && (
                                  <Badge variant="destructive" className="text-xs">
                                    Disabled for Company
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {module.description}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Category: {module.category} • Type: {module.module_type}
                              </div>
                            </div>
                            <Switch
                              checked={currentValue}
                              onCheckedChange={(checked) => handleModuleToggle(module.id, checked)}
                              disabled={!module.is_enabled || saveModulesMutation.isPending}
                            />
                          </div>
                          {!module.is_enabled && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-red-600">
                              <AlertCircle className="h-3 w-3" />
                              This module is disabled for {companyName}. Contact your super admin to enable it.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(!userModules || userModules.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Modules Available</h3>
                  <p>No modules are currently enabled for {companyName}.</p>
                </div>
              )}

              {/* Pending Changes Summary */}
              {hasPendingChanges && (
                <div className="p-4 border rounded-lg bg-amber-50 border-amber-300">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-amber-700">Pending Changes</span>
                    <Badge variant="outline" className="text-amber-600 border-amber-600">
                      {Object.keys(pendingChanges).length} changes
                    </Badge>
                  </div>
                  <div className="text-sm text-amber-700">
                    {Object.entries(pendingChanges).map(([moduleId, hasAccess]) => {
                      const module = userModules?.find(m => m.id === moduleId);
                      return (
                        <div key={moduleId}>
                          {hasAccess ? 'Enable' : 'Disable'} access to {module?.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {hasPendingChanges && (
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleSave}
                  disabled={saveModulesMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {saveModulesMutation.isPending ? (
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
                  variant="outline"
                  onClick={() => setPendingChanges({})}
                  disabled={saveModulesMutation.isPending}
                >
                  Cancel Changes
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}