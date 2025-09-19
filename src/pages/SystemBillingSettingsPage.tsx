"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, CreditCard } from "lucide-react"; // Removed DollarSign, kept CreditCard
import { useSession } from "@/components/SessionContextProvider";

const systemBillingSettingsSchema = z.object({
  billing_currency_code: z.string().min(1, "Billing currency is required"),
});

type SystemBillingSettingsFormValues = z.infer<typeof systemBillingSettingsSchema>;

interface SystemBillingSettings {
  id: string;
  billing_currency_code: string;
  updated_at: string;
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

const SystemBillingSettingsPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const isSuperAdmin = profile?.role === 'super-admin';

  const { data: settings, isLoading: isLoadingSettings, isError: isErrorSettings } = useQuery<SystemBillingSettings | null>({
    queryKey: ["systemBillingSettings"],
    queryFn: async () => {
      if (!isSuperAdmin) return null;
      const { data, error } = await supabase.from("system_billing_settings").select("*").single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 means "no rows found"
      return data;
    },
    enabled: isSuperAdmin,
  });

  const { data: currencies, isLoading: isLoadingCurrencies } = useQuery<Currency[]>({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("currencies").select("id, code, name, symbol").eq("is_active", true).order("code");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<SystemBillingSettingsFormValues>({
    resolver: zodResolver(systemBillingSettingsSchema),
    defaultValues: {
      billing_currency_code: "USD", // Default to USD
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        billing_currency_code: settings.billing_currency_code,
      });
    }
  }, [settings, form]);

  const upsertSettingsMutation = useMutation({
    mutationFn: async (values: SystemBillingSettingsFormValues) => {
      if (!isSuperAdmin) throw new Error("Only Super Admins can configure system billing settings.");

      const { data, error } = await supabase.functions.invoke('upsert-system-billing-settings', {
        body: { billing_currency_code: values.billing_currency_code },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systemBillingSettings"] });
      toast({
        title: "Billing Settings Saved",
        description: "System billing currency has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Saving Settings",
        description: error.message ?? "An unexpected error occurred while saving system billing settings.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: SystemBillingSettingsFormValues) => {
    upsertSettingsMutation.mutate(values);
  };

  if (isLoadingSession || isLoadingSettings || isLoadingCurrencies) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading system billing settings...</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: Only Super Admins can manage system billing settings.</p>
      </div>
    );
  }

  if (isErrorSettings) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading system billing settings. Please try again.</p>
      </div>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" /> System Billing Settings
        </CardTitle>
        <CardDescription>
          Configure the default currency used for billing companies on the platform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="billing_currency_code">Default Billing Currency</Label>
            <Select
              onValueChange={(value) => form.setValue("billing_currency_code", value)}
              value={form.watch("billing_currency_code")}
              disabled={upsertSettingsMutation.isPending}
            >
              <SelectTrigger id="billing_currency_code">
                <SelectValue placeholder="Select default billing currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies?.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name} ({currency.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.billing_currency_code && (
              <p className="text-sm text-destructive">{form.formState.errors.billing_currency_code.message}</p>
            )}
          </div>

          <Button type="submit" disabled={upsertSettingsMutation.isPending} className="mt-4">
            {upsertSettingsMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SystemBillingSettingsPage;