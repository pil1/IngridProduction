/**
 * Create User Dialog Component
 *
 * Comprehensive dialog for creating new users with role assignment
 * and initial permissions configuration.
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  User,
  Mail,
  Shield,
  Building2,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { UserRole } from '@/types/permissions';
import { useSystemModules, useCompanyModules } from '@/hooks/useEnhancedPermissions';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated?: (user: any) => void;
}

interface CreateUserForm {
  email: string;
  full_name: string;
  role: UserRole;
  company_id: string;
  send_invitation: boolean;
  welcome_message: string;
  modules: string[];
}

const roleDescriptions = {
  'user': 'Regular user with basic access to assigned modules',
  'admin': 'Company administrator with management capabilities',
  'super-admin': 'System administrator with full access (Super Admin only)',
};

export const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
  open,
  onOpenChange,
  onUserCreated,
}) => {
  const { profile } = useSession();
  const queryClient = useQueryClient();
  const { data: modules } = useSystemModules();

  const [form, setForm] = useState<CreateUserForm>({
    email: '',
    full_name: '',
    role: 'user',
    company_id: profile?.company_id || '',
    send_invitation: true,
    welcome_message: '',
    modules: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch companies (for super-admins)
  const { data: companies } = useCompanyModules(form.company_id);

  // Create user mutation
  const createUser = useMutation({
    mutationFn: async (userData: CreateUserForm) => {
      // Validate form
      const newErrors: Record<string, string> = {};

      if (!userData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
        newErrors.email = 'Invalid email format';
      }

      if (!userData.full_name.trim()) {
        newErrors.full_name = 'Full name is required';
      }

      if (!userData.company_id && profile?.role !== 'super-admin') {
        newErrors.company_id = 'Company is required';
      }

      // Super-admin role restriction
      if (userData.role === 'super-admin' && profile?.role !== 'super-admin') {
        newErrors.role = 'Only Super Admins can create Super Admin users';
      }

      setErrors(newErrors);

      if (Object.keys(newErrors).length > 0) {
        throw new Error('Validation failed');
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('user_id, email')
        .eq('email', userData.email.toLowerCase())
        .single();

      if (existingUser) {
        throw new Error('A user with this email already exists');
      }

      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email.toLowerCase(),
        email_confirm: !userData.send_invitation, // Auto-confirm if not sending invitation
        user_metadata: {
          full_name: userData.full_name,
          role: userData.role,
          company_id: userData.company_id,
        },
      });

      if (authError) throw authError;

      if (!authUser.user) {
        throw new Error('Failed to create user');
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authUser.user.id,
          email: userData.email.toLowerCase(),
          full_name: userData.full_name,
          role: userData.role,
          company_id: userData.company_id,
        });

      if (profileError) throw profileError;

      // Assign modules if specified
      if (userData.modules.length > 0) {
        const moduleAssignments = userData.modules.map(moduleId => ({
          user_id: authUser.user!.id,
          module_id: moduleId,
          company_id: userData.company_id,
          is_enabled: true,
          granted_by: profile?.user_id,
        }));

        const { error: moduleError } = await supabase
          .from('user_modules')
          .insert(moduleAssignments);

        if (moduleError) {
          console.warn('Failed to assign modules:', moduleError);
        }
      }

      // Send invitation email if requested
      if (userData.send_invitation) {
        const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
          userData.email.toLowerCase(),
          {
            data: {
              full_name: userData.full_name,
              role: userData.role,
              company_id: userData.company_id,
              welcome_message: userData.welcome_message,
            },
          }
        );

        if (inviteError) {
          console.warn('Failed to send invitation:', inviteError);
        }
      }

      return {
        user: authUser.user,
        profile: {
          user_id: authUser.user.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
          company_id: userData.company_id,
        },
      };
    },
    onSuccess: (data) => {
      // Reset form
      setForm({
        email: '',
        full_name: '',
        role: 'user',
        company_id: profile?.company_id || '',
        send_invitation: true,
        welcome_message: '',
        modules: [],
      });
      setErrors({});

      // Refresh user list
      queryClient.invalidateQueries({ queryKey: ['usersWithPermissions'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });

      // Notify parent component
      onUserCreated?.(data);

      // Close dialog
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate(form);
  };

  const handleModuleToggle = (moduleId: string, enabled: boolean) => {
    setForm(prev => ({
      ...prev,
      modules: enabled
        ? [...prev.modules, moduleId]
        : prev.modules.filter(id => id !== moduleId),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Create New User
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-medium">Basic Information</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10"
                    placeholder="user@company.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="John Doe"
                />
                {errors.full_name && (
                  <p className="text-sm text-red-600">{errors.full_name}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">User Role *</Label>
                <Select value={form.role} onValueChange={(value: UserRole) => setForm(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        User
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Admin
                      </div>
                    </SelectItem>
                    {profile?.role === 'super-admin' && (
                      <SelectItem value="super-admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-red-500" />
                          Super Admin
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {roleDescriptions[form.role]}
                </p>
                {errors.role && (
                  <p className="text-sm text-red-600">{errors.role}</p>
                )}
              </div>

              {profile?.role === 'super-admin' && (
                <div className="space-y-2">
                  <Label htmlFor="company_id">Company</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="company_id"
                      value={form.company_id}
                      onChange={(e) => setForm(prev => ({ ...prev, company_id: e.target.value }))}
                      className="pl-10"
                      placeholder="Company ID"
                    />
                  </div>
                  {errors.company_id && (
                    <p className="text-sm text-red-600">{errors.company_id}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Module Access */}
          {modules && modules.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium">Module Access</h4>
              <div className="grid grid-cols-2 gap-3">
                {modules.map((module) => (
                  <div key={module.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{module.name}</div>
                      <div className="text-sm text-gray-500">
                        <Badge variant="outline">{module.module_type}</Badge>
                      </div>
                    </div>
                    <Switch
                      checked={form.modules.includes(module.id)}
                      onCheckedChange={(checked) => handleModuleToggle(module.id, checked)}
                      disabled={module.is_core_required}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invitation Settings */}
          <div className="space-y-4">
            <h4 className="font-medium">Invitation Settings</h4>

            <div className="flex items-center justify-between p-3 border rounded">
              <div>
                <div className="font-medium">Send Welcome Email</div>
                <div className="text-sm text-gray-500">
                  Send an invitation email to the new user
                </div>
              </div>
              <Switch
                checked={form.send_invitation}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, send_invitation: checked }))}
              />
            </div>

            {form.send_invitation && (
              <div className="space-y-2">
                <Label htmlFor="welcome_message">Welcome Message (Optional)</Label>
                <Textarea
                  id="welcome_message"
                  value={form.welcome_message}
                  onChange={(e) => setForm(prev => ({ ...prev, welcome_message: e.target.value }))}
                  placeholder="Welcome to our team! We're excited to have you aboard."
                  rows={3}
                />
              </div>
            )}
          </div>

          {/* Error Display */}
          {createUser.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {createUser.error.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Display */}
          {createUser.isSuccess && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                User created successfully!
                {form.send_invitation && ' An invitation email has been sent.'}
              </AlertDescription>
            </Alert>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createUser.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={createUser.isPending}
          >
            {createUser.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating User...
              </>
            ) : (
              'Create User'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};