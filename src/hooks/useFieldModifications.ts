/**
 * Field Modifications Hook
 *
 * Manages field modification tracking, including recording changes,
 * fetching modification history, and handling audit trail data.
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FieldSource } from '@/types/expenses';
import { FieldModification } from '@/components/expenses/tracking/FieldModificationTracker';
import { toast } from 'sonner';

export interface RecordModificationParams {
  expenseId: string;
  fieldName: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  source: FieldSource;
  modifiedBy: string;
  confidenceScore?: number;
  changeReason?: string;
}

export interface FieldModificationStats {
  totalModifications: number;
  aiModifications: number;
  manualModifications: number;
  overrideModifications: number;
  averageConfidence: number;
  mostModifiedFields: Array<{
    fieldName: string;
    count: number;
  }>;
}

export const useFieldModifications = (expenseId?: string) => {
  const queryClient = useQueryClient();
  const [isRecording, setIsRecording] = useState(false);

  // Fetch modifications for a specific expense
  const {
    data: modifications = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['fieldModifications', expenseId],
    queryFn: async () => {
      if (!expenseId) return [];

      const { data, error } = await supabase
        .from('field_modifications')
        .select(`
          id,
          field_name,
          old_value,
          new_value,
          source,
          modified_by,
          modified_at,
          confidence_score,
          change_reason,
          validation_status,
          modified_by_profile:profiles!modified_by (
            full_name,
            email
          )
        `)
        .eq('expense_id', expenseId)
        .order('modified_at', { ascending: false });

      if (error) throw error;

      return data.map(mod => ({
        ...mod,
        modified_by_name: mod.modified_by_profile?.full_name || mod.modified_by_profile?.email || 'Unknown'
      })) as FieldModification[];
    },
    enabled: !!expenseId,
  });

  // Record a field modification
  const recordModification = useMutation({
    mutationFn: async (params: RecordModificationParams) => {
      setIsRecording(true);

      const { data, error } = await supabase
        .from('field_modifications')
        .insert({
          expense_id: params.expenseId,
          field_name: params.fieldName,
          old_value: params.oldValue?.toString() || null,
          new_value: params.newValue?.toString() || null,
          source: params.source,
          modified_by: params.modifiedBy,
          confidence_score: params.confidenceScore || null,
          change_reason: params.changeReason || null,
          validation_status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, params) => {
      // Invalidate and refetch modifications for this expense
      queryClient.invalidateQueries({
        queryKey: ['fieldModifications', params.expenseId]
      });

      // Also invalidate expense data to reflect the change
      queryClient.invalidateQueries({
        queryKey: ['expenses']
      });

      toast.success('Field modification recorded', {
        description: `Updated ${params.fieldName} field`
      });
    },
    onError: (error) => {
      console.error('Failed to record field modification:', error);
      toast.error('Failed to record modification', {
        description: 'Please try again or contact support'
      });
    },
    onSettled: () => {
      setIsRecording(false);
    }
  });

  // Calculate modification statistics
  const stats: FieldModificationStats = useMemo(() => {
    const totalModifications = modifications.length;
    const aiModifications = modifications.filter(m => m.source === 'ai').length;
    const manualModifications = modifications.filter(m => m.source === 'manual').length;
    const overrideModifications = modifications.filter(m => m.source === 'override').length;

    const confidenceScores = modifications
      .filter(m => m.confidence_score !== null)
      .map(m => m.confidence_score!);

    const averageConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : 0;

    // Count modifications by field
    const fieldCounts = modifications.reduce((counts, mod) => {
      counts[mod.field_name] = (counts[mod.field_name] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const mostModifiedFields = Object.entries(fieldCounts)
      .map(([fieldName, count]) => ({ fieldName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalModifications,
      aiModifications,
      manualModifications,
      overrideModifications,
      averageConfidence,
      mostModifiedFields
    };
  }, [modifications]);

  // Helper function to track field changes automatically
  const trackFieldChange = useCallback(async (
    fieldName: string,
    oldValue: any,
    newValue: any,
    userId: string,
    options: {
      source?: FieldSource;
      confidenceScore?: number;
      changeReason?: string;
    } = {}
  ) => {
    if (!expenseId || oldValue === newValue) return;

    const source = options.source || 'manual';

    await recordModification.mutateAsync({
      expenseId,
      fieldName,
      oldValue,
      newValue,
      source,
      modifiedBy: userId,
      confidenceScore: options.confidenceScore,
      changeReason: options.changeReason
    });
  }, [expenseId, recordModification]);

  // Get modifications for a specific field
  const getFieldModifications = useCallback((fieldName: string) => {
    return modifications.filter(mod => mod.field_name === fieldName);
  }, [modifications]);

  // Get the latest modification for a field
  const getLatestFieldModification = useCallback((fieldName: string) => {
    const fieldMods = getFieldModifications(fieldName);
    return fieldMods.length > 0 ? fieldMods[0] : null;
  }, [getFieldModifications]);

  // Check if a field has been modified
  const isFieldModified = useCallback((fieldName: string) => {
    return getFieldModifications(fieldName).length > 0;
  }, [getFieldModifications]);

  // Get field source (AI, manual, etc.)
  const getFieldSource = useCallback((fieldName: string): FieldSource | null => {
    const latestMod = getLatestFieldModification(fieldName);
    return latestMod ? latestMod.source : null;
  }, [getLatestFieldModification]);

  return {
    // Data
    modifications,
    stats,
    isLoading,
    error,

    // Mutations
    recordModification: recordModification.mutateAsync,
    isRecording: isRecording || recordModification.isPending,

    // Helper functions
    trackFieldChange,
    getFieldModifications,
    getLatestFieldModification,
    isFieldModified,
    getFieldSource,

    // Computed values
    hasModifications: modifications.length > 0,
    modifiedFields: [...new Set(modifications.map(m => m.field_name))]
  };
};

// Hook for fetching company-wide modification statistics
export const useCompanyFieldModifications = (companyId?: string, dateRange?: {
  start: Date;
  end: Date;
}) => {
  return useQuery({
    queryKey: ['companyFieldModifications', companyId, dateRange],
    queryFn: async () => {
      if (!companyId) return [];

      let query = supabase
        .from('field_modifications')
        .select(`
          id,
          field_name,
          source,
          modified_at,
          confidence_score,
          expense:expenses!inner (
            id,
            company_id
          )
        `)
        .eq('expense.company_id', companyId);

      if (dateRange) {
        query = query
          .gte('modified_at', dateRange.start.toISOString())
          .lte('modified_at', dateRange.end.toISOString());
      }

      const { data, error } = await query
        .order('modified_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
};