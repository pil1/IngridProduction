"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/SessionContextProvider";
import { Loader2, ChevronDown, User } from "lucide-react"; // Import User icon
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AvatarUpload from "@/components/AvatarUpload";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const profileSettingsSchema = z.object({
  first_name: z.string().min(1, "First name is required").optional().nullable(),
  last_name: z.string().min(1, "Last name is required").optional().nullable(),
  avatar_file: z.any().optional().nullable(),
});

type ProfileSettingsFormValues = z.infer<typeof profileSettingsSchema>;

const SettingsPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, user, isLoading: isLoadingSession } = useSession();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const form = useForm<ProfileSettingsFormValues>({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: {
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      avatar_file: null,
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        avatar_file: null,
      });
    }
  }, [profile, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileSettingsFormValues) => {
      if (!user?.id) throw new Error("User not authenticated.");
      let avatarUrl = profile?.avatar_url;
      if (avatarFile) {
        const fileExtension = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar.${fileExtension}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        // Append a timestamp for cache busting
        avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      } else if (avatarFile === null && profile?.avatar_url) {
        const oldFilePath = profile.avatar_url.split('/public/avatars/')[1]?.split('?')[0]; // Remove query params for deletion
        if (oldFilePath) {
          await supabase.storage.from('avatars').remove([oldFilePath]);
        }
        avatarUrl = null;
      }
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          first_name: values.first_name,
          last_name: values.last_name,
          full_name: (values.first_name || '') + ' ' + (values.last_name || ''),
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (updateError) throw updateError;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userMenuPreferences", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast({ title: "Profile Updated", description: "Your profile settings have been successfully saved." });
      setAvatarFile(null); // Clear the temporary file from state
    },
    onError: (error: any) => {
      toast({ title: "Error updating profile", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    },
  });

  const onSubmit = (values: ProfileSettingsFormValues) => {
    updateProfileMutation.mutate(values);
  };

  if (isLoadingSession) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading settings...</p>
      </div>
    );
  }

  return (
    <>
      <Collapsible defaultOpen={true} asChild>
        <Card>
          <CollapsibleTrigger asChild>
            <div className="flex w-full cursor-pointer items-center justify-between p-6 data-[state=open]:border-b">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" /> Profile Settings
                </CardTitle>
                <CardDescription>Manage your personal profile information.</CardDescription>
              </div>
              <ChevronDown className="h-5 w-5 transition-transform duration-300 data-[state=open]:rotate-180" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
                <div className="flex flex-col items-center gap-4">
                  <AvatarUpload
                    currentAvatarUrl={profile?.avatar_url}
                    onFileSelected={setAvatarFile}
                    isLoading={updateProfileMutation.isPending}
                    disabled={updateProfileMutation.isPending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input id="first_name" {...form.register("first_name")} disabled={updateProfileMutation.isPending} />
                  {form.formState.errors.first_name && <p className="text-sm text-destructive">{form.formState.errors.first_name.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input id="last_name" {...form.register("last_name")} disabled={updateProfileMutation.isPending} />
                  {form.formState.errors.last_name && <p className="text-sm text-destructive">{form.formState.errors.last_name.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={profile?.email || ""} readOnly />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" value={profile?.role || ""} readOnly />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">Company ID</Label>
                  <Input id="company" value={profile?.company_id || "N/A"} readOnly />
                </div>
                <Button type="submit" disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Profile
                </Button>
              </form>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>Manage your account preferences.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Button variant="outline" disabled>Change Password</Button>
          </div>
          <Separator />
          <div className="grid gap-2">
            <Label htmlFor="deleteAccount" className="text-destructive">Delete Account</Label>
            <Button variant="destructive" disabled>Delete My Account</Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default SettingsPage;