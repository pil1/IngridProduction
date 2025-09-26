"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs components
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Switch } from "@/components/ui/switch"; // Import Switch
import { useForm, Controller } from "react-hook-form"; // Import Controller
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";

const editUserSchema = z.object({
  first_name: z.string().min(1, "First name is required").nullable(),
  last_name: z.string().min(1, "Last name is required").nullable(),
  email: z.string().email("Invalid email address").optional(),
  role: z.string().min(1, "Role is required"),
  company_id: z.string().optional().nullable(),
  status: z.string().min(1, "Status is required"), // Added status to schema
});

export type EditUserFormValues = z.infer<typeof editUserSchema>;

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
}

interface Company {
  id: string;
  name: string;
}

interface Module {
  id: string;
  name: string;
  description: string;
  roles?: string[] | null; // Added roles to the interface
}

interface CompanyModule {
  id: string;
  company_id: string;
  module_id: string;
  is_enabled: boolean;
  is_locked_by_system?: boolean;
}

interface UserModule {
  id: string;
  user_id: string;
  module_id: string;
  is_enabled: boolean;
}

interface EditUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: Profile;
}

const EditUserDialog = ({ isOpen, onOpenChange, editingUser }: EditUserDialogProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile: currentUserProfile, user: currentUser, isLoading: isLoadingSession } = useSession(); // Get currentUser

  const isSuperAdmin = currentUserProfile?.role === 'super-admin';
  const currentCompanyId = currentUserProfile?.company_id;

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      first_name: editingUser.first_name,
      last_name: editingUser.last_name,
      email: editingUser.email,
      role: editingUser.role,
      company_id: editingUser.company_id,
      status: editingUser.status, // Initialize status
    },
  });

  // Reset form values when editingUser changes
  useEffect(() => {
    if (isOpen && editingUser) {
      form.reset({
        first_name: editingUser.first_name,
        last_name: editingUser.last_name,
        email: editingUser.email,
        role: editingUser.role,
        company_id: editingUser.company_id,
        status: editingUser.status, // Reset status
      });
    }
  }, [isOpen, editingUser, form]);

  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  const { data: companyModules, isLoading: isLoadingCompanyModules } = useQuery<CompanyModule[]>({
    queryKey: ["companyModulesForUserEdit", editingUser.company_id],
    queryFn: async () => {
      if (!editingUser.company_id) return [];
      const { data, error } = await supabase
        .from("company_modules")
        .select("id, company_id, module_id, is_enabled, is_locked_by_system") // Fetch all required fields
        .eq("company_id", editingUser.company_id)
        .eq("is_enabled", true); // Only show modules enabled for the company
      if (error) throw error;
      return data;
    },
    enabled: !!editingUser.company_id,
  });

  const { data: allModules, isLoading: isLoadingAllModules } = useQuery<Module[]>({
    queryKey: ["allModulesForUserEdit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("modules").select("id, name, description"); // Fetch basic module info
      if (error) throw error;
      return data;
    },
    enabled: !!editingUser.company_id, // Only fetch if the user has a company
  });

  const { data: userModules, isLoading: isLoadingUserModules } = useQuery<UserModule[]>({
    queryKey: ["userModules", editingUser.user_id],
    queryFn: async () => {
      if (!editingUser.user_id) return [];
      const { data, error } = await supabase
        .from("user_modules")
        .select("id, user_id, module_id, is_enabled") // Fetch all required fields
        .eq("user_id", editingUser.user_id);
      if (error) throw error;
      return data;
    },
    enabled: !!editingUser.user_id,
  });

  const updateUserMutation = useMutation({
    mutationFn: async (values: EditUserFormValues) => {
      if (!currentUserProfile || !currentUser) throw new Error("Current user profile or session not loaded.");

      let targetCompanyId = values.company_id;
      if (currentUserProfile.role === 'admin') {
        if (!currentCompanyId || values.company_id !== currentCompanyId) {
          throw new Error("Admins can only manage users within their own company.");
        }
        targetCompanyId = currentCompanyId;
      } else if (currentUserProfile.role === 'super-admin') {
        // Super-admins can update any company_id
      } else {
        throw new Error("Insufficient permissions to update user.");
      }

      const oldStatus = editingUser.status;
      const newStatus = values.status;

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: values.first_name,
          last_name: values.last_name,
          full_name: (values.first_name ?? '') + ' ' + (values.last_name ?? ''),
          role: values.role,
          company_id: targetCompanyId,
          status: newStatus, // Update status
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", editingUser.user_id);

      if (error) throw error;

      // Send notification if status changed
      if (oldStatus !== newStatus && editingUser.company_id) {
        const companyName = companies?.find(c => c.id === editingUser.company_id)?.name ?? 'Your Company';
        await supabase.functions.invoke('send-email', {
          body: {
            template_name: 'user_status_updated',
            recipient_email: currentUserProfile.email, // Send to the admin who performed the action
            template_variables: {
              admin_name: currentUserProfile.first_name ?? currentUserProfile.full_name ?? currentUserProfile.email,
              company_name: companyName,
              target_user_name: editingUser.full_name ?? `${editingUser.first_name} ${editingUser.last_name}`,
              target_user_email: editingUser.email,
              new_status: newStatus.charAt(0).toUpperCase() + newStatus.slice(1),
              performed_by_name: currentUserProfile.full_name ?? currentUserProfile.email,
              performed_by_email: currentUserProfile.email,
              users_link: `${window.location.origin}/users`,
              year: new Date().getFullYear(),
            },
          },
        });
      }

      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["userModules", editingUser.user_id] }); // Invalidate user modules
      toast({
        title: "User Updated",
        description: `Profile for ${editingUser.full_name ?? editingUser.email} has been updated.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error updating user",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const upsertUserModuleMutation = useMutation({
    mutationFn: async ({ moduleId, isEnabled }: { moduleId: string; isEnabled: boolean }) => {
      if (!editingUser.user_id || !editingUser.company_id || !currentUserProfile || !currentUser) throw new Error("User or company ID missing for module update, or current user profile not loaded.");

      const { error } = await supabase.functions.invoke('upsert-user-module', {
        body: {
          target_user_id: editingUser.user_id,
          target_user_role: editingUser.role,
          module_id: moduleId,
          company_id: editingUser.company_id,
          is_enabled: isEnabled,
        },
      });
      if (error) throw error;

      // Send notification for module access change
      const moduleName = allModules?.find(m => m.id === moduleId)?.name ?? 'Unknown Module';
      const companyName = companies?.find(c => c.id === editingUser.company_id)?.name ?? 'Your Company';
      const accessStatus = isEnabled ? 'Enabled' : 'Disabled';

      await supabase.functions.invoke('send-email', {
        body: {
          template_name: 'user_module_access_updated',
          recipient_email: currentUserProfile.email, // Send to the admin who performed the action
          template_variables: {
            admin_name: currentUserProfile.first_name ?? currentUserProfile.full_name ?? currentUserProfile.email,
            company_name: companyName,
            target_user_name: editingUser.full_name ?? `${editingUser.first_name} ${editingUser.last_name}`,
            target_user_email: editingUser.email,
            module_name: moduleName,
            access_status: accessStatus,
            performed_by_name: currentUserProfile.full_name ?? currentUserProfile.email,
            performed_by_email: currentUserProfile.email,
            users_link: `${window.location.origin}/users`,
            year: new Date().getFullYear(),
          },
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userModules", editingUser.user_id] });
      queryClient.invalidateQueries({ queryKey: ["userMenuPreferences", editingUser.user_id] }); // Invalidate menu for the edited user
      toast({ title: "User Module Updated", description: "User's module access has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error updating user module", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: EditUserFormValues) => {
    updateUserMutation.mutate(values);
  };

  const handleModuleToggle = (moduleId: string, isChecked: boolean) => {
    upsertUserModuleMutation.mutate({ moduleId, isEnabled: isChecked });
  };

  const isLoading = isLoadingSession || updateUserMutation.isPending || (isSuperAdmin && isLoadingCompanies) || isLoadingCompanyModules || isLoadingAllModules || isLoadingUserModules || upsertUserModuleMutation.isPending;

  const modulesForUserManagement = allModules?.filter(module => {
    const isCompanyEnabled = companyModules?.some((cm: CompanyModule) => cm.module_id === module.id && cm.is_enabled);
    const roleMatches = !module.roles || module.roles.length === 0 || module.roles.includes(editingUser.role);
    return isCompanyEnabled && roleMatches;
  }).map(module => {
    const userModuleSetting = userModules?.find((um: UserModule) => um.module_id === module.id);
    const companyModuleSetting = companyModules?.find((cm) => cm.module_id === module.id);

    let isEnabledForUser;
    if (userModuleSetting) {
      isEnabledForUser = userModuleSetting.is_enabled;
    } else {
      // Default based on role if no specific user setting exists
      isEnabledForUser = editingUser.role === 'admin' || editingUser.role === 'controller';
    }

    return {
      ...module,
      is_enabled_for_user: isEnabledForUser,
      is_locked: companyModuleSetting?.is_locked_by_system ?? false,
    };
  });

  // Determine if the status toggle should be disabled
  const isStatusToggleDisabled = isLoading || (currentUserProfile?.user_id === editingUser.user_id);

  return (
    <DialogContent variant="full-width">
      <DialogHeader>
        <DialogTitle>Edit User: {editingUser.full_name ?? editingUser.email}</DialogTitle>
        <DialogDescription>
          Update the profile details and module access for this user.
        </DialogDescription>
      </DialogHeader>
      <Tabs defaultValue="profile" className="grid gap-4 py-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="modules" disabled={!editingUser.company_id}>Module Access</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="first_name" className="text-right">
                First Name
              </Label>
              <Input
                id="first_name"
                {...form.register("first_name")}
                className="col-span-3"
                disabled={isLoading}
              />
              {form.formState.errors.first_name && (
                <p className="col-span-4 text-right text-sm text-destructive">
                  {form.formState.errors.first_name.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="last_name" className="text-right">
                Last Name
              </Label>
              <Input
                id="last_name"
                {...form.register("last_name")}
                className="col-span-3"
                disabled={isLoading}
              />
              {form.formState.errors.last_name && (
                <p className="col-span-4 text-right text-sm text-destructive">
                  {form.formState.errors.last_name.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={editingUser.email}
                className="col-span-3"
                readOnly
                disabled
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select
                onValueChange={(value) => form.setValue("role", value)}
                value={form.watch("role")}
                disabled={isLoading || (currentUserProfile?.user_id === editingUser.user_id)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="controller">Controller</SelectItem>
                  {isSuperAdmin && <SelectItem value="super-admin">Super Admin</SelectItem>}
                </SelectContent>
              </Select>
              {form.formState.errors.role && (
                <p className="col-span-4 text-right text-sm text-destructive">
                  {form.formState.errors.role.message}
                </p>
              )}
            </div>
            {isSuperAdmin && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company_id" className="text-right">
                  Company
                </Label>
                <Select
                  onValueChange={(value) => form.setValue("company_id", value)}
                  value={form.watch("company_id") ?? ""}
                  disabled={isLoading}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.company_id && (
                  <p className="col-span-4 text-right text-sm text-destructive">
                    {form.formState.errors.company_id.message}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Active
              </Label>
              <Controller
                name="status"
                control={form.control}
                render={({ field }) => (
                  <Switch
                    id="status"
                    checked={field.value === 'active'}
                    onCheckedChange={(checked) => field.onChange(checked ? 'active' : 'inactive')}
                    className="col-span-3"
                    disabled={isStatusToggleDisabled}
                  />
                )}
              />
              {form.formState.errors.status && (
                <p className="col-span-4 text-right text-sm text-destructive">
                  {form.formState.errors.status.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading && (updateUserMutation.isPending) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="modules">
          {!editingUser.company_id ? (
            <p className="text-muted-foreground text-center py-8">This user is not assigned to a company. Assign a company to manage modules.</p>
          ) : (
            <div className="grid gap-4">
              {isLoadingCompanyModules || isLoadingAllModules || isLoadingUserModules ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading modules...
                </div>
              ) : (
                modulesForUserManagement?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No modules available for this user's role or company.</p>
                ) : (
                  modulesForUserManagement?.map((module) => (
                    <div key={module.id} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                      <div>
                        <Label htmlFor={`module-${module.id}`} className="font-medium">{module.name}</Label>
                        <p className="text-sm text-muted-foreground">{module.description}</p>
                      </div>
                      <Checkbox
                        id={`module-${module.id}`}
                        checked={module.is_enabled_for_user}
                        onCheckedChange={(checked) => handleModuleToggle(module.id, checked as boolean)}
                        disabled={
                          isLoading || 
                          upsertUserModuleMutation.isPending ||
                          (!isSuperAdmin && module.is_locked)
                        }
                      />
                    </div>
                  ))
                )
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
};

export default EditUserDialog;