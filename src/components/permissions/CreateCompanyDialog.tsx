/**
 * Create Company Dialog Component
 *
 * Enhanced company creation with admin onboarding workflow for Super Admins.
 * Replaces legacy company creation with comprehensive setup process.
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Shield,
  Settings,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Package,
  Users,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useSystemModules } from '@/hooks/useEnhancedPermissions';

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanyCreated?: (company: any) => void;
}

interface CompanyForm {
  // Company Details
  name: string;
  slug: string;
  description: string;
  industry: string;
  website: string;

  // Contact Information
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;

  // Billing & Subscription
  subscription_plan: 'starter' | 'professional' | 'enterprise';
  billing_cycle: 'monthly' | 'annual';

  // Admin User
  admin_email: string;
  admin_full_name: string;
  admin_phone: string;

  // Settings
  auto_create_admin: boolean;
  send_welcome_email: boolean;
  enabled_modules: string[];
  welcome_message: string;
}

const subscriptionPlans = {
  starter: {
    name: 'Starter',
    price: 29,
    users: 5,
    features: ['Basic expense tracking', 'Simple reporting', 'Email support'],
  },
  professional: {
    name: 'Professional',
    price: 79,
    users: 25,
    features: ['Advanced analytics', 'Custom workflows', 'Priority support', 'API access'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 199,
    users: 'Unlimited',
    features: ['All features', 'Custom integrations', 'Dedicated support', 'SLA'],
  },
};

const industries = [
  'Technology',
  'Healthcare',
  'Finance',
  'Manufacturing',
  'Retail',
  'Education',
  'Construction',
  'Professional Services',
  'Non-Profit',
  'Other',
];

export const CreateCompanyDialog: React.FC<CreateCompanyDialogProps> = ({
  open,
  onOpenChange,
  onCompanyCreated,
}) => {
  const { profile } = useSession();
  const queryClient = useQueryClient();
  const { data: modules } = useSystemModules();

  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<CompanyForm>({
    // Company Details
    name: '',
    slug: '',
    description: '',
    industry: '',
    website: '',

    // Contact Information
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
    phone: '',

    // Billing & Subscription
    subscription_plan: 'professional',
    billing_cycle: 'monthly',

    // Admin User
    admin_email: '',
    admin_full_name: '',
    admin_phone: '',

    // Settings
    auto_create_admin: true,
    send_welcome_email: true,
    enabled_modules: [],
    welcome_message: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-generate slug from company name
  React.useEffect(() => {
    if (form.name && !form.slug) {
      const slug = form.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setForm(prev => ({ ...prev, slug }));
    }
  }, [form.name]);

  // Create company mutation
  const createCompany = useMutation({
    mutationFn: async (companyData: CompanyForm) => {
      // Validate form
      const newErrors: Record<string, string> = {};

      if (!companyData.name.trim()) {
        newErrors.name = 'Company name is required';
      }

      if (!companyData.slug.trim()) {
        newErrors.slug = 'Company slug is required';
      }

      if (companyData.auto_create_admin) {
        if (!companyData.admin_email.trim()) {
          newErrors.admin_email = 'Admin email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyData.admin_email)) {
          newErrors.admin_email = 'Invalid email format';
        }

        if (!companyData.admin_full_name.trim()) {
          newErrors.admin_full_name = 'Admin full name is required';
        }
      }

      setErrors(newErrors);

      if (Object.keys(newErrors).length > 0) {
        throw new Error('Validation failed');
      }

      // Check if company name/slug already exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id, name, slug')
        .or(`name.eq.${companyData.name},slug.eq.${companyData.slug}`)
        .single();

      if (existingCompany) {
        if (existingCompany.name === companyData.name) {
          throw new Error('A company with this name already exists');
        }
        if (existingCompany.slug === companyData.slug) {
          throw new Error('A company with this slug already exists');
        }
      }

      // Create company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyData.name,
          slug: companyData.slug,
          description: companyData.description || null,
          industry: companyData.industry || null,
          website: companyData.website || null,
          address_line1: companyData.address_line1 || null,
          address_line2: companyData.address_line2 || null,
          city: companyData.city || null,
          state: companyData.state || null,
          postal_code: companyData.postal_code || null,
          country: companyData.country || 'US',
          phone: companyData.phone || null,
          subscription_plan: companyData.subscription_plan,
          billing_cycle: companyData.billing_cycle,
          is_active: true,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      if (!company) {
        throw new Error('Failed to create company');
      }

      // Enable selected modules for the company
      if (companyData.enabled_modules.length > 0) {
        const moduleAssignments = companyData.enabled_modules.map(moduleId => ({
          company_id: company.id,
          module_id: moduleId,
          is_enabled: true,
          enabled_by: profile?.user_id,
          configuration: {},
          usage_limits: {},
          billing_tier: companyData.subscription_plan,
        }));

        const { error: moduleError } = await supabase
          .from('company_modules')
          .insert(moduleAssignments);

        if (moduleError) {
          console.warn('Failed to assign modules:', moduleError);
        }
      }

      // Create admin user if requested
      let adminUser = null;
      if (companyData.auto_create_admin) {
        try {
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: companyData.admin_email.toLowerCase(),
            email_confirm: !companyData.send_welcome_email,
            user_metadata: {
              full_name: companyData.admin_full_name,
              role: 'admin',
              company_id: company.id,
            },
          });

          if (authError) throw authError;

          if (authUser.user) {
            // Create admin profile
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                user_id: authUser.user.id,
                email: companyData.admin_email.toLowerCase(),
                full_name: companyData.admin_full_name,
                role: 'admin',
                company_id: company.id,
                phone: companyData.admin_phone || null,
              });

            if (profileError) {
              console.warn('Failed to create admin profile:', profileError);
            } else {
              adminUser = {
                user: authUser.user,
                profile: {
                  user_id: authUser.user.id,
                  email: companyData.admin_email,
                  full_name: companyData.admin_full_name,
                  role: 'admin',
                  company_id: company.id,
                },
              };

              // Send welcome email if requested
              if (companyData.send_welcome_email) {
                const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
                  companyData.admin_email.toLowerCase(),
                  {
                    data: {
                      full_name: companyData.admin_full_name,
                      role: 'admin',
                      company_id: company.id,
                      company_name: company.name,
                      welcome_message: companyData.welcome_message,
                    },
                  }
                );

                if (inviteError) {
                  console.warn('Failed to send welcome email:', inviteError);
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to create admin user:', error);
          // Don't fail the entire operation if admin creation fails
        }
      }

      return {
        company,
        adminUser,
      };
    },
    onSuccess: (data) => {
      // Reset form
      setForm({
        name: '',
        slug: '',
        description: '',
        industry: '',
        website: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
        phone: '',
        subscription_plan: 'professional',
        billing_cycle: 'monthly',
        admin_email: '',
        admin_full_name: '',
        admin_phone: '',
        auto_create_admin: true,
        send_welcome_email: true,
        enabled_modules: [],
        welcome_message: '',
      });
      setErrors({});
      setCurrentStep(1);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['companiesForFiltering'] });
      queryClient.invalidateQueries({ queryKey: ['companiesForModules'] });

      // Notify parent component
      onCompanyCreated?.(data);

      // Close dialog
      onOpenChange(false);
    },
  });

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    createCompany.mutate(form);
  };

  const handleModuleToggle = (moduleId: string, enabled: boolean) => {
    setForm(prev => ({
      ...prev,
      enabled_modules: enabled
        ? [...prev.enabled_modules, moduleId]
        : prev.enabled_modules.filter(id => id !== moduleId),
    }));
  };

  const steps = [
    { id: 1, title: 'Company Details', icon: Building2 },
    { id: 2, title: 'Contact & Billing', icon: CreditCard },
    { id: 3, title: 'Admin Setup', icon: Shield },
    { id: 4, title: 'Modules & Review', icon: Settings },
  ];

  const selectedPlan = subscriptionPlans[form.subscription_plan];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Create New Company
          </DialogTitle>
        </DialogHeader>

        {/* Step Progress */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;

            return (
              <React.Fragment key={step.id}>
                <div className={`flex items-center gap-2 ${
                  isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                }`}>
                  <div className={`p-2 rounded-full ${
                    isActive ? 'bg-blue-100' : isCompleted ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-sm font-medium">{step.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-px flex-1 mx-4 ${
                    isCompleted ? 'bg-green-300' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="space-y-6">
          {/* Step 1: Company Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Company Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Acme Corporation"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Company Slug *</Label>
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="acme-corporation"
                  />
                  {errors.slug && (
                    <p className="text-sm text-red-600">{errors.slug}</p>
                  )}
                  <p className="text-xs text-gray-500">Used in URLs and system identification</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the company..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select value={form.industry} onValueChange={(value) => setForm(prev => ({ ...prev, industry: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map(industry => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={form.website}
                    onChange={(e) => setForm(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://acme.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact & Billing */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Contact Information</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address_line1">Address Line 1</Label>
                    <Input
                      id="address_line1"
                      value={form.address_line1}
                      onChange={(e) => setForm(prev => ({ ...prev, address_line1: e.target.value }))}
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address_line2">Address Line 2</Label>
                    <Input
                      id="address_line2"
                      value={form.address_line2}
                      onChange={(e) => setForm(prev => ({ ...prev, address_line2: e.target.value }))}
                      placeholder="Suite 100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="San Francisco"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={form.state}
                      onChange={(e) => setForm(prev => ({ ...prev, state: e.target.value }))}
                      placeholder="CA"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      value={form.postal_code}
                      onChange={(e) => setForm(prev => ({ ...prev, postal_code: e.target.value }))}
                      placeholder="94105"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Subscription Plan</h3>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  {Object.entries(subscriptionPlans).map(([key, plan]) => (
                    <Card
                      key={key}
                      className={`cursor-pointer transition-all ${
                        form.subscription_plan === key
                          ? 'ring-2 ring-blue-500 bg-blue-50'
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setForm(prev => ({ ...prev, subscription_plan: key as any }))}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        <div className="text-2xl font-bold">
                          ${plan.price}
                          <span className="text-sm font-normal text-gray-500">/month</span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="text-sm text-gray-600">
                            Up to {plan.users} users
                          </div>
                          <ul className="text-xs space-y-1">
                            {plan.features.map((feature, index) => (
                              <li key={index} className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <Select value={form.billing_cycle} onValueChange={(value: 'monthly' | 'annual') => setForm(prev => ({ ...prev, billing_cycle: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly billing</SelectItem>
                      <SelectItem value="annual">Annual billing (10% discount)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Admin Setup */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Administrator Setup</h3>
                <Switch
                  checked={form.auto_create_admin}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, auto_create_admin: checked }))}
                />
              </div>

              {form.auto_create_admin ? (
                <div className="space-y-4">
                  <Alert>
                    <Users className="h-4 w-4" />
                    <AlertDescription>
                      An administrator account will be created for this company with full management access.
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin_email">Admin Email *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="admin_email"
                          type="email"
                          value={form.admin_email}
                          onChange={(e) => setForm(prev => ({ ...prev, admin_email: e.target.value }))}
                          className="pl-10"
                          placeholder="admin@acme.com"
                        />
                      </div>
                      {errors.admin_email && (
                        <p className="text-sm text-red-600">{errors.admin_email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="admin_full_name">Admin Full Name *</Label>
                      <Input
                        id="admin_full_name"
                        value={form.admin_full_name}
                        onChange={(e) => setForm(prev => ({ ...prev, admin_full_name: e.target.value }))}
                        placeholder="John Smith"
                      />
                      {errors.admin_full_name && (
                        <p className="text-sm text-red-600">{errors.admin_full_name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="admin_phone">Admin Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="admin_phone"
                          value={form.admin_phone}
                          onChange={(e) => setForm(prev => ({ ...prev, admin_phone: e.target.value }))}
                          className="pl-10"
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">Send Welcome Email</div>
                      <div className="text-sm text-gray-500">
                        Send login instructions and welcome message to the admin
                      </div>
                    </div>
                    <Switch
                      checked={form.send_welcome_email}
                      onCheckedChange={(checked) => setForm(prev => ({ ...prev, send_welcome_email: checked }))}
                    />
                  </div>

                  {form.send_welcome_email && (
                    <div className="space-y-2">
                      <Label htmlFor="welcome_message">Welcome Message (Optional)</Label>
                      <Textarea
                        id="welcome_message"
                        value={form.welcome_message}
                        onChange={(e) => setForm(prev => ({ ...prev, welcome_message: e.target.value }))}
                        placeholder="Welcome to your new INFOtrac account! We're excited to help you manage your expenses efficiently."
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No administrator will be created automatically. You'll need to manually create admin users after the company is set up.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 4: Modules & Review */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Enable Modules</h3>
                <p className="text-gray-600 mb-4">
                  Select which modules will be available to this company's users.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {modules?.map((module) => (
                    <div key={module.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{module.name}</div>
                        <div className="text-sm text-gray-500">{module.description}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{module.module_type}</Badge>
                          {module.default_monthly_price > 0 && (
                            <Badge variant="secondary">
                              ${module.default_monthly_price}/mo
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={form.enabled_modules.includes(module.id)}
                        onCheckedChange={(checked) => handleModuleToggle(module.id, checked)}
                        disabled={module.is_core_required}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Review & Confirm</h3>

                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Company Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div><span className="font-medium">Name:</span> {form.name}</div>
                      <div><span className="font-medium">Slug:</span> {form.slug}</div>
                      <div><span className="font-medium">Industry:</span> {form.industry || 'Not specified'}</div>
                      <div><span className="font-medium">Plan:</span> {selectedPlan.name} (${selectedPlan.price}/{form.billing_cycle === 'monthly' ? 'mo' : 'yr'})</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Administrator</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {form.auto_create_admin ? (
                        <>
                          <div><span className="font-medium">Name:</span> {form.admin_full_name}</div>
                          <div><span className="font-medium">Email:</span> {form.admin_email}</div>
                          <div><span className="font-medium">Welcome Email:</span> {form.send_welcome_email ? 'Yes' : 'No'}</div>
                        </>
                      ) : (
                        <div className="text-gray-500">No admin user will be created</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Enabled Modules ({form.enabled_modules.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {form.enabled_modules.length > 0 ? (
                        modules?.filter(m => form.enabled_modules.includes(m.id)).map(module => (
                          <Badge key={module.id} variant="outline">
                            {module.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-500">No modules selected</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Error Display */}
          {createCompany.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {createCompany.error.message}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={createCompany.isPending}
              >
                Previous
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createCompany.isPending}
            >
              Cancel
            </Button>

            {currentStep < 4 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={createCompany.isPending}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={createCompany.isPending}
              >
                {createCompany.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Company...
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4 mr-2" />
                    Create Company
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};