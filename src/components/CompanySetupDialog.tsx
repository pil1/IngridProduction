"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";

// Define the schema for company creation and initial admin invitation
const companySetupSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyDomain: z.string().optional(),
  subscriptionTier: z.string().default("basic"),
  defaultCurrency: z.string().default("USD"),
  adminEmail: z.string().email("Invalid email address for admin"),
  adminFullName: z.string().optional(),
  adminRole: z.string().default("admin"),
});

type CompanySetupFormValues = z.infer<typeof companySetupSchema>;

interface CompanySetupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const CompanySetupDialog = ({ isOpen, onOpenChange }: CompanySetupDialogProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser, profile } = useSession();

  const form = useForm<CompanySetupFormValues>({
    resolver: zodResolver(companySetupSchema),
    defaultValues: {
      companyName: "",
      companyDomain: "",
      subscriptionTier: "basic",
      defaultCurrency: "USD",
      adminEmail: "",
      adminFullName: "",
      adminRole: "admin",
    },
  });

  const createCompanyAndInviteAdminMutation = useMutation({
    mutationFn: async (values: CompanySetupFormValues) => {
      if (profile?.role !== 'super-admin') {
        throw new Error("Only super-admins can perform this action.");
      }
      if (!currentUser?.id) {
        throw new Error("Current user ID is missing.");
      }

      // 1. Create the company
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .insert({
          name: values.companyName,
          domain: values.companyDomain,
          subscription_tier: values.subscriptionTier,
          default_currency: values.defaultCurrency,
        })
        .select()
        .single();

      if (companyError) throw companyError;
      if (!companyData) throw new Error("Failed to create company.");

      // 2. Invite the initial admin for this company
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      const { data: invitationData, error: invitationError } = await supabase
        .from("invitations")
        .insert({
          company_id: companyData.id,
          email: values.adminEmail,
          role: values.adminRole,
          invited_by: currentUser.id,
          token: token,
        })
        .select()
        .single();

      if (invitationError) throw invitationError;

      return { company: companyData, invitation: invitationData };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["companyInvitations"] });
      toast({
        title: "Company Setup Complete",
        description: `Company "${data.company.name}" created and admin invitation sent to ${data.invitation.email}.`,
      });
      onOpenChange(false); // Close dialog on success
      form.reset();
      console.log(`Admin Invitation Link for ${data.invitation.email}: ${window.location.origin}/accept-invite?token=${data.invitation.token}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error during company setup",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: CompanySetupFormValues) => {
    createCompanyAndInviteAdminMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Set Up New Company & Admin</DialogTitle>
          <DialogDescription>
            Create a new company and invite its first administrator.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  {...form.register("companyName")}
                />
                {form.formState.errors.companyName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.companyName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyDomain">Company Domain (Optional)</Label>
                <Input
                  id="companyDomain"
                  {...form.register("companyDomain")}
                />
                {form.formState.errors.companyDomain && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.companyDomain.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionTier">Subscription Tier</Label>
                <Select
                  onValueChange={(value) => form.setValue("subscriptionTier", value)}
                  defaultValue={form.watch("subscriptionTier")}
                >
                  <SelectTrigger id="subscriptionTier">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.subscriptionTier && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.subscriptionTier.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultCurrency">Default Currency</Label>
                <Input
                  id="defaultCurrency"
                  {...form.register("defaultCurrency")}
                />
                {form.formState.errors.defaultCurrency && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.defaultCurrency.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Initial Admin Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Admin Email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  {...form.register("adminEmail")}
                />
                {form.formState.errors.adminEmail && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.adminEmail.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminFullName">Admin Full Name (Optional)</Label>
                <Input
                  id="adminFullName"
                  {...form.register("adminFullName")}
                />
                {form.formState.errors.adminFullName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.adminFullName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminRole">Admin Role</Label>
                <Select
                  onValueChange={(value) => form.setValue("adminRole", value)}
                  defaultValue={form.watch("adminRole")}
                  disabled
                >
                  <SelectTrigger id="adminRole">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.adminRole && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.adminRole.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={createCompanyAndInviteAdminMutation.isPending}>
            {createCompanyAndInviteAdminMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Set Up Company & Invite Admin
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CompanySetupDialog;