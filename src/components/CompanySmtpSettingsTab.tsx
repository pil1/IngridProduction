"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";

const smtpSettingsSchema = z.object({
  sender_email: z.string().email("Invalid email address").min(1, "Sender email is required"),
  smtp_host: z.string().optional().nullable(),
  smtp_port: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().positive("Port must be a positive integer").nullable().optional()
  ),
  smtp_username: z.string().optional().nullable(),
  smtp_password: z.string().optional().nullable(),
  email_api_key: z.string().optional().nullable(),
});

type SmtpSettingsFormValues = z.infer<typeof smtpSettingsSchema>;

interface CompanySmtpSettingsTabProps {
  companyId: string; // Add companyId prop
}

const CompanySmtpSettingsTab = ({ companyId }: CompanySmtpSettingsTabProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const userRole = profile?.role;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["companySmtpSettings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase.from("company_smtp_settings").select("*").eq("company_id", companyId).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!companyId && !isLoadingSession,
  });

  const form = useForm<SmtpSettingsFormValues>({
    resolver: zodResolver(smtpSettingsSchema),
    defaultValues: { sender_email: "", smtp_host: "", smtp_port: undefined, smtp_username: "", smtp_password: "", email_api_key: "" },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        sender_email: settings.sender_email,
        smtp_host: settings.smtp_host ?? "",
        smtp_port: settings.smtp_port ?? undefined,
        smtp_username: settings.smtp_username ?? "",
        smtp_password: "",
        email_api_key: "",
      });
    }
  }, [settings, form]);

  const upsertSettingsMutation = useMutation({
    mutationFn: async (values: SmtpSettingsFormValues) => {
      if (!companyId) throw new Error("Company not identified.");

      // Authorization check: Admins can only manage settings for their own company
      if (userRole === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only manage SMTP settings for your own company.");
      }

      const { error } = await supabase.functions.invoke('upsert-company-smtp-settings', {
        body: { ...values, company_id: companyId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySmtpSettings", companyId] });
      toast({ title: "Settings Saved", description: "Your company's email settings have been updated." });
      form.setValue("smtp_password", "");
      form.setValue("email_api_key", "");
    },
    onError: (error: Error) => {
      toast({ title: "Error Saving Settings", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: SmtpSettingsFormValues) => {
    upsertSettingsMutation.mutate(values);
  };

  const canManageSmtp = userRole && (
    userRole === 'super-admin' ||
    (userRole === 'admin' && companyId === profile?.company_id)
  );

  if (isLoadingSession || isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!canManageSmtp) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: You do not have permission to manage these SMTP settings.</p>
      </div>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Company SMTP Settings</CardTitle>
        <CardDescription>
          Configure your company's own SMTP server or email service API key. If left blank, the system default will be used.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="sender_email">Sender Email Address</Label>
            <Input id="sender_email" type="email" {...form.register("sender_email")} disabled={upsertSettingsMutation.isPending} />
            {form.formState.errors.sender_email && <p className="text-sm text-destructive">{form.formState.errors.sender_email.message}</p>}
          </div>
          <h3 className="text-lg font-semibold mt-4">SMTP Credentials (Optional)</h3>
          <div className="grid gap-2">
            <Label htmlFor="smtp_host">SMTP Host</Label>
            <Input id="smtp_host" {...form.register("smtp_host")} disabled={upsertSettingsMutation.isPending} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="smtp_port">SMTP Port</Label>
            <Input id="smtp_port" type="number" {...form.register("smtp_port")} disabled={upsertSettingsMutation.isPending} />
            {form.formState.errors.smtp_port && <p className="text-sm text-destructive">{form.formState.errors.smtp_port.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="smtp_username">SMTP Username</Label>
            <Input id="smtp_username" {...form.register("smtp_username")} disabled={upsertSettingsMutation.isPending} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="smtp_password">SMTP Password (will not be displayed)</Label>
            <Input id="smtp_password" type="password" {...form.register("smtp_password")} disabled={upsertSettingsMutation.isPending} />
          </div>
          <h3 className="text-lg font-semibold mt-4">Email API Key (Optional)</h3>
          <div className="grid gap-2">
            <Label htmlFor="email_api_key">Email API Key (will not be displayed)</Label>
            <Input id="email_api_key" type="password" {...form.register("email_api_key")} disabled={upsertSettingsMutation.isPending} />
          </div>
          <Button type="submit" disabled={upsertSettingsMutation.isPending} className="mt-4">
            {upsertSettingsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CompanySmtpSettingsTab;