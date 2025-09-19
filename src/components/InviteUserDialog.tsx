"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";

const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  role: z.string().min(1, "Role is required"),
  company_id: z.string().optional().nullable(), // Optional for super-admins
  selectedTemplateName: z.string().optional().nullable(), // New field for template selection
});

type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

interface Company {
  id: string;
  name: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
}

interface InviteUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const InviteUserDialog = ({ isOpen, onOpenChange }: InviteUserDialogProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const isSuperAdmin = profile?.role === 'super-admin';
  const currentCompanyId = profile?.company_id;

  const form = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      role: "user",
      company_id: isSuperAdmin ? undefined : currentCompanyId ?? undefined, // Default to current company for admins
      selectedTemplateName: "user_invitation", // Default to the standard user invitation template
    },
  });

  // Reset form values when dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset({
        email: "",
        role: "user",
        company_id: isSuperAdmin ? undefined : currentCompanyId ?? undefined,
        selectedTemplateName: "user_invitation", // Reset to default template
      });
    }
  }, [isOpen, form, isSuperAdmin, currentCompanyId]);

  const { data: companies, isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ["companiesForInvite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin, // Only fetch companies if current user is super-admin
  });

  // Fetch system-wide email templates (for Super Admins)
  const { data: systemTemplates, isLoading: isLoadingSystemTemplates } = useQuery<EmailTemplate[]>({
    queryKey: ["systemEmailTemplatesForInvite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_templates").select("id, name, subject").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  // Fetch company-specific email templates (for Admins)
  const { data: companyTemplates, isLoading: isLoadingCompanyTemplates } = useQuery<EmailTemplate[]>({
    queryKey: ["companyEmailTemplatesForInvite", currentCompanyId],
    queryFn: async () => {
      if (!currentCompanyId) return [];
      const { data, error } = await supabase.from("company_email_templates").select("id, name, subject").eq("company_id", currentCompanyId).order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !isSuperAdmin && !!currentCompanyId,
  });

  // Combine and deduplicate templates for the dropdown
  const availableTemplates = (isSuperAdmin ? systemTemplates : companyTemplates) ?? [];
  const uniqueTemplates = Array.from(new Map(availableTemplates.map(template => [template.name, template])).values());


  const inviteUserMutation = useMutation({
    mutationFn: async (values: InviteUserFormValues) => {
      const payload = isSuperAdmin
        ? { ...values, template_name: values.selectedTemplateName }
        : { ...values, company_id: currentCompanyId, template_name: values.selectedTemplateName }; // Force current company for admins

      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] }); // Invalidate invitations list
      // NEW: Invalidate the Super Admin's own profile to ensure it's refetched
      if (profile?.user_id) {
        queryClient.invalidateQueries({ queryKey: ["profiles", profile.user_id] });
      }
      toast({
        title: "Invitation Sent",
        description: `An invitation has been sent to ${form.getValues("email")}.`,
      });
      console.log("Invitation Link:", data.invitationLink); // Log the invitation link for super-admin
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error Sending Invitation",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: InviteUserFormValues) => {
    inviteUserMutation.mutate(values);
  };

  const isLoading = isLoadingSession || inviteUserMutation.isPending || (isSuperAdmin && isLoadingCompanies) || isLoadingSystemTemplates || isLoadingCompanyTemplates;

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Invite New User</DialogTitle>
        <DialogDescription>
          Send an email invitation to a new user to join your company.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="email" className="text-right">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            {...form.register("email")}
            className="col-span-3"
            disabled={isLoading}
          />
          {form.formState.errors.email && (
            <p className="col-span-4 text-right text-sm text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="role" className="text-right">
            Role
          </Label>
          <Select
            onValueChange={(value) => form.setValue("role", value)}
            value={form.watch("role")}
            disabled={isLoading}
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
              disabled={isLoading || isLoadingCompanies}
            >
              <SelectTrigger className="col-span-3">
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
            {form.formState.errors.company_id && (
              <p className="col-span-4 text-right text-sm text-destructive">
                {form.formState.errors.company_id.message}
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="selectedTemplateName" className="text-right">
            Email Template
          </Label>
          <Select
            onValueChange={(value) => form.setValue("selectedTemplateName", value)}
            value={form.watch("selectedTemplateName") ?? ""}
            disabled={isLoading}
          >
            <SelectTrigger className="col-span-3">
              <SelectValue placeholder="Select an email template" />
            </SelectTrigger>
            <SelectContent>
              {uniqueTemplates.length === 0 ? (
                <SelectItem value="__no_templates__" disabled>No templates available</SelectItem>
              ) : (
                uniqueTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.name}>
                    {template.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {form.formState.errors.selectedTemplateName && (
            <p className="col-span-4 text-right text-sm text-destructive">
              {form.formState.errors.selectedTemplateName.message}
            </p>
          )}
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send Invitation
        </Button>
      </form>
    </DialogContent>
  );
};

export default InviteUserDialog;