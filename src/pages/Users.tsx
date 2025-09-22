"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Users, RefreshCcw, Trash2, Package, ChevronRight, ChevronLeft, Save } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import EditUserDialog from "@/components/EditUserDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Schema for individual module settings for a new user
const newUserModuleSettingSchema = z.object({
  module_id: z.string(),
  name: z.string(), // For display
  description: z.string().optional().nullable(), // For display
  is_enabled: z.boolean(),
  is_locked_by_system: z.boolean(), // To indicate if it's a core module
  module_type: z.enum(["core", "super", "add-on"]), // To filter by type
});

// Schema for the first step (User Details)
const userDetailsSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  role: z.string().min(1, "Role is required"),
  company_id: z.string().optional().nullable(),
});

// Full schema for the form, including modules for the second step
const addUserFormSchema = userDetailsSchema.extend({
  modules: z.array(newUserModuleSettingSchema),
});

type UserDetailsFormValues = z.infer<typeof userDetailsSchema>;
type AddUserFormValues = z.infer<typeof addUserFormSchema>;

interface Profile {
  id: string;
  user_id: string;
  company_id: string | null;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  company_id: string | null;
}

interface SystemModule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  module_type: "core" | "super" | "add-on";
  roles?: string[] | null; // Roles that can access this module (can be null)
}

interface CompanyModule {
  id: string;
  company_id: string;
  module_id: string;
  is_enabled: boolean;
  is_locked_by_system: boolean;
}

// Helper function to capitalize the first letter of a string
const capitalizeFirstLetter = (str: string) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const UsersPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession, user: currentUser } = useSession();
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<Profile | null>(null);
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [isDeleteInvitationDialogOpen, setIsDeleteInvitationDialogOpen] = useState(false);
  const [invitationToDelete, setInvitationToDelete] = useState<Invitation | null>(null);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);

  const [activeAddUserTab, setActiveAddUserTab] = useState("user-details");
  const [newlyCreatedUserId, setNewlyCreatedUserId] = useState<string | null>(null);
  const [newlyCreatedUserRole, setNewlyCreatedUserRole] = useState<string | null>(null);

  const isSuperAdmin = profile?.role === 'super-admin';
  const isCompanyAdmin = profile?.role === 'admin';
  const currentCompanyId = profile?.company_id;

  const { data: users, isLoading: isLoadingUsers, isError: isErrorUsers } = useQuery<Profile[]>({
    queryKey: ["users", currentCompanyId],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*");
      if (!isSuperAdmin && currentCompanyId) {
        query = query.eq("company_id", currentCompanyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const { data: companies, isLoading: isLoadingCompanies, isError: isErrorCompanies } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name");
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  const { data: invitations, isLoading: isLoadingInvitations, isError: isErrorInvitations } = useQuery<Invitation[]>({
    queryKey: ["invitations", currentCompanyId],
    queryFn: async () => {
      let query = supabase
        .from("invitations")
        .select("id,email,role,invited_by,expires_at,accepted_at,company_id")
        .is("accepted_at", null);

      if (!isSuperAdmin && currentCompanyId) {
        query = query.eq("company_id", currentCompanyId);
      }
      const { data, error } = await query;
      if (error) throw error;

      const typedData: Invitation[] = (data as any[]).map(item => ({
        id: item.id,
        email: item.email,
        role: item.role,
        invited_by: item.invited_by,
        expires_at: item.expires_at,
        accepted_at: item.accepted_at,
        company_id: item.company_id,
      }));
      return typedData;
    },
    enabled: !!profile,
  });

  // Fetch all system modules (depends on newlyCreatedUserRole for filtering)
  const { data: allSystemModules, isLoading: isLoadingAllSystemModules } = useQuery<SystemModule[]>({
    queryKey: ["allSystemModulesForUserCreation", newlyCreatedUserRole], // Key depends on role
    queryFn: async () => {
      // Only fetch if a role is selected
      if (!newlyCreatedUserRole) return []; 
      const { data, error } = await supabase.from("modules").select("id, name, description, is_active, module_type, roles");
      if (error) {
        console.error("Error fetching system modules:", error);
        throw error;
      }
      return data ?? [];
    },
    enabled: !!profile && !!newlyCreatedUserRole, // Only fetch when a role is set
  });

  // Fetch company's enabled modules (depends on newlyCreatedUserId for company context)
  const { data: companyEnabledModules, isLoading: isLoadingCompanyEnabledModules } = useQuery<CompanyModule[]>({
    queryKey: ["companyEnabledModulesForUserCreation", currentCompanyId],
    queryFn: async () => {
      if (!currentCompanyId) return [];
      const { data, error } = await supabase.from("company_modules").select("id, company_id, module_id, is_enabled, is_locked_by_system").eq("company_id", currentCompanyId).eq("is_enabled", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentCompanyId && !!profile,
  });

  const addUserForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserFormSchema),
    defaultValues: {
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      role: "user",
      company_id: isSuperAdmin ? undefined : currentCompanyId ?? undefined,
      modules: [], // Initialize empty
    },
  });

  // Populate modules in form when system modules and company modules are loaded
  useEffect(() => {
    if (allSystemModules && companyEnabledModules && newlyCreatedUserRole) {
      const targetCompany = addUserForm.getValues("company_id") ?? currentCompanyId;

      const initialModules = allSystemModules
        .filter(sysMod => {
          // Filter by role: if module has roles defined, check if newlyCreatedUserRole is included
          // If sysMod.roles is null or empty, it means it's available to ALL roles.
          const roleMatches = !sysMod.roles || sysMod.roles.length === 0 || sysMod.roles.includes(newlyCreatedUserRole);

          // Filter by company enablement: if not super-admin, check if module is enabled for the company
          const isCompanyEnabled = isSuperAdmin || !targetCompany || (companyEnabledModules || []).some(cm => cm.module_id === sysMod.id && cm.is_enabled);

          return sysMod.is_active && roleMatches && isCompanyEnabled;
        })
        .map(sysMod => ({
          module_id: sysMod.id,
          name: sysMod.name,
          description: sysMod.description,
          is_enabled: sysMod.module_type === 'core', // Core modules enabled by default
          is_locked_by_system: sysMod.module_type === 'core', // Core modules are locked
          module_type: sysMod.module_type,
        }));
      addUserForm.setValue("modules", initialModules);
    }
  }, [allSystemModules, companyEnabledModules, newlyCreatedUserRole, addUserForm.watch("company_id"), isSuperAdmin, currentCompanyId]);

  // Reset dialog state when it closes
  useEffect(() => {
    if (isAddUserDialogOpen) {
      setActiveAddUserTab("user-details");
      setNewlyCreatedUserId(null);
      setNewlyCreatedUserRole(null);
      addUserForm.reset({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        role: "user",
        company_id: isSuperAdmin ? undefined : currentCompanyId ?? undefined,
        modules: [], // Will be re-populated by the effect above
      });
    }
  }, [isAddUserDialogOpen, addUserForm, isSuperAdmin, currentCompanyId]);

  // Mutation for creating the user (first step)
  const createUserOnlyMutation = useMutation({
    mutationFn: async (userDetails: UserDetailsFormValues) => {
      const payload = isSuperAdmin
        ? userDetails
        : { ...userDetails, company_id: currentCompanyId };

      const { data, error } = await supabase.functions.invoke('create-user-by-admin', {
        body: { ...payload, modules: [] }, // Pass empty modules for now, will be updated in next step
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "User Created",
        description: "User account created. Now configure module access.",
      });
      setNewlyCreatedUserId(data.userId);
      setNewlyCreatedUserRole(addUserForm.getValues("role")); // Store the role for module filtering
      setActiveAddUserTab("module-access");
      queryClient.invalidateQueries({ queryKey: ["users"] }); // Invalidate users list to show new user
    },
    onError: (error: any) => {
      if (error.status === 409 && error.message.includes('A user with this email already exists.')) {
        toast({
          title: "Error Creating User",
          description: "A user with this email address already exists. Please use a different email.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error creating user",
          description: error.message ?? "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    },
  });

  // Mutation for updating user modules (second step)
  const updateUserModulesMutation = useMutation({
    mutationFn: async (modulesToUpdate: AddUserFormValues['modules']) => {
      if (!newlyCreatedUserId || !currentCompanyId) throw new Error("User ID or Company ID missing for module update.");

      const payload = {
        target_user_id: newlyCreatedUserId,
        company_id: currentCompanyId,
        modules: modulesToUpdate.map(m => ({
          module_id: m.module_id,
          is_enabled: m.is_enabled,
        })),
      };

      const { data, error } = await supabase.functions.invoke('upsert-user-module', {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["userModulesForMenu", newlyCreatedUserId] }); // Invalidate menu for the new user
      toast({
        title: "Module Access Saved",
        description: "User's module access has been configured.",
      });
      setIsAddUserDialogOpen(false); // Close dialog after successful module save
    },
    onError: (error: any) => {
      toast({
        title: "Error Saving Module Access",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      setResendingInvitationId(invitationId);
      const { data, error } = await supabase.functions.invoke('resend-invitation', {
        body: { invitation_id: invitationId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast({
        title: "Invitation Resent",
        description: data.message ?? "The invitation has been successfully resent.",
      });
      console.log("New Invitation Link:", data.invitationLink);
      setResendingInvitationId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error Resending Invitation",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
      setResendingInvitationId(null);
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-invitation', {
        body: { invitation_id: invitationId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast({
        title: "Invitation Deleted",
        description: data.message ?? "The invitation has been successfully deleted.",
      });
      setIsDeleteInvitationDialogOpen(false);
      setInvitationToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error Deleting Invitation",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (currentUser?.id === userId) throw new Error("Cannot delete your own user account.");

      const { data, error } = await supabase.functions.invoke('delete-user-by-admin', {
        body: { user_id: userId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "User Deleted",
        description: data.message ?? "The user account has been successfully deleted.",
      });
      setIsDeleteUserDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error Deleting User",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const handleCreateUserAndProceed = (values: UserDetailsFormValues) => {
    createUserOnlyMutation.mutate(values);
  };

  const handleSaveModuleAccess = (values: AddUserFormValues) => {
    updateUserModulesMutation.mutate(values.modules);
  };

  const handleEditUserClick = (user: Profile) => {
    setUserToEdit(user);
    setIsEditUserDialogOpen(true);
  };

  const handleResendInviteClick = (invitationId: string) => {
    resendInvitationMutation.mutate(invitationId);
  };

  const handleDeleteInviteClick = (invitation: Invitation) => {
    setInvitationToDelete(invitation);
    setIsDeleteInvitationDialogOpen(true);
  };

  const confirmDeleteInvitation = () => {
    if (invitationToDelete) {
      deleteInvitationMutation.mutate(invitationToDelete.id);
    }
  };

  const handleDeleteUserClick = (user: Profile) => {
    setUserToDelete(user);
    setIsDeleteUserDialogOpen(true);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.user_id);
    }
  };

  const isLoadingPage = isLoadingSession || isLoadingUsers || (isSuperAdmin && isLoadingCompanies) || isLoadingInvitations || isLoadingAllSystemModules || isLoadingCompanyEnabledModules;
  const isCreatingUser = createUserOnlyMutation.isPending;
  const isSavingModules = updateUserModulesMutation.isPending;

  const modulesForNewUser = addUserForm.watch("modules");
  const selectedRoleForNewUser = newlyCreatedUserRole ?? addUserForm.watch("role"); // Use newlyCreatedUserRole if available

  const getModulesByCategory = (type: "core" | "super" | "add-on") => {
    return modulesForNewUser
      .filter(moduleSetting => moduleSetting.module_type === type)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const coreModules = getModulesByCategory("core");
  const superModules = getModulesByCategory("super");
  const addOnModules = getModulesByCategory("add-on");

  const renderModuleTable = (modulesToRender: AddUserFormValues['modules']) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Module</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Enabled</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {modulesToRender.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="text-center text-muted-foreground">
              No modules available for this role or company.
            </TableCell>
          </TableRow>
        ) : (
          modulesToRender.map((moduleSetting) => {
            const isLocked = moduleSetting.is_locked_by_system;
            const isInputDisabled = isSavingModules || isLocked;

            // Find the correct index in the form's 'modules' array
            const formModuleIndex = addUserForm.watch("modules").findIndex(m => m.module_id === moduleSetting.module_id);
            if (formModuleIndex === -1) return null; // Should not happen if data is consistent

            return (
              <TableRow key={moduleSetting.module_id}>
                <TableCell className="font-medium">{moduleSetting.name}</TableCell>
                <TableCell>{moduleSetting.description ?? "N/A"}</TableCell>
                <TableCell>
                  <Checkbox
                    checked={addUserForm.watch(`modules.${formModuleIndex}.is_enabled`)}
                    onCheckedChange={(checked) => addUserForm.setValue(`modules.${formModuleIndex}.is_enabled`, checked as boolean)}
                    disabled={isInputDisabled}
                  />
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  if (isLoadingPage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading users and invitations...</p>
      </div>
    );
  }

  if (isErrorUsers || (isSuperAdmin && isErrorCompanies) || isErrorInvitations) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading data. Please try again.</p>
      </div>
    );
  }

  // Determine if Super Modules tab should be visible
  const showSuperModulesTab = ['admin', 'controller', 'super-admin'].includes(selectedRoleForNewUser || '');

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Current Users
            </CardTitle>
            <CardDescription>
              {isSuperAdmin ? "All users across the platform." : "Users in your company."}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>
                    Create a new user account and configure their module access.
                  </DialogDescription>
                </DialogHeader>
                <Tabs value={activeAddUserTab} onValueChange={setActiveAddUserTab} className="grid gap-4 py-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="user-details">User Details</TabsTrigger>
                    <TabsTrigger value="module-access" disabled={!newlyCreatedUserId}>Module Access</TabsTrigger>
                  </TabsList>

                  <form onSubmit={addUserForm.handleSubmit(activeAddUserTab === "user-details" ? handleCreateUserAndProceed : handleSaveModuleAccess)} className="grid gap-4">
                    {/* User Details Tab */}
                    <TabsContent value="user-details">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="first_name">First Name</Label>
                          <Input
                            id="first_name"
                            {...addUserForm.register("first_name")}
                            disabled={isCreatingUser}
                          />
                          {addUserForm.formState.errors.first_name && (
                            <p className="text-sm text-destructive">
                              {addUserForm.formState.errors.first_name.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="last_name">Last Name</Label>
                          <Input
                            id="last_name"
                            {...addUserForm.register("last_name")}
                            disabled={isCreatingUser}
                          />
                          {addUserForm.formState.errors.last_name && (
                            <p className="text-sm text-destructive">
                              {addUserForm.formState.errors.last_name.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            {...addUserForm.register("email")}
                            disabled={isCreatingUser}
                          />
                          {addUserForm.formState.errors.email && (
                            <p className="text-sm text-destructive">
                              {addUserForm.formState.errors.email.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            {...addUserForm.register("password")}
                            disabled={isCreatingUser}
                          />
                          {addUserForm.formState.errors.password && (
                            <p className="text-sm text-destructive">
                              {addUserForm.formState.errors.password.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Controller
                            name="role"
                            control={addUserForm.control}
                            render={({ field }) => (
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={isCreatingUser}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="controller">Controller</SelectItem>
                                  {isSuperAdmin && <SelectItem value="super-admin">Super Admin</SelectItem>}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {addUserForm.formState.errors.role && (
                            <p className="text-sm text-destructive">
                              {addUserForm.formState.errors.role.message}
                            </p>
                          )}
                        </div>
                        {isSuperAdmin && (
                          <div className="space-y-2">
                            <Label htmlFor="company_id">Company</Label>
                            <Controller
                              name="company_id"
                              control={addUserForm.control}
                              render={({ field }) => (
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value ?? ""}
                                  disabled={isCreatingUser || isLoadingCompanies}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={isLoadingCompanies ? "Loading companies..." : "Select a company"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {companies?.map((company) => (
                                      <SelectItem key={company.id} value={company.id}>
                                        {company.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {addUserForm.formState.errors.company_id && (
                              <p className="col-span-4 text-right text-sm text-destructive">
                                {addUserForm.formState.errors.company_id.message}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end mt-6">
                        <Button type="submit" disabled={isCreatingUser}>
                          {isCreatingUser ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <>Next <ChevronRight className="ml-2 h-4 w-4" /></>
                          )}
                        </Button>
                      </div>
                    </TabsContent>

                    {/* Module Access Tab */}
                    <TabsContent value="module-access" key={`module-access-tab-${selectedRoleForNewUser}`}>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-5 w-5" /> Module Access
                          </CardTitle>
                          <CardDescription>
                            Configure which modules this new user will have access to.
                            Core modules are enabled by default.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                          {selectedRoleForNewUser === 'user' ? (
                            // Render only Add-On Modules directly for 'user' role
                            <>
                              <h4 className="text-md font-semibold">Add-On Modules</h4>
                              {renderModuleTable(addOnModules)}
                            </>
                          ) : (
                            // Render tabs for other roles
                            <Tabs defaultValue="core-modules">
                              <TabsList className={`grid w-full ${showSuperModulesTab ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                <TabsTrigger value="core-modules">Core Modules</TabsTrigger>
                                {showSuperModulesTab && <TabsTrigger value="super-modules">Super Modules</TabsTrigger>}
                                <TabsTrigger value="add-on-modules">Add-On Modules</TabsTrigger>
                              </TabsList>

                              <TabsContent value="core-modules" key={`core-${selectedRoleForNewUser}`} className="mt-4">
                                {renderModuleTable(coreModules)}
                              </TabsContent>

                              {showSuperModulesTab && (
                                <TabsContent value="super-modules" key={`super-${selectedRoleForNewUser}`} className="mt-4">
                                  {renderModuleTable(superModules)}
                                </TabsContent>
                              )}

                              <TabsContent value="add-on-modules" key={`addon-${selectedRoleForNewUser}`} className="mt-4">
                                {renderModuleTable(addOnModules)}
                              </TabsContent>
                            </Tabs>
                          )}
                        </CardContent>
                        <div className="flex justify-between p-6 pt-0">
                          <Button type="button" variant="outline" onClick={() => setActiveAddUserTab("user-details")} disabled={isSavingModules}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                          </Button>
                          <Button type="submit" disabled={isSavingModules}>
                            {isSavingModules ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-4 w-4" />
                            )}
                            Save Module Access
                          </Button>
                        </div>
                      </Card>
                    </TabsContent>
                  </form>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {isSuperAdmin && <TableHead>Company</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name ?? "N/A"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{capitalizeFirstLetter(user.role)}</TableCell>
                  <TableCell>{capitalizeFirstLetter(user.status)}</TableCell>
                  {isSuperAdmin && <TableCell>{companies?.find(c => c.id === user.company_id)?.name ?? "N/A"}</TableCell>}
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleEditUserClick(user)}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    {(isSuperAdmin || (isCompanyAdmin && user.role === 'user')) && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteUserClick(user)}
                        disabled={deleteUserMutation.isPending || currentUser?.id === user.user_id} // Disable if deleting self
                      >
                        {deleteUserMutation.isPending && userToDelete?.user_id === user.user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span className="sr-only">Delete User</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            {isSuperAdmin ? "All pending invitations across the platform." : "Pending invitations for your company."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations?.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>{capitalizeFirstLetter(invite.role)}</TableCell>
                  <TableCell>{new Date(invite.expires_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResendInviteClick(invite.id)}
                      disabled={resendingInvitationId === invite.id || deleteInvitationMutation.isPending}
                    >
                      {resendingInvitationId === invite.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-4 w-4" />
                      )}
                      <span className="sr-only">Resend Invite</span>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteInviteClick(invite)}
                      disabled={resendingInvitationId === invite.id || deleteInvitationMutation.isPending}
                    >
                      {deleteInvitationMutation.isPending && invitationToDelete?.id === invite.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span className="sr-only">Delete Invite</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {userToEdit && (
        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
          <EditUserDialog
            isOpen={isEditUserDialogOpen}
            onOpenChange={setIsEditUserDialogOpen}
            editingUser={userToEdit}
          />
        </Dialog>
      )}

      {/* Delete Invitation Confirmation Dialog */}
      <AlertDialog open={isDeleteInvitationDialogOpen} onOpenChange={setIsDeleteInvitationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the invitation for "{invitationToDelete?.email}".
              The invited user will no longer be able to use this invitation link to set up their account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInvitationMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteInvitation} disabled={deleteInvitationMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteInvitationMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteUserDialogOpen} onOpenChange={setIsDeleteUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user "{userToDelete?.full_name ?? userToDelete?.email}"
              and all their associated data.
              {currentUser?.id === userToDelete?.user_id && (
                <p className="text-red-500 font-semibold mt-2">You cannot delete your own account.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUserMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              disabled={deleteUserMutation.isPending || currentUser?.id === userToDelete?.user_id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UsersPage;