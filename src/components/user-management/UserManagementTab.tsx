/**
 * User Management Tab - Context-Aware User Creation and Management
 *
 * Manages users within a company context with proper module assignment
 * based on what modules the company has access to.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Plus,
  Loader2,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  User
} from 'lucide-react';
import { UserModuleDialog } from './UserModuleDialog';

const createUserSchema = z.object({
  email: z.string().email('Valid email is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  role: z.enum(['user', 'admin']),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  send_invitation: z.boolean(),
  modules: z.array(z.string()),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

interface UserManagementTabProps {
  companyId: string;
  companyName: string;
  isSuperAdmin: boolean;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  companyId: string;
  companyName: string;
  profileCompleted: boolean;
  onboardingCompleted: boolean;
  lastSignIn: string | null;
  isActive: boolean;
}

interface Module {
  id: string;
  name: string;
  description: string;
  module_type: string;
  is_enabled: boolean;
}

export function UserManagementTab({ companyId, companyName, isSuperAdmin }: UserManagementTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      role: 'user',
      phone: '',
      password: '',
      send_invitation: true,
      modules: [],
    },
  });

  // Fetch users for the company
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users', companyId],
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
      return data.success ? data.data.users.filter((u: User) => u.companyId === companyId) : [];
    },
    enabled: !!companyId,
  });

  // Fetch company modules
  const { data: modulesData, isLoading: isLoadingModules } = useQuery({
    queryKey: ['companyModules', companyId],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/modules/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch company modules');
      const data = await response.json();
      return data.success ? data.data.modules.filter((m: Module) => m.is_enabled) : [];
    },
    enabled: !!companyId,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');

      const userData = {
        ...data,
        company_id: companyId,
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to create user');
      }

      return response.json();
    },
    onSuccess: (response) => {
      toast({
        title: "User Created Successfully",
        description: `${response.data.user.fullName} has been added to ${companyName}`,
      });

      form.reset();
      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users', companyId] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create User",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateUserForm) => {
    createUserMutation.mutate(data);
  };

  const handleManageModules = (userId: string) => {
    setSelectedUserId(userId);
    setIsModuleDialogOpen(true);
  };

  const filteredUsers = usersData?.filter((user: User) =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const enabledModules = modulesData?.filter((m: Module) => m.is_enabled) || [];

  return (
    <div className="space-y-6">
      {/* Header with Create User Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Users - {companyName}</h2>
          <p className="text-muted-foreground">
            Manage users and their module access for this company
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New User to {companyName}</DialogTitle>
              <DialogDescription>
                Create a new user account with access to selected modules.
                {isSuperAdmin ? " As a super admin, you're adding a user to the selected company." : " This user will be added to your company."}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Doe" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="john.doe@company.com" type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="+1 (555) 123-4567" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select user role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Admin users can manage other users and company settings
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Password Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium">Password & Access</h4>

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Leave empty to send invitation" type="password" />
                        </FormControl>
                        <FormDescription>
                          If empty, an invitation email will be sent to set password
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Module Access */}
                <div className="space-y-4">
                  <h4 className="font-medium">Module Access</h4>
                  <p className="text-sm text-muted-foreground">
                    Select which modules this user will have access to. Only modules enabled for {companyName} are shown.
                  </p>

                  {isLoadingModules ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading available modules...
                    </div>
                  ) : enabledModules.length > 0 ? (
                    <FormField
                      control={form.control}
                      name="modules"
                      render={() => (
                        <FormItem>
                          <div className="grid grid-cols-2 gap-3">
                            {enabledModules.map((module: Module) => (
                              <FormField
                                key={module.id}
                                control={form.control}
                                name="modules"
                                render={({ field }) => {
                                  return (
                                    <FormItem key={module.id}>
                                      <div className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                        field.value?.includes(module.id)
                                          ? 'border-primary bg-primary/5'
                                          : 'hover:border-primary/50'
                                      }`} onClick={() => {
                                        const newValue = field.value?.includes(module.id)
                                          ? field.value?.filter((value) => value !== module.id) || []
                                          : [...(field.value || []), module.id];
                                        field.onChange(newValue);
                                      }}>
                                        <div className="flex items-center gap-2">
                                          <div className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                                            field.value?.includes(module.id)
                                              ? 'border-primary bg-primary text-white'
                                              : 'border-gray-300'
                                          }`}>
                                            {field.value?.includes(module.id) && (
                                              <CheckCircle className="h-3 w-3" />
                                            )}
                                          </div>
                                          <span className="font-medium">{module.name}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {module.description}
                                        </p>
                                      </div>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No modules are currently enabled for {companyName}. Please contact your super admin to enable modules first.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={createUserMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating User...
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4 mr-2" />
                        Create User
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Company Users
          </CardTitle>
          <CardDescription>
            View and manage all users in {companyName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="outline">
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Users Table */}
          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading users...
            </div>
          ) : filteredUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: User) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.fullName}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? (
                          <>
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </>
                        ) : (
                          'User'
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.isActive ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={user.isActive ? 'text-green-600' : 'text-red-600'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.lastSignIn ? (
                        new Date(user.lastSignIn).toLocaleDateString()
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleManageModules(user.id)}>
                            <Shield className="h-4 w-4 mr-2" />
                            Manage Modules
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No users found</h3>
              <p className="text-muted-foreground">
                {searchTerm
                  ? "No users match your search criteria"
                  : "This company doesn't have any users yet. Add the first user to get started."
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Module Dialog */}
      <UserModuleDialog
        open={isModuleDialogOpen}
        onOpenChange={setIsModuleDialogOpen}
        userId={selectedUserId}
        companyId={companyId}
        companyName={companyName}
        onModulesUpdated={() => {
          // Refresh user data if needed
          queryClient.invalidateQueries({ queryKey: ['users', companyId] });
        }}
      />
    </div>
  );
}