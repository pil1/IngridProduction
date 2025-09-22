/**
 * Ingrid Expense Creation Dialog
 *
 * A sophisticated 3-step modal that replaces the traditional expense creation flow
 * with AI-powered document processing and smart form pre-filling.
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, X, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/SessionContextProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { ingridCore } from '@/services/ingrid/IngridCore';
import { IngridAvatar } from './IngridAvatar';
import { Step1DocumentUpload } from './Step1DocumentUpload';
import { Step2SmartForm } from './Step2SmartForm';
import { Step3ReviewSubmit } from './Step3ReviewSubmit';
import { useIngridExpenseCreation } from '@/hooks/useIngridExpenseCreation';
import type { IngridResponse } from '@/types/ingrid';

export interface IngridExpenseCreationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseCreated?: (expenseId: string) => void;
}

export interface ProcessedExpenseData {
  // Extracted from Ingrid analysis
  description: string;
  amount: number;
  vendor_name: string;
  expense_date: string;
  category_id: string;
  gl_account_code?: string;
  tax_amount?: number;
  currency_code: string;

  // AI metadata
  confidence_score: number;
  ingrid_suggestions: string[];
  field_confidences: Record<string, number>;

  // Document info
  document_url?: string;
  document_name: string;
  document_type: string;

  // Processing info
  processing_time_ms?: number;
  processing_started_at?: string;
  processing_completed_at?: string;
}

type StepNumber = 1 | 2 | 3;

export const IngridExpenseCreationDialog: React.FC<IngridExpenseCreationDialogProps> = ({
  isOpen,
  onOpenChange,
  onExpenseCreated
}) => {
  const { profile } = useSession();
  const { toast } = useToast();
  const { securityContext } = usePermissions();

  // Step management
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [canProceed, setCanProceed] = useState(false);

  // Ingrid processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [ingridResponse, setIngridResponse] = useState<IngridResponse | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedExpenseData | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState<ProcessedExpenseData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    validateExpenseData,
    submitExpense,
    isValidating
  } = useIngridExpenseCreation();

  // Reset dialog state when opening/closing
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      // Reset all state when closing
      setCurrentStep(1);
      setCanProceed(false);
      setIsProcessing(false);
      setIngridResponse(null);
      setProcessedData(null);
      setUploadedFile(null);
      setFormData(null);
      setIsSubmitting(false);
      setProcessingStartTime(null);
    }
    onOpenChange(open);
  }, [onOpenChange]);

  // Step 1: Document upload and processing
  const handleDocumentProcessed = useCallback(async (file: File, response: IngridResponse) => {
    try {
      setIsProcessing(true);
      setUploadedFile(file);
      setIngridResponse(response);

      // Calculate processing time
      const endTime = Date.now();
      const processingTime = processingStartTime ? endTime - processingStartTime : 0;
      const startTimeIso = processingStartTime ? new Date(processingStartTime).toISOString() : new Date().toISOString();
      const endTimeIso = new Date(endTime).toISOString();

      // Extract expense data from action cards
      const expenseAction = response.actionCards.find(card => card.type === 'create_expense');

      if (expenseAction && expenseAction.data) {
        const processedExpenseData: ProcessedExpenseData = {
          description: expenseAction.data.description || '',
          amount: expenseAction.data.amount || 0,
          vendor_name: expenseAction.data.vendor_name || '',
          expense_date: expenseAction.data.expense_date || new Date().toISOString().split('T')[0],
          category: expenseAction.data.category || '',
          gl_account_code: expenseAction.data.gl_account_code,
          tax_amount: expenseAction.data.tax_amount,
          currency_code: expenseAction.data.currency_code || 'USD',
          confidence_score: expenseAction.confidence > 1 ? expenseAction.confidence / 100 : expenseAction.confidence,
          ingrid_suggestions: response.actionCards.map(card => card.description),
          field_confidences: expenseAction.data.field_confidences || {},
          document_name: file.name,
          document_type: expenseAction.data.document_type || 'unknown',
          processing_time_ms: processingTime,
          processing_started_at: startTimeIso,
          processing_completed_at: endTimeIso
        };

        setProcessedData(processedExpenseData);
        setFormData(processedExpenseData);
        setCanProceed(true);

        toast({
          title: "Document Processed Successfully",
          description: `Ingrid analyzed your ${file.name} with ${Math.round(response.confidence)}% confidence.`,
        });
      } else {
        // AI processing failed, but allow manual entry
        console.warn("Unable to extract expense data from document, enabling manual entry");

        // Create empty form data for manual entry with default confidence scores
        const emptyData: ProcessedExpenseData = {
          description: '',
          amount: 0,
          vendor_name: '',
          expense_date: new Date().toISOString().split('T')[0],
          category: '',
          currency_code: 'USD',
          confidence_score: 0.5, // Medium confidence for manual entry
          ingrid_suggestions: ['Please review and fill in all required fields manually'],
          field_confidences: {
            description: 0.5,
            amount: 0.5,
            vendor_name: 0.5,
            expense_date: 0.5,
            category: 0.5,
            gl_account_code: 0.5,
            tax_amount: 0.5,
            currency_code: 0.8 // Higher confidence for default currency
          },
          document_name: file.name,
          document_type: 'unknown',
          processing_time_ms: processingTime,
          processing_started_at: startTimeIso,
          processing_completed_at: endTimeIso
        };

        setProcessedData(emptyData);
        setFormData(emptyData);
        setCanProceed(true); // Allow proceeding to manual entry

        toast({
          title: "AI Processing Failed",
          description: "Please enter expense details manually.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Document processing error:', error);

      // Even if there's an error, allow manual entry
      const emptyData: ProcessedExpenseData = {
        description: '',
        amount: 0,
        vendor_name: '',
        expense_date: new Date().toISOString().split('T')[0],
        category: '',
        currency_code: 'USD',
        confidence_score: 0.5,
        ingrid_suggestions: ['Processing failed - please review and fill in all fields manually'],
        field_confidences: {
          description: 0.5,
          amount: 0.5,
          vendor_name: 0.5,
          expense_date: 0.5,
          category: 0.5,
          gl_account_code: 0.5,
          tax_amount: 0.5,
          currency_code: 0.8
        },
        document_name: uploadedFile?.name || 'Unknown document',
        document_type: 'unknown',
        processing_time_ms: processingTime,
        processing_started_at: startTimeIso,
        processing_completed_at: endTimeIso
      };

      setProcessedData(emptyData);
      setFormData(emptyData);
      setCanProceed(true); // Always allow proceeding to manual entry

      toast({
        title: "Processing Failed",
        description: "Ingrid couldn't process your document. Please enter details manually.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  // Handle skip to manual entry
  const handleSkipToManual = useCallback(() => {
    // Create empty form data for manual entry
    const currentTime = new Date().toISOString();
    const emptyData: ProcessedExpenseData = {
      description: '',
      amount: 0,
      vendor_name: '',
      expense_date: new Date().toISOString().split('T')[0],
      category: '',
      currency_code: 'USD',
      confidence_score: 0.5,
      ingrid_suggestions: ['Manual entry mode - please fill in all required fields'],
      field_confidences: {
        description: 0.5,
        amount: 0.5,
        vendor_name: 0.5,
        expense_date: 0.5,
        category: 0.5,
        gl_account_code: 0.5,
        tax_amount: 0.5,
        currency_code: 0.8
      },
      document_name: 'Manual Entry',
      document_type: 'manual',
      processing_time_ms: 0, // No processing time for manual entry
      processing_started_at: currentTime,
      processing_completed_at: currentTime
    };

    setProcessedData(emptyData);
    setFormData(emptyData);
    setCanProceed(true);
    setCurrentStep(2); // Skip directly to Step 2

    toast({
      title: "Manual Entry Mode",
      description: "Please fill in the expense details manually.",
      variant: "default"
    });
  }, [toast]);

  // Step 2: Form data updated
  const handleFormDataChange = useCallback((updatedData: ProcessedExpenseData) => {
    setFormData(updatedData);

    // Validate required fields
    const isValid = updatedData.description &&
                   updatedData.amount > 0 &&
                   updatedData.expense_date &&
                   updatedData.vendor_name;

    setCanProceed(isValid);
  }, []);

  // Step 3: Final submission
  const handleExpenseSubmit = useCallback(async (finalData: ProcessedExpenseData) => {
    if (!profile?.company_id || !formData) return;

    try {
      setIsSubmitting(true);

      // Submit the expense
      const expenseId = await submitExpense({
        ...finalData,
        company_id: profile.company_id,
        user_id: profile.user_id,
        document_file: uploadedFile,
        ingrid_metadata: {
          confidence_score: finalData.confidence_score,
          suggestions: finalData.ingrid_suggestions,
          field_confidences: finalData.field_confidences,
          ingrid_response_id: ingridResponse?.conversationId
        }
      });

      toast({
        title: "Expense Created Successfully",
        description: "Your expense has been created and is ready for review.",
      });

      // Close dialog and notify parent
      handleOpenChange(false);
      onExpenseCreated?.(expenseId);

    } catch (error) {
      console.error('Expense submission error:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to create expense. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [profile, formData, uploadedFile, ingridResponse, submitExpense, toast, handleOpenChange, onExpenseCreated]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (currentStep < 3 && canProceed) {
      setCurrentStep((prev) => (prev + 1) as StepNumber);
      setCanProceed(currentStep === 2 ? true : false); // Step 3 always allows proceed
    }
  }, [currentStep, canProceed]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as StepNumber);
      setCanProceed(true);
    }
  }, [currentStep]);

  // Progress calculation
  const progress = ((currentStep - 1) / 2) * 100;

  // Step titles
  const stepTitles = {
    1: "Upload Document",
    2: "Review & Edit",
    3: "Confirm & Submit"
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" hideCloseButton>
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IngridAvatar size="sm" />
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-500" />
                  Create Expense with Ingrid
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Step {currentStep} of 3: {stepTitles[currentStep]}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="space-y-2 pt-4">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className={currentStep >= 1 ? "text-blue-600 font-medium" : ""}>
                Upload Document
              </span>
              <span className={currentStep >= 2 ? "text-blue-600 font-medium" : ""}>
                Review & Edit
              </span>
              <span className={currentStep >= 3 ? "text-blue-600 font-medium" : ""}>
                Confirm & Submit
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {currentStep === 1 && (
            <Step1DocumentUpload
              onDocumentProcessed={handleDocumentProcessed}
              onSkipToManual={handleSkipToManual}
              isProcessing={isProcessing}
              securityContext={securityContext}
              onProcessingStart={() => setProcessingStartTime(Date.now())}
              companyId={profile?.company_id}
            />
          )}

          {currentStep === 2 && processedData && (
            <Step2SmartForm
              initialData={processedData}
              onDataChange={handleFormDataChange}
              uploadedFile={uploadedFile}
              isValidating={isValidating}
            />
          )}

          {currentStep === 3 && formData && (
            <Step3ReviewSubmit
              expenseData={formData}
              uploadedFile={uploadedFile}
              ingridResponse={ingridResponse}
              onSubmit={handleExpenseSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </div>

        {/* Navigation Footer */}
        <div className="flex-shrink-0 border-t pt-4">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1 || isProcessing || isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              {isProcessing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full" />
                  Ingrid is processing...
                </div>
              )}

              {isSubmitting && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-pulse h-2 w-2 bg-green-500 rounded-full" />
                  Creating expense...
                </div>
              )}
            </div>

            {currentStep < 3 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed || isProcessing || isSubmitting}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => formData && handleExpenseSubmit(formData)}
                disabled={!canProceed || isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "Creating..." : "Create Expense"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};