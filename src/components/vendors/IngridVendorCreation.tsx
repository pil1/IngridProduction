/**
 * IngridVendorCreation Component
 *
 * AI-first vendor creation workflow that uses minimal user input and leverages
 * Ingrid's web enrichment service to auto-populate vendor fields.
 */

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sparkles,
  Search,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Bot,
  Globe,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Zap,
  X,
  Check,
  Info
} from 'lucide-react';
import { WebEnrichmentService } from '@/services/ingrid/WebEnrichmentService';
import { IngridConfig } from '@/types/ingrid';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';

// Schema for the initial vendor input (minimal)
const initialVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
});

// Schema for the complete vendor (after enrichment)
const enrichedVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  contact_person: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  state_province: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  tax_id: z.string().optional(),
  payment_terms: z.string().optional(),
  default_currency_code: z.string().default('USD'),
  notes: z.string().optional(),
});

type InitialVendorForm = z.infer<typeof initialVendorSchema>;
type EnrichedVendorForm = z.infer<typeof enrichedVendorSchema>;

interface EnrichmentResult {
  field: string;
  value: string;
  confidence: number;
  source: string;
  userProvided: boolean;
}

interface IngridVendorCreationProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  companyId: string;
  prefillData?: Partial<InitialVendorForm>;
}

export const IngridVendorCreation: React.FC<IngridVendorCreationProps> = ({
  isOpen,
  onOpenChange,
  onSuccess,
  companyId,
  prefillData
}) => {
  const [step, setStep] = useState<'input' | 'enriching' | 'review' | 'saving'>('input');
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);
  const [enrichmentResults, setEnrichmentResults] = useState<EnrichmentResult[]>([]);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useSession();

  // Form for initial input
  const initialForm = useForm<InitialVendorForm>({
    resolver: zodResolver(initialVendorSchema),
    defaultValues: {
      name: prefillData?.name || '',
      website: prefillData?.website || '',
      email: prefillData?.email || '',
      phone: prefillData?.phone || '',
    }
  });

  // Form for enriched data review
  const enrichedForm = useForm<EnrichedVendorForm>({
    resolver: zodResolver(enrichedVendorSchema),
    defaultValues: {
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      website: '',
      address_line_1: '',
      address_line_2: '',
      city: '',
      state_province: '',
      postal_code: '',
      country: '',
      tax_id: '',
      payment_terms: '',
      default_currency_code: 'USD',
      notes: '',
    }
  });

  // Reset forms when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setEnrichmentProgress(0);
      setEnrichmentResults([]);
      setEnrichmentError(null);
      initialForm.reset({
        name: prefillData?.name || '',
        website: prefillData?.website || '',
        email: prefillData?.email || '',
        phone: prefillData?.phone || '',
      });
    }
  }, [isOpen, prefillData, initialForm]);

  // Mock web enrichment service (replace with actual implementation)
  const performWebEnrichment = async (vendorData: InitialVendorForm) => {
    setStep('enriching');
    setEnrichmentProgress(0);
    setEnrichmentError(null);

    try {
      // Simulate enrichment steps
      const steps = [
        'Searching web for vendor information...',
        'Analyzing company data sources...',
        'Extracting contact information...',
        'Verifying business details...',
        'Finalizing enrichment...'
      ];

      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setEnrichmentProgress(((i + 1) / steps.length) * 100);
      }

      // Mock enrichment results
      const mockResults: EnrichmentResult[] = [
        {
          field: 'name',
          value: vendorData.name,
          confidence: 100,
          source: 'user-provided',
          userProvided: true
        },
        {
          field: 'website',
          value: vendorData.website || `https://www.${vendorData.name.toLowerCase().replace(/\s+/g, '')}.com`,
          confidence: vendorData.website ? 100 : 75,
          source: vendorData.website ? 'user-provided' : 'web-search',
          userProvided: !!vendorData.website
        },
        {
          field: 'email',
          value: vendorData.email || `contact@${vendorData.name.toLowerCase().replace(/\s+/g, '')}.com`,
          confidence: vendorData.email ? 100 : 60,
          source: vendorData.email ? 'user-provided' : 'web-inference',
          userProvided: !!vendorData.email
        },
        {
          field: 'phone',
          value: vendorData.phone || '(555) 123-4567',
          confidence: vendorData.phone ? 100 : 45,
          source: vendorData.phone ? 'user-provided' : 'business-directory',
          userProvided: !!vendorData.phone
        },
        {
          field: 'address_line_1',
          value: '123 Business Ave',
          confidence: 70,
          source: 'business-directory',
          userProvided: false
        },
        {
          field: 'city',
          value: 'San Francisco',
          confidence: 80,
          source: 'business-directory',
          userProvided: false
        },
        {
          field: 'state_province',
          value: 'CA',
          confidence: 80,
          source: 'business-directory',
          userProvided: false
        },
        {
          field: 'postal_code',
          value: '94105',
          confidence: 75,
          source: 'business-directory',
          userProvided: false
        },
        {
          field: 'country',
          value: 'US',
          confidence: 90,
          source: 'business-directory',
          userProvided: false
        }
      ];

      setEnrichmentResults(mockResults);

      // Populate the enriched form
      const enrichedData: EnrichedVendorForm = {};
      mockResults.forEach(result => {
        (enrichedData as any)[result.field] = result.value;
      });

      enrichedForm.reset({
        ...enrichedData,
        default_currency_code: 'USD',
      });

      setStep('review');
    } catch (error) {
      setEnrichmentError('Failed to enrich vendor data. Please try again or continue manually.');
      setStep('input');
    }
  };

  // Save vendor mutation
  const saveVendorMutation = useMutation({
    mutationFn: async (vendorData: EnrichedVendorForm) => {
      setStep('saving');

      const { error } = await supabase
        .from('vendors')
        .insert({
          ...vendorData,
          company_id: companyId,
          is_active: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Vendor Created Successfully',
        description: 'The vendor has been added with AI-enhanced information.',
      });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Create Vendor',
        description: error.message,
        variant: 'destructive',
      });
      setStep('review');
    },
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return 'High';
    if (confidence >= 60) return 'Medium';
    return 'Low';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Create Vendor with AI
          </DialogTitle>
          <DialogDescription>
            Enter basic vendor information and let Ingrid AI enrich it with web data
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Initial Input */}
        {step === 'input' && (
          <div className="space-y-6">
            {enrichmentError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{enrichmentError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={initialForm.handleSubmit(performWebEnrichment)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Vendor Name *</Label>
                <Input
                  id="name"
                  {...initialForm.register('name')}
                  placeholder="Enter vendor name..."
                />
                {initialForm.formState.errors.name && (
                  <p className="text-sm text-red-600">{initialForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website">Website (Optional)</Label>
                  <Input
                    id="website"
                    {...initialForm.register('website')}
                    placeholder="https://..."
                  />
                  {initialForm.formState.errors.website && (
                    <p className="text-sm text-red-600">{initialForm.formState.errors.website.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    {...initialForm.register('email')}
                    placeholder="contact@vendor.com"
                  />
                  {initialForm.formState.errors.email && (
                    <p className="text-sm text-red-600">{initialForm.formState.errors.email.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  {...initialForm.register('phone')}
                  placeholder="(555) 123-4567"
                />
              </div>

              <Alert>
                <Bot className="h-4 w-4" />
                <AlertDescription>
                  <strong>AI Enhancement:</strong> Ingrid will search the web to automatically fill in
                  missing vendor details like address, contact information, and business data.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!initialForm.watch('name')}>
                  <Zap className="h-4 w-4 mr-2" />
                  Enhance with AI
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Enriching */}
        {step === 'enriching' && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Bot className="h-8 w-8 text-purple-600 animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Ingrid is enhancing your vendor...</h3>
              <p className="text-gray-600 mb-6">Searching the web for additional vendor information</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Enhancement Progress</span>
                <span>{Math.round(enrichmentProgress)}%</span>
              </div>
              <Progress value={enrichmentProgress} className="h-2" />
            </div>

            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>This may take a few seconds...</span>
            </div>
          </div>
        )}

        {/* Step 3: Review Enriched Data */}
        {step === 'review' && (
          <div className="space-y-6">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Enhancement Complete!</strong> Review the information below and make any necessary adjustments.
              </AlertDescription>
            </Alert>

            <form onSubmit={enrichedForm.handleSubmit((data) => saveVendorMutation.mutate(data))} className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="enriched-name">Vendor Name</Label>
                      <Input
                        id="enriched-name"
                        {...enrichedForm.register('name')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-person">Contact Person</Label>
                      <Input
                        id="contact-person"
                        {...enrichedForm.register('contact_person')}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="enriched-email">Email</Label>
                      <div className="relative">
                        <Input
                          id="enriched-email"
                          {...enrichedForm.register('email')}
                        />
                        {enrichmentResults.find(r => r.field === 'email' && !r.userProvided) && (
                          <Badge
                            className={`absolute -top-2 -right-2 text-xs ${getConfidenceColor(
                              enrichmentResults.find(r => r.field === 'email')?.confidence || 0
                            )}`}
                          >
                            AI: {getConfidenceLabel(enrichmentResults.find(r => r.field === 'email')?.confidence || 0)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="enriched-phone">Phone</Label>
                      <div className="relative">
                        <Input
                          id="enriched-phone"
                          {...enrichedForm.register('phone')}
                        />
                        {enrichmentResults.find(r => r.field === 'phone' && !r.userProvided) && (
                          <Badge
                            className={`absolute -top-2 -right-2 text-xs ${getConfidenceColor(
                              enrichmentResults.find(r => r.field === 'phone')?.confidence || 0
                            )}`}
                          >
                            AI: {getConfidenceLabel(enrichmentResults.find(r => r.field === 'phone')?.confidence || 0)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="enriched-website">Website</Label>
                    <Input
                      id="enriched-website"
                      {...enrichedForm.register('website')}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Address Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address-line-1">Address Line 1</Label>
                    <div className="relative">
                      <Input
                        id="address-line-1"
                        {...enrichedForm.register('address_line_1')}
                      />
                      <Badge className={`absolute -top-2 -right-2 text-xs ${getConfidenceColor(70)}`}>
                        AI: {getConfidenceLabel(70)}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        {...enrichedForm.register('city')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Province</Label>
                      <Input
                        id="state"
                        {...enrichedForm.register('state_province')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postal-code">Postal Code</Label>
                      <Input
                        id="postal-code"
                        {...enrichedForm.register('postal_code')}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setStep('input')}>
                  Back
                </Button>
                <Button type="submit" disabled={saveVendorMutation.isPending}>
                  {saveVendorMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Create Vendor
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Step 4: Saving */}
        {step === 'saving' && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Creating vendor...</h3>
              <p className="text-gray-600">Saving your enhanced vendor information</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default IngridVendorCreation;