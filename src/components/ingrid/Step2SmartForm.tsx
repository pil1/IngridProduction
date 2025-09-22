/**
 * Step 2: Smart Form Component
 *
 * Displays Ingrid's extracted data in an editable form with confidence indicators,
 * smart suggestions, and real-time validation.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CalendarIcon,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Brain,
  Eye,
  EyeOff,
  Lightbulb,
  FileText,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { IngridAvatar } from './IngridAvatar';
import FormattedCurrencyInput from '@/components/FormattedCurrencyInput';
import { PDFPreviewService, type PreviewResult } from '@/services/pdfPreviewService';
import type { ProcessedExpenseData } from './IngridExpenseCreationDialog';

interface Step2SmartFormProps {
  initialData: ProcessedExpenseData;
  onDataChange: (data: ProcessedExpenseData) => void;
  uploadedFile: File | null;
  isValidating: boolean;
}

// Form validation schema
const expenseFormSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  vendor_name: z.string().min(1, 'Vendor name is required'),
  expense_date: z.date(),
  category_id: z.string().min(1, 'Category is required'),
  gl_account_code: z.string().optional(),
  tax_amount: z.number().min(0).optional(),
  currency_code: z.string().min(3).max(3)
});

type FormData = z.infer<typeof expenseFormSchema>;

interface FieldConfidence {
  value: number;
  level: 'high' | 'medium' | 'low';
  color: string;
  description: string;
}

// Helper function to format processing time
const formatProcessingTime = (timeMs?: number): string => {
  if (!timeMs || timeMs === 0) {
    return "No processing";
  }

  if (timeMs < 1000) {
    return `${timeMs}ms`;
  }

  const seconds = Math.round(timeMs / 1000 * 10) / 10;
  return `${seconds}s`;
};

export const Step2SmartForm: React.FC<Step2SmartFormProps> = ({
  initialData,
  onDataChange,
  uploadedFile,
  isValidating
}) => {
  const { profile } = useSession();
  const [showDocumentPreview, setShowDocumentPreview] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const initializedRef = useRef(false);

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid }
  } = useForm<FormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: initialData.description,
      amount: initialData.amount,
      vendor_name: initialData.vendor_name,
      expense_date: new Date(initialData.expense_date),
      category_id: initialData.category_id,
      gl_account_code: initialData.gl_account_code || '',
      tax_amount: initialData.tax_amount || 0,
      currency_code: initialData.currency_code
    },
    mode: 'onChange'
  });

  const watchedValues = watch();

  // Load dropdown data
  const { data: categories = [] } = useQuery({
    queryKey: ['expenseCategories', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glAccounts', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gl_accounts')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('account_code');

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.company_id
  });

  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .order('code');

      if (error) throw error;
      return data || [];
    }
  });

  // Generate document preview URL
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const generatePreview = async () => {
      if (!uploadedFile) {
        setPreviewUrl(null);
        setPreviewResult(null);
        return;
      }

      try {
        setIsGeneratingPreview(true);

        if (PDFPreviewService.isImage(uploadedFile)) {
          // Handle image files
          const url = URL.createObjectURL(uploadedFile);
          setPreviewUrl(url);
          cleanup = () => URL.revokeObjectURL(url);
        } else if (PDFPreviewService.isPDF(uploadedFile)) {
          // Handle PDF files - generate JPG preview
          const result = await PDFPreviewService.generatePreview(uploadedFile);
          setPreviewResult(result);
          setPreviewUrl(result.previewUrl);
          cleanup = () => PDFPreviewService.cleanupPreview(result.previewUrl);
        } else {
          // Unsupported file type
          setPreviewUrl(null);
          setPreviewResult(null);
        }
      } catch (error) {
        console.error('Failed to generate preview:', error);
        setPreviewUrl(null);
        setPreviewResult(null);
      } finally {
        setIsGeneratingPreview(false);
      }
    };

    generatePreview();

    return () => {
      cleanup?.();
    };
  }, [uploadedFile]);

  // Update parent component when form data changes
  useEffect(() => {
    // Skip the first call to prevent infinite loop during initialization
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    if (isValid) {
      const updatedData: ProcessedExpenseData = {
        ...initialData,
        description: watchedValues.description,
        amount: watchedValues.amount,
        vendor_name: watchedValues.vendor_name,
        expense_date: watchedValues.expense_date.toISOString().split('T')[0],
        category_id: watchedValues.category_id,
        gl_account_code: watchedValues.gl_account_code,
        tax_amount: watchedValues.tax_amount,
        currency_code: watchedValues.currency_code
      };
      onDataChange(updatedData);
    }
  }, [watchedValues, isValid]);

  // Calculate confidence level for a field
  const getFieldConfidence = useCallback((fieldName: string): FieldConfidence => {
    const confidence = initialData.field_confidences[fieldName] || 0;

    if (confidence >= 0.8) {
      return {
        value: confidence,
        level: 'high',
        color: 'text-green-600',
        description: 'High confidence'
      };
    } else if (confidence >= 0.6) {
      return {
        value: confidence,
        level: 'medium',
        color: 'text-yellow-600',
        description: 'Medium confidence'
      };
    } else {
      return {
        value: confidence,
        level: 'low',
        color: 'text-red-600',
        description: 'Low confidence - please verify'
      };
    }
  }, []);

  // Confidence indicator component
  const ConfidenceIndicator: React.FC<{ fieldName: string }> = ({ fieldName }) => {
    const confidence = getFieldConfidence(fieldName);

    return (
      <div className="flex items-center gap-2 text-xs flex-shrink-0">
        <div className="flex items-center gap-1">
          <Brain className="h-3 w-3 text-blue-500" />
          <span className={confidence.color}>
            {Math.round(confidence.value * 100)}%
          </span>
        </div>
        <Badge
          variant={confidence.level === 'high' ? 'default' : confidence.level === 'medium' ? 'secondary' : 'destructive'}
          className="text-xs px-2 py-0.5 h-auto font-normal whitespace-nowrap"
        >
          {confidence.level === 'high' ? 'High' : confidence.level === 'medium' ? 'Medium' : 'Low'}
        </Badge>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Form Section */}
      <div className="space-y-4 overflow-y-auto pr-2 h-full pb-32">
        {/* Header */}
        <div className="flex items-center gap-3">
          <IngridAvatar size="sm" />
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              Review Extracted Data
            </h3>
            <p className="text-sm text-muted-foreground">
              Verify and edit the information Ingrid extracted from your document
            </p>
          </div>
        </div>

        {/* Overall Confidence */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">
                Overall Analysis Confidence
              </span>
              <span className="text-sm font-bold text-blue-900">
                {Math.round(initialData.confidence_score * 100)}%
              </span>
            </div>
            <Progress
              value={initialData.confidence_score * 100}
              className="h-2"
            />
            <p className="text-xs text-blue-800 mt-2">
              {initialData.confidence_score >= 0.8
                ? "High confidence - data should be very accurate"
                : initialData.confidence_score >= 0.6
                ? "Medium confidence - please verify important details"
                : "Low confidence - please carefully review all fields"}
            </p>
          </CardContent>
        </Card>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description *</Label>
              <ConfidenceIndicator fieldName="description" />
            </div>
            <Textarea
              {...register('description')}
              id="description"
              placeholder="Expense description"
              className={cn(errors.description && "border-red-500")}
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">Amount *</Label>
                <ConfidenceIndicator fieldName="amount" />
              </div>
              <FormattedCurrencyInput
                value={watchedValues.amount}
                onChange={(value) => setValue('amount', value, { shouldValidate: true })}
                currency={watchedValues.currency_code}
                className={cn(errors.amount && "border-red-500")}
              />
              {errors.amount && (
                <p className="text-sm text-red-600">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency_code">Currency</Label>
              <Select
                value={watchedValues.currency_code}
                onValueChange={(value) => setValue('currency_code', value, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.code}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vendor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="vendor_name">Vendor *</Label>
              <ConfidenceIndicator fieldName="vendor_name" />
            </div>
            <Input
              {...register('vendor_name')}
              id="vendor_name"
              placeholder="Vendor name"
              className={cn(errors.vendor_name && "border-red-500")}
            />
            {errors.vendor_name && (
              <p className="text-sm text-red-600">{errors.vendor_name.message}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Expense Date *</Label>
              <ConfidenceIndicator fieldName="expense_date" />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !watchedValues.expense_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {watchedValues.expense_date ? (
                    format(watchedValues.expense_date, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={watchedValues.expense_date}
                  onSelect={(date) => date && setValue('expense_date', date, { shouldValidate: true })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="category_id">Category *</Label>
              <ConfidenceIndicator fieldName="category_id" />
            </div>
            <Select
              value={watchedValues.category_id}
              onValueChange={(value) => setValue('category_id', value, { shouldValidate: true })}
            >
              <SelectTrigger className={cn(errors.category_id && "border-red-500")}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category_id && (
              <p className="text-sm text-red-600">{errors.category_id.message}</p>
            )}
          </div>

          {/* GL Account */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="gl_account_code">GL Account</Label>
              <ConfidenceIndicator fieldName="gl_account_code" />
            </div>
            <Select
              value={watchedValues.gl_account_code || ''}
              onValueChange={(value) => setValue('gl_account_code', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select GL account (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No GL account</SelectItem>
                {glAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.account_code}>
                    {account.account_code} - {account.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tax Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tax_amount">Tax Amount</Label>
              <ConfidenceIndicator fieldName="tax_amount" />
            </div>
            <FormattedCurrencyInput
              value={watchedValues.tax_amount || 0}
              onChange={(value) => setValue('tax_amount', value)}
              currency={watchedValues.currency_code}
            />
          </div>
        </div>

        {/* Ingrid Suggestions */}
        {initialData.ingrid_suggestions.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                Ingrid's Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="text-sm text-amber-800 space-y-1">
                {initialData.ingrid_suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Document Preview Section */}
      <div className="space-y-4 overflow-y-auto h-full">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Document Preview</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDocumentPreview(!showDocumentPreview)}
          >
            {showDocumentPreview ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Show
              </>
            )}
          </Button>
        </div>

        {showDocumentPreview && (
          <Card className="h-[400px] flex-shrink-0">
            <CardContent className="p-4 h-full">
              {isGeneratingPreview ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="h-8 w-8 mb-2 animate-spin" />
                  <p className="text-sm">Generating preview...</p>
                  <p className="text-xs">Converting PDF to image</p>
                </div>
              ) : previewUrl ? (
                <div className="h-full flex flex-col">
                  <div className="flex-1 flex items-center justify-center overflow-hidden">
                    <img
                      src={previewUrl}
                      alt="Document preview"
                      className="max-w-full max-h-full object-contain rounded shadow-sm"
                    />
                  </div>
                  {previewResult && (
                    <div className="mt-2 text-xs text-muted-foreground text-center">
                      PDF Preview (Page 1 of {previewResult.pageCount})
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-12 w-12 mb-2" />
                  <p className="text-sm">
                    {uploadedFile?.name || 'No preview available'}
                  </p>
                  <p className="text-xs">
                    {uploadedFile?.type || 'Preview not supported for this file type'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Document Info */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Document Type:</span>
                <span className="font-medium">{initialData.document_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">File Name:</span>
                <span className="font-medium">{initialData.document_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing Time:</span>
                <span className="font-medium">
                  {isValidating ? "Validating..." : formatProcessingTime(initialData.processing_time_ms)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};