"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/components/SessionContextProvider";
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Users,
  Shield,
  Settings,
  Loader2,
  Save,
  X,
  Search,
  Crown,
  User,
  UserCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CustomRoleService, { CreateCustomRoleRequest, UpdateCustomRoleRequest } from "@/services/customRoleService";
import RoleTemplateSelector from "@/components/RoleTemplateSelector";
import {
  CustomRole,
  RoleTemplate,
  Permission,
  PermissionKey,
  SystemRole,
  ALL_PERMISSIONS,
  CORE_PERMISSIONS,
  OPERATIONS_PERMISSIONS,
  AI_PERMISSIONS,
  ACCOUNTING_PERMISSIONS,
  AUTOMATION_PERMISSIONS,
  ANALYTICS_PERMISSIONS,
  PermissionCategory
} from "@/types/permissions";
import { cn } from "@/lib/utils";

interface CustomRoleManagerProps {
  companyId: string;
}

// Form schemas
const createRoleSchema = z.object({
  role_display_name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  based_on_role: z.enum(['user', 'admin', 'super-admin']).optional(),
  permissions: z.array(z.string()).default([]),
});

const editRoleSchema = z.object({
  role_display_name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  permissions: z.array(z.string()).default([]),
});

type CreateRoleFormData = z.infer<typeof createRoleSchema>;
type EditRoleFormData = z.infer<typeof editRoleSchema>;

const CustomRoleManager = ({ companyId }: CustomRoleManagerProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile } = useSession();
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState("");

  const userRole = profile?.role;
  const canManageRoles = userRole && ['admin', 'super-admin'].includes(userRole);

  // Fetch custom roles
  const { data: customRoles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["customRoles", companyId],
    queryFn: () => CustomRoleService.getCompanyCustomRoles(companyId),
    enabled: !!companyId && !!canManageRoles,
  });

  // Fetch role templates
  const { data: roleTemplates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["roleTemplates"],
    queryFn: () => CustomRoleService.getRoleTemplates(),
    enabled: !!canManageRoles,
  });

  // Fetch all permissions
  const { data: allPermissions, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category', { ascending: true })
        .order('permission_name', { ascending: true });
      if (error) throw error;
      return data as Permission[];
    },
    enabled: !!canManageRoles,
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (data: CreateRoleFormData) => {
      const request: CreateCustomRoleRequest = {
        company_id: companyId,
        role_name: data.role_display_name.toLowerCase().replace(/\s+/g, '_'),
        role_display_name: data.role_display_name,
        description: data.description,
        based_on_role: data.based_on_role,
        permissions: data.permissions as PermissionKey[],
      };
      return CustomRoleService.createCustomRole(request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customRoles", companyId] });
      toast({ title: "Success", description: "Custom role created successfully" });
      setCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create custom role",
        variant: "destructive"
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ roleId, data }: { roleId: string; data: EditRoleFormData }) => {
      const request: UpdateCustomRoleRequest = {
        role_display_name: data.role_display_name,
        description: data.description,
        is_active: data.is_active,
        permissions: data.permissions as PermissionKey[],
      };
      return CustomRoleService.updateCustomRole(roleId, request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customRoles", companyId] });
      toast({ title: "Success", description: "Custom role updated successfully" });
      setEditDialogOpen(false);
      setSelectedRole(null);
      editForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update custom role",
        variant: "destructive"
      });
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => CustomRoleService.deleteCustomRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customRoles", companyId] });
      toast({ title: "Success", description: "Custom role deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete custom role",
        variant: "destructive"
      });
    },
  });

  // Forms
  const createForm = useForm<CreateRoleFormData>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      role_display_name: "",
      description: "",
      permissions: [],
    },
  });

  const editForm = useForm<EditRoleFormData>({
    resolver: zodResolver(editRoleSchema),
    defaultValues: {
      role_display_name: "",
      description: "",
      is_active: true,
      permissions: [],
    },
  });

  // Handle edit role
  const handleEditRole = async (role: CustomRole) => {
    setSelectedRole(role);
    try {
      const roleDetails = await CustomRoleService.getCustomRoleDetails(role.id);
      editForm.reset({
        role_display_name: roleDetails.role_display_name,
        description: roleDetails.description || "",
        is_active: roleDetails.is_active,
        permissions: roleDetails.permissions.map(p => p.permission?.permission_key || '').filter(Boolean),
      });
      setEditDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load role details",
        variant: "destructive"
      });
    }
  };

  // Group permissions by category
  const getPermissionsByCategory = (category: PermissionCategory) => {
    if (!allPermissions) return [];
    return allPermissions.filter(p => p.category === category);
  };

  // Filter permissions based on search
  const getFilteredPermissions = (permissions: Permission[]) => {
    if (!permissionSearch) return permissions;
    return permissions.filter(p =>
      p.permission_name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
      p.permission_key.toLowerCase().includes(permissionSearch.toLowerCase())
    );
  };

  // Filter roles based on search
  const filteredRoles = customRoles?.filter(role =>
    role.role_display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Get system role badge variant
  const getSystemRoleBadge = (role?: SystemRole) => {
    switch (role) {
      case 'super-admin': return { icon: Crown, variant: 'destructive' as const, label: 'Super Admin' };
      case 'admin': return { icon: Shield, variant: 'default' as const, label: 'Admin' };
      case 'user': return { icon: User, variant: 'secondary' as const, label: 'User' };
      default: return { icon: UserCheck, variant: 'outline' as const, label: 'Custom' };
    }
  };

  if (!canManageRoles) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You don't have permission to manage custom roles.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isLoading = isLoadingRoles || isLoadingTemplates || isLoadingPermissions;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading custom roles...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Custom Role Management
          </CardTitle>
          <CardDescription>
            Create and manage custom roles with granular permissions for your company
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="templates" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="templates">Role Templates</TabsTrigger>
              <TabsTrigger value="custom">Custom Roles</TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="mt-6">
              <RoleTemplateSelector
                companyId={companyId}
                onRoleCreated={() => {
                  queryClient.invalidateQueries({ queryKey: ["customRoles", companyId] });
                }}
              />
            </TabsContent>

            <TabsContent value="custom" className="mt-6">
              <div className="space-y-6">
                {/* Custom Role Creation Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Custom Roles ({filteredRoles.length})</h3>
                    <p className="text-sm text-muted-foreground">
                      Create roles from scratch or manage existing custom roles
                    </p>
                  </div>
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Custom Role
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create Custom Role</DialogTitle>
                        <DialogDescription>
                          Create a new custom role and assign specific permissions
                        </DialogDescription>
                      </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit((data) => createRoleMutation.mutate(data))} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="role_display_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Expense Reviewer" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="based_on_role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Based on System Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select base role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="super-admin">Super Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Start with permissions from a system role
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={createForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe what this role is for..."
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Permission Assignment */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Permissions</h4>
                        <div className="relative w-64">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search permissions..."
                            value={permissionSearch}
                            onChange={(e) => setPermissionSearch(e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      </div>

                      <Tabs defaultValue="core" className="w-full">
                        <TabsList className="grid grid-cols-6 w-full">
                          <TabsTrigger value="core">Core</TabsTrigger>
                          <TabsTrigger value="operations">Operations</TabsTrigger>
                          <TabsTrigger value="accounting">Accounting</TabsTrigger>
                          <TabsTrigger value="ai">AI</TabsTrigger>
                          <TabsTrigger value="automation">Automation</TabsTrigger>
                          <TabsTrigger value="analytics">Analytics</TabsTrigger>
                        </TabsList>

                        {(['core', 'operations', 'accounting', 'ai', 'automation', 'analytics'] as PermissionCategory[]).map(category => (
                          <TabsContent key={category} value={category} className="mt-4">
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                              {getFilteredPermissions(getPermissionsByCategory(category)).map(permission => (
                                <FormField
                                  key={permission.id}
                                  control={createForm.control}
                                  name="permissions"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(permission.permission_key)}
                                          onCheckedChange={(checked) => {
                                            const current = field.value || [];
                                            if (checked) {
                                              field.onChange([...current, permission.permission_key]);
                                            } else {
                                              field.onChange(current.filter(p => p !== permission.permission_key));
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <div className="space-y-1 leading-none">
                                        <FormLabel className="text-sm font-normal">
                                          {permission.permission_name}
                                        </FormLabel>
                                        {permission.description && (
                                          <p className="text-xs text-muted-foreground">
                                            {permission.description}
                                          </p>
                                        )}
                                      </div>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createRoleMutation.isPending}>
                        {createRoleMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Create Role
                      </Button>
                    </div>
                      </form>
                    </Form>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Search Bar */}
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search custom roles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Roles Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Custom Roles ({filteredRoles.length})</CardTitle>
                  </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Based On</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No custom roles found. Create your first custom role to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map((role) => {
                  const systemRoleBadge = getSystemRoleBadge(role.based_on_role);
                  const BadgeIcon = systemRoleBadge.icon;

                  return (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {role.role_display_name}
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">
                          {role.description || "No description"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={systemRoleBadge.variant} className="gap-1">
                          <BadgeIcon className="h-3 w-3" />
                          {systemRoleBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={role.is_active ? "default" : "secondary"}>
                          {role.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(role.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditRole(role)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete the role "${role.role_display_name}"?`)) {
                                deleteRoleMutation.mutate(role.id);
                              }
                            }}
                            disabled={deleteRoleMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
                </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Custom Role</DialogTitle>
            <DialogDescription>
              Modify role details and permissions
            </DialogDescription>
          </DialogHeader>
          {selectedRole && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit((data) =>
                updateRoleMutation.mutate({ roleId: selectedRole.id, data })
              )} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="role_display_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Expense Reviewer" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Active Role</FormLabel>
                          <FormDescription>
                            Whether this role can be assigned to users
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what this role is for..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Permission Assignment */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Permissions</h4>
                    <div className="relative w-64">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search permissions..."
                        value={permissionSearch}
                        onChange={(e) => setPermissionSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <Tabs defaultValue="core" className="w-full">
                    <TabsList className="grid grid-cols-6 w-full">
                      <TabsTrigger value="core">Core</TabsTrigger>
                      <TabsTrigger value="operations">Operations</TabsTrigger>
                      <TabsTrigger value="accounting">Accounting</TabsTrigger>
                      <TabsTrigger value="ai">AI</TabsTrigger>
                      <TabsTrigger value="automation">Automation</TabsTrigger>
                      <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

                    {(['core', 'operations', 'accounting', 'ai', 'automation', 'analytics'] as PermissionCategory[]).map(category => (
                      <TabsContent key={category} value={category} className="mt-4">
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                          {getFilteredPermissions(getPermissionsByCategory(category)).map(permission => (
                            <FormField
                              key={permission.id}
                              control={editForm.control}
                              name="permissions"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(permission.permission_key)}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        if (checked) {
                                          field.onChange([...current, permission.permission_key]);
                                        } else {
                                          field.onChange(current.filter(p => p !== permission.permission_key));
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-normal">
                                      {permission.permission_name}
                                    </FormLabel>
                                    {permission.description && (
                                      <p className="text-xs text-muted-foreground">
                                        {permission.description}
                                      </p>
                                    )}
                                  </div>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateRoleMutation.isPending}>
                    {updateRoleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Update Role
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomRoleManager;