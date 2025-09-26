"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/SessionContextProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Building, Phone, Save, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AvatarUpload from '@/components/AvatarUpload';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  phone: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface Company {
  id: string;
  name: string;
  description: string;
}

export default function NewCompleteProfilePage() {
  const { user, profile, isLoading: isSessionLoading } = useSession();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      phone: '',
    },
  });

  // All users are pre-created with company assignments
  // Fetch the user's assigned company
  const { data: invitedCompany } = useQuery<Company>({
    queryKey: ['user-company', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) throw new Error('No company ID');

      const { data, error } = await supabase
        .from('companies')
        .select('id, name, description')
        .eq('id', profile.company_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  // Pre-fill form if profile exists
  useEffect(() => {
    if (profile) {
      form.reset({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile, form]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isSessionLoading && !user) {
      navigate('/auth');
    }
  }, [user, isSessionLoading, navigate]);

  // SUPERADMIN BYPASS - Check email directly
  useEffect(() => {
    if (user?.email === 'admin@infotrac.com') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Redirect super-admins immediately by role - they don't need profile completion
  useEffect(() => {
    if (profile && profile.role === 'super-admin') {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  // Redirect if profile is already complete (for regular users and admins)
  useEffect(() => {
    if (profile && profile.full_name && profile.company_id && profile.role !== 'super-admin') {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (!profile) throw new Error('Profile not found');

      let avatarUrl = profile?.avatar_url;

      // Upload avatar if provided
      if (avatarFile) {
        const fileExtension = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      }

      // Update existing profile (users are pre-created so they always have existing profiles)
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone || null,
          avatar_url: avatarUrl,
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        // Handle PGRST204 case
        if (error.code === 'PGRST204') {
          const { data: verifyData, error: verifyError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (!verifyError && verifyData) {
            return verifyData;
          }
        }
        throw error;
      }

      return updatedProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({
        title: "Profile Complete!",
        description: "Welcome to INFOtrac. Redirecting to your dashboard...",
      });

      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Profile Setup Failed",
        description: error.message || "Failed to complete profile setup",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ProfileFormData) => {
    profileMutation.mutate(data);
  };

  const isLoading = profileMutation.isPending;
  const isSuccess = profileMutation.isSuccess;


  if (isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Prevent rendering for super-admins (they will be redirected)
  if (profile?.role === 'super-admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Welcome to INFOtrac!</CardTitle>
            <CardDescription>
              Your profile has been successfully completed. Redirecting to your dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle>Complete Your Profile</CardTitle>
          <CardDescription>
            Your account has been created by your administrator. Please complete your personal information to get started with INFOtrac
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Avatar Upload */}
            <div className="flex justify-center">
              <AvatarUpload
                currentAvatarUrl={profile?.avatar_url}
                onFileSelected={setAvatarFile}
                isLoading={isLoading}
                disabled={isLoading}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Full Name *
                </Label>
                <Input
                  id="full_name"
                  {...form.register('full_name')}
                  placeholder="Enter your full name"
                  disabled={isLoading}
                />
                {form.formState.errors.full_name && (
                  <p className="text-sm text-red-600">{form.formState.errors.full_name.message}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone (Optional)
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  {...form.register('phone')}
                  placeholder="Enter your phone number"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Company Section - Always show pre-populated data since all users are created by admins */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2 text-base font-semibold">
                <Building className="w-4 h-4" />
                Your Account Information
              </Label>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Your account has been created with the following details:</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Company:</span>
                    <div className="mt-1">
                      <span className="font-semibold text-gray-900">{invitedCompany?.name || 'Loading...'}</span>
                      {invitedCompany?.description && (
                        <p className="text-sm text-gray-600 mt-1">{invitedCompany.description}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Role:</span>
                    <div className="mt-1">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        {profile?.role === 'admin' ? 'Administrator' :
                         profile?.role === 'user' ? 'Team Member' :
                         'Loading...'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Email:</span>
                    <div className="mt-1">
                      <span className="text-gray-900">{user?.email}</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-3 p-2 bg-gray-50 rounded">
                  <strong>Note:</strong> Your company and role assignments were set by your administrator.
                  If you need any changes, please contact your administrator.
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Profile...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Complete Profile
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}