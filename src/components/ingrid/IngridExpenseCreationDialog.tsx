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
import DualColumnInvoiceView from '@/components/DualColumnInvoiceView';
import { InvoiceExtractionService } from '@/services/ingrid/InvoiceExtractionService';
import type { InvoiceOCRData } from '@/services/ingrid/OCRService';
import type { InvoiceStructure, InvoiceLineItem } from '@/types/expenses';
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

  // Invoice structure for dual-column view
  const [invoiceStructure, setInvoiceStructure] = useState<InvoiceStructure | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);

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
      setInvoiceStructure(null);
      setDocumentPreviewUrl(null);
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

        // Create document preview URL
        const previewUrl = URL.createObjectURL(file);
        setDocumentPreviewUrl(previewUrl);

        // Create invoice structure from processed data
        const mockOcrData: InvoiceOCRData = {
          header: {
            invoiceNumber: processedExpenseData.description.split(' ')[0] || 'INV-001',
            purchaseOrderNumber: null,
            issueDate: processedExpenseData.expense_date,
            dueDate: null,
            reference: null
          },
          vendor: {
            name: processedExpenseData.vendor_name || 'Demo Vendor',
            address: processedExpenseData.gl_account_code || 'Demo Address',
            phone: null,
            email: null,
            website: null,
            taxNumber: null
          },
          billTo: {
            name: 'Your Company',
            address: 'Your Company Address'
          },
          lineItems: [{
            lineNumber: 1,
            description: processedExpenseData.description,
            quantity: 1,
            unitPrice: processedExpenseData.amount,
            amount: processedExpenseData.amount,
            productCode: null,
            taxRate: processedExpenseData.tax_amount ? (processedExpenseData.tax_amount / processedExpenseData.amount) : 0.13,
            taxAmount: processedExpenseData.tax_amount || (processedExpenseData.amount * 0.13),
            confidence: processedExpenseData.confidence_score
          }],
          taxes: [{
            type: 'Sales Tax',
            rate: processedExpenseData.tax_amount ? (processedExpenseData.tax_amount / processedExpenseData.amount) : 0.13,
            baseAmount: processedExpenseData.amount,
            taxAmount: processedExpenseData.tax_amount || (processedExpenseData.amount * 0.13),
            jurisdiction: 'Unknown',
            confidence: processedExpenseData.field_confidences.tax_amount || 0.8
          }],
          totals: {
            subtotal: processedExpenseData.amount - (processedExpenseData.tax_amount || (processedExpenseData.amount * 0.13)),
            totalTax: processedExpenseData.tax_amount || (processedExpenseData.amount * 0.13),
            grandTotal: processedExpenseData.amount,
            currency: processedExpenseData.currency_code,
            confidence: processedExpenseData.field_confidences.amount || 0.9
          },
          overallConfidence: processedExpenseData.confidence_score,
          documentQuality: 'good'
        };

        const extractionService = new InvoiceExtractionService({
          companyDefaultCurrency: processedExpenseData.currency_code,
          enableTaxValidation: true,
          strictModeEnabled: false,
          confidenceThreshold: 0.6
        });

        extractionService.extractInvoiceFromOCR(
          mockOcrData,
          processingTime,
          'ingrid-ai'
        ).then(invoiceStruct => {
          setInvoiceStructure(invoiceStruct);
        }).catch(error => {
          console.error('Failed to create invoice structure:', error);
        });

        toast({
          title: "Document Processed Successfully",
          description: `Ingrid analyzed your ${file.name} with ${Math.round(response.confidence)}% confidence.`,
        });

        // Automatically proceed to step 2 to show the invoice view
        setTimeout(() => {
          setCurrentStep(2);
        }, 1000); // Small delay to let user see the success message
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

        // Create document preview URL for manual entry too
        const previewUrl = URL.createObjectURL(file);
        setDocumentPreviewUrl(previewUrl);

        // Create basic invoice structure for manual entry
        const basicOcrData: InvoiceOCRData = {
          header: {
            invoiceNumber: null,
            purchaseOrderNumber: null,
            issueDate: new Date().toISOString(),
            dueDate: null,
            reference: null
          },
          vendor: {
            name: 'Unknown Vendor',
            address: null,
            phone: null,
            email: null,
            website: null,
            taxNumber: null
          },
          billTo: {
            name: 'Your Company',
            address: 'Your Company Address'
          },
          lineItems: [{
            lineNumber: 1,
            description: 'Enter description',
            quantity: 1,
            unitPrice: 0,
            amount: 0,
            productCode: null,
            taxRate: 0.13,
            taxAmount: 0,
            confidence: 0.5
          }],
          taxes: [{
            type: 'Sales Tax',
            rate: 0.13,
            baseAmount: 0,
            taxAmount: 0,
            jurisdiction: 'Unknown',
            confidence: 0.5
          }],
          totals: {
            subtotal: 0,
            totalTax: 0,
            grandTotal: 0,
            currency: 'USD',
            confidence: 0.5
          },
          overallConfidence: 0.5,
          documentQuality: 'unknown'
        };

        const extractionService = new InvoiceExtractionService({
          companyDefaultCurrency: 'USD',
          enableTaxValidation: true,
          strictModeEnabled: false,
          confidenceThreshold: 0.6
        });

        extractionService.extractInvoiceFromOCR(
          basicOcrData,
          processingTime,
          'manual-entry'
        ).then(invoiceStruct => {
          setInvoiceStructure(invoiceStruct);
        }).catch(error => {
          console.error('Failed to create manual invoice structure:', error);
        });

        toast({
          title: "AI Processing Failed",
          description: "Please enter expense details manually.",
          variant: "default"
        });

        // Proceed to step 2 for manual entry
        setTimeout(() => {
          setCurrentStep(2);
        }, 1000); // Small delay to let user see the message
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

      // Proceed to step 2 even on error for manual entry
      setTimeout(() => {
        setCurrentStep(2);
      }, 1000); // Small delay to let user see the error message
    } finally {
      setIsProcessing(false);
    }
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

  // Add new line item handler
  const handleAddLineItem = useCallback(() => {
    if (!invoiceStructure) return;

    const newLineItem: InvoiceLineItem = {
      id: `line-${Date.now()}`, // Temporary ID
      description: '',
      quantity: 1,
      unit_price: 0,
      line_amount: 0,
      currency_code: invoiceStructure.summary.currency,
      lineNumber: invoiceStructure.lineItems.length + 1,
      productCode: null,
      taxRate: null,
      taxAmount: null,
      discountRate: null,
      discountAmount: null,
      netAmount: 0,
      grossAmount: 0,
      taxJurisdiction: null,
      taxType: null,
      confidence: 0.0, // Manual entry has no AI confidence
    };

    setInvoiceStructure({
      ...invoiceStructure,
      lineItems: [...invoiceStructure.lineItems, newLineItem],
      // Update summary to reflect new line item
      summary: {
        ...invoiceStructure.summary,
        subtotal: invoiceStructure.summary.subtotal + newLineItem.line_amount,
        grandTotal: invoiceStructure.summary.grandTotal + newLineItem.line_amount,
      }
    });
  }, [invoiceStructure, setInvoiceStructure]);

  // Remove line item handler
  const handleRemoveLineItem = useCallback((lineIndex: number) => {
    if (!invoiceStructure) return;

    const removedItem = invoiceStructure.lineItems[lineIndex];
    const updatedLineItems = invoiceStructure.lineItems.filter((_, index) => index !== lineIndex);

    // Renumber remaining line items
    const renumberedLineItems = updatedLineItems.map((item, index) => ({
      ...item,
      lineNumber: index + 1
    }));

    setInvoiceStructure({
      ...invoiceStructure,
      lineItems: renumberedLineItems,
      // Update summary to reflect removed line item
      summary: {
        ...invoiceStructure.summary,
        subtotal: invoiceStructure.summary.subtotal - removedItem.line_amount,
        grandTotal: invoiceStructure.summary.grandTotal - removedItem.line_amount,
      }
    });
  }, [invoiceStructure, setInvoiceStructure]);

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
              isProcessing={isProcessing}
              securityContext={securityContext}
              onProcessingStart={() => setProcessingStartTime(Date.now())}
              companyId={profile?.company_id}
            />
          )}

          {currentStep === 2 && processedData && invoiceStructure && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Review Invoice Details</h3>
                <p className="text-sm text-muted-foreground">
                  Review and edit the extracted information from your document
                </p>
              </div>
              <DualColumnInvoiceView
                invoiceData={invoiceStructure}
                documentUrl={documentPreviewUrl}
                documentFile={uploadedFile}
                onFieldEdit={(fieldPath: string, newValue: any) => {
                  // Handle field edits - sync with form data
                  if (fieldPath === 'header.vendorName' && formData) {
                    setFormData({ ...formData, vendor_name: newValue });
                  }
                  // Add more field syncing as needed
                }}
                onLineItemEdit={(lineIndex: number, field: string, value: any) => {
                  // Handle line item edits
                  if (field === 'description' && formData) {
                    setFormData({ ...formData, description: value });
                  }
                  if (field === 'line_amount' && formData) {
                    setFormData({ ...formData, amount: value });
                  }
                }}
                onTaxEdit={(taxIndex: number, field: string, value: any) => {
                  // Handle tax edits
                  if (field === 'taxAmount' && formData) {
                    setFormData({ ...formData, tax_amount: value });
                  }
                }}
                onAddLineItem={handleAddLineItem}
                onRemoveLineItem={handleRemoveLineItem}
                editable={true}
                className="h-[500px]"
              />
            </div>
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