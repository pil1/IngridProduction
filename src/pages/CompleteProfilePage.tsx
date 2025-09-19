"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/components/SessionContextProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import AvatarUpload from "@/components/AvatarUpload";

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  avatar_file: z.any().optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const CompleteProfilePage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, profile, isLoading: isLoadingSession } = useSession();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: profile?.first_name ?? "",
      last_name: profile?.last_name ?? "",
      avatar_file: null,
    },
  });

  // Update form defaults when profile loads or changes
  useEffect(() => {
    if (profile) {
      form.reset({
        first_name: profile.first_name ?? "",
        last_name: profile.last_name ?? "",
        avatar_file: null,
      });
    }
  }, [profile, form]);

  // Redirect if profile is already complete OR if it's an admin (who should use /onboarding)
  useEffect(() => {
    if (!isLoadingSession && profile) {
      if (profile.first_name && profile.last_name) {
        // If profile is complete, redirect to dashboard based on role
        if (profile.role === 'super-admin') {
          navigate('/super-admin-dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else if (profile.role === 'admin' && profile.company_id) {
        // If admin and profile incomplete, redirect to new onboarding flow
        navigate('/onboarding', { replace: true });
      }
    }
  }, [profile, isLoadingSession, navigate]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!user?.id) throw new Error("User not authenticated.");

      let avatarUrl = profile?.avatar_url;

      // 1. Handle avatar file upload if a new one is selected
      if (avatarFile) {
        const fileExtension = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, {
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        // Append a timestamp for cache busting
        avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      } else if (avatarFile === null && profile?.avatar_url) {
        // If avatarFile is explicitly set to null (cleared by user) and there was a previous avatar
        const oldFilePath = profile.avatar_url.split('/public/avatars/')[1]?.split('?')[0]; // Remove query params for deletion
        if (oldFilePath) {
          await supabase.storage.from('avatars').remove([oldFilePath]);
        }
        avatarUrl = null;
      }

      // 2. Update profile in the database
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
      queryClient.invalidateQueries({ queryKey: ["profiles"] }); // Invalidate to refresh profile data in session context
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully completed.",
      });
      setAvatarFile(null); // Clear the temporary file from state
      // Redirect to dashboard after profile completion
      if (profile?.role === 'super-admin') {
        navigate('/super-admin-dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error completing profile",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    updateProfileMutation.mutate(values);
  };

  if (isLoadingSession) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading profile...</p>
      </div>
    );
  }

  // If user is not authenticated, redirect to login
  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <div className="flex justify-center mb-6">
          <img src="/infotrac-logo.png" alt="INFOtrac Logo" className="h-16 w-auto object-contain" />
        </div>
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
          Complete Your Profile
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
            <CardDescription>Please provide your first name, last name, and an optional avatar.</CardDescription>
          </CardHeader>
          <CardContent>
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
                <Input
                  id="first_name"
                  {...form.register("first_name")}
                  disabled={updateProfileMutation.isPending}
                />
                {form.formState.errors.first_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.first_name.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  {...form.register("last_name")}
                  disabled={updateProfileMutation.isPending}
                />
                {form.formState.errors.last_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.last_name.message}</p>
                )}
              </div>
              <Button type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Profile
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompleteProfilePage;