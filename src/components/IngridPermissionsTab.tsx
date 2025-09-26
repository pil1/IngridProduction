/**
 * Ingrid Permissions Management Tab
 *
 * Allows company admins to manage Ingrid AI access for their users
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Bot,
  Users,
  UserPlus,
  Settings,
  Shield,
  Activity,
  TrendingUp,
  Calendar,
  FileText,
  MessageSquare,
  Zap,
  BarChart3,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ingridPermissionsService, UserModulePermission, CreatePermissionRequest } from '@/services/api/ingridPermissions';
import { userService } from '@/services/api/user';
import { useSession } from '@/components/SessionContextProvider';

interface PermissionFormData {
  user_id: string;
  permission_types: ('chat' | 'document_processing' | 'automation' | 'analytics')[];
  expires_at?: string;
  usage_limit?: number;
  notes?: string;
}

export function IngridPermissionsTab() {
  const { profile } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedUser, setSelectedUser] = useState<string>('');
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [editingPermission, setEditingPermission] = useState<UserModulePermission | null>(null);
  const [bulkSelection, setBulkSelection] = useState<string[]>([]);

  // Fetch company users
  const { data: companyUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['company-users', profile?.company_id],
    queryFn: () => userService.getCompanyUsers(profile?.company_id || ''),
    enabled: !!profile?.company_id,
  });

  // Fetch Ingrid permissions
  const { data: permissions, isLoading: permissionsLoading, refetch } = useQuery({
    queryKey: ['ingrid-permissions', profile?.company_id],
    queryFn: () => ingridPermissionsService.getCompanyIngridPermissions(profile?.company_id || ''),
    enabled: !!profile?.company_id,
  });

  // Fetch usage stats
  const { data: usageStats } = useQuery({
    queryKey: ['ingrid-usage-stats', profile?.company_id],
    queryFn: () => ingridPermissionsService.getCompanyUsageStats(profile?.company_id || ''),
    enabled: !!profile?.company_id,
  });

  // Grant permission mutation
  const grantPermissionMutation = useMutation({
    mutationFn: (data: CreatePermissionRequest) => ingridPermissionsService.grantPermission(data),
    onSuccess: () => {
      toast({
        title: 'Permission Granted',
        description: 'Ingrid AI access has been granted to the user.',
      });
      queryClient.invalidateQueries({ queryKey: ['ingrid-permissions'] });
      setShowGrantDialog(false);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to grant permission.',
      });
    },
  });

  // Revoke permission mutation
  const revokePermissionMutation = useMutation({
    mutationFn: (id: string) => ingridPermissionsService.revokePermission(id),
    onSuccess: () => {
      toast({
        title: 'Permission Revoked',
        description: 'Ingrid AI access has been revoked.',
      });
      queryClient.invalidateQueries({ queryKey: ['ingrid-permissions'] });
    },
  });

  // Bulk grant permissions mutation
  const bulkGrantMutation = useMutation({
    mutationFn: (data: {
      userIds: string[];
      permissionTypes: ('chat' | 'document_processing' | 'automation' | 'analytics')[];
      options?: any;
    }) => ingridPermissionsService.bulkGrantPermissions(
      data.userIds,
      profile?.company_id || '',
      data.permissionTypes,
      data.options
    ),
    onSuccess: () => {
      toast({
        title: 'Bulk Permissions Granted',
        description: `Granted Ingrid AI access to ${bulkSelection.length} users.`,
      });
      queryClient.invalidateQueries({ queryKey: ['ingrid-permissions'] });
      setBulkSelection([]);
    },
  });

  const handleGrantPermission = (formData: PermissionFormData) => {
    formData.permission_types.forEach(permissionType => {
      grantPermissionMutation.mutate({
        user_id: formData.user_id,
        company_id: profile?.company_id || '',
        permission_type: permissionType,
        expires_at: formData.expires_at || null,
        usage_limit: formData.usage_limit || null,
        notes: formData.notes || null,
      });
    });
  };

  const handleBulkGrant = () => {
    if (bulkSelection.length === 0) return;

    bulkGrantMutation.mutate({
      userIds: bulkSelection,
      permissionTypes: ['chat', 'document_processing'],
      options: {
        notes: 'Bulk granted basic Ingrid AI access',
      },
    });
  };

  const getPermissionIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return <MessageSquare className="h-4 w-4" />;
      case 'document_processing':
        return <FileText className="h-4 w-4" />;
      case 'automation':
        return <Zap className="h-4 w-4" />;
      case 'analytics':
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (permission: UserModulePermission) => {
    if (!permission.is_enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }

    if (permission.expires_at && new Date(permission.expires_at) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }

    if (permission.usage_limit && permission.current_usage >= permission.usage_limit) {
      return <Badge variant="outline">Limit Reached</Badge>;
    }

    return <Badge variant="default">Active</Badge>;
  };

  const groupedPermissions = permissions?.data?.reduce((acc, permission) => {
    if (!acc[permission.user_id]) {
      acc[permission.user_id] = {
        user: permission.user,
        permissions: [],
      };
    }
    acc[permission.user_id].permissions.push(permission);
    return acc;
  }, {} as Record<string, { user: any; permissions: UserModulePermission[] }>) || {};

  if (usersLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center space-x-2">
            <Bot className="h-6 w-6 text-blue-600" />
            <span>Ingrid AI Permissions</span>
          </h2>
          <p className="text-muted-foreground">
            Manage Ingrid AI access for your team members
          </p>
        </div>

        <div className="flex space-x-2">
          {bulkSelection.length > 0 && (
            <Button onClick={handleBulkGrant} variant="outline">
              <UserPlus className="h-4 w-4 mr-2" />
              Grant to {bulkSelection.length} users
            </Button>
          )}

          <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Grant Access
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Grant Ingrid AI Access</DialogTitle>
                <DialogDescription>
                  Select a user and permissions to grant Ingrid AI access.
                </DialogDescription>
              </DialogHeader>

              <GrantPermissionForm
                users={companyUsers?.data || []}
                onSubmit={handleGrantPermission}
                onCancel={() => setShowGrantDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Usage Stats */}
      {usageStats?.data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usageStats.data.total_users}</div>
              <p className="text-xs text-muted-foreground">
                with Ingrid access
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usageStats.data.active_users}</div>
              <p className="text-xs text-muted-foreground">
                used this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usageStats.data.total_usage}</div>
              <p className="text-xs text-muted-foreground">
                interactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Most Used</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.keys(usageStats.data.usage_by_type)[0] || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                feature type
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Permissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Permissions</CardTitle>
          <CardDescription>
            Manage individual Ingrid AI permissions for your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBulkSelection(Object.keys(groupedPermissions));
                      } else {
                        setBulkSelection([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedPermissions).map(([userId, { user, permissions }]) => (
                <TableRow key={userId}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={bulkSelection.includes(userId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBulkSelection(prev => [...prev, userId]);
                        } else {
                          setBulkSelection(prev => prev.filter(id => id !== userId));
                        }
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {user?.first_name} {user?.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user?.email}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {permissions.map(permission => (
                        <Badge key={permission.id} variant="outline" className="text-xs">
                          <span className="mr-1">{getPermissionIcon(permission.permission_type)}</span>
                          {permission.permission_type.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm">
                      {permissions.reduce((sum, p) => sum + p.current_usage, 0)} interactions
                    </div>
                  </TableCell>

                  <TableCell>
                    {permissions.length > 0 && getStatusBadge(permissions[0])}
                  </TableCell>

                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke Access</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will revoke all Ingrid AI permissions for {user?.first_name} {user?.last_name}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                permissions.forEach(permission => {
                                  revokePermissionMutation.mutate(permission.id);
                                });
                              }}
                            >
                              Revoke Access
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {Object.keys(groupedPermissions).length === 0 && (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Permissions Yet</h3>
              <p className="text-gray-600 mb-4">
                Start by granting Ingrid AI access to your team members.
              </p>
              <Button onClick={() => setShowGrantDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Grant First Permission
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Grant Permission Form Component
interface GrantPermissionFormProps {
  users: any[];
  onSubmit: (data: PermissionFormData) => void;
  onCancel: () => void;
}

function GrantPermissionForm({ users, onSubmit, onCancel }: GrantPermissionFormProps) {
  const [formData, setFormData] = useState<PermissionFormData>({
    user_id: '',
    permission_types: ['chat'],
    expires_at: '',
    usage_limit: undefined,
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handlePermissionToggle = (permissionType: 'chat' | 'document_processing' | 'automation' | 'analytics') => {
    setFormData(prev => ({
      ...prev,
      permission_types: prev.permission_types.includes(permissionType)
        ? prev.permission_types.filter(p => p !== permissionType)
        : [...prev.permission_types, permissionType]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="user_id">Select User</Label>
        <Select value={formData.user_id} onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: value }))}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a user" />
          </SelectTrigger>
          <SelectContent>
            {users.map(user => (
              <SelectItem key={user.user_id} value={user.user_id}>
                {user.first_name} {user.last_name} ({user.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Permissions</Label>
        <div className="space-y-2 mt-2">
          {[
            { type: 'chat' as const, label: 'Chat Access', icon: MessageSquare },
            { type: 'document_processing' as const, label: 'Document Processing', icon: FileText },
            { type: 'automation' as const, label: 'Automation', icon: Zap },
            { type: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
          ].map(({ type, label, icon: Icon }) => (
            <div key={type} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={type}
                checked={formData.permission_types.includes(type)}
                onChange={() => handlePermissionToggle(type)}
              />
              <Icon className="h-4 w-4" />
              <Label htmlFor={type}>{label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="expires_at">Expiration Date (Optional)</Label>
        <Input
          id="expires_at"
          type="date"
          value={formData.expires_at}
          onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
        />
      </div>

      <div>
        <Label htmlFor="usage_limit">Usage Limit (Optional)</Label>
        <Input
          id="usage_limit"
          type="number"
          placeholder="e.g., 1000 interactions"
          value={formData.usage_limit || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: e.target.value ? parseInt(e.target.value) : undefined }))}
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea
          id="notes"
          placeholder="Add any notes about this permission grant..."
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.user_id || formData.permission_types.length === 0}>
          Grant Access
        </Button>
      </DialogFooter>
    </form>
  );
}