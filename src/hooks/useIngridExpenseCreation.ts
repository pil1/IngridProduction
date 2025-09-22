/**
 * useIngridExpenseCreation Hook
 *
 * Custom hook for managing Ingrid-powered expense creation workflow,
 * including validation, submission, and database operations.
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ProcessedExpenseData } from '@/components/ingrid/IngridExpenseCreationDialog';

interface ExpenseSubmissionData extends ProcessedExpenseData {
  company_id: string;
  user_id: string;
  document_file?: File | null;
  ingrid_metadata?: {
    confidence_score: number;
    suggestions: string[];
    field_confidences: Record<string, number>;
    ingrid_response_id?: string;
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export const useIngridExpenseCreation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isValidating, setIsValidating] = useState(false);

  // Validate expense data
  const validateExpenseData = useCallback(async (data: ProcessedExpenseData): Promise<ValidationResult> => {
    setIsValidating(true);

    try {
      const errors: Record<string, string> = {};
      const warnings: Record<string, string> = {};

      // Required field validation
      if (!data.description?.trim()) {
        errors.description = 'Description is required';
      }

      if (!data.amount || data.amount <= 0) {
        errors.amount = 'Amount must be greater than 0';
      }

      if (!data.vendor_name?.trim()) {
        errors.vendor_name = 'Vendor name is required';
      }

      if (!data.expense_date) {
        errors.expense_date = 'Expense date is required';
      }

      if (!data.category?.trim()) {
        errors.category = 'Category is required';
      }

      // Business logic validation
      if (data.amount > 10000) {
        warnings.amount = 'Large expense amount - may require additional approval';
      }

      if (data.tax_amount && data.tax_amount > data.amount) {
        errors.tax_amount = 'Tax amount cannot exceed total amount';
      }

      // Date validation
      const expenseDate = new Date(data.expense_date);
      const today = new Date();
      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());

      if (expenseDate > today) {
        warnings.expense_date = 'Future expense date - please verify';
      }

      if (expenseDate < sixMonthsAgo) {
        warnings.expense_date = 'Old expense date - may affect approval process';
      }

      // Confidence-based warnings
      if (data.confidence_score < 0.7) {
        warnings.general = 'Low AI confidence - please review all fields carefully';
      }

      Object.entries(data.field_confidences).forEach(([field, confidence]) => {
        if (confidence < 0.6) {
          warnings[field] = `Low confidence for ${field} - please verify`;
        }
      });

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
        warnings
      };

    } finally {
      setIsValidating(false);
    }
  }, []);

  // Upload document to storage
  const uploadDocument = useCallback(async (file: File, companyId: string, expenseId: string): Promise<string | null> => {
    try {
      const fileExtension = file.name.split('.').pop();
      const fileName = `${expenseId}.${fileExtension}`;
      const filePath = `${companyId}/expenses/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('expense-documents')
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) {
        console.error('Document upload error:', uploadError);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from('expense-documents')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;

    } catch (error) {
      console.error('Document upload error:', error);
      return null;
    }
  }, []);

  // Submit expense mutation
  const submitExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseSubmissionData): Promise<string> => {
      // Step 1: Insert the expense record
      const expenseData = {
        company_id: data.company_id,
        user_id: data.user_id,
        description: data.description,
        amount: data.amount,
        vendor_name: data.vendor_name,
        expense_date: data.expense_date,
        category_id: data.category_id,
        gl_account_code: data.gl_account_code || null,
        tax_amount: data.tax_amount || null,
        currency_code: data.currency_code,
        status: 'pending_review',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Ingrid-specific metadata
        ingrid_processed: true,
        ingrid_confidence_score: data.ingrid_metadata?.confidence_score || null,
        ingrid_suggestions: data.ingrid_metadata?.suggestions || [],
        ingrid_field_confidences: data.ingrid_metadata?.field_confidences || {},
        ingrid_response_id: data.ingrid_metadata?.ingrid_response_id || null,
        document_type: data.document_type
      };

      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select('id')
        .single();

      if (expenseError) {
        throw new Error(`Failed to create expense: ${expenseError.message}`);
      }

      const expenseId = expense.id;

      // Step 2: Upload document if provided
      if (data.document_file) {
        const documentUrl = await uploadDocument(data.document_file, data.company_id, expenseId);

        if (documentUrl) {
          // Update expense with document URL
          const { error: updateError } = await supabase
            .from('expenses')
            .update({
              receipt_url: documentUrl,
              document_name: data.document_file.name,
              document_size: data.document_file.size,
              document_mime_type: data.document_file.type
            })
            .eq('id', expenseId);

          if (updateError) {
            console.error('Failed to update expense with document URL:', updateError);
          }
        }
      }

      // Step 3: Create audit trail entry
      try {
        await supabase
          .from('expense_audit_log')
          .insert({
            expense_id: expenseId,
            action: 'created',
            user_id: data.user_id,
            details: {
              method: 'ingrid_ai',
              confidence_score: data.ingrid_metadata?.confidence_score,
              document_processed: !!data.document_file,
              field_count: Object.keys(data.ingrid_metadata?.field_confidences || {}).length
            },
            timestamp: new Date().toISOString()
          });
      } catch (auditError) {
        console.error('Failed to create audit log entry:', auditError);
        // Don't fail the expense creation for audit log errors
      }

      return expenseId;
    },
    onSuccess: (expenseId) => {
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expensesWithSubmitter'] });
      queryClient.invalidateQueries({ queryKey: ['expense', expenseId] });

      toast({
        title: "Expense Created Successfully",
        description: "Your expense has been created with Ingrid's AI assistance.",
      });
    },
    onError: (error) => {
      console.error('Expense submission error:', error);
      toast({
        title: "Expense Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create expense. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Public interface
  const submitExpense = useCallback(async (data: ExpenseSubmissionData): Promise<string> => {
    // Validate data before submission
    const validation = await validateExpenseData(data);

    if (!validation.isValid) {
      const errorMessages = Object.values(validation.errors).join(', ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    // Show warnings if any
    if (Object.keys(validation.warnings).length > 0) {
      const warningMessages = Object.values(validation.warnings).join(', ');
      toast({
        title: "Please Review",
        description: warningMessages,
        variant: "default"
      });
    }

    return submitExpenseMutation.mutateAsync(data);
  }, [validateExpenseData, submitExpenseMutation, toast]);

  return {
    validateExpenseData,
    submitExpense,
    isValidating,
    isSubmitting: submitExpenseMutation.isPending,
    submitError: submitExpenseMutation.error
  };
};