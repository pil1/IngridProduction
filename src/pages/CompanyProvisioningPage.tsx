/**
 * Company Provisioning Page - Super Admin Only
 *
 * Standalone page for complete company creation that collects ALL required database fields,
 * automatically assigns core modules, allows add-on selection, creates admin user,
 * and configures module pricing.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Building,
  Plus,
  Loader2,
  CheckCircle,
  AlertCircle,
  User,
  Shield,
  Package,
  DollarSign,
  ArrowLeft,
  MapPin
} from 'lucide-react';
import { COUNTRIES, CURRENCIES, getStatesByCountry, getCurrencyByCountry } from '@/utils/countryData';

const companyProvisioningSchema = z.object({
  // Company Information
  name: z.string().min(1, 'Company name is required'),
  slug: z.string().min(1, 'Company slug is required').regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),

  // Contact Information
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),

  // Address Information
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  base_currency: z.string().min(1, 'Base currency is required'),

  // Module Selection
  enabled_modules: z.array(z.string()),
  module_pricing: z.record(z.object({
    monthly_price: z.number().min(0),
    per_user_price: z.number().min(0),
  })).optional(),

  // Admin User Creation (always required)
  admin_user: z.object({
    email: z.string().email('Valid email is required'),
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    phone: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  }),
});

type CompanyProvisioningForm = z.infer<typeof companyProvisioningSchema>;

interface Module {
  id: string;
  name: string;
  description: string;
  module_type: 'core' | 'super' | 'add-on';
  category: string;
  is_core_required: boolean;
  default_monthly_price: number;
  default_per_user_price: number;
}

export default function CompanyProvisioningPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [modulePricing, setModulePricing] = useState<Record<string, { monthly_price: number; per_user_price: number }>>({});

  const form = useForm<CompanyProvisioningForm>({
    resolver: zodResolver(companyProvisioningSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      website: '',
      phone: '',
      email: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      base_currency: 'USD',
      enabled_modules: [],
      module_pricing: {},
      admin_user: {
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        password: '',
      },
    },
  });

  // Fetch available modules
  const { data: modulesData, isLoading: isLoadingModules } = useQuery({
    queryKey: ['modules'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/modules`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch modules');
      const data = await response.json();
      return data.success ? data.data.modules : [];
    },
  });

  // Auto-generate slug from company name
  const handleNameChange = (value: string) => {
    form.setValue('name', value);
    const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    form.setValue('slug', slug);
  };

  // Handle country change and auto-set currency
  const handleCountryChange = (countryCode: string) => {
    form.setValue('country', countryCode);
    form.setValue('state', ''); // Clear state when country changes
    const currency = getCurrencyByCountry(countryCode);
    form.setValue('base_currency', currency);
  };

  const selectedCountry = form.watch('country');
  const availableStates = getStatesByCountry(selectedCountry);

  // Company provisioning mutation
  const provisionMutation = useMutation({
    mutationFn: async (data: CompanyProvisioningForm) => {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No access token');

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/companies/provision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        console.log('Backend error response:', error);

        if (error.errors && Array.isArray(error.errors)) {
          // Show specific validation errors
          const errorMessage = error.errors.map((err: any) => err.msg).join(', ');
          throw new Error(`Validation failed: ${errorMessage}`);
        }

        throw new Error(error.message || 'Failed to provision company');
      }

      return response.json();
    },
    onSuccess: (response) => {
      toast({
        title: "Company Provisioned Successfully",
        description: `${response.data.company.name} has been created with ${response.data.module_count} modules enabled.`,
      });

      form.reset();
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setIsProvisioning(false);

      // Navigate back to User Management
      navigate('/users');
    },
    onError: (error: any) => {
      toast({
        title: "Provisioning Failed",
        description: error.message || "Failed to provision company",
        variant: "destructive",
      });
      setIsProvisioning(false);
    },
  });

  const onSubmit = (data: CompanyProvisioningForm) => {
    console.log('Form submission data:', data);
    setIsProvisioning(true);
    provisionMutation.mutate(data);
  };

  const coreModules = modulesData?.filter((m: Module) => m.is_core_required || m.module_type === 'core') || [];
  const addOnModules = modulesData?.filter((m: Module) => !m.is_core_required && m.module_type === 'add-on') || [];
  const selectedModules = form.watch('enabled_modules');

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Provision New Company</h1>
        <p className="text-muted-foreground">
          Create a new company with complete configuration including modules, admin user, and custom pricing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Company Setup
          </CardTitle>
          <CardDescription>
            All required database fields will be collected to ensure proper system integration with custom pricing configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

              {/* Company Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">Company Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="Enter company name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Slug *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="company-slug" />
                        </FormControl>
                        <FormDescription>
                          Auto-generated from name. Used for URLs and identification.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://company.com" type="url" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Brief description of the company" rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Contact & Address Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">Contact & Address Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Email</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="contact@company.com" type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="+1 (555) 123-4567" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address_line1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 1</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="123 Main Street" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address_line2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 2</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Suite 100" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="San Francisco" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="94105" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country *</FormLabel>
                        <Select onValueChange={handleCountryChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRIES.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                {country.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State/Province</FormLabel>
                        {availableStates.length > 0 ? (
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select state/province" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableStates.map((state) => (
                                <SelectItem key={state.code} value={state.code}>
                                  {state.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <FormControl>
                            <Input {...field} placeholder="Enter state/province" />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="base_currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Currency *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CURRENCIES.map((currency) => (
                              <SelectItem key={currency.code} value={currency.code}>
                                {currency.code} - {currency.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Auto-selected based on country. Can be changed if needed.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Module Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">Module Configuration</h3>
                </div>

                {isLoadingModules ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading modules...
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Core Modules (Always Enabled) */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="default">Required</Badge>
                        <span className="font-medium">Core Modules</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {coreModules.map((module: Module) => (
                          <div key={module.id} className="p-3 border rounded-lg bg-muted/30">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="font-medium">{module.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {module.description}
                            </p>
                            <div className="text-xs text-muted-foreground mt-2">
                              ${module.default_monthly_price}/mo + ${module.default_per_user_price}/user
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Add-on Modules (Optional) */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary">Optional</Badge>
                        <span className="font-medium">Add-on Modules</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {addOnModules.map((module: Module) => {
                          const isSelected = selectedModules.includes(module.id);
                          const pricing = modulePricing[module.id] || {
                            monthly_price: module.default_monthly_price,
                            per_user_price: module.default_per_user_price
                          };

                          return (
                            <div key={module.id} className="space-y-3">
                              <div
                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'border-primary bg-primary/5'
                                    : 'hover:border-primary/50'
                                }`}
                                onClick={() => {
                                  const currentModules = form.getValues('enabled_modules');
                                  const newValue = isSelected
                                    ? currentModules.filter((id) => id !== module.id)
                                    : [...currentModules, module.id];
                                  form.setValue('enabled_modules', newValue);

                                  // Initialize pricing for newly selected modules
                                  if (!isSelected) {
                                    setModulePricing(prev => ({
                                      ...prev,
                                      [module.id]: {
                                        monthly_price: module.default_monthly_price,
                                        per_user_price: module.default_per_user_price
                                      }
                                    }));
                                  }
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                                    isSelected
                                      ? 'border-primary bg-primary text-white'
                                      : 'border-gray-300'
                                  }`}>
                                    {isSelected && (
                                      <CheckCircle className="h-3 w-3" />
                                    )}
                                  </div>
                                  <span className="font-medium">{module.name}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {module.description}
                                </p>
                                <div className="text-xs text-muted-foreground mt-2">
                                  Default: ${module.default_monthly_price}/mo + ${module.default_per_user_price}/user
                                </div>
                              </div>

                              {isSelected && (
                                <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                                  <div className="text-sm font-medium">Custom Pricing</div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs text-muted-foreground">Monthly Base</label>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={pricing.monthly_price}
                                        onChange={(e) => {
                                          const value = parseFloat(e.target.value) || 0;
                                          setModulePricing(prev => ({
                                            ...prev,
                                            [module.id]: { ...pricing, monthly_price: value }
                                          }));
                                          form.setValue('module_pricing', {
                                            ...form.getValues('module_pricing'),
                                            [module.id]: { ...pricing, monthly_price: value }
                                          });
                                        }}
                                        className="h-8"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-muted-foreground">Per User</label>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={pricing.per_user_price}
                                        onChange={(e) => {
                                          const value = parseFloat(e.target.value) || 0;
                                          setModulePricing(prev => ({
                                            ...prev,
                                            [module.id]: { ...pricing, per_user_price: value }
                                          }));
                                          form.setValue('module_pricing', {
                                            ...form.getValues('module_pricing'),
                                            [module.id]: { ...pricing, per_user_price: value }
                                          });
                                        }}
                                        className="h-8"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Admin User Creation */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <h3 className="text-lg font-semibold">Admin User Creation</h3>
                </div>

                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="text-sm text-muted-foreground mb-4">
                    An admin user will be automatically created for this company with full permissions.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="admin_user.email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admin Email *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="admin@company.com" type="email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="admin_user.phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admin Phone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+1 (555) 123-4567" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="admin_user.first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="John" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="admin_user.last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Doe" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="admin_user.password"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Admin Password</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Leave empty to send invitation" type="password" />
                          </FormControl>
                          <FormDescription>
                            If empty, an invitation email will be sent to set password.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/users')}
                  disabled={isProvisioning}
                >
                  Cancel
                </Button>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    disabled={isProvisioning}
                  >
                    Clear Form
                  </Button>
                  <Button type="submit" disabled={isProvisioning} className="min-w-[150px]">
                    {isProvisioning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Provisioning...
                      </>
                    ) : (
                      <>
                        <Building className="h-4 w-4 mr-2" />
                        Provision Company
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}